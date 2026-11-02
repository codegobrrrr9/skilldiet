// Test helpers. No test touches the real home: SKILLDIET_FORBID_PREFIX makes the tool throw if it resolves a path under it.
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync, lstatSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { createHash } from 'node:crypto';

const REAL_HOME = homedir();

export function isolate() {
  const root = mkdtempSync(join(tmpdir(), 'skilldiet-t-'));
  const home = join(root, 'home'), claude = join(home, '.claude');
  for (const d of [home, claude, join(claude, 'skills'), join(claude, 'projects'), join(claude, 'plugins')]) mkdirSync(d, { recursive: true });
  const env = { HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: claude, SKILLDIET_FORBID_PREFIX: REAL_HOME };
  return { root, home, claude, skills: join(claude, 'skills'), env, apply() { Object.assign(process.env, env); } };
}

export function writeSkill(base, name, { description = 'Does a thing. Use when the user asks for the thing.', body = '# Body\nSteps.\n', frontmatter = null, mtime = null } = {}) {
  const dir = join(base, name);
  mkdirSync(dir, { recursive: true });
  const fm = frontmatter ?? `---\nname: ${name}\ndescription: ${description}\n---\n`;
  writeFileSync(join(dir, 'SKILL.md'), fm + body);
  if (mtime) { const t = new Date(mtime); import('node:fs').then(fs => fs.utimesSync(dir, t, t)); }
  return dir;
}

// a hash of a directory tree: names, and file contents (a junction/symlink counts as its target path)
export function treeHash(dir) {
  const h = createHash('sha256');
  const go = (d) => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n); const l = lstatSync(p);
      h.update(n + '|');
      if (l.isSymbolicLink()) h.update('->' + readlinkSync(p));
      else if (l.isDirectory()) go(p);
      else h.update(readFileSync(p));
    }
  };
  go(dir);
  return h.digest('hex');
}

export const line = (o) => JSON.stringify(o) + '\n';
export function writeTranscript(iso, project, session, objs, mtime) {
  const dir = join(iso.claude, 'projects', project); mkdirSync(dir, { recursive: true });
  const f = join(dir, session + '.jsonl'); writeFileSync(f, objs.map(line).join(''));
  if (mtime) { const t = new Date(mtime); import('node:fs').then(fs => fs.utimesSync(f, t, t)); }
  return f;
}
export const skillCall = (skill, ts = '2026-10-30T12:00:00.000Z') => ({ type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'x' + Math.random().toString(36).slice(2), name: 'Skill', input: { skill } }] } });
export const slashCall = (name, ts = '2026-10-30T12:05:00.000Z') => ({ type: 'user', timestamp: ts, message: { role: 'user', content: `<command-message>${name}</command-message>\n<command-name>/${name}</command-name>` } });
export { statSync };
