#!/usr/bin/env node
// Fetch the pinned skill packs into benchmarks/work/packs/<id>/ (gitignored) using the GitHub CLI, and record a SHA-256 per file in packs.lock.json.
//   node benchmarks/fetch.js
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const GH = process.env.GH_BIN || (process.platform === 'win32' ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh');
const manifest = JSON.parse(readFileSync(join(here, 'packs.json'), 'utf8'));
const include = new RegExp(manifest.include), exclude = new RegExp(manifest.exclude, 'i');
const lockFile = join(here, 'packs.lock.json');
const lock = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, 'utf8')) : {};

function gh(args) { const r = spawnSync(GH, ['api', ...args], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }); if (r.status !== 0) throw new Error('gh api failed: ' + args[0]); return r.stdout; }

for (const p of manifest.packs) {
  const tree = JSON.parse(gh([`repos/${p.repo}/git/trees/${p.sha}?recursive=1`]));
  const paths = tree.tree.filter(e => e.type === 'blob' && include.test(e.path) && !exclude.test(e.path)).map(e => e.path);
  lock[p.id] = lock[p.id] || { repo: p.repo, sha: p.sha, files: {} };
  for (const path of paths) {
    const dest = join(here, 'work', 'packs', p.id, path);
    let buf;
    if (existsSync(dest) && lock[p.id].files[path]) buf = readFileSync(dest);
    else {
      const r = await fetch(`https://raw.githubusercontent.com/${p.repo}/${p.sha}/${path}`);
      if (!r.ok) throw new Error(`${p.id}/${path}: HTTP ${r.status}`);
      buf = Buffer.from(await r.arrayBuffer()); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, buf);
    }
    const sha = createHash('sha256').update(buf).digest('hex');
    if (lock[p.id].files[path] && lock[p.id].files[path] !== sha) throw new Error(`${p.id}/${path}: content changed since it was locked`);
    lock[p.id].files[path] = sha;
  }
  console.log(p.id.padEnd(26), String(paths.length).padStart(3), 'skills');
}
writeFileSync(lockFile, JSON.stringify(lock, null, 1) + '\n');
