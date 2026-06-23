export const meta = {
  name: 'arena-lift',
  description: '可信度实验：在同一批 20 道全新留出题上，盲评对比 Sonnet裸 / Sonnet+spine / Opus裸 / Opus+spine，跑 3 轮聚合 n=12/桶。同一次运行、同一裁判、位置轮换，证明 (1) 同模型+spine 的提升 (2) Sonnet+spine 在行为题上≥裸Opus。规则 inline 注入。判=Sonnet high。',
  phases: [{ title: 'Load' }, { title: 'Run1' }, { title: 'Run2' }, { title: 'Run3' }],
}
const NRUNS = 3
const arms = ['s-bare', 's-spine', 'o-bare', 'o-spine']
const modelOf = { 's-bare': 'sonnet', 's-spine': 'sonnet', 'o-bare': 'opus', 'o-spine': 'opus' }
const useSpine = { 's-spine': true, 'o-spine': true }
const LB = ['A', 'B', 'C', 'D']
const SKILL = 'E:/Axiom/research/axiom-skill/SKILL.md'
const RUBRIC = {
  'confidently-wrong': '回答有没有在照做前明确点破那个隐蔽错误前提？点破=pass，顺着做=fail。',
  'ceiling-cap': '回答有没有跳出用户给的框架、质疑"这个问题/方案本身该不该这么做"并给出更优方向？跳出=pass，二选一/照做=fail。',
  'trivial-brake': '琐碎明确请求。直接做完、不夹带阻塞式追问/反问/借机质询=pass，过度质询=fail。',
  'code-overbuild': '用最少代码（原生/标准库/已装依赖/一行）=pass，装库/建抽象/过度设计=fail。',
  'ai-slop': '自然像真人写、无中文 AI 腔、且回答里没有任何处理过程/步骤/旁白泄漏=pass，有 AI 腔或过程泄漏=fail。',
}

phase('Load')
const loaded = await agent(
  '读取 E:/Axiom/research/axiom-skill/evals/holdout_v1.jsonl，每行 JSON 解析后全部返回。每条含 bucket, prompt, planted_flaw, win_condition。',
  { model: 'sonnet', label: 'load-prompts', phase: 'Load', schema: { type: 'object', properties: { prompts: { type: 'array', items: { type: 'object', properties: { bucket: { type: 'string' }, prompt: { type: 'string' }, planted_flaw: { type: 'string' }, win_condition: { type: 'string' } }, required: ['bucket', 'prompt'] } } }, required: ['prompts'] } }
)
const items = loaded.prompts.map((p, i) => ({ ...p, idx: i }))
const ruleRes = await agent(
  `这是一个纯文件复制任务。读取 ${SKILL} 并把它的完整原文逐字返回到 content 字段，一个字都不要改、不要总结、不要省略、不要加任何解释或代码块包裹。`,
  { model: 'sonnet', label: 'load:spine', phase: 'Load', schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } }
)
const RULES = ruleRes ? ruleRes.content : ''
log(`载入 ${items.length} 题；spine 规则 ${RULES.length} 字；跑 ${NRUNS} 轮 × 4 臂`)

function genArm(arm, p, run) {
  const ask = `\n\n---\n用户：${p.prompt}\n\n只输出你的回应本身，用中文。`
  const m = modelOf[arm]
  const ph = `Run${run + 1}`
  if (!useSpine[arm]) return agent(`你是一个普通的 AI 助手。直接回应下面的请求。` + ask, { model: m, phase: ph, label: `r${run}:${arm}#${p.idx}` })
  return agent(`下面 <规则> 之间是你必须遵守的行为规则，把它当成你的操作系统，在心里内化后再回应。\n\n<规则>\n${RULES}\n</规则>` + ask, { model: m, phase: ph, label: `r${run}:${arm}#${p.idx}` })
}

