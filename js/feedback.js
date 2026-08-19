/**
 * 反馈弹窗模块
 * 负责：进球/Miss 等事件的瞬时文字反馈
 * 动画：scale 0.5 → 1.2 → 1，y 上移 40px，alpha 0.6s 渐隐
 * 文字：
 *   - Perfect 金色 PERFECT! +1
 *   - Swish 蓝色 SWISH!
 *   - Combo 放大 COMBO ×N
 *   - Miss 红色 MISS
 */

/**
 * 弹窗生命周期
 */
const POPUP_LIFE = 0.6            // 总生命（秒）
const POPUP_RISE_DISTANCE = 40    // 上移距离（像素）
const POPUP_START_SCALE = 0.5     // 起始缩放
const POPUP_PEAK_SCALE = 1.2      // 峰值缩放
const POPUP_END_SCALE = 1.0       // 结束缩放
// scale 阶段性时间比例：前 30% 升到峰值，30%~100% 回落到 1.0
const POPUP_PEAK_RATIO = 0.3

/**
 * 颜色预设
 */
const POPUP_COLOR_PERFECT = '#ffd700'   // 金
const POPUP_COLOR_SWISH = '#4fc3ff'     // 蓝
const POPUP_COLOR_COMBO = '#ff9800'     // 橙（强调连击）
const POPUP_COLOR_MISS = '#ff5252'      // 红
const POPUP_COLOR_NORMAL = '#ffffff'    // 白（普通得分）

/**
 * 创建得分弹窗
 *
 * @param {number} x - 显示位置 X
 * @param {number} y - 显示位置 Y
 * @param {string} text - 弹窗文字
 * @param {string} [color='#ffffff'] - 文字颜色
 * @param {boolean} [isPerfect=false] - 是否 Perfect（金色发光特效）
 * @param {Object} [opts] - 附加选项 {combo, big}
 * @returns {Object} 弹窗对象
 */
function spawnScorePopup(x, y, text, color = POPUP_COLOR_NORMAL, isPerfect = false, opts = {}) {
    return {
        x,
        y,
        originY: y,
        text: String(text),
        color,
        isPerfect: !!isPerfect,
        isCombo: !!opts.combo,
        big: !!opts.big,
        age: 0,
        life: POPUP_LIFE
    }
}

/** Perfect 弹窗 */
function popupPerfect(x, y) {
    return spawnScorePopup(x, y, 'PERFECT! +1', POPUP_COLOR_PERFECT, true)
}

/** Swish 弹窗 */
function popupSwish(x, y) {
    return spawnScorePopup(x, y, 'SWISH!', POPUP_COLOR_SWISH, false, { big: true })
}

/** Combo 弹窗 */
function popupCombo(x, y, n) {
    return spawnScorePopup(x, y, `COMBO ×${n}`, POPUP_COLOR_COMBO, false, { combo: true, big: true })
}

/** Miss 弹窗 */
function popupMiss(x, y) {
    return spawnScorePopup(x, y, 'MISS', POPUP_COLOR_MISS, false)
}

/** 普通得分弹窗 */
function popupScore(x, y, points) {
    return spawnScorePopup(x, y, `+${points}`, POPUP_COLOR_NORMAL, false)
}

/**
 * 更新所有弹窗（推进 age，过期则移除）
 * @param {Array<Object>} popups
 * @param {number} dt - 帧间隔（秒）
 */
function updatePopups(popups, dt) {
    if (!popups || popups.length === 0) return
    for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i]
        p.age += dt
        if (p.age >= p.life) {
            popups.splice(i, 1)
        }
    }
}

/**
 * 计算当前帧的 scale、alpha、offsetY
 * @param {Object} p
 * @returns {{scale:number, alpha:number, offsetY:number}}
 */
function computePopupState(p) {
    const t = Math.min(1, p.age / p.life)

    // 缩放两段插值
    let scale
    if (t < POPUP_PEAK_RATIO) {
        const k = t / POPUP_PEAK_RATIO
        scale = POPUP_START_SCALE + (POPUP_PEAK_SCALE - POPUP_START_SCALE) * k
    } else {
        const k = (t - POPUP_PEAK_RATIO) / (1 - POPUP_PEAK_RATIO)
        scale = POPUP_PEAK_SCALE + (POPUP_END_SCALE - POPUP_PEAK_SCALE) * k
    }

    // 上移
    const offsetY = -POPUP_RISE_DISTANCE * t

    // 透明度：前 70% 不衰减，后 30% 渐隐
    let alpha
    if (t < 0.7) {
        alpha = 1
    } else {
        alpha = 1 - (t - 0.7) / 0.3
    }

    return { scale, alpha, offsetY }
}

/**
 * 绘制所有弹窗
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Object>} popups
 */
function drawPopups(ctx, popups) {
    if (!ctx || !popups || popups.length === 0) return

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (const p of popups) {
        const { scale, alpha, offsetY } = computePopupState(p)
        const finalScale = p.big ? scale * 1.15 : scale
        const baseFont = p.isCombo ? 28 : 22
        const fontSize = baseFont * finalScale

        ctx.save()
        ctx.translate(p.x, p.y + offsetY)
        ctx.scale(finalScale, finalScale)
        ctx.globalAlpha = alpha

        ctx.font = `bold ${fontSize}px sans-serif`

        if (p.isPerfect) {
            ctx.shadowColor = '#ffd700'
            ctx.shadowBlur = 16
            ctx.fillStyle = p.color
            ctx.fillText(p.text, 0, 0)
            ctx.shadowBlur = 0
            ctx.lineWidth = 3
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
            ctx.strokeText(p.text, 0, 0)
        } else if (p.isCombo) {
            ctx.shadowColor = '#ff6600'
            ctx.shadowBlur = 10
            ctx.fillStyle = p.color
            ctx.fillText(p.text, 0, 0)
            ctx.shadowBlur = 0
            ctx.lineWidth = 2
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
            ctx.strokeText(p.text, 0, 0)
        } else if (p.color === POPUP_COLOR_SWISH) {
            ctx.shadowColor = '#4fc3ff'
            ctx.shadowBlur = 12
            ctx.fillStyle = p.color
            ctx.fillText(p.text, 0, 0)
            ctx.shadowBlur = 0
            ctx.lineWidth = 2
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
            ctx.strokeText(p.text, 0, 0)
        } else if (p.color === POPUP_COLOR_MISS) {
            ctx.fillStyle = p.color
            ctx.fillText(p.text, 0, 0)
            ctx.lineWidth = 2
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
            ctx.strokeText(p.text, 0, 0)
        } else {
            ctx.fillStyle = p.color
            ctx.fillText(p.text, 0, 0)
            ctx.lineWidth = 2
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
            ctx.strokeText(p.text, 0, 0)
        }

        ctx.restore()
    }

    ctx.restore()
}
