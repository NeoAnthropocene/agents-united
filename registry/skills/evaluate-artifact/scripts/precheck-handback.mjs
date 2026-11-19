#!/usr/bin/env node
// The hand-back hook of the factory evaluator (ADR 0070): a PreToolUse hook on the evaluator's hand-back tool, SubagentHandback. It asks the Skill's own checker
// (`check-review.mjs --precheck`) whether the caller's check would refuse the result that is being handed back. If so it blocks the hand-back (exit 2) and says why on
// stderr, which the Host shows to the evaluator; the evaluator corrects the listed items and hands the complete result back again.
//
// What it does, in order:
//   1. The hook input is JSON on stdin. The hand-back text is `tool_input.message` (hooks.md, SubagentStop). Anything else (another tool, no message) passes.
//   2. The text is written to a temporary file and checked as exactly one JSON object. If it is not (prose, a code fence, a syntax fault, an array, a string, a number,
//      null), the hand-back is blocked with the checker's own reason; no job is needed.
//   3. The result names its job by `jobDigest`. The pointer file `<temp>/agents-united/review-jobs/<jobDigest>.txt` (written by review-job.mjs, holding the absolute path of the
//      job file and nothing else) says where the job is. The pointer is only a locator and is never trusted: the checker verifies the job's own digest against the result's.
//      No pointer, or a `jobDigest` that is missing or mistyped, means that this worker is not doing a factory review, and the hand-back passes.
//   4. The checker runs with the job. Exit 1 (the result itself is refused) blocks; exit 0 passes; exit 3 (the environment is at fault: the job no longer checks, a pinned
//      file changed, the job at the pointer has another digest; the evaluator cannot repair that) passes, and the caller's check will report it.
//   5. It blocks at most TWO times for one worker, then lets the next hand-back through. The count is kept per session and agent id (`session_id` plus `agent_id` when the Host
//      gives an agent id; `session_id` alone otherwise, so that two evaluators of one session without an agent id share one count, which errs toward letting a hand-back through).
//      The number is two because the Host has a limit of its own (hooks.md:2026: it tells a worker whose hand-back is denied, up to three times, that the report was not
//      delivered, and then ends it without a report). The caller's check stays the judge; this hook only gives the evaluator the chance to correct itself.
//
// IT FAILS OPEN, on purpose. Any error of its own ends in exit 0, and its handler in the role's frontmatter carries NO `onFailure: "block"`. This differs from the guards
// of ADR 0068, which must fail closed: this is not a safety guard, a result it lets through is still checked by the caller, and a hook that blocked every hand-back whenever
// it failed would strand the worker (hooks.md:2026). So a thrown error, a rejected promise, a checker that crashes, hangs or says something unexpected, a count file that is
// corrupt or cannot be written, and a temp folder that cannot be used all end in exit 0. A count file that holds anything but a non-negative integer counts as the cap reached,
// so that a corrupt file can never block for ever. Count, pointer and temporary files older than a day are ignored and removed, so that an earlier journey cannot affect a new one.
//
// The temp folder is resolved ONCE with the real path (on macOS /var is a link, and the checker refuses a path that passes a link): the temporary result file, the count and
// the pointer lookup all use that path; review-job.mjs writes the pointer under the same resolved folder. The checker keeps its link rule for jobs and review roots.
//
// It writes nothing except its state under <temp>/agents-united/handback-checks/ and one temporary result file. The temporary file is removed on every exit path of this
// process (a normal end, process.exit, an uncaught exception, a rejected promise, a thrown spawnSync). A hook killed from outside (the Host's timeout, a signal) can leave it
// behind; the next run removes it once it is a day old. It runs no command except the checker. It does not run in a headless session (`claude -p` skips a project agent's
// frontmatter hooks, ADR 0042), and the Host provides SubagentHandback only in auto mode.
//
// The checker it runs is the check-review.mjs beside this file, resolved from this file's own location, and nothing else: no path, command or code is taken from the environment.
// Test-only seams, never set by the Host, named so that nobody sets them by accident, and ENUMERATED: AGENTS_UNITED_TEST_ONLY_HANDBACK_FAULT takes one name from a fixed list
// (uncaught | rejection | spawn | checker-crash | checker-exit2-silent | checker-not-json | checker-no-reason | checker-hang) and anything else is ignored; each fault is simulated
// inside this script around the checker's child call or its result. AGENTS_UNITED_TEST_ONLY_HANDBACK_TIMEOUT_MS takes a positive integer (milliseconds), clamped to 100..90000;
// any other value is ignored and the bound is 90000.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_BLOCKS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const SEAM = 'AGENTS_UNITED_TEST_ONLY_HANDBACK_';
const DEFAULT_TIMEOUT_MS = 90_000;
const requestedTimeout = /^[1-9][0-9]{0,8}$/.test(process.env[`${SEAM}TIMEOUT_MS`] ?? '') ? Number(process.env[`${SEAM}TIMEOUT_MS`]) : DEFAULT_TIMEOUT_MS;
const CHECK_TIMEOUT_MS = Math.min(Math.max(requestedTimeout, 100), DEFAULT_TIMEOUT_MS);
// The checker beside this file; the only one this hook ever runs.
const checker = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-review.mjs');
// The enumerated test-only faults. Only a name in this list has any effect.
const FAULTS = ['uncaught', 'rejection', 'spawn', 'checker-crash', 'checker-exit2-silent', 'checker-not-json', 'checker-no-reason', 'checker-hang'];
const fault = FAULTS.includes(process.env[`${SEAM}FAULT`]) ? process.env[`${SEAM}FAULT`] : null;
// What the checker's child would have returned, for the faults that simulate its result.
const SIMULATED = {
  'checker-crash': { status: 1, stderr: 'Error: test-only crash\n    at <anonymous>\n' },
  'checker-exit2-silent': { status: 2, stderr: '' },
  'checker-not-json': { status: 1, stderr: 'not json at all\n' },
  'checker-no-reason': { status: 1, stderr: `${JSON.stringify({ status: 'unavailable' })}\n` },
};
const safe = value => String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);

