/**
 * 游戏配置常量
 * 所有可调参数集中在此，方便手感调优
 */
const GAME_CONFIG = {
    // 物理参数
    physics: {
        gravity: 980,            // 重力加速度 (px/s²)
        restitution: 0.75,       // 碰撞恢复系数
        rimRestitution: 0.6,     // 篮筐碰撞恢复系数
        boardRestitution: 0.75   // 篮板碰撞恢复系数
    },

    // 篮球参数
    ball: {
        radius: 18,
        maxDragDistance: 240,    // 最大拖拽距离 (px)
        minPower: 0.6,           // 最小力度系数
        maxPower: 1.4,           // 最大力度系数
        baseForce: 900,          // 基础弹射力
        rotationFactor: 0.02,    // 旋转速度系数
        maxShotDuration: 3       // 投篮超时判定 (秒)
    },

    // 篮筐参数
    rim: {
        width: 90,               // 篮筐宽度
        height: 8,               // 篮筐边缘厚度
        tolerance: 8,            // 判定容差 (px)
        collisionRadius: 6       // 碰撞点半径
    },

    // 篮板参数
    backboard: {
        width: 10,               // 篮板厚度
        height: 120,             // 篮板高度
        offsetX: 60              // 篮筐中心到篮板右侧的偏移
    },

    // 计分参数
    scoring: {
        normal: 2,               // 普通命中得分
        perfectBonus: 1,         // Perfect 额外奖励
        perfectThreshold: 12,    // Perfect 判定阈值 (px)
        swishBonus: 1            // 空心入网奖励
    },

    // Combo 参数
    combo: {
        max: 10                  // 最大连击数
    },

    // 计时参数
    timer: {
        duration: 30,            // 游戏时长 (秒)
        urgentSeconds: 5         // 最后几秒红色闪烁
    },

    // 轨迹预测
    trajectory: {
        predictPoints: 8,        // 预测点数
        showPoints: 6,           // 显示点数
        step: 1 / 30             // 预测步长 (秒)
    },

    // 粒子系统
    particles: {
        minCount: 10,            // 最少粒子数
        maxCount: 30,            // 最多粒子数
        life: 0.5,               // 粒子生命周期 (秒)
        speed: 80,               // 最小速度
        maxSpeed: 240,           // 最大速度
        gravity: 600             // 粒子重力
    },

    // 弹窗反馈
    popup: {
        life: 0.6,               // 弹窗生命周期 (秒)
        riseSpeed: 60,           // 上移速度 (px/s)
        startScale: 0.5,         // 起始缩放
        peakScale: 1.2,          // 峰值缩放
        endScale: 1.0            // 结束缩放
    },

    // 下一球重置延迟
    nextBall: {
        delay: 0.25              // 投篮结束到下一球 (秒)
    },

    // 篮球起始位置 (相对于逻辑尺寸)
    ballStart: {
        xRatio: 0.15,            // 篮球起始 X 占逻辑宽度的比例
        yRatio: 0.75             // 篮球起始 Y 占逻辑高度的比例
    },

    // 篮筐位置 (相对于逻辑尺寸)
    rimPosition: {
        xRatio: 0.68,            // 篮筐中心 X 占逻辑宽度的比例
        yRatio: 0.35             // 篮筐中心 Y 占逻辑高度的比例
    },

    // 逻辑尺寸 (设计分辨率)
    logical: {
        width: 800,
        height: 600
    }
};