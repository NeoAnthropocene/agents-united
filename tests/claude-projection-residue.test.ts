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
 * (d) canonical-level: zero agent files contain both `ADR 0014` and `ADR 0015`;
 * (e) Finding F1 (Plan 019 Step 5 manual check, 2026-09-25): every Tier-1 orchestrator's
 *     Planning Consultation Phase carries the UNCONDITIONAL consult gate (MUST consult ≥1
 *     relevant specialist before the delegation map unless the user explicitly waives it),
 *     host-neutral (no tool names — Plan 018), and the gate survives Claude rendering;
 * (f) the Tier-2 coordinator mirrors the gate in its Phase 0/0.5 alignment protocol.
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

/** Finding F1 — the unconditional consult gate (canonical wording, host-neutral). */
const CONSULT_GATE =
  /MUST consult at least one relevant specialist during planning before emitting the delegation map, unless the user explicitly waives it/;
/** Tool / host nouns that must not appear in the gate line (Plan 018 host neutrality). */
const HOST_NOUNS = /\bAgent\(|\bTask\(|SendMessage|TaskCreate|subagent_\w+|ask_question|ask_followup_question|\bCline\b|\bClaude\b|Antigravity/;

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

  it('(e) Finding F1: every Tier-1 orchestrator carries the unconditional, host-neutral consult gate', () => {
    const violations: string[] = [];
    for (const file of tier1Orchestrators()) {
      const body = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
      const gateLine = body.split('\n').find(line => CONSULT_GATE.test(line));
      if (!gateLine) {
        violations.push(`${file}: missing the unconditional consult gate`);
        continue;
      }
      if (HOST_NOUNS.test(gateLine)) violations.push(`${file}: consult gate names a host/tool (${gateLine.match(HOST_NOUNS)?.[0]})`);
      const phase = body.split(/^## /m).find(section => section.includes('Planning Consultation Phase')) ?? '';
      if (!CONSULT_GATE.test(phase)) violations.push(`${file}: consult gate lives outside the Planning Consultation Phase`);
      if (/when the brief is ambiguous[^\n]*MUST consult/.test(phase)) violations.push(`${file}: consult gate is conditional`);
      if (!CONSULT_GATE.test(renderAgent(file))) violations.push(`${file}: consult gate lost in Claude rendering`);
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('(f) Finding F1: the Tier-2 coordinator mirrors the consult gate in Phase 0/0.5', () => {
    const body = fs.readFileSync(path.join(AGENTS_DIR, 'orchestrator-digital-agency.md'), 'utf8');
    const phase05 = body.split(/^### /m).find(section => section.startsWith('Phase 0.5')) ?? '';
    expect(phase05).toMatch(/MUST consult at least one relevant specialist before emitting the Delegation Map, unless the user explicitly waives it/);
  });
});
