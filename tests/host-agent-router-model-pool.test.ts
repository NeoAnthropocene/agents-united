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
const usageJson = (o: { gem5h?: number; gemWeekly?: number; argon?: number; thirdParty?: number } = {}): string => JSON.stringify({
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
          { id: '3p-weekly', name: 'Weekly Limit Remaining', window: 'weekly', remaining_fraction: o.thirdParty ?? 1, reset_time: '2026-11-25T10:00:00Z' },
          { id: '3p-5h', name: 'Five Hour Limit Remaining', window: '5h', remaining_fraction: o.thirdParty ?? 1, reset_time: '2026-11-19T15:00:00Z' },
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

  it('detects the Antigravity subscription tier from `agy models` rows via agyPlanOf and agyPool().plan', async () => {
    const { agyPlanOf, agyPool, parseAgyModels } = await lib();
    expect(agyPool(agyText(WITH_CARBON)).plan).toBe('ultra');
    expect(agyPool(agyText(AGY_ALL)).plan).toBe('pro');
    expect(agyPool(agyText([['gemini-pro-orchestrator', 'Orchestrator'], ['gemini-3.7-flash-medium', 'Gemini 3.7 Flash (Medium)']])).plan).toBe('enterprise');
    expect(agyPool(agyText([['gemini-3.8-flash-medium', 'Gemini 3.8 Flash (Medium)']])).plan).toBe('free');
    expect(agyPlanOf([])).toBeNull();
    expect(agyPlanOf(parseAgyModels(agyText(AGY_ALL))!)).toBe('pro');
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

  it('parseCodexCacheModels reads visible slugs and display names from models_cache.json and excludes hidden entries', async () => {
    const { parseCodexCacheModels } = await lib();
    const raw = JSON.stringify({
      models: [
        { slug: 'gpt-6.2-sol', display_name: 'GPT-6.2-Sol', visibility: 'list' },
        { slug: 'gpt-reserve', display_name: 'GPT-Reserve', visibility: 'hide' },
        { slug: 'codex-auto-review', display_name: 'Codex Auto Review', hidden: true },
      ],
    });
    expect(parseCodexCacheModels(raw)).toEqual(['gpt-6.2-sol', 'GPT-6.2-Sol']);
    expect(parseCodexCacheModels(JSON.stringify({ models: [{ slug: 'x', visibility: 'hide' }] }))).toBeNull();
    expect(parseCodexCacheModels('not json')).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------- the default tiers

describe('the default tiers, as ordered lists', () => {
  const table = async (host: string): Promise<Record<string, Array<[string | undefined, string | undefined, string]>>> => {
    const { tierEntries } = await lib();
    return Object.fromEntries(['simple', 'medium', 'high'].map(t => [t, (tierEntries(CFG.hosts[host].tiers[t]) as Any[]).map(e => [e.model, e.displayName, e.effort])]));
  };

  it('Antigravity: two-stage simple (Hydrogen Low / Flash Medium), Orchestrator-first medium and high with separate Argon/3P fallbacks', async () => {
    expect(await table('antigravity')).toEqual({
      simple: [['gemini-4-hydrogen-low', undefined, 'low'], ['gemini-3.8-flash-medium', undefined, 'medium']],
      medium: [
        ['gemini-pro-orchestrator-g1-pro', undefined, 'fixed'],
        ['gemini-pro-orchestrator-neon', undefined, 'fixed'],
        ['gemini-4-argon-medium', undefined, 'medium'],
        ['gemini-4-neon-medium', undefined, 'medium'],
        ['gemini-4-hydrogen-medium', undefined, 'medium'],
        ['gemini-3.8-flash-high', undefined, 'high'],
      ],
      high: [
        ['gemini-pro-orchestrator-g1-pro', undefined, 'fixed'],
        ['gemini-pro-orchestrator-neon', undefined, 'fixed'],
        ['claude-opus-5-5-high', undefined, 'high'],
        ['gemini-4-argon-high', undefined, 'high'],
        ['gemini-4-neon-high', undefined, 'high'],
      ],
    });
  });

  it('Codex: Terra then Luna (Luna first with --effort low), Sol 6.2 -> Sol 6.1 -> Terra 6.1, Astra 6.2 -> Sol 6.2 -> Astra 6 all at high', async () => {
    expect(await table('codex')).toEqual({
      simple: [['gpt-6.1-terra', undefined, 'medium'], ['gpt-6-luna', undefined, 'medium']],
      medium: [['gpt-6.2-sol', undefined, 'medium'], ['gpt-6.1-sol', undefined, 'medium'], ['gpt-6.1-terra', undefined, 'medium']],
      high: [['gpt-6.2-astra', undefined, 'high'], ['gpt-6.2-sol', undefined, 'high'], ['gpt-6-astra', undefined, 'high']],
    });
  });

  it('Cline: Flash fallback chain on simple, GLM-5.3 -> Qwen 3.8 Max -> DeepSeek V4 Pro -> MiniMax-M3.1-Flash on medium, Kimi K3.1 Pro -> DeepSeek V4 Pro -> Qwen 3.8 Max -> GLM-5.3 on high', async () => {
    expect(await table('cline')).toEqual({
      simple: [
        ['cline-pass/deepseek-v4.1-flash-1017', undefined, 'medium'],
        ['cline-pass/minimax-m3.1-flash', undefined, 'medium'],
        ['cline-pass/glm-5.3-flash', undefined, 'medium'],
      ],
      medium: [
        ['cline-pass/glm-5.3', undefined, 'medium'],
        ['cline-pass/qwen3.8-max', undefined, 'medium'],
        ['cline-pass/deepseek-v4-pro', undefined, 'medium'],
        ['cline-pass/minimax-m3.1-flash', undefined, 'medium'],
      ],
      high: [
        ['cline-pass/kimi-k3.1-pro', undefined, 'medium'],
        ['cline-pass/deepseek-v4-pro', undefined, 'medium'],
        ['cline-pass/qwen3.8-max', undefined, 'medium'],
        ['cline-pass/glm-5.3', undefined, 'medium'],
      ],
    });
  });

  it('Claude keeps one model per tier, as before', async () => {
    const { tierEntries } = await lib();
    for (const t of ['simple', 'medium', 'high']) expect(tierEntries(CFG.hosts.claude.tiers[t]), `claude/${t}`).toHaveLength(1);
  });

  it('no entry names a model that is not in the research facts of 2026-11-22, and the Carbon entry carries no invented slug', async () => {
    const { tierEntries } = await lib();
    const known = new Set([...AGY_ALL.map(([s]) => s), ...CODEX_ALL.map(([m]) => m)]);
    for (const host of ['antigravity', 'codex']) {
      for (const t of ['simple', 'medium', 'high']) {
        for (const e of tierEntries(CFG.hosts[host].tiers[t]) as Any[]) {
          for (const m of [e.model, ...Object.values(e.efforts ?? {}).map((x: Any) => (typeof x === 'string' ? undefined : x.model))].filter(Boolean)) expect(known.has(m), `${host}/${t}: ${m}`).toBe(true);
        }
      }
    }
    const argonOrch = (tierEntries(CFG.hosts.antigravity.tiers.high) as Any[])[0];
    const carbon = argonOrch.efforts?.extra;
    expect(carbon.model).toBeUndefined();
    expect(carbon.displayName).toBe('Orchestrator (Carbon)');
    expect(carbon.fixedEffort).toBe(true);
    expect(carbon.quotaGroups).toEqual(['Gemini Models']);
  });

  it('the Orchestrator entries have a fixed configuration and the quota groups of the facts', async () => {
    const { tierEntries } = await lib();
    const [argon, neon, opus, argonStandalone, neonStandalone] = tierEntries(CFG.hosts.antigravity.tiers.high) as Any[];
    for (const e of [argon, neon]) expect(e.fixedEffort).toBe(true);
    for (const e of [opus, argonStandalone, neonStandalone]) expect(e.fixedEffort).toBeFalsy();
    expect(neon.quotaGroups).toEqual(['Gemini Models']);
    expect(argon.quotaGroups).toEqual(['Gemini Models', 'Gemini 4 Argon']);
    const [medArgon, medNeon] = tierEntries(CFG.hosts.antigravity.tiers.medium) as Any[];
    expect(medArgon.fixedEffort).toBe(true);
    expect(medNeon.fixedEffort).toBe(true);
    expect(medArgon.quotaGroups).toEqual(['Gemini Models', 'Gemini 4 Argon']);
    expect(medNeon.quotaGroups).toEqual(['Gemini Models']);
  });

  it('is a valid configuration', async () => {
    const { validateConfig } = await lib();
    expect(validateConfig(CFG)).toEqual([]);
  });

  it('lists every configured model once for `models`, display-name entries by their name', async () => {
    const { configuredModels } = await lib();
    expect(configuredModels(CFG, 'codex')).toEqual(['gpt-6.1-terra', 'gpt-6-luna', 'gpt-6.2-sol', 'gpt-6.1-sol', 'gpt-6.2-astra', 'gpt-6-astra']);
    expect(configuredModels(CFG, 'cline')).toEqual([
      'cline-pass/deepseek-v4.1-flash-1017', 'cline-pass/minimax-m3.1-flash', 'cline-pass/glm-5.3-flash',
      'cline-pass/glm-5.3', 'cline-pass/qwen3.8-max', 'cline-pass/deepseek-v4-pro', 'cline-pass/kimi-k3.1-pro',
    ]);
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
    const agySimple = (await plan('antigravity', 'simple', agy)).selected;
    expect([agySimple.model, agySimple.effort]).toEqual(['gemini-4-hydrogen-low', 'low']);
    expect(agySimple.alternates.map((a: Any) => a.model)).toEqual(['gemini-3.8-flash-medium']);
    const agySimpleLow = (await plan('antigravity', 'simple', agy, 'low')).selected;
    expect([agySimpleLow.model, agySimpleLow.effort]).toEqual(['gemini-3.8-flash-medium', 'medium']);
    expect(agySimpleLow.alternates.map((a: Any) => [a.model, a.effort])).toEqual([['gemini-4-hydrogen-low', 'low']]);
    const agyMed = (await plan('antigravity', 'medium', agy)).selected;
    expect(agyMed.model).toBe('gemini-pro-orchestrator-g1-pro');
    expect(agyMed.alternates.map((a: Any) => a.model)).toEqual([
      'gemini-pro-orchestrator-neon', 'gemini-4-argon-medium', 'gemini-4-neon-medium', 'gemini-4-hydrogen-medium', 'gemini-3.8-flash-high',
    ]);
    const codex = await codexFull();
    const simple = (await plan('codex', 'simple', codex)).selected;
    expect([simple.model, simple.effort]).toEqual(['gpt-6.1-terra', 'medium']);
    expect((await plan('codex', 'medium', codex)).selected.model).toBe('gpt-6.2-sol');
    const high = (await plan('codex', 'high', codex)).selected;
    expect([high.model, high.effort]).toEqual(['gpt-6.2-astra', 'high']);
    expect(high.alternates.map((a: Any) => [a.model, a.effort])).toEqual([['gpt-6.2-sol', 'high'], ['gpt-6-astra', 'high']]);
    expect(high.skipped_models).toBeUndefined();
  });

  it('Antigravity high: Argon Orchestrator first on Pro, then Neon Orchestrator, Opus 5.5, Argon High and Neon High', async () => {
    const p = await plan('antigravity', 'high', await agyFull());
    expect(p.selected.model).toBe('gemini-pro-orchestrator-g1-pro');
    expect(p.selected.alternates.map((a: Any) => a.model)).toEqual([
      'gemini-pro-orchestrator-neon', 'claude-opus-5-5-high', 'gemini-4-argon-high', 'gemini-4-neon-high',
    ]);
    expect(p.selected.skipped_models).toBeUndefined();
  });

  it('Antigravity high --effort extra: Orchestrator (Carbon) on Ultra, Neon (XHigh) on Pro', async () => {
    const { agyPool } = await lib();
    const ultra = await plan('antigravity', 'high', status({ pool: agyPool(agyText(WITH_CARBON)) }), 'extra');
    expect(ultra.selected.model).toBe('fixture-orchestrator-carbon');
    expect(ultra.selected.label).toBe('Orchestrator (Carbon)');
    expect(ultra.selected.effort).toBe('fixed');
    expect(ultra.selected.effort_note).toBeUndefined();
    expect(ultra.selected.alternates.map((a: Any) => a.model)).toEqual([
      'gemini-4-neon-xhigh', 'gemini-pro-orchestrator-g1-pro', 'gemini-pro-orchestrator-neon', 'claude-opus-5-5-high', 'gemini-4-argon-high',
    ]);
    expect(ultra.selected.skipped_models).toBeUndefined();

    const pro = await plan('antigravity', 'high', await agyFull(), 'extra');
    expect(pro.selected.model).toBe('gemini-4-neon-xhigh');
    expect(pro.selected.effort).toBe('extra');
    expect(pro.selected.effort_note).toBeUndefined();
    expect(pro.selected.skipped_models).toEqual([{ model: 'Orchestrator (Carbon)', reason: expect.stringMatching(/not in the account's model list/) }]);
    expect(pro.selected.alternates.map((a: Any) => a.model)).toEqual([
      'gemini-pro-orchestrator-g1-pro', 'gemini-pro-orchestrator-neon', 'claude-opus-5-5-high', 'gemini-4-argon-high',
    ]);
  });

  it('a pool without the first entry picks the second and names the skipped one with the reason', async () => {
    const { codexPool } = await lib();
    const pool = codexPool(codexResponse(CODEX_ALL.filter(([m]) => m !== 'gpt-6-luna')));
    const p = await plan('codex', 'simple', status({ pool }));
    expect(p.selected.model).toBe('gpt-6.1-terra');
    expect(p.selected.skipped_models).toEqual([{ model: 'gpt-6-luna', reason: "not in the account's model list" }]);
    expect(p.selected.alternates).toBeUndefined();
  });

  it('a pool without the Orchestrator lines falls back to Opus 5.5 High (or Neon XHigh for --effort extra)', async () => {
    const { agyPool } = await lib();
    const st = status({ pool: agyPool(agyText(NO_ORCHESTRATOR)) });
    const p = await plan('antigravity', 'high', st);
    expect([p.selected.model, p.selected.effort]).toEqual(['claude-opus-5-5-high', 'high']);
    expect(p.selected.skipped_models.map((s: Any) => s.model)).toEqual(['gemini-pro-orchestrator-g1-pro', 'gemini-pro-orchestrator-neon']);
    const extra = await plan('antigravity', 'high', st, 'extra');
    expect([extra.selected.model, extra.selected.effort, extra.selected.effort_note]).toEqual(['gemini-4-neon-xhigh', 'extra', undefined]);
    expect(extra.selected.skipped_models.map((s: Any) => s.model)).toEqual([
      'Orchestrator (Carbon)', 'gemini-pro-orchestrator-g1-pro', 'gemini-pro-orchestrator-neon',
    ]);
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
    expect(by(p, 'antigravity').model).toBe('gemini-pro-orchestrator-g1-pro');
    expect(by(p, 'antigravity').skipped_models).toBeUndefined();
    const pExtra = buildPlan(CFG, 'high', { antigravity: { windows: st } }, 'windows', ['antigravity'], 'read-only', 'extra');
    expect(by(pExtra, 'antigravity').model).toBe('gemini-4-neon-xhigh'); // Carbon has no model id to start with, so it is skipped when pool is unknown
    expect(by(pExtra, 'antigravity').skipped_models[0]).toEqual({ model: 'Orchestrator (Carbon)', reason: expect.stringMatching(/no model id is configured/) });
    expect(by(p, 'codex').model).toBe('gpt-6.2-astra');
    expect(by(p, 'codex').skipped_models).toBeUndefined();
    expect(p.pools['antigravity/windows']).toMatchObject({ source: 'unknown', reason: 'agy models failed' });
    expect(p.pools['codex/windows']).toMatchObject({ source: 'unknown' });
  });

  it('a status with no pool at all (an older replay) behaves like an unknown pool and never blocks', async () => {
    const p = await plan('codex', 'medium', status());
    expect(p.selected.model).toBe('gpt-6.2-sol');
    expect(p.selected.alternates.map((a: Any) => a.model)).toEqual(['gpt-6.1-sol', 'gpt-6.1-terra']);
  });

  it('reports each pool read, and only for hosts that have one', async () => {
    const { buildPlan, agyPool } = await lib();
    const p = buildPlan(CFG, 'simple', { antigravity: { windows: status({ pool: agyPool(agyText(AGY_ALL)) }) }, claude: { windows: status() } }, 'windows', undefined, 'read-only');
    expect(p.pools).toEqual({ 'antigravity/windows': { source: 'cli', models: 23 } });
  });

  it('Claude keeps one model per tier and Cline keeps its fallback list without probing an account pool', async () => {
    const { buildPlan } = await lib();
    const p = buildPlan(CFG, 'high', { claude: { windows: status() }, cline: { windows: status() } }, 'windows', undefined, 'read-only');
    expect(by(p, 'claude').model).toBe('claude-opus-5-5');
    expect(by(p, 'claude').alternates).toBeUndefined();
    expect(by(p, 'cline').model).toBe('cline-pass/kimi-k3.1-pro');
    expect(by(p, 'cline').alternates.map((a: Any) => a.model)).toEqual([
      'cline-pass/deepseek-v4-pro', 'cline-pass/qwen3.8-max', 'cline-pass/glm-5.3',
    ]);
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
    expect([c.model, c.effort]).toEqual(['gemini-pro-orchestrator-g1-pro', 'fixed']);
    expect(c.effort_note).toMatch(/--effort "high" was not applied/);
    expect(c.effort_note).toMatch(/Orchestrator \(Argon\)/);
    expect(c.effort_note).toMatch(/fixed configuration/);
    const args = buildSpec(CFG, 'antigravity', c, 'x', 'read-only', '/w', 'high').args as string[];
    expect(args[args.indexOf('--model') + 1]).toBe('gemini-pro-orchestrator-g1-pro');
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

  it('Codex takes low, medium, high, extra (as xhigh), xhigh and max where the model offers it, and the router does not offer ultra', async () => {
    const { resolveEffort, knownEfforts, checkEffort } = await lib();
    for (const e of ['low', 'medium', 'high', 'xhigh', 'max']) expect(resolveEffort(CFG, 'codex', 'medium', e), e).toMatchObject({ model: 'gpt-6.2-sol', effort: e, note: null });
    expect(resolveEffort(CFG, 'codex', 'simple', 'extra')).toMatchObject({ model: 'gpt-6.1-terra', effort: 'xhigh', note: null });
    expect(resolveEffort(CFG, 'codex', 'medium', 'extra')).toMatchObject({ model: 'gpt-6.2-sol', effort: 'xhigh', note: null });
    expect(resolveEffort(CFG, 'codex', 'high', 'extra')).toMatchObject({ model: 'gpt-6.2-astra', effort: 'xhigh', note: null });
    expect(knownEfforts(CFG, 'high', ['codex'])).toEqual(['extra', 'high', 'low', 'max', 'medium', 'xhigh']);
    expect(checkEffort(CFG, 'high', 'ultra', ['codex'])).toMatch(/--effort "ultra" is not offered by the router/);
  });

  it('Cline offers low, medium, high, extra (as xhigh) and xhigh across its tiers', async () => {
    const { resolveEffort, knownEfforts } = await lib();
    expect(resolveEffort(CFG, 'cline', 'medium', 'high')).toMatchObject({ model: 'cline-pass/glm-5.3', effort: 'high', note: null });
    expect(resolveEffort(CFG, 'cline', 'high', 'extra')).toMatchObject({ model: 'cline-pass/kimi-k3.1-pro', effort: 'xhigh', note: null });
    expect(knownEfforts(CFG, 'high', ['cline'])).toEqual(['extra', 'high', 'low', 'medium', 'xhigh']);
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
    expect(p.selected.alternates.map((a: Any) => [a.model, a.effort])).toEqual([['gpt-6.2-sol', 'max'], ['gpt-6-astra', 'max']]);
  });
});

// ---------------------------------------------------------------------------------------------------- quota groups

describe('quota groups of the Orchestrator entries', () => {
  const resolvedHigh = async (effort?: string): Promise<Any[]> => {
    const { resolveTier } = await lib();
    return resolveTier(CFG.hosts.antigravity.tiers.high, 'antigravity', 'high', effort, CFG.hosts.antigravity).map((p: Any) => p.r);
  };
  const resolvedMed = async (): Promise<Any[]> => {
    const { resolveTier } = await lib();
    return resolveTier(CFG.hosts.antigravity.tiers.medium, 'antigravity', 'medium', undefined, CFG.hosts.antigravity).map((p: Any) => p.r);
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
    expect(by1['claude-opus-5-5-high'].binding_pct).toBe(100);
    expect(by1['gemini-4-argon-high'].binding_pct).toBe(5);
    expect(by1['gemini-4-neon-high'].binding_pct).toBe(80);
    const by2 = agyUsageByModel(usageJson({ gem5h: 0.04, gemWeekly: 0.8, argon: 1 }), await resolvedHigh(), pool, groups) as Record<string, Any>;
    expect(by2['gemini-pro-orchestrator-neon'].binding_pct).toBe(4);
    expect(by2['gemini-pro-orchestrator-g1-pro'].binding_pct).toBe(4);
    expect(by2['claude-opus-5-5-high'].binding_pct).toBe(100);
    expect(by2['gemini-4-argon-high'].binding_pct).toBe(100);
  });

  it('gives the Carbon entry the usage of its slug from the account list and the groups of its entry', async () => {
    const { agyUsageByModel, agyPool } = await lib();
    const pool = agyPool(agyText(WITH_CARBON));
    const r = await agyUsageByModel(usageJson({ gemWeekly: 0.7 }), await resolvedHigh('extra'), pool, groups);
    expect(r['fixture-orchestrator-carbon'].binding_pct).toBe(70);
  });

  it('the plan skips an entry whose group is below the floor and takes the next one, naming the headroom', async () => {
    const { agyUsageByModel, agyPool, buildPlan } = await lib();
    const pool = agyPool(agyText(NO_NEON_ORCHESTRATOR));
    const usage_by_model = agyUsageByModel(usageJson({ gem5h: 0.9, gemWeekly: 0.8, argon: 0.05 }), await resolvedHigh(), pool, groups);
    const p = buildPlan(CFG, 'high', { antigravity: { windows: status({ pool, usage: usage_by_model['claude-opus-5-5-high'], usage_by_model }) } }, 'windows', ['antigravity'], 'read-only');
    expect(p.selected.model).toBe('claude-opus-5-5-high');
    expect(p.selected.binding_pct).toBe(100);
    expect(p.selected.skipped_models).toEqual(expect.arrayContaining([{ model: 'gemini-pro-orchestrator-g1-pro', reason: 'headroom 5% below minimum 10%' }]));
  });

  it('when Gemini Models is below the floor, high falls back to Claude Opus 5.5 (3P bucket) and medium falls back to standalone Argon (Argon bucket)', async () => {
    const { agyUsageByModel, agyPool, buildPlan } = await lib();
    const pool = agyPool(agyText(AGY_ALL));
    const highUsage = agyUsageByModel(usageJson({ gem5h: 0.04 }), await resolvedHigh(), pool, groups);
    const ph = buildPlan(CFG, 'high', { antigravity: { windows: status({ pool, usage_by_model: highUsage }) } }, 'windows', ['antigravity'], 'read-only');
    expect(ph.selected.model).toBe('claude-opus-5-5-high');
    expect(ph.selected.skipped_models).toEqual([
      { model: 'gemini-pro-orchestrator-g1-pro', reason: 'headroom 4% below minimum 10%' },
      { model: 'gemini-pro-orchestrator-neon', reason: 'headroom 4% below minimum 10%' },
      { model: 'gemini-4-neon-high', reason: 'headroom 4% below minimum 10%' },
    ]);
    const medUsage = agyUsageByModel(usageJson({ gem5h: 0.04 }), await resolvedMed(), pool, groups);
    const pm = buildPlan(CFG, 'medium', { antigravity: { windows: status({ pool, usage_by_model: medUsage }) } }, 'windows', ['antigravity'], 'read-only');
    expect(pm.selected.model).toBe('gemini-4-argon-medium');
    expect(pm.selected.skipped_models).toEqual([
      { model: 'gemini-pro-orchestrator-g1-pro', reason: 'headroom 4% below minimum 10%' },
      { model: 'gemini-pro-orchestrator-neon', reason: 'headroom 4% below minimum 10%' },
      { model: 'gemini-4-neon-medium', reason: 'headroom 4% below minimum 10%' },
      { model: 'gemini-4-hydrogen-medium', reason: 'headroom 4% below minimum 10%' },
      { model: 'gemini-3.8-flash-high', reason: 'headroom 4% below minimum 10%' },
    ]);
  });

  it('when every bucket of the tier is below the floor, every entry is out and the host is skipped for headroom', async () => {
    const { agyUsageByModel, agyPool, buildPlan } = await lib();
    const pool = agyPool(agyText(AGY_ALL));
    const usage_by_model = agyUsageByModel(usageJson({ gem5h: 0.04, argon: 0.05, thirdParty: 0.03 }), await resolvedHigh(), pool, groups);
    const p = buildPlan(CFG, 'high', { antigravity: { windows: status({ pool, usage_by_model }) } }, 'windows', ['antigravity'], 'read-only');
    expect(p.selected).toBeNull();
    expect(p.skipped[0].reason).toMatch(/headroom 5% below minimum 10%/);
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
    expect(p.selected.alternates).toBeUndefined(); // gpt-6.1-sol and gpt-6.1-terra are not in the configured pool
    expect(p.selected.skipped_models).toEqual([
      { model: 'gpt-6.1-sol', reason: 'not in the configured pool' },
      { model: 'gpt-6.1-terra', reason: 'not in the configured pool' },
    ]);
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
    expect((tierEntries(merged.hosts.codex.tiers.simple) as Any[]).map(e => e.model)).toEqual(['gpt-6.1-terra', 'gpt-6-luna']); // other tiers keep their lists
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
    const merged = mergeConfig(CFG, { hosts: { antigravity: { tiers: { simple: { efforts: { max: { model: 'gemini-4-hydrogen-xhigh' } } } } } } });
    expect(validateConfig(merged)).toEqual([]);
    expect(resolveEffort(merged, 'antigravity', 'simple', 'max').model).toBe('gemini-4-hydrogen-xhigh');
    expect(resolveEffort(merged, 'antigravity', 'simple', 'extra').model).toBe('gemini-4-hydrogen-xhigh'); // the shipped effort is still there
    expect(resolveEffort(merged, 'antigravity', 'simple', 'high').model).toBe('gemini-4-hydrogen-high');
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
    expect(bad({ models: [{ model: 'x', fixedEffort: true }] })).toMatch(/codex\/high: entry 1: fixedEffort is only for a host whose effort is part of the model name/);
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
    expect([agy.model, agy.effort]).toEqual(['claude-opus-5-5-high', 'high']);
    expect(agy.skipped_models.map((s: Any) => s.model)).toEqual(['gemini-pro-orchestrator-g1-pro', 'gemini-pro-orchestrator-neon']);
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
    expect(r.out).toContain('claude-opus-5-5-high');
    expect(r.out).toMatch(/skipped model[^\n]*antigravity[^\n]*gemini-pro-orchestrator-neon[^\n]*not in the account's model list/);
  });

  it('run --dry-run: the command line carries the chosen slug, and the alternates are listed for the retry', async () => {
    const r = run(['run', '--tier', 'high', '--prompt', 'x', '--dry-run', '--here', 'windows', '--statuses-file', await replay(), '--host', 'antigravity', '--cwd', tmp()]);
    expect(r.status).toBe(0);
    const t = r.json.would_try[0];
    expect(t.args[t.args.indexOf('--model') + 1]).toBe('gemini-pro-orchestrator-g1-pro');
    expect(t.alternates.map((a: Any) => a.model)).toEqual([
      'gemini-pro-orchestrator-neon', 'claude-opus-5-5-high', 'gemini-4-argon-high', 'gemini-4-neon-high',
    ]);
    expect(r.json.plan.pools['antigravity/windows']).toEqual({ source: 'cli', models: 23 });
  });

  it('an effort no entry knows is still a usage error, ultra included', async () => {
    const r = run(['plan', '--tier', 'high', '--effort', 'ultra', '--here', 'windows', '--statuses-file', await replay(), '--host', 'codex']);
    expect(r.status).toBe(64);
    expect(r.out).toMatch(/--effort "ultra" is not offered by the router/);
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
    expect(entries.map(e => e.effort)).toEqual(['fixed', 'fixed', 'low', 'low', 'low']);
    const p = await plan(cfg, 'antigravity', 'high', undefined, await agyFull());
    expect([p.selected.model, p.selected.effort]).toEqual(['gemini-pro-orchestrator-g1-pro', 'fixed']);
    expect(p.selected.effort_note).toMatch(/effort "low" from your config was not applied/);
    expect(p.selected.effort_note).toMatch(/fixed configuration/);
    const h = await plan(cfg, 'antigravity', 'high', undefined, await agyFull(NO_ORCHESTRATOR));
    expect([h.selected.model, h.selected.effort, h.selected.effort_note]).toEqual(['claude-opus-5-5-high', 'low', undefined]); // the entry that takes an effort got it
  });

  it('a label alone applies to the first entry', async () => {
    const { mergeConfig, tierEntries } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'simple', { label: 'mine' }));
    expect((tierEntries(cfg.hosts.codex.tiers.simple) as Any[]).map(e => e.label)).toEqual(['mine', 'GPT-6 Luna']);
  });

  it("the reviewer's input: a user efforts map wins over an Orchestrator at the head of the shipped tier", async () => {
    const { mergeConfig, validateConfig } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'high', { efforts: { high: { label: 'x', model: 'gemini-4-argon-high' } } }));
    expect(validateConfig(cfg)).toEqual([]);
    const p = await plan(cfg, 'antigravity', 'high', 'high', await agyFull());
    expect([p.selected.model, p.selected.effort, p.selected.label]).toEqual(['gemini-4-argon-high', 'high', 'x']);
    // the shipped list follows as alternates, without a second copy of the chosen model
    expect(p.selected.alternates.map((a: Any) => a.model)).toEqual([
      'gemini-pro-orchestrator-g1-pro', 'gemini-pro-orchestrator-neon', 'claude-opus-5-5-high', 'gemini-4-neon-high',
    ]);
  });

  it('the user map named choice is still subject to the headroom (the pool keeps it: it is a model the user named)', async () => {
    const { mergeConfig, agyPool } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'high', { efforts: { high: { label: 'x', model: 'gemini-4-argon-high' } } }));
    const noArgon = AGY_ALL.filter(([s]) => s !== 'gemini-4-argon-high');
    const p = await plan(cfg, 'antigravity', 'high', 'high', await agyFull(noArgon));
    expect(p.selected.model).toBe('gemini-4-argon-high');
    expect(p.selected.pool_note).toBe("gemini-4-argon-high is not in the account's model list; kept because your config names it");
    const usage_by_model = { 'gemini-4-argon-high': usageOf(4), 'gemini-pro-orchestrator-g1-pro': usageOf(80) };
    const q = await plan(cfg, 'antigravity', 'high', 'high', status({ pool: agyPool(agyText(AGY_ALL)), usage_by_model }));
    expect(q.selected.model).toBe('gemini-pro-orchestrator-g1-pro');
    expect(q.selected.skipped_models).toEqual(expect.arrayContaining([{ model: 'gemini-4-argon-high', reason: 'headroom 4% below minimum 10%' }]));
  });

  it('a name the user map does not have falls back to the shipped per-entry maps', async () => {
    const { mergeConfig } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'simple', { efforts: { max: { label: 'M', model: 'gemini-4-hydrogen-xhigh' } } }));
    const m = await plan(cfg, 'antigravity', 'simple', 'max', await agyFull());
    expect(m.selected.model).toBe('gemini-4-hydrogen-xhigh');
    const e = await plan(cfg, 'antigravity', 'simple', 'extra', await agyFull());
    expect(e.selected.model).toBe('gemini-4-hydrogen-xhigh'); // the shipped Hydrogen map answers `extra`
    const l = await plan(cfg, 'antigravity', 'simple', 'low', await agyFull());
    expect(l.selected.model).toBe('gemini-3.8-flash-medium'); // the shipped two-stage simple map answers `low`
  });

  it('a plain effort value in the user map applies to whichever model is chosen', async () => {
    const { mergeConfig } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'medium', { efforts: { extra: 'xhigh' } }));
    const p = await plan(cfg, 'codex', 'medium', 'extra');
    expect([p.selected.model, p.selected.effort, p.selected.alternates.map((a: Any) => a.effort)]).toEqual(['gpt-6.2-sol', 'xhigh', ['xhigh', 'xhigh']]);
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
    expect(p.selected.model).toBe('gemini-pro-orchestrator-g1-pro');
    expect(p.pools['antigravity/windows']).toMatchObject({ source: 'unknown' });
    expect(p.pools['antigravity/windows'].reason).toMatch(/none of the \d+ models this config names for antigravity \(1 read\), so it is not trusted/);
    expect(p.skipped).toEqual([]);
  });

  it('the same for Codex: a list with none of the configured models is unknown, not a reason to skip the host', async () => {
    const { codexPool, buildPlan } = await lib();
    const pool = codexPool(codexResponse([['gpt-9-x', 'GPT-9 X']]));
    const p = buildPlan(CFG, 'simple', { codex: { windows: status({ pool }) } }, 'windows', ['codex'], 'read-only');
    expect(p.selected.model).toBe('gpt-6.1-terra');
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

// ---------------------------------------------------------------------------------------------------- second review

describe('fixedEffort belongs to a host whose effort is part of the model name', () => {
  const over = (host: string, tier: string, t: Any): Any => ({ hosts: { [host]: { tiers: { [tier]: t } } } });

  it('is refused on a host whose effort is a CLI flag, with a message that names the key and the host', async () => {
    const { mergeConfig, validateConfig } = await lib();
    for (const host of ['codex', 'claude', 'cline']) {
      const msg = validateConfig(mergeConfig(CFG, over(host, 'high', { models: [{ model: 'x-model', fixedEffort: true }] }))).join('\n');
      expect(msg, host).toContain(`${host}/high: entry 1: fixedEffort is only for a host whose effort is part of the model name`);
      expect(msg, host).toContain(host);
    }
    expect(validateConfig(mergeConfig(CFG, over('antigravity', 'high', { models: [{ model: 'gemini-pro-orchestrator-neon', fixedEffort: true }] })))).toEqual([]);
  });

  it('no spec of any host ever carries the literal "fixed" as an effort', async () => {
    const { buildPlan, buildSpec, agyPool, codexPool } = await lib();
    const pools: Record<string, Any> = { antigravity: agyPool(agyText(WITH_CARBON)), codex: codexPool(codexResponse(CODEX_ALL)) };
    for (const tier of ['simple', 'medium', 'high']) {
      for (const effort of [undefined, 'high', 'low']) {
        const statuses = Object.fromEntries(CFG.priority.map((h: string) => [h, { windows: status(pools[h] ? { pool: pools[h] } : {}) }]));
        const plan = buildPlan(CFG, tier, statuses, 'windows', undefined, 'read-only', effort);
        for (const c of plan.candidates) {
          for (const t of [c, ...(c.alternates ?? [])]) {
            for (const access of ['read-only', 'edit']) {
              const args = (buildSpec(CFG, c.host, t, 'x', access, '/w', tier).args as string[]);
              const flagged = c.host === 'antigravity' ? [] : args;
              expect(flagged.some(a => /fixed/.test(a)), `${c.host}/${tier}/${effort}: ${t.model} ${JSON.stringify(flagged)}`).toBe(false);
              if (c.host === 'antigravity') expect(args).not.toContain('--effort');
            }
          }
        }
      }
    }
  });

  it('buildSpec refuses the effort "fixed" for a host whose effort is a flag', async () => {
    const { buildSpec } = await lib();
    for (const host of ['codex', 'claude', 'cline']) expect(() => buildSpec(CFG, host, { model: 'x', effort: 'fixed', label: 'x' }, 'x', 'read-only', '/w', 'high'), host).toThrow(/"fixed"/);
  });
});

describe('mixed shapes in a tier override are errors, not silently dropped', () => {
  const bad = async (host: string, tier: string, t: Any): Promise<string> => {
    const { mergeConfig, validateConfig } = await lib();
    return validateConfig(mergeConfig(CFG, { hosts: { [host]: { tiers: { [tier]: t } } } })).join('\n');
  };

  it('model and models together', async () => {
    const m = await bad('codex', 'high', { model: 'gpt-6-astra', models: ['gpt-6-astra'] });
    expect(m).toContain('codex/high: model and models are both given; write one: "model" for a single model, or "models" for an ordered list');
  });

  it('a tier-level label beside models', async () => {
    const m = await bad('codex', 'high', { models: ['gpt-6-astra'], label: 'mine' });
    expect(m).toContain('codex/high: label beside models belongs to an entry; write { "models": [ { "model": "...", "label": "..." } ] }');
  });

  it('fixedEffort, displayName or quotaGroups beside a single model: refused, with the shape to write instead (the choice: refuse, not honour)', async () => {
    for (const key of ['fixedEffort', 'displayName', 'quotaGroups']) {
      const value = key === 'fixedEffort' ? true : key === 'displayName' ? 'Orchestrator (Carbon)' : ['Gemini Models'];
      const m = await bad('antigravity', 'high', { model: 'gemini-pro-orchestrator-neon', [key]: value });
      expect(m, key).toContain(`antigravity/high: ${key} beside model is not read; write { "models": [ { "model": "..."`);
    }
  });

  it('the single-model shape itself is still valid, with label, effort and efforts', async () => {
    expect(await bad('codex', 'high', { model: 'gpt-6-astra', label: 'A', effort: 'high', efforts: { low: 'low' } })).toBe('');
  });
});

describe('the model a user efforts map puts first goes through the same checks', () => {
  const over = (host: string, tier: string, t: Any): Any => ({ hosts: { [host]: { tiers: { [tier]: t } } } });
  const plan = async (cfg: Any, host: string, tier: string, effort: string | undefined, st: Any): Promise<Any> => (await lib()).buildPlan(cfg, tier, { [host]: { windows: st } }, 'windows', [host], 'read-only', effort);

  it('ultra is refused by the router wherever it is named: in the config, and as --effort', async () => {
    const { mergeConfig, validateConfig, checkEffort } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'medium', { efforts: { ultra: { model: 'gpt-6-luna' } } }));
    expect(validateConfig(cfg).join('\n')).toMatch(/codex\/medium: efforts\.ultra: "ultra" is not offered by the router/);
    expect(checkEffort(cfg, 'medium', 'ultra', ['codex'])).toMatch(/--effort "ultra" is not offered by the router/);
    expect(validateConfig(mergeConfig(CFG, over('codex', 'medium', { efforts: { max: 'ultra' } }))).join('\n')).toMatch(/"ultra" is not offered by the router/);
    expect(validateConfig(mergeConfig(CFG, over('codex', 'medium', { effort: 'ultra' }))).join('\n')).toMatch(/"ultra" is not offered by the router/);
  });

  it("the pool's effort list for that model applies, with its note", async () => {
    const { mergeConfig, codexPool } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'medium', { efforts: { max: { model: 'gpt-6-luna' } } }));
    const pool = codexPool(codexResponse(CODEX_ALL, { 'gpt-6-luna': ['low', 'medium'] }));
    const p = await plan(cfg, 'codex', 'medium', 'max', status({ pool }));
    expect([p.selected.model, p.selected.effort]).toEqual(['gpt-6-luna', 'medium']);
    expect(p.selected.effort_note).toMatch(/gpt-6-luna does not offer "max" on this account; kept medium/);
  });

  it('an Orchestrator named in the user map is fixed wherever it is named', async () => {
    const { mergeConfig, agyPool } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'medium', { efforts: { high: { model: 'gemini-pro-orchestrator-neon' } } }));
    const p = await plan(cfg, 'antigravity', 'medium', 'high', status({ pool: agyPool(agyText(AGY_ALL)) }));
    expect([p.selected.model, p.selected.effort]).toEqual(['gemini-pro-orchestrator-neon', 'fixed']);
    expect(p.selected.effort_note).toMatch(/--effort "high" was not applied/);
    expect(p.selected.effort_note).toMatch(/fixed configuration/);
  });

  it('the shipped Orchestrators stay fixed even after the user replaced the high tier', async () => {
    const { mergeConfig, agyPool } = await lib();
    const cfg = mergeConfig(CFG, { hosts: { antigravity: { tiers: { high: { model: 'gemini-4-argon-medium' }, medium: { efforts: { high: { model: 'gemini-pro-orchestrator-g1-pro' } } } } } } });
    const p = await plan(cfg, 'antigravity', 'medium', 'high', status({ pool: agyPool(agyText(AGY_ALL)) }));
    expect([p.selected.model, p.selected.effort]).toEqual(['gemini-pro-orchestrator-g1-pro', 'fixed']);
  });
});

