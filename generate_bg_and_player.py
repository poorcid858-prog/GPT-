"""
generate_bg_and_player.py
生成球场背景、观众背景、球馆背景、射手逐帧动画
风格：明亮写实球场，轻度质感
"""
import os, math, random
from PIL import Image, ImageDraw, ImageFilter

OUT_IMG = r"D:\temp\gpt投篮\assets\images"
OUT_PLY = r"D:\temp\gpt投篮\assets\player"
os.makedirs(OUT_IMG, exist_ok=True)
os.makedirs(OUT_PLY, exist_ok=True)

# === 调色板 ===
COURT_WOOD = (195, 145, 85)
COURT_D = (160, 115, 60)
COURT_L = (220, 175, 120)
LINE_W = (240, 235, 225)
GREEN = (55, 95, 60)
SKY = (180, 210, 240)
WALL = (160, 150, 140)
CROWD_COLORS = [(180,140,120),(200,170,150),(160,140,130),(190,160,140),(170,150,130),(210,180,160)]
SEAT_COLORS = [(40,55,70),(50,65,80),(35,50,65)]
FLOOR_D = (60, 50, 40)
PLAYER_SKIN = (220, 180, 150)
PLAYER_JERSEY = (220, 50, 50)
PLAYER_SHORT = (40, 40, 50)
PLAYER_SHOE = (30, 30, 30)

# ──── 1. Court Background (1280x720) ────
def gen_court():
    w, h = 1280, 720
    img = Image.new('RGB', (w, h), COURT_WOOD)
    draw = ImageDraw.Draw(img)

    # 木地板纹理
    for y in range(0, h, 12):
        shade = random.randint(-25, 15)
        R = max(0, min(255, COURT_WOOD[0] + shade))
        G = max(0, min(255, COURT_WOOD[1] + shade))
        B = max(0, min(255, COURT_WOOD[2] + shade))
        draw.rectangle([0, y, w, y+2], fill=(R,G,B))

    # 球场区域线
    court_l = 80
    court_r = w - 80
    court_t = 250
    court_b = h - 10
    # 底线
    draw.line([court_l, court_b, court_r, court_b], fill=LINE_W, width=3)
    # 边线
    draw.line([court_l, court_t, court_l, court_b], fill=LINE_W, width=3)
    draw.line([court_r, court_t, court_r, court_b], fill=LINE_W, width=3)
    # 中线
    cx = w // 2
    draw.line([cx, court_t, cx, court_b], fill=LINE_W, width=2)
    # 三分弧线
    arc_y = court_b - 120
    draw.arc([cx-200, arc_y-200, cx+200, arc_y+200], 0, 180, fill=LINE_W, width=2)

    # 阴影渐变（底部和顶部）
    for i in range(120):
        alpha = int(40 * (1 - i/120))
        draw.rectangle([0, i, w, i+1], fill=(0,0,0,alpha))
    for i in range(80):
        alpha = int(30 * (1 - i/80))
        draw.rectangle([0, h-i-1, w, h-i], fill=(0,0,0,alpha))

    img.save(os.path.join(OUT_IMG, 'court-background.png'))
    print("✅ court-background.png")

# ──── 2. Crowd Background (1280x360 上半部分可拼到球场) ────
def gen_crowd():
    w, h = 1280, 360
    img = Image.new('RGB', (w, h), WALL)
    draw = ImageDraw.Draw(img)

    # 观众席背景墙
    draw.rectangle([0, 0, w, h], fill=(45, 55, 70))

    # 5排观众
    for row in range(5):
        base_y = 30 + row * 60
        count = 0
        for col in range(0, w, 35):
            if random.random() < 0.65:
                x = col + random.randint(-5, 10)
                y = base_y + random.randint(-5, 5)
                skin = random.choice(CROWD_COLORS)
                jersey = random.choice([(200,50,50),(50,80,180),(200,180,50),(255,255,255),(50,50,50)])
                # 头
                draw.ellipse([x-6, y-6, x+6, y+6], fill=skin)
                # 身体
                draw.rectangle([x-8, y+6, x+8, y+24], fill=jersey)
                # 手
                draw.rectangle([x-12, y+8, x-8, y+18], fill=skin)
                draw.rectangle([x+8, y+8, x+12, y+18], fill=skin)
                count += 1

    # 座位间隙装饰
    for row in range(5):
        for col in range(0, w, 35):
            draw.rectangle([col-12, 30+row*60-4, col+12, 30+row*60-2], fill=(25,35,50))

    img.save(os.path.join(OUT_IMG, 'crowd-background.png'))
    print("✅ crowd-background.png")

