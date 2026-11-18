import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { ANTIGRAVITY_SHIM_HOST, CLAUDE_SHIM_HOST, CLINE_SHIM_HOST } from '../src/core/cmd-shim.js';
import { assertNoCmdShimBridge, cmdShimRefusalField, resolveHostBinary } from '../src/core/host-binary.js';
import type { PlainHostBinarySpec, WrappedHostBinarySpec } from '../src/core/host-binary.js';
import { exeShim, FOLDER_PREFIX, npmShim, OPAQUE_SHIM } from './helpers/cmd-shim-fixtures.js';

/**
 * The shared Windows binary resolver and the plan/launch refusal helpers that the Claude, Cline and Antigravity
 * launchers use. Every fixture is a temporary file; no real host binary is started.
 */

const WRAPPED_SPEC: WrappedHostBinarySpec = {
  binaryName: 'fakehost',
  envVar: 'FAKEHOST_BIN_PATH',
  adjacentWrappers: [['node_modules', 'fakehost', 'bin', 'fakehost'], ['node_modules', '@fake', 'fakehost', 'bin', 'fakehost']],
  shimSource: target => (target.prefixArgs.length > 0 ? 'node-wrapper' : 'path-executable'),
};
const PLAIN_SPEC: PlainHostBinarySpec = { binaryName: 'fakehost', envVar: 'FAKEHOST_BIN_PATH' };

