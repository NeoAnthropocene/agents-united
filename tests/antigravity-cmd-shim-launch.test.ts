import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AntigravityCapabilityProbe } from '../src/core/antigravity-capabilities.js';
import { AntigravityLauncher } from '../src/core/antigravity-launcher.js';
import { ANTIGRAVITY_SHIM_HOST, cmdShimRefusalFor } from '../src/core/cmd-shim.js';
import { InstallEngine } from '../src/core/installer.js';
import type { AntigravityCapabilityReport, ResolvedAgyCommand } from '../src/core/types.js';
import { builtCliPath, exeShim, FOLDER_PREFIX, npmShim, PROMPT } from './helpers/cmd-shim-fixtures.js';

/**
 * The Windows `.cmd` shim route of the Antigravity launcher: the same fault the Claude and Cline launchers had.
 * `cmd.exe /c <shim>` cuts a multi-line first message at its first line break and fails on some shim paths, so the
 * probe reads the program the shim starts and the launcher refuses a bridge it cannot avoid. The reader itself is
 * covered in tests/claude-cmd-shim-launch.test.ts; these tests cover the Antigravity wiring.
 * Every fixture is a temporary file; no real `agy` is started. No real Antigravity shim was observed (none exists on
 * the development machine, where `agy` is a native agy.exe), so the shim shapes here are the npm cmd-shim shapes.
 */

function report(command: ResolvedAgyCommand): AntigravityCapabilityReport {
  return { installed: true, command, agentFlag: true, promptInteractive: true, modes: [], meetsVersionFloor: true, diagnostics: [] };
}

