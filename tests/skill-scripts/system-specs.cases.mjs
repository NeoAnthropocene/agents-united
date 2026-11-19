import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import * as specs from '../../registry/skills/system-specs/scripts/specs.mjs';

// All command execution and every os/fs read of the collector goes through one `deps` object, so these cases run
// with a fake runner and fixed inputs on Windows and Linux alike. No sleeps; temp folders come from mkdtemp.

const NOW = Date.parse('2026-11-19T10:00:00Z');
const GiB = 1024 ** 3;

/** What each probe prints, by probe name. A name left out is absent (the fake runner reports a missing command). */
const OUT = {
  node: 'v24.1.0', npm: '11.0.1', pnpm: '9.15.0', git: 'git version 2.47.1.windows.1', gh: 'gh version 2.63.0 (2026-01-02)\nhttps://github.com/cli/cli',
  docker: 'Docker version 27.3.1, build ce12230', 'docker compose': 'Docker Compose version v2.29.7', python: 'Python 3.12.4', pip: 'pip 24.0 from X (python 3.12)',
  uv: 'uv 0.5.1', java: 'openjdk version "21.0.3" 2024-04-16\nOpenJDK Runtime Environment', dotnet: '9.0.100', go: 'go version go1.23.3 windows/amd64',
  rustc: 'rustc 1.82.0 (f6e511eec 2024-10-15)', cargo: 'cargo 1.82.0 (8f40fc59f 2024-08-21)', ffmpeg: 'ffmpeg version 7.1 Copyright (c) 2000-2024',
  claude: '2.1.300 (Claude Code)', codex: 'codex-cli 0.60.0', kubectl: 'Client Version: v1.31.0', terraform: 'Terraform v1.9.8\non windows_amd64',
  az: '{\n  "azure-cli": "2.66.0"\n}', vercel: '39.1.3', supabase: '2.1.1', bun: '1.1.38', deno: 'deno 2.0.6 (stable)',
};

const SHELL_OUT = { pwsh: 'PowerShell 7.4.6', powershell: '5.1.26100.2161', bash: 'GNU bash, version 5.2.26(1)-release (x86_64-pc-msys)', cmd: 'Microsoft Windows [Version 10.0.26200.1]' };

function probeFor(cmd, args) {
  const a = args.join(' ');
  const hit = specs.PROBES.find(p => [].concat(p.cmd).includes(cmd) && p.args.join(' ') === a);
  return hit ? hit.name : null;
}

export function makeDeps(over = {}) {
  const calls = [];
  const state = { inflight: 0, maxInflight: 0 };
  const outputs = over.outputs ?? OUT;
  const shellOut = over.shellOut ?? SHELL_OUT;
  const extra = over.extraRun ?? (() => null);
  const deps = {
    platform: 'win32',
    arch: 'x64',
    release: '10.0.26200',
    osVersion: 'Windows 11 Pro',
    cpus: () => [{ model: 'Fake CPU 9000 @ 3.00GHz' }, { model: 'Fake CPU 9000 @ 3.00GHz' }, { model: 'Fake CPU 9000 @ 3.00GHz' }, { model: 'Fake CPU 9000 @ 3.00GHz' }],
    totalmem: () => 31.6 * GiB,
    freeBytes: () => 120.4 * GiB,
    homedir: () => 'C:\\Users\\fakeuser',
    hostname: () => 'FAKE-HOST',
    username: () => 'fakeuser',
    env: { PATH: 'X' },
    cwd: () => 'C:\\work\\project',
    now: () => NOW,
    monotonic: () => 0,
    readFile: () => { throw new Error('ENOENT'); },
    concurrency: 4,
    run: async (cmd, args) => {
      calls.push([cmd, ...args].join(' '));
      state.inflight += 1;
      state.maxInflight = Math.max(state.maxInflight, state.inflight);
      await Promise.resolve();
      await Promise.resolve();
      state.inflight -= 1;
      const custom = extra(cmd, args);
      if (custom) return custom;
      const name = probeFor(cmd, args);
      if (name) return name in outputs ? { status: 'ok', code: 0, out: outputs[name] } : { status: 'missing', code: null, out: '' };
      const shell = specs.SHELLS.find(x => x.cmd === cmd && x.args.join(' ') === args.join(' '));
      if (shell && shell.name in shellOut) return { status: 'ok', code: 0, out: shellOut[shell.name] };
      return { status: 'missing', code: null, out: '' };
    },
    ...over.deps,
  };
  return { deps, calls, state };
}