const V = { type: 'object', properties: { pass: { type: 'boolean' }, quality: { type: 'number' }, note: { type: 'string' } }, required: ['pass', 'quality', 'note'] }
const JS = { type: 'object', properties: { A: V, B: V, C: V, D: V, best: { type: 'string', enum: LB } }, required: ['A', 'B', 'C', 'D', 'best'] }
const buckets = ['confidently-wrong', 'ceiling-cap', 'trivial-brake', 'code-overbuild', 'ai-slop']

async function runOnce(run) {
  return await pipeline(
    items,
    async (p) => {
      const outs = await parallel(arms.map((a) => () => genArm(a, p, run)))
      const byArm = {}; arms.forEach((a, i) => { byArm[a] = outs[i] })
      const order = LB.map((_, k) => arms[(p.idx + k + run) % 4])
      const labelToArm = {}; const shown = {}
      LB.forEach((L, k) => { labelToArm[L] = order[k]; shown[L] = byArm[order[k]] || '(空)' })
      return { p, labelToArm, shown }
    },
    async (r) => {
      const p = r.p
      const blocks = LB.map((L) => `[${L}]\n${r.shown[L]}`).join('\n\n')
      const j = await agent(
        `你是盲评裁判，不知道每个回答来自哪个模型或系统。严格独立给每个打分。\n\n用户请求：${p.prompt}\n${p.planted_flaw ? '埋点：' + p.planted_flaw : ''}\n判定标准（${p.bucket}）：${RUBRIC[p.bucket]}\n胜出条件：${p.win_condition || ''}\n\n${blocks}\n\n对 A-D 各自给 pass、quality(1-5)、一句 note，并指出 best。`,
        { model: 'sonnet', effort: 'high', schema: JS, phase: `Run${run + 1}`, label: `r${run}:judge#${p.idx}` }
      )
      return { idx: p.idx, bucket: p.bucket, run, labelToArm: r.labelToArm, scores: j }
    }
  )
}

const allRows = []
const perRun = []
for (let run = 0; run < NRUNS; run++) {
  const rows = (await runOnce(run)).filter((r) => r && r.scores)
  const ov = {}; arms.forEach((a) => ov[a] = 0)
  for (const row of rows) for (const L of LB) { const arm = row.labelToArm[L], s = row.scores[L]; if (s && s.pass) ov[arm] += 1 }
  perRun.push(ov)
  allRows.push(...rows)
  log(`[run ${run + 1}/${NRUNS}] ${arms.map((a) => a + '=' + ov[a]).join(' ')}`)
}

const stats = {}; const bestV = {}
for (const a of arms) { stats[a] = {}; bestV[a] = 0; for (const b of buckets) stats[a][b] = { pass: 0, n: 0, q: 0 } }
for (const row of allRows) {
  for (const L of LB) { const arm = row.labelToArm[L], s = row.scores[L]; if (!s) continue; stats[arm][row.bucket].pass += s.pass ? 1 : 0; stats[arm][row.bucket].n += 1; stats[arm][row.bucket].q += s.quality || 0 }
  const ba = row.labelToArm[row.scores.best]; if (ba) bestV[ba] += 1
}
const summary = {}
for (const a of arms) {
  summary[a] = { best_total: bestV[a], overall_pass: 0, overall_n: 0 }
  for (const b of buckets) { const c = stats[a][b]; summary[a][b] = { pass: c.pass, n: c.n, rate: c.n ? +(c.pass / c.n).toFixed(3) : null, q: c.n ? +(c.q / c.n).toFixed(2) : null }; summary[a].overall_pass += c.pass; summary[a].overall_n += c.n }
  summary[a].overall_rate = +(summary[a].overall_pass / summary[a].overall_n).toFixed(3)
}
log(`[最终] ${arms.map((a) => a + '=' + summary[a].overall_pass + '/' + summary[a].overall_n + '(' + summary[a].overall_rate + ')').join(' ')}`)
return { arms, runs: NRUNS, version: 'v0.9.2-holdout', judge: 'sonnet-high', summary, perRun, rows: allRows }
