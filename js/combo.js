/**
 * 连击（Combo）系统模块
 * 负责：连击计数、归零、最高连击记录、平滑放大动画
 * 设计原则：纯逻辑层；动画数据写回 gameState.comboAnim，由 Render 阶段读取绘制
 *
 * 规则：
 *   - 命中 combo = min(combo + 1, 10)
 *   - Miss  combo = 0
 *   - 命中瞬间触发 scale 弹跳：0.6 → 1.3 → 1.0（指数缓动回归）
 */

(function (global) {
    'use strict'

    // 最大连击数（与 config.combo.max 一致）
    const MAX_COMBO = 10

    // 动画常量
    const PEAK_SCALE = 1.3   // 命中瞬间放大峰值
    const BASE_SCALE = 1.0   // 回归的目标缩放
    const START_SCALE = 0.6  // 初始/重置时缩放（可选用）

    // 平滑回归速度系数（dt 缩放，越大回得越快）
    const RETURN_RATE = 12

    /**
     * 确保 gameState.comboAnim 存在（首次调用时初始化）
     * @param {Object} gameState
     */
    function ensureAnim(gameState) {
        if (!gameState.comboAnim) {
            gameState.comboAnim = { scale: BASE_SCALE, age: 0, target: BASE_SCALE }
        }
        if (typeof gameState.combo !== 'number') gameState.combo = 0
        if (typeof gameState.maxCombo !== 'number') gameState.maxCombo = 0
    }

    /**
     * 命中时调用：combo +1（封顶 10），更新 maxCombo，触发放大动画
     * @param {Object} gameState
     * @returns {number} 新的 combo 值
     */
    function onHit(gameState) {
        ensureAnim(gameState)
        gameState.combo = Math.min(gameState.combo + 1, MAX_COMBO)
        if (gameState.combo > gameState.maxCombo) {
            gameState.maxCombo = gameState.combo
        }
        // 触发命中瞬间放大峰值
        gameState.comboAnim.scale = PEAK_SCALE
        gameState.comboAnim.target = BASE_SCALE
        return gameState.combo
    }

    /**
     * Miss 时调用：combo 归零
     * @param {Object} gameState
     */
    function onMiss(gameState) {
        ensureAnim(gameState)
        gameState.combo = 0
        // Miss 不重置 maxCombo（结算用），但动画回到基础缩放
        gameState.comboAnim.target = BASE_SCALE
    }

    /**
     * 立即把 combo 设到指定值（用于初始化 / 重开）
     * @param {Object} gameState
     * @param {number} value
     */
    function setCombo(gameState, value) {
        ensureAnim(gameState)
        const v = Math.max(0, Math.min(MAX_COMBO, value | 0))
        gameState.combo = v
    }

    /**
     * 推进 combo 缩放动画（每帧调用）
     * 公式：scale += (target - scale) * rate * dt
     * 越接近 target 收敛越快，给手感提供自然回弹
     * @param {Object} gameState
     * @param {number} dt 秒
     */
    function updateComboAnimation(gameState, dt) {
        ensureAnim(gameState)
        const anim = gameState.comboAnim
        // 指数缓动
        const k = 1 - Math.exp(-RETURN_RATE * Math.max(0, dt))
        anim.scale += (anim.target - anim.scale) * k
        // 防止 NaN / 极端值
        if (!isFinite(anim.scale)) anim.scale = BASE_SCALE
        // 抖动到 0.0001 以内时硬收敛，避免长期微小插值
        if (Math.abs(anim.scale - anim.target) < 0.0005) {
            anim.scale = anim.target
        }
    }

    /**
     * 取得当前应当绘制的 combo 数字（>0 才显示）
     * @param {Object} gameState
     * @returns {string} 例如 "×3" 或 ""
     */
    function getComboLabel(gameState) {
        const c = gameState.combo | 0
        return c > 0 ? `×${c}` : ''
    }

    /**
     * 重置 combo 与动画（restart 时调用）
     * @param {Object} gameState
     */
    function resetCombo(gameState) {
        ensureAnim(gameState)
        gameState.combo = 0
        gameState.maxCombo = 0
        gameState.comboAnim.scale = BASE_SCALE
        gameState.comboAnim.target = BASE_SCALE
        gameState.comboAnim.age = 0
    }

    // 暴露到全局
    global.ComboSystem = {
        MAX_COMBO,
        PEAK_SCALE,
        BASE_SCALE,
        onHit,
        onMiss,
        setCombo,
        updateComboAnimation,
        getComboLabel,
        resetCombo
    }
})(typeof window !== 'undefined' ? window : globalThis)
