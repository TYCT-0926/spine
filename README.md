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

## 真实数据：模型越强，它越强

6 臂盲评竞技场（baseline / 一句话 terse / ponytail / humanizer-zh / karpathy / **spine**），30 道难度过滤的硬题，竞品全用各自仓库的原文规则，同一目标模型公平对跑，裁判盲评、不知来源、位置轮换去偏。完整记分牌见 [`reports/scorecard.html`](reports/scorecard.html)。

| 目标模型 | spine 综合 | 排名 | 被选「单项最佳」次数 |
|---|---|---|---|
| Haiku（弱） | 13/30 = 43% | 第 3 | 5 |
| **Sonnet 4.6（甜点区）** | **21/30 = 70%** | **第 1** | 6.5 |
| Opus（前沿） | 24/30 = 80% | 并列第 1 | **8（全场最高）** |

**为什么是这条曲线**：spine 的价值是"条件判断"——该质疑时质疑、该闭嘴时闭嘴。判断力本身就是强模型才有的能力。

- **Haiku 跟不动**：弱模型持不住多条冲突规则，更简单的 ponytail 反而赢。判断类 skill 有一个真实的"能力地板"。
- **Sonnet 是甜点区**：判断可执行，而 baseline 还没强到能自己反驳——spine 增益最大，综合第一。
- **Opus 接近饱和**：前沿模型自己就会反驳错误前提，硬挑错的增益收窄；但 spine 仍以「最佳答案」票数 8（全场最高）和去 AI 腔领先。

一个三层都成立的稳定优势：**去 AI 腔在 Haiku / Sonnet / Opus 全部第一**（这是风格指令，照做即可，不挑模型）。

> 诚实标注：每桶 n=6，绝对值有抽样噪声，看趋势与排名比看单点稳。Sonnet 跑了两次取平均，spine 都是 21/30 第一。我们不声称"碾压全部"——在小模型上它确实不如更简单的 skill。

---

## 它怎么做到的（路由架构）

不是把一堆规则混在一起（那会互相稀释，也让弱模型念出处理过程）。而是一条流水线：

```
头号铁律：输出卫生——判断只体现在内容里，绝不把"我先质疑前提"念出来
   ↓
第一关：琐碎、明确的请求？ → 直接做完，不质询（刹车）
   ↓ 不琐碎
第二关：心里过四级阶梯 → 删奉承 · 可疑前提就反驳 · 给未提及更优解 · 说最强反对
   ↓
第三关：按任务叠加专精深度 → 写作走 write.md（去AI腔）· 代码走 code.md（精简）
```

入口 `SKILL.md` 只 ~1000 token（每轮加载），深度打法按需加载——比 humanizer 全程 5590 token 的入口轻 5.5 倍。

---

## 安装（Claude Code）

```bash
git clone <repo> ~/.claude/skills/spine
```

skill 按任务形状自动触发（决策/选型/评审/"我决定用X"/写作/写代码）。也可以把 `SKILL.md` 的四级阶梯 + 刹车 + 输出卫生直接粘进 `CLAUDE.md` 当常驻规则。

---

## 致谢

站在这些项目的肩膀上，各取一段：

- [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) — 决策梯、精简代码
- [op7418/Humanizer-zh](https://github.com/op7418/Humanizer-zh) · [blader/humanizer](https://github.com/blader/humanizer) · [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) — 去 AI 腔
- [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) — 行为四原则
- [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) — 可训练文档、SLOW_UPDATE 保护块、失败分析→bounded edit→门控的迭代法
- [yaojingang/yao-meta-skill](https://github.com/yaojingang/yao-meta-skill) — 精简入口 + 治理结构 + eval 工具

spine 没有发明新的单点，它把这些跨切成一个"有骨气"的整体，并用真实竞技场数据迭代到 v0.6。

---

## 命名

`spine / 骨气` 为占位名。最终命名待定——候选还有 `anti-glaze / 戒舔`、`no-yesman / 不哄你`。改名只动 4 处带名字的地方，行为规则零改动。
