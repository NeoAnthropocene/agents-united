import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';

const official = [
  'remotion-best-practices', 'remotion-captions', 'remotion-create', 'remotion-docs',
  'remotion-interactivity', 'remotion-maps', 'remotion-markup', 'remotion-multimedia',
  'remotion-render', 'remotion-saas', 'remotion-studio', 'remotion-upgrade',
];

describe('official Remotion Skills come from upstream', () => {
  it('omits the former Bundle from discovery', async () => {
    const registry = new RegistryResolver();
    expect(await registry.getBundle('remotion-agent-skills')).toBeNull();
    expect((await registry.listBundles()).map(bundle => bundle.name)).not.toContain('remotion-agent-skills');
  });

  it('does not distribute the unresolved snapshot or advertise a removed Bundle', () => {
    const manifest = JSON.parse(fs.readFileSync('registry/bundles.json', 'utf8')) as {
      bundles: Record<string, { skills?: string[]; recommendedAddons?: string[] }>;
    };
    expect(manifest.bundles['remotion-agent-skills']).toBeUndefined();
    for (const bundle of Object.values(manifest.bundles)) {
      expect(bundle.recommendedAddons ?? []).not.toContain('remotion-agent-skills');
      for (const name of official) expect(bundle.skills ?? []).not.toContain(name);
    }
    for (const name of official) {
      expect(fs.existsSync(path.join('registry/skills', name)), name).toBe(false);
    }
    expect(fs.existsSync('registry/skills/remotion-production/SKILL.md')).toBe(true);
  });

  it('rejects the removed Bundle without changing an existing project', async () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'remotion-upstream-'));
    try {
      fs.writeFileSync(path.join(project, 'user-scene.jsx'), 'original user scene');
      await expect(new InstallEngine().install('remotion-agent-skills', {
        scope: 'project', method: 'copy', targetDir: path.join(project, '.agents'),
        implicitStore: true, fanout: ['claude'], nativeLane: true,
      })).rejects.toThrow(/not found in registry/);
      expect(fs.readdirSync(project)).toEqual(['user-scene.jsx']);
      expect(fs.readFileSync(path.join(project, 'user-scene.jsx'), 'utf8')).toBe('original user scene');
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });
});
