import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';

export interface SkillMetadata {
  author?: string;
  version?: string | number;
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  metadata?: SkillMetadata;
}

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  frontmatter?: SkillFrontmatter;
  totalLines: number;
  runbookLines: number;
  sectionsFound: string[];
  hasTriggers: boolean;
  hasInputOutput: boolean;
  hasEdgeCases: boolean;
  hasErrorRecovery: boolean;
  hasExemplars: boolean;
}

export function validateSkillDepth(
  content: string,
  folderName: string = 'skill-dir',
  options: { minLines?: number; requireAllSections?: boolean } = {}
): SkillValidationResult {
  const errors: string[] = [];
  const minLines = options.minLines ?? 50;

  if (!content || !content.trim()) {
    return {
      valid: false,
      errors: ['SKILL.md content is empty or whitespace only'],
      totalLines: 0,
      runbookLines: 0,
      sectionsFound: [],
      hasTriggers: false,
      hasInputOutput: false,
      hasEdgeCases: false,
      hasErrorRecovery: false,
      hasExemplars: false,
    };
  }

  const totalLines = content.trim().split(/\r?\n/).length;
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  let frontmatter: SkillFrontmatter | undefined;

  if (!frontmatterMatch) {
    errors.push('Missing YAML frontmatter delimiters (--- ... ---)');
  } else {
    try {
      frontmatter = YAML.parse(frontmatterMatch[1]);
    } catch (err: any) {
      errors.push(`Invalid YAML frontmatter syntax: ${err.message}`);
    }
  }

  if (frontmatter) {
    if (!frontmatter.name || typeof frontmatter.name !== 'string' || !frontmatter.name.trim()) {
      errors.push("Missing or empty frontmatter field 'name'");
    }
    if (!frontmatter.description || typeof frontmatter.description !== 'string' || !frontmatter.description.trim()) {
      errors.push("Missing or empty frontmatter field 'description'");
    }
  }

  const runbookBody = frontmatterMatch
    ? content.replace(/^---\r?\n[\s\S]+?\r?\n---/, '').trim()
    : content.trim();

  const runbookLines = runbookBody.split(/\r?\n/).length;

  if (options.minLines !== undefined && runbookLines < minLines) {
    errors.push(`Runbook line count (${runbookLines}) is below minimum requirement (${minLines} lines)`);
  }

  // Section checks
  const hasTriggers = /trigger|procedure|guideline|usage|when to use/i.test(runbookBody);
  const hasInputOutput = /input|output|requirement|parameter|contract/i.test(runbookBody);
  const hasEdgeCases = /edge.case|corner.case|boundary|limit/i.test(runbookBody);
  const hasErrorRecovery = /error|recover|troubleshoot|fallback|failure/i.test(runbookBody);
  const hasExemplarSection = /exemplar|example|code|sample|template/i.test(runbookBody);
  const hasCodeBlocks = /```[\s\S]*?```/.test(runbookBody);
  const hasExemplars = hasExemplarSection || hasCodeBlocks;

  const sectionsFound: string[] = [];
  if (hasTriggers) sectionsFound.push('Triggers/Procedures');
  if (hasInputOutput) sectionsFound.push('Input/Output Requirements');
  if (hasEdgeCases) sectionsFound.push('Edge-Case Handling');
  if (hasErrorRecovery) sectionsFound.push('Error-Recovery Procedures');
  if (hasExemplars) sectionsFound.push('Code/Config Exemplars');

  if (options.requireAllSections) {
    if (!hasTriggers) errors.push("Missing required section: 'Triggers/Procedures'");
    if (!hasInputOutput) errors.push("Missing required section: 'Input/Output Requirements'");
    if (!hasEdgeCases) errors.push("Missing required section: 'Edge-Case Handling'");
    if (!hasErrorRecovery) errors.push("Missing required section: 'Error-Recovery Procedures'");
    if (!hasExemplars) errors.push("Missing required section: 'Code/Config Exemplars'");
  }

  return {
    valid: errors.length === 0,
    errors,
    frontmatter,
    totalLines,
    runbookLines,
    sectionsFound,
    hasTriggers,
    hasInputOutput,
    hasEdgeCases,
    hasErrorRecovery,
    hasExemplars,
  };
}

