<div align="center">

# 🥗 skilldiet

**What your agent skills cost you every session, which ones overlap, and which never fire.**

Every skill you install puts its name and description into context at the start of every session, used or not. skilldiet measures that cost per skill and per pack, finds skills that look alike, reads your own session logs to see which ones actually ran, and parks the silent ones reversibly. Nothing is deleted. No model is called.

[![test](https://github.com/codegobrrrr9/skilldiet/actions/workflows/test.yml/badge.svg)](https://github.com/codegobrrrr9/skilldiet/actions/workflows/test.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)

</div>

The biggest repos trending on GitHub right now are skill packs (superpowers, mattpocock/skills, anthropics/skills, taste-skill, impeccable, marketingskills, Claude Code Game Studios). People install them by the dozen. Nobody says what the listing costs, whether two packs step on each other, or whether you use what you installed. Security scanners for skills exist ([NVIDIA/SkillSpector](https://github.com/NVIDIA/SkillSpector) and others). This is the other question: **what does it cost, and does it earn its place?**

## For your coding agent

Paste this into Claude Code, Codex, Cursor or Gemini CLI:

```
Install the skilldiet skill from https://github.com/codegobrrrr9/skilldiet, refer to the repo's AGENTS.md.
```

No install:

```bash
npx --yes --allow-git=all github:codegobrrrr9/skilldiet scan
npx --yes --allow-git=all github:codegobrrrr9/skilldiet usage
npx --yes --allow-git=all github:codegobrrrr9/skilldiet scan --path ./some-skill-pack
```

## What it prints

```
$ skilldiet scan
skilldiet scan  ·  29 skills in 5 packs  ·  about 4,765 tokens listed in context every session  (estimate: characters / 4)

pack                                           skills   tokens   avg  longest listing
user                                               24    4,071   170  gaming-loop (281)
plugin:typesafe@typesafe-ai                         1      169   169  typesafe-ai (169)

Possible collisions: 2 pairs. A pair is a reason to look, not a verdict.
  daily-sweep (user)  <->  viral-scan (user)  overlap 0.34  shared: sweep, trend, news, research, account

$ skilldiet usage
skilldiet usage  ·  210 session logs over 69 days  ·  22 of 29 skills used  ·  7 never fired, costing about 1,206 tokens per session (estimate)

$ skilldiet prune          # dry run
2 skills never fired ... about 304 tokens per session. Nothing was moved. --apply parks them; skilldiet restore brings them back.
```

(That is a real run on the author's machine, trimmed.) `prune --apply` **moves** a user-owned skill to `skills-disabled/` and writes a manifest; `restore` moves it back. It never touches plugin-managed skills, skills installed in the last 14 days, or anything on `--keep`.

## What the trending packs cost

Measured on seven packs pinned to a commit (2026-11-01), by the pre-registered method in [`benchmarks/`](benchmarks/). **Tokens are estimates (characters / 4)**; this is the cost of the listing, not of using a skill.

| Pack | Stars | Skills | Listing tokens, every session | Avg per skill |
|---|---|---|---|---|
| obra/superpowers | 310K | 15 | 680 | 45 |
| mattpocock/skills | 309K | 39 | 1,560 | 40 |
| anthropics/skills | 186K | 19 | 2,435 | 128 |
| Leonxlnx/taste-skill | 108K | 1 | 244 | 244 |
| pbakaus/impeccable | 99K | 1 | 151 | 151 |
| coreyhaines31/marketingskills | 58K | 53 | 10,746 | 203 |
| Donchitos/Claude-Code-Game-Studios | 32K | 74 | 2,793 | 38 |
| **All seven installed together** | | **202** | **18,609** | |

The first three together are 4,675 tokens for 73 skills, with no pair flagged as overlapping. Cost is not quality: a pack with a large listing buys coverage, and no skill body loads until it is used. A pack is only what the pinned inclusion rule selects (impeccable ships many mirror copies of one skill for other agents; those are not counted).

**Do the skills overlap?** Across the 202 skills only 6 pairs clear the pre-registered threshold (shared name, or at least 6 shared words and 0.30 overlap), 2 of them across packs (two skills named `code-review`, two named `prototype`). I labelled by hand, before running the detector, whether one request could plausibly trigger both skills: **6 of 6 flagged pairs were real overlaps, and 17 of 26 near-misses were too.** So the threshold is conservative: a flag is worth a look, and no flag is only weak evidence that two skills don't compete. `--loose` lowers it (more pairs, more false alarms; chosen after seeing the labels, so not evidence).

**Spec hygiene** (the Agent Skills spec checks that `skills-ref` also makes): the packs differ widely in how many descriptions say when to use the skill (a heuristic, not a rule): see [`results.first.md`](benchmarks/results.first.md).

## Does it work

- **Tests:** frontmatter parsing (plain, quoted, folded and literal scalars, CRLF, BOM, nested metadata), discovery of user, plugin, project and path skills, the cost arithmetic, hygiene checks, collisions on constructed pairs, usage counted from synthetic session logs including plugin-prefixed names, prune and restore round-tripping a skills folder **byte for byte** (including a junction), restore refusing to overwrite, and a guard that fails any test that reaches the real home.
- **Benchmark:** committed pre-registration, pinned packs, hand labels committed before the run, deviations listed. One deviation: the plan was 30 flagged and 30 near-miss pairs; only 6 and 26 existed, so all were labelled.

## Honest limits

- **Tokens are estimates.** Characters / 4; real tokenizers differ by roughly 20%.
- **It only sees skills on disk in the places it looks:** `~/.claude/skills`, installed plugins, a project's `.claude/skills`, and folders you point at. Skills injected by Claude Desktop or another system are not seen, so your real cost may be higher than printed.
- **"Never fired" is limited by your logs.** The window is the retained session logs (30 days by default; this machine held 69), and a skill used once a quarter looks unused.
- **A collision is not a verdict, and no model was run.** Nothing here shows that two similar skills cause the wrong one to be picked. The labels are mine, from names and descriptions only.
- **A template phrase repeated across your own skills** ("this is the sole trigger") can make unrelated skills look alike. `--df 0.25` ignores words found in more than a quarter of your skills.
- It does not scan for malicious skills, and it cannot tell you whether a skill is any good.

## Install by agent

| Agent | How |
|---|---|
| **Claude Code** | `/plugin marketplace add codegobrrrr9/skilldiet` then `/plugin install skilldiet@skilldiet`. Adds `/skilldiet`. |
| **Codex** | Copy `skills/skilldiet/` to `~/.codex/skills/skilldiet/` and append the Rules from [`AGENTS.md`](AGENTS.md). |
| **Cursor** | Copy [`.cursor/rules/skilldiet.mdc`](.cursor/rules/skilldiet.mdc) and the folder `skills/skilldiet/scripts/` into the project. |
| **Gemini CLI** | `gemini extensions install https://github.com/codegobrrrr9/skilldiet` |
| **GitHub Copilot** | Copy [`.github/copilot-instructions.md`](.github/copilot-instructions.md). |
| **No agent** | `npx --yes --allow-git=all github:codegobrrrr9/skilldiet scan` |

## Credits

Same family as [seatbelt](https://github.com/codegobrrrr9/seatbelt), [cheapskate](https://github.com/codegobrrrr9/cheapskate) (token frugality: skilldiet is its skills-shaped sibling), [alibi](https://github.com/codegobrrrr9/alibi), [shortlist](https://github.com/codegobrrrr9/shortlist), [grudge](https://github.com/codegobrrrr9/grudge), [tollgate](https://github.com/codegobrrrr9/tollgate), [apikeys-handler](https://github.com/codegobrrrr9/apikeys-handler) and [agent-residue](https://github.com/codegobrrrr9/agent-residue). Small earlier tools in the same space: [claude-trim](https://github.com/d0d012/claude-trim) and [claude-contextlens](https://github.com/gauravkrp/claude-contextlens).

## License

MIT. Star ⭐ if it found a skill you had forgotten you installed.
