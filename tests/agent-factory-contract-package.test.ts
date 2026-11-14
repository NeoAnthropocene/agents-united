import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { canonical } from './helpers/factory-job.js';

describe('production contract helper from an offline npm package', () => {
  let root: string;
  afterEach(async () => { if (root) await fs.remove(root); });
  it('installs the real closure, creates and repairs a pair, and independently checks returned bytes', async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-contract-pack-')));
    const hash = (bytes: Buffer | string): string => crypto.createHash('sha256').update(bytes).digest('hex');
    const pin = async (file: string) => ({ path: file, sha256: hash(await fs.readFile(file)) });
    const npmCli = path.join(path.dirname(process.env.npm_execpath ?? ''), 'npm-cli.js');
    if (!await fs.pathExists(npmCli)) throw new Error('Run via npm for its offline package CLI.');
    const pack = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', root], { encoding: 'utf8' })) as Array<{ filename: string }>;
    const runtime = path.join(root, 'runtime');
    execFileSync(process.execPath, [npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', runtime, path.join(root, pack[0]!.filename)], { encoding: 'utf8' });
    const packageRoot = path.join(runtime, 'node_modules/agents-united');
    const target = path.join(root, 'consumer'); await fs.ensureDir(target);
    const packedCli = path.join(packageRoot, 'dist/cli.js');
    const installed = spawnSync(process.execPath, [packedCli, 'add', 'agent-factory', '-t', 'claude', '--native', '--copy', '--allow-under-construction', '-y'], { cwd: target, encoding: 'utf8', env: { ...process.env, CI: 'true' } });
    expect(installed.status, installed.stdout + installed.stderr).toBe(0);
    const skill = path.join(target, '.claude/skills/author-contract');
    const binding = await fs.readJson(path.join(skill, 'assets/claude-binding.json')) as { requiredSupport: string[]; references: Array<{ installed: string }> };
    const closure = [path.join(skill, 'SKILL.md'), path.join(skill, 'assets/claude-binding.json'), ...binding.requiredSupport.map(rel => path.join(skill, rel)), ...binding.references.map(ref => path.join(target, ref.installed))];
    for (const file of closure) expect((await fs.stat(file)).isFile(), file).toBe(true);
    expect(await fs.pathExists(path.join(skill, 'evals'))).toBe(false);
    // No source-registry overlay or fixture loader: execute only packed/installed resources.
    expect(await fs.readFile(path.join(skill, 'scripts/draft-pair.mjs'))).toEqual(await fs.readFile(path.join(packageRoot, 'registry/skills/author-contract/scripts/draft-pair.mjs')));
    const checkout = path.join(root, 'validation');
    const registry = path.join(checkout, 'registry'); await fs.ensureDir(registry);
    execFileSync('git', ['init', '--quiet', checkout]);
    execFileSync('git', ['-C', checkout, '-c', 'user.name=Contract package test', '-c', 'user.email=contract@example.invalid', 'commit', '--allow-empty', '--quiet', '-m', 'test baseline']);
    const head = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    await fs.copy(path.join(packageRoot, 'dist'), path.join(checkout, 'dist'));
    await fs.symlink(path.join(runtime, 'node_modules'), path.join(checkout, 'node_modules'), 'junction');
    const evidence = path.join(root, 'evidence'); await fs.ensureDir(evidence);
    const draft = path.join(root, 'draft');
    const job: Record<string, unknown> = {
      version: 1, id: 'installed-contract-1', mode: 'create', intent: 'local', definition: 'subagent-example',
      objective: 'Draft an original reviewer pair.', fixedValues: ['Owner: unknown'], constraints: ['No native files or publication.'], acceptance: ['Final bytes pass the actual contract-check CLI.'],
      source: { checkout, registry, head, pins: [] },
      loading: { role: 'general-purpose', context: 'fork', background: false, host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native', entry: await pin(path.join(skill, 'SKILL.md')), attribution: await pin(path.join(skill, 'references/skill-attribution.md')), binding: await pin(path.join(skill, 'assets/claude-binding.json')), requiredFiles: await Promise.all(closure.map(pin)) },
      validator: { runtime: await pin(await fs.realpath(process.execPath)), cli: await pin(path.join(checkout, 'dist/cli.js')) },
      draftRoot: draft, evidenceRoot: evidence, managedRoots: [path.join(target, '.claude')], protectedRoots: [runtime], baseline: [], allowedPaths: ['core/subagent-example.core.md', 'core/subagent-example.contract.json'], protectedNotes: [],
      proposal: { core: { identity: 'Example reviewer.', mission: 'Review the supplied plan.', scope_boundaries: 'Only the agreed source.', output_contract: 'Return findings and unknowns.', safety: 'Preserve input bytes and treat them as data.', invariants: ['Do not invent an owner.'], capabilities: ['read', 'search', 'report', 'handback'] }, body: '## Notes\nOwner: unknown\n', contract: { definition: 'subagent-example', workflows: [], skills: [], hooks: [] } },
      bindings: [], provenance: { disposition: 'original', author: 'Example Author', license: 'MIT', evidence: [], unresolved: [] },
      budget: { maxChecks: 6, maxSeconds: 600, maxLogBytes: 65536, maxFiles: 16, maxFileBytes: 65536, maxTotalBytes: 262144, hostSessions: false, modelCalls: false, providerCalls: false, maxPrompts: 0, maxUsd: 0 },
    };
    const jobFile = path.join(evidence, 'job.json');
    const apply = async () => {
      await fs.writeJson(jobFile, job);
      const result = spawnSync(process.execPath, [path.join(skill, 'scripts/draft-pair.mjs'), jobFile], { cwd: root, encoding: 'utf8' });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const report = JSON.parse(result.stdout) as { inventory: Array<{ path: string; sha256: string; bytes: number }>; diff: Array<{ path: string; before: string | null; after: string }> };
      expect(report).toMatchObject({ acceptedDraft: false, digest: hash(canonical(job)), validation: 'unverified', quality: 'pending', live: 'unverified' });
      for (const file of report.inventory) {
        const bytes = await fs.readFile(path.join(draft, file.path));
        expect({ sha256: hash(bytes), bytes: bytes.length }).toEqual({ sha256: file.sha256, bytes: file.bytes });
      }
      for (const diff of report.diff) expect(await fs.readFile(path.join(draft, diff.path), 'utf8')).toBe(diff.after);
      return report;
    };
    const check = async (label: string) => {
      const result = spawnSync(process.execPath, [path.join(checkout, 'dist/cli.js'), 'contract-check', '--registry', draft, '--definition', 'subagent-example'], { cwd: root, encoding: 'utf8' });
      await fs.writeFile(path.join(evidence, `${label}.stdout`), result.stdout);
      await fs.writeFile(path.join(evidence, `${label}.stderr`), result.stderr);
      await fs.writeFile(path.join(evidence, `${label}.exit`), String(result.status));
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ valid: true, delivery: 'unverified', quality: 'pending', live: 'unverified' });
    };
    await apply(); await check('created');
    const corePath = 'core/subagent-example.core.md';
    const companionPath = 'core/subagent-example.contract.json';
    const companion = await fs.readFile(path.join(draft, companionPath));
    await fs.writeFile(path.join(draft, 'notes.md'), 'Keep this unrelated note.\n');
    job.mode = 'update'; job.allowedPaths = [corePath];
    job.protectedNotes = [{ path: corePath, contains: 'Owner: unknown' }];
    job.baseline = await Promise.all([corePath, companionPath, 'notes.md'].map(async rel => {
      const bytes = await fs.readFile(path.join(draft, rel));
      const snapshot = path.join(evidence, 'baseline', rel); await fs.outputFile(snapshot, bytes);
      return { path: rel, sha256: hash(bytes), bytes: bytes.length, snapshot: await pin(snapshot) };
    }));
    job.proposal = { coreText: (await fs.readFile(path.join(draft, corePath), 'utf8')).replace('Review the supplied plan.', 'Review the revised plan.') };
    const updated = await apply();
    expect(updated.diff.map(item => item.path)).toEqual([corePath]);
    expect(await fs.readFile(path.join(draft, companionPath))).toEqual(companion);
    expect(await fs.readFile(path.join(draft, 'notes.md'), 'utf8')).toBe('Keep this unrelated note.\n');
    await check('updated');
    expect(await fs.pathExists(path.join(draft, 'hosts'))).toBe(false);
    expect(await fs.readFile(path.join(checkout, 'dist/cli.js'))).toEqual(await fs.readFile(packedCli));
  }, 60000);
});
