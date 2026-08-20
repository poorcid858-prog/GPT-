/**
 * 音效管理器模块
 * 负责：预加载 7 个 WAV 音效，按名称播放，浏览器禁音时优雅降级
 * 关键约束：音效失败不能成为游戏运行的前置条件
 *
 * 预加载列表（7 个）：
 *   - shoot.wav     投篮出手
 *   - rim-hit.wav   篮筐碰撞
 *   - score.wav     得分
 *   - swish.wav     空心入网
 *   - perfect.wav   完美命中
 *   - game-over.wav 游戏结束
 *   - button.wav    按钮点击
 */

/**
 * 音频资源根路径
 * 7 个 WAV 文件全部放在 assets/sounds/ 下
 */
const SOUND_BASE_PATH = 'assets/sounds/'

/**
 * 预加载清单
 */
const SOUND_LIST = [
    { name: 'shoot',     file: 'shoot.wav' },
    { name: 'rim-hit',   file: 'rim-hit.wav' },
    { name: 'score',     file: 'score.wav' },
    { name: 'swish',     file: 'swish.wav' },
    { name: 'perfect',   file: 'perfect.wav' },
    { name: 'game-over', file: 'game-over.wav' },
    { name: 'button',    file: 'button.wav' }
]

/**
 * 音量配置
 */
const SOUND_VOLUME = {
    'shoot':     0.8,
    'rim-hit':   0.7,
    'score':     0.9,
    'swish':     0.9,
    'perfect':   1.0,
    'game-over': 0.9,
    'button':    0.5
}

/**
 * 全局状态
 */
const SOUND_STATE = {
    sounds: {},
    unlocked: false,
    muted: false,
    enabled: true,
    audioCtx: null,
    loadAttempts: 0,
    loadSuccess: 0
}

/**
 * 初始化音频上下文
 * 浏览器策略：AudioContext 必须在用户首次交互后才能 resume
 * 必须在 click / touchstart / keydown 等用户事件中调用一次
 */
function initAudio() {
    if (SOUND_STATE.unlocked) return

    try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (Ctx) {
            SOUND_STATE.audioCtx = SOUND_STATE.audioCtx || new Ctx()
            if (SOUND_STATE.audioCtx.state === 'suspended') {
                SOUND_STATE.audioCtx.resume().catch(err => {
                    console.warn('[sound-manager] AudioContext resume failed:', err)
                })
            }
        }
        SOUND_STATE.unlocked = true

        for (const key in SOUND_STATE.sounds) {
            const s = SOUND_STATE.sounds[key]
            if (s && s.audio && typeof s.audio.play === 'function' && s.audio.paused) {
                const p = s.audio.play()
                if (p && p.then) {
                    p.then(() => {
                        s.audio.pause()
                        s.audio.currentTime = 0
                    }).catch(() => { /* 忽略 */ })
                }
            }
        }
    } catch (err) {
        console.warn('[sound-manager] initAudio failed, running silent:', err)
        SOUND_STATE.enabled = false
    }
}

/**
 * 预加载所有 7 个音效
 * 失败/不支持时安全降级：游戏可继续，playSound 静默
 *
 * @returns {Promise<{loaded:number, total:number, success:boolean}>}
 */
function loadSounds() {
    const promises = SOUND_LIST.map(item => loadSingleSound(item.name, item.file))
    return Promise.all(promises).then(results => {
        const success = results.filter(Boolean).length
        return {
            loaded: success,
            total: SOUND_LIST.length,
            success: success > 0
        }
    })
}

/**
 * 加载单个音效
 * @param {string} name
 * @param {string} file
 * @returns {Promise<boolean>}
 */
function loadSingleSound(name, file) {
    return new Promise(resolve => {
        SOUND_STATE.loadAttempts++
        try {
            const audio = new Audio()
            audio.preload = 'auto'
            audio.src = SOUND_BASE_PATH + file
            audio.volume = SOUND_VOLUME[name] ?? 0.8

            const onCanPlay = () => {
                SOUND_STATE.sounds[name] = { audio, loaded: true, failed: false }
                SOUND_STATE.loadSuccess++
                cleanup()
                resolve(true)
            }
            const onError = () => {
                SOUND_STATE.sounds[name] = { audio: null, loaded: false, failed: true }
                cleanup()
                resolve(false)
            }
            const cleanup = () => {
                audio.removeEventListener('canplaythrough', onCanPlay)
                audio.removeEventListener('canplay', onCanPlay)
                audio.removeEventListener('error', onError)
            }

            audio.addEventListener('canplaythrough', onCanPlay, { once: true })
            audio.addEventListener('canplay', onCanPlay, { once: true })
            audio.addEventListener('error', onError, { once: true })

            audio.load()
        } catch (err) {
            console.warn(`[sound-manager] failed to load ${name}:`, err)
            SOUND_STATE.sounds[name] = { audio: null, loaded: false, failed: true }
            resolve(false)
        }
    })
}

