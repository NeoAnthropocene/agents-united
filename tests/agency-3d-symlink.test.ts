import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { RegistryResolver } from '../src/core/registry.js';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
const run = promisify(execFile);
let root = '';
afterEach(async () => { if (root) await fs.remove(root); });
describe('3D standalone Bundle symlink installation', () => {
  it('runs the installed sibling helper from another cwd and preserves user source on removal', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'agency-3d-symlink-'));
    const project = path.join(root, 'project');
    const targetDir = path.join(project, '.agents');
    const source = path.join(project, 'media', 'scene.json');
    await fs.outputFile(source, '{"user":"scene"}\n');
    const registry = new RegistryResolver(path.resolve('registry'));
    await new InstallEngine(registry).install('agency-3d-production', { targetDir, method: 'symlink', fanout: ['claude'], nativeLane: true });
    const role = path.join(project, '.claude', 'agents', 'agency-3d-designer.md');
    expect(await fs.pathExists(role)).toBe(true);
    expect(await fs.readFile(role, 'utf8')).toContain('agents-united:floor:start');
    const installed = path.join(project, '.claude', 'skills', '3d-design-direction', 'scripts', 'project-3d.mjs');
    const executed = await run(process.execPath, [installed, '--help'], { cwd: root });
    expect(JSON.parse(executed.stdout).ok).toBe(true);
    expect(await fs.pathExists(path.join(project, '.claude', 'skills', 'audiovisual-review', 'scripts', 'review.mjs'))).toBe(true);
    for (const skill of ['3d-design-direction', 'threejs-scene-production', '3d-asset-review', 'workflow-agency-3d-production']) expect(await fs.pathExists(path.join(project, '.claude', 'skills', skill, 'evals')), skill).toBe(false);
    await new UninstallEngine(registry).uninstall('agency-3d-production', { targetDir });
    expect(await fs.pathExists(role)).toBe(false);
    expect(await fs.readFile(source, 'utf8')).toBe('{"user":"scene"}\n');
  }, 120000);
});

