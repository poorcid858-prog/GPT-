/**
 * 瞄准辅助与蓄力条模块
 * 负责：方向线、预测轨迹、蓄力条（颜色分段：绿/黄/红）
 * 设计原则：纯绘制函数，不修改游戏状态；上层传入 ball/dragStart/dragCurrent/power
 */

/**
 * 力度颜色分段
 * power < 0.8  绿色  （轻）
 * power < 1.1  黄色  （中）
 * power >= 1.1 红色  （满）
 * @param {number} power - 当前力度系数 (通常 0.6 ~ 1.4)
 * @returns {string} CSS 颜色字符串
 */
function getPowerColor(power) {
    if (power < 0.8) return '#4CAF50'   // 绿色 - 蓄力不足
    if (power < 1.1) return '#FFC107'   // 黄色 - 蓄力适中
    return '#FF5252'                    // 红色 - 蓄力已满
}

/**
 * 蓄力条绘制
 * 背景：半透明深色矩形
 * 前景：根据 power 长度变化 + 颜色分段
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} power - 当前力度系数
 * @param {number} x - 左上角 X
 * @param {number} y - 左上角 Y
 */
function drawPowerBar(ctx, power, x, y) {
    // 蓄力条总宽 200px，高度 14px
    const totalWidth = 200
    const height = 14
    // 把 power 归一化到 0~1 区间，限定下限 0.6（最低有效力度）
    const normalized = Math.max(0, Math.min(1, (power - 0.6) / (1.4 - 0.6)))
    const filledWidth = totalWidth * normalized
    const color = getPowerColor(power)

    // 背景：圆角深色矩形
    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    roundRect(ctx, x, y, totalWidth, height, 4)
    ctx.fill()

    // 前景：按颜色填充的进度条
    ctx.fillStyle = color
    roundRect(ctx, x, y, filledWidth, height, 4)
    ctx.fill()

    // 边框：细微白边，提高可见度
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.lineWidth = 1
    roundRect(ctx, x, y, totalWidth, height, 4)
    ctx.stroke()

    // 力度文字
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`POWER ${power.toFixed(2)}x`, x + totalWidth / 2, y + height / 2 + 0.5)

    ctx.restore()
}

/**
 * 绘制瞄准辅助（方向线 + 预测轨迹 + 蓄力条）
 * 集成入口：上层每帧在球体之上调用一次
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} ball - 篮球对象 {x, y, radius}
 * @param {Object} dragStart - 拖拽起点 {x, y}
 * @param {Object} dragCurrent - 当前拖拽点 {x, y}
 * @param {number} power - 当前力度系数
 */
function drawAimGuide(ctx, ball, dragStart, dragCurrent, power) {
    if (!ball || !dragStart || !dragCurrent) return

    // 1) 方向线（球心 → 拖拽方向的反向）
    //    拖拽向后 = 投射向前
    const dx = dragStart.x - dragCurrent.x
    const dy = dragStart.y - dragCurrent.y
    const dist = Math.hypot(dx, dy)
    if (dist < 1) {
        // 拖拽距离太短，不绘制方向线
        return
    }

    const dirX = dx / dist
    const dirY = dy / dist
    // 方向线长度受当前 power 调制（蓄力越大线越长）
    const lineLength = Math.min(dist, 140) + 20

    // 线段起点：球边缘外延 4px，避免压住球本身
    const startX = ball.x + dirX * (ball.radius + 4)
    const startY = ball.y + dirY * (ball.radius + 4)
    const endX = startX + dirX * lineLength
    const endY = startY + dirY * lineLength

    // 虚线方向线，颜色随力度变化
    ctx.save()
    ctx.strokeStyle = getPowerColor(power)
    ctx.lineWidth = 3
    ctx.setLineDash([8, 6])
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    ctx.setLineDash([])

    // 末端箭头
    const arrowSize = 8
    const arrowAngle = Math.atan2(dirY, dirX)
    ctx.fillStyle = getPowerColor(power)
    ctx.beginPath()
    ctx.moveTo(endX, endY)
    ctx.lineTo(
        endX - arrowSize * Math.cos(arrowAngle - Math.PI / 6),
        endY - arrowSize * Math.sin(arrowAngle - Math.PI / 6)
    )
    ctx.lineTo(
        endX - arrowSize * Math.cos(arrowAngle + Math.PI / 6),
        endY - arrowSize * Math.sin(arrowAngle + Math.PI / 6)
    )
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // 2) 蓄力条（绘制在屏幕左上角）
    drawPowerBar(ctx, power, 20, 20)
}

/**
 * 内部工具：绘制圆角矩形路径
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r - 圆角半径
 */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
}