describe('a model the user config names is not dropped by the pool', () => {
  const over = (host: string, tier: string, t: Any): Any => ({ hosts: { [host]: { tiers: { [tier]: t } } } });
  const plan = async (cfg: Any, host: string, tier: string, effort: string | undefined, st: Any): Promise<Any> => (await lib()).buildPlan(cfg, tier, { [host]: { windows: st } }, 'windows', [host], 'read-only', effort);
  const note = (m: string): string => `${m} is not in the account's model list; kept because your config names it`;

  it('a single-model override that the list does not show is kept, with a note', async () => {
    const { mergeConfig, codexPool } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'simple', { model: 'gpt-9-alias' }));
    const p = await plan(cfg, 'codex', 'simple', undefined, status({ pool: codexPool(codexResponse(CODEX_ALL)) }));
    expect(p.selected.model).toBe('gpt-9-alias');
    expect(p.selected.pool_note).toBe(note('gpt-9-alias'));
    expect(p.selected.skipped_models).toBeUndefined();
    expect(p.skipped).toEqual([]);
  });

  it('entries of a user models list are kept; a shipped entry the list lacks is still passed over', async () => {
    const { mergeConfig, codexPool } = await lib();
    const pool = codexPool(codexResponse(CODEX_ALL.filter(([m]) => m !== 'gpt-6.1-terra')));
    const user = mergeConfig(CFG, over('codex', 'simple', { models: ['gpt-6.1-terra', 'gpt-6-luna'] }));
    const p = await plan(user, 'codex', 'simple', undefined, status({ pool }));
    expect(p.selected.model).toBe('gpt-6.1-terra');
    expect(p.selected.pool_note).toBe(note('gpt-6.1-terra'));
    expect(p.selected.alternates.map((a: Any) => [a.model, a.pool_note])).toEqual([['gpt-6-luna', undefined]]);
    const shipped = await plan(CFG, 'codex', 'simple', undefined, status({ pool }));
    expect(shipped.selected.model).toBe('gpt-6-luna');
    expect(shipped.selected.skipped_models).toEqual([{ model: 'gpt-6.1-terra', reason: "not in the account's model list" }]);
    expect(shipped.selected.pool_note).toBeUndefined();
  });

  it('a model in a user efforts map is kept too', async () => {
    const { mergeConfig, codexPool } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'medium', { efforts: { max: { model: 'gpt-9-alias' } } }));
    const p = await plan(cfg, 'codex', 'medium', 'max', status({ pool: codexPool(codexResponse(CODEX_ALL)) }));
    expect([p.selected.model, p.selected.pool_note]).toEqual(['gpt-9-alias', note('gpt-9-alias')]);
  });

  it('with a configured pool the note names the configured pool', async () => {
    const { mergeConfig } = await lib();
    const cfg = mergeConfig(CFG, { hosts: { codex: { pool: ['gpt-6-luna'], tiers: { simple: { model: 'gpt-9-alias' } } } } });
    const p = await plan(cfg, 'codex', 'simple', undefined, status());
    expect(p.selected.pool_note).toBe("gpt-9-alias is not in the configured pool; kept because your config names it");
  });

  it('its refusal follows the normal retry: the alternates stay behind it', async () => {
    const { mergeConfig, codexPool } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'simple', { models: ['gpt-9-alias', 'gpt-6-luna'] }));
    const p = await plan(cfg, 'codex', 'simple', undefined, status({ pool: codexPool(codexResponse(CODEX_ALL)) }));
    expect(p.selected.alternates.map((a: Any) => a.model)).toEqual(['gpt-6-luna']);
  });
});

