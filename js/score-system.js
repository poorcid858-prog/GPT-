/**
 * 计分系统模块
 * 负责：单球得分计算（命中/Perfect/Swish）、三分判定、得分累加
 * 设计原则：纯逻辑层，只改 gameState 数据，不操作 DOM；事件由事件总线消费
 *
 * 判定顺序（重要）：
 *   1) isMade       是否进入篮筐得分区
 *   2) isThreePoint 出手距离是否达到三分线
 *   3) isPerfect    中心偏差是否 ≤ 阈值
 *   4) isSwish      飞行全程未碰篮筐边缘
 * 得分构成：基础分（2 或 3） + Perfect +1 + Swish +1
 */

(function (global) {
    'use strict'

    // 三分线半径（出手距离 ≥ 该值记 3 分）
    const THREE_POINT_RADIUS = 300

    // 简易事件总线（由 main.js 注入或被外部覆盖）
    const listeners = {}
    function emit(eventName, payload) {
        const arr = listeners[eventName]
        if (!arr) return
        for (let i = 0; i < arr.length; i++) {
            try { arr[i](payload) } catch (e) { /* 忽略回调异常 */ }
        }
    }

    /**
     * 订阅事件
     * @param {string} eventName 事件名（'score' | 'perfect' | 'swish' | 'three'）
     * @param {Function} handler 回调函数
     */
    function on(eventName, handler) {
        if (!listeners[eventName]) listeners[eventName] = []
        listeners[eventName].push(handler)
    }

    /**
     * 清除某事件的所有监听
     * @param {string} eventName
     */
    function off(eventName) {
        if (eventName) delete listeners[eventName]
    }

    /**
     * 是否命中（球心在篮筐得分判定区）
     * @param {Object} ball {x, y, radius}
     * @param {Object} rim {x, y, width}
     * @returns {boolean}
     */
    function isMade(ball, rim) {
        if (!ball || !rim) return false
        const half = rim.width / 2 + 8  // 容差 8px（与 config.rim.tolerance 对齐）
        const dx = Math.abs(ball.x - rim.x)
        const dy = Math.abs(ball.y - rim.y)
        return dx < half && dy < ball.radius
    }

    /**
     * 是否三分球（出手位置距离篮筐 ≥ 三分线）
     * @param {Object} shootFrom 出手点 {x, y}
     * @param {Object} rim 篮筐中心 {x, y}
     * @returns {boolean}
     */
    function isThreePoint(shootFrom, rim) {
        if (!shootFrom || !rim) return false
        const dx = shootFrom.x - rim.x
        const dy = shootFrom.y - rim.y
        return Math.hypot(dx, dy) >= THREE_POINT_RADIUS
    }

    /**
     * 是否 Perfect（球心与篮筐中心偏差 ≤ 阈值）
     * @param {Object} ball
     * @param {Object} rim
     * @returns {boolean}
     */
    function isPerfect(ball, rim) {
        if (!ball || !rim) return false
        return Math.abs(ball.x - rim.x) <= 12  // perfectThreshold
    }

    /**
     * 是否 Swish（空心入网：飞行全程未碰篮筐边缘）
     * @param {Object} ball 需带 hitRim 标记
     * @returns {boolean}
     */
    function isSwish(ball) {
        if (!ball) return false
        return ball.hitRim !== true
    }

    /**
     * 计算单球得分（含基础分 + Perfect + Swish）
     * 顺序：isMade → isPerfect → isSwish
     * @param {Object} ball 篮球对象（需带 hitRim）
     * @param {Object} rim 篮筐对象
     * @param {Object} [shootFrom] 出手点（用于三分判定）；省略时按 2 分
     * @returns {Object} {made:boolean, three:boolean, perfect:boolean, swish:boolean, base:number, bonus:number, points:number}
     */
    function calculatePoints(ball, rim, shootFrom) {
        const made = isMade(ball, rim)
        if (!made) {
            return { made: false, three: false, perfect: false, swish: false, base: 0, bonus: 0, points: 0 }
        }

        // 基础分：三分 / 二分
        const three = isThreePoint(shootFrom, rim)
        const base = three ? 3 : 2

        // 额外奖励（按顺序判定）
        const perfect = isPerfect(ball, rim)
        const swish = isSwish(ball)  // 命中时仍检查 Swish
        let bonus = 0
        if (perfect) bonus += 1
        if (swish) bonus += 1

        return {
            made: true,
            three: three,
            perfect: perfect,
            swish: swish,
            base: base,
            bonus: bonus,
            points: base + bonus
        }
    }

    /**
     * 应用得分到 gameState，触发事件
     * 注意：仅当 made=true 时才累加；Miss 应由 game-rules.js 走另外分支
     * @param {Object} gameState
     * @param {Object} scoreResult calculatePoints 返回值
     * @returns {number} 实际累加的分值
     */
    function applyScore(gameState, scoreResult) {
        if (!gameState || !scoreResult || !scoreResult.made) return 0
        const points = scoreResult.points
        gameState.score += points
        gameState.made += 1
        emit('score', { points, total: gameState.score, result: scoreResult })
        if (scoreResult.perfect) emit('perfect', { points: 1, result: scoreResult })
        if (scoreResult.swish) emit('swish', { points: 1, result: scoreResult })
        if (scoreResult.three) emit('three', { points: 3, result: scoreResult })
        return points
    }

    // 暴露到全局（兼容普通 <script> 引入）
    global.ScoreSystem = {
        THREE_POINT_RADIUS,
        isMade,
        isThreePoint,
        isPerfect,
        isSwish,
        calculatePoints,
        applyScore,
        on,
        off
    }
})(typeof window !== 'undefined' ? window : globalThis)
