import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync, symlinkSync, utimesSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { isolate, writeSkill, treeHash, writeTranscript, skillCall, slashCall } from './helpers.js';

const iso = isolate(); iso.apply();
const { parseFrontmatter, discover } = await import('../skills/skilldiet/scripts/skills.js');
const { estimateTokens, costOf, packTotals, hygiene, collisions, stems } = await import('../skills/skilldiet/scripts/analyze.js');
const { readUsage, matchUsage } = await import('../skills/skilldiet/scripts/usage.js');
const { planPrune, applyPrune, restore, readManifest } = await import('../skills/skilldiet/scripts/prune.js');
const { guard } = await import('../skills/skilldiet/scripts/paths.js');

const CLI = fileURLToPath(new URL('../skills/skilldiet/scripts/skilldiet.js', import.meta.url));
const run = (args, env = {}) => new Promise((resolve) => {
  const p = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, ...iso.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let o = ''; p.stdout.on('data', d => o += d); p.stderr.on('data', d => o += d);
  p.on('close', (status) => resolve({ status, all: o }));
});
const OLD = Date.now() - 60 * 86400000;

test('frontmatter: plain, quoted with escapes, folded and literal block scalars, multi-line plain, nested metadata, BOM and CRLF, none at all', () => {
  const t = (s) => parseFrontmatter(s).data;
  assert.equal(t('---\nname: a\ndescription: Plain text here.\n---\nbody').description, 'Plain text here.');
  assert.equal(t('---\nname: a\ndescription: "Say \\"hi\\" and\\nstop."\n---\n').description, 'Say "hi" and\nstop.');
  assert.equal(t("---\nname: a\ndescription: 'It''s quoted.'\n---\n").description, "It's quoted.");
  assert.equal(t('---\nname: a\ndescription: >\n  folded line one\n  line two\n---\n').description, 'folded line one line two');
  assert.equal(t('---\nname: a\ndescription: |\n  literal one\n  literal two\n---\n').description, 'literal one\nliteral two');
  assert.equal(t('---\nname: a\ndescription: starts here\n  and continues here\nlicense: MIT\n---\n').description, 'starts here and continues here');
  assert.equal(t('---\nname: a\nmetadata:\n  author: x\n  version: "1"\ndescription: after metadata\n---\n').description, 'after metadata');
  assert.equal(t('﻿---\r\nname: a\r\ndescription: crlf works\r\n---\r\nbody').description, 'crlf works');
  const none = parseFrontmatter('# just markdown');
  assert.equal(none.hasFrontmatter, false); assert.deepEqual(none.data, {});
  assert.equal(parseFrontmatter('---\nname: a\ndescription: x\n---\nthe body').body, 'the body');
});

test('discover: user skills, plugin skills from installed_plugins.json, a project, and any path; folders without SKILL.md are ignored', () => {
  writeSkill(iso.skills, 'alpha'); writeSkill(iso.skills, 'beta'); mkdirSync(join(iso.skills, 'not-a-skill'), { recursive: true });
  const plug = join(iso.claude, 'plugins', 'cache', 'mkt', 'tools'); writeSkill(join(plug, 'skills'), 'gamma');
  writeFileSync(join(iso.claude, 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'tools@mkt': [{ scope: 'user', installPath: plug }] } }));
  const proj = join(iso.root, 'proj'); writeSkill(join(proj, '.claude', 'skills'), 'delta');
  const pack = join(iso.root, 'somepack'); writeSkill(join(pack, 'skills'), 'epsilon');
  const all = discover({ project: proj, paths: [pack] });
  const by = Object.fromEntries(all.map(s => [s.name, s]));
  assert.deepEqual(Object.keys(by).sort(), ['alpha', 'beta', 'delta', 'epsilon', 'gamma']);
  assert.equal(by.alpha.owner, 'user'); assert.equal(by.gamma.owner, 'plugin'); assert.equal(by.gamma.pack, 'plugin:tools@mkt'); assert.equal(by.epsilon.owner, 'path');
  assert.equal(discover({ includePlugins: false }).some(s => s.name === 'gamma'), false);
});

