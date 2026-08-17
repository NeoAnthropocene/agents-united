import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';

interface AgentFrontmatter {
  name?: string;
  description?: string;
  version?: string | number;
  type?: 'orchestrator' | 'subagent' | string;
  model?: string;
  permissionMode?: 'acceptEdits' | 'requestReview' | 'strict' | string;
  commandExecutionPolicy?: 'auto' | 'ask' | 'never' | string;
  tools?: string[];
  mainAgent?: boolean;
  subagent?: boolean;
  hooks?: Record<string, any>;
}

function validateAgentSchema(content: string, filename: string = 'agent.md') {
  const errors: string[] = [];
  if (!content || !content.trim()) return { valid: false, errors: ['Empty'] };
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return { valid: false, errors: ['Missing YAML delimiters'] };
  let data: AgentFrontmatter;
  try {
    data = YAML.parse(match[1]);
  } catch (err: any) {
    return { valid: false, errors: [`Invalid YAML: ${err.message}`] };
  }
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Not an object'] };
  if (!data.name || typeof data.name !== 'string') errors.push("Missing 'name'");
  if (!data.description || typeof data.description !== 'string') errors.push("Missing 'description'");
  if (!data.model || typeof data.model !== 'string') errors.push("Missing 'model'");
  const validTypes = ['orchestrator', 'subagent'];
  if (data.type && !validTypes.includes(data.type)) errors.push(`Invalid type: ${data.type}`);
  const validPerms = ['acceptEdits', 'requestReview', 'strict', 'readOnly'];
  if (data.permissionMode && !validPerms.includes(data.permissionMode)) errors.push(`Invalid permissionMode: ${data.permissionMode}`);
  const validPolicies = ['auto', 'ask', 'never'];
  if (data.commandExecutionPolicy && !validPolicies.includes(data.commandExecutionPolicy)) errors.push(`Invalid commandExecutionPolicy: ${data.commandExecutionPolicy}`);
  return { valid: errors.length === 0, errors, data };
}

function validateAgentPrompt(content: string, filename: string = 'agent.md', options: { minLines?: number; requireHooks?: boolean } = {}) {
  const errors: string[] = [];
  const minLines = options.minLines ?? 40;
  if (!content || !content.trim()) return { valid: false, errors: ['Empty'], promptBodyLines: 0, hooksFound: [] };
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  const promptBody = frontmatterMatch ? content.replace(/^---\r?\n[\s\S]+?\r?\n---/, '').trim() : content.trim();
  const promptBodyLines = promptBody.split(/\r?\n/).length;

  const hooksFound: string[] = [];
  if (frontmatterMatch) {
    try {
      const parsed = YAML.parse(frontmatterMatch[1]);
      if (parsed && typeof parsed.hooks === 'object' && parsed.hooks !== null) {
        const validHooks = ['PreInvocation', 'PostInvocation', 'PreToolUse', 'PostToolUse'];
        for (const hookName of Object.keys(parsed.hooks)) {
          if (validHooks.includes(hookName)) hooksFound.push(hookName);
        }
      }
    } catch {}
  }

  const hasDirectives = /directive|role|purpose|objective|primary|architect|specialist|agent|responsibilit|you are/i.test(promptBody);
  const hasProtocol = /protocol|phase|step|execution|workflow|reasoning/i.test(promptBody);
  const hasGuardrails = /guardrail|safety|boundary|rule|constraint|never/i.test(promptBody);

  if (promptBodyLines < minLines) errors.push(`Body lines ${promptBodyLines} < ${minLines}`);
  if (options.requireHooks && hooksFound.length === 0) errors.push('Missing hooks');

  return { valid: errors.length === 0, errors, promptBodyLines, hooksFound, hasDirectives, hasProtocol, hasGuardrails };
}

