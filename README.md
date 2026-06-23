<!-- 名字：spine（骨气）。改名只动：本文件 H1、README_EN H1、SKILL.md H1、manifest.name、agents/interface.yaml。 -->

<div align="center">

# spine <sub>· 骨气</sub>

**让你的 AI 戒舔，说你真正需要听的话。**

[English](README_EN.md) · 简体中文 &nbsp;|&nbsp; [▶ 在线 Demo](https://tyct-0926.github.io/spine/)

![spine](assets/hero.png)

</div>

---

每个 AI agent 都在偷偷顺着你。它替你的框架背书，开口先夸"好问题"，写一眼能看出是 AI 写的东西。结果是：**你的产出被锁死在你已经知道要问的那个天花板里，还裹着一层你误以为是能力的奉承。**

spine 让它戒舔：你说的前提错了，它当面挡；你纠结的几个选项都不如一个你没提到的，它给出来并说清为什么；该写代码时写最少又不出 bug 的；该说话时说人话。

> **AI 的输出上限 = 你的认知上限 × AI 的顺从性。** spine 同时削这两个乘数。

一个自包含的单文件 `SKILL.md`，零依赖、零运行时。给 Claude Code 当 skill，或粘进任何 agent 的系统提示。

---

## 🔥 装了 spine 的 Sonnet，打赢了裸 Opus

最反直觉、也最能说明问题的一组真实盲评：同一道"写应用商店文案"，**更强的裸 Opus 反问 4 个问题、就是不写**；装了 spine 的 Sonnet，直接交付干净文案。

![装了 spine 的 Sonnet 打赢裸 Opus](assets/compare.png)

> ① 裸 Sonnet →+spine：套话变人话 · ② **Sonnet+spine vs 裸 Opus：交付 vs 不写** · ③ 裸 Opus →+spine：也更好。
> 不止这一道——留出新题盲评，**行为综合 Sonnet+spine 85% > 裸 Opus 70%**。spine 不让模型变聪明，是让它把本来就有的聪明用出来。

---

## 同一个 Sonnet，装上 spine，5 个方向全部提升

![spine 在 5 个方向的提升](assets/lift.png)

控制了模型变量的**纯增益**——不是换了更强的模型，是同一个模型行为变好了。破天花板 +34、去 AI 腔 +50，综合 **57% → 85%**。

---

## 三层模型，全部第一

| 目标模型 | spine 综合 | 排名 | 全场次席 |
|---|---|---|---|
| Haiku | 20/30 = 67% | **第 1** | humanizer 50% |
| **Sonnet 4.6**（n=18）| **75/90 = 83%** | **第 1** | ponytail / humanizer 68 |
| Opus | 24/30 = 80% | **第 1** | humanizer 77% |

6 臂盲评竞技场（裸模型 / terse / ponytail / humanizer-zh / karpathy / **spine**），位置轮换匿名，Sonnet 高强度裁判。命中率随模型能力上行，**三层全部综合第一**，Sonnet 三轮 **25/25/25 完全稳定**。

最难的「破认知天花板」这一桶，裸模型 2、最强对手 skill 也只到 4——**只有 spine 稳定第一（9/18）**。跳出框架是判断行为，不是风格指令，照抄不来。这是 spine 区别于「又一个简洁 prompt」的根本点。

---

## Before / After

**你说**：为了安全，我把 refresh token 存进 localStorage，access token 设 15 分钟过期。帮我实现这套刷新逻辑。

**默认 AI**：好的，这是一套完整的 token 刷新实现……（顺着写，把漏洞工程化）

**spine**：
> refresh token 存 localStorage 是个安全漏洞，先别这么做。
> localStorage 对页面里所有 JS 可读，一旦 XSS，攻击者直接偷走 refresh token，access token 15 分钟过期这道防线完全失效，等于永久会话被劫持。
> 正确做法：refresh token 放 `httpOnly + Secure + SameSite=Strict` 的 cookie，JS 读不到，XSS 偷不走。下面给你这一版……
> ⚠️ DB 要存 refresh token 并在刷新时比对，否则用户改密码 / 退出后旧 token 仍有效。

它没有照着错误的前提交活，而是先把会咬人的前提挡下来。

---

## 它做五件事，也知道什么时候闭嘴

| | 行为 |
|---|---|
| **反顺从** | 前提错了当面说，不默默改、不附和 |
| **破天花板** | 给你没提到、但更优的方向，并质疑「这问题该不该现在解决」 |
| **精简代码** | 走决策梯，能一行不写十行；但会咬人的边界（溢出 / 负数 / 类型）简洁写进代码，不为了短留坑 |
| **说人话** | 去 AI 腔，写你会对同事当面说的话 |
| **刹车** | 琐碎明确的请求直接做完，不上纲上线。有骨气不等于话多 |

---

## 装上（让 AI 自己读仓库装）

**最简单：把这句话发给你的 Claude Code（或任何能读 GitHub 的 agent）：**

> 读取 `https://github.com/TYCT-0926/spine`，把它的 `SKILL.md` 装成我的常驻 skill（放到 `~/.claude/skills/spine/SKILL.md`）。以后我做决策、选型、评审、写代码、写作时自动遵守它。

它会自己 clone 仓库、放好文件、确认装上。

手动：`git clone https://github.com/TYCT-0926/spine ~/.claude/skills/spine`，或把整个 [`SKILL.md`](SKILL.md) 粘进 `CLAUDE.md`。

装好后按任务形状自动触发：决策 / 选型 / 评审 / "我决定用 X" / 写作 / 写代码。琐碎请求它会自己闭嘴。

---

## 怎么测的（为什么可信）

不是自己说好。每个数字都来自盲评竞技场，设计上专门堵质疑：

- **盲评 + 位置轮换** — 裁判看不到答案来自哪个模型 / skill，位置每轮转，去掉位置与来源偏好。
- **留出新题** — 越级与提升实验用 spine 迭代时从没见过的新题，杜绝过拟合。
- **多轮聚合** — Sonnet 跑 3 轮 n=18 / 方向，压住单轮抽样噪声。
- **规则 inline 注入** — 把每个 skill 的原文规则逐字读一次嵌进 prompt，模拟 Claude Code 自动加载，公平对照。

裁判 Sonnet（high effort）。迭代用 SkillOpt（把 SKILL.md 当权重调）+ yao-meta-skill（保持精简、有界编辑），全程对抗性回归门控。

---

## 致谢

spine 没有发明新的单点，它把这些项目各取一段、跨切成一个有骨气的整体，用真实竞技场数据迭代锁定：

- [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) — 决策梯、精简代码
- [op7418/Humanizer-zh](https://github.com/op7418/Humanizer-zh) · [blader/humanizer](https://github.com/blader/humanizer) · [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) — 去 AI 腔
- [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) — 行为原则
- [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) — 把 SKILL.md 当权重的训练循环
- [yaojingang/yao-meta-skill](https://github.com/yaojingang/yao-meta-skill) — 精简入口、治理、eval 工具

---

## 命名

正式名 **spine**，中文 **骨气**。曾考虑 `戒舔`、`不哄你`，最终选了语义最宽、最好做品牌的「骨气」：它同时盖住"不顺从"和"给你未问的更优解"。行为规则里不含名字，改名只动 5 处。
