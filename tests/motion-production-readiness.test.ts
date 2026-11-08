import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const motionRoles = [
  'registry/agents/subagent-motion-designer.md',
  'registry/hosts/claude/agents/agency-motion-designer.md',
];
const leadRoles = [
  'registry/agents/orchestrator-digital-agency.md',
  'registry/hosts/claude/agents/orchestrator-digital-agency.md',
];

// These are authored-policy guards, not evidence that a host follows the policy live.
describe('motion production readiness policy', () => {
  for (const file of [...motionRoles, ...leadRoles]) {
    const body = fs.readFileSync(path.resolve(file), 'utf8');

    it(`${file}: carries setup authorization into one owned readiness gate`, () => {
      expect(body).toMatch(/one named setup owner/i);
      expect(body).toMatch(/carry forward[^\n]*setup authorization/i);
      expect(body).toMatch(/missing project-local runtime[^\n]*official Skills/i);
      expect(body).toContain('remotion-production/references/setup-and-elements.md');
      expect(body).toMatch(/research or install[^\n]*renderer switch/i);
    });

    it(`${file}: separates host invocation evidence from installation and helper use`, () => {
      expect(body).toMatch(/installed, discovered, invoked and used/i);
      expect(body).toMatch(/actual Skill[^\n]*result/i);
      expect(body).toMatch(/Bash[^\n]*Read[^\n]*not[^\n]*invocation/i);
      expect(body).toMatch(/unverified live/i);
    });

    it(`${file}: assigns Elements selection to the director against the brief`, () => {
      expect(body).toMatch(/director[^\n]*Elements shortlist/i);
      expect(body).toMatch(/choose or skip[^\n]*brief[^\n]*rights[^\n]*dependencies/i);
      expect(body).toMatch(/not[^\n]*user[^\n]*pick every/i);
    });
  }

  for (const file of leadRoles) {
    it(`${file}: accepts stage Skills and revision review only from attributable evidence`, () => {
      const body = fs.readFileSync(path.resolve(file), 'utf8');
      expect(body).toMatch(/before accepting[^\n]*required[^\n]*stage[^\n]*Skill/i);
      expect(body).toMatch(/missing[^\n]*invocation[^\n]*unverified[^\n]*owner/i);
      expect(body).toMatch(/motion-design-direction[^\n]*production/i);
      expect(body).toMatch(/helper[^\n]*does not[^\n]*recursive[^\n]*Skill/i);
      expect(body).toMatch(/producer[^\n]*rerun[^\n]*not[^\n]*independent review/i);
      expect(body).toMatch(/trivial[^\n]*proportional/i);
    });

    it(`${file}: separates guard and rights conclusions from missing evidence`, () => {
      const body = fs.readFileSync(path.resolve(file), 'utf8');
      expect(body).toMatch(/project settings[^\n]*native.role hooks[^\n]*observed enforcement/i);
      expect(body).toMatch(/missing[^\n]*settings[^\n]*not[^\n]*guards[^\n]*absent/i);
      expect(body).toMatch(/source.specific[^\n]*terms[^\n]*actually read/i);
      expect(body).toMatch(/comparison[^\n]*labels[^\n]*not[^\n]*clearance/i);
      expect(body).toMatch(/no source[^\n]*unverified/i);
    });

    it(`${file}: delegates production and substantial revisions despite prior results`, () => {
      const body = fs.readFileSync(path.resolve(file), 'utf8');
      expect(body).toMatch(/delegate[^\n]*production and nontrivial revisions[^\n]*Motion Designer/i);
      expect(body).toMatch(/sound changes[^\n]*Sound Designer/i);
      expect(body).toMatch(/prior result[^\n]*not[^\n]*solo/i);
    });
  }
});

const read = (path: string) => fs.readFileSync(path, 'utf8');
const roles = [
  'registry/agents/orchestrator-digital-agency.md',
  'registry/agents/subagent-motion-designer.md',
  'registry/hosts/claude/agents/orchestrator-digital-agency.md',
  'registry/hosts/claude/agents/agency-motion-designer.md',
];

