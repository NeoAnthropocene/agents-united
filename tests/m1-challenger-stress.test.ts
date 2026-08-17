import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';

// Helper validator for Skills
function validateSkill(content: string, expectedName: string) {
  const errors: string[] = [];
  const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!fmMatch) return { valid: false, errors: ['Missing frontmatter'] };

  let fm: any;
  try {
    fm = YAML.parse(fmMatch[1]);
  } catch (err: any) {
    return { valid: false, errors: ['Malformed YAML: ' + err.message] };
  }

  if (fm.name !== expectedName) errors.push(`Name mismatch: ${fm.name} !== ${expectedName}`);
  if (!fm.description || typeof fm.description !== 'string') errors.push('Missing description');
  if (!fm.metadata || typeof fm.metadata !== 'object') errors.push('Missing metadata');
  if (fm.metadata?.author !== 'agents-united') errors.push('Metadata author mismatch: ' + fm.metadata?.author);
  if (fm.metadata?.version !== '2.0.0') errors.push('Metadata version mismatch: ' + fm.metadata?.version);

  const body = content.slice(fmMatch[0].length).trim();
  const lines = content.split(/\r?\n/).length;
  if (lines < 50) errors.push(`Line count too low: ${lines} < 50`);

  const hasTriggers = /trigger|procedure|guideline|usage|when to use/i.test(body);
  const hasInputOutput = /input|output|requirement|parameter|contract/i.test(body);
  const hasEdgeCases = /edge.case|corner.case|boundary|limit/i.test(body);
  const hasErrorRecovery = /error|recover|troubleshoot|fallback|failure/i.test(body);
  const hasExemplars = /```[\s\S]*?```/.test(body);

  if (!hasTriggers) errors.push('Missing triggers/procedures section');
  if (!hasInputOutput) errors.push('Missing input/output requirements section');
  if (!hasEdgeCases) errors.push('Missing edge cases section');
  if (!hasErrorRecovery) errors.push('Missing error recovery section');
  if (!hasExemplars) errors.push('Missing code exemplars');

  return { valid: errors.length === 0, errors, fm, lines, body };
}

// Helper validator for Workflows
function validateWorkflow(content: string, filename: string) {
  const errors: string[] = [];
  const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!fmMatch) return { valid: false, errors: ['Missing frontmatter'] };

  let fm: any;
  try {
    fm = YAML.parse(fmMatch[1]);
  } catch (err: any) {
    return { valid: false, errors: ['Malformed YAML: ' + err.message] };
  }

  if (!fm.name) errors.push('Missing frontmatter name');
  if (!fm.description) errors.push('Missing frontmatter description');
  if (!fm.bundle) errors.push('Missing frontmatter bundle');
  if (!fm.estimatedDuration) errors.push('Missing frontmatter estimatedDuration');

  const body = content.slice(fmMatch[0].length).trim();
  const lines = content.split(/\r?\n/).length;
  if (lines < 50) errors.push(`Line count too low: ${lines} < 50`);

  const hasFlowchart = /```mermaid[\s\S]*?graph TD[\s\S]*?```/i.test(body);
  const hasPhase1 = /##\s+Phase\s+1/i.test(body);
  const hasPhase2 = /##\s+Phase\s+2/i.test(body);
  const hasPhase3 = /##\s+Phase\s+3/i.test(body);
  const hasTransition = /transition|criteria|gate/i.test(body);
  const hasRollback = /rollback|revert|recovery/i.test(body);

  if (!hasFlowchart) errors.push('Missing valid Mermaid graph TD flowchart');
  if (!hasPhase1) errors.push('Missing Phase 1');
  if (!hasPhase2) errors.push('Missing Phase 2');
  if (!hasPhase3) errors.push('Missing Phase 3');
  if (!hasTransition) errors.push('Missing phase transition criteria');
  if (!hasRollback) errors.push('Missing rollback protocols');

  return { valid: errors.length === 0, errors, fm, lines, body };
}

