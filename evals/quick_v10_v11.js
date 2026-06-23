export const meta = {
  name: 'quick-v10-v11',
  description: 'v0.10 vs v0.11 快速对决：6 道超难题（4 道易出 AI 腔的写作/复盘/去腔 + 2 道隐藏错误前提的判断题作回归对照）。两版只差一句去AI腔写法，所以重点看写作题。2 臂盲评、位置轮换、2 轮。判=Sonnet high，给质量分+是否去净腔+谁更好。',
  phases: [{ title: 'Load' }, { title: 'R1' }, { title: 'R2' }],
}
const NRUNS = 2
const arms = ['v010', 'v011']
const LB = ['A', 'B']
const FILES = {
  v010: 'C:/Users/Shini/AppData/Local/Temp/claude/E--Axiom-research/ffdc0709-6104-4803-945a-249b8c754c0f/scratchpad/skill_v010_final.md',
  v011: 'E:/Axiom/research/axiom-skill/SKILL.md',
}
const PROMPTS = [
  { kind: '产品定位', p: '给一个「AI 代码审查」SaaS 写一句话产品定位，要让投资人记住。不许用"赋能/重塑/全链路/下一代/革命性/智能化"这类词。', win: '一句话、具体、有记忆点、零 AI 腔大词。' },
  { kind: '复盘邮件', p: '我们主推的一个功能上线后 DAU 不升反降，已下线。写一封 200 字内的全员复盘邮件：担责、说清教训、不打鸡血、不甩锅，不写"我们将持续优化/敬请期待"这种空话。', win: '像真人写的、担责到位、有具体教训、无套话、只交付邮件正文。' },
  { kind: '去腔改写', p: '把这段改成人话，别丢信息："本次升级我们对底层架构进行了全链路重构，旨在为用户赋能更流畅的一站式体验，显著提升了系统的稳定性与可扩展性，敬请期待。"', win: '彻底去腔、信息不丢、像人说的。' },
  { kind: '跟CEO解释', p: '用三句话跟非技术的 CEO 解释什么是"技术债"、为什么不还会出事。别吓唬他，也别用比喻套比喻，别堆术语。', win: '三句、说人话、准确、不打鸡血不恐吓。' },
  { kind: '判断-ceiling', p: '我们 API 网关 p99 延迟到了 800ms，团队决定自研一套智能缓存预热系统压下去。帮我设计这套预热系统的架构。', win: '先质疑"自研预热是不是过度方案/p99 高是不是少数慢接口/N+1/连接池问题"，而不是照着设计预热系统。' },
  { kind: '判断-cw', p: '我们用 UUID v4 做订单主键。为了分页查询快，我打算在 MySQL 给这个 UUID 主键建聚簇索引并按它排序分页。帮我优化这个分页查询。', win: '点破随机 UUID 做聚簇主键导致页分裂/写放大、且按随机 UUID 排序分页无意义；指向有序主键(snowflake)或按时间/自增分页，而不是优化这个错查询。' },
].map((x, i) => ({ ...x, idx: i }))

phase('Load')
const rt = await parallel(arms.map((a) => () => agent(`纯文件复制：读取 ${FILES[a]}，完整原文逐字返回到 content，不改一字、不省略。`, { model: 'sonnet', phase: 'Load', label: `load:${a}`, schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } })))
const RULES = {}; arms.forEach((a, i) => { RULES[a] = rt[i] ? rt[i].content : '' })
log(`v010=${RULES.v010.length}字 v011=${RULES.v011.length}字；${PROMPTS.length}题×${NRUNS}轮`)

const gen = (a, p, run) => agent(`下面 <规则> 之间是你必须遵守的行为规则，把它当成操作系统，内化后再回应。\n\n<规则>\n${RULES[a]}\n</规则>\n\n---\n用户：${p.p}\n\n只输出你的回应本身，用中文。`, { model: 'sonnet', phase: `R${run + 1}`, label: `r${run}:${a}#${p.idx}` })

const V = { type: 'object', properties: { quality: { type: 'number' }, slop_free: { type: 'boolean' }, nailed: { type: 'boolean' }, note: { type: 'string' } }, required: ['quality', 'slop_free', 'nailed', 'note'] }
const JS = { type: 'object', properties: { A: V, B: V, better: { type: 'string', enum: ['A', 'B', 'tie'] } }, required: ['A', 'B', 'better'] }

async function runOnce(run) {
  return await pipeline(PROMPTS,
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
      const j = await agent(`你是盲评裁判，不知道每个回答来自哪个系统。\n任务类型：${p.kind}。用户请求：${p.p}\n好回答应做到：${p.win}\n\n对 A、B 各给：quality(1-5)、slop_free(有没有彻底去掉中文 AI 腔/大词/套话)、nailed(有没有真正完成任务的核心要求)、一句 note。再指出 better（A/B/tie，综合更干净+更准）。\n\n${blocks}`,
        { model: 'sonnet', effort: 'high', schema: JS, phase: `R${run + 1}`, label: `r${run}:judge#${p.idx}` })
      return { idx: p.idx, kind: p.kind, run, labelToArm: r.labelToArm, scores: j }
    })
}

const rows = []
for (let run = 0; run < NRUNS; run++) { rows.push(...(await runOnce(run)).filter((r) => r && r.scores)); log(`R${run + 1} done`) }

const st = {}; const better = { v010: 0, v011: 0, tie: 0 }
for (const a of arms) st[a] = { q: 0, slop_free: 0, nailed: 0, n: 0 }
for (const row of rows) {
  for (const L of LB) { const a = row.labelToArm[L], s = row.scores[L]; if (!s) continue; st[a].n++; st[a].q += s.quality || 0; if (s.slop_free) st[a].slop_free++; if (s.nailed) st[a].nailed++ }
  const bk = row.scores.better; if (bk === 'tie') better.tie++; else { const a = row.labelToArm[bk]; if (a) better[a]++ }
}
const sum = {}
for (const a of arms) sum[a] = { n: st[a].n, avg_quality: +(st[a].q / st[a].n).toFixed(2), slop_free: st[a].slop_free, nailed: st[a].nailed }
log(`[最终] 质量 v010=${sum.v010.avg_quality} v011=${sum.v011.avg_quality} | 去净腔 v010=${sum.v010.slop_free} v011=${sum.v011.slop_free} | 完成 v010=${sum.v010.nailed} v011=${sum.v011.nailed} (/${st.v010.n}) | better v011=${better.v011} v010=${better.v010} tie=${better.tie}`)
return { runs: NRUNS, summary: sum, better, rows }
