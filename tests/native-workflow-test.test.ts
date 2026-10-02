import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listNativeRoles, nativeWorkflowSource } from '../src/core/native-package.js';
import { extractMetaLiteral } from './helpers/workflow-lint.js';

/**
 * Plan 032 — behaviour of the shipped `workflow-test` script, run against a mock of the Claude workflow runtime
 * (agent, parallel, phase, log, args). The lint proves the script parses; this proves the loop it runs: run the suites,
 * repair the failures by test file within a cap, verify independently, and decide the verdict in code.
 */

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<any>;
const REGISTRY = path.resolve('registry');
const source = fs.readFileSync(nativeWorkflowSource(REGISTRY, 'claude', 'workflow-test')!, 'utf8').replace(/\r\n/g, '\n');
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
    throw new Error('workflow-test does not use pipeline');
  };
  const result = await script(agent, pipeline, parallel, (title: string) => phases.push(title), () => undefined, args, { total: null }, async () => null);
  return { result, calls, phases };
}

const label = (call: Call): string => String(call.opts.label);
const is = (kind: string) => (call: Call): boolean => label(call).startsWith(kind);

const noCoverage = { measured: false, percent: 0, lowFiles: [] as unknown[] };
const failure = (file: string, test = 'works', message = 'expected 1 to equal 2') => ({ test, file, message });
const suite = (over: Record<string, unknown> = {}) => ({ name: 'tests', command: 'npm test', passed: true, total: 10, failed: 0, failures: [] as unknown[], ...over });
const green = (over: Record<string, unknown> = {}) => ({ suites: [suite()], coverage: noCoverage, problem: '', ...over });
const red = (...failures: Array<ReturnType<typeof failure>>) => ({ suites: [suite({ passed: false, failed: failures.length, failures })], coverage: noCoverage, problem: '' });
const fixed = (over: Record<string, unknown> = {}) => ({ classification: 'test-bug', rootCause: 'stale expectation', fixed: true, filesChanged: ['tests/a.test.ts'], evidence: 'passes now', blocker: '', ...over });

/** Answers every stage with its happy answer; override one stage at a time. */
const happy =
  (over: Partial<Record<'run' | 'fix' | 'verify', Handler>> = {}): Handler =>
  (call, index) => {
    const stage = (['run', 'fix', 'verify'] as const).find(kind => label(call).startsWith(kind));
    if (stage && over[stage]) return over[stage]!(call, index);
    if (stage === 'fix') return fixed();
    return green();
  };