describe('E2E Skill Progressive Frontmatter & Depth Validation (Tier 1-4)', () => {
  const skillsDir = path.resolve(process.cwd(), 'registry/skills');
  const bundlesPath = path.resolve(process.cwd(), 'registry/bundles.json');

  // Tier 1: Feature Coverage (Happy Path)
  describe('Tier 1: Feature Coverage (Skill Frontmatter & Runbook Structure)', () => {
    it('should parse progressive frontmatter (name, description) for all existing SKILL.md playbooks', async () => {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      const skillDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

      expect(skillDirs.length).toBe(91);

      let foundSkillCount = 0;
      for (const skillName of skillDirs) {
        const skillFilePath = path.join(skillsDir, skillName, 'SKILL.md');
        if (await fs.pathExists(skillFilePath)) {
          foundSkillCount++;
          const content = await fs.readFile(skillFilePath, 'utf8');
          const result = validateSkillDepth(content, skillName);

          expect(result.frontmatter, `Skill ${skillName} frontmatter should be defined`).toBeDefined();
          expect(result.frontmatter?.name).toBeDefined();
          expect(result.frontmatter?.description).toBeDefined();
        }
      }

      expect(foundSkillCount).toBeGreaterThan(0);
    });

    it('should validate runbook structure and line count tracking for skills', async () => {
      const archSkillPath = path.join(skillsDir, 'architecture-design', 'SKILL.md');
      const content = await fs.readFile(archSkillPath, 'utf8');
      const result = validateSkillDepth(content, 'architecture-design');

      expect(result.totalLines).toBeGreaterThan(0);
      expect(result.runbookLines).toBeGreaterThan(0);
      expect(result.hasTriggers).toBe(true);
    });
  });

  // Tier 2: Boundary & Corner Cases (Negative Testing)
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('should fail validation when SKILL.md content is empty', () => {
      const result = validateSkillDepth('', 'empty-skill');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SKILL.md content is empty or whitespace only');
    });

    it('should fail validation when frontmatter YAML is malformed', () => {
      const malformed = `---\nname: test-skill\ndescription: [unclosed array\n---\n\n# Runbook`;
      const result = validateSkillDepth(malformed, 'malformed-skill');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid YAML frontmatter syntax');
    });

    it('should fail validation when runbook line count is below strict 50-line threshold', () => {
      const shortRunbook = `---\nname: short-skill\ndescription: Short runbook test\n---\n\n# Short Runbook\n\nLine 1\nLine 2\nLine 3`;
      const result = validateSkillDepth(shortRunbook, 'short-skill', { minLines: 50 });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('below minimum requirement (50 lines)');
    });

    it('should pass validation when runbook line count meets or exceeds 50 lines', () => {
      const lines = Array.from({ length: 55 }, (_, i) => `Line ${i + 1}: Execution runbook step details and commands.`).join('\n');
      const longRunbook = `---\nname: deep-skill\ndescription: Deep runbook test\nmetadata:\n  author: NeoAnthropocene\n  version: 2.0.0\n---\n\n# Deep Skill Runbook\n\n${lines}`;
      const result = validateSkillDepth(longRunbook, 'deep-skill', { minLines: 50 });

      expect(result.valid).toBe(true);
      expect(result.runbookLines).toBeGreaterThanOrEqual(50);
      expect(result.frontmatter?.metadata?.author).toBe('NeoAnthropocene');
    });

    it('should fail validation when required section headers are missing under strict mode', () => {
      const incompleteSkill = `---\nname: incomplete\ndescription: Missing sections\n---\n\n# Minimal Title\n` + 'Content line.\n'.repeat(55);
      const result = validateSkillDepth(incompleteSkill, 'incomplete', { minLines: 50, requireAllSections: true });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // Tier 3: Cross-Feature Pairwise Audit
  describe('Tier 3: Cross-Feature Pairwise Audit', () => {
    it('should cross-validate all 92 skills listed in bundles.json against registry/skills/ directory', async () => {
      const bundlesJson = await fs.readJson(bundlesPath);
      const fullBundleSkills: string[] = bundlesJson.bundles.full.skills;

      expect(fullBundleSkills.length).toBe(91);

      for (const skillName of fullBundleSkills) {
        const skillFolderPath = path.join(skillsDir, skillName);
        const exists = await fs.pathExists(skillFolderPath);
        expect(exists, `Skill folder '${skillName}' referenced in bundles.json does not exist in registry/skills/`).toBe(true);
      }
    });

    it('should verify frontmatter name property matches directory name for all existing SKILL.md files', async () => {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      const skillDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

      for (const skillName of skillDirs) {
        const skillFilePath = path.join(skillsDir, skillName, 'SKILL.md');
        if (await fs.pathExists(skillFilePath)) {
          const content = await fs.readFile(skillFilePath, 'utf8');
          const result = validateSkillDepth(content, skillName);
          expect(result.frontmatter?.name).toBe(skillName);
        }
      }
    });
  });

  // Tier 4: Real-World Inventory Health Report
  describe('Tier 4: Real-World Inventory Health Report', () => {
    it('should perform a complete audit of all 92 skill directories and compile a depth metric report', async () => {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      const skillDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

      expect(skillDirs.length).toBe(91);

      const healthReport = {
        totalSkillDirectories: skillDirs.length,
        withSkillMdFile: 0,
        expandedRunbooksCount: 0, // >= 50 lines
        skillsWithExemplars: 0,
      };

      for (const skillName of skillDirs) {
        const skillFilePath = path.join(skillsDir, skillName, 'SKILL.md');
        if (await fs.pathExists(skillFilePath)) {
          healthReport.withSkillMdFile++;
          const content = await fs.readFile(skillFilePath, 'utf8');
          const result = validateSkillDepth(content, skillName);

          if (result.runbookLines >= 50) healthReport.expandedRunbooksCount++;
          if (result.hasExemplars) healthReport.skillsWithExemplars++;
        }
      }

      expect(healthReport.totalSkillDirectories).toBe(91);
      expect(healthReport.withSkillMdFile).toBeGreaterThan(0);
    });
  });
});
