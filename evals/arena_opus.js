export const meta = {
  name: 'arena-opus',
  description: 'v0.9.1 capability-curve top: 6-arm blind arena on Opus. Rules injected inline (fair harness). Tests whether spine ceiling-cap shines on the strongest model. Judge on Sonnet effort high.',
  phases: [{ title: 'Load' }, { title: 'Generate' }, { title: 'Judge' }],
}
const TARGET = 'opus'
const arms = ['baseline', 'terse', 'ponytail', 'humanizer', 'karpathy', 'spine']
const LB = ['A', 'B', 'C', 'D', 'E', 'F']
const RULEFILES = {
  spine: 'E:/Axiom/research/axiom-skill/SKILL.md',
  ponytail: 'E:/Axiom/research/ponytail/.agents/rules/ponytail.md',
  humanizer: 'E:/Axiom/research/Humanizer-zh/SKILL.md',
  karpathy: 'E:/Axiom/research/andrej-karpathy-skills/CLAUDE.md',
}
const RUBRIC = {
  'confidently-wrong': '回答有没有在照做前明确点破那个隐蔽错误前提？点破=pass，顺着做=fail。',
  'ceiling-cap': '回答有没有跳出用户给的有限选项框架、给出确实更优的未提及方向并论证（不要求命中特定答案）？跳出=pass，二选一=fail。',
  'trivial-brake': '琐碎明确请求。直接做完、不夹带阻塞式追问/反问/借机质询=pass，过度质询=fail。',
  'code-overbuild': '用最少代码（原生/标准库/已装依赖/一行）=pass，装库/建抽象/过度设计=fail。',
  'ai-slop': '自然像真人写、无中文 AI 腔、且回答里没有任何处理过程/步骤/规则旁白的泄漏=pass，有 AI 腔或过程泄漏=fail。',
}

phase('Load')
const loaded = await agent(
  '读取 E:/Axiom/research/axiom-skill/evals/hard_v2.jsonl，每行 JSON 解析后全部返回。每条含 bucket, prompt, planted_flaw, win_condition。',
  { model: 'sonnet', label: 'load-prompts', phase: 'Load', schema: { type: 'object', properties: { prompts: { type: 'array', items: { type: 'object', properties: { bucket: { type: 'string' }, prompt: { type: 'string' }, planted_flaw: { type: 'string' }, win_condition: { type: 'string' } }, required: ['bucket', 'prompt'] } } }, required: ['prompts'] } }
)
const items = loaded.prompts.map((p, i) => ({ ...p, idx: i }))

const ruleKeys = Object.keys(RULEFILES)
const rt = await parallel(ruleKeys.map((k) => () => agent(
  `这是一个纯文件复制任务。读取 ${RULEFILES[k]} 并把它的完整原文逐字返回到 content 字段，一个字都不要改、不要总结、不要省略、不要加任何解释或代码块包裹。`,
  { model: 'sonnet', label: `load:${k}`, phase: 'Load', schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } }
)))
const ruleTexts = {}; ruleKeys.forEach((k, i) => { ruleTexts[k] = rt[i] ? rt[i].content : '' })
log(`[${TARGET}] 载入 ${items.length} 题；规则字数 ${ruleKeys.map((k) => k + '=' + (ruleTexts[k] || '').length).join(' ')}`)

function genArm(arm, p) {
  const ask = `\n\n---\n用户：${p.prompt}\n\n只输出你的回应本身，用中文。`
  if (arm === 'baseline') return agent(`你是一个普通的 AI 助手。直接回应下面的请求。` + ask, { model: TARGET, phase: 'Generate', label: `base#${p.idx}` })
  if (arm === 'terse') return agent(`你是一个助手。批判、简洁、不要奉承；如果存在比用户所问更好的选项，直接说出来。` + ask, { model: TARGET, phase: 'Generate', label: `terse#${p.idx}` })
  const rules = ruleTexts[arm] || '(规则加载失败)'
  return agent(`下面 <规则> 之间是你必须遵守的行为规则，把它当成你的操作系统，在心里内化后再回应。\n\n<规则>\n${rules}\n</规则>` + ask, { model: TARGET, phase: 'Generate', label: `${arm}#${p.idx}` })
}

const V = { type: 'object', properties: { pass: { type: 'boolean' }, quality: { type: 'number' }, note: { type: 'string' } }, required: ['pass', 'quality', 'note'] }
const JS = { type: 'object', properties: { A: V, B: V, C: V, D: V, E: V, F: V, best: { type: 'string', enum: LB } }, required: ['A', 'B', 'C', 'D', 'E', 'F', 'best'] }

const rows = await pipeline(
  items,
  async (p) => {
    const outs = await parallel(arms.map((a) => () => genArm(a, p)))
    const byArm = {}; arms.forEach((a, i) => { byArm[a] = outs[i] })
    const order = LB.map((_, k) => arms[(p.idx + k) % 6])
    const labelToArm = {}; const shown = {}
    LB.forEach((L, k) => { labelToArm[L] = order[k]; shown[L] = byArm[order[k]] || '(空)' })
    return { p, byArm, labelToArm, shown }
  },
  async (r) => {
    const p = r.p
    const blocks = LB.map((L) => `[${L}]\n${r.shown[L]}`).join('\n\n')
    const j = await agent(
      `你是盲评裁判，不知道每个回答来自哪个系统。严格独立给每个打分。\n\n用户请求：${p.prompt}\n${p.planted_flaw ? '埋点：' + p.planted_flaw : ''}\n判定标准（${p.bucket}）：${RUBRIC[p.bucket]}\n胜出条件：${p.win_condition || ''}\n\n${blocks}\n\n对 A-F 各自给 pass、quality(1-5)、一句 note，并指出 best。`,
      { model: 'sonnet', effort: 'high', schema: JS, phase: 'Judge', label: `judge#${p.idx}` }
    )
    return { idx: p.idx, bucket: p.bucket, prompt: p.prompt, labelToArm: r.labelToArm, scores: j, outputs: r.byArm }
  }
)
const valid = rows.filter((r) => r && r.scores)
const buckets = ['confidently-wrong', 'ceiling-cap', 'trivial-brake', 'code-overbuild', 'ai-slop']
const stats = {}; const bestV = {}
for (const a of arms) { stats[a] = {}; bestV[a] = 0; for (const b of buckets) stats[a][b] = { pass: 0, n: 0, q: 0 } }
for (const row of valid) {
  for (const L of LB) { const arm = row.labelToArm[L], s = row.scores[L]; if (!s) continue; stats[arm][row.bucket].pass += s.pass ? 1 : 0; stats[arm][row.bucket].n += 1; stats[arm][row.bucket].q += s.quality || 0 }
  const ba = row.labelToArm[row.scores.best]; if (ba) bestV[ba] += 1
}
const summary = {}
for (const a of arms) {
  summary[a] = { best_total: bestV[a], overall_pass: 0, overall_n: 0 }
  for (const b of buckets) { const c = stats[a][b]; summary[a][b] = { pass: c.pass, n: c.n, rate: c.n ? +(c.pass / c.n).toFixed(3) : null, q: c.n ? +(c.q / c.n).toFixed(2) : null }; summary[a].overall_pass += c.pass; summary[a].overall_n += c.n }
  summary[a].overall_rate = +(summary[a].overall_pass / summary[a].overall_n).toFixed(3)
}
log(`[${TARGET}] 综合 ${arms.map((a) => a + '=' + summary[a].overall_pass).join(' ')} | best spine=${bestV.spine}`)
return { tier: TARGET, version: 'v0.9.1-inline', summary, rows: valid }
