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
});
