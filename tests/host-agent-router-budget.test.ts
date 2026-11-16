import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * R6: `run --max-budget-usd N` reaches the Host that has a budget flag (Claude) and says so plainly for the Hosts that have none.
 * Offline: dry runs on a replayed statuses file, and pure functions. No Host is started.
 */

const DIR = path.resolve('registry/skills/host-agent-router');
const SCRIPT = path.join(DIR, 'scripts', 'router.mjs');
const CFG = JSON.parse(fs.readFileSync(path.join(DIR, 'assets', 'config.default.json'), 'utf8')) as Record<string, any>;

interface Lib {
  buildSpec: (cfg: unknown, host: string, t: unknown, prompt: string, access: string, cwd: string | null, tier: string, extra?: Record<string, unknown>) => { args: string[]; stdin: string | null; env: Record<string, string> };
  budgetProblem: (v: unknown) => string | null;
  budgetOf: (host: string, usd: number | null) => Record<string, unknown> | undefined;
  execPayload: (spec: { args: string[]; stdin: string | null; env: Record<string, string> }, o: { host: string; cwd: string; timeout: number; workerTemp?: unknown }) => Record<string, unknown>;
  validateConfig: (cfg: unknown) => string[];
}
const lib = async (): Promise<Lib> => (await import(pathToFileURL(SCRIPT).href)) as Lib;

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'har-r6-'));
  dirs.push(d);
  return d;
};

const HOSTS = ['cline', 'antigravity', 'codex', 'claude'] as const;
const ST = { installed: true, logged_in: true, usage: null };
const replay = (hosts: readonly string[] = HOSTS): string => {
  const f = path.join(tmp(), 'statuses.json');
  fs.writeFileSync(f, JSON.stringify(Object.fromEntries(hosts.map(h => [h, { windows: ST }]))));
  return f;
};

interface Out { status: number | null; out: string; json: any }
const run = (args: string[], env: Record<string, string> = {}): Out => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, HOST_AGENT_ROUTER_DEPTH: '', ...env } });
  let json: any = null;
  try { json = JSON.parse(r.stdout); } catch { /* usage text */ }
  return { status: r.status, out: `${r.stdout}${r.stderr}`, json };
};
const dry = (extra: string[], o: { hosts?: readonly string[]; env?: Record<string, string> } = {}): Out =>
  run(['run', '--tier', 'simple', '--prompt', 'Say hi', '--dry-run', '--here', 'windows', '--statuses-file', replay(o.hosts), '--cwd', tmp(), ...extra], o.env);
const tries = (r: Out): Array<Record<string, any>> => r.json.would_try;
const entry = (r: Out, host: string): Record<string, any> => tries(r).find(t => t.host === host)!;

