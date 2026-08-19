/**
 * 游戏结束与结算面板模块
 * 负责：进入 Game Over 状态、一次性计算统计数据、逐行延迟入场动画
 * 设计原则：纯逻辑层；动画数据写入 gameState.resultAnim，由 Render 阶段消费
 *
 * 阶段：
 *   PLAYING/PAUSED → GAME_OVER（handleGameOver）
 *   GAME_OVER      → MENU/PLAYING（restart.js）
 */

(function (global) {
    'use strict'

    // 结算面板行入场：每行间隔 120ms
    const ROW_INTERVAL_MS = 120
    // 第一行起始延迟 80ms
    const ROW_START_DELAY_MS = 80
    // 单行动画时长（ms）
    const ROW_ANIM_MS = 360

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
     * 进入游戏结束状态：停止输入、停止计时、生成结算
     * 注意：调用前确保本球已结算完（shotResolved=true）
     * @param {Object} gameState
     * @returns {Object} stats 结算数据
     */
    function handleGameOver(gameState) {
        if (!gameState) return null
        // 1) 状态机切换
        gameState.phase = 'GAME_OVER'
        // 2) 停止计时
        if (gameState.timer) gameState.timer.running = false
        // 3) 停止输入（input gate 标志）
        gameState.inputLocked = true
        // 4) 一次性统计
        const stats = calculateStats(gameState)
        gameState.lastStats = stats
        // 5) 逐行入场动画数据准备
        if (!gameState.resultAnim) gameState.resultAnim = {}
        gameState.resultAnim.startedAt = performance.now()
        gameState.resultAnim.visible = true
        gameState.resultAnim.rows = buildRowList(stats)
        // 6) 通知上层
        emit('gameover', { stats })
        // 7) 触发入场动画（异步启动各行 timer）
        showResultPanel(stats)
        return stats
    }

    /**
     * 一次性计算本局统计数据
     *   Score    - 当前得分
     *   Shots    - 出手总次数
     *   Made     - 命中次数
     *   Miss     - 未命中次数
     *   Accuracy - 命中率（0~100 整数百分比；0 shots 时返回 0）
     *   MaxCombo - 本局最高连击
     * @param {Object} gameState
     * @returns {Object} stats
     */
    function calculateStats(gameState) {
        const shots = gameState.shots | 0
        const made = gameState.made | 0
        const miss = Math.max(0, shots - made)
        let accuracy = 0
        if (shots > 0) {
            accuracy = Math.round((made / shots) * 100)
        }
        return {
            score: gameState.score | 0,
            shots,
            made,
            miss,
            accuracy,
            maxCombo: gameState.maxCombo | 0
        }
    }

    /**
     * 构造结算面板的展示行（label/value 单位等）
     * @param {Object} stats
     * @returns {Array<{key:string,label:string,value:string,unit:string}>}
     */
    function buildRowList(stats) {
        return [
            { key: 'score',     label: '得分',     value: String(stats.score),     unit: '' },
            { key: 'shots',     label: '出手',     value: String(stats.shots),     unit: '次' },
            { key: 'made',      label: '命中',     value: String(stats.made),      unit: '次' },
            { key: 'miss',      label: '未中',     value: String(stats.miss),      unit: '次' },
            { key: 'accuracy',  label: '命中率',   value: String(stats.accuracy),  unit: '%' },
            { key: 'maxCombo',  label: '最高连击', value: '×' + String(stats.maxCombo), unit: '' }
        ]
    }

    /**
     * 触发结算面板逐行延迟入场动画
     * 实际绘制由 Render 阶段读取 gameState.resultAnim.rows 与 progress
     * 这里负责"启动"——给每行打上目标入场时间，由 main.js 负责注册真实 UI
     * @param {Object} stats
     */
    function showResultPanel(stats) {
        const rows = buildRowList(stats)
        // 真实 DOM/UI 渲染由上层订阅 'result-row-show' 事件完成
        // 这里仅设置每行的 showAtMs 时间戳
        const now = performance.now()
        for (let i = 0; i < rows.length; i++) {
            rows[i].showAtMs = now + ROW_START_DELAY_MS + i * ROW_INTERVAL_MS
            rows[i].shown = false
        }
        emit('result-panel-show', { rows, stats })
    }

    /**
     * 计算单行当前动画进度（0~1）
     * - 0 → 未开始（应隐藏）
     * - 0~1 → 入场过程（淡入 + 上移）
     * - 1 → 完成（稳定显示）
     * @param {Object} row
     * @param {number} nowMs performance.now()
     * @returns {number} progress
     */
    function getRowProgress(row, nowMs) {
        if (!row) return 0
        const elapsed = nowMs - (row.showAtMs || 0)
        if (elapsed <= 0) return 0
        const p = Math.min(1, elapsed / ROW_ANIM_MS)
        return p
    }

    /**
     * 隐藏结算面板（用于 restart 后清理）
     * @param {Object} gameState
     */
    function hideResultPanel(gameState) {
        if (!gameState.resultAnim) return
        gameState.resultAnim.visible = false
        gameState.resultAnim.rows = []
        emit('result-panel-hide', {})
    }

    // 暴露到全局
    global.GameOverSystem = {
        ROW_INTERVAL_MS,
        ROW_START_DELAY_MS,
        ROW_ANIM_MS,
        handleGameOver,
        calculateStats,
        buildRowList,
        showResultPanel,
        getRowProgress,
        hideResultPanel,
        on
    }
})(typeof window !== 'undefined' ? window : globalThis)
