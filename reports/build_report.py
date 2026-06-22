#!/usr/bin/env python3
"""从 tier_*.json 生成 scorecard.md + 自包含 HTML 仪表盘。数据驱动，可复现。"""
import json
from pathlib import Path

R = Path(__file__).parent
arms = ['baseline', 'terse', 'ponytail', 'humanizer', 'karpathy', 'spine']
names = {'baseline': 'baseline(裸模型)', 'terse': 'terse(一句话)', 'ponytail': 'ponytail',
         'humanizer': 'humanizer-zh', 'karpathy': 'karpathy', 'spine': 'spine(本作)'}
buckets = ['confidently-wrong', 'ceiling-cap', 'trivial-brake', 'code-overbuild', 'ai-slop']
bk_cn = {'confidently-wrong': '反驳错误前提', 'ceiling-cap': '认知天花板', 'trivial-brake': '刹车',
         'code-overbuild': '精简代码', 'ai-slop': '去AI腔'}

H = json.load(open(R / 'tier_haiku.json', encoding='utf-8'))['summary']
S1 = json.load(open(R / 'tier_sonnet.json', encoding='utf-8'))['summary']
S2 = json.load(open(R / 'tier_sonnet2.json', encoding='utf-8'))['summary']
O = json.load(open(R / 'tier_opus.json', encoding='utf-8'))['summary']


def savg(a):  # Sonnet 两次平均
    r = {'overall': (S1[a]['overall_pass'] + S2[a]['overall_pass']) / 2,
         'best': (S1[a]['best_total'] + S2[a]['best_total']) / 2}
    for b in buckets:
        r[b] = (S1[a][b]['pass'] + S2[a][b]['pass']) / 2
    return r


def norm(summ, a):
    if 'overall' in summ[a]:
        return summ[a]
    return {'overall': summ[a]['overall_pass'], 'best': summ[a]['best_total'],
            **{b: summ[a][b]['pass'] for b in buckets}}


tiers = {'Haiku': {a: norm(H, a) for a in arms},
         'Sonnet': {a: savg(a) for a in arms},
         'Opus': {a: norm(O, a) for a in arms}}


def rank(t, a, key='overall'):
    return sorted(arms, key=lambda x: -tiers[t][x][key]).index(a) + 1


# ---------- scorecard.md ----------
md = ['# spine 评测记分牌（真实数据）', '',
      '6 臂盲评竞技场 · 30 道难度过滤的硬题（5 桶各 6 题）· 位置轮换匿名 · Sonnet 高强度裁判。',
      '竞品用各自仓库原文规则；spine 为 v0.6 路由架构。Sonnet 跑了两次取平均（结果稳定）。', '',
      '## 能力—增益曲线（spine）', '',
      '| 目标模型 | 综合 pass | 综合排名 | best 票 | 去AI腔排名 |', '|---|---|---|---|---|']
for t in ['Haiku', 'Sonnet', 'Opus']:
    s = tiers[t]['spine']
    md.append(f"| {t} | {s['overall']:.0f}/30 = {s['overall']/30*100:.0f}% | 第 {rank(t,'spine')} | "
              f"{s['best']:.1f} | 第 {rank(t,'spine','ai-slop')} |")
md += ['', '> 越往强模型，spine 越占优：综合从 43%→70%→80%，排名 3→1→并列1。',
       '> 去 AI 腔（风格指令，照做即可）在三层全部第一；反驳/天花板（判断行为）需要强模型才跟得动。', '',
       '## 每层全场综合（pass / 30）', '']
for t in ['Haiku', 'Sonnet', 'Opus']:
    md.append(f"### {t}")
    md.append('| 臂 | ' + ' | '.join(bk_cn[b] for b in buckets) + ' | 综合 | best |')
    md.append('|---|' + '---|' * (len(buckets) + 2))
    for a in sorted(arms, key=lambda x: -tiers[t][x]['overall']):
        c = tiers[t][a]
        row = f"| {names[a]} | " + ' | '.join(f"{c[b]:.0f}" for b in buckets)
        row += f" | **{c['overall']:.0f}** | {c['best']:.1f} |"
        md.append(row)
    md.append('')
