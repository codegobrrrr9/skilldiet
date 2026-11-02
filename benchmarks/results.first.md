# skilldiet benchmark (first)

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md). 202 skills in 7 packs, pinned in `packs.json`. Tokens are **estimates** (characters / 4); this is the cost of the skill LISTING (name and description), paid every session. A skill's body loads only when it is used.

## Cost per pack

| Pack | Stars | Skills | Listing tokens | Avg per skill | Longest listing | Avg body when used |
|---|---|---|---|---|---|---|
| obra/superpowers | 310,572 | 15 | **680** | 45 | 101 (diagnosing-superpowers) | 2,291 |
| mattpocock/skills | 309,173 | 39 | **1,560** | 40 | 109 (code-review) | 1,081 |
| anthropics/skills | 186,317 | 19 | **2,435** | 128 | 271 (claude-api) | 3,672 |
| Leonxlnx/taste-skill | 107,684 | 1 | **244** | 244 | 244 (design-taste-frontend) | 9,620 |
| pbakaus/impeccable | 99,229 | 1 | **151** | 151 | 151 (impeccable) | 2,774 |
| coreyhaines31/marketingskills | 57,833 | 53 | **10,746** | 203 | 260 (marketing-plan) | 3,758 |
| Donchitos/Claude-Code-Game-Studios | 32,124 | 74 | **2,793** | 38 | 61 (propagate-design-change) | 3,305 |

## Installed together

| Packs | Skills | Listing tokens | Possible collisions | Across packs | Same name |
|---|---|---|---|---|---|
| obra-superpowers + mattpocock-skills | 54 | **2,240** | 0 | 0 | 0 |
| obra-superpowers + anthropics-skills | 34 | **3,115** | 0 | 0 | 0 |
| mattpocock-skills + anthropics-skills | 58 | **3,995** | 0 | 0 | 0 |
| obra-superpowers + mattpocock-skills + anthropics-skills | 73 | **4,675** | 0 | 0 | 0 |
| all seven | 202 | **18,609** | 6 | 2 | 2 |

## Hygiene (Agent Skills spec)

| Pack | Skills with any issue | Name rule | Description over 1,024 chars | Says what, not when | Body over ~5,000 tokens |
|---|---|---|---|---|---|
| obra/superpowers | 1 of 15 | 0 | 0 | 1 | 0 |
| mattpocock/skills | 24 of 39 | 0 | 0 | 24 | 0 |
| anthropics/skills | 5 of 19 | 0 | 1 | 3 | 2 |
| Leonxlnx/taste-skill | 1 of 1 | 1 | 0 | 0 | 1 |
| pbakaus/impeccable | 0 of 1 | 0 | 0 | 0 | 0 |
| coreyhaines31/marketingskills | 9 of 53 | 0 | 0 | 0 | 9 |
| Donchitos/Claude-Code-Game-Studios | 64 of 74 | 0 | 0 | 64 | 11 |

## Does the collision detector find real overlap?

Definition fixed before the run: shared name, or at least 6 shared stems and Jaccard >= 0.3. Labelled by hand, before the run: could one request plausibly trigger both skills, or either in place of the other?

| | Pairs | Judged a real overlap |
|---|---|---|
| Flagged by the detector | 6 | **6** (100%) |
| Near-misses (not flagged; at least 4 shared stems, Jaccard >= 0.18) | 26 | **17** (65.4%) |

Only 6 pairs across the 202 skills clear the threshold, so all of them were labelled, not the 30 planned. The threshold is conservative: most of the near-misses were judged real overlaps. Read the flagged list as pairs worth a look, and the absence of a flag as weak evidence of no overlap.

## Deviations from the pre-registration, and limits

- The plan was 30 flagged and 30 near-miss pairs. Only 6 pairs were flagged and 26 qualified as near-misses, so all of them were labelled.
- `packs.json` was committed with its `include` regex missing two backslashes (invalid JSON); it was fixed in a later commit, before any pack was fetched. The pattern is the same.
- A pack is only what the inclusion rule in `packs.json` selects. For `pbakaus/impeccable` that is one skill: the repository holds many copies of it for other agents and test workspaces, which are not counted. Pack sizes depend on that rule.
- "Says what, not when" is a heuristic: the description has no "use when", "when the user", "trigger" or "whenever" phrase. Many descriptions that fail it still route well because their first words say what they are for.
- Cost is the listing only, and tokens are characters / 4. The biggest listing is not the worst pack: it buys coverage, and no body loads until a skill is used.
- Labels are mine, from names and descriptions only. No model was run, so nothing here shows that a collision causes a wrong skill to be chosen.

## Flagged pairs

- mattpocock-skills/code-review <-> claude-code-game-studios/code-review (same name)
- mattpocock-skills/prototype <-> claude-code-game-studios/prototype (same name)
- claude-code-game-studios/team-audio <-> claude-code-game-studios/team-combat (overlap 0.47)
- claude-code-game-studios/team-level <-> claude-code-game-studios/team-narrative (overlap 0.44)
- marketingskills/cro <-> marketingskills/signup (overlap 0.34)
- claude-code-game-studios/team-combat <-> claude-code-game-studios/team-polish (overlap 0.32)