const byName = list => Object.fromEntries(list.map(t => [t.name, t]));
const lf = s => s.replace(/\r\n/g, '\n');
const mkTemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'system-specs-'));
const rmTemp = dir => fs.rmSync(dir, { recursive: true, force: true });

// ------------------------------------------------------------------------------------------ tier 1: the sheet

test('the probe table is one data structure with the fixed tool names, each name once', () => {
  const names = specs.PROBES.map(p => p.name);
  assert.deepEqual(names, [
    'node', 'npm', 'pnpm', 'yarn', 'bun', 'deno', 'python', 'pip', 'uv', 'git', 'gh', 'docker', 'docker compose', 'podman', 'kubectl', 'helm', 'terraform',
    'az', 'aws', 'gcloud', 'vercel', 'supabase', 'java', 'dotnet', 'go', 'rustc', 'cargo', 'ruby', 'php', 'ffmpeg', 'claude', 'codex', 'cline', 'agy',
  ]);
  assert.equal(new Set(names).size, names.length);
  for (const p of specs.PROBES) {
    assert.ok(p.cmd && Array.isArray(p.args), `${p.name} has a command and an argument array`);
    assert.ok(Array.isArray(p.args), `${p.name}: args are an array, never a shell string`);
  }
});

test('collect builds the allowlisted sheet from a fake machine', async () => {
  const { deps } = makeDeps();
  const sheet = await specs.collectSpecs(deps);
  assert.equal(sheet.schemaVersion, specs.SCHEMA_VERSION);
  assert.equal(sheet.collectedAt, '2026-11-19T10:00:00Z');
  assert.deepEqual(Object.keys(sheet).sort(), ['collectedAt', 'cpu', 'freeDiskGiB', 'gpus', 'memoryGiB', 'os', 'schemaVersion', 'shells', 'tools']);
  assert.equal(sheet.os.family, 'windows');
  assert.equal(sheet.os.release, '10.0.26200');
  assert.equal(sheet.os.architecture, 'x64');
  assert.equal(sheet.cpu.logicalCores, 4);
  assert.equal(sheet.cpu.model, 'Fake CPU 9000 @ 3.00GHz');
  assert.equal(sheet.memoryGiB, 32);
  assert.equal(sheet.freeDiskGiB, 120);
  const tools = byName(sheet.tools);
  assert.equal(sheet.tools.length, specs.PROBES.length);
  assert.equal(tools.node.version, '24.1.0');
  assert.equal(tools.git.version, '2.47.1');
  assert.equal(tools.java.version, '21.0.3');
  assert.equal(tools['docker compose'].version, '2.29.7');
  assert.equal(tools.az.version, '2.66.0');
  assert.equal(tools.kubectl.version, '1.31.0');
  assert.equal(tools.podman.status, 'absent');
  assert.equal(tools.podman.version, null);
  assert.equal(tools.cline.status, 'absent');
  assert.equal(tools.agy.status, 'absent');
  const shells = byName(sheet.shells);
  assert.equal(shells.pwsh.version, '7.4.6');
  assert.equal(shells.powershell.version, '5.1.26100.2161');
  assert.equal(shells.zsh.status, 'absent');
});

test('a Windows Store python stub counts as absent, and python3 is tried when python is missing', async () => {
  const stub = makeDeps({ extraRun: (cmd, args) => (cmd === 'python3' ? { status: 'missing', code: null, out: '' } : cmd === 'python' && args[0] === '--version' ? { status: 'ok', code: 9009, out: 'Python was not found; run without arguments to install from the Microsoft Store, or disable this shortcut from Settings' } : null) });
  const sheet = await specs.collectSpecs(stub.deps);
  assert.equal(byName(sheet.tools).python.status, 'absent');
  const fallback = makeDeps({ extraRun: (cmd, args) => {
    if (cmd === 'python' && args[0] === '--version') return { status: 'missing', code: null, out: '' };
    if (cmd === 'python3' && args[0] === '--version') return { status: 'ok', code: 0, out: 'Python 3.11.2' };
    return null;
  } });
  const sheet2 = await specs.collectSpecs(fallback.deps);
  assert.equal(byName(sheet2.tools).python.version, '3.11.2');
});

