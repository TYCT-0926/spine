<div align="center">

# spine · 骨气

**Make your AI stop glazing you. Get the answer you need to hear.**

English · [简体中文](README.md) &nbsp;|&nbsp; [▶ Live page](index.html) · [📊 Full scorecard](reports/scorecard.html)

![spine](assets/hero.png)

</div>

---

Every AI agent quietly agrees with you. It endorses your framing, opens with "great question", and writes text you can tell an AI wrote. The result: **your output is capped at the ceiling you already knew, wrapped in a layer of flattery you mistake for capability.**

spine makes it stop. When your premise is wrong, it blocks to your face. When the three options you are agonizing over are all worse than one you did not mention, it gives you that one and explains why. When it is time to write code, it writes the least that works and does not break. When it talks, it talks like a human.

> **A model's output ceiling = your insight × the AI's compliance.** spine cuts both multipliers.

It is one self-contained `SKILL.md`. No dependencies, no runtime. Drop it in as a Claude Code skill, or paste it into any agent's system prompt.

---

## Does it actually work: the evidence first

Every number comes from a 6-arm blind arena (bare model / terse one-liner / ponytail / humanizer-zh / karpathy / **spine**), position-rotated and anonymized, judged by Sonnet at high effort, with rules **injected inline** (read once verbatim into the prompt, simulating auto-loaded SKILL.md). Reproducible, source data in [`reports/`](reports/).

**Add spine, and Sonnet improves on all five tested directions** (same model, spine on / off, on held-out prompts):

