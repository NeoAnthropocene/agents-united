import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string): string => fs.readFileSync(file, 'utf8');
const workflow = 'registry/skills/workflow-agency-motion-production';
const leads = ['registry/agents/orchestrator-digital-agency.md', 'registry/hosts/claude/agents/orchestrator-digital-agency.md'];
const roles = ['registry/agents/subagent-motion-designer.md', 'registry/hosts/claude/agents/agency-motion-designer.md', 'registry/agents/subagent-sound-designer.md', 'registry/hosts/claude/agents/agency-sound-designer.md'];

// Authored-policy guards; these do not establish live Host behavior.
describe('media treatment and approval policy', () => {
  for (const file of [`${workflow}/SKILL.md`, ...leads]) it(`${file} offers a complete treatment and preserves decisions`, () => {
    const body = read(file);
    expect(body).toMatch(/proactively[^\n]*voiceover[^\n]*SFX[^\n]*music[^\n]*captions[^\n]*Elements/i);
    expect(body).toMatch(/include\s*\/\s*defer\s*\/\s*decline/i);
    expect(body).toMatch(/already accepted choices/i);
    expect(body).toMatch(/one consolidated[^\n]*user acceptance/i);
    expect(body).toMatch(/Native[^\n]*no automatic Elements/i);
  });
  for (const file of [`${workflow}/references/production-gates.md`, ...leads, ...roles]) it(`${file} separates evidence and records handoffs`, () => {
    const body = read(file);
    expect(body).toMatch(/gate, status, approver, source\/reference, revision and open items/i);
    expect(body).toMatch(/route or tone[^\n]*not[^\n]*audio map[^\n]*listening/i);
    expect(body).toMatch(/scoped waiver[^\n]*not human review/i);
  });
  it('provides reviewable treatment and handoff examples', () => {
    expect(read(`${workflow}/assets/treatment-plan.example.md`)).toMatch(/voiceover[\s\S]*SFX[\s\S]*music[\s\S]*captions[\s\S]*Elements/i);
    expect(read(`${workflow}/assets/approval-handoff.example.md`)).toMatch(/gate:[\s\S]*status:[\s\S]*approver:[\s\S]*source\/reference:[\s\S]*revision:[\s\S]*open items:/i);
  });
});
