/**
 * scoring.js —— 进球判定与计分处理
 *
 * 进球核心条件（同时满足）：
 *   1. 篮球从上方穿到下方（ball.prevY <= rim.y && ball.y >= rim.y）
 *   2. 篮球中心在篮筐宽度范围内（考虑篮球半径）
 *   3. 篮球运动方向向下（vy > 0）
 *
 * 一次投篮只能结算一次（shotResolved 保护）。
 * Perfect：中心偏差 ≤ perfectThreshold
 * Swish：  未碰边缘（flight 全程 ball.hitRim === false）
 * 基础分 + Perfect 奖励（+1）+ Swish 奖励（+1）。
 *
 * 进球分类：
 *   - bankshot:  碰篮板后进球（hitBackboard + isScored）
 *   - swish:     空心入框（isSwish + isScored）
 *   - rimOut:    碰筐弹出（hitRim + !isScored，球碰筐后未进）
 *   - airball:   三不沾（未碰任何东西，直接出界/落地）
 *   - normal:    普通进球（碰筐后进）
 */
(function (global) {
    'use strict';

    const SCORING = GAME_CONFIG.scoring;
    const COMBO_CONFIG = GAME_CONFIG.combo;

    /**
     * 判定是否进球。
     * @param {object} ball 篮球对象
     * @param {object} rim  篮筐对象
     * @returns {boolean}
     */
    function isScored(ball, rim) {
        // 1. 篮球从上方穿到下方
        const crossesDown =
            ball.prevY <= rim.y && ball.y >= rim.y && ball.vy > 0;
        if (!crossesDown) return false;

        // 2. 篮球中心在篮筐宽度范围内（考虑篮球半径）
        //    篮筐左边缘到右边缘之间，扣除篮球半径以让球体必须进入内部
        const leftBound = rim.rimLeft.x + ball.radius;
        const rightBound = rim.rimRight.x + rim.edgeRadius * 2 - ball.radius;
        const inRim = ball.x > leftBound && ball.x < rightBound;

        // 3. 已经通过 crossesDown 中 vy > 0 保证方向向下
        return inRim;
    }

    /**
     * 判定是否 Perfect（中心偏差 ≤ perfectThreshold）。
     * @param {object} ball 篮球对象
     * @param {object} rim  篮筐对象
     * @returns {boolean}
     */
    function isPerfect(ball, rim) {
        return Math.abs(ball.x - rim.x) <= SCORING.perfectThreshold;
    }

    /**
     * 判定是否空心入网（Swish）。
     * 条件：飞行全程未碰撞边缘（hitRim === false）。
     * @param {object} ball 篮球对象
     * @returns {boolean}
     */
    function isSwish(ball) {
        return !ball.hitRim;
    }

    /**
     * 判定是否打板入框（Bank Shot）。
     * 条件：飞行中碰过篮板（hitBackboard === true）且进球。
     * @param {object} ball 篮球对象
     * @returns {boolean}
     */
    function isBankShot(ball) {
        return !!ball.hitBackboard;
    }

    /**
     * 判定投篮是否为三分（根据出手点距离）。
     * @param {object} shootFrom 出手点 {x, y}
     * @param {object} rim       篮筐对象
     * @returns {boolean}
     */
    function isThreePoint(shootFrom, rim) {
        const dx = shootFrom.x - rim.x;
        const dy = shootFrom.y - rim.y;
        const dist = Math.hypot(dx, dy);
        return dist >= SCORING.threePointRadius;
    }

    /**
     * 判定 Miss 的具体类型（供 UI 层使用不同反馈）。
     * @param {object} ball 篮球对象
     * @returns {string} 'rimOut' | 'airball' | 'normal'
     */
    function getMissType(ball) {
        if (!ball) return 'normal';
        // 碰筐弹出：碰过篮筐边缘但没进
        if (ball.hitRim && !ball.inFlight) return 'rimOut';
        // 三不沾：没碰过任何东西（既没碰篮筐也没碰篮板）
        if (!ball.hitRim && !ball.hitBackboard) return 'airball';
        return 'normal';
    }

    /**
     * 得分处理（仅修改数据，不操作 DOM / UI）。
     * 计算基础分 + Perfect 奖励 + Swish 奖励，并更新 gameState 与 combo。
     * 同时把本次得分的明细写回 ball，供 UI 层消费（飘字提示等）。
     *
     * @param {object} gameState 游戏状态（含 score / combo / shots / madeShots 等）
     * @param {object} ball      篮球对象
     * @returns {{points:number, isPerfect:boolean, isSwish:boolean, shotType:string}} 得分明细
     */
    function onScore(gameState, ball) {
        const rim = gameState.rim;

        // 基础分（2 分；三分模式 3 分）
        let base = SCORING.normal;
        if (gameState.shootFrom && isThreePoint(gameState.shootFrom, rim)) {
            base = SCORING.threePoint;
        }

        // Perfect / Swish / Bank Shot 判定
        const perfect = isPerfect(ball, rim);
        const swish = isSwish(ball);
        const bankshot = isBankShot(ball);

        // 累加得分（Perfect 与 Swish 奖励独立可叠加）
        let points = base;
        const perfectBonus = perfect ? SCORING.perfectBonus : 0;
        const swishBonus = swish ? SCORING.swishBonus : 0;
        points += perfectBonus + swishBonus;

        // 更新游戏状态
        gameState.score += points;
        gameState.combo = Math.min(gameState.combo + 1, COMBO_CONFIG.max);
        gameState.madeShots += 1;
        gameState.maxCombo = Math.max(gameState.maxCombo, gameState.combo);

        // 标记本球已结算（同时更新 ball 和 gameState.currentShot）
        ball.shotResolved = true;
        if (gameState.currentShot) {
            gameState.currentShot.resolved = true;
            gameState.currentShot.isScored = true;
            gameState.currentShot.hitRim = ball.hitRim;
            gameState.currentShot.hitBackboard = ball.hitBackboard;
            gameState.currentShot.isPerfect = perfect;
            gameState.currentShot.isSwish = swish;
            gameState.currentShot.isBankShot = bankshot;
        }

        // 确定进球类型（用于 UI 分类反馈）
        let shotType = 'normal';
        if (bankshot) shotType = 'bankshot';
        else if (swish) shotType = 'swish';
        else if (perfect) shotType = 'perfect';

        // 把得分明细写回 ball，供 UI 层读取（飘字 / 音效 / 粒子事件）
        ball.lastScoreDetail = {
            base: base,
            perfect: perfect ? perfectBonus : 0,
            swish: swish ? swishBonus : 0,
            bankshot: bankshot,
            perfectText: perfect,
            swishText: swish,
            shotType: shotType,
            total: points
        };

        return {
            points: points,
            isPerfect: perfect,
            isSwish: swish,
            isBankShot: bankshot,
            shotType: shotType,
            base: base
        };
    }

    /**
     * Miss 处理（更新状态，供 UI 层消费）。
     * Miss 不产生得分，重置 combo，仍计入 shots。
     * @param {object} gameState 游戏状态
     * @param {object} ball      篮球对象（可空）
     */
    function onMiss(gameState, ball) {
        gameState.shotResolved = true;
        gameState.combo = 0;
        gameState.missShots += 1;
        if (ball) ball.shotResolved = true;

        // 确定 Miss 类型
        const missType = getMissType(ball);

        // 同时更新 gameState.currentShot，确保状态流转正常
        if (gameState.currentShot) {
            gameState.currentShot.resolved = true;
            gameState.currentShot.isScored = false;
            gameState.currentShot.missType = missType;
            gameState.currentShot.hitRim = ball ? ball.hitRim : false;
            gameState.currentShot.hitBackboard = ball ? ball.hitBackboard : false;
        }

        // 把 Miss 类型写回 ball，供 UI 层读取
        if (ball) {
            ball.lastMissType = missType;
        }
    }

    const Api = {
        isScored: isScored,
        isPerfect: isPerfect,
        isSwish: isSwish,
        isBankShot: isBankShot,
        isThreePoint: isThreePoint,
        getMissType: getMissType,
        onScore: onScore,
        onMiss: onMiss
    };

    global.Scoring = Api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Api;
    }
})(typeof window !== 'undefined' ? window : globalThis);