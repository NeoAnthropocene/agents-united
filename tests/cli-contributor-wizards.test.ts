import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';

const prompts = vi.hoisted(() => ({
  intro: vi.fn(), outro: vi.fn(), note: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
  select: vi.fn(), multiselect: vi.fn(), confirm: vi.fn(), text: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}));

// Terminal prompts are the external boundary; registry and installation stay real.
vi.mock('@clack/prompts', () => prompts);

import { cli } from '../src/cli.js';

interface SelectPrompt {
  message: string;
  options: Array<{ value: string; label: string; hint?: string }>;
}

const originalCwd = process.cwd();
const workspace = path.resolve(originalCwd, 'scratch/test-cli-contributor-wizards');
const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

async function runCommand(...args: string[]): Promise<void> {
  cli.parse([process.execPath, 'agents', ...args], { run: false });
  await cli.runMatchedCommand();
}

describe('Contributor CLI wizards', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await fs.emptyDir(workspace);
    process.chdir(workspace);
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (stdoutTty) Object.defineProperty(process.stdout, 'isTTY', stdoutTty);
    else Reflect.deleteProperty(process.stdout, 'isTTY');
    await fs.remove(workspace);
  });

  it('add wizard labels the contributor section and explains its purpose before cancellation', async () => {
    prompts.select.mockResolvedValue(Symbol('cancel'));

    await runCommand('add', '--copy');

    const departmentPrompt = prompts.select.mock.calls[0]?.[0] as SelectPrompt;
    const contributor = departmentPrompt.options.find(option => option.value === 'contributor');
    expect(contributor, 'the add wizard must offer the separate contributor section').toBeDefined();
    expect(contributor?.label).toContain('Developers only: contribute to Agents United');
    expect(contributor?.hint).toMatch(/author|contribut/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });
});
