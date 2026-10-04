import fs from 'node:fs';
import path from 'node:path';

/**
 * The fifteen committed native Claude roles and the Semantic Core stem each one stands for (the eight agency-only roles stand for the
 * marketing, SEO, QA, compliance and frontend cores, ADR 0036 and ADR 0039). Used by the conformance suites that replaced the created lane (ADR 0037).
 */
export const NATIVE_ROLES: ReadonlyArray<{ role: string; stem: string; tier: 1 | 2; coordinator: boolean }> = [
  { role: 'orchestrator-engineering', stem: 'orchestrator-engineering', tier: 1, coordinator: true },
  { role: 'backend-architect', stem: 'subagent-backend-architect', tier: 1, coordinator: false },
  { role: 'frontend-architect', stem: 'subagent-frontend-architect', tier: 1, coordinator: false },
  { role: 'code-reviewer', stem: 'subagent-code-reviewer', tier: 1, coordinator: false },
  { role: 'repo-index', stem: 'subagent-repo-index', tier: 1, coordinator: false },
  { role: 'orchestrator-digital-agency', stem: 'orchestrator-digital-agency', tier: 2, coordinator: true },
  { role: 'agency-growth-strategist', stem: 'subagent-marketing-growth-strategist', tier: 2, coordinator: false },
  { role: 'agency-creative-designer', stem: 'subagent-marketing-creative-designer', tier: 2, coordinator: false },
  { role: 'agency-conversion-specialist', stem: 'subagent-marketing-conversion-specialist', tier: 2, coordinator: false },
  { role: 'agency-content-strategist', stem: 'subagent-marketing-content-strategist', tier: 2, coordinator: false },
  { role: 'agency-campaign-specialist', stem: 'subagent-marketing-campaign-specialist', tier: 2, coordinator: false },
  { role: 'agency-seo-specialist', stem: 'subagent-seo-specialist', tier: 2, coordinator: false },
  { role: 'agency-qa-automation-lead', stem: 'subagent-qa-automation-lead', tier: 2, coordinator: false },
  { role: 'agency-compliance-grc-specialist', stem: 'subagent-compliance-grc-specialist', tier: 2, coordinator: false },
  { role: 'agency-frontend-architect', stem: 'subagent-frontend-architect', tier: 2, coordinator: false },
];

export const NATIVE_AGENTS_DIR = path.resolve('registry/hosts/claude/agents');

/** The committed native agent file, line endings normalised. */
export const nativeText = (role: string): string => fs.readFileSync(path.join(NATIVE_AGENTS_DIR, `${role}.md`), 'utf8').replace(/\r\n/g, '\n');

export type DeltaDisposition = 'mapped' | 'approximated' | 'degraded' | 'unsupported';

/** A divergence above the floor that a native role declares instead of binding (`registry/hosts/claude/deltas.json`). */
export interface NativeDelta {
  roles: string[];
  feature: string;
  disposition: DeltaDisposition;
  rationale: string;
}

/** The declared deltas of a host's native roles, or an empty list when the host declares none. */
export function loadNativeDeltas(registryDir: string, host: string): NativeDelta[] {
  const file = path.join(registryDir, 'hosts', host, 'deltas.json');
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { deltas?: NativeDelta[] };
  return parsed.deltas ?? [];
}
