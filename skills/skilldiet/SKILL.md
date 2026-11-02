---
name: skilldiet
description: Shows what your agent skills cost you every session, which ones overlap, and which never fire. Measures the always-loaded skill listing in tokens per skill and per pack (installed skills, plugin skills, or any pack by path), flags skills with near-identical descriptions or the same name, checks Agent Skills spec hygiene, reads your Claude Code session logs to see which skills actually ran, and parks the unused ones reversibly (nothing is deleted). Use when the user asks why their context is full, what their skills cost, whether too many skills are installed, which skills they use, whether two skills conflict, or says /skilldiet.
license: MIT
metadata:
  author: codegobrrrr9
  version: "0.1.0"
  homepage: https://github.com/codegobrrrr9/skilldiet
---

# skilldiet

Every skill you install puts a line (its name and description) into context at the start of every session, whether or not it is used. skilldiet measures
that cost, finds skills that look alike, and shows which ones your own session logs say never fired. It never deletes anything and calls no model.

## Rules

1. **Run the tool, quote what it prints.** Report tokens as estimates (characters / 4) every time; never state them as exact or as a bill.
2. **Cost is not quality.** A big pack can be worth its listing: bodies load only when a skill is used. Say what a number is, not whether a pack is good.
3. **A collision is a reason to look, not a verdict.** Show the pair and the shared words; let the user decide whether two skills really compete.
4. **Prune is a dry run until the user says yes.** `prune --apply` only parks user-owned skills in `skills-disabled` (a manifest records each one, `restore` brings it
   back). It never touches plugin-managed skills (disable the plugin instead) or skills installed in the last 14 days. Tell the user to restart Claude Code afterwards.
5. **"Never fired" is limited by the logs.** The window is only as long as the retained session logs (30 days by default), and a skill used once a quarter looks unused.
   Say the window the tool printed.
6. **Do not go looking for security problems here.** skilldiet does not scan skills for malicious content; for that, point to NVIDIA/SkillSpector or a similar scanner.
7. Do not read skill bodies or session logs yourself to answer these questions: run `usage` and `scan`.

## Commands

```
skilldiet scan    [--path dir ...] [--project dir] [--no-plugins] [--loose] [--df 0.25] [--json]
skilldiet usage   [--days N]                    which skills fired, and what the silent ones cost
skilldiet prune   [--apply] [--keep a,b] [--grace 14]      park unused user skills (dry run unless --apply)
skilldiet restore [name ... | --all]
skilldiet report  [--out file.md]
```

What it measures, the collision definition, and the benchmark on the seven trending skill packs are in [`references/method.md`](references/method.md).

## Final message shape

```
skilldiet · 29 skills, about 4,800 tokens listed every session (estimate) · 22 used in the last 69 days · 2 parked, restore with: skilldiet restore --all
```
