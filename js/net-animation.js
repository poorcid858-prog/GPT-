/**
 * 篮网动画模块
 * 状态机：normal → entering → swinging → returning → normal
 * 篮球穿过篮筐时触发摆动；用贝塞尔曲线绘制
 */

/**
 * 状态枚举
 */
const NET_STATE = {
    NORMAL: 'normal',
    ENTERING: 'entering',
    SWINGING: 'swinging',
    RETURNING: 'returning'
}

/**
 * 篮网默认参数
 */
const NET_DEFAULT = {
    points: 6,            // 经线（垂直方向）分段数
    strands: 5,           // 纬线（水平方向）圈数
    depth: 40,            // 篮网下垂深度（像素）
    segmentWidth: 18,     // 相邻经线之间的水平间距
    swingDuration: 0.4,   // 摆动阶段时长（秒）
    returnDuration: 0.3,  // 回弹阶段时长（秒）
    compressAmount: 8,    // 球穿过时的初始压缩量
    swingAmplitude: 5     // 摆动峰值
}

/**
 * 创建篮网状态对象
 * @param {Object} [overrides] - 覆盖默认参数
 * @returns {Object}
 */
function createNet(overrides = {}) {
    return Object.assign({
        state: NET_STATE.NORMAL,
        timer: 0,
        swing: 0,          // 当前摆动幅度（正负值）
        compress: 0,       // 压缩量（球穿过时增加）
        swingDuration: NET_DEFAULT.swingDuration,
        returnDuration: NET_DEFAULT.returnDuration,
        points: NET_DEFAULT.points,
        strands: NET_DEFAULT.strands,
        depth: NET_DEFAULT.depth,
        segmentWidth: NET_DEFAULT.segmentWidth
    }, overrides)
}

/**
 * 触发篮网摆动（在篮球穿过篮筐时调用）
 * 状态：NORMAL → ENTERING → SWINGING → RETURNING → NORMAL
 *
 * @param {Object} net
 */
function triggerNetSwing(net) {
    if (!net) return
    net.state = NET_STATE.ENTERING
    net.timer = 0
    net.compress = NET_DEFAULT.compressAmount
}

/**
 * 更新篮网状态
 * 进入、摆动、回弹三段时间分别用不同曲线
 *
 * @param {Object} net
 * @param {number} dt - 帧间隔（秒）
 */
function updateNet(net, dt) {
    if (!net) return

    net.timer += dt

    switch (net.state) {
        case NET_STATE.NORMAL:
            net.swing = 0
            net.compress = 0
            break

        case NET_STATE.ENTERING:
            // 球刚穿过：篮网瞬间压缩，立刻切到摆动
            net.compress = NET_DEFAULT.compressAmount
            net.state = NET_STATE.SWINGING
            net.timer = 0
            break

        case NET_STATE.SWINGING: {
            // 摆动：用 sin 函数制造左右摆动 + 振幅随时间衰减
            const t = Math.min(1, net.timer / net.swingDuration)
            const envelope = 1 - t                 // 振幅包络
            net.swing = Math.sin(net.timer * 18) * NET_DEFAULT.swingAmplitude * envelope
            net.compress = NET_DEFAULT.compressAmount * (1 - t) * 0.5

            if (net.timer >= net.swingDuration) {
                net.state = NET_STATE.RETURNING
                net.timer = 0
            }
            break
        }

        case NET_STATE.RETURNING: {
            // 回弹：阻尼衰减至 0
            net.swing *= 0.85
            net.compress = 0

            if (Math.abs(net.swing) < 0.1 || net.timer >= net.returnDuration) {
                net.swing = 0
                net.compress = 0
                net.state = NET_STATE.NORMAL
                net.timer = 0
            }
            break
        }
    }
}

/**
 * 绘制篮网
 * 用二次贝塞尔曲线绘制经线、纬线，swing 偏移制造摆动
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} rim - 篮筐 {x, y, width}
 * @param {Object} net
 */
function drawNet(ctx, rim, net) {
    if (!ctx || !rim || !net) return

    const points = net.points || NET_DEFAULT.points
    const strands = net.strands || NET_DEFAULT.strands
    const depth = net.depth || NET_DEFAULT.depth
    const startX = rim.x - rim.width / 2
    const startY = rim.y + 4   // 篮筐下沿略偏下
    const endY = startY + depth

    ctx.save()

    // 摆动偏移：经线底端在中线处偏移最大
    const swingOffset = net.swing || 0
    const compress = net.compress || 0

    // ---------- 1) 经线（垂直方向） ----------
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.lineWidth = 1.5
    ctx.beginPath()

    for (let i = 0; i <= points; i++) {
        const topX = startX + (i / points) * rim.width
        const t = i / points
        const inward = (t - 0.5) * 18  // 向中线收口
        const bottomX = topX + inward + swingOffset * Math.sin(t * Math.PI)
        const bottomY = endY - compress

        // 用二次贝塞尔曲线绘制
        const ctrlX = (topX + bottomX) / 2
        const ctrlY = startY + (endY - startY) * 0.5 + swingOffset * 0.5
        ctx.moveTo(topX, startY)
        ctx.quadraticCurveTo(ctrlX, ctrlY, bottomX, bottomY)
    }
    ctx.stroke()

    // ---------- 2) 纬线（水平方向） ----------
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let j = 1; j < strands; j++) {
        const ratio = j / strands
        const y = startY + (endY - startY) * ratio
        const widthAtY = rim.width - 18 * ratio * 2
        const leftX = rim.x - widthAtY / 2 + swingOffset * 0.4 * Math.sin(ratio * Math.PI)
        const rightX = rim.x + widthAtY / 2 + swingOffset * 0.4 * Math.sin(ratio * Math.PI)
        const ctrlY = y + 4
        ctx.moveTo(leftX, y)
        ctx.quadraticCurveTo(rim.x + swingOffset * 0.4, ctrlY, rightX, y)
    }
    ctx.stroke()

    ctx.restore()
}

// 导出到 window 对象，供 game.js 调用
window.createNet = createNet;
window.triggerNetSwing = triggerNetSwing;
window.updateNet = updateNet;
window.drawNet = drawNet;
