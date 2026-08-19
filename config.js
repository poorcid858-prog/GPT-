/**
 * 游戏全局配置
 * 集中管理可调参数，方便手感调优
 */
const GAME_CONFIG = {
  // 游戏时长（秒）
  duration: 30,

  // 物理参数
  physics: {
    gravity: 980,            // 重力加速度 (px/s²)
    restitution: 0.75,       // 通用碰撞恢复系数
    rimRestitution: 0.6,     // 篮筐碰撞恢复系数
    backboardRestitution: 0.75 // 篮板碰撞恢复系数
  },

  // 篮球参数
  ball: {
    radius: 18,              // 篮球半径 (px)
    maxDragDistance: 240,    // 最大拖拽距离 (px)
    minPower: 0.6,           // 最小力度系数
    maxPower: 1.4,           // 最大力度系数
    baseForce: 900,          // 基础弹射力
    rotationFactor: 0.02     // 旋转速度系数
  },

  // 篮筐参数
  rim: {
    width: 90,               // 篮筐宽度
    height: 8,               // 篮筐边缘厚度
    tolerance: 8,            // 判定容差 (px)
    y: 180                   // 篮筐 Y 坐标（设计分辨率）
  },

  // 计分参数
  scoring: {
    normal: 2,               // 普通命中得分
    perfectBonus: 1,         // Perfect 奖励
    swishBonus: 1,           // 空心入网奖励
    perfectThreshold: 12,    // Perfect 判定阈值 (px)
    threePointRadius: 300    // 三分线半径
  },

  // Combo 参数
  combo: {
    max: 10                  // 最大连击数
  },

  // 投篮参数
  shot: {
    maxDuration: 3,          // 单次投篮最大时长 (秒)
    stuckThreshold: 5        // 卡死判定速度阈值
  },

  // 轨迹预测
  trajectory: {
    predictPoints: 8,        // 总预测点数
    showPoints: 6,           // 显示点数
    dt: 1 / 30               // 预测步长 (秒)
  },

  // 粒子系统
  particles: {
    count: 20,               // 粒子数量
    life: 0.5,               // 粒子生命周期 (秒)
    gravity: 600             // 粒子重力
  }
};
