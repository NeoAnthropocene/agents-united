import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';

/**
 * Plan 032 close-out, found in the first real Cline session: the native Cline workflows (`/workflow-test`, `/workflow-review`,
 * `/workflow-implement`) are shadowed by the generic skills of the same names in the shared `.agents/skills/` store, because a skill is
 * a `/<name>` command and wins (proven: with the skill removed, the host expanded the native workflow). The `.agents/` store also gets
 * the Antigravity native lane (agents, rules, guard hook, hooks.json, mcp_config.json) in a Cline-only install, where Antigravity was
 * never asked for. Both follow from one fact the installer lacked: whether Antigravity is a target or the store was only added for
 * another host. `implicitStore` records it (sticky, in the lockfile). When the store is only implicit, the Antigravity lane does not
 * run and a native Cline lane leaves the three same-named skills out; when Antigravity is a target they stay and doctor says the
 * workflows are shadowed.
 */

const BUNDLE = 'software-engineering';
const WS = path.resolve(process.cwd(), 'scratch/test-native-cline-store-gate');
const STORE = path.join(WS, '.agents');
const SHADOWED = ['workflow-implement', 'workflow-review', 'workflow-test'];

describe('native Cline lane and the shared .agents/ store', () => {
  beforeEach(async () => {
    await fs.remove(WS);
    await fs.ensureDir(WS);
  });
  afterEach(async () => {
    await fs.remove(WS);
  });

  const install = (extra: Record<string, unknown> = {}) =>
    new InstallEngine().install(BUNDLE, { targetDir: STORE, method: 'copy', fanout: ['cline'], ...extra } as never);
  const lock = async () => fs.readJson(path.join(STORE, 'agents-united.json'));
  const skill = (name: string): string => path.join(STORE, 'skills', name, 'SKILL.md');

  it('with an implicit store runs no Antigravity lane: no hooks, MCP config, agents or rules of its own', async () => {
    await install({ nativeLane: true, implicitStore: true });
    for (const rel of ['hooks.json', 'mcp_config.json', 'hooks']) expect(await fs.pathExists(path.join(STORE, rel)), rel).toBe(false);
    const record = await lock();
    expect(record.nativeLanes?.antigravity).toBeUndefined();
    expect(record.nativeLanes?.cline).toBe(true);
    expect(record.implicitStore).toBe(true);
    expect(await fs.readFile(path.join(STORE, 'agents', 'orchestrator-engineering.md'), 'utf8')).not.toContain('antigravity-native');
  });

  it('leaves the three same-named generic skills out of the store, and keeps every other skill', async () => {
    await install({ nativeLane: true, implicitStore: true });
    for (const name of SHADOWED) {
      expect(await fs.pathExists(path.join(STORE, 'skills', name)), name).toBe(false);
      expect(await fs.pathExists(path.join(WS, '.cline', 'workflows', `${name}.md`)), `${name} native workflow`).toBe(true);
    }
    expect(await fs.pathExists(skill('test-driven-development'))).toBe(true);
    expect(await fs.pathExists(skill('workflow-build'))).toBe(true);
    const record = await lock();
    for (const name of SHADOWED) {
      expect(record.installed.skills).not.toContain(name);
      // Only the empty pointer the workflow projection hangs its `projectedTo` on may remain, never a record of an installed file.
      expect(Object.entries(record.files).filter(([key, entry]) => key.startsWith(`skills/${name}/`) && (entry as { hash: string }).hash !== ''), name).toEqual([]);
    }
    expect(await fs.readFile(path.join(WS, '.cline', 'workflows', 'workflow-test.md'), 'utf8')).toContain('profile: cline-native');
  });

  it('with Antigravity as a target keeps the skills and the Antigravity lane, and doctor says the workflows are shadowed', async () => {
    await install({ nativeLane: true, implicitStore: false });
    expect(await fs.pathExists(path.join(STORE, 'hooks.json'))).toBe(true);
    for (const name of SHADOWED) expect(await fs.pathExists(skill(name)), name).toBe(true);
    const record = await lock();
    expect(record.nativeLanes?.antigravity).toBe(true);
    expect(record.implicitStore).toBeUndefined();
    const warnings = (await DoctorEngine.runDoctor(STORE, 'cline')).warnings.filter(w => /shadow/i.test(w));
    expect(warnings.join('\n')).toMatch(/\/workflow-test/);
    expect(warnings.join('\n')).toMatch(/skill/);
  });

  it('gives doctor nothing to say about shadowing when the store is implicit', async () => {
    await install({ nativeLane: true, implicitStore: true });
    expect((await DoctorEngine.runDoctor(STORE, 'cline')).warnings.filter(w => /shadow/i.test(w))).toEqual([]);
  });

  it('is sticky: an install without the option (what `agents update` does) keeps the same behaviour', async () => {
    await install({ nativeLane: true, implicitStore: true });
    await install();
    expect(await fs.pathExists(path.join(STORE, 'hooks.json'))).toBe(false);
    for (const name of SHADOWED) expect(await fs.pathExists(path.join(STORE, 'skills', name)), name).toBe(false);
    expect((await lock()).implicitStore).toBe(true);
  });

  it('an explicit Antigravity target later clears it, and the skills come back', async () => {
    await install({ nativeLane: true, implicitStore: true });
    await install({ nativeLane: true, implicitStore: false });
    expect((await lock()).implicitStore).toBeUndefined();
    expect(await fs.pathExists(path.join(STORE, 'hooks.json'))).toBe(true);
    for (const name of SHADOWED) expect(await fs.pathExists(skill(name)), name).toBe(true);
  });

  it('does not turn an Antigravity lane that is already recorded into an implicit store', async () => {
    await install({ nativeLane: true, implicitStore: false });
    await install({ nativeLane: true, implicitStore: true });
    const record = await lock();
    expect(record.implicitStore).toBeUndefined();
    expect(record.nativeLanes?.antigravity).toBe(true);
    expect(await fs.pathExists(path.join(STORE, 'hooks.json'))).toBe(true);
  });

  it('removes unmodified skill copies an earlier install left, when the native lane is turned on', async () => {
    await install({ implicitStore: true });
    for (const name of SHADOWED) expect(await fs.pathExists(skill(name)), `${name} before`).toBe(true);
    await install({ nativeLane: true, implicitStore: true });
    for (const name of SHADOWED) expect(await fs.pathExists(path.join(STORE, 'skills', name)), name).toBe(false);
  });

  it('leaves an edited copy in place, stops tracking it and says so', async () => {
    await install({ implicitStore: true });
    await fs.appendFile(skill('workflow-test'), '\nMy own note.\n');
    const result = await install({ nativeLane: true, implicitStore: true });
    expect(await fs.pathExists(skill('workflow-test'))).toBe(true);
    expect(Object.entries((await lock()).files).filter(([key, entry]) => key.startsWith('skills/workflow-test/') && (entry as { hash: string }).hash !== '')).toEqual([]);
    const warning = result.projections.flatMap(p => p.warnings).join('\n');
    expect(warning).toMatch(/workflow-test/);
    expect(warning).toMatch(/edited/);
    expect(await fs.pathExists(path.join(STORE, 'skills', 'workflow-review'))).toBe(false);
  });

  it('brings the skills back with --no-native', async () => {
    await install({ nativeLane: true, implicitStore: true });
    await install({ nativeLane: false });
    for (const name of SHADOWED) expect(await fs.pathExists(skill(name)), name).toBe(true);
    expect((await lock()).nativeLanes?.cline).toBeUndefined();
  });

  it('a dry run with an implicit store plans no Antigravity artifact', async () => {
    const result = await install({ nativeLane: true, implicitStore: true, dryRun: true });
    expect(result.projections.filter(p => p.host === 'antigravity')).toEqual([]);
    expect(result.projections.some(p => p.host === 'cline')).toBe(true);
  });
});
