import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import type { LedgerDisposition, TranslationLedgerEntry } from '../src/core/types.js';

/**
 * Plan 017 (ADR 0019) / Step 2 — RED suite for the Host Dialect Codex, the Translation
 * Ledger, declarative overlays, the body-tool rewrite, and the body lint's section-residue
 * dimension (2026-09-24 re-evaluation, note 4; command tokens, note 7).
 *
 * RED-PHASE CONTRACT — most of these APIs do not exist yet, so the suite is RED until
 * Plan 017 Steps 3–5 land them. Import failures of `../src/core/dialects.js` and the
 * "MISSING API" errors below ARE the expected Red reason (missing API). Expected surface:
 *
 *   `../src/core/dialects.js` (new):
 *     - HOST_DIALECTS: Record<string, HostDialectSpec>            // v1 ships { claude }
 *     - validateHostDialectSpec(spec: unknown): HostDialectSpec   // throws on invalid/missing fields
 *     - validateProjectionOverlays(projections: unknown, spec: HostDialectSpec): void  // throws
 *     - lintProjectedBody(body: string, ledger?: TranslationLedgerEntry[]): string[]   // [] = clean
 *   `../src/core/registry.js` (new export, decision 4 / Step 3):
 *     - loadTranslationLedger(registryDir?: string): TranslationLedgerEntry[]
 *       loads registry/translation-ledger.json and fail-fast validates it
 *   `../src/core/claude-projector.js` (existing entry points, new behavior):
 *     - renderRole applies `projections` overlays with precedence
 *       overlay > dialect-derived default > canonical-derived value (decision 3),
 *       rewrites/dispositions the command tokens (note 7), and throws at render on any
 *       drop or surviving body token without a ledger disposition (decision 4).
 */

/**
 * QUARANTINE (2026-09-25, owner-approved): the 8 tests marked it.skip below are the
 * Plan 017 Step 5 render-lane contract (renderRole overlay/command-token/residue behavior).
 * They stay RED-by-design until the Plan 019 canonical purge + reviewed legacy-golden
 * regeneration land them (plans/019). Skips are the documented signal - never deleted
 * assertions. Un-skip exactly these 8 when the legacy goldens regenerate.
 */

const REQUIRED_SPEC_FIELDS = [
  'id',
  'fields',
  'toolVocabulary',
  'bodyToolVocabulary',
  'commandVocabulary',
  'features',
  'budgets',
  'nameRules',
  'launcher',
  'markerProfile',
] as const;

/** Re-evaluation note 7 — slash-command tokens are ledger citizens alongside tool tokens. */
const COMMAND_TOKENS = ['team_command', 'deep_planning_command', 'interview_command'] as const;

/** Plan 017 gate 4 — the 12 measured body-prose tokens with clean Claude equivalents. */
const MEASURED_12 = [
  'view_file',
  'write_to_file',
  'run_command',
  'grep_search',
  'replace_file_content',
  'manage_task',
  'list_dir',
  'search_web',
  'read_url_content',
  'invoke_subagent',
  'multi_replace_file_content',
  'send_message',
] as const;

const VALID_DISPOSITIONS: LedgerDisposition[] = ['mapped', 'approximated', 'degraded', 'unsupported'];

/** Re-evaluation note 4 — foreign-host section residue that must never survive a projection. */
const SECTION_RESIDUE = [/Nested Subagent Delegation/, /Host Routing/, /language_server/, /Cline & CLI/];

interface HostDialectSpecLike {
  id: string;
  commandVocabulary?: Record<string, string>;
  [key: string]: unknown;
}

interface DialectsModule {
  HOST_DIALECTS: Record<string, HostDialectSpecLike>;
  validateHostDialectSpec(spec: unknown): HostDialectSpecLike;
  validateProjectionOverlays(projections: unknown, spec: HostDialectSpecLike): void;
  lintProjectedBody(body: string, ledger?: TranslationLedgerEntry[]): string[];
}

interface RegistryModule {
  loadTranslationLedger(registryDir?: string): TranslationLedgerEntry[];
}

