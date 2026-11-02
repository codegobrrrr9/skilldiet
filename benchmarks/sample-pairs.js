#!/usr/bin/env node
// Draw the validation pairs (seeded): 30 flagged and 30 near-miss pairs from the union of all packs, written to pairs-to-label.json with each skill's name and
// description. Nothing about the outcome is computed here. The author labels them (labels.jsonl) and commits the labels BEFORE run.js is executed.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll } from './load.js';
import { allPairs, COLLISION_DEFAULTS } from '../skills/skilldiet/scripts/analyze.js';

const here = dirname(fileURLToPath(import.meta.url));
const skills = Object.values(loadAll()).flat();
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20261101);
const sample = (arr, n) => { const pool = [...arr], out = []; for (let k = 0; k < n && pool.length; k++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); return out; };

const pairs = allPairs(skills);
const sameName = (p) => skills[p.i].name.toLowerCase() === skills[p.j].name.toLowerCase();
const flagged = pairs.filter(p => sameName(p) || (p.shared >= COLLISION_DEFAULTS.minShared && p.jaccard >= COLLISION_DEFAULTS.threshold));
const near = pairs.filter(p => !sameName(p) && !(p.shared >= COLLISION_DEFAULTS.minShared && p.jaccard >= COLLISION_DEFAULTS.threshold) && p.shared >= 4 && p.jaccard >= 0.18);
const pick = (kind, arr) => sample(arr, 30).map((p, n) => ({ id: `${kind}-${n + 1}`, kind, a: { name: skills[p.i].name, pack: skills[p.i].pack, description: skills[p.i].description }, b: { name: skills[p.j].name, pack: skills[p.j].pack, description: skills[p.j].description } }));
const out = { seed: 20261101, skills: skills.length, flaggedTotal: flagged.length, nearMissTotal: near.length, pairs: [...pick('flagged', flagged), ...pick('near', near)].sort((x, y) => (x.id < y.id ? -1 : 1)) };
// shuffle the order so the label is not influenced by which list a pair came from
const order = sample(out.pairs.map((_, i) => i), out.pairs.length);
out.pairs = order.map(i => out.pairs[i]);
writeFileSync(join(here, 'pairs-to-label.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`skills ${skills.length}; flagged pairs ${flagged.length}; near-miss pairs ${near.length}; wrote ${out.pairs.length} pairs to label`);
