/**
 * 倒计时模块
 * 负责：开始计时、每帧倒计时推进、最后 5 秒红色闪烁提示
 * 设计原则：纯逻辑层；绘制由 drawTimer 提供；暂停时计时停止
 *
 * 数据约定：
 *   gameState.timeLeft  - 剩余秒数（float）
 *   gameState.timer.running - 是否在走（暂停时为 false）
 *   gameState.timer.urgent  - 是否进入紧急闪烁（最后 5 秒）
 */

(function (global) {
    'use strict'

    // 默认时长与紧急阈值（可被外部配置覆盖）
    const DEFAULT_DURATION = 30
    const URGENT_SECONDS = 5

    // 闪烁周期（秒）：进入紧急后亮/暗各半周期
    const BLINK_PERIOD = 0.5

    // 简易事件总线
    const listeners = {}
    function emit(name, payload) {
        const arr = listeners[name]
        if (!arr) return
        for (let i = 0; i < arr.length; i++) {
            try { arr[i](payload) } catch (e) { /* 忽略回调异常 */ }
        }
    }
    function on(name, fn) {
        if (!listeners[name]) listeners[name] = []
        listeners[name].push(fn)
    }

    /**
     * 启动一次新计时（写入 gameState.timer）
     * @param {Object} gameState
     * @param {number} [duration] 倒计时秒数（缺省 30）
     */
    function startTimer(gameState, duration) {
        if (!gameState.timer) gameState.timer = {}
        const total = (typeof duration === 'number' && duration > 0) ? duration : DEFAULT_DURATION
        gameState.duration = total
        gameState.timeLeft = total
        gameState.timer.running = true
        gameState.timer.urgent = false
        gameState.timer.blinkPhase = 0
    }

    /**
     * 暂停计时（保留 timeLeft）
     * @param {Object} gameState
     */
    function pauseTimer(gameState) {
        if (!gameState.timer) return
        gameState.timer.running = false
    }

    /**
     * 恢复计时
     * @param {Object} gameState
     */
    function resumeTimer(gameState) {
        if (!gameState.timer) gameState.timer = {}
        if (gameState.timeLeft > 0) gameState.timer.running = true
    }

    /**
     * 每帧推进倒计时
     * - running=false 时不推进（暂停）
     * - 进入紧急区（前 5 秒）时切换 urgent 标志，并累计闪烁相位
     * - 倒计时归零时停止并 emit('timeup')
     * @param {number} dt 秒
     * @param {Object} gameState
     * @param {Object} [ui] 可选 UI 描述对象，由 main.js 传入（不直接操作 DOM）
     * @returns {Object} {timeLeft, urgent, expired}
     */
    function updateTimer(dt, gameState, ui) {
        if (!gameState.timer) gameState.timer = {}
        // 防止异常 dt（如切后台后第一帧）
        const safeDt = Math.max(0, Math.min(0.1, dt))

        if (gameState.timer.running && gameState.timeLeft > 0) {
            gameState.timeLeft = Math.max(0, gameState.timeLeft - safeDt)
            // 紧急判定
            const wasUrgent = gameState.timer.urgent
            const nowUrgent = gameState.timeLeft <= URGENT_SECONDS
            if (nowUrgent) {
                gameState.timer.blinkPhase = (gameState.timer.blinkPhase || 0) + safeDt
                if (gameState.timer.blinkPhase >= BLINK_PERIOD) {
                    gameState.timer.blinkPhase -= BLINK_PERIOD
                }
            } else {
                gameState.timer.blinkPhase = 0
            }
            if (!wasUrgent && nowUrgent) {
                emit('urgent', { timeLeft: gameState.timeLeft })
            }
        }

        // 归零判定
        if (gameState.timeLeft <= 0 && gameState.timer.running) {
            gameState.timeLeft = 0
            gameState.timer.running = false
            gameState.timer.urgent = true
            emit('timeup', { timeLeft: 0 })
        }

        // 同步到 UI 描述对象（可选）
        if (ui && typeof ui === 'object') {
            ui.timeLeft = gameState.timeLeft
            ui.urgent = !!gameState.timer.urgent
        }

        return {
            timeLeft: gameState.timeLeft,
            urgent: !!gameState.timer.urgent,
            expired: gameState.timeLeft <= 0
        }
    }

    /**
     * 是否处于紧急闪烁（最后 5 秒）
     * @param {Object} gameState
     * @returns {boolean}
     */
    function isUrgent(gameState) {
        return !!(gameState.timer && gameState.timer.urgent)
    }

    /**
     * 当前是否应该"亮"（闪烁相位前半周期）
     * @param {Object} gameState
     * @returns {boolean}
     */
    function isBlinkOn(gameState) {
        if (!isUrgent(gameState)) return true
        const phase = (gameState.timer.blinkPhase || 0) / BLINK_PERIOD
        return phase < 0.5
    }

    /**
     * 在 Canvas 顶部居中绘制倒计时
     * - 字号 64
     * - 紧急时红色，普通时白色
     * - 闪烁相位为"暗"时透明度 0.35
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} timeLeft 剩余秒数
     * @param {boolean} urgent 是否紧急
     * @param {number} [canvasWidth] 画布宽（用于居中）
     * @param {Object} [opts] {blinkOn:boolean, fontSize:number}
     */
    function drawTimer(ctx, timeLeft, urgent, canvasWidth, opts) {
        if (!ctx) return
        const w = (typeof canvasWidth === 'number') ? canvasWidth : 800
        const o = opts || {}
        const blinkOn = (typeof o.blinkOn === 'boolean') ? o.blinkOn : true
        const fontSize = (typeof o.fontSize === 'number') ? o.fontSize : 64
        const seconds = Math.max(0, Math.ceil(timeLeft || 0))

        ctx.save()
        ctx.font = `bold ${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // 紧急且当前是"暗"相位 → 半透明
        const alpha = (urgent && !blinkOn) ? 0.35 : 1
        ctx.globalAlpha = alpha

        // 文字描边（增强可读性）
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
        ctx.strokeText(String(seconds), w / 2, 60)

        // 文字填充
        ctx.fillStyle = urgent ? '#FF3B30' : '#FFFFFF'
        ctx.fillText(String(seconds), w / 2, 60)

        ctx.restore()
    }

    /**
     * 把毫秒格式化为 "SS" 或 "MM:SS"
     * @param {number} sec
     * @returns {string}
     */
    function formatTime(sec) {
        const s = Math.max(0, Math.floor(sec || 0))
        const mm = Math.floor(s / 60)
        const ss = s % 60
        if (mm <= 0) return String(ss).padStart(2, '0')
        return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    }

    // 暴露到全局
    global.TimerSystem = {
        DEFAULT_DURATION,
        URGENT_SECONDS,
        BLINK_PERIOD,
        startTimer,
        pauseTimer,
        resumeTimer,
        updateTimer,
        isUrgent,
        isBlinkOn,
        drawTimer,
        formatTime,
        on
    }
})(typeof window !== 'undefined' ? window : globalThis)
