/**
 * 轨迹预测模块
 * 负责：基于拖拽方向和力度计算未来若干帧的预测点位，并绘制
 * 关键约束：与真实物理共用 gravity / baseForce / 拖拽方向规则，避免"预测能进实际进不了"
 */

/**
 * 预测步长（秒）
 * 30FPS，对应 1/30 秒，与实际物理积分频率一致
 */
const TRAJECTORY_DT = 1 / 30

/**
 * 兜底常量（在未加载 config.js 时仍能工作）
 * 真实物理应统一使用此值或 GAME_CONFIG.physics.* 的值
 */
const TRAJECTORY_GRAVITY = 980
const TRAJECTORY_BASE_FORCE = 700  // 从 900 降低到 700，与 config.js 保持一致
const TRAJECTORY_MIN_POWER = 0.6
const TRAJECTORY_MAX_POWER = 1.4
const TRAJECTORY_MAX_DRAG = 240
const TRAJECTORY_PREDICT_COUNT = 8
const TRAJECTORY_SHOW_COUNT = 6

/**
 * 力度计算（与 shootBall 保持一致）
 * 距离 / 最大拖拽距离 = 原始力度，再钳制到 [minPower, maxPower]
 * @param {Object} dragStart {x, y}
 * @param {Object} dragCurrent {x, y}
 * @returns {number}
 */
function computePowerForTrajectory(dragStart, dragCurrent) {
    const dx = dragCurrent.x - dragStart.x
    const dy = dragCurrent.y - dragStart.y
    const dragDistance = Math.hypot(dx, dy)
    const rawPower = dragDistance / TRAJECTORY_MAX_DRAG
    return Math.max(
        TRAJECTORY_MIN_POWER,
        Math.min(TRAJECTORY_MAX_POWER, rawPower)
    )
}

/**
 * 计算出手速度（与真实 shootBall 共用规则）
 * 拖拽方向反向为投射方向
 * 垂直分量始终向上（dy 越大 vy 越负）
 * @param {Object} dragStart
 * @param {Object} dragCurrent
 * @param {number} power
 * @returns {{vx:number, vy:number, dist:number}}
 */
function computeLaunchVelocityForTrajectory(dragStart, dragCurrent, power) {
    const dx = dragCurrent.x - dragStart.x
    const dy = dragCurrent.y - dragStart.y
    const dist = Math.hypot(dx, dy) || 1

    const force = TRAJECTORY_BASE_FORCE * power
    const dirX = dx / dist
    // 始终向上抛：Canvas 中 y 向下为正，向上为负
    const dirY = -Math.abs(dy) / dist

    return {
        vx: dirX * force,
        vy: dirY * force,
        dist
    }
}

/**
 * 生成预测轨迹点
 * 抛物线方程：x(t) = x0 + vx*t;  y(t) = y0 + vy*t + 0.5*g*t^2
 * 隐藏：篮板、篮筐碰撞、Swish 判定等复杂因素（仅做理想抛物线）
 *
 * @param {Object} ball - 篮球 {x, y, radius}
 * @param {Object} dragStart {x, y}
 * @param {Object} dragCurrent {x, y}
 * @param {number} power - 力度系数；传 0 时会自动用拖拽距离计算
 * @param {number} [count=8] - 总生成点数
 * @returns {Array<{x:number, y:number, t:number}>}
 */
function generateTrajectoryPoints(ball, dragStart, dragCurrent, power, count = TRAJECTORY_PREDICT_COUNT) {
    if (!ball) return []
    // 若未传 power（如上层没算过），自动从拖拽距离推导
    const effectivePower = power && power > 0
        ? power
        : computePowerForTrajectory(dragStart, dragCurrent)

    const launch = computeLaunchVelocityForTrajectory(dragStart, dragCurrent, effectivePower)

    const points = []
    const x0 = ball.x
    const y0 = ball.y
    const g = TRAJECTORY_GRAVITY

    for (let i = 0; i < count; i++) {
        const t = i * TRAJECTORY_DT
        const x = x0 + launch.vx * t
        // Canvas 中 g 向下为正，所以 y += +0.5*g*t^2
        const y = y0 + launch.vy * t + 0.5 * g * t * t
        points.push({ x, y, t })
    }
    return points
}

/**
 * 绘制预测轨迹
 * 只显示前半段（默认 6 个点），防止剧透完整落点
 * 颜色随力度变化：与蓄力条颜色一致
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x:number, y:number}>} points - generateTrajectoryPoints 返回
 * @param {number} power - 当前力度（用于着色）
 * @param {number} [showCount=6] - 显示几个点
 */
function drawTrajectory(ctx, points, power, showCount = TRAJECTORY_SHOW_COUNT) {
    if (!ctx || !points || points.length === 0) return

    // 力度颜色（与 aim-guide 保持一致）
    const baseColor = power < 0.8
        ? '#4CAF50'
        : power < 1.1
            ? '#FFC107'
            : '#FF5252'

    const visible = Math.min(points.length, showCount)

    ctx.save()

    // 1) 虚线连接（轻辅助线）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    for (let i = 0; i < visible; i++) {
        const p = points[i]
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // 2) 圆点（由近到远逐渐变大、变亮，引导视线）
    for (let i = 0; i < visible; i++) {
        const p = points[i]
        // 半径：远端略大
        const radius = 2.5 + i * 0.4
        // 透明度：远端略淡
        const alpha = 0.55 + (i / visible) * 0.4

        // 外圈（白色描边，提高对比）
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius + 1, 0, Math.PI * 2)
        ctx.fill()

        // 内圈（按力度变色）
        ctx.fillStyle = hexToRgba(baseColor, alpha)
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.fill()
    }

    ctx.restore()
}

/**
 * 工具：把 #RRGGBB 转为 rgba(r, g, b, a)
 * @param {string} hex
 * @param {number} alpha 0~1
 * @returns {string}
 */
function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '')
    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
