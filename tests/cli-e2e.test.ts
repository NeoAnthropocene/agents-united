import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { execSync } from 'node:child_process';
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

  it('should run doctor health check', () => {
    execSync(`node "${cliPath}" add software-engineering -y`, { cwd: e2eDir, encoding: 'utf8' });
    const stdout = execSync(`node "${cliPath}" doctor`, { cwd: e2eDir, encoding: 'utf8' });
    expect(stdout).toContain('Installed Agents');
  });

  it('should detect existing agent hosts in workspace correctly', async () => {
    const { detectWorkspaceHosts } = await import('../src/cli.js');
    await fs.ensureDir(path.join(e2eDir, '.gemini'));
    await fs.ensureDir(path.join(e2eDir, '.claude'));

    const detected = detectWorkspaceHosts(e2eDir);
    expect(detected).toContain('gemini');
    expect(detected).toContain('claude');
    expect(detected).not.toContain('cursor');
  });
});
