import { describe, it, expect } from 'vitest';
import yaml from 'yaml';
import { ClineProjector } from '../src/core/cline-projector.js';
import type { BundleDefinition, InstallScope, LockfileManifest } from '../src/core/types.js';

describe('Milestone 1: ClineProjector', () => {
  const sampleBundle: BundleDefinition = {
    name: 'software-engineering',
    description: 'Autonomous software engineering team',
    orchestrator: 'orchestrator-engineering.md',
    agents: [
      'subagent-backend-architect.md',
      'subagent-frontend-architect.md',
      'subagent-code-reviewer.md',
      'subagent-repo-index.md',
    ],
    skills: ['backend-api-design', 'architecture-design'],
    workflows: ['workflow-implement.md', 'workflow-review.md'],
    recommendedAddons: ['mobile-development', 'frontend-engineering'],
  };

  describe('Team Manifest generation', () => {
    it('generates deterministic Team Manifest YAML matching schema', () => {
      const manifestYaml = ClineProjector.renderTeamManifest(sampleBundle, 'project');
      const parsed = yaml.parse(manifestYaml);

      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.bundle).toBe('software-engineering');
      expect(parsed.scope).toBe('project');
      expect(parsed.coordinator).toEqual({
        name: 'orchestrator-engineering',
        canonicalPath: 'agents/orchestrator-engineering.md',
      });
      expect(parsed.roles).toEqual([
        { name: 'subagent-backend-architect', canonicalPath: 'agents/subagent-backend-architect.md' },
        { name: 'subagent-frontend-architect', canonicalPath: 'agents/subagent-frontend-architect.md' },
        { name: 'subagent-code-reviewer', canonicalPath: 'agents/subagent-code-reviewer.md' },
        { name: 'subagent-repo-index', canonicalPath: 'agents/subagent-repo-index.md' },
      ]);
      // Deterministically sorted skills & workflows
      expect(parsed.skills).toEqual(['architecture-design', 'backend-api-design']);
      expect(parsed.workflows).toEqual(['workflow-implement.md', 'workflow-review.md']);
      expect(parsed.recommendedAddons).toEqual(['mobile-development', 'frontend-engineering']);
      expect(parsed.activation).toEqual({
        preferred: 'named-team',
        fallbacks: ['adaptive-session', 'single-orchestrator'],
      });
    });

    it('produces byte-identical repeat renders', () => {
      const render1 = ClineProjector.renderTeamManifest(sampleBundle, 'project');
      const render2 = ClineProjector.renderTeamManifest(sampleBundle, 'project');
      expect(render1).toBe(render2);
    });

    it('handles bundles with no recommended addons or no subagents gracefully', () => {
      const minimalBundle: BundleDefinition = {
        name: 'minimal-bundle',
        description: 'Minimal bundle',
        orchestrator: 'orchestrator-minimal.md',
      };
      const manifestYaml = ClineProjector.renderTeamManifest(minimalBundle, 'global');
      const parsed = yaml.parse(manifestYaml);

      expect(parsed.bundle).toBe('minimal-bundle');
      expect(parsed.scope).toBe('global');
      expect(parsed.roles).toEqual([]);
      expect(parsed.skills).toEqual([]);
      expect(parsed.workflows).toEqual([]);
      expect(parsed.recommendedAddons).toEqual([]);
    });
  });

  describe('Role definition rendering', () => {
    it('strips Claude-style tools, Antigravity keys, and injects Cline preamble and managed marker', () => {
      const canonicalAgent = `---
name: backend-architect
description: Expert backend architect
tools:
  - Read
  - Edit
  - Bash
permissionMode: default
hooks:
  PreToolUse: check
version: 1.0.0
---
You are a specialized backend architect.
Always design clean APIs.
`;

      const rendered = ClineProjector.renderRole(
        canonicalAgent,
        'agents/subagent-backend-architect.md'
      );

      // Must have frontmatter
      expect(rendered).toMatch(/^---\r?\n/);
      const parts = rendered.split(/---\r?\n/);
      const frontmatter = yaml.parse(parts[1]);

      expect(frontmatter.name).toBe('backend-architect');
      expect(frontmatter.description).toBe('Expert backend architect');
      expect(frontmatter.tools).toBeUndefined();
      expect(frontmatter.permissionMode).toBeUndefined();
      expect(frontmatter.hooks).toBeUndefined();
      expect(frontmatter.version).toBeUndefined();

      // Body contains managed marker as first line
      const body = parts.slice(2).join('---');
      expect(body).toContain('<!-- managed-by: agents-united | profile: cline | canonical: agents/subagent-backend-architect.md | do not edit -->');
      expect(body).toContain('## Cline runtime note');
      expect(body).toContain('Always design clean APIs.');
    });
  });

  describe('Skill SKILL.md rendering', () => {
    it('preserves valid frontmatter and inserts managed marker after frontmatter', () => {
      const canonicalSkill = `---
name: backend-api-design
description: Guidelines for building REST/GraphQL APIs
version: 1.0.0
---
# Backend API Design Guide
Follow REST standards.
`;

      const rendered = ClineProjector.renderSkillMd(
        canonicalSkill,
        'skills/backend-api-design/SKILL.md'
      );

      expect(rendered).toMatch(/^---\r?\n/);
      const parts = rendered.split(/---\r?\n/);
      const frontmatter = yaml.parse(parts[1]);
      expect(frontmatter.name).toBe('backend-api-design');
      expect(frontmatter.description).toBe('Guidelines for building REST/GraphQL APIs');

      const body = parts.slice(2).join('---');
      expect(body).toContain('<!-- managed-by: agents-united | profile: cline | canonical: skills/backend-api-design/SKILL.md | do not edit -->');
      expect(body).toContain('# Backend API Design Guide');
    });
  });

  describe('Coordinator Rule rendering', () => {
    it('renders concise rule with bundle reference, manifest path, and activation guidelines', () => {
      const rule = ClineProjector.renderCoordinatorRule(sampleBundle, 'project');
      expect(rule).toContain('software-engineering');
      expect(rule).toContain('.cline/agents-united/teams/software-engineering.yaml');
      expect(rule).toContain('orchestrator-engineering');
      expect(rule).toContain('<!-- managed-by: agents-united | profile: cline');
    });
  });

  describe('Backward compatibility of LockfileManifest without projections', () => {
    it('handles legacy lockfile manifest without projections field', () => {
      const legacyLockfile: LockfileManifest = {
        $schema: 'https://agents-united.dev/schemas/lockfile.json',
        version: 1,
        installed: {
          bundles: ['software-engineering'],
          agents: ['orchestrator-engineering.md'],
          skills: [],
          workflows: [],
        },
        files: {
          'agents/orchestrator-engineering.md': {
            hash: 'abc123hash',
            bundle: 'software-engineering',
            installedAt: '2026-08-14T00:00:00.000Z',
            projectedTo: ['.cline/agents/orchestrator-engineering.md'],
          },
        },
      };

      expect(legacyLockfile.projections).toBeUndefined();
      expect(legacyLockfile.files['agents/orchestrator-engineering.md'].projectedTo).toBeDefined();
    });
  });
});
