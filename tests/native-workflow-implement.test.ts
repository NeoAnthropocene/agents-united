import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listNativeRoles, nativeWorkflowSource } from '../src/core/native-package.js';
import { extractMetaLiteral } from './helpers/workflow-lint.js';

/**
 * Plan 032 — behaviour of the shipped `workflow-implement` script, run against a mock of the Claude workflow runtime
 * (agent, parallel, phase, log, args). The lint proves the script parses; this proves the loop it runs: implement,
 * review against the spec, a capped fix loop, then an independent gate.
 */

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<any>;
const REGISTRY = path.resolve('registry');
const source = fs.readFileSync(nativeWorkflowSource(REGISTRY, 'claude', 'workflow-implement')!, 'utf8').replace(/\r\n/g, '\n');
const body = source.slice(extractMetaLiteral(source)!.end);
const script = new AsyncFunction('agent', 'pipeline', 'parallel', 'phase', 'log', 'args', 'budget', 'workflow', body);

interface Call {
  prompt: string;
  opts: Record<string, any>;
}
type Handler = (call: Call, index: number) => unknown;

async function run(args: unknown, handler: Handler): Promise<{ result: any; calls: Call[]; phases: string[] }> {
  const calls: Call[] = [];
  const phases: string[] = [];
  const agent = async (prompt: string, opts: Record<string, any> = {}): Promise<unknown> => {
    calls.push({ prompt, opts });
    return handler({ prompt, opts }, calls.length - 1) ?? null;
  };
  const parallel = async (thunks: Array<() => Promise<unknown>>): Promise<unknown[]> =>
    Promise.all(thunks.map(thunk => Promise.resolve().then(thunk).catch(() => null)));
  const pipeline = async (): Promise<unknown[]> => {
    throw new Error('workflow-implement does not use pipeline');
  };
  const result = await script(agent, pipeline, parallel, (title: string) => phases.push(title), () => undefined, args, { total: null }, async () => null);
  return { result, calls, phases };
}

const label = (call: Call): string => String(call.opts.label);
const is = (kind: string) => (call: Call): boolean => label(call).startsWith(kind);
const TASKS = [
  { title: 'Add the parser', spec: 'Parse the lockfile header.', files: ['src/parse.ts'] },
  { title: 'Wire the CLI flag', spec: 'Expose --strict.', specialist: 'frontend' },
  { title: 'Document it', spec: 'Update the README.' },
  { title: 'Fourth', spec: 'A fourth task.' },
];
const tasks = (n: number) => TASKS.slice(0, n);

const done = (over: Record<string, unknown> = {}) => ({
  status: 'done',
  summary: 'implemented',
  filesChanged: ['src/a.ts'],
  red: '1 failed',
  typecheckPassed: true,
  testsPassed: true,
  concerns: [],
  blocker: '',
  ...over,
});
const issue = (over: Record<string, unknown> = {}) => ({ severity: 'HIGH', file: 'src/a.ts', line: 4, title: 'Spec gap', detail: 'The flag is ignored', ...over });
const clean = { specCompliant: true, issues: [] };
const dirty = (...titles: string[]) => ({ specCompliant: false, issues: titles.map(title => issue({ title })) });
const green = { typecheckPassed: true, testsPassed: true, output: '' };

/** A handler that answers every stage with its happy answer; override one stage at a time. */
const happy =
  (over: Partial<Record<'implement' | 'review' | 'fix' | 'checks' | 'final', Handler>> = {}): Handler =>
  (call, index) => {
    const stage = (['implement', 'review', 'fix', 'checks', 'final'] as const).find(kind => label(call).startsWith(kind));
    if (stage && over[stage]) return over[stage]!(call, index);
    if (stage === 'implement' || stage === 'fix') return done();
    if (stage === 'review' || stage === 'final') return clean;
    return green;
  };

