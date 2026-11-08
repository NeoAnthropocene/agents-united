import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RegistryResolver } from '../src/core/registry.js';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';
import { UpdateEngine } from '../src/core/updater.js';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { domainTypes, syncRoster } from '../src/core/native-roster.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';

// Synthetic placement surrogate, not a 3D role or a production registry entry.
describe('optional agency role placement feasibility', () => {
  let root: string;
  let registryDir: string;
  let targetDir: string;
  let registry: RegistryResolver;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'agency-placement-'));
    registryDir = path.join(root, 'registry');
    targetDir = path.join(root, 'project', '.agents');
    await fs.copy(path.resolve('registry'), registryDir);
    const manifest = await fs.readJson(path.join(registryDir, 'bundles.json'));
    manifest.bundles['placement-fixture'] = {
      name: 'placement-fixture', tier: 'organization', domain: 'organization',
      description: 'Synthetic placement fixture', version: '1.0.0',
      agents: ['subagent-code-reviewer.md'], skills: ['handoff'],
      personaAliases: { 'fixture-reviewer': 'subagent-code-reviewer' },
      nativeRoles: { 'subagent-code-reviewer.md': 'code-reviewer' },
    };
    await fs.writeJson(path.join(registryDir, 'bundles.json'), manifest);
    registry = new RegistryResolver(registryDir);
  });
  afterEach(async () => { await fs.remove(root); });
  const installOptions = () => ({ targetDir, method: 'copy' as const, fanout: ['claude'], nativeLane: true });

  it('installs the standalone fixture without enforcing an agency prerequisite', async () => {
    await new InstallEngine(registry).install('placement-fixture', installOptions());
    expect(await fs.pathExists(path.join(root, 'project', '.claude', 'agents', 'code-reviewer.md'))).toBe(true);
    expect(await fs.pathExists(path.join(root, 'project', '.claude', 'agents', 'orchestrator-digital-agency.md'))).toBe(false);
  });

  it('preserves agency roles and shared Skill ownership through addon removal', async () => {
    const installer = new InstallEngine(registry);
    await installer.install('digital-agency', installOptions());
    const agencyRole = path.join(root, 'project', '.claude', 'agents', 'agency-motion-designer.md');
    const original = await fs.readFile(agencyRole, 'utf8');
    await installer.install('placement-fixture', installOptions());
    const lock = await fs.readJson(path.join(targetDir, 'agents-united.json'));
    expect(lock.files['skills/handoff/SKILL.md'].owners.sort()).toEqual(['digital-agency', 'placement-fixture']);
    expect(await fs.readFile(agencyRole, 'utf8')).toBe(original);
    await new UninstallEngine(registry).uninstall('placement-fixture', { targetDir });
    expect(await fs.readFile(agencyRole, 'utf8')).toBe(original);
    expect(await fs.pathExists(path.join(targetDir, 'skills', 'handoff', 'SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(root, 'project', '.claude', 'agents', 'code-reviewer.md'))).toBe(false);
  // Two real Bundle installs plus removal exceeded 30s on the measured Windows run.
  // Keep all lifecycle assertions and a bounded budget matching the other full-install case.
  }, 60000);

  it('retains a user edit and reports the update conflict', async () => {
    await new InstallEngine(registry).install('placement-fixture', installOptions());
    const edited = path.join(targetDir, 'skills', 'handoff', 'SKILL.md');
    await fs.writeFile(edited, 'user edit\n');
    const lockPath = path.join(targetDir, 'agents-united.json');
    const lock = await fs.readJson(lockPath);
    lock.bundleVersions['placement-fixture'] = '0.9.0';
    await fs.writeJson(lockPath, lock);
    const result = await new UpdateEngine(registry).update('placement-fixture', { targetDir, scope: 'project', hosts: ['agents'], cwd: targetDir });
    expect(result.skipped.some(item => item.reason.includes('User modifications detected'))).toBe(true);
    expect(await fs.readFile(edited, 'utf8')).toBe('user edit\n');
  });

  it('protects an edited exclusive Skill on uninstall', async () => {
    await new InstallEngine(registry).install('placement-fixture', installOptions());
    const edited = path.join(targetDir, 'skills', 'handoff', 'SKILL.md');
    await fs.writeFile(edited, 'user edit\n');
    await expect(new UninstallEngine(registry).uninstall('placement-fixture', { targetDir })).rejects.toThrow(/user modifications/);
    expect(await fs.readFile(edited, 'utf8')).toBe('user edit\n');
  });

  it('installs a self-contained synthetic role before the agency and exposes it to an updated native Chris', async () => {
    const manifestPath = path.join(registryDir, 'bundles.json');
    const manifest = await fs.readJson(manifestPath);
    const fixture = manifest.bundles['placement-fixture'];
    const role = 'agency-placement-3d';
    const agent = 'subagent-placement-3d.md';
    const skills = ['placement-direction', 'placement-viewer', 'placement-review', 'placement-workflow'];
    fixture.agents = [agent];
    fixture.skills = [...skills, 'handoff'];
    fixture.nativeRoles = { [agent]: role };
    fixture.personaAliases = { 'fixture-3d': 'subagent-placement-3d' };
    await fs.outputFile(path.join(registryDir, 'agents', agent), `---\nname: placement-3d\ndescription: Synthetic direct-brief role\nskills: [${skills.join(', ')}]\n---\n\nAccept a complete brief directly.\n`);
    const nativeSource = await fs.readFile(path.join(registryDir, 'hosts', 'claude', 'agents', 'code-reviewer.md'), 'utf8');
    const synthetic = nativeSource.replace('name: code-reviewer', `name: ${role}`).replace('  - security-audit', `  - ${skills.join('\n  - ')}`) + '\nAccept a complete brief directly without Chris.\n';
    await fs.outputFile(path.join(registryDir, 'hosts', 'claude', 'agents', `${role}.md`), synthetic);
    for (const name of skills) {
      await fs.outputFile(path.join(registryDir, 'skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: Synthetic fixture\n---\n`);
      await fs.outputFile(path.join(registryDir, 'skills', name, 'scripts', 'helper.mjs'), 'export const fixture = true;\n');
    }
    await fs.writeJson(manifestPath, manifest);
    const types = domainTypes(manifest.bundles, 'digital-agency');
    expect(types.find(type => type.name === role)?.bundles).toEqual(['placement-fixture']);
    expect(fixture.personaAliases['fixture-3d']).toBe('subagent-placement-3d');
    // Native Chris's allowlist is authored in his file; syncRoster generates only the roster table.
    const chrisPath = path.join(registryDir, 'hosts', 'claude', 'agents', 'orchestrator-digital-agency.md');
    const chris = await fs.readFile(chrisPath, 'utf8');
    const updatedChris = syncRoster(chris, types).replace('tools: Agent(', `tools: Agent(${role}, `);
    expect(updatedChris).toContain(`| \`${role}\` | \`placement-fixture\` |`);
    expect(inspectNativeAgent(updatedChris).tools.some(tool => tool.startsWith('Agent(') && tool.includes(role))).toBe(true);
    await fs.writeFile(chrisPath, updatedChris);
    const fixtureRegistry = new RegistryResolver(registryDir);
    const installer = new InstallEngine(fixtureRegistry);
    await installer.install('placement-fixture', installOptions());
    const project = path.join(root, 'project');
    const installedRole = await fs.readFile(path.join(project, '.claude', 'agents', `${role}.md`), 'utf8');
    expect(installedRole).toMatch(new RegExp(`^---\\nname: ${role}\\n`));
    expect(installedRole).toContain('Accept a complete brief directly without Chris.');
    expect(await fs.pathExists(path.join(project, '.claude', 'agents', 'orchestrator-digital-agency.md'))).toBe(false);
    for (const name of skills) {
      expect(await fs.pathExists(path.join(project, '.claude', 'skills', name, 'SKILL.md'))).toBe(true);
      expect(await fs.pathExists(path.join(project, '.claude', 'skills', name, 'scripts', 'helper.mjs'))).toBe(true);
    }
    expect(await fs.pathExists(path.join(project, '.claude', 'skills', 'handoff', 'SKILL.md'))).toBe(true);
    await installer.install('digital-agency', installOptions());
    const installedChris = await fs.readFile(path.join(project, '.claude', 'agents', 'orchestrator-digital-agency.md'), 'utf8');
    expect(installedChris).toContain(`| \`${role}\` | \`placement-fixture\` |`);
    expect(inspectNativeAgent(installedChris).tools.some(tool => tool.startsWith('Agent(') && tool.includes(role))).toBe(true);
    expect(await fs.readFile(path.join(project, '.claude', 'agents', `${role}.md`), 'utf8')).toBe(installedRole);
  }, 60000);

  it('rejects inherited native mappings unless parent agents are redeclared', async () => {
    const manifestPath = path.join(registryDir, 'bundles.json');
    const manifest = await fs.readJson(manifestPath);
    const fixture = manifest.bundles['placement-fixture'];
    fixture.parentBundle = 'digital-agency';
    fixture.nativeRoles['subagent-motion-designer.md'] = 'agency-motion-designer';
    await fs.writeJson(manifestPath, manifest);
    await expect(new RegistryResolver(registryDir).resolve('placement-fixture')).rejects.toThrow(/nativeRoles key.*not one of its agents/);
    delete fixture.nativeRoles['subagent-motion-designer.md'];
    await fs.writeJson(manifestPath, manifest);
    const childRegistry = new RegistryResolver(registryDir);
    const resolved = await childRegistry.resolve('placement-fixture');
    expect(resolved.agents).toContain('subagent-motion-designer.md');
    const bundle = (await childRegistry.getBundle('placement-fixture'))!;
    const artifacts = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registryDir, undefined, true);
    expect(artifacts.some(a => a.relPath === '.claude/agents/agency-motion-designer.md')).toBe(false);
    expect(artifacts.some(a => a.relPath === '.claude/agents/motion-designer.md')).toBe(true);
    expect(bundle.personaAliases?.['motion-designer']).toBeUndefined();
  });
});




