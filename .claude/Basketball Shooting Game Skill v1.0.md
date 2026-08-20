# Basketball Shooting Game Skill

## 1. Skill 基本信息

- **Skill 名称**：Basketball Shooting Game Skill
- **版本**：v1.0
- **适用场景**：Web Canvas / React 投篮类小游戏
- **适用类型**：
  - 单次投篮
  - 限时投篮
  - 连续投篮
  - 三分投篮
  - 罚球
  - 篮球挑战
  - 投篮闯关
  - 投篮得分排行
  - 投篮 + Combo 连击
- **依赖 Skill**：[通用 Game Development Skill](.claude/skills/game-development/SKILL.md)
- **核心目标**：

> 将真实篮球投篮中的“瞄准 → 出手 → 飞行 → 篮筐碰撞 → 进球判定 → 得分 → 反馈”抽象成适合 Web 游戏实现的稳定游戏规则。

---

# 2. Skill 定位

本 Skill 不负责规定完整的 Web Game 工程架构。

工程方面应遵循：

> **[通用 Game Development Skill](.claude/skills/game-development/SKILL.md)**

本 Skill 只负责投篮游戏领域的：

1. 投篮核心玩法
2. 篮球运动轨迹
3. 篮筐与篮球碰撞
4. 进球判定
5. 瞄准机制
6. 投篮力度
7. 得分规则
8. 连击规则
9. 时间与回合
10. 难度设计
11. 游戏反馈
12. 投篮动画
13. 投篮游戏状态
14. 投篮游戏数据模型
15. 投篮游戏测试规则

---

# 3. 核心设计原则

## 3.1 优先保证“好玩”，而不是完全模拟真实篮球

Web 小游戏不需要完整模拟真实篮球物理。

应采用：

> **真实感 + 可控性 + 游戏性**

而不是：

> 完全真实的篮球物理模拟。

因此允许：

- 简化空气阻力
- 简化旋转
- 简化碰撞
- 简化篮筐结构
- 简化篮板
- 简化人物动作

但是必须保证：

- 投篮轨迹看起来合理
- 篮球飞行速度合理
- 进球结果可预测
- 操作具有反馈
- 玩家能够通过操作提高命中率

---

# 4. 默认游戏模式

如果用户没有明确指定投篮玩法，默认采用：

> **限时连续投篮模式**

默认规则：

- 游戏时长：30 秒
- 初始篮球：1 个
- 每次投篮后自动获得下一球
- 篮筐固定
- 玩家通过拖拽或鼠标操作瞄准
- 松开鼠标 / 手指后投篮
- 命中获得分数
- 未命中不扣分
- 连续命中产生 Combo
- 游戏结束后展示最终得分

默认游戏循环：

```text
开始游戏
    ↓
准备投篮
    ↓
瞄准
    ↓
蓄力
    ↓
松手
    ↓
篮球飞行
    ↓
碰撞检测
    ↓
进球？
 ┌──┴──┐
是    否
↓      ↓
得分   Miss
↓      ↓
Combo更新
    ↓
篮球重置
    ↓
下一次投篮
    ↓
时间结束
    ↓
Game Over
```

---

# 5. 投篮核心交互

## 5.1 默认操作方式

优先支持：

### PC

- 鼠标拖拽瞄准
- 鼠标释放投篮

### Mobile

- 手指拖拽瞄准
- 手指释放投篮

操作模型：

```text
按下篮球
    ↓
向目标方向拖拽
    ↓
显示瞄准线
    ↓
显示预计轨迹
    ↓
松手
    ↓
篮球按照计算结果飞出
```

---

# 6. 瞄准系统

## 6.1 瞄准目标

玩家通常不应该直接控制篮球最终位置。

应控制：

```text
投篮方向
+
投篮力度
```

最终由系统计算：

```text
投篮方向
+
投篮力度
+
篮球初始位置
+
重力
=
篮球飞行轨迹
```

---

## 6.2 瞄准线

瞄准时建议显示：

- 起点
- 方向线
- 预测轨迹
- 落点提示

例如：

```text
篮球 ●
       \
        \
         \  ·
          \   ·
           \    ·
            \     ○
                 篮筐
```

预测轨迹不应过度精确。

默认建议：

- 显示 5～10 个预测点
- 轨迹点间距逐渐增大
- 轨迹只显示前半段
- 避免完全暴露最终结果

目的：

> 帮助玩家瞄准，而不是替玩家完成投篮。

