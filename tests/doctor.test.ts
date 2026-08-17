import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import { InstallEngine } from '../src/core/installer.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { RegistryResolver } from '../src/core/registry.js';

describe('DoctorEngine', () => {
  const tempDir = path.resolve(process.cwd(), 'scratch/test-workspace-doctor');
  let resolver: RegistryResolver;
  let installer: InstallEngine;

  beforeEach(async () => {
    await fs.remove(tempDir);
    // Projection fan-out writes siblings of tempDir (e.g. scratch/.claude); clean them.
    await fs.remove(path.join(path.dirname(tempDir), '.claude'));
    await fs.ensureDir(tempDir);
    resolver = new RegistryResolver(path.resolve(process.cwd(), 'registry'));
    installer = new InstallEngine(resolver);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should validate healthy installed workspace', async () => {
    await installer.install('software-engineering', { targetDir: tempDir });
    const report = await DoctorEngine.runDoctor(tempDir);
    expect(report.valid).toBe(true);
    expect(report.agentsCount).toBeGreaterThan(0);
    expect(report.issues.length).toBe(0);
  });

  it('reports a missing projection as a warning', async () => {
    await installer.install('software-engineering', {
      targetDir: tempDir,
      method: 'copy',
      fanout: ['claude'],
    });

    const projAbs = path.join(path.dirname(tempDir), '.claude', 'agents', 'orchestrator-engineering.md');
    expect(await fs.pathExists(projAbs)).toBe(true);
    await fs.remove(projAbs);

    const report = await DoctorEngine.runDoctor(tempDir);
    expect(report.warnings.some(w => w.includes('Missing projection'))).toBe(true);
  });

  it('reports a user-modified projection as a warning', async () => {
    await installer.install('software-engineering', {
      targetDir: tempDir,
      method: 'copy',
      fanout: ['claude'],
    });

    const projAbs = path.join(path.dirname(tempDir), '.claude', 'agents', 'orchestrator-engineering.md');
    const content = (await fs.readFile(projAbs, 'utf8')).replace(
      'managed-by: agents-united',
      'managed-by: USER'
    );
    await fs.writeFile(projAbs, content, 'utf8');

    const report = await DoctorEngine.runDoctor(tempDir);
    expect(report.warnings.some(w => w.includes('user-modified projection'))).toBe(true);
  });
});
