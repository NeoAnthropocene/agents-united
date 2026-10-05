import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { ClineProjector } from '../src/core/cline-projector.js';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import type { BundleDefinition, ResolvedAssets } from '../src/core/types.js';

/**
 * Plan 035: a skill folder may hold `evals/` (the prompts a skill is tried with). It is for the maintainers, so no install lane
 * copies it: not the Claude projector, not the Cline plugin copy, not the canonical store. A link cannot hide a subfolder, so the
 * symlink method still shows the registry folder as it is; what it must not do is record `evals/` as an installed file.
 *
 * The registry here is a small one built for the test: the real catalog has no `evals/` until the skill-layout pull requests merge.
 */

const SCRATCH = path.resolve(process.cwd(), 'scratch/test-skill-evals-not-installed');
const REGISTRY = path.join(SCRATCH, 'registry');
const SKILL = 'evals-fixture';
const SKILL_DIR = path.join(REGISTRY, 'skills', SKILL);

/** What a user gets of the fixture skill: every file but the ones under the top-level `evals/`. `references/evals/` is an ordinary folder. */
const INSTALLED = [
  'SKILL.md',
  'examples/worked-example.md',
  'references/evals/how-to.md',
  'references/notes.md',
  'scripts/helper.mjs',
];
const MAINTAINER_ONLY = ['evals/evals.json', 'evals/files/sample.csv'];

const bundle: BundleDefinition = { name: 'fixture-bundle', description: 'A bundle for the evals tests', orchestrator: 'none.md', agents: [], skills: [SKILL] };
const resolved: ResolvedAssets = { targetBundle: 'fixture-bundle', agents: [], skills: [SKILL], workflows: [], rules: [] };

async function buildRegistry(): Promise<void> {
  await fs.outputFile(path.join(REGISTRY, 'bundles.json'), JSON.stringify({ bundles: { 'fixture-bundle': bundle } }, null, 2));
  // The `.agents/` store is an Antigravity library, so an install reads the package's MCP catalog even when the native lane is off.
  await fs.outputFile(path.join(REGISTRY, 'hosts', 'antigravity', 'mcp', 'servers.json'), JSON.stringify({ servers: {} }, null, 2));
  await fs.outputFile(path.join(SKILL_DIR, 'SKILL.md'), `---\nname: ${SKILL}\ndescription: Use when testing the install lanes. Skip it everywhere else.\n---\n\n# Fixture\n`);
  await fs.outputFile(path.join(SKILL_DIR, 'references', 'notes.md'), '# Notes\n');
  await fs.outputFile(path.join(SKILL_DIR, 'references', 'evals', 'how-to.md'), '# A references folder that happens to be called evals\n');
  await fs.outputFile(path.join(SKILL_DIR, 'examples', 'worked-example.md'), '# Example\n');
  await fs.outputFile(path.join(SKILL_DIR, 'scripts', 'helper.mjs'), 'export const ok = true;\n');
  await fs.outputFile(path.join(SKILL_DIR, 'evals', 'evals.json'), '{ "skill_name": "evals-fixture", "evals": [] }\n');
  await fs.outputFile(path.join(SKILL_DIR, 'evals', 'files', 'sample.csv'), 'a,b\n1,2\n');
}

/** Every file below `dir`, as sorted POSIX paths relative to it. */
async function filesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (current: string): Promise<void> => {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else out.push(path.relative(dir, abs).split(path.sep).join('/'));
    }
  };
  await walk(dir);
  return out.sort();
}

beforeEach(async () => {
  await fs.remove(SCRATCH);
  await buildRegistry();
});
afterEach(async () => {
  await fs.remove(SCRATCH);
});

describe('evals/ is not installed: the projectors', () => {
  it('the Claude projector plans every file of the skill but the ones under evals/', async () => {
    const artifacts = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, REGISTRY);
    const prefix = `.claude/skills/${SKILL}/`;
    const planned = artifacts.filter(a => a.relPath.startsWith(prefix)).map(a => a.relPath.slice(prefix.length)).sort();
    expect(planned).toEqual(INSTALLED);
    for (const rel of MAINTAINER_ONLY) expect(artifacts.map(a => a.canonical), rel).not.toContain(`skills/${SKILL}/${rel}`);
  });

  it('the Cline projector plans every file of the skill but the ones under evals/', async () => {
    const artifacts = await ClineProjector.planCompoundProjection(bundle, 'project', resolved, REGISTRY);
    const prefix = `.agents/plugins/${bundle.name}/skills/${SKILL}/`;
    const planned = artifacts.filter(a => a.relPath.startsWith(prefix)).map(a => a.relPath.slice(prefix.length)).sort();
    expect(planned).toEqual(INSTALLED);
    for (const rel of MAINTAINER_ONLY) expect(artifacts.map(a => a.canonical), rel).not.toContain(`skills/${SKILL}/${rel}`);
  });

  it('a skill without evals/ is planned unchanged, by both projectors', async () => {
    await fs.remove(path.join(SKILL_DIR, 'evals'));
    const claude = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, REGISTRY);
    const cline = await ClineProjector.planCompoundProjection(bundle, 'project', resolved, REGISTRY);
    expect(claude.filter(a => a.relPath.startsWith(`.claude/skills/${SKILL}/`))).toHaveLength(INSTALLED.length);
    expect(cline.filter(a => a.relPath.startsWith(`.agents/plugins/${bundle.name}/skills/${SKILL}/`))).toHaveLength(INSTALLED.length);
  });
});

