export const meta = {
  name: 'validate-v010',
  description: 'v0.9.2 vs v0.10 差分验证：同一批 20 道留出题上盲评两个 SKILL 版本，3 轮聚合 n=12/桶，位置轮换。只 2 臂——焦点是"每桶都正向、无回归"，不是全场对手对比。规则 inline 注入，判=Sonnet high。',
  phases: [{ title: 'Load' }, { title: 'Run1' }, { title: 'Run2' }, { title: 'Run3' }],
}
const NRUNS = 3
const arms = ['v092', 'v010']
const FILES = {
  v092: 'C:/Users/Shini/AppData/Local/Temp/claude/E--Axiom-research/ffdc0709-6104-4803-945a-249b8c754c0f/scratchpad/skill_v092.md',
  v010: 'E:/Axiom/research/axiom-skill/SKILL.md',
}
const LB = ['A', 'B']
const RUBRIC = {
  'confidently-wrong': '回答有没有在照做前明确点破那个隐蔽错误前提？点破=pass，顺着做=fail。',
  'ceiling-cap': '回答有没有跳出框架、质疑"这个问题/方案本身该不该这么做"并给出更优方向？跳出+给出具体可执行方向=最强，只质疑不落地=较弱，照做=fail。',
  'trivial-brake': '琐碎明确请求。直接做完、不夹带阻塞式追问/反问/借机质询=pass，过度质询=fail。',
  'code-overbuild': '用最少代码（原生/标准库/已装依赖/一行）、不外挂多余说明=pass，装库/建抽象/过度设计/啰嗦旁注=fail。',
  'ai-slop': '自然像真人写、无中文 AI 腔、回答里没有任何处理过程/步骤/旁白泄漏=pass，有 AI 腔或过程泄漏=fail。',
}

phase('Load')
const loaded = await agent(
  '读取 E:/Axiom/research/axiom-skill/evals/holdout_v1.jsonl，每行 JSON 解析后全部返回。每条含 bucket, prompt, planted_flaw, win_condition。',
  { model: 'sonnet', label: 'load-prompts', phase: 'Load', schema: { type: 'object', properties: { prompts: { type: 'array', items: { type: 'object', properties: { bucket: { type: 'string' }, prompt: { type: 'string' }, planted_flaw: { type: 'string' }, win_condition: { type: 'string' } }, required: ['bucket', 'prompt'] } } }, required: ['prompts'] } }
)
const items = loaded.prompts.map((p, i) => ({ ...p, idx: i }))
const rt = await parallel(arms.map((a) => () => agent(
  `这是纯文件复制任务。读取 ${FILES[a]} 并把完整原文逐字返回到 content，一个字都不改、不省略、不加解释。`,
  { model: 'sonnet', label: `load:${a}`, phase: 'Load', schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } }
)))
const RULES = {}; arms.forEach((a, i) => { RULES[a] = rt[i] ? rt[i].content : '' })
log(`载入 ${items.length} 题；v092=${RULES.v092.length}字 v010=${RULES.v010.length}字；跑 ${NRUNS} 轮`)

function gen(arm, p, run) {
  return agent(`下面 <规则> 之间是你必须遵守的行为规则，把它当成你的操作系统，在心里内化后再回应。\n\n<规则>\n${RULES[arm]}\n</规则>\n\n---\n用户：${p.prompt}\n\n只输出你的回应本身，用中文。`,
    { model: 'sonnet', phase: `Run${run + 1}`, label: `r${run}:${arm}#${p.idx}` })
}

const V = { type: 'object', properties: { pass: { type: 'boolean' }, quality: { type: 'number' }, note: { type: 'string' } }, required: ['pass', 'quality', 'note'] }
const JS = { type: 'object', properties: { A: V, B: V, better: { type: 'string', enum: ['A', 'B', 'tie'] } }, required: ['A', 'B', 'better'] }
const buckets = ['confidently-wrong', 'ceiling-cap', 'trivial-brake', 'code-overbuild', 'ai-slop']

async function runOnce(run) {
  return await pipeline(
    items,
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
        `你是盲评裁判，不知道每个回答来自哪个系统。独立给每个打分，再判哪个整体更好（或 tie）。\n\n用户请求：${p.prompt}\n${p.planted_flaw ? '埋点：' + p.planted_flaw : ''}\n判定标准（${p.bucket}）：${RUBRIC[p.bucket]}\n胜出条件：${p.win_condition || ''}\n\n${blocks}\n\n对 A、B 各给 pass、quality(1-5)、一句 note，并指出 better（A/B/tie）。`,
        { model: 'sonnet', effort: 'high', schema: JS, phase: `Run${run + 1}`, label: `r${run}:judge#${p.idx}` }
      )
      return { idx: p.idx, bucket: p.bucket, run, labelToArm: r.labelToArm, scores: j }
    }
  )
}

const allRows = []
for (let run = 0; run < NRUNS; run++) {
  const rows = (await runOnce(run)).filter((r) => r && r.scores)
  allRows.push(...rows)
  const ov = {}; arms.forEach((a) => ov[a] = 0)
  for (const row of rows) for (const L of LB) { const arm = row.labelToArm[L], s = row.scores[L]; if (s && s.pass) ov[arm] += 1 }
  log(`[run ${run + 1}/${NRUNS}] v092=${ov.v092} v010=${ov.v010} /20`)
}

const stats = {}; const better = { v092: 0, v010: 0, tie: 0 }
for (const a of arms) { stats[a] = {}; for (const b of buckets) stats[a][b] = { pass: 0, n: 0, q: 0 } }
for (const row of allRows) {
  for (const L of LB) { const arm = row.labelToArm[L], s = row.scores[L]; if (!s) continue; stats[arm][row.bucket].pass += s.pass ? 1 : 0; stats[arm][row.bucket].n += 1; stats[arm][row.bucket].q += s.quality || 0 }
  const bk = row.scores.better; if (bk === 'tie') better.tie += 1; else { const arm = row.labelToArm[bk]; if (arm) better[arm] += 1 }
}
const summary = {}
for (const a of arms) {
  summary[a] = { overall_pass: 0, overall_n: 0 }
  for (const b of buckets) { const c = stats[a][b]; summary[a][b] = { pass: c.pass, n: c.n, rate: c.n ? +(c.pass / c.n).toFixed(3) : null, q: c.n ? +(c.q / c.n).toFixed(2) : null }; summary[a].overall_pass += c.pass; summary[a].overall_n += c.n }
  summary[a].overall_rate = +(summary[a].overall_pass / summary[a].overall_n).toFixed(3)
}
const delta = {}; let regression = []
for (const b of buckets) { const d = summary.v010[b].pass - summary.v092[b].pass; delta[b] = d; if (d < -1) regression.push(`${b}(${d})`) }
const overall_delta = summary.v010.overall_pass - summary.v092.overall_pass
log(`[最终] v092=${summary.v092.overall_pass}/${summary.v092.overall_n} v010=${summary.v010.overall_pass}/${summary.v010.overall_n} | Δ综合=${overall_delta} | better v010=${better.v010} v092=${better.v092} tie=${better.tie} | 回归桶=${regression.join(',') || '无'}`)
return { runs: NRUNS, version_a: 'v0.9.2', version_b: 'v0.10', summary, delta, overall_delta, better, regression, verdict: regression.length === 0 && overall_delta >= 0 ? 'PASS' : 'REVIEW' }
