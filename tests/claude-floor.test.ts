import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeDiagnosticsToShow } from '../src/cli.js';
import { claudeBelowFloorMessage } from '../src/core/claude-capabilities.js';
import { ClaudeLauncher } from '../src/core/claude-launcher.js';
import { InstallEngine } from '../src/core/installer.js';
import type { ClaudeCapabilityReport } from '../src/core/types.js';

/**
 * The Claude Code floor is 2.1.295 for every bundle (the maintainer's decision of 2026-11-17). Below it the doctor
 * reports an error; installs and starts are not refused. The error text and the one-copy rule live here; the
 * version checks of the doctor itself are in tests/native-claude-guard-file.test.ts.
 */

const belowFloor: ClaudeCapabilityReport = {
  installed: true,
  version: '2.1.272',
  command: { executable: 'claude', prefixArgs: [], source: 'path-executable' },
  pluginSupport: true,
  agentTeamsExperimental: false,
  subagentHandback: true,
  diagnostics: [claudeBelowFloorMessage('2.1.272', '2.1.295')],
  profile: { profileId: 'claude', minVersion: '2.1.295', reviewedAgainst: '2.1.285', belowMinimum: true, newerThanReviewed: false },
};

describe('the below-floor message', () => {
  const message = claudeBelowFloorMessage('2.1.272', '2.1.295');
  it('names the installed version and the floor', () => {
    expect(message).toContain('2.1.272');
    expect(message).toContain('2.1.295');
  });
  it('says in one sentence that the guards cannot block when they fail to run', () => {
    expect(message).toMatch(/guards cannot block when they fail to run/);
  });
  it('says that installs and starts still work', () => {
    expect(message).toMatch(/Installs and starts still work/);
  });
  it('holds no em dash', () => {
    expect(message).not.toContain('—');
  });
});

describe('what the doctor prints of the probe diagnostics', () => {
  it('leaves the floor message out when it is already reported as an issue, so it prints once', () => {
    const message = claudeBelowFloorMessage('2.1.272', '2.1.295');
    expect(claudeDiagnosticsToShow(belowFloor, [message])).toEqual([]);
    const printed = [...[message], ...claudeDiagnosticsToShow(belowFloor, [message])];
    expect(printed.filter(line => line === message)).toHaveLength(1);
  });
  it('keeps other diagnostics', () => {
    const other = 'Claude Code help probe failed: boom';
    expect(claudeDiagnosticsToShow({ ...belowFloor, diagnostics: [...belowFloor.diagnostics, other] }, [claudeBelowFloorMessage('2.1.272', '2.1.295')])).toEqual([other]);
  });
});

describe('below the floor nothing is refused', () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-floor-'));
  });
  afterEach(async () => {
    await fs.remove(root);
  });

  it('plans a start below the floor exactly as it plans one at the floor', () => {
    const atFloor: ClaudeCapabilityReport = {
      ...belowFloor,
      version: '2.1.295',
      diagnostics: [],
      profile: { profileId: 'claude', minVersion: '2.1.295', reviewedAgainst: '2.1.285', belowMinimum: false, newerThanReviewed: false },
    };
    const plan = (report: ClaudeCapabilityReport) => new ClaudeLauncher().planActivation({ bundleName: 'software-engineering', workspace: root, scope: 'project', report });
    const below = plan(belowFloor);
    expect(below.argv.length).toBeGreaterThan(0);
    expect(below).toEqual(plan(atFloor));
  });

  it('installs a bundle into the Claude lane with no probe in the way', async () => {
    const result = await new InstallEngine().install('software-engineering', { targetDir: path.join(root, '.agents'), method: 'copy', fanout: ['claude'] });
    expect(result).toBeDefined();
    expect(await fs.pathExists(path.join(root, '.claude', 'agents'))).toBe(true);
  });
});