describe("a user's host-level quotaGroups rule wins over a shipped entry's own groups", () => {
  const usageText = JSON.stringify({ command: { data: { groups: [
    { name: 'My Group', buckets: [{ id: 'w', name: 'W', window: 'weekly', remaining_fraction: 0.5, reset_time: 'x' }] },
    { name: 'Gemini Models', buckets: [{ id: 'w2', name: 'W', window: 'weekly', remaining_fraction: 0.9, reset_time: 'x' }] },
  ] } } });

  it('agyGroupsFor: the user rule decides when it matches the model, then the entry list, then the shipped prefix rules', async () => {
    const { agyGroupsFor } = await lib();
    const shipped = CFG.hosts.antigravity.quotaGroups;
    expect(agyGroupsFor('gemini-pro-orchestrator-neon', shipped, ['Gemini Models'], { 'gemini-': 'My Group' })).toEqual(['My Group']);
    expect(agyGroupsFor('gemini-pro-orchestrator-g1-pro', shipped, ['Gemini Models', 'Gemini 4 Argon'], { 'gemini-pro-orchestrator': ['A', 'B'] })).toEqual(['A', 'B']);
    expect(agyGroupsFor('gemini-pro-orchestrator-neon', shipped, ['Gemini Models'], { 'claude-': 'Z' })).toEqual(['Gemini Models']);
    expect(agyGroupsFor('gemini-pro-orchestrator-neon', shipped, ['Gemini Models'], undefined)).toEqual(['Gemini Models']);
  });

  it('mergeConfig remembers which quota rules are the user', async () => {
    const { mergeConfig } = await lib();
    const cfg = mergeConfig(CFG, { hosts: { antigravity: { quotaGroups: { 'gemini-': 'My Group' } } } });
    expect(cfg.hosts.antigravity.userQuotaGroups).toEqual({ 'gemini-': 'My Group' });
    expect(cfg.hosts.antigravity.quotaGroups['gemini-']).toBe('My Group');
    expect(CFG.hosts.antigravity.userQuotaGroups).toBeUndefined();
  });

  it('the usage of an Orchestrator is read from the group the user named', async () => {
    const { mergeConfig, agyUsageByModel, agyPool, tierEntries, resolveEntry } = await lib();
    const cfg = mergeConfig(CFG, { hosts: { antigravity: { quotaGroups: { 'gemini-': 'My Group' } } } });
    const resolved = (tierEntries(cfg.hosts.antigravity.tiers.high) as Any[]).map(e => resolveEntry(e, 'antigravity', 'high', undefined));
    const by = agyUsageByModel(usageText, resolved, agyPool(agyText(AGY_ALL)), cfg.hosts.antigravity.quotaGroups, cfg.hosts.antigravity.userQuotaGroups);
    expect(by['gemini-pro-orchestrator-neon'].binding_pct).toBe(50);
    expect(by['gemini-pro-orchestrator-neon'].groups).toEqual(['My Group']);
    const shipped = agyUsageByModel(usageText, resolved, agyPool(agyText(AGY_ALL)), CFG.hosts.antigravity.quotaGroups, undefined);
    expect(shipped['gemini-pro-orchestrator-neon'].binding_pct).toBe(90);
  });
});

