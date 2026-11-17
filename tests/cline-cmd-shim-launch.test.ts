import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ClineCapabilityProbe } from '../src/core/cline-capabilities.js';
import { ClineLauncher } from '../src/core/cline-launcher.js';
import { CLINE_SHIM_HOST, cmdShimRefusalFor } from '../src/core/cmd-shim.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import type { ClineCapabilityReport, ResolvedClineCommand } from '../src/core/types.js';
import { builtCliPath, exeShim, FOLDER_PREFIX, npmShim, OPAQUE_SHIM, PROMPT } from './helpers/cmd-shim-fixtures.js';

/**
 * The Windows `.cmd` shim route of the Cline launcher: the same fault as the Claude launcher had (the maintainer's
 * decision of 2026-11-17). `cmd.exe /c <shim>` cuts a multi-line first message at its first line break and fails
 * on some shim paths, so the probe reads the program the shim starts and the launcher refuses a bridge it cannot
 * avoid. The shim reader itself is covered in tests/claude-cmd-shim-launch.test.ts; these tests cover the Cline wiring.
 * Every fixture is a temporary file; no real `cline` session is started.
 */

function report(command: ResolvedClineCommand): ClineCapabilityReport {
  return { installed: true, command, namedTeams: true, rolePresetConsumer: 'unknown', diagnostics: [] };
}

