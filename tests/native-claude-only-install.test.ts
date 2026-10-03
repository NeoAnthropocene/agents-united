import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';

/**
 * Plan 032 close-out, defect found in the first real Claude session: `agents add <bundle> -t claude --native` is a Claude-only install,
 * which is store-less (ADR 0022: the state lives in the `.claude/.agents-united/` sidecar). The Antigravity native lane ran against that
 * sidecar anyway, so a Claude-only project received `.agents/agents`, `.agents/rules`, `.agents/hooks/`, `.agents/hooks.json` and
 * `.agents/mcp_config.json`, files only Antigravity reads, and the lockfile recorded `nativeLanes.antigravity`. The legacy install of the
 * same project writes no `.agents/` at all. The lane belongs to the `.agents/` main library, so it must run only when that library is the state dir.
 */

const BUNDLE = 'software-engineering';
const WS = path.resolve(process.cwd(), 'scratch/test-native-claude-only');
const SIDECAR = path.join(WS, '.claude', '.agents-united');
const STORE = path.join(WS, '.agents');

describe('--native on a Claude-only (store-less) install', () => {
  beforeEach(async () => {
    await fs.remove(WS);
    await fs.ensureDir(WS);
  });
  afterEach(async () => {
    await fs.remove(WS);
  });

  const claudeOnly = (extra: Record<string, unknown> = {}) =>
    new InstallEngine().install(BUNDLE, { targetDir: SIDECAR, method: 'copy', fanout: ['claude'], nativeLane: true, ...extra } as never);

  it('installs the native Claude agents and no Antigravity file at the project root', async () => {
    await claudeOnly();
    for (const role of ['backend-architect', 'code-reviewer', 'frontend-architect', 'orchestrator-engineering', 'repo-index']) {
      expect(await fs.pathExists(path.join(WS, '.claude/agents', `${role}.md`)), role).toBe(true);
    }
    expect(await fs.pathExists(STORE), 'a Claude-only install must not create .agents/').toBe(false);
  });

  it('records the Claude lane only, not an Antigravity one', async () => {
    await claudeOnly();
    const lock = await fs.readJson(path.join(SIDECAR, 'agents-united.json'));
    expect(lock.nativeLane).toBe(true);
    expect(lock.nativeLanes?.antigravity).toBeUndefined();
    expect(lock.antigravityHooks).toBeUndefined();
    expect(lock.antigravityMcp).toBeUndefined();
    const hosts = new Set(Object.values(lock.projections as Record<string, { host: string }>).map(p => p.host));
    expect(hosts.has('antigravity')).toBe(false);
  });

  it('a dry run plans no Antigravity artifact either', async () => {
    const result = await claudeOnly({ dryRun: true });
    expect(result.projections.filter(p => p.host === 'antigravity')).toEqual([]);
    expect(result.projections.some(p => p.host === 'claude')).toBe(true);
  });

  it('still runs the Antigravity lane when the .agents/ library is the state dir', async () => {
    await new InstallEngine().install(BUNDLE, { targetDir: STORE, method: 'copy', fanout: ['claude'], nativeLane: true } as never);
    expect(await fs.pathExists(path.join(STORE, 'hooks.json'))).toBe(true);
    const lock = await fs.readJson(path.join(STORE, 'agents-united.json'));
    expect(lock.nativeLanes?.antigravity).toBe(true);
  });
});
