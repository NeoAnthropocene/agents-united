import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { AgentHostAdapter } from '../src/core/adapter.js';

describe('AgentHostAdapter', () => {
  const home = os.homedir();
  const cwd = process.cwd();

  it('should resolve default project scope for agents host', () => {
    const dir = AgentHostAdapter.resolveHostDir('project', 'agents');
    expect(dir).toBe(path.resolve(cwd, '.agents'));
  });

  it('should resolve project scope for gemini, claude, cursor hosts', () => {
    expect(AgentHostAdapter.resolveHostDir('project', 'gemini')).toBe(path.resolve(cwd, '.gemini'));
    expect(AgentHostAdapter.resolveHostDir('project', 'claude')).toBe(path.resolve(cwd, '.claude'));
    expect(AgentHostAdapter.resolveHostDir('project', 'cursor')).toBe(path.resolve(cwd, '.cursor'));
  });

  it('should resolve global scope for all hosts', () => {
    expect(AgentHostAdapter.resolveHostDir('global', 'agents')).toBe(path.join(home, '.agents'));
    expect(AgentHostAdapter.resolveHostDir('global', 'gemini')).toBe(path.join(home, '.gemini', 'config'));
    expect(AgentHostAdapter.resolveHostDir('global', 'claude')).toBe(path.join(home, '.claude'));
    expect(AgentHostAdapter.resolveHostDir('global', 'cursor')).toBe(path.join(home, '.cursor'));
  });

  it('should honor custom directory override', () => {
    const custom = path.resolve(cwd, 'scratch/custom-dir');
    expect(AgentHostAdapter.resolveHostDir('project', 'agents', custom)).toBe(custom);
  });
});
