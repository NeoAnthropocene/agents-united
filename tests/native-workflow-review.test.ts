import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nativeWorkflowSource } from '../src/core/native-package.js';
import { extractMetaLiteral } from './helpers/workflow-lint.js';

/**
 * Plan 032 — behaviour of the shipped `workflow-review` script, run against a mock of the Claude workflow runtime
 * (agent, parallel, phase, log, args). The lint proves the script parses; this proves what it does with the answers.
 */

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<any>;
const source = fs.readFileSync(nativeWorkflowSource(path.resolve('registry'), 'claude', 'workflow-review')!, 'utf8').replace(/\r\n/g, '\n');
const body = source.slice(extractMetaLiteral(source)!.end);
const script = new AsyncFunction('agent', 'pipeline', 'parallel', 'phase', 'log', 'args', 'budget', 'workflow', body);

interface Call {
  prompt: string;
  opts: Record<string, any>;
}
type Handler = (call: Call, index: number) => unknown;

async function run(args: unknown, handler: Handler): Promise<{ result: any; calls: Call[]; logs: string[]; phases: string[] }> {
  const calls: Call[] = [];
  const logs: string[] = [];
  const phases: string[] = [];
  const agent = async (prompt: string, opts: Record<string, any> = {}): Promise<unknown> => {
    calls.push({ prompt, opts });
    return handler({ prompt, opts }, calls.length - 1) ?? null;
  };
  const parallel = async (thunks: Array<() => Promise<unknown>>): Promise<unknown[]> =>
    Promise.all(thunks.map(thunk => Promise.resolve().then(thunk).catch(() => null)));
  const pipeline = async (): Promise<unknown[]> => {
    throw new Error('workflow-review does not use pipeline');
  };
  const result = await script(agent, pipeline, parallel, (title: string) => phases.push(title), (line: string) => logs.push(line), args, { total: null }, async () => null);
  return { result, calls, logs, phases };
}

const finding = (over: Partial<Record<string, unknown>> = {}) => ({
  severity: 'HIGH',
  file: 'src/a.ts',
  line: 10,
  title: 'SQL built by string concatenation',
  snippet: 'db.query("select * from t where id=" + id)',
  risk: 'Injection',
  remediation: 'Use a parameterised query',
  ...over,
});
const FILES = ['src/a.ts', 'src/b.ts'];
const isFind = (call: Call): boolean => call.opts.phase === 'Find';

