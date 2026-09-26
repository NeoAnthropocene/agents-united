import path from 'node:path';
import type { AgentHost } from './types.js';

export type ProjectionProfile =
  | 'antigravity'
  | 'claude-code'
  | 'cursor'
  | 'cline'
  | 'opencode'
  | 'agentsmd';

export type HostStatus = 'supported' | 'under-development';

export interface HostDefinition {
  id: string;
  label: string;
  projectDir: string; // '.claude' | '.cline' | '.opencode' | '.agents' | ...
  globalDirSegments: string[]; // joined under homedir, e.g. ['.claude'] or ['.config','opencode']
  agentsSubdir?: string; // 'agents' | 'agent' | undefined (agentsmd-only hosts)
  detectionMarkers: string[]; // ['.cline', '.clinerules'], ['.claude'], ...
  profile: ProjectionProfile;
  projectionCapable: boolean; // false for 'agents' (it IS the canonical) & 'gemini'
  /** Product availability. 'supported' hosts are selectable in the TUI; 'under-development' hosts are listed but unavailable (display + docs only). */
  status: HostStatus;
}

export const HOST_REGISTRY: Record<string, HostDefinition> = {
  agents: {
    id: 'agents',
    label: 'Google Antigravity & Master Library (📁 .agents/)',
    projectDir: '.agents',
    globalDirSegments: ['.agents'],
    agentsSubdir: 'agents',
    detectionMarkers: ['.agents'],
    profile: 'antigravity',
    projectionCapable: false,
    status: 'supported',
  },
  gemini: {
    id: 'gemini',
    label: 'Antigravity legacy (📁 .gemini/)',
    projectDir: '.gemini',
    globalDirSegments: ['.gemini', 'config'],
    agentsSubdir: 'agents',
    detectionMarkers: ['.gemini'],
    profile: 'antigravity',
    projectionCapable: false,
    status: 'supported',
  },
  claude: {
    id: 'claude',
    label: 'Anthropic Claude Code (📁 .claude/)',
    projectDir: '.claude',
    globalDirSegments: ['.claude'],
    agentsSubdir: 'agents',
    detectionMarkers: ['.claude'],
    profile: 'claude-code',
    projectionCapable: true,
    status: 'supported',
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor IDE (📁 .cursor/)',
    projectDir: '.cursor',
    globalDirSegments: ['.cursor'],
    agentsSubdir: 'agents',
    detectionMarkers: ['.cursor'],
    profile: 'cursor',
    projectionCapable: true,
    status: 'under-development',
  },
  cline: {
    id: 'cline',
    label: 'Cline (📁 .cline/)',
    projectDir: '.cline',
    globalDirSegments: ['.cline'],
    agentsSubdir: 'agents',
    detectionMarkers: ['.cline', '.clinerules'],
    profile: 'cline',
    projectionCapable: true,
    status: 'supported',
  },
  opencode: {
    id: 'opencode',
    label: 'OpenCode (📁 .opencode/)',
    projectDir: '.opencode',
    globalDirSegments: ['.config', 'opencode'],
    agentsSubdir: 'agent',
    detectionMarkers: ['.opencode', 'opencode.json'],
    profile: 'opencode',
    projectionCapable: true,
    status: 'under-development',
  },
  codex: {
    id: 'codex',
    label: 'OpenAI Codex, Copilot, Aider & Zed (📄 ./AGENTS.md)',
    projectDir: '.',
    globalDirSegments: ['.codex'],
    agentsSubdir: undefined,
    detectionMarkers: ['AGENTS.md', '.codex'],
    profile: 'agentsmd',
    projectionCapable: true,
    status: 'under-development',
  },
};

export const KNOWN_HOST_IDS = Object.keys(HOST_REGISTRY);
export function isKnownHost(id: string): id is keyof typeof HOST_REGISTRY {
  return Object.prototype.hasOwnProperty.call(HOST_REGISTRY, id);
}
/** Hosts on the product's supported focus list (Antigravity, Cline, Claude Code). */
export const SUPPORTED_HOST_IDS = Object.values(HOST_REGISTRY)
  .filter((h) => h.status === 'supported')
  .map((h) => h.id);