---

# 7. 投篮力度

## 7.1 力度模型

投篮力度可以由拖拽距离决定：

```text
power = clamp(
    dragDistance / maxDragDistance,
    minPower,
    maxPower
)
```

推荐：

```text
minPower = 0.6
maxPower = 1.4
```

最终力度：

```text
force = baseForce × power
```

---

## 7.2 力度反馈

力度增加时必须有明显反馈：

- 蓄力条
- 篮球缩放
- 投篮方向线变化
- 轨迹变化
- 轻微人物动作变化

建议使用：

```text
低力度
████░░░░░░

中力度
██████░░░░

高力度
█████████░
```

---

# 8. 篮球物理模型

## 8.1 基础模型

推荐使用简化二维抛物线。

篮球位置：

```text
x(t) = x0 + vx × t

y(t) = y0 + vy × t + 0.5 × g × t²
```

其中：

- `x0`：篮球初始 X
- `y0`：篮球初始 Y
- `vx`：水平速度
- `vy`：垂直初速度
- `g`：重力
- `t`：时间

---

# 9. 投篮速度计算

根据玩家瞄准方向：

```text
dx = targetX - ballX
dy = targetY - ballY
```

归一化：

```text
distance = sqrt(dx² + dy²)

dirX = dx / distance
dirY = dy / distance
```

最终：

```text
vx = dirX × force
vy = dirY × force
```

但是需要注意 Canvas 坐标系通常：

```text
向下 = 正方向
向上 = 负方向
```

因此投篮向上时：

```text
vy = dirY × force
```

应根据实际坐标系统进行调整。

---

# 10. 篮球旋转

篮球飞行过程中应具有旋转效果。

最低要求：

```text
rotation += rotationSpeed × deltaTime
```

旋转速度可以与水平速度相关：

```text
rotationSpeed = vx × rotationFactor
```

建议：

- 投篮速度越高 → 旋转越明显
- 篮球飞行时持续旋转
- 篮球碰撞篮筐后改变旋转状态

如果没有篮球纹理，也可以通过：

- 篮球线条
- SVG
- Canvas 绘制弧线

模拟旋转。

---

# 11. 篮筐模型

篮筐至少包含：

```text
Backboard
    ↓
Rim
    ↓
Net
```

推荐结构：

```text
        ┌──────────┐
        │ Backboard│
        └──────────┘
             │
        ──────────
          Rim
        ╲        ╱
         ╲      ╱
          ╲    ╱
           Net
```

---

# 12. 篮筐碰撞

不要只判断：

```text
篮球中心是否进入篮筐
```

而应考虑：

> 篮球半径 + 篮筐碰撞区域。

推荐使用：

### 篮筐

使用：

- 两个圆形碰撞点
- 一个矩形 / 椭圆进球区域

例如：

```text
RimLeft  ●────────● RimRight
             ↓
         Scoring Zone
```

---

# 13. 进球判定

## 13.1 核心原则

“篮球进入篮筐附近”不等于“进球”。

必须满足：

1. 篮球从篮筐上方进入
2. 篮球中心经过篮筐内部区域
3. 篮球运动方向向下
4. 篮球穿过篮筐高度范围

推荐核心条件：

```text
ball.y_previous < rimY
AND
ball.y_current >= rimY
AND
ball.x > rimLeft
AND
ball.x < rimRight
AND
ball.vy > 0
```

---

# 14. 进球状态机

投篮必须有明确状态：

```text
SHOT_READY
    ↓
SHOOTING
    ↓
BALL_FLYING
    ↓
RIM_COLLISION / RIM_PASS
    ↓
SCORED / MISSED
```

进球后：

```text
SCORED
 ↓
Score Update
 ↓
Combo Update
 ↓
Celebration
 ↓
Reset Ball
```

未进球：

```text
MISSED
 ↓
Miss Feedback
 ↓
Reset Ball
```

---

# 15. 防止重复计分

一次投篮只能产生一次最终结果。

必须增加：

```text
shotResolved
```

状态。

例如：

```javascript
if (shotResolved) {
    return;
}
```

进球判定成功后：

```text
shotResolved = true
```

避免：

- 一次进球加两次分
- 篮球穿过篮筐后重复检测
- 篮筐碰撞导致重复得分

---

# 16. 得分规则

默认规则：

| 行为 | 得分 |
|---|---:|
| 普通投篮命中 | +2 |
| 三分模式命中 | +3 |
| 连续命中 | Combo |
| Perfect Shot | 额外奖励 |
| 空心入网 | 额外奖励 |