describe('duplicates after resolution, and a retried model with its own figures', () => {
  it('two entries that resolve to the same model under --effort are attempted once', async () => {
    const { mergeConfig, buildPlan, agyPool, validateConfig } = await lib();
    const tier = { models: [
      { model: 'gemini-4-hydrogen-medium', effort: 'medium', efforts: { high: { model: 'gemini-3.8-flash-high' } } },
      { model: 'gemini-3.8-flash-high', effort: 'high' },
    ] };
    const cfg = mergeConfig(CFG, { hosts: { antigravity: { tiers: { medium: tier } } } });
    expect(validateConfig(cfg)).toEqual([]);
    const st = status({ pool: agyPool(agyText(AGY_ALL)) });
    const p = buildPlan(cfg, 'medium', { antigravity: { windows: st } }, 'windows', ['antigravity'], 'read-only', 'high');
    expect(p.selected.model).toBe('gemini-3.8-flash-high');
    expect(p.selected.alternates).toBeUndefined();
    const q = buildPlan(cfg, 'medium', { antigravity: { windows: st } }, 'windows', ['antigravity'], 'read-only');
    expect([q.selected.model, q.selected.alternates.map((a: Any) => a.model)]).toEqual(['gemini-4-hydrogen-medium', ['gemini-3.8-flash-high']]);
  });

  it('an alternate carries its own headroom figures and quota note in the plan', async () => {
    const { buildPlan, agyPool } = await lib();
    const pool = agyPool(agyText(AGY_ALL));
    const usage_by_model = {
      'gemini-pro-orchestrator-g1-pro': { ...usageOf(80), five_hour_pct: 90, weekly_pct: 80 },
      'gemini-pro-orchestrator-neon': { ...usageOf(40), five_hour_pct: null, weekly_pct: 40, groups: ['Gemini Models', 'Gemini 4 Argon'], missing_groups: ['Gemini 4 Argon'] },
    };
    const p = buildPlan(CFG, 'high', { antigravity: { windows: status({ pool, usage_by_model }) } }, 'windows', ['antigravity'], 'read-only');
    const [alt] = p.selected.alternates;
    expect([p.selected.binding_pct, p.selected.quota_note]).toEqual([80, undefined]);
    expect([alt.model, alt.binding_pct, alt.weekly_pct]).toEqual(['gemini-pro-orchestrator-neon', 40, 40]);
    expect(alt.quota_note).toBe('headroom judged on Gemini Models only: Gemini 4 Argon was not in the /usage readout');
  });

  it('the retry attempt logs the alternate own quota note and headroom, never the first model', async () => {
    const { runAttempts } = await lib();
    const first = { host: 'antigravity', side: 'windows', model: 'm-a', effort: 'high', label: 'A', binding_pct: 90, five_hour_pct: 95, weekly_pct: 90, quota_note: 'note of A',
      alternates: [{ model: 'm-b', effort: 'high', label: 'B', binding_pct: 40, five_hour_pct: null, weekly_pct: 40, quota_note: 'note of B' }, { model: 'm-c', effort: 'high', label: 'C', binding_pct: null, five_hour_pct: null, weekly_pct: null }] };
    const results = [{ rc: 1, stdout: '', stderr: 'unknown model m-a', seconds: 1 }, { rc: 1, stdout: '', stderr: 'unknown model m-b', seconds: 1 }, { rc: 0, stdout: 'ok', stderr: '', seconds: 1 }];
    let i = 0;
    const out = await runAttempts({ cands: [first], access: 'read-only', cwd: tmp(), tryOne: async () => results[i++] });
    expect(out.attempts.map((a: Any) => [a.model, a.quota_note, a.binding_pct])).toEqual([['m-a', 'note of A', 90], ['m-b', 'note of B', 40], ['m-c', undefined, null]]);
  });
});

