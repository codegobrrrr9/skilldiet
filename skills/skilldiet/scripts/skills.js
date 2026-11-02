// Find skills and read their frontmatter. Zero dependencies: a small parser for the part of YAML the Agent Skills spec uses
// (name, description, license, metadata), including quoted scalars and folded or literal block scalars.

import { readFileSync, readdirSync, statSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { roots, guard } from './paths.js';

export function parseFrontmatter(text) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!m) return { data: {}, body: text, hasFrontmatter: false };
  const lines = m[1].split(/\r?\n/);
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const km = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!km) continue;
    const [, key, rest] = km;
    let val = rest.trim();
    if (/^[>|][+-]?$/.test(val)) {                                   // folded or literal block scalar
      const fold = val[0] === '>';
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1] === '')) block.push(lines[++i].replace(/^\s+/, ''));
      val = fold ? block.join(' ').replace(/\s+/g, ' ').trim() : block.join('\n').trim();
    } else if (val === '') {                                         // nested mapping (metadata:) or a multi-line plain scalar
      const nested = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) nested.push(lines[++i].trim());
      val = key === 'metadata' ? '' : nested.join(' ');
    } else if ((val[0] === '"' || val[0] === "'") && !closes(val)) {  // a quoted scalar continued on following lines
      while (i + 1 < lines.length && !closes(val)) val += ' ' + lines[++i].trim();
    }
    else if (val[0] !== '"' && val[0] !== "'") {                      // a plain scalar continued on indented lines
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) val += ' ' + lines[++i].trim();
    }
    data[key] = unquote(val);
  }
  return { data, body: text.slice(m[0].length), hasFrontmatter: true };
}
function closes(v) { const q = v[0]; if (q !== '"' && q !== "'") return true; let i = 1; for (; i < v.length; i++) { if (q === '"' && v[i] === '\\') { i++; continue; } if (v[i] === q) { if (q === "'" && v[i + 1] === "'") { i++; continue; } return true; } } return false; }
function unquote(v) {
  if (v.length >= 2 && v[0] === '"' && v.endsWith('"')) return v.slice(1, -1).replace(/\\(["\\nt])/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
  if (v.length >= 2 && v[0] === "'" && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

// The line a skill costs every session: Claude Code lists "- name: description" for each skill it knows.
export const listingLine = (s) => `- ${s.name}: ${s.description}`;

function readSkill(dir, pack, owner, env) {
  const file = join(dir, 'SKILL.md');
  let text; try { text = readFileSync(guard(file, env), 'utf8'); } catch { return null; }
  const { data, body, hasFrontmatter } = parseFrontmatter(text);
  let st; try { st = statSync(dir); } catch { st = null; }
  return { name: String(data.name || basename(dir)), dirName: basename(dir), description: String(data.description || ''), hasFrontmatter, hasName: !!data.name, bodyChars: body.length, bytes: Buffer.byteLength(text), dir, file, pack, owner, mtime: st ? st.mtimeMs : 0, license: data.license || null };
}

function childDirs(base, env) {
  let names; try { names = readdirSync(guard(base, env)); } catch { return []; }
  return names.map(n => join(base, n)).filter(p => { try { return statSync(p).isDirectory() && existsSync(join(p, 'SKILL.md')); } catch { return false; } });
}

// Discover skills. owner: 'user' (a skill the user installed and can move), 'plugin' (managed by a plugin: disable the plugin instead), 'path' (a folder you pointed at).
export function discover({ env = process.env, project = null, paths = [], includePlugins = true } = {}) {
  const r = roots(env), out = [], seen = new Set();
  const add = (s) => { if (!s) return; const key = s.pack + '|' + s.dirName; if (seen.has(key)) return; seen.add(key); out.push(s); };
  for (const d of childDirs(r.skills, env)) add(readSkill(d, 'user', 'user', env));
  if (project) for (const d of childDirs(join(resolve(project), '.claude', 'skills'), env)) add(readSkill(d, 'project', 'user', env));
  if (includePlugins) {
    let installed = {};
    try { installed = JSON.parse(readFileSync(guard(join(r.plugins, 'installed_plugins.json'), env), 'utf8')).plugins || {}; } catch { /* no plugins */ }
    for (const [id, entries] of Object.entries(installed)) for (const e of Array.isArray(entries) ? entries : []) {
      if (!e || typeof e.installPath !== 'string') continue;
      for (const d of childDirs(join(e.installPath, 'skills'), env)) add(readSkill(d, 'plugin:' + id, 'plugin', env));
    }
  }
  for (const p of paths) {
    const base = resolve(p);
    const found = [...childDirs(base, env), ...childDirs(join(base, 'skills'), env), ...childDirs(join(base, '.claude', 'skills'), env)];
    if (existsSync(join(base, 'SKILL.md'))) found.push(base);
    for (const d of found) add(readSkill(d, 'path:' + basename(base), 'path', env));
  }
  return out;
}

export const isLink = (p) => { try { return lstatSync(p).isSymbolicLink() || (process.platform === 'win32' && realpathSync(p).toLowerCase() !== resolve(p).toLowerCase()); } catch { return false; } };
export { dirname };
