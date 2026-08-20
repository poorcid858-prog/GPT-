/**
 * shot.js —— 投篮触发逻辑
 *
 * 包括：开始瞄准、更新瞄准状态、松手投篮。
 * 投篮方向由拖拽方向决定（从篮球向目标方向拖拽）。
 * 力度由拖拽距离映射到 [0.6, 1.4]。
 * 出手时 shots += 1。
 */
(function (global) {
    'use strict';

    const PHYSICS = GAME_CONFIG.physics;

    /**
     * 开始瞄准（记录瞄准起点）。
     * @param {object} ball      篮球对象
     * @param {number} pointerX  指针 X
     * @param {number} pointerY  指针 Y
     */
    function startAiming(ball, pointerX, pointerY) {
        // 瞄准起点记录在篮球上（用于轨迹预测）
        ball.aimStart = { x: pointerX, y: pointerY };
        ball.aimCurrent = { x: pointerX, y: pointerY };
        ball.isAiming = true;
        ball.aimPower = 1.0;
        // 同步球的物理坐标到手部位置（确保飞行从正确位置出发）
        ball.x = pointerX;
        ball.y = pointerY;
    }

    /**
     * 更新瞄准状态（拖拽中）。
     * @param {object} ball      篮球对象
     * @param {number} pointerX  指针 X
     * @param {number} pointerY  指针 Y
     * @param {number} power     力度系数（可选，由外部传入则直接使用；否则由拖拽距离计算）
     */
    function updateAiming(ball, pointerX, pointerY, power) {
        ball.aimCurrent = { x: pointerX, y: pointerY };
        if (power !== undefined) {
            ball.aimPower = power;
        } else {
            // 由拖拽距离实时计算力度
            const dist = Math.hypot(
                pointerX - ball.aimStart.x,
                pointerY - ball.aimStart.y
            );
            const rawPower = dist / 240; // maxDragDistance = 240
            ball.aimPower = Math.max(0.6, Math.min(1.4, rawPower));
        }
    }

    /**
     * 松手投篮——将瞄准状态转换为篮球初速度。
     * @param {object} ball       篮球对象
     * @param {object} dragStart  拖拽起点（若不传则用 ball.aimStart）
     * @param {object} dragCurrent 拖拽当前点（若不传则用 ball.aimCurrent）
     * @param {object} gameState  游戏状态（用于更新 shotResolved / shots 等）
     * @returns {{vx:number, vy:number, power:number}|null} 成功返回初速度，失败返回 null
     */
    function releaseShot(ball, dragStart, dragCurrent, gameState) {
        // 如果篮球已在飞行中或已结算，拒绝重复投篮
        if (ball.inFlight || ball.shotResolved) return null;

        const start = dragStart || ball.aimStart;
        const current = dragCurrent || ball.aimCurrent;

        // 诊断日志：对比投篮方向
        console.log('[SHOT] dragStart:', JSON.stringify(start), 'dragCurrent:', JSON.stringify(current));

        // 最小拖拽距离防误触
        const dragDist = Math.hypot(start.x - current.x, start.y - current.y);
        const minDrag = (typeof PHYSICS.minDragDistance === 'number') ? PHYSICS.minDragDistance : 20;
        if (dragDist < minDrag) {
            // 拖拽距离太小，视为无效投篮
            ball.isAiming = false;
            return null;
        }

        // 计算出手初速度
        const launch = Physics.computeLaunchVelocity(start, current, ball.aimPower);

        // 应用初速度到篮球
        ball.vx = launch.vx;
        ball.vy = launch.vy;
        ball.inFlight = true;
        ball.flightTime = 0;
        ball.shotResolved = false;
        ball.hitRim = false;        // 重置 Swish 标记
        ball.hitBackboard = false;  // 重置 Bank Shot 标记
        ball.isAiming = false;

        // 记录出手位置（用于三分判定）
        gameState.shootFrom = { x: ball.x, y: ball.y };

        // 出手次数 +1
        gameState.shots += 1;

        return launch;
    }

    const Api = {
        startAiming: startAiming,
        updateAiming: updateAiming,
        releaseShot: releaseShot
    };

    global.Shot = Api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Api;
    }
})(typeof window !== 'undefined' ? window : globalThis);