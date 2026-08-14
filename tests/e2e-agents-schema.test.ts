import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';

export interface AgentFrontmatter {
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

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  data?: AgentFrontmatter;
}

export function validateAgentSchema(content: string, filename: string = 'agent.md'): SchemaValidationResult {
  const errors: string[] = [];

  if (!content || !content.trim()) {
    return { valid: false, errors: ['Content is empty or whitespace only'] };
  }

  const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!frontmatterMatch) {
    return { valid: false, errors: ['Missing YAML frontmatter delimiters (--- ... ---)'] };
  }

  let data: AgentFrontmatter;
  try {
    data = YAML.parse(frontmatterMatch[1]);
  } catch (err: any) {
    return { valid: false, errors: [`Invalid YAML syntax: ${err.message}`] };
  }

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Frontmatter did not parse into an object'] };
  }

  // Required field checks
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push("Missing or empty mandatory field 'name'");
  }

  if (!data.description || typeof data.description !== 'string' || data.description.trim() === '') {
    errors.push("Missing or empty mandatory field 'description'");
  }

  if (!data.model || typeof data.model !== 'string' || data.model.trim() === '') {
    errors.push("Missing or empty mandatory field 'model'");
  }

  // Enum validations
  const validTypes = ['orchestrator', 'subagent'];
  if (data.type && !validTypes.includes(data.type)) {
    errors.push(`Invalid agent type '${data.type}'. Must be one of: ${validTypes.join(', ')}`);
  }

  const validPermissionModes = ['acceptEdits', 'requestReview', 'strict', 'readOnly', 'read-only'];
  if (data.permissionMode && !validPermissionModes.includes(data.permissionMode)) {
    errors.push(`Invalid permissionMode '${data.permissionMode}'. Must be one of: ${validPermissionModes.join(', ')}`);
  }

  const validPolicies = ['auto', 'ask', 'never', 'requireApproval', 'allow'];
  if (data.commandExecutionPolicy && !validPolicies.includes(data.commandExecutionPolicy)) {
    errors.push(`Invalid commandExecutionPolicy '${data.commandExecutionPolicy}'. Must be one of: ${validPolicies.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    data,
  };
}

describe('E2E Agent Frontmatter & Schema Validation (Tier 1-4)', () => {
  const agentsDir = path.resolve(process.cwd(), 'registry/agents');

  // Tier 1: Feature Coverage (Happy Path)
  describe('Tier 1: Feature Coverage (Happy Path Parsing)', () => {
    it('should successfully parse YAML frontmatter for all agent files in registry/agents', async () => {
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter(f => f.endsWith('.md'));
      expect(agentFiles.length).toBeGreaterThan(0);

      for (const file of agentFiles) {
        const filePath = path.join(agentsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const result = validateAgentSchema(content, file);

        expect(result.valid, `Agent ${file} failed schema validation: ${result.errors.join('; ')}`).toBe(true);
        expect(result.data?.name).toBeDefined();
        expect(result.data?.description).toBeDefined();
        expect(result.data?.model).toBeDefined();
      }
    });
  });

  // Tier 2: Boundary & Corner Cases (Negative & Invalid Testing)
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('should reject agent markdown without frontmatter delimiters', () => {
      const invalidContent = `# Sub-agent without frontmatter\n\nYou are a sub-agent.`;
      const result = validateAgentSchema(invalidContent);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing YAML frontmatter delimiters (--- ... ---)');
    });

    it('should reject corrupt YAML syntax in frontmatter', () => {
      const invalidYaml = `---\nname: invalid-agent\ndescription: [unclosed array\nmodel: pro\n---\n\n# Body`;
      const result = validateAgentSchema(invalidYaml);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid YAML syntax');
    });

    it('should reject missing mandatory fields (name, description, model)', () => {
      const missingName = `---\ndescription: Missing name field\nmodel: pro\n---\n\n# Body`;
      const resultName = validateAgentSchema(missingName);
      expect(resultName.valid).toBe(false);
      expect(resultName.errors).toContain("Missing or empty mandatory field 'name'");

      const missingDesc = `---\nname: agent-test\nmodel: pro\n---\n\n# Body`;
      const resultDesc = validateAgentSchema(missingDesc);
      expect(resultDesc.valid).toBe(false);
      expect(resultDesc.errors).toContain("Missing or empty mandatory field 'description'");

      const missingModel = `---\nname: agent-test\ndescription: Some description\n---\n\n# Body`;
      const resultModel = validateAgentSchema(missingModel);
      expect(resultModel.valid).toBe(false);
      expect(resultModel.errors).toContain("Missing or empty mandatory field 'model'");
    });

    it('should reject invalid permissionMode enum values', () => {
      const invalidPerm = `---\nname: test\ndescription: desc\nmodel: pro\npermissionMode: superUser\n---\n\n# Body`;
      const result = validateAgentSchema(invalidPerm);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid permissionMode');
    });

    it('should reject invalid commandExecutionPolicy enum values', () => {
      const invalidPolicy = `---\nname: test\ndescription: desc\nmodel: pro\ncommandExecutionPolicy: executeAllSilently\n---\n\n# Body`;
      const result = validateAgentSchema(invalidPolicy);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid commandExecutionPolicy');
    });

    it('should reject invalid agent type enum values', () => {
      const invalidType = `---\nname: test\ndescription: desc\nmodel: pro\ntype: administrator\n---\n\n# Body`;
      const result = validateAgentSchema(invalidType);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid agent type');
    });

    it('should handle empty or whitespace-only files gracefully', () => {
      expect(validateAgentSchema('').valid).toBe(false);
      expect(validateAgentSchema('   \n  \t ').valid).toBe(false);
    });
  });

  // Tier 3: Cross-Feature Pairwise Consistency
  describe('Tier 3: Cross-Feature Pairwise Consistency', () => {
    it('should verify agent name in frontmatter matches filename stem', async () => {
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter(f => f.endsWith('.md'));

      for (const file of agentFiles) {
        const filePath = path.join(agentsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const result = validateAgentSchema(content, file);
        const fileStem = path.basename(file, '.md');

        expect(result.data?.name).toBe(fileStem);
      }
    });

    it('should verify file prefix matches agent role type (orchestrator vs subagent)', async () => {
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter(f => f.endsWith('.md'));

      for (const file of agentFiles) {
        const filePath = path.join(agentsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const result = validateAgentSchema(content, file);
        const data = result.data!;

        if (file.startsWith('orchestrator-')) {
          const isOrchestrator = data.type === 'orchestrator' || data.mainAgent === true;
          expect(isOrchestrator, `Orchestrator file ${file} should be marked as orchestrator or mainAgent`).toBe(true);
        } else if (file.startsWith('subagent-')) {
          const isSubagent = data.type === 'subagent' || data.subagent === true;
          expect(isSubagent, `Subagent file ${file} should be marked as subagent`).toBe(true);
        }
      }
    });
  });

  // Tier 4: Real-World Inventory Audit
  describe('Tier 4: Real-World Full Inventory Audit', () => {
    it('should confirm total inventory contains exactly 30 agent files with 0 duplicates', async () => {
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter(f => f.endsWith('.md'));

      expect(agentFiles.length).toBe(30);

      const orchestrators = agentFiles.filter(f => f.startsWith('orchestrator-'));
      const subagents = agentFiles.filter(f => f.startsWith('subagent-'));

      expect(orchestrators.length).toBe(7);
      expect(subagents.length).toBe(23);

      const names = new Set<string>();
      for (const file of agentFiles) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf8');
        const result = validateAgentSchema(content, file);
        const name = result.data?.name;
        expect(names.has(name!), `Duplicate agent name found: ${name}`).toBe(false);
        names.add(name!);
      }

      expect(names.size).toBe(30);
    });
  });
});
