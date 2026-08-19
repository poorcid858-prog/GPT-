"""
generate_basketball_assets.py
生成篮球、篮板、篮筐、篮网图片
风格：明亮写实球场，轻度质感（渐变+高光+阴影）
"""
import os, math
from PIL import Image, ImageDraw, ImageFilter

OUT = r"D:\temp\gpt投篮\assets\images"
os.makedirs(OUT, exist_ok=True)

# === 调色板 ===
ORANGE    = (200, 95, 30)
ORANGE_L  = (235, 145, 70)
ORANGE_D  = (150, 65, 15)
BROWN     = (80, 45, 15)
WHITE     = (240, 238, 235)
GRAY_L    = (200, 198, 195)
GRAY      = (160, 158, 155)
GRAY_D    = (100, 98, 95)
NET_WHITE = (220, 218, 215)
BOARD_WH  = (230, 228, 225)
BOARD_L   = (210, 208, 205)
BOARD_D   = (140, 138, 135)
RIM_RED   = (200, 45, 45)
RIM_L     = (235, 90, 60)

def add_highlight(img, x, y, radius, color, alpha=60):
    """在指定位置加一个半透明高光圆形"""
    hl = Image.new('RGBA', img.size, (0,0,0,0))
    d = ImageDraw.Draw(hl)
    d.ellipse([x-radius, y-radius, x+radius, y+radius],
              fill=color+(alpha,))
    return Image.alpha_composite(img, hl)

# ──── 1. Basketball (512x512) ────
def gen_basketball():
    size = 512
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    cx = cy = size // 2
    r = 200

    # 球体渐变 - 从高光到暗部
    for i in range(r, 0, -1):
        t = 1 - (i / r)  # 0 边缘, 1 中心
        # 径向光照：偏左上
        dist_to_center = math.hypot(0, 0)  # 纯粹径向
        light = 0.55 + 0.45 * (1 - (r-i)/r)
        # 暗角
        shade = 0.75 + 0.25 * (1 - (r-i)/r)
        R = int(ORANGE[0] * light * shade)
        G = int(ORANGE[1] * light * shade)
        B = int(ORANGE[2] * light * shade)
        draw.ellipse([cx-i, cy-i, cx+i, cy+i], fill=(R,G,B,255))

    # 篮球纹路
    draw.arc([cx-180, cy-180, cx+180, cy+180], 200, 340, fill=BROWN+(180,), width=4)
    draw.arc([cx-180, cy-180, cx+180, cy+180], 20, 160, fill=BROWN+(180,), width=4)
    # 横线
    draw.arc([cx-180, cy-40, cx+180, cy+40], 0, 180, fill=BROWN+(160,), width=4)
    draw.arc([cx-180, cy-40, cx+180, cy+40], 180, 360, fill=BROWN+(160,), width=4)
    # 竖直线（两侧）
    draw.arc([cx-40, cy-180, cx+40, cy+180], 270, 90, fill=BROWN+(160,), width=3)
    draw.arc([cx-40, cy-180, cx+40, cy+180], 90, 270, fill=BROWN+(160,), width=3)

    # 高光
    hl = Image.new('RGBA', img.size, (0,0,0,0))
    hd = ImageDraw.Draw(hl)
    hd.ellipse([cx-100, cy-140, cx-20, cy-40], fill=(255,255,255,45))
    hd.ellipse([cx-80, cy-130, cx-30, cy-60], fill=(255,255,255,30))
    img = Image.alpha_composite(img, hl)

    img.save(os.path.join(OUT, 'basketball.png'))
    print("✅ basketball.png")

# ──── 2. Basketball Texture (256x256 无缝纹理) ────
def gen_basketball_texture():
    size = 256
    img = Image.new('RGB', (size, size), ORANGE)
    draw = ImageDraw.Draw(img)

    # 模拟皮革颗粒感
    for _ in range(6000):
        x = random.randint(0, size-1)
        y = random.randint(0, size-1)
        v = random.randint(-20, 20)
        c = (ORANGE[0]+v, ORANGE[1]+v, ORANGE[2]+v)
        img.putpixel((x, y), tuple(max(0,min(255,vv)) for vv in c))

    # 纹路线条
    draw.arc([20, 20, size-20, size-20], 200, 340, fill=BROWN+(180,), width=3)
    draw.arc([20, 20, size-20, size-20], 20, 160, fill=BROWN+(180,), width=3)

    img.save(os.path.join(OUT, 'basketball-texture.png'))
    print("✅ basketball-texture.png")

