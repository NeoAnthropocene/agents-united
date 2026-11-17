import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ClaudeCapabilityProbe } from '../src/core/claude-capabilities.js';
import { ClaudeLauncher } from '../src/core/claude-launcher.js';
import { CLAUDE_SHIM_HOST, cmdShimRefusalFor, isCmdShimBridge, resolveCmdShimTarget } from '../src/core/cmd-shim.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { renderClaudeActivationPlan, resolveClaudeTeamsPosture } from '../src/cli.js';
import type { ClaudeCapabilityReport, ResolvedClaudeCommand } from '../src/core/types.js';
import { builtCliPath, exeShim, FOLDER_PREFIX, npmShim, oldNpmShim, OPAQUE_SHIM, PROMPT } from './helpers/cmd-shim-fixtures.js';

/**
 * The Windows `.cmd` shim route of the Claude launcher (the maintainer's decision of 2026-11-17).
 *
 * Root cause of the two faults the launcher had when `claude` resolved to an npm `.cmd` shim with no
 * Node script beside it: the shim was started as `cmd.exe /c <shim> <args>`.
 *   1. `cmd.exe` ends the command string at the first line feed, so a multi-line first message reached
 *      the session as its first line only.
 *   2. `cmd.exe /c` keeps the quotes around the program path only when the command string holds exactly two
 *      quote characters; the first message and the `--settings` JSON are quoted arguments, so with a shim
 *      path that needs quoting (a space) it strips the outer quotes and runs the path up to the space.
 *      A path with `&`, `^` or `@` breaks even the two probe commands.
 * The launcher now reads the program the shim starts and spawns it directly, and refuses a shim it cannot
 * read with certainty instead of starting a session with a cut message. A wrong silent reading is worse
 * than a refusal, so the reader returns null for anything it does not recognise as a whole.
 *
 * Every fixture is a temporary `.cmd` file that records or prints its arguments; no real `claude` session is
 * started. The fixture folder name holds spaces and parentheses (like "Program Files (x86)").
 */

function report(command: ResolvedClaudeCommand): ClaudeCapabilityReport {
  return { installed: true, command, pluginSupport: true, agentTeamsExperimental: true, subagentHandback: true, diagnostics: [] };
}

