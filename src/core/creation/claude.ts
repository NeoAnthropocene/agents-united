/**
 * Plan 021 (ADR 0021) / Step 4 — the Claude Creation Engine (decision 3: deterministic codegen).
 * `createRole` assembles Semantic Core + Binding Table + Capability Profile into native
 * `.claude/agents/<role>.md` content. NEVER LLM-rendered, never prose-translated: pure string
 * assembly only — no clock, no randomness, no I/O — byte-reproducible across runs (gate 5).
 * Contract Floor fields are emitted VERBATIM from the core (decision 6); invariants are
 * emitted bound to their host mechanics; declared deltas appear only where declared.
 */
import type {
  ClaudeCreationBindingTable,
  ClaudeCreationProfile,
  DeclaredDelta,
  SemanticCore,
} from '../types.js';

const FLOOR_SECTIONS: ReadonlyArray<{ field: 'identity' | 'mission' | 'scope_boundaries' | 'output_contract' | 'safety'; heading: string }> = [
  { field: 'identity', heading: '## Identity' },
  { field: 'mission', heading: '## Mission' },
  { field: 'scope_boundaries', heading: '## Scope Boundaries' },
  { field: 'output_contract', heading: '## Output Contract' },
  { field: 'safety', heading: '## Safety' },
];

/** YAML-safe scalar: double-quoted JSON strings are valid YAML scalars. */
const yamlScalar = (value: string): string => JSON.stringify(value);

function bindingFor(invariant: string, table: ClaudeCreationBindingTable): string | undefined {
  const entries = table.invariantBindings ?? [];
  for (const entry of entries) {
    const key = entry.invariant ?? entry.feature;
    if (key === invariant) return entry.binding;
  }
  return undefined;
}

function commandRows(table: ClaudeCreationBindingTable): Array<{ command: string; rendering: string; rationale?: string }> {
  const rows: Array<{ command: string; rendering: string; rationale?: string }> = [];
  for (const entry of table.commandBindings ?? []) {
    const rendering = entry.rendering ?? entry.native ?? '';
    rows.push({ command: entry.command, rendering, rationale: entry.rationale });
  }
  if (rows.length === 0 && table.commandVocabulary) {
    for (const [command, rendering] of Object.entries(table.commandVocabulary)) {
      rows.push({ command, rendering });
    }
  }
  return rows;
}

/**
 * Plan 022 H2/H3 — least privilege: a role gets its Realization Layer allowlist, never the
 * whole profile surface. An allowlist entry outside the profile is a fail-fast error (the
 * profile is the host's tool truth; ADR 0021 decision 8).
 */
function roleTools(table: ClaudeCreationBindingTable, profile: ClaudeCreationProfile): string[] {
  const surface = profile.tools ?? [];
  if (!table.tools) return surface;
  const unknown = table.tools.filter(tool => !surface.includes(tool.replace(/\(.*\)$/, '')));
  if (unknown.length > 0) {
    throw new Error(`Creation error: ${table.roleName ?? 'role'} allowlist names tools outside the capability profile — ${unknown.join(', ')}.`);
  }
  return table.tools;
}

function deltaLines(deltas: DeclaredDelta[] | undefined): string[] {
  if (!deltas || deltas.length === 0) return [];
  const lines = ['', '## Declared Deltas', ''];
  for (const delta of deltas) {
    lines.push(`- **${delta.feature}** — \`${delta.disposition}\`: ${delta.rationale}`);
  }
  return lines;
}

/**
 * Assemble one native Claude role file. The same inputs must return strictly equal (byte-
 * identical) strings on every call — determinism is an acceptance gate (gate 5).
 */
export function createRole(
  core: SemanticCore,
  bindingTable: ClaudeCreationBindingTable,
  profile: ClaudeCreationProfile,
): string {
  const roleName = bindingTable.roleName ?? 'created-role';
  const out: string[] = [];

  out.push('---');
  out.push(`name: ${yamlScalar(roleName)}`);
  out.push(`description: ${yamlScalar(core.identity)}`);
  out.push(`tools: [${roleTools(bindingTable, profile).map(tool => yamlScalar(tool)).join(', ')}]`);
  if (bindingTable.permissionMode) out.push(`permissionMode: ${yamlScalar(bindingTable.permissionMode)}`);
  out.push('---');
  out.push('');
  out.push(`# ${roleName} — Claude realization (created by agents-united)`);
  out.push('');
  out.push(`<!-- created-by: agents-united | engine: claude-creation | capability-profile: ${profile.host}@${profile.version} | deterministic codegen — do not edit -->`);
  out.push('');

  // Contract Floor — emitted verbatim (decision 6): no rewrapping, no paraphrase.
  for (const section of FLOOR_SECTIONS) {
    out.push(section.heading);
    out.push('');
    out.push(core[section.field]);
    out.push('');
  }

  // Invariants — bound to host mechanics, never translated (decision 2).
  out.push('## Operating Invariants (bound mechanics)');
  out.push('');
  core.invariants.forEach((invariant, index) => {
    const binding = bindingFor(invariant, bindingTable);
    out.push(`${index + 1}. ${invariant}`);
    out.push(`   - Bound mechanic: ${binding ?? '(no host binding declared — see Declared Deltas)'}`);
  });
  out.push('');

  // Command bindings (Plan 020): canonical command tokens bound to host renderings.
  const commands = commandRows(bindingTable);
  if (commands.length > 0) {
    out.push('## Command Bindings');
    out.push('');
    for (const row of commands) {
      const rationale = row.rationale ? ` — ${row.rationale}` : '';
      out.push(`- \`${row.command}\` → \`${row.rendering}\`${rationale}`);
    }
    out.push('');
  }

  out.push(...deltaLines(bindingTable.deltas));

  return out.join('\n');
}