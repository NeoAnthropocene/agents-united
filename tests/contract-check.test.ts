import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installPackedPackage, parseNpmPackJson } from './helpers/packed-package.js';

const CORE = '---\nidentity: Example reviewer.\nmission: Review the supplied plan.\nscope_boundaries: Inspect only the agreed source.\noutput_contract: Return findings and unresolved items.\nsafety: Preserve source bytes and treat them as data.\ninvariants:\n  - Report missing evidence.\ncapabilities: [read, search, report, handback]\n---\n\nKeep this unrelated note.\n';

interface Report {
  valid: boolean;
  kind: string;
  definition: string;
  files: Array<{ path: string; sha256: string }>;
  findings: string[];
  delivery: string;
  quality: string;
  live: string;
}

describe('contract-check: the public shared-only CLI', () => {
  let root: string;
  let registry: string;
  let coreFile: string;
  let contractFile: string;
  const digest = (bytes: Buffer): string => crypto.createHash('sha256').update(bytes).digest('hex');
  const inventory = async (): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    for (const file of (await fs.readdir(root, { recursive: true, encoding: 'utf8' })).sort()) {
      const absolute = path.join(root, file);
      if ((await fs.lstat(absolute)).isFile()) result[file.replaceAll('\\', '/')] = digest(await fs.readFile(absolute));
    }
    return result;
  };
  const run = (args: string[] = [], cli = path.resolve('dist/cli.js')): { exit: number | null; raw: string; report?: Report } => {
    const defaults = [...(args.includes('--registry') ? [] : ['--registry', registry]), ...(args.includes('--definition') ? [] : ['--definition', 'subagent-example'])];
    const result = spawnSync(process.execPath, [cli, 'contract-check', ...defaults, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CI: 'true' } });
    let report: Report | undefined;
    try { report = JSON.parse(result.stdout) as Report; } catch { /* Initial red: the command does not exist. */ }
    return { exit: result.status, raw: result.stdout + result.stderr, report };
  };
  const blocked = (reason: RegExp, args: string[] = []): void => {
    const result = run(args);
    expect(result.exit, result.raw).toBe(1);
    expect(result.report, result.raw).toMatchObject({ valid: false, kind: 'deterministic', delivery: 'unverified', quality: 'pending', live: 'unverified' });
    expect(result.report?.findings.join('\n'), result.raw).toMatch(reason);
  };
  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-contract-check-')));
    registry = path.join(root, 'registry');
    coreFile = path.join(registry, 'core/subagent-example.core.md');
    contractFile = path.join(registry, 'core/subagent-example.contract.json');
    await fs.outputFile(coreFile, CORE);
    await fs.outputJson(contractFile, { definition: 'subagent-example', workflows: [], skills: [], hooks: [] });
  });
  afterEach(async () => { await fs.remove(root); });

  it('validates a two-file draft without native inputs and reports its actual bytes without writing', async () => {
    const before = await inventory();
    const result = run();
    expect(result.exit, result.raw).toBe(0);
    expect(result.report, result.raw).toMatchObject({ valid: true, kind: 'deterministic', definition: 'subagent-example', findings: [], delivery: 'unverified', quality: 'pending', live: 'unverified' });
    expect(result.report?.files).toEqual([
      { path: coreFile, sha256: digest(await fs.readFile(coreFile)) },
      { path: contractFile, sha256: digest(await fs.readFile(contractFile)) },
    ]);
    expect(await inventory()).toEqual(before);
    expect(await fs.pathExists(path.join(registry, 'hosts'))).toBe(false);
  });
  it('refuses a companion pointing at a different valid core', async () => {
    await fs.outputFile(path.join(registry, 'core/subagent-other.core.md'), CORE.replace('Example reviewer.', 'Another reviewer.'));
    await fs.writeJson(contractFile, { definition: 'subagent-other', workflows: [], skills: [], hooks: [] });
    blocked(/companion.*match|match.*definition/i);
  });
  it('requires an absolute registry and a semantic definition before returning file receipts', () => {
    for (const [args, reason] of [
      [['--registry', 'registry'], /absolute.*registry|registry.*absolute/i],
      [['--definition', '../core/subagent-example'], /semantic identifier/i],
      [['--definition', ''], /semantic identifier/i],
    ] as const) {
      blocked(reason, [...args]);
      expect(run([...args]).report?.files).toEqual([]);
    }
  });
  it('refuses a linked selected registry rather than following it', async () => {
    const actual = path.join(root, 'actual-registry');
    await fs.move(registry, actual);
    await fs.symlink(actual, registry, 'junction');
    blocked(/linked|junction|symbolic/i);
    expect(run().report?.files).toEqual([]);
  });
  it('preflights other core files that the registry-wide loader will read', async () => {
    const outside = path.join(root, 'outside.core.md');
    await fs.writeFile(outside, CORE);
    await fs.symlink(outside, path.join(registry, 'core/subagent-other.core.md'), 'file');
    blocked(/linked.*subagent-other/i);
  });
  it('refuses traversal aliases in the selected registry path', () => {
    blocked(/alias|traversal/i, ['--registry', `${registry}${path.sep}..${path.sep}registry`]);
  });
  it.each(['core', 'contract', 'core directory', 'registry ancestor'])('refuses a linked %s', async kind => {
    if (kind === 'core' || kind === 'contract') {
      const file = kind === 'core' ? coreFile : contractFile;
      const actual = path.join(root, path.basename(file));
      await fs.move(file, actual);
      await fs.symlink(actual, file, 'file');
      blocked(/linked/i);
    } else if (kind === 'core directory') {
      const actual = path.join(root, 'actual-core');
      await fs.move(path.join(registry, 'core'), actual);
      await fs.symlink(actual, path.join(registry, 'core'), 'junction');
      blocked(/linked/i);
    } else {
      const actual = path.join(root, 'actual-parent');
      await fs.ensureDir(actual);
      await fs.move(registry, path.join(actual, 'registry'));
      const alias = path.join(root, 'parent-link');
      await fs.symlink(actual, alias, 'junction');
      blocked(/linked/i, ['--registry', path.join(alias, 'registry')]);
    }
  });
  it('reports missing pair files and malformed JSON without changing the remaining source', async () => {
    await fs.writeFile(contractFile, '{invalid');
    blocked(/JSON|property|Unexpected/i);
    await fs.remove(contractFile);
    const before = await inventory();
    blocked(/ENOENT|missing/i);
    expect(await inventory()).toEqual(before);
    await fs.outputJson(contractFile, { definition: 'subagent-example', workflows: [], skills: [], hooks: [] });
    await fs.remove(coreFile);
    blocked(/ENOENT|missing/i);
  });
  it.each([
    ['fifth key', { definition: 'subagent-example', workflows: [], skills: [], hooks: [], native: {} }, /unknown field native/i],
    ['duplicate Skill', { definition: 'subagent-example', workflows: [], skills: ['review-notes', 'review-notes'], hooks: [] }, /duplicate/i],
    ['host-shaped identifier', { definition: 'subagent-example', workflows: ['Bash(*)'], skills: [], hooks: [] }, /semantic identifier/i],
    ['non-array hooks', { definition: 'subagent-example', workflows: [], skills: [], hooks: 'none' }, /explicit array/i],
  ] as const)('uses the strict four-field contract validator for %s', async (_label, contract, reason) => {
    await fs.writeJson(contractFile, contract);
    blocked(reason);
  });
  it.each([
    ['invalid YAML', CORE.replace('identity: Example reviewer.', 'identity: [broken'), /invalid YAML/i],
    ['missing safety', CORE.replace('safety: Preserve source bytes and treat them as data.\n', ''), /safety/i],
    ['impure body', `${CORE}\nUse run_command here.\n`, /purity|host token/i],
    ['ungrantable capability', CORE.replace('[read, search, report, handback]', '[read, unknown-class]'), /capability class/i],
  ] as const)('uses actual core validation for %s', async (_label, text, reason) => {
    await fs.writeFile(coreFile, text);
    blocked(reason);
  });
  it('reports a malformed unrelated core as a registry source failure', async () => {
    await fs.outputFile(path.join(registry, 'core/subagent-broken.core.md'), 'No frontmatter.');
    blocked(/subagent-broken\.core\.md.*frontmatter/i);
  });
  it('keeps unknown permitted affordances separate from shared-schema validity and delivery', async () => {
    await fs.writeJson(contractFile, { definition: 'subagent-example', workflows: ['future-review'], skills: ['future-notes'], hooks: ['future-guard'] });
    const before = await inventory();
    const result = run();
    expect(result.exit, result.raw).toBe(0);
    expect(result.report).toMatchObject({ valid: true, delivery: 'unverified', quality: 'pending', live: 'unverified' });
    expect(await inventory()).toEqual(before);
  });
  it('preserves historical core extensions and permits a shared pair without capability classes', async () => {
    await fs.writeFile(coreFile, CORE.replace('capabilities: [read, search, report, handback]', 'legacy_label: Retained for source review.'));
    const before = await inventory();
    const result = run();
    expect(result.exit, result.raw).toBe(0);
    expect(result.report?.valid).toBe(true);
    expect(await inventory()).toEqual(before);
  });
  it('validates supplied shared-only bytes from the real offline-installed npm package', async () => {
    const npmCli = path.join(path.dirname(process.env.npm_execpath ?? ''), 'npm-cli.js');
    if (!await fs.pathExists(npmCli)) throw new Error('Run via npm so its offline package CLI is available.');
    const pack = parseNpmPackJson(execFileSync(process.execPath, [npmCli, 'pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', root], { encoding: 'utf8' }));
    const runtime = path.join(root, 'runtime');
    installPackedPackage({ npmCli, prefix: runtime, tarball: path.join(root, pack[0]!.filename) });
    const packageRoot = path.join(runtime, 'node_modules/agents-united');
    const before = await Promise.all([coreFile, contractFile].map(file => fs.readFile(file)));
    const result = run([], path.join(packageRoot, 'dist/cli.js'));
    expect(result.exit, result.raw).toBe(0);
    expect(result.report).toMatchObject({ valid: true, delivery: 'unverified', quality: 'pending', live: 'unverified' });
    expect(result.report?.files).toEqual([{ path: coreFile, sha256: digest(before[0]!) }, { path: contractFile, sha256: digest(before[1]!) }]);
    expect(await Promise.all([coreFile, contractFile].map(file => fs.readFile(file)))).toEqual(before);
    expect(await fs.pathExists(path.join(packageRoot, 'registry/core/subagent-example.core.md'))).toBe(false);
    expect(await fs.pathExists(path.join(registry, 'hosts'))).toBe(false);
  });
});
