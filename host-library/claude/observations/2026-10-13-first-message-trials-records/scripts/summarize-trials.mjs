// Reads every results\fm-<variant>-<prompt>-<n>.json of the first-message experiment (2026-10-13), finds its session record, runs first-message.mjs on it and prints ONE table plus the lead's words.
// usage: node scripts\summarize-trials.mjs [--detail]      (--detail adds every text block of the lead, as the lead wrote it)
// The three runs made before the gate was registered at settings level (base p1 1, a p1 1, b p1 1) are marked "gate off": `claude -p` skips the frontmatter hooks of a project agent, so no hold could happen in them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const detail = process.argv.includes('--detail');
const GATE_OFF = new Set(['fm-base-p1-1', 'fm-a-p1-1', 'fm-b-p1-1']);
const files = fs.readdirSync(path.join(root, 'results')).filter(f => /^fm-(base|a|b|c|d|e)-p[12]-\d+\.json$/.test(f)).sort((x, y) => {
  const key = f => { const m = /^fm-(\w+)-p(\d)-(\d+)\.json$/.exec(f); return ['base', 'a', 'b', 'c', 'd', 'e'].indexOf(m[1]) * 1000 + Number(m[2]) * 100 + Number(m[3]); };
  return key(x) - key(y);
});
const rows = [];
for (const f of files) {
  const name = f.replace('.json', '');
  const [, variant, prompt, n] = /^fm-(\w+)-(p\d)-(\d+)$/.exec(name);
  let session = '?';
  try { session = JSON.parse(fs.readFileSync(path.join(root, 'results', f), 'utf8')).session_id; } catch { /* a run that did not finish */ }
  const folder = path.join(root, 'fm', variant);
  const record = path.join(os.homedir(), '.claude', 'projects', folder.replace(/[^a-zA-Z0-9]/g, '-'), `${session}.jsonl`);
  if (!fs.existsSync(record)) { rows.push({ name, variant, prompt, n, session, missing: true }); continue; }
  const read = spawnSync('node', [path.join(root, 'scripts', 'first-message.mjs'), record], { encoding: 'utf8', env: { ...process.env, FULL: detail ? '1' : '' } });
  const summary = /SUMMARY (.*)/.exec(read.stdout)?.[1] ?? '';
  const get = re => re.exec(summary)?.[1] ?? '?';
  const searched = (/its searches returned: ([^;)]*)/.exec(summary)?.[1] ?? '?') + (/never searched for: ([^)]*)\)/.exec(summary)?.[1] && !/never searched for: none/.test(summary) ? ' (unsearched: ' + /never searched for: ([^)]*)\)/.exec(summary)[1] + ')' : '');
  rows.push({
    name, variant, prompt, n, session: session.slice(0, 8), gate: GATE_OFF.has(name) ? 'off' : 'on', holds: get(/holds=(\d+)/),
    line: get(/line: (message \d+|NEVER)/), before: get(/written before the first gated call: (yes|same message|NO|n\/a)/), accurate: get(/line accurate: (yes|NO|n\/a)/), searched, welcome: get(/welcome words: (.*)$/), text: read.stdout,
  });
}
console.log('run                 session   gate  holds  line         before-1st-gated  line-accurate  searches returned (callable)   welcome words');
for (const r of rows) {
  if (r.missing) { console.log(`${r.name.padEnd(19)} (no record)`); continue; }
  console.log(`${r.name.padEnd(19)} ${r.session}  ${r.gate.padEnd(4)}  ${r.holds.padEnd(5)}  ${r.line.padEnd(11)}  ${r.before.padEnd(16)}  ${r.accurate.padEnd(13)}  ${r.searched.padEnd(28)}   ${r.welcome}`);
}
const by = (pred) => rows.filter(r => !r.missing && pred(r));
const early = by(r => ['b', 'c', 'd'].includes(r.variant));
console.log('');
console.log(`runs: ${rows.length}; gate on: ${by(r => r.gate === 'on').length}; gate off: ${by(r => r.gate === 'off').length}`);
console.log(`line first from the start list (variants b, c, d): ${early.length} runs, line in message 1 in ${early.filter(r => r.line === 'message 1').length}, line NOT in agreement with the lead's own searches in ${early.filter(r => r.accurate === 'NO').length}`);
console.log(`line after the searches (variant e): ${by(r => r.variant === 'e').length} runs, line in message 2 in ${by(r => r.variant === 'e' && r.line === 'message 2').length}, in agreement with the lead's own searches in ${by(r => r.variant === 'e' && r.accurate === 'yes').length}`);
const gatedOn = by(r => r.gate === 'on' && r.before !== 'n/a');
const earlier = by(r => r.before !== 'n/a');
for (const v of ['base', 'a', 'b', 'c', 'd', 'e']) {
  const g = gatedOn.filter(r => r.variant === v);
  const all = earlier.filter(r => r.variant === v);
  console.log(`variant ${v}: gated runs ${all.length} (gate on ${g.length}), holds with the gate on ${g.map(r => r.holds).join(',') || '-'}, line in an EARLIER message than the first gated call in ${all.filter(r => r.before === 'yes').length}, in the same message in ${all.filter(r => r.before === 'same message').length}`);
}
if (detail) { console.log('\n=========== detail'); for (const r of rows) if (!r.missing) console.log(`\n--- ${r.name} (${r.session})\n${r.text.trimEnd()}`); }