describe('workflow-test (mock runtime)', () => {
  it('needs no args: it runs `npm test` once, and a green run is one agent and a Green verdict', async () => {
    for (const args of [undefined, {}, { commands: [] }, { commands: [3, ''] }, 'npm test']) {
      const { result, calls } = await run(args, happy());
      expect(calls.map(label), JSON.stringify(args)).toEqual(['run']);
      expect(calls[0].prompt).toContain('npm test');
      expect(result).toMatchObject({ workflow: 'workflow-test', size: 'small', verdict: 'Green', agents: 1 });
    }
  });

  it('runs the commands it is given, in order, as named suites (a string is a command with no name)', async () => {
    const { calls } = await run({ commands: [{ name: 'unit', command: 'npx vitest run tests/unit' }, 'npm run e2e'] }, happy());
    expect(calls[0].prompt.indexOf('npx vitest run tests/unit')).toBeGreaterThan(-1);
    expect(calls[0].prompt.indexOf('npm run e2e')).toBeGreaterThan(calls[0].prompt.indexOf('npx vitest run tests/unit'));
    expect(calls[0].prompt).toContain('unit');
  });

  it('small repairs everything in one agent, then verifies: run, fix, verify is 3 agents, under the Pro baseline', async () => {
    const { result, calls, phases } = await run(
      { size: 'small' },
      happy({ run: () => red(failure('tests/a.test.ts'), failure('tests/b.test.ts'), failure('tests/a.test.ts', 'second')) }),
    );
    expect(calls.map(label)).toEqual(['run', 'fix tests/a.test.ts (round 1)', 'verify (round 1)']);
    expect(calls.length).toBeLessThan(5);
    expect(calls[1].prompt).toContain('tests/b.test.ts');
    expect(phases).toEqual(['Run', 'Repair']);
    expect(result).toMatchObject({ verdict: 'Green', agents: 3 });
    expect(result.rounds).toHaveLength(1);
  });

  it('medium repairs one agent per failing test file, one after another, and verifies once per round', async () => {
    const { calls, result } = await run(
      { size: 'medium' },
      happy({ run: () => red(failure('tests/a.test.ts'), failure('tests/b.test.ts'), failure('tests/c.test.ts')) }),
    );
    expect(calls.map(label)).toEqual(['run', 'fix tests/a.test.ts (round 1)', 'fix tests/b.test.ts (round 1)', 'fix tests/c.test.ts (round 1)', 'verify (round 1)']);
    expect(result.verdict).toBe('Green');
  });

  it('more failing files than clusters are folded into the clusters, never dropped', async () => {
    const files = ['a', 'b', 'c', 'd', 'e'].map(name => `tests/${name}.test.ts`);
    const { calls } = await run({ size: 'medium' }, happy({ run: () => red(...files.map(file => failure(file))) }));
    const fixes = calls.filter(is('fix'));
    expect(fixes).toHaveLength(3);
    for (const file of files) expect(fixes.some(call => call.prompt.includes(file)), file).toBe(true);
  });

  it('a fixer is told to reproduce, find the cause, and never skip, disable, delete or loosen a test', async () => {
    const { calls } = await run({}, happy({ run: () => red(failure('tests/a.test.ts', 'adds', 'expected 1 to equal 2')) }));
    const prompt = calls.find(is('fix'))!.prompt;
    expect(prompt).toMatch(/never skip, disable, delete or loosen/i);
    expect(prompt).toContain('adds');
    expect(prompt).toContain('expected 1 to equal 2');
    expect(prompt).toMatch(/flake/i);
    expect(prompt).toMatch(/never commit/i);
  });

  it('picks the specialist for the fixers from args, defaulting to backend; checks use the default agent at low effort', async () => {
    const failing = happy({ run: () => red(failure('tests/a.test.ts')) });
    const backend = await run({ specialist: 'constructor' }, failing);
    expect(backend.calls.find(is('fix'))!.opts.agentType).toBe('backend-architect');
    const frontend = await run({ specialist: 'frontend' }, failing);
    expect(frontend.calls.find(is('fix'))!.opts.agentType).toBe('frontend-architect');
    expect(frontend.calls.find(is('run'))!.opts).toMatchObject({ effort: 'low' });
    expect(frontend.calls.find(is('run'))!.opts.agentType).toBeUndefined();
    const native = listNativeRoles(REGISTRY, 'claude');
    for (const call of [...backend.calls, ...frontend.calls]) if (call.opts.agentType !== undefined) expect(native).toContain(call.opts.agentType);
  });

  it('a failure that survives a round gets another round, up to the size cap, then the verdict is Red with what remains', async () => {
    let round = 0;
    const { result, calls } = await run(
      { size: 'medium' },
      happy({ verify: () => red(failure('tests/a.test.ts', `still failing ${++round}`)), run: () => red(failure('tests/a.test.ts', 'first')) }),
    );
    expect(calls.filter(is('verify'))).toHaveLength(2);
    expect(calls.filter(is('fix'))).toHaveLength(2);
    expect(result.verdict).toBe('Red');
    expect(result.remaining.map((f: any) => f.test)).toEqual(['still failing 2']);
  });

  it('stops early when a round leaves exactly the same failures: no progress', async () => {
    const { result, calls } = await run({ size: 'large' }, happy({ run: () => red(failure('tests/a.test.ts')), verify: () => red(failure('tests/a.test.ts')) }));
    expect(calls.filter(is('fix'))).toHaveLength(1);
    expect(calls.filter(is('verify'))).toHaveLength(1);
    expect(result.notes.join(' ')).toMatch(/no progress/i);
    expect(result.verdict).toBe('Red');
  });

  it('a fixer that changes nothing (environment, unknown) is reported, and no verification is paid for', async () => {
    const { result, calls } = await run(
      { size: 'medium' },
      happy({
        run: () => red(failure('tests/a.test.ts')),
        fix: () => fixed({ classification: 'environment', fixed: false, filesChanged: [], blocker: 'The browser binary is not installed.' }),
      }),
    );
    expect(calls.map(label)).toEqual(['run', 'fix tests/a.test.ts (round 1)']);
    expect(result.verdict).toBe('Red');
    expect(result.rounds[0].clusters[0]).toMatchObject({ classification: 'environment', fixed: false });
    expect(result.notes.join(' ')).toMatch(/browser binary is not installed/);
    expect(result.notes.join(' ')).not.toMatch(/\.;|;;|\.\./);
  });

  it('a fixer that does not complete is a note, never a silent success', async () => {
    const { result } = await run({}, happy({ run: () => red(failure('tests/a.test.ts')), fix: () => null }));
    expect(result.notes.join(' ')).toMatch(/fix for tests\/a\.test\.ts did not complete/);
    expect(result.verdict).toBe('Red');
  });

  it('a run that does not complete, or cannot start the commands, is Unknown, never Green', async () => {
    const dead = await run({}, happy({ run: () => null }));
    expect(dead.result.verdict).toBe('Unknown');
    expect(dead.result.notes.join(' ')).toMatch(/run agent did not complete/);
    expect(dead.calls).toHaveLength(1);

    const noStart = await run({}, happy({ run: () => ({ suites: [], coverage: noCoverage, problem: 'npm: command not found' }) }));
    expect(noStart.result.verdict).toBe('Unknown');
    expect(noStart.result.notes.join(' ')).toMatch(/command not found/);

    const lostVerify = await run({}, happy({ run: () => red(failure('tests/a.test.ts')), verify: () => null }));
    expect(lostVerify.result.verdict).toBe('Unknown');
    expect(lostVerify.result.notes.join(' ')).toMatch(/verify agent did not complete/);
  });

  it('a suite that did not pass without naming a test still counts as a failure to repair', async () => {
    const { result, calls } = await run({}, happy({ run: () => ({ suites: [suite({ passed: false, failed: 0, failures: [] })], coverage: noCoverage, problem: '' }), verify: () => red() }));
    expect(calls.filter(is('fix'))).toHaveLength(1);
    expect(calls.find(is('fix'))!.prompt).toMatch(/did not pass/);
    expect(result.verdict).toBe('Red');
  });

  it('coverage: at or above the target is Green, below it is Below Target with the files, and unmeasured is Unknown', async () => {
    const withCoverage = (percent: number, measured = true) => green({ coverage: { measured, percent, lowFiles: percent < 80 ? [{ file: 'src/x.ts', percent: 41 }] : [] } });
    const args = { coverageCommand: 'npm run test:coverage', coverageTarget: 80 };

    const ok = await run(args, happy({ run: () => withCoverage(83) }));
    expect(ok.result.verdict).toBe('Green');
    expect(ok.calls[0].prompt).toContain('npm run test:coverage');
    expect(ok.calls[0].prompt).toContain('80');

    const low = await run(args, happy({ run: () => withCoverage(62) }));
    expect(low.result).toMatchObject({ verdict: 'Below Target' });
    expect(low.result.coverage.lowFiles).toEqual([{ file: 'src/x.ts', percent: 41 }]);
    expect(low.calls).toHaveLength(1);

    const unmeasured = await run(args, happy({ run: () => withCoverage(0, false) }));
    expect(unmeasured.result.verdict).toBe('Unknown');
    expect(unmeasured.result.notes.join(' ')).toMatch(/coverage could not be measured/i);
  });

  it('without a coverage target the coverage is not asked for, and a low number cannot change the verdict', async () => {
    const { result, calls } = await run({}, happy({ run: () => green({ coverage: { measured: true, percent: 12, lowFiles: [] } }) }));
    expect(calls[0].prompt).not.toMatch(/coverage/i);
    expect(result.verdict).toBe('Green');
  });

  it('verifies coverage again after repairs, and the verify agent re-runs the same commands', async () => {
    const { calls, result } = await run(
      { commands: ['pnpm test'], coverageCommand: 'pnpm coverage', coverageTarget: 70 },
      happy({
        run: () => ({ ...red(failure('tests/a.test.ts')), coverage: { measured: true, percent: 50, lowFiles: [] } }),
        verify: () => green({ coverage: { measured: true, percent: 75, lowFiles: [] } }),
      }),
    );
    const verify = calls.find(is('verify'))!;
    expect(verify.prompt).toContain('pnpm test');
    expect(verify.prompt).toContain('pnpm coverage');
    expect(result.verdict).toBe('Green');
    expect(result.coverage.percent).toBe(75);
  });

  it('never exceeds a size budget, however many files keep failing', async () => {
    const many = (round: number) => red(...Array.from({ length: 12 }, (_, i) => failure(`tests/f${i}.test.ts`, `r${round}`)));
    for (const [size, ceiling] of [
      ['small', 4],
      ['medium', 9],
      ['large', 23],
    ] as const) {
      let round = 0;
      const { calls, result } = await run({ size }, happy({ run: () => many(0), verify: () => many(++round) }));
      expect(calls.length, size).toBeLessThanOrEqual(ceiling);
      expect(result.agents).toBe(calls.length);
    }
  });

  it('is deterministic for the same answers, and ignores an unknown size', async () => {
    const answers = happy({ run: () => red(failure('tests/b.test.ts'), failure('tests/a.test.ts')) });
    const first = await run({ size: 'constructor' }, answers);
    const second = await run({ size: 'constructor' }, answers);
    expect(first.result).toEqual(second.result);
    expect(first.result.size).toBe('small');
  });
});
