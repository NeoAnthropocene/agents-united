import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { RegistryResolver } from '../src/core/registry.js';
import { InstallEngine } from '../src/core/installer.js';
import { UninstallEngine } from '../src/core/uninstaller.js';

const registry = new RegistryResolver(path.resolve('registry'));
const skills = ['host-agent-router', 'handoff', 'git-guardrails'];
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => fs.remove(root))); });

async function footprint(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      const nested = await footprint(full);
      files += nested.files;
      bytes += nested.bytes;
    } else if (item.isFile()) {
      files++;
      bytes += (await fs.stat(full)).size;
    }
  }
  return { files, bytes };
}

describe('cross-host routing support installation', () => {
  if (process.env.AU_ROUTER_BASELINE_REGISTRY) {
    it('reports isolated deployed footprints against the fixed registry baseline', async () => {
      const before = new RegistryResolver(path.resolve(process.env.AU_ROUTER_BASELINE_REGISTRY!));
      for (const [bundle, host] of [
        ['software-engineering', 'claude'], ['software-engineering', 'cline'], ['software-engineering', 'antigravity'],
        ['frontend-engineering', 'claude'], ['frontend-engineering', 'cline'], ['frontend-engineering', 'antigravity'],
        ['digital-agency', 'claude'], ['digital-agency', 'cline'], ['digital-agency', 'antigravity'],
        ['agent-factory', 'claude'], ['agency-3d-production', 'claude'],
      ]) {
        const sizes = [];
        for (const source of [before, registry]) {
          const root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-router-footprint-'));
          roots.push(root);
          const targetDir = bundle === 'agent-factory' ? path.join(root, '.claude', '.agents-united') : path.join(root, '.agents');
          await new InstallEngine(source).install(bundle, { targetDir, method: 'copy', fanout: [host], nativeLane: true, allowUnderConstruction: true });
          sizes.push(await footprint(root));
        }
        const [oldSize, newSize] = sizes;
        if (!oldSize || !newSize) throw new Error('Both installations must be measured');
        console.log(JSON.stringify({ bundle, host, before: oldSize, after: newSize, delta: { files: newSize.files - oldSize.files, bytes: newSize.bytes - oldSize.bytes } }));
      }
    }, 240_000);
  }
  for (const bundle of ['software-engineering', 'frontend-engineering', 'digital-agency', 'agent-factory', 'agency-3d-production']) {
    for (const host of (['agent-factory', 'agency-3d-production'].includes(bundle) ? ['claude'] : ['claude', 'cline', 'antigravity'])) {
      it(`${bundle} installs owned support in ${host}`, async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-router-install-'));
        roots.push(root);
        const targetDir = bundle === 'agent-factory' ? path.join(root, '.claude', '.agents-united') : path.join(root, '.agents');
        await new InstallEngine(registry).install(bundle, { targetDir, method: 'copy', fanout: [host], nativeLane: true, allowUnderConstruction: true });
        const lock = await fs.readJson(path.join(targetDir, 'agents-united.json'));
        const hostRoot = host === 'claude' ? path.join(root, '.claude/skills') : host === 'cline' ? path.join(root, '.agents/plugins', bundle, 'skills') : path.join(root, '.agents/skills');
        for (const skill of skills) {
          const rel = `skills/${skill}/SKILL.md`;
          const file = path.join(targetDir, rel);
          if (bundle !== 'agent-factory') {
            expect(await fs.pathExists(file), rel).toBe(true);
            expect(lock.files[rel].owners).toContain(bundle);
          }
          expect(await fs.pathExists(path.join(targetDir, 'skills', skill, 'evals'))).toBe(false);
          expect(await fs.pathExists(path.join(hostRoot, skill, 'SKILL.md')), `${host} ${skill}`).toBe(true);
          expect(await fs.pathExists(path.join(hostRoot, skill, 'evals'))).toBe(false);
          if (host !== 'antigravity') {
            const deployed = path.join(hostRoot, skill, 'SKILL.md');
            const projection = lock.projections[path.relative(root, deployed).split(path.sep).join('/')];
            const bytes = await fs.readFile(deployed);
            expect(projection.owners).toContain(bundle);
            expect(projection.hash).toBe(`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`);
          }
        }
        for (const resource of ['scripts/router.mjs', 'assets/config.default.json', 'references/hosts.md', 'references/worker-contract.md', 'references/delegation-brief.md', 'examples/worked-example.md']) {
          const rel = `skills/host-agent-router/${resource}`;
          const deployed = bundle === 'agent-factory' ? path.join(hostRoot, 'host-agent-router', resource) : path.join(targetDir, rel);
          const bytes = await fs.readFile(deployed);
          expect(bytes.equals(await fs.readFile(path.join('registry', rel)))).toBe(true);
          const record = bundle === 'agent-factory' ? lock.projections[path.relative(root, deployed).split(path.sep).join('/')] : lock.files[rel];
          expect(record.hash).toBe(`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`);
          expect(record.owners).toContain(bundle);
        }
      }, 30_000);
    }
  }

  for (const first of ['software-engineering', 'frontend-engineering']) {
    it(`retains shared router when ${first} is removed first`, async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-router-owners-'));
      roots.push(root);
      const targetDir = path.join(root, '.agents');
      const installer = new InstallEngine(registry);
      const options = { targetDir, method: 'copy' as const, fanout: ['claude'], nativeLane: true };
      await installer.install('software-engineering', options);
      await installer.install('frontend-engineering', options);
      const other = first === 'software-engineering' ? 'frontend-engineering' : 'software-engineering';
      await new UninstallEngine(registry).uninstall(first, { targetDir });
      const lock = await fs.readJson(path.join(targetDir, 'agents-united.json'));
      expect(lock.files['skills/host-agent-router/scripts/router.mjs'].owners).toContain(other);
      expect(await fs.pathExists(path.join(targetDir, 'skills/host-agent-router/scripts/router.mjs'))).toBe(true);
      await new UninstallEngine(registry).uninstall(other, { targetDir });
      expect(await fs.pathExists(path.join(targetDir, 'skills/host-agent-router/scripts/router.mjs'))).toBe(false);
    }, 30_000);
  }
});