// ---------------------------------------------------------------------------------------------------- third review

describe('third review: duplicates by slug, fixed on a flag host, small holes', () => {
  const over = (host: string, tier: string, t: Any): Any => ({ hosts: { [host]: { tiers: { [tier]: t } } } });
  const plan = async (cfg: Any, host: string, tier: string, effort: string | undefined, st: Any): Promise<Any> => (await lib()).buildPlan(cfg, tier, { [host]: { windows: st } }, 'windows', [host], 'read-only', effort);
  const problems = async (cfg: Any): Promise<string> => (await lib()).validateConfig(cfg).join('\n');

  it('1. an entry reached by display name and an entry naming the same slug are one model, tried once', async () => {
    const { mergeConfig, agyPool } = await lib();
    const cfg = mergeConfig(CFG, over('antigravity', 'high', { efforts: { high: { model: 'fixture-orchestrator-carbon' } } }));
    const p = await plan(cfg, 'antigravity', 'high', 'high', status({ pool: agyPool(agyText(WITH_CARBON)) }));
    expect(p.selected.model).toBe('fixture-orchestrator-carbon');
    expect(p.selected.alternates.map((a: Any) => a.model)).toEqual([
      'gemini-pro-orchestrator-g1-pro', 'gemini-pro-orchestrator-neon', 'claude-opus-5-5-high', 'gemini-4-argon-high', 'gemini-4-neon-high',
    ]);
    const both = mergeConfig(CFG, over('antigravity', 'high', { models: [{ displayName: 'Orchestrator (Carbon)' }, { model: 'fixture-orchestrator-carbon' }, { model: 'gemini-4-neon-high' }] }));
    const q = await plan(both, 'antigravity', 'high', undefined, status({ pool: agyPool(agyText(WITH_CARBON)) }));
    expect([q.selected.model, q.selected.alternates.map((a: Any) => a.model)]).toEqual(['fixture-orchestrator-carbon', ['gemini-4-neon-high']]);
  });

  it('2. "fixed" as an effort value is a config error on a host whose effort is a flag, naming the key', async () => {
    const { mergeConfig } = await lib();
    expect(await problems(mergeConfig(CFG, over('codex', 'high', { effort: 'fixed' })))).toMatch(/codex\/high: entry 1: "fixed" is only for a host whose effort is part of the model name/);
    expect(await problems(mergeConfig(CFG, over('codex', 'high', { efforts: { x: 'fixed' } })))).toMatch(/codex\/high: efforts\.x: "fixed" is only for a host whose effort is part of the model name/);
    expect(await problems(mergeConfig(CFG, over('claude', 'high', { model: 'claude-opus-5-5', effort: 'fixed' })))).toMatch(/claude\/high: effort: "fixed" is only for a host whose effort is part of the model name/);
    expect(await problems(mergeConfig(CFG, over('codex', 'high', { efforts: { x: { model: 'gpt-6-luna', effort: 'fixed' } } })))).toMatch(/codex\/high: efforts\.x: "fixed" is only/);
  });

  it('2. an Orchestrator slug named under another host is refused the same way', async () => {
    const { mergeConfig } = await lib();
    expect(await problems(mergeConfig(CFG, over('codex', 'high', { efforts: { x: { model: 'gemini-pro-orchestrator-neon' } } })))).toMatch(/codex\/high: efforts\.x: gemini-pro-orchestrator-neon is an Orchestrator \(fixed configuration\); only a host whose effort is part of the model name/);
    expect(await problems(mergeConfig(CFG, over('codex', 'high', { models: ['gemini-pro-orchestrator-g1-pro'] })))).toMatch(/codex\/high: entry 1: gemini-pro-orchestrator-g1-pro is an Orchestrator/);
    expect(await problems(mergeConfig(CFG, over('claude', 'high', { model: 'gemini-pro-orchestrator-neon' })))).toMatch(/claude\/high: gemini-pro-orchestrator-neon is an Orchestrator/);
    expect(await problems(mergeConfig(CFG, over('antigravity', 'medium', { efforts: { x: { model: 'gemini-pro-orchestrator-neon' } } })))).toBe('');
  });

  it('4d. a shipped Orchestrator named in model or models is fixed on Antigravity, like one named in an efforts map', async () => {
    const { mergeConfig, agyPool } = await lib();
    const pool = agyPool(agyText(AGY_ALL));
    const a = await plan(mergeConfig(CFG, over('antigravity', 'high', { model: 'gemini-pro-orchestrator-neon' })), 'antigravity', 'high', 'high', status({ pool }));
    expect([a.selected.model, a.selected.effort]).toEqual(['gemini-pro-orchestrator-neon', 'fixed']);
    expect(a.selected.effort_note).toMatch(/--effort "high" was not applied/);
    const b = await plan(mergeConfig(CFG, over('antigravity', 'medium', { models: ['gemini-pro-orchestrator-g1-pro', 'gemini-4-hydrogen-medium'] })), 'antigravity', 'medium', undefined, status({ pool }));
    expect([b.selected.effort, b.selected.alternates[0].effort]).toEqual(['fixed', 'medium']);
  });

  it('5. "effort": null is refused over a list tier and over a single model, as in 1.1.2', async () => {
    const { mergeConfig } = await lib();
    expect(await problems(mergeConfig(CFG, over('codex', 'high', { effort: null })))).toMatch(/codex\/high: entry 1 needs an effort/);
    expect(await problems(mergeConfig(CFG, over('codex', 'high', { model: 'gpt-6-astra', effort: null })))).toMatch(/codex\/high: needs a model and an effort/);
    expect(await problems(mergeConfig(CFG, over('antigravity', 'high', { effort: null })))).toMatch(/antigravity\/high: entry \d needs an effort/);
  });

  it('5. a tier override without a model that carries other keys is refused, naming the key', async () => {
    const { mergeConfig } = await lib();
    const m = await problems(mergeConfig(CFG, over('codex', 'high', { effort: 'low', timeout: 5, fallback: 'x' })));
    expect(m).toContain('codex/high: timeout is not read in a tier override without a model; a tier override takes effort, label and efforts; write "model" or "models" to define the tier');
    expect(m).toContain('codex/high: fallback is not read');
    expect(await problems(mergeConfig(CFG, over('cline', 'high', { oops: true })))).toContain('cline/high: oops is not read');
    expect(await problems(mergeConfig(CFG, over('codex', 'high', { effort: 'low', label: 'x', efforts: { max: 'max' } })))).toBe('');
  });

  it('5. with an unknown pool a plain effort value for Codex is one of the efforts the router offers; any other word never reaches the CLI', async () => {
    const { mergeConfig } = await lib();
    const cfg = mergeConfig(CFG, over('codex', 'medium', { efforts: { x: 'banana', y: 'xhigh' } }));
    const bad = await plan(cfg, 'codex', 'medium', 'x', status());
    expect([bad.selected.model, bad.selected.effort]).toEqual(['gpt-6.2-sol', 'medium']);
    expect(bad.selected.effort_note).toMatch(/effort "banana" is not one the router offers for codex \(low, medium, high, xhigh, max\); kept medium/);
    const ok = await plan(cfg, 'codex', 'medium', 'y', status());
    expect([ok.selected.effort, ok.selected.effort_note]).toEqual(['xhigh', undefined]);
  });

  it('6. ultra in an entry-level effort is refused', async () => {
    const { mergeConfig } = await lib();
    expect(await problems(mergeConfig(CFG, over('codex', 'high', { models: [{ model: 'gpt-6.2-sol', effort: 'ultra' }] })))).toMatch(/codex\/high: entry 1: "ultra" is not offered by the router/);
    expect(await problems(mergeConfig(CFG, over('codex', 'high', { model: 'gpt-6.2-sol', effort: 'ultra' })))).toMatch(/codex\/high: effort: "ultra" is not offered by the router/);
  });
});

