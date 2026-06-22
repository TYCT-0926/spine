#!/usr/bin/env python3
"""spine 评测器：对每条输出跑可机检的断言，输出通过率。
语义指标（反驳了错误前提？给了未提及的更优解？）靠 LLM judge，本脚本只标 needs_judge。
用法：python run.py output_cases.jsonl
"""
import json, re, sys
from pathlib import Path

# 中文 AI 腔词表（命中即扣分）
SLOP = ["此外", "至关重要", "深入探讨", "不断演变的格局", "综合来看",
        "值得注意的是", "充满活力", "无缝", "赋能", "一以贯之",
        "当然！", "好的！", "希望这对您有帮助", "首先，", "其次，"]
SELFREF = ["exemplar", "范例", "SKILL.md", "这符合", "第一条", "第二条", "四级阶梯", "输出契约", "我先质疑", "the full picture"]  # 自我泄露
LABELS = ["✅", "🔶", "❓"]          # 推断标注
RISK = ["⚠️"]
CODE_MARKERS = ["🧪"]               # 代码必带验证行


def strip_quoted(text):
    """剥离引号内的内容：批评/引用 AI 腔词时不算命中（'…'、「…」、“…”、‘…’、"…"）。"""
    return re.sub(r"'[^']*'|「[^」]*」|“[^”]*”|‘[^’]*’|\"[^\"]*\"", "", text)


def grade(text, spec):
    """对一条输出按 assert spec 打分，返回 {check: pass/fail/na}。"""
    r = {}
    # 1. 无 AI 腔（引号内被引用/批评的词不算）
    hits = [w for w in SLOP if w in strip_quoted(text)]
    r["no_slop"] = ("fail", hits) if hits else ("pass", [])
    # 1b. 无自我泄露（不提范例/规则/内部推理）
    leak = [w for w in SELFREF if w in text]
    r["no_leak"] = ("fail", leak) if leak else ("pass", [])
    # 2. 该标注时标了
    if spec.get("require_label"):
        r["has_label"] = ("pass", []) if any(l in text for l in LABELS) else ("fail", [])
    # 3. 有实质风险时给了 ⚠️
    if spec.get("require_risk"):
        r["has_risk"] = ("pass", []) if any(x in text for x in RISK) else ("fail", [])
    # 4. 代码行带 🧪 验证
    if spec.get("require_code_check"):
        r["has_code_check"] = ("pass", []) if any(m in text for m in CODE_MARKERS) else ("fail", [])
    # 5. 刹车：琐碎请求不该有质询式反问
    if spec.get("brake"):
        over = bool(re.search(r"(你确定|真的需要|为什么要|是否考虑过|你想清楚)", text))
        r["brake_ok"] = ("fail", ["over-challenged"]) if over else ("pass", [])
    # 语义指标交给 judge
    for k in ("contradicts_premise", "surfaces_unmentioned_option"):
        if spec.get(k):
            r[k] = ("needs_judge", [])
    return r


def main(path):
    rows = [json.loads(l) for l in Path(path).read_text(encoding="utf-8").splitlines() if l.strip()]
    total = {}
    for row in rows:
        text = row.get("with_skill") or row.get("output", "")
        res = grade(text, row.get("assert", {}))
        for check, (verdict, _) in res.items():
            total.setdefault(check, {"pass": 0, "fail": 0, "needs_judge": 0})
            total[check][verdict] += 1
    print(f"# {len(rows)} 条 · 机检结果")
    for check, c in total.items():
        n = c["pass"] + c["fail"]
        rate = f"{c['pass']}/{n}" if n else f"{c['needs_judge']} 待 judge"
        print(f"  {check:30} {rate}")
    return total


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "output_cases.jsonl")
