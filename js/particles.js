/**
 * 粒子系统模块
 * 负责：进球/碰撞等事件的爆发粒子动画
 * 约束：单次爆发 10~30 粒，受重力影响，500ms 内消亡
 *
 * 进球分类粒子颜色：
 *   - Perfect:     金色 #ffd700
 *   - Swish:       蓝色 #4fc3ff（空心入框）
 *   - Bank Shot:   绿色 #4caf50（打板入框）
 *   - Normal:      白色 #ffffff（普通进球）
 *   - Rim Out:     橙色 #ff9800（碰筐弹出）
 *   - Miss:        红色 #ff5252
 *   - Airball:     灰色 #9e9e9e（三不沾，无粒子）
 */

/**
 * 粒子生命周期常量（秒）
 * 规范要求 500ms 消亡
 */
const PARTICLE_LIFE = 0.5

/**
 * 粒子物理参数
 */
const PARTICLE_GRAVITY = 600
const PARTICLE_MIN_SPEED = 80
const PARTICLE_MAX_SPEED = 240

/**
 * 颜色预设
 */
const PARTICLE_COLOR_PERFECT = '#ffd700'   // 金色（Perfect）
const PARTICLE_COLOR_NORMAL = '#ffffff'    // 白色（普通）
const PARTICLE_COLOR_SWISH = '#4fc3ff'     // 蓝色（Swish 空心）
const PARTICLE_COLOR_BANKSHOT = '#4caf50'  // 绿色（Bank Shot 打板）
const PARTICLE_COLOR_RIMOUT = '#ff9800'    // 橙色（Rim Out 碰筐弹出）
const PARTICLE_COLOR_AIRBALL = '#9e9e9e'   // 灰色（Airball 三不沾）
const PARTICLE_COLOR_MISS = '#ff5252'      // 红色（Miss）

/**
 * 爆发粒子
 * 在 (x, y) 处生成 count 个向四周扇形扩散的粒子
 *
 * @param {number} x - 中心 X
 * @param {number} y - 中心 Y
 * @param {string} [color='#ffffff'] - 粒子颜色
 * @param {number} [count=20] - 粒子数量，规范要求 10~30
 * @returns {Array<Object>} 新生成的粒子数组（外部应 push 到总粒子池）
 */
function burstParticles(x, y, color = PARTICLE_COLOR_NORMAL, count = 20) {
    // 安全钳制：始终保证 10~30 范围内
    const safeCount = Math.max(10, Math.min(30, count | 0))
    const particles = []

    for (let i = 0; i < safeCount; i++) {
        // 360° 随机方向
        const angle = Math.random() * Math.PI * 2
        // 速度区间
        const speed = PARTICLE_MIN_SPEED + Math.random() * (PARTICLE_MAX_SPEED - PARTICLE_MIN_SPEED)
        // 略向上偏移，让爆发感更强
        const vx = Math.cos(angle) * speed
        const vy = Math.sin(angle) * speed - 60   // -60 微微向上偏置

        // 粒子尺寸随机 2~4px
        const size = 2 + Math.random() * 2

        // 粒子寿命 0.4~0.5s（带随机扰动）
        const life = PARTICLE_LIFE * (0.8 + Math.random() * 0.2)

        particles.push({
            x,
            y,
            vx,
            vy,
            size,
            age: 0,
            life,
            color,
            // 是否金色（用于绘制发光效果）
            glow: color === PARTICLE_COLOR_PERFECT
        })
    }

    return particles
}

/**
 * 更新所有粒子位置与生命周期
 * 应用重力、衰减透明度、移除死亡粒子
 *
 * @param {Array<Object>} particles - 粒子数组（原地修改）
 * @param {number} dt - 帧间隔（秒）
 */
function updateParticles(particles, dt) {
    if (!particles || particles.length === 0) return

    // 倒序遍历，便于就地删除
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]

        // 重力加速度
        p.vy += PARTICLE_GRAVITY * dt
        // 位置积分
        p.x += p.vx * dt
        p.y += p.vy * dt
        // 年龄累加
        p.age += dt

        // 超出生命则移除
        if (p.age >= p.life) {
            particles.splice(i, 1)
        }
    }
}

/**
 * 绘制所有粒子
 * 透明度随年龄衰减；金色粒子加发光描边
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Object>} particles - 粒子数组
 */
function drawParticles(ctx, particles) {
    if (!ctx || !particles || particles.length === 0) return

    ctx.save()

    for (const p of particles) {
        // 生命进度 0~1
        const t = p.age / p.life
        // 透明度：开始 1，结束 0
        const alpha = 1 - t
        // 尺寸：开始原尺寸，逐渐缩小
        const size = p.size * (1 - t * 0.5)

        // 金色粒子：先画一圈外发光
        if (p.glow) {
            ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`
            ctx.beginPath()
            ctx.arc(p.x, p.y, size * 2.5, 0, Math.PI * 2)
            ctx.fill()
        }

        // 主体圆点
        ctx.fillStyle = withAlpha(p.color, alpha)
        ctx.beginPath()
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
        ctx.fill()
    }

    ctx.restore()
}

/**
 * 工具：给十六进制颜色加 alpha
 * 支持 #RRGGBB / #RGB / rgba()/rgb()
 * @param {string} color
 * @param {number} alpha
 * @returns {string}
 */
function withAlpha(color, alpha) {
    if (!color) return `rgba(255, 255, 255, ${alpha})`
    if (color.startsWith('rgba') || color.startsWith('rgb(')) {
        // 简单替换：把原 rgba 的 alpha 替换掉
        return color.replace(/[\d.]+\)$/, `${alpha})`)
    }
    let hex = color.replace('#', '')
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('')
    }
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
