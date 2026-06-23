#!/usr/bin/env python3
"""从 data_sonnet_v*.json 生成一个自包含、可截图的精美评测仪表盘。
数据驱动、可复现；spine 为锁定版 v0.9.2（n=18，3×Sonnet）。"""
import json
import math
from pathlib import Path

R = Path(__file__).parent
arms = ['baseline', 'terse', 'ponytail', 'humanizer', 'karpathy', 'spine']
names = {'baseline': '裸模型', 'terse': 'terse 一句话', 'ponytail': 'ponytail',
         'humanizer': 'humanizer-zh', 'karpathy': 'karpathy', 'spine': 'spine'}
buckets = ['confidently-wrong', 'ceiling-cap', 'trivial-brake', 'code-overbuild', 'ai-slop']
bk_cn = {'confidently-wrong': '反驳错误前提', 'ceiling-cap': '破认知天花板', 'trivial-brake': '该刹车就刹车',
         'code-overbuild': '精简代码', 'ai-slop': '去 AI 腔'}
COL = {'spine': '#f76707', 'baseline': '#ced4da', 'terse': '#94d82d',
       'ponytail': '#4dabf7', 'humanizer': '#9775fa', 'karpathy': '#20c997'}

P = json.load(open(R / 'data_sonnet_v0.9.2.json', encoding='utf-8'))   # 锁定版 n=18
Rep = json.load(open(R / 'data_sonnet_v0.9.1.json', encoding='utf-8'))  # 复现 n=18
H = json.load(open(R / 'data_haiku_v0.9.2.json', encoding='utf-8'))['summary']  # 曲线端点 n=6
O = json.load(open(R / 'data_opus_v0.9.2.json', encoding='utf-8'))['summary']   # 曲线端点 n=6
S, Sr = P['summary'], Rep['summary']
TIER = {'Haiku': H, 'Sonnet': S, 'Opus': O}
LIFT_FILE = R / 'data_lift_v0.9.2.json'
LIFT = json.load(open(LIFT_FILE, encoding='utf-8'))['summary'] if LIFT_FILE.exists() else None


def trate(summ, a):
    return summ[a]['overall_pass'] / summ[a]['overall_n']


def overall(summ, a):
    return summ[a]['overall_pass'], summ[a]['overall_n']


def curve_svg(w=640, h=290, padl=44, padr=26, padt=22, padb=34):
    xs = ['Haiku', 'Sonnet', 'Opus']
    span = (w - padl - padr) / (len(xs) - 1)
    px = lambda i: padl + i * span
    py = lambda r: (h - padb) - r * (h - padt - padb)
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px">']
    for g in range(0, 101, 20):
        y = py(g / 100)
        out.append(f'<line x1="{padl}" y1="{y:.0f}" x2="{w-padr}" y2="{y:.0f}" stroke="#f1f3f5"/>')
        out.append(f'<text x="{padl-7}" y="{y+3:.0f}" font-size="9" fill="#ced4da" text-anchor="end">{g}%</text>')
    for i, t in enumerate(xs):
        out.append(f'<text x="{px(i):.0f}" y="{h-10}" font-size="12.5" fill="#495057" text-anchor="middle" font-weight="600">{t}</text>')
    for a in [x for x in arms if x != 'spine'] + ['spine']:
        sp = a == 'spine'
        pts = [(px(i), py(trate(TIER[t], a))) for i, t in enumerate(xs)]
        d = ' '.join(f"{'M' if i==0 else 'L'}{x:.0f},{y:.0f}" for i, (x, y) in enumerate(pts))
        out.append(f'<path d="{d}" fill="none" stroke="{COL[a]}" stroke-width="{4 if sp else 1.6}" '
                   f'opacity="{1 if sp else 0.5}" stroke-linejoin="round"/>')
        for (x, y) in pts:
            out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{5 if sp else 3}" fill="{COL[a]}" opacity="{1 if sp else 0.5}"/>')
    for i, t in enumerate(xs):
        r = trate(TIER[t], 'spine')
        out.append(f'<text x="{px(i):.0f}" y="{py(r)-12:.0f}" font-size="13" fill="#e8590c" '
                   f'text-anchor="{"start" if i==0 else ("end" if i==2 else "middle")}" font-weight="700">{r*100:.0f}%</text>')
    out.append('</svg>')
    return '\n'.join(out)


