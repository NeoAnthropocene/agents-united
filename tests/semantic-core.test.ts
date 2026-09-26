import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';

/**
 * Plan 021 (ADR 0021) / Step 1 — RED suite for the Semantic Core schema, the forbidden-token
 * corpus scanner, the core loader, the Contract Floor validator, and declared-delta conformance.
 *
 * Acceptance gates pinned in this file:
 *   - Gate 2 (corpus completeness): core schema rejects 100% of the forbidden-pattern corpus —
 *     the 18 canonical tool tokens + 3 command tokens + 4 Plan-019 residue patterns = exactly
 *     25 entries, no duplicates.
 *   - Gate 3 (Contract Floor): zero floor divergence on a conforming realization; ONE seeded
 *     floor mutation (removing exactly one safety sentence) fails exactly one assertion,
 *     naming the `safety` field.
 *   - Gate 4 (declared deltas): undeclared delta → conformance failure; declared delta
 *     (`mapped|approximated|degraded|unsupported` + rationale) → pass; a delta without a
 *     rationale or with an invalid disposition is itself a violation.
 *   (Gate 5 — creation byte-determinism — lives in tests/creation-engine-claude.test.ts.)
 *
 * RED-PHASE CONTRACT — `../src/core/semantic-core.js` lands in Plan 021 Step 2 and does not
 * exist yet. ALL module access is wrapped in `semanticCoreApi()` below (the `dialectsApi()`
 * pattern from tests/host-dialect-codex.test.ts): a dynamic import plus export checks that
 * throw descriptive "MISSING API: …" errors. Those errors ARE the expected Red reason —
 * never a collection-time import crash. Expected surface pinned here:
 *
 *   `../src/core/semantic-core.js` (new — Step 2):
 *     - FORBIDDEN_TOKEN_CORPUS: readonly string[]
 *         exactly 25 entries, no duplicates: the 18 canonical tool tokens (view_file,
 *         write_to_file, replace_file_content, multi_replace_file_content, run_command,
 *         grep_search, find_by_name, list_dir, ask_question, invoke_subagent, define_subagent,
 *         manage_subagents, send_message, schedule, manage_task, search_web, read_url_content,
 *         generate_image) + the 3 command tokens (team_command, deep_planning_command,
 *         interview_command) + the 4 Plan-019 residue patterns as literal strings
 *         ("Nested Subagent Delegation", "Host Routing", "language_server", "Cline & CLI").
 *     - scanCoreForHostTokens(text: string): string[]
 *         [] = clean; otherwise the matched corpus entries.
 *     - validateCoreSchema(core: unknown): SemanticCore
 *         throws on malformed schema or any forbidden token in any field.
 *     - loadSemanticCore(registryDir?: string): Promise<Map<string, SemanticCore>>
 *         loads `<registryDir>/core/*.core.md` (default registryDir = "registry"); YAML
 *         frontmatter fields: identity, mission, scope_boundaries, output_contract, safety
 *         (strings) + invariants (string[]). Map key = the `<agent>` stem of `<agent>.core.md`.
 *         Every file passes validateCoreSchema — fail-fast at load.
 *     - validateContractFloor(realizationContent: string, core: SemanticCore): string[]
 *         [] = conformant; the floor fields (identity, scope_boundaries, output_contract,
 *         safety) must appear verbatim (whitespace-normalized) in the realization; one
 *         violation message per divergent field, each naming the field.
 *     - validateDeclaredDeltas(input: {
 *         realization: { boundInvariants: string[]; aboveFloorScope: string[] };
 *         core: SemanticCore;
 *         deltas: DeclaredDelta[];
 *       }): string[]
 *         violations for (i) a core invariant neither bound nor delta-declared, (ii) an
 *         above-floor scope item without a declared delta. DeclaredDelta = { feature: string;
 *         host: string; disposition: 'mapped'|'approximated'|'degraded'|'unsupported';
 *         rationale: string }. A delta without rationale or with an invalid disposition is
 *         itself a violation. A delta's `feature` matches the invariant / above-floor item
 *         text 1:1.
 */
type DeltaDisposition = 'mapped' | 'approximated' | 'degraded' | 'unsupported';

interface SemanticCore {
  identity: string;
  mission: string;
  scope_boundaries: string;
  output_contract: string;
  safety: string;
  invariants: string[];
}

interface DeclaredDelta {
  feature: string;
  host: string;
  disposition: DeltaDisposition;
  rationale: string;
}

interface ValidateDeclaredDeltasInput {
  realization: { boundInvariants: string[]; aboveFloorScope: string[] };
  core: SemanticCore;
  deltas: DeclaredDelta[];
}

