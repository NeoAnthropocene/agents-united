import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';

export interface PromptValidationResult {
  valid: boolean;
  errors: string[];
  totalLines: number;
  promptBodyLines: number;
  hooksFound: string[];
  hasDirectives: boolean;
  hasProtocol: boolean;
  hasGuardrails: boolean;
}

export function validateAgentPrompt(
  content: string,
  filename: string = 'agent.md',
  options: { minLines?: number; requireHooks?: boolean } = {}
): PromptValidationResult {
  const errors: string[] = [];
  const minLines = options.minLines ?? 40;

  if (!content || !content.trim()) {
    return {
      valid: false,
      errors: ['Agent file content is empty'],
      totalLines: 0,
      promptBodyLines: 0,
      hooksFound: [],
      hasDirectives: false,
      hasProtocol: false,
      hasGuardrails: false,
    };
  }

  const totalLines = content.trim().split(/\r?\n/).length;

  // Extract frontmatter & prompt body
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  const promptBody = frontmatterMatch
    ? content.replace(/^---\r?\n[\s\S]+?\r?\n---/, '').trim()
    : content.trim();

  const promptBodyLines = promptBody.split(/\r?\n/).length;

  // Check lifecycle hooks in frontmatter
  const hooksFound: string[] = [];
  if (frontmatterMatch) {
    try {
      const parsed = YAML.parse(frontmatterMatch[1]);
      if (parsed && typeof parsed.hooks === 'object' && parsed.hooks !== null) {
        const validHooks = ['PreInvocation', 'PostInvocation', 'PreToolUse', 'PostToolUse'];
        for (const hookName of Object.keys(parsed.hooks)) {
          if (validHooks.includes(hookName)) {
            hooksFound.push(hookName);
          } else {
            errors.push(`Unrecognized lifecycle hook '${hookName}'. Expected one of: ${validHooks.join(', ')}`);
          }
        }
      }
    } catch {
      errors.push('Malformed YAML frontmatter when checking hooks');
    }
  }

  // Check lifecycle hook mentions in prompt body if not in frontmatter
  const standardHooks = ['PreInvocation', 'PostInvocation', 'PreToolUse', 'PostToolUse'];
  for (const hook of standardHooks) {
    if (promptBody.includes(hook) && !hooksFound.includes(hook)) {
      hooksFound.push(hook);
    }
  }

  // Check section presence
  const hasDirectives = /directive|role|purpose|objective|primary|architect|specialist|agent|responsibilit|you are/i.test(promptBody);
  const hasProtocol = /protocol|phase|step|execution|workflow|reasoning/i.test(promptBody);
  const hasGuardrails = /guardrail|safety|boundary|rule|constraint|never/i.test(promptBody);

  // Line count evaluation
  if (promptBodyLines < minLines && options.minLines !== undefined) {
    errors.push(`Prompt body line count (${promptBodyLines}) is below minimum requirement (${minLines} lines)`);
  }

  if (options.requireHooks && hooksFound.length === 0) {
    errors.push('Missing required explicit lifecycle hooks (PreInvocation, PostInvocation, PreToolUse, PostToolUse)');
  }

  return {
    valid: errors.length === 0,
    errors,
    totalLines,
    promptBodyLines,
    hooksFound,
    hasDirectives,
    hasProtocol,
    hasGuardrails,
  };
}

