import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Skill 1.2.0 (2026-11-19): the model pool and ordered tiers.
 *
 * Before choosing a model the router learns which models the logged-in account can use (Antigravity: `agy models`; Codex: the
 * app-server `model/list`). Each tier is an ordered list, the first entry that is in the pool is used, and a model that a host refuses
 * moves to the next entry of the same tier on the same host. Offline: pure functions, replayed statuses and dry runs. No host CLI is
 * started and no fixture holds a credential, an e-mail address or an account id.
 *
 * The fixtures are built here from the SHAPE of the real outputs. `agy models` printed one `slug<TAB>display name` line per model on
 * 2026-11-19 (the "Fetching available models..." spinner goes to stderr). The Codex answer follows the `model/list` page of the
 * repository's host-library/codex snapshot. The slugs are the real ones read on 2026-11-19; the Orchestrator (Carbon) line is INVENTED
 * (its slug is not established: no Carbon model was listed for the account), so its slug here only proves the router takes it from the list.
 */

const DIR = path.resolve('registry/skills/host-agent-router');
const SCRIPT = path.join(DIR, 'scripts', 'router.mjs');
const CFG = JSON.parse(fs.readFileSync(path.join(DIR, 'assets', 'config.default.json'), 'utf8')) as Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const lib = async (): Promise<Record<string, Any>> => (await import(pathToFileURL(SCRIPT).href)) as Record<string, Any>;

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'har-pool-'));
  dirs.push(d);
  return d;
}

// ---------------------------------------------------------------------------------------------------- fixtures

type Row = [string, string];
const AGY_ALL: Row[] = [
  ['gemini-4-neon-high', 'Gemini 4 Neon (High)'], ['gemini-4-neon-xhigh', 'Gemini 4 Neon (XHigh)'], ['gemini-4-neon-medium', 'Gemini 4 Neon (Medium)'], ['gemini-4-neon-low', 'Gemini 4 Neon (Low)'],
  ['gemini-4-argon-medium', 'Gemini 4 Argon (Medium)'], ['gemini-4-argon-high', 'Gemini 4 Argon (High)'], ['gemini-4-argon-low', 'Gemini 4 Argon (Low)'],
  ['gemini-4-hydrogen-high', 'Gemini 4 Hydrogen (High)'], ['gemini-4-hydrogen-xhigh', 'Gemini 4 Hydrogen (XHigh)'], ['gemini-4-hydrogen-medium', 'Gemini 4 Hydrogen (Medium)'], ['gemini-4-hydrogen-low', 'Gemini 4 Hydrogen (Low)'],
  ['gemini-pro-orchestrator-neon', 'Orchestrator (Neon)'], ['gemini-pro-orchestrator-g1-pro', 'Orchestrator (Argon)'],
  ['gemini-3.8-flash-high', 'Gemini 3.8 Flash (High)'], ['gemini-3.8-flash-medium', 'Gemini 3.8 Flash (Medium)'], ['gemini-3.8-flash-low', 'Gemini 3.8 Flash (Low)'],
  ['claude-opus-5-5-low', 'Claude Opus 5.5 (Low)'], ['claude-opus-5-5-medium', 'Claude Opus 5.5 (Medium)'], ['claude-opus-5-5-high', 'Claude Opus 5.5 (High)'],
  ['claude-sonnet-5-5-low', 'Claude Sonnet 5.5 (Low)'], ['claude-sonnet-5-5-medium', 'Claude Sonnet 5.5 (Medium)'], ['claude-sonnet-5-5-high', 'Claude Sonnet 5.5 (High)'],
  ['gpt-oss-120b-medium', 'GPT-OSS 120B (Medium)'],
];
const NO_ORCHESTRATOR = AGY_ALL.filter(([s]) => !s.includes('orchestrator'));
const NO_NEON_ORCHESTRATOR = AGY_ALL.filter(([s]) => s !== 'gemini-pro-orchestrator-neon');
const WITH_CARBON: Row[] = [['fixture-orchestrator-carbon', 'Orchestrator (Carbon)'], ...AGY_ALL];
const agyText = (rows: Row[], header = ''): string => `${header}${rows.map(([s, n]) => `${s}\t${n}`).join('\n')}\n`;

const ALL_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const CODEX_ALL: Row[] = [
  ['gpt-6.2-sol', 'GPT-6.2 Sol'], ['gpt-6.2-astra', 'GPT-6.2 Astra'], ['gpt-6.1-terra', 'GPT-6.1 Terra'], ['gpt-6.1-sol', 'GPT-6.1 Sol'], ['gpt-6-astra', 'GPT-6 Astra'],
  ['gpt-6-sol', 'GPT-6 Sol'], ['gpt-6-luna', 'GPT-6 Luna'], ['gpt-5.6-sol', 'GPT-5.6 Sol'], ['gpt-5.6-terra', 'GPT-5.6 Terra'], ['gpt-5.6-luna', 'GPT-5.6 Luna'],
];
const codexResponse = (rows: Row[], efforts: Record<string, string[]> = {}, extra: Record<string, unknown> = {}): Record<string, Any> => ({
  id: 3,
  result: {
    data: rows.map(([m, n]) => ({
      id: m, model: m, displayName: n, hidden: false, defaultReasoningEffort: 'medium', inputModalities: ['text', 'image'], supportsPersonality: false, isDefault: m === 'gpt-6.2-sol',
      supportedReasoningEfforts: (efforts[m] ?? (m.endsWith('luna') ? ALL_EFFORTS.filter(e => e !== 'ultra') : ALL_EFFORTS)).map(e => ({ reasoningEffort: e, description: `${e} effort` })),
    })),
    nextCursor: null,
    ...extra,
  },
});

/** A `/usage` readout in the shape of the real one (groups with 5h and weekly buckets). The description of Gemini Models follows the 2026-11-19 facts. */
const usageJson = (o: { gem5h?: number; gemWeekly?: number; argon?: number } = {}): string => JSON.stringify({
  status: 'SUCCESS', response: '',
  command: {
    name: 'usage',
    data: {
      description: 'Within each group, models share a weekly limit and a 5-hour limit.',
      groups: [
        { name: 'Gemini Models', description: 'Models within this group: Gemini 4 Neon, Gemini 4 Hydrogen, Orchestrator (Neon), Gemini 3.8 Flash', buckets: [
          { id: 'gemini-weekly', name: 'Weekly Limit Remaining', window: 'weekly', remaining_fraction: o.gemWeekly ?? 1, reset_time: '2026-11-25T10:00:00Z' },
          { id: 'gemini-5h', name: 'Five Hour Limit Remaining', window: '5h', remaining_fraction: o.gem5h ?? 1, reset_time: '2026-11-19T15:00:00Z' },
        ] },
        { name: 'Claude and GPT models', description: 'Models within this group: Claude Opus, Claude Sonnet, GPT-OSS', buckets: [
          { id: '3p-weekly', name: 'Weekly Limit Remaining', window: 'weekly', remaining_fraction: 1, reset_time: '2026-11-25T10:00:00Z' },
          { id: '3p-5h', name: 'Five Hour Limit Remaining', window: '5h', remaining_fraction: 1, reset_time: '2026-11-19T15:00:00Z' },
        ] },
        { name: 'Gemini 4 Argon', description: 'For paid Pro plans, Argon quota is separate.', buckets: [
          { id: 'gemini-argon-wtu-weekly', name: 'Gemini 4 Argon Weekly Limit', window: 'weekly', remaining_fraction: o.argon ?? 1, reset_time: '2026-11-25T10:00:00Z' },
        ] },
      ],
    },
  },
});

const usageOf = (b: number | null): Any => ({ binding_pct: b, five_hour_pct: null, weekly_pct: null, windows: [] });
const status = (o: Record<string, Any> = {}): Any => ({ installed: true, logged_in: true, usage: null, ...o });
const by = (plan: Any, host: string): Any => plan.candidates.find((c: Any) => c.host === host);

// ---------------------------------------------------------------------------------------------------- the parsers

