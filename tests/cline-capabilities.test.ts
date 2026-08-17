import { describe, it, expect } from 'vitest';
import { ClineCapabilityProbe } from '../src/core/cline-capabilities.js';
import type { ProcessRunner, ProcessRunnerResult } from '../src/core/types.js';

describe('Milestone 4: ClineCapabilityProbe', () => {
  it('detects installed Cline with named-team capability when parser probe succeeds', async () => {
    const fakeRunner: ProcessRunner = async (exec, args) => {
      if (args.includes('version') && args.includes('--team-name')) {
        return { exitCode: 0, stdout: 'v3.0.55', stderr: '' };
      }
      if (args.includes('version')) {
        return { exitCode: 0, stdout: 'v3.0.55', stderr: '' };
      }
      return { exitCode: 1, stdout: '', stderr: 'unknown option' };
    };

    const probe = new ClineCapabilityProbe(fakeRunner, {
      resolveExecutable: () => ({
        executable: 'node',
        prefixArgs: ['/path/to/cline/bin/cline'],
        source: 'node-wrapper',
      }),
    });

    const report = await probe.probe();
    expect(report.installed).toBe(true);
    expect(report.version).toBe('v3.0.55');
    expect(report.namedTeams).toBe(true);
    expect(report.command?.source).toBe('node-wrapper');
  });

  it('detects installed Cline without named-team support when parser probe fails', async () => {
    const fakeRunner: ProcessRunner = async (exec, args) => {
      if (args.includes('--team-name')) {
        return { exitCode: 1, stdout: '', stderr: 'error: unknown option --team-name' };
      }
      if (args.includes('version')) {
        return { exitCode: 0, stdout: 'v2.5.0', stderr: '' };
      }
      return { exitCode: 1, stdout: '', stderr: 'unknown' };
    };

    const probe = new ClineCapabilityProbe(fakeRunner, {
      resolveExecutable: () => ({
        executable: 'cline',
        prefixArgs: [],
        source: 'path-executable',
      }),
    });

    const report = await probe.probe();
    expect(report.installed).toBe(true);
    expect(report.version).toBe('v2.5.0');
    expect(report.namedTeams).toBe(false);
  });

  it('handles missing executable gracefully without throwing', async () => {
    const fakeRunner: ProcessRunner = async () => {
      throw new Error('Command not found');
    };

    const probe = new ClineCapabilityProbe(fakeRunner, {
      resolveExecutable: () => null,
    });

    const report = await probe.probe();
    expect(report.installed).toBe(false);
    expect(report.namedTeams).toBe(false);
    expect(report.diagnostics.length).toBeGreaterThan(0);
    expect(report.diagnostics[0]).toContain('not found');
  });

  it('handles execution timeout during probe without throwing', async () => {
    const timeoutRunner: ProcessRunner = async () => {
      return { exitCode: 124, stdout: '', stderr: 'Timed out' };
    };

    const probe = new ClineCapabilityProbe(timeoutRunner, {
      resolveExecutable: () => ({
        executable: 'cline',
        prefixArgs: [],
        source: 'path-executable',
      }),
    });

    const report = await probe.probe();
    expect(report.installed).toBe(false);
    expect(report.namedTeams).toBe(false);
    expect(report.diagnostics.some(d => d.includes('Timed out') || d.includes('failed'))).toBe(true);
  });
});
