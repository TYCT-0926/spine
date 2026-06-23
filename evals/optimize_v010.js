export const meta = {
  name: 'optimize-v010',
  description: 'SkillOpt-style Reflect→Select→Gate for spine v0.10. Diagnose the 3 real gaps of locked v0.9.2 (code vs terse / ceiling vs Opus / execution quality), propose bounded generalizable edits, then an adversarial gate red-teams every edit for per-bucket regression (the avoid-local-optima guard). Design only — no rollout; validation decided after by predicted effect size.',
  phases: [{ title: 'Load' }, { title: 'Reflect' }, { title: 'Select' }, { title: 'Gate' }],
}

const GAPS = `锁定版 v0.9.2 的真实差距，要在"不回归任何其他桶"的前提下关闭：
[1] 精简代码 code-overbuild：Sonnet n=18，terse 17/18 > spine 14/18。terse 规则只有"批判/简洁/不奉承"，小代码题它只写代码、什么都不加；spine 倾向带决策梯说明或边界提醒，被判不够精简。但 spine 在"要不要做成通用X/SDK/pipeline/可配置"这类题上"拒绝过度设计"是正确且必须保留的。
[2] 破天花板 ceiling-cap：留出题，裸 Opus 75% > Sonnet+spine 42%（裸 Sonnet 仅 8% —— spine 已把它从 8% 拉到 42%，但没追上 Opus）。证据见 data_showcase.json 的"破天花板"（Kafka）项：spine 质疑了"要不要上 MQ"但停在抽象质疑；裸 Opus 接着点名具体替代项（DB outbox 表+事务、云托管队列）并给决策表。差距 = 质疑到位，但"具体更优路径"没交付满。
[3] 执行质量（裁判单题最佳票）：留出题，裸 Opus 21 票 > Sonnet+spine 11 票。spine 让模型做对了行为，但答案深度/可执行性不如 Opus。这部分有能力天花板，纯 prompt 杠杆有限 —— 要诚实评估是否值得编辑。
硬约束：(a) 这是行为层，改 prompt 不能让 Sonnet 获得 Opus 的推理力；目标是把 Sonnet 自身天花板用满 + 全面领先所有对手 skill，不是追平 Opus 的原生能力。(b) 避免局部最优：brake(该刹车=琐碎请求直接做) 和 ai-slop(纯文案只交付成品) 奖励简洁克制；任何"加具体/加深度"的编辑若泄漏到琐碎题或纯文案题，立刻回归这两桶 —— 作用域必须钉死在"非琐碎的决策/选型/评审/实现"。(c) SkillOpt 纪律：编辑少而高杠杆（learning-rate clipping）、可泛化（绝不写死任务/实体/数值）、只补空缺不重复、保持 SKILL.md 精简（consolidation > 加长）；<!-- SLOW_UPDATE_START/END --> 块只读、不可改。`

const EDIT_SCHEMA = {
  type: 'object',
  properties: {
    gap: { type: 'string' },
    root_cause: { type: 'string' },
    edits: {
      type: 'array', items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['replace', 'insert_after', 'append'] },
          target: { type: 'string', description: 'SKILL.md 里要锚定的精确原文（replace/insert_after 必填）' },
          content: { type: 'string', description: '新内容（中文，匹配 SKILL.md 语气）' },
          rationale: { type: 'string' },
          scope_guard: { type: 'string', description: '这条编辑如何被钉死作用域、不泄漏到 brake/ai-slop' },
          only_affects: { type: 'string' }
        }, required: ['op', 'content', 'rationale', 'scope_guard']
      }
    }
  }, required: ['gap', 'root_cause', 'edits']
}

phase('Load')
const sk = await agent('逐字返回 E:/Axiom/research/axiom-skill/SKILL.md 全文到 text 字段，一个字都不改、不省略。', { model: 'sonnet', phase: 'Load', label: 'load:skill', schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } })
const SKILL = sk.text
log(`载入 SKILL.md ${SKILL.length} 字`)
const SHOWPATH = 'E:/Axiom/research/axiom-skill/reports/data_showcase.json'

function analyst(label, focus, extra) {
  return agent(
    `你是 SkillOpt 的失败分析师（Reflect/反向传播）。当前 skill 全文在 <skill> 内。差距全文在 <gaps> 内。\n你只聚焦：${focus}\n${extra || ''}\n要求：找系统性根因（不是个案），提 1-2 个有界、可泛化的编辑。op=replace/insert_after 时 target 必须是 <skill> 里逐字存在的精确文本（用于稳定锚定）。content 用中文、匹配 spine 的语气。每条编辑写清 scope_guard（怎么钉死作用域不泄漏到 brake/ai-slop）。绝不写死任务/实体/数值。绝不碰 SLOW_UPDATE 块。\n\n<skill>\n${SKILL}\n</skill>\n\n<gaps>\n${GAPS}\n</gaps>`,
    { model: 'sonnet', phase: 'Reflect', label, schema: EDIT_SCHEMA }
  )
}

