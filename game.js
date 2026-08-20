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
    const marginH = 150; // 水平方向容差
    const marginBottom = 80; // 下方容差，减少球飞出屏幕的视觉问题
    if (ball.x < -marginH || ball.x > 800 + marginH || ball.y > 600 + marginBottom) return true;
    // 卡死（飞行超过 1.5 秒后速度极低）
    if (ball.flightTime > 1.5) {
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed < 10) return true;
    }
    // 碰筐后弹开（碰筐后飞行超过 1 秒，且速度仍较大但不再接近篮筐）
    if (ball.hitRim && ball.flightTime > 1.0) {
      const speed = Math.hypot(ball.vx, ball.vy);
      // 速度较大但不接近篮筐 → 判定为碰筐弹出
      if (speed > 50 && gs.rim) {
        const distToRim = Math.hypot(ball.x - gs.rim.x, ball.y - gs.rim.y);
        if (distToRim > 100) return true;
      }
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
      // 人物位置：篮球初始位置左侧，人物在篮球出手位置的左边
      const playerX = (gs.ballStartPos && gs.ballStartPos.x) || 240;
      const playerY = (gs.ballStartPos && gs.ballStartPos.y) || 450;
      // 人物高度 230px（增大以匹配比例），宽度按比例缩放
      const playerHeight = 230;
      const playerWidth = playerHeight * 0.6; // 138px

      // 根据游戏阶段选择人物图片
      let imageToUse = playerImage;
      let useFallback = !playerLoaded || !playerImage || !playerImage.complete || !playerImage.naturalWidth;

      if (!useFallback) {
        // 根据 phase 选择不同的帧
        if (gs.phase === STATE.AIMING) {
          // AIMING 阶段：使用投篮动画帧 1-2（交替）
          const frameIdx = gs.animFrame % 2; // 0 或 1
          if (playerShootFrames[frameIdx] && playerShootFrames[frameIdx].complete) {
            imageToUse = playerShootFrames[frameIdx];
          }
        } else if (gs.phase === STATE.SHOOTING || gs.phase === STATE.BALL_FLYING) {
          // SHOOTING/BALL_FLYING 阶段：使用投篮动画帧 3-6（循环）
          const frameIdx = 2 + (gs.animFrame % 4); // 2, 3, 4, 5
          if (playerShootFrames[frameIdx] && playerShootFrames[frameIdx].complete) {
            imageToUse = playerShootFrames[frameIdx];
          }
        } else if (gs.phase === STATE.SCORED || gs.phase === STATE.MISSED) {
          // SCORED/MISSED 阶段：使用最后一帧（投篮完成姿势）
          if (playerShootFrames[5] && playerShootFrames[5].complete) {
            imageToUse = playerShootFrames[5];
          }
        }
        // READY/MENU 阶段：使用 playerImage（站立姿势）
      }

      // 如果人物图片加载成功，绘制图片
      if (!useFallback) {
        ctx.save();
        // 人物右手持球：人物右侧（手）对齐球位置
        const pDrawX = playerX - playerWidth;
        const pDrawY = playerY - playerHeight + 20;
        ctx.drawImage(
          imageToUse,
          pDrawX,
          pDrawY,
          playerWidth,
          playerHeight
        );
        ctx.restore();
      } else {
        // 人物图片加载失败，绘制简笔人物
        ctx.save();
        const px = playerX - playerWidth;
        const py = playerY - playerHeight + 20;

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
        try {
          // 绘制前强制双向同步，确保 drawRim 读到最新的篮网状态
          if (gs.rim && gs.net && gs.rim.net !== gs.net) {
            gs.rim.net = gs.net;
          } else if (gs.net && gs.rim && !gs.rim.net) {
            gs.rim.net = gs.net;
          } else if (gs.rim && gs.rim.net && !gs.net) {
            gs.net = gs.rim.net;
          }
          window.Rim.drawRim(ctx, gs.rim);
        } catch(e){}
      });
    }

    // 3. 篮球 — 由 onRender 直接绘制，不走 BallModule（避免条件判断导致不可见）

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
            const rimHit = window.Collision.handleRimCollision(gs.ball, gs.rim);
            if (rimHit && typeof playSound === 'function') {
              playSound('rim-hit');
            }
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
            const scoreResult = window.Scoring.onScore(gs, gs.ball);
            if (typeof playSound === 'function') playSound('score');
            gs.currentShot.resolved = true;
            gs.currentShot.isScored = true;
            gs.currentShot.hitRim = gs.ball.hitRim;
            gs.currentShot.hitBackboard = gs.ball.hitBackboard;

            // 触发篮网动画
            if (typeof window.triggerNetSwing === 'function' && gs.net) {
              window.triggerNetSwing(gs.net);
            } else if (gs.rim && gs.rim.net && typeof window.Rim !== 'undefined' && typeof window.Rim.onBallPassesRim === 'function') {
              window.Rim.onBallPassesRim(gs.rim);
            }

            // 根据进球分类触发不同反馈效果
            const rimX = gs.rim ? gs.rim.x : 400;
            const rimY = gs.rim ? gs.rim.y : 180;

            // 飘字反馈
            if (scoreResult) {
              if (scoreResult.isPerfect) {
                // Perfect：金色飘字 + 金色粒子
                if (typeof popupPerfect === 'function') {
                  gs.popups.push(popupPerfect(rimX, rimY - 30));
                }
                if (typeof burstParticles === 'function' && gs.particles) {
                  gs.particles.push(...burstParticles(rimX, rimY, '#ffd700', 25));
                }
                // 播放 perfect 音效
                if (typeof playSound === 'function') {
                  playSound('perfect');
                }
              } else if (scoreResult.isSwish) {
                // Swish（空心入框）：蓝色飘字 + 蓝色粒子
                if (typeof popupSwish === 'function') {
                  gs.popups.push(popupSwish(rimX, rimY - 30));
                }
                if (typeof burstParticles === 'function' && gs.particles) {
                  gs.particles.push(...burstParticles(rimX, rimY, '#4fc3ff', 20));
                }
                // 播放 swish 音效
                if (typeof playSound === 'function') {
                  playSound('swish');
                }
              } else if (scoreResult.isBankShot) {
                // Bank Shot（打板入框）：绿色飘字 + 绿色粒子
                if (typeof popupBankshot === 'function') {
                  gs.popups.push(popupBankshot(rimX, rimY - 30));
                }
                if (typeof burstParticles === 'function' && gs.particles) {
                  gs.particles.push(...burstParticles(rimX, rimY, '#4caf50', 20));
                }
                // 播放 score 音效
                if (typeof playSound === 'function') {
                  playSound('score');
                }
              } else {
                // 普通进球：白色飘字 + 白色粒子
                if (typeof popupScore === 'function') {
                  gs.popups.push(popupScore(rimX, rimY - 30, scoreResult.points));
                }
                if (typeof burstParticles === 'function' && gs.particles) {
                  gs.particles.push(...burstParticles(rimX, rimY, '#ffffff', 15));
                }
                // 播放 score 音效
                if (typeof playSound === 'function') {
                  playSound('score');
                }
              }

              // Combo 反馈（连击数 >= 2 时显示）
              if (gs.combo >= 2 && typeof popupCombo === 'function') {
                gs.popups.push(popupCombo(rimX + 50, rimY - 50, gs.combo));
              }

              // +5秒奖励：进球时倒计时增加5秒（最大60秒）
              const prevTimeLeft = gs.timeLeft || 0;
              gs.timeLeft = Math.min(60, prevTimeLeft + 5);
              gs.remainingTime = gs.timeLeft;
              // +5S 飘字特效（在倒计时位置附近显示）
              if (typeof spawnScorePopup === 'function') {
                gs.popups.push(spawnScorePopup(400, 60, '+5S', '#00e676', false, { big: true }));
              }
              // +5S 音效（用 score 音效升调模拟）
              if (typeof playSound === 'function') {
                playSound('score', { rate: 1.5 });
              }
            }
          } else if (isBallOutOfBounds(gs.ball, gs)) {
            // Miss（出界 / 超时 / 卡死）
            const missResult = window.Scoring.onMiss(gs, gs.ball);
            gs.currentShot.resolved = true;
            gs.currentShot.isScored = false;

            // 根据 Miss 类型触发不同反馈
            const rimX = gs.rim ? gs.rim.x : 400;
            const rimY = gs.rim ? gs.rim.y : 180;
            const missType = gs.currentShot.missType || 'normal';

            if (missType === 'rimOut') {
              // 碰筐弹出：橙色飘字
              if (typeof popupRimOut === 'function') {
                gs.popups.push(popupRimOut(rimX, rimY - 30));
              }
              if (typeof burstParticles === 'function' && gs.particles) {
                gs.particles.push(...burstParticles(rimX, rimY, '#ff9800', 12));
              }
              // 播放 rim-hit 音效
              if (typeof playSound === 'function') {
                playSound('rim-hit');
              }
            } else if (missType === 'airball') {
              // 三不沾：灰色飘字
              if (typeof popupAirball === 'function') {
                gs.popups.push(popupAirball(gs.ball ? gs.ball.x : rimX, gs.ball ? gs.ball.y : rimY));
              }
              // 三不沾无粒子，无音效
            } else {
              // 普通 Miss：红色飘字
              if (typeof popupMiss === 'function') {
                gs.popups.push(popupMiss(rimX, rimY - 30));
              }
              if (typeof burstParticles === 'function' && gs.particles) {
                gs.particles.push(...burstParticles(rimX, rimY, '#ff5252', 10));
              }
            }
          }
        } catch(e){ console.error(e); }
      });
    }

    // 11. 篮网动画
    if (typeof window.updateNet === 'function') {
      reg.updates.push((gs, dt) => {
        try {
          // 双向同步：确保 gs.net 和 gs.rim.net 始终指向同一个对象
          if (gs.rim && gs.rim.net && gs.net !== gs.rim.net) {
            gs.net = gs.rim.net;
          } else if (gs.net && gs.rim && !gs.rim.net) {
            gs.rim.net = gs.net;
          }
          window.updateNet(gs.net, dt);
          // 更新后再次同步，确保 drawRim 读到最新状态
          if (gs.rim && gs.net) gs.rim.net = gs.net;
        } catch(e){}
      });
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
          // 最后 8 秒每秒播放一次紧急音效
          const sec = Math.ceil(gs.timeLeft || 0);
          if (gs.timeLeft <= 8 && gs.timeLeft > 0 && sec !== gs.lastBeepSecond) {
            gs.lastBeepSecond = sec;
            if (typeof playSound === 'function') {
              playSound('button', { rate: 1.2 });
            }
          }
          if (gs.timeLeft > 8) {
            gs.lastBeepSecond = -1;
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
            // 记录按下开始时间（用于力度控制）
            gs.pressStartTime = performance.now();
          }
        } catch (e) { console.error(e); }
      }

      // pointermove（更新瞄准方向）
      if (input.isDown && gs.phase === STATE.AIMING && window.Shot) {
        try {
          if (typeof window.Shot.updateAiming === 'function') {
            // 按住时长控制力度：0~3.5秒映射到0.6~1.4的power
            const holdTime = (performance.now() - gs.pressStartTime) / 1000; // 秒
            const maxHoldTime = 3.5; // 最大蓄力时间（秒），降低进度速度
            const power = 0.6 + Math.min(holdTime / maxHoldTime, 1) * (1.4 - 0.6);
            window.Shot.updateAiming(gs.ball, input.currentX, input.currentY, power);
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
              // 出手音效：仅在一次有效释放时触发
              if (typeof playSound === 'function') {
                playSound('shoot');
              }
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
              // 清除按下开始时间
              gs.pressStartTime = 0;
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
          if (shown <= 8) $timerPanel.classList.add('urgent');
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
      $resultPanel.classList.add('visible');
    }
    function hideResult() {
      if ($resultPanel) {
        $resultPanel.classList.remove('visible');
        $resultPanel.classList.add('hidden');
      }
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

  // 投篮动画帧缓存
  const playerShootFrames = [];
  let playerShootLoaded = 0;
  const PLAYER_SHOOT_COUNT = 6;

  /**
   * 加载背景图片
   * 优先加载 arena-background.png，失败则尝试 court-background.png
   */
  function loadBackgroundImage() {
    const paths = [
      'assets/images/arena-background.png',
      'assets/images/court-background.png'
    ];

    // 串行尝试：arena 成功后不再被较晚完成的 fallback 覆盖
    function tryLoad(index) {
      if (index >= paths.length || bgLoaded) return;
      const path = paths[index];
      const img = new Image();
      img.onload = function() {
        if (bgLoaded) return;
        bgImage = img;
        bgLoaded = true;
      };
      img.onerror = function() {
        console.warn('[game] 背景图片加载失败:', path);
        tryLoad(index + 1);
      };
      img.src = path;
    }

    tryLoad(0);
  }

  /**
   * 加载人物图片
   */
  function loadPlayerImage() {
    const img = new Image();
    img.onload = function() {
      playerImage = img;
      playerLoaded = true;
      // 人物图片加载成功
    };
    img.onerror = function() {
      console.warn('[game] 人物图片加载失败');
    };
    img.src = 'assets/player/player.png';
  }

  /**
   * 加载投篮动画帧（player-shoot-1~6.png）
   */
  function loadPlayerShootFrames() {
    for (let i = 1; i <= PLAYER_SHOOT_COUNT; i++) {
      const img = new Image();
      const idx = i - 1;
      img.onload = function() {
        playerShootFrames[idx] = img;
        playerShootLoaded++;
      };
      img.onerror = function() {
        console.warn('[game] 投篮动画帧加载失败:', i);
      };
      img.src = `assets/player/player-shoot-${i}.png`;
    }
  }

  async function bootstrap() {
    ensureModuleRegistry();

    // 7.1 加载所有可选子模块
    await loadAllModules();

    // 7.1.0 加载背景和人物图片
    loadBackgroundImage();
    loadPlayerImage();
    loadPlayerShootFrames();

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
    const RIM_X = LOGICAL_W * 0.75;  // 向右移动：600/800 = 0.75
    const RIM_Y = LOGICAL_H * 0.283; // 向下移动：170/600 = 0.283
    const BALL_START_X = LOGICAL_W * 0.30;
    const BALL_START_Y = LOGICAL_H * 0.75;

    if (typeof BallModule !== 'undefined') {
      gameState.ball = BallModule.createBall(BALL_START_X, BALL_START_Y);
    } else {
      gameState.ball = { x: BALL_START_X, y: BALL_START_Y, radius: GAME_CONFIG.ball.radius || 25, vx: 0, vy: 0, rotation: 0, rotationSpeed: 0, inFlight: false, shotResolved: false, hitRim: false, hitBackboard: false, prevX: BALL_START_X, prevY: BALL_START_Y, flightTime: 0, startX: BALL_START_X, startY: BALL_START_Y, aimPower: 0 };
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

    // 首次用户交互时解锁音频，并预加载资源；音效失败不影响游戏
    if (typeof autoUnlockOnFirstInteraction === 'function') {
      autoUnlockOnFirstInteraction();
    }
    if (typeof loadSounds === 'function') {
      loadSounds().catch(() => {});
    }

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

    // 7.6 渲染前的清理（优先素材背景，失败时使用渐变球场背景）
    function clearStage() {
      ctx.save();
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

      if (bgLoaded && bgImage && bgImage.complete && bgImage.naturalWidth) {
        // 背景图片加载成功：铺满逻辑画布
        ctx.drawImage(bgImage, 0, 0, LOGICAL_W, LOGICAL_H);
      } else {
        // 图片异步加载失败/尚未完成时，用渐变而非纯黑，保证刷新后仍有完整场景
        const gradient = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
        gradient.addColorStop(0, '#243b53');
        gradient.addColorStop(0.55, '#486581');
        gradient.addColorStop(1, '#102a43');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

        // 简洁球场地面与边框 fallback
        ctx.fillStyle = 'rgba(219, 170, 91, 0.16)';
        ctx.fillRect(0, LOGICAL_H * 0.58, LOGICAL_W, LOGICAL_H * 0.42);
        ctx.strokeStyle = 'rgba(255,255,255,.22)';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, LOGICAL_W - 40, LOGICAL_H - 40);
        ctx.beginPath();
        ctx.arc(LOGICAL_W * 0.5, LOGICAL_H, 190, Math.PI, Math.PI * 2);
        ctx.stroke();
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

      // 进入 READY 时显示一次操作提示；首屏 READY 不提示，只有投篮结束回到 READY 才提示
      if (gameState.phase === STATE.READY &&
          (gameState.previousPhase === STATE.SCORED || gameState.previousPhase === STATE.MISSED) &&
          !gameState.showReadyHint) {
        gameState.showReadyHint = true;
        gameState.readyHintTimer = 1.5;
      }
      if (gameState.showReadyHint) {
        gameState.readyHintTimer = Math.max(0, gameState.readyHintTimer - dt);
        if (gameState.readyHintTimer <= 0) {
          gameState.showReadyHint = false;
        }
      }

      // 更新人物动画帧（每 100ms 切一帧）
      if (gameState.phase === STATE.AIMING || gameState.phase === STATE.SHOOTING || gameState.phase === STATE.BALL_FLYING) {
        gameState.animTimer += dt;
        if (gameState.animTimer >= 0.1) {
          gameState.animTimer -= 0.1;
          gameState.animFrame++;
        }
      } else {
        // 非动画阶段重置帧计数
        gameState.animFrame = 0;
        gameState.animTimer = 0;
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
        gameState.ball.hitBackboard = false;
      }
      // 篮网属于篮筐实体，不随篮球重置；强制双向同步
      if (gameState.rim) {
        if (gameState.rim.net && gameState.net !== gameState.rim.net) {
          gameState.net = gameState.rim.net;
        } else if (gameState.net && !gameState.rim.net) {
          gameState.rim.net = gameState.net;
        } else if (!gameState.net && gameState.rim.net) {
          gameState.net = gameState.rim.net;
        }
      }
    }

    /**
     * 执行游戏结束流程
     */
    function doGameOver() {
      if (gameState.phase === STATE.GAME_OVER) return;
      if (typeof stopBgm === 'function') stopBgm();
      if (typeof playSound === 'function') playSound('game-over');
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
        try {
          reg.renders[i](gameState, ctx);
        } catch (e) { console.error(e); }
      }

      // 只在出手后绘制篮球；READY/AIMING 仅显示人物，避免出现两个球
      const ballVisible = gameState.phase === STATE.BALL_FLYING ||
                          gameState.phase === STATE.SCORED ||
                          gameState.phase === STATE.MISSED;
      if (ballVisible && gameState.ball) {
        const b = gameState.ball;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rotation || 0);
        // 使用配置中的半径，确保始终为25
        const ballRadius = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.ball && GAME_CONFIG.ball.radius) || 25;
        // 篮球主体
        ctx.beginPath();
        ctx.arc(0, 0, ballRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#E8710A';
        ctx.fill();
        ctx.strokeStyle = '#3D2B1F';
        ctx.lineWidth = 2;
        ctx.stroke();
        // 篮球纹路
        ctx.beginPath();
        ctx.moveTo(0, -ballRadius);
        ctx.lineTo(0, ballRadius);
        ctx.strokeStyle = '#3D2B1F';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, ballRadius * 0.6, ballRadius, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 投篮结束后在画布中央显示 1.5 秒操作提示，并随剩余时间渐隐
      if (gameState.phase === STATE.READY && gameState.showReadyHint && gameState.readyHintTimer > 0) {
        const alpha = Math.min(1, gameState.readyHintTimer / 0.45);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 28px sans-serif';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.strokeText('👆 拖拽投篮', 400, 300);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('👆 拖拽投篮', 400, 300);
        ctx.restore();
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
        // 重新播放背景音乐
        if (typeof stopBgm === 'function') stopBgm();
        if (typeof playBgm === 'function') playBgm();
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
        // 播放背景音乐
        if (typeof playBgm === 'function') playBgm();
        loop.resume();
      }
    };
    window.Game = Game;

    // 7.10 绑定按钮
    if (ui.$btnStart) {
      ui.$btnStart.addEventListener('click', () => {
        if (typeof initAudio === 'function') initAudio();
        if (typeof playSound === 'function') playSound('button');
        Game.beginRun();
      });
    }
    if (ui.$btnRestart) {
      ui.$btnRestart.addEventListener('click', () => {
        if (typeof initAudio === 'function') initAudio();
        if (typeof playSound === 'function') playSound('button');
        Game.restart();
      });
    }

    // 7.11 启动
    loop.start();

    // 7.12 页面失焦自动暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && gameState.phase !== STATE.GAME_OVER && gameState.phase !== STATE.LOADING) {
        Game.pause();
      }
    });
  }

  // DOM Ready 后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
