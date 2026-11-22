import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareFactoryNative } from './helpers/factory-native.js';
import { installPackedPackage, parseNpmPackJson } from './helpers/packed-package.js';

/** Real npm packaging/install, entirely offline and with lifecycle scripts disabled. */
describe('factory native binding from an installed npm package', () => {
  let root: string | undefined;
  afterEach(async () => { if (root) await fs.remove(root); });

  it('delivers a fixture registration using only the tarball and declared runtime dependencies', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-factory-package-'));
    const fixture = await prepareFactoryNative(root);
    const npmCli = path.join(path.dirname(process.env.npm_execpath ?? ''), 'npm-cli.js');
    if (!await fs.pathExists(npmCli)) throw new Error('Package verification requires the npm CLI that launched the test.');
    const packOutput = execFileSync(process.execPath, [npmCli, 'pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', root], { cwd: process.cwd(), encoding: 'utf8' });
    const packed = parseNpmPackJson(packOutput);
    const archive = path.join(root, packed[0]!.filename);
    const runtime = path.join(root, 'runtime');
    installPackedPackage({ npmCli, prefix: runtime, tarball: archive });
    const packageRoot = path.join(runtime, 'node_modules/agents-united');
    // P1 supplies no production worker yet: the approved temporary registry is an
    // explicit fixture for the packed installer's native-only public CLI seam.
    await fs.copy(fixture.registry, path.join(packageRoot, 'registry'));
    const output = execFileSync(process.execPath, [path.join(packageRoot, 'dist/cli.js'), 'add', 'agent-factory', '-t', 'claude', '--native', '--copy', '--allow-under-construction', '-y'], {
      cwd: fixture.workspace, encoding: 'utf8', env: { ...process.env, CI: 'true' },
    });
    expect(output).not.toMatch(/Error:/);
    expect(await fs.readFile(fixture.installed('.claude/agents/factory-realizer.md'), 'utf8')).toContain('Fixture author identity.');
    expect(await fs.pathExists(fixture.installed('.claude/skills/realize-artifact/assets/claude-binding.json'))).toBe(true);
    expect(await fs.pathExists(fixture.installed('.claude/hooks/agents-united-guard.js'))).toBe(true);
    expect(await fs.pathExists(fixture.installed('.claude/skills/realize-artifact/evals'))).toBe(false);
  }, 60000);
});
