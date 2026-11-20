import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { checkHooks } from '../src/core/native-floor.js';
import { inspectNativeAgent, nativeGuardProblem } from '../src/core/native-guard.js';
import { nativeGuardFileHooks } from '../src/core/guard.js';
import { READ_ONLY_GUARD_MATCHER, readOnlyGuardFileHooks } from '../src/core/readonly-guard.js';
import { HANDBACK_CHECK_REFERENCE, HANDBACK_CHECK_ROLE, HANDBACK_MAX_BLOCKS, expectedWorkerHooks, handbackCheckHooks } from '../src/core/handback-check.js';
import type { LockfileManifest } from '../src/core/types.js';
import { prepareProductionEvaluator } from './helpers/factory-evaluator.js';
import { evaluationResult, evaluationTree, prepareEvaluationJob } from './helpers/factory-evaluation.js';
import { isolatedTempEnv } from './helpers/isolated-temp.js';

// ADR 0070: a PreToolUse hook on the evaluator's hand-back tool runs the checker's pre-check mode before the result leaves the evaluator.
// No Host runs here: the hook script is driven as a child process with the hook input on stdin, as the session-guard tests drive their script.

const SKILL = '.claude/skills/evaluate-artifact';
const HOOK = `${SKILL}/scripts/precheck-handback.mjs`;
const CHECKER = `${SKILL}/scripts/check-review.mjs`;
const AGENTS = path.resolve('registry/hosts/claude/agents');

