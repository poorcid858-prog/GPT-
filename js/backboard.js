/**
 * backboard.js —— 篮板对象
 *
 * 篮板定义：位置、尺寸、恢复系数。与 collision.js 配合使用。
 */
(function (global) {
    'use strict';

    const BACKBOARD_CONFIG = (GAME_CONFIG.rim && GAME_CONFIG.rim.backboard) || { width: 10, height: 120 };
    const RIM_CONFIG = GAME_CONFIG.rim;

    /**
     * 创建篮板对象。
     * 篮板位于篮筐右侧，通常为垂直矩形。
     * @param {number} rimX 篮筐中心 X
     * @param {number} rimY 篮筐中心 Y
     * @returns {object} 篮板对象
     */
    function createBackboard(rimX, rimY) {
        return {
            x: rimX + RIM_CONFIG.width / 2 + 5,        // 篮板在篮筐右侧
            y: rimY - BACKBOARD_CONFIG.height / 2,       // 篮板居中在篮筐高度
            width: BACKBOARD_CONFIG.width,
            height: BACKBOARD_CONFIG.height,
            restitution: (GAME_CONFIG.physics && GAME_CONFIG.physics.restitutionBackboard) || 0.75
        };
    }

    /**
     * 更新篮板位置（跟随篮筐移动）。
     * @param {object} backboard 篮板对象
     * @param {number} rimX      篮筐中心 X
     * @param {number} rimY      篮筐中心 Y
     */
    function updateBackboardPosition(backboard, rimX, rimY) {
        backboard.x = rimX + RIM_CONFIG.width / 2 + 5;
        backboard.y = rimY - BACKBOARD_CONFIG.height / 2;
    }

    /**
     * 绘制篮板（使用 Canvas 绘制，不依赖素材图片）。
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} backboard 篮板对象
     */
    function drawBackboard(ctx, backboard) {
        ctx.save();

        // 篮板主体（白色矩形，灰色边框）
        ctx.fillStyle = '#f0f0f0';
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.fillRect(backboard.x, backboard.y, backboard.width, backboard.height);
        ctx.strokeRect(backboard.x, backboard.y, backboard.width, backboard.height);

        // 篮板内侧高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(
            backboard.x + 2,
            backboard.y + 2,
            backboard.width - 4,
            backboard.height - 4
        );

        // 篮板外框（红色描边）
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 3;
        ctx.strokeRect(backboard.x - 1, backboard.y - 1, backboard.width + 2, backboard.height + 2);

        ctx.restore();
    }

    const Api = {
        createBackboard: createBackboard,
        updateBackboardPosition: updateBackboardPosition,
        drawBackboard: drawBackboard
    };

    global.Backboard = Api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Api;
    }
})(typeof window !== 'undefined' ? window : globalThis);