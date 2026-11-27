import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import {
  formatWrappedList,
  formatInstallationSummary,
  wrapText,
  getTerminalContentWidth,
} from '../dist/cli.js';

describe('CLI End-to-End Suite (dist/cli.js)', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/cli.js');
  // Each test gets its own new folder: a fixed name in the shared temp folder let two worktrees running this file at once
  // delete each other's workspace (EBUSY on Windows).
  let e2eDir = '';

  beforeEach(async () => {
    e2eDir = await fs.mkdtemp(path.join(os.tmpdir(), 'au-cli-e2e-'));
  });

  afterEach(async () => {
    // Clear the name first, so a failed mkdtemp in the next beforeEach never leaves a stale or empty path to remove.
    const dir = e2eDir;
    e2eDir = '';
    if (dir) await fs.remove(dir);
  });

  it('should display list of bundles grouped by domain', () => {
    const stdout = execSync(`node "${cliPath}" list`, { encoding: 'utf8' });
    expect(stdout).toContain('Agents United — Registry Catalog Tree');
    expect(stdout).toContain('software-engineering');
    expect(stdout).toContain('mobile-development');
    expect(stdout).toContain('ai-ml-engineering');
    expect(stdout).toContain('growth-marketing');
    expect(stdout).toContain('seo-content-marketing');
    expect(stdout).toContain('Developers only: contribute to Agents United');
    expect(stdout).toContain('agent-factory');
  });

  it('should search for bundles and skills with find command and support --json', () => {
    const stdout = execSync(`node "${cliPath}" find software`, { encoding: 'utf8' });
    expect(stdout).toContain('software-engineering');

    const jsonStdout = execSync(`node "${cliPath}" find playwright --json`, { encoding: 'utf8' });
    const parsed = JSON.parse(jsonStdout);
    expect(parsed.skills).toContain('playwright-best-practices');
  });

  it('should support listing bundles as JSON with list --json', () => {
    const stdout = execSync(`node "${cliPath}" list --json`, { encoding: 'utf8' });
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((b: any) => b.name === 'software-engineering')).toBe(true);
  });

  it('should support listing full static catalog tree with list --tree', () => {
    const stdout = execSync(`node "${cliPath}" list --tree`, { encoding: 'utf8' });
    expect(stdout).toContain('Agents United — Registry Catalog Tree');
    expect(stdout).toContain('software-engineering');
    expect(stdout).toContain('universal-skills');
  });

  it('keeps the populated contributor toolkit discoverable through JSON list and domain search', () => {
    const list = JSON.parse(execSync(`node "${cliPath}" list --json`, { encoding: 'utf8' })) as Array<{
      name: string; domain?: string; tier?: string; status?: string; agents?: string[]; skills?: string[];
    }>;
    const factory = list.find(bundle => bundle.name === 'agent-factory');
    expect(factory).toMatchObject({ domain: 'contributor', tier: 'domain', status: 'under-construction', agents: [] });
    expect([...(factory?.skills ?? [])].sort()).toEqual(['author-bundle', 'author-contract', 'author-rule', 'author-skill', 'coordinate-artifact', 'evaluate-artifact', 'git-guardrails', 'handoff', 'host-agent-router', 'realize-artifact', 'repo-doctor', 'sync-host']);
    const search = JSON.parse(execSync(`node "${cliPath}" find --category contributor --type bundle --json`, { encoding: 'utf8' })) as {
      bundles: Array<{ name: string }>;
    };
    expect(search.bundles.map(bundle => bundle.name)).toEqual(['agent-factory']);
  });

  it.each([
    { label: 'default Antigravity target with the construction override', flags: ['--allow-under-construction'] },
    { label: 'default target with force', flags: ['--force'] },
    { label: 'default target with both overrides', flags: ['--allow-under-construction', '--force'] },
    { label: 'default target in dry-run mode', flags: ['--dry-run', '--allow-under-construction', '--force'] },
    { label: 'Claude without the native lane', flags: ['-t', 'claude', '--allow-under-construction', '--force'] },
    { label: 'Claude global scope', flags: ['-t', 'claude', '--native', '--global', '--allow-under-construction', '--force'] },
    { label: 'Cline native target', flags: ['-t', 'cline', '--native', '--allow-under-construction', '--force'] },
    { label: 'mixed Claude and Cline targets', flags: ['-t', 'claude,cline', '--native', '--allow-under-construction', '--force'] },
  ])('refuses factory installation for $label before writing any files', async ({ flags }) => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'agent-factory', '-y', '--copy', ...flags], {
      cwd: e2eDir, encoding: 'utf8',
    });
    expect(result.status, result.stdout + result.stderr).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/unavailable|requires.*native|availability/i);
    expect(output).not.toContain('successfully');
    expect(await fs.readdir(e2eDir)).toEqual([]);
  });

  it('keeps the factory construction gate before native Claude installation', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'agent-factory', '-t', 'claude', '--native', '-y', '--copy'], {
      cwd: e2eDir, encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('currently under construction');
    expect(await fs.readdir(e2eDir)).toEqual([]);
  });

  it('installs the factory in a fresh Claude workspace with its native loading and attribution files', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'agent-factory', '-t', 'claude', '--native', '--allow-under-construction', '-y', '--copy'], {
      cwd: e2eDir, encoding: 'utf8',
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const entry = await fs.readFile(path.join(e2eDir, '.claude/skills/author-skill/SKILL.md'), 'utf8');
    expect(entry).toMatch(/context: fork/);
    expect(entry).toMatch(/agent: general-purpose/);
    expect(entry).toMatch(/background: false/);
    const rule = '.claude/skills/author-skill/references/skill-attribution.md';
    expect(await fs.pathExists(path.join(e2eDir, rule))).toBe(true);
    expect(await fs.pathExists(path.join(e2eDir, '.claude/rules/skill-attribution.md'))).toBe(false);
    expect(await fs.pathExists(path.join(e2eDir, '.claude/skills/author-skill/evals'))).toBe(false);
    expect(await fs.pathExists(path.join(e2eDir, '.agents'))).toBe(false);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toEqual(['agent-factory']);
    expect(lock.projections[rule]).toMatchObject({ host: 'claude', kind: 'rule', canonical: 'rules/skill-attribution.md', owners: ['agent-factory'] });
  });

  it('installs the native devops-engineer for devops-engineering with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'devops-engineering', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/devops-engineer.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: devops-engineer$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('devops-engineering');
    expect(lock.projections['.claude/agents/devops-engineer.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-devops-engineer.md' });
  });

  it('installs the native security-engineer for security-operations with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'security-operations', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/security-engineer.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: security-engineer$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('security-operations');
    expect(lock.projections['.claude/agents/security-engineer.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-security-engineer.md' });
    // The bundle's lead comes native too, and it is no first-message agent: the domain tier has no mode line.
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-security.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lead).toMatch(/^name: orchestrator-security$/m);
    expect(lead).toContain('Agent(appsec-penetration-tester, cloud-security-architect, compliance-grc-specialist, security-engineer)');
    expect(lock.projections['.claude/agents/orchestrator-security.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-security.md' });
  });

  it('installs the native cloud-security-architect for secops-cloud-security with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'secops-cloud-security', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/cloud-security-architect.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: cloud-security-architect$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('secops-cloud-security');
    expect(lock.projections['.claude/agents/cloud-security-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-cloud-security-architect.md' });
  });

  it('installs the native appsec-penetration-tester for secops-application-security with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'secops-application-security', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/appsec-penetration-tester.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: appsec-penetration-tester$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('secops-application-security');
    expect(lock.projections['.claude/agents/appsec-penetration-tester.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-appsec-penetration-tester.md' });
  });

  it('installs the native compliance-grc-specialist for secops-compliance-grc with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'secops-compliance-grc', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/compliance-grc-specialist.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: compliance-grc-specialist$/m);
    expect(text).toContain('## Working with peers');
    expect(await fs.pathExists(path.join(e2eDir, '.claude/agents/agency-compliance-grc-specialist.md'))).toBe(false);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('secops-compliance-grc');
    expect(lock.projections['.claude/agents/compliance-grc-specialist.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-compliance-grc-specialist.md' });
  });

  it('installs the native accessibility-lead for frontend-engineering with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'frontend-engineering', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/accessibility-lead.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: accessibility-lead$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('frontend-engineering');
    expect(lock.projections['.claude/agents/accessibility-lead.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-accessibility-lead.md' });
  });

  it('installs the native design lead, ui-designer, ux-strategist and interaction-designer for product-design with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'product-design', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('product-design');
    for (const role of ['interaction-designer', 'ui-designer', 'ux-strategist']) {
      const text = await fs.readFile(path.join(e2eDir, `.claude/agents/${role}.md`), 'utf8');
      expect(text, role).toContain('profile: claude-native');
      expect(text, role).toMatch(new RegExp(`^name: ${role}$`, 'm'));
      expect(text, role).toContain('## Working with peers');
      expect(lock.projections[`.claude/agents/${role}.md`], role).toMatchObject({ host: 'claude', kind: 'role', canonical: `agents/subagent-${role}.md` });
    }
    // The design lead: a coordinator keeps its own name, and a domain lead carries no Working with peers section.
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-design.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lead).toMatch(/^name: orchestrator-design$/m);
    expect(lock.projections['.claude/agents/orchestrator-design.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-design.md' });
  });

  it('installs the native lead and system-architect for system-architecture with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'system-architecture', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/system-architect.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: system-architect$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('system-architecture');
    expect(lock.projections['.claude/agents/system-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-system-architect.md' });
    expect(lock.projections['.claude/agents/backend-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-backend-architect.md' });
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-system-architecture.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lead).toMatch(/^name: orchestrator-system-architecture$/m);
    expect(lead).toContain('claude --agent orchestrator-system-architecture');
    expect(lock.projections['.claude/agents/orchestrator-system-architecture.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-system-architecture.md' });
  });

  it('installs the native growth-marketing lead and its five marketing roles with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'growth-marketing', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-marketing.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lead).toMatch(/^name: orchestrator-marketing$/m);
    expect(lead).toContain('claude --agent orchestrator-marketing');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('growth-marketing');
    expect(lock.projections['.claude/agents/orchestrator-marketing.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-marketing.md' });
    for (const role of ['growth-strategist', 'creative-designer', 'content-strategist', 'conversion-specialist', 'campaign-specialist']) {
      const text = await fs.readFile(path.join(e2eDir, `.claude/agents/marketing-${role}.md`), 'utf8');
      expect(text, role).toContain('profile: claude-native');
      expect(lock.projections[`.claude/agents/marketing-${role}.md`], role).toMatchObject({ host: 'claude', kind: 'role', canonical: `agents/subagent-marketing-${role}.md` });
    }
  });

  it('installs the native deep-research and socratic-mentor for deep-research with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'deep-research', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    for (const role of ['deep-research', 'socratic-mentor']) {
      const text = await fs.readFile(path.join(e2eDir, `.claude/agents/${role}.md`), 'utf8');
      expect(text, role).toContain('profile: claude-native');
      expect(text, role).toMatch(new RegExp(`^name: ${role}$`, 'm'));
      expect(text, role).toContain('## Working with peers');
    }
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('deep-research');
    expect(lock.projections['.claude/agents/deep-research.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-deep-research.md' });
    expect(lock.projections['.claude/agents/socratic-mentor.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-socratic-mentor.md' });
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-research.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lead).toMatch(/^name: orchestrator-research$/m);
    expect(lead).toContain('claude --agent orchestrator-research');
    expect(lock.projections['.claude/agents/orchestrator-research.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-research.md' });
  });

  it('installs the native lead and business-panel-experts for business-strategy with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'business-strategy', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/business-panel-experts.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: business-panel-experts$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('business-strategy');
    expect(lock.projections['.claude/agents/business-panel-experts.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-business-panel-experts.md' });
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-business.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lead).toMatch(/^name: orchestrator-business$/m);
    expect(lead).toContain('claude --agent orchestrator-business');
    expect(lock.projections['.claude/agents/orchestrator-business.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-business.md' });
  });

  it('installs the native Prime Orchestrator for universal-orchestration with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'universal-orchestration', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('universal-orchestration');
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-universal.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lead).toMatch(/^name: orchestrator-universal$/m);
    expect(lead).toContain('claude --agent orchestrator-universal');
    expect(lock.projections['.claude/agents/orchestrator-universal.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-universal.md' });
    expect(await fs.pathExists(path.join(e2eDir, '.claude/hooks/agents-united-guard.js'))).toBe(true);
  });

  it('installs the native design-systems-architect and design-ops-lead for design-systems-ops with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'design-systems-ops', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('design-systems-ops');
    for (const role of ['design-ops-lead', 'design-systems-architect']) {
      const text = await fs.readFile(path.join(e2eDir, `.claude/agents/${role}.md`), 'utf8');
      expect(text, role).toContain('profile: claude-native');
      expect(text, role).toMatch(new RegExp(`^name: ${role}$`, 'm'));
      expect(text, role).toContain('## Working with peers');
      expect(lock.projections[`.claude/agents/${role}.md`], role).toMatchObject({ host: 'claude', kind: 'role', canonical: `agents/subagent-${role}.md` });
    }
  });

  it('installs the native design-researcher, designer-toolkit-expert and prototype-tester for design-research-testing with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'design-research-testing', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('design-research-testing');
    for (const role of ['design-researcher', 'designer-toolkit-expert', 'prototype-tester']) {
      const text = await fs.readFile(path.join(e2eDir, `.claude/agents/${role}.md`), 'utf8');
      expect(text, role).toContain('profile: claude-native');
      expect(text, role).toMatch(new RegExp(`^name: ${role}$`, 'm'));
      expect(text, role).toContain('## Working with peers');
      expect(lock.projections[`.claude/agents/${role}.md`], role).toMatchObject({ host: 'claude', kind: 'role', canonical: `agents/subagent-${role}.md` });
    }
  });

  it('installs the native finops-cost-engineer, system-architect, the parent natives and the architecture lead for system-architecture-finops with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'system-architecture-finops', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/finops-cost-engineer.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: finops-cost-engineer$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('system-architecture-finops');
    expect(lock.projections['.claude/agents/finops-cost-engineer.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-finops-cost-engineer.md' });
    expect(lock.projections['.claude/agents/system-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-system-architect.md' });
    expect(lock.projections['.claude/agents/backend-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-backend-architect.md' });
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-system-architecture.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lock.projections['.claude/agents/orchestrator-system-architecture.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-system-architecture.md' });
  });

  it('installs the native database-administrator, backend-architect, the parent natives and the architecture lead for system-architecture-data with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'system-architecture-data', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/database-administrator.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: database-administrator$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('system-architecture-data');
    expect(lock.projections['.claude/agents/database-administrator.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-database-administrator.md' });
    expect(lock.projections['.claude/agents/backend-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-backend-architect.md' });
    expect(lock.projections['.claude/agents/system-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-system-architect.md' });
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-system-architecture.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lock.projections['.claude/agents/orchestrator-system-architecture.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-system-architecture.md' });
  });

  it('installs the native sysops-sre-lead, its parent natives and the architecture lead for sysops-sre with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'sysops-sre', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/sysops-sre-lead.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: sysops-sre-lead$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('sysops-sre');
    expect(lock.projections['.claude/agents/sysops-sre-lead.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-sysops-sre-lead.md' });
    expect(lock.projections['.claude/agents/system-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-system-architect.md' });
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-system-architecture.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lock.projections['.claude/agents/orchestrator-system-architecture.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-system-architecture.md' });
  });

  it('installs the native cloud-infrastructure-architect, system-architect, the parent natives and the architecture lead for system-architecture-cloud with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'system-architecture-cloud', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/cloud-infrastructure-architect.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: cloud-infrastructure-architect$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('system-architecture-cloud');
    expect(lock.projections['.claude/agents/cloud-infrastructure-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-cloud-infrastructure-architect.md' });
    expect(lock.projections['.claude/agents/system-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-system-architect.md' });
    const lead = await fs.readFile(path.join(e2eDir, '.claude/agents/orchestrator-system-architecture.md'), 'utf8');
    expect(lead).toContain('profile: claude-native');
    expect(lock.projections['.claude/agents/orchestrator-system-architecture.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/orchestrator-system-architecture.md' });
  });

  it('installs the native seo-specialist with the seo-content-marketing add-on with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'seo-content-marketing', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/seo-specialist.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: seo-specialist$/m);
    expect(text).toContain('Crawl and indexation reconnaissance first');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('seo-content-marketing');
    expect(lock.projections['.claude/agents/seo-specialist.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-seo-specialist.md' });
  });

  it('installs the native paid-acquisition-specialist with the performance-paid-acquisition add-on with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'performance-paid-acquisition', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/paid-acquisition-specialist.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: paid-acquisition-specialist$/m);
    expect(text).toContain('Architect the campaign by funnel stage');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('performance-paid-acquisition');
    expect(lock.projections['.claude/agents/paid-acquisition-specialist.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-paid-acquisition-specialist.md' });
  });

  it('installs the native plg-strategist with the product-led-growth add-on with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'product-led-growth', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/plg-strategist.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: plg-strategist$/m);
    expect(text).toContain('Shorten the path to the activation moment');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('product-led-growth');
    expect(lock.projections['.claude/agents/plg-strategist.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-plg-strategist.md' });
  });

  it('installs the native lifecycle-email-specialist with the lifecycle-email-marketing add-on with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'lifecycle-email-marketing', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/lifecycle-email-specialist.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: lifecycle-email-specialist$/m);
    expect(text).toContain('Architect the behavior-triggered journeys');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('lifecycle-email-marketing');
    expect(lock.projections['.claude/agents/lifecycle-email-specialist.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-lifecycle-email-specialist.md' });
  });

  it('installs the native statistical-analyst and literature-patent-analyst for deep-research-analytics with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'deep-research-analytics', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    for (const role of ['statistical-analyst', 'literature-patent-analyst']) {
      const text = await fs.readFile(path.join(e2eDir, `.claude/agents/${role}.md`), 'utf8');
      expect(text, role).toContain('profile: claude-native');
      expect(text, role).toMatch(new RegExp(`^name: ${role}$`, 'm'));
      expect(text, role).toContain('## Working with peers');
    }
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('deep-research-analytics');
    expect(lock.projections['.claude/agents/statistical-analyst.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-statistical-analyst.md' });
    expect(lock.projections['.claude/agents/literature-patent-analyst.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-literature-patent-analyst.md' });
  });

  it('installs the native financial-analyst for business-financial-modeling with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'business-financial-modeling', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/financial-analyst.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: financial-analyst$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('business-financial-modeling');
    expect(lock.projections['.claude/agents/financial-analyst.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-financial-analyst.md' });
  });

  it('installs the native market-intelligence-analyst for business-market-intelligence with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'business-market-intelligence', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/market-intelligence-analyst.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: market-intelligence-analyst$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('business-market-intelligence');
    expect(lock.projections['.claude/agents/market-intelligence-analyst.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-market-intelligence-analyst.md' });
  });

  it('installs the native legal-contract-analyst and operations-strategist for business-operations-legal with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'business-operations-legal', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('business-operations-legal');
    for (const role of ['legal-contract-analyst', 'operations-strategist']) {
      const text = await fs.readFile(path.join(e2eDir, `.claude/agents/${role}.md`), 'utf8');
      expect(text, role).toContain('profile: claude-native');
      expect(text, role).toMatch(new RegExp(`^name: ${role}$`, 'm'));
      expect(text, role).toContain('## Working with peers');
      expect(lock.projections[`.claude/agents/${role}.md`], role).toMatchObject({ host: 'claude', kind: 'role', canonical: `agents/subagent-${role}.md` });
    }
  });

  it('installs the native qa-automation-lead for qa-automation with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'qa-automation', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/qa-automation-lead.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: qa-automation-lead$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('qa-automation');
    expect(lock.projections['.claude/agents/qa-automation-lead.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-qa-automation-lead.md' });
  });

  it('installs the native e2e-tester for qa-automation with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'qa-automation', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/e2e-tester.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: e2e-tester$/m);
    expect(text).toContain('## Working with peers');
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('qa-automation');
    expect(lock.projections['.claude/agents/e2e-tester.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-e2e-tester.md' });
  });

  it('installs the native distributed-systems-architect and data-engineer for backend-distributed-systems with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'backend-distributed-systems', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('backend-distributed-systems');
    for (const role of ['distributed-systems-architect', 'data-engineer']) {
      const text = await fs.readFile(path.join(e2eDir, `.claude/agents/${role}.md`), 'utf8');
      expect(text, role).toContain('profile: claude-native');
      expect(text, role).toMatch(new RegExp(`^name: ${role}$`, 'm'));
      expect(text, role).toContain('## Working with peers');
      expect(lock.projections[`.claude/agents/${role}.md`], role).toMatchObject({ host: 'claude', kind: 'role', canonical: `agents/subagent-${role}.md` });
    }
  });

  it('installs the native ios-architect, android-architect and cross-platform-specialist for mobile-development with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'mobile-development', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('mobile-development');
    for (const role of ['ios-architect', 'android-architect', 'cross-platform-specialist']) {
      const text = await fs.readFile(path.join(e2eDir, `.claude/agents/${role}.md`), 'utf8');
      expect(text, role).toContain('profile: claude-native');
      expect(text, role).toMatch(new RegExp(`^name: ${role}$`, 'm'));
      expect(text, role).toContain('## Working with peers');
      expect(lock.projections[`.claude/agents/${role}.md`], role).toMatchObject({ host: 'claude', kind: 'role', canonical: `agents/subagent-${role}.md` });
    }
  });

  it('installs the native ml-platform-engineer for ai-ml-engineering with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'ai-ml-engineering', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/ml-platform-engineer.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: ml-platform-engineer$/m);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('ai-ml-engineering');
    expect(lock.projections['.claude/agents/ml-platform-engineer.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-ml-platform-engineer.md' });
  });

  it('installs the native ai-model-architect for ai-ml-engineering with -t claude --native', async () => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'ai-ml-engineering', '-t', 'claude', '--native', '-y', '--copy'], { cwd: e2eDir, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = await fs.readFile(path.join(e2eDir, '.claude/agents/ai-model-architect.md'), 'utf8');
    expect(text).toContain('profile: claude-native');
    expect(text).toMatch(/^name: ai-model-architect$/m);
    const lock = await fs.readJson(path.join(e2eDir, '.claude/.agents-united/agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.installed.bundles).toContain('ai-ml-engineering');
    expect(lock.projections['.claude/agents/ai-model-architect.md']).toMatchObject({ host: 'claude', kind: 'role', canonical: 'agents/subagent-ai-model-architect.md' });
  });

  it.each(['domain:contributor', 'domain:CONTRIBUTOR'])('refuses %s as an ordinary department install', async identifier => {
    const result = spawnSync(process.execPath, [cliPath, 'add', identifier, '-y', '--copy'], {
      cwd: e2eDir, encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('not an end-user department');
    expect(await fs.readdir(e2eDir)).toEqual([]);
  });

  it.each([
    { label: 'without an override', flags: [], status: 1 },
    { label: 'with the construction override', flags: ['--allow-under-construction'], status: 0 },
    { label: 'with force', flags: ['--force'], status: 0 },
  ])('preserves the existing draft construction gate $label', async ({ flags, status }) => {
    const result = spawnSync(process.execPath, [cliPath, 'add', 'mock-tba', '-y', '--copy', '--dry-run', ...flags], {
      cwd: e2eDir, encoding: 'utf8',
    });
    expect(result.status).toBe(status);
    const output = result.stdout + result.stderr;
    if (status === 0) expect(output).toContain('[DRY RUN]');
    else expect(output).toContain('currently under construction');
    expect(await fs.readdir(e2eDir)).toEqual([]);
  });

  it('should add and remove bundles in non-interactive mode with -y flag', async () => {
    const addStdout = execSync(`node "${cliPath}" add software-engineering -y -s`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(addStdout).toContain('Installed "software-engineering" successfully');

    expect(await fs.pathExists(path.join(e2eDir, '.agents', 'agents-united.json'))).toBe(true);

    const removeStdout = execSync(`node "${cliPath}" remove software-engineering -y`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    // Honest summary contract: `Removed "<id>" from this workspace — N deleted, M kept`. The old
    // "Successfully removed N files" claimed deletion even when every asset was co-owned and kept.
    expect(removeStdout).toContain('Removed "software-engineering" from this workspace');
    expect(removeStdout).toContain('deleted');
  });

  it('should support copy mode flag --copy', async () => {
    const stdout = execSync(`node "${cliPath}" add product-design -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(stdout).toContain('Installed "product-design" successfully');

    const lockfile = await fs.readJson(path.join(e2eDir, '.agents', 'agents-united.json'));
    expect(lockfile.method).toBe('copy');
  });

  it('should print the projection plan for --fanout in dry-run mode', async () => {
    const stdout = execSync(
      `node "${cliPath}" add software-engineering -t agents --fanout claude,cline -y --copy --dry-run`,
      { cwd: e2eDir, encoding: 'utf8' }
    );
    expect(stdout).toContain('[DRY RUN]');
    expect(stdout).toContain('Projection');
    expect(stdout).toContain('claude');
    expect(stdout).toContain('.claude/');
    // dry-run must not write anything anywhere
    expect(await fs.pathExists(path.join(e2eDir, '.claude'))).toBe(false);
    expect(await fs.pathExists(path.join(e2eDir, '.cline'))).toBe(false);
  });

  it('should not print projection lines without --fanout', async () => {
    const stdout = execSync(
      `node "${cliPath}" add software-engineering -t agents -y --copy --dry-run`,
      { cwd: e2eDir, encoding: 'utf8' }
    );
    expect(stdout).toContain('[DRY RUN]');
    expect(stdout).not.toMatch(/Projection/i);
    expect(stdout).not.toContain('.claude/');
  });

  it('should warn and drop invalid --fanout hosts while keeping exit code 0', () => {
    const res = spawnSync(process.execPath, [
      cliPath,
      'add',
      'software-engineering',
      '-t',
      'agents',
      '--fanout',
      'nope',
      '-y',
      '--copy',
      '--dry-run',
    ], { cwd: e2eDir, encoding: 'utf8' });
    const output = (res.stdout || '') + (res.stderr || '');
    expect(res.status).toBe(0);
    expect(output).toMatch(/invalid|unknown|ignoring/i);
    expect(output).toContain('valid');
  });

  it('accepts --fanout when PowerShell has flattened the comma list to a space (owner field test, 2026-09-28)', () => {
    // Windows PowerShell parses an unquoted `claude,cline` as an array literal and flattens it
    // to one space-joined argument when invoking a native command, so Node never sees the comma.
    // Passing the two words as ONE argv element (not two separate '--fanout' args) reproduces
    // exactly what the owner observed on Windows: a single string "claude cline".
    const res = spawnSync(process.execPath, [
      cliPath,
      'add',
      'software-engineering',
      '-t',
      'agents',
      '--fanout',
      'claude cline',
      '-y',
      '--copy',
      '--dry-run',
    ], { cwd: e2eDir, encoding: 'utf8' });
    const output = (res.stdout || '') + (res.stderr || '');
    expect(res.status).toBe(0);
    expect(output).not.toMatch(/Ignoring invalid fanout/i);
    expect(output).toMatch(/claude/i);
    expect(output).toMatch(/cline/i);
  });

  it('refuses under-development --fanout hosts on add with a non-zero exit', () => {
    const res = spawnSync(process.execPath, [
      cliPath,
      'add',
      'software-engineering',
      '-t',
      'agents',
      '--fanout',
      'cursor',
      '-y',
      '--copy',
      '--dry-run',
    ], { cwd: e2eDir, encoding: 'utf8' });
    const output = (res.stdout || '') + (res.stderr || '');
    expect(res.status).toBe(1);
    expect(output).toMatch(/refusing/i);
    expect(output).toMatch(/under development/i);
    expect(output).toContain('cursor');
  });

  it('refuses under-development --fanout hosts on update with a non-zero exit', () => {
    execSync(`node "${cliPath}" add software-engineering -t agents -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    const res = spawnSync(process.execPath, [
      cliPath,
      'update',
      'software-engineering',
      '--fanout',
      'opencode',
      '-y',
    ], { cwd: e2eDir, encoding: 'utf8' });
    const output = (res.stdout || '') + (res.stderr || '');
    expect(res.status).toBe(1);
    expect(output).toMatch(/refusing/i);
    expect(output).toContain('opencode');
  });

  it('update --fanout projects a bundle that was installed without fanout (fix scenario)', async () => {
    // Original install: Universal (.agents) only, no fanout — the reported bug scenario
    execSync(`node "${cliPath}" add software-engineering -t agents -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(await fs.pathExists(path.join(e2eDir, '.agents', 'plugins'))).toBe(false);

    // Update WITH fanout repairs the install by projecting into Cline
    const stdout = execSync(`node "${cliPath}" update software-engineering --fanout cline -y`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(stdout).toContain('Successfully processed update');
    expect(stdout).toContain('Updated Projections');
    expect(stdout).toContain('+ cline');

    const clineProj = path.join(e2eDir, '.cline', 'agents', 'orchestrator-engineering.yml');
    expect(await fs.pathExists(clineProj)).toBe(true);
    expect(await fs.readFile(clineProj, 'utf8')).toContain('managed-by: agents-united');

    // And the fanout is now persisted in the lockfile for future updates
    const lockfile = await fs.readJson(path.join(e2eDir, '.agents', 'agents-united.json'));
    expect(lockfile.fanout).toContain('cline');

    // Subsequent update without flags inherits fanout from lockfile and prints Updated Projections
    const stdout2 = execSync(`node "${cliPath}" update software-engineering -y`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(stdout2).toContain('Successfully processed update');
    expect(stdout2).toContain('Updated Projections');
    expect(stdout2).toContain('+ cline');
  });

  it('reroutes -t cline to the main library + translated copies', async () => {
    const stdout = execSync(`node "${cliPath}" add software-engineering -t cline -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(stdout).toContain('Installed "software-engineering" successfully');
    expect(stdout).toMatch(/main library/i);

    // Canonical store installed AND translated Cline copies written
    expect(await fs.pathExists(path.join(e2eDir, '.agents', 'agents-united.json'))).toBe(true);
    const proj = await fs.readFile(
      path.join(e2eDir, '.cline', 'agents', 'orchestrator-engineering.yml'),
      'utf8'
    );
    expect(proj).toContain('managed-by: agents-united');
    expect(proj).not.toContain('hooks:');
  });

  it('keeps the native lane opt-in: legacy files without the flag, the native package with --native, and the legacy files back with --no-native', async () => {
    const run = (extra: string) => execSync(`node "${cliPath}" add software-engineering -t cline -y --copy ${extra}`, { cwd: e2eDir, encoding: 'utf8' });
    const agent = (role: string) => path.join(e2eDir, '.cline', 'agents', `${role}.yml`);
    const guard = path.join(e2eDir, '.cline', 'plugins', 'agents-united-guard.js');

    run('');
    expect(await fs.readFile(agent('code-reviewer'), 'utf8')).not.toContain('cline-native');
    expect(await fs.pathExists(agent('orchestrator-engineering'))).toBe(true);
    expect(await fs.pathExists(guard)).toBe(false);

    run('--native');
    expect(await fs.readFile(agent('code-reviewer'), 'utf8')).toContain('profile: cline-native');
    expect(await fs.pathExists(agent('orchestrator-engineering'))).toBe(false);
    expect(await fs.pathExists(guard)).toBe(true);

    run('');
    expect(await fs.pathExists(guard)).toBe(true); // sticky: an install without the flag keeps the recorded choice

    run('--no-native');
    expect(await fs.readFile(agent('code-reviewer'), 'utf8')).not.toContain('cline-native');
    expect(await fs.pathExists(guard)).toBe(false);
  });

  it('prints a plain-language sync tip when installing without fanout', async () => {
    const stdout = execSync(`node "${cliPath}" add software-engineering -t agents -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(stdout).toMatch(/Antigravity reads the main library/i);
    expect(stdout).toMatch(/\.agents\/skills\//i);
    expect(stdout).toContain('--fanout');
  });

  it('prints a sync tip after update when the bundle is not synced to other assistants', async () => {
    execSync(`node "${cliPath}" add software-engineering -t agents -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    const stdout = execSync(`node "${cliPath}" update software-engineering -y`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(stdout).toContain('Successfully processed update');
    expect(stdout).toContain('--fanout');
  });

  it('should run doctor health check', () => {
    execSync(`node "${cliPath}" add software-engineering -y`, { cwd: e2eDir, encoding: 'utf8' });
    const stdout = execSync(`node "${cliPath}" doctor`, { cwd: e2eDir, encoding: 'utf8' });
    expect(stdout).toContain('Installed Agents');
  });

  it('should detect existing agent hosts in workspace correctly', async () => {
    const { detectWorkspaceHosts } = await import('../src/cli.js');
    await fs.ensureDir(path.join(e2eDir, '.gemini'));
    await fs.ensureDir(path.join(e2eDir, '.claude'));
    await fs.ensureDir(path.join(e2eDir, '.cline'));
    await fs.ensureDir(path.join(e2eDir, '.opencode'));
    await fs.writeFile(path.join(e2eDir, 'AGENTS.md'), '# ws\n');

    const detected = detectWorkspaceHosts(e2eDir);
    expect(detected).toContain('gemini');
    expect(detected).toContain('claude');
    expect(detected).not.toContain('cursor');
    expect(detected).toContain('cline');
    expect(detected).toContain('opencode');
    expect(detected).toContain('codex');
  });

  it('should handle update command with --all and --dry-run', async () => {
    // Install first
    execSync(`node "${cliPath}" add software-engineering -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });

    const updateDryRun = execSync(`node "${cliPath}" update --dry-run`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(updateDryRun).toContain('[DRY RUN]');

    const updateAll = execSync(`node "${cliPath}" update --all -y`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(updateAll).toContain('Successfully processed update');
  });

  it('should report no packages found when running update in an empty workspace', () => {
    const stdout = execSync(`node "${cliPath}" update --all -y`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(stdout).toContain('No installed packages found');
  });

  it('runs agents start in --dry-run mode reporting team name, strategy, and safe argv', async () => {
    execSync(`node "${cliPath}" add software-engineering -t cline -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });

    const stdout = execSync(
      `node "${cliPath}" start software-engineering "Review & analyze codebase" --dry-run`,
      {
        cwd: e2eDir,
        encoding: 'utf8',
      }
    );

    expect(stdout).toContain('Activation Plan (dry run)');
    expect(stdout).toContain('Bundle: software-engineering');
    expect(stdout).toMatch(/Team Name: au-software-engineering-[a-f0-9]{8}/);
    expect(stdout).toContain('Review & analyze codebase');
  }, 20000);

  it('runs add with --dry-run and --start without launching processes', async () => {
    const stdout = execSync(`node "${cliPath}" add software-engineering -t cline -y --dry-run --start`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(stdout).toContain('[DRY RUN]');
    expect(stdout).toContain('Start in Cline (dry run)');
  });

  it('runs doctor --host cline reporting Cline runtime audit', async () => {
    execSync(`node "${cliPath}" add software-engineering -t cline -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });

    const stdout = execSync(`node "${cliPath}" doctor --host cline`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });

    expect(stdout).toContain('Installed Agents');
    expect(stdout).toContain('Cline Runtime & Native Discovery Audit:');
    expect(stdout).toContain('Configured Agents:');
  });

  it('formatWrappedList wraps long lists cleanly without exceeding maxLineLen', () => {
    const skills = [
      'diagnosing-bugs',
      'git-guardrails',
      'grill-me',
      'grill-with-docs',
      'handoff',
      'managing-git-worktrees',
      'managing-pull-requests',
      'managing-worktrees',
      'node-cli',
      'npm-monorepo',
      'package-json-scripts',
      'preparing-for-code-review',
      'receiving-code-review',
      'resolving-git-conflicts',
      'subagent-delegation',
      'to-spec',
      'to-tickets',
    ];

    const wrapped = formatWrappedList(skills, '  ', 68);
    expect(wrapped.length).toBeGreaterThan(1);
    for (const line of wrapped) {
      expect(line.length).toBeLessThanOrEqual(68);
      expect(line.startsWith('  ')).toBe(true);
    }

    // Handles empty list
    expect(formatWrappedList([])).toEqual([]);

    // Handles single item
    expect(formatWrappedList(['single-skill'], '  ', 68)).toEqual(['  single-skill']);
  });

  it('wrapText wraps text paragraphs at limit without word breaks', () => {
    const longText = 'This is a very long descriptive warning message that needs to wrap properly across multiple lines so that the terminal borders in clack prompts do not get corrupted or overflow the screen.';
    const wrapped = wrapText(longText, 60, '  ');
    expect(wrapped.length).toBeGreaterThan(1);
    for (const line of wrapped) {
      expect(line.length).toBeLessThanOrEqual(60);
      expect(line.startsWith('  ')).toBe(true);
    }
  });

  it('formatInstallationSummary prevents line overflow and formats counts & projections cleanly', () => {
    const summary = formatInstallationSummary({
      bundleName: 'software-engineering',
      scope: 'project',
      method: 'symlink',
      hosts: ['agents'],
      agents: [
        'subagent-backend-architect',
        'subagent-code-reviewer',
        'subagent-frontend-architect',
        'subagent-repo-index',
      ],
      skills: [
        'diagnosing-bugs',
        'git-guardrails',
        'grill-me',
        'grill-with-docs',
        'handoff',
        'managing-git-worktrees',
        'managing-pull-requests',
        'managing-worktrees',
        'node-cli',
        'npm-monorepo',
        'package-json-scripts',
        'preparing-for-code-review',
        'receiving-code-review',
        'resolving-git-conflicts',
        'subagent-delegation',
        'to-spec',
        'to-tickets',
      ],
      targetDirs: ['c:\\github\\agents-united\\.agents'],
      projections: [
        { host: 'cline', path: '.clinerules', warnings: [] },
        { host: 'cline', path: '.roomodes', warnings: [] },
      ],
    });

    expect(summary).toContain('Bundle: software-engineering');
    expect(summary).toContain('Agents (4):');
    expect(summary).toContain('Skills (17):');
    expect(summary).toContain('Target Directories: c:\\github\\agents-united\\.agents');
    expect(summary).toMatch(/Projections: Cline.*\(2 files\)/);

    // Crucial check: NO line in the entire summary exceeds 72 characters!
    const lines = summary.split('\n');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(72);
    }
  });

  it('agents add renders clean Installation Success note without line overflow', async () => {
    const stdout = execSync(`node "${cliPath}" add software-engineering -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });

    expect(stdout).toContain('Installation Success');
    expect(stdout).toContain('Skills (');
    expect(stdout).toContain('Agents (');
    expect(stdout).toContain('Target Directories');

    // Split into lines and check that no line in stdout exceeds 95 characters
    const lines = stdout.split(/\r?\n/);
    for (const line of lines) {
      // Measure what a terminal actually SHOWS: the spinner redraws in place (cursor back to column 0
      // via `ESC[<n>D` / `ESC[<n>G` / `\r`, then clear), so only the text after the last reset is
      // visible. Without this, a slow run piles several spinner frames onto one non-TTY line and the
      // check fails on machine speed rather than layout. Then strip the remaining ANSI codes.
      const visible = line.split(/\x1B\[\d*[DG]|\r/).pop() ?? '';
      const cleanLine = visible.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trimEnd();
      expect(cleanLine.length, `Line exceeded 95 chars: "${cleanLine}"`).toBeLessThanOrEqual(95);
    }
  });
});

