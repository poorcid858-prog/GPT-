#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
投篮游戏核心逻辑完整性验证脚本
================================
递归扫描指定路径下的 .js / .html 文件（跳过 node_modules / .git / dist / build），
检查投篮游戏的 10 项核心逻辑模块是否存在。

用法:
    python check_game_logic.py [--path 项目路径]

纯标准库实现（os / re / sys / argparse），无第三方依赖。
返回码: 0 = 全部通过；1 = 存在缺失或严重警告。
"""

import os
import re
import sys
import argparse

# 需要跳过的目录名（不区分大小写）
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "vendor", "__pycache__"}

# 文件扩展名白名单
ALLOWED_EXTS = {".js", ".html"}


def collect_files(root_path):
    """
    递归收集指定路径下所有需要检查的 *(js|html) 文件。
    - 跳过 SKIP_DIRS 中列出的目录
    - 不受扩展名大小写影响（.JS / .HTML 同样命中）
    返回: (files, skipped_dir_count)
    """
    files = []
    skipped_dirs = 0

    for dirpath, dirnames, filenames in os.walk(root_path):
        # 原地过滤目录：不在 SKIP_DIRS 中的才继续下钻
        keep = []
        for d in dirnames:
            if d.lower() in SKIP_DIRS:
                skipped_dirs += 1
            else:
                keep.append(d)
        dirnames[:] = keep

        for fn in filenames:
            if os.path.splitext(fn)[1].lower() in ALLOWED_EXTS:
                files.append(os.path.join(dirpath, fn))

    files.sort()  # 保证输出稳定
    return files, skipped_dirs


def grep_files(files, patterns, flags=re.IGNORECASE):
    """
    在给定文件中搜索任一正则模式。
    返回: 命中的文件路径列表（去重、保序）。
    """
    regexes = [re.compile(p, flags) for p in patterns]
    hits = []

    for path in files:
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except (OSError, IOError):
            continue
        if any(rx.search(content) for rx in regexes):
            hits.append(path)

    return hits


# ---------------------------------------------------------------------------
# 小工具
# ---------------------------------------------------------------------------

def _uniq(seq):
    """去重保序；兼容可哈希的短字符串列表。"""
    seen = set()
    out = []
    for item in seq:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def short_name(path):
    """返回不含目录的短文件名，用于展示。"""
    return os.path.basename(path)


def _report(label, hits, message, all_files):
    """生成单条检查结果。"""
    n = len(hits)
    if n == 0:
        return ("🔴", label, f"{message}（在 {len(all_files)} 个源码文件中均未找到）", [])
    sample = ", ".join(_uniq([short_name(h) for h in hits])[:5])
    if len(hits) > 5:
        sample += f" 等 {len(hits)} 个文件"
    return ("🟢", label, f"{message} —— 在 {sample} 中找到", short)


# ---------------------------------------------------------------------------
# 各检查项
# ---------------------------------------------------------------------------

def check_ball(files):
    """1. Ball —— 篮球本体（位置 / 半径 / 速度）"""
    pats = [
        r"\bball\b",
        r"\bball\.x\b",
        r"\bballRadius\b",
        r"\bball\.vy\b",
        r"\bball\.y\b",
        r"\bBall\b",
    ]
    hits = grep_files(files, pats)
    return _report("Ball", hits, "找到篮球本体相关代码（ball / ballRadius / ball.vy 等）", files)


def check_rim(files):
    """2. Rim —— 篮筐（位置 / 宽度 / 左右边界）"""
    pats = [
        r"\brim\b",
        r"\brim\.x\b",
        r"\brim\.width\b",
        r"\brimLeft\b",
        r"\brimRight\b",
        r"\brim\.y\b",
    ]
    hits = grep_files(files, pats)
    return _report("Rim", hits, "找到篮筐相关代码（rim / rimLeft / rimRight 等）", files)


def check_shooting(files):
    """3. Shooting —— 投篮触发（拖拽 / 松手 / 发射）"""
    pats = [
        r"\bshoot\w*\b",
        r"\bpointerup\b",
        r"\brelease\w*\b",
        r"\blaunch\b",
        r"\bfire\b",
        r"\bpointerdown\b",
    ]
    hits = grep_files(files, pats)
    return _report("Shooting", hits, "找到投篮触发逻辑（shoot / pointerup / release 等）", files)


def check_collision(files):
    """4. Collision —— 碰撞检测（球碰筐 / 筐判定）"""
    pats = [
        r"\bcollision\b",
        r"\bcollide\w*\b",
        r"\brimHit\b",
        r"\bcheckRim\w*\b",
        r"\bhitRim\w*\b",
        r"\bdetectCollision\b",
        r"\bhandleCollision\b",
    ]
    hits = grep_files(files, pats)
    return _report("Collision", hits, "找到碰撞检测代码（collision / rimHit / checkRim 等）", files)


def check_score(files):
    """5. Score —— 得分逻辑（+2 / 得分计数）"""
    pats = [
        r"\bscore\w*\b",
        r"\+\s*2\b",
        r"\bpoints\b",
        r"\bonScore\b",
        r"\bscored\b",
        r"\bincrementScore\b",
        r"\baddScore\b",
    ]
    hits = grep_files(files, pats)
    return _report("Score", hits, "找到得分逻辑（score / points / +2 等）", files)


def check_timer(files):
    """6. Timer —— 倒计时 / 游戏时长"""
    pats = [
        r"\btimer\b",
        r"\bremainingTime\b",
        r"\bcountdown\b",
        r"\bsetInterval\b",
        r"\bdeltaTime\b",
        r"\btimeLeft\b",
    ]
    hits = grep_files(files, pats)
    return _report("Timer", hits, "找到计时代码（timer / remainingTime / deltaTime 等）", files)


def check_combo(files):
    """7. Combo —— 连击逻辑"""
    pats = [
        r"\bcombo\b",
        r"\bcomboCount\b",
        r"\bmaxCombo\b",
        r"\bstreak\b",
    ]
    hits = grep_files(files, pats)
    return _report("Combo", hits, "找到连击逻辑（combo / comboCount / maxCombo 等）", files)


def check_game_over(files):
    """8. Game Over —— 游戏结束状态"""
    pats = [
        r"\bGAME_OVER\b",
        r"\bgameOver\b",
        r"\bgame_over\b",
        r"结束",
        r"\bgameover\b",
        r"\bendGame\b",
    ]
    hits = grep_files(files, pats)
    return _report("Game Over", hits, "找到结束状态处理（GAME_OVER / gameOver / 结束 等）", files)


def check_restart(files):
    """9. Restart —— 重新开始"""
    pats = [
        r"\brestart\b",
        r"\breset\b",
        r"\bplayAgain\b",
        r"\bPLAY_AGAIN\b",
        r"\brestartGame\b",
        r"\bnewGame\b",
    ]
    hits = grep_files(files, pats)
    return _report("Restart", hits, "找到重开逻辑（restart / reset / playAgain 等）", files)


def check_duplicate_score_guard(files):
    """
    10. 重复计分保护 —— 重点检查项
    防止「同一球进入篮筐被多次计分」的常见 Bug。

    A) 查找明确的防重标志位：shotResolved / resolved / scored / alreadyCounted 等
    B) 查找进球判定处的提前返回保护：if (shotResolved) return / return true 等
    C) 同时输出命中文件与定位线索，帮助开发者定位问题。
    """
    flag_pats = [
        r"\bshotResolved\b",
        r"\b.resolve(d)?\b",
        r"\balreadyCounted\b",
        r"\bcounted\b",
        r"\bissued\b",
        r"\bprocessedShot\b",
    ]
    guard_pats = [
        r"if\s*\([^)]*resolved[^)]*\)\s*return",
        r"if\s*\([^)]*scored[^)]*\)\s*return",
    ]
    # 检出进球判定处是否有任何返回保护：搜到 "if (...) return"（粗略信号叠加标志位）
    generic_guard_pats = [r"if\s*\([^)]*\)\s*\{?\s*return"]

    flag_hits = grep_files(files, flag_pats)
    guard_hits = grep_files(files, guard_pats)
    generic_guard_hits = grep_files(files, generic_guard_pats)

    lines = []

    # 关键诊断：进筐瞬间是否既有多球命中，又无一次性判定
    if flag_hits:
        sample = ", ".join(_uniq([short_name(h) for h in flag_hits])[:5])
        lines.append(f"发现防重标志位（shotResolved / resolved / scored 等）位于 {sample}")
    if guard_hits:
        sample = ", ".join(_uniq([short_name(h) for h in guard_hits])[:5])
        lines.append(f"发现进球判定保护逻辑（if (…resolved/scored) return）位于 {sample}")
    if not flag_hits and not guard_hits:
        # 没有任何防重机制 → 严重警告
        hint = (
            "这通常意味着同一篮球穿过篮筐后会被多次触发命中回调、重复加分。"
            "建议在进球判定代码处加入一次性标志，例如：\n"
            "    let shotResolved = false;\n"
            "    if (shotResolved) return;\n"
            "    shotResolved = true;\n"
            "    // 之后才加分\n"
        )
        return ("🔴", "重复计分保护", hint, [])

    if flag_hits or guard_hits:
        # 有某种机制，但无法证明判定回调内每次都被 return 拦住 → 提示检查
        note = (
            "找到防重机制迹象。请人工复核：进筐回调入口是否确实用该标志作为短路保护，"
            "避免同一次命中路径多次加分。"
        )
        return ("🟢", "重复计分保护", "； ".join(lines) + ". " + note, flag_hits or guard_hits)

    return ("⚪", "重复计分保护", "无。", [])


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="check_game_logic.py",
        description="投篮游戏核心逻辑完整性验证脚本",
    )
    parser.add_argument(
        "--path",
        default=os.path.abspath(r"d:\temp\gpt投篮"),
        help="要扫描的项目路径（默认: d:\\temp\\gpt投篮）",
    )
    args = parser.parse_args(argv)

    if not os.path.isdir(args.path):
        print(f"❌ 无法访问路径: {args.path}")
        return 1

    files, skipped = collect_files(args.path)
    if not files:
        print(f"❌ 在 {args.path} 下未找到任何 *.js / *.html 文件。")
        print(f"   （已跳过 {skipped} 个忽略目录）")
        return 1

    print(f"🔍 扫描路径: {args.path}")
    print(f"  源码文件: {len(files)} 个（.js / .html），忽略目录: {skipped} 个")
    print("=" * 70)

    # 依次执行各检查项（顺序便于阅读）
    checks = [
        ("Ball",             check_ball),
        ("Rim",              check_rim),
        ("Shooting",         check_shooting),
        ("Collision",        check_collision),
        ("Score",            check_score),
        ("Timer",            check_timer),
        ("Combo",            check_combo),
        ("Game Over",        check_game_over),
        ("Restart",          check_restart),
        ("重复计分保护",       check_duplicate_score_guard),
    ]

    passed = 0
    failed = 0
    warnings = 0

    for label, fn in checks:
        status, lab, msg, hit_files = fn(files)
        icon = {"🟢": "✅", "🔴": "❌", "⚪": "⚠️"}[status]
        print(f"{icon} {lab:<22} — {msg}")

        if status == "🟢":
            passed += 1
        elif status == "🔴":
            failed += 1
        else:
            warnings += 1

    # 汇总
    total = len(checks)
    print("=" * 70)
    print(f"✅ 通过 {passed}/{total} 项" if failed == 0 and warnings == 0 else
          f"⚠️  通过 {passed}/{total} 项（缺失 {failed}，模糊 {warnings}）")

    if failed > 0 or warnings > 0:
        print("检测到需要开发者处理的问题，请结合上方明细进行修复。")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())