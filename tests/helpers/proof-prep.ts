/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';

export type Json = any;

export const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
export const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

/**
 * The environment every child of these tests gets. `agents start --dry-run` runs `claude --version` and
 * `claude --help` when it can find a Claude executable, so the tests remove every PATH entry that holds one,
 * drop CLAUDE_BIN_PATH and the teams opt-in (the factory launcher refuses it), and switch colour off.
 */
export function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const key = Object.keys(env).find(name => name.toLowerCase() === 'path') ?? 'PATH';
  const names = process.platform === 'win32' ? ['claude', 'claude.cmd', 'claude.bat', 'claude.exe', 'claude.ps1'] : ['claude'];
  const kept = (env[key] ?? '').split(path.delimiter).filter(dir => !dir || !names.some(name => fs.existsSync(path.join(dir, name))));
  env[key] = kept.join(path.delimiter);
  delete env.CLAUDE_BIN_PATH;
  delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  env.NO_COLOR = '1';
  return { ...env, ...extra };
}

export function runNode(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {}): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, args, { cwd: options.cwd, env: options.env ?? cleanEnv(), encoding: 'utf8', windowsHide: true, timeout: options.timeout ?? 120_000, maxBuffer: 64 * 1024 * 1024 });
}

export function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

export function gitBytes(cwd: string, args: string[]): Buffer {
  const result = spawnSync('git', ['-C', cwd, ...args], { windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${String(result.stderr)}`);
  return result.stdout;
}

/**
 * SHA-256 of every regular file under a folder (forward-slash keys), except the top-level `.git`, plus the empty
 * directories. The file type is read before any read: a named pipe would block a read forever, a link is refused.
 */
export function walkFolder(root: string): { files: Record<string, string>; emptyDirectories: string[] } {
  const files: Record<string, string> = {};
  const emptyDirectories: string[] = [];
  const visit = (dir: string, prefix: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.length === 0 && prefix) emptyDirectories.push(prefix.slice(0, -1));
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (!prefix && entry.name === '.git') continue;
      const rel = `${prefix}${entry.name}`;
      const file = path.join(dir, entry.name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error(`Link under ${root}: ${rel}`);
      if (stat.isDirectory()) visit(file, `${rel}/`);
      else if (stat.isFile()) files[rel] = sha256(fs.readFileSync(file));
      else throw new Error(`Special file under ${root}: ${rel}`);
    }
  };
  visit(root, '');
  return { files, emptyDirectories };
}

export function inside(parent: string, child: string): boolean {
  const fold = (value: string): string => (process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value));
  const rel = path.relative(fold(parent), fold(child));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

export function getPath(value: Json, dotted: string): unknown {
  return dotted.split('.').reduce<Json>((node, key) => (node === null || node === undefined ? undefined : node[key]), value);
}

/**
 * A tiny git repository shaped like the part of the checkout that scenario S2 reads: a Claude host library with a lock and its
 * pages, and a copy of the built CLI. Two commits give a lock that changed between them (one page modified, one created, one
 * unchanged); one commit gives no earlier lock at all. The repository holds no recorded host source holds.
 */
export function makeMiniCheckout(root: string, cliFile: string, commits: 1 | 2): string {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.copyFileSync(cliFile, path.join(root, 'dist', 'cli.js'));
  const run = (args: string[]): void => { git(root, args); };
  run(['init', '-q', '-b', 'main']);
  run(['config', '--local', 'user.name', 'Mini Fixture']);
  run(['config', '--local', 'user.email', 'mini-fixture@example.invalid']);
  run(['config', '--local', 'commit.gpgsign', 'false']);
  const write = (rel: string, text: string): void => { const file = path.join(root, ...rel.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  write('.gitattributes', '* -text\n');
  const lock = (pages: Record<string, string>): string => JSON.stringify({ files: Object.fromEntries(Object.entries(pages).map(([rel, text]) => [rel, { url: `https://example.invalid/docs/${path.basename(rel)}`, sha256: `sha256:${sha256(text)}`, fetchedAt: '2026-01-01T00:00:00.000Z', via: 'http' }])) }, null, 2);
  const publish = (pages: Record<string, string>, message: string): void => {
    for (const [rel, text] of Object.entries(pages)) write(`host-library/claude/${rel}`, text);
    write('host-library/claude/library.lock.json', `${lock(pages)}\n`);
    run(['add', '-A', '.gitattributes', 'host-library']);
    run(['commit', '-q', '-m', message]);
  };
  const first = { 'pages/agent/sub-agents.md': '# Sub-agents v1\n\nFirst snapshot.\n', 'pages/orchestration/workflow-authoring.md': '# Workflow authoring\n\nUnchanged page.\n' };
  publish(first, 'First library snapshot');
  if (commits === 2) publish({ ...first, 'pages/agent/sub-agents.md': '# Sub-agents v2\n\nRefreshed snapshot.\n', 'pages/hook/hooks.md': '# Hooks\n\nA page created by the refresh.\n' }, 'Refresh the library');
  return root;
}
