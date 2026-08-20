/**
 * physics.js —— 投篮物理模型
 *
 * 二维抛物线物理模型（Canvas 坐标系 Y 向下为正，向上投篮时 vy 为负）。
 * 所有物理都使用 deltaTime（dt）驱动，保证不同刷新率下速度一致。
 */
(function (global) {
    'use strict';

    // 引用全局配置（config.js 提供的 GAME_CONFIG）
    const PHYSICS = GAME_CONFIG.physics;

    /**
     * 更新篮球位置和速度（半隐式欧拉，重力作用于下一帧速度）。
     * @param {object} ball  篮球对象
     * @param {number} dt    间隔时间（秒）
     */
    function updatePhysics(ball, dt) {
        if (!ball.inFlight) return;

        // 缓存上一帧位置，用于穿筐/碰撞判定
        ball.prevX = ball.x;
        ball.prevY = ball.y;

        // 重力影响垂直速度（向下加速，Canvas 中正方向向下）
        ball.vy += PHYSICS.gravity * dt;

        // 速度位移更新位置
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // 累加飞行时间
        ball.flightTime += dt;
    }

    /**
     * 根据拖拽向量计算出手初速度（玩家"向后拖"投篮）。
     *
     * 投篮方向由拖拽方向决定：以篮球为锚点，向目标方向拖拽。
     * 力度由拖拽距离映射到 [minPower, maxPower]。
     * Canvas 中 Y 向下为正，向上拖拽时 dy = dragStart.y - dragCurrent.y > 0，
     * 转换后 vy 为负（向上）。
     *
     * @param {object} dragStart   拖拽起点 {x, y}
     * @param {object} dragCurrent 拖拽当前点 {x, y}
     * @param {number} power       力度系数（0.6~1.4），若提供则直接使用；否则由拖拽距离计算
     * @returns {{vx: number, vy: number, power: number}} 初速度与力度
     */
    function computeLaunchVelocity(dragStart, dragCurrent, power) {
        // 投篮方向 = 从拖拽起点指向拖拽终点（松手方向即投篮方向）
        const dx = dragCurrent.x - dragStart.x;
        const dy = dragCurrent.y - dragStart.y;
        const dist = Math.hypot(dx, dy) || 1;

        // 力度：未传入则由拖拽距离映射
        let actualPower = power;
        if (actualPower === undefined || actualPower === null) {
            const rawPower = dist / 240;
            actualPower = Math.max(0.6, Math.min(1.4, rawPower));
        }

        // 使用配置中的 baseForce，不再硬编码
        const ballConfig = GAME_CONFIG.ball || {};
        const baseForce = ballConfig.baseForce || 700;
        const force = baseForce * actualPower;
        const dirX = dx / dist;
        // Canvas Y 向下为正，向上拖拽返回负数 vy（向上抛）。
        // 这里保证投篮方向始终向上（允许轻微水平分量）
        const dirY = -Math.abs(dy) / dist;

        return {
            vx: dirX * force,
            vy: dirY * force,
            power: actualPower
        };
    }

    /**
     * 由拖拽起止点直接计算力度系数（供瞄准 UI 使用）。
     * @param {object} dragStart   拖拽起点
     * @param {object} dragCurrent 拖拽当前点
     * @returns {number} 力度系数（0.6~1.4）
     */
    function computeDragPower(dragStart, dragCurrent) {
        const dist = Math.hypot(
            dragStart.x - dragCurrent.x,
            dragStart.y - dragCurrent.y
        );
        const rawPower = dist / PHYSICS.maxDragDistance;
        return Math.max(PHYSICS.minPower, Math.min(PHYSICS.maxPower, rawPower));
    }

    /**
     * 更新篮球旋转角度（旋转速度与水平速度成正比）。
     * @param {object} ball 篮球对象
     * @param {number} dt   间隔时间（秒）
     */
    function updateBallRotation(ball, dt) {
        ball.rotationSpeed = ball.vx * PHYSICS.rotationFactor;
        ball.rotation += ball.rotationSpeed * dt;
    }

    /**
     * 依据与真实物理完全一致的参数生成轨迹预测点（用于瞄准辅助）。
     * 只隐藏碰撞/反弹等复杂因素，抛物线核心必须与真实飞行一致。
     *
     * @param {object} ball        篮球对象（需要 x/y 起点）
     * @param {{vx:number,vy:number}} launch 出手初速度
     * @param {object} config      轨迹配置（可选，默认用 GAME_CONFIG.trajectory）
     * @returns {Array<{x:number,y:number}>} 预测点数组
     */
    function generateTrajectoryPoints(ball, launch, config) {
        const traj = config || GAME_CONFIG.trajectory;
        const points = [];
        const dt = 1 / 60;
        let vx = launch.vx;
        let vy = launch.vy;
        let x = ball.x;
        let y = ball.y;

        for (let i = 0; i < traj.predictPoints; i++) {
            vy += PHYSICS.gravity * dt;
            x += vx * dt;
            y += vy * dt;
            points.push({ x: x, y: y });
        }
        return points;
    }

    // 导出命名空间
    const Api = {
        updatePhysics: updatePhysics,
        computeLaunchVelocity: computeLaunchVelocity,
        computeDragPower: computeDragPower,
        updateBallRotation: updateBallRotation,
        generateTrajectoryPoints: generateTrajectoryPoints
    };

    global.Physics = Api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Api;
    }
})(typeof window !== 'undefined' ? window : globalThis);