如果没有特殊要求：

```text
普通投篮 = 2 分
Perfect = +1
```

---

# 17. Combo 连击

连续命中时增加 Combo。

例如：

```text
第 1 球：+2
第 2 球：+2 + Combo
第 3 球：+2 + Combo
第 4 球：+2 + Combo
```

推荐：

```text
combo = combo + 1
```

Miss：

```text
combo = 0
```

但不要让 Combo 无限增长。

例如：

```text
maxCombo = 10
```

---

# 18. Perfect Shot

Perfect Shot 用于提升游戏爽感。

建议根据篮球穿过篮筐中心的偏差判断：

```text
offset = abs(ballX - rimCenterX)
```

如果：

```text
offset <= perfectThreshold
```

则：

```text
Perfect Shot
```

视觉反馈：

```text
PERFECT!
+3
```

可以加入：

- 金色文字
- 粒子
- 篮筐闪光
- 轻微屏幕震动
- 音效

---

# 19. 空心入网

如果篮球没有明显碰到篮筐边缘，直接穿过篮筐内部，可以判定：

```text
SWISH
```

推荐条件：

```text
ballX ≈ rimCenterX
AND
ballVelocityY > 0
AND
没有发生 Rim Collision
```

Swish 可以给予额外反馈。

例如：

```text
SWISH!
+3
```

---

# 20. 篮筐碰撞反馈

如果篮球撞击篮筐：

必须表现出：

- 篮球反弹
- 篮球速度改变
- 篮球旋转变化
- 篮网轻微摆动

不要让篮球直接穿过篮筐。

简化碰撞即可。

---

# 21. 篮板碰撞

如果存在篮板：

篮球碰撞篮板后：

```text
vx = -vx × restitution
```

其中：

```text
restitution = 0.6 ~ 0.9
```

根据撞击角度调整反弹。

---

# 22. 篮网动画

进球后篮网应产生轻微动画。

推荐：

```text
Normal
 ↓
Ball Enters
 ↓
Net Compress
 ↓
Net Swing
 ↓
Return
```

实现可以使用：

- Canvas 曲线
- CSS transform
- 简单粒子
- 多段线模拟

不需要复杂物理布料模拟。

---

# 23. 游戏时间

默认：

```text
30 seconds
```

UI：

```text
TIME
00:30
```

游戏开始后：

```text
remainingTime -= deltaTime
```

当：

```text
remainingTime <= 0
```

进入：

```text
GAME_OVER
```

---

# 24. 投篮节奏

投篮游戏最重要的体验之一是：

> 投完后不要让玩家等待太久。

篮球落地 / 出界后：

```text
立即生成下一球
```

建议：

```text
0.2 ~ 0.5 秒
```

进入下一投。

---

# 25. 篮球重置

每次投篮结束后：

```text
ball.x = startX
ball.y = startY

ball.vx = 0
ball.vy = 0

ball.rotation = 0

shotResolved = false
```

重新进入：

```text
READY
```

---

# 26. 游戏状态

投篮游戏至少包含：

```text
LOADING
MENU
READY
AIMING
SHOOTING
BALL_FLYING
SCORED
MISSED
PAUSED
GAME_OVER
```

推荐：

```text
MENU
 ↓
READY
 ↓
AIMING
 ↓
SHOOTING
 ↓
BALL_FLYING
 ↓
SCORED / MISSED
 ↓
READY
```

---

# 27. 游戏核心数据模型

推荐：

```javascript
gameState = {
    phase: "READY",

    score: 0,

    combo: 0,

    maxCombo: 0,

    remainingTime: 30,

    shots: 0,

    madeShots: 0,

    missShots: 0,

    currentShot: {
        power: 0,
        angle: 0,
        resolved: false
    },

    ball: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 18,
        rotation: 0,
        rotationSpeed: 0
    },

    rim: {
        x: 0,
        y: 0,
        width: 90
    }
}
```

---

# 28. 投篮统计

游戏结束时至少统计：

```text
Score
Shots
Made
Miss
Accuracy
Max Combo
```

命中率：

```text
accuracy =
madeShots / shots × 100
```

如果：

```text
shots === 0
```

则：

```text
accuracy = 0
```

---

# 29. 游戏结束页面

默认显示：

```text
GAME OVER

Score
86

Accuracy
72%

Shots
25

Made
18

Max Combo
7
```

