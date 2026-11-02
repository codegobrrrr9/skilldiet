// Which skills actually fire. Reads Claude Code session logs (local only) and counts, per skill: Skill tool calls and /slash commands.
// Only skill names are read out of a line; no message text is kept or printed.

import { createReadStream, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createInterface } from 'node:readline';
import { roots, guard } from './paths.js';

function listTranscripts(dir, env) {
  const out = [];
  const go = (d, left) => {
    let names; try { names = readdirSync(guard(d, env)); } catch { return; }
    for (const n of names) {
      const p = join(d, n); let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (left > 0) go(p, left - 1); } else if (n.endsWith('.jsonl')) out.push({ file: p, mtime: st.mtimeMs });
    }
  };
  go(dir, 6);
  return out;
}

export const normalizeName = (n) => String(n || '').replace(/^\//, '').trim();
const bare = (n) => { const m = normalizeName(n); const i = m.lastIndexOf(':'); return i >= 0 ? m.slice(i + 1) : m; };

// Returns { window: {files, from, to, days}, used: Map(name -> {count, sessions, last}) }. A name is stored as written ('docs' and 'anthropic-skills:docs'
// both count for the skill called docs, see matchUsage).
export async function readUsage({ env = process.env, days = null } = {}) {
  const files = listTranscripts(roots(env).projects, env).filter(f => !days || f.mtime >= Date.now() - days * 86400000);
  const used = new Map();
  const note = (name, session, when) => {
    const key = normalizeName(name); if (!key) return;
    const u = used.get(key) || used.set(key, { count: 0, sessions: new Set(), last: null }).get(key);
    u.count++; u.sessions.add(session); if (when && (!u.last || when > u.last)) u.last = when;
  };
  let from = null, to = null;
  for (const f of files) {
    from = from === null ? f.mtime : Math.min(from, f.mtime); to = to === null ? f.mtime : Math.max(to, f.mtime);
    const session = basename(f.file, '.jsonl');
    const rl = createInterface({ input: createReadStream(guard(f.file, env), { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line || (!line.includes('"Skill"') && !line.includes('command-name'))) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      const when = o && o.timestamp;
      const content = o && o.message && o.message.content;
      if (typeof content === 'string') { for (const m of content.matchAll(/<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/g)) note(m[1], session, when); continue; }
      for (const b of Array.isArray(content) ? content : []) {
        if (b && b.type === 'tool_use' && b.name === 'Skill' && b.input && typeof b.input.skill === 'string') note(b.input.skill, session, when);
        else if (b && b.type === 'text' && typeof b.text === 'string') for (const m of b.text.matchAll(/<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/g)) note(m[1], session, when);
      }
    }
  }
  return { window: { files: files.length, from, to, days: from === null ? 0 : Math.max(1, Math.round((Date.now() - from) / 86400000)) }, used };
}

// A skill counts as used if its name matches a recorded use, with or without a plugin prefix ('docs' and 'anthropic-skills:docs').
export function matchUsage(skill, used) {
  let count = 0, last = null, sessions = 0;
  for (const [name, u] of used) {
    if (name === skill.name || bare(name) === skill.name || name === skill.dirName || bare(name) === skill.dirName) { count += u.count; sessions += u.sessions.size; if (u.last && (!last || u.last > last)) last = u.last; }
  }
  return { count, sessions, last };
}
