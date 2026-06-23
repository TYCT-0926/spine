export const meta = {
  name: 'audit-full',
  description: '全面设计审计（SkillOpt×yao）：深入 v0.10 SKILL.md 每个细节 + 全数据，5 个审计员逐切片找真净增益（高价值决策段 / 代码 / 克制簇 / 整体结构 / 借鉴对手），synthesizer 在 learning-rate 纪律下默认"不动"除非明显净正，2 critic 对抗门控逐桶查回归。目标：要么找到全面提升、要么诚实判定已近最优——避免为改而改的反向局部最优。',
  phases: [{ title: 'Load' }, { title: 'Audit' }, { title: 'Select' }, { title: 'Gate' }],
}

const DATA = `v0.10 当前已测位置（基于这些找真净增益，别凭空改）：
- Sonnet 6 臂 n=18：spine 综合 #1（71/90，领先次席 6 分）；逐桶 cw18 / ceiling6 / brake17 / code14 / ai-slop16（这是 v0.9.2 数；v0.10 已把 code 修到留出 100%、ceiling 留出 58→83%）。
- 能力曲线 spine 三层全 #1（Haiku67 / Sonnet79 / Opus80%）vs 5 个对手。
- 留出 vs 裸 Opus：Sonnet+spine 行为综合 85% > 裸 Opus 70%；但破天花板 42% < Opus75%、单题最佳票 Opus 赢——执行质量 / 原生推理是 Sonnet 的能力天花板，prompt 补不满，别在这虚耗。
- 代码稳健双轴 25→58%（已加"正确性不为短让路"底线）。
结论：v0.10 大概率已是 综合 #1 + 5 桶领先对手 + 稳健翻倍。本次只收真能再净提升的点；某一节已最优就明说"已最优、不动"。为改而改 = 反向局部最优。
对手可借鉴点（不许照搬膨胀）：terse=极致短、humanizer=去AI腔最狠、karpathy=行为原则清晰、ponytail=决策梯/精简代码。`

const EDIT = {
  type: 'object',
  properties: {
    op: { type: 'string', enum: ['replace', 'insert_after', 'append'] },
    target: { type: 'string', description: 'SKILL.md 逐字原文（replace/insert_after 必填，用于稳定锚定）' },
    content: { type: 'string' },
    rationale: { type: 'string' },
    scope_guard: { type: 'string' },
    regression_note: { type: 'string', description: '对 cw/ceiling/brake/code/ai-slop 各桶的影响预测' },
  }, required: ['op', 'content', 'rationale', 'scope_guard', 'regression_note']
}
const AUD = { type: 'object', properties: { area: { type: 'string' }, assessment: { type: 'string', enum: ['near-optimal', 'improvable'] }, findings: { type: 'string' }, edits: { type: 'array', items: EDIT } }, required: ['area', 'assessment', 'findings', 'edits'] }

phase('Load')
const sk = await agent('逐字返回 E:/Axiom/research/axiom-skill/SKILL.md 全文到 text，一个字不改、不省略。', { model: 'sonnet', phase: 'Load', label: 'load:skill', schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } })
const SKILL = sk.text
log(`v0.10 SKILL ${SKILL.length} 字`)

function auditor(label, area, focus) {
  return agent(
    `你是 SkillOpt×yao 的资深 skill 审计员。当前 v0.10 skill 全文在 <skill> 内，全局数据在 <data> 内。\n你只审：${area}\n${focus}\n纪律：(1) 这一节已最优就 assessment="near-optimal" 且 edits 空数组——不许为改而改。(2) 只有能明确净提升（且不回归任何其他桶）才提编辑，assessment="improvable"。(3) 编辑可泛化、不写死任务/实体/数值、只补空缺不重复、保持精简（yao：rigor>成本）；op=replace/insert_after 的 target 必须是 <skill> 逐字原文，绝不碰 <!-- SLOW_UPDATE --> 块。(4) 每条编辑写清 scope_guard + regression_note（逐桶 +/0/-，绝不能有 -）。\n\n<skill>\n${SKILL}\n</skill>\n\n<data>\n${DATA}\n</data>`,
    { model: 'sonnet', phase: 'Audit', label, schema: AUD }
  )
}

phase('Audit')
const audits = await parallel([
  () => auditor('audit:decision', '决策段（不奉承 / 前提错当面挡 / 问对问题+质疑后落地 / 最强反对 / 不给菜单）——这是 USP、最高杠杆也最高回归风险', '逐条看是否清晰、有无冲突/冗余、能否更准。重点：破天花板 42%（落后 Opus）还能不能用 prompt 再榨——但别把"质疑问题本身"软化成"在框架内多给选项"，那会反向毁掉 ceiling。'),
  () => auditor('audit:code', '写代码段（决策梯 + 决策梯内部检查 + 拒过度设计 + 正确性不为短让路 + fail loudly）', '精简与稳健的平衡是否最优？双轴测出"稳健 58%、有一处把 2 行写成 10 行的过度展开"。有没有一句能同时压住过度展开 + 提稳健、且不啰嗦的写法？'),
  () => auditor('audit:restraint', '克制簇（只输出答案本身 / 先看一眼琐碎直接做 / 说人话去AI腔）', '输出卫生、刹车、去AI腔是否够狠够清晰。brake/ai-slop 已接近满分，重点是有无措辞会让模型在边缘情况误判或泄漏过程；以及去AI腔能否再向 humanizer 看齐而不加长。'),
  () => auditor('audit:holistic', '整体结构 / 优先级 / 人格开场 / 不变核心（只读，别改 SLOW_UPDATE）/ 章节顺序 / 冗余与冲突', '通读全文：优先级排序是否最优？有没有两节互相打架？有没有重复？开场人格还能不能更精准地"长出"后面的规则？有没有一个被完全遗漏的行为维度（如：不确定时主动给验证路径、长任务的取舍透明）？'),
  () => auditor('audit:competitor', '借鉴对手的真实优势（不许照搬膨胀）', 'humanizer 去AI腔最狠、terse 极致短、karpathy 原则清晰、ponytail 决策梯。spine 在哪个维度还能从对手身上学到一招、用一句话内化进来、且不破坏现有结构？如果都已覆盖，就 near-optimal。'),
  () => auditor('audit:generality', '通用性——skill 为每个任务常驻加载，但只在 5 个桶(cw/ceiling/brake/code/ai-slop)上调过/测过。审它在"基准外"任务上会不会误伤（最高优先级）', '具体找：哪条规则在非基准任务（解释 / 教学 / 分析 / 头脑风暴 / 调试 / 规划 / 闲聊 / 总结 / 翻译）上可能 misfire？比如"前提错当面挡 / 最强反对 / 不奉承"会不会让"解释一下 X"变对抗、让协作头脑风暴变冷、让"帮我总结"变挑刺、让闲聊变审讯？现有规则其实已有"真没有更深一层才在选项里给判断""没硬伤就直说"等阀门——审它们够不够。若有缺口，提一句划定作用域的护栏：挑战只在真有判断分歧 / 真有错误前提时出，解释 / 教学 / 协作 / 闲聊保持有用与温度。'),
])

