import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * host-agent-router 1.1.2: from Windows, the WSL side is reached with a bash line that has to find `node` where a version manager put
 * it (nvm is the usual way node is installed on WSL, and a login, non-interactive shell does not run the part of ~/.bashrc that sets it up).
 * Nothing here starts wsl.exe or a Host. The line is run for real with a local bash in a throwaway HOME; the rest is pure data.
 */

const SCRIPT = path.resolve('registry/skills/host-agent-router/scripts/router.mjs');
const DEFAULTS = path.resolve('registry/skills/host-agent-router/assets/config.default.json');

type Lib = {
  wslNodeLine: (wslNode?: string | null) => string;
  wslBridgeArgv: (a: { distro: string; script: string; command: string; payloadFile: string; wslNode?: string | null }) => string[];
  skipNote: (error: unknown) => string;
  validateConfig: (cfg: unknown) => string[];
  searchDirs: (o?: { pathVar?: string; platform?: string; execPath?: string; home?: string }) => string[];
  envWithNodeDir: (env?: Record<string, string | undefined>, o?: { platform?: string; execPath?: string }) => Record<string, string | undefined>;
  which: (name: string, o?: { dirs?: string[] }) => string | null;
  runCmd: (argv: string[], o?: { timeout?: number; env?: Record<string, string> }) => Promise<{ rc: number; stdout: string; stderr: string }>;
};
const lib = async (): Promise<Lib> => (await import(pathToFileURL(SCRIPT).href)) as Lib;

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'har-wsl-'));
  dirs.push(d);
  return d;
}

const WIN = process.platform === 'win32';
/** Git Bash on Windows (never C:\Windows\System32\bash.exe, which is WSL), `bash` elsewhere; null when there is none. */
function findBash(): string | null {
  if (WIN) {
    const roots = [process.env.ProgramFiles, process.env.ProgramW6432, 'C:\\Program Files'].filter(Boolean) as string[];
    for (const r of roots) for (const rel of ['Git\\bin\\bash.exe', 'Git\\usr\\bin\\bash.exe']) if (fs.existsSync(path.join(r, rel))) return path.join(r, rel);
    return null;
  }
  return spawnSync('bash', ['-c', 'exit 0']).status === 0 ? 'bash' : null;
}
const BASH = findBash();
/** A path as bash sees it: Git Bash reads C:\x as /c/x. */
const toBash = (p: string): string => (WIN ? p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`) : p);

/** A `node` that prints its label, then one line per argument. */
function fakeNode(dir: string, label: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'node');
  fs.writeFileSync(f, `#!/bin/sh\necho ${label}\nfor a in "$@"; do printf '[%s]\\n' "$a"; done\n`, { mode: 0o755 });
  fs.chmodSync(f, 0o755);
  return f;
}

const ARGS = ['/staged/router.mjs', 'machine', '--payload', '/staged/pay load.json', 'a$HOME'];
const ARG_LINES = ['[/staged/router.mjs]', '[machine]', '[--payload]', '[/staged/pay load.json]', '[a$HOME]'];

/**
 * Runs the bridge line with a local bash in a throwaway HOME and a PATH that holds no node. It is `bash -c`, not `bash -lc`: the line is the
 * same, and `-l` only adds the profile files, which would read the real machine's (/etc/profile resets PATH and may find a real node).
 */
function runLine(line: string, home: string, pathDirs: string[] = []) {
  const bin = tmp();
  const env: Record<string, string> = { PATH: [bin, ...pathDirs.map(toBash)].join(WIN ? ';' : ':'), HOME: home };
  if (WIN) env.SYSTEMROOT = process.env.SYSTEMROOT ?? 'C:\\Windows';
  const r = spawnSync(BASH!, ['-c', line, ...ARGS], { env, encoding: 'utf8' });
  return { status: r.status, out: r.stdout.replace(/\r/g, '').split('\n').filter(Boolean), err: r.stderr.replace(/\r/g, '') };
}
function nvmHome(label: string, noise = false): { home: string; bin: string } {
  const home = tmp();
  const bin = path.join(home, 'nvm-bin');
  fakeNode(bin, label);
  const nvmDir = path.join(home, '.nvm');
  fs.mkdirSync(nvmDir, { recursive: true });
  fs.writeFileSync(path.join(nvmDir, 'nvm.sh'), `${noise ? 'echo nvm says hello\necho "and to stderr" >&2\n' : ''}PATH="${toBash(bin)}:$PATH"\n`);
  return { home, bin };
}

