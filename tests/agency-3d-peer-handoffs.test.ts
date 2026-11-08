import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
const cases = [
  ['registry/agents/subagent-marketing-creative-designer.md','registry/hosts/claude/agents/agency-creative-designer.md', /3D[\s\S]{0,200}Arda[\s\S]{0,200}(brand|look)/i],
  ['registry/agents/subagent-frontend-architect.md','registry/hosts/claude/agents/agency-frontend-architect.md', /3D[\s\S]{0,600}keyboard[\s\S]{0,300}(fallback|reduced.motion)/i],
  ['registry/agents/subagent-motion-designer.md','registry/hosts/claude/agents/agency-motion-designer.md', /3D[\s\S]{0,600}fingerprint[\s\S]{0,500}(stale|reproof)/i],
  ['registry/agents/subagent-qa-automation-lead.md','registry/hosts/claude/agents/agency-qa-automation-lead.md', /3D[\s\S]{0,600}(validator|budget)[\s\S]{0,500}(unverified|skipped)/i],
  ['registry/agents/subagent-compliance-grc-specialist.md','registry/hosts/claude/agents/agency-compliance-grc-specialist.md', /3D[\s\S]{0,600}(ledger|provenance)[\s\S]{0,500}(clearance|restrictions)/i],
] as const;
describe('conditional 3D peer handoffs', () => { for(const [canonical,native,contract] of cases) it(`${native} and canonical define the scoped handoff`,()=>{for(const p of [canonical,native])expect(fs.readFileSync(p,'utf8'),p).toMatch(contract);}); });

it('keeps private-prototype rights review bounded in the 3D GRC handoff', () => {
  for (const file of [cases[4][0], cases[4][1]]) {
    const section = fs.readFileSync(file, 'utf8').split('When the approved brief includes 3D,')[1];
    expect(section).toMatch(/personal-private[\s\S]{0,250}unverified/i);
    expect(section).toMatch(/no full terms audit or new approval gate/i);
    expect(section).toMatch(/public or commercial[\s\S]{0,120}approval/i);
  }
});


it('routes conditional 3D work through the calling lead across domains', () => {
  for (const [canonical, native] of cases) for (const file of [canonical, native]) {
    const section = fs.readFileSync(file, 'utf8').split('## Conditional 3D handoff')[1];
    expect(section, file).toContain('calling lead (Chris in digital-agency)');
    expect(section, file).not.toMatch(/through Chris(?! in digital-agency)/);
  }
});
