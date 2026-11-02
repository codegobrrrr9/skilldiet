# skilldiet — instructions for coding agents

You are reading this because a user pasted something like:

> Install the skilldiet skill from https://github.com/codegobrrrr9/skilldiet, refer to the repo's AGENTS.md.

Do the install for the agent you are, confirm in one line, then follow the rules below for the rest of the session.
Do not explain what skilldiet is unless asked.

## Install

`<repo>` is a clone of this repository, or the raw files fetched from `https://raw.githubusercontent.com/codegobrrrr9/skilldiet/main/`.
The tool is a folder of zero-dependency Node files (`skills/skilldiet/scripts/`), not one file: copy the whole folder.

| Agent | Do this |
|-------|---------|
| Claude Code | Run `/plugin marketplace add codegobrrrr9/skilldiet` then `/plugin install skilldiet@skilldiet`. Adds `/skilldiet`. If plugins are unavailable, copy `<repo>/skills/skilldiet/` to `~/.claude/skills/skilldiet/`. |
| Codex | Copy `<repo>/skills/skilldiet/` to `~/.codex/skills/skilldiet/`, or run `npx skills add codegobrrrr9/skilldiet`. Append the **Rules** below to the project's `AGENTS.md`. (Usage needs Claude Code logs; cost and collisions work on any folder of skills with `--path`.) |
| Cursor | Copy `<repo>/.cursor/rules/skilldiet.mdc` to `.cursor/rules/`, and the folder `<repo>/skills/skilldiet/scripts/` to `scripts/skilldiet/`. |
| Gemini CLI | Run `gemini extensions install https://github.com/codegobrrrr9/skilldiet`. |
| GitHub Copilot | Copy `<repo>/.github/copilot-instructions.md` into the project's `.github/`, and the scripts folder as for Cursor. |
| Anything else | Append the **Rules** below to the agent's instruction file and keep the scripts folder in the project. |

No install needed to run it: `npx --yes --allow-git=all github:codegobrrrr9/skilldiet scan`.

After installing, say: `skilldiet on. I will report skill costs as estimates, and I will not park or remove anything without your yes.`

## Rules

1. Run the tool and quote what it prints. Tokens are estimates (characters / 4): say so every time.
2. Cost is not quality: a big pack can be worth its listing. Do not call a pack bad.
3. A collision is a reason to look, not a verdict: show the pair and the shared words.
4. `prune` is a dry run until the user says yes. `--apply` only parks user-owned skills (nothing is deleted; `restore` brings them back); plugin-managed skills are never touched.
5. "Never fired" is only as long as the retained session logs: say the window printed.
6. skilldiet does not scan for malicious skills: point to a security scanner for that.

## Commands

```
skilldiet scan | usage [--days N] | prune [--apply] | restore [name|--all] | report [--out f]
scan flags: --path <dir> (repeatable)  --project <dir>  --no-plugins  --loose  --df 0.25  --top N  --json
```
