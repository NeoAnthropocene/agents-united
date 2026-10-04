import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_AGENTS_DIR } from './helpers/native-roles.ts';

/**
 * Plan 035 S6: the orchestration skills of the lead (Chris). The six `workflow-agency-*` skills are
 * rewritten as playbooks the lead loads (before this, no native role loaded them), and one new skill,
 * `agency-brief-and-premises`, is written in our own words from the ideas of obra/superpowers
 * `brainstorming` and garrytan/gstack `office-hours` (decision D6, ADR 0040). The shared contract is
 * pinned by `skill-rewrite-contract.test.ts`.
 */

const ROOT = process.cwd();
const SKILLS = path.resolve('registry/skills');
const skill = (name: string): string => fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
const lead = (): string => fs.readFileSync(path.join(NATIVE_AGENTS_DIR, 'orchestrator-digital-agency.md'), 'utf8');
const bundles = (): Record<string, { skills: string[] }> => JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')).bundles;

const PLAYBOOKS = [
  'workflow-agency-full-campaign',
  'workflow-agency-ad-creative-sprint',
  'workflow-agency-seo-content-engine',
  'workflow-agency-cro-funnel-teardown',
  'workflow-agency-brand-design-system',
  'workflow-agency-client-pitch-proposal',
] as const;

describe('S6: the six agency workflow skills are playbooks the lead loads', () => {
  for (const name of PLAYBOOKS) {
    it(`${name} is rewritten (3.0.0), loaded by the lead, and no longer a code-repository runbook`, () => {
      const s = skill(name);
      expect(s).toMatch(/^\s+version:\s*['"]?3\.0\.0/m);
      expect(lead()).toContain(`\`${name}\``);
      expect(s).not.toMatch(/npx agents-united doctor|npm run|subagent_\*|Team Manifest/);
      // the three conventions of the workflow skills stay: a flowchart, phase gate rows, a rollback protocol
      expect(s).toContain('```mermaid');
      expect((s.match(/^\| Phase/gm) ?? []).length).toBeGreaterThanOrEqual(3);
      expect(s).toMatch(/rollback/i);
      // what makes them agency playbooks: named owners, the plan gate, and the two verification gates
      expect(s).toMatch(/Delegation map/i);
      expect(s).toMatch(/Emre/);
      expect(s).toMatch(/Defne/);
    });
  }
});

describe('S6: the new planning skill agency-brief-and-premises', () => {
  const NAME = 'agency-brief-and-premises';

  it('exists, is in the digital-agency bundle and in full, and the lead loads it before any grill skill', () => {
    expect(fs.existsSync(path.join(SKILLS, NAME, 'SKILL.md'))).toBe(true);
    expect(bundles()['digital-agency'].skills).toContain(NAME);
    expect(bundles().full.skills).toContain(NAME);
    const text = lead();
    expect(text).toContain(`\`${NAME}\``);
    expect(text.indexOf(`\`${NAME}\``)).toBeLessThan(text.indexOf('`/grill-me`'));
  });

  it('is original work: version 3.0.0, no metadata.source, and carries the planning substance', () => {
    const s = skill(NAME);
    expect(s).toMatch(/^\s+version:\s*['"]?3\.0\.0/m);
    expect(s).not.toMatch(/^\s+source:/m);
    expect(s).toMatch(/classif/i);
    expect(s).toMatch(/say (it|the classification) (out loud|aloud)|aloud|out loud/i);
    expect(s).toMatch(/what the client said/i);
    expect(s).toMatch(/assum/i);
    expect(s).toMatch(/premise/i);
    expect(s).toMatch(/agree or disagree/i);
    expect(s).toMatch(/one question/i);
    expect(s).toMatch(/minimal/i);
    expect(s).toMatch(/recommend/i);
    expect(s).toMatch(/hard gate/i);
    expect(s).toMatch(/next action/i);
    expect(s).toMatch(/Delegation map/i);
  });

  it('never writes a deliverable: the skill states the gate and leaves production to the specialists', () => {
    const s = skill(NAME);
    expect(s).toMatch(/no deliverable|before the user accepts|until the user accepts/i);
  });

  it('is credited in the README as inspiration, naming both upstream repositories', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const credits = readme.slice(readme.indexOf('Credits & Acknowledgments', readme.indexOf('## 🤝')));
    expect(credits).toContain('obra/superpowers');
    expect(credits).toContain('garrytan/gstack');
    expect(credits).toContain('affaan-m/ECC');
    expect(credits).toMatch(/inspiration|ideas/i);
  });

  it('the skill counts stated in README, PROJECT.md and CONTEXT.md follow the catalog', () => {
    const dirs = fs.readdirSync(SKILLS, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    for (const f of ['README.md', 'PROJECT.md']) {
      const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
      expect(text, `${f} states the skill count`).toMatch(new RegExp(`\\b${dirs} (modular )?skills`));
    }
  });
});
