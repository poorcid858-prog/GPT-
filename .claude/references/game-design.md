# 投篮游戏设计参考文档

本文件是商业级投篮游戏（basketball-shooting-game）的核心玩法与机制设计规范。覆盖计时模式、计球模式、难度系统、篮筐动态、投篮节奏、反馈特效与结算流程。所有代码示例使用 JavaScript（Canvas 2D 环境），用于指导实际开发实现。

---

## 1. 30 秒模式

30 秒模式是限时比赛的经典形态：玩家在固定 30 秒内尽可能命中更多投篮。核心是「时间压力」驱动决策——玩家必须快速出手而非追求完美。倒计时切入 Game Over 前应有一个短暂缓冲，避免「秒表到时瞬间僵死」的生硬感。

设计要点：
- 倒计时从 30 递减到 0，每秒更新一次 UI（显示到秒，可精确到 0.1s 增强紧迫感）。
- 计时到 0 时立即置 `state = 'gameover'`，生成结算，并停止投篮生成。
- 倒计时 UI 放屏幕顶部中央，数字放大并以红色闪烁提示最后 5 秒。

```js
const GAME_TIME = 30;
let timeLeft = GAME_TIME;
let lastTick = performance.now();

function updateTimer(now) {
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    goGameOver();               // 进入结算
  }
  drawTimer(timeLeft);          // 顶部居中渲染
}

function drawTimer(t) {
  const sec = Math.max(0, Math.ceil(t));
  ui.timerText = String(sec);
  ui.timerUrgent = sec <= 5;    // 最后5秒红色闪烁标识
}
```

---

## 2. 10 球模式

10 球模式不限时，玩家拥有固定 10 次出手机会（shots），目标是在允许的投篮次数内取得最高得分。每次生成篮球算一 shot，投出/落地/出界都计一次；10 球用完即结束，比较的是「高效得分」而非「出手速度」。

设计要点：
- `shots` 每生成一球 +1，`made` 计命中数。
- 当 `shots >= 10` 时进入 Game Over，结算时展示命中率。
- 最后一球也要让它完整飞行并判定结果后再结束，避免「投出瞬间弹结算」的截断感。

```js
const TOTAL_SHOTS = 10;
let shots = 0;
let made = 0;

function shootBall(ball) {
  shots += 1;                   // 出手即计一球
  if (checkScore(ball)) made += 1;
  updateScoreBoard();
  if (shots >= TOTAL_SHOTS) {
    // 等最后一球落地/判定完再触发，这里记录结算等待
    pendingGameOver = true;
  }
}

function onBallSettled() {
  if (pendingGameOver) goGameOver();
}
```

---

## 3. 限时模式

限时模式是 30 秒模式的通用化框架：把固定 30 秒抽成配置项 `gameDuration`，可切换 30 / 60 / 90 秒三种预设。这样一套计时系统即可服务多个模式，减少重复代码并方便扩展。

设计要点：
- 用 `gameConfig` 对象承载模式参数（时长、目标球数、篮筐难度等）。
- `duration` 与 `maxShots` 互斥：限时模式用时长，计球模式用球数。
- 模式切换只改配置，不动游戏循环逻辑。

```js
const MODES = {
  timed30: { duration: 30,  maxShots: Infinity, label: '30秒' },
  timed60: { duration: 60,  maxShots: Infinity, label: '60秒' },
  timed90: { duration: 90,  maxShots: Infinity, label: '90秒' },
  balls10: { duration: Infinity, maxShots: 10,  label: '10球' },
};

const gameDuration = MODES.timed30.duration; // 可配置

function isGameOver() {
  const timeOver = timeLeft <= 0;
  const shotsOver = shots >= gameConfig.maxShots;
  return timeOver || shotsOver;
}
```

---

## 4. 移动篮筐

移动篮筐让球场在静态瞄准之外增加动态挑战。篮筐 x 坐标随时间正弦变化，公式 `rim.x = centerX + sin(time * speed) * range`。正弦保证运动是连续平滑的（可预测、无瞬移），玩家能通过观察周期预判移动方向。

设计要点：
- 推荐 `range = 150`，`speed = 0.8`，既能制造挑战又不至于难以捕捉。
- 用真实经过时间 `time` 驱动，保证帧率无关（不同设备上速度一致）。
- 篮筐只水平移动，y 坐标固定；越高难度可缩小 range 反而放大振幅不代表公平，保持平滑即可。

