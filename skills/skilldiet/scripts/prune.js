// prune / restore: PARK unused skills, never delete them. `prune --apply` moves a user-owned skill folder to <claude>/skills-disabled/ and records it in a
// manifest; `restore` moves it back. Plugin-managed skills are not touched (disable the plugin instead). A skill installed within the grace period is
// never a candidate: it has had no chance to be used.

import { renameSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { roots, guard } from './paths.js';
import { matchUsage } from './usage.js';

const manifestPath = (env) => join(roots(env).disabled, 'manifest.json');
export function readManifest(env = process.env) { try { return JSON.parse(readFileSync(guard(manifestPath(env), env), 'utf8')); } catch { return { v: 1, items: [] }; } }
function writeManifest(m, env) { mkdirSync(roots(env).disabled, { recursive: true }); writeFileSync(guard(manifestPath(env), env), JSON.stringify(m, null, 2)); }

export function planPrune(skills, usage, { keep = [], graceDays = 14, now = Date.now() } = {}) {
  const keepSet = new Set(keep.map(k => k.toLowerCase()));
  const out = { candidates: [], kept: [] };
  for (const s of skills) {
    if (s.owner !== 'user') { out.kept.push({ skill: s, why: s.owner === 'plugin' ? 'managed by a plugin: disable the plugin instead' : 'not in your skills folder' }); continue; }
    if (keepSet.has(s.name.toLowerCase()) || keepSet.has(s.dirName.toLowerCase())) { out.kept.push({ skill: s, why: 'on your --keep list' }); continue; }
    if (usage.window.files === 0) { out.kept.push({ skill: s, why: 'no session logs to judge by' }); continue; }
    if (now - s.mtime < graceDays * 86400000) { out.kept.push({ skill: s, why: `installed in the last ${graceDays} days` }); continue; }
    const u = matchUsage(s, usage.used);
    if (u.count > 0) { out.kept.push({ skill: s, why: `used ${u.count} time${u.count === 1 ? '' : 's'}` }); continue; }
    out.candidates.push(s);
  }
  return out;
}

export function applyPrune(candidates, env = process.env) {
  const m = readManifest(env), moved = [], failed = [];
  mkdirSync(guard(roots(env).disabled, env), { recursive: true });
  for (const s of candidates) {
    let to = join(roots(env).disabled, s.dirName);
    for (let n = 2; existsSync(to); n++) to = join(roots(env).disabled, `${s.dirName}-${n}`);
    try { renameSync(guard(s.dir, env), guard(to, env)); m.items.push({ name: s.name, dirName: s.dirName, from: s.dir, to, at: new Date().toISOString() }); moved.push(s.name); }
    catch (e) { failed.push({ name: s.name, why: e.code === 'EXDEV' ? 'on another drive' : e.code === 'EPERM' || e.code === 'EBUSY' ? 'in use' : 'could not move' }); }
  }
  writeManifest(m, env);
  return { moved, failed };
}

export function restore(names, env = process.env) {
  const m = readManifest(env), back = [], failed = [];
  const want = names === 'all' ? null : new Set(names.map(n => n.toLowerCase()));
  const keep = [];
  for (const it of m.items) {
    if (want && !want.has(it.name.toLowerCase()) && !want.has(it.dirName.toLowerCase())) { keep.push(it); continue; }
    if (existsSync(it.from)) { failed.push({ name: it.name, why: 'something is already at the original location' }); keep.push(it); continue; }
    try { renameSync(guard(it.to, env), guard(it.from, env)); back.push(it.name); } catch { failed.push({ name: it.name, why: 'could not move back' }); keep.push(it); }
  }
  writeManifest({ ...m, items: keep }, env);
  return { back, failed };
}
export { basename };
