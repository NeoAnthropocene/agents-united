import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClaudeCapabilityProbe } from '../src/core/claude-capabilities.js';
import type { ProcessRunner } from '../src/core/types.js';

/**
 * Plan 016 Step 6 — ClaudeCapabilityProbe (read-only probe surface, ADR 0018 decisions 11 + 12).
 *
 * Mocked-ProcessRunner style copied verbatim from tests/cline-capabilities.test.ts:
 * an injected `ProcessRunner` plus an injected `resolveExecutable`, so no real `claude`
 * binary is ever spawned.
 */

/** This test file's own path — guaranteed to exist, used as an absolute CLAUDE_BIN_PATH. */
const SELF_PATH = fileURLToPath(import.meta.url);

/** Shared resolver prefix args (node + adjacent cli.js wrapper layout). */
const PREFIX_ARGS: string[] = ['/path/to/node_modules/@anthropic-ai/claude-code/cli.js'];

const PLAIN_HELP = [
  'Usage: claude [options] [command]',
  '',
  'Options:',
  '  --version   output the version number',
  '  --help      display help for command',
  '',
].join('\n');

const PLUGIN_HELP = `${PLAIN_HELP}  --plugin-dir <path>   load plugins from a directory\n`;

const TEAMS_HELP = `${PLAIN_HELP}\nEnvironment:\n  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS   enable agent team orchestration\n`;

const ORIGINAL_CLAUDE_BIN_PATH = process.env.CLAUDE_BIN_PATH;
const ORIGINAL_PATH = process.env.PATH;

let tempDir: string | undefined;

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function makeTempDir(): string {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'au-claude-probe-'));
  return tempDir;
}

beforeEach(() => {
  // Never leak CLAUDE_BIN_PATH / PATH mutations into other suites.
  delete process.env.CLAUDE_BIN_PATH;
});