```js
function updateRimX(time) {
  const range = 150;           // 移动范围 ±150px
  const speed = 0.8;           // 角速度
  const centerX = canvas.width / 2;
  rim.x = centerX + Math.sin(time * speed) * range;
  // 通过时间正弦保证平滑，禁止直接 setPosition 瞬移
  drawRim(rim.x, rim.y, rim.width);
}
```

---

## 5. 篮筐缩小

篮筐宽度随难度缩放，直接影响命中判定面积。公式 `rimWidth = baseWidth * difficultyFactor`，Easy / Normal / Hard 对应 1.2 / 1.0 / 0.8。缩小时判定区按比例缩小，手感随之变紧。

设计要点：
- `difficultyFactor` 在难度系统里统一定义，射击判定的碰撞区同步用 `rimWidth` 计算。
- 缩小的篮筐不应改变视觉 y 位置或中心点，只改变宽度。
- 建议把碰撞容差也关联到 rimWidth，保持一致物理。

```js
const DIFFICULTY = {
  Easy:   { factor: 1.2 },
  Normal: { factor: 1.0 },
  Hard:   { factor: 0.8 },
};

const baseRimWidth = 90;
function getRimWidth(difficulty) {
  return baseRimWidth * DIFFICULTY[difficulty].factor;
}
// 命中判定
function checkScore(ball) {
  const half = getRimWidth(currentDifficulty) / 2;
  return Math.abs(ball.x - rim.x) < half && Math.abs(ball.y - rim.y) < ball.radius;
}
```

---

## 6. 难度

难度系统用一组参数驱动游戏手感，而不是单一数值。三级配置覆盖：篮筐大小、瞄准辅助（是否需要吸附）、时间、投篮敏感度（弧线 / 力度容差）。同时支持动态难度——连续命中 5 球自动 +1 档，让持续高分玩家面临更大挑战。

设计要点：
- 三级预置参数表，选中即整体切换。
- 动态难度：`comboStreak` 达 5 时触发升级，重置连击计数器，并弹出「难度提升」提示。
- 动态升级只升不降（本局内向上），避免来回波动破坏节奏。

```js
const DIFFICULTY_SETTINGS = {
  Easy:   { factor: 1.2, aimAssist: true,  timeMult: 1.2, shotSensitivity: 0.6 },
  Normal: { factor: 1.0, aimAssist: true,  timeMult: 1.0, shotSensitivity: 0.5 },
  Hard:   { factor: 0.8, aimAssist: false, timeMult: 0.8, shotSensitivity: 0.4 },
};

let currentDifficulty = 'Normal';
let comboStreak = 0;

function updateDynamicDifficulty() {
  if (comboStreak >= 5) {
    upgradeDifficultyOnce();    // Normal -> Hard 等
    comboStreak = 0;
    showToast('难度提升！');
  }
}
```

---

## 7. 投篮节奏

快节奏是休闲投篮的核心体验。投完后不应让玩家盯着空屏幕等待——应在 0.2～0.5 秒内生成下一球。篮球触地、出界或被判定无进后立即重置准备位，保证「投完即续」的流畅循环。

设计要点：
- 篮球的生命周期：待机 → 投出 → 飞行 → 落地/出界 → 快速重置。
- 用短延迟（250ms）而非即时，留一点视觉缓冲避免闪烁。
- 落地后直接复用同一篮球对象，避免反复创建造成 GC 卡顿。

```js
let nextBallTimer = 0;

function onBallFalling(ball) {
  nextBallTimer = 0.25;         // 0.2~0.5s 内生成下一球
}

function updateBallRespawn(dt) {
  if (state !== 'playing') return;
  if (!ball.inFlight && ball.settled) {
    nextBallTimer -= dt;
    if (nextBallTimer <= 0) {
      resetBallForNextShot(ball);   // 立即回到手持位置，不瞬移而是快速归位
    }
  }
}

function resetBallForNextShot(ball) {
  ball.inFlight = false;
  ball.settled = false;
  ball.x = holdX;
  ball.y = holdY;
  ball.vx = 0;
  ball.vy = 0;
}
```

---

## 8. 反馈