describe('Claude launcher .cmd shim route', () => {
  let root: string;
  let shimDir: string;
  let savedPath: string | undefined;
  let savedBin: string | undefined;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), FOLDER_PREFIX));
    shimDir = path.join(root, 'npm bin');
    await fs.ensureDir(shimDir);
    savedPath = process.env.PATH;
    savedBin = process.env.CLAUDE_BIN_PATH;
    delete process.env.CLAUDE_BIN_PATH;
  });

  afterEach(async () => {
    if (savedPath === undefined) delete process.env.PATH; else process.env.PATH = savedPath;
    if (savedBin === undefined) delete process.env.CLAUDE_BIN_PATH; else process.env.CLAUDE_BIN_PATH = savedBin;
    await fs.remove(root);
  });

  /** PATH holds the fixture folder first, then the system folder (for cmd.exe) and Node's folder, so no real `claude` can win. */
  function onlyFixtureOnPath(...dirs: string[]): void {
    const system32 = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
    process.env.PATH = [...(dirs.length > 0 ? dirs : [shimDir]), system32, path.dirname(process.execPath)].join(path.delimiter);
  }

  /** A Node script that prints a version for `--version` and otherwise records its argv as JSON. */
  async function writeRecorder(relative: string, out: string): Promise<string> {
    const file = path.join(shimDir, relative);
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, [
      "const fs = require('node:fs');",
      "if (process.argv[2] === '--version') { process.stdout.write('9.9.9 (Claude Code)\\n'); process.exit(0); }",
      "if (process.argv[2] === '--help') { process.stdout.write('Usage: claude [options] --plugin-dir\\n'); process.exit(0); }",
      `fs.writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(2)));`,
      '',
    ].join('\n'));
    return file;
  }

  /** A shim that only leaves a marker: if it ever runs, the marker file exists. */
  async function writeMarkerShim(dir: string, marker: string): Promise<string> {
    await fs.ensureDir(dir);
    const shim = path.join(dir, 'claude.cmd');
    await fs.writeFile(shim, `@echo off\r\necho ran> "${marker}"\r\n`);
    return shim;
  }

  function planFor(command: ResolvedClaudeCommand, workspace: string = root) {
    const launcher = new ClaudeLauncher();
    const plan = launcher.planActivation({ bundleName: 'software-engineering', workspace, scope: 'project', prompt: PROMPT, report: report(command) });
    return { launcher, plan };
  }

  it('says in one sentence to run npm run build when dist/cli.js is missing', () => {
    expect(() => builtCliPath(root)).toThrow(/dist\/cli\.js is missing: run "npm run build"/);
  });

  // ---- Reading the program a shim starts (pure; runs on every platform) -------------------------------

  describe('resolveCmdShimTarget', () => {
    it('reads a Node script target from the npm shim and resolves it beside the shim, in a folder with spaces', async () => {
      const script = await writeRecorder(path.join('node_modules', 'fake-claude', 'bin', 'cli.js'), path.join(root, 'out.json'));
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, npmShim('node_modules\\fake-claude\\bin\\cli.js'));
      expect(resolveCmdShimTarget(shim)).toEqual({ executable: process.execPath, prefixArgs: [script] });
    });

    it('reads the %~dp0 form of the same line', async () => {
      const script = await writeRecorder(path.join('lib', 'cli.cjs'), path.join(root, 'out.json'));
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, npmShim('lib\\cli.cjs', { dpForm: 'tilde' }));
      expect(resolveCmdShimTarget(shim)).toEqual({ executable: process.execPath, prefixArgs: [script] });
    });

    it('resolves a target that climbs out of the shim folder with ..\\', async () => {
      const script = path.join(root, 'lib', 'cli.js');
      await fs.ensureDir(path.dirname(script));
      await fs.writeFile(script, 'process.exit(0);\n');
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, npmShim('..\\lib\\cli.js'));
      expect(resolveCmdShimTarget(shim)).toEqual({ executable: process.execPath, prefixArgs: [script] });
    });

    it('reads the older two-branch shape (one program line per IF EXIST branch)', async () => {
      const script = await writeRecorder('cli.js', path.join(root, 'out.json'));
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, oldNpmShim('cli.js'));
      expect(resolveCmdShimTarget(shim)).toEqual({ executable: process.execPath, prefixArgs: [script] });
    });

    it('reads a shim with LF line ends', async () => {
      const script = await writeRecorder('cli.js', path.join(root, 'out.json'));
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, npmShim('cli.js', { lf: true }));
      expect(resolveCmdShimTarget(shim)).toEqual({ executable: process.execPath, prefixArgs: [script] });
    });

    it('reads a shim that starts with a byte order mark', async () => {
      const script = await writeRecorder('cli.js', path.join(root, 'out.json'));
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, npmShim('cli.js', { bom: true }));
      expect(resolveCmdShimTarget(shim)).toEqual({ executable: process.execPath, prefixArgs: [script] });
    });

    it.each([
      ['with the cmd-shim prefix', true],
      ['as a bare program line', false],
    ])('returns a native .exe target as the executable with no prefix, %s', async (_label, withPrefix) => {
      const exe = path.join(shimDir, 'node_modules', 'fake-claude', 'bin', 'claude.exe');
      await fs.ensureDir(path.dirname(exe));
      await fs.writeFile(exe, 'MZ');
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, exeShim('node_modules\\fake-claude\\bin\\claude.exe', withPrefix));
      expect(resolveCmdShimTarget(shim)).toEqual({ executable: exe, prefixArgs: [] });
    });

    it('lets the interpreter the shim names run the target, whatever the first line of the target says', async () => {
      const script = path.join(shimDir, 'node_modules', 'fake-claude', 'bin', 'claude');
      await fs.ensureDir(path.dirname(script));
      await fs.writeFile(script, '#!/opt/node-tools/python\nprint(1)\n');
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, npmShim('node_modules\\fake-claude\\bin\\claude'));
      expect(resolveCmdShimTarget(shim)).toEqual({ executable: process.execPath, prefixArgs: [script] });
    });

    it('uses the node.exe beside the shim when there is one, as the shim itself does', async () => {
      const script = await writeRecorder('cli.js', path.join(root, 'out.json'));
      const nodeBesideShim = path.join(shimDir, 'node.exe');
      await fs.writeFile(nodeBesideShim, 'MZ');
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, npmShim('cli.js'));
      expect(resolveCmdShimTarget(shim)).toEqual({ executable: nodeBesideShim, prefixArgs: [script] });
    });

    // The rule: a wrong silent reading is worse than a refusal, so anything that is not a whole known shape is null.
    it.each([
      ['a shim that names no readable program', () => OPAQUE_SHIM],
      ['an empty shim', () => '@echo off\r\n'],
      ['a target that does not exist on disk', () => npmShim('node_modules\\gone\\cli.js')],
      ['a target that is a folder', () => npmShim('bin')],
      ['a hand-written wrapper that sets a variable first', () => npmShim('cli.js', { extraLines: ['set ANTHROPIC_BASE_URL=http://localhost:1234'] })],
      ['a shim that sets NODE_PATH before the target', () => npmShim('cli.js', { extraLines: ['SET NODE_PATH=%dp0%\\node_modules;%NODE_PATH%'] })],
      ['a wrapper that changes folder first', () => npmShim('cli.js', { extraLines: ['cd /d "%dp0%\\.."'] })],
      ['a wrapper that calls another script first', () => npmShim('cli.js', { extraLines: ['call "%dp0%\\env.cmd"'] })],
      ['a wrapper with an if line', () => npmShim('cli.js', { extraLines: ['if not defined FOO set FOO=1'] })],
      ['a wrapper with a comment line', () => npmShim('cli.js', { extraLines: ['rem local changes'] })],
      ['a shim whose interpreter is bun', () => npmShim('cli.js', { prog: 'bun' })],
      ['a shim with an interpreter flag before the script', () => npmShim('cli.js', { flags: '--max-old-space-size=4096' })],
      ['an old-shape shim with an interpreter flag', () => oldNpmShim('cli.js', '--harmony')],
      ['a shim that starts a native program through the interpreter line', () => npmShim('prog.exe')],
      ['a bare program line whose target is a script', () => exeShim('cli.js', false)],
      ['a target that uses another variable', () => npmShim('%OTHER%\\cli.js')],
      ['a program line without the interpreter block it relies on', () => '@ECHO off\r\n"%_prog%"  "%dp0%\\cli.js" %*\r\n'],
      // Control flow: the real shape has its goto and exit only in the header, and ends with the program line.
      ['an exit placed before the program line', () => npmShim('cli.js', { extraLines: ['exit /b'] })],
      ['a goto placed before the program line', () => npmShim('cli.js', { extraLines: ['goto start'] })],
      ['an exit after the program line', () => npmShim('cli.js') + 'exit /b\r\n'],
      ['a header that is out of order', () => npmShim('cli.js').replace('GOTO start\r\n:find_dp0\r\n', ':find_dp0\r\nGOTO start\r\n')],
      ['a header line without the rest of the header', () => '@ECHO off\r\nGOTO start\r\n"%dp0%\\prog.exe"  %*\r\n'],
      // Block structure: the _prog block is accepted only whole, and the program line only outside it.
      ['a program line inside only one branch of the IF EXIST block', () => [
        ...npmShim('cli.js').split('\r\n').slice(0, 8),
        'IF EXIST "%dp0%\\node.exe" (',
        '  SET "_prog=%dp0%\\node.exe"',
        ') ELSE (',
        '  SET "_prog=node"',
        '  SET PATHEXT=%PATHEXT:;.JS;=;%',
        '  "%_prog%"  "%dp0%\\cli.js" %*',
        ')',
        '',
      ].join('\r\n')],
      ['the node.exe set without the IF EXIST gate', () => [
        ...npmShim('cli.js').split('\r\n').slice(0, 8),
        'SET "_prog=%dp0%\\node.exe"',
        '"%_prog%"  "%dp0%\\cli.js" %*',
        '',
      ].join('\r\n')],
      ['the plain node set without the IF EXIST gate', () => [
        ...npmShim('cli.js').split('\r\n').slice(0, 8),
        'SET "_prog=node"',
        '"%_prog%"  "%dp0%\\cli.js" %*',
        '',
      ].join('\r\n')],
      ['a program line that comes before the interpreter block it relies on', () => {
        const lines = npmShim('cli.js').split('\r\n');
        const program = lines.splice(lines.length - 2, 1)[0];
        lines.splice(8, 0, program);
        return lines.join('\r\n');
      }],
    ])('returns null for %s', async (_label, build) => {
      await fs.ensureDir(path.join(shimDir, 'bin'));
      await fs.writeFile(path.join(shimDir, 'cli.js'), 'process.exit(0);\n');
      await fs.writeFile(path.join(shimDir, 'prog.exe'), 'MZ');
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, build());
      expect(resolveCmdShimTarget(shim)).toBeNull();
    });

    it('returns null when the two program lines of an old-shape shim name different targets', async () => {
      await fs.writeFile(path.join(shimDir, 'a.js'), 'process.exit(0);\n');
      await fs.writeFile(path.join(shimDir, 'b.js'), 'process.exit(0);\n');
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, oldNpmShim('a.js').replace('node  "%~dp0\\a.js"', 'node  "%~dp0\\b.js"'));
      expect(resolveCmdShimTarget(shim)).toBeNull();
    });

    it('returns null for a target that is a symlink loop', async ctx => {
      const loop = path.join(shimDir, 'loop.js');
      try {
        fs.symlinkSync(loop, loop);
      } catch {
        ctx.skip();
        return;
      }
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, npmShim('loop.js'));
      expect(resolveCmdShimTarget(shim)).toBeNull();
    });

    it('returns null for a shim file that does not exist', () => {
      expect(resolveCmdShimTarget(path.join(shimDir, 'missing.cmd'))).toBeNull();
    });
  });

  describe('isCmdShimBridge', () => {
    it.each([
      ['cmd.exe', ['/c', 'C:\\x\\claude.cmd', '--version']],
      ['C:\\Windows\\System32\\CMD.EXE', ['/C', 'C:\\x\\claude.cmd']],
      ['cmd', ['/d', '/s', '/c', 'C:\\x\\claude.cmd']],
    ])('recognises %s as a cmd.exe bridge', (executable, argv) => {
      expect(isCmdShimBridge(executable, argv)).toBe(true);
    });

    it.each([
      ['node', ['C:\\x\\cli.js', '--agent', 'a']],
      ['C:\\x\\claude.exe', ['--agent', 'a']],
      ['cmd.exe', ['--agent', 'a']],
      ['/usr/bin/claude', ['/c']],
    ])('does not mistake %s for a cmd.exe bridge', (executable, argv) => {
      expect(isCmdShimBridge(executable, argv)).toBe(false);
    });
  });

  // ---- The refusal is data on the plan, and the launcher, dry run and doctor all use it (pure) ---------

  describe('the refusal of a cmd.exe bridge', () => {
    const bridge = (shim: string): ResolvedClaudeCommand => ({ executable: 'cmd.exe', prefixArgs: ['/c', shim], source: 'path-executable' });

    it('names the shim, the first-message fault and the one way out: CLAUDE_BIN_PATH set to a claude.exe', () => {
      const shim = path.join(shimDir, 'claude.cmd');
      const text = cmdShimRefusalFor(CLAUDE_SHIM_HOST, 'cmd.exe', ['/c', shim, '--agent', 'x']);
      expect(text).toBeDefined();
      expect(text).toContain(shim);
      expect(text).toMatch(/first message/i);
      expect(text).toMatch(/CLAUDE_BIN_PATH/);
      expect(text).toMatch(/claude\.exe/);
      expect(text).not.toMatch(/reinstall/i);
      expect(cmdShimRefusalFor(CLAUDE_SHIM_HOST, 'node', ['C:\\x\\cli.js'])).toBeUndefined();
    });

    it('is carried by the plan as data, and is absent for an ordinary executable', () => {
      const shim = path.join(shimDir, 'claude.cmd');
      const refusal = planFor(bridge(shim)).plan.cmdShimRefusal;
      expect(refusal).toBeDefined();
      expect(refusal).toBe(cmdShimRefusalFor(CLAUDE_SHIM_HOST, 'cmd.exe', ['/c', shim]));
      expect(planFor({ executable: process.execPath, prefixArgs: [], source: 'path-executable' }).plan.cmdShimRefusal).toBeUndefined();
    });

    it('stops the real start with exactly that text, and says what to do', async () => {
      const { launcher, plan } = planFor(bridge(path.join(shimDir, 'claude.cmd')));
      expect(plan.bootstrapPrompt).toContain('\n');
      expect(plan.cmdShimRefusal).toBeDefined();
      await expect(launcher.launch(plan)).rejects.toThrow(plan.cmdShimRefusal!);
    });

    it('is rendered by the dry run, which says the real start will refuse', () => {
      const posture = resolveClaudeTeamsPosture(undefined, 'domain');
      const { plan } = planFor(bridge(path.join(shimDir, 'claude.cmd')));
      const rendered = renderClaudeActivationPlan(plan, report(bridge('x')), ['claude'], posture);
      expect(rendered).toMatch(/Real start: .*refus/i);
      expect(rendered).toContain(plan.cmdShimRefusal!);
      // Nothing was probed, so the capabilities are unknown, not "no".
      expect(rendered).toContain('--plugin-dir=unknown, agent teams=unknown, subagent handback=unknown');
      expect(rendered).not.toMatch(/--plugin-dir=no/);

      const ordinary = planFor({ executable: process.execPath, prefixArgs: [], source: 'path-executable' }).plan;
      expect(renderClaudeActivationPlan(ordinary, report({ executable: process.execPath, prefixArgs: [], source: 'path-executable' }), ['claude'], posture)).not.toMatch(/Real start/);
    });
  });

  // ---- The real route on Windows ---------------------------------------------------------------------

  describe.runIf(process.platform === 'win32')('on Windows', () => {
    it('starts the program an npm shim names, directly, with a multi-line message and special characters intact, from a folder with spaces', async () => {
      const out = path.join(root, 'argv.json');
      await writeRecorder(path.join('node_modules', 'fake-claude', 'bin', 'cli.js'), out);
      await fs.writeFile(path.join(shimDir, 'claude.cmd'), npmShim('node_modules\\fake-claude\\bin\\cli.js'));
      onlyFixtureOnPath();

      const command = new ClaudeCapabilityProbe().resolveExecutable();
      expect(command).not.toBeNull();

      const { launcher, plan } = planFor(command!);
      expect(plan.argv[plan.argv.length - 1]).toContain('\n');
      await launcher.launch(plan);

      expect(await fs.pathExists(out), 'the program behind the shim was started').toBe(true);
      expect(await fs.readJson(out)).toEqual(plan.argv.slice(command!.prefixArgs.length));
      const delivered: string[] = await fs.readJson(out);
      const message = delivered[delivered.length - 1];
      for (const line of PROMPT.split('\n')) expect(message).toContain(line);
      // No shell sits between the launcher and the program.
      expect(path.basename(command!.executable).toLowerCase()).not.toBe('cmd.exe');
    });

    it('probes the version and flags through an npm shim in a folder with spaces and parentheses', async () => {
      await writeRecorder(path.join('node_modules', 'fake-claude', 'bin', 'cli.js'), path.join(root, 'argv.json'));
      await fs.writeFile(path.join(shimDir, 'claude.cmd'), npmShim('node_modules\\fake-claude\\bin\\cli.js'));
      onlyFixtureOnPath();

      const result = await new ClaudeCapabilityProbe().probe();
      expect(result.diagnostics).toEqual([]);
      expect(result.installed).toBe(true);
      expect(result.version).toBe('9.9.9 (Claude Code)');
      expect(result.pluginSupport).toBe(true);
    });

    it('refuses a shim it cannot read and starts nothing', async () => {
      const out = path.join(root, 'ran.txt');
      await fs.writeFile(path.join(shimDir, 'claude.cmd'), `@echo off\r\necho ran> "${out}"\r\n`);
      onlyFixtureOnPath();

      const command = new ClaudeCapabilityProbe().resolveExecutable();
      expect(command).not.toBeNull();
      const { launcher, plan } = planFor(command!);
      expect(plan.cmdShimRefusal).toBeDefined();
      await expect(launcher.launch(plan)).rejects.toThrow(plan.cmdShimRefusal!);
      expect(await fs.pathExists(out)).toBe(false);
    });

    it('refuses a hand-written wrapper that sets a variable before the program, instead of dropping the line', async () => {
      const out = path.join(root, 'argv.json');
      await writeRecorder('cli.js', out);
      await fs.writeFile(path.join(shimDir, 'claude.cmd'), npmShim('cli.js', { extraLines: ['set ANTHROPIC_BASE_URL=http://localhost:1234'] }));
      onlyFixtureOnPath();

      const command = new ClaudeCapabilityProbe().resolveExecutable();
      expect(path.basename(command!.executable).toLowerCase()).toBe('cmd.exe');
      const { launcher, plan } = planFor(command!);
      await expect(launcher.launch(plan)).rejects.toThrow(/first message/);
      expect(await fs.pathExists(out)).toBe(false);
    });

    // The shell runs the first PATH folder's program, so a shim that cannot be read ends the scan with the refusal:
    // no later folder may win silently over it. Inside one folder the name order is .exe, .cmd, .bat, then the bare name.
    describe('the PATH scan ends at a shim it cannot read', () => {
      let secondDir: string;
      beforeEach(async () => {
        secondDir = path.join(root, 'second bin');
        await fs.ensureDir(secondDir);
      });

      it('refuses at the first unreadable claude.cmd even when a claude.exe is later on PATH', async () => {
        const first = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(secondDir, 'claude.exe'), 'MZ');
        onlyFixtureOnPath(shimDir, secondDir);

        const command = new ClaudeCapabilityProbe().resolveExecutable();
        expect(command).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', first], source: 'path-executable' });
        expect(planFor(command!).plan.cmdShimRefusal).toBeDefined();
      });

      it('refuses at the first unreadable claude.cmd even when a readable npm shim is later on PATH', async () => {
        const first = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(secondDir, 'cli.js'), 'process.exit(0);\n');
        await fs.writeFile(path.join(secondDir, 'claude.cmd'), npmShim('cli.js'));
        onlyFixtureOnPath(shimDir, secondDir);

        expect(new ClaudeCapabilityProbe().resolveExecutable()).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', first], source: 'path-executable' });
      });

      it('prefers claude.exe over an unreadable claude.cmd in the same folder, as Windows does', async () => {
        await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        const exe = path.join(shimDir, 'claude.exe');
        await fs.writeFile(exe, 'MZ');
        onlyFixtureOnPath(shimDir);

        expect(new ClaudeCapabilityProbe().resolveExecutable()).toEqual({ executable: exe, prefixArgs: [], source: 'path-executable' });
      });

      it('never picks the bare claude (an npm shell script) ahead of a shim in the same folder', async () => {
        const shim = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(shimDir, 'claude'), '#!/bin/sh\n');
        onlyFixtureOnPath(shimDir);

        expect(new ClaudeCapabilityProbe().resolveExecutable()).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', shim], source: 'path-executable' });
      });

      it('keeps the old order of .cmd before .bat in one folder', async () => {
        const cmd = await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        await fs.writeFile(path.join(shimDir, 'cli.js'), 'process.exit(0);\n');
        await fs.writeFile(path.join(shimDir, 'claude.bat'), npmShim('cli.js'));
        onlyFixtureOnPath(shimDir);

        expect(new ClaudeCapabilityProbe().resolveExecutable()).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', cmd], source: 'path-executable' });
      });
    });
    // Settled by a run (probe-chars): `cmd /c "<path>" --version` works for spaces and parentheses, and breaks when the
    // path holds & ^ or @. The probe must not depend on that: a bridge is never run, it is reported as found and refused.
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

      const result = await new ClaudeCapabilityProbe().probe();
      expect(result.installed).toBe(true);
      expect(result.version).toBeUndefined();
      expect(result.command?.executable.toLowerCase()).toContain('cmd');
      expect(result.diagnostics.join('\n')).toContain(cmdShimRefusalFor(CLAUDE_SHIM_HOST, result.command!.executable, result.command!.prefixArgs)!);
      expect(await fs.pathExists(marker)).toBe(false);
    });

    it('CLAUDE_BIN_PATH naming a readable npm .cmd shim resolves to the program it starts', async () => {
      const script = await writeRecorder('cli.js', path.join(root, 'out.json'));
      const shim = path.join(shimDir, 'claude.cmd');
      await fs.writeFile(shim, npmShim('cli.js'));
      process.env.CLAUDE_BIN_PATH = shim;
      expect(new ClaudeCapabilityProbe().resolveExecutable()).toEqual({ executable: process.execPath, prefixArgs: [script], source: 'env-binary' });
    });

    it('CLAUDE_BIN_PATH naming an unreadable .cmd shim leads to the clear refusal, not to a spawn error', async () => {
      const marker = path.join(root, 'ran.txt');
      const shim = await writeMarkerShim(shimDir, marker);
      process.env.CLAUDE_BIN_PATH = shim;

      const command = new ClaudeCapabilityProbe().resolveExecutable();
      expect(path.basename(command!.executable).toLowerCase()).toBe('cmd.exe');
      const { launcher, plan } = planFor(command!);
      expect(plan.cmdShimRefusal).toBeDefined();
      await expect(launcher.launch(plan)).rejects.toThrow(plan.cmdShimRefusal!);
      expect(await fs.pathExists(marker)).toBe(false);
    });

    describe('with an installed bundle and an unreadable shim on PATH', () => {
      let workspace: string;
      let agentsDir: string;

      beforeEach(async () => {
        workspace = path.join(root, 'ws');
        agentsDir = path.join(workspace, '.agents');
        await fs.ensureDir(workspace);
        await new InstallEngine().install('software-engineering', { targetDir: agentsDir, method: 'copy', fanout: ['claude'] });
        await writeMarkerShim(shimDir, path.join(root, 'ran.txt'));
        onlyFixtureOnPath();
      });

      it('doctor warns that Claude Code cannot be started and gives the refusal text', async () => {
        const result = await DoctorEngine.runDoctor(agentsDir, 'claude');
        expect(result.claudeCapability?.installed).toBe(true);
        const shim = path.join(shimDir, 'claude.cmd');
        expect(result.warnings).toContain(cmdShimRefusalFor(CLAUDE_SHIM_HOST, 'cmd.exe', ['/c', shim]));
      });

      const runCli = (extra: string[], command = 'start') => spawnSync(process.execPath, [builtCliPath(), command, ...(command === 'start' ? ['software-engineering'] : []), '--host', 'claude', ...extra], {
        cwd: workspace,
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...process.env, CI: 'true' },
      });

      it('the doctor output says why the version is unknown, and prints the refusal once', () => {
        const result = runCli([], 'doctor');
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).not.toContain('Needs v2.1.271');
        expect(result.stdout).toMatch(/version could not be read because the shim cannot be started/i);
        expect(result.stdout).toMatch(/Detected, but cannot be started/);
        const refusal = cmdShimRefusalFor(CLAUDE_SHIM_HOST, 'cmd.exe', ['/c', path.join(shimDir, 'claude.cmd')])!;
        expect(result.stdout.split(refusal).length - 1).toBe(1);
      });

      it('the dry run prints the plan, says the real start will refuse, and exits 1 like the real start', async () => {
        const result = runCli(['--dry-run']);
        expect(result.status, result.stdout + result.stderr).toBe(1);
        expect(result.stdout).toMatch(/Real start: .*refus/i);
        expect(result.stdout).toContain('CLAUDE_BIN_PATH');
        expect(result.stdout).not.toMatch(/Dry run complete/);
      });

      it('the real start refuses before it prints the Starting Claude Code Session note', async () => {
        const result = runCli([]);
        expect(result.status, result.stdout + result.stderr).toBe(1);
        expect(result.stdout).toContain('CLAUDE_BIN_PATH');
        expect(result.stdout).not.toContain('Starting Claude Code Session');
        expect(await fs.pathExists(path.join(root, 'ran.txt'))).toBe(false);
      });
    });
  });
});