afterEach(() => {
  restoreEnv('CLAUDE_BIN_PATH', ORIGINAL_CLAUDE_BIN_PATH);
  restoreEnv('PATH', ORIGINAL_PATH);
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe('Plan 016 Step 6 — ClaudeCapabilityProbe', () => {
  it('1. resolves without throwing and reports an uninstalled, unsupported Claude when no executable is available', async () => {
    const recorded: string[] = [];
    const fakeRunner: ProcessRunner = async (exec) => {
      recorded.push(exec);
      throw new Error('runner must not be invoked when no executable resolves');
    };

    const probe = new ClaudeCapabilityProbe(fakeRunner, {
      resolveExecutable: () => null,
    });

    const report = await probe.probe();

    expect(report.installed).toBe(false);
    expect(report.pluginSupport).toBe(false);
    expect(report.agentTeamsExperimental).toBe(false);
    expect(report.diagnostics.length).toBeGreaterThan(0);
    expect(report.diagnostics[0]).toContain('not found');
    expect(recorded).toEqual([]);
  });

  it('2. invokes exactly [--version, --help] in that order and never claude agents --json or headless -p (ADR 0018 decision 12)', async () => {
    const invocations: Array<{ executable: string; args: string[] }> = [];
    const fakeRunner: ProcessRunner = async (exec, args) => {
      invocations.push({ executable: exec, args: [...args] });
      if (args.includes('--version')) {
        return { exitCode: 0, stdout: '2.1.272 (Claude Code)', stderr: '' };
      }
      if (args.includes('--help')) {
        return { exitCode: 0, stdout: PLUGIN_HELP, stderr: '' };
      }
      return { exitCode: 1, stdout: '', stderr: 'unexpected invocation' };
    };

    const probe = new ClaudeCapabilityProbe(fakeRunner, {
      resolveExecutable: () => ({
        executable: 'node',
        prefixArgs: [...PREFIX_ARGS],
        source: 'node-wrapper',
      }),
    });

    const report = await probe.probe();
    expect(report.installed).toBe(true);

    const recordedArgs = invocations.map((i) => i.args);
    expect(recordedArgs).toEqual([
      [...PREFIX_ARGS, '--version'],
      [...PREFIX_ARGS, '--help'],
    ]);
    expect(invocations.map((i) => i.executable)).toEqual(['node', 'node']);
    expect(invocations).toHaveLength(2);

    for (const args of recordedArgs) {
      expect(
        args,
        'probe must never invoke claude agents --json or headless -p (ADR 0018 decision 12)'
      ).not.toContain('agents');
      expect(
        args,
        'probe must never invoke claude agents --json or headless -p (ADR 0018 decision 12)'
      ).not.toContain('--json');
      expect(
        args,
        'probe must never invoke claude agents --json or headless -p (ADR 0018 decision 12)'
      ).not.toContain('-p');
    }
  });

  it('3. parses --version stdout first line as the version and leaves --help-only flags false', async () => {
    const fakeRunner: ProcessRunner = async (exec, args) => {
      if (args.includes('--version')) {
        // Observed contract: stdout '2.1.272 (Claude Code)' => version '2.1.272 (Claude Code)'.
        return { exitCode: 0, stdout: '2.1.272 (Claude Code)', stderr: '' };
      }
      return { exitCode: 0, stdout: PLAIN_HELP, stderr: '' };
    };

    const probe = new ClaudeCapabilityProbe(fakeRunner, {
      resolveExecutable: () => ({
        executable: 'node',
        prefixArgs: [...PREFIX_ARGS],
        source: 'node-wrapper',
      }),
    });

    const report = await probe.probe();

    expect(report.installed).toBe(true);
    // Exact observed value (trimmed stdout; only the first line is kept).
    expect(report.version).toBe('2.1.272 (Claude Code)');
    expect(report.pluginSupport).toBe(false);
    expect(report.agentTeamsExperimental).toBe(false);
  });

  it('4a. derives pluginSupport from --help text only (--plugin-dir marker)', async () => {
    const withPlugin: ProcessRunner = async (exec, args) =>
      args.includes('--help')
        ? { exitCode: 0, stdout: PLUGIN_HELP, stderr: '' }
        : { exitCode: 0, stdout: '2.1.272 (Claude Code)', stderr: '' };

    const withoutPlugin: ProcessRunner = async (exec, args) =>
      args.includes('--help')
        ? { exitCode: 0, stdout: PLAIN_HELP, stderr: '' }
        : { exitCode: 0, stdout: '2.1.272 (Claude Code)', stderr: '' };

    const command = {
      executable: 'node',
      prefixArgs: [...PREFIX_ARGS],
      source: 'node-wrapper' as const,
    };

    const supported = await new ClaudeCapabilityProbe(withPlugin, {
      resolveExecutable: () => command,
    }).probe();
    expect(supported.pluginSupport).toBe(true);

    const unsupported = await new ClaudeCapabilityProbe(withoutPlugin, {
      resolveExecutable: () => command,
    }).probe();
    expect(unsupported.pluginSupport).toBe(false);
  });

  it('4b. derives agentTeamsExperimental from --help text only (env marker or "agent teams"), false for plain help', async () => {
    const withTeams: ProcessRunner = async (exec, args) =>
      args.includes('--help')
        ? { exitCode: 0, stdout: TEAMS_HELP, stderr: '' }
        : { exitCode: 0, stdout: '2.1.272 (Claude Code)', stderr: '' };

    const plain: ProcessRunner = async (exec, args) =>
      args.includes('--help')
        ? { exitCode: 0, stdout: PLAIN_HELP, stderr: '' }
        : { exitCode: 0, stdout: '2.1.272 (Claude Code)', stderr: '' };

    const command = {
      executable: 'node',
      prefixArgs: [...PREFIX_ARGS],
      source: 'node-wrapper' as const,
    };

    const experimental = await new ClaudeCapabilityProbe(withTeams, {
      resolveExecutable: () => command,
    }).probe();
    expect(experimental.agentTeamsExperimental).toBe(true);

    const stable = await new ClaudeCapabilityProbe(plain, {
      resolveExecutable: () => command,
    }).probe();
    expect(stable.agentTeamsExperimental).toBe(false);
  });

  it('4c. reports installed=false with a non-empty diagnostic when --version exits non-zero', async () => {
    const fakeRunner: ProcessRunner = async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'claude: command failed',
    });

    const probe = new ClaudeCapabilityProbe(fakeRunner, {
      resolveExecutable: () => ({
        executable: 'claude',
        prefixArgs: [],
        source: 'path-executable',
      }),
    });

    const report = await probe.probe();

    expect(report.installed).toBe(false);
    expect(report.pluginSupport).toBe(false);
    expect(report.agentTeamsExperimental).toBe(false);
    expect(report.diagnostics.length).toBeGreaterThan(0);
    expect(report.diagnostics[0]).toContain('version check failed');
    expect(report.command?.source).toBe('path-executable');
  });

  it('5. contains a rejecting runner and still resolves with installed=false plus a diagnostic', async () => {
    const fakeRunner: ProcessRunner = async () => {
      throw new Error('Command not found');
    };

    const probe = new ClaudeCapabilityProbe(fakeRunner, {
      resolveExecutable: () => ({
        executable: 'claude',
        prefixArgs: [],
        source: 'path-executable',
      }),
    });

    // The implementation awaits the runner *inside* try/catch, so an async rejection
    // (not only a synchronous throw) is caught. Observed behaviour: resolves as data.
    const report = await probe.probe();

    expect(report.installed).toBe(false);
    expect(report.pluginSupport).toBe(false);
    expect(report.agentTeamsExperimental).toBe(false);
    expect(report.diagnostics.length).toBeGreaterThan(0);
    expect(report.diagnostics[0]).toContain('Command not found');
  });

  it('6. CLAUDE_BIN_PATH wins when absolute and existing, and is ignored when relative (or unresolvable)', () => {
    process.env.CLAUDE_BIN_PATH = SELF_PATH;
    const absolute = new ClaudeCapabilityProbe(undefined, {}).resolveExecutable();
    expect(absolute).toEqual({
      executable: SELF_PATH,
      prefixArgs: [],
      source: 'env-binary',
    });

    // A relative override must never be trusted, and with an empty PATH there is no
    // fallback to find, so resolution deterministically yields null.
    process.env.CLAUDE_BIN_PATH = path.join('.', 'claude');
    process.env.PATH = '';
    expect(new ClaudeCapabilityProbe(undefined, {}).resolveExecutable()).toBeNull();

    // Same for a non-existent absolute override.
    process.env.CLAUDE_BIN_PATH = path.join(os.tmpdir(), 'agents-united-no-such-claude');
    expect(new ClaudeCapabilityProbe(undefined, {}).resolveExecutable()).toBeNull();
  });

  it.runIf(process.platform === 'win32')(
    '7. bridges a PATH-resolved .cmd shim through cmd.exe with a shell-safe argv array',
    () => {
      const dir = makeTempDir();
      fs.writeFileSync(path.join(dir, 'claude.cmd'), '@echo off\r\n', 'utf8');

      delete process.env.CLAUDE_BIN_PATH;
      process.env.PATH = dir; // only our fixture dir, so nothing else can win

      const resolved = new ClaudeCapabilityProbe(undefined, {}).resolveExecutable();
      expect(resolved).toEqual({
        executable: 'cmd.exe',
        prefixArgs: ['/c', path.join(dir, 'claude.cmd')],
        source: 'path-executable',
      });
    }
  );

  it('8. keeps both capability flags false when --help returns no usable text', async () => {
    const fakeRunner: ProcessRunner = async (exec, args) => {
      if (args.includes('--version')) {
        return { exitCode: 0, stdout: '2.1.272 (Claude Code)', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    };

    const report = await new ClaudeCapabilityProbe(fakeRunner, {
      resolveExecutable: () => ({
        executable: 'claude',
        prefixArgs: [],
        source: 'path-executable',
      }),
    }).probe();

    expect(report.installed).toBe(true);
    expect(report.pluginSupport).toBe(false);
    expect(report.agentTeamsExperimental).toBe(false);
  });

  it('9. reports installed=true with no capability flags when --help exits non-zero, and never throws', async () => {
    const fakeRunner: ProcessRunner = async (exec, args) => {
      if (args.includes('--version')) {
        return { exitCode: 0, stdout: '2.1.272 (Claude Code)', stderr: '' };
      }
      return { exitCode: 2, stdout: '', stderr: 'unknown option' };
    };

    const report = await new ClaudeCapabilityProbe(fakeRunner, {
      resolveExecutable: () => ({
        executable: 'claude',
        prefixArgs: [],
        source: 'path-executable',
      }),
    }).probe();

    expect(report.installed).toBe(true);
    expect(report.pluginSupport).toBe(false);
    expect(report.agentTeamsExperimental).toBe(false);
    expect(report.diagnostics.join('\n')).toContain('help probe returned non-zero');
  });

  it('10. derives subagentHandback from the probed version, at the documented v2.1.271 floor', async () => {
    // https://code.claude.com/docs/en/tools-reference: SubagentHandback "Requires Claude Code v2.1.271
    // or later". Only `--version` is readable, so the probe reports the version floor.
    const command = { executable: 'claude', prefixArgs: [], source: 'path-executable' as const };
    const runnerFor = (version: string): ProcessRunner => async (exec, args) =>
      args.includes('--version')
        ? { exitCode: 0, stdout: version, stderr: '' }
        : { exitCode: 0, stdout: PLAIN_HELP, stderr: '' };

    for (const version of ['2.1.278 (Claude Code)', '2.1.271', '2.2.0', '3.0.0']) {
      const report = await new ClaudeCapabilityProbe(runnerFor(version), {
        resolveExecutable: () => command,
      }).probe();
      expect(report.subagentHandback, version).toBe(true);
    }

    for (const version of ['2.1.270', '2.1.0', '1.9.9', 'not-a-version']) {
      const report = await new ClaudeCapabilityProbe(runnerFor(version), {
        resolveExecutable: () => command,
      }).probe();
      expect(report.subagentHandback, version).toBe(false);
    }

    const absent = await new ClaudeCapabilityProbe(async () => ({ exitCode: 0, stdout: '', stderr: '' }), {
      resolveExecutable: () => null,
    }).probe();
    expect(absent.subagentHandback).toBe(false);
  });
});
