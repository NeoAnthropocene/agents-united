/**
 * Plan 021 (ADR 0021) / Step 3 — the per-host Binding Table, evolving `HOST_DIALECTS.claude`
 * per ADR 0021 decision 9: the Plan 017 codex shape survives as the vocabulary surface and
 * gains the realization layer (capability profile ref, invariant → mechanic bindings, and a
 * Declared-Delta Registry ref). Pure data + validation only — the legacy projection lane is
 * NOT touched here (strangler migration; golden bytes stay identical). Command tokens are
 * per-host command bindings (Plan 020 reframe).
 */
import { ClaudeProjector } from './claude-projector.js';
import type { HostDialectSpec, TranslationLedgerEntry } from './types.js';

/** The codex fields every HostDialectSpec must carry (Plan 017 contract, preserved suite). */
export const REQUIRED_SPEC_FIELDS = [
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

/** Slash-command tokens are ledger citizens alongside tool tokens (Plan 020 note 7). */
export const COMMAND_TOKENS = ['team_command', 'deep_planning_command', 'interview_command'] as const;

/** Overlay vocabularies live in the shared leaf module `overlays.ts` (imported above). */

const claude = ClaudeProjector.CLAUDE_DIALECT;

/**
 * The Claude Binding Table (capability profile `claude@2.1.271`). Vocabulary maps are lifted
 * from the single source `ClaudeProjector.CLAUDE_DIALECT` (Plan 016 decision 16) so no
 * mapping literal is duplicated and the renderer's bytes cannot drift.
 */
export const HOST_DIALECTS: Record<string, HostDialectSpec> = {
  claude: {
    id: 'claude',
    fields: CLAUDE_FIELD_POLICY,
    toolVocabulary: claude.toolVocabulary,
    bodyToolVocabulary: claude.bodyToolVocabulary,
    commandVocabulary: claude.commandVocabulary,
    features: {
      hooks: false,
      delegationAllowlists: true,
      pathScopedRules: false,
      skillsFolders: true,
      pluginLane: true,
      peerMessaging: true,
      subagentHandback: 'v2.1.271+ (auto mode)',
      agentTeams: 'experimental (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)',
    },
    budgets: claude.budgets,
    nameRules: {
      pattern: '^([a-z0-9]+(-[a-z0-9]+)*)$',
      subagentPrefixPolicy: 'strip the canonical subagent- prefix on this host (zero collisions proven)',
    },
    launcher: {
      flags: ['--agent', '--bg', '--teams', '--plugin', '--dry-run'],
      notes: 'agents start --host claude [--bg] [--teams] [--plugin] --agent <role> (Plan 016 Step 6)',
    },
    markerProfile: 'claude',
    capabilityProfile: 'claude@2.1.271',
    invariantBindings: [
      {
        invariant: 'Parallel slices fan out in a single turn; exactly one synthesis point.',
        binding: 'Agent(<specialist>) spawns run concurrently in one turn; the session thread is the single synthesis point; results arrive via SubagentHandback (v2.1.271+, auto mode).',
      },
      {
        invariant: 'Hand your result back, not across.',
        binding: 'A specialist returns one structured handoff to the spawning conversation (SubagentHandback); peers are unreachable by default.',
      },
      {
        invariant: 'Bounded peer exchange only when genuinely required.',
        binding: 'Spawn the peer yourself with Agent() within the 3-layer nesting depth; under Agent Teams (opt-in) peers are reachable by SendMessage.',
      },
      {
        invariant: 'Test-first ordering: author the failing test before implementation.',
        binding: 'Write the test file, run it via Bash to observe the red, then Edit to green — never report a slice complete with a red suite.',
      },
      {
        invariant: 'Resolve ambiguity before any unverified work.',
        binding: 'AskUserQuestion in the main conversation (subagents escalate to the calling orchestrator instead).',
      },
      {
        invariant: 'Read-only roles never mutate the filesystem.',
        binding: 'The allowlist carries Read/Grep/Glob only — no mutating capability is granted on this host.',
      },
      {
        invariant: 'The orchestrator delegates every domain implementation slice.',
        binding: 'Agent(<specialist-type>) with a self-contained prompt is the delegation mechanism; the coordinator never self-implements.',
      },
      {
        invariant: 'Never busy-poll; liveness is event- or schedule-driven.',
        binding: 'CronCreate/CronList for daemon health checks and TaskCreate/TaskUpdate for task state; completion wakes the session (approximated: cron replaces event-driven timers).',
      },
    ],
    deltaRegistry: 'registry/translation-ledger.json',
  },
};

/**
 * Plan 017 contract (preserved suite): validation runs at load and THROWS — an incomplete
 * command-token map or a missing codex field is a fail-fast error, never a silent default.
 */
export function validateHostDialectSpec(spec: unknown): HostDialectSpec {
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('HostDialectSpec validation failed: spec must be an object.');
  }
  const record = spec as Record<string, unknown>;
  for (const field of REQUIRED_SPEC_FIELDS) {
    if (record[field] === undefined || record[field] === null) {
      throw new Error(`HostDialectSpec validation failed: missing required field "${field}".`);
    }
  }
  if (typeof record.id !== 'string' || record.id.trim() === '') {
    throw new Error('HostDialectSpec validation failed: id must be a non-empty string.');
  }
  const commands = record.commandVocabulary as Record<string, unknown> | undefined;
  if (commands === null || typeof commands !== 'object' || Array.isArray(commands)) {
    throw new Error('HostDialectSpec validation failed: commandVocabulary must be an object.');
  }
  for (const token of COMMAND_TOKENS) {
    const rendering = commands[token];
    if (rendering === undefined || rendering === null) {
      throw new Error(`HostDialectSpec validation failed: commandVocabulary is missing "${token}".`);
    }
    if (typeof rendering !== 'string' || rendering.trim() === '') {
      throw new Error(`HostDialectSpec validation failed: command rendering for "${token}" must be non-blank.`);
    }
    if (rendering.trim() === token) {
      throw new Error(`HostDialectSpec validation failed: command rendering for "${token}" must not echo the canonical token.`);
    }
  }
  return spec as HostDialectSpec;
}