describe('the argv that reaches WSL from Windows', () => {
  it('is wsl.exe, the distro, --exec, bash -lc, the line, then script, command, --payload, file', async () => {
    const { wslBridgeArgv, wslNodeLine } = await lib();
    const a = { distro: 'Ubuntu', script: '/mnt/c/t/har-1/router.mjs', command: 'local-probe', payloadFile: '/mnt/c/t/har-1/payload.json' };
    expect(wslBridgeArgv(a)).toEqual(['wsl.exe', '-d', 'Ubuntu', '--exec', 'bash', '-lc', wslNodeLine(), a.script, 'local-probe', '--payload', a.payloadFile]);
    expect(wslBridgeArgv({ ...a, wslNode: '/opt/node/bin/node' })).toEqual(['wsl.exe', '-d', 'Ubuntu', '--exec', 'bash', '-lc', wslNodeLine('/opt/node/bin/node'), a.script, 'local-probe', '--payload', a.payloadFile]);
    expect(wslNodeLine('/opt/node/bin/node')).toContain("N='/opt/node/bin/node';");
    expect(wslNodeLine()).toContain("N='';");
    expect(wslNodeLine('/a/b c/node')).not.toBe(wslNodeLine());
  });

  it('is one line without a carriage return, quotes a path with a quote in it, and never asks for an interactive shell', async () => {
    const { wslNodeLine, wslBridgeArgv } = await lib();
    for (const line of [wslNodeLine(), wslNodeLine('/opt/it\'s/node')]) {
      expect(line).not.toMatch(/[\r\n]/);
      expect(line).toMatch(/exec "\$N" "\$0" "\$@"$/);
    }
    expect(wslNodeLine("/opt/it's/node")).toContain("N='/opt/it'\\''s/node';");
    const argv = wslBridgeArgv({ distro: 'U', script: 's', command: 'c', payloadFile: 'p' });
    expect(argv[argv.indexOf('bash') + 1]).toBe('-lc');
    expect(argv).not.toContain('-i');
    expect(argv).not.toContain('--');
  });
});

