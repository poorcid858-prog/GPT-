# 投篮计分规则参考文档

本文件是商业级投篮游戏（basketball-shooting-game）的计分规则规范，覆盖 2 分、3 分、Perfect、Swish、Combo、Accuracy、Miss 七大计分主题。所有代码示例使用 JavaScript（Canvas 2D 环境），遵循游戏架构规范（游戏逻辑与 UI 分离、配置集中、状态机驱动）。

---

## 目录

- [2 分（普通命中）](#2-分普通命中)
- [3 分（三分模式）](#3-分三分模式)
- [Perfect（完美命中）](#perfect完美命中)
- [Swish（空心入网）](#swish空心入网)
- [Combo（连击）](#combo连击)
- [Accuracy（命中率）](#accuracy命中率)
- [Miss（未命中）](#miss未命中)

---

## 2 分（普通命中）

### 原理说明

普通投篮命中是计分的基础。当篮球穿过篮筐的得分判定区（球心相对篮筐中心的水平偏差与竖直偏差都在容差内）时，判定为一次命中，基础分 +2。2 分是每次进球的最低得分，Perfect / Swish / Combo 的奖励都在此基础上叠加。

设计要点：
- 命中判定采用「球心 + 容差」模型，篮筐中心与容差半宽决定判定区。
- 命中只加分，不直接关系到 Perfect / Swish 判定（两者是更精细的叠加判定）。
- 判定应只改数据，飘字与粒子等 UI 反馈由 Render 阶段消费事件完成，避免逻辑层直接操作 DOM。

```js
const CONFIG = {
  scoring: { normal: 2, halfRim: 45, tolerance: 8 },
};
let score = 0;

// 命中判定：球心水平/竖直偏差均在容差内
function isMade(ball, rim) {
  const half = CONFIG.scoring.halfRim + CONFIG.scoring.tolerance;
  return Math.abs(ball.x - rim.x) < half &&
         Math.abs(ball.y - rim.y) < ball.radius;
}

function onScore(ball, rim) {
  if (!isMade(ball, rim)) return;
  score += CONFIG.scoring.normal;   // +2
  emit('score', { points: CONFIG.scoring.normal });
}
```

---

## 3 分（三分模式）

### 原理说明

三分模式为远距离投篮提供更高回报：当出手点与篮筐中心的直线距离超过三分线半径 `threePointRadius` 时，命中记为三分球，+3 分。三分线半径按出手位置判定——出手时球的发射点已决定分值档位，飞行途中不再变化。

设计要点：
- 出手点 `shootFrom` 在投篮触发那一刻锁定，飞行中不可变。
- 三分线半径可配置，Easy 缩小、Hard 放大来调整远投难度。
- 三分命中同样叠加 Perfect / Swish / Combo 奖励（三分 + Perfect = 4 分等）。

```js
const CONFIG = {
  threePoint: { radius: 300, penalty: 3 },
};

function isThreePoint(shootFrom, rim) {
  const dx = shootFrom.x - rim.x;
  const dy = shootFrom.y - rim.y;
  const dist = Math.hypot(dx, dy);
  return dist >= CONFIG.threePoint.radius;
}

// 出手时锁定分值档位
function shootBall(shootFrom, power, angle) {
  ballCatalog.shotType = isThreePoint(shootFrom, rim)
    ? 'three' : 'two';
  fireBall(shootFrom, power, angle);
}

// 命中结算：按出手时锁定的档位给分
function onScore(ball) {
  const base = ballCatalog.shotType === 'three'
    ? CONFIG.threePoint.penalty : CONFIG.scoring.normal;
  score += base;
}
```

---

## Perfect（完美命中）

### 原理说明

Perfect 奖励精准度。当篮球穿过篮筐中心与篮筐中心的水平偏差 ≤ `perfectThreshold` 时，判定为 Perfect 命中，在基础分上额外 +1 奖励（3 分球 Perfect 得 4 分，2 分球 Perfect 得 3 分）。视觉上以金色文字 + 粒子反馈强调。

设计要点：
- `perfectThreshold`（如 12px）远小于普通命中容差，只有真正对准中心才触发。
- Perfect 与 Swish 可同时成立，奖励可叠加。
- 金色飘字 `+1` + 金色粒子爆发，突出稀缺感。

```js
const CONFIG = {
  scoring: { perfectThreshold: 12, perfectBonus: 1 },
  fx: { gold: '#ffd700' },
};

function isPerfect(ball, rim) {
  return Math.abs(ball.x - rim.x) <= CONFIG.scoring.perfectThreshold;
}

function resolveHit(ball, rim) {
  const made = isMade(ball, rim);
  if (!made) return;
  const perfect = isPerfect(ball, rim);
  score += CONFIG.scoring.normal + (perfect ? CONFIG.scoring.perfectBonus : 0);
  if (perfect) {
    popups.push({
      text: '+1 PERFECT', color: CONFIG.fx.gold, // 金色文字
      glow: true, age: 0, life: 0.6,
    });
    burstParticles(ball.x, ball.y, CONFIG.fx.gold); // 金色粒子
  }
}
```

---

## Swish（空心入网）

### 原理说明

Swish 指空心入网：篮球穿过篮筐时未接触篮筐边缘（未产生 rim 碰撞），直接落入网心。它在命中基础上额外 +1 奖励。区别于 Perfect 的「中心偏差」，Swish 强调的是「全程无碰圈」——即便球偏了一点只要没撞到边缘也是 Swish。

设计要点：
- Swish 需要跟踪篮球是否在飞行过程中撞击过 rim（`hitRim` 标记）。
- 命中时若 `hitRim === false` 且判定命中，即为 Swish。
- 视觉上以蓝色描边飘字 + 「SWISH」文字提示，与 Perfect 金色区分。

```js
const CONFIG = {
  scoring: { swishBonus: 1 },
};

function onRimCollision(ball) {
  ball.hitRim = true;   // 飞行中一旦碰圈即标记
}

function onScore(ball, rim) {
  if (!isMade(ball, rim)) return;
  const swish = !ball.hitRim;          // 未碰过边缘 = 空心
  let gained = CONFIG.scoring.normal;
  if (swish) {
    gained += CONFIG.scoring.swishBonus; // +1
    popups.push({
      text: 'SWISH!', color: '#4fc3ff', // 蓝色描边提示
      age: 0, life: 0.7,
    });
  }
  score += gained;
  ball.hitRim = false;                  // 结算后重置标记
}
```

---

## Combo（连击）

### 原理说明

Combo 用连续命中激励稳定发挥。计数器从 `combo = 0` 开始，每命中一次 +1（第 1 球 combo 变 1）；一旦 Miss，combo 立即归 0。为避免 Combo 高到失控，设 `maxCombo = 10` 上限，满 10 后不再增长。数值放大显示，给连续命中追加视觉回报。

设计要点：
- 命中成功 `combo = min(combo + 1, maxCombo)`；Miss 直接归 0。
- `maxCombo` 用于结算展示本局最高连击数。
- Combo 放大用补间动画：scale 0.6 → 1.3（命中瞬间）再回落 1.0。

```js
const CONFIG = {
  combo: { max: 10 },
};
let combo = 0;
let maxCombo = 0;

function onHit() {
  combo = Math.min(combo + 1, CONFIG.combo.max); // 每命中 +1，封顶 10
  if (combo > maxCombo) maxCombo = combo;
  comboAnim.scale = 1.3;        // 命中瞬间放大
  comboText.textContent = `COMBO ×${combo}`;
}

function onMiss() {
  combo = 0;                    // Miss 归零
  comboText.textContent = '';
}

// 渲染阶段平滑回补动画
function updateComboScale(dt) {
  comboAnim.scale += (1.0 - comboAnim.scale) * 10 * dt;
}
```

---

## Accuracy（命中率）

### 原理说明

命中率 = `madeShots / shots × 100`，用于衡量出手的有效性。当 `shots = 0` 时（尚未出手），命中率按 0% 处理，避免除零。命中率在 Game Over 结算面板中统一展示，帮助玩家评估本局「高效得分」能力。

设计要点：
- 分母用 `shots`（出手总次数），分子 `madeShots`（命中数），Miss 计入分母不计分子。
- `shots = 0` 时显式返回 0，防止 `NaN`。
- Accuracy 为结算统计之一，不参与局内实时计分。

```js
const stats = { shots: 0, madeShots: 0 };

function onMade() { stats.madeShots += 1; }
function onShot()  { stats.shots += 1; }

function getAccuracy() {
  if (stats.shots === 0) return 0;          // 未出手 = 0%
  return Math.round((stats.madeShots / stats.shots) * 100);
}

// 结算面板展示
function goGameOver() {
  const accuracy = getAccuracy();
  showResult({
    score,
    shots: stats.shots,
    made: stats.madeShots,
    accuracy: accuracy + '%',
    maxCombo,
  });
}
```

---

## Miss（未命中）

### 原理说明

Miss 是命中的反面：篮球未进入得分判定区（偏出、撞框弹飞、触地或出界）。Miss 不产生任何得分，并将 Combo 计数器归零，同时弹出红色 Miss 文字反馈。但 Miss 仍计入「总投篮次数」（`shots + 1`），因此会拉低命中率。

设计要点：
- Miss 逻辑在篮球判定无进（落地 / 出界 / 弹开无进）后触发一次。
- Miss 重置 Combo，但**不重置 Perfect / Swish 状态**（它们随下一球飞行重置）。
- Miss 计入 `shots` 统计，作为 Accuracy 的分母。

```js
let misShotFired = true;   // 防止同一球重复触发 Miss

function onBallInvalid(ball) {
  if (!ball.inFlight) return;
  if (isMade(ball, rim)) return;      // 已命中不算 Miss
  if (misShotFired) return;
  misShotFired = true;

  combo = 0;                          // Combo 归零
  comboText.textContent = '';

  popups.push({                       // 红色 Miss 反馈
    text: 'MISS', color: '#ff5252',
    age: 0, life: 0.5,
  });

  stats.shots += 1;                   // 仍计入总投篮次数
}

function onNewShot() {
  misShotFired = false;               // 每次出手重置 Miss 标记
  stats.shots += 1;                   // 出手即计一球
}
```

---

## 计分总表

| 类型 | 基础分 | 额外奖励 | 触发条件 | 影响 Combo | 计入总投篮 |
|------|:------:|:--------:|----------|:----------:|:----------:|
| 2 分 | +2 | - | 球心进入判定区 | 命中 +1 | 是 |
| 3 分 | +3 | - | 出手距离 ≥ 三分线半径 | 命中 +1 | 是 |
| Perfect | 叠加 | +1 | 中心偏差 ≤ perfectThreshold | 命中 +1 | 是 |
| Swish | 叠加 | +1 | 飞行全程未碰边缘 | 命中 +1 | 是 |
| Combo | - | - | 连续命中递增，Miss 归 0 | - | - |
| Accuracy | - | - | madeShots / shots × 100 | - | - |
| Miss | 0 | - | 未进入判定区 | 归 0 | 是 |

奖励叠加关系：2/3 分决定基础分 → 叠加 Perfect/Swish 各 +1 → Ambition 由 Combo 单独计，不计入单球得分。实现时应保证判定顺序为「命中判定 → Perfect 判定 → Swish 判定 → Combo 递增 → Miss 兜底归零」，避免顺序错乱导致的重复加分。

---

本文件为计分规则的权威参考，实现时应与 `game-architecture.md`（架构规范）及 `game-design.md`（玩法机制）保持一致：计分逻辑只更新状态、不操作 DOM，反馈特效由事件驱动在渲染阶段消费。