# ──── 3. Arena Background (1280x720) ────
def gen_arena():
    w, h = 1280, 720
    img = Image.new('RGB', (w, h), (30, 40, 55))
    draw = ImageDraw.Draw(img)

    # 顶部场馆弧形
    draw.rectangle([0, 0, w, 60], fill=(25, 32, 45))
    for i in range(60):
        alpha = int(20 * (1 - i/60))
        draw.rectangle([0, i, w, i+1], fill=(60, 80, 110, alpha))

    # 顶部灯光
    for lx in range(200, w, 250):
        draw.ellipse([lx-20, 10, lx+20, 50], fill=(255, 240, 200, 200))
        draw.ellipse([lx-30, 20, lx+30, 55], fill=(255, 240, 200, 60))

    # 远处看台
    draw.rectangle([0, 60, w, 280], fill=(50, 60, 75))
    for row in range(4):
        y = 70 + row * 50
        for col in range(0, w, 32):
            if random.random() < 0.7:
                x = col + random.randint(-3, 3)
                skin = random.choice(CROWD_COLORS)
                jersey = random.choice([(200,50,50),(50,80,180),(200,180,50),(255,255,255)])
                draw.ellipse([x-5, y-5, x+5, y+5], fill=skin)
                draw.rectangle([x-6, y+5, x+6, y+18], fill=jersey)

    # 球场区域（木地板）
    draw.rectangle([0, 280, w, h], fill=COURT_WOOD)
    # 木纹
    for y in range(280, h, 12):
        shade = random.randint(-20, 15)
        R = max(0, min(255, COURT_WOOD[0] + shade))
        G = max(0, min(255, COURT_WOOD[1] + shade))
        B = max(0, min(255, COURT_WOOD[2] + shade))
        draw.rectangle([0, y, w, y+2], fill=(R,G,B))

    # 球场线
    draw.line([80, h-10, w-80, h-10], fill=LINE_W, width=3)
    draw.line([80, 300, 80, h-10], fill=LINE_W, width=3)
    draw.line([w-80, 300, w-80, h-10], fill=LINE_W, width=3)
    cx = w // 2
    draw.line([cx, 300, cx, h-10], fill=LINE_W, width=2)

    # 底部阴影
    for i in range(60):
        alpha = int(25 * (1 - i/60))
        draw.rectangle([0, h-i-1, w, h-i], fill=(0,0,0,alpha))

    img.save(os.path.join(OUT_IMG, 'arena-background.png'))
    print("✅ arena-background.png")

