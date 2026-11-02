# skilldiet: what it measures, and how sure it is

## What counts as a skill

`SKILL.md` folders in `<claude>/skills/` (user-owned), in the plugins listed in `<claude>/plugins/installed_plugins.json` (managed by the plugin), in a project's
`.claude/skills/` (`--project`), and in any folder you point at with `--path` (the folder itself, `skills/*` or `.claude/skills/*`). Skills that Claude Desktop, a
cloud workspace or another plugin system injects (for example the `anthropic-skills:` set) are not on disk in these places and are **not seen**: your real context
cost can be higher than the number printed.

## Cost

The listing line is `- <name>: <description>`: Claude Code puts a line like this in context for every skill, every session. **Tokens are estimated as characters / 4.**
Real tokenizers differ by roughly 20% (more for code, names and non-English text), so compare figures with each other; do not treat them as a bill. A skill's body
(`bodyTokens`) is only loaded when the skill is used and is reported separately.

## Collisions

Descriptions are lowercased, stop-words and generic verbs removed, words stemmed. Two skills collide when they share a name, or share **at least 6 stems and a Jaccard
overlap of at least 0.30** (the pre-registered setting). The report shows the shared words and never a verdict. Options: `--loose` (4 shared stems, 0.18; more pairs, more
false alarms; chosen after seeing the benchmark labels, so not evidence), `--threshold`, `--min-shared`, and `--df 0.25`, which ignores words found in more than a
quarter of the skills being compared (a template phrase repeated across your own skills otherwise makes unrelated skills look alike). `--df` applies to 8 or more skills.

## Hygiene

Agent Skills spec checks: frontmatter present, name 1 to 64 characters of lowercase letters, digits and single hyphens and equal to the folder name, description 1 to 1,024
characters. Plus two heuristics: a body over about 5,000 tokens, and "says what, not when": the description has no "use when", "when the user", "trigger" or "whenever"
phrase. The second is only a heuristic: many descriptions without one still route well.

## Usage

Reads Claude Code session logs (`<claude>/projects/**/*.jsonl`) and keeps only skill names: `Skill` tool calls (`input.skill`) and `/slash` commands
(`<command-name>`). A plugin prefix (`anthropic-skills:docs`) counts for the bare name (`docs`). The window is the retained logs: 30 days by default per Claude Code's
documentation; a machine can hold more. A skill used once a quarter will look unused, and a skill another skill calls internally is not counted.

## Prune

Dry run by default. `--apply` **moves** (renames) user-owned skill folders to `<claude>/skills-disabled/<name>` and writes a manifest; `restore` moves them back and refuses
to overwrite anything at the original location. A junction or symlink is moved as a link, so its target is untouched. Candidates must be unused in the window, not on `--keep`,
and not modified in the last 14 days (`--grace`). Plugin-managed skills are never touched.

## Benchmark

Pre-registered in `benchmarks/PREREGISTRATION.md` (seven trending packs pinned to commits, the inclusion rule, cost metrics, the collision definition and the label procedure,
all committed before the packs were fetched). Results and the deviations from the plan are in `benchmarks/results.first.md`.

## What this cannot do

- It cannot tell whether a skill is good, only what it costs and whether it fired.
- It does not call a model, so it cannot show that two similar skills cause the wrong one to be chosen.
- It does not scan for malicious skills. NVIDIA/SkillSpector and others do.
