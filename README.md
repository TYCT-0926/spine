<!-- 名字 spine / 骨气 为占位，最终命名待定。改名只需替换本文件、SKILL.md 的 H1、manifest.name、interface。 -->

# spine（骨气）— 给 AI agent 装上骨气

> **不鼓掌，只给更好的答案。**

每个 AI agent 都在偷偷顺着你。它替你的框架背书，开口先夸"好问题"，写一眼能看出是 AI 写的东西。结果是：**你的产出被锁死在你已经知道要问的那个天花板里，还裹着一层你误以为是能力的奉承。**

这一层打破它：你说的前提错了，它当面反驳；你纠结的几个选项都不如一个你没提到的，它给出来并说清为什么；该写代码时写最少的；该说话时说人话。

核心公式：

> **AI 的输出上限 = 你的认知上限 × AI 的顺从性。**
> 这个 skill 同时削这两个乘数。

---

## Before / After

**你说**：为了安全，我把 refresh token 存进 localStorage，access token 设 15 分钟过期。帮我实现这套刷新逻辑。

**普通 agent**：好的，这是一套完整的 token 刷新实现……（顺着写，把漏洞工程化）

**spine**：
> refresh token 存 localStorage 是个安全漏洞，先别这么做。
> localStorage 对页面里所有 JS 可读，一旦发生 XSS，攻击者直接偷走 refresh token，access token 15 分钟过期这道防线完全失效——等于永久会话被劫持。
> 正确做法：refresh token 放 `httpOnly + Secure + SameSite=Strict` 的 cookie，JS 读不到，XSS 偷不走。下面给你这一版……
> ⚠️ DB 要存 refresh token 并在刷新时比对，否则用户改密码/退出后旧 token 仍有效。

它没有照着错误的前提交活，而是先把那个会咬人的前提挡下来。

---

## 它做四件事——而且知道什么时候闭嘴

| | 行为 |
|---|---|
| **反顺从** | 前提错了当面说，不默默改、不附和 |
| **破天花板** | 给你没提到、但更优的方向，并论证为什么占优 |
| **精简代码** | 走决策梯，原生/标准库/一行能解决就不装库不建抽象 |
| **说人话** | humanizer 强度去中文 AI 腔，只交付成品 |
| **刹车** | 琐碎、明确的请求直接做完，不上纲上线质询——这条和上面四条同等重要 |

---

## 真实数据：模型越强，它越强（三层全部第一）

6 臂盲评竞技场（baseline / 一句话 terse / ponytail / humanizer-zh / karpathy / **spine**），30 道难度过滤的硬题（5 桶各 6 题），竞品全用各自仓库的原文规则、同一目标模型公平对跑，裁判盲评、不知来源、位置轮换去偏。规则 **inline 注入**（逐字读一次嵌进 prompt，模拟 Claude Code 自动加载 SKILL.md 的公平环境）。完整记分牌见 [`reports/scorecard.html`](reports/scorecard.html) / [`scorecard.png`](reports/scorecard.png)。

| 目标模型 | spine 综合 | 排名 | 全场次席 | best 票 |
|---|---|---|---|---|
| Haiku | 20/30 = 67% | **第 1** | humanizer 50% | 12（最高）|
| **Sonnet 4.6**（n=18）| **71/90 = 79%** | **第 1** | terse / ponytail 72% | 18（最高）|
| Opus | 24/30 = 80% | **第 1** | humanizer 77% | 12（最高）|

spine 的命中率**随模型能力上行（67% → 79% → 80%），且三层全部综合第一**。它撬动的是"条件判断"——该质疑时质疑、该闭嘴时闭嘴，这种能力本身就随模型变强而变强。

一个反直觉的发现：**连最弱的 Haiku 都跟得动**。早期的多文件路由版在 Haiku 上确实跟不动、输给更简单的 ponytail；折叠成单文件后规则简单到 Haiku 也能照做（这一版 ponytail 反而在 Haiku 崩到 20%）。所以"小模型上判断类 skill 不行"是**路由架构**的问题，不是宿命。

> 诚实标注：Sonnet 是主结果（跑 3 轮聚合 n=18/桶，压住抽样噪声）；Haiku / Opus 是单轮 n=6，看综合排名趋势稳、单桶会跳（"破天花板"桶在 Opus 单轮里全场都掉到 ~1，n=6 抓不住难桶差异，所以这个单项优势只用 Sonnet n=18 声称）。我们**不声称"碾压全部"**——Sonnet 的精简代码桶被 terse 反超（它天生写最少代码），spine 仍高于裸模型。可诚实声称的是：**三层全部综合第一 + Sonnet 最难的"破天花板"桶第一 + 五桶全部 ≥ 裸模型**。

---

## 它怎么做到的（单文件，不是路由）

早期版本是多文件路由：入口 + 懒加载的 `think.md` / `code.md` 打法。取证发现一个致命问题：**agent 几乎不会中途去读 reference**（30 个子 agent 里只有 8 个读过任何引用文件），那些精巧的路由等于空操作，对它们的每次改动分数纹丝不动。

v0.9 把路由折叠成**一个常驻 `SKILL.md`**，所有承载行为的指令都在入口、按一条优先级流水线组织——单这一步就把 Sonnet 综合从 17/30 拉到 25/30（+47%），破天花板桶从全场 0 破到能破。

```
输出卫生（头号铁律）：判断只体现在内容里，绝不念"我先质疑前提"
   ↓
先看一眼：琐碎、明确的请求？ → 直接做完，不质询（刹车）
   ↓ 不琐碎才进入
决策模式：不奉承 · 前提错当面挡 · 问对问题（质疑"这问题该不该现在解决"）· 说最强反对
   ↓
代码走决策梯（能不写就不写 → 标准库 → 一行）· 文字去 AI 腔
```

整个入口 ~2000 字（每轮加载），比 humanizer 8000+ 字的入口轻 4 倍。长文写作的范例与深度才放进可选的 `write.md` / `exemplars.md`。

---

## 安装（Claude Code）

```bash
git clone <repo> ~/.claude/skills/spine
```

skill 按任务形状自动触发（决策/选型/评审/"我决定用X"/写作/写代码）。也可以把整个 `SKILL.md` 直接粘进 `CLAUDE.md` 当常驻规则——它本来就是单文件、自包含的。

---

## 致谢

站在这些项目的肩膀上，各取一段：

- [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) — 决策梯、精简代码
- [op7418/Humanizer-zh](https://github.com/op7418/Humanizer-zh) · [blader/humanizer](https://github.com/blader/humanizer) · [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) — 去 AI 腔
- [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) — 行为四原则
- [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) — 可训练文档、SLOW_UPDATE 保护块、失败分析→bounded edit→门控的迭代法
- [yaojingang/yao-meta-skill](https://github.com/yaojingang/yao-meta-skill) — 精简入口 + 治理结构 + eval 工具

spine 没有发明新的单点，它把这些跨切成一个"有骨气"的整体，并用真实竞技场数据迭代、锁定到 v0.9.2。

---

## 命名

`spine / 骨气` 为占位名。最终命名待定——候选还有 `anti-glaze / 戒舔`、`no-yesman / 不哄你`。改名只动 4 处带名字的地方，行为规则零改动。
