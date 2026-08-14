import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';

export interface WorkflowFrontmatter {
  name?: string;
  description?: string;
  bundle?: string;
  estimatedDuration?: string;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  frontmatter?: WorkflowFrontmatter;
  totalLines: number;
  hasFlowchart: boolean;
  hasPhaseTransitions: boolean;
  hasPhaseGates: boolean;
  hasValidationCheckpoints: boolean;
  hasRollbackProtocols: boolean;
  phasesCount: number;
}

export function validateWorkflowGates(
  content: string,
  filename: string = 'workflow-test.md',
  options: { requireAllGates?: boolean } = {}
): WorkflowValidationResult {
  const errors: string[] = [];

  if (!content || !content.trim()) {
    return {
      valid: false,
      errors: ['Workflow file content is empty or whitespace only'],
      frontmatter: undefined,
      totalLines: 0,
      hasFlowchart: false,
      hasPhaseTransitions: false,
      hasPhaseGates: false,
      hasValidationCheckpoints: false,
      hasRollbackProtocols: false,
      phasesCount: 0,
    };
  }

  const totalLines = content.trim().split(/\r?\n/).length;

  const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  let frontmatter: WorkflowFrontmatter | undefined;

  if (frontmatterMatch) {
    try {
      frontmatter = YAML.parse(frontmatterMatch[1]);
    } catch (err: any) {
      errors.push(`Invalid YAML frontmatter syntax: ${err.message}`);
    }
  }

  const body = frontmatterMatch
    ? content.replace(/^---\r?\n[\s\S]+?\r?\n---/, '').trim()
    : content.trim();

  // Validate frontmatter under strict option
  if (frontmatter) {
    if (!frontmatter.name) errors.push("Missing mandatory frontmatter field 'name'");
    if (!frontmatter.description) errors.push("Missing mandatory frontmatter field 'description'");
  }

  // Section & Phase checks
  const hasFlowchart = /```mermaid|flowchart|graph TD|graph LR|diagram/i.test(body);
  const hasPhaseTransitions = /transition|criteria|exit condition|next phase/i.test(body);
  const hasPhaseGates = /phase gate|verification gate|gate|deterministic/i.test(body);
  const hasValidationCheckpoints = /checkpoint|validation|verification|check/i.test(body);
  const hasRollbackProtocols = /rollback|revert|recovery|fallback|protocol/i.test(body);

  const phaseMatches = body.match(/##\s+Phase\s+\d+|Phase\s+\d+:/gi);
  const phasesCount = phaseMatches ? phaseMatches.length : 0;

  if (options.requireAllGates) {
    if (!frontmatter?.name) errors.push("Missing mandatory frontmatter field 'name'");
    if (!frontmatter?.description) errors.push("Missing mandatory frontmatter field 'description'");
    if (!frontmatter?.bundle) errors.push("Missing mandatory frontmatter field 'bundle'");
    if (!frontmatter?.estimatedDuration) errors.push("Missing mandatory frontmatter field 'estimatedDuration'");
    if (!hasFlowchart) errors.push('Missing phase-by-phase execution flowchart (Mermaid diagram)');
    if (!hasPhaseTransitions) errors.push('Missing phase transition criteria');
    if (!hasPhaseGates) errors.push('Missing deterministic phase gates');
    if (!hasValidationCheckpoints) errors.push('Missing validation checkpoints');
    if (!hasRollbackProtocols) errors.push('Missing automated rollback protocols');
  }

  return {
    valid: errors.length === 0,
    errors,
    frontmatter,
    totalLines,
    hasFlowchart,
    hasPhaseTransitions,
    hasPhaseGates,
    hasValidationCheckpoints,
    hasRollbackProtocols,
    phasesCount,
  };
}

describe('E2E Workflow Metadata & Phase Gates Validation (Tier 1-4)', () => {
  const workflowsDir = path.resolve(process.cwd(), 'registry/workflows');
  const bundlesPath = path.resolve(process.cwd(), 'registry/bundles.json');

  // Tier 1: Feature Coverage (Happy Path)
  describe('Tier 1: Feature Coverage (Workflow Parsing & Phase Gates)', () => {
    it('should locate and parse all 44 workflow files in registry/workflows/', async () => {
      const files = await fs.readdir(workflowsDir);
      const workflowFiles = files.filter(f => f.startsWith('workflow-') && f.endsWith('.md'));

      expect(workflowFiles.length).toBe(54);

      for (const file of workflowFiles) {
        const filePath = path.join(workflowsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const result = validateWorkflowGates(content, file);

        expect(result.totalLines, `Workflow ${file} line count should be non-zero`).toBeGreaterThan(5);
        expect(result.phasesCount, `Workflow ${file} should contain phase sections`).toBeGreaterThan(0);
      }
    });

    it('should correctly parse frontmatter (name, description, bundle, estimatedDuration) when present', async () => {
      const sampleWorkflow = `---\nname: workflow-test\ndescription: Test workflow\nbundle: software-engineering\nestimatedDuration: 15m\n---\n\n# Workflow: Test\n\n## Phase 1: Planning\n`;
      const result = validateWorkflowGates(sampleWorkflow, 'workflow-test.md');

      expect(result.frontmatter?.name).toBe('workflow-test');
      expect(result.frontmatter?.description).toBe('Test workflow');
      expect(result.frontmatter?.bundle).toBe('software-engineering');
      expect(result.frontmatter?.estimatedDuration).toBe('15m');
    });
  });

  // Tier 2: Boundary & Corner Cases (Negative Testing)
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('should fail validation on empty or whitespace-only workflow files', () => {
      const result = validateWorkflowGates('', 'empty-workflow.md');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow file content is empty or whitespace only');
    });

    it('should fail validation when frontmatter YAML is malformed', () => {
      const malformed = `---\nname: bad-wf\ndescription: [unclosed array\n---\n\n# Body`;
      const result = validateWorkflowGates(malformed, 'bad-wf.md');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid YAML frontmatter syntax');
    });

    it('should fail validation under strict option when phase gates or flowcharts are missing', () => {
      const simpleContent = `---\nname: simple\ndescription: Simple workflow\n---\n\n# Workflow: Simple\n\nNo visual representation or verification rules here.`;
      const result = validateWorkflowGates(simpleContent, 'simple.md', { requireAllGates: true });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing phase-by-phase execution flowchart (Mermaid diagram)');
      expect(result.errors).toContain('Missing deterministic phase gates');
    });

    it('should pass validation under strict option when all mandatory frontmatter and sections are present', () => {
      const fullWorkflow = `---\nname: workflow-complete\ndescription: Complete workflow with phase gates\nbundle: software-engineering\nestimatedDuration: 30m\n---\n\n` +
        `# Workflow: Complete\n\n` +
        `## Flowchart\n\`\`\`mermaid\ngraph TD\n  A[Phase 1] --> B[Phase 2]\n\`\`\`\n\n` +
        `## Phase 1: Reconnaissance\n- Transition criteria: All checks green.\n- Deterministic phase gate: Gate 1 passed.\n- Validation checkpoint: Checkpoint 1 verified.\n- Automated rollback protocol: Revert commit on failure.\n`;

      const result = validateWorkflowGates(fullWorkflow, 'workflow-complete.md', { requireAllGates: true });
      expect(result.valid).toBe(true);
      expect(result.hasFlowchart).toBe(true);
      expect(result.hasPhaseGates).toBe(true);
      expect(result.hasRollbackProtocols).toBe(true);
    });
  });

  // Tier 3: Cross-Feature Pairwise Audit
  describe('Tier 3: Cross-Feature Pairwise Audit', () => {
    it('should cross-validate all 44 workflows referenced in bundles.json against registry/workflows/', async () => {
      const bundlesJson = await fs.readJson(bundlesPath);
      const fullBundleWorkflows: string[] = bundlesJson.bundles.full.workflows;

      expect(fullBundleWorkflows.length).toBe(54);

      for (const workflowFile of fullBundleWorkflows) {
        const workflowFilePath = path.join(workflowsDir, workflowFile);
        const exists = await fs.pathExists(workflowFilePath);
        expect(exists, `Workflow file '${workflowFile}' referenced in bundles.json does not exist in registry/workflows/`).toBe(true);
      }
    });

    it('should verify workflow filenames follow workflow-*.md naming convention', async () => {
      const files = await fs.readdir(workflowsDir);
      const workflowFiles = files.filter(f => f.endsWith('.md'));

      for (const file of workflowFiles) {
        expect(file.startsWith('workflow-'), `Workflow file '${file}' does not start with 'workflow-'`).toBe(true);
      }
    });
  });

  // Tier 4: Real-World Scenario Audit
  describe('Tier 4: Real-World Scenario Audit', () => {
    it('should perform complete audit of all 44 workflow files in registry/workflows/', async () => {
      const files = await fs.readdir(workflowsDir);
      const workflowFiles = files.filter(f => f.startsWith('workflow-') && f.endsWith('.md'));

      expect(workflowFiles.length).toBe(54);

      const report = {
        totalWorkflows: workflowFiles.length,
        withPhasesCount: 0,
        withMermaidFlowcharts: 0,
        withRollbackProtocols: 0,
      };

      for (const file of workflowFiles) {
        const content = await fs.readFile(path.join(workflowsDir, file), 'utf8');
        const result = validateWorkflowGates(content, file);

        if (result.phasesCount > 0) report.withPhasesCount++;
        if (result.hasFlowchart) report.withMermaidFlowcharts++;
        if (result.hasRollbackProtocols) report.withRollbackProtocols++;
      }

      expect(report.totalWorkflows).toBe(54);
      expect(report.withPhasesCount).toBe(54);
    });
  });
});
