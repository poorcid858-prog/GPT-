# 篮球碰撞与进球判定

本文档提供投篮游戏中篮球与篮筐、篮板、篮网的碰撞检测，以及进球/Miss 判定的完整规范。

---

## 目录

- [篮球与篮筐](#篮球与篮筐)
- [篮球与篮板](#篮球与篮板)
- [篮球与篮网](#篮球与篮网)
- [篮球穿筐](#篮球穿筐)
- [篮筐碰撞](#篮筐碰撞)
- [反弹](#反弹)
- [进球判定](#进球判定)
- [Miss 判定](#miss-判定)

---

## 篮球与篮筐

### 篮筐模型

篮筐由两个碰撞点和中间的进球区域组成：

```
RimLeft  ●────────────● RimRight
              ↓
         进球区域 (Scoring Zone)
```

```javascript
const rim = {
    x: 400,           // 篮筐中心 X
    y: 200,           // 篮筐中心 Y
    width: 90,        // 篮筐宽度
    height: 8,        // 篮筐边缘厚度
    rimLeft: { x: 355, y: 200, radius: 6 },   // 左边缘碰撞点
    rimRight: { x: 445, y: 200, radius: 6 }   // 右边缘碰撞点
}
```

### 篮球与篮筐边缘碰撞检测

使用圆形碰撞检测篮球是否碰到篮筐边缘：

```javascript
function checkRimEdgeCollision(ball, rim) {
    // 检测篮球与左右碰撞点
    if (circleCollision(ball, rim.rimLeft)) {
        return { hit: true, point: 'left', normal: { x: 1, y: 0 } }
    }
    if (circleCollision(ball, rim.rimRight)) {
        return { hit: true, point: 'right', normal: { x: -1, y: 0 } }
    }
    return { hit: false }
}

function circleCollision(a, b) {
    const dx = a.x - (b.x + b.radius)
    const dy = a.y - (b.y + b.radius)
    const dist = Math.hypot(dx, dy)
    return dist < a.radius + b.radius
}
```

---

## 篮球与篮板

### 篮板碰撞反弹

篮球碰撞篮板后水平速度反转并衰减：

```javascript
const BACKBOARD = {
    x: 480,               // 篮板位置 X
    y: 140,
    width: 10,            // 篮板厚度
    height: 120,
    restitution: 0.75     // 恢复系数
}

function checkBackboardCollision(ball, board) {
    // 球中心在篮板范围内
    if (ball.y + ball.radius > board.y &&
        ball.y - ball.radius < board.y + board.height) {

        // 球从左侧撞到篮板
        if (ball.x + ball.radius > board.x &&
            ball.x + ball.radius < board.x + board.width + 10 &&
            ball.vx > 0) {
            ball.x = board.x - ball.radius
            ball.vx = -ball.vx * board.restitution
            return true
        }
    }
    return false
}
```

### 碰撞位置偏移

根据碰撞点在篮板上的位置略微调整反弹角度，增加真实感：

```javascript
function checkBackboardCollision(ball, board) {
    if (ball.y + ball.radius > board.y &&
        ball.y - ball.radius < board.y + board.height &&
        ball.x + ball.radius > board.x &&
        ball.x + ball.radius < board.x + board.width + 10 &&
        ball.vx > 0) {

        // 根据碰撞点 Y 偏移微调反弹
        const hitRatio = (ball.y - board.y) / board.height  // 0~1
        const angleOffset = (hitRatio - 0.5) * 0.3          // -0.15~0.15

        ball.x = board.x - ball.radius
        ball.vx = -ball.vx * board.restitution
        ball.vy += ball.vx * angleOffset * 0.5              // 角度偏移

        ball.hitRim = true  // 标记碰撞，用于 Swish 判定
        return true
    }
    return false
}
```

---

## 篮球与篮网

### 篮网动画状态机

篮网不需要复杂物理模拟，用简单状态机即可：

```
Normal → Ball Enters → Net Compress → Net Swing → Return(Normal)
```

```javascript
const NET = {
    points: 6,           // 篮网分段数
    swing: 0,            // 摆动幅度
    swingSpeed: 0,
    state: 'normal',     // normal | entering | swinging | returning
    timer: 0
}

function updateNet(net, dt) {
    switch (net.state) {
        case 'normal':
            net.swing = 0
            break

        case 'entering':
            net.swing = 8               // 压缩幅度
            net.swingSpeed = 200
            net.state = 'swinging'
            net.timer = 0.4            // 摆动持续 0.4 秒
            break

        case 'swinging':
            net.swing = Math.sin(net.timer * 8) * 5 * (net.timer / 0.4)
            net.timer -= dt
            if (net.timer <= 0) {
                net.state = 'returning'
                net.timer = 0.3
            }
            break

        case 'returning':
            net.swing *= 0.9           // 阻尼衰减
            net.timer -= dt
            if (Math.abs(net.swing) < 0.5) {
                net.swing = 0
                net.state = 'normal'
            }
            break
    }
}

function drawNet(ctx, rim, net) {
    // 用曲线绘制篮网，swing 控制偏移
    const nodeCount = 6
    for (let i = 0; i < nodeCount; i++) {
        const t = i / (nodeCount - 1)
        const x = rim.x + (i - 2.5) * 8 + net.swing * Math.sin(t * Math.PI)
        const y = rim.y + 10 + t * 40
        // 绘制到 canvas
    }
}
```

### 篮网碰撞（简化）

篮球穿过篮筐时触发篮网动画：

```javascript
function onBallPassesRim(ball, net) {
    if (net.state === 'normal') {
        net.state = 'entering'
    }
}
```

---

## 篮球穿筐

### 穿越检测

检测篮球是否从篮筐高度上方穿到下方（这是进球的核心条件之一）：

```javascript
function checkBallCrossesRim(ball, rim) {
    // 必须在篮筐宽度范围内
    const inHorizontalRange =
        ball.x + ball.radius > rim.rimLeft.x &&
        ball.x - ball.radius < rim.rimRight.x + rim.rimRight.radius * 2

    // 从上方穿到下方
    const crossesDown =
        ball.prevY <= rim.y && ball.y >= rim.y && ball.vy > 0

    return inHorizontalRange && crossesDown
}
```

### 穿筐时的状态缓存

```javascript
// 在每帧更新前缓存上一帧位置
function cachePreviousPosition(ball) {
    ball.prevX = ball.x
    ball.prevY = ball.y
}
```

---

## 篮筐碰撞

### 碰撞检测类型

篮筐碰撞使用两种检测方式：

| 碰撞类型 | 检测方法 | 用途 |
|----------|----------|------|
| 圆形-圆形 | 篮球与 rimLeft/rimRight 碰撞点 | 篮筐边缘碰撞 |
| 圆形-矩形 | 篮球与篮筐矩形区域 | 进球区域判定 |

### 篮筐碰撞响应

篮球碰撞篮筐边缘后改变速度和方向：

```javascript
function handleRimCollision(ball, rim) {
    const result = checkRimEdgeCollision(ball, rim)
    if (!result.hit) return false

    // 反弹方向：沿碰撞法线方向
    const nx = result.normal.x
    const ny = result.normal.y

    // 速度沿法线反射
    const dot = ball.vx * nx + ball.vy * ny
    if (dot < 0) {  // 只处理朝向碰撞点的速度
        const restitution = 0.6
        ball.vx = (ball.vx - 2 * dot * nx) * restitution
        ball.vy = (ball.vy - 2 * dot * ny) * restitution
    }

    // 碰撞后旋转变化
    ball.rotationSpeed = ball.vx * 0.02

    // 标记碰撞（用于 Swish 判定）
    ball.hitRim = true

    return true
}
```

### 篮筐碰撞后的旋转变化

```javascript
// 碰撞后旋转速度由水平速度决定
ball.rotationSpeed = ball.vx * 0.02

// 每帧更新旋转
ball.rotation += ball.rotationSpeed * dt
```

---

## 反弹

### 恢复系数（Restitution）

restitution = 碰撞后速度 / 碰撞前速度（0~1）

| 系数 | 效果 | 应用场景 |
|------|------|----------|
| 0.0 | 无反弹 | 完全非弹性 |
| 0.6 | 小弹 | 篮筐边缘碰撞 |
| 0.75 | 中等弹 | 篮板碰撞 |
| 0.3~0.5 | 小弹 | 落地后滚动 |

### 通用反弹处理

```javascript
function reflectVelocity(velocity, normal, restitution) {
    const dot = velocity.x * normal.x + velocity.y * normal.y
    return {
        x: (velocity.x - 2 * dot * normal.x) * restitution,
        y: (velocity.y - 2 * dot * normal.y) * restitution
    }
}
```

### 碰撞后弹起 vs 弹开

- **弹起**：篮球从篮筐上边沿撞到，vy 从向下变为向上，向上弹起
- **弹开**：篮球从篮筐侧边撞到，vx 反向，水平方向弹开

```javascript
function applyBounce(ball, collision) {
    const { normal, restitution } = collision

    // 反射速度
    const reflected = reflectVelocity(
        { x: ball.vx, y: ball.vy },
        normal,
        restitution
    )

    ball.vx = reflected.x
    ball.vy = reflected.y

    // 防止卡在碰撞点
    ball.x += normal.x * 2
    ball.y += normal.y * 2
}
```

---

## 进球判定

### 核心条件

进球必须同时满足以下条件：

```javascript
function isScored(ball, rim) {
    // 1. 篮球从上方穿到下方
    const crossesDown = ball.prevY <= rim.y && ball.y >= rim.y && ball.vy > 0
    if (!crossesDown) return false

    // 2. 篮球中心在篮筐宽度范围内
    const inRim = ball.x > rim.rimLeft.x + ball.radius &&
                  ball.x < rim.rimRight.x + rim.rimRight.radius * 2 - ball.radius
    if (!inRim) return false

    return true
}
```

### 防止重复计分

一次投篮只能结算一次：

```javascript
function updateGameLogic(ball, rim, gameState, dt) {
    if (gameState.shotResolved) return

    if (isScored(ball, rim)) {
        gameState.shotResolved = true
        onScore(gameState, ball)  // 得分处理
    } else if (isMiss(ball, gameState)) {
        gameState.shotResolved = true
        onMiss(gameState)         // Miss 处理
    }
}
```

### 进球后的状态变化

```javascript
function onScore(gameState, ball) {
    const isPerfect = checkPerfect(ball, gameState.rim)
    const isSwish = !ball.hitRim && isPerfect

    // 基础分
    let points = 2
    if (isPerfect) points += 1
    if (isSwish) points += 1

    gameState.score += points
    gameState.combo += 1
    gameState.madeShots += 1

    // 触发反馈
    triggerScoreFeedback(points, isPerfect, isSwish, gameState.combo)
}
```

---

## Miss 判定

### 超时判定

篮球飞行超过最大时间后判定为 Miss：

```javascript
function checkShotTimeout(ball, gameState) {
    const MAX_SHOT_DURATION = 3  // 3 秒

    if (ball.flightTime >= MAX_SHOT_DURATION && !gameState.shotResolved) {
        return true
    }
    return false
}
```

### 飞出边界

```javascript
function checkOutOfBounds(ball, canvasWidth, canvasHeight) {
    const MARGIN = 100

    if (ball.x < -MARGIN ||
        ball.x > canvasWidth + MARGIN ||
        ball.y > canvasHeight + MARGIN) {
        return true
    }
    return false
}
```

### 卡死检测

```javascript
function checkStuck(ball, gameState) {
    // 水平速度接近 0 且垂直速度接近 0 且未结算
    const speed = Math.hypot(ball.vx, ball.vy)
    const STUCK_THRESHOLD = 5

    if (speed < STUCK_THRESHOLD &&
        ball.flightTime > 1 &&
        !gameState.shotResolved) {
        return true
    }
    return false
}
```

### Miss 综合判定

```javascript
function isMiss(ball, gameState, canvas) {
    return checkShotTimeout(ball, gameState) ||
           checkOutOfBounds(ball, canvas.width, canvas.height) ||
           checkStuck(ball, gameState)
}

function onMiss(gameState) {
    gameState.shotResolved = true
    gameState.combo = 0
    gameState.shots += 1

    // 触发 Miss 反馈
    triggerMissFeedback()
}
```

---

## 碰撞检测的优先顺序

每帧检测的顺序很重要：

```
1. 缓存上一帧位置（ball.prevX, ball.prevY）
2. 更新物理（位置 + 速度）
3. 检测篮板碰撞（先于篮筐）
4. 检测篮筐边缘碰撞
5. 检测穿筐（进球判定）
6. 检测 Miss 条件
7. 更新篮网动画
```

```javascript
function updateFrame(ball, rim, gameState, dt) {
    cachePreviousPosition(ball)            // 1
    updatePhysics(ball, dt)                // 2
    checkBackboardCollision(ball, board)   // 3
    handleRimCollision(ball, rim)          // 4

    if (!gameState.shotResolved) {
        if (isScored(ball, rim)) {         // 5
            onScore(gameState, ball)
        } else if (isMiss(ball, gameState, canvas)) { // 6
            onMiss(gameState)
        }
    }

    updateNet(net, dt)                     // 7
}
```