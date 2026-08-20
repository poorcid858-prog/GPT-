/**
 * 重新开始模块
 * 负责：Play Again 触发后的完整状态重置
 * 设计原则：纯逻辑层；调用后 gameState 回到 PLAYING 初始态，UI 由 Render 阶段重画
 *
 * 重置内容：
 *   1) 清除所有特效数组（popups / particles / toasts）
 *   2) 核心数据归零（score, combo, maxCombo, shots, made, timeLeft）
 *   3) 状态机回到 PLAYING，输入解锁
 *   4) 篮球归位到 ballStart，篮筐归位到 rimPosition
 *   5) 计时器重新启动（duration 来自 gameState.duration）
 *   6) 清空结算面板动画状态
 */

(function (global) {
    'use strict'

    // 简易事件总线
    const listeners = {}
    function emit(name, payload) {
        const arr = listeners[name]
        if (!arr) return
        for (let i = 0; i < arr.length; i++) {
            try { arr[i](payload) } catch (e) { /* ignore */ }
        }
    }
    function on(name, fn) {
        if (!listeners[name]) listeners[name] = []
        listeners[name].push(fn)
    }

    /**
     * 完整重置游戏状态（幂等：可重复调用，状态始终一致）
     * @param {Object} gameState
     * @returns {Object} gameState（便于链式）
     */
    function restartGame(gameState) {
        if (!gameState) return null

        // 1) 清空所有特效数组
        clearEffects(gameState)

        // 2) 核心数据归零
        resetCoreStats(gameState)

        // 3) 状态机回到 PLAYING，解锁输入
        gameState.phase = 'PLAYING'
        gameState.inputLocked = false
        gameState.shotResolved = true  // 重开后等待下一次出手
        gameState.lastShotResult = null

        // 4) 篮球归位
        resetBall(gameState)

        // 5) 篮筐归位（重置回中央）
        resetRim(gameState)

        // 6) 重启计时
        restartTimer(gameState)

        // 7) 清空结算面板动画
        if (gameState.resultAnim) {
            gameState.resultAnim.visible = false
            gameState.resultAnim.rows = []
            gameState.resultAnim.startedAt = 0
        }
        gameState.lastStats = null

        emit('restart', { gameState })
        return gameState
    }

    /**
     * 清空 popups / particles / toasts 数组
     * @param {Object} gameState
     */
    function clearEffects(gameState) {
        const arrs = ['popups', 'particles', 'toasts']
        for (let i = 0; i < arrs.length; i++) {
            const k = arrs[i]
            if (Array.isArray(gameState[k])) gameState[k].length = 0
            else gameState[k] = []
        }
    }

    /**
     * 核心数据归零（score / combo / maxCombo / shots / made / timeLeft）
     * @param {Object} gameState
     */
    function resetCoreStats(gameState) {
        gameState.score = 0
        gameState.combo = 0
        gameState.maxCombo = 0
        gameState.shots = 0
        gameState.made = 0
        // timeLeft 由 restartTimer 处理

        // combo 动画回到基线
        if (!gameState.comboAnim) {
            gameState.comboAnim = { scale: 1.0, age: 0, target: 1.0 }
        } else {
            gameState.comboAnim.scale = 1.0
            gameState.comboAnim.age = 0
            gameState.comboAnim.target = 1.0
        }
    }

    /**
     * 篮球归位到 ballStart
     * @param {Object} gameState
     */
    function resetBall(gameState) {
        if (!gameState.ball) gameState.ball = {}
        const start = gameState.ballStart || { x: 0, y: 0 }
        gameState.ball.x = start.x
        gameState.ball.y = start.y
        gameState.ball.vx = 0
        gameState.ball.vy = 0
        gameState.ball.prevX = start.x
        gameState.ball.prevY = start.y
        gameState.ball.rotation = 0
        gameState.ball.rotationSpeed = 0
        gameState.ball.flightTime = 0
        gameState.ball.inFlight = false
        gameState.ball.settled = true
        gameState.ball.hitRim = false
        // 出手点也清掉（影响三分判定）
        gameState.lastShootFrom = null
    }

    /**
     * 篮筐归位到 rimPosition（默认画布中央）
     * @param {Object} gameState
     */
    function resetRim(gameState) {
        if (!gameState.rim) gameState.rim = {}
        const pos = gameState.rimPosition || { x: 0, y: 0 }
        gameState.rim.x = pos.x
        gameState.rim.y = pos.y
        // width 保留 config 初始值
        if (typeof gameState.rim.width !== 'number') {
            gameState.rim.width = 90
        }
        // 篮网动画状态清空（直接操作 rim.net）
        if (gameState.rim && gameState.rim.net) {
            gameState.rim.net.state = 'normal'
            gameState.rim.net.swing = 0
            gameState.rim.net.timer = 0
        }
    }

    /**
     * 重启计时（优先用 gameState.duration，否则默认 30）
     * @param {Object} gameState
     */
    function restartTimer(gameState) {
        if (typeof global.TimerSystem !== 'undefined' && global.TimerSystem.startTimer) {
            const dur = (typeof gameState.duration === 'number' && gameState.duration > 0)
                ? gameState.duration
                : 30
            global.TimerSystem.startTimer(gameState, dur)
        } else {
            // 兜底：直接写字段
            if (!gameState.timer) gameState.timer = {}
            const dur = (typeof gameState.duration === 'number' && gameState.duration > 0)
                ? gameState.duration
                : 30
            gameState.duration = dur
            gameState.timeLeft = dur
            gameState.timer.running = true
            gameState.timer.urgent = false
            gameState.timer.blinkPhase = 0
        }
    }

    /**
     * 软重置：仅清空本局数据（不进 PLAYING）。一般外部不需要。
     * @param {Object} gameState
     */
    function softReset(gameState) {
        clearEffects(gameState)
        resetCoreStats(gameState)
        resetBall(gameState)
        resetRim(gameState)
        if (gameState.timer) {
            gameState.timer.running = false
            gameState.timer.urgent = false
        }
        gameState.shotResolved = true
        gameState.lastShotResult = null
    }

    // 暴露到全局
    global.RestartSystem = {
        restartGame,
        clearEffects,
        resetCoreStats,
        resetBall,
        resetRim,
        restartTimer,
        softReset,
        on
    }
})(typeof window !== 'undefined' ? window : globalThis)