/**
 * 播放指定名称的音效
 * 不抛异常，失败时静默
 *
 * @param {string} name - shoot/rim-hit/score/swish/perfect/game-over/button
 * @param {Object} [opts] - { volume, loop, rate }
 */
function playSound(name, opts = {}) {
    if (!SOUND_STATE.enabled) return
    if (SOUND_STATE.muted) return

    const entry = SOUND_STATE.sounds[name]
    if (!entry || entry.failed || !entry.audio) return

    try {
        // 每次播放克隆一份：避免同一音效叠加时被打断
        const audio = entry.audio.cloneNode(true)
        audio.volume = opts.volume ?? SOUND_VOLUME[name] ?? 0.8
        audio.loop = !!opts.loop
        if (opts.rate) audio.playbackRate = opts.rate

        const p = audio.play()
        if (p && p.catch) {
            p.catch(err => {
                if (err && err.name === 'NotAllowedError') {
                    // 用户尚未交互，忽略
                }
            })
        }

        audio.addEventListener('ended', () => {
            audio.src = ''
        }, { once: true })
    } catch (err) {
        console.warn(`[sound-manager] playSound(${name}) failed:`, err)
    }
}

/**
 * 静音 / 取消静音
 * @param {boolean} muted
 */
function setMuted(muted) {
    SOUND_STATE.muted = !!muted
}

/**
 * 切换静音状态
 * @returns {boolean} 切换后的状态
 */
function toggleMute() {
    SOUND_STATE.muted = !SOUND_STATE.muted
    return SOUND_STATE.muted
}

/**
 * 停止所有正在播放的音效
 */
function stopAllSounds() {
    for (const key in SOUND_STATE.sounds) {
        const s = SOUND_STATE.sounds[key]
        if (s && s.audio) {
            try { s.audio.pause() } catch (e) { /* ignore */ }
            try { s.audio.currentTime = 0 } catch (e) { /* ignore */ }
        }
    }
}

/**
 * 销毁音频管理器（页面卸载时调用）
 */
function destroyAudio() {
    stopAllSounds()
    if (SOUND_STATE.audioCtx) {
        try { SOUND_STATE.audioCtx.close() } catch (e) { /* ignore */ }
        SOUND_STATE.audioCtx = null
    }
    SOUND_STATE.sounds = {}
    SOUND_STATE.unlocked = false
    SOUND_STATE.enabled = false
}

/**
 * 便捷：自动绑定到 document 的首次交互，自动解锁音频
 * 一般在游戏启动时调用一次
 */
function autoUnlockOnFirstInteraction() {
    if (SOUND_STATE.unlocked) return

    const handler = () => {
        initAudio()
        if (SOUND_STATE.sounds.button && SOUND_STATE.sounds.button.audio) {
            try {
                const a = SOUND_STATE.sounds.button.audio
                a.volume = 0
                const p = a.play()
                if (p && p.then) {
                    p.then(() => { a.pause(); a.currentTime = 0; a.volume = SOUND_VOLUME.button })
                       .catch(() => { /* 忽略 */ })
                }
            } catch (e) { /* ignore */ }
        }
        document.removeEventListener('pointerdown', handler)
        document.removeEventListener('keydown', handler)
        document.removeEventListener('touchstart', handler)
    }

    document.addEventListener('pointerdown', handler, { once: true })
    document.addEventListener('keydown', handler, { once: true })
    document.addEventListener('touchstart', handler, { once: true })
}

// 导出到 window 对象，供 game.js 调用
window.playSound = playSound;
window.loadSounds = loadSounds;
window.autoUnlockOnFirstInteraction = autoUnlockOnFirstInteraction;
window.setMuted = setMuted;
window.toggleMute = toggleMute;
