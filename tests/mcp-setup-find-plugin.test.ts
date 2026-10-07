import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * `scripts/find-plugin.mjs` of the `mcp-setup` skill (Plan 035 N1 slice 2, 2026-10-07).
 *
 * `claude plugin` has no search command (Claude Code 2.1.291), so the lead cannot ask the host whether a plugin exists for an integration. Two catalogs sit
 * on disk as plain files: the official marketplace clone and the built-in directory cache. The script reads them, never writes, never touches the network
 * and never runs the install it prints; the lead runs that after the user's yes. These tests use two small fixtures with the shape of the real catalogs
 * (`tests/fixtures/plugin-catalogs/`), so nothing here depends on the machine's own plugin folder.
 */

const SCRIPT = path.resolve('registry/skills/mcp-setup/scripts/find-plugin.mjs');
const OFFICIAL = path.resolve('tests/fixtures/plugin-catalogs/official-marketplace.json');
const DIRECTORY = path.resolve('tests/fixtures/plugin-catalogs/directory-cache.json');

const tmpDirs: string[] = [];
const tmp = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'find-plugin-'));
  tmpDirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const find = (args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: options.cwd, env: { ...process.env, ...options.env } });
const withFixtures = (...words: string[]) => find([...words, '--official', OFFICIAL, '--directory', DIRECTORY]);
const sha = (file: string): string => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

interface Hit {
  name: string;
  catalogs: string[];
  surfaces: string[];
  source: string;
  install: string | null;
  description: string;
}

describe('find-plugin: it exists and cannot change anything', () => {
  it('is a Node script in the skill folder', () => {
    expect(fs.existsSync(SCRIPT)).toBe(true);
  });

  it('has no write, network or process-spawning call in its source', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8');
    expect(source).not.toMatch(/writeFile|appendFile|mkdirSync|rmSync|unlinkSync|renameSync|copyFile/);
    expect(source).not.toMatch(/node:(https?|net|child_process)|\bfetch\(/);
  });

  it('leaves both catalogs and the working folder as they were', () => {
    const cwd = tmp();
    const before = [sha(OFFICIAL), sha(DIRECTORY)];
    const result = find(['context7', '--official', OFFICIAL, '--directory', DIRECTORY], { cwd });
    expect(result.status).toBe(0);
    expect([sha(OFFICIAL), sha(DIRECTORY)]).toEqual(before);
    expect(fs.readdirSync(cwd)).toEqual([]);
  });
});

describe('find-plugin: a name', () => {
  it('prints the catalogs, the surfaces, the source and the install command for a plugin that both catalogs list', () => {
    const result = withFixtures('context7');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('context7');
    expect(result.stdout).toContain('catalogs: official marketplace, built-in directory');
    expect(result.stdout).toContain('surfaces: claude_code, cowork, claude_ai');
    expect(result.stdout).toContain('source: ./external_plugins/context7');
    expect(result.stdout).toContain('install: claude plugin install context7@claude-plugins-official --scope project');
  });

  it('shows that a plugin has no claude.ai surface, which means no connector', () => {
    const result = withFixtures('playwright');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('surfaces: claude_code, cowork');
    expect(result.stdout).not.toContain('claude_ai');
  });

  it('matches a name in any case and joins the two catalogs on it, with the source of a remote plugin and a short commit', () => {
    const result = withFixtures('FIGMA');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('surfaces: claude_code, cowork, claude_ai');
    expect(result.stdout).toContain('source: https://github.com/figma/mcp-server-guide.git @ 1729207');
    expect(result.stdout).toContain('install: claude plugin install figma@claude-plugins-official --scope project');
    expect(result.stdout.match(/^figma$/gim)).toHaveLength(1);
  });

  it('says plainly when a plugin is only in the directory and gives no install command for it', () => {
    const result = withFixtures('acme');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('acme-notes');
    expect(result.stdout).toContain('catalogs: built-in directory');
    expect(result.stdout).toContain('source: https://github.com/acme/notes-plugin @ abcdef1');
    expect(result.stdout).toContain('install: none, not in the official marketplace');
    expect(result.stdout).not.toContain('claude plugin install acme-notes');
  });

  it('reports a surface as unknown for a plugin that only the marketplace lists', () => {
    const result = withFixtures('frontend-design');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('surfaces: unknown (not in the directory cache)');
  });
});

