import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

const prompts = vi.hoisted(() => ({
  intro: vi.fn(), outro: vi.fn(), note: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
  select: vi.fn(), multiselect: vi.fn(), confirm: vi.fn(), text: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}));

// Terminal prompts are the external boundary; the registry, the prerequisite check and the installation stay real.
vi.mock('@clack/prompts', () => prompts);

import { cli } from '../src/cli.js';
import { InstallEngine } from '../src/core/installer.js';
import { PrerequisiteChecker } from '../src/core/prerequisites.js';

/**
 * ADR 0079: the guided install evaluates the prerequisites of a bundle for the hosts that it then installs for, the same set. With `.claude` as the only marker of the workspace, the
 * install targets `agents` (added to every install) and `claude` (the fan-out); a panel that evaluated `claude` alone differed from the install, and one that looked at `agents` alone
 * never printed the Claude command.
 */

const originalCwd = process.cwd();
const workspace = path.resolve(originalCwd, 'scratch/test-cli-guided-install-hosts');
const home = path.resolve(originalCwd, 'scratch/test-cli-guided-install-hosts-home');
const KEYS = ['USERPROFILE', 'HOME', 'APPDATA'] as const;
const saved: Record<string, string | undefined> = {};
const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const strip = (text: string): string => text.replace(new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g'), '');

async function runCommand(...args: string[]): Promise<void> {
  cli.parse([process.execPath, 'agents', ...args], { run: false });
  await cli.runMatchedCommand();
}

describe('the guided install evaluates the hosts it installs for', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of KEYS) saved[key] = process.env[key];
    process.env.USERPROFILE = home;
    process.env.HOME = home;
    process.env.APPDATA = path.join(home, 'appdata');
    await fs.emptyDir(home);
    await fs.emptyDir(workspace);
    await fs.ensureDir(path.join(workspace, '.claude'));
    process.chdir(workspace);
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    if (stdoutTty) Object.defineProperty(process.stdout, 'isTTY', stdoutTty);
    else Reflect.deleteProperty(process.stdout, 'isTTY');
    await fs.remove(workspace);
    await fs.remove(home);
  });

  it('prints the Claude add command in the panel, and evaluates exactly the hosts that the install then receives', async () => {
    // The department, the bundle, the action and the answer to the gate (the required servers are not configured); every later prompt is cancelled.
    prompts.select
      .mockReset()
      .mockResolvedValueOnce('organization')
      .mockResolvedValueOnce('digital-agency')
      .mockResolvedValueOnce('install')
      .mockResolvedValueOnce('force')
      .mockResolvedValue(Symbol('cancel'));
    const evaluate = vi.spyOn(PrerequisiteChecker.prototype, 'evaluate');
    const install = vi.spyOn(InstallEngine.prototype, 'install');

    await runCommand('list');

    const panel = prompts.note.mock.calls.map(call => strip(String(call[0]))).find(text => text.includes('[MCP] higgsfield'));
    expect(panel, 'the prerequisite panel').toBeDefined();
    expect(panel).toContain('claude mcp add --scope project --transport http higgsfield https://mcp.higgsfield.ai/mcp');

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledTimes(1);
    const evaluated = [...(evaluate.mock.calls[0]![1]!.targetHosts ?? [])].map(String).sort();
    const options = install.mock.calls[0]![1]!;
    const installed = [...(options.hosts ?? []), ...(options.fanout ?? [])].map(String).sort();
    expect(installed).toEqual(['agents', 'claude']);
    expect(evaluated).toEqual(installed);
  });
});