describe('Antigravity launcher .cmd shim route', () => {
  let root: string;
  let shimDir: string;
  let savedPath: string | undefined;
  let savedBin: string | undefined;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), FOLDER_PREFIX));
    shimDir = path.join(root, 'npm bin');
    await fs.ensureDir(shimDir);
    savedPath = process.env.PATH;
    savedBin = process.env.AGY_BIN_PATH;
    delete process.env.AGY_BIN_PATH;
  });

  afterEach(async () => {
    if (savedPath === undefined) delete process.env.PATH; else process.env.PATH = savedPath;
    if (savedBin === undefined) delete process.env.AGY_BIN_PATH; else process.env.AGY_BIN_PATH = savedBin;
    await fs.remove(root);
  });

  function onlyFixtureOnPath(...dirs: string[]): void {
    const system32 = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
    process.env.PATH = [...(dirs.length > 0 ? dirs : [shimDir]), system32, path.dirname(process.execPath)].join(path.delimiter);
  }

  /** A Node script that prints a version for `--version`, a flag list for `--help`, and otherwise records its argv as JSON. */
  async function writeRecorder(relative: string, out: string): Promise<string> {
    const file = path.join(shimDir, relative);
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, [
      "const fs = require('node:fs');",
      "if (process.argv[2] === '--version') { process.stdout.write('1.2.99\\n'); process.exit(0); }",
      "if (process.argv[2] === '--help') { process.stdout.write('Usage: agy --agent <name> --prompt-interactive --mode <m>\\n'); process.exit(0); }",
      `fs.writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(2)));`,
      '',
    ].join('\n'));
    return file;
  }

  async function writeMarkerShim(dir: string, marker: string): Promise<string> {
    await fs.ensureDir(dir);
    const shim = path.join(dir, 'agy.cmd');
    await fs.writeFile(shim, `@echo off\r\necho ran> "${marker}"\r\n`);
    return shim;
  }

  function planFor(command: ResolvedAgyCommand, workspace: string = root) {
    const launcher = new AntigravityLauncher();
    const plan = launcher.planActivation({ bundleName: 'software-engineering', workspace, scope: 'project', prompt: PROMPT, report: report(command) });
    return { launcher, plan };
  }

  describe('the refusal of a cmd.exe bridge', () => {
    const bridge = (shim: string): ResolvedAgyCommand => ({ executable: 'cmd.exe', prefixArgs: ['/c', shim], source: 'path-executable' });

    it('names the shim and only a way out the code accepts: AGY_BIN_PATH set to agy.exe', () => {
      const shim = path.join(shimDir, 'agy.cmd');
      const text = cmdShimRefusalFor(ANTIGRAVITY_SHIM_HOST, 'cmd.exe', ['/c', shim]);
      expect(text).toContain(shim);
      expect(text).toMatch(/^Antigravity CLI \(agy\) resolved/);
      expect(text).toMatch(/first message/i);
      expect(text).toContain('Set AGY_BIN_PATH to the full path of agy.exe, the native binary, and run the command again.');
      expect(text).not.toMatch(/CLAUDE|CLINE|reinstall/i);
    });

    it('is carried by the plan as data, and is absent for an ordinary executable', () => {
      const shim = path.join(shimDir, 'agy.cmd');
      const refusal = planFor(bridge(shim)).plan.cmdShimRefusal;
      expect(refusal).toBeDefined();
      expect(refusal).toBe(cmdShimRefusalFor(ANTIGRAVITY_SHIM_HOST, 'cmd.exe', ['/c', shim]));
      expect(planFor({ executable: process.execPath, prefixArgs: [], source: 'path-executable' }).plan.cmdShimRefusal).toBeUndefined();
    });

    it('stops the real start with exactly that text', async () => {
      const { launcher, plan } = planFor(bridge(path.join(shimDir, 'agy.cmd')));
      expect(plan.cmdShimRefusal).toBeDefined();
      await expect(launcher.launch(plan)).rejects.toThrow(plan.cmdShimRefusal!);
    });
  });

  describe.runIf(process.platform === 'win32')('on Windows', () => {
    it('starts the program an npm shim names, directly, with a multi-line message intact, from a folder with spaces', async () => {
      const out = path.join(root, 'argv.json');
      const script = await writeRecorder(path.join('node_modules', 'fake-agy', 'bin', 'cli.js'), out);
      await fs.writeFile(path.join(shimDir, 'agy.cmd'), npmShim('node_modules\\fake-agy\\bin\\cli.js'));
      onlyFixtureOnPath();

      const command = new AntigravityCapabilityProbe().resolveExecutable();
      expect(command).toEqual({ executable: process.execPath, prefixArgs: [script], source: 'path-executable' });

      const { launcher, plan } = planFor(command!);
      expect(plan.cmdShimRefusal).toBeUndefined();
      await launcher.launch(plan);
      expect(await fs.pathExists(out), 'the program behind the shim was started').toBe(true);
      expect(await fs.readJson(out)).toEqual(plan.argv.slice(command!.prefixArgs.length));
      const delivered: string[] = await fs.readJson(out);
      for (const line of PROMPT.split('\n')) expect(delivered[delivered.length - 1]).toContain(line);
    });

    it('maps a native .exe target to a path-executable command', async () => {
      const exe = path.join(shimDir, 'node_modules', 'fake-agy', 'agy.exe');
      await fs.ensureDir(path.dirname(exe));
      await fs.writeFile(exe, 'MZ');
      await fs.writeFile(path.join(shimDir, 'agy.cmd'), exeShim('node_modules\\fake-agy\\agy.exe'));
      onlyFixtureOnPath();
      expect(new AntigravityCapabilityProbe().resolveExecutable()).toEqual({ executable: exe, prefixArgs: [], source: 'path-executable' });
    });

    it('probes the version and flags through an npm shim in a folder with spaces and parentheses', async () => {
      await writeRecorder(path.join('node_modules', 'fake-agy', 'bin', 'cli.js'), path.join(root, 'argv.json'));
      await fs.writeFile(path.join(shimDir, 'agy.cmd'), npmShim('node_modules\\fake-agy\\bin\\cli.js'));
      onlyFixtureOnPath();
      const result = await new AntigravityCapabilityProbe().probe();
      expect(result.diagnostics).toEqual([]);
      expect(result.installed).toBe(true);
      expect(result.version).toBe('1.2.99');
      expect(result.agentFlag).toBe(true);
    });

    it('refuses a hand-written wrapper instead of dropping its lines, and starts nothing', async () => {
      const out = path.join(root, 'argv.json');
      await writeRecorder('cli.js', out);
      await fs.writeFile(path.join(shimDir, 'agy.cmd'), npmShim('cli.js', { extraLines: ['set AGY_HOME=D:\\data'] }));
      onlyFixtureOnPath();
      const command = new AntigravityCapabilityProbe().resolveExecutable();
      expect(path.basename(command!.executable).toLowerCase()).toBe('cmd.exe');
      const { launcher, plan } = planFor(command!);
      expect(plan.cmdShimRefusal).toBeDefined();
      await expect(launcher.launch(plan)).rejects.toThrow(plan.cmdShimRefusal!);
      expect(await fs.pathExists(out)).toBe(false);
    });

    it.each([
      ['spaces and an ampersand', 'tom & jerry'],
      ['a caret', 'a ^ b'],
      ['an at sign', 'me @ home'],
      ['parentheses', 'Program Files (x86)'],
    ])('reports an unreadable shim in a folder with %s as found and refused, and does not run it', async (_label, folder) => {
      const marker = path.join(root, 'ran.txt');
      const dir = path.join(root, folder);
      await writeMarkerShim(dir, marker);
      onlyFixtureOnPath(dir);
      const result = await new AntigravityCapabilityProbe().probe();
      expect(result.installed).toBe(true);
      expect(result.version).toBeUndefined();
      expect(result.diagnostics.join('\n')).toContain(cmdShimRefusalFor(ANTIGRAVITY_SHIM_HOST, result.command!.executable, result.command!.prefixArgs)!);
      expect(await fs.pathExists(marker)).toBe(false);
    });

    it('AGY_BIN_PATH naming a readable npm .cmd shim resolves to the program it starts', async () => {
      const script = await writeRecorder('cli.js', path.join(root, 'out.json'));
      const shim = path.join(shimDir, 'agy.cmd');
      await fs.writeFile(shim, npmShim('cli.js'));
      process.env.AGY_BIN_PATH = shim;
      expect(new AntigravityCapabilityProbe().resolveExecutable()).toEqual({ executable: process.execPath, prefixArgs: [script], source: 'env-binary' });
    });

    it('AGY_BIN_PATH naming an unreadable .cmd shim leads to the clear refusal, not to a spawn error', async () => {
      const marker = path.join(root, 'ran.txt');
      process.env.AGY_BIN_PATH = await writeMarkerShim(shimDir, marker);
      const command = new AntigravityCapabilityProbe().resolveExecutable();
      expect(command).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', process.env.AGY_BIN_PATH], source: 'env-binary' });
      const { launcher, plan } = planFor(command!);
      await expect(launcher.launch(plan)).rejects.toThrow(plan.cmdShimRefusal!);
      expect(await fs.pathExists(marker)).toBe(false);
    });

    it('AGY_BIN_PATH naming a native file is spawned directly, as before', async () => {
      const exe = path.join(shimDir, 'agy.exe');
      await fs.writeFile(exe, 'MZ');
      process.env.AGY_BIN_PATH = exe;
      expect(new AntigravityCapabilityProbe().resolveExecutable()).toEqual({ executable: exe, prefixArgs: [], source: 'env-binary' });
    });

    // The shell runs the first PATH folder's program, so a shim that cannot be read ends the scan with the refusal.
    // Name order inside one folder is the same before and after this change: agy.exe, agy.cmd, agy.bat, then the bare name.
    describe('the PATH scan ends at a shim it cannot read', () => {
      let secondDir: string;
      beforeEach(async () => {
        secondDir = path.join(root, 'second bin');
        await fs.ensureDir(secondDir);
      });

      it('refuses at the first unreadable agy.cmd even when an agy.exe is later on PATH', async () => {
        const first = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(secondDir, 'agy.exe'), 'MZ');
        onlyFixtureOnPath(shimDir, secondDir);
        const command = new AntigravityCapabilityProbe().resolveExecutable();
        expect(command).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', first], source: 'path-executable' });
        expect(planFor(command!).plan.cmdShimRefusal).toBeDefined();
      });

      it('refuses at the first unreadable agy.cmd even when a readable npm shim is later on PATH', async () => {
        const first = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(secondDir, 'cli.js'), 'process.exit(0);\n');
        await fs.writeFile(path.join(secondDir, 'agy.cmd'), npmShim('cli.js'));
        onlyFixtureOnPath(shimDir, secondDir);
        expect(new AntigravityCapabilityProbe().resolveExecutable()).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', first], source: 'path-executable' });
      });

      it('prefers agy.exe over an unreadable agy.cmd in the same folder', async () => {
        await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        const exe = path.join(shimDir, 'agy.exe');
        await fs.writeFile(exe, 'MZ');
        onlyFixtureOnPath(shimDir);
        expect(new AntigravityCapabilityProbe().resolveExecutable()).toEqual({ executable: exe, prefixArgs: [], source: 'path-executable' });
      });

      it('never picks the bare agy ahead of a shim in the same folder', async () => {
        const shim = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(shimDir, 'agy'), '#!/bin/sh\n');
        onlyFixtureOnPath(shimDir);
        expect(new AntigravityCapabilityProbe().resolveExecutable()).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', shim], source: 'path-executable' });
      });

      it('keeps .cmd before .bat in one folder', async () => {
        const cmd = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(shimDir, 'cli.js'), 'process.exit(0);\n');
        await fs.writeFile(path.join(shimDir, 'agy.bat'), npmShim('cli.js'));
        onlyFixtureOnPath(shimDir);
        expect(new AntigravityCapabilityProbe().resolveExecutable()).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', cmd], source: 'path-executable' });
      });
    });

    describe('agents start --host antigravity with an installed bundle and an unreadable shim on PATH', () => {
      let workspace: string;

      beforeEach(async () => {
        workspace = path.join(root, 'ws');
        await fs.ensureDir(workspace);
        await new InstallEngine().install('software-engineering', { targetDir: path.join(workspace, '.agents'), method: 'copy' });
        await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        onlyFixtureOnPath();
      });

      const runCli = (extra: string[]) => spawnSync(process.execPath, [builtCliPath(), 'start', 'software-engineering', '--host', 'antigravity', ...extra], {
        cwd: workspace,
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...process.env, CI: 'true' },
      });
      const refusalText = () => cmdShimRefusalFor(ANTIGRAVITY_SHIM_HOST, 'cmd.exe', ['/c', path.join(shimDir, 'agy.cmd')])!;

      it('the dry run prints the plan, says the real start will refuse, and exits 1 like the real start', () => {
        const result = runCli(['--dry-run']);
        expect(result.status, result.stdout + result.stderr).toBe(1);
        expect(result.stdout).toMatch(/Real start: .*refus/i);
        expect(result.stdout).toContain('AGY_BIN_PATH');
        expect(result.stdout).not.toMatch(/Dry run complete/);
      });

      it('the real start refuses, once, before it prints any Starting or capability note', async () => {
        const result = runCli([]);
        expect(result.status, result.stdout + result.stderr).toBe(1);
        expect(result.stdout.split(refusalText()).length - 1).toBe(1);
        expect(result.stdout).not.toContain('Starting Antigravity Session');
        expect(result.stdout).not.toContain('could not confirm --prompt-interactive');
        expect(await fs.pathExists(path.join(root, 'ran.txt'))).toBe(false);
      });
    });
  });
});
