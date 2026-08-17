import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { HOST_REGISTRY, KNOWN_HOST_IDS, isKnownHost, planInstallTargets } from '../src/core/hosts.js';
import { AgentHostAdapter } from '../src/core/adapter.js';

describe('Host Registry', () => {
  it('contains the canonical hosts with identical dir resolution to today', () => {
    const cwd = process.cwd();
    const home = os.homedir();

    expect(HOST_REGISTRY.agents.projectDir).toBe('.agents');
    expect(HOST_REGISTRY.agents.globalDirSegments).toEqual(['.agents']);
    expect(AgentHostAdapter.resolveHostDir('project', 'agents')).toBe(
      path.resolve(cwd, '.agents')
    );
    expect(AgentHostAdapter.resolveHostDir('global', 'agents')).toBe(path.join(home, '.agents'));

    expect(HOST_REGISTRY.gemini.projectDir).toBe('.gemini');
    expect(HOST_REGISTRY.gemini.globalDirSegments).toEqual(['.gemini', 'config']);
    expect(AgentHostAdapter.resolveHostDir('project', 'gemini')).toBe(
      path.resolve(cwd, '.gemini')
    );
    expect(AgentHostAdapter.resolveHostDir('global', 'gemini')).toBe(
      path.join(home, '.gemini', 'config')
    );

    expect(HOST_REGISTRY.claude.projectDir).toBe('.claude');
    expect(HOST_REGISTRY.claude.globalDirSegments).toEqual(['.claude']);
    expect(AgentHostAdapter.resolveHostDir('project', 'claude')).toBe(
      path.resolve(cwd, '.claude')
    );
    expect(AgentHostAdapter.resolveHostDir('global', 'claude')).toBe(path.join(home, '.claude'));

    expect(HOST_REGISTRY.cursor.projectDir).toBe('.cursor');
    expect(HOST_REGISTRY.cursor.globalDirSegments).toEqual(['.cursor']);
    expect(AgentHostAdapter.resolveHostDir('project', 'cursor')).toBe(
      path.resolve(cwd, '.cursor')
    );
    expect(AgentHostAdapter.resolveHostDir('global', 'cursor')).toBe(path.join(home, '.cursor'));
  });

  it('exposes every host id in KNOWN_HOST_IDS', () => {
    expect(isKnownHost('agents')).toBe(true);
    expect(isKnownHost('gemini')).toBe(true);
    expect(isKnownHost('claude')).toBe(true);
    expect(isKnownHost('cursor')).toBe(true);
    expect(isKnownHost('cline')).toBe(true);
    expect(isKnownHost('opencode')).toBe(true);
    expect(isKnownHost('codex')).toBe(true);
    expect(KNOWN_HOST_IDS).toContain('cline');
    expect(KNOWN_HOST_IDS).toContain('opencode');
    expect(KNOWN_HOST_IDS).toContain('codex');
  });

  it('rejects unknown hosts', () => {
    expect(isKnownHost('cline')).toBe(true);
    expect(isKnownHost('nope')).toBe(false);
  });

  it('resolves new host project dirs', () => {
    expect(AgentHostAdapter.resolveHostDir('project', 'cline')).toBe(
      path.resolve(process.cwd(), '.cline')
    );
  });

  it('resolves new host global dirs', () => {
    expect(AgentHostAdapter.resolveHostDir('global', 'opencode')).toBe(
      path.join(os.homedir(), '.config', 'opencode')
    );
  });
});

describe('planInstallTargets (Option B — main library + translated copies)', () => {
  it('maps a lone runtime selection to the main library + fan-out', () => {
    expect(planInstallTargets(['cline'])).toEqual({
      hosts: ['agents'],
      fanout: ['cline'],
      addedCanonicalStore: true,
    });
  });

  it('keeps agents direct and moves projection-capable hosts to fan-out', () => {
    expect(planInstallTargets(['agents', 'claude', 'cline'])).toEqual({
      hosts: ['agents'],
      fanout: ['claude', 'cline'],
      addedCanonicalStore: false,
    });
  });

  it('a plain agents selection fans out nowhere', () => {
    expect(planInstallTargets(['agents'])).toEqual({
      hosts: ['agents'],
      fanout: [],
      addedCanonicalStore: false,
    });
  });

  it('gemini stays a direct install (Antigravity dialect, no translation needed)', () => {
    expect(planInstallTargets(['gemini'])).toEqual({
      hosts: ['gemini'],
      fanout: [],
      addedCanonicalStore: false,
    });
  });

  it('agents + gemini + claude: canonical+legacy direct, claude projected', () => {
    expect(planInstallTargets(['agents', 'gemini', 'claude'])).toEqual({
      hosts: ['agents', 'gemini'],
      fanout: ['claude'],
      addedCanonicalStore: false,
    });
  });

  it('defaults to agents for empty or all-unknown input', () => {
    expect(planInstallTargets([])).toEqual({ hosts: ['agents'], fanout: [], addedCanonicalStore: false });
    expect(planInstallTargets(['nope'])).toEqual({ hosts: ['agents'], fanout: [], addedCanonicalStore: false });
  });

  it('dedupes case-insensitively', () => {
    expect(planInstallTargets(['Cline', ' cline '])).toEqual({
      hosts: ['agents'],
      fanout: ['cline'],
      addedCanonicalStore: true,
    });
  });
});