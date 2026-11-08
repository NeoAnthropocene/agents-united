import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { RegistryResolver } from '../src/core/registry.js';
import { InstallEngine } from '../src/core/installer.js';
import { UpdateEngine } from '../src/core/updater.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
const exec = promisify(execFile);
let root = '';
afterEach(async () => { if (root) await fs.remove(root); });
describe('installed 3D helper lifecycle', () => {
  it('executes installed sibling imports and protects user files through update and removal', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), '3d installed project & '));
    const project = path.join(root, 'project ü');
    const targetDir = path.join(project, '.agents');
    const registry = new RegistryResolver(path.resolve('registry'));
    await new InstallEngine(registry).install('agency-3d-production', { targetDir, method: 'copy', fanout: ['claude'], nativeLane: true });
    for (const helper of ['3d-design-direction/scripts/project-3d.mjs', 'threejs-scene-production/scripts/shot-handoff.mjs']) {
      const installed = path.join(project, '.claude/skills', helper);
      const result = await exec(process.execPath, [installed, '--help'], { cwd: project, timeout: 30000 });
      expect(JSON.parse(result.stdout).ok).toBe(true);
    }
    const inspector = path.join(project, '.claude/skills/3d-asset-review/scripts/inspect-glb.mjs');
    await expect(exec(process.execPath, [inspector, 'inspect', '--project', project, '--asset', '../escape.glb', '--budgets', 'budgets.json', '--out', 'report.json'], { cwd: project })).rejects.toMatchObject({ code: 2 });
    const scene = path.join(project, 'media', 'user-scene.glb');
    await fs.outputFile(scene, 'user asset');
    const edited = path.join(targetDir, 'skills/3d-asset-review/SKILL.md');
    const originalSkill = await fs.readFile(edited, 'utf8');
    await fs.writeFile(edited, 'user customized skill\n');
    const lockPath = path.join(targetDir, 'agents-united.json');
    const lock = await fs.readJson(lockPath);
    lock.bundleVersions['agency-3d-production'] = '0.0.0';
    await fs.writeJson(lockPath, lock);
    const updated = await new UpdateEngine(registry).update('agency-3d-production', { targetDir, scope: 'project', hosts: ['agents'], cwd: targetDir });
    expect(updated.skipped.some(item => item.reason.includes('User modifications detected'))).toBe(true);
    expect(await fs.readFile(edited, 'utf8')).toBe('user customized skill\n');
    await expect(new UninstallEngine(registry).uninstall('agency-3d-production', { targetDir })).rejects.toThrow(/user modifications/);
    expect(await fs.readFile(edited, 'utf8')).toBe('user customized skill\n');
    expect(await fs.readFile(scene, 'utf8')).toBe('user asset');
    await fs.writeFile(edited, originalSkill);
    await new UninstallEngine(registry).uninstall('agency-3d-production', { targetDir });
    expect(await fs.readFile(scene, 'utf8')).toBe('user asset');
  }, 120000);
});