提供：

```text
PLAY AGAIN
```

---

# 30. 难度系统

如果用户没有指定难度，至少设计：

```text
Easy
Normal
Hard
```

---

## Easy

特点：

- 篮筐较大
- 瞄准辅助明显
- 投篮轨迹稳定
- 篮球速度较慢
- 时间较长

---

## Normal

特点：

- 正常篮筐
- 普通轨迹辅助
- 普通投篮速度
- 标准时间

---

## Hard

特点：

- 篮筐缩小
- 瞄准辅助减少
- 篮筐位置变化
- 投篮角度更敏感
- 时间减少

---

# 31. 动态难度

如果游戏需要更强的挑战，可以根据玩家表现自动调整。

例如：

```text
连续命中 5 球
        ↓
难度 +1
```

或者：

```text
命中率 > 80%
        ↓
篮筐移动速度增加
```

但动态难度必须缓慢变化。

禁止：

> 玩家刚刚连续命中一次，就突然大幅提高难度。

---

# 32. 移动篮筐

如果采用移动篮筐模式：

```text
rim.x = centerX + sin(time × speed) × range
```

例如：

```text
range = 150
speed = 0.8
```

移动应保持：

> 可预测、连续、平滑。

禁止随机瞬移。

---

# 33. 篮筐缩放

如果需要逐级增加难度：

```text
rimWidth = baseWidth × difficultyFactor
```

例如：

```text
Easy   = 1.2
Normal = 1.0
Hard   = 0.8
```

不要让篮筐小到无法操作。

---

# 34. 镜头与 Canvas

投篮游戏默认使用：

> 2D Canvas。

推荐：

```text
Canvas
 ├── Background
 ├── Court
 ├── Backboard
 ├── Rim
 ├── Net
 ├── Ball
 ├── Aim Guide
 ├── Particles
 └── UI
```

绘制顺序：

```text
Background
↓
Court
↓
Backboard
↓
Rim
↓
Net
↓
Aim Guide
↓
Ball
↓
Particles
↓
UI
```

---

# 35. Canvas 坐标设计

不要把游戏逻辑直接绑定到固定像素。

使用逻辑坐标：

```text
logicalWidth
logicalHeight
```

Canvas 负责进行：

```text
logical coordinates
        ↓
screen coordinates
```

这样可以支持：

- Desktop
- Mobile
- 不同屏幕比例
- Resize

---

# 36. 响应式设计

投篮游戏必须支持：

```text
16:9
4:3
9:16
```

如果为移动端设计：

推荐：

```text
portrait
```

如果为桌面小游戏：

推荐：

```text
landscape
```

核心游戏区域不能因为窗口变化而变形。

---

# 37. Touch 事件

移动端必须支持：

```text
pointerdown
pointermove
pointerup
```

不要只实现：

```text
mousedown
mousemove
mouseup
```

推荐统一使用：

```text
Pointer Events
```

这样：

```text
Mouse
Touch
Pen
```

可以使用同一套逻辑。

---

# 38. 输入控制

输入逻辑应该与游戏逻辑解耦。

例如：

```text
Input Layer
    ↓
Aim Controller
    ↓
Shot Controller
    ↓
Physics
```

不要在：

```text
pointermove
```

里面直接修改所有游戏状态。

---

# 39. 游戏循环

使用：

```text
requestAnimationFrame
```

核心：

```text
Input
 ↓
Update
 ↓
Collision
 ↓
Game State
 ↓
Render
```

标准循环：

```text
while game running:

    read input

    update game state

    update ball physics

    detect collisions

    detect score

    update effects

    render canvas
```

---

# 40. Delta Time

物理计算必须基于：

```text
deltaTime
```

例如：

```text
ball.x += ball.vx × deltaTime
ball.y += ball.vy × deltaTime
ball.vy += gravity × deltaTime
```

不要直接：

```text
ball.x += ball.vx
```

否则不同刷新率设备上的游戏速度可能不同。

---

# 41. 投篮轨迹预测

预测轨迹必须与真实物理使用相同的核心参数：

```text
gravity
initialVelocity
initialPosition
```

避免出现：

> 预测轨迹显示能进球，实际却完全进不了。

预测算法可以与真实物理共用：

```text
calculateTrajectory()
```

---

# 42. 预测轨迹与真实轨迹

建议：

```text
Aim Guide
    ↓
calculateTrajectory()
    ↓
Shot
    ↓
calculateTrajectory()
```

