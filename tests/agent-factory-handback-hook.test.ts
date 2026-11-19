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
  const env = (): NodeJS.ProcessEnv => ({ ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp });
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
  /** A result whose one citation spans seven lines: the kind of fault the pilot's evaluators made. */
  const badResult = () => {
    const result = goodResult();
    result.criteria[0]!.citations = [{ ...result.criteria[0]!.citations[0]!, startLine: 1, endLine: 7, quote: 'Read only the supplied path.' }];
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

  it('counts per worker: three blocks, then the fourth attempt of the same worker goes through; another worker starts at one', () => {
    const message = text(badResult());
    for (const attempt of [1, 2, 3]) {
      const run = hook(message);
      expect(run.status).toBe(2);
      expect(run.stderr.split('\n')[0]).toContain(`attempt ${attempt} of 3`);
    }
    const fourth = hook(message);
    expect(fourth.status).toBe(0);
    expect(fourth.stderr).toBe('');
    const other = hook(message, { agent_id: 'agent-two' });
    expect(other.status).toBe(2);
    expect(other.stderr.split('\n')[0]).toContain('attempt 1 of 3');
  });

  it('keys the count by session and job digest when the input carries no agent id', () => {
    const message = text(badResult());
    const noAgent = { agent_id: undefined, agent_type: undefined };
    expect(hook(message, noAgent).status).toBe(2);
    expect(hook(message, noAgent).stderr.split('\n')[0]).toContain('attempt 2 of 3');
    expect(hook(message, { ...noAgent, session_id: 'session-2' }).stderr.split('\n')[0]).toContain('attempt 1 of 3');
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
    expect(hook('[1, 2, 3]').status).toBe(0);
  });

  it('blocks nothing for a missing or malformed hook input', () => {
    for (const input of ['', 'not json', '{}', '[]', JSON.stringify({ tool_name: 'SubagentHandback' }), JSON.stringify({ tool_name: 'SubagentHandback', tool_input: { message: 12 } }),
      JSON.stringify({ tool_name: 'Read', tool_input: { message: text(badResult()) } })]) {
      const run = node([fixture.installed(HOOK)], input);
      expect(run.status, input).toBe(0);
      expect(run.stderr, input).toBe('');
    }
  });

  it('refuses as the checker would when the pointer leads to a job whose digest is not the result\'s', async () => {
    const stranger = 'f'.repeat(64);
    await writePointer(stranger);
    const result = { ...goodResult(), jobDigest: stranger };
    const run = hook(text(result));
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('Result fixed job/candidate digest mismatch.');
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

  describe('the pre-check mode of check-review.mjs', () => {
    const fixtures: Array<[string, () => unknown]> = [
      ['a valid result', () => goodResult()],
      ['a citation over the line limit', () => badResult()],
      ['a quote one line off', () => {
        const result = goodResult();
        result.criteria[0]!.citations = [{ ...result.criteria[0]!.citations[0]!, startLine: 6, endLine: 6, quote: 'Read only the supplied path.' }];
        return result;
      }],
      ['a digest of another job', () => ({ ...goodResult(), jobDigest: 'e'.repeat(64) })],
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
