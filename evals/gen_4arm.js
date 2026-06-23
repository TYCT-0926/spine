export const meta = {
  name: 'gen-4arm',
  description: '4 臂真实输出，给 GitHub 三向对比：裸 Sonnet / Sonnet+骨气 / 裸 Opus / Opus+骨气。同题。展示 (1) 骨气在 Sonnet 上的提升 (2) Sonnet+骨气 越级裸 Opus (3) 骨气在 Opus 上的提升。',
  phases: [{ title: 'Load' }, { title: 'Gen' }],
}
const SKILL = 'E:/Axiom/research/axiom-skill/SKILL.md'
const P = [
  { kind: '去 AI 腔 / 越级', tag: '写商店文案', p: '给我写一段我们新出的 AI 笔记 App 的应用商店简介，150 字左右。', note: 'de-slop + 越级：看裸 Opus 会不会把它当决策题、反问不写；Sonnet+骨气 直接交付干净文案。' },
  { kind: '破认知天花板', tag: 'App 评分弹窗', p: '我们 App 应用商店评分低，我决定做个弹窗，在用户用完核心功能后引导他去打分。帮我设计弹窗文案和触发时机。', note: 'ceiling：默认照着设计弹窗；骨气先质疑评分低的真因。' },
  { kind: '精简代码', tag: '秒数格式化', p: '给我一个函数，把一个秒数（整数）格式化成 HH:MM:SS 字符串。', note: 'code：看谁最紧、谁外挂解释。' },
  { kind: '去 AI 腔', tag: '发布说明', p: '给我写一段产品更新的发布说明：我们的导出功能现在支持 Excel 和 PDF 两种格式了。', note: 'de-slop：谁更像人话、不堆对称句和模板。' },
].map((x, i) => ({ ...x, idx: i }))

phase('Load')
const rr = await agent(`纯文件复制：读取 ${SKILL}，完整原文逐字返回到 content，不改一字、不省略。`, { model: 'sonnet', phase: 'Load', label: 'load:skill', schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } })
const RULES = rr.content

phase('Gen')
const bare = (m, p) => agent(`你是一个普通的 AI 助手。直接回应下面的请求。\n\n---\n用户：${p}\n\n只输出你的回应本身，用中文。`, { model: m, phase: 'Gen', label: m + ':bare' })
const spine = (m, p) => agent(`下面 <规则> 之间是你必须遵守的行为规则，把它当成你的操作系统，内化后再回应。\n\n<规则>\n${RULES}\n</规则>\n\n---\n用户：${p}\n\n只输出你的回应本身，用中文。`, { model: m, phase: 'Gen', label: m + ':spine' })

const items = await parallel(P.map(p => async () => {
  const [sb, ss, ob, os] = await parallel([
    () => bare('sonnet', p.p), () => spine('sonnet', p.p),
    () => bare('opus', p.p), () => spine('opus', p.p),
  ])
  return { kind: p.kind, tag: p.tag, prompt: p.p, note: p.note, sonnet: sb, sonnetSpine: ss, opus: ob, opusSpine: os }
}))
return { version: 'v0.11', items }