describe('workflow-review (mock runtime)', () => {
  it('refuses a request without files, and never spawns an agent for it', async () => {
    for (const args of [undefined, {}, { files: [] }, { files: [3, ''] }, 'src/a.ts']) {
      const { result, calls } = await run(args, () => null);
      expect(result.error, JSON.stringify(args)).toMatch(/args\.files/);
      expect(calls).toHaveLength(0);
    }
  });

  it('small (the default) uses 3 agents, all code-reviewer: two reviewers and one batched verifier', async () => {
    const { result, calls, phases } = await run({ files: FILES }, call => (isFind(call) ? { findings: [finding()] } : { verdicts: [{ id: 'F1', refuted: false, reason: 'real' }] }));
    expect(calls).toHaveLength(3);
    expect(calls.every(call => call.opts.agentType === 'code-reviewer')).toBe(true);
    expect(calls.filter(isFind)).toHaveLength(2);
    expect(phases).toEqual(['Find', 'Verify']);
    expect(result.size).toBe('small');
    expect(result.confirmed).toHaveLength(1);
    expect(result.verdict).toBe('Request Changes');
  });

  it('merges duplicate findings across dimensions into one, keeping the higher severity and both dimensions', async () => {
    const { result, calls } = await run({ files: FILES }, (call, index) =>
      isFind(call)
        ? { findings: [finding({ severity: index === 0 ? 'MEDIUM' : 'HIGH' })] }
        : { verdicts: [{ id: 'F1', refuted: false, reason: 'real' }] },
    );
    expect(calls.filter(call => !isFind(call))[0].prompt.match(/F1 \[/g)).toHaveLength(1);
    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]).toMatchObject({ id: 'F1', severity: 'HIGH', dimensions: ['security-correctness', 'design-performance-tests'] });
  });

  it('finds nothing: approves without paying for verification', async () => {
    const { result, calls } = await run({ files: FILES }, () => ({ findings: [] }));
    expect(calls).toHaveLength(2);
    expect(result.verdict).toBe('Approve');
    expect(result.confirmed).toEqual([]);
  });

  it('drops a refuted finding but lists it, and comments (not approves) when only MEDIUM findings are confirmed', async () => {
    const { result } = await run({ files: FILES }, call =>
      isFind(call)
        ? { findings: [finding({ severity: 'MEDIUM', title: 'Weak check', line: 3 }), finding({ severity: 'HIGH', title: 'False alarm', line: 20 })] }
        : { verdicts: [{ id: 'F1', refuted: true, reason: 'the value is validated upstream' }, { id: 'F2', refuted: false, reason: 'real' }] },
    );
    expect(result.refuted).toEqual([{ id: 'F1', title: 'False alarm', reason: 'the value is validated upstream' }]);
    expect(result.confirmed.map((f: any) => f.title)).toEqual(['Weak check']);
    expect(result.verdict).toBe('Comment');
  });

  it('a reviewer that does not complete is a note and a Comment verdict, never silent coverage', async () => {
    const { result } = await run({ files: FILES }, (call, index) => (isFind(call) ? (index === 0 ? null : { findings: [] }) : null));
    expect(result.notes.join(' ')).toMatch(/security-correctness reviewer did not complete/);
    expect(result.verdict).toBe('Comment');
  });

  it('a verifier that does not complete leaves every finding unverified, and a serious one still keeps the verdict at Comment', async () => {
    const { result } = await run({ files: FILES }, call => (isFind(call) ? { findings: [finding()] } : null));
    expect(result.confirmed).toEqual([]);
    expect(result.unverified).toHaveLength(1);
    expect(result.notes.join(' ')).toMatch(/verification agent did not complete/);
    expect(result.verdict).toBe('Comment');
  });

  it('sizes stay inside their agent budgets, and what the cap leaves out is reported unverified with a note', async () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => finding({ title: `Finding ${i}`, line: i + 1, severity: i < 3 ? 'HIGH' : 'LOW' }));
    const verdicts = (prompt: string) => ({ refuted: false, reason: 'real', verdicts: [...prompt.matchAll(/(F\d+) \[/g)].map(match => ({ id: match[1], refuted: false, reason: 'real' })) });
    const budgets: Array<[string, number]> = [['small', 4], ['medium', 9], ['large', 23]];
    for (const [size, ceiling] of budgets) {
      const { result, calls } = await run({ files: FILES, size }, call => (isFind(call) ? { findings: many(40) } : verdicts(call.prompt)));
      expect(calls.length, size).toBeLessThanOrEqual(ceiling);
      expect(result.confirmed.length + result.unverified.length, size).toBe(40);
      expect(result.notes.join(' '), size).toMatch(/reported unverified/);
    }
    // The Pro baseline is "fewer than 5 agents".
    expect(budgets[0][1]).toBeLessThan(5);
  });

  it('large runs two votes per finding: a 1-1 tie keeps the finding, marked contested; a 2-0 refutation removes it', async () => {
    let seen = 0;
    const { result } = await run({ files: FILES, size: 'large' }, call => {
      if (isFind(call)) return { findings: seen++ === 0 ? [finding({ title: 'Tie', line: 1 }), finding({ title: 'Gone', line: 2 })] : [] };
      if (call.prompt.includes('Tie')) return { refuted: call.opts.label.endsWith('vote 1'), reason: 'split' };
      return { refuted: true, reason: 'not real' };
    });
    expect(result.confirmed.map((f: any) => [f.title, f.contested])).toEqual([['Tie', true]]);
    expect(result.refuted.map((f: any) => f.title)).toEqual(['Gone']);
  });

  it('is deterministic for the same answers, and ignores an unknown size', async () => {
    const handler: Handler = call => (isFind(call) ? { findings: [finding()] } : { verdicts: [{ id: 'F1', refuted: false, reason: 'real' }] });
    const first = await run({ files: FILES, size: 'constructor' }, handler);
    const second = await run({ files: FILES, size: 'constructor' }, handler);
    expect(first.result).toEqual(second.result);
    expect(first.result.size).toBe('small');
  });
});
