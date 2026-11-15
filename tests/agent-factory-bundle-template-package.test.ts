import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import YAML from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { RegistryResolver } from '../src/core/registry.js';
import type { BundleDefinition, ClaudeContractTaskBinding, LockfileManifest } from '../src/core/types.js';
import { BUNDLE_RULES, BUNDLE_SUPPORT, BUNDLE_TASK_ROOT } from './helpers/factory-bundle-template.js';
import { REQUIRED_HEADINGS } from './helpers/skill-contract.js';
import { installPackedPackage } from './helpers/packed-package.js';

describe('production bundle templates from an offline npm package', () => {
  let root: string;
  afterEach(async () => { if (root) await fs.remove(root); });

  it('delivers actual packed bytes in an unrelated consumer and resolves concrete proposal examples with explicit source limits', async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-bundle-pack-')));
    const npmCli = process.env.npm_execpath;
    if (!npmCli || !await fs.pathExists(npmCli)) throw new Error('Run via npm for its offline package CLI.');
    const pack = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', root], { encoding: 'utf8' })) as Array<{ filename: string }>;
    const runtime = path.join(root, 'runtime');
    installPackedPackage({ npmCli, prefix: runtime, tarball: path.join(root, pack[0]!.filename) });
    const packageRoot = path.join(runtime, 'node_modules/agents-united'), consumer = path.join(root, 'consumer');
    await fs.ensureDir(consumer);
    const installed = spawnSync(process.execPath, [path.join(packageRoot, 'dist/cli.js'), 'add', 'agent-factory', '-t', 'claude', '--native', '--copy', '--allow-under-construction', '-y'], { cwd: consumer, encoding: 'utf8', env: { ...process.env, CI: 'true' } });
    expect(installed.status, installed.stdout + installed.stderr).toBe(0);
    const skill = path.join(consumer, BUNDLE_TASK_ROOT);
    const binding = await fs.readJson(path.join(packageRoot, 'registry/hosts/claude/agent-factory-bundle.binding.json')) as ClaudeContractTaskBinding;
    const receipt = await fs.readJson(path.join(skill, 'assets/claude-binding.json'));
    expect(receipt.requiredSupport).toEqual([...BUNDLE_SUPPORT]);
    expect(binding.references.map(ref => ref.source).sort()).toEqual(BUNDLE_RULES.map(rule => `rules/${rule}`).sort());
    expect(receipt.sourceHash).toBe(`sha256:${crypto.createHash('sha256').update(await fs.readFile(path.join(packageRoot, 'registry/hosts/claude/agent-factory-bundle.binding.json'))).digest('hex')}`);
    const lock = await fs.readJson(path.join(consumer, '.claude/.agents-united/agents-united.json')) as LockfileManifest;
    for (const rel of ['SKILL.md', ...BUNDLE_SUPPORT, 'assets/claude-binding.json', ...binding.references.map(ref => ref.installed.slice(BUNDLE_TASK_ROOT.length + 1))]) {
      const bytes = await fs.readFile(path.join(skill, rel));
      const projected = `${BUNDLE_TASK_ROOT}/${rel}`;
      expect(lock.projections?.[projected]?.owners, rel).toEqual(['agent-factory']);
      expect(lock.projections?.[projected]?.hash, rel).toBe(`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`);
    }
    // Package installation uses its actual registry, without source overlays or fixture loaders.
    for (const rel of BUNDLE_SUPPORT) expect(await fs.readFile(path.join(skill, rel))).toEqual(await fs.readFile(path.join(packageRoot, 'registry/skills/author-bundle', rel)));
    expect(await fs.pathExists(path.join(skill, 'evals'))).toBe(false);
    expect(await fs.pathExists(path.join(skill, 'scripts'))).toBe(false);
    const native = (await fs.readFile(path.join(skill, 'SKILL.md'), 'utf8')).replace(/\r\n/g, '\n');
    expect(native.length).toBeLessThanOrEqual(6000);
    expect(native.split('\n').length).toBeLessThanOrEqual(90);
    for (const heading of REQUIRED_HEADINGS) expect(native).toContain(heading);
    const meta = YAML.parse(/^---\n([\s\S]*?)\n---/.exec(native)![1]!) as Record<string, unknown>;
    expect(Object.keys(meta).sort()).toEqual(['agent', 'background', 'context', 'description', 'metadata', 'name']);
    expect(meta).toMatchObject({ name: 'author-bundle', context: 'fork', agent: 'general-purpose', background: false });
    for (const rel of ['assets/domain-bundle.template.json', 'assets/organization-bundle.template.json', 'assets/report.json']) expect(JSON.parse(await fs.readFile(path.join(skill, rel), 'utf8'))).toBeTypeOf('object');

    // Resolver output is proposal data. Check real assets independently before any delivery claim.
    const proposalRegistry = path.join(root, 'proposal-registry');
    await fs.copy(path.join(packageRoot, 'registry'), proposalRegistry);
    for (const example of ['domain', 'organization']) {
      const markdown = await fs.readFile(path.join(skill, 'examples', `${example}.md`), 'utf8');
      const proposal = JSON.parse(/```json\s*([\s\S]*?)```/.exec(markdown)![1]!) as { version: number; bundles: Record<string, BundleDefinition> };
      const [name, bundle] = Object.entries(proposal.bundles)[0]!;
      await fs.writeJson(path.join(proposalRegistry, 'bundles.json'), proposal);
      const resolver = new RegistryResolver(proposalRegistry);
      expect((await resolver.loadBundles()).bundles[name]).toEqual(bundle);
      const resolved = await resolver.resolve(name);
      expect(resolved.targetBundle).toBe(name);
      for (const companion of ['host-agent-router', 'handoff', 'git-guardrails']) expect(bundle.skills?.filter(value => value === companion)).toHaveLength(1);
      for (const agent of resolved.agents) expect(await fs.pathExists(path.join(proposalRegistry, 'agents', agent))).toBe(true);
      for (const declaredSkill of resolved.skills) expect(await fs.pathExists(path.join(proposalRegistry, 'skills', declaredSkill, 'SKILL.md'))).toBe(true);
      const missing = resolved.agents[0]!;
      await fs.remove(path.join(proposalRegistry, 'agents', missing));
      expect((await new RegistryResolver(proposalRegistry).resolve(name)).agents).toContain(missing);
      expect(await fs.pathExists(path.join(proposalRegistry, 'agents', missing))).toBe(false);
      // Restore for the next independent example; absence was never treated as native delivery.
      await fs.copy(path.join(packageRoot, 'registry/agents', missing), path.join(proposalRegistry, 'agents', missing));
    }
  });
});