describe('the flag and the config key', () => {
  it('accepts a positive amount with at most two decimals', () => {
    for (const v of ['5', '0.5', '2.50', '10.05', '100']) {
      const r = dry(['--max-budget-usd', v]);
      expect([v, r.status]).toEqual([v, 0]);
      expect(entry(r, 'claude').budget).toEqual({ usd: Number(v), applied: true, flag: '--max-budget-usd' });
    }
  });

  it('refuses every other form with exit 64 and a message that names the flag', () => {
    for (const v of ['0', '0.00', '-1', '1.234', 'abc', '', '5.', '.5', '1e3', ' 5', '+5', 'NaN', 'Infinity']) {
      const r = dry([`--max-budget-usd=${v}`]); // the = form, so that a value like -1 reaches the check
      expect([v, r.status]).toEqual([v, 64]);
      expect(r.out).toMatch(/--max-budget-usd must be a positive number/);
      expect(r.json).toBeNull();
    }
    const missing = run(['run', '--tier', 'simple', '--prompt', 'x', '--dry-run', '--here', 'windows', '--statuses-file', replay(), '--max-budget-usd']);
    expect(missing.status).toBe(64);
  });

  it('belongs to run: another command refuses it like any foreign flag', () => {
    for (const flag of [['--max-budget-usd', '5'], ['--require-budget']]) {
      for (const cmd of ['plan', 'status', 'models', 'machine']) {
        const r = run([cmd, ...flag, '--here', 'windows']);
        expect([cmd, flag[0], r.status]).toEqual([cmd, flag[0], 64]);
        expect(r.out).toContain(`${flag[0]} does not apply to ${cmd}`);
      }
    }
  });

  it('config key: default null, validated like the flag; the flag wins over the config', async () => {
    const { validateConfig, budgetProblem } = await lib();
    expect(CFG.maxBudgetUsd).toBeNull();
    expect(validateConfig(CFG)).toEqual([]);
    expect(validateConfig({ ...CFG, maxBudgetUsd: 3.5 })).toEqual([]);
    expect(validateConfig({ ...CFG, maxBudgetUsd: null })).toEqual([]);
    for (const bad of [0, -2, 1.234, '5', true, Number.NaN, 1e21]) {
      expect(validateConfig({ ...CFG, maxBudgetUsd: bad }).join('\n'), String(bad)).toMatch(/maxBudgetUsd must be a positive number/);
    }
    expect(budgetProblem(2.5)).toBeNull();

    const file = path.join(tmp(), 'config.json');
    fs.writeFileSync(file, JSON.stringify({ maxBudgetUsd: 3 }));
    const env = { HOST_AGENT_ROUTER_CONFIG: file };
    expect(entry(dry([], { env }), 'claude').budget).toEqual({ usd: 3, applied: true, flag: '--max-budget-usd' });
    expect(entry(dry(['--max-budget-usd', '7'], { env }), 'claude').budget.usd).toBe(7);
    fs.writeFileSync(file, JSON.stringify({ maxBudgetUsd: 0 }));
    const bad = dry([], { env });
    expect(bad.status).toBe(64);
    expect(bad.out).toMatch(/invalid config[\s\S]*maxBudgetUsd must be a positive number/);
  });
});

describe('the command lines', () => {
  const spec = async (host: string, access: string, extra: Record<string, unknown> = {}) => {
    const { buildSpec } = await lib();
    return buildSpec(CFG, host, CFG.hosts[host].tiers.medium, 'TASK', access, 'C:/w', 'medium', extra);
  };

  it('Claude gets the flag and the value as two elements directly before --output-format, and only then', async () => {
    const plain = (await spec('claude', 'read-only')).args;
    expect(plain).toEqual(['-p', '--model', CFG.hosts.claude.tiers.medium.model, '--effort', CFG.hosts.claude.tiers.medium.effort, '--permission-mode', 'plan', '--output-format', 'text']);
    const capped = (await spec('claude', 'read-only', { maxBudgetUsd: 5 })).args;
    expect(capped).toEqual([...plain.slice(0, -2), '--max-budget-usd', '5', '--output-format', 'text']);
    const edit = (await spec('claude', 'edit', { maxBudgetUsd: 2.5 })).args;
    expect(edit.slice(-4)).toEqual(['--max-budget-usd', '2.5', '--output-format', 'text']);
    expect((await spec('claude', 'edit', { maxBudgetUsd: 2.5 })).args.filter(a => a === '--max-budget-usd')).toHaveLength(1);
  });

  it('Cline, Antigravity and Codex get exactly the command line they get without a cap', async () => {
    for (const host of ['cline', 'antigravity', 'codex']) {
      for (const access of ['read-only', 'edit']) {
        expect(await spec(host, access, { maxBudgetUsd: 5 }), `${host} ${access}`).toEqual(await spec(host, access));
      }
    }
  });
});