describe('reading the account model list from the host', () => {
  it('parses `agy models`: one slug<TAB>display-name line per model, nothing else counts', async () => {
    const { parseAgyModels } = await lib();
    const rows = parseAgyModels(agyText(AGY_ALL)) as Array<{ slug: string; name: string }>;
    expect(rows).toHaveLength(23);
    expect(rows[0]).toEqual({ slug: 'gemini-4-neon-high', name: 'Gemini 4 Neon (High)' });
    expect(rows.find(r => r.slug === 'gemini-pro-orchestrator-g1-pro')?.name).toBe('Orchestrator (Argon)');
  });

  it('ignores a spinner or header line, blank lines, colour codes and CRLF', async () => {
    const { parseAgyModels } = await lib();
    const text = `\u001b[2K⠋ Fetching available models...\r\n${agyText(AGY_ALL.slice(0, 3)).replace(/\n/g, '\r\n')}\r\n`;
    expect((parseAgyModels(text) as Array<{ slug: string }>).map(r => r.slug)).toEqual(['gemini-4-neon-high', 'gemini-4-neon-xhigh', 'gemini-4-neon-medium']);
  });

  it('answers null for output it does not recognise: an unreadable list is unknown, never empty', async () => {
    const { parseAgyModels } = await lib();
    for (const text of ['', 'Fetching available models...\n', 'not logged in\n', 'no tab here\n\n']) expect(parseAgyModels(text), JSON.stringify(text)).toBeNull();
  });

  it('builds the Antigravity pool with the display names, once each', async () => {
    const { agyPool } = await lib();
    const pool = agyPool(agyText(WITH_CARBON));
    expect(pool.source).toBe('cli');
    expect(pool.models).toContain('gemini-pro-orchestrator-neon');
    expect(pool.names['fixture-orchestrator-carbon']).toBe('Orchestrator (Carbon)');
    expect(agyPool('garbage')).toBeNull();
  });

  it('parses the app-server `model/list` answer, with the efforts each model offers', async () => {
    const { codexPool } = await lib();
    const pool = codexPool(codexResponse(CODEX_ALL));
    expect(pool.source).toBe('cli');
    expect(pool.models).toEqual(CODEX_ALL.map(([m]) => m));
    expect(pool.names['gpt-6.2-astra']).toBe('GPT-6.2 Astra');
    expect(pool.efforts['gpt-6.2-astra']).toEqual(ALL_EFFORTS);
    expect(pool.efforts['gpt-6-luna']).toEqual(['low', 'medium', 'high', 'xhigh', 'max']); // Luna has no ultra
  });

  it('takes the answer as the whole response or as its result, and leaves hidden models out', async () => {
    const { codexPool } = await lib();
    const resp = codexResponse(CODEX_ALL.slice(0, 2));
    resp.result.data[1].hidden = true;
    expect(codexPool(resp).models).toEqual(['gpt-6.2-sol']);
    expect(codexPool(resp.result).models).toEqual(['gpt-6.2-sol']);
  });

  it('answers null for an error, a missing result, an empty list, or a list that continues on another page', async () => {
    const { codexPool } = await lib();
    expect(codexPool(undefined)).toBeNull();
    expect(codexPool({ id: 3, error: { code: -32600, message: 'restart codex' } })).toBeNull();
    expect(codexPool({ id: 3, result: { data: [], nextCursor: null } })).toBeNull();
    expect(codexPool({ id: 3, result: { nextCursor: null } })).toBeNull();
    expect(codexPool(codexResponse(CODEX_ALL, {}, { nextCursor: 'page-2' }))).toBeNull(); // a partial list would wrongly drop models
  });

  it('makes a pool from the configured override, and a pool that says why it is unknown', async () => {
    const { configPool, unknownPool } = await lib();
    expect(configPool(['gpt-6.1-terra'])).toMatchObject({ source: 'config', models: ['gpt-6.1-terra'] });
    expect(unknownPool('the app-server did not answer')).toMatchObject({ source: 'unknown', models: [], reason: 'the app-server did not answer' });
  });
});

// ---------------------------------------------------------------------------------------------------- the default tiers

describe('the default tiers, as ordered lists', () => {
  const table = async (host: string): Promise<Record<string, Array<[string | undefined, string | undefined, string]>>> => {
    const { tierEntries } = await lib();
    return Object.fromEntries(['simple', 'medium', 'high'].map(t => [t, (tierEntries(CFG.hosts[host].tiers[t]) as Any[]).map(e => [e.model, e.displayName, e.effort])]));
  };

  it('Antigravity: Neon high, Argon fallback', async () => {
    expect(await table('antigravity')).toEqual({
      simple: [['gemini-3.8-flash-medium', undefined, 'medium']],
      medium: [['gemini-4-hydrogen-medium', undefined, 'medium'], ['gemini-3.8-flash-high', undefined, 'high']],
      high: [
        [undefined, 'Orchestrator (Carbon)', 'fixed'],
        ['gemini-pro-orchestrator-neon', undefined, 'fixed'],
        ['gemini-pro-orchestrator-g1-pro', undefined, 'fixed'],
        ['gemini-4-hydrogen-high', undefined, 'high'],
      ],
    });
  });

  it('Codex: Luna then Terra, Sol 6.2 then Sol 6.1, Astra 6.2 at high then Astra 6 then Sol 6.2 at high', async () => {
    expect(await table('codex')).toEqual({
      simple: [['gpt-6-luna', undefined, 'medium'], ['gpt-6.1-terra', undefined, 'medium']],
      medium: [['gpt-6.2-sol', undefined, 'medium'], ['gpt-6.1-sol', undefined, 'medium']],
      high: [['gpt-6.2-astra', undefined, 'high'], ['gpt-6-astra', undefined, 'medium'], ['gpt-6.2-sol', undefined, 'high']],
    });
  });

  it('Claude and Cline keep one model per tier, as before', async () => {
    const { tierEntries } = await lib();
    for (const host of ['claude', 'cline']) for (const t of ['simple', 'medium', 'high']) expect(tierEntries(CFG.hosts[host].tiers[t]), `${host}/${t}`).toHaveLength(1);
  });

  it('no entry names a model that is not in the research facts of 2026-11-19, and the Carbon entry carries no invented slug', async () => {
    const { tierEntries } = await lib();
    const known = new Set([...AGY_ALL.map(([s]) => s), ...CODEX_ALL.map(([m]) => m)]);
    for (const host of ['antigravity', 'codex']) {
      for (const t of ['simple', 'medium', 'high']) {
        for (const e of tierEntries(CFG.hosts[host].tiers[t]) as Any[]) {
          for (const m of [e.model, ...Object.values(e.efforts ?? {}).map((x: Any) => (typeof x === 'string' ? undefined : x.model))].filter(Boolean)) expect(known.has(m), `${host}/${t}: ${m}`).toBe(true);
        }
      }
    }
    const carbon = (tierEntries(CFG.hosts.antigravity.tiers.high) as Any[])[0];
    expect(carbon.model).toBeUndefined();
    expect(carbon.displayName).toBe('Orchestrator (Carbon)');
  });

  it('the Orchestrator entries have a fixed configuration and the quota groups of the facts', async () => {
    const { tierEntries } = await lib();
    const [carbon, neon, argon, hyd] = tierEntries(CFG.hosts.antigravity.tiers.high) as Any[];
    for (const e of [carbon, neon, argon]) expect(e.fixedEffort).toBe(true);
    expect(hyd.fixedEffort).toBeFalsy();
    expect(neon.quotaGroups).toEqual(['Gemini Models']);
    expect(argon.quotaGroups).toEqual(['Gemini Models', 'Gemini 4 Argon']);
  });

  it('is a valid configuration', async () => {
    const { validateConfig } = await lib();
    expect(validateConfig(CFG)).toEqual([]);
  });

  it('lists every configured model once for `models`, display-name entries by their name', async () => {
    const { configuredModels } = await lib();
    expect(configuredModels(CFG, 'codex')).toEqual(['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.2-sol', 'gpt-6.1-sol', 'gpt-6.2-astra', 'gpt-6-astra']);
    const agy = configuredModels(CFG, 'antigravity') as string[];
    expect(agy).toContain('Orchestrator (Carbon)');
    expect(agy).toContain('gemini-pro-orchestrator-g1-pro');
    expect(new Set(agy).size).toBe(agy.length);
  });
});

// ---------------------------------------------------------------------------------------------------- choosing from the pool

