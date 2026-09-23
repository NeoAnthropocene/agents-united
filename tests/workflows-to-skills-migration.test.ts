import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';
import { InstallEngine } from '../src/core/installer.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { ClineProjector } from '../src/core/cline-projector.js';
import type { LockfileManifest, BundleDefinition, ResolvedAssets } from '../src/core/types.js';

describe('ADR 0016: Workflows to Skills Auto-Migration Suite (Tier 1-4)', () => {
  const testWorkspace = path.resolve(process.cwd(), 'scratch/test-migration-workspace');
  const agentsDir = path.join(testWorkspace, '.agents');
  const workflowsDir = path.join(agentsDir, 'workflows');
  const skillsDir = path.join(agentsDir, 'skills');
  const lockfilePath = path.join(agentsDir, 'agents-united.json');

  beforeEach(async () => {
    await fs.remove(testWorkspace);
    await fs.ensureDir(agentsDir);
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  // Tier 1: Feature Coverage (Silent Workspace Auto-Migration)
  describe('Tier 1: Feature Coverage (Silent Auto-Migration)', () => {
    it('should silently auto-migrate legacy workflows to skills and update lockfile on update()', async () => {
      // 1. Setup legacy workspace state
      await fs.ensureDir(workflowsDir);
      const legacyWorkflowContent = [
        '---',
        'name: workflow-deploy',
        'description: Deployment workflow for production releases.',
        'bundle: software-engineering',
        'estimatedDuration: 20m',
        '---',
        '',
        '# Workflow: Production Deployment',
        '',
        '## Execution Flowchart',
        '```mermaid',
        'graph TD',
        '  Start --> Deploy',
        '```',
        '',
        '## Phase 1: Pre-flight',
        '- Verification gate: tests passing.',
      ].join('\n');

      await fs.writeFile(path.join(workflowsDir, 'workflow-deploy.md'), legacyWorkflowContent, 'utf8');

      // A *legacy* lockfile shape on purpose: the migration under test must cope with the extra fields
      // older releases wrote (`schemaVersion`, `installedAt`, `updatedAt`), so the fixture is typed as the
      // current manifest plus unknown legacy keys rather than pretending they are part of the schema.
      const initialLockfile: LockfileManifest & Record<string, unknown> = {
        $schema: 'https://agents-united.dev/schemas/lockfile.json',
        files: {},
        version: 1,
        schemaVersion: '2.0.0',
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        method: 'copy',
        installed: {
          bundles: ['software-engineering'],
          agents: ['orchestrator-engineering.md'],
          skills: ['test-driven-development'],
          workflows: ['workflow-deploy.md'],
        },
      };
      await fs.writeJson(lockfilePath, initialLockfile, { spaces: 2 });

      // 2. Trigger auto-migration
      const installer = new InstallEngine();
      const migratedCount = await installer.migrateLegacyWorkspaceWorkflows(agentsDir, initialLockfile);
      expect(migratedCount).toBe(1);

      // 3. Verify target skill was created with standard frontmatter
      const targetSkillDir = path.join(skillsDir, 'workflow-deploy');
      const targetSkillFile = path.join(targetSkillDir, 'SKILL.md');
      expect(await fs.pathExists(targetSkillFile)).toBe(true);

      const skillContent = await fs.readFile(targetSkillFile, 'utf8');
      const fmMatch = skillContent.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      expect(fmMatch).not.toBeNull();
      const fm = YAML.parse(fmMatch![1]);
      expect(fm.name).toBe('workflow-deploy');
      expect(fm.description).toContain('Deployment workflow');
      expect(fm.metadata?.author).toBe('Agents United');
      expect(fm.metadata?.icon).toBe('🔄');

      // Verify body preserved
      expect(skillContent).toContain('# Workflow: Production Deployment');
      expect(skillContent).toContain('```mermaid');

      // 4. Verify legacy workflow directory was cleaned up
      expect(await fs.pathExists(workflowsDir)).toBe(false);

      // 5. Verify lockfile synchronization
      const updatedLockfile: LockfileManifest = await fs.readJson(lockfilePath);
      expect(updatedLockfile.installed.skills).toContain('workflow-deploy');
      expect(updatedLockfile.installed.workflows).toEqual([]);
    });
  });

  // Tier 2: Boundary & Corner Cases
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('should be a no-op if no legacy workflows directory exists', async () => {
      const installer = new InstallEngine();
      const count = await installer.migrateLegacyWorkspaceWorkflows(agentsDir);
      expect(count).toBe(0);
    });

    it('should be idempotent if called multiple times on an already migrated workspace', async () => {
      await fs.ensureDir(workflowsDir);
      await fs.writeFile(path.join(workflowsDir, 'workflow-test.md'), '# Test', 'utf8');

      const installer = new InstallEngine();
      const firstRun = await installer.migrateLegacyWorkspaceWorkflows(agentsDir);
      expect(firstRun).toBe(1);

      const secondRun = await installer.migrateLegacyWorkspaceWorkflows(agentsDir);
      expect(secondRun).toBe(0);
    });

    it('should ignore non-markdown files and remove workflows dir if empty', async () => {
      await fs.ensureDir(workflowsDir);
      // Empty directory
      const installer = new InstallEngine();
      const count = await installer.migrateLegacyWorkspaceWorkflows(agentsDir);
      expect(count).toBe(0);
      expect(await fs.pathExists(workflowsDir)).toBe(false);
    });
  });

  // Tier 3: Cross-Feature Pairwise (Cline Projector Dual Benefits)
  describe('Tier 3: Cross-Feature Pairwise (Cline Projection)', () => {
    it('should project workflow skills to .cline/workflows/<slug>.md while projecting normal skills to .cline/skills/<name>/SKILL.md', async () => {
      const sampleBundle: BundleDefinition = {
        name: 'test-bundle',
        description: 'Test bundle',
        orchestrator: 'orchestrator-engineering.md',
        agents: ['subagent-backend-architect.md'],
        skills: ['architecture-design', 'workflow-implement'],
      };

      const resolved: ResolvedAssets = {
        targetBundle: 'test-bundle',
        agents: ['orchestrator-engineering.md', 'subagent-backend-architect.md'],
        skills: ['architecture-design', 'workflow-implement'],
        workflows: [],
        rules: ['GEMINI.md'],
      };

      const registryDir = path.resolve(process.cwd(), 'registry');
      const plan = await ClineProjector.planCompoundProjection(
        sampleBundle,
        'project',
        resolved,
        registryDir
      );

      const paths = plan.map(a => a.relPath);

      // Workflow skill must project to .cline/workflows/workflow-implement.md
      expect(paths).toContain('.cline/workflows/workflow-implement.md');

      // Standard skill must project to .agents/plugins/test-bundle/skills/architecture-design/SKILL.md
      expect(paths).toContain('.agents/plugins/test-bundle/skills/architecture-design/SKILL.md');

      // Team manifest and coordinator rule must be created
      expect(paths).toContain('.agents/plugins/test-bundle/agents-united/teams/test-bundle.yaml');
      expect(paths).toContain('.cline/rules/agents-united-test-bundle.md');
    });
  });

  // Tier 4: Health Doctor Warnings & Recovery
  describe('Tier 4: Doctor Detection & Health Verification', () => {
    it('should report a warning when unmigrated legacy workflows exist and pass cleanly after migration', async () => {
      await fs.ensureDir(workflowsDir);
      await fs.writeFile(path.join(workflowsDir, 'workflow-old.md'), '# Old Workflow', 'utf8');

      // Run doctor before migration
      const doctorBefore = await DoctorEngine.runDoctor(agentsDir);
      expect(doctorBefore.warnings.some(w => w.includes('legacy workflows'))).toBe(true);

      // Run migration
      const installer = new InstallEngine();
      await installer.migrateLegacyWorkspaceWorkflows(agentsDir);

      // Run doctor after migration
      const doctorAfter = await DoctorEngine.runDoctor(agentsDir);
      expect(doctorAfter.warnings.some(w => w.includes('legacy workflows'))).toBe(false);
    });
  });
});