即：

> **预测和真实投篮必须使用同一套物理模型。**

只允许预测阶段隐藏：

- 碰撞
- 篮板
- 篮筐反弹

等复杂因素。

---

# 43. 视觉反馈

投篮游戏必须具备至少以下反馈：

### 命中

```text
+2
```

### Perfect

```text
PERFECT!
+3
```

### 连击

```text
COMBO ×5
```

### 未命中

```text
MISS
```

### 游戏结束

```text
GAME OVER
```

---

# 44. 得分动画

得分数字出现后：

```text
scale: 1 → 1.3 → 1
opacity: 1 → 0
```

同时：

```text
向上移动
```

例如：

```text
        +2
         ↑
         ↑
         ↑
```

动画时间建议：

```text
500 ~ 1000ms
```

---

# 45. 粒子效果

命中后可以产生：

```text
Particle Burst
```

粒子从篮筐附近向外扩散。

推荐：

```text
10 ~ 30 particles
```

不要产生大量粒子。

小游戏优先保证：

> 性能稳定。

---

# 46. 屏幕震动

Perfect Shot 或特殊进球可以触发轻微震动。

例如：

```text
duration = 100ms
intensity = 2~4px
```

普通投篮不要频繁震动。

---

# 47. 音效

建议至少：

```text
shoot
rim-hit
score
swish
perfect
game-over
```

音效应根据事件触发，而不是每一帧触发。

---

# 48. 音效降级

如果浏览器：

- 未授权声音
- 自动播放被禁止
- 音频资源不存在

游戏必须继续运行。

音频不能成为游戏运行的前置条件。

---

# 49. 游戏开始

用户点击：

```text
START GAME
```

之后：

```text
score = 0
combo = 0
shots = 0
madeShots = 0
remainingTime = gameDuration
```

然后进入：

```text
READY
```

---

# 50. 投篮计数

用户真正释放投篮时：

```text
shots += 1
```

而不是：

- 按下篮球
- 开始瞄准

时增加。

因为：

> 一次完整的投篮应该以“出手”为统计节点。

---

# 51. Miss 判定

篮球满足以下任一情况可以判定 Miss：

```text
超出游戏区域
```

或者：

```text
飞行时间超过 maxShotDuration
```

或者：

```text
明显离开有效投篮区域
```

例如：

```text
maxShotDuration = 3s
```

避免篮球永远飞行。

---

# 52. 防止篮球卡死

必须处理：

```text
ball stuck
```

例如篮球：

- 卡在篮筐
- 卡在篮板
- 卡在边界
- 速度接近 0
- 长时间没有产生结果

可以设置：

```text
shotTimeout
```

超过时间后：

```text
MISSED
```

然后重置。

---

# 53. 边界处理

篮球飞出 Canvas 后：

```text
MISSED
```

如果篮球进入：

```text
x < -margin
x > width + margin
y > height + margin
```

则结束当前投篮。

---

# 54. 游戏暂停

暂停时：

```text
phase = PAUSED
```

必须停止：

- 计时器
- 篮球物理
- 动画
- 粒子
- Combo 时间

恢复后继续。

---

# 55. 页面失焦

如果浏览器：

- 切换 Tab
- 窗口失焦
- 手机切换应用

默认建议：

```text
自动暂停
```

避免玩家回来时：

> 游戏已经结束。

---

# 56. 投篮游戏 UI

默认 UI：

```text
┌─────────────────────────────┐
│ SCORE        TIME           │
│  32          00:21          │
│                             │
│           🏀                │
│                             │
│                 ┌──────┐    │
│                 │      │    │
│                 └──────┘    │
│                    ○        │
│                             │
│             COMBO ×4       │
└─────────────────────────────┘
```

核心 UI 必须让玩家始终知道：

```text
我得了多少分？
还剩多久？
当前是否连击？
篮球在哪里？
篮筐在哪里？
```

---

# 57. 默认 UI 优先级

优先级：

```text
Score
↓
Timer
↓
Combo
↓
Aim Guide
↓
Feedback
↓
其他装饰
```

不要让装饰元素遮挡：

- 篮球
- 篮筐
- 瞄准线

---

# 58. 视觉风格

如果用户没有指定风格，默认：

> 简洁、明亮、运动游戏风格。

建议：

- 篮球场
- 篮板
- 篮筐
- 篮球
- 清晰 UI
- 高对比度反馈

不要默认使用：

