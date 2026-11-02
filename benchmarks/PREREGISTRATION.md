# skilldiet benchmark: pre-registration

Written and committed **before** the packs were fetched and before any collision or cost number was computed on them. The order is in git history.

**Question.** What does it cost, in tokens, to have each of the skill packs trending on GitHub on 1 November 2026 loaded, how much does installing several
together cost, and how many of their skills look alike?

**Packs.** The seven in `packs.json`: obra/superpowers, mattpocock/skills, anthropics/skills, Leonxlnx/taste-skill, pbakaus/impeccable,
coreyhaines31/marketingskills, Donchitos/Claude-Code-Game-Studios, each pinned to a commit. A skill is a `SKILL.md` matching the `include` pattern and not the
`exclude` pattern in `packs.json`, so mirror copies for other agents, test workspaces and templates are not counted. Two skills with the same name in one pack count once.

**Cost metrics (deterministic).** Per skill, the listing line is `- <name>: <description>`: Claude Code puts a line like this in context for every skill, every
session. Tokens are **estimated as characters / 4**; real tokenizers differ by roughly 20%, so figures are for comparison, not billing. Per pack: skills, listing tokens,
average per skill, longest listing. Per combination: packs 1+2, 1+3, 2+3, 1+2+3, and all seven installed together: total listing tokens and the number of cross-pack
collisions. A skill's **body** loads only when it is used; its size is reported separately as "cost when used".

**Hygiene.** Count of skills failing each Agent Skills spec check: name not lowercase letters, digits and single hyphens, name over 64 characters, name differing from the
folder name, description over 1,024 characters, no frontmatter, and descriptions that say what a skill does but not when to use it (regex in `analyze.js`).

**Collision definition (fixed now).** Descriptions are lowercased, stop-words and generic verbs removed, words stemmed. Two skills collide when they share a name, or share
**at least 6 stems and a Jaccard overlap of at least 0.30** (`COLLISION_DEFAULTS` in `analyze.js`). This is a flag, not a verdict.

**Validating the collision detector (labels committed before the run).** From the union of all seven packs, a seeded sample (seed 20261101) of **30 flagged pairs** and
**30 near-misses** (not flagged, but at least 4 shared stems and Jaccard of at least 0.18). The author reads each pair's two names and descriptions and answers one question:
*could a single user request plausibly trigger both skills, or either in place of the other?* yes or no, written to `labels.jsonl` and committed before `run.js` is executed.
Reported: precision of the flagged pairs (yes out of 30) and the share of near-misses labelled yes (what the threshold misses).

**Not claimed.** That a pack is good or bad: a large listing buys coverage, and bodies cost nothing until used. That collisions cause wrong skill selection: that would need model
runs. That token estimates match a given model's tokenizer. The labels come from one person reading descriptions, the same person who wrote the detector.

**Tuning.** Anything changed after the first run is listed in `results.md` under "After the first run", and the first run's numbers stay the headline.
