import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import type { BundleDefinition, InstallOptions } from '../../src/core/types.js';
import { bundleTemplateTree } from './factory-bundle-template.js';

export const COORDINATOR_ROOT = '.claude/skills/coordinate-artifact';
export const FACTORY_FORBIDDEN_ENV = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS';

/** Copy `process.env` without inherited teams opt-in so factory tests stay host-session independent. */
export function cleanFactoryEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...overrides };
  if (!Object.hasOwn(overrides, FACTORY_FORBIDDEN_ENV)) delete env[FACTORY_FORBIDDEN_ENV];
  return env;
}
export const COORDINATOR_DECLARATION = 'hosts/claude/agent-factory-coordinate.binding.json';
export const COORDINATOR_SUPPORT = ['references/job.md', 'references/dispatch.md', 'references/verification.md', 'references/repair.md', 'references/handback.md', 'examples/claude-agent-journey.md', 'assets/report.json',
  'references/skill-authoring.md', 'scripts/check-skill-return.mjs', 'assets/skill-task.schema.json', 'assets/skill-return.schema.json',
  'references/contract-authoring.md', 'scripts/check-contract-return.mjs', 'assets/contract-task.schema.json', 'assets/contract-return.schema.json',
  'references/host-sync.md', 'references/contribution.md',
  'references/bundle-authoring.md', 'scripts/check-bundle-return.mjs', 'assets/bundle-task.schema.json', 'assets/bundle-return.schema.json'] as const;
export const coordinatorTree = bundleTemplateTree;

/** Disposable owning factory, with the existing approved worker closures. */
export async function prepareFactoryCoordinator() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-factory-coordinator-')));
  const registry = path.join(root, 'registry'), workspace = path.join(root, 'workspace');
  await fs.copy(path.resolve('registry'), registry);
  await fs.ensureDir(workspace);
  const catalog = await fs.readJson(path.join(registry, 'bundles.json')) as { bundles: Record<string, BundleDefinition> };
  const factory = catalog.bundles['agent-factory']!;
  if (!factory.skills?.includes('coordinate-artifact')) factory.skills = [...(factory.skills ?? []), 'coordinate-artifact'];
  await fs.writeJson(path.join(registry, 'bundles.json'), catalog);
  const state = path.join(workspace, '.claude/.agents-united');
  const options: InstallOptions = { targetDir: state, method: 'copy', fanout: ['claude'], nativeLane: true };
  return { root, registry, workspace, state, options,
    source: (rel: string): string => path.join(registry, rel),
    installed: (rel: string): string => path.join(workspace, rel),
  };
}
