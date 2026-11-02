// Where skills live. Every location comes from here so a test can prove no run touched the real home.
//   CLAUDE_CONFIG_DIR           Claude Code's config dir (default ~/.claude)
//   SKILLDIET_FORBID_PREFIX     tests set this to the REAL home: touching anything under it (outside the temp dir) throws

import { homedir, tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { realpathSync } from 'node:fs';

export function home(env = process.env) { return env.USERPROFILE && process.platform === 'win32' ? env.USERPROFILE : env.HOME || homedir(); }

export function roots(env = process.env) {
  const h = home(env);
  const claude = resolve(env.CLAUDE_CONFIG_DIR || join(h, '.claude'));
  return { home: h, claude, skills: join(claude, 'skills'), disabled: join(claude, 'skills-disabled'), plugins: join(claude, 'plugins'), projects: join(claude, 'projects') };
}

const norm = (p) => { let r; try { r = realpathSync(p); } catch { r = resolve(p); } return process.platform === 'win32' ? r.toLowerCase() : r; };
const under = (x, base) => x === base || x.startsWith(base.endsWith(sep) ? base : base + sep);

export function guard(p, env = process.env) {
  const forbid = env.SKILLDIET_FORBID_PREFIX;
  if (!forbid) return p;
  const t = norm(p);
  if (under(t, norm(tmpdir()))) return p;          // on Windows the temp dir lives inside the home
  if (under(t, norm(forbid))) throw new Error('skilldiet test guard: refusing to touch the real home (' + p.slice(0, 40) + '…)');
  return p;
}
