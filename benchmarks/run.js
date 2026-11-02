#!/usr/bin/env node
// Run the pre-registered benchmark: cost per pack, combinations, hygiene, collisions, and the collision detector against the hand labels.
//   node benchmarks/run.js [label]    writes results.<label>.json and results.<label>.md (default label: first)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll, manifest } from './load.js';
import { costOf, packTotals, hygiene, collisions, COLLISION_DEFAULTS } from '../skills/skilldiet/scripts/analyze.js';

const here = dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] || 'first';
const packs = loadAll();
const ids = manifest.packs.map(p => p.id);
const num = (n) => Number(n).toLocaleString('en-US');
const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : null);

// per pack
const perPack = ids.map(id => {
  const s = packs[id], t = packTotals(s)[0];
  const body = s.reduce((n, x) => n + costOf(x).bodyTokens, 0);
  const longest = [...s].sort((a, b) => costOf(b).listingTokens - costOf(a).listingTokens)[0];
  const issues = s.map(x => hygiene(x));
  const count = (re) => issues.filter(l => l.some(i => re.test(i))).length;
  return { id, repo: manifest.packs.find(p => p.id === id).repo, stars: manifest.packs.find(p => p.id === id).stars, skills: s.length, listingTokens: t.listingTokens, avg: t.avg, longest: costOf(longest).listingTokens, longestName: longest.name, bodyTokens: body, avgBody: Math.round(body / s.length),
    hygiene: { any: issues.filter(l => l.length).length, name: count(/name/), descriptionTooLong: count(/over 1,024/), noWhen: count(/not when to use/), bigBody: count(/over about 5,000/) } };
});

// combinations
const combos = [['obra-superpowers', 'mattpocock-skills'], ['obra-superpowers', 'anthropics-skills'], ['mattpocock-skills', 'anthropics-skills'], ['obra-superpowers', 'mattpocock-skills', 'anthropics-skills'], ids].map(c => {
  const s = c.flatMap(id => packs[id]);
  const pairs = collisions(s);
  const cross = pairs.filter(p => p.aPack !== p.bPack);
  return { packs: c, skills: s.length, listingTokens: s.reduce((n, x) => n + costOf(x).listingTokens, 0), collisions: pairs.length, crossPack: cross.length, sameName: pairs.filter(p => p.sameName).length };
});

// the detector against the labels
const labels = Object.fromEntries(readFileSync(join(here, 'labels.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).map(l => [l.id, l]));
const flagged = Object.values(labels).filter(l => l.kind === 'flagged'), near = Object.values(labels).filter(l => l.kind === 'near');
const validation = { flagged: flagged.length, flaggedOverlap: flagged.filter(l => l.overlap).length, nearMisses: near.length, nearMissOverlap: near.filter(l => l.overlap).length };

const all = Object.values(packs).flat();
const out = { label, definition: COLLISION_DEFAULTS, skills: all.length, totalListingTokens: all.reduce((n, x) => n + costOf(x).listingTokens, 0), perPack, combos, validation,
  allPairs: collisions(all).map(p => ({ a: `${p.aPack}/${p.a}`, b: `${p.bPack}/${p.b}`, jaccard: p.jaccard, sameName: p.sameName })) };
writeFileSync(join(here, `results.${label}.json`), JSON.stringify(out, null, 1) + '\n');

const L = [`# skilldiet benchmark (${label})`, '', `Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md). ${all.length} skills in 7 packs, pinned in \`packs.json\`. Tokens are **estimates** (characters / 4); this is the cost of the skill LISTING (name and description), paid every session. A skill's body loads only when it is used.`, ''];
L.push('## Cost per pack', '', '| Pack | Stars | Skills | Listing tokens | Avg per skill | Longest listing | Avg body when used |', '|---|---|---|---|---|---|---|');
for (const p of perPack) L.push(`| ${p.repo} | ${num(p.stars)} | ${p.skills} | **${num(p.listingTokens)}** | ${p.avg} | ${p.longest} (${p.longestName}) | ${num(p.avgBody)} |`);
L.push('', '## Installed together', '', '| Packs | Skills | Listing tokens | Possible collisions | Across packs | Same name |', '|---|---|---|---|---|---|');
for (const c of combos) L.push(`| ${c.packs.length === 7 ? 'all seven' : c.packs.join(' + ')} | ${c.skills} | **${num(c.listingTokens)}** | ${c.collisions} | ${c.crossPack} | ${c.sameName} |`);
L.push('', '## Hygiene (Agent Skills spec)', '', '| Pack | Skills with any issue | Name rule | Description over 1,024 chars | Says what, not when | Body over ~5,000 tokens |', '|---|---|---|---|---|---|');
for (const p of perPack) L.push(`| ${p.repo} | ${p.hygiene.any} of ${p.skills} | ${p.hygiene.name} | ${p.hygiene.descriptionTooLong} | ${p.hygiene.noWhen} | ${p.hygiene.bigBody} |`);
L.push('', '## Does the collision detector find real overlap?', '', `Definition fixed before the run: shared name, or at least ${COLLISION_DEFAULTS.minShared} shared stems and Jaccard >= ${COLLISION_DEFAULTS.threshold}. Labelled by hand, before the run: could one request plausibly trigger both skills, or either in place of the other?`, '');
L.push('| | Pairs | Judged a real overlap |', '|---|---|---|', `| Flagged by the detector | ${validation.flagged} | **${validation.flaggedOverlap}** (${pct(validation.flaggedOverlap, validation.flagged)}%) |`, `| Near-misses (not flagged; at least 4 shared stems, Jaccard >= 0.18) | ${validation.nearMisses} | **${validation.nearMissOverlap}** (${pct(validation.nearMissOverlap, validation.nearMisses)}%) |`, '');
L.push(`Only ${validation.flagged} pairs across the ${all.length} skills clear the threshold, so all of them were labelled, not the 30 planned. The threshold is conservative: most of the near-misses were judged real overlaps. Read the flagged list as pairs worth a look, and the absence of a flag as weak evidence of no overlap.`, '');
L.push('## Deviations from the pre-registration, and limits', '',
  `- The plan was 30 flagged and 30 near-miss pairs. Only ${validation.flagged} pairs were flagged and ${validation.nearMisses} qualified as near-misses, so all of them were labelled.`,
  '- `packs.json` was committed with its `include` regex missing two backslashes (invalid JSON); it was fixed in a later commit, before any pack was fetched. The pattern is the same.',
  '- A pack is only what the inclusion rule in `packs.json` selects. For `pbakaus/impeccable` that is one skill: the repository holds many copies of it for other agents and test workspaces, which are not counted. Pack sizes depend on that rule.',
  '- "Says what, not when" is a heuristic: the description has no "use when", "when the user", "trigger" or "whenever" phrase. Many descriptions that fail it still route well because their first words say what they are for.',
  '- Cost is the listing only, and tokens are characters / 4. The biggest listing is not the worst pack: it buys coverage, and no body loads until a skill is used.',
  '- Labels are mine, from names and descriptions only. No model was run, so nothing here shows that a collision causes a wrong skill to be chosen.',
  '');
L.push('## Flagged pairs', '', ...out.allPairs.map(p => `- ${p.a} <-> ${p.b} (${p.sameName ? 'same name' : 'overlap ' + p.jaccard})`), '');
writeFileSync(join(here, `results.${label}.md`), L.join('\n'));
console.log(L.slice(0, 40).join('\n'));
