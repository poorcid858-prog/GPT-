/**
 * 主入口
 * 负责：模块动态加载、Canvas 初始化、输入绑定、循环启动、对外 API
 *
 * 模块加载顺序（按依赖关系）：
 *   config → game-state → game-loop
 *   → physics → ball → rim → collision → scoring
 *   → shot → score-system → combo → timer → game-over → restart
 *   → aim-guide → trajectory → particles → feedback
 *   → screen-shake → net-animation → sound-manager
 *   → game
 *
 * 约定：
 *   1. 子模块向 window.GameModules 注册 update / render / input 函数
 *   2. 子模块可以扩展 Game / gameState 而无需修改本文件
 *   3. 缺失模块自动跳过，主程序依然能跑（便于分阶段交付）
 */
(function () {
  'use strict';

  // ====== 1. 子模块清单（按依赖顺序排列）======
  // 子模块都放在 ./js/ 子目录
  const MODULE_SCRIPTS = [
    'js/physics.js',
    'js/ball.js',
    'js/rim.js',
    'js/backboard.js',
    'js/collision.js',
    'js/scoring.js',
    'js/shot.js',
    'js/score-system.js',
    'js/combo.js',
    'js/timer.js',
    'js/game-over.js',
    'js/restart.js',
    'js/aim-guide.js',
    'js/trajectory.js',
    'js/particles.js',
    'js/feedback.js',
    'js/screen-shake.js',
    'js/net-animation.js',
    'js/sound-manager.js'
  ];

  // ====== 2. 动态加载脚本工具 ======
  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false; // 保持顺序
      s.onload = () => resolve({ src, ok: true });
      s.onerror = () => {
        console.warn(`[game] 模块缺失，已跳过: ${src}`);
        resolve({ src, ok: false });
      };
      document.head.appendChild(s);
    });
  }

  async function loadAllModules() {
    for (const file of MODULE_SCRIPTS) {
      await loadScript(file);
    }
  }

  // ====== 3. 子模块扩展点 ======
  // 子模块挂载到 window.GameModules = { updates: [], renders: [], inputs: [] }
  // 主循环会按注册顺序依次调用
  function ensureModuleRegistry() {
    if (!window.GameModules) {
      window.GameModules = { updates: [], renders: [], inputs: [] };
    }
    return window.GameModules;
  }

  /**
   * 子模块注册接口（全局可用）
   * @param {'update'|'render'|'input'} kind
   * @param {Function} fn
   */
  function register(kind, fn) {
    const reg = ensureModuleRegistry();
    if (kind === 'update') reg.updates.push(fn);
    else if (kind === 'render') reg.renders.push(fn);
    else if (kind === 'input') reg.inputs.push(fn);
  }
  window.registerModule = register;

  // ====== 4.5 子模块集成（glue code）======

  /**
   * 球出界 / 超时 / 卡死判定（简化版，供 scoring 更新钩子使用）
   */
  function isBallOutOfBounds(ball, gs) {
    if (!ball) return false;
    // 飞行超时（增加到 4 秒，给篮球足够时间飞行）
    if (ball.flightTime >= 4.0) return true;
    // 出界（增加边界容差，避免篮球刚飞出画布就判定为 Miss）
    const margin = 150;
    if (ball.x < -margin || ball.x > 800 + margin || ball.y > 600 + margin) return true;
    // 卡死（飞行超过 1.5 秒后速度极低）
    if (ball.flightTime > 1.5) {
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed < 10) return true;
    }
    return false;
  }

  /**
   * 把子模块的纯函数挂到 GameModules.updates / .renders / .inputs
   * 让主循环每帧自动调用它们
   */
  function registerModuleGlue() {
    const reg = ensureModuleRegistry();

    // ---- 渲染钩子：按绘制顺序加入 ----

    // 0. 人物（在篮球之前绘制，作为前景）
    reg.renders.push((gs, ctx) => {
      // 人物位置：篮球初始位置附近（左下方）
      const playerX = (gs.ballStartPos && gs.ballStartPos.x) || 240;
      const playerY = (gs.ballStartPos && gs.ballStartPos.y) || 450;
      const playerWidth = 80;
      const playerHeight = 120;

      // 如果人物图片加载成功，绘制图片
      if (playerLoaded && playerImage && playerImage.complete && playerImage.naturalWidth) {
        ctx.save();
        // 人物在篮球左侧偏下位置
        ctx.drawImage(
          playerImage,
          playerX - playerWidth - 20,
          playerY - playerHeight + 30,
          playerWidth,
          playerHeight
        );
        ctx.restore();
      } else {
        // 人物图片加载失败，绘制简笔人物
        ctx.save();
        const px = playerX - playerWidth - 20;
        const py = playerY - playerHeight + 30;

        // 头部
        ctx.fillStyle = '#ffcc99';
        ctx.beginPath();
        ctx.arc(px + playerWidth / 2, py + 15, 12, 0, Math.PI * 2);
        ctx.fill();

        // 身体
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(px + playerWidth / 2 - 15, py + 27, 30, 40);

        // 手臂（投篮姿势）
        ctx.strokeStyle = '#ffcc99';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        // 左臂
        ctx.beginPath();
        ctx.moveTo(px + playerWidth / 2 - 15, py + 35);
        ctx.lineTo(px + playerWidth / 2 - 30, py + 20);
        ctx.stroke();
        // 右臂（向上投篮）
        ctx.beginPath();
        ctx.moveTo(px + playerWidth / 2 + 15, py + 35);
        ctx.lineTo(px + playerWidth / 2 + 30, py + 10);
        ctx.stroke();

        // 腿部
        ctx.fillStyle = '#3498db';
        ctx.fillRect(px + playerWidth / 2 - 12, py + 67, 10, 35);
        ctx.fillRect(px + playerWidth / 2 + 2, py + 67, 10, 35);

        ctx.restore();
      }
    });

    // 1. 篮板（Backboard 单独绘制）
    if (window.Backboard && typeof window.Backboard.drawBackboard === 'function') {
      reg.renders.push((gs, ctx) => {
        try { window.Backboard.drawBackboard(ctx, gs.backboard); } catch(e){}
      });
    }

    // 2. 篮筐 + 篮网（rim.js 的 drawRim 已包含篮网绘制）
    if (window.Rim && typeof window.Rim.drawRim === 'function') {
      reg.renders.push((gs, ctx) => {
        try { window.Rim.drawRim(ctx, gs.rim); } catch(e){}
      });
    }

    // 3. 篮球
    if (window.BallModule && typeof window.BallModule.drawBall === 'function') {
      reg.renders.push((gs, ctx) => {
        try { window.BallModule.drawBall(ctx, gs.ball); } catch(e){}
      });
    }

    // 4. 瞄准辅助线（仅 AIMING 阶段且按下中）
    if (typeof window.drawAimGuide === 'function') {
      reg.renders.push((gs, ctx) => {
        if (gs.phase !== STATE.AIMING || !gs.input || !gs.input.isDown) return;
        try {
          const dragStart = { x: gs.input.startX, y: gs.input.startY };
          const dragCurrent = { x: gs.input.currentX, y: gs.input.currentY };
          const power = (gs.ball && gs.ball.aimPower) || 0;
          window.drawAimGuide(ctx, gs.ball, dragStart, dragCurrent, power);
        } catch(e){}
      });
    }

    // 5. 粒子
    if (typeof window.updateParticles === 'function' && typeof window.drawParticles === 'function') {
      reg.updates.push((gs, dt) => { try { window.updateParticles(gs.particles || [], dt); } catch(e){} });
      reg.renders.push((gs, ctx) => { try { window.drawParticles(ctx, gs.particles || []); } catch(e){} });
    }

    // 6. 飘字反馈
    if (typeof window.updatePopups === 'function' && typeof window.drawPopups === 'function') {
      reg.updates.push((gs, dt) => { try { window.updatePopups(gs.popups || [], dt); } catch(e){} });
      reg.renders.push((gs, ctx) => { try { window.drawPopups(ctx, gs.popups || []); } catch(e){} });
    }

    // 7. 屏幕震动（应用偏移到 ctx）
    if (typeof window.withShake === 'function' && window.__shake) {
      reg.renders.push((gs, ctx) => {
        try { window.withShake(ctx, window.__shake, () => {}); } catch(e){}
      });
    }

    // ---- 更新钩子 ----

    // 8. 物理（仅 BALL_FLYING 阶段）
    if (window.Physics && typeof window.Physics.updatePhysics === 'function') {
      reg.updates.push((gs, dt) => {
        if (gs.phase !== STATE.BALL_FLYING) return;
        try { window.Physics.updatePhysics(gs.ball, dt); } catch(e){ console.error(e); }
      });
    }

    // 9. 碰撞检测与响应（仅 BALL_FLYING 阶段）
    if (window.Collision) {
      reg.updates.push((gs, dt) => {
        if (gs.phase !== STATE.BALL_FLYING) return;
        try {
          // 篮筐边缘碰撞（handleRimCollision 包含检测+响应）
          if (typeof window.Collision.handleRimCollision === 'function') {
            window.Collision.handleRimCollision(gs.ball, gs.rim);
          }
          // 篮板碰撞（检测+响应一体）
          if (typeof window.Collision.checkBackboardCollision === 'function') {
            window.Collision.checkBackboardCollision(gs.ball, gs.backboard);
          }
        } catch(e){}
      });
    }

    // 10. 进球 / Miss 判定（仅 BALL_FLYING 且未结算）
    if (window.Scoring) {
      reg.updates.push((gs, dt) => {
        if (gs.phase !== STATE.BALL_FLYING || gs.currentShot.resolved) return;
        try {
          if (typeof window.Scoring.isScored === 'function' && window.Scoring.isScored(gs.ball, gs.rim)) {
            // 命中
            window.Scoring.onScore(gs, gs.ball);
            gs.currentShot.resolved = true;
            gs.currentShot.isScored = true;
            gs.currentShot.hitRim = gs.ball.hitRim;
            // 触发篮网动画
            if (typeof window.triggerNetSwing === 'function' && gs.net) {
              window.triggerNetSwing(gs.net);
            } else if (gs.rim && gs.rim.net && typeof window.Rim !== 'undefined' && typeof window.Rim.onBallPassesRim === 'function') {
              window.Rim.onBallPassesRim(gs.rim);
            }
          } else if (isBallOutOfBounds(gs.ball, gs)) {
            // Miss（出界 / 超时 / 卡死）
            window.Scoring.onMiss(gs, gs.ball);
            gs.currentShot.resolved = true;
            gs.currentShot.isScored = false;
          }
        } catch(e){ console.error(e); }
      });
    }

    // 11. 篮网动画
    if (typeof window.updateNet === 'function') {
      reg.updates.push((gs, dt) => { try { window.updateNet(gs.net, dt); } catch(e){} });
    }

    // 12. 倒计时（TimerSystem）
    if (window.TimerSystem && typeof window.TimerSystem.updateTimer === 'function') {
      reg.updates.push((gs, dt) => {
        try {
          window.TimerSystem.updateTimer(dt, gs, null);
          // 同步到 remainingTime（UI 读取此字段）
          if (typeof gs.timeLeft === 'number') {
            gs.remainingTime = gs.timeLeft;
          }
        } catch(e){}
      });
    }

    // 13. Combo 动画推进
    if (window.ComboSystem && typeof window.ComboSystem.updateComboAnimation === 'function') {
      reg.updates.push((gs, dt) => {
        try { window.ComboSystem.updateComboAnimation(gs, dt); } catch(e){}
      });
    }

    // 14. 屏幕震动衰减
    if (typeof window.updateShake === 'function' && window.__shake) {
      reg.updates.push((gs, dt) => { try { window.updateShake(window.__shake, dt); } catch(e){} });
    }

    // ---- 输入钩子：Pointer 事件 ----
    reg.inputs.push(function onInputModule(gs, input, dt) {
      if (!input) return;

      // pointerdown（开始瞄准）
      if (input.justPressed && gs.phase === STATE.READY && window.Shot) {
        try {
          if (typeof window.Shot.startAiming === 'function') {
            window.Shot.startAiming(gs.ball, input.startX, input.startY);
            setState(gs, STATE.AIMING);
          }
        } catch (e) { console.error(e); }
      }

      // pointermove（更新瞄准方向）
      if (input.isDown && gs.phase === STATE.AIMING && window.Shot) {
        try {
          if (typeof window.Shot.updateAiming === 'function') {
            window.Shot.updateAiming(gs.ball, input.currentX, input.currentY);
          }
          // 同步力度到 currentShot（供 UI 消费）
          if (gs.ball && typeof gs.ball.aimPower === 'number') {
            gs.currentShot.power = gs.ball.aimPower;
          }
        } catch (e) {}
      }

      // pointerup（投篮释放）
      if (input.lastRelease && gs.phase === STATE.AIMING && window.Shot) {
        try {
          if (typeof window.Shot.releaseShot === 'function') {
            const dragStart = { x: input.startX, y: input.startY };
            const dragEnd = { x: input.currentX, y: input.currentY };
            const result = window.Shot.releaseShot(gs.ball, dragStart, dragEnd, gs);
            if (result) {
              // 出手成功 → AIMING → SHOOTING → BALL_FLYING
              setState(gs, STATE.SHOOTING);
              setState(gs, STATE.BALL_FLYING);
              // 记录出手信息
              gs.currentShot.startTime = performance.now();
              gs.currentShot.startX = gs.ball.x;
              gs.currentShot.startY = gs.ball.y;
              gs.currentShot.vx = result.vx;
              gs.currentShot.vy = result.vy;
              gs.currentShot.power = result.power;
              gs.currentShot.resolved = false;
              gs.currentShot.isScored = false;
              gs.currentShot.hitRim = false;
            }
          }
        } catch (e) { console.error(e); }
      }
    });
  }
  window.__glue = registerModuleGlue;

  // ====== 4. 画布与缩放 ======
  /**
   * 设置 Canvas 实际像素尺寸与 CSS 尺寸
   * 处理 devicePixelRatio 让画面在高 DPI 设备上仍然清晰
   */
  function setupCanvas(canvas, logicalW, logicalH) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    function resize() {
      // CSS 尺寸：保持逻辑比例，按视口缩放
      const ratio = logicalW / logicalH;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let cssW, cssH;
      if (vw / vh > ratio) {
        cssH = vh;
        cssW = vh * ratio;
      } else {
        cssW = vw;
        cssH = vw / ratio;
      }
      canvas.style.width  = cssW + 'px';
      canvas.style.height = cssH + 'px';
      // 实际像素：cssW * dpr
      canvas.width  = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);

      // 上下文按 dpr 缩放，使游戏逻辑仍按 logicalW × logicalH 编写
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return resize;
  }

  // ====== 5. 屏幕坐标 → 逻辑坐标 ======
  function screenToLogical(canvas, logicalW, logicalH, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width)  * logicalW;
    const y = ((clientY - rect.top)  / rect.height) * logicalH;
    return { x, y };
  }

  // ====== 6. UI 辅助：刷新 HUD ======
  function bindUI(gameState) {
    const $score = document.getElementById('ui-score');
    const $combo = document.getElementById('ui-combo');
    const $timer = document.getElementById('ui-timer');
    const $timerPanel = document.getElementById('ui-timer-panel');
    const $startPanel = document.getElementById('start-panel');
    const $resultPanel = document.getElementById('result-panel');
    const $resultRows = document.getElementById('result-rows');
    const $btnStart = document.getElementById('btn-start');
    const $btnRestart = document.getElementById('btn-restart');

    // 简单快照：游戏循环每帧调用
    let lastShownScore = -1, lastShownCombo = -1, lastShownTimer = -1;

    function refresh() {
      if ($score && gameState.score !== lastShownScore) {
        $score.textContent = String(gameState.score);
        lastShownScore = gameState.score;
      }
      if ($combo && gameState.combo !== lastShownCombo) {
        $combo.textContent = '×' + gameState.combo;
        lastShownCombo = gameState.combo;
      }
      if ($timer) {
        const t = Math.max(0, gameState.remainingTime);
        const shown = Math.ceil(t);
        if (shown !== lastShownTimer) {
          $timer.textContent = String(shown);
          lastShownTimer = shown;
        }
        if ($timerPanel) {
          if (shown <= 5) $timerPanel.classList.add('urgent');
          else $timerPanel.classList.remove('urgent');
        }
      }
    }

    function showStart() {
      if ($startPanel) $startPanel.classList.remove('hidden');
      if ($resultPanel) $resultPanel.classList.add('hidden');
    }
    function hideStart() {
      if ($startPanel) $startPanel.classList.add('hidden');
    }
    function showResult(stats) {
      if (!$resultPanel || !$resultRows) return;
      $resultRows.innerHTML = '';
      const items = [
        { key: '得分',    val: stats.score,                  highlight: true },
        { key: '出手',    val: stats.shots },
        { key: '命中',    val: stats.made },
        { key: 'Miss',    val: stats.miss },
        { key: '命中率',  val: stats.accuracy + '%' },
        { key: '最高连击', val: '×' + stats.maxCombo }
      ];
      items.forEach((it, i) => {
        const row = document.createElement('div');
        row.className = 'result-row' + (it.highlight ? ' highlight' : '');
        row.style.animationDelay = (i * 120 + 80) + 'ms';
        const k = document.createElement('span');
        k.className = 'key';
        k.textContent = it.key;
        const v = document.createElement('span');
        v.className = 'val';
        v.textContent = String(it.val);
        row.append(k, v);
        $resultRows.appendChild(row);
      });
      $resultPanel.classList.remove('hidden');
    }
    function hideResult() {
      if ($resultPanel) $resultPanel.classList.add('hidden');
    }

    return {
      refresh, showStart, hideStart, showResult, hideResult,
      $btnStart, $btnRestart
    };
  }

  // ====== 7. 主流程 ======

  // 背景图片缓存
  let bgImage = null;
  let bgLoaded = false;
  let playerImage = null;
  let playerLoaded = false;

  /**
   * 加载背景图片
   * 优先加载 arena-background.png，失败则尝试 court-background.png
   */
  function loadBackgroundImage() {
    const paths = [
      'assets/images/arena-background.png',
      'assets/images/court-background.png'
    ];

    for (const path of paths) {
      const img = new Image();
      img.onload = function() {
        bgImage = img;
        bgLoaded = true;
        console.log('[game] 背景图片加载成功:', path);
      };
      img.onerror = function() {
        console.warn('[game] 背景图片加载失败:', path);
      };
      img.src = path;
    }
  }

  /**
   * 加载人物图片
   */
  function loadPlayerImage() {
    const img = new Image();
    img.onload = function() {
      playerImage = img;
      playerLoaded = true;
      console.log('[game] 人物图片加载成功');
    };
    img.onerror = function() {
      console.warn('[game] 人物图片加载失败');
    };
    img.src = 'assets/player/player.png';
  }

  async function bootstrap() {
    ensureModuleRegistry();

    // 7.1 加载所有可选子模块
    await loadAllModules();

    // 7.1.0 加载背景和人物图片
    loadBackgroundImage();
    loadPlayerImage();

    // 7.1.1 子模块集成（glue code）
    // 把子模块的纯函数注册到主循环的 update / render / input 钩子
    registerModuleGlue();

    // 7.2 创建状态
    const gameState = createInitialState();

    // 7.3 准备画布
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    // 逻辑尺寸与设计分辨率保持一致（设计文档：800x600）
    const LOGICAL_W = 800;
    const LOGICAL_H = 600;
    setupCanvas(canvas, LOGICAL_W, LOGICAL_H);

    // 7.3.1 初始化实体（篮球、篮筐、篮板、篮网）
    // 篮筐位置：画布右上方（逻辑坐标 800×600 中）
    const RIM_X = LOGICAL_W * 0.72;
    const RIM_Y = LOGICAL_H * 0.22;
    const BALL_START_X = LOGICAL_W * 0.30;
    const BALL_START_Y = LOGICAL_H * 0.75;

    if (typeof BallModule !== 'undefined') {
      gameState.ball = BallModule.createBall(BALL_START_X, BALL_START_Y);
    } else {
      gameState.ball = { x: BALL_START_X, y: BALL_START_Y, radius: 18, vx: 0, vy: 0, rotation: 0, rotationSpeed: 0, inFlight: false, shotResolved: false, hitRim: false, prevX: BALL_START_X, prevY: BALL_START_Y, flightTime: 0, startX: BALL_START_X, startY: BALL_START_Y, aimPower: 0 };
    }

    if (typeof Rim !== 'undefined' && typeof Rim.createRim === 'function') {
      // createRim 接受 (x, y) 坐标
      gameState.rim = Rim.createRim(RIM_X, RIM_Y);
    } else {
      const rimW = GAME_CONFIG.rim.width;
      gameState.rim = { x: RIM_X, y: RIM_Y, width: rimW, height: GAME_CONFIG.rim.height, edgeRadius: 6, rimLeft: { x: RIM_X - rimW/2, y: RIM_Y, radius: 6 }, rimRight: { x: RIM_X + rimW/2, y: RIM_Y, radius: 6 }, net: { state: 'normal', swing: 0, swingSpeed: 0, timer: 0, points: 6, netLength: 40 } };
    }

    if (typeof Backboard !== 'undefined' && typeof Backboard.createBackboard === 'function') {
      gameState.backboard = Backboard.createBackboard(RIM_X, RIM_Y);
    } else {
      const bbConf = (GAME_CONFIG.rim && GAME_CONFIG.rim.backboard) || { width: 10, height: 120 };
      gameState.backboard = { x: RIM_X + (GAME_CONFIG.rim.width / 2) + 5, y: RIM_Y - bbConf.height / 2, width: bbConf.width, height: bbConf.height, restitution: 0.75 };
    }

    // 篮网（rim 内部已包含 net，这里同步一份到 gameState.net 供外部模块使用）
    gameState.net = (gameState.rim && gameState.rim.net) || { points: 6, swing: 0, swingSpeed: 0, state: 'normal', timer: 0 };

    // 粒子和飘字数组（反馈系统用）
    gameState.particles = [];
    gameState.popups = [];

    // 记录起始位置（restart 时归位用）
    gameState.ballStartPos = { x: BALL_START_X, y: BALL_START_Y };

    // 初始化屏幕震动对象
    if (typeof createShake === 'function') {
      window.__shake = createShake();
    }

    // 7.4 UI 绑定
    const ui = bindUI(gameState);

    // 7.5 输入层（Pointer Events，统一鼠标/触屏）
    const input = {
      isDown: false,
      startX: 0, startY: 0,
      currentX: 0, currentY: 0,
      lastRelease: null,
      justPressed: false
    };
    // 挂到 gameState 上，让 glue code 的 input 钩子可以访问
    gameState.input = input;
    function onPointerDown(e) {
      input.justPressed = true;
      const p = screenToLogical(canvas, LOGICAL_W, LOGICAL_H, e.clientX, e.clientY);
      input.isDown = true;
      input.startX = p.x; input.startY = p.y;
      input.currentX = p.x; input.currentY = p.y;
      // 阻止页面滚动 / 选中
      if (e.cancelable) e.preventDefault();
    }
    function onPointerMove(e) {
      if (!input.isDown) return;
      const p = screenToLogical(canvas, LOGICAL_W, LOGICAL_H, e.clientX, e.clientY);
      input.currentX = p.x; input.currentY = p.y;
      if (e.cancelable) e.preventDefault();
    }
    function onPointerUp(e) {
      if (!input.isDown) return;
      input.isDown = false;
      const p = screenToLogical(canvas, LOGICAL_W, LOGICAL_H,
        e.clientX != null ? e.clientX : input.currentX,
        e.clientY != null ? e.clientY : input.currentY);
      input.currentX = p.x; input.currentY = p.y;
      input.lastRelease = {
        start: { x: input.startX, y: input.startY },
        end:   { x: input.currentX, y: input.currentY },
        at: performance.now()
      };
      if (e && e.cancelable) e.preventDefault();
    }
    // Pointer 事件优先；不支持时退化到 touch + mouse
    if ('PointerEvent' in window) {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup',   onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
    } else {
      canvas.addEventListener('touchstart', (e) => onPointerDown(e.touches[0]), { passive: false });
      canvas.addEventListener('touchmove',  (e) => onPointerMove(e.touches[0]), { passive: false });
      canvas.addEventListener('touchend',   (e) => onPointerUp(e.changedTouches[0]), { passive: false });
      canvas.addEventListener('mousedown', onPointerDown);
      canvas.addEventListener('mousemove', onPointerMove);
      canvas.addEventListener('mouseup',   onPointerUp);
    }

    // 7.6 渲染前的清理（绘制背景图片或纯色背景）
    function clearStage() {
      ctx.save();
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

      // 优先绘制背景图片
      if (bgLoaded && bgImage && bgImage.complete && bgImage.naturalWidth) {
        // 绘制背景图片，铺满整个画布
        ctx.drawImage(bgImage, 0, 0, LOGICAL_W, LOGICAL_H);
      } else {
        // 背景图片加载失败，使用纯色背景
        ctx.fillStyle = '#11151c';
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
        // 球场线（占位，后续模块可重绘）
        ctx.strokeStyle = 'rgba(255,255,255,.06)';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, LOGICAL_W - 40, LOGICAL_H - 40);
      }

      ctx.restore();
    }

    // 7.7 主循环回调
    const reg = window.GameModules;
    function onInput(dt) {
      // 输入数据交给注册的 input 模块消费
      for (let i = 0; i < reg.inputs.length; i++) {
        try { reg.inputs[i](gameState, input, dt); } catch (e) { console.error(e); }
      }
      // 一帧后清空「单次释放」事件和「单次按下」事件
      if (input.lastRelease) input.lastRelease = null;
      input.justPressed = false;
    }
    function onUpdate(dt) {
      // 状态机阶段：LOADING → READY（显示开始面板）
      if (gameState.phase === STATE.LOADING) {
        setState(gameState, STATE.READY);
        ui.showStart();
      }

      // 执行所有注册的 update 钩子（物理、碰撞、计分、计时等）
      for (let i = 0; i < reg.updates.length; i++) {
        try { reg.updates[i](gameState, dt); } catch (e) { console.error(e); }
      }

      // —— 投篮结果状态流转 ——
      // BALL_FLYING 且本球已结算 → 短暂进入 SCORED / MISSED
      if (gameState.phase === STATE.BALL_FLYING && gameState.currentShot.resolved) {
        const scored = gameState.currentShot.isScored;
        if (scored) {
          setState(gameState, STATE.SCORED);
        } else {
          setState(gameState, STATE.MISSED);
        }
      }

      // SCORED / MISSED 停留 600ms 后回到 READY（或触发 Game Over）
      if (gameState.phase === STATE.SCORED || gameState.phase === STATE.MISSED) {
        const elapsed = performance.now() - gameState.phaseEnteredAt;
        if (elapsed > 600) {
          // 检查时间是否已耗尽
          const timeUp = (typeof gameState.timeLeft === 'number' && gameState.timeLeft <= 0) ||
                         (typeof gameState.remainingTime === 'number' && gameState.remainingTime <= 0);
          if (timeUp) {
            // 游戏结束
            doGameOver();
          } else {
            // 回到准备态，重置篮球
            setState(gameState, STATE.READY);
            resetBallToStart();
          }
        }
      }

      // —— 游戏结束检测（非投篮状态时）——
      if (gameState.phase !== STATE.GAME_OVER && gameState.phase !== STATE.LOADING
          && gameState.phase !== STATE.SCORED && gameState.phase !== STATE.MISSED) {
        const timeUp = (typeof gameState.timeLeft === 'number' && gameState.timeLeft <= 0) ||
                       (typeof gameState.remainingTime === 'number' && gameState.remainingTime <= 0);
        if (timeUp && (gameState.phase === STATE.READY || gameState.currentShot.resolved)) {
          doGameOver();
        }
      }

      ui.refresh();
    }

    /**
     * 重置篮球到起始位置
     */
    function resetBallToStart() {
      if (window.BallModule && typeof window.BallModule.resetBall === 'function') {
        window.BallModule.resetBall(gameState.ball);
      } else {
        const start = gameState.ballStartPos || { x: 240, y: 450 };
        gameState.ball.x = start.x;
        gameState.ball.y = start.y;
        gameState.ball.vx = 0;
        gameState.ball.vy = 0;
        gameState.ball.prevX = start.x;
        gameState.ball.prevY = start.y;
        gameState.ball.rotation = 0;
        gameState.ball.rotationSpeed = 0;
        gameState.ball.flightTime = 0;
        gameState.ball.inFlight = false;
        gameState.ball.shotResolved = false;
        gameState.ball.hitRim = false;
      }
    }

    /**
     * 执行游戏结束流程
     */
    function doGameOver() {
      if (gameState.phase === STATE.GAME_OVER) return;
      setState(gameState, STATE.GAME_OVER);
      loop.pause();
      const accuracy = gameState.shots > 0
        ? Math.round((gameState.madeShots / gameState.shots) * 100)
        : 0;
      ui.showResult({
        score: gameState.score,
        shots: gameState.shots,
        made:  gameState.madeShots,
        miss:  gameState.missShots,
        accuracy,
        maxCombo: gameState.maxCombo
      });
    }
    function onRender(ctx) {
      clearStage();
      for (let i = 0; i < reg.renders.length; i++) {
        try { reg.renders[i](gameState, ctx); } catch (e) { console.error(e); }
      }
    }

    // 7.8 启动循环
    const loop = startLoop(gameState, ctx, { onInput, onUpdate, onRender });

    // 7.9 对外 API
    const Game = {
      state: gameState,
      ctx,
      input,
      canvas,
      loop,

      /** 重新开始一局 */
      restart() {
        resetRunState(gameState);
        setState(gameState, STATE.READY);
        ui.hideResult();
        ui.hideStart();
        // 重置篮球到起始位置
        resetBallToStart();
        // 重启计时器
        if (window.TimerSystem && typeof window.TimerSystem.startTimer === 'function') {
          window.TimerSystem.startTimer(gameState, GAME_CONFIG.duration);
        }
        loop.resume();
      },

      /** 暂停（同时显示结算/菜单由调用方决定） */
      pause() {
        if (gameState.phase === STATE.PAUSED) return;
        setState(gameState, STATE.PAUSED);
        loop.pause();
      },

      /** 恢复 */
      resume() {
        if (gameState.phase !== STATE.PAUSED) return;
        setState(gameState, STATE.READY);
        loop.resume();
      },

      /** 主动结算（计时归零时由 timer 模块触发） */
      gameOver(stats) {
        doGameOver();
      },

      /** 进入准备态（由开始按钮调用） */
      beginRun() {
        resetRunState(gameState);
        setState(gameState, STATE.READY);
        ui.hideStart();
        // 重置篮球到起始位置
        resetBallToStart();
        // 启动计时器
        if (window.TimerSystem && typeof window.TimerSystem.startTimer === 'function') {
          window.TimerSystem.startTimer(gameState, GAME_CONFIG.duration);
        } else {
          gameState.timer = { running: true, urgent: false, blinkPhase: 0 };
          gameState.timeLeft = GAME_CONFIG.duration;
          gameState.remainingTime = GAME_CONFIG.duration;
        }
        loop.resume();
      }
    };
    window.Game = Game;

    // 7.10 绑定按钮
    if (ui.$btnStart) {
      ui.$btnStart.addEventListener('click', () => Game.beginRun());
    }
    if (ui.$btnRestart) {
      ui.$btnRestart.addEventListener('click', () => Game.restart());
    }

    // 7.11 启动
    loop.start();

    // 7.12 页面失焦自动暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && gameState.phase !== STATE.GAME_OVER && gameState.phase !== STATE.LOADING) {
        Game.pause();
      }
    });

    console.log('[game] 启动完成。模块注册：', {
      update: reg.updates.length,
      render: reg.renders.length,
      input:  reg.inputs.length
    });
  }

  // DOM Ready 后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