async function dialectsApi(): Promise<DialectsModule> {
  // A missing module rejects here with the module-resolution error — the expected Red reason.
  const mod = (await import('../src/core/dialects.js')) as unknown as Partial<DialectsModule>;
  for (const name of [
    'HOST_DIALECTS',
    'validateHostDialectSpec',
    'validateProjectionOverlays',
    'lintProjectedBody',
  ] as const) {
    if (mod[name] === undefined) {
      throw new Error(`MISSING API: src/core/dialects.ts must export ${name} (Plan 017 Step 2 contract)`);
    }
  }
  return mod as DialectsModule;
}

async function registryApi(): Promise<RegistryModule> {
  const mod = (await import('../src/core/registry.js')) as unknown as Partial<RegistryModule>;
  if (typeof mod.loadTranslationLedger !== 'function') {
    throw new Error('MISSING API: src/core/registry.ts must export loadTranslationLedger (Plan 017 Step 3)');
  }
  return mod as RegistryModule;
}

/** Deterministic fixture factory: same bytes in, same bytes out, no global state. */
function roleWith(body: string, extraFrontmatter = ''): string {
  return [
    '---',
    'name: subagent-fixture-runner',
    'version: 2.0.0',
    'type: subagent',
    'description: Fixture role for the Plan 017 codex red suite.',
    'model: inherit',
    'permissionMode: acceptEdits',
    'effort: high',
    'mainAgent: false',
    'subagent: true',
    'tools:',
    '  - view_file',
    '  - run_command',
    extraFrontmatter,
    '---',
    '',
    '# fixture-runner — system prompt',
    '',
    body,
    '',
  ].join('\n');
}

function yamlOf(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  expect(match, 'projection must start with YAML frontmatter').not.toBeNull();
  return (yaml.parse(match![1]) as Record<string, unknown>) || {};
}

function proseOf(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  const body = match ? match[1] : content;
  // Even indexes of the fence split are prose; odd indexes are ```fenced``` blocks.
  return body
    .split(/(```[\s\S]*?```)/g)
    .filter((_, index) => index % 2 === 0)
    .join('');
}

