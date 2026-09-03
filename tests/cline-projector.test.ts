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

  describe('Configured Agent (.yml) rendering', () => {
    it('emits Cline configured-agent YAML with name/description frontmatter, stripped Antigravity keys, marker, and runtime note', () => {
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

      const rendered = ClineProjector.renderConfiguredAgent(
        canonicalAgent,
        'agents/subagent-backend-architect.md'
      );

      // Must have YAML frontmatter
      expect(rendered).toMatch(/^---\r?\n/);
      const parts = rendered.split(/---\r?\n/);
      const frontmatter = yaml.parse(parts[1]);

      expect(frontmatter.name).toBe('backend-architect');
      expect(frontmatter.description).toBe('Expert backend architect');
      expect(frontmatter.tools).toBeUndefined();
      expect(frontmatter.permissionMode).toBeUndefined();
      expect(frontmatter.hooks).toBeUndefined();
      expect(frontmatter.version).toBeUndefined();

      // Body contains managed marker and runtime note
      const body = parts.slice(2).join('---');
      expect(body).toContain('<!-- managed-by: agents-united | profile: cline | canonical: agents/subagent-backend-architect.md | do not edit -->');
      expect(body).toContain('## Cline runtime note');
      expect(body).toContain('Always design clean APIs.');
    });

    it('strips the subagent- prefix from the frontmatter name (ADR 0013 decision 2)', () => {
      const canonicalAgent = `---
name: subagent-marketing-growth-strategist
description: Growth funnel architecture specialist
---
Build funnels.
`;
      const rendered = ClineProjector.renderConfiguredAgent(
        canonicalAgent,
        'agents/subagent-marketing-growth-strategist.md'
      );
      const parts = rendered.split(/---\r?\n/);
      const frontmatter = yaml.parse(parts[1]);
      expect(frontmatter.name).toBe('marketing-growth-strategist');
    });

    it('throws when canonical agent lacks frontmatter (configured agents require a name)', () => {
      expect(() =>
        ClineProjector.renderConfiguredAgent('No frontmatter here.', 'agents/broken.md')
      ).toThrow(/missing YAML frontmatter/i);
    });
  });

  describe('Workflow projection rendering', () => {
    it('slugifies the frontmatter name and keeps the human title in description', () => {
      const canonicalWorkflow = `---
name: "Digital Agency Full-Funnel Campaign Orchestration"
description: "End-to-end cross-functional campaign workflow."
bundle: "digital-agency"
---
# Workflow body
Execute phases.
`;
      const slug = ClineProjector.workflowSlug(
        canonicalWorkflow,
        'workflows/workflow-agency-full-campaign.md'
      );
      expect(slug).toBe('digital-agency-full-funnel-campaign-orchestration');

      const rendered = ClineProjector.renderWorkflowProjection(
        canonicalWorkflow,
        'workflows/workflow-agency-full-campaign.md'
      );
      const parts = rendered.split(/---\r?\n/);
      const frontmatter = yaml.parse(parts[1]);
      expect(frontmatter.name).toBe('digital-agency-full-funnel-campaign-orchestration');
      expect(frontmatter.description).toBe('End-to-end cross-functional campaign workflow.');
      expect(frontmatter.bundle).toBeUndefined();

      const body = parts.slice(2).join('---');
      expect(body).toContain('<!-- managed-by: agents-united | profile: cline | canonical: workflows/workflow-agency-full-campaign.md | do not edit -->');
      expect(body).toContain('# Workflow body');
    });

    it('falls back to slugified filename when frontmatter name is missing', () => {
      const canonicalWorkflow = `---
description: "No name field here."
---
Body.
`;
      const slug = ClineProjector.workflowSlug(
        canonicalWorkflow,
        'workflows/workflow-review.md'
      );
      expect(slug).toBe('workflow-review');
    });

    it('slugifyWorkflowName collapses separators and trims dashes', () => {
      expect(ClineProjector.slugifyWorkflowName('  A  B -- C__D  ')).toBe('a-b-c-d');
      expect(ClineProjector.slugifyWorkflowName('--edge--case--')).toBe('edge-case');
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
      expect(rule).toContain('.agents/plugins/software-engineering/agents-united/teams/software-engineering.yaml');
      expect(rule).toContain('orchestrator-engineering');
      expect(rule).toContain('<!-- managed-by: agents-united | profile: cline');
    });
  });

  describe('planCompoundProjection', () => {
    it('generates the ADR 0013 artifact set: plugin.json Agent Plugin manifest, .cline/agents/*.yml, .cline/rules/, .cline/workflows/, skills in package, team manifest', async () => {
      const resolved = {
        agents: ['subagent-backend-architect.md'],
        skills: ['backend-api-design'],
        workflows: ['workflow-implement.md'],
      };
      const registryDir = 'registry';
      const artifacts = await ClineProjector.planCompoundProjection(
        sampleBundle,
        'project',
        resolved,
        registryDir
      );

      // Agent Plugin manifest (.agents/plugins/<bundle>/plugin.json, agent-plugins.org schema)
      const manifestArtifact = artifacts.find(a => a.kind === 'plugin-manifest');
      expect(manifestArtifact).toBeDefined();
      expect(manifestArtifact?.relPath).toBe('.agents/plugins/software-engineering/plugin.json');
      expect(manifestArtifact?.managedMarker).toBe(false);

      const parsedManifest = JSON.parse(manifestArtifact!.content!);
      expect(parsedManifest.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
      expect(parsedManifest.name).toBe('software-engineering');
      expect(parsedManifest.version).toBe('1.0.0');
      expect(parsedManifest.description).toBe('Autonomous software engineering team');
      expect(parsedManifest.cline).toBeUndefined();

      // No legacy package.json projection
      expect(artifacts.find(a => a.relPath.endsWith('/package.json'))).toBeUndefined();

      // Configured agent role -> .cline/agents/backend-architect.yml (subagent- prefix stripped)
      const roleArtifact = artifacts.find(a => a.kind === 'role');
      expect(roleArtifact?.relPath).toBe('.cline/agents/backend-architect.yml');
      expect(roleArtifact?.canonical).toBe('agents/subagent-backend-architect.md');
      expect(roleArtifact?.managedMarker).toBe(true);

      // Skill artifact stays inside the Agent Plugin package (portability lane)
      const skillArtifact = artifacts.find(a => a.kind === 'skill');
      expect(skillArtifact?.relPath).toContain('.agents/plugins/software-engineering/skills/backend-api-design/');

      // Coordinator rule -> .cline/rules/
      const ruleArtifact = artifacts.find(a => a.kind === 'rule');
      expect(ruleArtifact?.relPath).toBe('.cline/rules/agents-united-software-engineering.md');
      expect(ruleArtifact?.managedMarker).toBe(true);

      // Workflows -> .cline/workflows/<slug>.md (kind workflow, slugified)
      const workflowArtifacts = artifacts.filter(a => a.kind === 'workflow');
      for (const wf of workflowArtifacts) {
        expect(wf.relPath).toMatch(/^\.cline\/workflows\/[a-z0-9-]+\.md$/);
        expect(wf.managedMarker).toBe(true);
        const wfFrontmatter = yaml.parse(wf.content!.split(/---\r?\n/)[1]);
        expect(wfFrontmatter.name).toBeTruthy();
      }

      // Team manifest artifact target path (unchanged vendor-namespace location)
      const teamManifestArtifact = artifacts.find(a => a.kind === 'team-manifest');
      expect(teamManifestArtifact?.relPath).toBe('.agents/plugins/software-engineering/agents-united/teams/software-engineering.yaml');
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