describe.skipIf(!BASH)(`the bash line, run for real with ${BASH ? 'a local bash' : 'no bash on this machine (skipped: no bash on the path)'}`, () => {
  it('runs the login PATH node first, handing over the script and every argument unchanged', async () => {
    const { wslNodeLine } = await lib();
    const pathNode = tmp();
    fakeNode(pathNode, 'PATH');
    const { home } = nvmHome('NVM');
    const r = runLine(wslNodeLine(), home, [pathNode]);
    expect(r.status).toBe(0);
    expect(r.out).toEqual(['PATH', ...ARG_LINES]);
  });

  it('finds an nvm node when the login PATH has none, with the script path and arguments unchanged (a space, a $)', async () => {
    const { wslNodeLine } = await lib();
    const { home } = nvmHome('NVM');
    const r = runLine(wslNodeLine(), home);
    expect(r.err).toBe('');
    expect(r.status).toBe(0);
    expect(r.out).toEqual(['NVM', ...ARG_LINES]);
  });

  it('does not let nvm.sh print into the output (stdout or stderr)', async () => {
    const { wslNodeLine } = await lib();
    const { home } = nvmHome('NVM', true);
    const r = runLine(wslNodeLine(), home);
    expect(r.status).toBe(0);
    expect(r.out).toEqual(['NVM', ...ARG_LINES]);
    expect(r.err).toBe('');
  });

  it('honours NVM_DIR', async () => {
    const { wslNodeLine } = await lib();
    const home = tmp();
    const other = nvmHome('OTHER');
    const line = `NVM_DIR=${toBash(path.join(other.home, '.nvm'))}; ${wslNodeLine()}`;
    const r = runLine(line, home);
    expect(r.out).toEqual(['OTHER', ...ARG_LINES]);
  });

  it('an explicit wslNode wins over the login PATH and over nvm', async () => {
    const { wslNodeLine } = await lib();
    const pathNode = tmp();
    fakeNode(pathNode, 'PATH');
    const { home } = nvmHome('NVM');
    const explicit = fakeNode(path.join(tmp(), 'chosen bin'), 'EXPLICIT');
    const r = runLine(wslNodeLine(toBash(explicit)), home, [pathNode]);
    expect(r.status).toBe(0);
    expect(r.out).toEqual(['EXPLICIT', ...ARG_LINES]);
  });

  it('an explicit wslNode that is not there falls through to the rest of the order', async () => {
    const { wslNodeLine } = await lib();
    const { home } = nvmHome('NVM');
    const r = runLine(wslNodeLine('/no/such/node'), home);
    expect(r.out).toEqual(['NVM', ...ARG_LINES]);
  });

  it.each([
    ['.volta/bin'],
    ['.local/share/fnm/aliases/default/bin'],
    ['.local/bin'],
  ])('finds the per-user node in %s when nvm is absent', async rel => {
    const { wslNodeLine } = await lib();
    const home = tmp();
    fakeNode(path.join(home, ...rel.split('/')), 'PLACE');
    const r = runLine(wslNodeLine(), home);
    expect(r.status).toBe(0);
    expect(r.out).toEqual(['PLACE', ...ARG_LINES]);
  });

  it('exits 127 with a message the skip note turns into "WSL has no node" when nothing is found', async () => {
    const { wslNodeLine, skipNote } = await lib();
    const r = runLine(wslNodeLine(), tmp());
    expect(r.status).toBe(127);
    expect(r.out).toEqual([]);
    expect(r.err).toMatch(/node: not found/);
    const note = skipNote(new Error(`wsl bridge returned no JSON (rc=127): ${r.err.trim()}`));
    expect(note).toMatch(/^WSL has no node/);
  });
});

describe('the skip note for a WSL without node', () => {
  it('says so in one sentence, names the config key, and holds no path', async () => {
    const { skipNote } = await lib();
    const staged = 'wsl bridge returned no JSON (rc=127): /mnt/c/Users/dev/AppData/Local/Temp/har-84776f-lKeHDu/router.mjs: line 1: exec: node: not found';
    const n = skipNote(new Error(staged));
    expect(n).toBe('WSL has no node (the config key "wslNode" can name it)');
    expect(n).not.toMatch(/[\\/]|Users|har-/);
    expect(skipNote(new Error('wsl bridge returned no JSON (rc=127): node: not found (not on the login PATH, not in nvm, not in the usual per-user folders)'))).toBe(n);
    expect(skipNote(new Error('cannot open /home/dev/x now'))).toBe('cannot open <path> now');
  });
});

describe('the wslNode config key', () => {
  const base = async () => JSON.parse(fs.readFileSync(DEFAULTS, 'utf8')) as Record<string, unknown>;

  it('is in the default config as null, and null, absent and a Linux path are valid', async () => {
    const { validateConfig } = await lib();
    const cfg = await base();
    expect(cfg).toHaveProperty('wslNode', null);
    expect(validateConfig(cfg)).toEqual([]);
    delete cfg.wslNode;
    expect(validateConfig(cfg)).toEqual([]);
    expect(validateConfig({ ...cfg, wslNode: '/home/dev/.nvm/versions/node/v24.20.0/bin/node' })).toEqual([]);
  });

  it.each([[''], ['node'], ['C:\\node\\node.exe'], ['rel/node'], ['/a\\b'], ['/a\nb'], [5], [['/x']]])('refuses %j', async bad => {
    const { validateConfig } = await lib();
    const errs = validateConfig({ ...(await base()), wslNode: bad });
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/^wslNode must be an absolute Linux path/);
  });
});