md += ['## 迭代日志（SkillOpt 式，全部真实数据驱动）', '',
       '| 版本 | 改动 | 触发的数据 |', '|---|---|---|',
       '| v0.2 | 强化刹车「不挂追问/不尾部反问」+ 纠错前提要明说 | 早期集 cw 0.917→1.0 |',
       '| v0.3 | 输出卫生：不泄露范例/规则/内部推理 | 发现 spine 输出漏出「exemplar #6」元评论 |',
       '| v0.4 | 路由架构：写作/代码分流到专精强度打法 | AI腔 0→5 反超，但思考被路由走导致 cw 掉 |',
       '| v0.5 | 思考四级阶梯改 always-on | cw/天花板跃升 5/5，但刹车崩 0、念过程 |',
       '| v0.6 | 刹车前置门控 + 输出卫生升头号铁律 + 阶梯心里过 | 三桶增益保住、刹车恢复、泄漏消除 |',
       '', '## 诚实边界',
       '- 每桶 n=6，单层 30 题，绝对值有抽样噪声；看趋势与排名比看单点更稳。',
       '- ceiling-cap 三层普遍偏低（硬题"非显然更优解"对所有臂都难），按实质而非命中特定答案评分。',
       '- Opus 上 baseline 已能自做反驳/天花板（前沿饱和），spine 综合与之并列，靠 best 票（8，全场最高）与去AI腔领先。',
       '- 小模型（Haiku）跟不动条件判断，spine 不如更简单的 ponytail——这是判断类 skill 的能力地板，已诚实标注。']
(R / 'scorecard.md').write_text('\n'.join(md), encoding='utf-8')

# ---------- HTML ----------
COL = {'spine': '#e8590c', 'baseline': '#adb5bd', 'terse': '#ced4da', 'ponytail': '#74c0fc',
       'humanizer': '#b197fc', 'karpathy': '#63e6be'}


def bars(t, w=460, h=170, pad=34):
    data = sorted(arms, key=lambda x: -tiers[t][x]['overall'])
    mx = 30
    bw = (w - pad) / len(data) * 0.62
    gap = (w - pad) / len(data)
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px">']
    out.append(f'<line x1="{pad}" y1="{h-22}" x2="{w}" y2="{h-22}" stroke="#dee2e6"/>')
    for i, a in enumerate(data):
        v = tiers[t][a]['overall']
        bh = (v / mx) * (h - 44)
        x = pad + i * gap + (gap - bw) / 2
        y = h - 22 - bh
        out.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{bw:.0f}" height="{bh:.0f}" rx="2" fill="{COL[a]}">'
                   f'<title>{a}: {v:.0f}/30</title></rect>')
        out.append(f'<text x="{x+bw/2:.0f}" y="{y-4:.0f}" font-size="11" text-anchor="middle" fill="#333" font-weight="{700 if a=="spine" else 400}">{v:.0f}</text>')
        out.append(f'<text x="{x+bw/2:.0f}" y="{h-8:.0f}" font-size="9" text-anchor="middle" fill="#666">{a[:6]}</text>')
    out.append('</svg>')
    return '\n'.join(out)


def curve_svg(w=520, h=240, pad=42):
    xs = ['Haiku', 'Sonnet', 'Opus']
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px">']
    for gy in range(0, 101, 25):
        y = h - 30 - gy / 100 * (h - 56)
        out.append(f'<line x1="{pad}" y1="{y:.0f}" x2="{w-10}" y2="{y:.0f}" stroke="#f1f3f5"/>')
        out.append(f'<text x="{pad-6}" y="{y+3:.0f}" font-size="9" text-anchor="end" fill="#999">{gy}%</text>')
    px = lambda i: pad + i * (w - pad - 20) / 2 + 10
    py = lambda v: h - 30 - (v) * (h - 56)
    for a in arms:
        pts = [(px(i), py(tiers[t][a]['overall'] / 30)) for i, t in enumerate(xs)]
        d = ' '.join(f"{'M' if i==0 else 'L'}{x:.0f},{y:.0f}" for i, (x, y) in enumerate(pts))
        sp = a == 'spine'
        out.append(f'<path d="{d}" fill="none" stroke="{COL[a]}" stroke-width="{3.5 if sp else 1.5}" opacity="{1 if sp else 0.5}"/>')
        for (x, y) in pts:
            out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{4 if sp else 2.5}" fill="{COL[a]}"/>')
        lx, ly = pts[-1]
        out.append(f'<text x="{lx+6:.0f}" y="{ly+3:.0f}" font-size="10" fill="{COL[a]}" font-weight="{700 if sp else 400}">{a}</text>')
    for i, t in enumerate(xs):
        out.append(f'<text x="{px(i):.0f}" y="{h-12:.0f}" font-size="11" text-anchor="middle" fill="#333">{t}</text>')
    out.append('</svg>')
    return '\n'.join(out)