- 复杂 3D
- 大量背景动画
- 复杂人物
- 大量 UI 装饰

---

# 59. 游戏体验优先级

开发过程中优先级必须遵循：

```text
玩法正确
    ↓
投篮手感
    ↓
命中判定
    ↓
视觉反馈
    ↓
音效
    ↓
UI
    ↓
装饰
```

不能反过来。

---

# 60. 投篮手感调优

投篮游戏最重要的不是“物理正确”，而是：

> 玩家能够理解自己的投篮为什么进、为什么不进。

因此：

### 好的体验

```text
瞄准
↓
看到轨迹
↓
松手
↓
篮球飞行
↓
进球
↓
明确反馈
```

### 不好的体验

```text
瞄准
↓
松手
↓
篮球随机飞
↓
不知道为什么没进
```

---

# 61. 命中判定容错

浏览器小游戏不能设计得过于苛刻。

建议设置：

```text
rimTolerance
```

允许一定误差。

例如：

```text
effectiveRimWidth =
realRimWidth + tolerance
```

视觉上篮筐不变。

但逻辑判定稍微宽松。

---

# 62. “看起来合理”优先

如果真实物理计算导致：

```text
篮球擦过篮筐 1px
```

但玩家明显认为：

> “这球应该进。”

可以适当提高判定容错。

投篮小游戏应优先：

> 玩家认知 > 物理绝对精确。

---

# 63. 关卡模式

如果实现关卡玩法：

```text
Level 1
↓
固定篮筐

Level 2
↓
篮筐移动

Level 3
↓
篮筐缩小

Level 4
↓
篮筐移动 + 缩小

Level 5
↓
限时 + 移动 + 缩小
```

每一关必须引入有限的新变量。

不要同时加入所有困难因素。

---

# 64. 挑战模式

可以提供：

### 30 秒挑战

```text
30 秒内最高分
```

### 60 秒挑战

```text
60 秒内最高分
```

### 10 球挑战

```text
10 球内最高得分
```

### Perfect Challenge

```text
连续 Perfect
```

---

# 65. 排行榜

如果接入排行榜：

数据至少包括：

```text
playerId
score
accuracy
madeShots
shots
maxCombo
createdAt
```

排序：

```text
score DESC
```

如果分数相同：

```text
accuracy DESC
```

再相同：

```text
time / shots
```

---

# 66. 游戏数据事件

可以定义：

```text
GAME_START
SHOT_START
SHOT_RELEASE
RIM_HIT
SHOT_MADE
SHOT_MISS
PERFECT_SHOT
SWISH
COMBO_UPDATE
GAME_PAUSE
GAME_RESUME
GAME_OVER
RESTART
```

用于：

- 数据分析
- 游戏优化
- Bug 定位

---

# 67. 核心指标

如果需要分析游戏表现，至少记录：

```text
Game Start Rate
Game Completion Rate
Average Score
Average Accuracy
Average Shots
Average Combo
Perfect Rate
Swish Rate
Miss Rate
Replay Rate
```

---

# 68. 测试要求

投篮游戏必须重点测试：

## 输入

- 鼠标投篮
- Touch 投篮
- 快速拖拽
- 短距离拖拽
- 超长拖拽
- 点击但不拖拽
- 多指触控

## 物理

- 低力度
- 高力度
- 极端角度
- 篮筐正下方
- 篮板反弹
- 篮筐碰撞

## 得分

- 正常进球
- Perfect
- Swish
- 擦筐
- 篮球穿筐
- 重复碰撞

## 状态

- 开始
- 暂停
- 恢复
- 时间结束
- 重开
- 页面失焦

---

# 69. 必测 Bug

必须重点避免：

### Bug 1：重复计分

```text
一次进球 → +2 +2
```

必须禁止。

---

### Bug 2：篮球穿过篮筐不进球

检查：

```text
crossing detection
```

---

### Bug 3：篮球卡在篮筐

必须有：

```text
timeout
```

---

### Bug 4：不同刷新率速度不同

必须使用：

```text
deltaTime
```

---

### Bug 5：移动端无法投篮

必须使用：

```text
Pointer Events
```

---

### Bug 6：预测轨迹与实际轨迹不一致

必须共用：

```text
physics calculation
```

---

### Bug 7：游戏结束后仍然可以投篮

Game Over 后：

```text
disable gameplay input
```

---

### Bug 8：暂停后计时继续

暂停必须停止：

```text
game timer
physics
effects
```

---