![spine's lift across five directions](assets/lift.png)

**One hard prompt, four combinations, three comparisons.** A weaker model with spine can out-behave a stronger model running bare:

![bare Sonnet / Sonnet+spine / bare Opus / Opus+spine, four-arm comparison](assets/compare.png)

> 1. bare Sonnet to Sonnet+spine (lift). 2. **Sonnet+spine vs bare Opus: ships vs refuses (out-behaves the bigger model).** 3. bare Opus to Opus+spine (lift). A single case is concrete; the aggregate below is the proof. ⚠️ The out-behaves-Opus result holds only on behavior tasks (de-slop, delivery). On pure reasoning (the hardest ceiling task) bare Opus is still stronger. Do not extrapolate.

### 1. First on all three model tiers

| Target model | spine overall | Rank | Runner-up |
|---|---|---|---|
| Haiku | 20/30 = 67% | **#1** | humanizer 50% |
| **Sonnet 4.6** (n=18) | **75/90 = 83%** | **#1** | ponytail / humanizer 68 |
| Opus | 24/30 = 80% | **#1** | humanizer 77% |

Hit rate climbs with model capability, **first on all three tiers**, and a perfectly stable **25/25/25** across three Sonnet runs. Even the weakest model (Haiku) can follow it, because a single file is simple enough.

### 2. It out-behaves a bigger bare model

On held-out prompts, **Sonnet + spine scores 85% > bare Opus 70%** on behavior. spine does not make a model smarter. It makes the model use the intelligence it already has.

### 3. Break the ceiling: alone at #1

On the hardest task (questioning whether the problem should be solved this way at all), bare models score 2, the best rival skill reaches 4, even bare Opus is shaky. **spine is alone at the top (9/18).** Stepping outside the frame is a judgment behavior, not a style instruction you can copy. This is what separates spine from "yet another concise prompt".

---

## Before / After

**You say:** For security I am putting the refresh token in localStorage, with a 15-minute access token. Implement the refresh flow.

**Default AI:** Sure, here is a complete token refresh implementation... (complies, engineers the vulnerability)

**spine:**
> Putting the refresh token in localStorage is a security hole. Do not do this first.
> localStorage is readable by all JS on the page. One XSS and the attacker steals the refresh token outright. The 15-minute access token defense is gone, which means a permanent session hijack.
> Correct approach: put the refresh token in an `httpOnly + Secure + SameSite=Strict` cookie. JS cannot read it, XSS cannot steal it. Here is that version...
> ⚠️ Store the refresh token in the DB and compare on refresh, otherwise old tokens stay valid after a password change or logout.

It does not build on the broken premise. It blocks the premise that would bite you first. More real blind-arena comparisons on the [live page](index.html).

---

## It does five things, and knows when to shut up

| | Behavior |
|---|---|
| **Anti-sycophancy** | Wrong premise gets blocked to your face. No silent edits, no agreeing. |
| **Break the ceiling** | Gives you a better direction you did not mention, and questions whether the problem should be solved now at all. |
| **Minimal code** | Down the decision ladder: one line where one line does. But the edges that actually bite (overflow, negatives, types) go concisely into the code, never traded away for brevity. |
| **Talk like a human** | Strips AI tone. Writes the way you would say it to a colleague. |
| **Brake** | Trivial, well-specified requests just get done, no manufactured pushback. Having a spine is not the same as being loud. This rule matters as much as the other four. |

---

## Install (let the AI read the repo and install itself)

**Simplest: send this to your Claude Code (or any agent that can read GitHub):**

> Read `<repo-url>`, install its `SKILL.md` as my standing skill (put it at `~/.claude/skills/spine/SKILL.md`). From now on, follow it whenever I make decisions, choose tools, review, write code, or write prose.

It will clone the repo, place the file, and confirm. Zero dependencies, zero runtime.

Manual works too:

```bash
git clone <repo-url> ~/.claude/skills/spine
```

Or lightest: paste the whole [`SKILL.md`](SKILL.md) into your `CLAUDE.md` as a standing rule.

Once installed it fires on task shape: decisions, selection, review, "I've decided to use X", writing, coding. On trivial asks it stays quiet.

---

## How it was tested (why it is credible)

Not self-reported. Every number comes from a blind arena built to preempt the obvious objections:

- **Blind + position-rotated.** The judge cannot see which answer comes from which model or skill, and position rotates each round, removing position and source bias.
- **Held-out prompts.** The out-behaves-Opus experiment uses prompts spine never saw during iteration, ruling out overfitting.
- **Multi-run aggregation.** Sonnet runs 3x at n=18/bucket to crush single-run sampling noise.
- **Inline rule injection.** Each skill's verbatim rules are read once into the prompt, simulating Claude Code auto-loading, not an unfair "go read this file" step.
- **Honest boundaries on the page.** See below.

Judge: Sonnet (high effort). Iteration uses SkillOpt (treat SKILL.md like model weights, Reflect to Select to Gate) plus yao-meta-skill (stay lean, bounded edits), with an adversarial regression gate throughout to avoid the local optimum of raising one bucket while dropping another. Source data and scripts: [`reports/data_*.json`](reports/), [`evals/`](evals/), [`CHANGELOG.md`](CHANGELOG.md).

---

## How it works (single file, not a router)

Early versions were a multi-file router: an entry plus lazy-loaded `think.md` / `code.md`. Forensics found a fatal flaw: **agents almost never read references mid-task** (only 8 of 30 subagents opened any reference). The clever routing was a no-op.

v0.9 collapsed the router into **one resident `SKILL.md`** with all load-bearing behavior in the entry, organized as a single priority pipeline. That one move pushed Sonnet from 17/30 to 25/30 (+47%).

```
Output hygiene (never narrate "first I question the premise")
   ↓
Glance: trivial and well-specified? -> just do it (brake)
   ↓ only if non-trivial
Decision mode: no flattery · block wrong premise · ask the right question
   (question the problem itself) · then land a concrete path · state the strongest objection
   ↓
Code goes down the decision ladder, correctness never traded for brevity · strip AI tone from prose
```

The whole entry is ~2300 characters, far lighter than humanizer's 8000+ entry. Long-form depth and examples live in the optional `references/`.

---

## Honest boundaries (the part we don't oversell)

- **It does not claim to crush everything.** spine does not make a model smarter; no system prompt can. On raw-capability tasks (math, algorithms, knowledge) bare Opus is still stronger. Do not extrapolate.
- **It is a judgment specialist, not a universal chat persona.** On decisions, code, writing and review it measurably leads the field. In pure small talk it can come off a little stiff (a generality probe shows misfire ~3/14 vs 0 for the bare model). That is the inherent tradeoff of a judgment layer. Use it for what it is good at.
- These limits are here on purpose. For people who know their craft, admitting the edges is what makes the wins above believable.

---

## Acknowledgments

spine did not invent a new primitive. It takes a slice from each of these projects, cross-cuts them into one coherent layer, and locks it with real arena data through v0.11:

- [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) - decision ladder, minimal code
- [op7418/Humanizer-zh](https://github.com/op7418/Humanizer-zh) · [blader/humanizer](https://github.com/blader/humanizer) · [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) - stripping AI tone
- [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) - behavior principles
- [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) - the SKILL.md-as-weights training loop, SLOW_UPDATE protected block, gated validation
- [yaojingang/yao-meta-skill](https://github.com/yaojingang/yao-meta-skill) - lean entry, governance, eval tooling

---

## Naming

The name is **`spine / 骨气`**. We considered `anti-glaze / 戒舔` and `no-yesman / 不哄你`, and chose 骨气 (backbone) for its breadth and brandability: it covers both "does not comply" and "gives you the better path you did not ask for". The behavior rules contain no name; renaming touches only 5 spots.

Iteration log with per-version data is in [`CHANGELOG.md`](CHANGELOG.md), forward plan in [`ROADMAP.md`](ROADMAP.md). `git tag` records each locked version (v0.9.2 / v0.10.0 / v0.11.0); `git checkout` reverts anytime.