高质量的瞬时反馈决定「手感」。命中时：得分飘字（缩放 + 上移 + 渐隐消失）、Perfect 金色特效、Combo 放大提示；未命中：红色 Miss 提示。另配 10～30 粒粒子在篮筐附近向四周扩散，强化进球的爆发感。

设计要点：
- 飘字用补间动画：scale 0.5→1.2→1，y 上移 40px，alpha 渐隐 600ms。
- Perfect 覆盖在飘字上层，金色描边 + 发光。
- 粒子系统：发射 10～30 粒，初始速度随机扇形扩散，受重力影响，500ms 内消亡。
- 所有反馈元素带独立生命周期，自动清理，避免内存泄漏。

```js
const particles = [];

function spawnScorePopup(x, y, points, isPerfect) {
  popups.push({
    x, y, points, isPerfect,
    age: 0, life: 0.6,
    scale: 0.5, vy: -60,
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 600 * dt;            // 重力
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.age += dt;
    if (p.age > p.life) particles.splice(i, 1);
  }
}

function burstParticles(cx, cy) {
  const n = 10 + Math.floor(Math.random() * 21); // 10~30 粒
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 160;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      age: 0, life: 0.4 + Math.random() * 0.2,
      color: Math.random() > 0.5 ? '#ffd700' : '#ffffff',
    });
  }
}
```

---

## 9. 游戏结束

游戏结束进入结算面板，展示全部统计：Score、Shots、Made、Miss、Accuracy、MaxCombo。数据带入场动画（淡入 + 上移错峰出现），并提供「Play Again」按钮。结算应让人一眼看清本局表现并快速重开。

设计要点：
- 统计在结束时一次性计算：`Accuracy = made / shots`，`Miss = shots - made`。
- 数据行逐个延迟入场（每行间隔 120ms，淡入上移），强化剧场感。
- Play Again 命中高亮，点击触发 `restartGame()`。
- 结算期间暂停所有游戏输入，只响应按钮。

```js
function goGameOver() {
  state = 'gameover';
  timeLeft = 0;
  bgmStop();
  const stats = {
    score,
    shots,
    made,
    miss: shots - made,
    accuracy: shots ? Math.round((made / shots) * 100) + '%' : '0%',
    maxCombo,
  };
  showResultPanel(stats);   // 逐行入场动画
}

function showResultPanel(stats) {
  Object.entries(stats).forEach(([k, v], i) => {
    setTimeout(() => animateInResultRow(k, v), 120 * i + 80);
  });
}
```

---

## 10. Replay 重新开始

Play Again 触发完整状态重置：分数、计时、Combo、篮球位置、篮筐初始 x、残留粒子与飘字全部清理，UI 恢复初始状态。重置必须彻底，否则第二次对局会出现「首局残余」Bug（例如时间不清零、粒子残留）。

设计要点：
- 重置即「回到状态机 playing 初始态」，复用初始化函数 `resetAll()`。
- 清空 `popups`、`particles`、`toasts` 数组并强制渲染空帧。
- 重置难度到初始档位；若支持局内续档，则读配置决定。
- 建议设置一个初始化函数，restart 时直接调用，保证幂等。

```js
function restartGame() {
  // 清除残留特效
  popups.length = 0;
  particles.length = 0;
  toasts.length = 0;

  // 重置核心数值
  score = 0;
  shots = 0;
  made = 0;
  comboStreak = 0;
  maxCombo = 0;
  timeLeft = gameDuration;
  currentDifficulty = 'Normal';

  // 重置实体
  ball.x = holdX;
  ball.y = holdY;
  ball.inFlight = false;
  ball.settled = false;
  ball.vx = ball.vy = 0;
  rim.x = canvas.width / 2;

  // UI 恢复
  ui.resultPanel.visible = false;
  ui.timerText = String(gameDuration);
  state = 'playing';

  lastTick = performance.now();
}

document.getElementById('play-again')
  .addEventListener('click', () => { hideUI(); restartGame(); });
```

---

以上 10 个机制共同构成一套自洽的投篮游戏框架。实现时应优先保证「节奏流畅」与「反馈即时」这两大手感支柱，再逐步叠加难度与模式配置。所有代码示例结构可直接拼接进主体游戏循环，遵循状态机（menu → playing → gameover）驱动。