sp_curve = [tiers[t]['spine']['overall'] for t in ['Haiku', 'Sonnet', 'Opus']]
html = f"""<!doctype html><html lang="zh"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>spine · 评测仪表盘</title>
<style>
 body{{font:15px/1.6 -apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#212529;max-width:880px;margin:0 auto;padding:28px 20px;background:#fff}}
 h1{{font-size:26px;margin:0 0 4px}} .sub{{color:#868e96;margin:0 0 24px}}
 h2{{font-size:18px;margin:34px 0 10px;border-bottom:2px solid #e8590c;display:inline-block;padding-bottom:3px}}
 .card{{border:1px solid #e9ecef;border-radius:10px;padding:16px 18px;margin:14px 0;background:#fcfcfd}}
 .grid{{display:flex;flex-wrap:wrap;gap:14px}} .grid .card{{flex:1;min-width:260px}}
 table{{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}}
 th,td{{border:1px solid #e9ecef;padding:5px 8px;text-align:center}} th{{background:#f8f9fa}}
 tr.spine td{{background:#fff4e6;font-weight:600}}
 .big{{font-size:30px;font-weight:700;color:#e8590c}} .lbl{{color:#868e96;font-size:12px}}
 .note{{color:#868e96;font-size:12.5px}}
</style>
<h1>spine — 反顺从行为层 · 评测仪表盘</h1>
<p class="sub">6 臂盲评 · 30 道难度过滤硬题 · 位置轮换匿名 · 真实数据（占位名 spine/骨气，命名待定）</p>

<h2>核心：能力—增益曲线</h2>
<div class="card">
<p>同一套 skill，目标模型越强，spine 越占优。综合 pass 率随能力上升：
<b>{sp_curve[0]/30*100:.0f}% → {sp_curve[1]/30*100:.0f}% → {sp_curve[2]/30*100:.0f}%</b>，排名 <b>3 → 1 → 并列1</b>。</p>
{curve_svg()}
<p class="note">粗橙线为 spine。判断类行为（反驳错误前提 / 认知天花板）需要强模型才跟得动，所以小模型上 spine 不如更简单的 ponytail——这是判断类 skill 的「能力地板」。</p>
</div>

<h2>三层全场综合（pass / 30）</h2>
<div class="grid">
<div class="card"><div class="lbl">Haiku（地板）</div>{bars('Haiku')}</div>
<div class="card"><div class="lbl">Sonnet（甜点区，spine 第1）</div>{bars('Sonnet')}</div>
<div class="card"><div class="lbl">Opus（顶端，spine best票最高）</div>{bars('Opus')}</div>
</div>

<h2>spine 三个稳定优势</h2>
<div class="grid">
<div class="card"><div class="big">×3</div><div class="lbl">去 AI 腔在 Haiku/Sonnet/Opus <b>三层全部第一</b>（风格指令照做即可，不挑模型）</div></div>
<div class="card"><div class="big">8</div><div class="lbl">Opus 上被裁判选为「单项最佳」<b>8 次，全场最高</b></div></div>
<div class="card"><div class="big">0</div><div class="lbl">Sonnet/Opus 上<b>没有垫底的桶</b>，而每个专精 skill 都有自己的崩盘项</div></div>
</div>

<h2>每桶明细（Opus 层 · pass/6）</h2>
<table><tr><th>臂</th>{''.join(f'<th>{bk_cn[b]}</th>' for b in buckets)}<th>综合</th><th>best</th></tr>
{''.join('<tr class="'+('spine' if a=='spine' else '')+'">'+f'<td>{names[a]}</td>'+''.join(f'<td>{tiers["Opus"][a][b]:.0f}</td>' for b in buckets)+f'<td>{tiers["Opus"][a]["overall"]:.0f}</td><td>{tiers["Opus"][a]["best"]:.0f}</td></tr>' for a in sorted(arms,key=lambda x:-tiers['Opus'][x]['overall']))}
</table>

<h2>迭代轨迹</h2>
<div class="card note">
v0.2 修刹车 → v0.3 输出卫生 → v0.4 路由架构（AI腔 0→5）→ v0.5 阶梯 always-on（cw/天花板 5/5，刹车崩）→ <b>v0.6 刹车前置门控</b>（三桶增益保住+刹车恢复+泄漏消除）。每一步都由竞技场真实失败案例驱动。
</div>
<p class="note">方法：竞品用各自仓库原文规则当系统指令；同一目标模型跑全部臂（公平）；裁判盲评、不知来源、位置轮换去偏。每桶 n=6，趋势比单点稳。</p>
</html>"""
(R / 'scorecard.html').write_text(html, encoding='utf-8')
print('wrote scorecard.md +', len((R / 'scorecard.html').read_text(encoding='utf-8')), 'B scorecard.html')