# 70. 性能要求

默认目标：

```text
60 FPS
```

优先控制：

- Canvas 绘制次数
- 粒子数量
- DOM 数量
- 图片资源大小
- 音频资源
- 不必要的 React Render

游戏运行期间：

> 游戏循环不要依赖 React State 高频更新。

---

# 71. React 使用原则

React 主要负责：

```text
页面
UI
菜单
按钮
设置
游戏结果
```

Canvas 负责：

```text
篮球
篮筐
物理
碰撞
动画
粒子
```

不要把：

```text
ball.x
ball.y
ball.vx
ball.vy
```

每一帧都写入 React State。

推荐：

```text
React
 ↓
Game Controller
 ↓
Canvas
```

---

# 72. Canvas 与 React 状态边界

推荐：

### React State

```text
score
combo
remainingTime
gamePhase
gameSettings
```

### Game Runtime

```text
ball
physics
particles
aim
collision
animation
```

高频数据尽量保存在：

```text
useRef
```

或者独立的游戏 Runtime 中。

---

# 73. 资源策略

如果用户没有提供素材：

优先使用：

```text
Canvas Drawing
SVG
CSS
```

实现：

- 篮球
- 篮筐
- 篮板
- 篮网
- 简单球场

不要因为缺少素材导致游戏无法运行。

---

# 74. 图片资源使用

如果使用图片：

必须考虑：

```text
loading
fallback
aspect ratio
device pixel ratio
```

图片加载失败时：

> 必须存在 Canvas / CSS fallback。

---

# 75. Device Pixel Ratio

Canvas 应根据：

```text
devicePixelRatio
```

处理高清屏。

逻辑：

```text
canvas.width =
logicalWidth × DPR

canvas.height =
logicalHeight × DPR
```

同时调整：

```text
context.scale(DPR, DPR)
```

避免 Retina 屏幕模糊。

---

# 76. 游戏参数集中配置

不要把大量魔法数字散落在代码中。

推荐：

```javascript
const GAME_CONFIG = {
    duration: 30,

    physics: {
        gravity: 980,
        restitution: 0.75
    },

    ball: {
        radius: 18,
        maxDragDistance: 240
    },

    rim: {
        width: 90,
        tolerance: 8
    },

    scoring: {
        normal: 2,
        perfectBonus: 1
    },

    combo: {
        max: 10
    }
};
```

---

# 77. 调参原则

以下参数必须可以快速调整：

```text
gravity
ballSpeed
dragSensitivity
rimWidth
rimTolerance
shotTimeout
perfectThreshold
comboMultiplier
gameDuration
```

原因：

> 投篮游戏的核心体验高度依赖参数调优。

---

# 78. 不允许随机影响核心投篮结果

默认情况下：

不要让：

```text
random()
```

直接决定：

```text
是否进球
```

例如禁止：

```javascript
if (Math.random() > 0.5) {
    score();
}
```

正确方式：

```text
玩家输入
+
物理轨迹
+
碰撞
=
进球结果
```

随机性可以用于：

- 粒子
- 音效变化
- 篮网动画
- 装饰
- 非核心环境效果

---

# 79. 游戏公平性

如果存在排行榜：

投篮结果必须主要由：

```text
Player Input
+
Physics
+
Collision
```

决定。

禁止：

```text
随机作弊式命中
```

否则排行榜没有意义。

---

# 80. 默认实现策略

当用户只提出：

> “帮我做一个投篮小游戏。”

Skill 应自动采用：

```text
技术：
React + Canvas

模式：
30 秒连续投篮

操作：
拖拽瞄准 + 松手投篮

物理：
二维抛物线

篮筐：
固定篮筐

得分：
命中 +2

Perfect：
额外 +1

Combo：
连续命中

反馈：
得分动画 + 粒子 + 音效

结束：
显示分数、命中率、最高 Combo

响应：
Desktop + Mobile
```

---

# 81. 默认开发顺序

实现投篮游戏时，必须按照以下优先级：

## Phase 1：核心玩法

```text
Canvas
↓
篮球
↓
篮筐
↓
投篮输入
↓
篮球飞行
↓
进球判定
```

---

## Phase 2：游戏规则

```text
Score
↓
Shots
↓
Accuracy
↓
Combo
↓
Timer
↓
Game Over
```

---

## Phase 3：体验

```text
Aim Guide
↓
Trajectory
↓
Perfect
↓
Swish
↓
Particles
↓
Animation
↓
Sound
```

