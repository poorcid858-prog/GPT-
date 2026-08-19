# 投篮物理

本文档提供投篮游戏中篮球飞行物理的实现规范，涵盖初速度、角度、重力、抛物线、力度、旋转和轨迹预测。

---

## 目录

- [投篮初速度](#投篮初速度)
- [投篮角度](#投篮角度)
- [重力](#重力)
- [抛物线](#抛物线)
- [投篮力度](#投篮力度)
- [篮球旋转](#篮球旋转)
- [轨迹预测](#轨迹预测)

---

## 投篮初速度

### 概念

出手速度由玩家拖拽的方向和力度共同决定，分解为水平速度 `vx` 和垂直速度 `vy`。

### 出手速度计算

```javascript
// 根据拖拽方向和力度计算初速度
function shootBall(dragStart, dragCurrent, power) {
    // 1. 拖拽方向向量
    let dx = dragStart.x - dragCurrent.x   // 向上拖 → dx
    let dy = dragStart.y - dragCurrent.y   // 向上拖 → dy 为正（向上）

    // 2. 距离与归一化方向
    const dist = Math.hypot(dx, dy)
    const dirX = dx / dist
    const dirY = dy / dist

    // 3. 初速度分量
    const force = BASE_FORCE * power
    ball.vx = dirX * force
    ball.vy = dirY * force  // Canvas 中向上为负，拖拽向上 dirY 为正，需转换
}
```

### Canvas 坐标系注意

Canvas 中 Y 轴**向下为正**。投篮向上时 y 初速度应为负值：

```javascript
// 拖拽向上：dy = start.y - current.y > 0（向上）
// 需要转换为 canvas 方向（向上为负）
ball.vy = -dirY * force
```

用统一的辅助函数：

```javascript
function computeLaunchVelocity(dragStart, dragCurrent, power) {
    const dx = dragStart.x - dragCurrent.x
    const dy = dragStart.y - dragCurrent.y
    const dist = Math.hypot(dx, dy) || 1

    const force = BASE_FORCE * power
    const dirX = dx / dist

    return {
        vx: dirX * force,
        vy: -Math.abs(dy) / dist * force  // 始终向上抛
    }
}
```

### 初速度典型值

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| BASE_FORCE | 弹射力基础值 | 配合拖拽距离和画布尺寸 |
| 出手速度范围 | 400 ~ 1200 | 根据屏幕大小缩放 |
| 投篮手感 | 偏高抛 | 让轨迹更明显、更易瞄准 |

---

## 投篮角度

### 概念

出手角度决定篮球飞行弧线。角度过大投不远，过小则弹道太平。

### 角度计算

```javascript
// 用 atan2 计算出手角度（弧度）
function computeLaunchAngle(dragStart, dragCurrent) {
    const dx = dragStart.x - dragCurrent.x
    const dy = dragStart.y - dragCurrent.y
    const angle = Math.atan2(dy, dx)

    // 转为可读角度（度）
    return (angle * 180) / Math.PI
}
```

### 最佳出手角度

远端投篮（三分、远投）最佳角度通常在 **45°~70°** 之间。越远越应当高抛以增加命中率视觉合理性：

- **近投（罚球线附近）**：50°~60°
- **中投（三分线内）**：45°~55°
- **远投（三分线外）**：55°~70°

```javascript
// 可视需要把瞄准限制在合理角度范围
const MIN_ANGLE = 30   // 度
const MAX_ANGLE = 80   // 度

function clampLaunchAngle(angle) {
    return Math.max(30, Math.min(80, angle))
}
```

### 角度与速度的关系

- 相同力度下，角度越大，弧线越高、射程越近
- 相同角度下，力度越大，射程越远
- 要同时控制"方向"和"力度"，才能精准命中目标

---

## 重力

### 概念

重力产生恒定向下的加速度（Canvas 中 Y 向下为正，故重力为正）。

```javascript
const GRAVITY = 980  // 像素/秒²
```

### 应用重力

```javascript
function updatePhysics(ball, dt) {
    // 重力影响垂直速度（向下加速）
    ball.vy += GRAVITY * dt

    // 速度更新位置
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
}
```

### 重力推荐值

| 游戏风格 | 推荐重力（像素/秒²） |
|----------|---------------------|
| 轻快街机 | 800 ~ 900 |
| 标准手感 | 900 ~ 1050 |
| 重弹道感 | 1100 ~ 1300 |

> 投篮游戏建议稍小的重力，让轨迹更拱、更容易瞄准。具体数值须配合篮球大小和屏幕尺寸反复调优。

### 重力与初速的配合

```javascript
// 让篮球精准到达目标高处，可用初速反推
function computeInitialVelocity(target, ball, gravity) {
    // 简化的到达固定点所需垂直初速
    const dy = target.y - ball.y
    const time = Math.sqrt(2 * Math.abs(dy) / gravity)
    const vy = -Math.sqrt(2 * gravity * Math.abs(dy))

    const dx = target.x - ball.x
    const vx = dx / time

    return { vx, vy }
}
```

---

## 抛物线

### 位置方程

投掷物体的位置随时间变化（Canvas 坐标，Y 向下为正）：

```
x(t) = x0 + vx × t
y(t) = y0 + vy × t + 0.5 × g × t²
```

```javascript
function getPositionAtTime(ball, t) {
    return {
        x: ball.x0 + ball.vx * t,
        y: ball.y0 + ball.vy * t + 0.5 * GRAVITY * t * t
    }
}
```

### 顶点（最高点）

```javascript
function getApexTime(ball) {
    // 垂直速度变为 0 的时刻
    return -ball.vy / GRAVITY
}

function getApexY(ball) {
    const t = getApexTime(ball)
    return ball.y0 + (ball.vy * ball.vy) / (2 * GRAVITY)
}
```

### 完整抛物线更新

```javascript
function updateProjectile(ball, dt) {
    // 上一帧位置（用于穿筐判定）
    ball.prevX = ball.x
    ball.prevY = ball.y

    // 物理
    ball.vy += GRAVITY * dt
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
}
```

---

## 投篮力度

### 概念

力度由拖拽距离映射而来，是控制投篮"远近"的核心参数。

### 力度模型

```javascript
function computePower(dragStart, dragCurrent) {
    const dragDistance = Math.hypot(
        dragStart.x - dragCurrent.x,
        dragStart.y - dragCurrent.y
    )

    const MAX_DRAG = 240  // 最大拖拽距离像素

    // 归一化并限制范围
    const rawPower = dragDistance / MAX_DRAG
    const power = Math.max(MIN_POWER, Math.min(MAX_POWER, rawPower))

    return power
}

const MIN_POWER = 0.6
const MAX_POWER = 1.4
```

### 力度应用到出手

```javascript
function shootBall(dragStart, dragCurrent) {
    const power = computePower(dragStart, dragCurrent)
    const launch = computeLaunchVelocity(dragStart, dragCurrent, power)

    ball.vx = launch.vx
    ball.vy = launch.vy
    ball.flightTime = 0
    ball.shotResolved = false
}
```

### 力度反馈

力度增加时必须有明显反馈：蓄力条、篮球缩放、方向线变化、轨迹长度变化。

```javascript
function drawPowerBar(ctx, power) {
    const width = 200 * (power - MIN_POWER) / (MAX_POWER - MIN_POWER)

    ctx.fillStyle = '#333'
    ctx.fillRect(20, 20, 200, 12)
    ctx.fillStyle = powerBarColor(power)
    ctx.fillRect(20, 20, width, 12)
}

function powerBarColor(power) {
    if (power < 0.8) return '#4CAF50'   // 低力度绿色
    if (power < 1.1) return '#FFC107'   // 中力度黄色
    return '#FF5722'                     // 高力度红色
}
```

---

## 篮球旋转

### 旋转效果

篮球飞行时应有旋转效果，让轨迹更自然。旋转速度可与水平速度相关。

```javascript
function updateBallRotation(ball, dt) {
    // 旋转速度与水平速度成正比
    ball.rotationSpeed = ball.vx * ROTATION_FACTOR
    ball.rotation += ball.rotationSpeed * dt
}
const ROTATION_FACTOR = 0.02
```

### 无纹理时的旋转模拟

没有篮球纹理时，可用弧线模拟旋转：

```javascript
function drawBasketball(ctx, ball) {
    const { x, y, radius, rotation } = ball

    // 篮球主体
    ctx.fillStyle = '#FF6B35'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()

    // 旋转弧线（随 rotation 变化）
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    for (let i = 0; i < 2; i++) {
        const angle = rotation + i * Math.PI
        ctx.beginPath()
        ctx.arc(x, y, radius * 0.7, angle + 0.5, angle + Math.PI - 0.5)
        ctx.stroke()
    }
}
```

### 碰撞后旋转变化

```javascript
// 碰撞后旋转速度改变
function onBallBounce(ball, collision) {
    ball.rotationSpeed = ball.vx * 0.02
    if (collision.type === 'rim') {
        ball.rotationSpeed *= 2  // 篮筐碰撞旋转更明显
    }
}
```

---

## 轨迹预测

### 核心原则

预测轨迹必须与真实投篮使用**同一套物理参数**：

```
gravity + initialVelocity + initialPosition = trajectory
```

避免出现"预测显示能进、实际却进不了"。

### 预测点生成

```javascript
function generateTrajectory(ball, dragStart, dragCurrent, power) {
    const launch = computeLaunchVelocity(dragStart, dragCurrent, power)

    const points = []
    const PREDICT_POINTS = 8
    const dt = 1 / 30

    let x0 = ball.x0
    let y0 = ball.y0

    for (let i = 0; i < PREDICT_POINTS; i++) {
        const t = i * dt
        const x = x0 + launch.vx * t
        const y = y0 + launch.vy * t + 0.5 * GRAVITY * t * t
        points.push({ x, y })
    }
    return points
}
```

### 与真实物理统一

让预测和真实投篮共用同一物理函数：

```javascript
// 统一的物理更新（预测和真实共用）
function stepProjectile(ball, launch, gravity, dt) {
    ball.vy += gravity * dt
    ball.x += launch.vx * dt
    ball.y += launch.vy * dt
}
```

### 预测的隐藏因素

只允许预测阶段隐藏：碰撞、篮板、篮筐反弹等复杂因素。但**基础抛物线必须一致**。

### 预测绘制

```javascript
function drawTrajectory(ctx, points, power) {
    // 轨迹只显示前半段，帮助瞄准而不剧透
    const showCount = Math.min(points.length, 6)

    for (let i = 1; i < showCount; i++) {
        const alpha = 1 - i / showCount
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(points[i].x, points[i].y, 3, 0, Math.PI * 2)
        ctx.stroke()
    }
}
```

---

## 物理参数集中配置

所有物理参数集中在配置对象中，方便手感调优：

```javascript
const PHYSICS_CONFIG = {
    gravity: 980,
    restitution: 0.75,
    ball: {
        radius: 18,
        maxDragDistance: 240,
        minPower: 0.6,
        maxPower: 1.4,
        rotationFactor: 0.02,
        baseForce: 900
    },
    trajectory: {
        predictPoints: 8,
        showPoints: 6
    }
}
```

调参时只需改配置，不用改业务逻辑：`gravity`、`baseForce`、`minPower/maxPower`、`maxDragDistance`、`rotationFactor` 都是投篮手感的核心旋钮。