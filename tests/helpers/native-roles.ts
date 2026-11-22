import fs from 'node:fs';
import path from 'node:path';

/**
 * The committed native Claude roles and the Semantic Core stem each one stands for (the agency-only roles stand for the
 * marketing, SEO, QA, compliance and frontend cores, ADR 0036 and ADR 0039). Used by the conformance suites that replaced the created lane (ADR 0037).
 */
export const NATIVE_ROLES: ReadonlyArray<{ role: string; stem: string; tier: 1 | 2; coordinator: boolean }> = [
  { role: 'orchestrator-agent-factory', stem: 'orchestrator-agent-factory', tier: 1, coordinator: true },
  { role: 'factory-evaluator', stem: 'subagent-factory-evaluator', tier: 1, coordinator: false },
  { role: 'factory-realizer', stem: 'subagent-realize-for-host', tier: 1, coordinator: false },
  { role: 'factory-sync', stem: 'subagent-host-update-sync', tier: 1, coordinator: false },
  { role: 'orchestrator-engineering', stem: 'orchestrator-engineering', tier: 1, coordinator: true },
  { role: 'orchestrator-system-architecture', stem: 'orchestrator-system-architecture', tier: 1, coordinator: true },
  { role: 'orchestrator-research', stem: 'orchestrator-research', tier: 1, coordinator: true },
  { role: 'orchestrator-business', stem: 'orchestrator-business', tier: 1, coordinator: true },
  { role: 'backend-architect', stem: 'subagent-backend-architect', tier: 1, coordinator: false },
  { role: 'distributed-systems-architect', stem: 'subagent-distributed-systems-architect', tier: 1, coordinator: false },
  { role: 'data-engineer', stem: 'subagent-data-engineer', tier: 1, coordinator: false },
  { role: 'accessibility-lead', stem: 'subagent-accessibility-lead', tier: 1, coordinator: false },
  { role: 'frontend-architect', stem: 'subagent-frontend-architect', tier: 1, coordinator: false },
  { role: 'devops-engineer', stem: 'subagent-devops-engineer', tier: 1, coordinator: false },
  { role: 'system-architect', stem: 'subagent-system-architect', tier: 1, coordinator: false },
  { role: 'business-panel-experts', stem: 'subagent-business-panel-experts', tier: 1, coordinator: false },
  { role: 'sysops-sre-lead', stem: 'subagent-sysops-sre-lead', tier: 1, coordinator: false },
  { role: 'cloud-infrastructure-architect', stem: 'subagent-cloud-infrastructure-architect', tier: 1, coordinator: false },
  { role: 'database-administrator', stem: 'subagent-database-administrator', tier: 1, coordinator: false },
  { role: 'finops-cost-engineer', stem: 'subagent-finops-cost-engineer', tier: 1, coordinator: false },
  { role: 'financial-analyst', stem: 'subagent-financial-analyst', tier: 1, coordinator: false },
  { role: 'market-intelligence-analyst', stem: 'subagent-market-intelligence-analyst', tier: 1, coordinator: false },
  { role: 'legal-contract-analyst', stem: 'subagent-legal-contract-analyst', tier: 1, coordinator: false },
  { role: 'operations-strategist', stem: 'subagent-operations-strategist', tier: 1, coordinator: false },
  { role: 'e2e-tester', stem: 'subagent-e2e-tester', tier: 1, coordinator: false },
  { role: 'code-reviewer', stem: 'subagent-code-reviewer', tier: 1, coordinator: false },
  { role: 'qa-automation-lead', stem: 'subagent-qa-automation-lead', tier: 1, coordinator: false },
  { role: 'ios-architect', stem: 'subagent-ios-architect', tier: 1, coordinator: false },
  { role: 'android-architect', stem: 'subagent-android-architect', tier: 1, coordinator: false },
  { role: 'cross-platform-specialist', stem: 'subagent-cross-platform-specialist', tier: 1, coordinator: false },
  { role: 'repo-index', stem: 'subagent-repo-index', tier: 1, coordinator: false },
  { role: 'security-engineer', stem: 'subagent-security-engineer', tier: 1, coordinator: false },
  { role: 'cloud-security-architect', stem: 'subagent-cloud-security-architect', tier: 1, coordinator: false },
  { role: 'appsec-penetration-tester', stem: 'subagent-appsec-penetration-tester', tier: 1, coordinator: false },
  { role: 'compliance-grc-specialist', stem: 'subagent-compliance-grc-specialist', tier: 1, coordinator: false },
  { role: 'orchestrator-security', stem: 'orchestrator-security', tier: 1, coordinator: true },
  { role: 'design-ops-lead', stem: 'subagent-design-ops-lead', tier: 1, coordinator: false },
  { role: 'design-researcher', stem: 'subagent-design-researcher', tier: 1, coordinator: false },
  { role: 'design-systems-architect', stem: 'subagent-design-systems-architect', tier: 1, coordinator: false },
  { role: 'designer-toolkit-expert', stem: 'subagent-designer-toolkit-expert', tier: 1, coordinator: false },
  { role: 'orchestrator-design', stem: 'orchestrator-design', tier: 1, coordinator: true },
  { role: 'interaction-designer', stem: 'subagent-interaction-designer', tier: 1, coordinator: false },
  { role: 'prototype-tester', stem: 'subagent-prototype-tester', tier: 1, coordinator: false },
  { role: 'ui-designer', stem: 'subagent-ui-designer', tier: 1, coordinator: false },
  { role: 'ux-strategist', stem: 'subagent-ux-strategist', tier: 1, coordinator: false },
  { role: 'orchestrator-marketing', stem: 'orchestrator-marketing', tier: 1, coordinator: true },
  { role: 'lifecycle-email-specialist', stem: 'subagent-lifecycle-email-specialist', tier: 1, coordinator: false },
  { role: 'marketing-campaign-specialist', stem: 'subagent-marketing-campaign-specialist', tier: 1, coordinator: false },
  { role: 'marketing-content-strategist', stem: 'subagent-marketing-content-strategist', tier: 1, coordinator: false },
  { role: 'marketing-conversion-specialist', stem: 'subagent-marketing-conversion-specialist', tier: 1, coordinator: false },
  { role: 'marketing-creative-designer', stem: 'subagent-marketing-creative-designer', tier: 1, coordinator: false },
  { role: 'marketing-growth-strategist', stem: 'subagent-marketing-growth-strategist', tier: 1, coordinator: false },
  { role: 'deep-research', stem: 'subagent-deep-research', tier: 1, coordinator: false },
  { role: 'socratic-mentor', stem: 'subagent-socratic-mentor', tier: 1, coordinator: false },
  { role: 'paid-acquisition-specialist', stem: 'subagent-paid-acquisition-specialist', tier: 1, coordinator: false },
  { role: 'plg-strategist', stem: 'subagent-plg-strategist', tier: 1, coordinator: false },
  { role: 'seo-specialist', stem: 'subagent-seo-specialist', tier: 1, coordinator: false },
  { role: 'statistical-analyst', stem: 'subagent-statistical-analyst', tier: 1, coordinator: false },
  { role: 'literature-patent-analyst', stem: 'subagent-literature-patent-analyst', tier: 1, coordinator: false },
  { role: 'ml-platform-engineer', stem: 'subagent-ml-platform-engineer', tier: 1, coordinator: false },
  { role: 'ai-model-architect', stem: 'subagent-ai-model-architect', tier: 1, coordinator: false },
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
  { role: 'agency-3d-designer', stem: 'subagent-3d-designer', tier: 2, coordinator: false },
  { role: 'agency-motion-designer', stem: 'subagent-motion-designer', tier: 2, coordinator: false },
  { role: 'agency-sound-designer', stem: 'subagent-sound-designer', tier: 2, coordinator: false },
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