describe('Cline launcher .cmd shim route', () => {
  let root: string;
  let shimDir: string;
  let savedPath: string | undefined;
  let savedBin: string | undefined;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), FOLDER_PREFIX));
    shimDir = path.join(root, 'npm bin');
    await fs.ensureDir(shimDir);
    savedPath = process.env.PATH;
    savedBin = process.env.CLINE_BIN_PATH;
    delete process.env.CLINE_BIN_PATH;
  });

  afterEach(async () => {
    if (savedPath === undefined) delete process.env.PATH; else process.env.PATH = savedPath;
    if (savedBin === undefined) delete process.env.CLINE_BIN_PATH; else process.env.CLINE_BIN_PATH = savedBin;
    await fs.remove(root);
  });

  function onlyFixtureOnPath(...dirs: string[]): void {
    const system32 = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
    process.env.PATH = [...(dirs.length > 0 ? dirs : [shimDir]), system32, path.dirname(process.execPath)].join(path.delimiter);
  }

  /** A Node script that prints a version for `version` and otherwise records its argv as JSON. */
  async function writeRecorder(relative: string, out: string): Promise<string> {
    const file = path.join(shimDir, relative);
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, [
      "const fs = require('node:fs');",
      "if (process.argv[2] === 'version') { process.stdout.write('3.3.3\\n'); process.exit(0); }",
      `fs.writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(2)));`,
      '',
    ].join('\n'));
    return file;
  }

  async function writeMarkerShim(dir: string, marker: string): Promise<string> {
    await fs.ensureDir(dir);
    const shim = path.join(dir, 'cline.cmd');
    await fs.writeFile(shim, `@echo off\r\necho ran> "${marker}"\r\n`);
    return shim;
  }

  function planFor(command: ResolvedClineCommand, workspace: string = root) {
    const launcher = new ClineLauncher();
    const plan = launcher.planActivation({ bundleName: 'software-engineering', workspace, scope: 'project', prompt: PROMPT, report: report(command) });
    return { launcher, plan };
  }

  describe('the refusal of a cmd.exe bridge', () => {
    const bridge = (shim: string): ResolvedClineCommand => ({ executable: 'cmd.exe', prefixArgs: ['/c', shim], source: 'path-executable' });

    // CLINE_BIN_PATH is read by the code only as a native executable or a .cmd shim of the standard npm shape, and Cline
    // is installed with npm, so the advice is the npm reinstall; it must not name a cline.exe nobody can have.
    it('names the shim and only a way out the code accepts: an npm reinstall for a standard shim', () => {
      const shim = path.join(shimDir, 'cline.cmd');
      const text = cmdShimRefusalFor(CLINE_SHIM_HOST, 'cmd.exe', ['/c', shim]);
      expect(text).toContain(shim);
      expect(text).toMatch(/^Cline resolved/);
      expect(text).toMatch(/first message/i);
      expect(text).toContain('npm install -g cline');
      expect(text).toMatch(/standard npm shape/);
      expect(text).toMatch(/CLINE_BIN_PATH only helps when it names a native Cline executable or a \.cmd shim of that standard shape/);
      expect(text).not.toMatch(/cline\.exe/);
      expect(text).not.toMatch(/CLAUDE/);
    });

    it('is carried by the plan as data, and is absent for an ordinary executable', () => {
      const shim = path.join(shimDir, 'cline.cmd');
      const refusal = planFor(bridge(shim)).plan.cmdShimRefusal;
      expect(refusal).toBeDefined();
      expect(refusal).toBe(cmdShimRefusalFor(CLINE_SHIM_HOST, 'cmd.exe', ['/c', shim]));
      expect(planFor({ executable: process.execPath, prefixArgs: [], source: 'path-executable' }).plan.cmdShimRefusal).toBeUndefined();
    });

    it('stops the real start with exactly that text', async () => {
      const { launcher, plan } = planFor(bridge(path.join(shimDir, 'cline.cmd')));
      expect(plan.bootstrapPrompt).toContain('\n');
      expect(plan.cmdShimRefusal).toBeDefined();
      await expect(launcher.launch(plan)).rejects.toThrow(plan.cmdShimRefusal!);
    });
  });

  describe.runIf(process.platform === 'win32')('on Windows', () => {
    it('starts the program an npm shim names, directly, with a multi-line message intact, from a folder with spaces', async () => {
      const out = path.join(root, 'argv.json');
      await writeRecorder(path.join('node_modules', 'fake-cline', 'bin', 'cli.js'), out);
      await fs.writeFile(path.join(shimDir, 'cline.cmd'), npmShim('node_modules\\fake-cline\\bin\\cli.js'));
      onlyFixtureOnPath();

      const command = new ClineCapabilityProbe().resolveExecutable();
      expect(command).toEqual({
        executable: process.execPath,
        prefixArgs: [path.join(shimDir, 'node_modules', 'fake-cline', 'bin', 'cli.js')],
        source: 'node-wrapper',
      });

      const { launcher, plan } = planFor(command!);
      await launcher.launch(plan);
      expect(await fs.pathExists(out), 'the program behind the shim was started').toBe(true);
      expect(await fs.readJson(out)).toEqual(plan.argv.slice(command!.prefixArgs.length));
      const delivered: string[] = await fs.readJson(out);
      for (const line of PROMPT.split('\n')) expect(delivered[delivered.length - 1]).toContain(line);
    });

    it('maps a native .exe target to a path-executable command', async () => {
      const exe = path.join(shimDir, 'node_modules', 'fake-cline', 'cline.exe');
      await fs.ensureDir(path.dirname(exe));
      await fs.writeFile(exe, 'MZ');
      await fs.writeFile(path.join(shimDir, 'cline.cmd'), exeShim('node_modules\\fake-cline\\cline.exe'));
      onlyFixtureOnPath();
      expect(new ClineCapabilityProbe().resolveExecutable()).toEqual({ executable: exe, prefixArgs: [], source: 'path-executable' });
    });

    it('keeps the adjacent Node wrapper ahead of the shim reader', async () => {
      const wrapper = path.join(shimDir, 'node_modules', 'cline', 'bin', 'cline');
      await fs.ensureDir(path.dirname(wrapper));
      await fs.writeFile(wrapper, '#!/usr/bin/env node\n');
      await fs.writeFile(path.join(shimDir, 'cline.cmd'), OPAQUE_SHIM);
      onlyFixtureOnPath();
      expect(new ClineCapabilityProbe().resolveExecutable()).toEqual({ executable: process.execPath, prefixArgs: [wrapper], source: 'node-wrapper' });
    });

    it('probes the version through an npm shim in a folder with spaces and parentheses', async () => {
      await writeRecorder(path.join('node_modules', 'fake-cline', 'bin', 'cli.js'), path.join(root, 'argv.json'));
      await fs.writeFile(path.join(shimDir, 'cline.cmd'), npmShim('node_modules\\fake-cline\\bin\\cli.js'));
      onlyFixtureOnPath();
      const result = await new ClineCapabilityProbe().probe();
      expect(result.installed).toBe(true);
      expect(result.version).toBe('3.3.3');
      expect(result.namedTeams).toBe(true);
    });

    it('refuses a hand-written wrapper instead of dropping its lines, and starts nothing', async () => {
      const out = path.join(root, 'argv.json');
      await writeRecorder('cli.js', out);
      await fs.writeFile(path.join(shimDir, 'cline.cmd'), npmShim('cli.js', { extraLines: ['set CLINE_DIR=D:\\data'] }));
      onlyFixtureOnPath();
      const command = new ClineCapabilityProbe().resolveExecutable();
      expect(path.basename(command!.executable).toLowerCase()).toBe('cmd.exe');
      const { launcher, plan } = planFor(command!);
      expect(plan.cmdShimRefusal).toBeDefined();
      await expect(launcher.launch(plan)).rejects.toThrow(plan.cmdShimRefusal!);
      expect(await fs.pathExists(out)).toBe(false);
    });

    it.each([
      ['spaces and an ampersand', 'tom & jerry'],
      ['a caret', 'a ^ b'],
      ['parentheses', 'Program Files (x86)'],
    ])('reports an unreadable shim in a folder with %s as found and refused, and does not run it', async (_label, folder) => {
      const marker = path.join(root, 'ran.txt');
      const dir = path.join(root, folder);
      await writeMarkerShim(dir, marker);
      onlyFixtureOnPath(dir);
      const result = await new ClineCapabilityProbe().probe();
      expect(result.installed).toBe(true);
      expect(result.version).toBeUndefined();
      expect(result.diagnostics.join('\n')).toContain(cmdShimRefusalFor(CLINE_SHIM_HOST, result.command!.executable, result.command!.prefixArgs)!);
      expect(await fs.pathExists(marker)).toBe(false);
    });

    it('CLINE_BIN_PATH naming a readable npm .cmd shim resolves to the program it starts', async () => {
      const script = await writeRecorder('cli.js', path.join(root, 'out.json'));
      const shim = path.join(shimDir, 'cline.cmd');
      await fs.writeFile(shim, npmShim('cli.js'));
      process.env.CLINE_BIN_PATH = shim;
      expect(new ClineCapabilityProbe().resolveExecutable()).toEqual({ executable: process.execPath, prefixArgs: [script], source: 'env-binary' });
    });

    it('CLINE_BIN_PATH naming an unreadable .cmd shim leads to the clear refusal, not to a spawn error', async () => {
      const marker = path.join(root, 'ran.txt');
      process.env.CLINE_BIN_PATH = await writeMarkerShim(shimDir, marker);
      const command = new ClineCapabilityProbe().resolveExecutable();
      expect(path.basename(command!.executable).toLowerCase()).toBe('cmd.exe');
      const { launcher, plan } = planFor(command!);
      await expect(launcher.launch(plan)).rejects.toThrow(plan.cmdShimRefusal!);
      expect(await fs.pathExists(marker)).toBe(false);
    });

    // The shell runs the first PATH folder's program, so a shim that cannot be read ends the scan with the refusal:
    // no later folder may win silently over it. Inside one folder the name order is .exe, .cmd, .bat, then the bare name.
    describe('the PATH scan ends at a shim it cannot read', () => {
      let secondDir: string;
      beforeEach(async () => {
        secondDir = path.join(root, 'second bin');
        await fs.ensureDir(secondDir);
      });

      it('refuses at the first unreadable cline.cmd even when a cline.exe is later on PATH', async () => {
        const first = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(secondDir, 'cline.exe'), 'MZ');
        onlyFixtureOnPath(shimDir, secondDir);
        const command = new ClineCapabilityProbe().resolveExecutable();
        expect(command).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', first], source: 'path-executable' });
        expect(planFor(command!).plan.cmdShimRefusal).toBeDefined();
      });

      it('refuses at the first unreadable cline.cmd even when a readable npm shim is later on PATH', async () => {
        const first = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(secondDir, 'cli.js'), 'process.exit(0);\n');
        await fs.writeFile(path.join(secondDir, 'cline.cmd'), npmShim('cli.js'));
        onlyFixtureOnPath(shimDir, secondDir);
        expect(new ClineCapabilityProbe().resolveExecutable()).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', first], source: 'path-executable' });
      });

      it('prefers cline.exe over an unreadable cline.cmd in the same folder', async () => {
        await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        const exe = path.join(shimDir, 'cline.exe');
        await fs.writeFile(exe, 'MZ');
        onlyFixtureOnPath(shimDir);
        expect(new ClineCapabilityProbe().resolveExecutable()).toEqual({ executable: exe, prefixArgs: [], source: 'path-executable' });
      });

      it('never picks the bare cline (an npm shell script) ahead of a shim in the same folder', async () => {
        const shim = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(shimDir, 'cline'), '#!/bin/sh\n');
        onlyFixtureOnPath(shimDir);
        expect(new ClineCapabilityProbe().resolveExecutable()).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', shim], source: 'path-executable' });
      });
    });

    describe('agents add --start with an unreadable shim on PATH', () => {
      it('installs, then refuses before the "Launching Cline team" note, with the same text as agents start', async () => {
        const marker = path.join(root, 'ran.txt');
        await writeMarkerShim(shimDir, marker);
        onlyFixtureOnPath();
        const workspace = path.join(root, 'ws-add');
        await fs.ensureDir(workspace);

        const result = spawnSync(process.execPath, [builtCliPath(), 'add', 'software-engineering', '-t', 'cline', '--copy', '-y', '--start'], {
          cwd: workspace,
          encoding: 'utf8',
          timeout: 120_000,
          env: { ...process.env, CI: 'true' },
        });
        const refusal = cmdShimRefusalFor(CLINE_SHIM_HOST, 'cmd.exe', ['/c', path.join(shimDir, 'cline.cmd')])!;
        expect(result.status, result.stdout + result.stderr).toBe(1);
        expect(result.stdout).not.toContain('Launching Cline team');
        expect(result.stdout).toMatch(/installed successfully, but the start was refused/);
        expect(result.stdout).toContain(refusal);
        expect(result.stdout).not.toMatch(/Installed ".*" successfully!/);
        expect(await fs.pathExists(path.join(workspace, '.agents', 'agents-united.json'))).toBe(true);
        expect(await fs.pathExists(marker)).toBe(false);
      });
    });

    describe('with an installed bundle and an unreadable shim on PATH', () => {
      let workspace: string;
      let agentsDir: string;

      beforeEach(async () => {
        workspace = path.join(root, 'ws');
        agentsDir = path.join(workspace, '.agents');
        await fs.ensureDir(workspace);
        await new InstallEngine().install('software-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['cline'] });
        await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        onlyFixtureOnPath();
      });

      it('doctor warns that Cline cannot be started and gives the refusal text', async () => {
        const result = await DoctorEngine.runDoctor(agentsDir, 'cline');
        expect(result.clineCapability?.installed).toBe(true);
        expect(result.warnings).toContain(cmdShimRefusalFor(CLINE_SHIM_HOST, 'cmd.exe', ['/c', path.join(shimDir, 'cline.cmd')]));
      });

      const runCli = (extra: string[], command = 'start') => spawnSync(process.execPath, [builtCliPath(), command, ...(command === 'start' ? ['software-engineering'] : []), '--host', 'cline', ...extra], {
        cwd: workspace,
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...process.env, CI: 'true' },
      });

      it('the doctor output says why the version is unknown, and prints the refusal once', () => {
        const result = runCli([], 'doctor');
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toMatch(/Detected, but cannot be started/);
        // Nothing was probed, so the named-teams support is unknown, not "unsupported".
        expect(result.stdout).toMatch(/Named Teams: .*Unknown \(the version could not be read because the shim cannot be started\)/);
        expect(result.stdout).not.toContain('Adaptive fallback');
        const refusal = cmdShimRefusalFor(CLINE_SHIM_HOST, 'cmd.exe', ['/c', path.join(shimDir, 'cline.cmd')])!;
        expect(result.stdout.split(refusal).length - 1).toBe(1);
      });

      it('the dry run prints the plan, says the real start will refuse, and exits 1 like the real start', () => {
        const result = runCli(['--dry-run']);
        expect(result.status, result.stdout + result.stderr).toBe(1);
        expect(result.stdout).toMatch(/Real start: .*refus/i);
        expect(result.stdout).toContain('CLINE_BIN_PATH');
        expect(result.stdout).not.toMatch(/Dry run complete/);
      });

      it('the real start refuses before it prints the Starting Cline Team note', async () => {
        const result = runCli([]);
        expect(result.status, result.stdout + result.stderr).toBe(1);
        expect(result.stdout).toContain('CLINE_BIN_PATH');
        expect(result.stdout).not.toContain('Starting Cline Team');
        expect(await fs.pathExists(path.join(root, 'ran.txt'))).toBe(false);
      });
    });
  });
});
