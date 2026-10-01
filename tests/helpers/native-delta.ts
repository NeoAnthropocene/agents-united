/**
 * Plan 032 Phase 7 — the maintainers' conformance check for native agents (not user-facing: a native package is the
 * product, so users are never shown a translation report). Each native agent is measured against the Semantic Core
 * contract (ADR 0025 decision 2): its Contract Floor, its tools against the role's capability-class ceiling, the guard
 * it carries, and the specialist model posture. Reads the committed registry, or the text of an installed file when
 * the caller passes one.
 */
import fs from 'node:fs';
import { ClaudeProjector } from '../../src/core/claude-projector.js';
import { compareRealization, loadToolPolicy, resolveGrant } from '../../src/core/host-profile.js';
import { checkFloor } from '../../src/core/native-floor.js';
import type { NativeGuard } from '../../src/core/native-guard.js';
import { inspectNativeAgent, nativeGuardProblem } from '../../src/core/native-guard.js';
import { listNativeRoles, nativeRoleSource } from '../../src/core/native-package.js';
import { loadSemanticCore } from '../../src/core/semantic-core.js';

export interface NativeDeltaRow {
  role: string;
  /** `ok`, or `drift` when the Contract Floor differs from the Semantic Core. */
  floor: 'ok' | 'drift';
  /** Ceiling tools the agent does not hold (a deliberate narrowing, never an issue by itself). */
  toolGains: string[];
  /** Tools the agent holds beyond its capability-class ceiling (an issue). */
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
    const facts = inspectNativeAgent(text);
    const issues: string[] = [];
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
      const ceiling = resolveGrant(policy, core.capabilities ?? [], { subagent: true, background: true });
      ({ gains: toolGains, extras: toolExtras } = compareRealization(ceiling, facts.tools.filter(tool => !tool.startsWith('mcp__'))));
      for (const extra of toolExtras) issues.push(`Holds ${extra} beyond its capability classes.`);
    }

    const guardProblem = nativeGuardProblem(facts);
    if (guardProblem) issues.push(`Guard: this role ${guardProblem}.`);

    const model = typeof facts.meta.model === 'string' ? facts.meta.model : undefined;
    const effort = typeof facts.meta.effort === 'string' ? facts.meta.effort : undefined;
    if (model !== posture.model || effort !== posture.effort) {
      issues.push(`Model posture ${model ?? '(none)'}/${effort ?? '(none)'} differs from the specialist posture ${posture.model}/${posture.effort}.`);
    }

    return { role, floor, toolGains, toolExtras, serverTools: facts.tools.filter(tool => tool.startsWith('mcp__')).sort(), guard: facts.guard, model, effort, issues };
  });
}
