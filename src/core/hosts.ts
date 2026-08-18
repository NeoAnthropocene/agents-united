import path from 'node:path';
import type { AgentHost } from './types.js';

export type ProjectionProfile =
  | 'antigravity'
  | 'claude-code'
  | 'cursor'
  | 'cline'
  | 'opencode'
  | 'agentsmd';

export interface HostDefinition {
  id: string;
  label: string;
  projectDir: string; // '.claude' | '.cline' | '.opencode' | '.agents' | ...
  globalDirSegments: string[]; // joined under homedir, e.g. ['.claude'] or ['.config','opencode']
  agentsSubdir?: string; // 'agents' | 'agent' | undefined (agentsmd-only hosts)
  detectionMarkers: string[]; // ['.cline', '.clinerules'], ['.claude'], ...
  profile: ProjectionProfile;
  projectionCapable: boolean; // false for 'agents' (it IS the canonical) & 'gemini'
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
  },
};

export const KNOWN_HOST_IDS = Object.keys(HOST_REGISTRY);
export function isKnownHost(id: string): id is keyof typeof HOST_REGISTRY {
  return Object.prototype.hasOwnProperty.call(HOST_REGISTRY, id);
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
}

/**
 * Maps a user selection of assistants/IDEs to an install plan (Option B):
 * - `agents` (main library) and `gemini` (legacy Antigravity) install directly.
 * - Every other assistant (Claude Code, Cursor, Cline, OpenCode, Codex) receives a
 *   translated copy projected from the main library — never an untranslated direct
 *   install, so no runtime ever gets Antigravity-only frontmatter it cannot parse.
 * - When any translated copy is needed, the main library is added automatically.
 */
export function planInstallTargets(selected: string[]): InstallTargetPlan {
  const normalized = Array.from(
    new Set(selected.map(s => (typeof s === 'string' ? s.trim().toLowerCase() : '')).filter(Boolean))
  );
  const known = normalized.filter(isKnownHost);

  const fanout = known.filter(h => HOST_REGISTRY[h].projectionCapable);
  const hosts = known.filter(h => !HOST_REGISTRY[h].projectionCapable) as AgentHost[];

  let addedCanonicalStore = false;
  if (fanout.length > 0 && !hosts.includes('agents')) {
    hosts.unshift('agents');
    addedCanonicalStore = true;
  }
  if (hosts.length === 0 && fanout.length === 0) {
    hosts.push('agents');
  }

  return { hosts, fanout, addedCanonicalStore };
}