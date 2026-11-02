// Load the fetched packs as skill objects (what skilldiet's analysis expects). Shared by sample-pairs.js and run.js.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../skills/skilldiet/scripts/skills.js';

const here = dirname(fileURLToPath(import.meta.url));
export const manifest = JSON.parse(readFileSync(join(here, 'packs.json'), 'utf8'));

function walk(dir) { const out = []; for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) out.push(...walk(p)); else if (n === 'SKILL.md') out.push(p); } return out; }

export function loadPack(id) {
  const base = join(here, 'work', 'packs', id);
  const seen = new Set(), skills = [];
  for (const file of walk(base).sort()) {
    const text = readFileSync(file, 'utf8');
    const { data, body, hasFrontmatter } = parseFrontmatter(text);
    const dirName = basename(dirname(file));
    const name = String(data.name || dirName);
    if (seen.has(name)) continue;                                   // the same name twice in one pack counts once
    seen.add(name);
    skills.push({ name, dirName, description: String(data.description || ''), hasFrontmatter, hasName: !!data.name, bodyChars: body.length, bytes: Buffer.byteLength(text), pack: id, owner: 'path', file });
  }
  return skills;
}
export const loadAll = () => Object.fromEntries(manifest.packs.map(p => [p.id, loadPack(p.id)]));