interface SemanticCoreModule {
  FORBIDDEN_TOKEN_CORPUS: readonly string[];
  scanCoreForHostTokens(text: string): string[];
  validateCoreSchema(core: unknown): SemanticCore;
  loadSemanticCore(registryDir?: string): Promise<Map<string, SemanticCore>>;
  validateContractFloor(realizationContent: string, core: SemanticCore): string[];
  validateDeclaredDeltas(input: ValidateDeclaredDeltasInput): string[];
}

async function semanticCoreApi(): Promise<SemanticCoreModule> {
  // The dynamic import (the `dialectsApi()` pattern): a missing module rejects below and is
  // re-thrown as a descriptive MISSING API error — the expected Red reason, never a crash.
  const mod = (await import('../src/core/semantic-core.js').catch((err: unknown) => {
    throw new Error(
      `MISSING API: src/core/semantic-core.ts cannot be loaded (Plan 021 Step 2 contract) — dynamic import rejected: ${err instanceof Error ? err.message : String(err)}`,
    );
  })) as unknown as Partial<SemanticCoreModule>;
  for (const name of [
    'FORBIDDEN_TOKEN_CORPUS',
    'scanCoreForHostTokens',
    'validateCoreSchema',
    'loadSemanticCore',
    'validateContractFloor',
    'validateDeclaredDeltas',
  ] as const) {
    if (mod[name] === undefined) {
      throw new Error(`MISSING API: src/core/semantic-core.ts must export ${name} (Plan 021 Step 1/2 contract)`);
    }
  }
  return mod as SemanticCoreModule;
}
/** Gate 2's corpus, restated as expected membership — this suite pins 100% coverage. */
const EXPECTED_CORPUS = [
  // 18 canonical tool tokens
  'view_file',
  'write_to_file',
  'replace_file_content',
  'multi_replace_file_content',
  'run_command',
  'grep_search',
  'find_by_name',
  'list_dir',
  'ask_question',
  'invoke_subagent',
  'define_subagent',
  'manage_subagents',
  'send_message',
  'schedule',
  'manage_task',
  'search_web',
  'read_url_content',
  'generate_image',
  // 3 command tokens
  'team_command',
  'deep_planning_command',
  'interview_command',
  // 4 Plan-019 residue patterns, as literal strings
  'Nested Subagent Delegation',
  'Host Routing',
  'language_server',
  'Cline & CLI',
] as const;

const VALID_DISPOSITIONS: DeltaDisposition[] = ['mapped', 'approximated', 'degraded', 'unsupported'];

/** Schema fields scanned for forbidden tokens (invariants are exercised separately). */
const CORE_FIELDS = ['identity', 'mission', 'scope_boundaries', 'output_contract', 'safety'] as const;

const INVARIANT_BOUND = 'Every report claim cites a test result.';
const INVARIANT_UNBOUND = 'Fail fast on missing preconditions.';
const ABOVE_FLOOR_ITEM = 'Host-native automatic handback of specialist output.';
const SAFETY_MUTATION_SENTENCE = 'Never commit to protected branches.';

/** Deterministic fixture factory: same bytes in, same bytes out, no global state, no sleeps. */
function coreFixture(): SemanticCore {
  return {
    identity: 'Senior QA Automation Lead & Test Architecture Specialist.',
    mission: 'Guarantee deterministic release quality across every host realization.',
    scope_boundaries: 'Owns test authoring, execution, and verification gates exclusively.',
    output_contract: 'Deliver a QA Verification Gate Report with suite breakdown and verdict.',
    safety: 'Never run destructive shell commands. Never commit to protected branches. Never log secrets.',
    invariants: [INVARIANT_BOUND, INVARIANT_UNBOUND],
  };
}

/**
 * A conforming realization: native `.claude/agents/<role>.md`-shaped content embedding every
 * floor field. `scope_boundaries` is deliberately rendered with a mid-sentence line wrap so a
 * passing floor check also pins the whitespace-normalization rule.
 */
function realizationFixture(core: SemanticCore): string {
  return [
    '---',
    'name: subagent-qa-automation-lead',
    'description: Claude realization fixture for the Plan 021 Step 1 red suite.',
    '---',
    '',
    '# subagent-qa-automation-lead — system prompt',
    '',
    '## Identity',
    core.identity,
    '',
    '## Mission',
    core.mission,
    '',
    '## Scope boundaries',
    core.scope_boundaries.replace(' gates ', ' gates\n'),
    '',
    '## Output contract',
    core.output_contract,
    '',
    '## Safety',
    core.safety,
    '',
  ].join('\n');
}