describe('on the WSL side, the script looks beside its own node and in ~/.local/bin as well as on PATH', () => {
  const exe = (dir: string, name: string): string => {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, name + (WIN ? '.exe' : ''));
    fs.writeFileSync(f, '#!/bin/sh\n', { mode: 0o755 });
    fs.chmodSync(f, 0o755);
    return f;
  };

  it('searchDirs lists PATH first, then the folder of node and ~/.local/bin; on Windows PATH only', async () => {
    const { searchDirs } = await lib();
    const o = { pathVar: ['/p1', '/p2'].join(path.delimiter), execPath: path.join('/n', 'bin', 'node'), home: path.join('/h', 'u') };
    expect(searchDirs({ ...o, platform: 'linux' })).toEqual(['/p1', '/p2', path.join('/n', 'bin'), path.join('/h', 'u', '.local', 'bin')]);
    expect(searchDirs({ ...o, platform: 'win32' })).toEqual(['/p1', '/p2']);
  });

  it('finds an executable that exists only beside the running node', async () => {
    const { searchDirs, which } = await lib();
    const nodeBin = path.join(tmp(), 'bin');
    const f = exe(nodeBin, 'fakecline');
    const search = searchDirs({ pathVar: tmp(), platform: 'linux', execPath: path.join(nodeBin, 'node'), home: tmp() });
    expect(which('fakecline', { dirs: search })?.toLowerCase()).toBe(f.toLowerCase()); // PATHEXT may give .EXE for .exe
    expect(which('fakecline', { dirs: searchDirs({ pathVar: tmp(), platform: 'win32', execPath: path.join(nodeBin, 'node'), home: tmp() }) })).toBeNull();
  });

  it('finds an executable that exists only in ~/.local/bin', async () => {
    const { searchDirs, which } = await lib();
    const home = tmp();
    const f = exe(path.join(home, '.local', 'bin'), 'fakeagy');
    const search = searchDirs({ pathVar: tmp(), platform: 'linux', execPath: path.join(tmp(), 'node'), home });
    expect(which('fakeagy', { dirs: search })?.toLowerCase()).toBe(f.toLowerCase());
    expect(which('fakeagy', { dirs: [] })).toBeNull();
  });

  it('prefers PATH over the extra folders', async () => {
    const { searchDirs, which } = await lib();
    const onPath = tmp();
    const extra = tmp();
    const wanted = exe(onPath, 'fakehost');
    exe(extra, 'fakehost');
    expect(which('fakehost', { dirs: searchDirs({ pathVar: onPath, platform: 'linux', execPath: path.join(extra, 'node'), home: tmp() }) })?.toLowerCase()).toBe(wanted.toLowerCase());
  });

  it('appends the folder of node to the PATH of a Host it starts, only when it is missing, without touching the input', async () => {
    const { envWithNodeDir } = await lib();
    const execPath = path.join('/n', 'bin', 'node');
    const dir = path.join('/n', 'bin');
    const env = { PATH: ['/a', '/b'].join(path.delimiter), KEEP: '1' };
    const out = envWithNodeDir(env, { platform: 'linux', execPath });
    expect(out.PATH).toBe(['/a', '/b', dir].join(path.delimiter));
    expect(out.KEEP).toBe('1');
    expect(env.PATH).toBe(['/a', '/b'].join(path.delimiter));
    const already = { PATH: [dir, '/a'].join(path.delimiter) };
    expect(envWithNodeDir(already, { platform: 'linux', execPath })).toBe(already);
    expect(envWithNodeDir({}, { platform: 'linux', execPath }).PATH).toBe(dir);
    expect(envWithNodeDir(env, { platform: 'win32', execPath })).toBe(env);
  });

  it.skipIf(WIN)('runCmd starts a child with the folder of node on its PATH', async () => {
    const { runCmd } = await lib();
    const script = path.join(tmp(), 'print-path.mjs');
    fs.writeFileSync(script, 'console.log(process.env.PATH);\n');
    const r = await runCmd([process.execPath, script], { env: { PATH: '/usr/nonexistent' } });
    expect(r.rc).toBe(0);
    expect(r.stdout.trim().split(path.delimiter)).toContain(path.dirname(process.execPath));
  });
});