test('platform families: linux, wsl and macos', async () => {
  const linux = await specs.collectSpecs(makeDeps({ deps: {
    platform: 'linux', release: '6.8.0-48-generic', osVersion: '#48-Ubuntu SMP', homedir: () => '/home/fakeuser', cwd: () => '/work/project',
    readFile: p => { if (p === '/proc/version') return 'Linux version 6.8.0-48-generic (buildd@lcy02) gcc'; if (p === '/etc/os-release') return 'NAME="Ubuntu"\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\n'; throw new Error('ENOENT'); },
  } }).deps);
  assert.equal(linux.os.family, 'linux');
  assert.equal(linux.os.environment, 'linux');
  assert.match(linux.os.distribution, /Ubuntu 24\.04/);
  const wsl = await specs.collectSpecs(makeDeps({ deps: {
    platform: 'linux', release: '5.15.167.4-microsoft-standard-WSL2', homedir: () => '/home/fakeuser', cwd: () => '/work/project', env: { PATH: 'X', WSL_DISTRO_NAME: 'Ubuntu' },
    readFile: p => { if (p === '/proc/version') return 'Linux version 5.15.167.4-microsoft-standard-WSL2'; throw new Error('ENOENT'); },
  } }).deps);
  assert.equal(wsl.os.family, 'linux');
  assert.equal(wsl.os.environment, 'wsl');
  const mac = await specs.collectSpecs(makeDeps({ deps: { platform: 'darwin', arch: 'arm64', release: '24.1.0', homedir: () => '/Users/fakeuser', cwd: () => '/work' } }).deps);
  assert.equal(mac.os.family, 'macos');
  assert.equal(mac.os.wsl, 'not applicable');
});

test('on Windows, WSL is present when its launcher answers and absent when it does not', async () => {
  const present = await specs.collectSpecs(makeDeps({ extraRun: (cmd, args) => (/^wsl(\.exe)?$/.test(cmd) ? { status: 'ok', code: 0, out: '' } : null) }).deps);
  assert.equal(present.os.wsl, 'present');
  const absent = await specs.collectSpecs(makeDeps().deps);
  assert.equal(absent.os.wsl, 'absent');
});

test('the GPU comes from nvidia-smi when it answers, else is not determined', async () => {
  const withGpu = await specs.collectSpecs(makeDeps({ extraRun: cmd => (cmd === 'nvidia-smi' ? { status: 'ok', code: 0, out: 'NVIDIA GeForce RTX 4070, 12282\n' } : null) }).deps);
  assert.deepEqual(withGpu.gpus, [{ name: 'NVIDIA GeForce RTX 4070', vramGiB: 12 }]);
  const none = await specs.collectSpecs(makeDeps().deps);
  assert.deepEqual(none.gpus, [{ name: 'not determined', vramGiB: null }]);
});

// --------------------------------------------------------------------------------- tier 2: boundaries, bounds

test('a probe that times out is not determined; one that throws never escapes', async () => {
  const { deps } = makeDeps({ extraRun: (cmd, args) => {
    if (cmd === 'git') return { status: 'timeout', code: null, out: '' };
    if (cmd === 'docker' && args[0] === '--version') throw new Error('boom');
    return null;
  } });
  const sheet = await specs.collectSpecs(deps);
  const tools = byName(sheet.tools);
  assert.equal(tools.git.status, 'not determined');
  assert.equal(tools.docker.status, 'not determined');
  assert.equal(tools.node.status, 'present');
});

test('probes run in parallel with a small cap', async () => {
  const { deps, state } = makeDeps({ deps: { concurrency: 3 } });
  await specs.collectSpecs(deps);
  assert.ok(state.maxInflight > 1, 'runs in parallel');
  assert.ok(state.maxInflight <= 3, `never over the cap (saw ${state.maxInflight})`);
});

test('the whole collect has a bound: probes not started inside the budget are not determined', async () => {
  let t = 0;
  const { deps } = makeDeps({ deps: { concurrency: 1, monotonic: () => t } });
  const inner = deps.run;
  deps.run = async (...a) => { t += 10_000; return inner(...a); };
  const sheet = await specs.collectSpecs(deps, { budgetMs: 25_000 });
  const statuses = sheet.tools.map(x => x.status);
  assert.ok(statuses.includes('not determined'), 'late probes give up');
  assert.ok(statuses.includes('present'), 'early probes ran');
});