describe('third review: what the plan and the notes say', () => {
  const usageText = JSON.stringify({ command: { data: { groups: [
    { name: 'My Group', buckets: [{ id: 'w', name: 'W', window: 'weekly', remaining_fraction: 0.5, reset_time: 'x' }] },
    { name: 'Gemini Models', buckets: [{ id: 'w2', name: 'W', window: 'weekly', remaining_fraction: 0.9, reset_time: 'x' }] },
  ] } } });
  const resolvedHigh = async (cfg: Any): Promise<Any[]> => {
    const { tierEntries, resolveEntry } = await lib();
    return (tierEntries(cfg.hosts.antigravity.tiers.high) as Any[]).map(e => resolveEntry(e, 'antigravity', 'high', undefined));
  };

  it('4a. a user quota rule that replaces the groups of an entry is said in the plan', async () => {
    const { mergeConfig, agyUsageByModel, agyPool, buildPlan } = await lib();
    const cfg = mergeConfig(CFG, { hosts: { antigravity: { quotaGroups: { 'gemini-pro-orchestrator-g1-pro': 'My Group' } } } });
    const pool = agyPool(agyText(AGY_ALL.filter(([s]) => s !== 'gemini-pro-orchestrator-neon')));
    const h = cfg.hosts.antigravity;
    const by = agyUsageByModel(usageText, await resolvedHigh(cfg), pool, h.quotaGroups, h.userQuotaGroups);
    expect(by['gemini-pro-orchestrator-g1-pro'].replaced_groups).toEqual(['Gemini Models', 'Gemini 4 Argon']);
    expect(by['gemini-4-neon-high'].replaced_groups).toBeUndefined();
    const p = buildPlan(cfg, 'high', { antigravity: { windows: status({ pool, usage_by_model: by }) } }, 'windows', ['antigravity'], 'read-only');
    expect(p.selected.model).toBe('gemini-pro-orchestrator-g1-pro');
    expect(p.selected.quota_note).toBe('your quotaGroups rule replaces this model\'s groups (Gemini Models and Gemini 4 Argon); headroom is read from My Group only, so their quota is not checked');
  });

  it('4b. a model with no matching quota rule, or whose group is not in the readout, has unknown headroom, runs, and says so', async () => {
    const { agyUsageByModel, agyPool, buildPlan } = await lib();
    const pool = agyPool(agyText(AGY_ALL));
    const by = agyUsageByModel(usageText, [{ model: 'no-rule-model' }, { model: 'gemini-4-argon-high' }, { model: 'gemini-4-hydrogen-high' }], pool, CFG.hosts.antigravity.quotaGroups, undefined);
    expect(by['no-rule-model'].binding_pct).toBeNull();
    expect(by['gemini-4-argon-high'].binding_pct).toBeNull();
    expect(by['gemini-4-hydrogen-high'].binding_pct).toBe(90);
    const user = { ...CFG, hosts: { ...CFG.hosts, antigravity: { ...CFG.hosts.antigravity, tiers: { ...CFG.hosts.antigravity.tiers, high: { model: 'gemini-4-argon-high', effort: 'medium' } }, userTiers: ['high'] } } };
    const p = buildPlan(user, 'high', { antigravity: { windows: status({ pool, usage_by_model: by }) } }, 'windows', ['antigravity'], 'read-only');
    expect(p.selected.model).toBe('gemini-4-argon-high');
    expect(p.selected.quota_note).toBe('headroom unknown (Gemini 4 Argon is not in the /usage readout); the model runs');
    expect(by['no-rule-model'].unknown).toBe('no quota rule matches no-rule-model');
  });

  it('4c. a retry attempt carries the models passed over before it, as the first attempt does', async () => {
    const { runAttempts } = await lib();
    const sk = [{ model: 'gpt-6-luna', reason: "not in the account's model list" }];
    const first = { host: 'codex', side: 'windows', model: 'gpt-6.1-terra', effort: 'medium', label: 'T', skipped_models: sk, alternates: [{ model: 'gpt-6.1-sol', effort: 'medium', label: 'S' }] };
    let i = 0;
    const out = await runAttempts({ cands: [first], access: 'read-only', cwd: tmp(), tryOne: async () => (i++ === 0 ? { rc: 1, stdout: '', stderr: 'unknown model x', seconds: 1 } : { rc: 0, stdout: 'ok', stderr: '', seconds: 1 }) });
    expect(out.attempts.map((a: Any) => a.skipped_models)).toEqual([sk, sk]);
  });

  it('6. the Antigravity probe passes the user quota rules through to the usage of each model', async () => {
    const { applyAgyProbe, mergeConfig, agyPool } = await lib();
    const cfg = mergeConfig(CFG, { hosts: { antigravity: { quotaGroups: { 'gemini-': 'My Group' } } } });
    const host = cfg.hosts.antigravity;
    const { tierEntries, resolveEntry } = await lib();
    const entries = (tierEntries(host.tiers.high) as Any[]).map(e => resolveEntry(e, 'antigravity', 'high', undefined));
    const st: Any = { host: 'antigravity', side: 'windows', installed: true, logged_in: null, usage: null, notes: [] };
    applyAgyProbe(st, { usageOut: usageText, usageErr: '', models: { rc: 0, stdout: agyText(AGY_ALL) } }, host, { model: '', entries });
    expect(st.usage_by_model['gemini-pro-orchestrator-neon'].groups).toEqual(['My Group']);
    expect(st.usage_by_model['gemini-pro-orchestrator-neon'].binding_pct).toBe(50);
    expect(st.pool.source).toBe('cli');
    expect(st.logged_in).toBe(true);
    void agyPool;
  });
});

