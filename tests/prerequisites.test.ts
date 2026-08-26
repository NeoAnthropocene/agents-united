import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { execSync, spawnSync } from 'node:child_process';
import { PrerequisiteChecker } from '../src/core/prerequisites.js';
import { RegistryResolver } from '../src/core/registry.js';

describe('PrerequisiteChecker & Organization Bundles', () => {
  let testWorkspace: string;
  let registry: RegistryResolver;

  beforeEach(async () => {
    testWorkspace = path.join(os.tmpdir(), `au-prereq-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fs.ensureDir(testWorkspace);
    registry = new RegistryResolver();
  });

  afterEach(async () => {
    await fs.remove(testWorkspace);
  });

  it('should evaluate bundle without prerequisites as fully satisfied', async () => {
    const checker = new PrerequisiteChecker();
    const softwareBundle = await registry.getBundle('software-engineering');
    expect(softwareBundle).toBeDefined();
    expect(softwareBundle?.status).toBe('stable');

    const result = await checker.evaluate(softwareBundle!, { cwd: testWorkspace });
    expect(result.hasPrerequisites).toBe(false);
    expect(result.allSatisfied).toBe(true);
    expect(result.operationalPossible).toBe(true);
    expect(result.items.length).toBe(0);
  });

  it('should evaluate digital-agency organization bundle prerequisites', async () => {
    const checker = new PrerequisiteChecker();
    const agencyBundle = await registry.getBundle('digital-agency');
    expect(agencyBundle).toBeDefined();
    expect(agencyBundle?.tier).toBe('organization');
    expect(agencyBundle?.status).toBe('experimental');
    expect(agencyBundle?.prerequisites?.requiredMcps).toBeDefined();
    expect(agencyBundle?.modes?.operational).toBeDefined();
    expect(agencyBundle?.modes?.brainstorming).toBeDefined();

    const result = await checker.evaluate(agencyBundle!, {
      cwd: testWorkspace,
      env: {}, // empty env
    });

    expect(result.hasPrerequisites).toBe(true);
    expect(result.tier).toBe('organization');
    expect(result.allSatisfied).toBe(false);

    // MCP checks
    const firecrawlCheck = result.items.find(i => i.name === 'firecrawl');
    expect(firecrawlCheck).toBeDefined();
    expect(firecrawlCheck?.type).toBe('mcp');
  });

  it('should detect MCP when configured in .cursor/mcp.json', async () => {
    const cursorDir = path.join(testWorkspace, '.cursor');
    await fs.ensureDir(cursorDir);
    await fs.writeJson(path.join(cursorDir, 'mcp.json'), {
      mcpServers: {
        'custom-test-mcp': {
          command: 'npx',
          args: ['-y', 'custom-test-mcp'],
        },
      },
    });

    const check = await PrerequisiteChecker.isMcpConfigured('custom-test-mcp', testWorkspace);
    expect(check.configured).toBe(true);
    expect(check.host).toBe('cursor');
  });

  it('should detect MCP when configured in cline_mcp_settings.json', async () => {
    await fs.writeJson(path.join(testWorkspace, 'cline_mcp_settings.json'), {
      mcpServers: {
        'custom-cline-mcp': {
          command: 'npx',
          args: ['-y', 'custom-cline-mcp'],
        },
      },
    });

    const check = await PrerequisiteChecker.isMcpConfigured('custom-cline-mcp', testWorkspace);
    expect(check.configured).toBe(true);
    expect(check.host).toBe('cline');
  });

  it('should detect environment variable in process.env and local .env.local', async () => {
    // Custom env
    const check1 = await PrerequisiteChecker.isEnvVarSet('TEST_API_TOKEN', testWorkspace, {
      TEST_API_TOKEN: 'secret-val-123',
    });
    expect(check1.set).toBe(true);

    // .env.local file
    await fs.writeFile(path.join(testWorkspace, '.env.local'), 'MY_CUSTOM_KEY=abc123xyz\n');
    const check2 = await PrerequisiteChecker.isEnvVarSet('MY_CUSTOM_KEY', testWorkspace, {});
    expect(check2.set).toBe(true);
    expect(check2.source).toBe('.env.local');
  });

  it('should detect installed package in package.json dependencies', async () => {
    await fs.writeJson(path.join(testWorkspace, 'package.json'), {
      name: 'test-app',
      devDependencies: {
        '@playwright/test': '^1.40.0',
      },
    });

    const check = await PrerequisiteChecker.isPackageInstalled('@playwright/test', testWorkspace);
    expect(check.installed).toBe(true);
  });

  it('should auto-configure host MCP settings file in workspace via autoConfigureHost', async () => {
    const res = await PrerequisiteChecker.autoConfigureHost(
      'cursor',
      ['github', 'firecrawl', 'context7'],
      testWorkspace,
      'operational'
    );
    expect(res.configured).toBe(true);
    expect(res.addedServers).toEqual(['github', 'firecrawl', 'context7']);

    const targetJson = await fs.readJson(path.join(testWorkspace, '.cursor', 'mcp.json'));
    expect(targetJson.mcpServers.github).toBeDefined();
    expect(targetJson.mcpServers.firecrawl).toBeDefined();
    expect(targetJson.mcpServers.context7).toBeDefined();
  });
});

describe('CLI Organization Bundles, Lifecycle Badges & Gates', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/cli.js');

  it('should list Organization Bundles in a separate dedicated section with status badges', () => {
    const stdout = execSync(`node "${cliPath}" list`, { encoding: 'utf8' });
    expect(stdout).toContain('Organization Bundles (Experimental / Cross-Functional)');
    expect(stdout).toContain('digital-agency');
    expect(stdout).toContain('[Experimental]');
    expect(stdout).toContain('mock-organization-under-construction');
    expect(stdout).toContain('[Under Construction (TBA)]');
    expect(stdout).toContain('[Prerequisites Required]');
    expect(stdout).toContain('universal-skills');
    expect(stdout).toContain('[Recommended]');
    expect(stdout).toContain('Prerequisites:');
    expect(stdout).toContain('Execution Modes:');
  });

  it('should output digital-agency with tier, status, and prerequisites in list --json', () => {
    const stdout = execSync(`node "${cliPath}" list --json`, { encoding: 'utf8' });
    const bundles = JSON.parse(stdout);
    const agency = bundles.find((b: any) => b.name === 'digital-agency');
    const mock = bundles.find((b: any) => b.name === 'mock-organization-under-construction');
    const engineering = bundles.find((b: any) => b.name === 'software-engineering');
    const design = bundles.find((b: any) => b.name === 'product-design');
    const universalSkills = bundles.find((b: any) => b.name === 'universal-skills');

    expect(agency).toBeDefined();
    expect(agency.tier).toBe('organization');
    expect(agency.status).toBe('experimental');
    expect(agency.prerequisites.requiredMcps.length).toBeGreaterThan(0);
    expect(agency.modes.operational).toBeDefined();
    expect(agency.modes.limitedOperational || agency.modes['limited-operational']).toBeDefined();
    expect(agency.modes.brainstorming).toBeDefined();
    
    expect(mock).toBeDefined();
    expect(mock.status).toBe('under-construction');

    expect(engineering).toBeDefined();
    expect(engineering.status).toBe('stable');

    expect(design).toBeDefined();
    expect(design.status).toBe('stable');

    expect(universalSkills).toBeDefined();
    expect(universalSkills.domain).toBe('universal');
  });

  it('should block headless install for under-construction bundles', () => {
    const res = spawnSync('node', [cliPath, 'add', 'mock-organization-under-construction', '-y', '--dry-run'], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(1);
    expect(res.stdout + res.stderr).toContain('under construction');
  });

  it('should allow install when --allow-under-construction and --mode brainstorming are passed', () => {
    const stdout = execSync(
      `node "${cliPath}" add mock-organization-under-construction --allow-under-construction --mode brainstorming -y --dry-run`,
      { encoding: 'utf8' }
    );
    expect(stdout).toContain('[DRY RUN] Would install');
  });

  it('should allow install when --allow-under-construction and --allow-missing-prereqs', () => {
    const stdout = execSync(
      `node "${cliPath}" add mock-organization-under-construction --allow-under-construction --allow-missing-prereqs -y --dry-run`,
      { encoding: 'utf8' }
    );
    expect(stdout).toContain('[DRY RUN] Would install');
  });

  it('should allow install of organization bundle in limited-operational mode', () => {
    const stdout = execSync(
      `node "${cliPath}" add digital-agency --mode limited-operational -y --dry-run`,
      { encoding: 'utf8' }
    );
    expect(stdout).toContain('[DRY RUN] Would install');
  });
});


