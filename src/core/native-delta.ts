/**
 * Plan 032 Phase 7 — the core-based delta table behind `agents doctor --host claude`. Each native agent is measured
 * against the Semantic Core contract (ADR 0025 decision 2: never against another host's keys): its Contract Floor, its
 * tool grant against the capability classes, the guard it carries, and the specialist model posture. Pure and
 * read-only: it reads the committed registry, or the text of an installed file when the caller passes one.
 */
import yaml from 'yaml';
import { GUARD_SCRIPT } from './guard.js';
import { ClaudeProjector } from './claude-projector.js';
import { compareRealization, loadToolPolicy, resolveGrant } from './host-profile.js';
import { checkFloor } from './native-floor.js';
import { listNativeRoles, nativeRoleSource } from './native-package.js';
import { READ_ONLY_GUARD_SCRIPT } from './readonly-guard.js';
import { loadSemanticCore } from './semantic-core.js';
import fs from 'node:fs';

export type NativeGuard = 'read-only' | 'destructive' | 'none';

export interface NativeDeltaRow {
  role: string;
  /** `ok`, or `drift` when the Contract Floor differs from the Semantic Core. */
  floor: 'ok' | 'drift';
  /** Class-allowed tools the agent does not hold (informational: the efficiency report). */
  toolGains: string[];
  /** Tools the agent holds beyond its capability classes (an issue). */
  toolExtras: string[];
  /** Connected-server tools, which classes do not cover. */
  serverTools: string[];
  guard: NativeGuard;
  model?: string;
  effort?: string;
  issues: string[];
}

export interface NativeDeltaOptions {
  /** Text of an installed agent per role, measured instead of the committed registry copy. */
  installed?: ReadonlyMap<string, string>;
}

const WRITERS = ['Bash', 'PowerShell', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

function guardOf(hooks: unknown): NativeGuard {
  const scripts: string[] = [];
  const groups = (hooks as { PreToolUse?: Array<{ hooks?: Array<{ args?: unknown[] }> }> } | undefined)?.PreToolUse;
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const hook of group.hooks ?? []) if (typeof hook.args?.[1] === 'string') scripts.push(hook.args[1]);
  }
  if (scripts.includes(READ_ONLY_GUARD_SCRIPT)) return 'read-only';
  if (scripts.includes(GUARD_SCRIPT)) return 'destructive';
  return 'none';
}

/** One row per committed native agent of `host`, in role order; empty for a host with none. */
export async function nativeDeltaRows(registryDir: string, host: string, options: NativeDeltaOptions = {}): Promise<NativeDeltaRow[]> {
  const roles = listNativeRoles(registryDir, host);
  if (roles.length === 0) return [];
  const cores = await loadSemanticCore(registryDir);
  const policy = loadToolPolicy(registryDir, host);
  const posture = {
    model: ClaudeProjector.CLAUDE_DIALECT.roleModelDefaults?.specialist,
    effort: ClaudeProjector.CLAUDE_DIALECT.roleEffortDefaults?.specialist,
  };

  return roles.map(role => {
    const text = (options.installed?.get(role) ?? fs.readFileSync(nativeRoleSource(registryDir, host, role)!, 'utf8')).replace(/\r\n/g, '\n');
    const issues: string[] = [];
    const meta = (yaml.parse(FRONTMATTER.exec(text)?.[1] ?? '') ?? {}) as Record<string, unknown>;
    const core = cores.get(`subagent-${role}`);

    let floor: NativeDeltaRow['floor'] = 'ok';
    let toolGains: string[] = [];
    let toolExtras: string[] = [];
    if (!core) {
      issues.push(`No Semantic Core registry/core/subagent-${role}.core.md to measure against.`);
    } else {
      const violations = checkFloor(text, core);
      if (violations.length > 0) {
        floor = 'drift';
        issues.push(...violations);
      }
      const declared = String(meta.tools ?? '').split(',').map(tool => tool.trim()).filter(Boolean);
      const grant = resolveGrant(policy, core.capabilities ?? [], { subagent: true, background: true });
      ({ gains: toolGains, extras: toolExtras } = compareRealization(grant, declared.filter(tool => !tool.startsWith('mcp__'))));
      for (const extra of toolExtras) issues.push(`Holds ${extra} beyond its capability classes.`);
    }

    const declared = String(meta.tools ?? '').split(',').map(tool => tool.trim()).filter(Boolean);
    const serverTools = declared.filter(tool => tool.startsWith('mcp__')).sort();
    const holdsWriter = declared.some(tool => WRITERS.includes(tool));
    const guard = guardOf(meta.hooks);
    if (holdsWriter && guard === 'none') issues.push('Holds a shell or file writer without a guard.');
    if (!holdsWriter && guard !== 'read-only') issues.push('A read-only role needs the read-only guard.');

    const model = typeof meta.model === 'string' ? meta.model : undefined;
    const effort = typeof meta.effort === 'string' ? meta.effort : undefined;
    if (model !== posture.model || effort !== posture.effort) {
      issues.push(`Model posture ${model ?? '(none)'}/${effort ?? '(none)'} differs from the specialist posture ${posture.model}/${posture.effort}.`);
    }

    return { role, floor, toolGains, toolExtras, serverTools, guard, model, effort, issues };
  });
}