/** Gate 3's seeded mutation: remove exactly ONE safety sentence from the realization. */
function withOneSafetySentenceRemoved(realization: string): string {
  return realization.replace(` ${SAFETY_MUTATION_SENTENCE}`, '');
}

function makeDelta(feature: string, disposition: string, rationale: string): DeclaredDelta {
  // Cast: tests must be able to feed invalid dispositions to the runtime validator.
  return { feature, host: 'claude', disposition, rationale } as unknown as DeclaredDelta;
}

function deltaInput(
  boundInvariants: string[],
  aboveFloorScope: string[],
  deltas: DeclaredDelta[],
): ValidateDeclaredDeltasInput {
  return { realization: { boundInvariants, aboveFloorScope }, core: coreFixture(), deltas };
}

function coreFileContent(fields: unknown): string {
  return ['---', yaml.stringify(fields).trimEnd(), '---', '', 'Tool-neutral behavioural core fixture body.', ''].join('\n');
}
describe('Forbidden-token corpus (gate 2 — 100% rejection)', () => {
  it('pins exactly the 25-entry corpus with no duplicates', async () => {
    const { FORBIDDEN_TOKEN_CORPUS } = await semanticCoreApi();
    expect([...FORBIDDEN_TOKEN_CORPUS].sort(), 'corpus membership must match EXPECTED_CORPUS').toEqual(
      [...EXPECTED_CORPUS].sort(),
    );
    expect(FORBIDDEN_TOKEN_CORPUS.length, 'corpus must be exactly 25 entries').toBe(25);
    expect(new Set(FORBIDDEN_TOKEN_CORPUS).size, 'corpus must carry no duplicates').toBe(25);
  });

  it('(a) flags every corpus token and rejects it from every core field', async () => {
    const { FORBIDDEN_TOKEN_CORPUS, scanCoreForHostTokens, validateCoreSchema } = await semanticCoreApi();
    expect(FORBIDDEN_TOKEN_CORPUS.length).toBe(25);
    for (const [index, token] of FORBIDDEN_TOKEN_CORPUS.entries()) {
      expect(scanCoreForHostTokens(`alpha ${token} omega`), `scan must flag ${token}`).toContain(token);

      // Rotate the seeded field so every core string field is exercised across the corpus.
      const field = CORE_FIELDS[index % CORE_FIELDS.length];
      const poisoned = { ...coreFixture(), [field]: `alpha ${token} omega` };
      expect(
        () => validateCoreSchema(poisoned),
        `validateCoreSchema must reject ${token} in ${field}`,
      ).toThrow();

      const poisonedInvariant = { ...coreFixture(), invariants: [`alpha ${token} omega`] };
      expect(
        () => validateCoreSchema(poisonedInvariant),
        `validateCoreSchema must reject ${token} in invariants`,
      ).toThrow();
    }
  });

  it('accepts clean text and a clean core', async () => {
    const { scanCoreForHostTokens, validateCoreSchema } = await semanticCoreApi();
    expect(scanCoreForHostTokens('A fully tool-neutral behavioural law.')).toEqual([]);
    expect(() => validateCoreSchema(coreFixture())).not.toThrow();
  });

  it('throws on malformed core schema (missing or mistyped fields)', async () => {
    const { validateCoreSchema } = await semanticCoreApi();
    for (const field of CORE_FIELDS) {
      const broken: Record<string, unknown> = { ...coreFixture() };
      delete broken[field];
      expect(() => validateCoreSchema(broken), `missing ${field} must throw`).toThrow();
    }
    expect(() => validateCoreSchema({ ...coreFixture(), invariants: 'not-an-array' })).toThrow();
    expect(() => validateCoreSchema(null)).toThrow();
  });
});

describe('Contract Floor validator (gate 3 — floor is not negotiable)', () => {
  it('(b) passes a conforming realization and fails EXACTLY one seeded mutation', async () => {
    const { validateContractFloor } = await semanticCoreApi();
    const core = coreFixture();

    expect(validateContractFloor(realizationFixture(core), core), 'conforming realization must report []').toEqual([]);

    const mutated = validateContractFloor(withOneSafetySentenceRemoved(realizationFixture(core)), core);
    expect(mutated, 'one seeded floor mutation must fail exactly one assertion').toHaveLength(1);
    expect(mutated[0], 'the violation must name the safety field').toMatch(/safety/);
  });

  it('normalizes whitespace when matching floor fields verbatim', async () => {
    const { validateContractFloor } = await semanticCoreApi();
    const core = coreFixture();
    // realizationFixture wraps scope_boundaries mid-sentence; normalization must tolerate it.
    expect(validateContractFloor(realizationFixture(core), core)).toEqual([]);
  });

  it('reports one violation per divergent floor field', async () => {
    const { validateContractFloor } = await semanticCoreApi();
    const core = coreFixture();
    const empty = '---\nname: x\n---\n\nno floor content at all\n';
    const violations = validateContractFloor(empty, core);
    expect(violations, 'all four floor fields must be reported').toHaveLength(4);
  });
});