describe('resolveHostBinary', () => {
  let root: string;
  let shimDir: string;
  let laterDir: string;
  let savedPath: string | undefined;
  let savedBin: string | undefined;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), FOLDER_PREFIX));
    shimDir = path.join(root, 'npm bin');
    laterDir = path.join(root, 'later bin');
    await fs.ensureDir(shimDir);
    await fs.ensureDir(laterDir);
    savedPath = process.env.PATH;
    savedBin = process.env.FAKEHOST_BIN_PATH;
    delete process.env.FAKEHOST_BIN_PATH;
  });

  afterEach(async () => {
    if (savedPath === undefined) delete process.env.PATH; else process.env.PATH = savedPath;
    if (savedBin === undefined) delete process.env.FAKEHOST_BIN_PATH; else process.env.FAKEHOST_BIN_PATH = savedBin;
    await fs.remove(root);
  });

  function onPath(...dirs: string[]): void {
    process.env.PATH = dirs.join(path.delimiter);
  }

  async function nodeShim(dir: string, name: string): Promise<{ shim: string; script: string }> {
    const script = path.join(dir, 'node_modules', 'fakehost', 'cli.js');
    await fs.outputFile(script, '// script\n');
    const shim = path.join(dir, name);
    await fs.writeFile(shim, npmShim('node_modules\\fakehost\\cli.js'));
    return { shim, script };
  }

  describe('on every platform', () => {
    it('returns null when nothing is on PATH and no override is set', () => {
      onPath(shimDir);
      expect(resolveHostBinary(WRAPPED_SPEC)).toBeNull();
    });

    it.runIf(process.platform !== 'win32')('takes the bare name on POSIX and ignores a .cmd beside it', async () => {
      await fs.writeFile(path.join(shimDir, 'fakehost.cmd'), OPAQUE_SHIM);
      await fs.writeFile(path.join(shimDir, 'fakehost'), '');
      onPath(shimDir);
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: path.join(shimDir, 'fakehost'), prefixArgs: [], source: 'path-executable' });
    });

    it('returns an absolute existing native override unchanged', async () => {
      const native = path.join(root, 'fakehost-native');
      await fs.writeFile(native, '');
      process.env.FAKEHOST_BIN_PATH = native;
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: native, prefixArgs: [], source: 'env-binary' });
    });

    it('ignores an override that is relative or missing and falls back to PATH', async () => {
      onPath(shimDir);
      process.env.FAKEHOST_BIN_PATH = 'relative-fakehost';
      expect(resolveHostBinary(WRAPPED_SPEC)).toBeNull();
      process.env.FAKEHOST_BIN_PATH = path.join(root, 'missing');
      expect(resolveHostBinary(WRAPPED_SPEC)).toBeNull();
    });
  });

  describe.runIf(process.platform === 'win32')('on Windows', () => {
    it('reads a .cmd override of the standard shape and reports env-binary', async () => {
      const { shim, script } = await nodeShim(shimDir, 'fakehost.cmd');
      process.env.FAKEHOST_BIN_PATH = shim;
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: process.execPath, prefixArgs: [script], source: 'env-binary' });
      expect(resolveHostBinary(PLAIN_SPEC)).toEqual({ executable: process.execPath, prefixArgs: [script], source: 'env-binary' });
    });

    it('keeps an unreadable .cmd or .bat override as a cmd.exe bridge carried as data', async () => {
      for (const name of ['override.cmd', 'override.bat']) {
        const shim = path.join(shimDir, name);
        await fs.writeFile(shim, OPAQUE_SHIM);
        process.env.FAKEHOST_BIN_PATH = shim;
        expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', shim], source: 'env-binary' });
      }
    });

    it('spawns a native .exe override directly', async () => {
      const exe = path.join(shimDir, 'custom.exe');
      await fs.writeFile(exe, '');
      process.env.FAKEHOST_BIN_PATH = exe;
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: exe, prefixArgs: [], source: 'env-binary' });
    });

    it('prefers an adjacent wrapper to everything else in that folder, in listed order', async () => {
      await fs.writeFile(path.join(shimDir, 'fakehost.cmd'), OPAQUE_SHIM);
      const second = path.join(shimDir, 'node_modules', '@fake', 'fakehost', 'bin', 'fakehost');
      await fs.outputFile(second, '');
      onPath(shimDir);
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: process.execPath, prefixArgs: [second], source: 'node-wrapper' });
      const first = path.join(shimDir, 'node_modules', 'fakehost', 'bin', 'fakehost');
      await fs.outputFile(first, '');
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: process.execPath, prefixArgs: [first], source: 'node-wrapper' });
    });

    it('ignores adjacent wrappers when the spec lists none', async () => {
      await fs.writeFile(path.join(shimDir, 'fakehost.cmd'), OPAQUE_SHIM);
      await fs.outputFile(path.join(shimDir, 'node_modules', 'fakehost', 'bin', 'fakehost'), '');
      onPath(shimDir);
      expect(resolveHostBinary(PLAIN_SPEC)).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', path.join(shimDir, 'fakehost.cmd')], source: 'path-executable' });
    });

    it('reads a PATH shim; a Node script is a node-wrapper for the wrapped spec and a path-executable for the plain one', async () => {
      const { shim, script } = await nodeShim(shimDir, 'fakehost.cmd');
      onPath(shimDir);
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: process.execPath, prefixArgs: [script], source: 'node-wrapper' });
      expect(resolveHostBinary(PLAIN_SPEC)).toEqual({ executable: process.execPath, prefixArgs: [script], source: 'path-executable' });
      expect(shim).toContain('fakehost.cmd');
    });

    it('reads a PATH shim of a native program as a path-executable', async () => {
      const program = path.join(shimDir, 'native', 'fakehost-real.exe');
      await fs.outputFile(program, '');
      await fs.writeFile(path.join(shimDir, 'fakehost.cmd'), exeShim('native\\fakehost-real.exe'));
      onPath(shimDir);
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: program, prefixArgs: [], source: 'path-executable' });
    });

    it('keeps an unreadable PATH .cmd or .bat as a cmd.exe bridge', async () => {
      for (const name of ['fakehost.cmd', 'fakehost.bat']) {
        await fs.remove(path.join(shimDir, 'fakehost.cmd'));
        await fs.remove(path.join(shimDir, 'fakehost.bat'));
        await fs.writeFile(path.join(shimDir, name), OPAQUE_SHIM);
        onPath(shimDir);
        expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: 'cmd.exe', prefixArgs: ['/c', path.join(shimDir, name)], source: 'path-executable' });
      }
    });

    it('lets an .exe beside an unreadable shim win, then orders .cmd before .bat before the bare name', async () => {
      const cmd = path.join(shimDir, 'fakehost.cmd');
      const bat = path.join(shimDir, 'fakehost.bat');
      const exe = path.join(shimDir, 'fakehost.exe');
      const bare = path.join(shimDir, 'fakehost');
      await fs.writeFile(bare, '');
      await fs.writeFile(bat, OPAQUE_SHIM);
      await fs.writeFile(cmd, OPAQUE_SHIM);
      onPath(shimDir);
      expect(resolveHostBinary(WRAPPED_SPEC)?.prefixArgs).toEqual(['/c', cmd]);
      await fs.remove(cmd);
      expect(resolveHostBinary(WRAPPED_SPEC)?.prefixArgs).toEqual(['/c', bat]);
      await fs.remove(bat);
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: bare, prefixArgs: [], source: 'path-executable' });
      await fs.writeFile(cmd, OPAQUE_SHIM);
      await fs.writeFile(exe, '');
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: exe, prefixArgs: [], source: 'path-executable' });
    });

    it('lets the first folder with a hit decide: an unreadable shim is not passed over for a later folder', async () => {
      await fs.writeFile(path.join(shimDir, 'fakehost.cmd'), OPAQUE_SHIM);
      await fs.writeFile(path.join(laterDir, 'fakehost.exe'), '');
      onPath(shimDir, laterDir);
      expect(resolveHostBinary(WRAPPED_SPEC)?.executable).toBe('cmd.exe');
    });

    it('moves on to a later folder when the earlier one has no hit', async () => {
      const exe = path.join(laterDir, 'fakehost.exe');
      await fs.writeFile(exe, '');
      onPath(shimDir, laterDir);
      expect(resolveHostBinary(WRAPPED_SPEC)).toEqual({ executable: exe, prefixArgs: [], source: 'path-executable' });
    });
  });
});

describe('cmdShimRefusalField and assertNoCmdShimBridge', () => {
  const bridge = ['/c', 'C:\\bin\\fakehost.cmd', '--flag'];

  it('gives an empty object for a plan that does not start a cmd.exe bridge', () => {
    expect(cmdShimRefusalField(CLAUDE_SHIM_HOST, 'C:\\bin\\claude.exe', ['--x'])).toEqual({});
    expect(() => assertNoCmdShimBridge(CLAUDE_SHIM_HOST, 'C:\\bin\\claude.exe', ['--x'])).not.toThrow();
  });

  it.each([CLAUDE_SHIM_HOST, CLINE_SHIM_HOST, ANTIGRAVITY_SHIM_HOST])('carries the host-specific refusal text as data and throws the same text for $label', host => {
    const field = cmdShimRefusalField(host, 'cmd.exe', bridge);
    expect(field).toEqual({ cmdShimRefusal: expect.stringContaining(host.label) });
    expect(field.cmdShimRefusal).toContain('C:\\bin\\fakehost.cmd');
    expect(field.cmdShimRefusal).toContain(host.advice);
    expect(() => assertNoCmdShimBridge(host, 'cmd.exe', bridge)).toThrow(field.cmdShimRefusal as string);
  });
});
