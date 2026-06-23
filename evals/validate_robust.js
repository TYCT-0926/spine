export const meta = {
  name: 'validate-robust',
  description: '双轴代码验证：v0.10-base（2编辑）vs v0.10-robust（+正确性不为短让路）在 6 道易踩坑的小代码题上盲评。判同时给两个分——minimal（够精简不过度）和 robust（真实边界有没有在代码里处理掉、不出 bug）。证明"精简 AND 周全"不是二选一。判=Sonnet high。',
  phases: [{ title: 'Load' }, { title: 'Run1' }, { title: 'Run2' }],
}
const NRUNS = 2
const arms = ['base', 'robust']
const FILES = {
  base: 'C:/Users/Shini/AppData/Local/Temp/claude/E--Axiom-research/ffdc0709-6104-4803-945a-249b8c754c0f/scratchpad/skill_v010base.md',
  robust: 'E:/Axiom/research/axiom-skill/SKILL.md',
}
const LB = ['A', 'B']
const PROMPTS = [
  { prompt: '写一个函数，把秒数（整数）格式化成 "HH:MM:SS"。', edges: '负数秒；非整数(float)输入；超过 24 小时是否给出合理结果' },
  { prompt: '用 JavaScript 写一个函数，计算从 a 到 b 的百分比变化。', edges: 'a=0 时除零（不能直接返回 Infinity / NaN，要有合理处理）' },
  { prompt: '写一个函数，返回一个数字列表里第二大的数。', edges: '空列表；只有一个元素；最大值有重复（第二大该是次大还是并列）' },
  { prompt: '写一个函数，把 "1,234.56" 这种带千分位逗号的金额字符串转成数字。', edges: '空字符串；含非法字符；没有小数部分；负号 / 前后空格' },
  { prompt: '写一个函数，判断一串只含圆括号的字符串是否正确匹配。', edges: '空字符串（应为 true）；只有右括号 ")"；未闭合 "("；深层嵌套' },
  { prompt: '写一个 Python 函数，把一个列表按每 n 个元素分块。', edges: 'n<=0（非法）；空列表；长度不能被 n 整除（最后一块不足）' },
].map((p, i) => ({ ...p, idx: i }))

phase('Load')
const rt = await parallel(arms.map((a) => () => agent(
  `这是纯文件复制任务。读取 ${FILES[a]} 并把完整原文逐字返回到 content，一个字都不改、不省略、不加解释。`,
  { model: 'sonnet', label: `load:${a}`, phase: 'Load', schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } }
)))
const RULES = {}; arms.forEach((a, i) => { RULES[a] = rt[i] ? rt[i].content : '' })
log(`base=${RULES.base.length}字 robust=${RULES.robust.length}字；${PROMPTS.length} 题 × ${NRUNS} 轮`)

function gen(arm, p, run) {
  return agent(`下面 <规则> 之间是你必须遵守的行为规则，把它当成你的操作系统，在心里内化后再回应。\n\n<规则>\n${RULES[arm]}\n</规则>\n\n---\n用户：${p.prompt}\n\n只输出你的回应本身，用中文。`,
    { model: 'sonnet', phase: `Run${run + 1}`, label: `r${run}:${arm}#${p.idx}` })
}

const V = { type: 'object', properties: { minimal: { type: 'boolean' }, robust: { type: 'boolean' }, note: { type: 'string' } }, required: ['minimal', 'robust', 'note'] }
const JS = { type: 'object', properties: { A: V, B: V, better: { type: 'string', enum: ['A', 'B', 'tie'] } }, required: ['A', 'B', 'better'] }

async function runOnce(run) {
  return await pipeline(
    PROMPTS,
    async (p) => {
      const outs = await parallel(arms.map((a) => () => gen(a, p, run)))
      const byArm = {}; arms.forEach((a, i) => { byArm[a] = outs[i] })
      const order = LB.map((_, k) => arms[(p.idx + k + run) % 2])
      const labelToArm = {}; const shown = {}
      LB.forEach((L, k) => { labelToArm[L] = order[k]; shown[L] = byArm[order[k]] || '(空)' })
      return { p, labelToArm, shown }
    },
    async (r) => {
      const p = r.p
      const blocks = LB.map((L) => `[${L}]\n${r.shown[L]}`).join('\n\n')
      const j = await agent(
        `你是盲评代码裁判，不知道每个回答来自哪个系统。两个轴独立评：\n- minimal：够精简——没装多余库、没建无谓抽象、没为这一个需求过度设计、没写一大段代码外的解释旁白。注意：把边界处理写进代码里**不算**啰嗦，不要因为代码考虑了边界就扣 minimal。\n- robust：拿下面的"必须扛住的边界"逐条对照，代码是不是真能正确处理（不崩、不返回错误结果、该挡的 fail loudly）。全部扛住=true，漏掉会真实出 bug 的边界=false。\n\n用户请求：${p.prompt}\n必须扛住的边界：${p.edges}\n\n${blocks}\n\n对 A、B 各给 minimal(bool)、robust(bool)、一句 note，并指出 better（综合又短又稳，A/B/tie）。`,
        { model: 'sonnet', effort: 'high', schema: JS, phase: `Run${run + 1}`, label: `r${run}:judge#${p.idx}` }
      )
      return { idx: p.idx, run, labelToArm: r.labelToArm, scores: j }
    }
  )
}

const rows = []
for (let run = 0; run < NRUNS; run++) {
  const rr = (await runOnce(run)).filter((r) => r && r.scores)
  rows.push(...rr)
  const m = {}, rb = {}; arms.forEach((a) => { m[a] = 0; rb[a] = 0 })
  for (const row of rr) for (const L of LB) { const arm = row.labelToArm[L], s = row.scores[L]; if (!s) continue; if (s.minimal) m[arm]++; if (s.robust) rb[arm]++ }
  log(`[run ${run + 1}] minimal base=${m.base} robust=${m.robust} | robust base=${rb.base} robust=${rb.robust} /${PROMPTS.length}`)
}

const stat = {}; const better = { base: 0, robust: 0, tie: 0 }
for (const a of arms) stat[a] = { minimal: 0, robust: 0, n: 0 }
for (const row of rows) {
  for (const L of LB) { const arm = row.labelToArm[L], s = row.scores[L]; if (!s) continue; stat[arm].n++; if (s.minimal) stat[arm].minimal++; if (s.robust) stat[arm].robust++ }
  const bk = row.scores.better; if (bk === 'tie') better.tie++; else { const arm = row.labelToArm[bk]; if (arm) better[arm]++ }
}
const summary = {}
for (const a of arms) summary[a] = { n: stat[a].n, minimal: stat[a].minimal, robust: stat[a].robust, minimal_rate: +(stat[a].minimal / stat[a].n).toFixed(3), robust_rate: +(stat[a].robust / stat[a].n).toFixed(3) }
const minimal_held = summary.robust.minimal >= summary.base.minimal - 1
const robust_up = summary.robust.robust > summary.base.robust
log(`[最终] minimal base=${summary.base.minimal} robust=${summary.robust.minimal} | robust base=${summary.base.robust} robust=${summary.robust.robust} (/${stat.base.n}) | better robust=${better.robust} base=${better.base} tie=${better.tie}`)
return { runs: NRUNS, arms: 'v0.10-base vs v0.10-robust', summary, better, minimal_held, robust_up, verdict: (minimal_held && robust_up) ? 'PASS（精简守住、稳健提升）' : 'REVIEW', rows }
