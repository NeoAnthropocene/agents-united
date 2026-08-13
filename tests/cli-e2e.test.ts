import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';

describe('CLI End-to-End Suite (dist/cli.js)', () => {
  const cliPath = path.resolve(process.cwd(), 'dist/cli.js');
  const tempDir = path.resolve(process.cwd(), 'scratch/e2e-workspace');

  beforeEach(async () => {
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should display list of bundles cleanly', () => {
    const output = execSync(`node "${cliPath}" list`, { encoding: 'utf8' });
    expect(output).toContain('software-engineering');
    expect(output).toContain('system-architecture');
    expect(output).toContain('product-design');
    expect(output).toContain('growth-marketing');
  });

  it('should search registry using find command', () => {
    const output = execSync(`node "${cliPath}" find design`, { encoding: 'utf8' });
    expect(output).toContain('product-design');
    expect(output).toContain('orchestrator-design.md');
    expect(output).toContain('ui-design');
  });

  it('should initialize workspace with software-engineering bundle', async () => {
    execSync(`node "${cliPath}" init --bundle software-engineering`, { cwd: tempDir, encoding: 'utf8' });

    const agentsExist = await fs.pathExists(path.join(tempDir, '.agents/agents/orchestrator-engineering.md'));
    const lockfileExist = await fs.pathExists(path.join(tempDir, '.agents/agents-united.json'));

    expect(agentsExist).toBe(true);
    expect(lockfileExist).toBe(true);
  });

  it('should run doctor successfully on initialized workspace', async () => {
    execSync(`node "${cliPath}" init --bundle software-engineering`, { cwd: tempDir, encoding: 'utf8' });
    const output = execSync(`node "${cliPath}" doctor`, { cwd: tempDir, encoding: 'utf8' });

    expect(output).toContain('Installed Agents: 5');
    expect(output).toContain('healthy');
  });

  it('should add and remove bundles cleanly', async () => {
    execSync(`node "${cliPath}" add growth-marketing`, { cwd: tempDir, encoding: 'utf8' });
    expect(await fs.pathExists(path.join(tempDir, '.agents/agents/orchestrator-marketing.md'))).toBe(true);

    execSync(`node "${cliPath}" remove growth-marketing`, { cwd: tempDir, encoding: 'utf8' });
    expect(await fs.pathExists(path.join(tempDir, '.agents/agents/orchestrator-marketing.md'))).toBe(false);
  });
});
