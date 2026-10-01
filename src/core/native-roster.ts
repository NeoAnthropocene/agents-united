/**
 * Plan 032 PR E — the orchestrator's domain map. A native coordinator must know every specialist type of its domain, which
 * bundle provides it (so it can tell the user what to install when a type is missing), and what a native specialist can do
 * on this host (who has a dedicated search tool, who runs commands, who is read-only). The block between two markers in
 * the orchestrator's file is generated from `registry/bundles.json` and the native agent files, so it cannot drift.
 * Pure string work: no I/O, no clock.
 */
import { WRITER_TOOLS } from './native-guard.js';
import type { NativeGuard } from './native-guard.js';

export const ROSTER_START =
  '<!-- agents-united:roster:start (generated from registry/bundles.json and the native agents, regenerate with UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts, do not edit) -->';
export const ROSTER_END = '<!-- agents-united:roster:end -->';

interface BundleLike {
  name?: string;
  domain?: string;
  orchestrator?: string;
  agents?: string[];
}

export interface RosterType {
  /** Type name as `Agent(...)` spells it: the agent file without `.md` and without the `subagent-` prefix. */
  name: string;
  /** Bundles that declare the type, sorted. */
  bundles: string[];
  /** Present when the type has a committed native agent on this host. */
  native?: { description: string; tools: string[]; guard: NativeGuard };
}

const typeName = (agentFile: string): string => agentFile.replace(/\.md$/i, '').replace(/^subagent-/, '');

/** Every specialist type of the coordinator bundle's domain (sorted), with every bundle that declares it. */
export function domainTypes(bundles: Record<string, BundleLike>, coordinatorBundle: string): RosterType[] {
  const coordinator = bundles[coordinatorBundle];
  if (!coordinator) throw new Error(`Roster error: bundle "${coordinatorBundle}" is not in the registry.`);
  const coordinatorFile = coordinator.orchestrator ?? `${coordinatorBundle}.md`;
  const providers = new Map<string, Set<string>>();
  for (const [name, bundle] of Object.entries(bundles)) {
    if (!coordinator.domain || bundle.domain !== coordinator.domain) continue;
    for (const agentFile of bundle.agents ?? []) {
      if (agentFile === coordinatorFile) continue;
      const type = typeName(agentFile);
      providers.set(type, (providers.get(type) ?? new Set()).add(bundle.name ?? name));
    }
  }
  return [...providers.entries()]
    .map(([name, set]) => ({ name, bundles: [...set].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function capabilityNotes(native: NonNullable<RosterType['native']>): string {
  const tools = new Set(native.tools);
  const shell = tools.has('Bash') || tools.has('PowerShell');
  const writes = native.tools.some(tool => WRITER_TOOLS.includes(tool));
  const notes: string[] = [];
  if (!writes) notes.push('read-only');
  else notes.push(shell ? 'edits files and runs commands' : 'edits files');
  if (shell) notes.push('searches through Bash');
  else if (tools.has('Glob') && tools.has('Grep')) notes.push('Glob/Grep search');
  if (tools.has('Monitor')) notes.push('Monitor');
  if (tools.has('EnterWorktree')) notes.push('worktrees');
  if (tools.has('ReportFindings')) notes.push('ReportFindings (foreground)');
  const servers = [...new Set(native.tools.filter(tool => tool.startsWith('mcp__')).map(tool => tool.split('__')[1]))].sort();
  if (servers.length > 0) notes.push(`MCP: ${servers.join(', ')}`);
  return notes.join('; ');
}

const cell = (text: string): string => text.replace(/\s+/g, ' ').replace(/\|/g, '/').trim();

/** The map as a markdown table plus the install hint. */
export function renderRoster(types: RosterType[]): string {
  const rows = types.map(type => {
    const provided = type.bundles.map(bundle => `\`${bundle}\``).join(', ');
    const detail = type.native
      ? `${cell(type.native.description)} — ${capabilityNotes(type.native)}`
      : 'Not yet a native agent: read its definition in `.claude/agents/` before relying on a specific tool.';
    return `| \`${type.name}\` | ${provided} | ${detail} |`;
  });
  return [
    '| Type | Provided by | Role and what it can do on this host |',
    '|---|---|---|',
    ...rows,
    '',
    'Install a missing type by installing a bundle that provides it: `agents add <bundle>` (it keeps the recorded fan-out and native choices).',
  ].join('\n');
}

function locate(text: string): { bodyStart: number; end: number } {
  const start = text.indexOf(ROSTER_START);
  const end = text.indexOf(ROSTER_END);
  if (start < 0 || end < start || text.indexOf(ROSTER_START, start + 1) >= 0 || text.indexOf(ROSTER_END, end + 1) >= 0) {
    throw new Error('Native roster error: the file needs exactly one pair of roster markers, start before end.');
  }
  return { bodyStart: start + ROSTER_START.length, end };
}

const lf = (text: string): string => text.replace(/\r\n/g, '\n');

export function syncRoster(text: string, types: RosterType[]): string {
  const source = lf(text);
  const { bodyStart, end } = locate(source);
  return `${source.slice(0, bodyStart)}\n${renderRoster(types)}\n${source.slice(end)}`;
}

export function checkRoster(text: string, types: RosterType[]): string[] {
  const source = lf(text);
  const { bodyStart, end } = locate(source);
  return source.slice(bodyStart, end) === `\n${renderRoster(types)}\n`
    ? []
    : ['Native roster stale: the block between the roster markers differs from the bundles and native agents (regenerate with UPDATE_NATIVE=1).'];
}
