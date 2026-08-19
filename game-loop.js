/**
 * 游戏主循环
 * 负责驱动 requestAnimationFrame，串联 input → update → render
 *
 * 设计要点：
 * - 使用 deltaTime 保证不同刷新率下速度一致
 * - 限制 dt 上限 50ms，防止后台切回时跳帧
 * - update / render 拆分，便于单测与固定步长
 * - 暂停时不更新世界，但继续渲染（避免画面冻结的不适感）
 */

/**
 * 单次主循环帧的最大逻辑时长（秒）
 * 防止页面隐藏后切回累积超大 dt 导致物体瞬移
 */
const MAX_DT = 0.05; // 50ms

/**
 * 创建游戏循环
 * @param {object} gameState 全局状态对象
 * @param {CanvasRenderingContext2D} ctx Canvas 2D 上下文
 * @param {object} callbacks 回调集合
 *   - onInput(dt)        读取并处理输入
 *   - onUpdate(dt)       更新游戏世界（物理、AI、状态）
 *   - onRender(ctx)       绘制当前帧
 *   - onResize?(w,h)     画布尺寸变化
 * @returns {object} 控制器 { start, stop, pause, resume, tick }
 */
function startLoop(gameState, ctx, callbacks) {
  if (!gameState || !ctx) {
    throw new Error('[game-loop] gameState 与 ctx 必填');
  }
  const cb = callbacks || {};
  const onInput = typeof cb.onInput === 'function' ? cb.onInput : () => {};
  const onUpdate = typeof cb.onUpdate === 'function' ? cb.onUpdate : () => {};
  const onRender = typeof cb.onRender === 'function' ? cb.onRender : () => {};
  const onResize = typeof cb.onResize === 'function' ? cb.onResize : null;

  let rafId = 0;             // requestAnimationFrame 句柄
  let lastTime = 0;          // 上一帧时间戳（毫秒）
  let running = false;       // 循环是否在跑
  let paused = false;        // 是否暂停

  /**
   * 单帧执行：input → update → render
   * @param {number} timestamp 高精度时间戳（毫秒）
   */
  function tick(timestamp) {
    if (!running) return;

    // 首帧或时间被重置时把 lastTime 设为当前
    if (!lastTime) lastTime = timestamp;

    // 计算 dt（秒）并限制上限
    let dt = (timestamp - lastTime) / 1000;
    if (dt > MAX_DT) dt = MAX_DT;
    lastTime = timestamp;
    gameState.lastTimestamp = timestamp;

    if (!paused) {
      // 1) 读取并处理玩家输入
      onInput(dt);
      // 2) 推进游戏世界
      onUpdate(dt);
    }

    // 3) 渲染（暂停时仍然渲染，保持画面显示暂停状态）
    onRender(ctx);

    // 安排下一帧
    rafId = requestAnimationFrame(tick);
  }

  /**
   * 启动循环
   */
  function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    rafId = requestAnimationFrame(tick);
  }

  /**
   * 停止循环
   */
  function stop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  /**
   * 暂停游戏（不再更新世界）
   */
  function pause() {
    if (paused) return;
    paused = true;
    gameState.pausedAt = performance.now();
  }

  /**
   * 恢复游戏
   */
  function resume() {
    if (!paused) return;
    paused = false;
    // 修正 lastTime，避免恢复时跳一帧
    lastTime = 0;
    if (gameState.pausedAt > 0) {
      gameState.pauseAccumulated += performance.now() - gameState.pausedAt;
      gameState.pausedAt = 0;
    }
  }

  /**
   * 处理窗口尺寸变化
   * @param {number} w 新宽度
   * @param {number} h 新高度
   */
  function resize(w, h) {
    if (onResize) onResize(w, h);
  }

  return {
    start,
    stop,
    pause,
    resume,
    resize,
    isRunning: () => running,
    isPaused: () => paused,
    // 暴露给其他模块直接驱动一帧（调试 / 单测用）
    tick
  };
}

// 暴露到全局
window.startLoop = startLoop;
window.MAX_DT = MAX_DT;
