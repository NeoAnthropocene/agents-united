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
    it(`${file}: delegates production and substantial revisions despite prior results`, () => {
      const body = fs.readFileSync(path.resolve(file), 'utf8');
      expect(body).toMatch(/delegate[^\n]*production and nontrivial revisions[^\n]*Motion Designer/i);
      expect(body).toMatch(/sound changes[^\n]*Sound Designer/i);
      expect(body).toMatch(/prior result[^\n]*not[^\n]*solo/i);
    });
  }
});
