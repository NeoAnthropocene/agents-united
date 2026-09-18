import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Plan 015 Step 3 / §0/C1 + §0/D1.
 *
 * Phase-transition gate tables used to hardcode `node dist/cli.js doctor`, a
 * command that cannot resolve in an external project workspace (the CLI is not
 * built there). This suite is the permanent guard: the legacy literal must never
 * return, and every runbook must cite the portable replacement.
 */
const skillsDir = path.resolve(process.cwd(), 'registry', 'skills');

const listSkillFiles = (): string[] => {
  const files: string[] = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
    if (fs.existsSync(skillMd)) files.push(skillMd);
  }
  return files;
};

describe('Skill runbook doctor command (Plan 015 Step 3)', () => {
  const files = listSkillFiles();

  it('scans the full canonical skill catalog', () => {
    // Catalog contract (ADR 0016 cutover): 160 canonical SKILL.md files.
    expect(files.length).toBe(160);
  });

  it('never references the workspace-relative node dist/cli.js doctor', () => {
    const offenders = files
      .filter((f) => fs.readFileSync(f, 'utf8').includes('node dist/cli.js doctor'))
      .map((f) => path.relative(process.cwd(), f));

    expect(offenders).toEqual([]);
  });

  it('cites the portable npx agents-united doctor command in every affected runbook', () => {
    const withDoctor = files.filter((f) => fs.readFileSync(f, 'utf8').includes('npx agents-united doctor'));

    // Measured scope at Plan 015 execution time: 91 of 160 runbooks gate a phase
    // transition on the doctor check.
    expect(withDoctor.length).toBe(91);

    for (const file of withDoctor) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('npx agents-united doctor');
    }
  });

  it('contains no workspace-relative dist/cli.js reference anywhere in the catalog', () => {
    const offenders = files
      .filter((f) => fs.readFileSync(f, 'utf8').includes('dist/cli.js'))
      .map((f) => path.relative(process.cwd(), f));

    expect(offenders).toEqual([]);
  });
});
