/**
 * 游戏状态机
 * 负责定义状态、初始化、状态切换与合法性校验
 *
 * 设计原则：
 * - 状态机显式驱动，避免用一堆布尔变量隐式表示
 * - 状态变更通过 setState 集中处理，便于埋点、调试
 * - 跨状态切换由 canTransition 校验，防止非法跳转
 */

/**
 * 游戏所有可能的状态
 * LOADING     资源加载中
 * MENU        主菜单
 * READY       准备就绪（显示开始按钮）
 * AIMING      玩家蓄力瞄准
 * SHOOTING    出手瞬间（短促状态）
 * BALL_FLYING 篮球飞行中
 * SCORED      命中后短暂反馈
 * MISSED      Miss 后短暂反馈
 * PAUSED      暂停
 * GAME_OVER   结算
 */
const STATE = Object.freeze({
  LOADING: 'LOADING',
  MENU: 'MENU',
  READY: 'READY',
  AIMING: 'AIMING',
  SHOOTING: 'SHOOTING',
  BALL_FLYING: 'BALL_FLYING',
  SCORED: 'SCORED',
  MISSED: 'MISSED',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
});

/**
 * 状态转移表
 * 列出每个状态允许切换到的下一个状态
 * 集中维护，避免散落各处的 if/else
 */
const TRANSITIONS = {
  [STATE.LOADING]:     [STATE.MENU, STATE.READY],
  [STATE.MENU]:        [STATE.READY],
  [STATE.READY]:       [STATE.AIMING, STATE.PAUSED, STATE.GAME_OVER],
  [STATE.AIMING]:      [STATE.SHOOTING, STATE.PAUSED],
  [STATE.SHOOTING]:    [STATE.BALL_FLYING, STATE.PAUSED],
  [STATE.BALL_FLYING]: [STATE.SCORED, STATE.MISSED, STATE.PAUSED],
  [STATE.SCORED]:      [STATE.READY, STATE.GAME_OVER, STATE.PAUSED],
  [STATE.MISSED]:      [STATE.READY, STATE.GAME_OVER, STATE.PAUSED],
  [STATE.PAUSED]:      [STATE.READY, STATE.AIMING, STATE.BALL_FLYING, STATE.GAME_OVER, STATE.MENU],
  [STATE.GAME_OVER]:   [STATE.READY, STATE.MENU]
};

/**
 * 判断状态切换是否合法
 * @param {string} from 当前状态
 * @param {string} to   目标状态
 * @returns {boolean}
 */
function canTransition(from, to) {
  if (from === to) return true; // 同状态幂等
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * 创建初始游戏状态对象
 * @returns {object} gameState
 */
function createInitialState() {
  return {
    // 当前阶段（状态机标记）
    phase: STATE.LOADING,
    // 上一阶段（用于状态变更回调）
    previousPhase: null,
    // 状态进入时间戳（毫秒）
    phaseEnteredAt: 0,

    // —— 玩家数据 ——
    score: 0,                // 当前总分
    combo: 0,                // 当前连击数
    maxCombo: 0,             // 本局最高连击
    remainingTime: GAME_CONFIG.duration, // 剩余时间（秒）
    shots: 0,                // 总出手数
    madeShots: 0,            // 命中数
    missShots: 0,            // Miss 数

    // —— 倒计时（TimerSystem 写入 timeLeft，UI 读取 remainingTime）——
    timeLeft: GAME_CONFIG.duration,

    // —— 当前投篮信息 ——
    currentShot: {
      startTime: 0,          // 出手时间
      startX: 0,             // 出手 X
      startY: 0,             // 出手 Y
      vx: 0,                 // 出手水平速度
      vy: 0,                 // 出手垂直速度
      power: 0,              // 力度系数
      isThree: false,        // 是否三分球
      hitRim: false,         // 是否擦筐
      isPerfect: false,      // 是否 Perfect
      isSwish: false,        // 是否空心
      resolved: false,       // 本球是否已结算
      isScored: false        // 本球是否命中（结算后设置）
    },

    // —— 实体数据占位（由 ball/rim 模块填充）——
    ball: null,
    rim: null,
    backboard: null,
    net: null,

    // —— 暂停时间累积 ——
    pausedAt: 0,
    pauseAccumulated: 0,

    // —— 上一帧时间（供主循环使用）——
    lastTimestamp: 0,

    // —— 动画帧计数器（用于人物动画）——
    animFrame: 0,
    animTimer: 0
  };
}

/**
 * 切换游戏状态
 * 内部校验合法性，非法切换给出警告
 * @param {object} gameState 全局状态对象
 * @param {string} newPhase 目标状态
 * @returns {boolean} 是否切换成功
 */
function setState(gameState, newPhase) {
  if (!gameState) return false;
  const old = gameState.phase;
  if (!canTransition(old, newPhase)) {
    console.warn(`[game-state] 非法的状态切换: ${old} → ${newPhase}`);
    return false;
  }
  gameState.previousPhase = old;
  gameState.phase = newPhase;
  gameState.phaseEnteredAt = performance.now();
  return true;
}

/**
 * 重置与一局相关的可变数据
 * 篮球 / 篮筐等实体位置在调用方负责复原
 * @param {object} gameState
 */
function resetRunState(gameState) {
  gameState.score = 0;
  gameState.combo = 0;
  gameState.maxCombo = 0;
  gameState.remainingTime = GAME_CONFIG.duration;
  gameState.timeLeft = GAME_CONFIG.duration;
  gameState.shots = 0;
  gameState.madeShots = 0;
  gameState.missShots = 0;
  gameState.currentShot.resolved = false;
  gameState.currentShot.isScored = false;
  gameState.currentShot.hitRim = false;
  gameState.currentShot.isPerfect = false;
  gameState.currentShot.isSwish = false;
  gameState.pauseAccumulated = 0;
}

/**
 * 暴露给全局，方便其它模块访问
 */
window.STATE = STATE;
window.createInitialState = createInitialState;
window.setState = setState;
window.canTransition = canTransition;
window.resetRunState = resetRunState;
