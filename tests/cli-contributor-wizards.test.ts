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

import { cli, canInstallEntireDomain } from '../src/cli.js';
import type { BundleDefinition, BundlesManifest } from '../src/core/types.js';

interface SelectPrompt {
  message: string;
  options: Array<{ value: string; label: string; hint?: string }>;
}

const originalCwd = process.cwd();
const workspace = path.resolve(originalCwd, 'scratch/test-cli-contributor-wizards');
const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
let terminalLines: string[];

async function runCommand(...args: string[]): Promise<void> {
  cli.parse([process.execPath, 'agents', ...args], { run: false });
  await cli.runMatchedCommand();
}

describe('Contributor CLI wizards', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    prompts.select.mockReset().mockResolvedValue(Symbol('cancel'));
    terminalLines = [];
    vi.spyOn(console, 'log').mockImplementation((...values: unknown[]) => terminalLines.push(values.join(' ')));
    await fs.emptyDir(workspace);
    process.chdir(workspace);
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
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

  it('list wizard offers the contributor section with authoring guidance', async () => {
    prompts.select.mockResolvedValue(Symbol('cancel'));

    await runCommand('list');

    const departmentPrompt = prompts.select.mock.calls[0]?.[0] as SelectPrompt;
    const contributor = departmentPrompt.options.find(option => option.value === 'contributor');
    expect(contributor, 'the explorer must offer the contributor section').toBeDefined();
    expect(contributor?.label).toContain('Developers only: contribute to Agents United');
    expect(contributor?.hint).toMatch(/local drafts.*PR to dev/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });

  it('list inspection marks the empty shell unavailable and offers no installation action', async () => {
    prompts.select.mockResolvedValueOnce('contributor').mockResolvedValueOnce('agent-factory').mockResolvedValueOnce('exit');

    await runCommand('list');

    const bundlePrompt = prompts.select.mock.calls[1]?.[0] as SelectPrompt;
    const shell = bundlePrompt.options.find(option => option.value === 'agent-factory');
    expect(shell?.label).toContain('[Unavailable]');
    expect(shell?.label).not.toContain('Essentials');
    const actionPrompt = prompts.select.mock.calls[2]?.[0] as SelectPrompt;
    expect(actionPrompt.options.map(option => option.value)).not.toContain('install');
    const detail = terminalLines.join('\n');
    expect(detail).toContain('[Under Construction]');
    expect(detail).toContain('[Unavailable]');
    expect(detail).toContain('Developers only: contribute to Agents United');
    expect(detail.replace(/\n│\s+/g, ' ')).toContain('local drafts or a reviewed PR to dev');
    expect(detail).not.toMatch(/Essentials|Operational|Self-directed meta-skills/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });

  it('add wizard identifies the empty shell and stops before the construction override prompt', async () => {
    prompts.select.mockResolvedValueOnce('contributor').mockResolvedValueOnce('agent-factory');

    await runCommand('add', '--copy');

    const bundlePrompt = prompts.select.mock.calls[1]?.[0] as SelectPrompt;
    const shell = bundlePrompt.options.find(option => option.value === 'agent-factory');
    expect(shell?.label).toContain('[Unavailable]');
    expect(shell?.label).not.toContain('Essentials');
    expect(prompts.select.mock.calls).toHaveLength(2);
    expect(prompts.outro.mock.calls.flat().join(' ')).toMatch(/unavailable.*empty contributor shell/i);
    expect(await fs.readdir(workspace)).toEqual([]);
  });

  it.each(['--tree', '--all'])('static catalog %s shows the contributor section without a department recommendation', async flag => {
    await runCommand('list', flag);

    const catalog = terminalLines.join('\n');
    expect(catalog).toContain('Developers only: contribute to Agents United');
    expect(catalog).toMatch(/Author Agents United artifacts.*local drafts.*PR to dev/);
    const shellLine = terminalLines.find(line => line.includes('📦') && line.includes('agent-factory'));
    expect(shellLine).toContain('[Under Construction]');
    expect(shellLine).toContain('[Unavailable]');
    expect(shellLine).not.toContain('Essentials');
  });

  it('keyword search marks the shell unavailable before offering installation', async () => {
    await runCommand('find', 'agent-factory');

    const match = terminalLines.find(line => line.includes('agent-factory'));
    expect(match).toContain('[Unavailable]');
    expect(match).toContain('[Under Construction]');
    expect(terminalLines.join('\n')).toContain('Developers only: contribute to Agents United');
    expect(terminalLines.join('\n')).toContain('local drafts or a reviewed PR to dev');
  });

  it.each(['add', 'list'])('%s search wizard labels unavailable matches and leaves the workspace empty', async command => {
    prompts.select.mockResolvedValueOnce('__search__')
      .mockResolvedValueOnce(command === 'list' ? 'bundle:agent-factory' : 'agent-factory')
      .mockResolvedValueOnce('exit');
    prompts.text.mockResolvedValueOnce('agent-factory');

    await runCommand(command, ...(command === 'add' ? ['--copy'] : []));

    const resultsPrompt = prompts.select.mock.calls[1]?.[0] as SelectPrompt;
    const shell = resultsPrompt.options.find(option => option.value.endsWith('agent-factory'));
    expect(shell?.label).toContain('[Unavailable]');
    expect(await fs.readdir(workspace)).toEqual([]);
  });

  it('populated contributor tools never offer an entire department install', () => {
    const tools: BundleDefinition[] = [
      { name: 'author-artifact', domain: 'contributor', description: 'Authoring fixture', skills: ['write-artifact'] },
      { name: 'review-artifact', domain: 'contributor', description: 'Review fixture', skills: ['review-artifact'] },
    ];
    expect(canInstallEntireDomain('contributor', tools.length)).toBe(false);
    expect(canInstallEntireDomain('engineering', 2)).toBe(true);
    expect(canInstallEntireDomain('engineering', 1)).toBe(false);
    expect(canInstallEntireDomain('organization', 2)).toBe(false);
    expect(canInstallEntireDomain('universal', 3)).toBe(false);
  });

  it('full inspection shows the current end-user inventory and preserves shared skills', async () => {
    const catalog = await fs.readJson(path.join(originalCwd, 'registry/bundles.json')) as BundlesManifest;
    const full = catalog.bundles.full;
    prompts.select.mockResolvedValueOnce('universal').mockResolvedValueOnce('full').mockResolvedValueOnce('exit');

    await runCommand('list');

    const detail = terminalLines.join('\n');
    const leads = full.agents!.filter(agent => agent.startsWith('orchestrator-'));
    const workers = full.agents!.filter(agent => !agent.startsWith('orchestrator-'));
    expect(detail).toContain(`Lead Orchestrators (${leads.length})`);
    expect(detail).toContain(`Specialized Sub-Agents (${workers.length})`);
    for (const agent of full.agents!) expect(detail).toContain(agent.replace(/\.md$/, ''));
    for (const skill of ['color-theory', 'image-creation', 'brand-consistency-audit']) expect(detail).toContain(skill);
    expect(detail).not.toContain('agent-factory');
  });

  it('interactive find labels the shell unavailable and cannot create an empty installation', async () => {
    prompts.select.mockResolvedValueOnce('agent-factory');

    await runCommand('find', 'agent-factory', '--interactive');

    const matches = prompts.select.mock.calls[0]?.[0] as SelectPrompt;
    expect(matches.options.find(option => option.value === 'agent-factory')?.label).toContain('[Unavailable]');
    expect(prompts.outro.mock.calls.flat().join(' ')).toMatch(/unavailable.*empty contributor shell/i);
    expect(prompts.outro.mock.calls.flat().join(' ')).not.toContain('Successfully installed');
    expect(await fs.readdir(workspace)).toEqual([]);
  });
});