describe('find-plugin: words', () => {
  it('finds a word in a description and keeps every word of the query', () => {
    const result = withFixtures('browser');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('playwright');
    expect(result.stdout).toContain('chrome-devtools-mcp');
    expect(result.stdout).not.toContain('context7\n');
    const narrowed = withFixtures('browser', 'microsoft');
    expect(narrowed.stdout).toContain('playwright');
    expect(narrowed.stdout).not.toContain('chrome-devtools-mcp');
  });

  it('puts a name that holds the word before a description that holds it', () => {
    const out = withFixtures('design').stdout;
    expect(out).toContain('frontend-design');
    expect(out).toContain('figma');
    expect(out.indexOf('frontend-design')).toBeLessThan(out.indexOf('figma'));
  });

  it('puts an exact name before a longer name that holds it, whatever the order of the catalog', () => {
    const names = (JSON.parse(withFixtures('playwright', '--json').stdout) as Hit[]).map(hit => hit.name);
    expect(names).toEqual(['playwright', 'playwright-extras']);
  });

  it('keeps no more hits than --limit says', () => {
    const hits = JSON.parse(find(['browser', '--json', '--limit', '1', '--official', OFFICIAL, '--directory', DIRECTORY]).stdout) as Hit[];
    expect(hits).toHaveLength(1);
  });

  it('exits 1 and says so when nothing matches, as it does for stitch, which has no plugin', () => {
    const result = withFixtures('stitch');
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('no plugin matches "stitch"');
    const two = withFixtures('browser', 'zzzz');
    expect(two.status).toBe(1);
    expect(`${two.stdout}${two.stderr}`).toContain('no plugin matches "browser zzzz"');
  });
});

describe('find-plugin: --json', () => {
  it('prints one parseable array with the fields a script can use', () => {
    const result = withFixtures('context7', '--json');
    expect(result.status).toBe(0);
    const hits = JSON.parse(result.stdout) as Hit[];
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({
      name: 'context7',
      catalogs: ['official', 'directory'],
      surfaces: ['claude_code', 'cowork', 'claude_ai'],
      source: './external_plugins/context7',
      install: 'claude plugin install context7@claude-plugins-official --scope project',
      description: 'Upstash Context7 MCP server for up-to-date documentation lookup.',
    });
  });

  it('gives null for the install of a plugin that only the directory lists, and an empty array with exit 1 for no match', () => {
    const only = JSON.parse(withFixtures('acme', '--json').stdout) as Hit[];
    expect(only[0]?.install).toBeNull();
    expect(only[0]?.catalogs).toEqual(['directory']);
    const none = withFixtures('stitch', '--json');
    expect(none.status).toBe(1);
    expect(JSON.parse(none.stdout)).toEqual([]);
  });
});

describe('find-plugin: the catalogs on disk', () => {
  it('still answers from the marketplace when the directory cache is missing, and says how to refresh', () => {
    const missing = path.join(tmp(), 'plugin-directory-cache-v2.json');
    const result = find(['context7', '--official', OFFICIAL, '--directory', missing]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('surfaces: unknown (not in the directory cache)');
    expect(result.stderr).toContain(missing);
    expect(result.stderr).toContain('claude plugin marketplace update');
  });

  it('exits 2 and names both files when neither catalog can be read', () => {
    const dir = tmp();
    const official = path.join(dir, 'marketplace.json');
    const directory = path.join(dir, 'cache.json');
    const result = find(['context7', '--official', official, '--directory', directory]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(official);
    expect(result.stderr).toContain(directory);
  });

  it('exits 2 with the usage when no word is given', () => {
    const result = find(['--official', OFFICIAL, '--directory', DIRECTORY]);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/usage: node find-plugin\.mjs <word>/i);
  });

  it('reads the default catalog paths under CLAUDE_CONFIG_DIR when no file is named', () => {
    const config = tmp();
    const marketplace = path.join(config, 'plugins', 'marketplaces', 'claude-plugins-official', '.claude-plugin');
    fs.mkdirSync(marketplace, { recursive: true });
    fs.copyFileSync(OFFICIAL, path.join(marketplace, 'marketplace.json'));
    fs.copyFileSync(DIRECTORY, path.join(config, 'plugins', 'plugin-directory-cache-v2.json'));
    const result = find(['context7'], { env: { CLAUDE_CONFIG_DIR: config } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('install: claude plugin install context7@claude-plugins-official --scope project');
  });
});
