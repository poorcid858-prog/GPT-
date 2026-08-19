/**
 * ball.js —— 篮球对象
 *
 * 篮球包含：位置、速度、半径、旋转、飞行时间等属性。
 * drawBall 优先尝试加载贴图作为 fallback，贴图不可用时用 Canvas 原生绘制带旋转弧线。
 */
(function (global) {
    'use strict';

    const BALL_CONFIG = GAME_CONFIG.ball;

    // 模块级贴图缓存（懒加载一次）
    let ballImage = null;
    let imageLoaded = false;
    let imageAttempted = false;

    /**
     * 尝试加载篮球贴图（fallback 用）。
     * assets/images/basketball.png 存在则使用；失败或未就绪则回退 Canvas 绘制。
     */
    function ensureBallImage(src) {
        if (imageAttempted) return;
        imageAttempted = true;

        if (typeof Image === 'undefined') return;

        ballImage = new Image();
        ballImage.onload = function () {
            imageLoaded = true;
        };
        ballImage.src = src || '../assets/images/basketball.png';
    }

    /**
     * 创建篮球对象。
     * @param {number} startX 初始位置 X
     * @param {number} startY 初始位置 Y
     * @returns {object} 篮球对象
     */
    function createBall(startX, startY) {
        return {
            x: startX,
            y: startY,
            radius: BALL_CONFIG.radius,
            vx: 0,
            vy: 0,
            rotation: 0,          // 当前旋转角（弧度）
            rotationSpeed: 0,      // 旋转角速度（弧度/秒）
            flightTime: 0,         // 飞行时间（秒）
            inFlight: false,       // 是否在飞行中
            shotResolved: false,   // 本次投篮是否已结算
            hitRim: false,         // 飞行中是否碰过篮筐边缘（Swish 判定）
            prevX: 0,              // 上一帧位置（穿筐/碰撞判定）
            prevY: 0,
            startX: startX,        // 记录初始位置
            startY: startY
        };
    }

    /**
     * 重置篮球到初始位置（复用同一对象，避免 GC）。
     * @param {object} ball   篮球对象
     * @param {number} [startX] 可选覆盖初始 X
     * @param {number} [startY] 可选覆盖初始 Y
     */
    function resetBall(ball, startX, startY) {
        ball.x = startX !== undefined ? startX : ball.startX;
        ball.y = startY !== undefined ? startY : ball.startY;
        ball.vx = 0;
        ball.vy = 0;
        ball.rotation = 0;
        ball.rotationSpeed = 0;
        ball.flightTime = 0;
        ball.inFlight = false;
        ball.shotResolved = false;
        ball.hitRim = false;
        ball.prevX = ball.x;
        ball.prevY = ball.y;
    }

    /**
     * 用 Canvas 原生绘制篮球（带旋转弧线）。
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} ball 篮球对象
     */
    function drawBall(ctx, ball) {
        if (imageLoaded && ballImage && ballImage.complete && ballImage.naturalWidth) {
            // 贴图可用：绘制贴图（带旋转）
            ctx.save();
            ctx.translate(ball.x, ball.y);
            ctx.rotate(ball.rotation);
            ctx.drawImage(
                ballImage,
                -ball.radius,
                -ball.radius,
                ball.radius * 2,
                ball.radius * 2
            );
            ctx.restore();
            return;
        }

        // ---- 原生 Canvas fallback ----
        ctx.save();
        ctx.translate(ball.x, ball.y);
        ctx.rotate(ball.rotation);

        // 篮球主体
        ctx.beginPath();
        ctx.fillStyle = '#ff6b35';
        ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        // 外圈描边
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 篮球黑线（竖线 + 随旋转显示的弧线）
        // 竖直中线
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -ball.radius);
        ctx.lineTo(0, ball.radius);
        ctx.stroke();

        // 两条旋转弧线（模拟篮球纹理）
        for (let i = 0; i < 2; i++) {
            const angle = i * Math.PI;
            ctx.beginPath();
            ctx.arc(0, 0, ball.radius * 0.72, angle + 0.5, angle + Math.PI - 0.5);
            ctx.stroke();
        }

        // 边缘高光
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius - 1.5, -0.6, 0.6);
        ctx.stroke();

        ctx.restore();
    }

    const Api = {
        createBall: createBall,
        resetBall: resetBall,
        drawBall: drawBall,
        ensureBallImage: ensureBallImage
    };

    global.BallModule = Api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Api;
    }
})(typeof window !== 'undefined' ? window : globalThis);