describe('the hand-back hook entry of the factory evaluator', () => {
  const evaluator = fs.readFileSync(path.join(AGENTS, 'factory-evaluator.md'), 'utf8').replace(/\r\n/g, '\n');

  it('is the generated frontmatter: the read-only guard entry exactly as before, then the one hand-back entry, without onFailure', () => {
    const facts = inspectNativeAgent(evaluator);
    expect(facts.meta.hooks).toEqual({ PreToolUse: [
      readOnlyGuardFileHooks().PreToolUse[0],
      { matcher: 'SubagentHandback', hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/skills/evaluate-artifact/scripts/precheck-handback.mjs'] }] },
    ] });
    const handler = (facts.meta.hooks as any).PreToolUse[1].hooks[0];
    expect(Object.keys(handler)).toEqual(['type', 'command', 'args']);
    expect(handbackCheckHooks().PreToolUse[0]!.hooks[0]!.args).toEqual([HANDBACK_CHECK_REFERENCE]);
    expect(checkHooks(evaluator, expectedWorkerHooks('factory-evaluator', 'read-only'))).toEqual([]);
  });

  it('keeps the evaluator a read-only role with its guard file: the doctor sees one guard, no problem, and no extra script file to demand', () => {
    const facts = inspectNativeAgent(evaluator);
    expect(facts.guard).toBe('read-only');
    expect(facts.guardFiles).toEqual(['read-only']);
    expect(nativeGuardProblem(facts)).toBeUndefined();
  });

  it('does not overlap the guard: the guard matcher never matches the hand-back tool, and the hand-back matcher matches nothing else', () => {
    expect(new RegExp(`^(?:${READ_ONLY_GUARD_MATCHER})$`).test('SubagentHandback')).toBe(false);
    expect(new RegExp(`^(?:${handbackCheckHooks().PreToolUse[0]!.matcher})$`).test('SubagentHandback')).toBe(true);
    for (const tool of ['Read', 'Grep', 'ReportFindings', 'Write', 'Agent']) expect(new RegExp(`^(?:${handbackCheckHooks().PreToolUse[0]!.matcher})$`).test(tool)).toBe(false);
  });

  it('is the entry of this role only: every other committed native agent keeps exactly its guard', () => {
    expect(HANDBACK_CHECK_ROLE).toBe('factory-evaluator');
    for (const file of fs.readdirSync(AGENTS).filter(name => name.endsWith('.md') && name !== 'factory-evaluator.md')) {
      const text = fs.readFileSync(path.join(AGENTS, file), 'utf8');
      expect(text, file).not.toContain('precheck-handback');
      expect(/"matcher":"SubagentHandback"/.test(text), file).toBe(false);
    }
    expect(expectedWorkerHooks('factory-realizer', 'destructive')).toEqual(nativeGuardFileHooks());
    expect(expectedWorkerHooks('factory-sync', 'read-only')).toEqual(readOnlyGuardFileHooks());
    expect(expectedWorkerHooks('code-reviewer', 'read-only')).toEqual(readOnlyGuardFileHooks());
    expect(expectedWorkerHooks('factory-evaluator', 'destructive')).toEqual(nativeGuardFileHooks());
  });
});

describe('the hand-back hook script, the checker\'s pre-check mode and the pointer file', () => {
  let fixture: Awaited<ReturnType<typeof prepareProductionEvaluator>>;
  let temp: string;
  let selected: Awaited<ReturnType<typeof prepareEvaluationJob>>;
  let jobDigest: string;
  const env = (): NodeJS.ProcessEnv => isolatedTempEnv(temp);
  const node = (args: string[], input?: string, extra: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, args, {
    cwd: fixture.workspace, encoding: 'utf8', timeout: 60_000, input, env: { ...env(), ...extra },
  });
  const checker = (args: string[]) => node([fixture.installed(CHECKER), ...args]);
  const pointerFile = (digest = jobDigest) => path.join(temp, 'agents-united', 'review-jobs', `${digest}.txt`);
  const writePointer = async (digest = jobDigest, job = selected.jobFile) => { await fs.outputFile(pointerFile(digest), job); };
  const resultFile = () => path.join(selected.evidence, 'result.json');

  beforeEach(async () => {
    fixture = await prepareProductionEvaluator(await fs.mkdtemp(path.join(os.tmpdir(), 'au-handback-hook-')));
    temp = path.join(fixture.root, 'tmp');
    await fs.ensureDir(temp);
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
    selected = await prepareEvaluationJob(fixture);
    const preflight = checker(['--job', selected.jobFile]);
    expect(preflight.status, preflight.stderr).toBe(0);
    jobDigest = JSON.parse(preflight.stdout).jobDigest as string;
    await writePointer();
  });
  afterEach(async () => { await fs.remove(fixture.root); });

  const goodResult = () => evaluationResult(selected, { jobDigest });
  /** A result whose one citation names a line one off from where its quote begins: the kind of fault the pilot's evaluators made. */
  const badResult = () => {
    const result = goodResult();
    result.criteria[0]!.citations = [{ ...result.criteria[0]!.citations[0]!, line: 6, quote: 'Read only the supplied path.' }];
    return result;
  };
  const hookInput = (message: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({
    session_id: 'session-1', hook_event_name: 'PreToolUse', cwd: fixture.workspace, agent_id: 'agent-one', agent_type: 'factory-evaluator',
    tool_name: 'SubagentHandback', tool_input: { message }, tool_use_id: 'toolu_1', ...extra,
  });
  const hook = (message: unknown, extra: Record<string, unknown> = {}) => node([fixture.installed(HOOK)], hookInput(message, extra));
  const text = (result: unknown) => JSON.stringify(result, null, 2);

  it('is installed with the Skill, recorded in the lockfile as owned by the factory, and removed with it', async () => {
    expect(await fs.pathExists(fixture.installed(HOOK))).toBe(true);
    const lock = await fs.readJson(path.join(fixture.state, 'agents-united.json')) as LockfileManifest;
    expect(lock.projections?.[HOOK]?.owners).toEqual(['agent-factory']);
    expect(fixture.binding.requiredSupport).toContain('scripts/precheck-handback.mjs');
    const doctor = await DoctorEngine.runDoctor(fixture.state, 'claude');
    expect(doctor.issues).toEqual([]);
    expect(doctor.warnings.join('\n')).not.toMatch(/precheck|SubagentHandback/);
    await new UninstallEngine(new RegistryResolver(fixture.registry)).uninstall('agent-factory', { targetDir: fixture.state });
    expect(await fs.pathExists(fixture.installed(HOOK))).toBe(false);
    expect(await fs.pathExists(fixture.installed('.claude/agents/factory-evaluator.md'))).toBe(false);
  });

  it('lets a valid result through silently', () => {
    const run = hook(text(goodResult()));
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toBe('');
    expect(run.stderr).toBe('');
  });

  it('blocks a result with a bad citation: exit 2, one line that names the check and the attempt, then the checker\'s full reason', async () => {
    await fs.writeJson(resultFile(), badResult());
    const saved = checker(['--job', selected.jobFile, '--result', resultFile()]);
    expect(saved.status).toBe(1);
    const reason = (JSON.parse(saved.stderr) as { reason: string }).reason;
    const run = hook(text(badResult()));
    expect(run.status).toBe(2);
    expect(run.stdout).toBe('');
    const [first, ...rest] = run.stderr.trimEnd().split('\n');
    expect(first).toBe(`Hand-back check (agents-united), attempt 1 of ${HANDBACK_MAX_BLOCKS}: your hand-back was NOT delivered, because the record check would refuse it. Correct every item listed below and hand back the complete result again as ONE JSON object; after ${HANDBACK_MAX_BLOCKS} blocked attempts the hand-back goes through as it is.`);
    expect(rest.join('\n')).toBe(reason);
    expect(reason).toContain('criterion task-fit, citation 1');
  });

  it('keeps the cap inside the Host\'s own limit: the Host tells a worker whose hand-back is denied, up to three times, that its report was not delivered (hooks.md:2026), so the hook blocks fewer than three times', () => {
    expect(HANDBACK_MAX_BLOCKS).toBe(2);
    expect(HANDBACK_MAX_BLOCKS).toBeLessThan(3);
    // Through the hook: the first two attempts are blocked and the third is delivered.
    const message = JSON.stringify(badResult());
    expect([hook(message).status, hook(message).status, hook(message).status]).toEqual([2, 2, 0]);
  });

  it('counts per worker: the cap in blocks, then the next attempt of the same worker goes through; another worker starts at one', () => {
    const message = text(badResult());
    for (let attempt = 1; attempt <= HANDBACK_MAX_BLOCKS; attempt++) {
      const run = hook(message);
      expect(run.status).toBe(2);
      expect(run.stderr.split('\n')[0]).toContain(`attempt ${attempt} of ${HANDBACK_MAX_BLOCKS}:`);
    }
    const next = hook(message);
    expect(next.status).toBe(0);
    expect(next.stderr).toBe('');
    const other = hook(message, { agent_id: 'agent-two' });
    expect(other.status).toBe(2);
    expect(other.stderr.split('\n')[0]).toContain(`attempt 1 of ${HANDBACK_MAX_BLOCKS}:`);
  });

  it('blocks prose and a fenced record with the not-JSON reason, even when no pointer exists', async () => {
    await fs.remove(pointerFile());
    const prose = hook('RESULT DATA (job sample-review)\n\n## Criteria\n- task-fit: fine\n');
    expect(prose.status).toBe(2);
    expect(prose.stderr).toContain('Result is not valid JSON');
    expect(prose.stderr).toContain('exactly ONE JSON object');
    const fenced = hook(`\`\`\`json\n${text(goodResult())}\n\`\`\`\n`, { agent_id: 'agent-fence' });
    expect(fenced.status).toBe(2);
    expect(fenced.stderr).toContain('code fence');
  });

  it('blocks a result with a JSON syntax fault with the parser position', () => {
    const run = hook(`${text(goodResult()).slice(0, 400)}, "broken": }`);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('Result is not valid JSON');
  });

  it('blocks nothing for JSON without a pointer: the worker is not doing a factory review', async () => {
    await fs.remove(pointerFile());
    const run = hook(text(badResult()));
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    expect(hook(JSON.stringify({ some: 'other record' })).status).toBe(0);
  });

  it('blocks nothing for a missing or malformed hook input', () => {
    for (const input of ['', 'not json', '{}', '[]', JSON.stringify({ tool_name: 'SubagentHandback' }), JSON.stringify({ tool_name: 'SubagentHandback', tool_input: { message: 12 } }),
      JSON.stringify({ tool_name: 'Read', tool_input: { message: text(badResult()) } })]) {
      const run = node([fixture.installed(HOOK)], input);
      expect(run.status, input).toBe(0);
      expect(run.stderr, input).toBe('');
    }
  });

  it('fails open on its own errors: no usable temp folder, a pointer to a missing job, a job that no longer checks', async () => {
    // The temp folder is a file: nothing can be created in it.
    const file = path.join(fixture.root, 'not-a-folder');
    await fs.writeFile(file, 'x');
    const noTemp = node([fixture.installed(HOOK)], hookInput(text(badResult())), { TEMP: file, TMP: file, TMPDIR: file });
    expect(noTemp.status, noTemp.stderr).toBe(0);
    // The pointer names a job that is gone.
    await writePointer(jobDigest, path.join(fixture.root, 'gone', 'job.json'));
    expect(hook(text(badResult())).status).toBe(0);
    // The job no longer checks (the candidate changed after the job was built): the fault is the job's, not the result's.
    await writePointer();
    await fs.appendFile(path.join(selected.candidate, 'SKILL.md'), 'A late edit.\n');
    const drifted = hook(text(badResult()), { agent_id: 'agent-drift' });
    expect(drifted.status, drifted.stderr).toBe(0);
    expect(drifted.stderr).toBe('');
  });

  it('writes nothing but its temp state, removes its temporary result file, and leaves the review and candidate folders untouched', async () => {
    const before = { candidate: await evaluationTree(selected.candidate), evidence: await evaluationTree(selected.evidence), workspace: await evaluationTree(fixture.workspace) };
    expect(hook(text(badResult())).status).toBe(2);
    expect(hook(text(goodResult()), { agent_id: 'agent-good' }).status).toBe(0);
    expect({ candidate: await evaluationTree(selected.candidate), evidence: await evaluationTree(selected.evidence), workspace: await evaluationTree(fixture.workspace) }).toEqual(before);
    const left = (await fs.readdir(path.join(temp, 'agents-united'))).sort();
    expect(left.some(name => name.startsWith('handback-') && name.endsWith('.json'))).toBe(false);
    expect(left).toEqual(expect.arrayContaining(['review-jobs', 'handback-checks']));
  });

  // The hook resolves its temp folder once (macOS: /var is a link). The checker keeps refusing a path that passes a link, for jobs and review roots.
  const LINKS = (() => {
    try {
      const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'au-link-probe-'));
      const link = `${probe}-link`;
      fs.symlinkSync(probe, link, process.platform === 'win32' ? 'junction' : 'dir');
      fs.rmSync(link, { recursive: true, force: true });
      fs.rmSync(probe, { recursive: true, force: true });
      return true;
    } catch { return false; }
  })();
  const stateDir = () => path.join(temp, 'agents-united', 'handback-checks');
  const leftovers = async (): Promise<string[]> => ((await fs.pathExists(path.join(temp, 'agents-united'))) ? await fs.readdir(path.join(temp, 'agents-united')) : []).filter(name => /^handback-.*\.json$/.test(name));
  const noAgent = { agent_id: undefined, agent_type: undefined };
  const firstLine = (run: { stderr: string }) => run.stderr.split('\n')[0];

  it.skipIf(!LINKS)('still blocks when the temp folder path passes a link: the hook resolves it once, and the checker keeps its symlink rule', async () => {
    const real = path.join(fixture.root, 'real-tmp');
    const link = path.join(fixture.root, 'linked-tmp');
    await fs.ensureDir(real);
    fs.symlinkSync(real, link, process.platform === 'win32' ? 'junction' : 'dir');
    await fs.outputFile(path.join(real, 'agents-united', 'review-jobs', `${jobDigest}.txt`), selected.jobFile);
    // The checker refuses a result file whose path passes a link (exit 3, the input's fault); that rule is not relaxed.
    await fs.writeJson(path.join(real, 'x.json'), goodResult());
    expect(checker(['--precheck', path.join(link, 'x.json')]).status).toBe(3);
    const linked = { TEMP: link, TMP: link, TMPDIR: link };
    const run = node([fixture.installed(HOOK)], hookInput(text(badResult())), linked);
    expect(run.status, run.stderr).toBe(2);
    expect(firstLine(run)).toContain(`attempt 1 of ${HANDBACK_MAX_BLOCKS}:`);
    expect(await fs.readdir(path.join(real, 'agents-united', 'handback-checks'))).toHaveLength(1);
  });

  it('counts one worker\'s blocks together, whatever they were for, and never by job digest', () => {
    // A prose block (no digest) and a JSON block (a digest) are two blocks of one worker.
    const first = hook('RESULT DATA\n\nprose only', noAgent);
    expect(first.status).toBe(2);
    expect(firstLine(first)).toContain(`attempt 1 of ${HANDBACK_MAX_BLOCKS}:`);
    const second = hook(text(badResult()), noAgent);
    expect(second.status).toBe(2);
    expect(firstLine(second)).toContain(`attempt 2 of ${HANDBACK_MAX_BLOCKS}:`);
    expect(hook('still prose', noAgent).status).toBe(0);
    expect(hook(text(badResult()), noAgent).status).toBe(0);
    expect(firstLine(hook(text(badResult()), { ...noAgent, session_id: 'session-2' }))).toContain(`attempt 1 of ${HANDBACK_MAX_BLOCKS}:`);
  });

  it('without an agent id, two evaluators of one session share one count (it errs toward letting a hand-back through); with one, the key is session plus agent', () => {
    expect(hook(text(badResult()), noAgent).status).toBe(2);
    expect(hook(text(badResult()), noAgent).status).toBe(2);
    // A fresh evaluator in the same session finds the count used up and is let through.
    expect(hook(text(badResult()), noAgent).status).toBe(0);
    // With an agent id: another agent of the session starts at one, and the same agent id in another session starts at one.
    expect(firstLine(hook(text(badResult()), { agent_id: 'agent-a' }))).toContain(`attempt 1 of ${HANDBACK_MAX_BLOCKS}:`);
    expect(firstLine(hook(text(badResult()), { agent_id: 'agent-b' }))).toContain(`attempt 1 of ${HANDBACK_MAX_BLOCKS}:`);
    expect(firstLine(hook(text(badResult()), { agent_id: 'agent-a' }))).toContain(`attempt 2 of ${HANDBACK_MAX_BLOCKS}:`);
    expect(firstLine(hook(text(badResult()), { agent_id: 'agent-a', session_id: 'session-9' }))).toContain(`attempt 1 of ${HANDBACK_MAX_BLOCKS}:`);
  });

  it.each([
    ['an array', '[1, 2, 3]'],
    ['a string', '"all fine"'],
    ['a number', '42'],
    ['null', 'null'],
  ])('blocks a hand-back that is %s, with the checker\'s own reason for it', async (_name, content) => {
    await fs.writeFile(resultFile(), content);
    const saved = checker(['--job', selected.jobFile, '--result', resultFile()]);
    expect(saved.status).toBe(1);
    const reason = (JSON.parse(saved.stderr) as { reason: string }).reason;
    expect(reason).toBe('result: expected object.');
    const run = hook(content);
    expect(run.status, run.stderr).toBe(2);
    expect(run.stderr).toContain(reason);
    const alone = checker(['--precheck', resultFile()]);
    expect(alone.status).toBe(1);
    expect((JSON.parse(alone.stderr) as { reason: string }).reason).toBe(reason);
  });

  it('lets a hand-back through when the job at the pointer was rebuilt with another digest (the environment, not the result), and still blocks a wrong candidate digest', async () => {
    const stranger = 'f'.repeat(64);
    await writePointer(stranger);
    const rebuilt = { ...goodResult(), jobDigest: stranger };
    expect(hook(text(rebuilt)).status).toBe(0);
    await fs.writeJson(resultFile(), rebuilt);
    const saved = checker(['--job', selected.jobFile, '--result', resultFile()]);
    const pre = checker(['--job', selected.jobFile, '--precheck', resultFile()]);
    expect(saved.status).toBe(1);
    expect(pre.status).toBe(3);
    expect((JSON.parse(pre.stderr) as { reason: string }).reason).toBe((JSON.parse(saved.stderr) as { reason: string }).reason);
    // The right job digest with a wrong candidate digest is the result's own fault.
    const wrong = hook(text({ ...goodResult(), candidateDigest: 'a'.repeat(64) }), { agent_id: 'agent-wrong' });
    expect(wrong.status).toBe(2);
    expect(wrong.stderr).toContain('Result fixed job/candidate digest mismatch.');
  });

  it.each([
    ['an uncaught exception', 'uncaught'],
    ['a rejected promise', 'rejection'],
    ['a thrown spawnSync', 'spawn'],
  ])('fails open and leaves no temporary file on %s', async (_name, fault) => {
    const run = node([fixture.installed(HOOK)], hookInput(text(badResult())), { AGENTS_UNITED_TEST_ONLY_HANDBACK_FAULT: fault });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    expect(await leftovers()).toEqual([]);
  });

  // The seams are enumerated: one variable whose value names a fault from a fixed list, and a number. No path, command or code comes from the environment.
  it.each([
    ['crashes', 'checker-crash'],
    ['exits 2 with no output', 'checker-exit2-silent'],
    ['writes stderr that is not the expected JSON', 'checker-not-json'],
    ['writes JSON without a reason', 'checker-no-reason'],
    ['hangs past the bound', 'checker-hang'],
  ])('lets the hand-back through, silently, when the checker %s', async (_name, fault) => {
    const run = node([fixture.installed(HOOK)], hookInput(text(badResult())), { AGENTS_UNITED_TEST_ONLY_HANDBACK_FAULT: fault, AGENTS_UNITED_TEST_ONLY_HANDBACK_TIMEOUT_MS: '700' });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    expect(await leftovers()).toEqual([]);
  });

  it('runs only the check-review.mjs beside it: the removed checker variable, set to a script that exits 0 for everything, has no effect', async () => {
    const fake = path.join(fixture.root, 'always-fine.mjs');
    await fs.writeFile(fake, 'process.exit(0);');
    const run = node([fixture.installed(HOOK)], hookInput(text(badResult())), { AGENTS_UNITED_TEST_ONLY_HANDBACK_CHECKER: fake });
    expect(run.status, run.stderr).toBe(2);
    expect(firstLine(run)).toContain(`attempt 1 of ${HANDBACK_MAX_BLOCKS}:`);
    expect(fs.readFileSync(fixture.installed(HOOK), 'utf8')).not.toMatch(/process\.env\[[^\]]*CHECKER/);
  });

  it.each([
    ['an unknown fault name', { AGENTS_UNITED_TEST_ONLY_HANDBACK_FAULT: 'checker-crash; rm -rf /' }],
    ['a fault name in the wrong case', { AGENTS_UNITED_TEST_ONLY_HANDBACK_FAULT: 'CHECKER-CRASH' }],
    ['a timeout that is not a number', { AGENTS_UNITED_TEST_ONLY_HANDBACK_TIMEOUT_MS: 'soon' }],
    ['a timeout of zero', { AGENTS_UNITED_TEST_ONLY_HANDBACK_TIMEOUT_MS: '0' }],
    ['a negative timeout', { AGENTS_UNITED_TEST_ONLY_HANDBACK_TIMEOUT_MS: '-5' }],
    ['a fractional timeout', { AGENTS_UNITED_TEST_ONLY_HANDBACK_TIMEOUT_MS: '1.5' }],
    ['a timeout that is a path', { AGENTS_UNITED_TEST_ONLY_HANDBACK_TIMEOUT_MS: 'C:\\temp\\x.mjs' }],
  ])('ignores %s: a bad hand-back is still blocked', (_name, seam) => {
    const run = node([fixture.installed(HOOK)], hookInput(text(badResult())), seam);
    expect(run.status, run.stderr).toBe(2);
  });

  it.each([
    ['a string', '"x"'],
    ['a negative number', '{"blocks":-1}'],
    ['a non-integer', '{"blocks":1.5}'],
    ['a number in a string', '{"blocks":"1"}'],
    ['an absurd number', '{"blocks":1000000000000}'],
    ['no count at all', '{}'],
    ['not JSON', 'not json {'],
    ['empty', ''],
  ])('treats a count file that holds %s as the cap reached, so a corrupt file never blocks for ever', async (_name, content) => {
    expect(hook(text(badResult())).status).toBe(2);
    const [name] = await fs.readdir(stateDir());
    await fs.writeFile(path.join(stateDir(), name!), content);
    const run = hook(text(badResult()));
    expect(run.status, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
  });

  it('lets the hand-back through when the count cannot be written or read', async () => {
    await fs.outputFile(stateDir(), 'a file where the folder goes');
    expect(hook(text(badResult())).status).toBe(0);
  });

  it('ignores and removes count, pointer and temporary files older than a day', async () => {
    expect(hook(text(badResult())).status).toBe(2);
    expect(hook(text(badResult())).status).toBe(2);
    expect(hook(text(badResult())).status).toBe(0);
    const old = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const [name] = await fs.readdir(stateDir());
    await fs.utimes(path.join(stateDir(), name!), old, old);
    const again = hook(text(badResult()));
    expect(again.status, again.stderr).toBe(2);
    expect(firstLine(again)).toContain(`attempt 1 of ${HANDBACK_MAX_BLOCKS}:`);
    const leftover = path.join(temp, 'agents-united', 'handback-deadbeef.json');
    await fs.outputFile(leftover, '{}');
    await fs.utimes(leftover, old, old);
    await fs.utimes(pointerFile(), old, old);
    const stale = hook(text(badResult()), { agent_id: 'agent-stale' });
    expect(stale.status).toBe(0);
    expect(await fs.pathExists(pointerFile())).toBe(false);
    expect(await fs.pathExists(leftover)).toBe(false);
  });

  it('reads the same cap in the script as in the constant', () => {
    const source = fs.readFileSync(fixture.installed(HOOK), 'utf8');
    expect(Number(/const MAX_BLOCKS = (\d+);/.exec(source)?.[1])).toBe(HANDBACK_MAX_BLOCKS);
  });

  it('in pre-check mode a result file that is missing or over the byte budget is the environment\'s fault (exit 3); the saved-file mode keeps exit 1', async () => {
    const absent = path.join(temp, 'no-such-result.json');
    const pre = checker(['--job', selected.jobFile, '--precheck', absent]);
    expect(pre.status, pre.stderr).toBe(3);
    const saved = checker(['--job', selected.jobFile, '--result', resultFile()]);
    expect(saved.status).toBe(1);
    expect((JSON.parse(saved.stderr) as { reason: string }).reason).toMatch(/missing ordinary file/);
    const big = path.join(temp, 'big-result.json');
    await fs.writeFile(big, ' '.repeat((selected.job.budget as { maxResultBytes: number }).maxResultBytes + 1));
    expect(checker(['--job', selected.jobFile, '--precheck', big]).status).toBe(3);
    await fs.copy(big, resultFile());
    expect(checker(['--job', selected.jobFile, '--result', resultFile()]).status).toBe(1);
  });

  it('removes a temporary file whose write failed midway', async () => {
    const run = node([fixture.installed(HOOK)], hookInput(text(badResult())), { AGENTS_UNITED_TEST_ONLY_HANDBACK_FAULT: 'temp-write-fail' });
    expect(run.status, run.stderr).toBe(0);
    expect(await leftovers()).toEqual([]);
  });

  it.each([
    ['empty', ''],
    ['only white space', '  \n\t \n'],
  ])('blocks a hand-back that is %s: it is not a JSON object', (_name, content) => {
    const run = hook(content);
    expect(run.status, run.stderr).toBe(2);
    expect(run.stderr).toContain('Result is not valid JSON');
  });

  it('lets a hand-back larger than the checker\'s byte limit through: it cannot be checked, and the caller\'s check decides', () => {
    const run = hook('x'.repeat(300_000));
    expect(run.status, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
  });

  it('lets the hand-back through when the SECOND checker call, the one with the job, fails', () => {
    expect(hook(text(badResult())).status).toBe(2);
    const run = node([fixture.installed(HOOK)], hookInput(text(badResult()), { agent_id: 'agent-second' }), { AGENTS_UNITED_TEST_ONLY_HANDBACK_FAULT: 'checker-second-crash' });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
  });

  it.skipIf(typeof process.getuid === 'function' && process.getuid() === 0)('lets the hand-back through when the count can be read but not written, and leaves the count as it was', async () => {
    expect(hook(text(badResult())).status).toBe(2);
    const [name] = await fs.readdir(stateDir());
    const file = path.join(stateDir(), name!);
    await fs.chmod(file, 0o444);
    try {
      const run = hook(text(badResult()));
      expect(run.status, run.stderr).toBe(0);
      expect((JSON.parse(await fs.readFile(file, 'utf8')) as { blocks: number }).blocks).toBe(1);
    } finally { await fs.chmod(file, 0o644); }
  });

  it('counts a worker whose hook input has no session id (the key is the agent id alone), and workers with neither id (one shared count, which errs toward passing)', () => {
    const agentOnly = { session_id: undefined };
    expect(firstLine(hook(text(badResult()), agentOnly))).toContain(`attempt 1 of ${HANDBACK_MAX_BLOCKS}:`);
    expect(firstLine(hook(text(badResult()), agentOnly))).toContain(`attempt 2 of ${HANDBACK_MAX_BLOCKS}:`);
    expect(hook(text(badResult()), agentOnly).status).toBe(0);
    const neither = { session_id: undefined, agent_id: undefined, agent_type: undefined };
    expect(hook(text(badResult()), neither).status).toBe(2);
    expect(hook(text(badResult()), neither).status).toBe(2);
    expect(hook(text(badResult()), neither).status).toBe(0);
  });

  it('lets the hand-back through, and creates nothing, when the temp folder does not exist yet', async () => {
    const missing = path.join(fixture.root, 'not-yet');
    const run = node([fixture.installed(HOOK)], hookInput(text(badResult())), { TEMP: missing, TMP: missing, TMPDIR: missing });
    expect(run.status, run.stderr).toBe(0);
    expect(await fs.pathExists(missing)).toBe(false);
  });

  describe('the pre-check mode of check-review.mjs', () => {
    const fixtures: Array<[string, () => unknown]> = [
      ['a valid result', () => goodResult()],
      ['a citation whose line is one off', () => badResult()],
      ['a quote found nowhere in the file', () => {
        const result = goodResult();
        result.criteria[0]!.citations = [{ ...result.criteria[0]!.citations[0]!, quote: 'A sentence the candidate does not contain.' }];
        return result;
      }],
      ['an unknown property', () => ({ ...goodResult(), extra: true })],
    ];

    it.each(fixtures)('decides %s as the saved-file mode does, with the same reason and details', async (_name, make) => {
      await fs.writeJson(resultFile(), make());
      const saved = checker(['--job', selected.jobFile, '--result', resultFile()]);
      const elsewhere = path.join(temp, 'anywhere', 'candidate-result.json');
      await fs.copy(resultFile(), elsewhere);
      const pre = checker(['--job', selected.jobFile, '--precheck', elsewhere]);
      expect(pre.status, pre.stderr).toBe(saved.status);
      if (saved.status === 0) expect(JSON.parse(pre.stdout)).toMatchObject({ recordValid: true, precheck: true, candidateMatch: true, acceptedDraft: false });
      else {
        const a = JSON.parse(saved.stderr) as Record<string, unknown>, b = JSON.parse(pre.stderr) as Record<string, unknown>;
        expect(b.reason).toBe(a.reason);
        expect(b.details).toEqual(a.details);
      }
    });

    it.each([
      ['prose', () => 'RESULT DATA (job sample-review)\n\n## Criteria\n'],
      ['a record followed by text', () => `${JSON.stringify(goodResult())}\n\nThat is my review.\n`],
      ['a record in a code fence', () => `\`\`\`json\n${JSON.stringify(goodResult())}\n\`\`\`\n`],
    ])('decides %s as the saved-file mode does', async (_name, content) => {
      await fs.writeFile(resultFile(), content());
      const saved = checker(['--job', selected.jobFile, '--result', resultFile()]);
      const pre = checker(['--job', selected.jobFile, '--precheck', resultFile()]);
      expect(saved.status).toBe(1);
      expect(pre.status).toBe(1);
      expect((JSON.parse(pre.stderr) as { reason: string }).reason).toBe((JSON.parse(saved.stderr) as { reason: string }).reason);
      // Without a job the same reason is given: the parse needs none.
      const alone = checker(['--precheck', resultFile()]);
      expect(alone.status).toBe(1);
      expect((JSON.parse(alone.stderr) as { reason: string }).reason).toBe((JSON.parse(saved.stderr) as { reason: string }).reason);
    });

    it('checks only that a record is JSON when no job is given, and exits 0 for one', async () => {
      await fs.writeJson(resultFile(), goodResult());
      const alone = checker(['--precheck', resultFile()]);
      expect(alone.status, alone.stderr).toBe(0);
      expect(JSON.parse(alone.stdout)).toMatchObject({ kind: 'deterministic', precheck: 'json-only', acceptedDraft: false });
    });

    it('is exit 3, not 1, when the fault is the job\'s or the input\'s, so the hook can tell them apart and fail open', async () => {
      await fs.writeJson(resultFile(), goodResult());
      await fs.appendFile(path.join(selected.candidate, 'SKILL.md'), 'A late edit.\n');
      const drifted = checker(['--job', selected.jobFile, '--precheck', resultFile()]);
      expect(drifted.status).toBe(3);
      expect((JSON.parse(drifted.stderr) as { reason: string }).reason).toMatch(/Candidate inventory\/hash mismatch/);
      const missing = checker(['--precheck', path.join(temp, 'no-such-file.json')]);
      expect(missing.status).toBe(3);
    });

    it('does not weaken the saved-file mode: a file elsewhere is still refused there, and --precheck cannot be combined with --result', async () => {
      const elsewhere = path.join(temp, 'anywhere', 'result.json');
      await fs.outputJson(elsewhere, goodResult());
      const saved = checker(['--job', selected.jobFile, '--result', elsewhere]);
      expect(saved.status).toBe(1);
      expect((JSON.parse(saved.stderr) as { reason: string }).reason).toBe('Result must be the caller-owned review-root result.json.');
      const both = checker(['--job', selected.jobFile, '--result', resultFile(), '--precheck', elsewhere]);
      expect(both.status).toBe(1);
    });
  });
});
