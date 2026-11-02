#!/usr/bin/env node
// skilldiet: what your skills cost you every session, which collide, and which never fire.
//   skilldiet scan    [--path dir ...] [--project dir] [--no-plugins] [--json]    cost per pack, collisions, hygiene
//   skilldiet usage   [--days N]                                                 which skills fired in your session logs
//   skilldiet prune   [--apply] [--days N] [--keep a,b] [--grace 14]             park unused user skills (dry run unless --apply)
//   skilldiet restore [name ... | --all]                                         move parked skills back
//   skilldiet report  [--out file.md]
// Tokens are estimates (characters / 4). Nothing is deleted, nothing leaves the machine, no model is called.

import { realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discover } from './skills.js';

// calendar day in the machine's own time zone, not UTC
const localDay = (v) => { const d = v ? new Date(v) : null; if (!d || Number.isNaN(d.getTime())) return 'n/a'; const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
import { costOf, packTotals, hygiene, collisions, estimateTokens, COLLISION_DEFAULTS } from './analyze.js';
import { readUsage, matchUsage } from './usage.js';
import { planPrune, applyPrune, restore, readManifest } from './prune.js';

const out = (s = '') => process.stdout.write(s + '\n');
const err = (s = '') => process.stderr.write(s + '\n');

export function parseArgs(argv) {
  const a = { _: [], flags: {}, multi: {} };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const k = t.slice(2), n = argv[i + 1];
      const v = (n === undefined || n.startsWith('--')) ? true : (i++, n);
      a.flags[k] = v; (a.multi[k] ||= []).push(v);
    } else a._.push(t);
  }
  return a;
}
const num = (n) => Number(n).toLocaleString('en-US');
const pad = (s, n) => String(s).padEnd(n).slice(0, Math.max(n, String(s).length));

export function gather(a, env = process.env) {
  return discover({ env, project: a.flags.project && a.flags.project !== true ? a.flags.project : null, paths: (a.multi.path || []).filter(p => p !== true), includePlugins: !a.flags['no-plugins'] });
}

// --loose is a more sensitive collision setting (4 shared stems, overlap 0.18). It was chosen after looking at the benchmark labels, so its numbers are not evidence.
export function collisionOptions(flags) {
  const df = flags.df ? Number(flags.df) : null;
  if (flags.loose) return { threshold: 0.18, minShared: 4, df };
  return { threshold: flags.threshold ? Number(flags.threshold) : COLLISION_DEFAULTS.threshold, minShared: flags['min-shared'] ? Number(flags['min-shared']) : COLLISION_DEFAULTS.minShared, df };
}
export function analyze(skills, opts = COLLISION_DEFAULTS) {
  const packs = packTotals(skills);
  const totalTokens = skills.reduce((n, s) => n + costOf(s).listingTokens, 0);
  const issues = skills.map(s => ({ s, list: hygiene(s) })).filter(x => x.list.length);
  return { packs, totalTokens, issues, pairs: collisions(skills, opts) };
}

function printScan(skills, an, flags) {
  out(`skilldiet scan  ·  ${skills.length} skills in ${an.packs.length} pack${an.packs.length === 1 ? '' : 's'}  ·  about ${num(an.totalTokens)} tokens listed in context every session  (estimate: characters / 4)`);
  out(`\n${pad('pack', 46)} ${'skills'.padStart(6)} ${'tokens'.padStart(8)} ${'avg'.padStart(5)}  longest listing`);
  for (const p of an.packs) out(`${pad(p.pack, 46)} ${String(p.skills).padStart(6)} ${num(p.listingTokens).padStart(8)} ${String(p.avg).padStart(5)}  ${p.longestName} (${p.longest})`);
  if (an.pairs.length) {
    out(`\nPossible collisions: ${an.pairs.length} pair${an.pairs.length === 1 ? '' : 's'} (descriptions share many of the same words, or the same name). A pair is a reason to look, not a verdict.`);
    for (const p of an.pairs.slice(0, Number(flags.top) || 12)) out(`  ${p.a} (${p.aPack})  <->  ${p.b} (${p.bPack})  ${p.sameName ? 'SAME NAME' : 'overlap ' + p.jaccard}${p.shared.length ? '  shared: ' + p.shared.join(', ') : ''}`);
    if (an.pairs.length > (Number(flags.top) || 12)) out(`  … ${an.pairs.length - (Number(flags.top) || 12)} more (--top N, or --json)`);
  } else out('\nNo skill pairs look alike.');
  if (an.issues.length) {
    out(`\nHygiene: ${an.issues.length} skill${an.issues.length === 1 ? '' : 's'} with issues`);
    for (const x of an.issues.slice(0, Number(flags.top) || 12)) out(`  ${x.s.name} (${x.s.pack}): ${x.list.join('; ')}`);
  }
  out('\nThis is the cost of the LISTING (name and description), paid every session. A skill\'s body loads only when it is used. A big pack can be worth its cost.');
}

