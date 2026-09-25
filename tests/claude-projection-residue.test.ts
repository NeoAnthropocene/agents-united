import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ClaudeProjector } from '../src/core/claude-projector.js';

/**
 * Plan 019 / Step 1 — RED suite for the projection-residue purge (owner-approved 2026-09-25).
 *
 * (a) rendering every agent through ClaudeProjector leaves no forbidden residue pattern
 *     (/Nested Subagent Delegation/, /language_server/, /Host Routing/, /Cline & CLI/);
 * (b) every orchestrator carries EXACTLY ONE delegation-policy section
 *     (ADR 0014 Subagent-First XOR ADR 0015 Planner-Orchestrator — the one-policy rule that
 *     keeps Tier semantics unambiguous);
 * (c) every Tier-1 orchestrator carries the Planning Consultation Phase (Step 3);
 * (d) canonical-level: zero agent files contain both `ADR 0014` and `ADR 0015`.
 *
 * RED until Steps 2–3 land the purge and the phase; GREEN is the plan's done-criteria 2/3.
 */
const REGISTRY = path.resolve(process.cwd(), 'registry');
const AGENTS_DIR = path.join(REGISTRY, 'agents');

const FORBIDDEN_RESIDUE: readonly RegExp[] = [
  /Nested Subagent Delegation/,
  /language_server/,
  /Host Routing/,
  /Cline & CLI/,
];

function agentFiles(): string[] {
  return fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md')).sort();
}

function orchestratorFiles(): string[] {
  return agentFiles().filter(f => f.startsWith('orchestrator-'));
}

/** Tier-1 = orchestrators of `tier: domain` bundles (bundles.json). */
function tier1Orchestrators(): string[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(REGISTRY, 'bundles.json'), 'utf8')) as {
    bundles: Record<string, { tier?: string; orchestrator?: string }>;
  };
  const names = new Set<string>();
  for (const def of Object.values(manifest.bundles)) {
    if (def.tier === 'domain' && def.orchestrator) names.add(def.orchestrator);
  }
  return [...names].sort();
}

function renderAgent(file: string): string {
  const raw = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
  const nativeName = file.replace(/^subagent-/, '');
  return ClaudeProjector.renderRole(raw, `agents/${nativeName}`).content;
}

describe('Projection residue purge (Plan 019 done-criteria 2)', () => {
  it('(a) no rendered .claude artifact survives with a forbidden residue pattern', () => {
    const violations: string[] = [];
    for (const file of agentFiles()) {
      const rendered = renderAgent(file);
      for (const pattern of FORBIDDEN_RESIDUE) {
        if (pattern.test(rendered)) violations.push(`${file}: /${pattern.source}/ survives rendering`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('(b) every orchestrator carries exactly one delegation-policy section', () => {
    const violations: string[] = [];
    for (const file of orchestratorFiles()) {
      const body = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
      const policies = body.match(/^## .*(?:Delegation Policy|Planner-Orchestrator Policy).*$/gm) ?? [];
      if (policies.length !== 1) {
        violations.push(`${file}: ${policies.length} delegation-policy sections (${policies.join(' | ')})`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('(c) every Tier-1 orchestrator carries the Planning Consultation Phase', () => {
    const violations: string[] = [];
    for (const file of tier1Orchestrators()) {
      const body = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
      if (!/^## .*Planning Consultation.*$/m.test(body)) {
        violations.push(`${file}: missing the Planning Consultation Phase`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('(d) canonical: zero agent files contain both ADR 0014 and ADR 0015', () => {
    const violations: string[] = [];
    for (const file of agentFiles()) {
      const body = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
      if (body.includes('ADR 0014') && body.includes('ADR 0015')) {
        violations.push(`${file}: carries both ADR 0014 and ADR 0015 (contradictory dual policy)`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});