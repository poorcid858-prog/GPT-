"""
generate_sounds.py
生成投篮游戏音效（WAV 格式）
风格：明亮写实球场，轻度质感
"""
import os, struct, math, wave, random

OUT = r"D:\temp\gpt投篮\assets\sounds"
os.makedirs(OUT, exist_ok=True)

SAMPLE_RATE = 44100

def generate_wav(name, duration, func, volume=0.5):
    """通用WAV生成"""
    n_samples = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n_samples):
        t = i / SAMPLE_RATE
        samples.append(max(-1.0, min(1.0, func(t) * volume)))

    # 淡出
    fade_len = int(SAMPLE_RATE * 0.02)
    for i in range(min(fade_len, n_samples)):
        env = 1.0 - (i / fade_len)
        samples[-1-i] *= env

    max_val = max(abs(s) for s in samples) or 1.0
    samples = [int(s / max_val * 32767 * 0.9) for s in samples]

    path = os.path.join(OUT, name)
    with wave.open(path, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(struct.pack(f'<{len(samples)}h', *samples))
    print(f"✅ {name}")

# ──── 1. shoot.wav ────
def gen_shoot():
    """投篮出手：短促的"嗖"声，带空气感"""
    def fn(t):
        if t < 0.05:
            return 0
        t -= 0.05
        freq = 400 + t * 3000
        env = max(0, 1 - t / 0.25) ** 1.5
        return math.sin(2 * math.pi * freq * t) * env + \
               math.sin(2 * math.pi * (freq * 1.5) * t) * env * 0.3
    generate_wav("shoot.wav", 0.3, fn, 0.45)

# ──── 2. rim-hit.wav ────
def gen_rim_hit():
    """擦筐金属撞击声"""
    def fn(t):
        if t < 0.01:
            return 0
        t -= 0.01
        # 金属撞击 = 高频噪音 + 金属共振
        env = max(0, 1 - t / 0.35) ** 2
        noise = (random.random() * 2 - 1) * 0.5
        tone = math.sin(2 * math.pi * 800 * t) * 0.6 + \
               math.sin(2 * math.pi * 1200 * t) * 0.3 + \
               math.sin(2 * math.pi * 600 * t) * 0.5
        return (noise * 0.2 + tone * 0.8) * env
    generate_wav("rim-hit.wav", 0.35, fn, 0.5)

# ──── 3. score.wav ────
def gen_score():
    """进球得分：轻快的上升音，正反馈"""
    def fn(t):
        if t < 0.02:
            return 0
        t -= 0.02
        env = max(0, 1 - t / 0.5) ** 0.8
        freq = 440 + t * 600
        tone = math.sin(2 * math.pi * freq * t) * 0.7 + \
               math.sin(2 * math.pi * (freq * 1.5) * t) * 0.3
        return tone * env
    generate_wav("score.wav", 0.5, fn, 0.5)

# ──── 4. swish.wav ────
def gen_swish():
    """空心入网：清脆的"唰"声"""
    def fn(t):
        if t < 0.02:
            return 0
        t -= 0.02
        env = max(0, 1 - t / 0.4) ** 1.2
        # 白噪声 + 高频滤波
        noise = (random.random() * 2 - 1)
        filtered = noise * 0.5 + (noise * 0.3) * (1 + math.sin(2 * math.pi * 3000 * t) * 0.5)
        freq = 500 + t * 2000
        tone = math.sin(2 * math.pi * freq * t) * 0.3
        return (filtered * 0.6 + tone) * env
    generate_wav("swish.wav", 0.4, fn, 0.5)

# ──── 5. perfect.wav ────
def gen_perfect():
    """Perfect 完美：金色反馈，上升音阶+闪光"""
    def fn(t):
        if t < 0.02:
            return 0
        t -= 0.02
        env = max(0, 1 - t / 0.7) ** 0.6
        # 上升音阶
        freq = 523 + int(t / 0.15) * 131
        tone = math.sin(2 * math.pi * freq * (t % 0.15)) * 0.6
        high = math.sin(2 * math.pi * 2000 * t) * 0.2
        # 泛音
        harm = math.sin(2 * math.pi * freq * 2 * t) * 0.3
        return (tone + harm + high) * env
    generate_wav("perfect.wav", 0.7, fn, 0.55)

# ──── 6. game-over.wav ────
def gen_game_over():
    """游戏结束：下行低音"""
    def fn(t):
        if t < 0.05:
            return 0
        t -= 0.05
        env = max(0, 1 - t / 1.0) ** 0.7
        freq = 400 - t * 300
        if freq < 60:
            freq = 60
        tone = math.sin(2 * math.pi * freq * t) * 0.5
        low = math.sin(2 * math.pi * freq * 0.5 * t) * 0.3
        return (tone + low) * env
    generate_wav("game-over.wav", 1.0, fn, 0.5)

# ──── 7. button.wav ────
def gen_button():
    """按钮点击：短促清脆"""
    def fn(t):
        if t < 0.005:
            return 0
        t -= 0.005
        env = max(0, 1 - t / 0.1) ** 2
        tone = math.sin(2 * math.pi * 1000 * t) * 0.6 + \
               math.sin(2 * math.pi * 1500 * t) * 0.3
        return tone * env
    generate_wav("button.wav", 0.12, fn, 0.5)

gen_shoot()
gen_rim_hit()
gen_score()
gen_swish()
gen_perfect()
gen_game_over()
gen_button()
print("🎉 音效全部生成完成！")