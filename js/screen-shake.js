/**
 * 屏幕震动模块
 * 负责：Perfect / 特殊进球 等关键时刻的镜头震动反馈
 * 触发后用 ctx.translate 应用偏移；每帧 update 衰减
 * 不会影响游戏逻辑，只影响绘制
 */

/**
 * 默认震动参数
 * duration=100ms（0.1 秒），intensity=3 像素
 * 注释：参数 100 在规范里指 100 毫秒，函数内部会统一转为秒
 */
const DEFAULT_SHAKE_DURATION_MS = 100
const DEFAULT_SHAKE_INTENSITY = 3

/**
 * 创建一个新的 shake 状态对象
 * @returns {{active:boolean, time:number, duration:number, intensity:number, offsetX:number, offsetY:number}}
 */
function createShake() {
    return {
        active: false,
        time: 0,             // 已用时间（秒）
        duration: 0,         // 持续时间（秒）
        intensity: 0,        // 最大振幅（像素）
        offsetX: 0,
        offsetY: 0
    }
}

/**
 * 触发一次屏幕震动
 *
 * @param {Object} shake - 通过 createShake() 创建的 shake 对象
 * @param {number} [duration=100] - 持续时间（毫秒），兼容规范 100
 * @param {number} [intensity=3] - 震动强度（像素）
 */
function triggerShake(shake, duration = DEFAULT_SHAKE_DURATION_MS, intensity = DEFAULT_SHAKE_INTENSITY) {
    if (!shake) return
    // 如果 duration > 5 视作毫秒，否则视为秒（兼容两种调用）
    const durationSec = duration > 5 ? duration / 1000 : duration

    shake.active = true
    shake.time = 0
    shake.duration = Math.max(0.01, durationSec)
    shake.intensity = Math.max(0, intensity)
    shake.offsetX = 0
    shake.offsetY = 0
}

/**
 * 更新震动状态（每帧调用）
 * 衰减曲线：剩余比例的平方根，保证开头震感强、结尾迅速收敛
 *
 * @param {Object} shake
 * @param {number} dt - 帧间隔（秒）
 */
function updateShake(shake, dt) {
    if (!shake || !shake.active) return

    shake.time += dt
    if (shake.time >= shake.duration) {
        // 结束震动
        shake.active = false
        shake.offsetX = 0
        shake.offsetY = 0
        return
    }

    // 衰减系数：1 → 0（线性），但取平方根让头部更明显
    const t = shake.time / shake.duration
    const decay = Math.sqrt(1 - t)

    // 随机方向 + 当前强度
    const angle = Math.random() * Math.PI * 2
    const magnitude = shake.intensity * decay
    shake.offsetX = Math.cos(angle) * magnitude
    shake.offsetY = Math.sin(angle) * magnitude
}

/**
 * 应用震动偏移到 Canvas 上下文
 * 调用后应配合 ctx.restore() 撤销
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} shake
 */
function applyShake(ctx, shake) {
    if (!ctx || !shake || !shake.active) return
    ctx.save()
    ctx.translate(shake.offsetX, shake.offsetY)
}

/**
 * 撤销震动偏移
 * 必须与 applyShake 配对调用
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} shake
 */
function restoreShake(ctx, shake) {
    if (!ctx || !shake || !shake.active) return
    ctx.restore()
}

/**
 * 便捷封装：渲染回调带震动的 Canvas
 * 内部自动 save/restore，外层回调正常绘制即可
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} shake
 * @param {Function} drawFn - 绘制函数
 */
function withShake(ctx, shake, drawFn) {
    applyShake(ctx, shake)
    try {
        if (typeof drawFn === 'function') drawFn()
    } finally {
        restoreShake(ctx, shake)
    }
}