describe('the budget field and the notes', () => {
  it('a dry run carries budget on every entry: applied for Claude, the stated reason for the other three', () => {
    const r = dry(['--max-budget-usd', '5']);
    expect(tries(r).map(t => t.host)).toEqual([...HOSTS]);
    expect(entry(r, 'claude').budget).toEqual({ usd: 5, applied: true, flag: '--max-budget-usd' });
    for (const host of ['cline', 'antigravity', 'codex']) {
      expect(entry(r, host).budget).toEqual({ usd: 5, applied: false, reason: `${host} has no budget flag; the run is bounded by --timeout only` });
      expect(entry(r, host).args).not.toContain('--max-budget-usd');
    }
    expect(entry(r, 'claude').args.slice(-4)).toEqual(['--max-budget-usd', '5', '--output-format', 'text']);
  });

  it('budgetOf says nothing without a cap', async () => {
    const { budgetOf } = await lib();
    expect(budgetOf('claude', null)).toBeUndefined();
    expect(budgetOf('codex', null)).toBeUndefined();
  });

  it('without a cap there is no budget field and no mention of a budget anywhere in the output', () => {
    for (const access of ['read-only', 'edit']) {
      const r = dry(['--access', access]);
      expect(r.status).toBe(0);
      expect(r.out).not.toMatch(/budget/i);
      for (const t of tries(r)) expect(t, t.host).not.toHaveProperty('budget');
    }
  });

  it('the uncapped dry run is byte-identical to the one before this change (one candidate per Host, taken from the unchanged script)', () => {
    // The expected text was captured on 2026-11-16 from the script as it was before R6 (same statuses, same prompt), with the temp
    // working directory replaced by <CWD>; the args of each Host are compared whole.
    const want: Record<string, string[]> = {
      codex: ['exec', '-m', CFG.hosts.codex.tiers.simple.model, '-c', `model_reasoning_effort="${CFG.hosts.codex.tiers.simple.effort}"`, '-s', 'read-only', '--skip-git-repo-check', '--color', 'never', '-C', '<CWD>', '-'],
    };
    const cwd = tmp();
    const r = run(['run', '--tier', 'simple', '--prompt', 'Say hi', '--dry-run', '--here', 'windows', '--statuses-file', replay(), '--cwd', cwd]);
    expect(Object.keys(entry(r, 'codex'))).toEqual(['host', 'side', 'model', 'effort', 'label', 'binding_pct', 'five_hour_pct', 'weekly_pct', 'cwd', 'prompt_chars', 'args', 'prompt_via']);
    expect(entry(r, 'codex').args.map((a: string) => (a === cwd ? '<CWD>' : a))).toEqual(want.codex);
    expect(Object.keys(r.json)).toEqual(['dry_run', 'access', 'skills', 'plan', 'would_try']);
  });
});

describe('--require-budget', () => {
  it('skips the Hosts without a budget flag, with the reason, in the plan and the dry run', () => {
    const r = dry(['--max-budget-usd', '5', '--require-budget']);
    expect(r.status).toBe(0);
    expect(tries(r).map(t => t.host)).toEqual(['claude']);
    expect(r.json.plan.candidates.map((c: any) => c.host)).toEqual(['claude']);
    expect(r.json.plan.selected.host).toBe('claude');
    expect(r.json.plan.skipped).toEqual(['cline', 'antigravity', 'codex'].map(host => ({ host, side: 'windows', reason: 'no budget flag (--require-budget)' })));
  });

  it('ends as no usable host when only such Hosts are candidates (exit 2 on a dry run)', () => {
    const r = dry(['--max-budget-usd', '5', '--require-budget'], { hosts: ['cline', 'codex'] });
    expect(r.status).toBe(2);
    expect(tries(r)).toEqual([]);
    expect(r.json.plan.skipped).toHaveLength(2);
  });

  it('a real run with nothing left starts no Host and reports "no usable host/side"', () => {
    const r = run(['run', '--tier', 'simple', '--prompt', 'x', '--here', 'windows', '--statuses-file', replay(['cline', 'codex']), '--cwd', tmp(), '--max-budget-usd', '5', '--require-budget']);
    expect(r.json.error).toBe('no usable host/side');
    expect(r.json.ok).toBe(false);
    expect(r.json.attempts).toEqual([]);
    expect(r.json.skipped.map((s: any) => s.reason)).toEqual(['no budget flag (--require-budget)', 'no budget flag (--require-budget)']);
    expect([1, 2]).toContain(r.status);
  });

  it('without a cap (neither the flag nor the config) it is a usage error, and the config key can supply the cap', () => {
    const r = dry(['--require-budget']);
    expect(r.status).toBe(64);
    expect(r.out).toMatch(/--require-budget needs a cap/);
    const file = path.join(tmp(), 'config.json');
    fs.writeFileSync(file, JSON.stringify({ maxBudgetUsd: 4 }));
    const ok = dry(['--require-budget'], { env: { HOST_AGENT_ROUTER_CONFIG: file } });
    expect(ok.status).toBe(0);
    expect(tries(ok).map(t => t.host)).toEqual(['claude']);
  });
});

