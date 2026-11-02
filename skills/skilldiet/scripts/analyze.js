// Cost, hygiene and collisions. Everything here is deterministic text analysis: no model, no network.

import { listingLine } from './skills.js';

// Tokens are an ESTIMATE: characters / 4, the usual rule of thumb for English prose. Real tokenizers differ by roughly +-20%, more for code,
// names and non-English text. Every report says so.
export const estimateTokens = (chars) => Math.ceil(chars / 4);

export function costOf(skill) {
  const line = listingLine(skill);
  return { listingTokens: estimateTokens(line.length + 1), bodyTokens: estimateTokens(skill.bodyChars) };
}

export function packTotals(skills) {
  const by = new Map();
  for (const s of skills) {
    const p = by.get(s.pack) || by.set(s.pack, { pack: s.pack, owner: s.owner, skills: 0, listingTokens: 0, longest: 0, longestName: '', bodyTokens: 0 }).get(s.pack);
    const c = costOf(s);
    p.skills++; p.listingTokens += c.listingTokens; p.bodyTokens += c.bodyTokens;
    if (c.listingTokens > p.longest) { p.longest = c.listingTokens; p.longestName = s.name; }
  }
  return [...by.values()].map(p => ({ ...p, avg: p.skills ? Math.round(p.listingTokens / p.skills) : 0 })).sort((a, b) => b.listingTokens - a.listingTokens);
}

// Agent Skills spec checks: name 1-64 chars, lowercase letters, digits and single hyphens, equal to the folder name; description 1-1024 chars.
export function hygiene(s) {
  const issues = [];
  if (!s.hasFrontmatter) issues.push('no frontmatter');
  if (!s.hasName) issues.push('no name');
  else {
    if (s.name.length > 64) issues.push('name over 64 characters');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.name)) issues.push('name is not lowercase letters, digits and single hyphens');
    if (s.name !== s.dirName) issues.push('name differs from its folder name');
  }
  if (!s.description) issues.push('no description');
  else {
    if (s.description.length > 1024) issues.push('description over 1,024 characters');
    if (!/\b(?:use (?:this )?(?:skill )?(?:when|for|whenever|if)|when (?:the )?user|trigger|whenever|invoke when|use it when)\b/i.test(s.description)) issues.push('description says what it does but not when to use it');
  }
  if (s.bodyChars > 20000) issues.push('SKILL.md body over about 5,000 tokens');
  return issues;
}

// ---- collisions ----
const STOP = new Set(('a an the and or but if then else of to in on at by for with without from as is are was were be been being it its this that these those you your we our i me my they them their he she him her ' +
  'not no yes do does did done can could should would will may might must shall have has had get gets got also only any all each every more most some such than so too very just about into over under again once here there how what which who whom whose why ' +
  'use used uses using when whenever user users skill skills claude code agent agents ai assistant ask asks asked say says said want wants need needs help helps anything something someone trigger triggers triggered task tasks work works working mention mentions mentioned request requests ' +
  'include includes including e.g eg etc like new make makes made create creates created build builds write writes run runs add adds update updates check checks one two see via per both either other another own same ' +
  'file files project projects tool tools command commands').split(/\s+/));

const stem = (w) => w.length > 5 && /ies$/.test(w) ? w.slice(0, -3) + 'y' : w.length > 6 && /(?:ing|ed)$/.test(w) ? w.replace(/(?:ing|ed)$/, '') : w.length > 4 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w;
export function stems(text) {
  const out = new Set();
  for (const raw of String(text).toLowerCase().replace(/[`'"]/g, '').split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOP.has(raw) || /^\d+$/.test(raw)) continue;
    out.add(stem(raw));
  }
  return out;
}

// Two skills collide when their descriptions share enough informative words (Jaccard over stems at or above `threshold`, and at least
// `minShared` shared stems) or when they share a name. Report pairs with the shared words, never a verdict: whether two skills actually compete
// for the same request is a judgment the reader has to make.
export const COLLISION_DEFAULTS = { threshold: 0.30, minShared: 6 };
// df (off by default): ignore words that appear in more than this share of the skills being compared. A template phrase repeated across your own skills
// ("this is the sole trigger", "do not activate for any other reason") otherwise makes unrelated skills look alike. Applies to sets of 8 skills or more.
export function collisions(skills, { threshold = COLLISION_DEFAULTS.threshold, minShared = COLLISION_DEFAULTS.minShared, df = null } = {}) {
  const sets = skills.map(s => stems(s.description));
  if (df && skills.length >= 8) {
    const freq = new Map();
    for (const set of sets) for (const w of set) freq.set(w, (freq.get(w) || 0) + 1);
    for (const set of sets) for (const w of [...set]) if (freq.get(w) / skills.length > df) set.delete(w);
  }
  const pairs = [];
  for (let i = 0; i < skills.length; i++) for (let j = i + 1; j < skills.length; j++) {
    const a = skills[i], b = skills[j];
    const sameName = a.name.toLowerCase() === b.name.toLowerCase();
    let shared = 0; for (const w of sets[i]) if (sets[j].has(w)) shared++;
    const union = sets[i].size + sets[j].size - shared;
    const jac = union ? shared / union : 0;
    if (sameName || (shared >= minShared && jac >= threshold)) pairs.push({ a: a.name, aPack: a.pack, b: b.name, bPack: b.pack, jaccard: Math.round(jac * 100) / 100, shared: [...sets[i]].filter(w => sets[j].has(w)).slice(0, 10), sameName });
  }
  return pairs.sort((x, y) => Number(y.sameName) - Number(x.sameName) || y.jaccard - x.jaccard);
}

// Every pair's score, for sampling the benchmark labels (pairs just under the threshold are the near-misses).
export function allPairs(skills) {
  const sets = skills.map(s => stems(s.description)), out = [];
  for (let i = 0; i < skills.length; i++) for (let j = i + 1; j < skills.length; j++) {
    let shared = 0; for (const w of sets[i]) if (sets[j].has(w)) shared++;
    const union = sets[i].size + sets[j].size - shared;
    out.push({ i, j, shared, jaccard: union ? shared / union : 0 });
  }
  return out;
}