---

## Phase 4：完善

```text
Responsive
↓
Touch
↓
Pause
↓
Restart
↓
Difficulty
↓
Performance
```

---

# 82. 生成代码时的硬性规则

当 Agent 根据本 Skill 生成投篮游戏时：

1. 必须存在明确的篮球对象。
2. 必须存在明确的篮筐对象。
3. 必须存在投篮输入。
4. 必须存在篮球飞行过程。
5. 必须存在真实的轨迹计算。
6. 必须存在进球判定。
7. 一次投篮只能结算一次。
8. 必须处理 Miss。
9. 必须处理篮球超时。
10. 必须支持重新投篮。
11. 必须存在明确的游戏状态。
12. 必须存在得分机制。
13. 必须存在 Game Over。
14. 必须避免用随机数直接决定进球。
15. 必须使用 deltaTime 处理物理。
16. 必须保证预测轨迹与实际轨迹基本一致。
17. 必须支持 Pointer Events。
18. 必须考虑 Canvas Resize。
19. 必须考虑 Device Pixel Ratio。
20. 必须避免每帧高频更新 React State。

---

# 83. Agent 决策规则

当用户需求与本 Skill 冲突时：

### 用户明确指定规则

优先：

```text
User Requirement
```

例如用户要求：

> 篮筐会左右移动。

则启用：

```text
Moving Rim
```

---

### 用户没有指定规则

使用：

```text
Skill Default
```

---

### 用户需求不完整

不要随意增加复杂机制。

例如用户说：

> 做一个简单投篮游戏。

不要自动加入：

- 商店
- 角色系统
- 装备
- 排行榜
- 多人
- 任务
- 金币
- 抽奖

应该先实现：

> **最小可玩的投篮闭环。**

---

# 84. 最小可玩版本 MVP

一个合格的投篮游戏 MVP 至少包含：

```text
篮球
+
篮筐
+
拖拽瞄准
+
投篮
+
篮球飞行
+
进球判定
+
Miss
+
得分
+
计时
+
Game Over
+
Restart
```

如果上述功能没有完成：

> 不应优先增加装饰功能。

---

# 85. 完整体验版本

如果用户要求“精致”“完整”“商业化小游戏”，则在 MVP 基础上增加：

```text
Trajectory Guide
+
Perfect Shot
+
Swish
+
Combo
+
Particles
+
Sound
+
Screen Shake
+
Net Animation
+
Difficulty
+
Pause
+
Responsive
+
Statistics
```

---

# 86. 最终验收标准

生成投篮游戏后，Agent 必须自检：

### 玩法

- [ ] 能够开始游戏
- [ ] 能够瞄准
- [ ] 能够投篮
- [ ] 篮球会飞行
- [ ] 篮球能够进球
- [ ] 篮球能够 Miss
- [ ] 能够连续投篮

### 规则

- [ ] 得分正确
- [ ] Combo 正确
- [ ] 命中率正确
- [ ] 不会重复计分
- [ ] 时间结束后停止游戏

### 物理

- [ ] 使用 deltaTime
- [ ] 轨迹合理
- [ ] 篮筐碰撞合理
- [ ] 篮球不会无限飞行
- [ ] 篮球不会永久卡死

### 交互

- [ ] Mouse 可用
- [ ] Touch 可用
- [ ] Pointer Events 正常
- [ ] 快速操作不会破坏状态

### UI

- [ ] Score 清晰
- [ ] Timer 清晰
- [ ] Combo 清晰
- [ ] Game Over 清晰
- [ ] Restart 可用

### 性能

- [ ] Canvas 渲染稳定
- [ ] 无明显卡顿
- [ ] 无大量无意义 React Render
- [ ] 高 DPI 屏幕显示正常

---

# 87. Skill 核心总结

投篮游戏的核心闭环：

```text
玩家输入
    ↓
瞄准
    ↓
力度
    ↓
投篮
    ↓
物理模拟
    ↓
篮球飞行
    ↓
篮筐碰撞
    ↓
进球判定
    ↓
Score / Combo / Feedback
    ↓
下一球
```

最终设计原则：

> **让玩家觉得“这一球是我投进去的”。**

因此投篮游戏的核心不是：

```text
篮球图片
+
篮筐图片
+
随机得分
```

而是：

```text
Input
+
Trajectory
+
Physics
+
Collision
+
Scoring
+
Feedback
```

这六部分共同构成投篮游戏的核心玩法系统。