# ──── 4. Player 逐帧动画 (6帧) ────
def gen_player_frames():
    W, H = 180, 260
    # 身体定位
    base_y = 180  # 脚底位置
    frames = []

    for frame in range(1, 7):
        img = Image.new('RGBA', (W, H), (0,0,0,0))
        draw = ImageDraw.Draw(img)

        # 帧动画参数：
        # frame 1: 准备持球, 2: 举球, 3: 出手最高点, 4: 出手后随挥, 5: 随挥结束, 6: 收球
        t = frame / 6  # 0~1

        # 手臂抬起角度
        arm_angle = 30 + t * 120  # 30° -> 150°
        arm_rad = math.radians(arm_angle)
        # 球的位置
        ball_x = 80 + math.cos(arm_rad) * 40
        ball_y = base_y - 80 - math.sin(arm_rad) * 40

        # 身体旋转偏移
        body_lean = (t - 0.5) * 10  # 轻微前倾后倾

        # 头
        head_x = 90 + body_lean
        head_y = base_y - 100
        draw.ellipse([head_x-14, head_y-14, head_x+14, head_y+14], fill=PLAYER_SKIN)
        # 头发
        draw.arc([head_x-14, head_y-16, head_x+14, head_y+4], 180, 360, fill=(50,40,30), width=4)

        # 身体（球衣）
        body_x = 90 + body_lean
        body_y = base_y - 70
        draw.rectangle([body_x-18, body_y-5, body_x+18, body_y+35], fill=PLAYER_JERSEY)
        # 球衣号码
        draw.text((body_x-6, body_y+8), "23", fill=(255,255,255), font=None)

        # 腿
        leg_shift = math.sin(t * math.pi) * 6
        draw.rectangle([body_x-14, body_y+35, body_x-2+leg_shift, body_y+60], fill=PLAYER_SHORT)
        draw.rectangle([body_x+2+leg_shift, body_y+35, body_x+14, body_y+60], fill=PLAYER_SHORT)
        # 小腿
        draw.rectangle([body_x-12+leg_shift, body_y+60, body_x-2+leg_shift, body_y+85], fill=PLAYER_SKIN)
        draw.rectangle([body_x+2+leg_shift, body_y+60, body_x+12+leg_shift, body_y+85], fill=PLAYER_SKIN)

        # 鞋
        draw.ellipse([body_x-16+leg_shift, body_y+80, body_x-2+leg_shift, body_y+90], fill=PLAYER_SHOE)
        draw.ellipse([body_x+2+leg_shift, body_y+80, body_x+16+leg_shift, body_y+90], fill=PLAYER_SHOE)

        # 手臂（动态变化）
        # 左臂（持球手）
        l_angle = arm_angle - 20
        l_rad = math.radians(l_angle)
        l_end_x = body_x - 10 + math.cos(l_rad) * 35
        l_end_y = body_y + 5 - math.sin(l_rad) * 35
        draw.line([body_x-10, body_y+5, l_end_x, l_end_y], fill=PLAYER_SKIN, width=6)
        # 右臂（辅助手）
        r_angle = arm_angle - 40
        r_rad = math.radians(r_angle)
        r_end_x = body_x + 10 + math.cos(r_rad) * 30
        r_end_y = body_y + 5 - math.sin(r_rad) * 30
        draw.line([body_x+10, body_y+5, r_end_x, r_end_y], fill=PLAYER_SKIN, width=6)

        # 篮球
        if frame < 5:  # 前4帧篮球在手上
            basketball_rad = 12
            draw.ellipse([ball_x-basketball_rad, ball_y-basketball_rad,
                          ball_x+basketball_rad, ball_y+basketball_rad],
                         fill=(200,95,30))
            # 篮球纹路
            draw.arc([ball_x-10, ball_y-10, ball_x+10, ball_y+10], 200, 340, fill=(80,45,15), width=2)
            draw.arc([ball_x-10, ball_y-10, ball_x+10, ball_y+10], 20, 160, fill=(80,45,15), width=2)
        else:  # 出手后球在上方，手在跟随
            # 球已出手并在上方
            ball2_x = 100 + frame * 5
            ball2_y = base_y - 120 - frame * 8
            basketball_rad = 10
            draw.ellipse([ball2_x-basketball_rad, ball2_y-basketball_rad,
                          ball2_x+basketball_rad, ball2_y+basketball_rad],
                         fill=(200,95,30))

        # 篮球阴影（地面上的影子）
        shadow_alpha = max(30, 60 - frame * 5)
        shadow_scale = max(0.6, 1.0 - frame * 0.06)
        draw.ellipse([body_x-20*shadow_scale, base_y+2, body_x+20*shadow_scale, base_y+8], fill=(0,0,0,shadow_alpha))

        fname = f"player-shoot-{frame}.png"
        img.save(os.path.join(OUT_PLY, fname))
        frames.append(fname)
        print(f"✅ {fname}")

    # 静态站姿 player.png
    img = Image.new('RGBA', (W, H), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    # 头
    draw.ellipse([76, 76, 104, 104], fill=PLAYER_SKIN)
    draw.arc([76, 74, 104, 94], 180, 360, fill=(50,40,30), width=4)
    # 身体
    draw.rectangle([72, 105, 108, 140], fill=PLAYER_JERSEY)
    draw.text((84, 115), "23", fill=(255,255,255), font=None)
    # 腿
    draw.rectangle([76, 140, 92, 165], fill=PLAYER_SHORT)
    draw.rectangle([88, 140, 104, 165], fill=PLAYER_SHORT)
    draw.rectangle([78, 165, 92, 190], fill=PLAYER_SKIN)
    draw.rectangle([88, 165, 102, 190], fill=PLAYER_SKIN)
    draw.ellipse([76, 185, 92, 195], fill=PLAYER_SHOE)
    draw.ellipse([88, 185, 104, 195], fill=PLAYER_SHOE)
    # 手臂（持球姿势）
    draw.line([72, 115, 50, 90], fill=PLAYER_SKIN, width=6)
    draw.line([108, 115, 130, 95], fill=PLAYER_SKIN, width=6)
    # 篮球
    draw.ellipse([55, 72, 75, 92], fill=(200,95,30))
    draw.arc([57, 74, 73, 90], 200, 340, fill=(80,45,15), width=2)
    # 阴影
    draw.ellipse([70, 195, 110, 200], fill=(0,0,0,50))
    img.save(os.path.join(OUT_PLY, 'player.png'))
    print("✅ player.png")

gen_court()
gen_crowd()
gen_arena()
gen_player_frames()
print("🎉 背景和射手图片全部生成完成！")