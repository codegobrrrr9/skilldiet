---
description: What your agent skills cost you every session, which overlap, and which never fire. Runs scan, or usage / prune (dry run) / report with an argument.
allowed-tools: Bash(node:*)
---

1. If `$ARGUMENTS` is empty, run `node ${CLAUDE_PLUGIN_ROOT}/skills/skilldiet/scripts/skilldiet.js scan` and quote the output. Say tokens are estimates (characters / 4).
2. Otherwise run `node ${CLAUDE_PLUGIN_ROOT}/skills/skilldiet/scripts/skilldiet.js $ARGUMENTS` (`usage`, `prune`, `report`, `restore`) and quote it as printed.
3. Never add `--apply` yourself. For `prune`, show the dry run, say nothing is deleted (skills are parked and `restore` brings them back), and ask first.
4. A collision is a reason to look, not a verdict. Cost is not quality.