export async function main(argv, env = process.env) {
  const a = parseArgs(argv), cmd = a._[0], f = a.flags;
  if (!cmd || cmd === 'help' || f.help) { out(readHelp()); return 0; }
  if (cmd === 'restore') {
    const r = restore(f.all ? 'all' : a._.slice(1), env);
    out(`restored ${r.back.length}${r.back.length ? ': ' + r.back.join(', ') : ''}`);
    for (const x of r.failed) out(`  ${x.name}: ${x.why}`);
    if (!f.all && a._.length === 1) { const m = readManifest(env); out(m.items.length ? `parked: ${m.items.map(i => i.name).join(', ')}  (skilldiet restore <name> or --all)` : 'nothing is parked.'); }
    return r.failed.length ? 1 : 0;
  }
  if (!['scan', 'usage', 'prune', 'report'].includes(cmd)) { err(`unknown command "${cmd}". Run skilldiet help.`); return 2; }
  const skills = gather(a, env);
  const an = analyze(skills, collisionOptions(f));
  if (cmd === 'scan') { if (f.json) out(JSON.stringify(jsonScan(skills, an), null, 2)); else printScan(skills, an, f); return 0; }

  const usage = await readUsage({ env, days: f.days ? Number(f.days) : null });
  const rows = skills.map(s => ({ s, u: matchUsage(s, usage.used), c: costOf(s) }));
  if (cmd === 'usage' || cmd === 'report') {
    const never = rows.filter(r => r.u.count === 0), usedRows = rows.filter(r => r.u.count > 0);
    const neverTokens = never.reduce((n, r) => n + r.c.listingTokens, 0);
    const lines = [];
    lines.push(`skilldiet usage  ·  ${usage.window.files} session logs over ${usage.window.days} days  ·  ${usedRows.length} of ${skills.length} skills used  ·  ${never.length} never fired, costing about ${num(neverTokens)} tokens per session (estimate)`);
    lines.push('\nUsed:'); for (const r of usedRows.sort((x, y) => y.u.count - x.u.count)) lines.push(`  ${String(r.u.count).padStart(4)}×  ${pad(r.s.name, 32)} ${pad(r.s.pack, 28)} last ${localDay(r.u.last)}`);
    lines.push('\nNever fired in these logs:'); for (const r of never.sort((x, y) => y.c.listingTokens - x.c.listingTokens)) lines.push(`  ${pad(r.s.name, 32)} ${pad(r.s.pack, 28)} ${String(r.c.listingTokens).padStart(4)} tokens`);
    lines.push(`\nThe window is only as long as your retained session logs (Claude Code keeps 30 days by default), and a skill used once a quarter will look unused. Skills are matched by name; a skill another skill calls internally is not counted.`);
    if (cmd === 'usage') { if (f.json) out(JSON.stringify({ window: usage.window, used: usedRows.map(r => ({ name: r.s.name, pack: r.s.pack, count: r.u.count, last: r.u.last })), never: never.map(r => ({ name: r.s.name, pack: r.s.pack, tokens: r.c.listingTokens })) }, null, 2)); else out(lines.join('\n')); return 0; }
    const md = ['# skilldiet report', '', `Generated ${new Date().toISOString()}. Token figures are estimates (characters / 4).`, '', '```', ...lines, '```', ''].join('\n');
    if (f.out) { writeFileSync(resolve(f.out), md); out(`report written to ${f.out}`); } else out(md);
    return 0;
  }
  // prune
  const plan = planPrune(skills, usage, { keep: typeof f.keep === 'string' ? f.keep.split(',').map(s => s.trim()) : [], graceDays: f.grace ? Number(f.grace) : 14 });
  const saved = plan.candidates.reduce((n, s) => n + costOf(s).listingTokens, 0);
  out(`skilldiet prune ${f.apply ? '' : '(dry run) '} ·  ${plan.candidates.length} skills never fired in ${usage.window.files} session logs (${usage.window.days} days)  ·  about ${num(saved)} tokens per session  (estimate)`);
  for (const s of plan.candidates) out(`  ${pad(s.name, 32)} ${s.dir.replace(/\\/g, '/').split('/').slice(-3).join('/')}  ${costOf(s).listingTokens} tokens`);
  const skippedPlugins = plan.kept.filter(k => k.skill.owner === 'plugin').length;
  if (skippedPlugins) out(`  (${skippedPlugins} plugin-managed skills not touched: disable the plugin to remove them)`);
  const graceHeld = plan.kept.filter(k => k.skill.owner !== 'plugin' && /^installed in the last/.test(k.why));
  if (graceHeld.length) out(`  (${graceHeld.length} user skill${graceHeld.length === 1 ? '' : 's'} held back because ${graceHeld.length === 1 ? 'it was' : 'they were'} installed in the last ${f.grace ? Number(f.grace) : 14} days and may not have had time to fire: ${graceHeld.map(k => k.skill.name).join(', ')}. --grace 0 includes them.)`);
  if (!plan.candidates.length) { out('nothing to park.'); return 0; }
  if (!f.apply) { out('\nDry run: nothing was moved. --apply parks these in your skills-disabled folder (nothing is deleted; skilldiet restore brings them back).'); return 0; }
  const r = applyPrune(plan.candidates, env);
  out(`\nparked ${r.moved.length}${r.moved.length ? ': ' + r.moved.join(', ') : ''}. Restore with: skilldiet restore <name>  (or --all). Restart Claude Code to drop them from the listing.`);
  for (const x of r.failed) out(`  ${x.name}: ${x.why}`);
  return r.failed.length ? 1 : 0;
}