test('cost: the listing line "- name: description" is estimated at characters / 4; pack totals, average and the longest listing', () => {
  const s = { name: 'x', description: 'a'.repeat(95), bodyChars: 400, pack: 'user', owner: 'user' };
  assert.equal(estimateTokens(100), 25);
  const c = costOf(s);
  assert.equal(c.listingTokens, Math.ceil((`- x: ${'a'.repeat(95)}`.length + 1) / 4)); assert.equal(c.bodyTokens, 100);
  const totals = packTotals([s, { ...s, name: 'yy', description: 'b'.repeat(15) }, { ...s, name: 'z', pack: 'other', owner: 'plugin' }]);
  assert.equal(totals.length, 2); assert.equal(totals[0].pack, 'user');
  assert.equal(totals[0].skills, 2); assert.equal(totals[0].longestName, 'x'); assert.equal(totals[0].avg, Math.round(totals[0].listingTokens / 2));
});

test('hygiene: the Agent Skills spec checks, and a description with no "when"', () => {
  const ok = { hasFrontmatter: true, hasName: true, name: 'good-name', dirName: 'good-name', description: 'Does X. Use when the user asks for X.', bodyChars: 100 };
  assert.deepEqual(hygiene(ok), []);
  const has = (s, re) => hygiene({ ...ok, ...s }).some(i => re.test(i));
  assert.ok(has({ name: 'Bad_Name', dirName: 'Bad_Name' }, /lowercase letters, digits and single hyphens/));
  assert.ok(has({ name: 'good-name', dirName: 'other' }, /differs from its folder/));
  assert.ok(has({ description: 'x'.repeat(1100) + ' use when asked' }, /over 1,024/));
  assert.ok(has({ description: 'Formats tables nicely.' }, /not when to use it/));
  assert.ok(has({ description: '' }, /no description/)); assert.ok(has({ hasFrontmatter: false }, /no frontmatter/));
  assert.ok(has({ bodyChars: 25000 }, /over about 5,000 tokens/)); assert.ok(has({ name: 'a'.repeat(65), dirName: 'a'.repeat(65) }, /over 64/));
});

test('collisions: near-identical descriptions are flagged with their shared words, unrelated ones are not, a shared name always is', () => {
  const mk = (name, description, pack = 'p') => ({ name, description, pack });
  const a = mk('review-code', 'Reviews a pull request for bugs, security problems, style issues and missing tests before merge. Use when the user asks for a pull request review.');
  const b = mk('pr-review', 'Review a pull request for bugs, security problems, style issues and missing tests, then summarize before merge. Use when asked to review a pull request.', 'q');
  const c = mk('make-slides', 'Builds a presentation deck from an outline with themes, speaker notes and charts. Use when the user wants slides.');
  const d = mk('review-code', 'Totally different text about gardening, soil, watering schedules and plant disease.', 'r');
  const pairs = collisions([a, b, c, d]);
  const names = pairs.map(p => [p.a, p.b, p.sameName].join('|'));
  assert.ok(names.includes('review-code|pr-review|false'), 'the two review skills collide');
  assert.ok(names.includes('review-code|review-code|true'), 'the same name always collides');
  assert.ok(!pairs.some(p => p.a === 'make-slides' || p.b === 'make-slides'), 'unrelated skills do not');
  assert.ok(pairs.find(p => p.b === 'pr-review').shared.includes('pull') || pairs.find(p => p.b === 'pr-review').shared.length >= 6);
  assert.equal(collisions([a, b], { threshold: 0.99 }).length, 0, 'the threshold is a parameter');
  assert.ok(stems('Reviewing the reviews, reviewed').has('review'), 'a stem merges word forms');
});

test('usage: Skill tool calls and /slash commands are counted per skill, a plugin prefix matches the bare name, and --days limits the window', async () => {
  writeTranscript(iso, 'p1', 's1', [skillCall('alpha'), skillCall('anthropic-skills:gamma'), slashCall('beta'), slashCall('alpha'), { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'no skill here' }] } }], Date.now() - 86400000);
  writeTranscript(iso, 'p1', 's2', [skillCall('alpha', '2026-08-01T00:00:00.000Z')], OLD);
  const u = await readUsage({});
  assert.equal(u.window.files, 2);
  const all = discover({});
  const get = (n) => matchUsage(all.find(s => s.name === n), u.used);
  assert.equal(get('alpha').count, 3); assert.equal(get('alpha').sessions, 2); assert.equal(get('beta').count, 1);
  assert.equal(get('gamma').count, 1, 'anthropic-skills:gamma counts for gamma');
  assert.equal(matchUsage({ name: 'delta', dirName: 'delta' }, u.used).count, 0);
  const recent = await readUsage({ days: 7 });
  assert.equal(recent.window.files, 1); assert.equal(matchUsage(all.find(s => s.name === 'alpha'), recent.used).count, 2);
  assert.ok(!JSON.stringify([...recent.used]).includes('no skill here'), 'only skill names are kept');
});