// ---------------------------------------------------------------------------------------------------- Codex simple in two stages

describe('Codex simple tier: Terra for medium to higher scale, Luna for lower scale (--effort low)', () => {
  const plan = async (effort: string | undefined, rows: Row[] = CODEX_ALL): Promise<Any> => {
    const { buildPlan, codexPool } = await lib();
    return buildPlan(CFG, 'simple', { codex: { windows: status({ pool: codexPool(codexResponse(rows)) }) } }, 'windows', ['codex'], 'read-only', effort);
  };
  const shape = (c: Any): Any => [c.model, c.effort, (c.alternates ?? []).map((a: Any) => [a.model, a.effort])];

  it('no --effort: Terra at medium, Luna behind it', async () => {
    expect(shape((await plan(undefined)).selected)).toEqual(['gpt-6.1-terra', 'medium', [['gpt-6-luna', 'medium']]]);
  });

  it('--effort medium, high, xhigh, max: Terra at that effort, Luna behind it at the same effort', async () => {
    for (const e of ['medium', 'high', 'xhigh', 'max']) expect(shape((await plan(e)).selected), e).toEqual(['gpt-6.1-terra', e, [['gpt-6-luna', e]]]);
  });

  it('--effort low: Luna at medium (the model is the smaller stage, its effort is not lowered), Terra at medium behind it', async () => {
    const p = await plan('low');
    expect(shape(p.selected)).toEqual(['gpt-6-luna', 'medium', [['gpt-6.1-terra', 'medium']]]);
    expect(p.selected.effort_note).toBeUndefined();
  });

  it('a pool that lacks Luna: Terra for every effort; with --effort low Terra at medium takes over, and Luna is named as passed over', async () => {
    const rows = CODEX_ALL.filter(([m]) => m !== 'gpt-6-luna');
    const a = await plan(undefined, rows);
    expect([shape(a.selected), a.selected.skipped_models]).toEqual([['gpt-6.1-terra', 'medium', []], [{ model: 'gpt-6-luna', reason: "not in the account's model list" }]]);
    const l = await plan('low', rows);
    expect([shape(l.selected), l.selected.skipped_models]).toEqual([['gpt-6.1-terra', 'medium', []], [{ model: 'gpt-6-luna', reason: "not in the account's model list" }]]);
  });

  it('a pool that lacks Terra: Luna for every effort', async () => {
    const rows = CODEX_ALL.filter(([m]) => m !== 'gpt-6.1-terra');
    const a = await plan(undefined, rows);
    expect([shape(a.selected), a.selected.skipped_models]).toEqual([['gpt-6-luna', 'medium', []], [{ model: 'gpt-6.1-terra', reason: "not in the account's model list" }]]);
    expect(shape((await plan('high', rows)).selected)).toEqual(['gpt-6-luna', 'high', []]);
    expect(shape((await plan('low', rows)).selected)).toEqual(['gpt-6-luna', 'medium', []]);
  });

  it('the per-model effort list still applies: a Luna that lacks the asked effort keeps medium with the note', async () => {
    const { buildPlan, codexPool } = await lib();
    const pool = codexPool(codexResponse(CODEX_ALL.filter(([m]) => m !== 'gpt-6.1-terra'), { 'gpt-6-luna': ['low', 'medium'] }));
    const p = buildPlan(CFG, 'simple', { codex: { windows: status({ pool }) } }, 'windows', ['codex'], 'read-only', 'max');
    expect([p.selected.model, p.selected.effort]).toEqual(['gpt-6-luna', 'medium']);
    expect(p.selected.effort_note).toMatch(/gpt-6-luna does not offer "max" on this account; kept medium/);
  });

  it('the command line carries the model and the effort the plan chose', async () => {
    const { buildSpec } = await lib();
    const low = (await plan('low')).selected;
    const args = buildSpec(CFG, 'codex', low, 'x', 'read-only', '/w', 'simple').args as string[];
    expect([args[args.indexOf('-m') + 1], args.includes('model_reasoning_effort="medium"')]).toEqual(['gpt-6-luna', true]);
  });

  it('the config check accepts the shipped shape, with updated Codex medium fallback and high order', async () => {
    const { validateConfig, tierEntries } = await lib();
    expect(validateConfig(CFG)).toEqual([]);
    expect((tierEntries(CFG.hosts.codex.tiers.medium) as Any[]).map(e => e.model)).toEqual(['gpt-6.2-sol', 'gpt-6.1-sol', 'gpt-6.1-terra']);
    expect((tierEntries(CFG.hosts.codex.tiers.high) as Any[]).map(e => [e.model, e.effort])).toEqual([['gpt-6.2-astra', 'high'], ['gpt-6.2-sol', 'high'], ['gpt-6-astra', 'high']]);
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
    for (const w of ['gemini-pro-orchestrator-neon', 'gemini-pro-orchestrator-g1-pro', 'Orchestrator (Carbon)', 'claude-opus-5-5-high', 'gemini-4-argon-high', 'gemini-4-neon-high', 'gemini-4-neon-xhigh', 'gemini-4-hydrogen-low', '2026-11-22', 'gpt-6-luna', 'gpt-6.2-sol', 'gpt-6.2-astra', 'fixed configuration', '`ultra`']) expect(t, w).toContain(w);
  });

  it('validateEfforts accepts displayName, fixedEffort and quotaGroups on effortInModel hosts and refuses them on flag hosts', async () => {
    const { mergeConfig, validateConfig } = await lib();
    expect(validateConfig(mergeConfig(CFG, { hosts: { antigravity: { tiers: { high: { efforts: { extra: { displayName: 'Orchestrator (Carbon)', fixedEffort: true, quotaGroups: ['Gemini Models'] } } } } } } }))).toEqual([]);
    const flagMsg = validateConfig(mergeConfig(CFG, { hosts: { codex: { tiers: { high: { efforts: { extra: { displayName: 'X', fixedEffort: true } } } } } } })).join('\n');
    expect(flagMsg).toMatch(/codex\/high: efforts\.extra: displayName is only for a host/);
    expect(flagMsg).toMatch(/codex\/high: efforts\.extra: "fixed" is only for a host/);
  });

  it('hosts.md has a "Coming from 1.1.2" section: what gives the same plan, the two changes, and the old and new first models', () => {
    const t = doc('references/hosts.md');
    const i = t.indexOf('## Coming from 1.1.2');
    expect(i).toBeGreaterThan(-1);
    const s = t.slice(i, t.indexOf('\n## ', i + 5));
    for (const w of ['defines that tier completely', '1. Shipped efforts maps.', '2. Labels.', '3. Antigravity high, no overrides.', 'xhigh` and `max` were a usage error on every scope', '`low` and `high` were a usage error with `--host codex`', '9. A config that names `ultra`', 'invalid config (<your file>)', 'is refused at startup now', 'replaces its two shipped groups', 'Antigravity simple and medium keep theirs', '5. A user `efforts` map on Antigravity high', '6. The Antigravity medium tier has a second model', '7. A model you name.', 'pool_note', '8. Quota groups.', 'beats the groups of a shipped entry', 'gemini-4-argon-medium', 'gemini-pro-orchestrator-neon', 'gpt-6.1-sol', 'gpt-6.2-sol', 'gpt-6-astra']) expect(s, w).toContain(w);
    expect(t).not.toContain('changes the first model of the shipped list');
    expect(t).toContain('quota_note');
    expect(t).toContain('refused once per side, so twice on a machine with a Windows and a WSL side');
    expect(t).toContain('has unknown headroom and runs, as in 1.1.2');
    expect(t).toContain('so a refused model is not tried again as its own alternate');
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
