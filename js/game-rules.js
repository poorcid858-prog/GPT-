/**
 * 游戏规则核心模块
 * 负责：
 *   - 初始化完整 gameState
 *   - 投篮结果判定（命中 / Miss / null）
 *   - 游戏结束条件检查
 *   - 每帧游戏状态推进（计时 + 动画）
 *
 * 依赖：ScoreSystem / ComboSystem / TimerSystem / GameOverSystem / RestartSystem
 * 设计原则：纯逻辑层；只改 gameState，不操作 DOM
 */

(function (global) {
    'use strict'

    // 兼容默认参数
    const DEFAULT_DURATION = 30
    const DEFAULT_RIM_WIDTH = 90
    const DEFAULT_BALL_RADIUS = 18
    const DEFAULT_HALF_RIM = 45  // rim.width/2
    const DEFAULT_TOLERANCE = 8
    const DEFAULT_PERFECT_THRESHOLD = 12

    // 出界/超时/卡死容差
    const MAX_FLIGHT_TIME = 3.0      // 秒
    const OUT_OF_BOUNDS_MARGIN = 100 // 像素
    const STUCK_SPEED = 5            // 速度阈值
    const STUCK_MIN_TIME = 1.0       // 飞行超过 1s 才开始判卡死

    /**
     * 初始化完整游戏状态
     * @param {Object} [config] GAME_CONFIG（缺省时使用内部默认）
     * @param {Object} [canvas] {width, height}
     * @returns {Object} gameState
     */
    function initGameState(config, canvas) {
        const cfg = config || global.GAME_CONFIG || {}
        const cv = canvas || { width: 800, height: 600 }
        const W = cv.width || 800
        const H = cv.height || 600

        // 篮球/篮筐起始位置（按比例配置或兜底默认）
        const ballStart = {
            x: (cfg.ballStart && typeof cfg.ballStart.xRatio === 'number')
                ? cfg.ballStart.xRatio * W
                : W * 0.15,
            y: (cfg.ballStart && typeof cfg.ballStart.yRatio === 'number')
                ? cfg.ballStart.yRatio * H
                : H * 0.75
        }
        const rimPos = {
            x: (cfg.rimPosition && typeof cfg.rimPosition.xRatio === 'number')
                ? cfg.rimPosition.xRatio * W
                : W * 0.68,
            y: (cfg.rimPosition && typeof cfg.rimPosition.yRatio === 'number')
                ? cfg.rimPosition.yRatio * H
                : H * 0.35
        }

        const rimWidth = (cfg.rim && cfg.rim.width) || DEFAULT_RIM_WIDTH
        const ballRadius = (cfg.ball && cfg.ball.radius) || DEFAULT_BALL_RADIUS
        const duration = (cfg.timer && cfg.timer.duration) || DEFAULT_DURATION

        const gameState = {
            // —— 状态机 ——
            phase: 'PLAYING',   // MENU | PLAYING | PAUSED | GAME_OVER
            inputLocked: false,
            shotResolved: true, // 等待下一次出手
            lastShotResult: null,

            // —— 分数 & 连击 ——
            score: 0,
            combo: 0,
            maxCombo: 0,
            comboAnim: { scale: 1.0, age: 0, target: 1.0 },

            // —— 统计 ——
            shots: 0,
            made: 0,
            miss: 0,

            // —— 计时 ——
            duration: duration,
            timeLeft: duration,
            timer: {
                running: true,
                urgent: false,
                blinkPhase: 0
            },

            // —— 实体：篮球 ——
            ball: {
                x: ballStart.x,
                y: ballStart.y,
                vx: 0,
                vy: 0,
                prevX: ballStart.x,
                prevY: ballStart.y,
                radius: ballRadius,
                rotation: 0,
                rotationSpeed: 0,
                flightTime: 0,
                inFlight: false,
                settled: true,
                hitRim: false
            },

            // —— 实体：篮筐 ——
            rim: {
                x: rimPos.x,
                y: rimPos.y,
                width: rimWidth
            },

            // —— 篮网（动画状态） ——
            net: {
                state: 'normal',
                swing: 0,
                timer: 0
            },

            // —— 缓存：出手点（用于三分判定） ——
            lastShootFrom: null,

            // —— 特效容器（popups / particles / toasts） ——
            popups: [],
            particles: [],
            toasts: [],

            // —— 起始位置缓存（restart 用） ——
            ballStart: { x: ballStart.x, y: ballStart.y },
            rimPosition: { x: rimPos.x, y: rimPos.y },

            // —— 画布引用（只读） ——
            canvas: { width: W, height: H },

            // —— 结算相关 ——
            resultAnim: { visible: false, rows: [], startedAt: 0 },
            lastStats: null,

            // —— 配置缓存（便利用） ——
            config: {
                rimWidth: rimWidth,
                ballRadius: ballRadius,
                halfRim: rimWidth / 2,
                tolerance: (cfg.rim && cfg.rim.tolerance) || DEFAULT_TOLERANCE,
                perfectThreshold: (cfg.scoring && cfg.scoring.perfectThreshold) || DEFAULT_PERFECT_THRESHOLD,
                maxFlightTime: (cfg.ball && cfg.ball.maxShotDuration) || MAX_FLIGHT_TIME
            }
        }

        return gameState
    }

    /**
     * 检查单次投篮结果（在物理/碰撞之后由 updateGameState 调用）
     * 一次投篮只结算一次（依赖 gameState.shotResolved 守门）
     * @param {Object} gameState
     * @param {Object} ball
     * @param {Object} rim
     * @returns {'SCORED'|'MISSED'|null}  本帧是否产生新结果
     */
    function checkShotResult(gameState, ball, rim) {
        if (!gameState || !ball || !rim) return null
        // 已经结算过：不再重复
        if (gameState.shotResolved) return null
        // 球未在飞行：等待玩家出手
        if (!ball.inFlight) return null

        // 1) 命中判定（穿筐 + 水平在篮筐内）
        if (isScored(ball, rim)) {
            gameState.shotResolved = true
            return onScored(gameState, ball, rim)
        }

        // 2) Miss 判定（超时 / 出界 / 卡死 / 落地）
        if (isMissed(ball, gameState)) {
            gameState.shotResolved = true
            return onMissed(gameState, ball)
        }

        return null
    }

    /**
     * 进球核心条件（球心穿筐 + 水平在篮筐内）
     * @param {Object} ball {x, y, prevX, prevY, radius, vy}
     * @param {Object} rim  {x, y, width}
     */
    function isScored(ball, rim) {
        const half = rim.width / 2
        // 上一帧在篮筐上方，本帧在篮筐或下方（穿筐）
        const crossedDown = (ball.prevY <= rim.y && ball.y >= rim.y && ball.vy > 0)
        if (!crossedDown) return false
        // 球心水平在篮筐内（留 radius 余量避免贴边）
        return ball.x > rim.x - half + ball.radius &&
               ball.x < rim.x + half - ball.radius
    }

    /**
     * Miss 综合判定：超时 / 出界 / 卡死
     * @param {Object} ball
     * @param {Object} gameState
     */
    function isMissed(ball, gameState) {
        // 超时
        if (ball.flightTime >= (gameState.config && gameState.config.maxFlightTime || MAX_FLIGHT_TIME)) {
            return true
        }
        // 出界
        const cv = gameState.canvas || { width: 800, height: 600 }
        if (ball.x < -OUT_OF_BOUNDS_MARGIN ||
            ball.x > cv.width + OUT_OF_BOUNDS_MARGIN ||
            ball.y > cv.height + OUT_OF_BOUNDS_MARGIN) {
            return true
        }
        // 卡死（低速度 + 已飞行一段时间）
        if (ball.flightTime > STUCK_MIN_TIME) {
            const speed = Math.hypot(ball.vx, ball.vy)
            if (speed < STUCK_SPEED) return true
        }
        // 落地（球已落到地面以下且向下）
        if (ball.y > (gameState.canvas ? gameState.canvas.height : 600) - ball.radius && ball.vy >= 0) {
            // 触发落地即视为本球结束（避免空中已无意义飞行）
            return true
        }
        return false
    }

    /**
     * 命中分支：调用 ScoreSystem 计分 + ComboSystem 递增
     * @returns {'SCORED'}
     */
    function onScored(gameState, ball, rim) {
        // 1) 缓存出手点（如果未缓存过）—— 由外部 shot.js 写入 lastShootFrom
        const shootFrom = gameState.lastShootFrom || { x: ball.prevX, y: ball.prevY }
        // 2) 计算得分
        let result = null
        if (global.ScoreSystem && global.ScoreSystem.calculatePoints) {
            result = global.ScoreSystem.calculatePoints(ball, rim, shootFrom)
        } else {
            // 兜底：2 分基础 + Perfect + Swish
            result = fallbackCalculate(ball, rim, shootFrom)
        }
        // 3) 应用得分
        if (global.ScoreSystem && global.ScoreSystem.applyScore) {
            global.ScoreSystem.applyScore(gameState, result)
        } else {
            gameState.score += result.points
            gameState.made += 1
        }
        // 4) Combo 递增
        if (global.ComboSystem && global.ComboSystem.onHit) {
            global.ComboSystem.onHit(gameState)
        } else {
            gameState.combo = Math.min((gameState.combo | 0) + 1, 10)
            if (gameState.combo > gameState.maxCombo) gameState.maxCombo = gameState.combo
        }
        // 5) 出手计数（命中后计一次 shot）
        gameState.shots += 1
        // 6) 标记飞行结束
        ball.inFlight = false
        ball.settled = true
        gameState.lastShotResult = 'SCORED'
        // 7) 触发篮网动画（直接操作 rim.net）
        if (gameState.rim && gameState.rim.net) gameState.rim.net.state = 'entering'
        return 'SCORED'
    }

    /**
     * Miss 分支：ComboSystem 归零 + 出手计数
     * @returns {'MISSED'}
     */
    function onMissed(gameState, ball) {
        if (global.ComboSystem && global.ComboSystem.onMiss) {
            global.ComboSystem.onMiss(gameState)
        } else {
            gameState.combo = 0
        }
        gameState.shots += 1
        gameState.miss = (gameState.miss | 0) + 1
        ball.inFlight = false
        ball.settled = true
        gameState.lastShotResult = 'MISSED'
        return 'MISSED'
    }

    /**
     * 兜底计分（不依赖 ScoreSystem）
     */
    function fallbackCalculate(ball, rim, shootFrom) {
        const half = (rim.width || 90) / 2 + 8
        const made = Math.abs(ball.x - rim.x) < half && Math.abs(ball.y - rim.y) < ball.radius
        if (!made) return { made: false, three: false, perfect: false, swish: false, base: 0, bonus: 0, points: 0 }
        const dx = shootFrom ? shootFrom.x - rim.x : 0
        const dy = shootFrom ? shootFrom.y - rim.y : 0
        const dist = Math.hypot(dx, dy)
        const three = dist >= 300
        const base = three ? 3 : 2
        const perfect = Math.abs(ball.x - rim.x) <= 12
        const swish = ball.hitRim !== true
        const bonus = (perfect ? 1 : 0) + (swish ? 1 : 0)
        return { made: true, three, perfect, swish, base, bonus, points: base + bonus }
    }

    /**
     * 检查游戏是否结束
     * 结束条件（任一）：
     *   1) 倒计时 ≤ 0（限时模式）
     *   2) 出手次数 ≥ maxShots（计球模式，可选）
     *   3) 状态已经是 GAME_OVER
     * @param {Object} gameState
     * @returns {boolean}
     */
    function checkGameOverCondition(gameState) {
        if (!gameState) return false
        if (gameState.phase === 'GAME_OVER') return true
        // 1) 倒计时归零
        if (typeof gameState.timeLeft === 'number' && gameState.timeLeft <= 0) {
            return true
        }
        // 2) 达到最大出手次数（cfg.shots 提供；缺省 Infinity）
        const maxShots = gameState.maxShots
        if (typeof maxShots === 'number' && isFinite(maxShots) && gameState.shots >= maxShots) {
            return true
        }
        return false
    }

    /**
     * 每帧推进游戏状态（计时 + 动画 + 结算检测）
     * 暂停时不推进计时与判定
     * @param {Object} gameState
     * @param {number} dt 秒
     * @returns {Object} {advanced, gameOver, stats}
     */
    function updateGameState(gameState, dt) {
        if (!gameState) return { advanced: false, gameOver: false, stats: null }

        // 暂停 / 已结束：只更新非计时动画（保证 UI 平滑）
        if (gameState.phase === 'PAUSED') {
            if (global.ComboSystem && global.ComboSystem.updateComboAnimation) {
                global.ComboSystem.updateComboAnimation(gameState, dt)
            }
            return { advanced: false, gameOver: false, stats: null }
        }
        if (gameState.phase === 'GAME_OVER') {
            return { advanced: false, gameOver: true, stats: gameState.lastStats }
        }

        // 1) 计时推进（暂停逻辑由 TimerSystem 内部 running 守门）
        if (global.TimerSystem && global.TimerSystem.updateTimer) {
            global.TimerSystem.updateTimer(dt, gameState, null)
        } else {
            // 兜底
            const safeDt = Math.max(0, Math.min(0.1, dt))
            if (gameState.timer && gameState.timer.running && gameState.timeLeft > 0) {
                gameState.timeLeft = Math.max(0, gameState.timeLeft - safeDt)
            }
        }

        // 2) Combo 动画推进
        if (global.ComboSystem && global.ComboSystem.updateComboAnimation) {
            global.ComboSystem.updateComboAnimation(gameState, dt)
        }

        // 3) 飞行时间累加（仅当球在飞行）
        if (gameState.ball && gameState.ball.inFlight) {
            gameState.ball.flightTime += dt
        }

        // 4) 篮网动画推进
        if (gameState.net && typeof updateNetState === 'function') {
            updateNetState(gameState.net, dt)
        }

        // 5) 投篮结果判定（命中 / Miss）
        if (!gameState.shotResolved) {
            checkShotResult(gameState, gameState.ball, gameState.rim)
        }

        // 6) 游戏结束检测
        if (checkGameOverCondition(gameState)) {
            if (global.GameOverSystem && global.GameOverSystem.handleGameOver) {
                const stats = global.GameOverSystem.handleGameOver(gameState)
                return { advanced: true, gameOver: true, stats }
            }
        }

        return { advanced: true, gameOver: false, stats: null }
    }

    /**
     * 篮网动画状态机推进（精简版）
     * normal → entering → swinging → returning → normal
     * @param {Object} net {state, swing, timer}
     * @param {number} dt
     */
    function updateNetState(net, dt) {
        switch (net.state) {
            case 'normal':
                net.swing = 0
                break
            case 'entering':
                net.swing = 8
                net.state = 'swinging'
                net.timer = 0.4
                break
            case 'swinging':
                net.swing = Math.sin(net.timer * 8) * 5 * (net.timer / 0.4)
                net.timer -= dt
                if (net.timer <= 0) {
                    net.state = 'returning'
                    net.timer = 0.3
                }
                break
            case 'returning':
                net.swing *= 0.9
                net.timer -= dt
                if (Math.abs(net.swing) < 0.5 || net.timer <= 0) {
                    net.swing = 0
                    net.state = 'normal'
                }
                break
            default:
                net.state = 'normal'
                net.swing = 0
        }
    }

    /**
     * 暂停 / 恢复（统一入口）
     * @param {Object} gameState
     * @param {boolean} paused
     */
    function setPaused(gameState, paused) {
        if (!gameState) return
        if (paused) {
            gameState.phase = 'PAUSED'
            gameState.inputLocked = true
            if (global.TimerSystem && global.TimerSystem.pauseTimer) {
                global.TimerSystem.pauseTimer(gameState)
            } else if (gameState.timer) {
                gameState.timer.running = false
            }
        } else {
            if (gameState.phase === 'PAUSED') gameState.phase = 'PLAYING'
            gameState.inputLocked = false
            if (global.TimerSystem && global.TimerSystem.resumeTimer) {
                global.TimerSystem.resumeTimer(gameState)
            } else if (gameState.timer && gameState.timeLeft > 0) {
                gameState.timer.running = true
            }
        }
    }

    /**
     * 玩家出手前的预处理：标记飞行、清 hitRim、缓存出手点
     * 由外部 shot.js 在调 shot() 那一刻调用
     * @param {Object} gameState
     * @param {Object} shootFrom {x, y}
     */
    function beginShot(gameState, shootFrom) {
        if (!gameState || !gameState.ball) return
        gameState.shotResolved = false
        gameState.lastShotResult = null
        gameState.ball.inFlight = true
        gameState.ball.settled = false
        gameState.ball.hitRim = false
        gameState.ball.flightTime = 0
        gameState.ball.prevX = gameState.ball.x
        gameState.ball.prevY = gameState.ball.y
        gameState.lastShootFrom = shootFrom ? { x: shootFrom.x, y: shootFrom.y } : null
    }

    // 暴露到全局
    global.GameRules = {
        // 常量
        MAX_FLIGHT_TIME,
        OUT_OF_BOUNDS_MARGIN,
        STUCK_SPEED,
        STUCK_MIN_TIME,
        DEFAULT_RIM_WIDTH,
        DEFAULT_BALL_RADIUS,
        // 初始化
        initGameState,
        // 判定
        checkShotResult,
        isScored,
        isMissed,
        checkGameOverCondition,
        // 主循环
        updateGameState,
        setPaused,
        beginShot,
        // 内部
        updateNetState
    }
})(typeof window !== 'undefined' ? window : globalThis)