test('every probe call is an argument array: no shell string reaches the runner', async () => {
  const { deps } = makeDeps();
  const seen = [];
  const inner = deps.run;
  deps.run = async (cmd, args, opts) => { seen.push([cmd, args, opts]); return inner(cmd, args, opts); };
  await specs.collectSpecs(deps);
  for (const [cmd, args, opts] of seen) {
    assert.equal(typeof cmd, 'string');
    assert.ok(Array.isArray(args), `${cmd}: args array`);
    assert.ok(!/\s/.test(cmd), `${cmd}: a bare command, no shell string`);
    assert.ok(opts.timeoutMs > 0 && opts.timeoutMs <= 15_000, `${cmd}: short timeout`);
  }
});

test('parseVersion reads the first version number and refuses text without one', () => {
  assert.equal(specs.parseVersion('v24.1.0'), '24.1.0');
  assert.equal(specs.parseVersion('git version 2.47.1.windows.1'), '2.47.1');
  assert.equal(specs.parseVersion('openjdk version "21.0.3" 2024-04-16'), '21.0.3');
  assert.equal(specs.parseVersion('Python was not found; run without arguments'), null);
  assert.equal(specs.parseVersion(''), null);
});

// ------------------------------------------------------------------------- tier 3: files, freshness, exit codes