describe('E2E Agent Prompt & Lifecycle Hooks Validation (Tier 1-4)', () => {
  const agentsDir = path.resolve(process.cwd(), 'registry/agents');

  // Tier 1: Feature Coverage (Happy Path)
  describe('Tier 1: Feature Coverage (Prompt & Hooks Evaluation)', () => {
    it('should validate system prompt line count and structure for all 58 agent files', async () => {
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter(f => f.endsWith('.md'));
      expect(agentFiles.length).toBe(58);

      for (const file of agentFiles) {
        const filePath = path.join(agentsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const result = validateAgentPrompt(content, file, { minLines: 10 }); // Baseline check for all files

        expect(result.totalLines, `File ${file} total line count should be non-zero`).toBeGreaterThan(10);
        expect(result.promptBodyLines, `File ${file} body line count should be non-zero`).toBeGreaterThan(1);
        expect(result.hasDirectives, `Agent ${file} missing operational directives/role section`).toBe(true);
      }
    });

    it('should correctly parse explicit lifecycle hooks (PreInvocation, PostInvocation, PreToolUse, PostToolUse)', async () => {
      const orchestratorPath = path.join(agentsDir, 'orchestrator-engineering.md');
      const content = await fs.readFile(orchestratorPath, 'utf8');
      const result = validateAgentPrompt(content, 'orchestrator-engineering.md');

      expect(result.hooksFound).toContain('PreInvocation');
      expect(result.hooksFound).toContain('PreToolUse');
      expect(result.hooksFound).toContain('PostToolUse');
    });
  });

  // Tier 2: Boundary & Corner Cases (Negative Testing)
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('should fail validation when prompt line count is below strict threshold (sub-40 lines check)', () => {
      const shortPrompt = `---\nname: short-agent\ndescription: test\nmodel: pro\n---\n\n# Short Agent\n\nOnly a few lines of prompt body.\nLine 2.\nLine 3.`;
      const result = validateAgentPrompt(shortPrompt, 'short-agent.md', { minLines: 40 });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('below minimum requirement (40 lines)');
    });

    it('should pass validation when prompt line count meets or exceeds strict threshold (>= 40 lines)', () => {
      const lines = Array.from({ length: 42 }, (_, i) => `Line ${i + 1}: Operational instructions and reasoning protocol step.`).join('\n');
      const longPrompt = `---\nname: long-agent\ndescription: test\nmodel: pro\n---\n\n# Long Agent\n\n${lines}`;
      const result = validateAgentPrompt(longPrompt, 'long-agent.md', { minLines: 40 });

      expect(result.valid).toBe(true);
      expect(result.promptBodyLines).toBeGreaterThanOrEqual(40);
    });

    it('should reject unrecognized lifecycle hook names in frontmatter', () => {
      const invalidHooksYaml = `---\nname: invalid-hooks\ndescription: test\nmodel: pro\nhooks:\n  OnStartup:\n    - command: echo hi\n---\n\n# Body\n` + 'Line\n'.repeat(40);
      const result = validateAgentPrompt(invalidHooksYaml, 'invalid-hooks.md');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Unrecognized lifecycle hook 'OnStartup'");
    });

    it('should handle empty files gracefully', () => {
      const result = validateAgentPrompt('', 'empty.md');
      expect(result.valid).toBe(false);
      expect(result.promptBodyLines).toBe(0);
    });

    it('should preserve line count accuracy with unicode and complex markdown content', () => {
      const complexContent = `---\nname: unicode-agent\ndescription: 🤖 test\nmodel: pro\n---\n\n` +
        `# 🤖 Directive 1\n` +
        `\`\`\`typescript\nconst x = "🚀";\n\`\`\`\n` +
        'Instruction line.\n'.repeat(45);
      const result = validateAgentPrompt(complexContent, 'unicode-agent.md', { minLines: 40 });

      expect(result.valid).toBe(true);
      expect(result.promptBodyLines).toBeGreaterThanOrEqual(40);
    });
  });

  // Tier 3: Cross-Feature Pairwise Integration
  describe('Tier 3: Cross-Feature Pairwise Integration', () => {
    it('should verify orchestrator agents specify subagent delegation protocol in system prompt', async () => {
      const files = await fs.readdir(agentsDir);
      const orchestrators = files.filter(f => f.startsWith('orchestrator-'));

      for (const file of orchestrators) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf8');
        const result = validateAgentPrompt(content, file);
        const hasDelegation = /subagent|delegate|coordination|invok/i.test(content);

        expect(hasDelegation, `Orchestrator ${file} should contain subagent delegation protocol in prompt`).toBe(true);
      }
    });

    it('should verify hook command actions specify valid executable commands', async () => {
      const engineeringPath = path.join(agentsDir, 'orchestrator-engineering.md');
      const content = await fs.readFile(engineeringPath, 'utf8');
      const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      expect(match).toBeDefined();

      const parsed = YAML.parse(match![1]);
      expect(parsed.hooks).toBeDefined();
      expect(parsed.hooks.PreInvocation[0].command).toContain('git status');
    });
  });

  // Tier 4: Real-World Inventory Audit
  describe('Tier 4: Real-World Inventory Audit', () => {
    it('should perform comprehensive prompt and lifecycle hooks audit across all 46 agents', async () => {
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter(f => f.endsWith('.md'));

      const report = {
        totalAgents: agentFiles.length,
        orchestratorsCount: 0,
        subagentsCount: 0,
        expandedPromptsCount: 0, // >= 40 lines
        withLifecycleHooksCount: 0,
      };

      for (const file of agentFiles) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf8');
        const result = validateAgentPrompt(content, file);

        if (file.startsWith('orchestrator-')) report.orchestratorsCount++;
        if (file.startsWith('subagent-')) report.subagentsCount++;

        if (result.promptBodyLines >= 40) report.expandedPromptsCount++;
        if (result.hooksFound.length > 0) report.withLifecycleHooksCount++;
      }

      expect(report.totalAgents).toBe(58);
      expect(report.orchestratorsCount).toBe(8);
      expect(report.subagentsCount).toBe(50);
      expect(report.expandedPromptsCount).toBeGreaterThan(0);
    });
  });
});