/**
 * Plan 017 decision 3 (preserved suite): overlay keys must be the spec's own host;
 * overlay fields must exist in the spec's field map, must not introduce dropped/unsupported
 * fields, and enum-ish values must sit in the host vocabulary. Any violation is a fail-fast
 * throw (catalog-load validation error doctrine). Implementation lives in `overlays.ts`
 * (shared with renderRole's overlay application) and is re-exported here for the contract.
 */
export { validateOverlaysShared as validateProjectionOverlays };

/** Scanned canonical tokens = every vocabulary key plus the command tokens (note 7). */
function scannedTokens(): string[] {
  const spec = HOST_DIALECTS.claude;
  return [
    ...new Set([
      ...Object.keys(spec.toolVocabulary),
      ...Object.keys(spec.bodyToolVocabulary),
      ...Object.keys(spec.commandVocabulary),
    ]),
  ];
}

/** Re-evaluation note 4 — foreign-host section residue that must never survive a projection. */
import { RESIDUE_PATTERNS_BY_HOST } from './residue-patterns.js';
import { CLAUDE_FIELD_POLICY, OVERLAY_FIELD_VOCAB, validateProjectionOverlays as validateOverlaysShared } from './overlays.js';

/**
 * Plan 019 Step 4 — host-keyed forbidden-pattern lists feeding the body lint (acceptance
 * gate 4 extension). The list must grow with every new host section (maintenance note):
 * each host carries the residue patterns that may never survive in ITS projections.
 * (Re-exported from the shared leaf module so the renderer's scrub consumes the same list.)
 */
export { RESIDUE_PATTERNS_BY_HOST };

const CODE_FENCE_SPLIT = /(```[\s\S]*?```)/g;

/**
 * Plan 017 gate 4 (preserved suite) — the body lint's two dimensions: (1) undispositioned
 * canonical tool/command tokens surviving OUTSIDE code fences (a survivor carrying a ledger
 * disposition is legal), and (2) foreign-host section residue anywhere in the body.
 * [] = clean. Judged on the POST-rewrite body.
 */
export function lintProjectedBody(body: string, ledger: TranslationLedgerEntry[] = []): string[] {
  const violations: string[] = [];

  const proseParts = body.split(CODE_FENCE_SPLIT).filter((_, index) => index % 2 === 0);
  const prose = proseParts.join('\n');
  for (const pattern of RESIDUE_PATTERNS_BY_HOST[HOST_DIALECTS.claude.id] ?? []) {
    if (pattern.test(body)) {
      violations.push(`Section residue: projected body matches /${pattern.source}/ — foreign-host prose must never survive.`);
    }
  }
  for (const token of scannedTokens()) {
    if (!prose.includes(token)) continue;
    const dispositioned = ledger.some(entry => entry.feature === token && entry.host === HOST_DIALECTS.claude.id);
    if (!dispositioned) {
      violations.push(`Canonical token "${token}" survived the projected body outside code fences without a ledger disposition.`);
    }
  }

  return violations;
}

// Validate the shipped spec at load — fail-fast doctrine (decision 2 / re-evaluation note 7).
validateHostDialectSpec(HOST_DIALECTS.claude);