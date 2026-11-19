#!/usr/bin/env node
// The hand-back hook of the factory evaluator (ADR 0070): a PreToolUse hook on the evaluator's hand-back tool, SubagentHandback. It asks the Skill's own checker
// (`check-review.mjs --precheck`) whether the caller's check would refuse the result that is being handed back. If so it blocks the hand-back (exit 2) and says why on
// stderr, which the Host shows to the evaluator; the evaluator corrects the listed items and hands the complete result back again.
//
// What it does, in order:
//   1. The hook input is JSON on stdin. The hand-back text is `tool_input.message` (hooks.md, SubagentStop). Anything else (another tool, no message) passes.
//   2. The text is written to a temporary file and checked as exactly one JSON object. If it is not, the hand-back is blocked with the checker's not-JSON reason (no job needed).
//   3. The result names its job by `jobDigest`. The pointer file `<temp>/agents-united/review-jobs/<jobDigest>.txt` (written by review-job.mjs, holding the absolute path of the
//      job file and nothing else) says where the job is. The pointer is only a locator and is never trusted: the checker verifies the job's own digest against the result's.
//      No pointer means that this worker is not doing a factory review, and the hand-back passes.
//   4. The checker runs with the job. Exit 1 (the result is refused) blocks; exit 0 passes; exit 3 (the job or the input is at fault, which the evaluator cannot repair) passes.
//   5. It blocks at most TWO times for one worker (keyed by the agent id of the hook input, else by the session id and the job digest), then lets the next hand-back through.
//      The caller's check stays the judge; this hook only gives the evaluator the chance to correct itself.
//
// IT FAILS OPEN, on purpose. Any error of its own ends in exit 0, and its handler in the role's frontmatter carries NO `onFailure: "block"`. This differs from the guards
// of ADR 0068, which must fail closed: this is not a safety guard, a result it lets through is still checked by the caller, and a hook that blocked every hand-back whenever
// it failed would strand the worker (the Host tells a worker whose hand-back is denied that its report was not delivered, up to three times, and then ends it without a report:
// hooks.md:2026; two blocks keep this hook inside that limit under either reading of it, and the third attempt is delivered).
// It writes nothing except its state under <temp>/agents-united/handback-checks/ and the temporary result file, which it removes. It runs no command except the checker.
// It does not run in a headless session (`claude -p` skips a project agent's frontmatter hooks, ADR 0042), and the Host provides SubagentHandback only in auto mode.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_BLOCKS = 2;
const CHECK_TIMEOUT_MS = 90_000;
const checker = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-review.mjs');
const stateRoot = () => path.join(os.tmpdir(), 'agents-united');
const safe = value => String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);

const readStdin = () => new Promise(resolve => {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; }).on('end', () => resolve(raw)).on('error', () => resolve(''));
});

/** The checker's reason, when it refused the result (exit 1); null for every other outcome, so that nothing but a refused result blocks. */
function refusedReason(run) {
  if (run.status !== 1) return null;
  try {
    const reason = JSON.parse(run.stderr.trim().split('\n').filter(Boolean).pop()).reason;
    return typeof reason === 'string' && reason ? reason : null;
  } catch { return null; }
}

async function main() {
  let input;
  try { input = JSON.parse(await readStdin()); } catch { return process.exit(0); }
  if (!input || typeof input !== 'object' || input.tool_name !== 'SubagentHandback') return process.exit(0);
  const message = input.tool_input && input.tool_input.message;
  if (typeof message !== 'string' || !message.trim()) return process.exit(0);

  const root = stateRoot();
  const file = path.join(root, `handback-${randomBytes(8).toString('hex')}.json`);
  const finish = code => {
    try { fs.rmSync(file, { force: true }); } catch { /* a leftover temporary file is not a reason to block */ }
    process.exit(code);
  };
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(file, message);
  } catch { return finish(0); }

  const run = args => spawnSync(process.execPath, [checker, ...args], { encoding: 'utf8', timeout: CHECK_TIMEOUT_MS, windowsHide: true, maxBuffer: 1 << 20 });
  let digest = null;
  let reason = null;
  const alone = run(['--precheck', file]);
  if (alone.status === 1) reason = refusedReason(alone);
  else if (alone.status === 0) {
    let parsed = null;
    try { parsed = JSON.parse(message); } catch { return finish(0); }
    digest = parsed && typeof parsed === 'object' && typeof parsed.jobDigest === 'string' && /^[a-f0-9]{64}$/.test(parsed.jobDigest) ? parsed.jobDigest : null;
    if (!digest) return finish(0);
    let job;
    try { job = fs.readFileSync(path.join(root, 'review-jobs', `${digest}.txt`), 'utf8').trim(); } catch { return finish(0); }
    if (!job || !path.isAbsolute(job)) return finish(0);
    reason = refusedReason(run(['--job', job, '--precheck', file]));
  }
  if (!reason) return finish(0);

  const agent = safe(input.agent_id);
  const key = agent ? `agent-${agent}` : `session-${createHash('sha256').update(`${safe(input.session_id)}:${digest ?? 'none'}`).digest('hex').slice(0, 32)}`;
  const stateFile = path.join(root, 'handback-checks', `${key}.json`);
  let blocks = 0;
  try { blocks = Number(JSON.parse(fs.readFileSync(stateFile, 'utf8')).blocks) || 0; } catch { /* the first block of this worker */ }
  if (blocks >= MAX_BLOCKS) return finish(0);
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ blocks: blocks + 1 }));
  } catch { return finish(0); /* a block that cannot be counted could repeat for ever */ }
  // The exit waits for the write to be flushed: the Host shows this text to the evaluator.
  process.stderr.write(`Hand-back check (agents-united), attempt ${blocks + 1} of ${MAX_BLOCKS}: your hand-back was NOT delivered, because the record check would refuse it. Correct every item listed below and hand back the complete result again as ONE JSON object; after ${MAX_BLOCKS} blocked attempts the hand-back goes through as it is.\n${reason}\n`, () => finish(2));
}

process.on('uncaughtException', () => process.exit(0));
main().catch(() => process.exit(0));
