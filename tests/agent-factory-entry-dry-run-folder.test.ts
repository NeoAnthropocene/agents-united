import fs from 'fs-extra';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { FACTORY_FORBIDDEN_ENV, cleanFactoryEnv, prepareFactoryCoordinator } from './helpers/factory-coordinator.js';

// Sitting B finding B-1: the entry dry run exits 1 with "Bundle 'agent-factory' is not installed in project scope." when the shell
// stands in a subfolder of the workspace. The runbook sentence now says where to run it, and the error names the folder it checked.

const REFERENCES = 'registry/skills/coordinate-artifact/references';
const AGENT_BODY = 'registry/hosts/claude/agents/orchestrator-agent-factory.md';
const PLACES = [`${REFERENCES}/skill-authoring.md`, `${REFERENCES}/contract-authoring.md`, `${REFERENCES}/bundle-authoring.md`, `${REFERENCES}/host-sync.md`, `${REFERENCES}/dispatch.md`, AGENT_BODY];
const ENTRY_SENTENCE = 'Run the pinned checkout\'s built CLI, `node <checkout>/dist/cli.js start agent-factory --host claude --dry-run`, from the workspace root (the folder the session was started in, which holds the installed bundle; not a subfolder), never a bare `agents` from the path, and save its output in the evidence folder.';
const OLD_SENTENCE = 'Bundle \'agent-factory\' is not installed in project scope.';

describe('the entry dry run is run from the workspace root', () => {
  let fixture: Awaited<ReturnType<typeof prepareFactoryCoordinator>>;
  beforeEach(async () => {
    vi.stubEnv(FACTORY_FORBIDDEN_ENV, undefined);
    vi.stubEnv('CLAUDE_CODE_FORK_SUBAGENT', undefined);
    fixture = await prepareFactoryCoordinator();
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
  });
  afterEach(async () => { vi.unstubAllEnvs(); await fs.remove(fixture.root); });

  const dryRun = (cwd: string) => spawnSync(process.execPath, [path.resolve('dist/cli.js'), 'start', 'agent-factory', '--host', 'claude', '--dry-run'], {
    cwd, encoding: 'utf8', timeout: 30000, env: cleanFactoryEnv({ CLAUDE_BIN_PATH: process.execPath, PATH: '', CI: 'true' }),
  });

  it('exits 0 and plans the factory main from the workspace root', () => {
    const result = dryRun(fixture.workspace);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('orchestrator-agent-factory');
  });

  it('exits 1 from a subfolder, keeps the old sentence and names the folder it checked', async () => {
    const subfolder = path.join(fixture.workspace, 'work', 'evidence');
    await fs.ensureDir(subfolder);
    const result = dryRun(subfolder);
    expect(result.status, result.stdout + result.stderr).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain(`${OLD_SENTENCE} Checked folder: ${await fs.realpath(subfolder)}.`);
    expect(output).not.toContain(`Checked folder: ${fixture.workspace}.`);
  });

  it('does not walk up to a parent folder: the subfolder run fails even though its parent holds the installation', async () => {
    const subfolder = path.join(fixture.workspace, 'nested');
    await fs.ensureDir(subfolder);
    expect(dryRun(subfolder).status).toBe(1);
    expect(dryRun(fixture.workspace).status).toBe(0);
  });
});

describe('the entry sentence is identical in all six places', () => {
  it.each(PLACES)('%s holds the sentence exactly once', async rel => {
    const text = (await fs.readFile(path.resolve(rel), 'utf8')).replace(/\r\n/g, '\n');
    expect(text.split(ENTRY_SENTENCE).length - 1, rel).toBe(1);
    expect(text, rel).not.toContain('`node <checkout>/dist/cli.js start agent-factory --host claude --dry-run`, never a bare');
  });
});