# ──── 3. Backboard (320x420) ────
def gen_backboard():
    w, h = 320, 420
    img = Image.new('RGBA', (w, h), (0,0,0,0))
    draw = ImageDraw.Draw(img)

    # 篮板主体 - 透明亚克力质感
    margin = 20
    bx, by = 10, 10
    bw, bh = w-20, h-20
    # 边框
    draw.rounded_rectangle([bx, by, bx+bw, by+bh], radius=6, fill=BOARD_WH+(220,), outline=GRAY_D+(200,), width=3)
    # 内框（白色透明区域）
    inner = 14
    draw.rounded_rectangle([bx+inner, by+inner, bx+bw-inner, by+bh-inner], radius=4,
                           fill=BOARD_WH+(100,), outline=GRAY_L+(160,), width=2)

    # 高光条
    draw.rectangle([bx+inner, by+inner, bx+bw-inner, by+inner+6], fill=(255,255,255,120))

    # 固定支架（底部连接杆）
    pole_x = w // 2
    draw.rectangle([pole_x-8, h-20, pole_x+8, h], fill=GRAY_D+(200,))
    draw.rectangle([pole_x-6, h-25, pole_x+6, h-20], fill=GRAY_D+(200,))

    img.save(os.path.join(OUT, 'backboard.png'))
    print("✅ backboard.png")

# ──── 4. Rim (360x80) ────
def gen_rim():
    w, h = 360, 80
    img = Image.new('RGBA', (w, h), (0,0,0,0))
    draw = ImageDraw.Draw(img)

    # 篮筐环形 - 橙色/红色金属
    rim_h = 14
    rim_w = 280
    rx = (w - rim_w) // 2
    ry = (h - rim_h) // 2

    # 圆角矩形（金属质感渐变）
    for i in range(rim_h):
        t = i / rim_h
        bright = 0.7 + 0.3 * (1 - abs(t - 0.5) * 2)
        R = int(RIM_RED[0] * bright)
        G = int(RIM_RED[1] * bright)
        B = int(RIM_RED[2] * bright)
        draw.rounded_rectangle([rx, ry+i, rx+rim_w, ry+i+1], radius=3, fill=(R,G,B,255))

    # 高光
    draw.rounded_rectangle([rx+4, ry+2, rx+rim_w-4, ry+6], radius=2, fill=(255,200,150,80))

    # 连接篮板的杆
    conn_x = w // 2
    draw.rectangle([conn_x-4, 0, conn_x+4, ry], fill=GRAY_D+(200,))
    draw.rectangle([conn_x-4, ry+rim_h, conn_x+4, h], fill=GRAY_D+(200,))

    img.save(os.path.join(OUT, 'rim.png'))
    print("✅ rim.png")

# ──── 5. Net (300x200) ────
def gen_net():
    w, h = 300, 200
    img = Image.new('RGBA', (w, h), (0,0,0,0))
    draw = ImageDraw.Draw(img)

    # 篮网用白色/灰白色编织线，从顶部开口到底部逐渐收窄
    top_w = 180
    bot_w = 100
    top_y = 10
    bot_y = h - 20
    cx = w // 2
    lines = 12
    # 横线
    for row in range(6):
        t = row / 5
        y = top_y + (bot_y - top_y) * t
        ww = top_w + (bot_w - top_w) * t
        alpha = int(180 - 60 * t)
        lw = max(2, 4 - int(t * 2))
        draw.arc([cx-ww//2, y-5, cx+ww//2, y+5], 0, 180, fill=NET_WHITE+(alpha,), width=lw)

    # 竖线（编织线）
    for i in range(lines):
        t = i / (lines - 1)
        x1 = cx - top_w//2 + top_w * t
        x2 = cx - bot_w//2 + bot_w * t
        alpha = 200
        draw.line([x1, top_y, x2, bot_y], fill=NET_WHITE+(alpha,), width=2)

    # 顶部小弧线（连接篮筐）
    for i in range(12):
        t = i / 11
        x = cx - top_w//2 + top_w * t
        draw.arc([x-8, top_y-5, x+8, top_y+8], 0, 180, fill=NET_WHITE+(200,), width=2)

    # 底边
    for i in range(6):
        t = i / 5
        x = cx - bot_w//2 + bot_w * t
        ty = bot_y - 4
        draw.arc([x-10, ty, x+10, ty+8], 180, 360, fill=NET_WHITE+(160,), width=2)

    img.save(os.path.join(OUT, 'net.png'))
    print("✅ net.png")

import random
gen_basketball()
gen_basketball_texture()
gen_backboard()
gen_rim()
gen_net()
print("🎉 篮球相关图片全部生成完成！")