/**
 * collision.js —— 碰撞检测与弹性响应
 *
 * 覆盖：篮筐边缘碰撞（圆形-圆形）、篮板碰撞（圆形-矩形）、反弹响应。
 * 碰撞检测顺序：先篮板碰撞，再篮筐边缘碰撞。
 * 碰撞后标记 ball.hitRim = true（用于 Swish 判定）。
 */
(function (global) {
    'use strict';

    const PHYSICS = GAME_CONFIG.physics;

    /**
     * 圆形-圆形碰撞检测。
     * @param {object} a 圆形 A {x, y, radius}
     * @param {object} b 圆形 B {x, y, radius}
     * @returns {boolean} 是否碰撞
     */
    function circleCollision(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        return dist < a.radius + b.radius;
    }

    /**
     * 检测篮球是否碰到篮筐左右边缘的碰撞点。
     * @param {object} ball 篮球对象
     * @param {object} rim  篮筐对象
     * @returns {{hit: boolean, point: string|null, normal: {x:number, y:number}}}
     */
    function checkRimEdgeCollision(ball, rim) {
        // 检测左边缘
        if (circleCollision(ball, rim.rimLeft)) {
            // 法线方向：从碰撞点指向篮球中心
            const dx = ball.x - rim.rimLeft.x;
            const dy = ball.y - rim.rimLeft.y;
            const dist = Math.hypot(dx, dy) || 1;
            return {
                hit: true,
                point: 'left',
                normal: { x: dx / dist, y: dy / dist }
            };
        }
        // 检测右边缘
        if (circleCollision(ball, rim.rimRight)) {
            const dx = ball.x - rim.rimRight.x;
            const dy = ball.y - rim.rimRight.y;
            const dist = Math.hypot(dx, dy) || 1;
            return {
                hit: true,
                point: 'right',
                normal: { x: dx / dist, y: dy / dist }
            };
        }
        return { hit: false, point: null, normal: { x: 0, y: 0 } };
    }

    /**
     * 检测篮板碰撞（圆形-矩形碰撞）。
     * 篮球从左侧撞到篮板时，水平速度反转并衰减。
     * 根据碰撞在篮板上的 Y 位置微调反弹角度。
     * @param {object} ball      篮球对象
     * @param {object} backboard 篮板对象 {x, y, width, height, restitution}
     * @returns {boolean} 是否发生碰撞
     */
    function checkBackboardCollision(ball, backboard) {
        // 篮球 Y 必须在篮板范围内
        if (ball.y + ball.radius > backboard.y &&
            ball.y - ball.radius < backboard.y + backboard.height) {

            // 篮球从左侧接近篮板（x+radius 进入篮板区域），且水平速度向右（朝篮板去）
            if (ball.x + ball.radius > backboard.x &&
                ball.x + ball.radius < backboard.x + backboard.width + 10 &&
                ball.vx > 0) {

                // 根据碰撞点 Y 位置微调反弹角度
                const hitRatio = (ball.y - backboard.y) / backboard.height; // 0~1
                const angleOffset = (hitRatio - 0.5) * 0.3;                  // -0.15~0.15

                // 反弹位置修正（防止卡住）
                ball.x = backboard.x - ball.radius;

                // 水平速度反转并衰减
                ball.vx = -ball.vx * backboard.restitution;

                // 微调垂直速度（增加真实感）
                ball.vy += ball.vx * angleOffset * 0.5;

                // 标记碰撞
                ball.hitRim = true;

                return true;
            }
        }
        return false;
    }

    /**
     * 篮筐碰撞响应（速度反射 + 旋转变化）。
     * 当篮球碰撞到篮筐左右边缘时：
     * 1. 沿碰撞法线方向反射速度
     * 2. 应用恢复系数衰减
     * 3. 碰撞后旋转速度由水平速度决定
     * 4. 防止篮球卡在碰撞点
     * 5. 标记 hitRim = true
     * @param {object} ball 篮球对象
     * @param {object} rim  篮筐对象
     * @returns {boolean} 是否发生碰撞处理
     */
    function handleRimCollision(ball, rim) {
        const result = checkRimEdgeCollision(ball, rim);
        if (!result.hit) return false;

        const nx = result.normal.x;
        const ny = result.normal.y;

        // 速度沿法线反射（只处理朝向碰撞点的速度分量）
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
            const restitution = PHYSICS.restitutionRim;
            ball.vx = (ball.vx - 2 * dot * nx) * restitution;
            ball.vy = (ball.vy - 2 * dot * ny) * restitution;
        }

        // 碰撞后旋转变化（篮筐碰撞旋转更明显）
        ball.rotationSpeed = ball.vx * PHYSICS.rotationFactor * PHYSICS.rimBounceRotationMultiplier;

        // 防止卡在碰撞点：沿法线方向推开
        ball.x += nx * 2;
        ball.y += ny * 2;

        // 标记碰撞（用于 Swish 判定）
        ball.hitRim = true;

        return true;
    }

    /**
     * 检测篮球是否从篮筐高度上方穿到下方（用于进球判定）。
     * @param {object} ball 篮球对象
     * @param {object} rim  篮筐对象
     * @returns {boolean} 是否穿越
     */
    function checkBallCrossesRim(ball, rim) {
        // 必须在篮筐宽度范围内（考虑篮球半径）
        const inHorizontalRange =
            ball.x + ball.radius > rim.rimLeft.x &&
            ball.x - ball.radius < rim.rimRight.x + rim.rimRight.radius * 2;

        // 从上方穿到下方（垂直方向）
        const crossesDown =
            ball.prevY <= rim.y && ball.y >= rim.y && ball.vy > 0;

        return inHorizontalRange && crossesDown;
    }

    /**
     * 通用速度反射函数（工具函数）。
     * @param {object} velocity    {x, y}
     * @param {object} normal      {x, y} 法线方向（单位向量）
     * @param {number} restitution 恢复系数
     * @returns {{x:number, y:number}} 反射后的速度
     */
    function reflectVelocity(velocity, normal, restitution) {
        const dot = velocity.x * normal.x + velocity.y * normal.y;
        return {
            x: (velocity.x - 2 * dot * normal.x) * restitution,
            y: (velocity.y - 2 * dot * normal.y) * restitution
        };
    }

    const Api = {
        circleCollision: circleCollision,
        checkRimEdgeCollision: checkRimEdgeCollision,
        checkBackboardCollision: checkBackboardCollision,
        handleRimCollision: handleRimCollision,
        checkBallCrossesRim: checkBallCrossesRim,
        reflectVelocity: reflectVelocity
    };

    global.Collision = Api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Api;
    }
})(typeof window !== 'undefined' ? window : globalThis);