describe('the far side', () => {
  it('the payload sent for local-exec carries the command line with the flag for Claude, unchanged through the file the far side reads', async () => {
    const { buildSpec, execPayload } = await lib();
    const t = CFG.hosts.claude.tiers.medium;
    const withCap = execPayload(buildSpec(CFG, 'claude', t, 'TASK', 'read-only', '/work', 'medium', { maxBudgetUsd: 5 }), { host: 'claude', cwd: '/work', timeout: 900 });
    const file = path.join(tmp(), 'payload.json');
    fs.writeFileSync(file, JSON.stringify(withCap));
    const far = JSON.parse(fs.readFileSync(file, 'utf8')) as { host: string; args: string[]; timeout: number };
    const i = far.args.indexOf('--max-budget-usd');
    expect(far.args.slice(i, i + 3)).toEqual(['--max-budget-usd', '5', '--output-format']);
    expect(far.host).toBe('claude');
    // Without a cap the payload has no flag; for another Host it has none either way.
    const none = execPayload(buildSpec(CFG, 'claude', t, 'TASK', 'read-only', '/work', 'medium'), { host: 'claude', cwd: '/work', timeout: 900 });
    expect(none.args).not.toContain('--max-budget-usd');
    const codex = execPayload(buildSpec(CFG, 'codex', CFG.hosts.codex.tiers.medium, 'TASK', 'read-only', '/work', 'medium', { maxBudgetUsd: 5 }), { host: 'codex', cwd: '/work', timeout: 900 });
    expect(codex.args).not.toContain('--max-budget-usd');
  });

  it('the cross-side dry run (Windows to WSL) shows the same command line, with the cap, for a Claude candidate on the WSL side', () => {
    const f = path.join(tmp(), 'statuses.json');
    fs.writeFileSync(f, JSON.stringify({ claude: { windows: { installed: false, logged_in: null, usage: null }, wsl: ST } }));
    const r = run(['run', '--tier', 'simple', '--prompt', 'x', '--dry-run', '--here', 'windows', '--statuses-file', f, '--cwd', tmp(), '--max-budget-usd', '5']);
    const c = r.json.would_try[0];
    expect([c.host, c.side]).toEqual(['claude', 'wsl']);
    expect(c.args.slice(-4)).toEqual(['--max-budget-usd', '5', '--output-format', 'text']);
    expect(c.budget).toEqual({ usd: 5, applied: true, flag: '--max-budget-usd' });
  });
});

describe('the texts', () => {
  it('--help lists both flags, and hosts.md has a paragraph on the budget cap', () => {
    const help = run(['--help']).out;
    expect(help).toContain('--max-budget-usd N');
    expect(help).toContain('--require-budget');
    const hosts = fs.readFileSync(path.join(DIR, 'references', 'hosts.md'), 'utf8');
    expect(hosts).toContain('## Budget cap');
    expect(hosts).toContain('--require-budget');
    expect(hosts).toContain('maxBudgetUsd');
  });
});