/** Listed in the TUI as 🚧 Under Development: projections still render, but the host is not on the supported focus list and is unavailable in the wizard. */
export const UNDER_DEVELOPMENT_HOST_IDS = Object.values(HOST_REGISTRY)
  .filter((h) => h.status === 'under-development')
  .map((h) => h.id);

/** Display-only: announced on the TUI but deliberately absent from HOST_REGISTRY — target formats are unverified, so they are never stubbed (Plan 017 R3). */
export const PLANNED_HOSTS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'kimi', label: 'Kimi / Moonshot' },
];

/** TUI availability notice: supported focus list, 🚧 Under Development tags, and planned hosts. */
export function hostAvailabilityNotice(): string {
  const supported = SUPPORTED_HOST_IDS.map((id) => HOST_REGISTRY[id].label).join(' · ');
  const underDev = UNDER_DEVELOPMENT_HOST_IDS.map((id) => HOST_REGISTRY[id].label).join(' · ');
  const planned = PLANNED_HOSTS.map((h) => h.label).join(' · ');
  return [
    `✅ Supported: ${supported}`,
    `🚧 Under Development (unavailable): ${underDev}`,
    `🗓 Planned: ${planned} (projector on the planning list)`,
  ].join('\n');
}

export function resolveHostProjectDir(host: string, cwd: string): string {
  return path.resolve(cwd, HOST_REGISTRY[host].projectDir);
}
export function resolveHostGlobalDir(host: string, home: string): string {
  return path.join(home, ...HOST_REGISTRY[host].globalDirSegments);
}

/**
 * The result of turning a user-facing "which assistants do you use?" selection into
 * an install plan: which directories get direct installs, and which get translated
 * copies fanned out from the main library (.agents/).
 */
export interface InstallTargetPlan {
  /** Direct install targets. Contains 'agents' whenever any translated copy is needed. */
  hosts: AgentHost[];
  /** Projection-capable runtimes that receive translated copies from the main library. */
  fanout: string[];
  /** True when .agents/ was not selected but had to be added as the shared source. */
  addedCanonicalStore: boolean;
  /**
   * Plan 023 B (ADR 0022, D4) — where the machine state lives: `'sidecar'` (the hidden
   * `.claude/.agents-united/` snapshot + lockfile, no `.agents/`) only when Claude is the sole
   * selected host and neither `--canonical-store` nor the plugin lane asks for the store.
   */
  storeShape: 'store' | 'sidecar';
}

/**
 * Maps a user selection of assistants/IDEs to an install plan (Option B):
 * - `agents` (main library) and `gemini` (legacy Antigravity) install directly.
 * - Every other assistant (Claude Code, Cursor, Cline, OpenCode, Codex) receives a
 *   translated copy projected from the main library — never an untranslated direct
 *   install, so no runtime ever gets Antigravity-only frontmatter it cannot parse.
 * - When any translated copy is needed, the main library is added automatically.
 */
export function planInstallTargets(
  selected: string[],
  opts: { canonicalStore?: boolean; pluginLane?: boolean } = {},
): InstallTargetPlan {
  const normalized = Array.from(
    new Set(selected.map(s => (typeof s === 'string' ? s.trim().toLowerCase() : '')).filter(Boolean))
  );
  const known = normalized.filter(isKnownHost);

  const fanout = known.filter(h => HOST_REGISTRY[h].projectionCapable);
  const hosts = known.filter(h => !HOST_REGISTRY[h].projectionCapable) as AgentHost[];

  // ADR 0022 (D4): Claude alone needs no canonical store — its created artifacts are
  // self-contained, and the sidecar keeps the machine state. Every other selection keeps `.agents/`.
  const storeShape: 'store' | 'sidecar' =
    hosts.length === 0 && fanout.length === 1 && fanout[0] === 'claude' && !opts.canonicalStore && !opts.pluginLane
      ? 'sidecar'
      : 'store';

  let addedCanonicalStore = false;
  if (fanout.length > 0 && !hosts.includes('agents')) {
    // The `agents` host is the state-dir host in both shapes; only a store shape adds `.agents/`.
    hosts.unshift('agents');
    addedCanonicalStore = storeShape === 'store';
  }
  if (hosts.length === 0 && fanout.length === 0) {
    hosts.push('agents');
  }

  return { hosts, fanout, addedCanonicalStore, storeShape };
}