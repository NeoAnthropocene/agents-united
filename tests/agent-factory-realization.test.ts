import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { loadSemanticCore, validateSubagentContract } from '../src/core/semantic-core.js';
import { checkFloor } from '../src/core/native-floor.js';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { nativeGuardFileHooks } from '../src/core/guard.js';
import type { InstallOptions, LockfileManifest } from '../src/core/types.js';
import { validateRewrittenSkill } from './helpers/skill-contract.js';
import { checkSkillLayout, supportingText } from './helpers/skill-layout.js';
import { lintSkillPortability } from '../src/core/skill-portability-lint.js';
import { lintSkillLicence } from '../src/core/skill-licence-lint.js';
import { loadCorpus, measureSkill, verdictOf } from '../scripts/skill-quality/measure.ts';

/** Production registration and installed entry points; no host/model process. */
describe('the shipped Claude factory realizer', () => {
  let root: string;
  let state: string;
  const options = (): InstallOptions => ({ targetDir: state, method: 'copy', fanout: ['claude'], nativeLane: true, allowUnderConstruction: true });
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-factory-realize-'));
    state = path.join(root, '.claude/.agents-united');
  });
  afterEach(async () => { await fs.remove(root); });

  it('passes the existing compact layout, substance, licence, portability and frozen-corpus gates', async () => {
    const skills = path.resolve('registry/skills');
    const folder = path.join(skills, 'realize-artifact');
    const raw = await fs.readFile(path.join(folder, 'SKILL.md'), 'utf8');
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)![1]!;
    const meta = YAML.parse(front) as { name: string; metadata: { author: string; version: string; license: string; source?: string } };
    expect(checkSkillLayout(skills, 'realize-artifact')).toEqual([]);
    expect(validateRewrittenSkill('realize-artifact', raw, supportingText(folder))).toEqual([]);
    const walk = async (dir: string, prefix = ''): Promise<string[]> => {
      const result: string[] = [];
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) result.push(...await walk(path.join(dir, entry.name), `${prefix}${entry.name}/`));
        else result.push(`${prefix}${entry.name}`);
      }
      return result;
    };
    const files = await walk(folder);
    const scripts = await Promise.all(files.filter(rel => rel.startsWith('scripts/')).map(async relPath => ({ relPath, content: await fs.readFile(path.join(folder, relPath), 'utf8') })));
    expect(lintSkillPortability({ dirName: 'realize-artifact', name: meta.name, body: raw.slice(/^---\r?\n[\s\S]*?\r?\n---/.exec(raw)![0].length), scripts })).toEqual([]);
    expect(lintSkillLicence({ dirName: 'realize-artifact', license: meta.metadata.license, source: meta.metadata.source, files })).toEqual([]);
    expect(verdictOf(measureSkill(skills, 'realize-artifact', loadCorpus(path.resolve('tests/fixtures/skill-boilerplate-corpus.txt'))))).toBe('ok');
    expect(await fs.pathExists(path.resolve('tests/fixtures/templated-skills/realize-artifact'))).toBe(false);
  });

  it('installs an original supplied shared pair through the actual native-only registration', async () => {
    await new InstallEngine().install('agent-factory', options());
    const roleFile = path.join(root, '.claude/agents/factory-realizer.md');
    expect(await fs.pathExists(roleFile), 'production native worker is a required delivery edge').toBe(true);
    const text = await fs.readFile(roleFile, 'utf8');
    const front = YAML.parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)![1]!) as Record<string, unknown>;
    const cores = await loadSemanticCore(path.resolve('registry'));
    const contract = validateSubagentContract(await fs.readJson(path.resolve('registry/core/subagent-realize-for-host.contract.json')), cores);
    expect(Object.keys(contract).sort()).toEqual(['definition', 'hooks', 'skills', 'workflows']);
    const core = cores.get(contract.definition)!;
    expect(checkFloor(text, core)).toEqual([]);
    expect(front).toMatchObject({ name: 'factory-realizer', model: 'inherit', effort: 'medium', background: false, skills: ['realize-artifact'] });
    expect(front.hooks).toEqual(nativeGuardFileHooks());
    expect(String(front.tools).split(/,\s*/).sort()).toEqual(resolveGrant(loadToolPolicy(path.resolve('registry'), 'claude'), core.capabilities ?? [], { subagent: true, background: false }).tools.sort());
    expect(await fs.pathExists(path.resolve('registry/agents/subagent-realize-for-host.md'))).toBe(false);
    const lock = await fs.readJson(path.join(state, 'agents-united.json')) as LockfileManifest;
    expect(lock.projections?.['.claude/agents/factory-realizer.md']).toMatchObject({ owners: ['agent-factory'], kind: 'role' });
    expect(lock.projections?.['.claude/agents/factory-realizer.md']?.canonical).toBeUndefined();
    const skill = path.join(root, '.claude/skills/realize-artifact');
    expect(await fs.pathExists(path.join(skill, 'evals'))).toBe(false);
    const loader = YAML.parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(await fs.readFile(path.join(skill, 'SKILL.md'), 'utf8'))![1]!) as Record<string, unknown>;
    expect(loader['user-invocable']).toBe(false);
    expect(loader.context).toBeUndefined();
    expect(loader['disable-model-invocation']).not.toBe(true);
  });

  it.each(['check-job', 'check-handback'])('runs installed %s help from an unrelated cwd without checkout imports', async name => {
    await new InstallEngine().install('agent-factory', options());
    const script = path.join(root, '.claude/skills/realize-artifact/scripts', `${name}.mjs`);
    expect(await fs.pathExists(script), 'required installed helper').toBe(true);
    const other = path.join(root, 'other');
    await fs.ensureDir(other);
    const result = execFileSync(process.execPath, [script, '--help'], { cwd: other, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    expect(result).toMatch(/usage|--job/i);
  });

  it('refuses a missing production job checker before writing installation state', async () => {
    const registry = path.join(root, 'source-registry');
    await fs.copy(path.resolve('registry'), registry);
    await fs.remove(path.join(registry, 'skills/realize-artifact/scripts/check-job.mjs'));
    await expect(new InstallEngine(new RegistryResolver(registry)).install('agent-factory', options()))
      .rejects.toThrow(/factory.*missing.*check-job/i);
    expect(await fs.pathExists(state)).toBe(false);
  });
  it('refuses a partial direct realizer request before creating state or projections', async () => {
    await expect(new InstallEngine().install('realize-artifact', options())).rejects.toThrow(/partial direct item|required bundle/i);
    expect(await fs.pathExists(state)).toBe(false);
    expect(await fs.pathExists(path.join(root, '.claude/agents'))).toBe(false);
  });
});
