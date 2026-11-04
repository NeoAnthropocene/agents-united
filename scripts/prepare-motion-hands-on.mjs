import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const names = new Set(['--source', '--destination', '--cli']);
if (args.length % 2 || args.some((arg, i) => i % 2 === 0 && (!names.has(arg) || args.indexOf(arg) !== i)) || !args.includes('--source')) {
  console.error('Usage: node scripts/prepare-motion-hands-on.mjs --source <pilot> [--destination <fresh-directory>] [--cli <built-cli>]'); process.exit(1);
}
function option(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
const source = path.resolve(option('--source'));
const destination = path.resolve(option('--destination', path.join(repo, 'scratch/motion-hands-on')));
const cli = path.resolve(option('--cli', path.join(repo, 'dist/cli.js')));
const denied = /^(?:\.env(?:\..*)?|\.npmrc|\.netrc|node_modules|\.git|out-r\d.*|.*\.(?:key|pem|p12|pfx))$/i;
function copyTree(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true, dereference: false, filter: item => {
    const info = fs.lstatSync(item);
    return !info.isSymbolicLink() && !denied.test(path.basename(item));
  }});
}
try {
  function resolvedFuture(p) {
    let existing = p;
    while (!fs.existsSync(existing)) { const parent = path.dirname(existing); if (parent === existing) throw new Error('Cannot resolve destination'); existing = parent; }
    return path.resolve(fs.realpathSync(existing), path.relative(existing, p));
  }
  const realSource = fs.realpathSync(source), realDestination = resolvedFuture(destination);
  const relative = path.relative(realSource, realDestination);
  const reverse = path.relative(realDestination, realSource);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) || (!reverse.startsWith('..' + path.sep) && reverse !== '..' && !path.isAbsolute(reverse))) throw new Error('Source and destination must not overlap.');
  for (const lane of ['native', 'remotion']) {
    const media = path.join(source, lane, 'media');
    if (!fs.existsSync(media)) throw new Error(`Missing source media: ${lane}`);
    const relativeMedia = path.relative(realSource, fs.realpathSync(media));
    if (relativeMedia === '..' || relativeMedia.startsWith('..' + path.sep) || path.isAbsolute(relativeMedia)) throw new Error(`Source media escapes pilot: ${lane}`);
  }
  if (!fs.existsSync(cli)) throw new Error('Build the repository CLI first: npm run build');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(destination); // exclusive: never overwrite a previous session
  function copyRuntime(runtime, target) {
    if (!fs.existsSync(runtime)) return;
    const relRuntime = path.relative(realSource, fs.realpathSync(runtime));
    if (relRuntime === '..' || relRuntime.startsWith('..' + path.sep) || path.isAbsolute(relRuntime)) throw new Error('Runtime escapes pilot.');
    fs.cpSync(runtime, target, { recursive: true, filter: item => !fs.lstatSync(item).isSymbolicLink() && !/^(?:\.env(?:\..*)?|\.npmrc|\.netrc|.*\.(?:key|pem|p12|pfx))$/i.test(path.basename(item)) });
  }
  for (const lane of ['native', 'remotion']) {
    const dir = path.join(destination, lane);
    fs.mkdirSync(dir);
    for (const part of ['media', 'audio']) copyTree(path.join(source, lane, part), path.join(dir, part));
    for (const file of ['package.json', 'package-lock.json']) copyTree(path.join(source, lane, file), path.join(dir, file));
    copyRuntime(path.join(source, lane, 'node_modules'), path.join(dir, 'node_modules'));
    if (lane === 'native') copyRuntime(path.join(source, lane, 'media/native/node_modules'), path.join(dir, 'media/native/node_modules'));
    // Reuse the pinned runtime as a private copy, never as a link to the pilot.
    if (lane === 'remotion') {
      const runtime = path.join(source, lane, 'media/remotion/node_modules');
      copyRuntime(runtime, path.join(dir, 'media/remotion/node_modules'));
    }
    for (const bundle of ['digital-agency']) {
      const result = spawnSync(process.execPath, [cli, 'add', bundle, '-t', 'claude', '--native', '--copy', '-y'], { cwd: dir, encoding: 'utf8', windowsHide: true });
      if (result.status !== 0) throw new Error(`Install ${bundle} in ${lane} failed: ${result.stderr || result.stdout || result.error}`);
    }
    fs.writeFileSync(path.join(dir, 'BRIEF.md'), `# Hands-on motion exercise — ${lane}\n\nUse the copied chicken lifecycle as a historical starting point. Collaborate with me interactively to explore the new motion technique library. Propose a specific technique and proof before changing source; preserve the canonical timeline, audio and proof gates. Before Remotion production, verify compatible official Skills or complete the authorized project-local upstream install and actual host loading through remotion-production/references/setup-and-elements.md; preparation does not install the held vendored add-on. Ask before paid tools or external generation. Human visual, listening and perceived-sync approval are unverified. Historical records and the copied licence evaluation are not new approval or entitlement.\n`);
  }
  const hashes = {};
  function record(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const relative = path.join(prefix, entry.name), file = path.join(dir, entry.name);
      if (entry.isDirectory()) record(file, relative);
      else if (entry.isFile() && (relative.startsWith('media' + path.sep) || relative.startsWith('audio' + path.sep))) hashes[relative.replaceAll('\\', '/')] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
  for (const lane of ['native', 'remotion']) { record(path.join(destination, lane)); fs.writeFileSync(path.join(destination, lane, 'historical-sha256.json'), JSON.stringify(hashes, null, 2) + '\n'); for (const k of Object.keys(hashes)) delete hashes[k]; }
  console.log(`Prepared ${destination}. Historical evidence and licences are copied, not newly approved.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
