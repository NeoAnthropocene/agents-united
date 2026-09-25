import { describe, it, expect } from 'vitest';

/**
 * Plan 021 (ADR 0021) / Step 1 — RED suite for the Claude Creation Engine (case e).
 *
 * Acceptance gates pinned in this file:
 *   - Gate 5 (determinism): creation output is byte-identical across 3 repeated runs —
 *     same inputs, same bytes (case e). No LLM in the path (ADR 0021 decision 3): creation
 *     is deterministic codegen only.
 *   - Gate 3 support (Contract Floor): the floor fields (identity, scope_boundaries,
 *     output_contract, safety) are emitted VERBATIM from the core into the created role —
 *     the floor is not negotiable (ADR 0021 decision 6).
 *   (Gates 2 and 4 — corpus rejection and declared deltas — live in tests/semantic-core.test.ts.)
 *
 * RED-PHASE CONTRACT — `../src/core/creation/claude.js` lands in Plan 021 Step 4 and does not
 * exist yet. ALL module access is wrapped in `creationApi()` below (the `dialectsApi()` pattern
 * from tests/host-dialect-codex.test.ts): a dynamic import plus export checks that throw
 * descriptive "MISSING API: …" errors. Those errors ARE the expected Red reason — never a
 * collection-time import crash. Expected surface pinned here:
 *
 *   `../src/core/creation/claude.js` (new — Step 4):
 *     - createRole(core: SemanticCore, bindingTable: BindingTableLike,
 *       profile: CapabilityProfileLike): string
 *       deterministic native `.claude/agents/<role>.md` content (YAML-frontmatter markdown);
 *       floor fields emitted verbatim from the core; invariant prose emitted from binding
 *       templates; declared deltas applied only where declared. Pure: no clock, no
 *       randomness, no I/O — the same inputs must return strictly equal (byte-identical)
 *       strings on every call.
 */
interface SemanticCore {
  identity: string;
  mission: string;
  scope_boundaries: string;
  output_contract: string;
  safety: string;
  invariants: string[];
}

/**
 * Structural stand-in for the Step 3 Claude Binding Table (its canonical shape is owned by
 * Step 3 / ADR 0021 decision 9). The fixtures below carry representative entries so the
 * engine has real input to assemble; these tests pin determinism and floor emission only.
 */
interface BindingTableLike {
  host: string;
  [key: string]: unknown;
}

/** Structural stand-in for the versioned tool-surface snapshot (e.g. claude@2.1.271). */
interface CapabilityProfileLike {
  host: string;
  version: string;
  tools: string[];
  [key: string]: unknown;
}

interface CreationClaudeModule {
  createRole(core: SemanticCore, bindingTable: BindingTableLike, profile: CapabilityProfileLike): string;
}

async function creationApi(): Promise<CreationClaudeModule> {
  // The dynamic import (the `dialectsApi()` pattern): a missing module rejects below and is
  // re-thrown as a descriptive MISSING API error — the expected Red reason, never a crash.
  const mod = (await import('../src/core/creation/claude.js').catch((err: unknown) => {
    throw new Error(
      `MISSING API: src/core/creation/claude.ts cannot be loaded (Plan 021 Step 4 contract) — dynamic import rejected: ${err instanceof Error ? err.message : String(err)}`,
    );
  })) as unknown as Partial<CreationClaudeModule>;
  if (typeof mod.createRole !== 'function') {
    throw new Error('MISSING API: src/core/creation/claude.ts must export createRole (Plan 021 Step 4 contract)');
  }
  return mod as CreationClaudeModule;
}

/** Deterministic fixture factories: same bytes in, same bytes out, no global state, no sleeps. */
function coreFixture(): SemanticCore {
  return {
    identity: 'Senior QA Automation Lead & Test Architecture Specialist.',
    mission: 'Guarantee deterministic release quality across every host realization.',
    scope_boundaries: 'Owns test authoring, execution, and verification gates exclusively.',
    output_contract: 'Deliver a QA Verification Gate Report with suite breakdown and verdict.',
    safety: 'Never run destructive shell commands. Never commit to protected branches. Never log secrets.',
    invariants: [
      'Every report claim cites a test result.',
      'Fail fast on missing preconditions.',
    ],
  };
}

function bindingTableFixture(): BindingTableLike {
  return {
    host: 'claude',
    invariantBindings: [
      { feature: 'Every report claim cites a test result.', binding: 'Report template requires a cited-result line per claim.' },
      { feature: 'Fail fast on missing preconditions.', binding: 'Precondition checklist runs before any execution phase.' },
    ],
    commandBindings: [{ command: 'team_command', native: '/team' }],
    deltas: [],
  };
}

function profileFixture(): CapabilityProfileLike {
  return {
    host: 'claude',
    version: '2.1.271',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Agent', 'AskUserQuestion'],
  };
}
describe('Claude Creation Engine (case e / gate 5)', () => {
  it('createRole is byte-deterministic: 3 runs on the same inputs return strictly equal strings', async () => {
    const { createRole } = await creationApi();
    const core = coreFixture();
    const bindingTable = bindingTableFixture();
    const profile = profileFixture();

    const first = createRole(core, bindingTable, profile);
    const second = createRole(core, bindingTable, profile);
    const third = createRole(core, bindingTable, profile);

    expect(typeof first, 'createRole must return a string').toBe('string');
    expect(first.length, 'created role content must be non-empty').toBeGreaterThan(0);
    expect(second, 'gate 5: run 1 → run 2 must be byte-identical (toBe)').toBe(first);
    expect(third, 'gate 5: run 2 → run 3 must be byte-identical (toBe)').toBe(second);
  });

  it('emits every Contract Floor field verbatim from the core (gate 3 / ADR 0021 decision 6)', async () => {
    const { createRole } = await creationApi();
    const core = coreFixture();
    const output = createRole(core, bindingTableFixture(), profileFixture());

    expect(output, 'identity must be emitted verbatim').toContain(core.identity);
    expect(output, 'scope_boundaries must be emitted verbatim').toContain(core.scope_boundaries);
    expect(output, 'output_contract must be emitted verbatim').toContain(core.output_contract);
    expect(output, 'safety must be emitted verbatim').toContain(core.safety);
  });

  it('emits native `.claude/agents/<role>.md` YAML-frontmatter markdown', async () => {
    const { createRole } = await creationApi();
    const output = createRole(coreFixture(), bindingTableFixture(), profileFixture());
    expect(
      output.startsWith('---'),
      'native .claude/agents/<role>.md content starts with a YAML frontmatter fence',
    ).toBe(true);
    expect(output, 'the frontmatter fence must close before the body').toContain('\n---\n');
  });
});