describe('choosing the first entry that is in the pool', () => {
  const plan = async (host: string, tier: string, st: Any, effort?: string, cfg: Any = CFG): Promise<Any> => {
    const { buildPlan } = await lib();
    return buildPlan(cfg, tier, { [host]: { windows: st } }, 'windows', [host], 'read-only', effort);
  };
  const agyFull = async (): Promise<Any> => status({ pool: (await lib()).agyPool(agyText(AGY_ALL)) });
  const codexFull = async (): Promise<Any> => status({ pool: (await lib()).codexPool(codexResponse(CODEX_ALL)) });

  it('a pool that has everything picks the first entry of each tier', async () => {
    const agy = await agyFull();
    expect((await plan('antigravity', 'simple', agy)).selected.model).toBe('gemini-3.8-flash-medium');
    expect((await plan('antigravity', 'medium', agy)).selected.model).toBe('gemini-4-hydrogen-medium');
    const codex = await codexFull();
    const simple = (await plan('codex', 'simple', codex)).selected;
    expect([simple.model, simple.effort]).toEqual(['gpt-6-luna', 'medium']);
    expect((await plan('codex', 'medium', codex)).selected.model).toBe('gpt-6.2-sol');
    const high = (await plan('codex', 'high', codex)).selected;
    expect([high.model, high.effort]).toEqual(['gpt-6.2-astra', 'high']);
    expect(high.alternates.map((a: Any) => [a.model, a.effort])).toEqual([['gpt-6-astra', 'medium'], ['gpt-6.2-sol', 'high']]);
    expect(high.skipped_models).toBeUndefined();
  });

  it('Antigravity high: the Neon Orchestrator when the account has no Carbon one, then the Argon one and Hydrogen as fallbacks', async () => {
    const p = await plan('antigravity', 'high', await agyFull());
    expect(p.selected.model).toBe('gemini-pro-orchestrator-neon');
    expect(p.selected.alternates.map((a: Any) => a.model)).toEqual(['gemini-pro-orchestrator-g1-pro', 'gemini-4-hydrogen-high']);
    expect(p.selected.skipped_models).toEqual([{ model: 'Orchestrator (Carbon)', reason: expect.stringMatching(/not in the account's model list/) }]);
  });

  it('takes the slug of the Carbon Orchestrator from the account list by its display name (the slug is not in the config)', async () => {
    const { agyPool } = await lib();
    const p = await plan('antigravity', 'high', status({ pool: agyPool(agyText(WITH_CARBON)) }));
    expect(p.selected.model).toBe('fixture-orchestrator-carbon');
    expect(p.selected.label).toBe('Orchestrator (Carbon)');
    expect(p.selected.alternates.map((a: Any) => a.model)).toEqual(['gemini-pro-orchestrator-neon', 'gemini-pro-orchestrator-g1-pro', 'gemini-4-hydrogen-high']);
    expect(p.selected.skipped_models).toBeUndefined();
  });

  it('a pool without the first entry picks the second and names the skipped one with the reason', async () => {
    const { codexPool } = await lib();
    const pool = codexPool(codexResponse(CODEX_ALL.filter(([m]) => m !== 'gpt-6-luna')));
    const p = await plan('codex', 'simple', status({ pool }));
    expect(p.selected.model).toBe('gpt-6.1-terra');
    expect(p.selected.skipped_models).toEqual([{ model: 'gpt-6-luna', reason: "not in the account's model list" }]);
    expect(p.selected.alternates).toBeUndefined();
  });

  it('a pool without the Orchestrator lines falls back to Hydrogen High and still lets --effort move inside it', async () => {
    const { agyPool } = await lib();
    const st = status({ pool: agyPool(agyText(NO_ORCHESTRATOR)) });
    const p = await plan('antigravity', 'high', st);
    expect([p.selected.model, p.selected.effort]).toEqual(['gemini-4-hydrogen-high', 'high']);
    expect(p.selected.skipped_models.map((s: Any) => s.model)).toEqual(['Orchestrator (Carbon)', 'gemini-pro-orchestrator-neon', 'gemini-pro-orchestrator-g1-pro']);
    const extra = await plan('antigravity', 'high', st, 'extra');
    expect([extra.selected.model, extra.selected.effort, extra.selected.effort_note]).toEqual(['gemini-4-hydrogen-xhigh', 'extra', undefined]);
  });

  it('a pool with none of a tier entries makes the tier unavailable on that host, says so, and falls through to the next host', async () => {
    const { buildPlan, codexPool } = await lib();
    const pool = codexPool(codexResponse(CODEX_ALL.filter(([m]) => m !== 'gpt-6-luna' && m !== 'gpt-6.1-terra')));
    const plan2 = buildPlan(CFG, 'simple', { codex: { windows: status({ pool }) }, claude: { windows: status({ usage: usageOf(80) }) } }, 'windows', undefined, 'read-only');
    expect(plan2.selected.host).toBe('claude');
    const skip = plan2.skipped.find((s: Any) => s.host === 'codex');
    expect(skip.reason).toMatch(/no model of the simple tier is in the account's model list/);
    expect(skip.reason).toContain('gpt-6-luna');
    expect(skip.reason).toContain('gpt-6.1-terra');
  });

  it('an unreadable pool behaves as before: the first entry that has a model id, and the plan says the pool is unknown', async () => {
    const { buildPlan, unknownPool } = await lib();
    const st = status({ pool: unknownPool('agy models failed') });
    const p = buildPlan(CFG, 'high', { antigravity: { windows: st }, codex: { windows: status({ pool: unknownPool('the app-server did not answer') }) } }, 'windows', ['antigravity', 'codex'], 'read-only');
    expect(by(p, 'antigravity').model).toBe('gemini-pro-orchestrator-neon'); // Carbon has no model id to start with, so it is skipped
    expect(by(p, 'antigravity').skipped_models[0]).toEqual({ model: 'Orchestrator (Carbon)', reason: expect.stringMatching(/no model id is configured/) });
    expect(by(p, 'codex').model).toBe('gpt-6.2-astra');
    expect(by(p, 'codex').skipped_models).toBeUndefined();
    expect(p.pools['antigravity/windows']).toMatchObject({ source: 'unknown', reason: 'agy models failed' });
    expect(p.pools['codex/windows']).toMatchObject({ source: 'unknown' });
  });

  it('a status with no pool at all (an older replay) behaves like an unknown pool and never blocks', async () => {
    const p = await plan('codex', 'medium', status());
    expect(p.selected.model).toBe('gpt-6.2-sol');
    expect(p.selected.alternates.map((a: Any) => a.model)).toEqual(['gpt-6.1-sol']);
  });

  it('reports each pool read, and only for hosts that have one', async () => {
    const { buildPlan, agyPool } = await lib();
    const p = buildPlan(CFG, 'simple', { antigravity: { windows: status({ pool: agyPool(agyText(AGY_ALL)) }) }, claude: { windows: status() } }, 'windows', undefined, 'read-only');
    expect(p.pools).toEqual({ 'antigravity/windows': { source: 'cli', models: 23 } });
  });

  it('Claude and Cline are untouched: one model per tier, no pool read', async () => {
    const { buildPlan } = await lib();
    const p = buildPlan(CFG, 'high', { claude: { windows: status() }, cline: { windows: status() } }, 'windows', undefined, 'read-only');
    expect(by(p, 'claude').model).toBe('claude-opus-5-5');
    expect(by(p, 'cline').model).toBe('cline-pass/kimi-k3.1-pro');
    expect(by(p, 'claude').alternates).toBeUndefined();
    expect(p.pools).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------------- efforts

describe('efforts with the pool', () => {
  const plan = async (host: string, tier: string, st: Any, effort?: string): Promise<Any> => (await lib()).buildPlan(CFG, tier, { [host]: { windows: st } }, 'windows', [host], 'read-only', effort);

  it('an Orchestrator entry has a fixed configuration: --effort does not change the model, and the plan says it was not applied and why', async () => {
    const { agyPool, buildSpec } = await lib();
    const p = await plan('antigravity', 'high', status({ pool: agyPool(agyText(AGY_ALL)) }), 'high');
    const c = p.selected;
    expect([c.model, c.effort]).toEqual(['gemini-pro-orchestrator-neon', 'fixed']);
    expect(c.effort_note).toMatch(/--effort "high" was not applied/);
    expect(c.effort_note).toMatch(/Orchestrator \(Neon\)/);
    expect(c.effort_note).toMatch(/fixed configuration/);
    const args = buildSpec(CFG, 'antigravity', c, 'x', 'read-only', '/w', 'high').args as string[];
    expect(args[args.indexOf('--model') + 1]).toBe('gemini-pro-orchestrator-neon');
    expect(args).not.toContain('--effort');
  });

  it('without --effort an Orchestrator entry has no effort note', async () => {
    const { agyPool } = await lib();
    const p = await plan('antigravity', 'high', status({ pool: agyPool(agyText(AGY_ALL)) }));
    expect(p.selected.effort_note).toBeUndefined();
  });

  it('a name that only fixed entries could take is not an effort: the known efforts of a tier leave out the fixed ones', async () => {
    const { knownEfforts } = await lib();
    expect(knownEfforts(CFG, 'high', ['antigravity'])).not.toContain('fixed');
    expect(knownEfforts(CFG, 'high', ['antigravity'])).toEqual(expect.arrayContaining(['high', 'extra']));
  });

  it('Codex takes low, medium, high, xhigh and max where the model offers it, and the router does not offer ultra', async () => {
    const { resolveEffort, knownEfforts, checkEffort } = await lib();
    for (const e of ['low', 'medium', 'high', 'xhigh', 'max']) expect(resolveEffort(CFG, 'codex', 'medium', e), e).toMatchObject({ model: 'gpt-6.2-sol', effort: e, note: null });
    expect(knownEfforts(CFG, 'high', ['codex'])).toEqual(['high', 'low', 'max', 'medium', 'xhigh']);
    expect(checkEffort(CFG, 'high', 'ultra', ['codex'])).toMatch(/--effort "ultra" is not an effort of the high tier on codex; known: high, low, max, medium, xhigh/);
  });

  it('an effort the pool says the model does not offer is not applied: the entry keeps its own, with a note', async () => {
    const { codexPool } = await lib();
    const pool = codexPool(codexResponse(CODEX_ALL, { 'gpt-6.2-sol': ['low', 'medium', 'high'] }));
    const p = await plan('codex', 'medium', status({ pool }), 'max');
    expect([p.selected.model, p.selected.effort]).toEqual(['gpt-6.2-sol', 'medium']);
    expect(p.selected.effort_note).toMatch(/gpt-6\.2-sol does not offer "max" on this account; kept medium/);
    const ok = await plan('codex', 'medium', status({ pool }), 'high');
    expect([ok.selected.effort, ok.selected.effort_note]).toEqual(['high', undefined]);
  });

  it('every alternate carries its own effort for the asked name', async () => {
    const { codexPool } = await lib();
    const p = await plan('codex', 'high', status({ pool: codexPool(codexResponse(CODEX_ALL)) }), 'max');
    expect([p.selected.model, p.selected.effort]).toEqual(['gpt-6.2-astra', 'max']);
    expect(p.selected.alternates.map((a: Any) => [a.model, a.effort])).toEqual([['gpt-6-astra', 'max'], ['gpt-6.2-sol', 'max']]);
  });
});

// ---------------------------------------------------------------------------------------------------- quota groups

describe('quota groups of the Orchestrator entries', () => {
  const resolvedHigh = async (): Promise<Any[]> => {
    const { tierEntries, resolveEntry } = await lib();
    return (tierEntries(CFG.hosts.antigravity.tiers.high) as Any[]).map(e => resolveEntry(e, 'antigravity', 'high', undefined));
  };
  const groups = CFG.hosts.antigravity.quotaGroups;

  it('reads several groups into one readout: the smaller headroom counts, and each window names its group', async () => {
    const { parseAgyUsageGroups, makeUsage } = await lib();
    const w = parseAgyUsageGroups(usageJson({ gem5h: 0.9, gemWeekly: 0.8, argon: 0.05 }), ['Gemini Models', 'Gemini 4 Argon']) as Any[];
    expect(w.map(x => [x.group, x.name, x.remaining_pct])).toEqual([['Gemini Models', 'weekly', 80], ['Gemini Models', 'five_hour', 90], ['Gemini 4 Argon', 'weekly', 5]]);
    const u = makeUsage(w);
    expect([u.binding_pct, u.weekly_pct, u.five_hour_pct]).toEqual([5, 5, 90]);
    expect(parseAgyUsageGroups('not json', ['Gemini Models'])).toEqual([]);
  });

  it('Orchestrator (Neon) needs headroom in Gemini Models; Orchestrator (Argon) needs it in both Gemini Models and Gemini 4 Argon', async () => {
    const { agyUsageByModel, agyPool } = await lib();
    const pool = agyPool(agyText(AGY_ALL));
    const by1 = agyUsageByModel(usageJson({ gem5h: 0.9, gemWeekly: 0.8, argon: 0.05 }), await resolvedHigh(), pool, groups) as Record<string, Any>;
    expect(by1['gemini-pro-orchestrator-neon'].binding_pct).toBe(80);
    expect(by1['gemini-pro-orchestrator-g1-pro'].binding_pct).toBe(5);
    expect(by1['gemini-4-hydrogen-high'].binding_pct).toBe(80);
    const by2 = agyUsageByModel(usageJson({ gem5h: 0.04, gemWeekly: 0.8, argon: 1 }), await resolvedHigh(), pool, groups) as Record<string, Any>;
    expect(by2['gemini-pro-orchestrator-neon'].binding_pct).toBe(4);
    expect(by2['gemini-pro-orchestrator-g1-pro'].binding_pct).toBe(4);
  });

  it('gives the Carbon entry the usage of its slug from the account list and the groups of its entry', async () => {
    const { agyUsageByModel, agyPool } = await lib();
    const pool = agyPool(agyText(WITH_CARBON));
    const r = await agyUsageByModel(usageJson({ gemWeekly: 0.7 }), await resolvedHigh(), pool, groups);
    expect(r['fixture-orchestrator-carbon'].binding_pct).toBe(70);
  });

  it('the plan skips an entry whose group is below the floor and takes the next one, naming the headroom', async () => {
    const { agyUsageByModel, agyPool, buildPlan } = await lib();
    const pool = agyPool(agyText(NO_NEON_ORCHESTRATOR));
    const usage_by_model = agyUsageByModel(usageJson({ gem5h: 0.9, gemWeekly: 0.8, argon: 0.05 }), await resolvedHigh(), pool, groups);
    const p = buildPlan(CFG, 'high', { antigravity: { windows: status({ pool, usage: usage_by_model['gemini-4-hydrogen-high'], usage_by_model }) } }, 'windows', ['antigravity'], 'read-only');
    expect(p.selected.model).toBe('gemini-4-hydrogen-high');
    expect(p.selected.binding_pct).toBe(80);
    expect(p.selected.skipped_models).toEqual(expect.arrayContaining([{ model: 'gemini-pro-orchestrator-g1-pro', reason: 'headroom 5% below minimum 10%' }]));
  });

  it('when Gemini Models is below the floor every Orchestrator and Hydrogen entry is out and the host is skipped for headroom', async () => {
    const { agyUsageByModel, agyPool, buildPlan } = await lib();
    const pool = agyPool(agyText(AGY_ALL));
    const usage_by_model = agyUsageByModel(usageJson({ gem5h: 0.04 }), await resolvedHigh(), pool, groups);
    const p = buildPlan(CFG, 'high', { antigravity: { windows: status({ pool, usage_by_model }) } }, 'windows', ['antigravity'], 'read-only');
    expect(p.selected).toBeNull();
    expect(p.skipped[0].reason).toMatch(/headroom 4% below minimum 10%/);
  });

  it('keeps the host-level prefix map for models without an entry-level list, and a list in the map', async () => {
    const { agyGroupsFor } = await lib();
    expect(agyGroupsFor('gemini-4-argon-medium', groups, undefined)).toEqual(['Gemini 4 Argon']);
    expect(agyGroupsFor('gemini-4-hydrogen-high', groups, undefined)).toEqual(['Gemini Models']);
    expect(agyGroupsFor('claude-opus-5-5-high', groups, undefined)).toEqual(['Claude and GPT models']);
    expect(agyGroupsFor('gemini-pro-orchestrator-g1-pro', { 'gemini-': ['A', 'B'] }, undefined)).toEqual(['A', 'B']);
    expect(agyGroupsFor('gemini-pro-orchestrator-g1-pro', groups, ['X'])).toEqual(['X']);
  });
});

// ---------------------------------------------------------------------------------------------------- a refused model

describe('a refused model moves to the next model of the same tier on the same host first', () => {
  const alt = (model: string): Any => ({ model, effort: 'medium', label: model });
  const cands = (): Any[] => [
    { host: 'codex', side: 'windows', model: 'gpt-6.2-sol', effort: 'medium', label: 'a', alternates: [alt('gpt-6.1-sol')] },
    { host: 'claude', side: 'windows', model: 'claude-sonnet-5-5', effort: 'medium', label: 'c' },
  ];
  const run = async (results: Array<Any>): Promise<{ tried: string[]; out: Any }> => {
    const { runAttempts } = await lib();
    const tried: string[] = [];
    let i = 0;
    const out = await runAttempts({ cands: cands(), access: 'read-only', cwd: tmp(), tryOne: async (c: Any) => { tried.push(`${c.host}:${c.model}`); return results[i++]; } });
    return { tried, out };
  };
  const refused = { rc: 1, stdout: '', stderr: 'Error: unknown model gpt-6.2-sol', seconds: 1 };
  const ok = { rc: 0, stdout: 'done', stderr: '', seconds: 1 };

  it('tries the next model of the tier on the same host before any other host', async () => {
    const { tried, out } = await run([refused, ok]);
    expect(tried).toEqual(['codex:gpt-6.2-sol', 'codex:gpt-6.1-sol']);
    expect(out.attempts.map((a: Any) => [a.host, a.model, a.failure])).toEqual([['codex', 'gpt-6.2-sol', 'model'], ['codex', 'gpt-6.1-sol', null]]);
  });

  it('falls through to the next host only after every model of the tier on this host was refused', async () => {
    const { tried } = await run([refused, { ...refused, stderr: 'Error: invalid model gpt-6.1-sol' }, ok]);
    expect(tried).toEqual(['codex:gpt-6.2-sol', 'codex:gpt-6.1-sol', 'claude:claude-sonnet-5-5']);
  });

  it('a limit or a login failure does not try another model of the host, it falls through as before', async () => {
    const { tried } = await run([{ rc: 1, stdout: '', stderr: 'rate limit reached', seconds: 1 }, ok]);
    expect(tried).toEqual(['codex:gpt-6.2-sol', 'claude:claude-sonnet-5-5']);
  });

  it('the retry runs with the alternate model, effort and label, and not with the note of the first', async () => {
    const { runAttempts } = await lib();
    const seen: Any[] = [];
    const first = { host: 'codex', side: 'windows', model: 'gpt-6.2-astra', effort: 'high', label: 'A', effort_note: 'first note', alternates: [{ model: 'gpt-6-astra', effort: 'medium', label: 'B' }, { model: 'gpt-6.2-sol', effort: 'high', label: 'C', effort_note: 'third note' }] };
    let n = 0;
    const out = await runAttempts({ cands: [first], access: 'read-only', cwd: tmp(), tryOne: async (c: Any) => { seen.push(c); return n++ < 2 ? refused : ok; } });
    expect(seen.map(c => [c.model, c.effort, c.label, c.effort_note])).toEqual([['gpt-6.2-astra', 'high', 'A', 'first note'], ['gpt-6-astra', 'medium', 'B', undefined], ['gpt-6.2-sol', 'high', 'C', 'third note']]);
    expect(seen[1].alternates.map((a: Any) => a.model)).toEqual(['gpt-6.2-sol']);
    expect(out.last[0].model).toBe('gpt-6.2-sol');
  });

  it('in an edit run a refused model that changed files still stops the route', async () => {
    const { runAttempts } = await lib();
    const dir = tmp();
    const tried: string[] = [];
    const out = await runAttempts({
      cands: cands(), access: 'edit', cwd: dir,
      tryOne: async (c: Any) => { tried.push(c.model); fs.writeFileSync(path.join(dir, 'x.txt'), 'half'); return refused; },
      ignoredOf: () => null,
    });
    expect(tried).toEqual(['gpt-6.2-sol']);
    expect(out.stopped).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------------- the override

describe('an explicit pool in the user config replaces the one the CLI gives', () => {
  it('takes the configured list for the host: the CLI list is ignored and the plan says the source is the config', async () => {
    const { mergeConfig, validateConfig, buildPlan, codexPool } = await lib();
    const cfg = mergeConfig(CFG, { hosts: { codex: { pool: ['gpt-6.1-terra', 'gpt-6.1-sol'] } } });
    expect(validateConfig(cfg)).toEqual([]);
    const p = buildPlan(cfg, 'simple', { codex: { windows: status({ pool: codexPool(codexResponse(CODEX_ALL)) }) } }, 'windows', ['codex'], 'read-only');
    expect(p.selected.model).toBe('gpt-6.1-terra');
    expect(p.selected.skipped_models).toEqual([{ model: 'gpt-6-luna', reason: 'not in the configured pool' }]);
    expect(p.pools['codex/windows']).toEqual({ source: 'config', models: 2 });
    expect(CFG.hosts.codex.pool).toBeUndefined(); // the base is not mutated
  });

  it('works when the CLI list could not be read at all, which is what it is for', async () => {
    const { mergeConfig, buildPlan } = await lib();
    const cfg = mergeConfig(CFG, { hosts: { codex: { pool: ['gpt-6.2-sol'] } } });
    const p = buildPlan(cfg, 'medium', { codex: { windows: status() } }, 'windows', ['codex'], 'read-only');
    expect(p.selected.model).toBe('gpt-6.2-sol');
    expect(p.selected.alternates).toBeUndefined(); // gpt-6.1-sol is not in the configured pool
    expect(p.selected.skipped_models).toEqual([{ model: 'gpt-6.1-sol', reason: 'not in the configured pool' }]);
  });

  it('is validated with clear messages, and null clears it', async () => {
    const { mergeConfig, validateConfig } = await lib();
    const bad = (pool: unknown): string => validateConfig(mergeConfig(CFG, { hosts: { codex: { pool } } })).join('\n');
    expect(bad('gpt-6.2-sol')).toMatch(/codex: pool must be a non-empty list of model names/);
    expect(bad([])).toMatch(/codex: pool must be a non-empty list of model names/);
    expect(bad([1])).toMatch(/codex: pool must be a non-empty list of model names/);
    expect(bad([''])).toMatch(/codex: pool must be a non-empty list of model names/);
    expect(bad(null)).toBe('');
    expect(bad(['gpt-6.2-sol'])).toBe('');
  });
});

// ---------------------------------------------------------------------------------------------------- old shape and the new shape of a config

describe('the config shape: ordered lists, and the old one model string per tier still works', () => {
  it('an old-shape override (one model string for a tier) replaces the whole tier and keeps working', async () => {
    const { mergeConfig, validateConfig, tierEntries, buildPlan, codexPool } = await lib();
    const merged = mergeConfig(CFG, { hosts: { codex: { tiers: { high: { model: 'gpt-6-sol' } } } } });
    expect(validateConfig(merged)).toEqual([]);
    expect((tierEntries(merged.hosts.codex.tiers.high) as Any[]).map(e => [e.model, e.effort])).toEqual([['gpt-6-sol', 'medium']]);
    expect((tierEntries(merged.hosts.codex.tiers.simple) as Any[]).map(e => e.model)).toEqual(['gpt-6-luna', 'gpt-6.1-terra']); // other tiers keep their lists
    const p = buildPlan(merged, 'high', { codex: { windows: status({ pool: codexPool(codexResponse(CODEX_ALL)) }) } }, 'windows', ['codex'], 'read-only');
    expect(p.selected.model).toBe('gpt-6-sol');
    expect(p.selected.alternates).toBeUndefined();
  });

  it('an old-shape override with its own effort, label and efforts keeps them', async () => {
    const { mergeConfig, validateConfig, tierEntries } = await lib();
    const merged = mergeConfig(CFG, { hosts: { codex: { tiers: { medium: { model: 'gpt-6.1-sol', effort: 'low', label: 'mine', efforts: { extra: 'xhigh' } } } } } });
    expect(validateConfig(merged)).toEqual([]);
    expect((tierEntries(merged.hosts.codex.tiers.medium) as Any[])[0]).toMatchObject({ model: 'gpt-6.1-sol', effort: 'low', label: 'mine', efforts: { extra: 'xhigh' } });
  });

  it('a user config with only efforts for a tier adds them to the tier as its user map; the shipped maps answer the names it lacks', async () => {
    const { mergeConfig, validateConfig, resolveEffort } = await lib();
    const merged = mergeConfig(CFG, { hosts: { antigravity: { tiers: { medium: { efforts: { max: { model: 'gemini-4-hydrogen-xhigh' } } } } } } });
    expect(validateConfig(merged)).toEqual([]);
    expect(resolveEffort(merged, 'antigravity', 'medium', 'max').model).toBe('gemini-4-hydrogen-xhigh');
    expect(resolveEffort(merged, 'antigravity', 'medium', 'extra').model).toBe('gemini-4-hydrogen-xhigh'); // the shipped effort is still there
    expect(resolveEffort(merged, 'antigravity', 'medium', 'high').model).toBe('gemini-4-hydrogen-high');
  });

  it('a new-shape override replaces the list of a tier; entries may be plain model names', async () => {
    const { mergeConfig, validateConfig, tierEntries } = await lib();
    const merged = mergeConfig(CFG, { hosts: { codex: { tiers: { simple: { effort: 'low', models: ['gpt-6.1-terra', { model: 'gpt-6-luna', label: 'Luna', effort: 'high' }] } } } } });
    expect(validateConfig(merged)).toEqual([]);
    expect((tierEntries(merged.hosts.codex.tiers.simple) as Any[]).map(e => [e.model, e.effort, e.label])).toEqual([['gpt-6.1-terra', 'low', 'gpt-6.1-terra'], ['gpt-6-luna', 'high', 'Luna']]);
  });

  it('a fully old-shape host (no lists anywhere) is valid', async () => {
    const { validateConfig, tierEntries } = await lib();
    const t = (m: string): Any => ({ label: m, model: m, effort: 'medium' });
    const cfg = { ...CFG, priority: ['claude'], hosts: { claude: { tiers: { simple: t('a'), medium: t('b'), high: t('c') } } } };
    expect(validateConfig(cfg)).toEqual([]);
    expect((tierEntries(cfg.hosts.claude.tiers.high) as Any[])[0]).toMatchObject({ model: 'c', effort: 'medium', label: 'c' });
  });

  it('rejects broken lists with messages that name the host, the tier and the entry', async () => {
    const { mergeConfig, validateConfig } = await lib();
    const bad = (tier: Any): string => validateConfig(mergeConfig(CFG, { hosts: { codex: { tiers: { high: tier } } } })).join('\n');
    expect(bad({ models: [] })).toMatch(/codex\/high: models must be a non-empty list/);
    expect(bad({ models: 'gpt-6-sol' })).toMatch(/codex\/high: models must be a non-empty list/);
    expect(bad({ models: [{ effort: 'high' }] })).toMatch(/codex\/high: entry 1 needs a model or a displayName/);
    expect(bad({ models: [{ model: 'x', effort: 'HIGH' }] })).toMatch(/codex\/high: entry 1 needs an effort/);
    expect(bad({ models: [{ model: 'x', effort: 'high' }, 7] })).toMatch(/codex\/high: entry 2 must be a model name or an object/);
    expect(bad({ models: [{ model: 'x', effort: 'high', fixedEffort: 'yes' }] })).toMatch(/codex\/high: entry 1: fixedEffort must be true or false/);
    expect(bad({ models: [{ model: 'x', effort: 'high', efforts: 'high' }] })).toMatch(/codex\/high\[1\]: efforts must be an object/);
    expect(bad({ models: [{ model: 'x', effort: 'high', quotaGroups: 'G' }] })).toMatch(/codex\/high: entry 1: quotaGroups must be a list of group names/);
    expect(bad({ models: [{ displayName: 'Orchestrator (Carbon)', effort: 'high' }] })).toBe('');
    expect(bad({ models: [{ model: 'x', fixedEffort: true }] })).toBe('');
  });
});

// ---------------------------------------------------------------------------------------------------- on the command line

describe('on the command line (replayed statuses, nothing is started)', () => {
  const run = (args: string[]): { status: number | null; out: string; json: Any } => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, HOST_AGENT_ROUTER_DEPTH: '', HOST_AGENT_ROUTER_CONFIG: path.join(tmp(), 'none.json') } });
    let json: Any = null;
    try { json = JSON.parse(r.stdout); } catch { /* text */ }
    return { status: r.status, out: `${r.stdout}${r.stderr}`, json };
  };
  const replay = async (agyRows: Row[] = AGY_ALL): Promise<string> => {
    const { agyPool, codexPool } = await lib();
    const f = path.join(tmp(), 'statuses.json');
    fs.writeFileSync(f, JSON.stringify({
      antigravity: { windows: status({ pool: agyPool(agyText(agyRows)), usage: usageOf(90) }) },
      codex: { windows: status({ pool: codexPool(codexResponse(CODEX_ALL)), usage: usageOf(70) }) },
    }));
    return f;
  };

  it('plan: the chosen model, the alternates, the skipped entries with reasons and the pools', async () => {
    const r = run(['plan', '--tier', 'high', '--here', 'windows', '--statuses-file', await replay(NO_ORCHESTRATOR), '--host', 'antigravity', '--host', 'codex']);
    expect(r.status).toBe(0);
    const agy = by(r.json, 'antigravity');
    expect([agy.model, agy.effort]).toEqual(['gemini-4-hydrogen-high', 'high']);
    expect(agy.skipped_models.map((s: Any) => s.model)).toEqual(['Orchestrator (Carbon)', 'gemini-pro-orchestrator-neon', 'gemini-pro-orchestrator-g1-pro']);
    expect(by(r.json, 'codex').model).toBe('gpt-6.2-astra');
    expect(r.json.pools).toEqual({ 'antigravity/windows': { source: 'cli', models: 21 }, 'codex/windows': { source: 'cli', models: 10 } });
  });

  it('plan --effort high with the Orchestrator available: the note says it was not applied', async () => {
    const r = run(['plan', '--tier', 'high', '--effort', 'high', '--here', 'windows', '--statuses-file', await replay(), '--host', 'antigravity']);
    expect(r.status).toBe(0);
    expect(by(r.json, 'antigravity').effort_note).toMatch(/was not applied/);
  });

  it('status: the table shows the chosen model of each side and prints a line for every skipped model', async () => {
    const r = run(['status', '--tier', 'high', '--here', 'windows', '--statuses-file', await replay(NO_ORCHESTRATOR), '--host', 'antigravity']);
    expect(r.status).toBe(0);
    expect(r.out).toContain('gemini-4-hydrogen-high');
    expect(r.out).toMatch(/skipped model[^\n]*antigravity[^\n]*gemini-pro-orchestrator-neon[^\n]*not in the account's model list/);
  });

  it('run --dry-run: the command line carries the chosen slug, and the alternates are listed for the retry', async () => {
    const r = run(['run', '--tier', 'high', '--prompt', 'x', '--dry-run', '--here', 'windows', '--statuses-file', await replay(), '--host', 'antigravity', '--cwd', tmp()]);
    expect(r.status).toBe(0);
    const t = r.json.would_try[0];
    expect(t.args[t.args.indexOf('--model') + 1]).toBe('gemini-pro-orchestrator-neon');
    expect(t.alternates.map((a: Any) => a.model)).toEqual(['gemini-pro-orchestrator-g1-pro', 'gemini-4-hydrogen-high']);
    expect(r.json.plan.pools['antigravity/windows']).toEqual({ source: 'cli', models: 23 });
  });

  it('an effort no entry knows is still a usage error, ultra included', async () => {
    const r = run(['plan', '--tier', 'high', '--effort', 'ultra', '--here', 'windows', '--statuses-file', await replay(), '--host', 'codex']);
    expect(r.status).toBe(64);
    expect(r.out).toMatch(/--effort "ultra" is not an effort of the high tier on codex/);
  });
});

// ---------------------------------------------------------------------------------------------------- a config written for 1.1.2

describe('a user config written for 1.1.2: a model override defines the tier completely', () => {
  const over = (host: string, tier: string, t: Any): Any => ({ hosts: { [host]: { tiers: { [tier]: t } } } });
  const plan = async (cfg: Any, host: string, tier: string, effort?: string, st: Any = status()): Promise<Any> => (await lib()).buildPlan(cfg, tier, { [host]: { windows: st } }, 'windows', [host], 'read-only', effort);

  it('codex high with only a model runs effort medium, as in 1.1.2, with no alternates and nothing from the shipped entries', async () => {
    const { mergeConfig, tierEntries, validateConfig } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'high', { model: 'gpt-6-astra' }));
    expect(validateConfig(cfg)).toEqual([]);
    expect(cfg.hosts.codex.tiers.high).toEqual({ model: 'gpt-6-astra', effort: 'medium' });
    expect(tierEntries(cfg.hosts.codex.tiers.high)).toHaveLength(1);
    const p = await plan(cfg, 'codex', 'high');
    expect([p.selected.model, p.selected.effort, p.selected.alternates]).toEqual(['gpt-6-astra', 'medium', undefined]);
  });

  it('antigravity high with only a model is a normal model at effort medium, never the fixed effort of the shipped Orchestrator', async () => {
    const { mergeConfig, tierEntries, validateConfig, buildSpec, agyGroupsFor } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'high', { model: 'gemini-4-argon-medium' }));
    expect(validateConfig(cfg)).toEqual([]);
    const [e] = tierEntries(cfg.hosts.antigravity.tiers.high) as Any[];
    expect([e.model, e.effort, e.fixedEffort, e.efforts, e.quotaGroups]).toEqual(['gemini-4-argon-medium', 'medium', undefined, undefined, undefined]);
    const p = await plan(cfg, 'antigravity', 'high');
    expect([p.selected.model, p.selected.effort]).toEqual(['gemini-4-argon-medium', 'medium']);
    expect(agyGroupsFor('gemini-4-argon-medium', cfg.hosts.antigravity.quotaGroups, e.quotaGroups)).toEqual(['Gemini 4 Argon']); // the host-level prefix rules
    const args = buildSpec(cfg, 'antigravity', p.selected, 'x', 'read-only', '/w', 'high').args as string[];
    expect(args[args.indexOf('--model') + 1]).toBe('gemini-4-argon-medium');
  });

  it('the shipped efforts maps do not merge into a model override; the user gives an efforts map to get --effort variants', async () => {
    const { mergeConfig } = await lib();
    const none = mergeConfig(CFG, over('antigravity', 'medium', { model: 'gemini-4-hydrogen-medium' }));
    const p = await plan(none, 'antigravity', 'medium', 'extra');
    expect(p.selected.model).toBe('gemini-4-hydrogen-medium'); // 1.1.2 would have said gemini-4-hydrogen-xhigh
    const own = mergeConfig(CFG, over('antigravity', 'high', { model: 'gemini-4-argon-medium', efforts: { high: { label: 'Argon High', model: 'gemini-4-argon-high' } } }));
    const q = await plan(own, 'antigravity', 'high', 'high');
    expect([q.selected.model, q.selected.effort, q.selected.label]).toEqual(['gemini-4-argon-high', 'high', 'Argon High']);
  });

  it('with --effort and no mapping the note says so and names the config key; a name no host knows gets the same hint in the usage error', async () => {
    const { mergeConfig, checkEffort } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'high', { model: 'gemini-4-argon-medium' }));
    const p = await plan(cfg, 'antigravity', 'high', 'high');
    expect([p.selected.model, p.selected.effort]).toEqual(['gemini-4-argon-medium', 'medium']);
    expect(p.selected.effort_note).toMatch(/no "high" effort in the high tier; kept gemini-4-argon-medium \(medium\)/);
    expect(p.selected.effort_note).toContain('hosts.antigravity.tiers.high.efforts.high');
    const bad = checkEffort(cfg, 'high', 'high', ['antigravity']) as string;
    expect(bad).toMatch(/--effort "high" is not an effort of the high tier on antigravity; known: medium/);
    expect(bad).toContain('hosts.<host>.tiers.high.efforts');
  });

  it('a one-model host (Claude, Cline) is defined completely by a model override too, including its label', async () => {
    const { mergeConfig } = await lib();
    const cfg = mergeConfig(CFG, over('claude', 'high', { model: 'claude-sonnet-5-5' }));
    expect(cfg.hosts.claude.tiers.high).toEqual({ model: 'claude-sonnet-5-5', effort: 'medium' });
    expect(mergeConfig(CFG, over('claude', 'high', { model: 'claude-sonnet-5-5', effort: 'high', label: 'S' })).hosts.claude.tiers.high).toEqual({ label: 'S', model: 'claude-sonnet-5-5', effort: 'high' });
  });
});

describe('a tier override that gives no model', () => {
  const over = (host: string, tier: string, t: Any): Any => ({ hosts: { [host]: { tiers: { [tier]: t } } } });
  const plan = async (cfg: Any, host: string, tier: string, effort?: string, st: Any = status()): Promise<Any> => (await lib()).buildPlan(cfg, tier, { [host]: { windows: st } }, 'windows', [host], 'read-only', effort);
  const agyFull = async (rows: Row[] = AGY_ALL): Promise<Any> => status({ pool: (await lib()).agyPool(agyText(rows)) });

  it('an effort applies to every entry of the tier that takes one, the alternates included', async () => {
    const { mergeConfig, tierEntries } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'high', { effort: 'low' }));
    expect((tierEntries(cfg.hosts.codex.tiers.high) as Any[]).map(e => e.effort)).toEqual(['low', 'low', 'low']);
    const p = await plan(cfg, 'codex', 'high');
    expect([p.selected.effort, ...p.selected.alternates.map((a: Any) => a.effort)]).toEqual(['low', 'low', 'low']);
  });

  it('an effort does not reach a fixed entry, and the plan says the user effort was not applied', async () => {
    const { mergeConfig, tierEntries } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'high', { effort: 'low' }));
    const entries = tierEntries(cfg.hosts.antigravity.tiers.high) as Any[];
    expect(entries.map(e => e.effort)).toEqual(['fixed', 'fixed', 'fixed', 'low']);
    const p = await plan(cfg, 'antigravity', 'high', undefined, await agyFull());
    expect([p.selected.model, p.selected.effort]).toEqual(['gemini-pro-orchestrator-neon', 'fixed']);
    expect(p.selected.effort_note).toMatch(/effort "low" from your config was not applied/);
    expect(p.selected.effort_note).toMatch(/fixed configuration/);
    const h = await plan(cfg, 'antigravity', 'high', undefined, await agyFull(NO_ORCHESTRATOR));
    expect([h.selected.model, h.selected.effort, h.selected.effort_note]).toEqual(['gemini-4-hydrogen-high', 'low', undefined]); // the entry that takes an effort got it
  });

  it('a label alone applies to the first entry', async () => {
    const { mergeConfig, tierEntries } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'simple', { label: 'mine' }));
    expect((tierEntries(cfg.hosts.codex.tiers.simple) as Any[]).map(e => e.label)).toEqual(['mine', 'GPT-6.1 Terra']);
  });

  it("the reviewer's input: a user efforts map wins over an Orchestrator at the head of the shipped tier", async () => {
    const { mergeConfig, validateConfig } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'high', { efforts: { high: { label: 'x', model: 'gemini-4-argon-high' } } }));
    expect(validateConfig(cfg)).toEqual([]);
    const p = await plan(cfg, 'antigravity', 'high', 'high', await agyFull());
    expect([p.selected.model, p.selected.effort, p.selected.label]).toEqual(['gemini-4-argon-high', 'high', 'x']);
    // the shipped list follows as alternates, without a second copy of the chosen model
    expect(p.selected.alternates.map((a: Any) => a.model)).toEqual(['gemini-pro-orchestrator-neon', 'gemini-pro-orchestrator-g1-pro', 'gemini-4-hydrogen-high']);
  });

  it('the user map named choice is still subject to the pool and the headroom', async () => {
    const { mergeConfig, agyPool } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'high', { efforts: { high: { label: 'x', model: 'gemini-4-argon-high' } } }));
    const noArgon = AGY_ALL.filter(([s]) => s !== 'gemini-4-argon-high');
    const p = await plan(cfg, 'antigravity', 'high', 'high', await agyFull(noArgon));
    expect(p.selected.model).toBe('gemini-pro-orchestrator-neon');
    expect(p.selected.skipped_models).toEqual(expect.arrayContaining([{ model: 'gemini-4-argon-high', reason: "not in the account's model list" }]));
    const usage_by_model = { 'gemini-4-argon-high': usageOf(4), 'gemini-pro-orchestrator-neon': usageOf(80) };
    const q = await plan(cfg, 'antigravity', 'high', 'high', status({ pool: agyPool(agyText(AGY_ALL)), usage_by_model }));
    expect(q.selected.model).toBe('gemini-pro-orchestrator-neon');
    expect(q.selected.skipped_models).toEqual(expect.arrayContaining([{ model: 'gemini-4-argon-high', reason: 'headroom 4% below minimum 10%' }]));
  });

  it('a name the user map does not have falls back to the shipped per-entry maps', async () => {
    const { mergeConfig } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'medium', { efforts: { max: { label: 'M', model: 'gemini-4-hydrogen-xhigh' } } }));
    const m = await plan(cfg, 'antigravity', 'medium', 'max', await agyFull());
    expect(m.selected.model).toBe('gemini-4-hydrogen-xhigh');
    const e = await plan(cfg, 'antigravity', 'medium', 'extra', await agyFull());
    expect(e.selected.model).toBe('gemini-4-hydrogen-xhigh'); // the shipped Hydrogen map answers `extra`
    const l = await plan(cfg, 'antigravity', 'medium', 'low', await agyFull());
    expect(l.selected.model).toBe('gemini-4-hydrogen-low');
  });

  it('a plain effort value in the user map applies to whichever model is chosen', async () => {
    const { mergeConfig } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'medium', { efforts: { extra: 'xhigh' } }));
    const p = await plan(cfg, 'codex', 'medium', 'extra');
    expect([p.selected.model, p.selected.effort, p.selected.alternates.map((a: Any) => a.effort)]).toEqual(['gpt-6.2-sol', 'xhigh', ['xhigh']]);
  });

  it('knows the names of the user map, and checks the user map like any efforts map', async () => {
    const { mergeConfig, knownEfforts, validateConfig, configuredModels } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'high', { efforts: { max: { model: 'gemini-4-argon-high' } } }));
    expect(knownEfforts(cfg, 'high', ['antigravity'])).toContain('max');
    expect(configuredModels(cfg, 'antigravity')).toContain('gemini-4-argon-high');
    expect(validateConfig(mergeConfig(CFG, over('antigravity', 'high', { efforts: { max: 'max' } }))).join('\n')).toMatch(/antigravity\/high.*efforts\.max.*model/);
  });
});