// The temporary result file is removed whenever this process ends, by whatever path.
let tempFile = null;
process.on('exit', () => {
  if (tempFile) { try { fs.rmSync(tempFile, { force: true }); } catch { /* a leftover temporary file is not a reason to block */ } }
});
process.on('uncaughtException', () => process.exit(0));
process.on('unhandledRejection', () => process.exit(0));

/** The state folder under the resolved temp folder, or null when there is none to use. */
function stateRoot() {
  try { return path.join(fs.realpathSync.native(os.tmpdir()), 'agents-united'); } catch { return null; }
}

/** Removes count, pointer and temporary result files older than a day; they are state of an earlier journey. */
function sweep(root) {
  const limit = Date.now() - DAY_MS;
  for (const [dir, pattern] of [[root, /^handback-.*\.json$/], [path.join(root, 'review-jobs'), /\.txt$/], [path.join(root, 'handback-checks'), /\.json$/]]) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const name of names) {
      if (!pattern.test(name)) continue;
      const file = path.join(dir, name);
      try { if (fs.statSync(file).isFile() && fs.statSync(file).mtimeMs < limit) fs.rmSync(file, { force: true }); } catch { /* best effort */ }
    }
  }
}

const readStdin = () => new Promise(resolve => {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; }).on('end', () => resolve(raw)).on('error', () => resolve(''));
});

/** The checker's reason, when it refused the result (exit 1); null for every other outcome, so that nothing but a refused result blocks. */
function refusedReason(run) {
  if (!run || run.status !== 1) return null;
  try {
    const reason = JSON.parse(String(run.stderr ?? '').trim().split('\n').filter(Boolean).pop()).reason;
    return typeof reason === 'string' && reason ? reason : null;
  } catch { return null; }
}

