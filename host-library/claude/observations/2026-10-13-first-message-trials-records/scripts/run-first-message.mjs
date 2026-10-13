// One headless run of the first-message experiment (2026-10-13): the lead of fm\<variant> on Sonnet at low effort, the prompt of prompts\fm-<prompt>.txt, on the subscription.
// usage: node scripts\run-first-message.mjs <base|a|b> <p1|p2> <n>
// It removes every API key variable from the environment, sets the two team variables the interactive sittings set, caps the run (--max-budget-usd), writes results\fm-<variant>-<prompt>-<n>.json
// and then reads the newest session record of that folder with first-message.mjs. It never prints the command line, a key or a tool result.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [variant, promptId, n] = process.argv.slice(2);
if (!['base', 'a', 'b', 'c', 'd', 'e'].includes(variant) || !['p1', 'p2'].includes(promptId) || !n) { console.error('usage: node run-first-message.mjs base|a|b|c|d|e p1|p2 <n>'); process.exit(2); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const folder = path.join(root, 'fm', variant);
const prompt = fs.readFileSync(path.join(root, 'prompts', `fm-${promptId}.txt`), 'utf8').trim();
const result = path.join(root, 'results', `fm-${variant}-${promptId}-${n}.json`);
if (!fs.existsSync(path.join(folder, '.claude', 'agents', 'orchestrator-digital-agency.md'))) { console.error(`No installed team in ${folder}. Run scripts\\new-first-message-folders.ps1`); process.exit(1); }
if (fs.existsSync(result)) { console.error(`${result} exists: pick another n`); process.exit(1); }

const env = { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1', CLAUDE_CODE_ENABLE_TODO_TOOLS: '1' };
for (const name of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ARK_API_KEY']) delete env[name];
const args = ['-p', prompt, '--agent', 'orchestrator-digital-agency', '--model', 'sonnet', '--effort', 'low', '--output-format', 'json', '--max-budget-usd', '0.35'];
const started = Date.now();
const run = spawnSync(os.platform() === 'win32' ? path.join(os.homedir(), '.local', 'bin', 'claude.exe') : 'claude', args, { cwd: folder, env, input: '', encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
fs.mkdirSync(path.dirname(result), { recursive: true });
fs.writeFileSync(result, run.stdout || '');
let cost = '?'; let turns = '?'; let reply = '';
try { const j = JSON.parse(run.stdout); cost = j.total_cost_usd; turns = j.num_turns; reply = String(j.result || '').replace(/\s+/g, ' ').slice(0, 160); } catch { /* the summary below says what the record shows */ }
console.log(`run fm-${variant}-${promptId}-${n}: exit ${run.status}, ${((Date.now() - started) / 1000).toFixed(0)} s, turns ${turns}, cost ${cost} USD${run.error ? ', error ' + run.error.code : ''}`);
console.log(`final reply: ${JSON.stringify(reply)}`);

const slug = folder.replace(/[^a-zA-Z0-9]/g, '-');
const records = path.join(os.homedir(), '.claude', 'projects', slug);
const newest = fs.readdirSync(records).filter(f => f.endsWith('.jsonl')).map(f => ({ f, t: fs.statSync(path.join(records, f)).mtimeMs })).sort((x, y) => y.t - x.t)[0];
if (!newest) { console.log('no session record found'); process.exit(0); }
console.log(`session ${newest.f.slice(0, 8)}`);
const read = spawnSync('node', [path.join(root, 'scripts', 'first-message.mjs'), path.join(records, newest.f)], { encoding: 'utf8' });
console.log(read.stdout.trimEnd());
if (read.stderr) console.log(read.stderr.trimEnd());

// The decision log of the spike gate (names and counts only), when the folder's gate writes one.
const logFile = path.join(os.tmpdir(), 'agents-united', 'mode-line-' + newest.f.replace('.jsonl', '') + '.log');
if (fs.existsSync(logFile)) {
  console.log('gate decisions:');
  for (const row of fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean)) { try { const j = JSON.parse(row); console.log('   ' + j.at.slice(11, 23) + ' ' + j.tool + ' ' + j.event + ' ' + JSON.stringify({ ...j, at: undefined, tool: undefined, event: undefined })); } catch { /* not a record */ } }
}