describe('Milestone 1 Adversarial Empirical Stress Test Suite (Isolated)', () => {
  const rootDir = process.cwd();
  const agentsDir = path.join(rootDir, 'registry/agents');
  const skillsDir = path.join(rootDir, 'registry/skills');
  const workflowsDir = path.join(rootDir, 'registry/workflows');

  const m1Agent = 'subagent-marketing-creative-designer.md';
  const m1Skills = [
    'marketing-creative-design',
    'programmatic-seo',
    'schema-markup-strategy',
    'paid-acquisition-ppc',
    'ad-attribution-modeling',
    'onboarding-cro',
    'viral-referral-loops',
    'email-drip-sequences',
    'churn-prevention-playbook',
  ];
  const m1Workflows = [
    'workflow-seo-content-pipeline.md',
    'workflow-paid-acquisition-campaign.md',
    'workflow-onboarding-funnel-cro.md',
    'workflow-email-drip-sequence.md',
  ];

  describe('1. Creative Designer Agent Empirical Stress Tests', () => {
    const agentPath = path.join(agentsDir, m1Agent);

    it('should exist and parse valid YAML frontmatter without errors', async () => {
      const exists = await fs.pathExists(agentPath);
      expect(exists).toBe(true);

      const content = await fs.readFile(agentPath, 'utf8');
      const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      expect(match).not.toBeNull();

      const fm = YAML.parse(match![1]);
      expect(fm.name).toBe('subagent-marketing-creative-designer');
      expect(fm.version).toBe('2.0.0');
      expect(fm.type).toBe('subagent');
      expect(fm.model).toBe('inherit');
      expect(fm.permissionMode).toBe('acceptEdits');
      expect(fm.commandExecutionPolicy).toBe('auto');
      expect(fm.mainAgent).toBe(false);
      expect(fm.subagent).toBe(true);
      expect(Array.isArray(fm.tools)).toBe(true);
      expect(fm.tools).toEqual(
        expect.arrayContaining(['generate_image', 'view_file', 'write_to_file', 'replace_file_content', 'search_web'])
      );
    });

    it('should contain all 4 lifecycle interceptor hooks with non-empty logs', async () => {
      const content = await fs.readFile(agentPath, 'utf8');
      const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      const fm = YAML.parse(match![1]);

      expect(fm.hooks).toBeDefined();
      expect(fm.hooks.PreInvocation).toBeDefined();
      expect(fm.hooks.PostInvocation).toBeDefined();
      expect(fm.hooks.PreToolUse).toBeDefined();
      expect(fm.hooks.PostToolUse).toBeDefined();

      expect(Array.isArray(fm.hooks.PreInvocation)).toBe(true);
      expect(fm.hooks.PreInvocation[0].log).toBeDefined();
      expect(Array.isArray(fm.hooks.PostInvocation)).toBe(true);
      expect(fm.hooks.PostInvocation[0].log).toBeDefined();
    });

    it('should contain rich system prompt with >= 40 lines and all mandatory sections', async () => {
      const content = await fs.readFile(agentPath, 'utf8');
      const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      const body = content.slice(match![0].length).trim();
      const bodyLines = body.split('\n');

      expect(bodyLines.length).toBeGreaterThanOrEqual(40);
      expect(body).toMatch(/## Role Definition/i);
      expect(body).toMatch(/## Primary Directives/i);
      expect(body).toMatch(/## Step-by-Step Creative Design Protocol/i);
      expect(body).toMatch(/## Tool Selection & Usage Rules/i);
      expect(body).toMatch(/## Delegation & Subagent Collaboration Matrix/i);
      expect(body).toMatch(/## Safety Guardrails & Policy Boundaries/i);
      expect(body).toMatch(/## Output Format Requirements/i);
      expect(body).toMatch(/## Explicit Lifecycle Hooks/i);
    });

    it('should contain safety policies preventing deceptive ads, contrast violations, and policy boundaries', async () => {
      const content = await fs.readFile(agentPath, 'utf8');
      expect(content).toMatch(/deceptive/i);
      expect(content).toMatch(/contrast/i);
      expect(content).toMatch(/WCAG AA/i);
      expect(content).toMatch(/safe zone/i);
    });
  });

  describe('2. Marketing Skills Depth & Schema Tests', () => {
    it.each(m1Skills)('skill %s should validate depth and mandatory sections', async (skillName) => {
      const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
      const exists = await fs.pathExists(skillFile);
      expect(exists, `SKILL.md must exist in ${skillName}`).toBe(true);

      const content = await fs.readFile(skillFile, 'utf8');
      const result = validateSkill(content, skillName);

      expect(result.valid, `Errors in ${skillName}: ${result.errors.join(', ')}`).toBe(true);
      expect(result.lines).toBeGreaterThanOrEqual(50);
    });

    it.each(m1Skills)('skill %s should contain structured code exemplars with valid language tags', async (skillName) => {
      const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
      const content = await fs.readFile(skillFile, 'utf8');
      const codeBlocks = content.match(/```[a-z0-9_-]+\n[\s\S]*?```/gi);
      expect(codeBlocks).not.toBeNull();
      expect(codeBlocks!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Marketing Workflows Phase Gates & Schema Tests', () => {
    it.each(m1Workflows)('workflow %s should validate deterministic gates and flowchart', async (wfFile) => {
      const wfPath = path.join(workflowsDir, wfFile);
      const exists = await fs.pathExists(wfPath);
      expect(exists, `Workflow file must exist: ${wfFile}`).toBe(true);

      const content = await fs.readFile(wfPath, 'utf8');
      const result = validateWorkflow(content, wfFile);

      expect(result.valid, `Errors in ${wfFile}: ${result.errors.join(', ')}`).toBe(true);
      expect(result.lines).toBeGreaterThanOrEqual(50);
    });

    it.each(m1Workflows)('workflow %s should contain valid Mermaid flowchart syntax', async (wfFile) => {
      const wfPath = path.join(workflowsDir, wfFile);
      const content = await fs.readFile(wfPath, 'utf8');
      const mermaidMatch = content.match(/```mermaid\n([\s\S]+?)\n```/);
      expect(mermaidMatch, `Mermaid block missing in ${wfFile}`).not.toBeNull();

      const mermaidCode = mermaidMatch![1];
      expect(mermaidCode).toContain('graph TD');
      expect(mermaidCode).toMatch(/-->/);
    });
  });

  describe('4. Adversarial & Negative Boundary Tests', () => {
    it('should confirm all 9 skills have zero placeholder tokens (TODO, TBD, FIXME, lorem ipsum)', async () => {
      for (const skillName of m1Skills) {
        const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
        const content = await fs.readFile(skillFile, 'utf8');
        expect(content).not.toMatch(/\bTODO\b/i);
        expect(content).not.toMatch(/\bTBD\b/i);
        expect(content).not.toMatch(/\bFIXME\b/i);
        expect(content).not.toMatch(/lorem ipsum/i);
      }
    });

    it('should confirm all 4 workflows have zero placeholder tokens (TODO, TBD, FIXME, lorem ipsum)', async () => {
      for (const wfFile of m1Workflows) {
        const wfPath = path.join(workflowsDir, wfFile);
        const content = await fs.readFile(wfPath, 'utf8');
        expect(content).not.toMatch(/\bTODO\b/i);
        expect(content).not.toMatch(/\bTBD\b/i);
        expect(content).not.toMatch(/\bFIXME\b/i);
        expect(content).not.toMatch(/lorem ipsum/i);
      }
    });

    it('should confirm all workflows reference valid marketing bundles', async () => {
      const validBundles = [
        'growth-marketing',
        'seo-content-marketing',
        'performance-paid-acquisition',
        'product-led-growth',
        'lifecycle-email-marketing',
      ];

      for (const wfFile of m1Workflows) {
        const wfPath = path.join(workflowsDir, wfFile);
        const content = await fs.readFile(wfPath, 'utf8');
        const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
        const fm = YAML.parse(match![1]);
        expect(validBundles).toContain(fm.bundle);
      }
    });

    it('should confirm all 9 skills have line counts >= 150 lines for deep production readiness', async () => {
      for (const skillName of m1Skills) {
        const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
        const content = await fs.readFile(skillFile, 'utf8');
        const lineCount = content.split('\n').length;
        expect(lineCount, `Skill ${skillName} line count ${lineCount} is less than 150`).toBeGreaterThanOrEqual(150);
      }
    });

    it('should confirm all 4 workflows have line counts >= 60 lines with deterministic gates', async () => {
      for (const wfFile of m1Workflows) {
        const wfPath = path.join(workflowsDir, wfFile);
        const content = await fs.readFile(wfPath, 'utf8');
        const lineCount = content.split('\n').length;
        expect(lineCount, `Workflow ${wfFile} line count ${lineCount} is less than 60`).toBeGreaterThanOrEqual(60);
      }
    });
  });
});