describe('evals/ is not installed: the canonical store', () => {
  const agentsDir = path.join(SCRATCH, 'workspace', '.agents');
  const lockPath = path.join(agentsDir, 'agents-united.json');
  const installedSkill = path.join(agentsDir, 'skills', SKILL);
  const engine = (): InstallEngine => new InstallEngine(new RegistryResolver(REGISTRY));
  const recorded = async (): Promise<string[]> => {
    const lock = await fs.readJson(lockPath);
    return Object.keys(lock.files).filter(rel => rel.startsWith(`skills/${SKILL}/`)).map(rel => rel.slice(`skills/${SKILL}/`.length)).sort();
  };

  it('copy method: the folder has every file but the ones under evals/, and the lockfile records exactly those', async () => {
    await engine().install(SKILL, { targetDir: agentsDir, method: 'copy', nativeLane: false });
    expect((await fs.lstat(installedSkill)).isSymbolicLink()).toBe(false);
    expect(await filesUnder(installedSkill)).toEqual(INSTALLED);
    expect(await fs.pathExists(path.join(installedSkill, 'evals'))).toBe(false);
    expect(await recorded()).toEqual(INSTALLED);
  });

  it('copy method: the registry keeps its evals/ folder', async () => {
    await engine().install(SKILL, { targetDir: agentsDir, method: 'copy', nativeLane: false });
    for (const rel of MAINTAINER_ONLY) expect(await fs.pathExists(path.join(SKILL_DIR, rel)), rel).toBe(true);
  });

  it('copy method: a second install over the first changes nothing and still leaves evals/ out', async () => {
    await engine().install(SKILL, { targetDir: agentsDir, method: 'copy', nativeLane: false });
    await engine().install(SKILL, { targetDir: agentsDir, method: 'copy', force: true, nativeLane: false });
    expect(await filesUnder(installedSkill)).toEqual(INSTALLED);
    expect(await recorded()).toEqual(INSTALLED);
  });

  it('symlink method: evals/ is never recorded as an installed file, though a link shows the registry folder as it is', async () => {
    await engine().install(SKILL, { targetDir: agentsDir, method: 'symlink', nativeLane: false });
    expect(await recorded()).toEqual(INSTALLED);
  });

  it('a skill without evals/ is installed unchanged', async () => {
    await fs.remove(path.join(SKILL_DIR, 'evals'));
    await engine().install(SKILL, { targetDir: agentsDir, method: 'copy', nativeLane: false });
    expect(await filesUnder(installedSkill)).toEqual(INSTALLED);
    expect(await recorded()).toEqual(INSTALLED);
  });
});

describe('evals/ is not installed: the whole catalog', () => {
  const realRegistry = path.resolve('registry');
  const everySkill = fs.readdirSync(path.join(realRegistry, 'skills'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  const catalogBundle: BundleDefinition = { name: 'catalog-bundle', description: 'Every skill of the registry', orchestrator: 'none.md', agents: [], skills: everySkill };
  const catalogResolved: ResolvedAssets = { targetBundle: 'catalog-bundle', agents: [], skills: everySkill, workflows: [], rules: [] };
  const evalsOf = (skill: string): string => `skills/${skill}/evals/`;

  it('no projection plan of any skill in the registry carries a file of its evals/ folder', async () => {
    const claude = await ClaudeProjector.planCompoundProjection(catalogBundle, 'project', catalogResolved, realRegistry);
    const cline = await ClineProjector.planCompoundProjection(catalogBundle, 'project', catalogResolved, realRegistry);
    const withEvals = everySkill.filter(skill => fs.existsSync(path.join(realRegistry, 'skills', skill, 'evals')));
    for (const skill of withEvals) {
      for (const artifact of [...claude, ...cline]) {
        expect(artifact.canonical ?? '', `${skill}: ${artifact.relPath}`).not.toContain(evalsOf(skill));
        expect(artifact.relPath, `${skill}`).not.toContain(`/skills/${skill}/evals/`);
      }
    }
    // The plans still carry the skills themselves: a filter that dropped everything would pass the loop above.
    expect(claude.filter(a => a.kind === 'skill' && a.relPath.endsWith('/SKILL.md')).length).toBe(everySkill.length);
    expect(cline.filter(a => a.kind === 'skill' && a.relPath.endsWith('/SKILL.md')).length).toBe(everySkill.length);
  });
});