describe('workflow-implement (mock runtime)', () => {
  it('refuses a request without tasks, or a task without a spec, and never spawns an agent for it', async () => {
    for (const args of [undefined, {}, { tasks: [] }, { tasks: [{ title: 'x' }] }, { tasks: [{ spec: '' }] }, { tasks: 'do it' }]) {
      const { result, calls } = await run(args, () => null);
      expect(result.error, JSON.stringify(args)).toMatch(/args\.tasks/);
      expect(calls).toHaveLength(0);
    }
  });

  it('small (the default) is the Pro baseline: two implementers, the checks and the final review, 4 agents in all', async () => {
    const { result, calls, phases } = await run({ tasks: tasks(2) }, happy());
    expect(calls.map(label)).toEqual(['implement T1', 'implement T2', 'checks', 'final review']);
    expect(calls.length).toBeLessThan(5);
    expect(phases).toEqual(['Build', 'Gate']);
    expect(result).toMatchObject({ workflow: 'workflow-implement', size: 'small', verdict: 'Ready', agents: 4 });
    expect(result.tasks.map((t: any) => [t.id, t.status])).toEqual([
      ['T1', 'unreviewed'],
      ['T2', 'unreviewed'],
    ]);
    expect(result.notes).toContain('Not reviewed individually (agent budget): T1, T2. The final review covers the whole change.');
  });

  it('small runs at most two tasks, reports the rest as not run, and is Incomplete rather than Ready', async () => {
    const { result, calls } = await run({ tasks: tasks(3) }, happy());
    expect(calls.filter(is('implement'))).toHaveLength(2);
    expect(result.tasks.find((t: any) => t.id === 'T3')).toMatchObject({ status: 'not-run' });
    expect(result.notes.join(' ')).toMatch(/T3.*not run|not run.*T3/);
    expect(result.verdict).toBe('Incomplete');
  });

  it('runs tasks one after another, in order, and later prompts know what earlier tasks changed', async () => {
    const { calls } = await run({ tasks: tasks(2) }, happy({ implement: call => done({ filesChanged: [label(call) === 'implement T1' ? 'src/first.ts' : 'src/second.ts'] }) }));
    expect(calls.filter(is('implement')).map(label)).toEqual(['implement T1', 'implement T2']);
    expect(calls[1].prompt).toContain('src/first.ts');
  });

  it('picks the specialist from the task, defaults to backend, and uses only installed native agent types', async () => {
    const { calls } = await run({ tasks: [...tasks(2), { title: 'Odd', spec: 's', specialist: 'constructor' }], size: 'medium' }, happy());
    const types = (kind: string) => calls.filter(is(kind)).map(call => call.opts.agentType);
    expect(types('implement')).toEqual(['backend-architect', 'frontend-architect', 'backend-architect']);
    expect(types('review').every(type => type === 'code-reviewer')).toBe(true);
    expect(types('final')).toEqual(['code-reviewer']);
    const native = listNativeRoles(REGISTRY, 'claude');
    for (const call of calls) if (call.opts.agentType !== undefined) expect(native).toContain(call.opts.agentType);
  });

  it('an implementer that is blocked stops the remaining tasks, which are listed as not started, and the verdict is Blocked', async () => {
    const { result, calls } = await run(
      { tasks: tasks(3), size: 'medium' },
      happy({ implement: call => (label(call) === 'implement T2' ? done({ status: 'blocked', blocker: 'needs a schema decision' }) : done()) }),
    );
    expect(calls.filter(is('implement')).map(label)).toEqual(['implement T1', 'implement T2']);
    expect(result.tasks.map((t: any) => t.status)).toEqual(expect.arrayContaining(['blocked', 'not-started']));
    expect(result.tasks.find((t: any) => t.id === 'T2').blocker).toBe('needs a schema decision');
    expect(result.verdict).toBe('Blocked');
  });

  it('an implementer that does not complete counts as blocked, never as done', async () => {
    const { result } = await run({ tasks: tasks(1) }, happy({ implement: () => null }));
    expect(result.tasks[0].status).toBe('blocked');
    expect(result.verdict).toBe('Blocked');
  });

  it('medium reviews each task against its spec; a clean review accepts it', async () => {
    const { result, calls } = await run({ tasks: tasks(2), size: 'medium' }, happy());
    expect(calls.map(label)).toEqual(['implement T1', 'review T1 (round 1)', 'implement T2', 'review T2 (round 1)', 'checks', 'final review']);
    expect(calls.find(is('review T1'))!.prompt).toContain('Parse the lockfile header.');
    expect(result.tasks.map((t: any) => t.status)).toEqual(['accepted', 'accepted']);
    expect(result.verdict).toBe('Ready');
  });

  it('a blocking review sends the issues to a fixer, then reviews again; the fix is accepted once it is clean', async () => {
    let reviews = 0;
    const { result, calls } = await run({ tasks: tasks(1), size: 'medium' }, happy({ review: () => (reviews++ === 0 ? dirty('Flag is ignored') : clean) }));
    expect(calls.map(label)).toEqual(['implement T1', 'review T1 (round 1)', 'fix T1 (round 1)', 'review T1 (round 2)', 'checks', 'final review']);
    expect(calls[2].prompt).toContain('Flag is ignored');
    expect(calls[2].opts.agentType).toBe(calls[0].opts.agentType);
    expect(result.tasks[0]).toMatchObject({ status: 'accepted', fixRounds: 1 });
    expect(result.verdict).toBe('Ready');
  });

  it('the fix loop is capped: medium fixes once; if the issue stays, the task is open and the verdict is Needs Work', async () => {
    const { result, calls } = await run({ tasks: tasks(1), size: 'medium' }, happy({ review: (_call, index) => dirty(index === 1 ? 'First problem' : 'Second problem') }));
    expect(calls.filter(is('fix'))).toHaveLength(1);
    expect(result.tasks[0].status).toBe('open');
    expect(result.tasks[0].open.map((i: any) => i.title)).toEqual(['Second problem']);
    expect(result.verdict).toBe('Needs Work');
  });

  it('a fixer that is blocked leaves the issues open, and its blocker reads cleanly in the note (no doubled punctuation)', async () => {
    const { result, calls } = await run(
      { tasks: tasks(1), size: 'medium' },
      happy({ review: () => dirty('Needs a decision'), fix: () => done({ status: 'blocked', blocker: 'The change needs a decision from the requester.' }) }),
    );
    expect(calls.filter(is('fix'))).toHaveLength(1);
    expect(calls.filter(is('review'))).toHaveLength(1);
    expect(result.tasks[0].status).toBe('open');
    const note = result.notes.find((n: string) => /fix did not complete/.test(n))!;
    expect(note).toContain('needs a decision from the requester');
    expect(note).not.toMatch(/\.;|;;|\.\./);
    expect(result.verdict).toBe('Needs Work');
  });

  it('stops early when a round makes no progress on the same blocking issues (large would allow two fixes)', async () => {
    const { result, calls } = await run({ tasks: tasks(1), size: 'large' }, happy({ review: () => dirty('Same problem') }));
    expect(calls.filter(is('fix'))).toHaveLength(1);
    expect(calls.filter(is('review'))).toHaveLength(2);
    expect(result.notes.join(' ')).toMatch(/no progress/i);
    expect(result.tasks[0].status).toBe('open');
  });

  it('large lets a stubborn issue take two fix rounds when each round changes the problem', async () => {
    let n = 0;
    const { result, calls } = await run({ tasks: tasks(1), size: 'large' }, happy({ review: () => (n++ < 2 ? dirty(`Problem ${n}`) : clean) }));
    expect(calls.filter(is('fix'))).toHaveLength(2);
    expect(result.tasks[0]).toMatchObject({ status: 'accepted', fixRounds: 2 });
  });

  it('spends only what the size allows: optional reviews and fixes give way to the required implementers and the gate, and the skips are noted', async () => {
    const { result, calls } = await run({ tasks: tasks(4), size: 'medium' }, happy({ review: () => dirty('Always') }));
    expect(calls.length).toBeLessThanOrEqual(9);
    expect(calls.filter(is('implement'))).toHaveLength(4);
    expect(calls.filter(is('checks'))).toHaveLength(1);
    expect(calls.filter(is('final'))).toHaveLength(1);
    expect(result.agents).toBe(calls.length);
    expect(result.notes.join(' ')).toMatch(/agent budget/);
    expect(result.tasks.some((t: any) => t.status === 'unreviewed')).toBe(true);
  });

  it('never exceeds a size budget, whatever the reviewers say', async () => {
    for (const [size, ceiling] of [
      ['small', 4],
      ['medium', 9],
      ['large', 23],
    ] as const) {
      const { calls } = await run({ tasks: tasks(4), size }, happy({ review: (_c, index) => dirty(`P${index}`) }));
      expect(calls.length, size).toBeLessThanOrEqual(ceiling);
    }
  });

  it('an implementer that reports failing checks leaves a blocking issue, even with nobody to review it', async () => {
    const { result } = await run({ tasks: tasks(1) }, happy({ implement: () => done({ testsPassed: false }) }));
    expect(result.tasks[0].status).toBe('open');
    expect(result.tasks[0].open[0].title).toMatch(/checks/i);
    expect(result.verdict).toBe('Needs Work');
  });

  it('the gate runs the project commands from args, once, over every changed file without duplicates', async () => {
    const { calls } = await run(
      { tasks: tasks(2), typecheckCommand: 'pnpm tsc', testCommand: 'pnpm vitest run' },
      happy({ implement: () => done({ filesChanged: ['src/a.ts', 'src/b.ts'] }) }),
    );
    const checks = calls.find(is('checks'))!;
    expect(checks.prompt).toContain('pnpm tsc');
    expect(checks.prompt).toContain('pnpm vitest run');
    const finalReview = calls.find(is('final'))!;
    expect(finalReview.prompt.match(/src\/a\.ts/g)).toHaveLength(1);
    expect(finalReview.prompt).toContain('src/b.ts');
    expect(calls.find(is('implement'))!.prompt).toMatch(/never commit|do not commit/i);
  });

  it('failing checks, an unfinished gate or a blocking final issue each keep the verdict at Needs Work', async () => {
    const failing = await run({ tasks: tasks(1) }, happy({ checks: () => ({ typecheckPassed: true, testsPassed: false, output: '2 tests failed' }) }));
    expect(failing.result.verdict).toBe('Needs Work');
    expect(failing.result.checks).toMatchObject({ testsPassed: false, output: '2 tests failed' });

    const unfinished = await run({ tasks: tasks(1) }, happy({ checks: () => null }));
    expect(unfinished.result.verdict).toBe('Needs Work');
    expect(unfinished.result.notes.join(' ')).toMatch(/checks agent did not complete/);

    const blockingFinal = await run({ tasks: tasks(1) }, happy({ final: () => dirty('Cross-task break') }));
    expect(blockingFinal.result.verdict).toBe('Needs Work');
    expect(blockingFinal.result.finalReview.blocking.map((i: any) => i.title)).toEqual(['Cross-task break']);

    const unreviewed = await run({ tasks: tasks(1) }, happy({ final: () => null }));
    expect(unreviewed.result.verdict).toBe('Needs Work');
    expect(unreviewed.result.notes.join(' ')).toMatch(/final review did not complete/);
  });

  it('minor final issues are reported but do not stop a Ready verdict', async () => {
    const { result } = await run({ tasks: tasks(1) }, happy({ final: () => ({ specCompliant: true, issues: [issue({ severity: 'LOW', title: 'Naming' })] }) }));
    expect(result.verdict).toBe('Ready');
    expect(result.finalReview.minor.map((i: any) => i.title)).toEqual(['Naming']);
  });

  it('when every task is blocked there is nothing to gate, so no checks or final review is paid for', async () => {
    const { calls, result } = await run({ tasks: tasks(2) }, happy({ implement: () => done({ status: 'blocked', blocker: 'no' }) }));
    expect(calls.map(label)).toEqual(['implement T1']);
    expect(result.verdict).toBe('Blocked');
  });

  it('is deterministic for the same answers, and ignores an unknown size', async () => {
    const first = await run({ tasks: tasks(2), size: 'constructor' }, happy());
    const second = await run({ tasks: tasks(2), size: 'constructor' }, happy());
    expect(first.result).toEqual(second.result);
    expect(first.result.size).toBe('small');
  });
});
