/**
 * rim.js —— 篮筐模型与绘制
 *
 * 篮筐由篮板（Backboard）、篮筐边缘（Rim）与篮网（Net）组成。
 * 包含左右圆形碰撞点（用于边缘碰撞检测），以及篮网简单状态机。
 * 绘制全部使用 Canvas 原生 API，不依赖素材图片。
 */
(function (global) {
    'use strict';

    const RIM_CONFIG = GAME_CONFIG.rim;

    /**
     * 创建篮筐对象。
     * @param {number} x 篮筐中心 X 坐标
     * @param {number} y 篮筐中心 Y 坐标
     * @returns {object} 篮筐对象
     */
    function createRim(x, y) {
        const centerX = typeof x === 'number' ? x : (GAME_CONFIG.canvas ? GAME_CONFIG.canvas.width / 2 : 400);
        const centerY = typeof y === 'number' ? y : RIM_CONFIG.y;
        const halfWidth = RIM_CONFIG.width / 2;
        const edgeRadius = RIM_CONFIG.edgeRadius || 6;

        return {
            x: centerX,                       // 篮筐中心 X
            y: centerY,                       // 篮筐中心 Y
            width: RIM_CONFIG.width,          // 篮筐宽度
            height: RIM_CONFIG.height,        // 篮筐边缘厚度
            edgeRadius: edgeRadius,           // 边缘碰撞点半径
            rimLeft: {                        // 左边缘碰撞点
                x: centerX - halfWidth,
                y: centerY,
                radius: edgeRadius
            },
            rimRight: {                       // 右边缘碰撞点
                x: centerX + halfWidth,
                y: centerY,
                radius: edgeRadius
            },
            // 篮网状态机：normal → entering → swinging → returning → normal
            net: {
                state: 'normal',
                swing: 0,
                swingSpeed: 0,
                timer: 0,
                points: 6,                    // 篮网分段数
                netLength: 40                 // 篮网下垂长度
            },
            // 是否为移动篮筐（更新位置时由外部启用）
            moving: false,
            moveCenterX: centerX,
            moveRange: RIM_CONFIG.moveRange || 0,
            moveSpeed: RIM_CONFIG.moveSpeed || 0
        };
    }

    /**
     * 更新篮筐位置（预留移动篮筐接口）。
     * 使用真实经过时间 time 驱动正弦运动，保证不同帧率下速度一致。
     * @param {object} rim  篮筐对象
     * @param {number} time 经过时间（秒，用于正弦计算）
     */
    function updateRimPosition(rim, time) {
        if (!rim.moving) return;

        // 正弦平滑移动，禁止随机瞬移
        const x = rim.moveCenterX + Math.sin(time * rim.moveSpeed) * rim.moveRange;
        updateRimGeometry(rim, x, rim.y);
    }

    /**
     * 刷新篮筐内部几何（中心点、左右碰撞点）以匹配新的中心坐标。
     * @param {object} rim  篮筐对象
     * @param {number} x    新的篮筐中心 X
     * @param {number} y    新的篮筐中心 Y
     */
    function updateRimGeometry(rim, x, y) {
        rim.x = x;
        rim.y = y;
        const halfWidth = rim.width / 2;
        rim.rimLeft.x = x - halfWidth;
        rim.rimLeft.y = y;
        rim.rimRight.x = x + halfWidth;
        rim.rimRight.y = y;
    }

    /**
     * 更新篮网状态机（带 dt）。
     * @param {object} rim 篮筐对象
     * @param {number} dt  间隔时间（秒）
     */
    function updateNet(rim, dt) {
        const net = rim.net;

        switch (net.state) {
            case 'normal':
                net.swing = 0;
                break;

            case 'entering':
                // 篮球进入：篮网压缩
                net.swing = 8;
                net.swingSpeed = 200;
                net.state = 'swinging';
                net.timer = 0.4;               // 摆动持续 0.4 秒
                break;

            case 'swinging':
                // 摆动衰减
                net.swing = Math.sin(net.timer * 8) * 5 * (net.timer / 0.4);
                net.timer -= dt;
                if (net.timer <= 0) {
                    net.state = 'returning';
                    net.timer = 0.3;
                }
                break;

            case 'returning':
                // 阻尼衰减回原位
                net.swing *= 0.9;
                net.timer -= dt;
                if (Math.abs(net.swing) < 0.5) {
                    net.swing = 0;
                    net.state = 'normal';
                }
                break;
        }
    }

    /**
     * 触发篮网进入摆动（当球穿过篮筐时调用）。
     * @param {object} rim 篮筐对象
     */
    function onBallPassesRim(rim) {
        if (rim.net.state === 'normal') {
            rim.net.state = 'entering';
        }
    }

    /**
     * 绘制篮筐（Canvas 原生绘制）。
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} rim 篮筐对象
     */
    function drawRim(ctx, rim) {
        const halfWidth = rim.width / 2;
        // 安全兜底：确保 rim.net 永远存在且有效
        if (!rim.net) {
            rim.net = { state: 'normal', swing: 0, swingSpeed: 0, timer: 0, compress: 0, netLength: 45, points: 6 };
        }
        const net = rim.net;

        // ---- 篮板 ----
        drawBackboardShape(ctx, rim, halfWidth);

        // ---- 篮筐边缘（两个圆环 + 顶部横杆） ----
        // 圆环
        ctx.beginPath();
        ctx.fillStyle = '#e74c3c';
        ctx.arc(rim.rimLeft.x, rim.rimLeft.y, rim.edgeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rim.rimRight.x, rim.rimRight.y, rim.edgeRadius, 0, Math.PI * 2);
        ctx.fill();

        // 顶部横杆（连接左右边缘），作为篮筐视觉主体
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = rim.height + 2;
        ctx.beginPath();
        ctx.moveTo(rim.rimLeft.x, rim.rimLeft.y);
        ctx.lineTo(rim.rimRight.x, rim.rimRight.y);
        ctx.stroke();

        // 高光
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rim.rimLeft.x + 2, rim.rimLeft.y - 3);
        ctx.lineTo(rim.rimRight.x - 2, rim.rimRight.y - 3);
        ctx.stroke();

        // ---- 篮网 ----
        drawNetShape(ctx, rim, net, halfWidth);

        // ---- 固定立柱（连接篮筐到篮板） ----
        ctx.strokeStyle = '#b0b0b0';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo((rim.rimLeft.x + rim.rimRight.x) / 2, rim.y - 12);
        ctx.lineTo(rim.rimRight.x + 10, rim.y - 24);
        ctx.stroke();
    }

    /**
     * 绘制篮板（内部共用函数）。
     */
    function drawBackboardShape(ctx, rim, halfWidth) {
        const bbX = rim.rimRight.x + 8;
        const bbY = rim.y - 55;
        const bbW = 8;
        const bbH = 90;

        // 篮板主体
        ctx.fillStyle = '#e8e8e8';
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2;
        ctx.fillRect(bbX, bbY, bbW, bbH);
        ctx.strokeRect(bbX, bbY, bbW, bbH);

        // 篮板内侧高光
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(bbX + 1, bbY + 1, bbW - 2, bbH - 2);
    }

    /**
     * 绘制篮网（多段线，随 swing 偏移摆动）。
     */
    function drawNetShape(ctx, rim, net, halfWidth) {
        const netLength = net.netLength;
        const nodeCount = net.points + 1;

        // 篮网左右垂线 + 底部收紧，用多段曲线模拟
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;

        const topY = rim.y + 4;
        const bottomY = topY + netLength;

        // 左右两根侧边
        for (let side = -1; side <= 1; side += 2) {
            ctx.beginPath();
            ctx.moveTo(rim.rimLeft.x + (side > 0 ? rim.width : 0) * 0.5, topY);
            // 随 swing 增加摆动偏移
            const endX = (rim.rimLeft.x + (side > 0 ? rim.width : 0) * 0.5) + net.swing * 0.5;
            ctx.quadraticCurveTo(
                endX,
                topY + netLength * 0.5 + net.swing,
                (rim.rimLeft.x + rim.rimRight.x) / 2 + (side > 0 ? 8 : -8) + net.swing * 0.3,
                bottomY
            );
            ctx.stroke();
        }

        // 横向交叉线（织网）
        for (let i = 1; i < nodeCount - 1; i++) {
            const t = i / (nodeCount - 1);
            const y = topY + t * netLength;
            const spread = (1 - t) * (rim.width / 2);  // 从上到下逐渐收窄
            const swingOffset = net.swing * Math.sin(t * Math.PI);

            ctx.beginPath();
            ctx.moveTo((rim.rimLeft.x + rim.rimRight.x) / 2 - spread + swingOffset, y);
            ctx.lineTo((rim.rimLeft.x + rim.rimRight.x) / 2 + spread + swingOffset, y);
            ctx.stroke();

            // 纵向链接到下一横线（形成方格）
            const nextY = topY + ((i + 1) / (nodeCount - 1)) * netLength;
            const nextSpread = (1 - (i + 1) / (nodeCount - 1)) * (rim.width / 2);
            for (let j = 0; j < 2; j++) {
                const sideOffset = j === 0 ? -1 : 1;
                ctx.beginPath();
                ctx.moveTo(
                    (rim.rimLeft.x + rim.rimRight.x) / 2 + sideOffset * spread + swingOffset,
                    y
                );
                ctx.lineTo(
                    (rim.rimLeft.x + rim.rimRight.x) / 2 + sideOffset * nextSpread + swingOffset,
                    nextY
                );
                ctx.stroke();
            }
        }

        // 底部收口
        ctx.beginPath();
        ctx.moveTo((rim.rimLeft.x + rim.rimRight.x) / 2 - 8 + net.swing * 0.3, bottomY);
        ctx.lineTo((rim.rimLeft.x + rim.rimRight.x) / 2 + 8 + net.swing * 0.3, bottomY);
        ctx.stroke();
    }

    const Api = {
        createRim: createRim,
        updateRimPosition: updateRimPosition,
        updateRimGeometry: updateRimGeometry,
        updateNet: updateNet,
        onBallPassesRim: onBallPassesRim,
        drawRim: drawRim
    };

    global.Rim = Api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Api;
    }
})(typeof window !== 'undefined' ? window : globalThis);