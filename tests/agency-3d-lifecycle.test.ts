import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { RegistryResolver } from '../src/core/registry.js';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

const skills = ['3d-design-direction', 'threejs-scene-production', '3d-asset-review', 'workflow-agency-3d-production', 'audiovisual-review', 'handoff'];
let root = '';
afterEach(async () => { if (root) await fs.remove(root); });
describe('real 3D Bundle standalone lifecycle', () => {
  it('installs complete direct role and helpers, then coexists with agency and preserves shared ownership', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'agency-real-3d-'));
    const targetDir = path.join(root, 'project', '.agents');
    const registry = new RegistryResolver(path.resolve('registry'));
    const installer = new InstallEngine(registry);
    const options = { targetDir, method: 'copy' as const, fanout: ['claude'], nativeLane: true };
    await installer.install('agency-3d-production', options);
    const project = path.join(root, 'project');
    expect(await fs.pathExists(path.join(project, '.claude/agents/agency-3d-designer.md'))).toBe(true);
    expect(await fs.pathExists(path.join(project, '.claude/agents/orchestrator-digital-agency.md'))).toBe(false);
    for (const skill of skills) expect(await fs.pathExists(path.join(project, '.claude/skills', skill, 'SKILL.md')), skill).toBe(true);
    for (const helper of ['3d-design-direction/scripts/project-3d.mjs', '3d-asset-review/scripts/inspect-glb.mjs', 'threejs-scene-production/scripts/setup-three.mjs', 'threejs-scene-production/scripts/render-three.mjs', 'threejs-scene-production/scripts/shared-3d-runtime.mjs', 'threejs-scene-production/scripts/shot-handoff.mjs', 'audiovisual-review/scripts/review.mjs']) {
      expect(await fs.pathExists(path.join(project, '.claude/skills', helper)), helper).toBe(true);
    }
    for (const skill of skills.slice(0, 4)) expect(await fs.pathExists(path.join(project, '.claude', 'skills', skill, 'evals')), skill).toBe(false);
    const arda = await fs.readFile(path.join(project, '.claude/agents/agency-3d-designer.md'), 'utf8');
    await installer.install('digital-agency', options);
    expect(await fs.readFile(path.join(project, '.claude/agents/agency-3d-designer.md'), 'utf8')).toBe(arda);
    const lock = await fs.readJson(path.join(targetDir, 'agents-united.json'));
    expect(lock.files['skills/handoff/SKILL.md'].owners.sort()).toEqual(['agency-3d-production', 'digital-agency']);
    await new UninstallEngine(registry).uninstall('agency-3d-production', { targetDir });
    expect(await fs.pathExists(path.join(project, '.claude/agents/agency-3d-designer.md'))).toBe(false);
    expect(await fs.pathExists(path.join(targetDir, 'skills/handoff/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(project, '.claude/agents/orchestrator-digital-agency.md'))).toBe(true);
  }, 120000);
});