describe('Remotion readiness evidence policy', () => {
  it('keeps specialist QA attribution and source evidence aligned with the coordinator', () => {
    for (const file of ['registry/agents/subagent-qa-automation-lead.md', 'registry/hosts/claude/agents/agency-qa-automation-lead.md']) {
      const body = read(file);
      expect(body, file).toMatch(/script author[^\n]*execution actor[^\n]*revision/i);
      expect(body, file).toMatch(/producer[^\n]*rerun[^\n]*not[^\n]*independent review/i);
    }
    for (const file of ['registry/agents/subagent-3d-designer.md', 'registry/hosts/claude/agents/agency-3d-designer.md', 'registry/agents/subagent-compliance-grc-specialist.md', 'registry/hosts/claude/agents/agency-compliance-grc-specialist.md']) {
      const body = read(file);
      expect(body, file).toMatch(/source.specific[^\n]*terms[^\n]*actually read/i);
      expect(body, file).toMatch(/no source[^\n]*unverified/i);
    }
    const lead = read('registry/hosts/claude/agents/orchestrator-digital-agency.md');
    expect(lead).not.toContain("tell the user once that the team's shell and file writes are unguarded");
  });

  it('keeps the current handback bounded without discarding detailed evidence or blockers', () => {
    const setup = read('registry/skills/remotion-production/references/setup-and-elements.md');
    expect(setup).toContain('append-only');
    expect(setup).toContain('remotion-setup-evidence.jsonl');
    expect(setup).toMatch(/summary.*(?:60|sixty) lines/i);
    expect(setup).toMatch(/failed.*unverified.*(?:cannot|must not).*ready/i);
    const summary = read('registry/skills/remotion-production/assets/remotion-setup.example.md');
    expect(summary.split('\n').length).toBeLessThanOrEqual(60);
    for (const field of ['Authorization', 'Versions', 'Skills', 'Elements', 'Blockers', 'Evidence', 'Acceptance']) {
      expect(summary).toContain(field);
    }
    expect(summary).toContain('unverified');
    expect(summary).not.toContain('Status: ready');
    const rows = read('registry/skills/remotion-production/assets/setup-evidence.example.jsonl').trim().split('\n')
      .map(line => JSON.parse(line) as Record<string, unknown>);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const field of ['step', 'actor', 'recordedAt', 'status', 'evidence']) expect(row).toHaveProperty(field);
      expect(row.status).toBe('unverified');
    }
  });

  it('requires traceable catalog review, actual handback and safe handling of unexpected writes', () => {
    for (const path of roles) {
      const text = read(path);
      expect(text, path).toMatch(/read (?:the )?actual `media\/specs\/remotion-setup\.md`/i);
      expect(text, path).toMatch(/catalog consultation.*timestamp.*source.*tool receipt/i);
      expect(text, path).toMatch(/none.selected.*valid/i);
      expect(text, path).toMatch(/offline.*research gap/i);
      expect(text, path).toMatch(/unexpected out-of-project writes.*stop setup.*preserve.*report/i);
    }
    const setup = read('registry/skills/remotion-production/references/setup-and-elements.md');
    expect(setup).toMatch(/catalog consultation.*timestamp.*source.*tool receipt/i);
    expect(setup).toMatch(/offline.*research gap/i);
    expect(setup).toMatch(/unexpected out-of-project writes.*stop setup.*preserve.*report/i);
    expect(setup).toMatch(/never.*git checkout.*reset.*delete.*ownership/i);
  });

  it('follows the discovered router without confusing reference reads with invocation', () => {
    const guide = read('registry/skills/remotion-production/references/official-agent-skills.md');
    expect(guide).toMatch(/router.*remotion-create.*reference/i);
    expect(guide).toMatch(/reference use.*not.*Skill invocation/i);
    expect(guide).toMatch(/only.*needed/i);
  });
});