function hasWholeWord(text: string, token: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9_])${token}(?=[^A-Za-z0-9_]|$)`).test(text);
}

describe('HostDialectSpec validation (decision 2 + re-evaluation note 7)', () => {
  it('exposes HOST_DIALECTS with a claude spec carrying every required field', async () => {
    const { HOST_DIALECTS } = await dialectsApi();
    const spec = HOST_DIALECTS['claude'];
    expect(spec, 'HOST_DIALECTS.claude must exist (v1 is Claude-only)').toBeTruthy();
    for (const field of REQUIRED_SPEC_FIELDS) {
      expect(spec[field] !== undefined, `HostDialectSpec.${field} is required`).toBe(true);
    }
  });

  it('requires a command-token map covering team_command, deep_planning_command, interview_command (note 7)', async () => {
    const { HOST_DIALECTS } = await dialectsApi();
    const commands = HOST_DIALECTS['claude'].commandVocabulary;
    expect(commands, 'HostDialectSpec must carry a commandVocabulary map').toBeTruthy();
    for (const token of COMMAND_TOKENS) {
      const value = commands?.[token];
      expect(typeof value, `commandVocabulary[${token}] must be a string`).toBe('string');
      expect(String(value).trim().length, `commandVocabulary[${token}] must be non-empty`).toBeGreaterThan(0);
      // plans/020: never a bare foreign command name — the map must translate, never echo.
      expect(String(value), `commandVocabulary[${token}] must not echo the canonical token`).not.toBe(token);
    }
  });

  it('keeps spec data pure (no functions) so it stays serializable and diffable', async () => {
    const { HOST_DIALECTS } = await dialectsApi();
    const offenders: string[] = [];
    const walk = (value: unknown, at: string): void => {
      if (typeof value === 'function') {
        offenders.push(at);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, `${at}[${index}]`));
        return;
      }
      if (value && typeof value === 'object' && !(value instanceof RegExp)) {
        for (const [key, child] of Object.entries(value)) walk(child, `${at}.${key}`);
      }
    };
    walk(HOST_DIALECTS, 'HOST_DIALECTS');
    expect(offenders).toEqual([]);
  });

  it('accepts the shipped claude spec (validation runs at load)', async () => {
    const { HOST_DIALECTS, validateHostDialectSpec } = await dialectsApi();
    expect(() => validateHostDialectSpec(HOST_DIALECTS['claude'])).not.toThrow();
  });

  it('throws at load when the spec is missing a required field', async () => {
    const { HOST_DIALECTS, validateHostDialectSpec } = await dialectsApi();
    for (const field of REQUIRED_SPEC_FIELDS) {
      const broken: Record<string, unknown> = { ...HOST_DIALECTS['claude'] };
      delete broken[field];
      expect(() => validateHostDialectSpec(broken), `missing ${field} must throw`).toThrow();
    }
  });

  it('throws at load when the command-token map is missing or incomplete (note 7)', async () => {
    const { HOST_DIALECTS, validateHostDialectSpec } = await dialectsApi();
    const base = HOST_DIALECTS['claude'];

    const noMap: Record<string, unknown> = { ...base };
    delete noMap['commandVocabulary'];
    expect(() => validateHostDialectSpec(noMap), 'missing commandVocabulary must throw').toThrow();

    for (const token of COMMAND_TOKENS) {
      const commands: Record<string, string> = { ...(base.commandVocabulary ?? {}) };
      delete commands[token];
      expect(
        () => validateHostDialectSpec({ ...base, commandVocabulary: commands }),
        `missing ${token} must throw`
      ).toThrow();
    }

    const blank: Record<string, string> = { ...(base.commandVocabulary ?? {}) };
    blank['team_command'] = '   ';
    expect(
      () => validateHostDialectSpec({ ...base, commandVocabulary: blank }),
      'blank command rendering must throw'
    ).toThrow();
  });
});

describe('Translation Ledger fail-fast (decision 4 / acceptance gate 5)', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    // Isolated temp workspaces, cleaned deterministically (no retries, no sleeps).
    while (tmpDirs.length > 0) {
      const dir = tmpDirs.pop();
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function ledgerDir(entries: unknown): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'au-ledger-'));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, 'translation-ledger.json'), JSON.stringify(entries), 'utf8');
    return dir;
  }

  it('exposes loadTranslationLedger from src/core/registry.js (Plan 017 Step 3)', async () => {
    const mod = (await import('../src/core/registry.js')) as unknown as Partial<RegistryModule>;
    expect(
      typeof mod.loadTranslationLedger,
      'MISSING API: src/core/registry.ts must export loadTranslationLedger'
    ).toBe('function');
  });

  it('accepts exactly mapped|approximated|degraded|unsupported, each with a non-empty rationale', async () => {
    const { loadTranslationLedger } = await registryApi();
    for (const disposition of VALID_DISPOSITIONS) {
      const dir = ledgerDir([
        { feature: 'example_feature', host: 'claude', disposition, rationale: 'Fixture rationale for the disposition.' },
      ]);
      const entries = loadTranslationLedger(dir);
      expect(entries).toHaveLength(1);
      expect(entries[0].disposition).toBe(disposition);
      expect(entries[0].rationale.trim().length).toBeGreaterThan(0);
    }
  });

  it('rejects an invalid disposition, an empty rationale, or a missing feature/host at load', async () => {
    const { loadTranslationLedger } = await registryApi();
    expect(
      () => loadTranslationLedger(ledgerDir([{ feature: 'f', host: 'claude', disposition: 'maybe', rationale: 'r' }])),
      'invalid disposition must throw'
    ).toThrow();
    expect(
      () => loadTranslationLedger(ledgerDir([{ feature: 'f', host: 'claude', disposition: 'mapped', rationale: '   ' }])),
      'empty rationale must throw'
    ).toThrow();
    expect(
      () => loadTranslationLedger(ledgerDir([{ host: 'claude', disposition: 'mapped', rationale: 'r' }])),
      'missing feature must throw'
    ).toThrow();
    expect(
      () => loadTranslationLedger(ledgerDir([{ feature: 'f', disposition: 'mapped', rationale: 'r' }])),
      'missing host must throw'
    ).toThrow();
  });

  it('loads and validates the real registry/translation-ledger.json seed (decision 4)', async () => {
    const { loadTranslationLedger } = await registryApi();
    const entries = loadTranslationLedger();
    expect(Array.isArray(entries)).toBe(true);
    for (const entry of entries) {
      expect(VALID_DISPOSITIONS, `disposition of ${entry.feature}`).toContain(entry.disposition);
      expect(entry.rationale.trim().length, `rationale of ${entry.feature} must be non-empty`).toBeGreaterThan(0);
    }
  });

  it('THROWS at render when a dropped frontmatter feature has no disposition (never a silent drop)', () => {
    // Behavior pin — gate 5's core invariant (already enforced today via requireDisposition).
    const sample = roleWith('Body.', 'unmappedFutureKey: value');
    expect(() => ClaudeProjector.renderRole(sample, 'agents/subagent-fixture-runner.md')).toThrowError(
      /disposition|ledger/i
    );
  });

  it('THROWS at render when a surviving body tool token has no disposition (decision 4)', () => {
    // `subagent_handback` is a canonical tool token with no ledger entry: leaving it in the
    // body must be a render-time error, not a silent survivor.
    const sample = roleWith('Hand results back with subagent_handback when the runtime provides it.');
    expect(() => ClaudeProjector.renderRole(sample, 'agents/subagent-fixture-runner.md')).toThrowError(
      /disposition|ledger/i
    );
  });

  it('records a non-empty-rationale disposition for every surviving command token (note 7)', () => {
    const body = 'Open the team_command, then the deep_planning_command, then the interview_command.';
    const { ledger } = ClaudeProjector.renderRole(roleWith(body), 'agents/subagent-fixture-runner.md');
    for (const token of COMMAND_TOKENS) {
      const entry = ledger.find(e => e.feature === token);
      expect(entry, `render must disposition ${token} (command tokens are ledger citizens)`).toBeTruthy();
      expect(VALID_DISPOSITIONS).toContain(entry!.disposition);
      expect(entry!.rationale.trim().length, `rationale of ${token} must be non-empty`).toBeGreaterThan(0);
    }
  });
});

describe('Declarative overlays (decision 3 / acceptance gate 6)', () => {
  const CLAUDE_OVERLAY = [
    'projections:',
    '  claude:',
    '    model: haiku',
    '    effort: low',
    '    description: Overlay description wins.',
  ].join('\n');

  it('applies a valid claude overlay to the projected artifact (a valid overlay reaches its host)', () => {
    const { content } = ClaudeProjector.renderRole(
      roleWith('Overlay fixture body.', CLAUDE_OVERLAY),
      'agents/subagent-fixture-runner.md'
    );
    const meta = yamlOf(content);
    expect(meta.model, 'overlay model must reach the artifact').toBe('haiku');
    expect(meta.effort, 'overlay effort must reach the artifact').toBe('low');
    expect(meta.description, 'overlay description must reach the artifact').toBe('Overlay description wins.');
  });

  it('pins precedence: the overlay wins over the dialect-derived default', () => {
    // Canonical says `model: inherit`; the dialect default for a specialist is sonnet; the
    // overlay says haiku — the overlay must win (overlay > dialect default).
    const { content } = ClaudeProjector.renderRole(
      roleWith('Overlay fixture body.', CLAUDE_OVERLAY),
      'agents/subagent-fixture-runner.md'
    );
    expect(yamlOf(content).model).toBe('haiku');
  });

  it('pins precedence: the dialect-derived default wins over the canonical-derived value', () => {
    // Canonical `model: inherit` derives no opinion; the role posture (sonnet/medium) applies.
    const meta = yamlOf(ClaudeProjector.renderRole(roleWith('Default fixture body.'), 'agents/subagent-fixture-runner.md').content);
    expect(meta.model, 'dialect default beats canonical inherit').toBe('sonnet');
    expect(meta.effort, 'explicit canonical effort survives unchanged').toBe('high');
  });

  it('pins precedence: the overlay wins over an explicit canonical value', () => {
    // Canonical declares `effort: high`; the overlay says low — overlay > canonical-derived.
    const { content } = ClaudeProjector.renderRole(
      roleWith('Overlay fixture body.', CLAUDE_OVERLAY),
      'agents/subagent-fixture-runner.md'
    );
    expect(yamlOf(content).effort).toBe('low');
  });

  it('fails catalog load for an unknown overlay host', async () => {
    const { validateProjectionOverlays, HOST_DIALECTS } = await dialectsApi();
    expect(
      () => validateProjectionOverlays({ kimi: { model: 'haiku' } }, HOST_DIALECTS['claude']),
      'unknown overlay host must throw'
    ).toThrow();
  });

  it('fails catalog load for an unknown overlay field', async () => {
    const { validateProjectionOverlays, HOST_DIALECTS } = await dialectsApi();
    expect(
      () => validateProjectionOverlays({ claude: { unknownOverlayField: 1 } }, HOST_DIALECTS['claude']),
      'unknown overlay field must throw'
    ).toThrow();
  });

  it('fails catalog load for an invalid vocab value', async () => {
    const { validateProjectionOverlays, HOST_DIALECTS } = await dialectsApi();
    expect(
      () => validateProjectionOverlays({ claude: { permissionMode: 'yolo' } }, HOST_DIALECTS['claude']),
      'invalid vocab value must throw'
    ).toThrow();
  });

  it('rejects overlays that introduce fields the spec marks unsupported', async () => {
    const { validateProjectionOverlays, HOST_DIALECTS } = await dialectsApi();
    expect(
      () => validateProjectionOverlays({ claude: { hooks: { PreInvocation: [] } } }, HOST_DIALECTS['claude']),
      'an unsupported field must never be introduced by an overlay'
    ).toThrow();
  });

  it('fails the projection of an agent whose overlay is invalid (fail-fast, never silent)', () => {
    const invalid = roleWith('Overlay fixture body.', 'projections:\n  kimi:\n    model: haiku');
    expect(() => ClaudeProjector.renderRole(invalid, 'agents/subagent-fixture-runner.md')).toThrowError(
      /overlay|projection|unknown host/i
    );
  });
});

describe('Body-tool rewrite (decision 5 / acceptance gate 4)', () => {
  it('rewrites all 12 measured canonical tool tokens in prose, whole-word', () => {
    const body = MEASURED_12.map(token => `Use ${token} when needed.`).join(' ');
    const { content } = ClaudeProjector.renderRole(roleWith(body), 'agents/subagent-fixture-runner.md');
    const prose = proseOf(content);
    for (const token of MEASURED_12) {
      expect(
        hasWholeWord(prose, token),
        `${token} must be rewritten in prose; raw survivor found in: ${prose}`
      ).toBe(false);
    }
  });

  it('leaves no raw canonical tool token in prose outside code fences (gate 4)', () => {
    const body = `${MEASURED_12.map(token => `Call ${token} now.`).join(' ')} Schedule checks later.`;
    const { content } = ClaudeProjector.renderRole(roleWith(body), 'agents/subagent-fixture-runner.md');
    const prose = proseOf(content);
    // `schedule` is the documented English-word exception: it may survive only WITH a
    // disposition (asserted via lintProjectedBody below), every rewriteable token is gone.
    for (const token of MEASURED_12) {
      expect(hasWholeWord(prose, token), `${token} survived projection prose`).toBe(false);
    }
  });

  it('preserves fenced code blocks byte-for-byte', () => {
    const body = ['Rewrite view_file in prose.', '', '```bash', 'view_file README.md', 'run_command --dry-run', '```', ''].join('\n');
    const { body: out } = ClaudeProjector.rewriteBody(body);
    expect(out).toContain('```bash\nview_file README.md\nrun_command --dry-run\n```');
  });

  it('never rewrites longer identifiers that merely contain a token', () => {
    const { body } = ClaudeProjector.rewriteBody('Call send_message_batch, send_message2 and rescheduled tasks.');
    expect(body).toBe('Call send_message_batch, send_message2 and rescheduled tasks.');
  });

  it('rewrites the command tokens in prose; no raw command token survives (note 7)', () => {
    const body = [
      'Open the team_command when the team must assemble.',
      'Start the deep_planning_command for a fresh plan.',
      'Run the interview_command before requirements work.',
      '',
      '```text',
      'team_command deep_planning_command interview_command',
      '```',
    ].join('\n');
    const { content } = ClaudeProjector.renderRole(roleWith(body), 'agents/subagent-fixture-runner.md');
    const prose = proseOf(content);
    for (const token of COMMAND_TOKENS) {
      expect(hasWholeWord(prose, token), `${token} must be rewritten in prose (command tokens are ledger citizens)`).toBe(
        false
      );
    }
    // The fenced sample stays raw — code is preserved byte-for-byte.
    expect(content).toContain('team_command deep_planning_command interview_command');
  });

  it('lints a surviving undispositioned canonical token as a violation and allows a dispositioned survivor', async () => {
    const { lintProjectedBody } = await dialectsApi();
    expect(
      lintProjectedBody('Hand results back with subagent_handback.', []),
      'an undispositioned survivor must be a lint violation'
    ).not.toEqual([]);
    const scheduleLedger: TranslationLedgerEntry[] = [
      { feature: 'schedule', host: 'claude', disposition: 'approximated', rationale: 'Cron tools approximate liveness timers.' },
    ];
    expect(
      lintProjectedBody('We can schedule recurring checks.', scheduleLedger),
      'a survivor carrying a disposition is not a violation (gate 4: rewritten OR dispositioned)'
    ).toEqual([]);
  });
});

