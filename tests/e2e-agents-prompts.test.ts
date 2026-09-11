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
    it('should validate system prompt line count and structure for all 59 agent files', async () => {
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter(f => f.endsWith('.md'));
      expect(agentFiles.length).toBe(59);

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

    it('should configure regex tool matchers on digital-agency orchestrator hooks and match mutation tools', async () => {
      const agencyPath = path.join(agentsDir, 'orchestrator-digital-agency.md');
      const content = await fs.readFile(agencyPath, 'utf8');
      const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      expect(match).toBeDefined();

      const parsed = YAML.parse(match![1]);
      expect(parsed.hooks).toBeDefined();

      const preTool = parsed.hooks.PreToolUse[0];
      const postTool = parsed.hooks.PostToolUse[0];

      // TDD Red Assertion: Expect regex matcher covering all mutation operations
      expect(preTool.matcher).toBe('write_to_file|replace_file_content|multi_replace_file_content');
      expect(postTool.matcher).toBe('write_to_file|replace_file_content|multi_replace_file_content');

      // Test regex evaluation against tool names per Antigravity hooks specification
      const regex = new RegExp(`^(${preTool.matcher})$`);
      expect(regex.test('write_to_file')).toBe(true);
      expect(regex.test('replace_file_content')).toBe(true);
      expect(regex.test('multi_replace_file_content')).toBe(true);
      expect(regex.test('run_command')).toBe(false);
      expect(regex.test('search_web')).toBe(false);
    });

    it('should equip digital-agency orchestrator and subagents with advanced Antigravity tools', async () => {
      const agencyPath = path.join(agentsDir, 'orchestrator-digital-agency.md');
      const content = await fs.readFile(agencyPath, 'utf8');
      const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      expect(match).toBeDefined();

      const parsed = YAML.parse(match![1]);
      expect(parsed.tools).toContain('ask_question');
      expect(parsed.tools).toContain('find_by_name');
      expect(parsed.tools).toContain('define_subagent');
      expect(parsed.tools).toContain('manage_subagents');

      // Check subagents have find_by_name
      const subagentFiles = [
        'subagent-marketing-creative-designer.md',
        'subagent-marketing-content-strategist.md',
        'subagent-frontend-architect.md',
        'subagent-qa-automation-lead.md',
        'subagent-seo-specialist.md',
        'subagent-compliance-grc-specialist.md',
        'subagent-marketing-growth-strategist.md',
        'subagent-marketing-conversion-specialist.md',
        'subagent-marketing-campaign-specialist.md'
      ];

      for (const subFile of subagentFiles) {
        const subContent = await fs.readFile(path.join(agentsDir, subFile), 'utf8');
        const subMatch = subContent.match(/^---\r?\n([\s\S]+?)\r?\n---/);
        const subParsed = YAML.parse(subMatch![1]);
        expect(subParsed.tools, `${subFile} should have find_by_name`).toContain('find_by_name');
      }
    });

    it('should equip all 8 Tier-1 orchestrators with advanced Antigravity tools, regex hook matchers, skills, and mcpServers', async () => {
      const tier1Orchestrators = [
        'orchestrator-engineering.md',
        'orchestrator-system-architecture.md',
        'orchestrator-design.md',
        'orchestrator-marketing.md',
        'orchestrator-security.md',
        'orchestrator-research.md',
        'orchestrator-business.md',
        'orchestrator-universal.md'
      ];

      for (const file of tier1Orchestrators) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf8');
        const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
        expect(match, `${file} should have valid frontmatter`).toBeDefined();

        const parsed = YAML.parse(match![1]);
        expect(parsed.tools, `${file} missing ask_question`).toContain('ask_question');
        expect(parsed.tools, `${file} missing find_by_name`).toContain('find_by_name');
        expect(parsed.tools, `${file} missing define_subagent`).toContain('define_subagent');
        expect(parsed.tools, `${file} missing manage_subagents`).toContain('manage_subagents');

        expect(Array.isArray(parsed.skills) && parsed.skills.length > 0, `${file} should declare skills`).toBe(true);
        expect(Array.isArray(parsed.mcpServers) && parsed.mcpServers.length > 0, `${file} should declare mcpServers`).toBe(true);

        expect(parsed.hooks).toBeDefined();
        const postToolHooks = parsed.hooks.PostToolUse || [];
        const postToolMatcher = postToolHooks.find((h: any) => typeof h.matcher === 'string')?.matcher;
        expect(postToolMatcher, `${file} PostToolUse matcher should be regex covering mutation tools`).toBe(
          'write_to_file|replace_file_content|multi_replace_file_content'
        );
      }
    });

    it('should configure grill-me vs grill-with-docs appropriately and enforce ask_question in alignment protocols', async () => {
      const groupA = [
        'orchestrator-universal.md',
        'orchestrator-marketing.md',
        'orchestrator-business.md',
        'orchestrator-design.md',
        'orchestrator-research.md'
      ];
      const groupB = [
        'orchestrator-engineering.md',
        'orchestrator-system-architecture.md',
        'orchestrator-security.md',
        'orchestrator-digital-agency.md'
      ];

      for (const file of groupA) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf8');
        const parsed = YAML.parse(content.match(/^---\r?\n([\s\S]+?)\r?\n---/)![1]);
        expect(parsed.skills, `${file} should include grill-me`).toContain('grill-me');
        expect(parsed.skills, `${file} must NOT include grill-with-docs (role confusion)`).not.toContain('grill-with-docs');
        expect(content, `${file} should command ask_question tool in alignment protocol`).toMatch(/ask_question/);
      }

      for (const file of groupB) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf8');
        const parsed = YAML.parse(content.match(/^---\r?\n([\s\S]+?)\r?\n---/)![1]);
        expect(parsed.skills, `${file} should include grill-me`).toContain('grill-me');
        expect(parsed.skills, `${file} should include grill-with-docs`).toContain('grill-with-docs');
        expect(content, `${file} should command ask_question tool in alignment protocol`).toMatch(/ask_question/);
      }
    });

    it('should equip Tier-1 foundational subagents with find_by_name, skills, and mcpServers', async () => {
      const coreSubagents = [
        'subagent-backend-architect.md',
        'subagent-system-architect.md',
        'subagent-code-reviewer.md',
        'subagent-repo-index.md',
        'subagent-ui-designer.md',
        'subagent-ux-strategist.md',
        'subagent-interaction-designer.md',
        'subagent-security-engineer.md',
        'subagent-deep-research.md',
        'subagent-socratic-mentor.md',
        'subagent-business-panel-experts.md'
      ];

      for (const file of coreSubagents) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf8');
        const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
        expect(match, `${file} should have valid frontmatter`).toBeDefined();

        const parsed = YAML.parse(match![1]);
        expect(parsed.tools, `${file} missing find_by_name`).toContain('find_by_name');
        expect(Array.isArray(parsed.skills) && parsed.skills.length > 0, `${file} should declare skills`).toBe(true);
        expect(Array.isArray(parsed.mcpServers) && parsed.mcpServers.length > 0, `${file} should declare mcpServers`).toBe(true);
      }
    });

    it('should equip all 30 modular add-on subagents with find_by_name, skills, and mcpServers', async () => {
      const addonSubagents = [
        'subagent-ios-architect.md',
        'subagent-android-architect.md',
        'subagent-cross-platform-specialist.md',
        'subagent-accessibility-lead.md',
        'subagent-distributed-systems-architect.md',
        'subagent-data-engineer.md',
        'subagent-e2e-tester.md',
        'subagent-devops-engineer.md',
        'subagent-ml-platform-engineer.md',
        'subagent-ai-model-architect.md',
        'subagent-sysops-sre-lead.md',
        'subagent-cloud-infrastructure-architect.md',
        'subagent-database-administrator.md',
        'subagent-finops-cost-engineer.md',
        'subagent-design-ops-lead.md',
        'subagent-design-systems-architect.md',
        'subagent-designer-toolkit-expert.md',
        'subagent-design-researcher.md',
        'subagent-prototype-tester.md',
        'subagent-paid-acquisition-specialist.md',
        'subagent-plg-strategist.md',
        'subagent-lifecycle-email-specialist.md',
        'subagent-cloud-security-architect.md',
        'subagent-appsec-penetration-tester.md',
        'subagent-financial-analyst.md',
        'subagent-market-intelligence-analyst.md',
        'subagent-operations-strategist.md',
        'subagent-legal-contract-analyst.md',
        'subagent-statistical-analyst.md',
        'subagent-literature-patent-analyst.md'
      ];

      for (const file of addonSubagents) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf8');
        const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
        expect(match, `${file} should have valid frontmatter`).toBeDefined();

        const parsed = YAML.parse(match![1]);
        expect(parsed.tools, `${file} missing find_by_name`).toContain('find_by_name');
        expect(Array.isArray(parsed.skills) && parsed.skills.length > 0, `${file} should declare skills`).toBe(true);
        expect(Array.isArray(parsed.mcpServers) && parsed.mcpServers.length > 0, `${file} should declare mcpServers`).toBe(true);
      }
    });

    it('should verify that all skills declared across all agents exist in registry/skills', async () => {
      const skillsDir = path.resolve(process.cwd(), 'registry', 'skills');
      const agentFiles = (await fs.readdir(agentsDir)).filter(f => f.endsWith('.md'));
      const missing: Array<{ file: string; skill: string }> = [];

      for (const file of agentFiles) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf8');
        const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
        if (!match) continue;
        const parsed = YAML.parse(match[1]);
        if (Array.isArray(parsed.skills)) {
          for (const s of parsed.skills) {
            const skillPath = path.join(skillsDir, s, 'SKILL.md');
            if (!(await fs.pathExists(skillPath))) {
              missing.push({ file, skill: s });
            }
          }
        }
      }

      expect(missing, `Skills missing in registry/skills: ${missing.map(m => `${m.file} -> ${m.skill}`).join(', ')}`).toEqual([]);
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

      expect(report.totalAgents).toBe(59);
      expect(report.orchestratorsCount).toBe(9);
      expect(report.subagentsCount).toBe(50);
      expect(report.expandedPromptsCount).toBeGreaterThan(0);
    });
  });
});