// ---------------------------------------------------------------------------------------------------- noise is not a pool

describe('the parsers do not turn noise into a pool', () => {
  it('a header line with a tab is not a model', async () => {
    const { parseAgyModels } = await lib();
    expect(parseAgyModels('ID\tNAME\n')).toBeNull();
    expect(parseAgyModels('MODEL ID\tDisplay name\ngemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)\n')).toEqual([{ slug: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)' }]);
  });

  it('an error line printed with exit 0 is not trusted as a pool: the plan treats the list as unknown and the host is not skipped', async () => {
    const { agyPool, buildPlan } = await lib();
    const pool = agyPool('error\tnot logged in\n');
    expect(pool).not.toBeNull(); // the parser alone cannot tell; the check against the config can
    const p = buildPlan(CFG, 'medium', { antigravity: { windows: status({ pool }) } }, 'windows', ['antigravity'], 'read-only');
    expect(p.selected.model).toBe('gemini-4-hydrogen-medium');
    expect(p.pools['antigravity/windows']).toMatchObject({ source: 'unknown' });
    expect(p.pools['antigravity/windows'].reason).toMatch(/none of the \d+ models this config names for antigravity \(1 read\), so it is not trusted/);
    expect(p.skipped).toEqual([]);
  });

  it('the same for Codex: a list with none of the configured models is unknown, not a reason to skip the host', async () => {
    const { codexPool, buildPlan } = await lib();
    const pool = codexPool(codexResponse([['gpt-9-x', 'GPT-9 X']]));
    const p = buildPlan(CFG, 'simple', { codex: { windows: status({ pool }) } }, 'windows', ['codex'], 'read-only');
    expect(p.selected.model).toBe('gpt-6-luna');
    expect(p.pools['codex/windows'].source).toBe('unknown');
  });

  it('a list that names even one configured model is trusted, and a configured pool is never second-guessed', async () => {
    const { codexPool, buildPlan, mergeConfig } = await lib();
    const pool = codexPool(codexResponse([['gpt-6.1-sol', 'GPT-6.1 Sol'], ['gpt-9-x', 'GPT-9 X']]));
    const p = buildPlan(CFG, 'medium', { codex: { windows: status({ pool }) } }, 'windows', ['codex'], 'read-only');
    expect(p.pools['codex/windows']).toEqual({ source: 'cli', models: 2 });
    expect(p.selected.model).toBe('gpt-6.1-sol');
    const cfg = mergeConfig(CFG, { hosts: { codex: { pool: ['gpt-9-x'] } } });
    const q = buildPlan(cfg, 'simple', { codex: { windows: status() } }, 'windows', ['codex', 'claude'], 'read-only');
    expect(q.skipped[0].reason).toMatch(/no model of the simple tier is in the configured pool/);
  });

  it('duplicate lines count once; CRLF and colour codes are read', async () => {
    const { parseAgyModels } = await lib();
    const line = 'gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)';
    const text = `\u001b[32m${line}\u001b[0m\r\n${line}\r\ngemini-3.8-flash-low\tGemini 3.8 Flash (Low)\r\n`;
    expect((parseAgyModels(text) as Array<{ slug: string }>).map(r => r.slug)).toEqual(['gemini-3.8-flash-medium', 'gemini-3.8-flash-low']);
  });

  it('a slug in capitals or with spaces is not a model id', async () => {
    const { parseAgyModels } = await lib();
    expect(parseAgyModels('Error\tsomething failed\nfailed to load\tmodels\n')).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------- what the plan and the run say

describe('what the plan and the run result say', () => {
  it('when a model needs two quota groups and the readout has only one, the plan says the other was not in the readout', async () => {
    const { agyUsageByModel, agyPool, buildPlan, tierEntries, resolveEntry } = await lib();
    const text = JSON.stringify({ command: { data: { groups: [{ name: 'Gemini Models', buckets: [{ id: 'w', name: 'Weekly', window: 'weekly', remaining_fraction: 0.8, reset_time: 'x' }] }] } } });
    const resolved = (tierEntries(CFG.hosts.antigravity.tiers.high) as Any[]).map(e => resolveEntry(e, 'antigravity', 'high', undefined));
    const pool = agyPool(agyText(AGY_ALL));
    const byModel = agyUsageByModel(text, resolved, pool, CFG.hosts.antigravity.quotaGroups);
    expect(byModel['gemini-pro-orchestrator-g1-pro'].binding_pct).toBe(80);
    expect(byModel['gemini-pro-orchestrator-g1-pro'].missing_groups).toEqual(['Gemini 4 Argon']);
    expect(byModel['gemini-pro-orchestrator-neon'].missing_groups).toBeUndefined();
    const only = AGY_ALL.filter(([s]) => s !== 'gemini-pro-orchestrator-neon');
    const p = buildPlan(CFG, 'high', { antigravity: { windows: status({ pool: agyPool(agyText(only)), usage_by_model: byModel }) } }, 'windows', ['antigravity'], 'read-only');
    expect(p.selected.model).toBe('gemini-pro-orchestrator-g1-pro');
    expect(p.selected.quota_note).toBe('headroom judged on Gemini Models only: Gemini 4 Argon was not in the /usage readout');
  });

  it('a run result: each attempt carries the models that were passed over before it', async () => {
    const { runAttempts } = await lib();
    const c = { host: 'codex', side: 'windows', model: 'gpt-6.1-terra', effort: 'medium', label: 'T', skipped_models: [{ model: 'gpt-6-luna', reason: "not in the account's model list" }], quota_note: 'q' };
    const out = await runAttempts({ cands: [c], access: 'read-only', cwd: tmp(), tryOne: async () => ({ rc: 0, stdout: 'ok', stderr: '', seconds: 1 }) });
    expect(out.attempts[0].skipped_models).toEqual(c.skipped_models);
    expect(out.attempts[0].quota_note).toBe('q');
  });

  it('a dry run lists skipped_models on the attempt it would make', () => {
    const f = path.join(tmp(), 'statuses.json');
    fs.writeFileSync(f, JSON.stringify({ codex: { windows: status({ pool: JSON.parse(JSON.stringify({ source: 'cli', models: ['gpt-6.1-terra', 'gpt-6.2-sol'], names: {}, efforts: {} })) }) } }));
    const r = spawnSync(process.execPath, [SCRIPT, 'run', '--tier', 'simple', '--prompt', 'x', '--dry-run', '--here', 'windows', '--statuses-file', f, '--host', 'codex', '--cwd', tmp()], { encoding: 'utf8', env: { ...process.env, HOST_AGENT_ROUTER_DEPTH: '', HOST_AGENT_ROUTER_CONFIG: path.join(tmp(), 'none.json') } });
    expect(JSON.parse(r.stdout).would_try[0].skipped_models).toEqual([{ model: 'gpt-6-luna', reason: "not in the account's model list" }]);
  });

  it('duplicate entries in a models list are refused with a clear message', async () => {
    const { mergeConfig, validateConfig } = await lib();
    const bad = (models: Any[]): string => validateConfig(mergeConfig(CFG, { hosts: { codex: { tiers: { high: { models } } } } })).join('\n');
    expect(bad(['gpt-6-astra', { model: 'gpt-6-astra', effort: 'high' }])).toMatch(/codex\/high: entry 2 repeats gpt-6-astra \(entry 1\)/);
    expect(bad([{ displayName: 'Orchestrator (Carbon)' }, { displayName: 'orchestrator (carbon)' }])).toMatch(/codex\/high: entry 2 repeats orchestrator \(carbon\) \(entry 1\)/i);
    expect(bad(['gpt-6-astra', 'gpt-6.2-sol'])).toBe('');
  });
});

// ---------------------------------------------------------------------------------------------------- the documents

describe('the documents state the pool, the tiers and the sources', () => {
  const doc = (f: string): string => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');

  it('SKILL.md is version 1.2.0, names the pool and stays inside its size cap', () => {
    const t = doc('SKILL.md');
    expect(t).toMatch(/version: 1\.2\.0/);
    expect(t).toMatch(/model pool|account's model list/);
    expect(t.length).toBeLessThanOrEqual(6000);
    expect(t.split('\n').length).toBeLessThanOrEqual(90);
  });

  it('hosts.md has a pool section dated 2026-11-19 with the vendor pages and the cautious assumption for Orchestrator (Argon)', () => {
    const t = doc('references/hosts.md');
    const i = t.indexOf('## The model pool');
    expect(i).toBeGreaterThan(-1);
    const section = t.slice(i, t.indexOf('\n## ', i + 5));
    for (const w of ['2026-11-19', 'antigravity.google/docs/plans', 'antigravity.google/docs/models', 'learn.chatgpt.com/docs/models', '`agy models`', '`model/list`', 'cautious assumption', 'not an observation', 'slug not established', '`pool`']) expect(section, w).toContain(w);
    expect(section).toMatch(/Orchestrator \(Argon\)[^\n]*Gemini 4 Argon/);
    expect(section).toMatch(/not built|Not built/);
  });

  it('hosts.md no longer says that no group names Hydrogen, and keeps the maintainer confirmation of 2026-11-13', () => {
    const t = doc('references/hosts.md');
    expect(t).not.toMatch(/none names Hydrogen/);
    expect(t).not.toMatch(/No group names Gemini 4 Hydrogen/);
    expect(t).toContain('confirmed by the maintainer in the Antigravity app on 2026-11-13 (the Gemini Models quotas went down after the Hydrogen runs)');
    expect(t).toMatch(/Gemini Models[^\n]*description[^\n]*Hydrogen/);
  });

  it('hosts.md has the tier tables of both hosts with the Orchestrator and Codex entries, each dated and sourced', () => {
    const t = doc('references/hosts.md');
    for (const w of ['gemini-pro-orchestrator-neon', 'gemini-pro-orchestrator-g1-pro', 'Orchestrator (Carbon)', 'gpt-6-luna', 'gpt-6.2-sol', 'gpt-6.2-astra', 'fixed configuration', '`ultra`']) expect(t, w).toContain(w);
  });

  it('hosts.md has a "Coming from 1.1.2" section: what gives the same plan, the two changes, and the old and new first models', () => {
    const t = doc('references/hosts.md');
    const i = t.indexOf('## Coming from 1.1.2');
    expect(i).toBeGreaterThan(-1);
    const s = t.slice(i, t.indexOf('\n## ', i + 5));
    for (const w of ['defines that tier completely', 'no longer merge into a model override', 'first model of each shipped tier changed', 'gemini-4-argon-medium', 'gemini-pro-orchestrator-neon', 'gpt-6.1-sol', 'gpt-6.2-sol', 'gpt-6-astra']) expect(s, w).toContain(w);
    expect(t).not.toContain('changes the first model of the shipped list');
    expect(t).toContain('quota_note');
    expect(t).toContain('is not trusted');
    expect(doc('SKILL.md')).toContain('(plan, and run attempts)');
  });

  it('the worked example names the Codex model the medium tier now starts with', () => {
    expect(doc('examples/worked-example.md')).toContain('gpt-6.2-sol');
    expect(doc('examples/worked-example.md')).not.toContain('gpt-6.1-sol');
  });

  it('the evals (two to five of them) include a prepared case for a refused model', () => {
    const e = JSON.parse(doc('evals/evals.json')) as { evals: Array<{ prompt: string; expected_output: string }> };
    expect(e.evals.length).toBeGreaterThanOrEqual(2);
    expect(e.evals.length).toBeLessThanOrEqual(5);
    expect(e.evals.some(x => /attempts/.test(x.prompt) && /failure model/.test(x.prompt) && /next model of the same tier on the same host/i.test(x.expected_output))).toBe(true);
  });
});