describe('Declared-delta conformance (gate 4)', () => {
  it('(c) an undeclared delta fails conformance', async () => {
    const { validateDeclaredDeltas } = await semanticCoreApi();
    const violations = validateDeclaredDeltas(deltaInput([INVARIANT_BOUND], [ABOVE_FLOOR_ITEM], []));
    expect(violations, 'undeclared above-floor scope + unbound invariant = 2 violations').toHaveLength(2);
    expect(violations.join(' | '), 'above-floor item must be reported').toMatch(/Host-native automatic handback/);
    expect(violations.join(' | '), 'the unbound invariant must be reported').toMatch(/Fail fast on missing preconditions/);
  });

  it('(d) a declared delta passes with its classification', async () => {
    const { validateDeclaredDeltas } = await semanticCoreApi();
    for (const disposition of VALID_DISPOSITIONS) {
      const deltas = [
        makeDelta(ABOVE_FLOOR_ITEM, disposition, 'Claude delivers specialist handback at runtime.'),
        makeDelta(INVARIANT_UNBOUND, disposition, 'Bound to a precondition checklist on this host.'),
      ];
      const violations = validateDeclaredDeltas(deltaInput([INVARIANT_BOUND], [ABOVE_FLOOR_ITEM], deltas));
      expect(violations, `disposition ${disposition} must pass with a rationale`).toEqual([]);
    }
  });

  it('rejects an invalid disposition and a missing rationale', async () => {
    const { validateDeclaredDeltas } = await semanticCoreApi();
    const badDisposition = [
      makeDelta(ABOVE_FLOOR_ITEM, 'partial', 'Not a legal classification.'),
      makeDelta(INVARIANT_UNBOUND, 'mapped', 'Bound on this host.'),
    ];
    expect(
      validateDeclaredDeltas(deltaInput([INVARIANT_BOUND], [ABOVE_FLOOR_ITEM], badDisposition)),
      'an invalid disposition must be a violation',
    ).not.toEqual([]);

    const noRationale = [
      makeDelta(ABOVE_FLOOR_ITEM, 'mapped', ''),
      makeDelta(INVARIANT_UNBOUND, 'mapped', 'Bound on this host.'),
    ];
    expect(
      validateDeclaredDeltas(deltaInput([INVARIANT_BOUND], [ABOVE_FLOOR_ITEM], noRationale)),
      'a delta without rationale must be a violation',
    ).not.toEqual([]);
  });
});

describe('Semantic Core loader (registry/core/*.core.md, fail-fast at load)', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    while (tmpDirs.length > 0) {
      fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
    }
  });

  function tmpRegistry(files: Record<string, unknown>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p021-core-'));
    tmpDirs.push(dir);
    fs.mkdirSync(path.join(dir, 'core'), { recursive: true });
    for (const [stem, fields] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, 'core', `${stem}.core.md`), coreFileContent(fields), 'utf8');
    }
    return dir;
  }

  it('loads every *.core.md into a stem-keyed map of validated cores', async () => {
    const { loadSemanticCore } = await semanticCoreApi();
    const dir = tmpRegistry({ alpha: coreFixture() });
    const cores = await loadSemanticCore(dir);
    expect(cores.get('alpha'), 'loaded core must round-trip its fields').toEqual(coreFixture());
  });

  it('fail-fast rejects a malformed core file at load', async () => {
    const { loadSemanticCore } = await semanticCoreApi();
    const broken: Record<string, unknown> = { ...coreFixture() };
    delete broken.safety;
    const dir = tmpRegistry({ alpha: broken });
    await expect(loadSemanticCore(dir)).rejects.toThrow();
  });

  it('fail-fast rejects a core file carrying a forbidden token at load', async () => {
    const { loadSemanticCore } = await semanticCoreApi();
    const dir = tmpRegistry({ alpha: { ...coreFixture(), safety: 'Never call invoke_subagent yourself.' } });
    await expect(loadSemanticCore(dir)).rejects.toThrow();
  });
});


