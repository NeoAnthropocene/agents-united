import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import fs from 'fs-extra';

describe('CLI End-to-End Suite (dist/cli.js)', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/cli.js');
  const e2eDir = path.resolve(process.cwd(), 'scratch/test-cli-e2e-workspace');

  beforeEach(async () => {
    await fs.remove(e2eDir);
    await fs.ensureDir(e2eDir);
  });

  afterEach(async () => {
    await fs.remove(e2eDir);
  });

  it('should display list of bundles grouped by domain', () => {
    const stdout = execSync(`node "${cliPath}" list`, { encoding: 'utf8' });
    expect(stdout).toContain('Agents United — Registry Catalog Tree');
    expect(stdout).toContain('software-engineering');
    expect(stdout).toContain('mobile-development');
    expect(stdout).toContain('ai-ml-engineering');
    expect(stdout).toContain('growth-marketing');
    expect(stdout).toContain('seo-content-marketing');
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
    expect(removeStdout).toContain('Successfully removed');
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

    const clineProj = path.join(e2eDir, '.agents', 'plugins', 'software-engineering', 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(clineProj)).toBe(true);
    expect(await fs.readFile(clineProj, 'utf8')).toContain('managed-by: agents-united');

    // And the fanout is now persisted in the lockfile for future updates
    const lockfile = await fs.readJson(path.join(e2eDir, '.agents', 'agents-united.json'));
    expect(lockfile.fanout).toContain('cline');
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
      path.join(e2eDir, '.agents', 'plugins', 'software-engineering', 'agents', 'orchestrator-engineering.md'),
      'utf8'
    );
    expect(proj).toContain('managed-by: agents-united');
    expect(proj).not.toContain('hooks:');
  });

  it('prints a plain-language sync tip when installing without fanout', async () => {
    const stdout = execSync(`node "${cliPath}" add software-engineering -t agents -y --copy`, {
      cwd: e2eDir,
      encoding: 'utf8',
    });
    expect(stdout).toMatch(/only Antigravity reads/i);
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
    expect(stdout).toContain('Cline Runtime & Compound Projection Audit:');
    expect(stdout).toContain('Role Definitions:');
  });
});