function validateSkillDepth(content: string, folderName: string = 'skill-dir', options: { minLines?: number; requireAllSections?: boolean } = {}) {
  const errors: string[] = [];
  const minLines = options.minLines ?? 50;
  if (!content || !content.trim()) return { valid: false, errors: ['Empty'], runbookLines: 0, frontmatter: undefined };
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  let frontmatter: any;
  if (!frontmatterMatch) errors.push('Missing frontmatter');
  else {
    try { frontmatter = YAML.parse(frontmatterMatch[1]); } catch (e: any) { errors.push(e.message); }
  }
  if (frontmatter) {
    if (!frontmatter.name) errors.push('Missing name');
    if (!frontmatter.description) errors.push('Missing description');
  }
  const runbookBody = frontmatterMatch ? content.replace(/^---\r?\n[\s\S]+?\r?\n---/, '').trim() : content.trim();
  const runbookLines = runbookBody.split(/\r?\n/).length;
  if (runbookLines < minLines) errors.push(`Runbook lines ${runbookLines} < ${minLines}`);

  const hasTriggers = /trigger|procedure|guideline|usage|when to use/i.test(runbookBody);
  const hasInputOutput = /input|output|requirement|parameter|contract/i.test(runbookBody);
  const hasEdgeCases = /edge.case|corner.case|boundary|limit/i.test(runbookBody);
  const hasErrorRecovery = /error|recover|troubleshoot|fallback|failure/i.test(runbookBody);
  const hasExemplars = /exemplar|example|code|sample|template/i.test(runbookBody) || /```[\s\S]*?```/.test(runbookBody);

  if (options.requireAllSections) {
    if (!hasTriggers) errors.push('Missing triggers');
    if (!hasInputOutput) errors.push('Missing input/output');
    if (!hasEdgeCases) errors.push('Missing edge cases');
    if (!hasErrorRecovery) errors.push('Missing error recovery');
    if (!hasExemplars) errors.push('Missing exemplars');
  }

  return { valid: errors.length === 0, errors, frontmatter, runbookLines, hasTriggers, hasInputOutput, hasEdgeCases, hasErrorRecovery, hasExemplars };
}