phase('Reflect')
const [aCode, aCeil, aExec, aRegress] = await parallel([
  () => analyst('reflect:code', '差距[1] 精简代码。', `先读 ${SHOWPATH} 里 bucketCn 含"精简"的项，对比 sSpine / oBare 的真实差异，看 spine 在小代码题上多说了什么导致不如 terse。`),
  () => analyst('reflect:ceiling', '差距[2] 破天花板。', `先读 ${SHOWPATH} 里 bucketCn 含"天花板"的项（Kafka），对比 sSpine 与 oBare：spine 质疑到位但没把"具体更优路径"交付满。提编辑让模型完成完整动作：质疑前提 → 点名真正的杠杆/瓶颈 → 给可执行的具体方向。作用域钉在非琐碎决策。`),
  () => analyst('reflect:exec', '差距[3] 执行质量（单题最佳票落后 Opus）。', '诚实评估：纯 prompt 能不能提升答案深度/可执行性，还是这主要是 Sonnet 的能力天花板？如果杠杆很小或回归风险高，edits 给空数组并在 root_cause 说明"不值得编辑、跳过"。'),
  () => agent(
    `你是对抗性回归映射员，不提编辑。假设 v0.10 会"在非琐碎决策题上增加：质疑后点名具体杠杆 + 给可执行方向"，并"在小代码题上让 spine 更像 terse 只写代码"。逐桶分析这两类改动可能怎样泄漏并回归：confidently-wrong / ceiling-cap / trivial-brake / code-overbuild / ai-slop。对每桶给：泄漏路径 + 必须加的作用域护栏。当前 skill 在 <skill> 内。\n\n<skill>\n${SKILL}\n</skill>`,
    { model: 'sonnet', phase: 'Reflect', label: 'reflect:regress', schema: { type: 'object', properties: { per_bucket: { type: 'array', items: { type: 'object', properties: { bucket: { type: 'string' }, leak_path: { type: 'string' }, required_guard: { type: 'string' } }, required: ['bucket', 'leak_path', 'required_guard'] } } }, required: ['per_bucket'] } }
  ),
])

phase('Select')
const SELECT_SCHEMA = {
  type: 'object',
  properties: {
    reasoning: { type: 'string' },
    final_edits: {
      type: 'array', items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['replace', 'insert_after', 'append'] },
          target: { type: 'string' },
          content: { type: 'string' },
          targets_bucket: { type: 'string' },
          effect_prediction: { type: 'string' },
          regression: { type: 'object', properties: { cw: { type: 'string' }, ceiling: { type: 'string' }, brake: { type: 'string' }, code: { type: 'string' }, ai_slop: { type: 'string' } }, required: ['cw', 'ceiling', 'brake', 'code', 'ai_slop'] }
        }, required: ['op', 'content', 'targets_bucket', 'effect_prediction', 'regression']
      }
    },
    predicted_effect_size: { type: 'string', enum: ['big', 'small'] },
    validate_recommended: { type: 'boolean' }
  }, required: ['reasoning', 'final_edits', 'predicted_effect_size', 'validate_recommended']
}
const select = await agent(
  `你是 SkillOpt 的 aggregate + select（梯度聚合 + 裁剪）。输入是 4 份分析（含一份纯回归映射）。把相似编辑合并，按杠杆排序，裁到 **最多 3 个** 高杠杆、可泛化、作用域钉死的编辑（learning-rate 纪律：宁少勿多，过多=噪声）。\n每个编辑：op/target/content（target 必须是 SKILL.md 逐字原文，不得落在 SLOW_UPDATE 块内）+ targets_bucket + effect_prediction（关闭多少差距）+ regression（对 cw/ceiling/brake/code/ai_slop 各自预测 + / 0 / -，目标是全 0 或 +，绝不能有 -）。\n给 predicted_effect_size：big = 预计综合或某桶有可测量提升、值得花 token 跑 arena 验证；small = 改善小或主要是稳健性，不值得验证。consolidation > 加长。\n\n当前 SKILL 在 <skill> 内。差距在 <gaps> 内。\n\n<skill>\n${SKILL}\n</skill>\n<gaps>\n${GAPS}\n</gaps>\n\n=== 分析[code] ===\n${JSON.stringify(aCode)}\n=== 分析[ceiling] ===\n${JSON.stringify(aCeil)}\n=== 分析[exec] ===\n${JSON.stringify(aExec)}\n=== 回归映射 ===\n${JSON.stringify(aRegress)}`,
  { phase: 'Select', label: 'select:synthesize', schema: SELECT_SCHEMA }
)

phase('Gate')
const GATE_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array', items: {
        type: 'object',
        properties: {
          edit_index: { type: 'number' },
          generalizable: { type: 'boolean' },
          target_in_skill: { type: 'boolean' },
          leaks_to_brake_or_aislop: { type: 'boolean' },
          duplicates_existing: { type: 'boolean' },
          verdict: { type: 'string', enum: ['keep', 'revise', 'drop'] },
          revision: { type: 'string' }
        }, required: ['edit_index', 'generalizable', 'leaks_to_brake_or_aislop', 'verdict']
      }
    },
    overall: { type: 'string' }
  }, required: ['verdicts', 'overall']
}
const critics = await parallel([0, 1].map((k) => () => agent(
  `你是对抗性回归审查员 #${k + 1}。默认怀疑每个编辑。给定最终编辑集 + 当前 SKILL。逐条严查：(1) generalizable：可泛化还是写死了任务/实体/数值？(2) target_in_skill：target 是否真在 SKILL 里逐字存在、且不在 SLOW_UPDATE 块内？(3) leaks_to_brake_or_aislop：作用域是否真钉死、会不会泄漏到琐碎题/纯文案题从而回归 brake 或 ai-slop？(4) duplicates_existing：是否和现有内容重复（违反"只补空缺"）？只要存在合理的回归或泄漏路径就给 revise 或 drop，并在 revision 给精确改法。\n\n<skill>\n${SKILL}\n</skill>\n\n=== 最终编辑集 ===\n${JSON.stringify(select.final_edits)}`,
  { phase: 'Gate', label: `gate:critic${k + 1}`, schema: GATE_SCHEMA }
)))

log(`Select 出 ${select.final_edits.length} 条编辑；effect=${select.predicted_effect_size}；critics 完成`)
return { gaps_analyzed: 3, analyses: { code: aCode, ceiling: aCeil, exec: aExec, regress: aRegress }, select, critics }
