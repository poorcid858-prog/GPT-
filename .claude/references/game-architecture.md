# Game Architecture Reference

本文档提供 Web 小游戏项目架构规范和最佳实践，涵盖项目结构、游戏循环、状态管理、UI 分离、React 与 Canvas 协作等核心架构决策。

---

## 目录

- [游戏项目基本结构](#游戏项目基本结构)
- [Game Loop](#game-loop)
- [Update / Render](#update--render)
- [游戏状态管理](#游戏状态管理)
- [Entity / Component 基本思想](#entity--component-基本思想)
- [游戏逻辑与 UI 分离](#游戏逻辑与-ui-分离)
- [React 与 Canvas 配合](#react-与-canvas-配合)
- [输入层与游戏逻辑分离](#输入层与游戏逻辑分离)
- [游戏生命周期](#游戏生命周期)

---

## 游戏项目基本结构

### 小型游戏（单文件 HTML）

```
game.html
├── HTML 结构（Canvas 容器 + UI 元素）
├── CSS 样式（布局、UI、动画）
└── JavaScript
    ├── 配置常量
    ├── 游戏状态管理
    ├── 游戏循环
    ├── 输入处理
    ├── 物理 / 碰撞
    ├── 渲染（Canvas 绘制）
    ├── UI 更新
    └── 工具函数
```

### 中型游戏（模块化）

```
project/
├── index.html
├── style.css
├── js/
│   ├── main.js          # 入口、初始化
│   ├── config.js         # 游戏配置常量
│   ├── game-loop.js      # 游戏循环
│   ├── state.js          # 游戏状态管理
│   ├── input.js          # 输入系统
│   ├── physics.js        # 物理 / 碰撞
│   ├── entities/
│   │   ├── ball.js       # 实体定义
│   │   ├── basket.js
│   │   └── player.js
│   ├── rendering/
│   │   ├── canvas.js     # Canvas 绘制
│   │   ├── particles.js  # 粒子系统
│   │   └── ui.js         # UI 渲染
│   └── utils.js          # 工具函数
└── assets/
    ├── images/
    └── sounds/
```

### 核心架构原则

- **职责分离**：每个模块只做一件事
- **配置集中**：魔法数字放在 `config.js`
- **依赖单向**：UI 依赖游戏逻辑，但游戏逻辑不依赖 UI
- **入口简单**：`main.js` 只负责初始化并启动

---

## Game Loop

### 标准游戏循环

所有需要实时更新的游戏必须建立明确的游戏循环。使用 `requestAnimationFrame` 驱动：

```
Input → Update → Collision → Game State → Render
```

### 循环结构

```
while game running:
    read input
    update game state (deltaTime)
    update physics (deltaTime)
    detect collisions
    apply game rules
    update effects / particles
    render canvas
```

### 计数循环 vs 时间循环

| 方式 | 说明 | 推荐 |
|------|------|------|
| 固定时间步长 | 每次更新固定 dt，物理稳定 | 物理复杂游戏推荐 |
| 可变时间步长 | 使用真实 deltaTime，简单 | 简单小游戏常用 |

### 固定时间步长循环

```
const FIXED_DT = 1 / 60
let accumulator = 0

function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000
    lastTime = timestamp
    accumulator += dt

    while (accumulator >= FIXED_DT) {
        update(FIXED_DT)    // 物理在固定步长下稳定
        accumulator -= FIXED_DT
    }

    render()                // 渲染按实际帧率
    requestAnimationFrame(loop)
}
```

### 简单可变时间步长循环

```
let lastTime = 0

function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05)  // 上限 50ms 防跳帧
    lastTime = timestamp

    input()
    update(dt)
    render()

    requestAnimationFrame(loop)
}
```

**关键规则**：
- **必须使用 deltaTime**，否则不同刷新率设备速度不同
- 设置 deltaTime 上限（如 50ms）防止长时间暂停后跳帧
- 不要在 `requestAnimationFrame` 回调外更新游戏状态

---

## Update / Render

### 分离原则

Update 和 Render 必须逻辑分离，不能混在一起：

```
function update(dt) {
    // 更新位置
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
    ball.vy += gravity * dt

    // 碰撞检测
    checkCollisions()

    // 游戏规则
    checkScoring()
}

function render() {
    // 清空画布
    ctx.clearRect(0, 0, width, height)

    // 绘制场景
    drawBackground(ctx)
    drawBasket(ctx)
    drawBall(ctx)
    drawUI(ctx)
}
```

### 为什么必须分离

- **Update 可被独立调用**（固定时间步长时多次调用）
- **Render 可被跳过**（帧率跟不上时降帧）
- **测试方便**（可以直接调用 `update(dt)` 验证逻辑）
- **逻辑清晰**（改物理不影响渲染，改渲染不影响物理）

### 渲染顺序

分层绘制，下层先绘制：

```
Background
  ↓
Game World （场景、场地、地图）
  ↓
Entities （实体：篮球、角色、道具）
  ↓
Particles / Effects （粒子、特效）
  ↓
UI Layer （分数、计时、按钮）
```

---

## 游戏状态管理

### 状态模型

使用明确的状态机，避免用大量布尔变量隐式表示：

```
LOADING → MENU → READY → PLAYING → PAUSED → PLAYING
                                        → GAME_OVER → MENU
```

### 常见游戏状态

| 状态 | 说明 | 玩家可操作 | 世界更新 | 计时 |
|------|------|:----------:|:--------:|:----:|
| LOADING | 加载资源 | ✗ | ✗ | ✗ |
| MENU | 主菜单 | ✔（菜单操作） | ✗ | ✗ |
| READY | 准备开始 | ✗ | ✗ | ✗ |
| PLAYING | 游戏中 | ✔ | ✔ | ✔ |
| PAUSED | 暂停 | ✔（暂停菜单） | ✗ | ✗ |
| GAME_OVER | 游戏结束 | ✗ | ✗ | ✗ |

### 推荐实现方式

```
const STATE = {
    LOADING: 'LOADING',
    MENU: 'MENU',
    READY: 'READY',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER'
}

let gameState = STATE.MENU

function setState(newState) {
    const prev = gameState
    gameState = newState
    onStateChange(prev, newState)
}

function onStateChange(prev, next) {
    // 进入状态时重置、显示 UI 等
    if (next === STATE.READY) {
        resetGame()
    }
    if (next === STATE.GAME_OVER) {
        showGameOverScreen()
    }
}
```

### 状态守卫

每个状态必须明确：
- 是否接受输入
- 游戏世界是否更新
- 是否计时
- 哪些 UI 显示
- 可以进入哪些状态

```
function canTransition(from, to) {
    const transitions = {
        [STATE.MENU]: [STATE.READY],
        [STATE.READY]: [STATE.PLAYING],
        [STATE.PLAYING]: [STATE.PAUSED, STATE.GAME_OVER],
        [STATE.PAUSED]: [STATE.PLAYING, STATE.MENU],
        [STATE.GAME_OVER]: [STATE.MENU, STATE.READY]
    }
    return transitions[from]?.includes(to) ?? false
}
```

### 禁止反模式

```
// ❌ 不要这样做
let isPlaying = true
let isPaused = false
let isGameOver = false
let isReady = false
```

---

## Entity / Component 基本思想

### 核心概念

对于简单小游戏，不需要完整 ECS 框架，但可以借鉴其思想：

```
Entity（实体） = 游戏中的"东西"
Component（组件） = 实体的"属性数据"
System（系统） = 处理"逻辑"的代码
```

### 简单实现

```
// 实体：一个带有 ID 的对象
function createEntity(type, components) {
    return {
        id: nextId++,
        type,
        components: { ...components }
    }
}

// 组件：纯数据
const ball = createEntity('ball', {
    position: { x: 100, y: 200 },
    velocity: { x: 0, y: 0 },
    physics: { radius: 18, gravity: 980 },
    render: { color: '#FF6B35', rotation: 0 }
})

const basket = createEntity('basket', {
    position: { x: 400, y: 150 },
    rim: { width: 90, height: 10 },
    collision: { type: 'scoring-zone' }
})

// 系统：处理逻辑的函数
function physicsSystem(entities, dt) {
    entities.forEach(e => {
        if (e.components.velocity && e.components.physics) {
            e.components.velocity.y += e.components.physics.gravity * dt
            e.components.position.x += e.components.velocity.x * dt
            e.components.position.y += e.components.velocity.y * dt
        }
    })
}
```

### 何时使用

| 游戏规模 | 推荐 | 原因 |
|----------|------|------|
| 小型（1-5 实体） | 简单对象 | 直接用对象字面量即可 |
| 中型（5-20 实体） | 轻量 Entity | 按类型组织，便于扩展 |
| 大型（20+ 实体） | 完整 ECS | 需要性能和数据驱动 |

对于大多数 Web 小游戏，**简单对象 + 按职责分离函数**即可，不需要引入 ECS 框架。

---

## 游戏逻辑与 UI 分离

### 核心原则

```
游戏核心逻辑                    UI
├── 玩家位置           ───→    ├── 分数显示
├── 速度 / 物理        ───→    ├── 血量条
├── 生命值             ───→    ├── 菜单按钮
├── 碰撞检测           ───→    ├── Game Over 界面
├── 得分计算           ───→    └── 结算面板
└── 游戏规则
```

**UI 展示游戏状态，但 UI 不承担核心游戏规则。**

### 好的做法

```
// 游戏逻辑（纯数据）
function updateScore(points) {
    score += points
    // 只更新数据，不操作 DOM
}

// UI 层（读取状态）
function renderScore() {
    scoreElement.textContent = score
}
```

### 差的做法

```
// ❌ 在游戏逻辑里操作 UI
function updateScore(points) {
    score += points
    document.getElementById('score').textContent = score  // 不要
    document.getElementById('score').classList.add('flash') // 不要
}
```

### 推荐方式

1. 游戏逻辑更新数据（纯函数）
2. 游戏循环的 Render 阶段绘制到 Canvas
3. UI 层（DOM/React）读取游戏状态进行展示
4. 游戏核心不引用任何 DOM 元素

---

## React 与 Canvas 配合

### 职责分工

| 负责 | 技术 |
|------|------|
| 页面、菜单、按钮、设置、结算 | React |
| 篮球、篮筐、物理、碰撞、动画、粒子 | Canvas |
| 分数、计时、Combo 等高频数据 | Canvas 或 React（低频更新） |

### 高频数据不要走 React State

```
// ❌ 不要每一帧更新 React State
function GameLoop() {
    ball.x += ball.vx * dt
    setBallState({ x: ball.x, y: ball.y }) // 每帧触发 React 重渲染！
}

// ✅ 使用 useRef 或独立 Runtime
const ballRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
// Canvas 直接读取 ref 数据绘制，不触发 React 重渲染
```

### React State 与 Canvas Runtime 边界

```
React State（低频，触发 UI 更新）
├── score
├── combo
├── remainingTime (每 100ms 更新)
├── gamePhase
└── gameSettings

Game Runtime（高频，Canvas 直接使用）
├── ball.position
├── ball.velocity
├── particles
├── aim / trajectory
├── collision state
└── animation frame
```

### 推荐架构

```
React 组件
    ↓
useEffect 初始化
    ↓
Game Controller（独立对象，不依赖 React）
    ↓
Canvas 渲染（直接操作 Canvas 2D API）
    ↓
低频率同步数据回 React State（用于 UI 更新）
```

### 示例结构

```
function Game() {
    const canvasRef = useRef(null)
    const [score, setScore] = useState(0)
    const [phase, setPhase] = useState('MENU')

    useEffect(() => {
        const canvas = canvasRef.current
        const game = new GameController(canvas, {
            onScoreUpdate: (s) => setScore(s),
            onPhaseChange: (p) => setPhase(p)
        })
        game.start()

        return () => game.destroy()
    }, [])

    return (
        <div>
            <canvas ref={canvasRef} />
            {phase === 'MENU' && <button onClick={startGame}>开始游戏</button>}
            <div className="score">得分: {score}</div>
        </div>
    )
}
```

---

## 输入层与游戏逻辑分离

### 分层架构

```
Input Layer（输入层）
    ↓
Input State（输入状态）
    ↓
Game Logic（游戏逻辑）
    ↓
Render（渲染）
```

### 输入层职责

- 监听原生事件（pointerdown / keydown / touchstart）
- 转换为统一的输入状态
- 不直接修改游戏对象

### 示例

```
// 输入层：只记录状态
const input = {
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragCurrent: { x: 0, y: 0 },
    released: false
}

canvas.addEventListener('pointerdown', (e) => {
    input.isDragging = true
    input.dragStart = { x: e.clientX, y: e.clientY }
    input.dragCurrent = { x: e.clientX, y: e.clientY }
})

canvas.addEventListener('pointermove', (e) => {
    if (input.isDragging) {
        input.dragCurrent = { x: e.clientX, y: e.clientY }
    }
})

canvas.addEventListener('pointerup', () => {
    input.isDragging = false
    input.released = true
})
```

### 游戏逻辑读取输入

```
function update(dt) {
    if (input.released) {
        shootBall(input.dragStart, input.dragCurrent)
        input.released = false
    }
}
```

### 禁止反模式

```
// ❌ 不要在事件监听里直接修改游戏状态
canvas.addEventListener('pointerup', () => {
    ball.x = 100  // 不要
    ball.vx = 500 // 不要
    score += 2    // 不要
})
```

---

## 游戏生命周期

### 完整生命周期

```
创建（初始化）
    ↓
加载（资源）
    ↓
配置（设置）
    ↓
启动（开始游戏循环）
    ↓
运行（游戏循环中）
    ↓
暂停（可选）
    ↓
继续（可选）
    ↓
结束（游戏结束）
    ↓
销毁（释放资源）
```

### 初始化流程

```
function createGame(canvas, options) {
    // 1. 创建配置
    const config = { ...DEFAULT_CONFIG, ...options }
    // 2. 创建游戏状态
    const state = createInitialState(config)
    // 3. 创建 Canvas 上下文
    const ctx = canvas.getContext('2d')
    // 4. 设置输入监听
    const input = createInputSystem(canvas)
    // 5. 创建实体
    const entities = createEntities(config)
    // 6. 返回游戏控制器
    return {
        start() { startLoop(state, ctx, input, entities, config) },
        pause() { state.gameState = 'PAUSED' },
        resume() { state.gameState = 'PLAYING' },
        destroy() { cleanup(input, canvas) }
    }
}
```

### 销毁与清理

```
function destroyGame(game) {
    // 1. 停止游戏循环
    cancelAnimationFrame(game.rafId)
    // 2. 移除事件监听
    game.input.removeListeners()
    // 3. 释放资源
    game.assets = null
    // 4. 清理 Canvas
    game.ctx.clearRect(0, 0, width, height)
}
```

### 页面失焦处理

当浏览器切换 Tab 或页面失焦时，建议自动暂停：

```
document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState === 'PLAYING') {
        pauseGame()
    }
})
```

---

## 代码风格要求

### 配置集中

```
const CONFIG = {
    canvas: { width: 800, height: 600 },
    physics: { gravity: 980, restitution: 0.75 },
    ball: { radius: 18, maxDragDist: 240 },
    rim: { width: 90, tolerance: 8 },
    scoring: { normal: 2, perfectBonus: 1 }
}
```

### 命名规范

- 变量/函数：`camelCase`
- 常量：`UPPER_SNAKE_CASE`
- 类/构造函数：`PascalCase`
- 文件：`kebab-case.js`

### 函数职责单一

```
// ✅ 好的：一个函数只做一件事
function updateBallPosition(ball, dt) { ... }
function checkRimCollision(ball, rim) { ... }
function renderScore(ctx, score) { ... }

// ❌ 差的：一个函数做所有事
function updateEverything() { ... }
```