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
   * 把子模块的纯函数挂到 GameModules.updates / .renders / .inputs
   * 让主循环每帧自动调用它们
   */
  function registerModuleGlue() {
    const reg = ensureModuleRegistry();

    // ---- 渲染钩子：按绘制顺序加入 ----

    // 1. 背景层（球场 / 场地装饰）
    if (window.Court || typeof window.drawCourt === 'function') {
      reg.renders.push(function renderCourt(gs, ctx) {
        if (window.Court && typeof window.Court.render === 'function') window.Court.render(gs, ctx);
        else if (typeof window.drawCourt === 'function') window.drawCourt(ctx);
      });
    }

    // 2. 篮板 / 篮筐 / 篮网（B 包）
    if (window.Backboard && typeof window.Backboard.drawBackboard === 'function') {
      reg.renders.push((gs, ctx) => { try { window.Backboard.drawBackboard(ctx, gs.backboard); } catch(e){} });
    }
    if (window.Rim && typeof window.Rim.drawRim === 'function') {
      reg.renders.push((gs, ctx) => { try { window.Rim.drawRim(ctx, gs.rim); } catch(e){} });
    }
    if (typeof window.drawNet === 'function') {
      reg.renders.push((gs, ctx) => { try { window.drawNet(ctx, gs.rim, gs.net); } catch(e){} });
    }

    // 3. 篮球
    if (window.BallModule && typeof window.BallModule.drawBall === 'function') {
      reg.renders.push((gs, ctx) => { try { window.BallModule.drawBall(ctx, gs.ball); } catch(e){} });
    }

    // 4. 瞄准线 / 轨迹预测（瞄准中）
    if (typeof window.drawAimGuide === 'function') {
      reg.renders.push((gs, ctx) => {
        if (gs.phase !== STATE.AIMING || !gs.input || !gs.input.isDown) return;
        try { window.drawAimGuide(ctx, gs.ball, gs.input.start, gs.input.current, gs.currentShot.power); } catch(e){}
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

    // 8. 物理 / 碰撞 / 进球判定（B 包）
    if (window.Physics && typeof window.Physics.updatePhysics === 'function') {
      reg.updates.push((gs, dt) => {
        if (gs.phase !== STATE.BALL_FLYING) return;
        try { window.Physics.updatePhysics(gs.ball, dt); } catch(e){ console.error(e); }
      });
    }
    if (window.Collision) {
      reg.updates.push((gs, dt) => {
        if (gs.phase !== STATE.BALL_FLYING) return;
        try {
          if (typeof window.Collision.checkRimEdgeCollision === 'function') window.Collision.checkRimEdgeCollision(gs.ball, gs.rim);
          if (typeof window.Collision.checkBackboardCollision === 'function') window.Collision.checkBackboardCollision(gs.ball, gs.backboard);
        } catch(e){}
      });
    }
    if (window.Scoring) {
      reg.updates.push((gs, dt) => {
        if (gs.phase !== STATE.BALL_FLYING || gs.shotResolved) return;
        try {
          if (typeof window.Scoring.checkScore === 'function') window.Scoring.checkScore(gs);
        } catch(e){}
      });
    }

    // 9. 篮网动画
    if (typeof window.updateNet === 'function') {
      reg.updates.push((gs, dt) => { try { window.updateNet(gs.net, dt); } catch(e){} });
    }

    // 10. 计时 / Combo / 命中处理（C 包：GameRules）
    if (window.GameRules && typeof window.GameRules.updateGameState === 'function') {
      reg.updates.push((gs, dt) => { try { window.GameRules.updateGameState(gs, dt); } catch(e){} });
    } else if (window.TimerSystem && typeof window.TimerSystem.updateTimer === 'function') {
      reg.updates.push((gs, dt) => { try { window.TimerSystem.updateTimer(dt, gs, null); } catch(e){} });
    }

    // 11. 屏幕震动衰减
    if (typeof window.updateShake === 'function' && window.__shake) {
      reg.updates.push((gs, dt) => { try { window.updateShake(window.__shake, dt); } catch(e){} });
    }

    // ---- 输入钩子：Pointer 事件 ----
    reg.inputs.push(function onInputModule(gs, input, dt) {
      if (!input) return;
      // pointerup（投篮释放）
      if (input.lastRelease && gs.phase === STATE.AIMING && window.Shot) {
        try {
          if (typeof window.Shot.releaseShot === 'function') {
            window.Shot.releaseShot(gs.ball, input.lastRelease.start, input.lastRelease.end, gs);
          }
        } catch (e) { console.error(e); }
      }
      // pointerdown（开始瞄准）
      if (input.justPressed && gs.phase === STATE.READY && window.Shot) {
        try {
          if (typeof window.Shot.startAiming === 'function') {
            window.Shot.startAiming(gs.ball, input.startX, input.startY);
            gs.phase = STATE.AIMING;
          }
        } catch (e) { console.error(e); }
      }
      // pointermove（更新瞄准方向）
      if (input.isDown && gs.phase === STATE.AIMING && window.Shot) {
        try {
          if (typeof window.Shot.updateAiming === 'function') {
            window.Shot.updateAiming(gs.ball, input.currentX, input.currentY, gs.currentShot.power);
          }
        } catch (e) {}
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
  async function bootstrap() {
    ensureModuleRegistry();

    // 7.1 加载所有可选子模块
    await loadAllModules();

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
      gameState.ball = { x: BALL_START_X, y: BALL_START_Y, radius: 18, vx: 0, vy: 0, rotation: 0, inFlight: false, shotResolved: false, hitRim: false, prevX: BALL_START_X, prevY: BALL_START_Y, flightTime: 0 };
    }

    if (typeof Rim !== 'undefined' && typeof Rim.createRim === 'function') {
      gameState.rim = Rim.createRim(RIM_X, RIM_Y);
    } else {
      const rimW = GAME_CONFIG.rim.width;
      gameState.rim = { x: RIM_X, y: RIM_Y, width: rimW, height: GAME_CONFIG.rim.height, rimLeft: { x: RIM_X - rimW/2, y: RIM_Y, radius: 6 }, rimRight: { x: RIM_X + rimW/2, y: RIM_Y, radius: 6 } };
    }

    if (typeof Backboard !== 'undefined' && typeof Backboard.createBackboard === 'function') {
      gameState.backboard = Backboard.createBackboard(RIM_X + 15, RIM_Y - 50);
    } else {
      gameState.backboard = { x: RIM_X + 15, y: RIM_Y - 50, width: 10, height: 120, restitution: 0.75 };
    }

    // 篮网
    gameState.net = { points: 6, swing: 0, swingSpeed: 0, state: 'normal', timer: 0 };

    // 粒子和飘字数组（反馈系统用）
    gameState.particles = [];
    gameState.popups = [];

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

    // 7.6 渲染前的清理（深色背景 + 简单边框）
    function clearStage() {
      ctx.save();
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      ctx.fillStyle = '#11151c';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      // 球场线（占位，后续模块可重绘）
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, LOGICAL_W - 40, LOGICAL_H - 40);
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
      // 状态机阶段：LOADING → MENU → READY
      if (gameState.phase === STATE.LOADING) {
        setState(gameState, STATE.READY);
        ui.showStart();
      }
      for (let i = 0; i < reg.updates.length; i++) {
        try { reg.updates[i](gameState, dt); } catch (e) { console.error(e); }
      }
      ui.refresh();
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
        // 子模块可在 window.GameModules 中注册 reset 钩子
        if (typeof window.__resetRun === 'function') {
          try { window.__resetRun(gameState); } catch (e) { console.error(e); }
        }
        resetRunState(gameState);
        setState(gameState, STATE.READY);
        ui.hideResult();
        ui.hideStart();
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
        setState(gameState, STATE.GAME_OVER);
        loop.pause();
        const accuracy = stats.shots > 0
          ? Math.round((stats.made / stats.shots) * 100)
          : 0;
        ui.showResult({
          score: stats.score,
          shots: stats.shots,
          made:  stats.made,
          miss:  stats.miss,
          accuracy,
          maxCombo: stats.maxCombo
        });
      },

      /** 进入准备态（由开始按钮调用） */
      beginRun() {
        resetRunState(gameState);
        setState(gameState, STATE.READY);
        ui.hideStart();
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