test('collect writes the Markdown and JSON sheets, relative to the working folder, under 2,500 characters', async () => {
  const dir = mkTemp();
  try {
    const { deps } = makeDeps({ deps: { cwd: () => dir } });
    const res = await specs.runCli(['collect'], deps);
    assert.equal(res.code, 0, res.err);
    const md = lf(fs.readFileSync(path.join(dir, '.agents-united', 'system-specs.md'), 'utf8'));
    const json = JSON.parse(fs.readFileSync(path.join(dir, '.agents-united', 'system-specs.json'), 'utf8'));
    assert.equal(json.schemaVersion, specs.SCHEMA_VERSION);
    assert.match(md, /^# System specs/);
    assert.match(md, /Machine facts, not project facts/);
    assert.ok(md.length < 2500, `sheet is ${md.length} characters`);
    assert.match(md, /Absent: .*podman/);
    assert.ok(!res.out.includes(dir), 'the report does not print the working folder');
  } finally { rmTemp(dir); }
});

test('--out names the Markdown file and the JSON goes beside it', async () => {
  const dir = mkTemp();
  try {
    const { deps } = makeDeps({ deps: { cwd: () => dir } });
    const res = await specs.runCli(['collect', '--out', 'sheets/here.md'], deps);
    assert.equal(res.code, 0, res.err);
    assert.ok(fs.existsSync(path.join(dir, 'sheets', 'here.md')));
    assert.ok(fs.existsSync(path.join(dir, 'sheets', 'here.json')));
  } finally { rmTemp(dir); }
});

test('a sheet younger than --max-age is reused; --refresh and an older sheet are collected again', async () => {
  const dir = mkTemp();
  try {
    const first = makeDeps({ deps: { cwd: () => dir } });
    await specs.runCli(['collect'], first.deps);
    const ran = first.calls.length;
    assert.ok(ran > 0);
    const later = makeDeps({ deps: { cwd: () => dir, now: () => NOW + 2 * 3600 * 1000 } });
    const reuse = await specs.runCli(['collect', '--max-age', '24'], later.deps);
    assert.equal(reuse.code, 0);
    assert.equal(later.calls.length, 0, 'no command ran');
    assert.match(reuse.out, /reused/i);
    const refresh = makeDeps({ deps: { cwd: () => dir, now: () => NOW + 2 * 3600 * 1000 } });
    await specs.runCli(['collect', '--max-age', '24', '--refresh'], refresh.deps);
    assert.ok(refresh.calls.length > 0);
    const old = makeDeps({ deps: { cwd: () => dir, now: () => NOW + 30 * 3600 * 1000 } });
    const res = await specs.runCli(['collect', '--max-age', '24'], old.deps);
    assert.ok(old.calls.length > 0, 'older than max-age is collected again');
    assert.doesNotMatch(res.out, /reused/i);
  } finally { rmTemp(dir); }
});

test('a damaged JSON sheet is not reused', async () => {
  const dir = mkTemp();
  try {
    fs.mkdirSync(path.join(dir, '.agents-united'));
    fs.writeFileSync(path.join(dir, '.agents-united', 'system-specs.json'), '{ not json');
    fs.writeFileSync(path.join(dir, '.agents-united', 'system-specs.md'), '# x');
    const { deps, calls } = makeDeps({ deps: { cwd: () => dir } });
    const res = await specs.runCli(['collect'], deps);
    assert.equal(res.code, 0, res.err);
    assert.ok(calls.length > 0);
  } finally { rmTemp(dir); }
});

test('--json prints the JSON to stdout and writes nothing', async () => {
  const dir = mkTemp();
  try {
    const { deps } = makeDeps({ deps: { cwd: () => dir } });
    const res = await specs.runCli(['collect', '--json'], deps);
    assert.equal(res.code, 0, res.err);
    assert.equal(JSON.parse(res.out).schemaVersion, specs.SCHEMA_VERSION);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally { rmTemp(dir); }
});

test('usage errors exit 2 and name the problem; help exits 0', async () => {
  const { deps } = makeDeps();
  for (const argv of [[], ['frobnicate'], ['collect', '--nope'], ['collect', '--max-age', 'abc'], ['collect', '--max-age', '-1'], ['collect', '--out']]) {
    const res = await specs.runCli(argv, deps);
    assert.equal(res.code, 2, JSON.stringify(argv));
    assert.ok(res.err.length > 0, JSON.stringify(argv));
  }
  const help = await specs.runCli(['help'], deps);
  assert.equal(help.code, 0);
  assert.match(help.out, /collect/);
});

test('a folder that cannot be written exits 1 with a message, not a stack trace', async () => {
  const dir = mkTemp();
  try {
    fs.writeFileSync(path.join(dir, 'blocker'), 'a file where a folder is needed');
    const { deps } = makeDeps({ deps: { cwd: () => dir } });
    const res = await specs.runCli(['collect', '--out', 'blocker/sheet.md'], deps);
    assert.equal(res.code, 1);
    assert.match(res.err, /could not write/i);
    assert.ok(!res.err.includes(dir), 'the message names no absolute path');
  } finally { rmTemp(dir); }
});

// --------------------------------------------------------------------------------------- tier 4: privacy

for (const variant of [
  { label: 'windows', platform: 'win32', home: 'C:\\Users\\zelda_tester', cwd: 'C:\\Users\\zelda_tester\\code\\proj' },
  { label: 'posix', platform: 'linux', home: '/home/zelda_tester', cwd: '/home/zelda_tester/code/proj' },
]) {
  test(`privacy (${variant.label}): a planted user name, host name and home path appear in neither output file`, async () => {
    const dir = mkTemp();
    try {
      const user = 'zelda_tester';
      const host = 'PLANTED-HOST-9';
      const planted = {
        node: `v24.1.0 (${variant.home}${variant.platform === 'win32' ? '\\' : '/'}.nvm)`,
        git: `git version 2.47.1 built by ${user} on ${host}`,
        docker: `Docker version 27.3.1, build abc (${variant.home.replace(/\\/g, '/')}/.docker)`,
        gh: `gh version 2.63.0 ${host.toLowerCase()}`,
        java: `openjdk version "21.0.3" at ${variant.home}`,
      };
      const { deps } = makeDeps({
        outputs: { ...OUT, ...planted },
        deps: {
          platform: variant.platform,
          homedir: () => variant.home,
          hostname: () => host,
          username: () => user,
          cwd: () => dir,
          env: { PATH: variant.home, USERPROFILE: variant.home, USERNAME: user, COMPUTERNAME: host, GITHUB_TOKEN: 'ghp_SECRETSECRET', OPENAI_API_KEY: 'sk-SECRETSECRET' },
          cpus: () => [{ model: `Fake CPU of ${host}` }],
          osVersion: `Windows 11 Pro of ${user}`,
          readFile: p => { if (p === '/etc/os-release') return `PRETTY_NAME="Ubuntu 24.04 ${host}"`; throw new Error('ENOENT'); },
        },
        extraRun: (cmd, args) => (cmd === 'nvidia-smi' ? { status: 'ok', code: 0, out: `GPU of ${user}, 8192\n` } : null),
      });
      const res = await specs.runCli(['collect'], deps);
      assert.equal(res.code, 0, res.err);
      const files = [path.join(dir, '.agents-united', 'system-specs.md'), path.join(dir, '.agents-united', 'system-specs.json')];
      for (const f of files) {
        const text = fs.readFileSync(f, 'utf8');
        for (const secret of [user, host, host.toLowerCase(), 'ghp_SECRET', 'sk-SECRET', variant.home, variant.home.replace(/\\/g, '/'), dir]) {
          assert.ok(!text.toLowerCase().includes(secret.toLowerCase()), `${path.basename(f)} holds ${secret}`);
        }
        assert.doesNotMatch(text, /[A-Za-z]:\\|\/home\/|\/Users\//, `${path.basename(f)} holds an absolute path`);
      }
      const json = JSON.parse(fs.readFileSync(files[1], 'utf8'));
      assert.match(byName(json.tools).node.version, /^24\.1\.0/);
    } finally { rmTemp(dir); }
  });
}

test('scrub replaces home, user and host, and any leftover absolute path', () => {
  const ctx = { home: 'C:\\Users\\zelda_tester', user: 'zelda_tester', host: 'PLANTED-HOST-9' };
  assert.equal(specs.scrub('C:\\Users\\zelda_tester\\bin', ctx), '~\\bin');
  assert.equal(specs.scrub('c:/users/ZELDA_TESTER/bin', ctx), '~/bin');
  assert.equal(specs.scrub('by zelda_tester@planted-host-9', ctx), 'by <user>@<host>');
  assert.equal(specs.scrub('see /opt/tools/bin/x now', ctx), 'see <path> now');
  assert.equal(specs.scrub('plain 1.2.3', ctx), 'plain 1.2.3');
  // A very short user name is matched as a whole word only, so ordinary words survive.
  assert.equal(specs.scrub('a banana by al', { home: '', user: 'al', host: '' }), 'a banana by <user>');
});

test('the sheet carries no environment value, git remote or login state', async () => {
  const dir = mkTemp();
  try {
    const { deps, calls } = makeDeps({ deps: { cwd: () => dir, env: { PATH: 'X', SECRET_THING: 'hunter2-value', GIT_AUTHOR_EMAIL: 'me@example.test' } } });
    await specs.runCli(['collect'], deps);
    for (const f of ['system-specs.md', 'system-specs.json']) {
      const text = fs.readFileSync(path.join(dir, '.agents-united', f), 'utf8');
      assert.ok(!text.includes('hunter2-value') && !text.includes('example.test'));
      assert.doesNotMatch(text, /remote|origin|logged in|login|token|credential/i);
    }
    for (const c of calls) assert.doesNotMatch(c, /\b(remote|auth|login|status|config|whoami)\b/i, `a probe asks for account state: ${c}`);
  } finally { rmTemp(dir); }
});

// ------------------------------------------------------------------------------- tier 4: the real machine

test('smoke: the real collector returns a well-formed, private sheet', async () => {
  const deps = specs.defaultDeps();
  const sheet = await specs.collectSpecs(deps, { budgetMs: 25_000 });
  assert.equal(sheet.schemaVersion, specs.SCHEMA_VERSION);
  assert.equal(sheet.tools.length, specs.PROBES.length);
  assert.ok(sheet.cpu.logicalCores >= 1);
  assert.ok(sheet.memoryGiB >= 1);
  assert.ok(['windows', 'linux', 'macos', 'other'].includes(sheet.os.family));
  assert.equal(byName(sheet.tools).node.status, 'present', 'node runs this very test');
  const text = JSON.stringify(sheet) + specs.renderMarkdown(sheet);
  for (const secret of [os.userInfo().username, os.hostname(), os.homedir(), process.cwd()]) {
    if (secret.length >= 3) assert.ok(!text.toLowerCase().includes(secret.toLowerCase()), 'private value in the real sheet');
  }
  assert.doesNotMatch(text, /[A-Za-z]:\\|\/home\/|\/Users\//);
});