function validateWorkflowGates(content: string, filename: string = 'wf.md', options: { requireAllGates?: boolean } = {}) {
  const errors: string[] = [];
  if (!content || !content.trim()) return { valid: false, errors: ['Empty'], frontmatter: undefined, phasesCount: 0 };
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  let frontmatter: any;
  if (frontmatterMatch) {
    try { frontmatter = YAML.parse(frontmatterMatch[1]); } catch (e: any) { errors.push(e.message); }
  }
  const body = frontmatterMatch ? content.replace(/^---\r?\n[\s\S]+?\r?\n---/, '').trim() : content.trim();
  const hasFlowchart = /```mermaid|flowchart|graph TD|graph LR|diagram/i.test(body);
  const hasPhaseTransitions = /transition|criteria|exit condition|next phase/i.test(body);
  const hasPhaseGates = /phase gate|verification gate|gate|deterministic/i.test(body);
  const hasValidationCheckpoints = /checkpoint|validation|verification|check/i.test(body);
  const hasRollbackProtocols = /rollback|revert|recovery|fallback|protocol/i.test(body);
  const phaseMatches = body.match(/##\s+Phase\s+\d+|Phase\s+\d+:/gi);
  const phasesCount = phaseMatches ? phaseMatches.length : 0;

  if (options.requireAllGates) {
    if (!frontmatter?.name) errors.push('Missing name');
    if (!frontmatter?.description) errors.push('Missing description');
    if (!frontmatter?.bundle) errors.push('Missing bundle');
    if (!frontmatter?.estimatedDuration) errors.push('Missing estimatedDuration');
    if (!hasFlowchart) errors.push('Missing flowchart');
    if (!hasPhaseTransitions) errors.push('Missing transitions');
    if (!hasPhaseGates) errors.push('Missing phase gates');
    if (!hasValidationCheckpoints) errors.push('Missing checkpoints');
    if (!hasRollbackProtocols) errors.push('Missing rollback protocols');
  }

  return { valid: errors.length === 0, errors, frontmatter, hasFlowchart, hasPhaseTransitions, hasPhaseGates, hasValidationCheckpoints, hasRollbackProtocols, phasesCount };
}

describe('Milestone 3 (Worker 1) Deliverables Validation', () => {
  const agentsDir = path.resolve(process.cwd(), 'registry/agents');
  const skillsDir = path.resolve(process.cwd(), 'registry/skills');
  const workflowsDir = path.resolve(process.cwd(), 'registry/workflows');

  describe('Sub-Agents Validation', () => {
    const agents = [
      'subagent-ml-platform-engineer.md',
      'subagent-ai-model-architect.md',
    ];

    for (const agentFile of agents) {
      it(`should strictly validate ${agentFile} schema and prompt depth`, async () => {
        const filePath = path.join(agentsDir, agentFile);
        expect(await fs.pathExists(filePath), `Agent file ${agentFile} must exist`).toBe(true);

        const content = await fs.readFile(filePath, 'utf8');
        const schemaRes = validateAgentSchema(content, agentFile);
        expect(schemaRes.valid, `Agent schema failed: ${schemaRes.errors.join('; ')}`).toBe(true);
        expect(schemaRes.data?.version).toBe('2.0.0');
        expect(schemaRes.data?.type).toBe('subagent');
        expect(schemaRes.data?.model).toBe('inherit');
        expect(schemaRes.data?.permissionMode).toBe('acceptEdits');
        expect(schemaRes.data?.commandExecutionPolicy).toBe('auto');
        expect(schemaRes.data?.subagent).toBe(true);
        expect(schemaRes.data?.mainAgent).toBe(false);

        const promptRes = validateAgentPrompt(content, agentFile, { minLines: 40, requireHooks: true });
        expect(promptRes.valid, `Agent prompt failed: ${promptRes.errors.join('; ')}`).toBe(true);
        expect(promptRes.promptBodyLines).toBeGreaterThanOrEqual(40);
        expect(promptRes.hasDirectives).toBe(true);
        expect(promptRes.hasProtocol).toBe(true);
        expect(promptRes.hasGuardrails).toBe(true);
        expect(promptRes.hooksFound).toContain('PreInvocation');
        expect(promptRes.hooksFound).toContain('PostInvocation');
        expect(promptRes.hooksFound).toContain('PreToolUse');
        expect(promptRes.hooksFound).toContain('PostToolUse');
      });
    }
  });

  describe('7 AI/ML Skills Validation', () => {
    const skills = [
      { name: 'modal-serverless-python', author: 'Modal Labs / agents-united' },
      { name: 'replicate-model-inference', author: 'Replicate / agents-united' },
      { name: 'runpod-gpu-orchestration', author: 'RunPod / agents-united' },
      { name: 'local-llm-inference', author: 'Ollama & vLLM Community / agents-united' },
      { name: 'rag-vector-pipeline', author: 'LangChain & LlamaIndex / agents-united' },
      { name: 'hf-model-evaluation', author: 'Hugging Face / agents-united' },
      { name: 'vector-database-design', author: 'Qdrant & Pinecone Community / agents-united' },
    ];

    for (const skill of skills) {
      it(`should strictly validate skill ${skill.name}/SKILL.md`, async () => {
        const skillPath = path.join(skillsDir, skill.name, 'SKILL.md');
        expect(await fs.pathExists(skillPath), `Skill file for ${skill.name} must exist`).toBe(true);

        const content = await fs.readFile(skillPath, 'utf8');
        const depthRes = validateSkillDepth(content, skill.name, { minLines: 50, requireAllSections: true });
        expect(depthRes.valid, `Skill validation failed for ${skill.name}: ${depthRes.errors.join('; ')}`).toBe(true);
        expect(depthRes.frontmatter?.name).toBe(skill.name);
        expect(depthRes.frontmatter?.metadata?.author).toBe(skill.author);
        expect(depthRes.frontmatter?.metadata?.version).toBe('2.0.0');
        expect(depthRes.runbookLines).toBeGreaterThanOrEqual(50);
        expect(depthRes.hasTriggers).toBe(true);
        expect(depthRes.hasInputOutput).toBe(true);
        expect(depthRes.hasEdgeCases).toBe(true);
        expect(depthRes.hasErrorRecovery).toBe(true);
        expect(depthRes.hasExemplars).toBe(true);
      });
    }
  });

  describe('3 AI/ML Workflows Validation', () => {
    const workflows = [
      { file: 'workflow-ml-eval.md', duration: '30-60m' },
      { file: 'workflow-rag-pipeline-deploy.md', duration: '25-45m' },
      { file: 'workflow-serverless-gpu-deploy.md', duration: '15-30m' },
    ];

    for (const wf of workflows) {
      it(`should strictly validate workflow ${wf.file}`, async () => {
        const wfPath = path.join(workflowsDir, wf.file);
        expect(await fs.pathExists(wfPath), `Workflow file ${wf.file} must exist`).toBe(true);

        const content = await fs.readFile(wfPath, 'utf8');
        const wfRes = validateWorkflowGates(content, wf.file, { requireAllGates: true });
        expect(wfRes.valid, `Workflow validation failed for ${wf.file}: ${wfRes.errors.join('; ')}`).toBe(true);
        expect(wfRes.frontmatter?.bundle).toBe('ai-ml-engineering');
        expect(wfRes.frontmatter?.estimatedDuration).toBe(wf.duration);
        expect(wfRes.hasFlowchart).toBe(true);
        expect(wfRes.hasPhaseTransitions).toBe(true);
        expect(wfRes.hasPhaseGates).toBe(true);
        expect(wfRes.hasValidationCheckpoints).toBe(true);
        expect(wfRes.hasRollbackProtocols).toBe(true);
        expect(wfRes.phasesCount).toBeGreaterThanOrEqual(3);
      });
    }
  });
});
