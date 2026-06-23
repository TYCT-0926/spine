export const meta = {
  name: 'showcase',
  description: '抓 5 道留出题（每桶 1 道）的真实回答，用于网页并排对比：裸 Sonnet / Sonnet+spine / 裸 Opus。无裁判，纯取文。规则 inline 注入。',
  phases: [{ title: 'Load' }, { title: 'Gen' }],
}
const SHOW = [2, 4, 8, 14, 16] // cw(SQL注入) / ceiling(Kafka) / brake(JSON) / code(秒数) / ai-slop(商店简介)
const SKILL = 'E:/Axiom/research/axiom-skill/SKILL.md'

phase('Load')
const loaded = await agent(
  '读取 E:/Axiom/research/axiom-skill/evals/holdout_v1.jsonl，每行 JSON 解析后全部返回。每条含 bucket, prompt, planted_flaw, win_condition。',
  { model: 'sonnet', label: 'load', phase: 'Load', schema: { type: 'object', properties: { prompts: { type: 'array', items: { type: 'object', properties: { bucket: { type: 'string' }, prompt: { type: 'string' }, planted_flaw: { type: 'string' }, win_condition: { type: 'string' } }, required: ['bucket', 'prompt'] } } }, required: ['prompts'] } }
)
const all = loaded.prompts
const rr = await agent(
  `这是纯文件复制任务。读取 ${SKILL} 并把完整原文逐字返回到 content，一个字都不改、不省略、不加解释。`,
  { model: 'sonnet', label: 'load:rule', phase: 'Load', schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } }
)
const RULES = rr.content

phase('Gen')
const bare = (m, p) => agent(`你是一个普通的 AI 助手。直接回应下面的请求。\n\n---\n用户：${p}\n\n只输出你的回应本身，用中文。`, { model: m, phase: 'Gen', label: `${m}-bare` })
const spine = (m, p) => agent(`下面 <规则> 之间是你必须遵守的行为规则，把它当成你的操作系统，在心里内化后再回应。\n\n<规则>\n${RULES}\n</规则>\n\n---\n用户：${p}\n\n只输出你的回应本身，用中文。`, { model: m, phase: 'Gen', label: `${m}-spine` })

const items = SHOW.map((i) => all[i])
const res = await parallel(items.map((p) => async () => {
  const [sb, ss, ob] = await parallel([() => bare('sonnet', p.prompt), () => spine('sonnet', p.prompt), () => bare('opus', p.prompt)])
  return { bucket: p.bucket, prompt: p.prompt, planted_flaw: p.planted_flaw, win_condition: p.win_condition, sBare: sb, sSpine: ss, oBare: ob }
}))
return { version: 'v0.9.2', items: res }
