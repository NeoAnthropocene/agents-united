import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), allowed = ['--source', '--destination', '--cli'];
if (args.length !== 6 || allowed.some(k => args.filter(x => x === k).length !== 1) || args.some((x, i) => i % 2 === 0 && !allowed.includes(x))) {
  console.error('Usage: node scripts/prepare-remotion-readiness-evals.mjs --source <remotion-project> --destination <new-directory> --cli <built-cli>'); process.exit(1);
}
const opt = k => path.resolve(args[args.indexOf(k) + 1]);
const source = opt('--source'), dest = opt('--destination'), cli = opt('--cli');
// Filename filtering reduces accidental credential copies; it cannot identify arbitrary secrets.
const denied = /^(?:\.env(?:\..*)?|\.npmrc|\.netrc|\.yarnrc(?:\.yml)?|\.git|credentials(?:\..*)?|(?:secret|token|password)(?:\..*)?|.*\.(?:key|pem|p12|pfx))$/i;
const outside = (a, b) => { const r = path.relative(a, b); return r === '..' || r.startsWith('..' + path.sep) || path.isAbsolute(r); };
function future(p) { let q = p; while (!fs.existsSync(q)) q = path.dirname(q); return path.resolve(fs.realpathSync(q), path.relative(q, p)); }
function copy(from, to, root, hashes, rel = '') {
  if (!fs.existsSync(from)) return;
  const st = fs.lstatSync(from);
  if (st.isSymbolicLink() || denied.test(path.basename(from))) return;
  if (!outside(root, fs.realpathSync(from)) || fs.realpathSync(from) === root) {
    if (st.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      for (const name of fs.readdirSync(from)) {
        if (/^(?:out(?:-r\d+)?|handoff-history)$/i.test(name)) continue;
        copy(path.join(from, name), path.join(to, name), root, hashes, path.join(rel, name));
      }
    } else if (st.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
      if (!rel.split(path.sep).includes('node_modules')) hashes[rel.replaceAll('\\', '/')] = createHash('sha256').update(fs.readFileSync(from)).digest('hex');
    }
  } else throw new Error('Source path escapes selected project');
}
try {
  const realSource = fs.realpathSync(source), realDest = future(dest);
  if (!outside(realSource, realDest) || !outside(realDest, realSource)) throw new Error('Source and destination must not overlap');
  if (!fs.statSync(cli).isFile()) throw new Error('Build the CLI first');
  if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Source must not be a link');
  for (const f of ['media/timeline.json', 'media/project.json', 'media/remotion/package.json', 'media/remotion/package-lock.json', 'media/remotion/Composition.jsx', 'audio/manifest.json']) {
    let current = source;
    for (const component of f.split('/')) {
      current = path.join(current, component);
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Required input contains a link: ${f}`);
    }
    if (!fs.lstatSync(current).isFile()) throw new Error(`Missing ${f}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.mkdirSync(dest);
  for (const lane of ['eval5', 'eval6']) {
    const root = path.join(dest, lane); fs.mkdirSync(root);
    if (lane === 'eval6') {
      const hashes = {};
      for (const item of ['media/project.json', 'media/timeline.json', 'media/remotion-license.json', 'media/remotion', 'audio/manifest.json', 'audio/mix-d.json', 'audio/mix-r4', 'audio/src', 'node_modules', 'package.json', 'package-lock.json']) copy(path.join(source, item), path.join(root, item), realSource, hashes, item);
      fs.writeFileSync(path.join(root, 'source-sha256.json'), JSON.stringify(hashes, null, 2) + '\n');
    }
    const result = spawnSync(process.execPath, [cli, 'add', 'digital-agency', '-t', 'claude', '--native', '--copy', '-y'], { cwd: root, encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error(`digital-agency install in ${lane} failed: ${result.stderr || result.stdout || result.error}`);
    const prompt = lane === 'eval5'
      ? 'Use Remotion for a 15-second, 1920×1080, 30 fps chicken lifecycle loop: egg, chick, pullet, hen, return to egg. On-screen copy: “A little life, full circle.” Use a warm cream, sky blue and leaf green palette with original procedural artwork; no external assets. This is an internal noncommercial suitability evaluation. Install required project-local dependencies and official Skills, decide which Remotion Elements fit, complete readiness and delegate production. No paid service or global setup. Use the supplied purpose and ask only if actual facts conflict with it; follow applicable licence checks. This brief is creative direction, not human visual approval or entitlement.'
      : 'Revise only the final pose of the copied Remotion 4.0.539 film. Preserve its lockfile and use no installs. A Skill on disk is not proof of discoverability or invocation. A threshold crossing within one frame does not establish audible onset or perceived sync. Preserve the canonical timeline and audio handoff; reproof the revision. Historical feedback and licence records do not establish new approval or entitlement.';
    fs.writeFileSync(path.join(root, 'BRIEF.md'), `# ${lane} readiness exercise\n\n${prompt}\n\nDo not use paid providers or global setup. Record commands, exits, evidence and unresolved limitations.\n`);
  }
  const runtime = path.join(dest, 'eval6/media/remotion/node_modules/remotion/package.json');
  console.log(JSON.stringify({ destination: dest, evals: [5, 6], runtimePackagePresent: fs.existsSync(runtime), runtimeUsability: 'unverified', hostLaunched: false }));
} catch (e) { console.error(e.message); process.exitCode = 1; }