phase('Select')
const SEL = {
  type: 'object',
  properties: {
    reasoning: { type: 'string' },
    overall_verdict: { type: 'string', enum: ['v0.10-near-optimal', 'improvements-found'] },
    final_edits: { type: 'array', items: { type: 'object', properties: { op: { type: 'string', enum: ['replace', 'insert_after', 'append'] }, target: { type: 'string' }, content: { type: 'string' }, targets: { type: 'string' }, effect: { type: 'string' }, regression: { type: 'object', properties: { cw: { type: 'string' }, ceiling: { type: 'string' }, brake: { type: 'string' }, code: { type: 'string' }, ai_slop: { type: 'string' } }, required: ['cw', 'ceiling', 'brake', 'code', 'ai_slop'] } }, required: ['op', 'content', 'targets', 'effect', 'regression'] } },
    predicted_effect_size: { type: 'string', enum: ['big', 'small', 'none'] }
  }, required: ['reasoning', 'overall_verdict', 'final_edits', 'predicted_effect_size']
}
const select = await agent(
  `你是 SkillOpt 的 aggregate+select（梯度聚合+裁剪），但带强烈的反局部最优偏置。输入 5 份审计。\n规则：(1) **默认不动**——v0.10 已综合 #1、5 桶领先对手、稳健翻倍；任何编辑都有回归风险。只有当某条编辑能明确净提升、且逐桶回归全 0/+ 时才纳入。(2) learning-rate：最多 3 条，宁缺毋滥。(3) 若所有审计都 near-optimal 或所有提案都达不到"明确净正"的门槛，就 overall_verdict="v0.10-near-optimal"、final_edits 空、effect_size="none"——这是诚实的最优判定，不是失败。(4) 纳入的编辑必须 target 逐字命中 SKILL、不碰 SLOW_UPDATE、可泛化。(5) **通用性优先**：skill 常驻加载于所有任务类型；任何编辑都不能让它在基准外任务（解释/教学/分析/头脑风暴/调试/规划/闲聊/总结）上误伤或变对抗。若 audit:generality 发现真实护栏缺口，那是最高优先级的净增益——它提升真实通用性，比刷某个桶的分更有价值。\n\n<skill>\n${SKILL}\n</skill>\n<data>\n${DATA}\n</data>\n\n${audits.map((a, i) => `=== 审计${i + 1} [${a.area}] ${a.assessment} ===\n${JSON.stringify(a)}`).join('\n')}`,
  { phase: 'Select', label: 'select', schema: SEL }
)

phase('Gate')
let critics = []
if (select.final_edits.length) {
  const GATE = { type: 'object', properties: { verdicts: { type: 'array', items: { type: 'object', properties: { edit_index: { type: 'number' }, generalizable: { type: 'boolean' }, target_in_skill: { type: 'boolean' }, regresses_any_bucket: { type: 'boolean' }, duplicates: { type: 'boolean' }, beats_doing_nothing: { type: 'boolean' }, verdict: { type: 'string', enum: ['keep', 'revise', 'drop'] }, revision: { type: 'string' } }, required: ['edit_index', 'regresses_any_bucket', 'beats_doing_nothing', 'verdict'] } }, overall: { type: 'string' } }, required: ['verdicts', 'overall'] }
  critics = await parallel([0, 1].map((k) => () => agent(
    `你是对抗性回归审查员 #${k + 1}，默认怀疑、默认保留现状。v0.10 已是强基线，任何改动要先证明"明显好过不改"。逐条查：generalizable？target 逐字在 SKILL 且不在 SLOW_UPDATE？regresses_any_bucket（cw/ceiling/brake/code/ai-slop 任一、或基准外任务如解释/头脑风暴/闲聊/总结可能变差或变对抗，就 true）？duplicates 现有内容？beats_doing_nothing（净增益是否大到值得冒回归风险）？只要回归路径合理或增益不明显就 drop/revise。\n\n<skill>\n${SKILL}\n</skill>\n\n=== 候选编辑 ===\n${JSON.stringify(select.final_edits)}`,
    { phase: 'Gate', label: `gate:critic${k + 1}`, schema: GATE }
  )))
}

log(`审计完成：verdict=${select.overall_verdict}，候选编辑 ${select.final_edits.length} 条，effect=${select.predicted_effect_size}`)
return { audits, select, critics, near_optimal: select.overall_verdict === 'v0.10-near-optimal' }
