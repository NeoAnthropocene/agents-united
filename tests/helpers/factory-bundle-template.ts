import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import type { BundleDefinition, InstallOptions } from '../../src/core/types.js';

export const BUNDLE_TASK_ROOT = '.claude/skills/author-bundle';
export const BUNDLE_SUPPORT = [
  'references/job.md', 'references/verification.md', 'references/bundle-shape.md', 'references/prerequisites.md',
  'assets/domain-bundle.template.json', 'assets/organization-bundle.template.json',
  'assets/leader-responsibility.template.md', 'assets/report.json', 'examples/domain.md', 'examples/organization.md',
  'scripts/bundle-return.mjs',
] as const;
export const BUNDLE_RULES = ['skill-attribution.md', 'git-guardrails.md', 'test-driven-development.md',
  'clean-code-and-architecture.md', 'domain-modeling-and-adr.md', 'multi-agent-coordination.md', 'quality-aesthetics-accessibility.md'] as const;

/** Own task closure and approved slice-3 entry; no other factory task can mask a missing edge. */
export async function prepareBundleTemplate() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-bundle-template-')));
  const registry = path.join(root, 'registry'), workspace = path.join(root, 'workspace');
  await fs.copy(path.resolve('registry'), registry);
  await fs.ensureDir(workspace);
  const catalog = await fs.readJson(path.join(registry, 'bundles.json')) as { bundles: Record<string, BundleDefinition> };
  const factory = catalog.bundles['agent-factory']!;
  factory.skills = ['author-skill', 'author-rule', 'author-bundle', 'host-agent-router', 'handoff', 'git-guardrails'];
  await fs.writeJson(path.join(registry, 'bundles.json'), catalog);
  for (const name of ['realize', 'evaluate', 'sync', 'contract']) await fs.remove(path.join(registry, `hosts/claude/agent-factory-${name}.binding.json`));
  const state = path.join(workspace, '.claude/.agents-united');
  const options: InstallOptions = { targetDir: state, method: 'copy', fanout: ['claude'], nativeLane: true };
  return { root, registry, workspace, state, options,
    source: (rel: string): string => path.join(registry, rel),
    installed: (rel: string): string => path.join(workspace, rel),
  };
}

/** Complete filesystem state, including empty directories and links, for prewrite refusal assertions. */
export async function bundleTemplateTree(root: string): Promise<Record<string, string>> {
  const tree: Record<string, string> = {};
  const walk = async (dir: string, prefix = ''): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const rel = `${prefix}${entry.name}`, file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) tree[rel] = `link:${await fs.readlink(file)}`;
      else if (entry.isDirectory()) { tree[`${rel}/`] = 'directory'; await walk(file, `${rel}/`); }
      else tree[rel] = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
    }
  };
  await walk(root);
  return tree;
}