/** How many blocks this worker has used. A missing file is zero; anything else that is not a non-negative integer counts as the cap reached. */
function usedBlocks(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (error) { return error && error.code === 'ENOENT' ? 0 : MAX_BLOCKS; }
  try {
    const blocks = JSON.parse(text).blocks;
    return Number.isInteger(blocks) && blocks >= 0 ? blocks : MAX_BLOCKS;
  } catch { return MAX_BLOCKS; }
}

async function seamFault() {
  const kind = fault;
  if (kind === 'uncaught') await new Promise(() => setTimeout(() => { throw new Error('test-only fault'); }, 0));
  if (kind === 'rejection') { Promise.reject(new Error('test-only fault')); await new Promise(resolve => setTimeout(resolve, 50)); }
}

async function main() {
  let input;
  try { input = JSON.parse(await readStdin()); } catch { return process.exit(0); }
  if (!input || typeof input !== 'object' || input.tool_name !== 'SubagentHandback') return process.exit(0);
  const message = input.tool_input && input.tool_input.message;
  if (typeof message !== 'string' || !message.trim()) return process.exit(0);

  const root = stateRoot();
  if (!root) return process.exit(0);
  sweep(root);
  const file = path.join(root, `handback-${randomBytes(8).toString('hex')}.json`);
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(file, message);
    tempFile = file;
  } catch { return process.exit(0); }
  await seamFault();

  const run = args => {
    try {
      if (fault === 'spawn') throw new Error('test-only fault');
      if (fault && SIMULATED[fault]) return SIMULATED[fault];
      // checker-hang: a fixed child that never ends, so that the real time bound is what ends it.
      const argv = fault === 'checker-hang' ? ['-e', 'setTimeout(function () {}, 600000)'] : [checker, ...args];
      return spawnSync(process.execPath, argv, { encoding: 'utf8', timeout: CHECK_TIMEOUT_MS, windowsHide: true, maxBuffer: 1 << 20 });
    } catch { return { status: null, stderr: '' }; }
  };
  let reason = null;
  const alone = run(['--precheck', file]);
  if (alone.status === 1) reason = refusedReason(alone);
  else if (alone.status === 0) {
    let parsed = null;
    try { parsed = JSON.parse(message); } catch { return process.exit(0); }
    const digest = parsed && typeof parsed === 'object' && typeof parsed.jobDigest === 'string' && /^[a-f0-9]{64}$/.test(parsed.jobDigest) ? parsed.jobDigest : null;
    if (!digest) return process.exit(0);
    let job;
    try { job = fs.readFileSync(path.join(root, 'review-jobs', `${digest}.txt`), 'utf8').trim(); } catch { return process.exit(0); }
    if (!job || !path.isAbsolute(job)) return process.exit(0);
    reason = refusedReason(run(['--job', job, '--precheck', file]));
  }
  if (!reason) return process.exit(0);

  // One count per worker, whatever it was blocked for: the session and the agent id when the Host gives one, the session alone otherwise. Never the job digest.
  const key = createHash('sha256').update(`${safe(input.session_id)}:${safe(input.agent_id)}`).digest('hex').slice(0, 32);
  const stateFile = path.join(root, 'handback-checks', `${key}.json`);
  const blocks = usedBlocks(stateFile);
  if (blocks >= MAX_BLOCKS) return process.exit(0);
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ blocks: blocks + 1 }));
  } catch { return process.exit(0); /* a block that cannot be counted could repeat for ever */ }
  // The exit waits for the write to be flushed: the Host shows this text to the evaluator.
  process.stderr.write(`Hand-back check (agents-united), attempt ${blocks + 1} of ${MAX_BLOCKS}: your hand-back was NOT delivered, because the record check would refuse it. Correct every item listed below and hand back the complete result again as ONE JSON object; after ${MAX_BLOCKS} blocked attempts the hand-back goes through as it is.\n${reason}\n`, () => process.exit(2));
}

main().catch(() => process.exit(0));