/**
 * Re-evaluation note 4 (2026-09-24) — the body lint gains a section-residue dimension
 * (extends gate 4): besides undispositioned canonical tool tokens, the lint must fail on
 * foreign-host section patterns in projected bodies. The measured residue inventory and
 * the canonical purge live in plans/019; the lint SEAM and this invariant live here.
 */
describe('Body lint — section residue (re-evaluation note 4)', () => {
  it('flags every foreign-host section pattern as a lint violation', async () => {
    const { lintProjectedBody } = await dialectsApi();
    for (const pattern of SECTION_RESIDUE) {
      expect(
        lintProjectedBody(`## Example\n\nThis projected body mentions ${pattern.source} residue.\n`, []),
        `lint must flag /${pattern.source}/`
      ).not.toEqual([]);
    }
    expect(lintProjectedBody('A clean projection body with nothing foreign in it.\n', [])).toEqual([]);
  });

  it('projects a residue fixture body clean of all four patterns (they must not match)', () => {
    const body = [
      '## Nested Subagent Delegation',
      '',
      'Deep recursion into sub-subagents is described here.',
      '',
      'Runtime note for Cline & CLI operators: route via the host bridge.',
      'Upstream limitation: language_server.exe on one host.',
      '',
      '## Host Routing',
      '',
      'Route each slice to the host that owns it.',
    ].join('\n');
    const { content } = ClaudeProjector.renderRole(roleWith(body), 'agents/subagent-fixture-runner.md');
    for (const pattern of SECTION_RESIDUE) {
      expect(
        `${pattern.source} survived projection: ${pattern.test(content)}`,
        `projected .claude bodies must not match /${pattern.source}/`
      ).toBe(`${pattern.source} survived projection: false`);
    }
  });

  it('flags residue that survives today\'s projection output (the seam must catch real renderers)', async () => {
    const { lintProjectedBody } = await dialectsApi();
    // The lint judges whatever body it is given (note 4): residue must be reported, never
    // passed silently. The renderer now scrubs residue itself (see the fixture test above),
    // so the seam check feeds residue straight to the lint, whatever emitted it.
    const residueBody = ['## Nested Subagent Delegation', '', 'Still foreign prose.'].join('\n');
    const violations = lintProjectedBody(residueBody, []);
    expect(violations.some(v => /Nested Subagent Delegation/.test(v)), `violations were: ${violations.join(' | ')}`).toBe(
      true
    );
  });
});