def lerp(c1, c2, t):
    return tuple(round(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def cell_color(rate):
    if rate is None:
        return '#f1f3f5'
    stops = [(0.0, (255, 201, 201)), (0.5, (255, 236, 179)), (0.78, (211, 243, 199)), (1.0, (140, 216, 158))]
    for i in range(len(stops) - 1):
        a, b = stops[i], stops[i + 1]
        if rate <= b[0]:
            t = (rate - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 0
            r, g, bl = lerp(a[1], b[1], t)
            return f'rgb({r},{g},{bl})'
    return 'rgb(140,216,158)'


# ---------- SVG: 综合排名横条 ----------
def rank_bars(w=620, rh=46, pad_l=120, pad_r=64):
    order = sorted(arms, key=lambda a: -S[a]['overall_pass'])
    n = len(order)
    h = rh * n + 16
    mx = 90
    base = S['baseline']['overall_pass']
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px">']
    bx = pad_l + (base / mx) * (w - pad_l - pad_r)
    out.append(f'<line x1="{bx:.0f}" y1="6" x2="{bx:.0f}" y2="{h-10}" stroke="#dee2e6" stroke-dasharray="3 3"/>')
    out.append(f'<text x="{bx:.0f}" y="{h-1}" font-size="9.5" fill="#adb5bd" text-anchor="middle">裸模型基线</text>')
    for i, a in enumerate(order):
        v = S[a]['overall_pass']
        bw = (v / mx) * (w - pad_l - pad_r)
        y = 8 + i * rh
        sp = a == 'spine'
        out.append(f'<text x="{pad_l-10}" y="{y+rh*0.46:.0f}" font-size="13" text-anchor="end" '
                   f'fill="{"#e8590c" if sp else "#495057"}" font-weight="{700 if sp else 500}">{names[a]}</text>')
        out.append(f'<rect x="{pad_l}" y="{y:.0f}" width="{bw:.1f}" height="{rh*0.62:.0f}" rx="4" '
                   f'fill="{COL[a]}" {"" if sp else "opacity=0.92"}>'
                   f'<title>{a}: {v}/90</title></rect>')
        pct = v / mx * 100
        out.append(f'<text x="{pad_l+bw+8:.0f}" y="{y+rh*0.42:.0f}" font-size="12.5" '
                   f'fill="{"#e8590c" if sp else "#868e96"}" font-weight="{700 if sp else 400}">'
                   f'{v}<tspan font-size="10" fill="#adb5bd">/90 · {pct:.0f}%</tspan></text>')
        if sp:
            out.append(f'<text x="{pad_l+bw+8:.0f}" y="{y+rh*0.42+15:.0f}" font-size="10" fill="#e8590c">综合第一</text>')
    out.append('</svg>')
    return '\n'.join(out)


# ---------- SVG: 每桶能力矩阵（热力图） ----------
def heatmap(w=640, ch=44, cw0=104, gap=4, lh=30):
    order = sorted(arms, key=lambda a: -S[a]['overall_pass'])
    cw = (w - cw0) / len(buckets) - gap
    h = lh + len(order) * (ch + gap) + 6
    colmax = {b: max(S[a][b]['pass'] for a in arms) for b in buckets}
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px" font-family="inherit">']
    for j, b in enumerate(buckets):
        x = cw0 + j * (cw + gap)
        out.append(f'<text x="{x+cw/2:.0f}" y="20" font-size="11" text-anchor="middle" fill="#495057" font-weight="600">{bk_cn[b]}</text>')
    for i, a in enumerate(order):
        y = lh + i * (ch + gap)
        sp = a == 'spine'
        out.append(f'<text x="{cw0-10}" y="{y+ch*0.6:.0f}" font-size="12.5" text-anchor="end" '
                   f'fill="{"#e8590c" if sp else "#495057"}" font-weight="{700 if sp else 500}">{names[a]}</text>')
        for j, b in enumerate(buckets):
            x = cw0 + j * (cw + gap)
            c = S[a][b]
            rate = c['rate']
            ismax = c['pass'] == colmax[b]
            stroke = '#e8590c' if (sp and ismax) else ('#fab005' if ismax else '#e9ecef')
            sw = 2.5 if ismax else 1
            out.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{cw:.0f}" height="{ch}" rx="6" '
                       f'fill="{cell_color(rate)}" stroke="{stroke}" stroke-width="{sw}"/>')
            out.append(f'<text x="{x+cw/2:.0f}" y="{y+ch*0.46:.0f}" font-size="13" text-anchor="middle" '
                       f'fill="#212529" font-weight="{700 if ismax else 500}">{c["pass"]}<tspan font-size="9" fill="#868e96">/18</tspan></text>')
            if ismax:
                out.append(f'<text x="{x+cw/2:.0f}" y="{y+ch*0.78:.0f}" font-size="8.5" text-anchor="middle" fill="{"#e8590c" if sp else "#f08c00"}">领先</text>')
    out.append('</svg>')
    return '\n'.join(out)


# ---------- SVG: ceiling-cap 聚光 ----------
def ceiling_spot(w=620, rh=38, pad_l=120, pad_r=80):
    order = sorted(arms, key=lambda a: -S[a]['ceiling-cap']['pass'])
    h = rh * len(order) + 10
    mx = 9
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px">']
    for i, a in enumerate(order):
        v = S[a]['ceiling-cap']['pass']
        bw = (v / mx) * (w - pad_l - pad_r)
        y = 6 + i * rh
        sp = a == 'spine'
        out.append(f'<text x="{pad_l-10}" y="{y+rh*0.5:.0f}" font-size="12.5" text-anchor="end" '
                   f'fill="{"#e8590c" if sp else "#868e96"}" font-weight="{700 if sp else 400}">{names[a]}</text>')
        out.append(f'<rect x="{pad_l}" y="{y:.0f}" width="{max(bw,2):.1f}" height="{rh*0.56:.0f}" rx="4" '
                   f'fill="{COL[a] if sp else "#dee2e6"}"/>')
        out.append(f'<text x="{pad_l+max(bw,2)+8:.0f}" y="{y+rh*0.46:.0f}" font-size="12" '
                   f'fill="{"#e8590c" if sp else "#adb5bd"}" font-weight="{700 if sp else 400}">{v}/18</text>')
    out.append('</svg>')
    return '\n'.join(out)


# ---------- SVG: 稳定性点图（perRun） ----------
def stability(w=620, rh=40, pad_l=120, pad_r=30):
    pr = P['perRun']
    order = sorted(arms, key=lambda a: -sum(r[a] for r in pr))
    h = rh * len(order) + 26
    lo, hi = 14, 28
    sx = lambda v: pad_l + (v - lo) / (hi - lo) * (w - pad_l - pad_r)
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px">']
    for gx in range(15, 29, 3):
        out.append(f'<line x1="{sx(gx):.0f}" y1="6" x2="{sx(gx):.0f}" y2="{h-20}" stroke="#f1f3f5"/>')
        out.append(f'<text x="{sx(gx):.0f}" y="{h-6}" font-size="9" fill="#ced4da" text-anchor="middle">{gx}</text>')
    for i, a in enumerate(order):
        vals = [r[a] for r in pr]
        y = 12 + i * rh
        sp = a == 'spine'
        out.append(f'<text x="{pad_l-10}" y="{y+4:.0f}" font-size="12.5" text-anchor="end" '
                   f'fill="{"#e8590c" if sp else "#868e96"}" font-weight="{700 if sp else 400}">{names[a]}</text>')
        out.append(f'<line x1="{sx(min(vals)):.0f}" y1="{y:.0f}" x2="{sx(max(vals)):.0f}" y2="{y:.0f}" '
                   f'stroke="{COL[a] if sp else "#dee2e6"}" stroke-width="{3 if sp else 2}"/>')
        for v in vals:
            out.append(f'<circle cx="{sx(v):.0f}" cy="{y:.0f}" r="{5 if sp else 3.5}" fill="{COL[a] if sp else "#adb5bd"}"/>')
        rng = max(vals) - min(vals)
        out.append(f'<text x="{sx(max(vals))+10:.0f}" y="{y+4:.0f}" font-size="10.5" '
                   f'fill="{"#e8590c" if sp else "#ced4da"}">极差 {rng}</text>')
    out.append(f'<text x="{pad_l}" y="{h-6}" font-size="9.5" fill="#adb5bd">每轮命中数（满分 30）· 三轮独立重测</text>')
    out.append('</svg>')
    return '\n'.join(out)


# ---------- 架构跃升 before/after ----------
def arch_jump(w=380, h=150):
    data = [('v0.6 路由架构', 17, '#ced4da'), ('v0.9 单文件', 25, '#f76707')]
    mx, bw, gap, base = 30, 92, 80, h - 34
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px">']
    for i, (lbl, v, c) in enumerate(data):
        x = 70 + i * (bw + gap)
        bh = v / mx * (h - 56)
        y = base - bh
        out.append(f'<rect x="{x}" y="{y:.0f}" width="{bw}" height="{bh:.0f}" rx="5" fill="{c}"/>')
        out.append(f'<text x="{x+bw/2}" y="{y-6:.0f}" font-size="17" text-anchor="middle" fill="{c if i else "#868e96"}" font-weight="700">{v}<tspan font-size="10" fill="#adb5bd">/30</tspan></text>')
        out.append(f'<text x="{x+bw/2}" y="{base+16:.0f}" font-size="11" text-anchor="middle" fill="#495057">{lbl}</text>')
    out.append(f'<text x="{w-8}" y="26" font-size="22" text-anchor="end" fill="#f76707" font-weight="800">+47%</text>')
    out.append('</svg>')
    return '\n'.join(out)


bk_short = {'confidently-wrong': '反错前提', 'ceiling-cap': '破天花板', 'trivial-brake': '刹车',
            'code-overbuild': '精简代码', 'ai-slop': '去AI腔'}


def _pent(cx, cy, R, rates):
    pts = []
    for i, r in enumerate(rates):
        ang = math.radians(-90 + i * 72)
        pts.append((cx + R * r * math.cos(ang), cy + R * r * math.sin(ang)))
    return pts


def radar_svg(w=330, h=292):
    cx, cy, R = w / 2, h / 2 + 4, 86
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px">']
    for g in (0.25, 0.5, 0.75, 1.0):
        d = ' '.join(f'{x:.0f},{y:.0f}' for x, y in _pent(cx, cy, R, [g] * 5))
        out.append(f'<polygon points="{d}" fill="none" stroke="#eef1f3"/>')
    for i, b in enumerate(buckets):
        ang = math.radians(-90 + i * 72)
        ex, ey = cx + R * math.cos(ang), cy + R * math.sin(ang)
        out.append(f'<line x1="{cx:.0f}" y1="{cy:.0f}" x2="{ex:.0f}" y2="{ey:.0f}" stroke="#eef1f3"/>')
        lx, ly = cx + (R + 16) * math.cos(ang), cy + (R + 16) * math.sin(ang)
        anc = 'middle' if abs(math.cos(ang)) < 0.3 else ('start' if math.cos(ang) > 0 else 'end')
        out.append(f'<text x="{lx:.0f}" y="{ly+3:.0f}" font-size="9.5" fill="#868e96" text-anchor="{anc}">{bk_short[b]}</text>')
    for arm, col, dashed in [('s-bare', '#ced4da', False), ('o-bare', '#4dabf7', True), ('s-spine', '#f76707', False)]:
        sp = arm == 's-spine'
        rates = [LIFT[arm][b]['rate'] for b in buckets]
        d = ' '.join(f'{x:.0f},{y:.0f}' for x, y in _pent(cx, cy, R, rates))
        dash = 'stroke-dasharray="4 3"' if dashed else ''
        out.append(f'<polygon points="{d}" fill="{col}" fill-opacity="{0.18 if sp else 0.05}" '
                   f'stroke="{col}" stroke-width="{2.8 if sp else 1.6}" {dash}/>')
        if sp:
            for x, y in _pent(cx, cy, R, rates):
                out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3" fill="{col}"/>')
    out.append('</svg>')
    return '\n'.join(out)


def dumbbell(w=330, h=250, padl=56, padr=56):
    rows = [('Sonnet', 's-bare', 's-spine'), ('Opus', 'o-bare', 'o-spine')]
    sx = lambda r: padl + r * (w - padl - padr)
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px">']
    for g in (0, 0.25, 0.5, 0.75, 1.0):
        x = sx(g)
        out.append(f'<line x1="{x:.0f}" y1="24" x2="{x:.0f}" y2="{h-50}" stroke="#f4f5f7"/>')
        out.append(f'<text x="{x:.0f}" y="{h-36}" font-size="8.5" fill="#ced4da" text-anchor="middle">{int(g*100)}</text>')
    obx = sx(LIFT['o-bare']['overall_rate'])
    out.append(f'<line x1="{obx:.0f}" y1="18" x2="{obx:.0f}" y2="{h-50}" stroke="#4dabf7" stroke-dasharray="3 3"/>')
    out.append(f'<text x="{obx:.0f}" y="{h-22}" font-size="9" fill="#4dabf7" text-anchor="middle">裸 Opus 基线</text>')
    rh = (h - 86) / len(rows)
    for i, (lbl, bare, spine) in enumerate(rows):
        y = 44 + i * rh
        rb, rs = LIFT[bare]['overall_rate'], LIFT[spine]['overall_rate']
        out.append(f'<text x="{padl-10}" y="{y+4:.0f}" font-size="12" fill="#495057" text-anchor="end" font-weight="600">{lbl}</text>')
        out.append(f'<line x1="{sx(rb):.0f}" y1="{y:.0f}" x2="{sx(rs):.0f}" y2="{y:.0f}" stroke="#f76707" stroke-width="3"/>')
        out.append(f'<circle cx="{sx(rb):.0f}" cy="{y:.0f}" r="5" fill="#fff" stroke="#adb5bd" stroke-width="2"/>')
        out.append(f'<circle cx="{sx(rs):.0f}" cy="{y:.0f}" r="6.5" fill="#f76707"/>')
        out.append(f'<text x="{sx(rb):.0f}" y="{y-11:.0f}" font-size="9.5" fill="#adb5bd" text-anchor="middle">{rb*100:.0f}%</text>')
        out.append(f'<text x="{sx(rs):.0f}" y="{y-12:.0f}" font-size="11.5" fill="#e8590c" text-anchor="middle" font-weight="700">{rs*100:.0f}%</text>')
        out.append(f'<text x="{(sx(rb)+sx(rs))/2:.0f}" y="{y+17:.0f}" font-size="9.5" fill="#f76707" text-anchor="middle">+{(rs-rb)*100:.0f}pt</text>')
    out.append('</svg>')
    return '\n'.join(out)


def lift_section():
    ss = LIFT['s-spine']['overall_rate']; ob = LIFT['o-bare']['overall_rate']
    sb = LIFT['s-bare']['overall_rate']; osp = LIFT['o-spine']['overall_rate']
    wins = [b for b in buckets if LIFT['s-spine'][b]['rate'] >= LIFT['o-bare'][b]['rate']]
    loses = [b for b in buckets if LIFT['s-spine'][b]['rate'] < LIFT['o-bare'][b]['rate']]
    lose_names = '、'.join(bk_cn[b] for b in loses) or '无'
    ob_best = LIFT['o-bare']['best_total']; ss_best = LIFT['s-spine']['best_total']
    leg = ('<div class="legend">'
           '<span class="lg"><i style="background:#f76707"></i>Sonnet + spine</span>'
           '<span class="lg"><i style="background:#4dabf7"></i>裸 Opus（虚线）</span>'
           '<span class="lg"><i style="background:#ced4da"></i>裸 Sonnet</span></div>')
    return f'''<h2>提升与越级（全新留出题 · 4 臂同场盲评）</h2>
<p class="cap">20 道 spine <b>从没见过的新题</b>，同一次运行盲评四个组合、位置轮换、3 轮聚合 n=12/桶——这才压得住「过拟合 / 不同批次」的质疑。左图：同模型加 spine 的纯增益（控制了模型变量），蓝虚线是要越过的裸 Opus 基线。右图：五维行为雷达。</p>
<div class="card two">
 <div>{dumbbell()}</div>
 <div>{radar_svg()}{leg}</div>
</div>
<div class="quote"><b>结论：Sonnet+spine 行为综合 {ss*100:.0f}% &gt; 裸 Opus {ob*100:.0f}%。</b> spine 让 Sonnet 在没见过的题上提升 <b>{(ss-sb)*100:.0f} 个点（+{(ss-sb)/sb*100:.0f}%）</b>，加到 Opus 上也 +{(osp-ob)*100:.0f} 点。雷达里橙圈在 <b>{len(wins)} / 5 维</b>盖过裸 Opus，只有「<b>{lose_names}</b>」裸 Opus 反超——<b>这恰恰是诚实的边界</b>：行为题 spine 能让 Sonnet 追平甚至超过 Opus，但最吃推理力的那一维、以及「单题最佳」的执行质量（裸 Opus {ob_best} 票 vs Sonnet+spine {ss_best} 票），Opus 的脑子仍更强。⚠️ 这是<b>行为题不是能力题</b>，别外推到数学 / 算法 / 知识。</div>
'''


sp = S['spine']
sp_ov = sp['overall_pass']
lead = sorted((S[a]['overall_pass'] for a in arms if a != 'spine'), reverse=True)[0]
nlead = [a for a in arms if a != 'spine' and S[a]['overall_pass'] == lead][0]
win_buckets = sum(1 for b in buckets if S['spine'][b]['pass'] == max(S[a][b]['pass'] for a in arms))

CSS = '''
*{margin:0;padding:0;box-sizing:border-box}
:root{--ink:#18181b;--ink2:#3f3f46;--mut:#71717a;--faint:#a1a1aa;--o:#ea580c;--o2:#f97316;
 --o-soft:#fff7ed;--o-line:#fed7aa;--bg:#fff;--bg2:#fafaf9;--line:#eeedeb;--line2:#e4e4e7;
 --ok:#16a34a;--no:#dc2626;--rad:16px;--shadow:0 1px 2px rgba(0,0,0,.04),0 10px 30px -16px rgba(0,0,0,.12);--maxw:940px}
html{scroll-behavior:smooth;scroll-padding-top:74px}
body{font:16px/1.72 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;
 color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
em{font-style:normal;color:var(--o)}
b,strong{font-weight:680}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 22px}
.nav{position:sticky;top:0;z-index:50;backdrop-filter:saturate(1.7) blur(12px);background:rgba(255,255,255,.8);border-bottom:1px solid var(--line)}
.nav-in{max-width:var(--maxw);margin:0 auto;padding:0 22px;height:56px;display:flex;align-items:center;gap:18px}
.brand{font-weight:820;font-size:18px;letter-spacing:-.02em;display:flex;align-items:center;gap:8px}
.brand span{font-size:11.5px;font-weight:600;color:var(--mut);background:var(--bg2);border:1px solid var(--line2);padding:2px 8px;border-radius:20px}
.nav-links{display:flex;gap:2px;margin-left:auto;overflow-x:auto;scrollbar-width:none}
.nav-links::-webkit-scrollbar{display:none}
.nav-links a{font-size:13.5px;color:var(--mut);padding:6px 11px;border-radius:8px;white-space:nowrap;transition:.15s}
.nav-links a:hover{color:var(--ink);background:var(--bg2)}
.nav-links a.on{color:var(--o);background:var(--o-soft)}
.hero{padding:74px 0 46px;border-bottom:1px solid var(--line);background:radial-gradient(1100px 420px at 78% -12%,var(--o-soft),transparent 62%)}
.kicker{font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--o)}
.hero h1{font-size:clamp(40px,7.2vw,64px);line-height:1.02;letter-spacing:-.035em;font-weight:830;margin:16px 0 0}
.hero-thesis{font-size:18px;color:var(--ink2);max-width:610px;margin:22px 0 0;line-height:1.62}
.hero-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:40px}
.hs{background:var(--bg);border:1px solid var(--line2);border-radius:14px;padding:18px 20px;box-shadow:var(--shadow)}
.hs-n{font-size:30px;font-weight:830;color:var(--o);letter-spacing:-.02em;line-height:1}
.hs-n s{text-decoration:none;color:var(--faint);font-weight:600;font-size:21px;margin:0 3px}
.hs-l{font-size:12.5px;color:var(--mut);margin-top:10px;line-height:1.5}
.sec{padding:58px 0;border-bottom:1px solid var(--line)}
.sec h2{font-size:clamp(25px,4vw,33px);letter-spacing:-.022em;font-weight:790;margin:11px 0 0}
.sub{font-size:21px;font-weight:740;letter-spacing:-.01em;margin:44px 0 0}
.lead{font-size:15px;color:var(--mut);max-width:700px;margin:15px 0 0;line-height:1.66}
.lead b{color:var(--ink2)}
.card{border:1px solid var(--line2);border-radius:var(--rad);padding:24px;margin-top:22px;background:var(--bg);box-shadow:var(--shadow)}
.card.flat{box-shadow:none}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:center}
.cap{color:var(--mut);font-size:13.5px;line-height:1.62;margin:14px 0 0}
.note{color:var(--faint);font-size:12.5px;margin:14px 0 0;line-height:1.62}
.legend{display:flex;flex-wrap:wrap;gap:9px 16px;margin-top:15px;font-size:12.5px;color:var(--mut)}
.legend .lg{display:flex;align-items:center;gap:6px}.legend i{width:11px;height:11px;border-radius:3px;display:inline-block}.legend b{color:var(--ink2)}
.quote{font-size:14.5px;color:var(--ink2);background:var(--o-soft);border:1px solid var(--o-line);border-radius:12px;padding:15px 18px;margin-top:18px;line-height:1.62}
.cmp{margin-top:24px}
.cmp-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.cmp-tabs{display:flex;gap:6px;flex-wrap:wrap}
.cmp-tabs button{font-size:13.5px;font-weight:600;color:var(--mut);background:var(--bg2);border:1px solid var(--line2);padding:7px 13px;border-radius:9px;cursor:pointer;transition:.15s}
.cmp-tabs button:hover{color:var(--ink)}
.cmp-tabs button.on{color:#fff;background:var(--o);border-color:var(--o)}
.cmp-toggle{display:inline-flex;background:var(--bg2);border:1px solid var(--line2);border-radius:11px;padding:3px}
.cmp-toggle button{font-size:12.5px;font-weight:600;color:var(--mut);background:none;border:none;padding:7px 13px;border-radius:8px;cursor:pointer;transition:.15s}
.cmp-toggle button.on{color:var(--ink);background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.09)}
.cmp-q{margin-top:18px;font-size:15px;color:var(--ink2);background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:14px 16px;line-height:1.6}
.cmp-q .ql{display:inline-block;font-size:11px;font-weight:700;color:var(--o);background:var(--o-soft);padding:2px 8px;border-radius:6px;margin-right:8px}
.cmp-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
.ans{border:1px solid var(--line2);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;background:var(--bg)}
.ans.spine{border-color:var(--o-line);box-shadow:0 0 0 1px var(--o-line)}
.ans-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 15px;border-bottom:1px solid var(--line);background:var(--bg2)}
.ans.spine .ans-h{background:var(--o-soft)}
.ans-m{font-size:13.5px;font-weight:700}
.chip{font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap}
.chip.ok{color:var(--ok);background:#f0fdf4;border:1px solid #bbf7d0}
.chip.no{color:var(--no);background:#fef2f2;border:1px solid #fecaca}
.ans-b{padding:14px 16px;font-size:13px;line-height:1.64;color:var(--ink2);white-space:pre-wrap;word-break:break-word;overflow:hidden;transition:max-height .35s ease}
.ans-b[data-c="1"]{max-height:250px;-webkit-mask-image:linear-gradient(180deg,#000 74%,transparent);mask-image:linear-gradient(180deg,#000 74%,transparent)}
.ans-b[data-c="0"]{max-height:6000px}
.ans-b code{font-family:'SF Mono',Consolas,monospace;font-size:12px;background:var(--bg2);border-radius:4px;padding:1px 4px}
.ans-b pre{font-family:'SF Mono',Consolas,monospace;font-size:11.5px;line-height:1.5;background:#1e1e22;color:#e4e4e7;border-radius:8px;padding:11px 13px;margin:8px 0;white-space:pre;overflow-x:auto}
.ans-x{font-size:12px;color:var(--o);background:none;border:none;border-top:1px solid var(--line);padding:9px;cursor:pointer;font-weight:600}
.ans-x:hover{background:var(--o-soft)}
.cmp-diff{margin-top:16px;font-size:14px;line-height:1.62;color:var(--ink2);background:var(--o-soft);border:1px solid var(--o-line);border-radius:12px;padding:14px 18px}
.cmp-diff b{color:var(--o);margin-right:8px}
.meth{font-size:13px;color:var(--ink2);background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:16px 18px;line-height:1.72}
.honest li{margin:9px 0;color:var(--ink2);font-size:14px;line-height:1.6}
.repl{display:flex;gap:12px;flex-wrap:wrap}
.repl .b{flex:1;min-width:200px;border:1px solid var(--line2);border-radius:12px;padding:14px 16px}
.repl .b .t{font-size:12px;color:var(--mut)}.repl .b .v{font-size:16px;font-weight:700;margin-top:3px}.repl .b .v b{color:var(--o)}
footer{padding:40px 0 72px;color:var(--faint);font-size:12.5px;line-height:1.85}
.reveal{opacity:0;transform:translateY(18px);transition:opacity .6s cubic-bezier(.2,.7,.2,1),transform .6s cubic-bezier(.2,.7,.2,1)}
.reveal.in{opacity:1;transform:none}
.v10banner{margin-top:24px;font-size:13.5px;line-height:1.62;color:var(--ink2);background:var(--o-soft);border:1px solid var(--o-line);border-radius:12px;padding:14px 18px}
.v10banner b{color:var(--o)}
@media(max-width:680px){.hero-stats,.two,.cmp-cols{grid-template-columns:1fr}}
'''

JS = r'''
var links=[].slice.call(document.querySelectorAll('.nav-links a'));
var spy=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(l){l.classList.toggle('on',l.getAttribute('href')==='#'+e.target.id)})}})},{rootMargin:'-45% 0px -50% 0px'});
[].slice.call(document.querySelectorAll('section[id]')).forEach(function(s){spy.observe(s)});
var rev=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');rev.unobserve(e.target)}})},{rootMargin:'0px 0px -6% 0px'});
[].slice.call(document.querySelectorAll('.reveal')).forEach(function(x){rev.observe(x)});
var LBL={sBare:'裸 Sonnet',sSpine:'Sonnet + spine',oBare:'裸 Opus'};
var ci=0,cm='lift';
function $(id){return document.getElementById(id)}
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function fmt(s){s=esc(s);s=s.replace(/```[a-z]*\n([\s\S]*?)```/g,function(m,c){return '<pre>'+c.replace(/\n$/,'')+'</pre>'});s=s.replace(/`([^`]+)`/g,'<code>$1</code>');s=s.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');return s}
function ansCard(it,k){var ok=it.pass[k];return '<div class="ans'+(k==='sSpine'?' spine':'')+'"><div class="ans-h"><span class="ans-m">'+LBL[k]+'</span><span class="chip '+(ok?'ok':'no')+'">'+(ok?'✓ 做对了':'✗ 没做到')+'</span></div><div class="ans-b" data-c="1">'+fmt(it.ans[k])+'</div><button class="ans-x">展开全文</button></div>'}
function renderCmp(){if(!window.SHOWCASE||!SHOWCASE.length)return;var it=SHOWCASE[ci];
$('cmpTabs').innerHTML=SHOWCASE.map(function(x,i){return '<button class="'+(i===ci?'on':'')+'" data-i="'+i+'">'+x.bucketCn+'</button>'}).join('');
[].slice.call($('cmpTabs').querySelectorAll('button')).forEach(function(b){b.onclick=function(){ci=+b.dataset.i;renderCmp()}});
[].slice.call(document.querySelectorAll('#cmpToggle button')).forEach(function(b){b.classList.toggle('on',b.dataset.m===cm)});
$('cmpQ').innerHTML='<span class="ql">用户问</span>'+esc(it.prompt);
var p=cm==='lift'?['sBare','sSpine']:['sSpine','oBare'];
$('cmpCols').innerHTML=ansCard(it,p[0])+ansCard(it,p[1]);
[].slice.call($('cmpCols').querySelectorAll('.ans-x')).forEach(function(btn){btn.onclick=function(){var b=btn.previousElementSibling;var c=b.dataset.c==='1';b.dataset.c=c?'0':'1';btn.textContent=c?'收起':'展开全文'}});
$('cmpDiff').innerHTML='<b>关键差异</b>'+esc(it.note[cm])}
[].slice.call(document.querySelectorAll('#cmpToggle button')).forEach(function(b){b.onclick=function(){cm=b.dataset.m;renderCmp()}});
renderCmp();
'''

SHOWCASE_FILE = R / 'data_showcase.json'
SHOWCASE = json.load(open(SHOWCASE_FILE, encoding='utf-8')) if SHOWCASE_FILE.exists() else []
nav = '<a href="#lift">提升越级</a><a href="#compare">回答实例</a><a href="#curve">能力曲线</a><a href="#arena">对手对比</a><a href="#method">方法论</a>'
curve_leg = ''.join(f'<span class="lg"><i style="background:{COL[a]}"></i>{names[a]} <b>{trate(O,a)*100:.0f}%</b></span>' for a in sorted(arms, key=lambda x: -trate(O, x)))
cmp_box = '' if not SHOWCASE else ('<div class="cmp"><div class="cmp-bar"><div class="cmp-tabs" id="cmpTabs"></div>'
    '<div class="cmp-toggle" id="cmpToggle"><button class="on" data-m="lift">提升 · 裸 Sonnet → +spine</button>'
    '<button data-m="cross">越级 · +spine vs 裸 Opus</button></div></div>'
    '<div class="cmp-q" id="cmpQ"></div><div class="cmp-cols" id="cmpCols"></div><div class="cmp-diff" id="cmpDiff"></div></div>')

body = f'''<nav class="nav"><div class="nav-in"><a href="#top" class="brand">spine <span>骨气</span></a><div class="nav-links">{nav}</div></div></nav>
<header id="top" class="hero"><div class="wrap reveal">
<div class="kicker">反顺从行为层 · 锁定版 v0.11</div>
<h1>给 AI agent<br>装上 <em>骨气</em></h1>
<p class="hero-thesis">该直接做就做，该挡前提就挡，问对问题、写最少代码、说人话。<br><b>AI 的输出上限 = 你的认知上限 × AI 的顺从性</b>——这一层同时削两个乘数。</p>
<div class="hero-stats">
<div class="hs"><div class="hs-n">+50%</div><div class="hs-l">留出新题上，spine 让 Sonnet 行为命中率 57% → 85%（同模型纯增益）</div></div>
<div class="hs"><div class="hs-n">85% <s>&gt;</s> 70%</div><div class="hs-l">Sonnet + spine 行为综合越过裸 Opus（留出题盲评，非过拟合）</div></div>
<div class="hs"><div class="hs-n">三层 #1</div><div class="hs-l">对比 5 个对手 skill，Haiku / Sonnet / Opus 综合命中率都第一</div></div>
</div>
</div></header>
<main>
<div class="wrap"><div class="v10banner reveal"><b>v0.11（当前锁定）</b>最新 6 臂 n=18 复测：spine <b>综合 75/90 全场第一</b>（领先次席 7 分）、best 票 24、<b>破天花板 9 全场断层第一</b>、刹车满分、三轮 25/25/25 完全稳定；去 AI 腔 16→17 近满分。一个「通用性护栏」被本轮实测抓出会连带伤 cw（判断↔普适的根本矛盾），已撤回——详见 CHANGELOG。下方明细图为 v0.9.2 基线（cw 干净），v0.11 在其上再 +。</div></div>
<section id="lift" class="sec"><div class="wrap reveal"><div class="kicker">效果 · 留出验证</div>{lift_section() if LIFT else ''}</div></section>
<section id="compare" class="sec"><div class="wrap reveal">
<div class="kicker">回答实例</div>
<h2>同一道题，加了骨气前后</h2>
<p class="lead">分数是抽象的，回答是具体的。下面是<b>留出题里的真实回答</b>，你自己看差别。切「提升」看同一个 Sonnet 开关 spine 的变化，切「越级」看 Sonnet+spine 对打裸 Opus。<b>没挑好的</b>——「破天花板」那道 Opus 反而更强，照样放上来。</p>
{cmp_box}
</div></section>
<section id="curve" class="sec"><div class="wrap reveal">
<div class="kicker">能力曲线</div>
<h2>模型越强，它越强</h2>
<p class="lead">同一个 v0.9.2 文件装到三个强度的模型上。spine 在 <b>Haiku / Sonnet / Opus 三层全部综合第一</b>，命中率随能力上行（67% → 79% → 80%）。早期路由版在 Haiku 上跟不动、输给更简单的 ponytail；折叠成单文件后连最弱的 Haiku 都能照着做（ponytail 反而在 Haiku 崩到 20%）。</p>
<div class="card">{curve_svg()}<div class="legend">{curve_leg}</div>
<p class="note">图例为 Opus 层综合命中率。Opus / Haiku 为单轮 n=6（比 Sonnet 的 n=18 噪声大），看综合趋势稳；破天花板桶在 Opus 单轮全场掉到 ~1，该单项优势只用 Sonnet n=18 声称。</p></div>
</div></section>
<section id="arena" class="sec"><div class="wrap reveal">
<div class="kicker">对手对比 · Sonnet n=18</div>
<h2>对比 5 个专精 skill</h2>
<p class="lead">6 臂盲评（裸模型 / terse / ponytail / humanizer-zh / karpathy / spine），各用其仓库原文规则。spine 综合第一，且是唯一全程高于裸模型基线的行为层。</p>
<div class="card">{rank_bars()}</div>
<div class="sub">每桶能力矩阵</div>
<p class="lead">格子颜色 = 命中率（红低绿高），金框 = 该桶全场领先。spine 拿下 <b>{win_buckets}/5</b> 桶领先且<b>没有一个红格</b>——每个对手都有崩盘桶。code 桶 terse 凭「天然写最少代码」领先，spine 第 3 但仍高于裸模型。</p>
<div class="card">{heatmap()}</div>
<div class="sub">USP：破认知天花板</div>
<p class="lead">spine 区别于「又一个简洁 prompt」的根本点：不是「在选项里选得好」，而是<b>主动质疑「这个问题该不该现在解决」</b>。</p>
<div class="card">{ceiling_spot()}<div class="quote">整个领域在这一桶都低分——跳出框架是判断行为，不是风格指令。spine 6/18 全场第一；v0.9.1 同桶 8/18，<b>领先两轮复现</b>。</div></div>
<div class="sub">稳定性：不是手气好</div>
<p class="lead">三轮独立重测。spine 每轮都第一、三轮极差最小——别的臂忽高忽低，spine 稳在 23–24。</p>
<div class="card">{stability()}</div>
</div></section>
<section id="method" class="sec"><div class="wrap reveal">
<div class="kicker">方法论与边界</div>
<h2>为什么可信</h2>
<div class="meth" style="margin-top:18px">盲评 + 位置轮换（裁判不知答案来自哪个模型/skill，位置每轮转）· <b>留出题</b>（越级实验那 20 道 spine 没见过，杜绝过拟合）· 同场对比（四组合同一次运行、同一裁判）· 3 轮聚合 n=12~18/桶 · <b>规则 inline 注入</b>（原文逐字读一次嵌进 prompt，模拟自动加载 SKILL.md）· 诚实边界写在脸上。裁判：Sonnet high。</div>
<div class="two" style="margin-top:18px">
 <div class="card flat" style="margin:0"><div class="lead" style="margin:0 0 10px">两次独立 n=18，spine 综合与天花板桶都第一：</div><div class="repl"><div class="b"><div class="t">v0.9.1（前一版）</div><div class="v"><b>73</b>/90 · 综合#1 · 天花板 8</div></div><div class="b"><div class="t">v0.9.2（锁定）</div><div class="v"><b>71</b>/90 · 综合#1 · 天花板 6</div></div></div></div>
 <div class="card flat" style="margin:0"><div class="lead" style="margin:0 0 6px">真正的「比过去好」是结构性的：多文件路由折叠成单文件，agent 几乎不读懒加载 reference，路由层等于空操作。</div>{arch_jump()}</div>
</div>
<div class="sub">诚实边界</div>
<div class="card honest" style="margin-top:14px"><ul style="margin:0;padding-left:20px">
<li>不声称「碾压全部」：行为题 Sonnet+spine 综合越过裸 Opus，但<b>最吃推理的「破天花板」桶、以及单题执行质量，裸 Opus 仍领先</b>。这是行为题不是能力题，别外推到数学 / 算法 / 知识。</li>
<li>最稳的信号是「综合排名」和 Sonnet 的「天花板#1」（n=18）。Opus / Haiku 单轮 n=6，per-bucket 会跳。v0.9.2 后停止行为迭代，避免追单桶噪声。</li>
<li>单文件版连最弱的 Haiku 都综合第一，推翻早期「小模型不如 ponytail」——那是路由架构问题，不是宿命。</li>
<li>「精简代码」桶测的是<b>精简度，不是 bug 率</b>——看不见静默 bug。v0.10 另立底线「正确性不为短让路」，双轴验证把代码稳健性从 <b>25%→58%</b>（边界不出 bug），精简守住。但 58% 非满分：prompt 把 Sonnet 的边界意识拉得高、拉不满，是能力上限。</li>
<li>spine 是<b>判断类专精</b>：决策 / 代码 / 写作实测领先全场；纯闲聊 / 社交它会略端着（通用性探针 misfire ~3/14 vs 裸模型 0）。v0.11 试过「通用性护栏」让它在通用场景收手，但全场 arena 实测它会<b>连带把 cw 从 18 砸到 15</b>（判断↔普适的根本矛盾），已撤——该把 spine 用在它擅长的活上，不当全局闲聊层。</li>
</ul></div>
</div></section>
</main>
<footer><div class="wrap">spine / 骨气 — 给 agent 装上骨气。行为规则不含名字。<br>
数据：6 臂盲评竞技场，Sonnet 3× 聚合 n=18/桶（主结果）；Haiku / Opus 单轮 n=6（曲线端点）；留出越级 4 臂 n=12/桶。规则 inline 注入，源数据 reports/data_*.json，可复现。<br>
竞品规则来自各自仓库原文，致谢见 README。</div></footer>'''

html = ('<!doctype html><html lang="zh"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>spine（骨气）· 反顺从行为层</title><style>' + CSS + '</style>'
        '<noscript><style>.reveal{opacity:1!important;transform:none!important}</style></noscript></head><body>'
        + body + '<script>window.SHOWCASE=' + json.dumps(SHOWCASE, ensure_ascii=False) + ';\n' + JS + '</script></body></html>')
(R / 'scorecard.html').write_text(html, encoding='utf-8')

# ---------- 精简 md（给不开浏览器的人） ----------
md = ['# spine 评测记分牌 · 锁定版 v0.9.2（真实数据）', '',
      '6 臂盲评竞技场 · 30 道难度过滤硬题 · 位置轮换匿名 · Sonnet 高强度裁判 · 规则 inline 注入 · 3 轮聚合 n=18/桶。', '',
      f'**三层全部第一**：Haiku 67% · Sonnet 79% · Opus 80%——spine 综合命中率在三个强度的模型上都排第一（单文件版连 Haiku 都跟得动）。',
      f'**Sonnet 综合第一**：spine {sp_ov}/90，领先次席（{names[nlead]}）{sp_ov-lead} 分。',
      f'**{win_buckets}/5 桶领先**，无一桶低于裸模型。**最难的「破天花板」桶 Sonnet 第一**（两轮复现）。', '',
      '## 综合命中（pass / 90）', '', '| 臂 | 综合 | best 票 | ' + ' | '.join(bk_cn[b] for b in buckets) + ' |',
      '|---|---|---|' + '---|' * len(buckets)]
for a in sorted(arms, key=lambda x: -S[x]['overall_pass']):
    s = S[a]
    star = ' ★' if a == 'spine' else ''
    md.append(f"| {names[a]}{star} | **{s['overall_pass']}** | {s['best_total']} | " +
              ' | '.join(f"{s[b]['pass']}/18" for b in buckets) + ' |')
md += ['', '## 诚实边界',
       '- 不声称碾压全部：Sonnet 的 code 桶被 terse 反超（terse 天然写最少代码），spine 仍高于裸模型。',
       '- Opus/Haiku 为单轮 n=6（噪声大）；天花板桶在 Opus 单轮里全场都掉到 ~1，看综合趋势更稳。',
       '- 单文件版连 Haiku 都综合第一，推翻早期路由版「小模型不如 ponytail」的判断（那是架构问题）。']
(R / 'scorecard.md').write_text('\n'.join(md), encoding='utf-8')
print('wrote scorecard.html (%d B) + scorecard.md' % len((R / 'scorecard.html').read_text(encoding='utf-8')))
