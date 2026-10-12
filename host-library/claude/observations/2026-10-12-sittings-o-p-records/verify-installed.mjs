// verify-installed.mjs: checks that what the install put into a scenario folder is the text of the branch under test.
// The model follows the text it loads, so a folder built from a stale build would test the wrong rule. This compares, file by file, what the two roles load
// for the image route with the same files in the clone: the skills image-generation and image-creation (every file), the creative designer's role text
// and the lead's. The managed-by comment line, the front matter and line endings are set aside. It reads files and prints; it writes nothing.
//
// usage: node scripts/verify-installed.mjs <folder> [--repo C:\path\to\clone]    (the clone defaults to $env:H10D_REPO, then to the worktree of PR 194)
// exit:  0 every file equal, 1 a file differs or is missing, 2 usage
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const folder = argv[0] && !argv[0].startsWith('--') ? path.resolve(argv[0]) : undefined;
const repo = path.resolve(flag('--repo') ?? process.env.H10D_REPO ?? 'C:\\github\\scratch-pilot\\wt-s19b');
if (!folder || !existsSync(folder)) {
  console.error('usage: node scripts/verify-installed.mjs <folder> [--repo <clone>]');
  process.exit(2);
}

const norm = text =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .split('\n')
    .filter(line => !/^<!-- managed-by:/.test(line))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
const walk = dir => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile()) out.push(p);
  }
  return out;
};
const rel = (root, file) => path.relative(root, file).replace(/\\/g, '/');

const pairs = [];
for (const skill of ['image-generation', 'image-creation']) {
  const source = path.join(repo, 'registry', 'skills', skill);
  const installed = path.join(folder, '.claude', 'skills', skill);
  const names = new Set([...(existsSync(source) ? walk(source) : []).map(f => rel(source, f)), ...(existsSync(installed) ? walk(installed) : []).map(f => rel(installed, f))]);
  // evals/ is never installed (it is for the repository's tests), so it is not compared.
  for (const name of [...names].filter(n => !n.startsWith('evals/')).sort()) pairs.push({ label: `skill ${skill}/${name}`, source: path.join(source, name), installed: path.join(installed, name) });
}
for (const agent of ['agency-creative-designer', 'orchestrator-digital-agency']) {
  pairs.push({
    label: `role ${agent}`,
    source: path.join(repo, 'registry', 'hosts', 'claude', 'agents', `${agent}.md`),
    installed: path.join(folder, '.claude', 'agents', `${agent}.md`),
  });
}

let different = 0;
for (const pair of pairs) {
  const has = [existsSync(pair.source) && statSync(pair.source).isFile(), existsSync(pair.installed) && statSync(pair.installed).isFile()];
  if (!has[0] || !has[1]) {
    different += 1;
    console.log(`DIFFERENT  ${pair.label}: ${has[0] ? 'not installed' : 'not in the clone'}`);
    continue;
  }
  const a = norm(readFileSync(pair.source, 'utf8'));
  const b = norm(readFileSync(pair.installed, 'utf8'));
  if (a === b) continue;
  different += 1;
  const x = a.split('\n');
  const y = b.split('\n');
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i += 1;
  console.log(`DIFFERENT  ${pair.label}: first difference at line ${i + 1}`);
  console.log(`  clone:     ${(x[i] ?? '(end)').slice(0, 140)}`);
  console.log(`  installed: ${(y[i] ?? '(end)').slice(0, 140)}`);
}
console.log(different ? `${different} of ${pairs.length} files differ: this folder does not hold the text of ${repo}. Build the clone (npm run build) and build the folder again.` : `OK: all ${pairs.length} files the roles load for the image route equal the clone's (${repo}).`);
process.exit(different ? 1 : 0);
