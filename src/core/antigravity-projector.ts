/**
 * Plan 032 Phase 8 / ADR 0031 — the native install lane of Antigravity. Antigravity's layout is the canonical store the base install already
 * writes, so a committed native file can land on a path the store owns. The lane therefore plans the native agents and rules as projections
 * and reports which canonical assets they replace, so the store skips those assets while the lane is on. The guard hook script travels with any
 * native role (its registration in the user-owned `hooks.json` is a merge done by the installer). Pure planning: no writes.
 */
import fs from 'fs-extra';
import { ANTIGRAVITY_GUARD_SCRIPT, ANTIGRAVITY_HOOK_NAME } from './antigravity-hooks.js';
import { nativeHookSource, nativeRoleSource, nativeRuleSource, renderNativeHook, renderNativeRole, renderNativeRule } from './native-package.js';
import type { PlannedProjectionArtifact, ResolvedAssets } from './types.js';

export interface AntigravityNativePlan {
  /** The native agents and rules to install as projections, with workspace-root-relative paths. */
  artifacts: PlannedProjectionArtifact[];
  /** Canonical agent files (`subagent-code-reviewer.md`, `orchestrator-engineering.md`) that a native agent replaces in the store. */
  coveredAgents: Set<string>;
  /** Canonical rule files (`git-guardrails.md`) that a native rule replaces in the store. */
  coveredRules: Set<string>;
  /** For each covered canonical asset, the root-relative path of its native replacement (to seed owners and to clear the store copy). */
  replacedBy: Map<string, string>;
}

/** `subagent-code-reviewer.md` and `code-reviewer.md` are both the role `code-reviewer`; the coordinator keeps its own name. */
export const roleNameOf = (agentFile: string): string => agentFile.replace(/\.md$/i, '').replace(/^subagent-/, '');

export class AntigravityProjector {
  static async plan(resolved: ResolvedAssets, registryDir: string): Promise<AntigravityNativePlan> {
    const plan: AntigravityNativePlan = { artifacts: [], coveredAgents: new Set(), coveredRules: new Set(), replacedBy: new Map() };

    for (const agentFile of resolved.agents) {
      const role = roleNameOf(agentFile);
      const source = nativeRoleSource(registryDir, 'antigravity', role);
      if (source === undefined) continue;
      const relPath = `.agents/agents/${role}.md`;
      plan.artifacts.push({
        kind: 'role',
        relPath,
        content: renderNativeRole(await fs.readFile(source, 'utf8'), `hosts/antigravity/agents/${role}.md`, 'antigravity'),
        managedMarker: true,
        ownedByBundle: true,
      });
      plan.coveredAgents.add(agentFile);
      plan.replacedBy.set(`agents/${agentFile}`, relPath);
    }

    for (const ruleFile of [...resolved.rules].sort()) {
      const name = ruleFile.replace(/\.md$/i, '');
      const source = nativeRuleSource(registryDir, 'antigravity', name);
      if (source === undefined) continue;
      const relPath = `.agents/rules/${name}.md`;
      plan.artifacts.push({
        kind: 'rule',
        relPath,
        content: renderNativeRule(await fs.readFile(source, 'utf8'), `hosts/antigravity/rules/${name}.md`, 'antigravity'),
        managedMarker: true,
        ownedByBundle: true,
      });
      plan.coveredRules.add(ruleFile);
      plan.replacedBy.set(`rules/${ruleFile}`, relPath);
    }

    // The guard script travels with any native role: it covers every agent that holds a shell or an editor. Registering it in the
    // user-owned `.agents/hooks.json` is a merge, not a projection, and is done by the installer (see `antigravity-hooks.ts`).
    const guardSource = plan.artifacts.some(artifact => artifact.kind === 'role') ? nativeHookSource(registryDir, 'antigravity', ANTIGRAVITY_HOOK_NAME) : undefined;
    if (guardSource !== undefined) {
      plan.artifacts.push({
        kind: 'hook',
        relPath: ANTIGRAVITY_GUARD_SCRIPT,
        content: renderNativeHook(await fs.readFile(guardSource, 'utf8'), `hosts/antigravity/hooks/${ANTIGRAVITY_HOOK_NAME}.js`, 'antigravity'),
        managedMarker: true,
        ownedByBundle: true,
      });
    }

    return plan;
  }
}
