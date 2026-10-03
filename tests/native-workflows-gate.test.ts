import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { nativeWorkflowNote, userSettingsFile, workflowsDisabledBy } from '../src/core/native-workflows.js';
import type { ProjectionInfo } from '../src/core/types.js';

/**
 * Plan 032 close-out, found in the first real Claude session: on Claude Pro, dynamic workflows are off until the user turns them on
 * (`/config`, Dynamic workflows), and they can be turned off with `disableWorkflows` or `CLAUDE_CODE_DISABLE_WORKFLOWS`. The native lane
 * installs the three workflows in place of the skills of the same name, so with workflows off a user has neither `/workflow-review`,
 * `/workflow-implement` nor `/workflow-test`. The install says so, the doctor warns when a documented switch has them off, and the
 * orchestrator explains the missing `Workflow` tool instead of only falling back silently.
 */

const WORKFLOW_PROJECTIONS: ProjectionInfo[] = ['workflow-implement', 'workflow-review', 'workflow-test'].map(name => ({
  host: 'claude',
  path: `.claude/workflows/${name}.js`,
  kind: 'workflow' as const,
  warnings: [],
}));

describe('workflowsDisabledBy (the documented switches only)', () => {
  it('reads disableWorkflows from the user settings', () => {
    expect(workflowsDisabledBy('{"disableWorkflows": true}', {})).toMatch(/disableWorkflows/);
  });

  it('reads CLAUDE_CODE_DISABLE_WORKFLOWS from the environment', () => {
    expect(workflowsDisabledBy(undefined, { CLAUDE_CODE_DISABLE_WORKFLOWS: '1' })).toMatch(/CLAUDE_CODE_DISABLE_WORKFLOWS/);
  });

  it('finds nothing when the switches are off, absent, false, empty or unreadable', () => {
    expect(workflowsDisabledBy(undefined, {})).toBeUndefined();
    expect(workflowsDisabledBy('{"disableWorkflows": false}', {})).toBeUndefined();
    expect(workflowsDisabledBy('{"enableWorkflows": true}', {})).toBeUndefined();
    expect(workflowsDisabledBy('not json', {})).toBeUndefined();
    expect(workflowsDisabledBy(undefined, { CLAUDE_CODE_DISABLE_WORKFLOWS: '' })).toBeUndefined();
    expect(workflowsDisabledBy(undefined, { CLAUDE_CODE_DISABLE_WORKFLOWS: '0' })).toBeUndefined();
  });

  it('locates the user settings under CLAUDE_CONFIG_DIR when it is set, and under the home directory otherwise', () => {
    expect(userSettingsFile({ CLAUDE_CONFIG_DIR: '/cfg' }, '/home/u')).toBe(path.join('/cfg', 'settings.json'));
    expect(userSettingsFile({}, '/home/u')).toBe(path.join('/home/u', '.claude', 'settings.json'));
  });
});

describe('nativeWorkflowNote (printed after a native Claude install)', () => {
  it('is empty when no workflow was installed', () => {
    expect(nativeWorkflowNote([])).toBeUndefined();
    expect(nativeWorkflowNote([{ host: 'cline', path: '.cline/workflows/workflow-test.md', kind: 'workflow', warnings: [] }])).toBeUndefined();
  });

  it('names the workflows, where Pro turns them on, and how to get the skills back', () => {
    const note = nativeWorkflowNote(WORKFLOW_PROJECTIONS)!;
    for (const name of ['workflow-implement', 'workflow-review', 'workflow-test']) expect(note).toContain(`/${name}`);
    expect(note).toMatch(/Dynamic workflows/);
    expect(note).toMatch(/\/config/);
    expect(note).toMatch(/Pro/);
    expect(note).toMatch(/--no-native/);
  });
});

describe('doctor and a Claude native install with workflows', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-workflows-gate');
  const sidecar = path.join(workspace, '.claude', '.agents-united');
  const configDir = path.join(workspace, 'claude-config');
  const saved = { dir: process.env.CLAUDE_CONFIG_DIR, off: process.env.CLAUDE_CODE_DISABLE_WORKFLOWS };

  beforeEach(async () => {
    await fs.remove(workspace);
    await fs.ensureDir(configDir);
    process.env.CLAUDE_CONFIG_DIR = configDir;
    delete process.env.CLAUDE_CODE_DISABLE_WORKFLOWS;
    await new InstallEngine().install('software-engineering', { targetDir: sidecar, method: 'copy', fanout: ['claude'], nativeLane: true } as never);
  });
  afterEach(async () => {
    for (const [key, value] of [['CLAUDE_CONFIG_DIR', saved.dir], ['CLAUDE_CODE_DISABLE_WORKFLOWS', saved.off]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fs.remove(workspace);
  });

  const workflowWarnings = async (): Promise<string[]> =>
    (await DoctorEngine.runDoctor(sidecar, 'claude')).warnings.filter(w => /dynamic workflows/i.test(w));

  it('says nothing when no documented switch turns workflows off', async () => {
    expect(await workflowWarnings()).toEqual([]);
  });

  it('warns when disableWorkflows is set in the user settings, and names the way back', async () => {
    await fs.writeFile(path.join(configDir, 'settings.json'), '{"disableWorkflows": true}\n');
    const warnings = await workflowWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/disableWorkflows/);
    expect(warnings[0]).toMatch(/\/workflow-review/);
    expect(warnings[0]).toMatch(/--no-native/);
  });

  it('warns when CLAUDE_CODE_DISABLE_WORKFLOWS is set', async () => {
    process.env.CLAUDE_CODE_DISABLE_WORKFLOWS = '1';
    expect((await workflowWarnings()).join('\n')).toMatch(/CLAUDE_CODE_DISABLE_WORKFLOWS/);
  });

  it('does not warn about workflows on a legacy install, which has the skills', async () => {
    await fs.remove(workspace);
    await fs.ensureDir(configDir);
    await fs.writeFile(path.join(configDir, 'settings.json'), '{"disableWorkflows": true}\n');
    await new InstallEngine().install('software-engineering', { targetDir: sidecar, method: 'copy', fanout: ['claude'] } as never);
    expect(await workflowWarnings()).toEqual([]);
  });
});

describe('the native orchestrator explains a missing Workflow tool', () => {
  const body = fs.readFileSync(path.resolve('registry/hosts/claude/agents/orchestrator-engineering.md'), 'utf8');

  it('tells the user why workflows may be unavailable and where to turn them on, then falls back', () => {
    const section = body.slice(body.indexOf('## Large work: saved workflows'));
    expect(section).toMatch(/`Workflow` tool is not among your tools/);
    expect(section).toMatch(/Dynamic workflows/);
    expect(section).toMatch(/`\/config`/);
    expect(section).toMatch(/parallel `Agent` calls/);
  });
});

