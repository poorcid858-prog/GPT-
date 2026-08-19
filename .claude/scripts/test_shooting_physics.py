#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
投篮物理测试脚本 —— 模拟投篮抛物线轨迹，检测篮球是否经过篮筐区域。
纯数学计算，无第三方依赖。
"""

import math
import argparse
import sys


def compute_velocity(angle_deg: float, power: float, base_force: float):
    """
    根据角度（度）和力度计算 vx, vy (Canvas坐标系，Y向下为正)。
    vy 为负表示向上。
    """
    angle_rad = math.radians(angle_deg)
    vx = math.cos(angle_rad) * base_force * power
    vy = -math.sin(angle_rad) * base_force * power  # 负号=向上
    return vx, vy


def simulate_trajectory(
    ball_x, ball_y,
    vx, vy,
    gravity, dt=1/60, max_steps=200,
):
    """
    模拟轨迹，返回列表 [(x, y, t, vx, vy), ...]。
    """
    points = []
    x, y = ball_x, ball_y
    cur_vx, cur_vy = vx, vy
    t = 0.0
    for _ in range(max_steps):
        points.append((x, y, t, cur_vx, cur_vy))
        cur_vy += gravity * dt
        x += cur_vx * dt
        y += cur_vy * dt
        t += dt
    return points


def check_scoring(
    points,
    rim_x, rim_y, rim_width,
    ball_radius,
):
    """
    检测篮球是否命中篮筐。
    条件：
    1. 篮球从篮筐 Y 上方穿到下方（prevY < rimY && currY >= rimY）
    2. 篮球 X 在篮筐宽度范围内（rimX - rimWidth/2 < ballX < rimX + rimWidth/2）
    3. 篮球运动方向向下（vy > 0）

    返回 (hit: bool, info: dict)
    """
    rim_half = rim_width / 2.0
    for i in range(1, len(points)):
        prev_x, prev_y, prev_t, prev_vx, prev_vy = points[i - 1]
        curr_x, curr_y, curr_t, curr_vx, curr_vy = points[i]

        # 从上方穿过篮筐高度
        if prev_y < rim_y and curr_y >= rim_y:
            # 线性插值求穿过篮筐高度时的精确位置
            if curr_y - prev_y != 0:
                ratio = (rim_y - prev_y) / (curr_y - prev_y)
                cross_x = prev_x + (curr_x - prev_x) * ratio
                cross_t = prev_t + (curr_t - prev_t) * ratio
                cross_vy = prev_vy + (curr_vy - prev_vy) * ratio
            else:
                cross_x = curr_x
                cross_t = curr_t
                cross_vy = curr_vy

            # 检查 X 是否在篮筐范围内（考虑篮球半径）
            in_x_range = (rim_x - rim_half + ball_radius) < cross_x < (rim_x + rim_half - ball_radius)
            going_down = cross_vy > 0

            if in_x_range and going_down:
                return True, {
                    "cross_x": cross_x,
                    "cross_y": rim_y,
                    "cross_t": cross_t,
                    "cross_vy": cross_vy,
                    "rim_left": rim_x - rim_half,
                    "rim_right": rim_x + rim_half,
                }

        # 也检查是否有一步直接穿过篮筐区域内部（当前帧已进入区域）
        if curr_y >= rim_y - ball_radius and curr_y <= rim_y + ball_radius:
            if (rim_x - rim_half + ball_radius) < curr_x < (rim_x + rim_half - ball_radius):
                if curr_vy > 0:
                    return True, {
                        "cross_x": curr_x,
                        "cross_y": curr_y,
                        "cross_t": curr_t,
                        "cross_vy": curr_vy,
                        "rim_left": rim_x - rim_half,
                        "rim_right": rim_x + rim_half,
                    }

    return False, {}


def find_apex(points):
    """找到轨迹最高点（Y 最小）。"""
    apex = min(points, key=lambda p: p[1])
    return apex[0], apex[1], apex[2]


def find_rim_cross_info(points, rim_y, rim_width, ball_radius):
    """
    分析篮球到达篮筐高度时的信息（用于未命中时的诊断）。
    返回 (cross_x, cross_y, cross_t, cross_vy, in_x_range, going_down, reached)
    """
    rim_half = rim_width / 2.0
    for i in range(1, len(points)):
        prev_x, prev_y, prev_t, prev_vx, prev_vy = points[i - 1]
        curr_x, curr_y, curr_t, curr_vx, curr_vy = points[i]

        if (prev_y < rim_y and curr_y >= rim_y) or (prev_y > rim_y and curr_y <= rim_y):
            if curr_y - prev_y != 0:
                ratio = (rim_y - prev_y) / (curr_y - prev_y)
                cross_x = prev_x + (curr_x - prev_x) * ratio
                cross_t = prev_t + (curr_t - prev_t) * ratio
                cross_vy = prev_vy + (curr_vy - prev_vy) * ratio
            else:
                cross_x = curr_x
                cross_t = curr_t
                cross_vy = curr_vy

            in_x_range = (rim_x - rim_half + ball_radius) < cross_x < (rim_x + rim_half - ball_radius)
            going_down = cross_vy > 0
            return cross_x, rim_y, cross_t, cross_vy, in_x_range, going_down, True

    return None, None, None, None, False, False, False


def draw_ascii_trajectory(points, rim_x, rim_y, rim_width, ball_radius):
    """
    打印 ASCII 轨迹图。
    宽 60 字符，高 20 行。
    * 表示轨迹点，○ 表示篮筐位置。
    """
    if not points:
        return

    chart_width = 60
    chart_height = 20

    # 收集所有点的坐标
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    # 加入篮筐位置作为边界参考
    xs.append(rim_x - rim_width / 2)
    xs.append(rim_x + rim_width / 2)
    ys.append(rim_y)

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    # 防止除零
    if max_x - min_x == 0:
        max_x = min_x + 1
    if max_y - min_y == 0:
        max_y = min_y + 1

    # 创建网格（行 = Y 轴，列 = X 轴；第 0 行是顶部）
    grid = [[" " for _ in range(chart_width)] for _ in range(chart_height)]

    # 映射轨迹点
    for px, py, *_ in points:
        col = int((px - min_x) / (max_x - min_x) * (chart_width - 1))
        row = int((py - min_y) / (max_y - min_y) * (chart_height - 1))
        col = max(0, min(chart_width - 1, col))
        row = max(0, min(chart_height - 1, row))
        if grid[row][col] == " ":
            grid[row][col] = "*"

    # 映射篮筐位置（覆盖轨迹点，用 ○ 表示）
    rim_half = rim_width / 2.0
    for rim_x_pos in (rim_x - rim_half, rim_x, rim_x + rim_half):
        col = int((rim_x_pos - min_x) / (max_x - min_x) * (chart_width - 1))
        row = int((rim_y - min_y) / (max_y - min_y) * (chart_height - 1))
        col = max(0, min(chart_width - 1, col))
        row = max(0, min(chart_height - 1, row))
        grid[row][col] = "○"

    # 绘制篮筐横梁（篮筐左右边缘之间用 "=" 连接）
    left_col = int((rim_x - rim_half - min_x) / (max_x - min_x) * (chart_width - 1))
    right_col = int((rim_x + rim_half - min_x) / (max_x - min_x) * (chart_width - 1))
    rim_row = int((rim_y - min_y) / (max_y - min_y) * (chart_height - 1))
    left_col = max(0, min(chart_width - 1, left_col))
    right_col = max(0, min(chart_width - 1, right_col))
    rim_row = max(0, min(chart_height - 1, rim_row))
    for c in range(left_col, right_col + 1):
        if grid[rim_row][c] == " " or grid[rim_row][c] == "*":
            grid[rim_row][c] = "="

    # 打印
    print()
    print("  ┌" + "─" * chart_width + "┐  (Y 向下)")
    for row_idx, row_data in enumerate(grid):
        # 右侧标尺
        y_val = min_y + (max_y - min_y) * row_idx / (chart_height - 1)
        label = f"{y_val:4.0f}" if row_idx % 4 == 0 else "    "
        print(f"{label}│{''.join(row_data)}│")
    print("  └" + "─" * chart_width + "┘")
    # X 轴标尺
    x_label_positions = [0, chart_width // 4, chart_width // 2, 3 * chart_width // 4, chart_width - 1]
    x_label = ""
    for i in range(chart_width):
        if i in x_label_positions:
            x_val = min_x + (max_x - min_x) * i / (chart_width - 1)
            x_label += f"{x_val:5.0f}"[:1]
        else:
            x_label += " "
    print(f"      {x_label}")
    x_label2 = ""
    for i in range(chart_width):
        if i in x_label_positions:
            x_val = min_x + (max_x - min_x) * i / (chart_width - 1)
            val_str = f"{x_val:5.0f}"
            x_label2 += val_str[1:2] if len(val_str) > 1 else " "
        else:
            x_label2 += " "
    print(f"      {x_label2}")
    print(f"      {'─' * (chart_width)}")
    print(f"      图例: * = 轨迹点  ○ = 篮筐  = = 篮筐横梁")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="投篮物理测试脚本 —— 模拟投篮抛物线轨迹，检测篮球是否经过篮筐区域"
    )
    parser.add_argument("--ball-x", type=float, default=100, help="篮球初始 X")
    parser.add_argument("--ball-y", type=float, default=500, help="篮球初始 Y")
    parser.add_argument("--rim-x", type=float, default=500, help="篮筐中心 X")
    parser.add_argument("--rim-y", type=float, default=300, help="篮筐中心 Y")
    parser.add_argument("--rim-width", type=float, default=90, help="篮筐宽度")
    parser.add_argument("--angle", type=float, default=45, help="出手角度（度）")
    parser.add_argument("--power", type=float, default=0.8, help="出手力度")
    parser.add_argument("--gravity", type=float, default=980, help="重力加速度（像素/秒²）")
    parser.add_argument("--base-force", type=float, default=900, help="基础力")
    parser.add_argument("--ball-radius", type=float, default=18, help="篮球半径")
    parser.add_argument("--simulate-only", action="store_true", help="仅输出轨迹点 CSV，不画图")
    parser.add_argument("--verbose", action="store_true", help="输出每一步的详细数据")
    parser.add_argument("--dt", type=float, default=1/60, help="模拟步长（秒）")
    parser.add_argument("--max-steps", type=int, default=200, help="最大模拟步数")

    args = parser.parse_args()

    ball_x = args.ball_x
    ball_y = args.ball_y
    rim_x = args.rim_x
    rim_y = args.rim_y
    rim_width = args.rim_width
    angle = args.angle
    power = args.power
    gravity = args.gravity
    base_force = args.base_force
    ball_radius = args.ball_radius
    simulate_only = args.simulate_only
    verbose = args.verbose
    dt = args.dt
    max_steps = args.max_steps

    # ========== 计算初速度 ==========
    vx, vy = compute_velocity(angle, power, base_force)

    # ========== 模拟轨迹 ==========
    points = simulate_trajectory(ball_x, ball_y, vx, vy, gravity, dt, max_steps)

    # ========== 寻找最高点 ==========
    apex_x, apex_y, apex_t = find_apex(points)

    # ========== 检测命中 ==========
    hit, hit_info = check_scoring(points, rim_x, rim_y, rim_width, ball_radius)

    # ========== 输出 ==========
    if simulate_only:
        # CSV 输出
        print("t,x,y,vx,vy")
        for px, py, pt, pvx, pvy in points:
            print(f"{pt:.4f},{px:.2f},{py:.2f},{pvx:.2f},{pvy:.2f}")
        return

    # 标准输出
    print("=" * 50)
    print("   投篮物理测试")
    print("=" * 50)
    print()
    print("参数:")
    print(f"  篮球起始: ({ball_x}, {ball_y})")
    print(f"  篮筐位置: ({rim_x}, {rim_y})  篮筐宽度: {rim_width}")
    print(f"  出手角度: {angle}°  力度: {power}  重力: {gravity}")
    print(f"  基础力: {base_force}  篮球半径: {ball_radius}")
    print()
    print(f"初速度: vx={vx:.1f}  vy={vy:.1f}")
    print(f"最高点: ({apex_x:.0f}, {apex_y:.0f})  到达时间: {apex_t:.2f}s")
    print()

    if hit:
        cross_x = hit_info["cross_x"]
        cross_y = hit_info["cross_y"]
        cross_t = hit_info["cross_t"]
        cross_vy = hit_info["cross_vy"]
        rim_left = hit_info["rim_left"]
        rim_right = hit_info["rim_right"]
        print(f"✅ 命中！篮球经过篮筐区域")
        print(f"  ball=({cross_x:.0f}, {cross_y:.0f})  在篮筐范围内 ({rim_left:.0f}~{rim_right:.0f})")
        print(f"  (从上方穿过，到达时间: {cross_t:.2f}s, vy={cross_vy:.1f})")
        print()
        print(f"篮筐范围: X ∈ ({rim_left:.0f}, {rim_right:.0f})")
        print(f"进入位置: X = {cross_x:.1f}")
        print(f"穿越速度: vy = {cross_vy:.1f} (向下)")
    else:
        print("❌ 未命中")
        cross_x, cross_y, cross_t, cross_vy, in_x_range, going_down, reached = \
            find_rim_cross_info(points, rim_y, rim_width, ball_radius)

        if not reached:
            print("  篮球未到达篮筐高度（可能力太小或角度太偏）")
        elif not in_x_range:
            rim_half = rim_width / 2.0
            print(f"  篮球到达篮筐高度时 X={cross_x:.0f}，不在篮筐范围内 ({rim_x - rim_half:.0f}~{rim_x + rim_half:.0f})")
            if cross_x < rim_x - rim_half:
                print(f"  → 偏左 {rim_x - rim_half - cross_x:.0f} 像素")
            else:
                print(f"  → 偏右 {cross_x - rim_x - rim_half:.0f} 像素")
        elif not going_down:
            print(f"  篮球到达篮筐高度时 vy={cross_vy:.1f}，仍在上升阶段（未进入下落轨迹）")
        else:
            print("  未知原因未命中")

    # 打印关键诊断信息
    print()
    print("诊断信息:")
    total_time = points[-1][2]
    final_x, final_y, *_ = points[-1]
    print(f"  总飞行时间: {total_time:.2f}s")
    print(f"  最终位置: ({final_x:.0f}, {final_y:.0f})")
    print(f"  水平飞行距离: {final_x - ball_x:.0f} 像素")
    print(f"  垂直下降距离: {final_y - ball_y:.0f} 像素")

    # 画 ASCII 轨迹图
    draw_ascii_trajectory(points, rim_x, rim_y, rim_width, ball_radius)

    # 详细输出
    if verbose:
        print()
        print("详细轨迹数据:")
        print(f"{'步数':>4} {'X':>8} {'Y':>8} {'t':>6} {'vx':>8} {'vy':>8}")
        print("-" * 50)
        for i, (px, py, pt, pvx, pvy) in enumerate(points):
            print(f"{i:>4} {px:>8.1f} {py:>8.1f} {pt:>6.3f} {pvx:>8.1f} {pvy:>8.1f}")

    # 退出码：命中 0，未命中 1
    sys.exit(0 if hit else 1)


if __name__ == "__main__":
    main()