test('prune: only old, unused, user-owned skills are candidates; used, recent, kept, plugin skills are not; apply parks, restore brings back a byte-identical tree', async () => {
  const base = iso.skills;
  const oldDir = (n) => { const d = writeSkill(base, n); utimesSync(d, new Date(OLD), new Date(OLD)); return d; };
  oldDir('stale-one'); oldDir('stale-two'); oldDir('keep-me');
  writeSkill(base, 'fresh-skill');                                                      // installed just now: inside the grace period
  const target = join(iso.root, 'linked-source'); writeSkill(target, 'linked'); symlinkSync(join(target, 'linked'), join(base, 'linked-junction'), 'junction');
  utimesSync(join(base, 'linked-junction'), new Date(OLD), new Date(OLD));
  const skills = discover({});
  const usage = await readUsage({});
  const plan = planPrune(skills, usage, { keep: ['keep-me'] });
  const names = plan.candidates.map(s => s.name).sort();
  assert.ok(names.includes('stale-one') && names.includes('stale-two'));
  for (const n of ['alpha', 'beta', 'keep-me', 'fresh-skill', 'gamma']) assert.ok(!names.includes(n), n + ' is not a candidate');
  assert.ok(plan.kept.some(k => k.skill.name === 'gamma' && /plugin/.test(k.why)));
  const before = treeHash(iso.skills), beforeTarget = treeHash(target);
  const moved = applyPrune(plan.candidates);
  assert.deepEqual(moved.failed, []);
  for (const n of moved.moved) assert.ok(!existsSync(join(base, n)) || n === 'linked');
  assert.ok(readManifest().items.length === moved.moved.length);
  assert.ok(existsSync(join(iso.claude, 'skills-disabled', 'stale-one', 'SKILL.md')), 'parked, not deleted');
  assert.equal(treeHash(target), beforeTarget, 'the source behind a parked junction is untouched');
  const back = restore('all');
  assert.deepEqual(back.failed, []);
  assert.equal(treeHash(iso.skills), before, 'restore leaves the skills folder byte for byte as it was');
  assert.equal(readManifest().items.length, 0);
});

test('restore refuses to overwrite: if something is already at the original location, the parked skill stays parked', async () => {
  const d = writeSkill(iso.skills, 'twice'); utimesSync(d, new Date(OLD), new Date(OLD));
  const s = discover({}).find(x => x.name === 'twice');
  applyPrune([s]);
  writeSkill(iso.skills, 'twice', { description: 'a new one. Use when asked.' });
  const r = restore(['twice']);
  assert.match(r.failed[0].why, /already at the original location/);
  assert.ok(existsSync(join(iso.claude, 'skills-disabled', 'twice', 'SKILL.md')));
});

test('CLI: scan prints cost and collisions, usage and prune dry run change nothing, --json is valid, and no path outside the temp home is touched', async () => {
  const real = process.env.SKILLDIET_FORBID_PREFIX;
  assert.throws(() => guard(join(real, '.claude', 'skills')), /refusing to touch the real home/);
  const before = treeHash(iso.skills);
  const scan = await run(['scan']);
  assert.equal(scan.status, 0, scan.all); assert.match(scan.all, /skilldiet scan  ·  \d+ skills/); assert.match(scan.all, /estimate: characters \/ 4/);
  const json = JSON.parse((await run(['scan', '--json'])).all);
  assert.ok(json.skills.length > 3 && json.estimateNote && json.collisionDefinition.threshold === 0.3);
  const usage = await run(['usage']); assert.match(usage.all, /skilldiet usage/); assert.match(usage.all, /Never fired/);
  const prune = await run(['prune']); assert.match(prune.all, /Dry run: nothing was moved/);
  assert.equal(treeHash(iso.skills), before, 'scan, usage and a prune dry run change nothing');
  assert.ok(!scan.all.includes(real) && !prune.all.includes(real));
  const help = await run(['help']); assert.match(help.all, /Security scanning is out of scope/);
});