function jsonScan(skills, an) {
  return { estimateNote: 'tokens are estimates: characters / 4', skills: skills.map(s => ({ name: s.name, pack: s.pack, owner: s.owner, listingTokens: costOf(s).listingTokens, bodyTokens: costOf(s).bodyTokens, issues: hygiene(s) })), packs: an.packs, collisions: an.pairs, collisionDefinition: COLLISION_DEFAULTS };
}

function readHelp() {
  return `skilldiet: what your skills cost you every session, which collide, and which never fire.

  scan     cost of the skill listing per pack, possible collisions, hygiene (add --path <dir> for any pack, --project for a repo)
  usage    which skills fired in your Claude Code session logs, and what the silent ones cost
  prune    park skills that never fired (dry run unless --apply); nothing is deleted     restore  move them back
  report   usage as a markdown file (--out)

flags: --path <dir> (repeatable)  --project <dir>  --no-plugins  --days N  --keep a,b  --grace 14  --top N  --json
       --loose (collisions at 4 shared words and 0.18 overlap: more pairs, more false alarms)  --threshold 0.30  --min-shared 6  --df 0.25 (ignore words found in more than a quarter of your skills, e.g. a template phrase you repeat)
Tokens are estimates (characters / 4). Security scanning is out of scope: see NVIDIA/SkillSpector.`;
}

const samePath = (a, b) => { try { return realpathSync(a) === realpathSync(b); } catch { return a === b; } };
const isMain = process.argv[1] && samePath(fileURLToPath(import.meta.url), resolve(process.argv[1]));
if (isMain) main(process.argv.slice(2)).then(c => { if (c !== undefined) process.exitCode = c; }).catch(e => { err('skilldiet: ' + (e && e.message ? e.message : e)); process.exitCode = 1; });
export { estimateTokens };
