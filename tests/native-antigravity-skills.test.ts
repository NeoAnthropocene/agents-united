import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { lintSkillPortability } from '../src/core/skill-portability-lint.js';

/**
 * Plan 032 Phase 8 / ADR 0031 addendum — Antigravity skills. A skill is a folder with a `SKILL.md` whose frontmatter documents only `description`
 * (required) and `name` (optional, lowercase with hyphens, defaulting to the folder), and the CLI turns every skill into a slash command. The
 * registry's skills are portable as written (the Cline lane made the same call, ADR 0029), so none is copied into `registry/hosts/antigravity/skills/`
 * (a copy would only drift); the lane serves them from `.agents/skills/`, and this suite keeps them loadable: portability lint, the documented keys,
 * and no name that shadows a built-in slash command. The built-in names are READ from the docs snapshots, so a refresh that adds one fails here.
 */

const registry = path.resolve('registry');
const lib = path.resolve('host-library/antigravity');
const read = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const skillNames = fs.readdirSync(path.join(registry, 'skills')).filter(name => fs.existsSync(path.join(registry, 'skills', name, 'SKILL.md'))).sort();
const split = (name: string): { meta: Record<string, unknown>; body: string } => {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(read(path.join(registry, 'skills', name, 'SKILL.md')))!;
  return { meta: yaml.parse(match[1]) as Record<string, unknown>, body: match[2] };
};

/** `/name` tokens in the first column of the docs' command tables, plus the aliases column of the CLI reference. */
function builtInCommands(): Set<string> {
  const names = new Set<string>();
  const rows = (file: string, from: string): string[] => {
    const text = read(path.join(lib, file));
    const start = text.indexOf(from);
    return text.slice(start).split('\n').filter(line => line.startsWith('|') && /`\//.test(line));
  };
  for (const line of [...rows('pages/command/slash-commands.md', '## Command catalog').slice(0, 20), ...rows('pages/settings/cli-reference.md', '## Core slash commands').slice(0, 60)]) {
    const cells = line.split('|').slice(1, -1);
    for (const match of (cells[0] + ' ' + (cells.length > 3 ? cells[2] : '')).matchAll(/`\/([a-z][a-z-]*)/g)) names.add(match[1]);
  }
  return names;
}

describe('the built-in slash commands, read from the docs snapshots', () => {
  it('include the ones the guide names, so the parser has not gone blind', () => {
    const builtIns = builtInCommands();
    for (const name of ['boost', 'plan', 'goal', 'learn', 'schedule', 'browser', 'btw', 'plugin', 'grill-me', 'teamwork-preview', 'agents', 'hooks', 'mcp', 'skills', 'permissions', 'config', 'resume', 'new', 'quit', 'teamwork']) {
      expect(builtIns, name).toContain(name);
    }
    expect(builtIns.size).toBeGreaterThan(35);
  });
});

describe('the registry skills stay Antigravity-loadable (they are installed as written, not copied)', () => {
  // The one name shared with a built-in. Which wins is not documented and unverified (guide/command.md), so it is kept by name and recorded here:
  // a NEW collision must fail this test, and a resolved one is removed from the list.
  const KNOWN_COLLISIONS = ['grill-me'];
  // Skills whose name is not lowercase-with-hyphens, which the docs' name rule does not allow. There was one, `generative_ui`, renamed
  // `generative-ui` on 2026-10-03 (tests/generative-ui-rename.test.ts); a NEW such name must fail here, so the list stays empty.
  const KNOWN_NAME_EXCEPTIONS: string[] = [];
  const NAME_RULE = /name must be lowercase letters, digits and hyphens only/;

  it('has skills to check', () => {
    expect(skillNames.length).toBeGreaterThan(150);
  });

  it.each(skillNames)('%s: portable lint clean, name equal to its folder, a description, documented or recorded keys only', skill => {
    const { meta, body } = split(skill);
    const violations = lintSkillPortability({ dirName: skill, name: String(meta.name), body });
    expect(violations.filter(violation => !(KNOWN_NAME_EXCEPTIONS.includes(skill) && NAME_RULE.test(violation)))).toEqual([]);
    expect(violations.some(violation => NAME_RULE.test(violation)), `${skill} is a recorded name exception only while it breaks the name rule`).toBe(KNOWN_NAME_EXCEPTIONS.includes(skill));
    expect(meta.name).toBe(skill);
    expect(String(meta.description).length).toBeGreaterThan(0);
    expect(String(meta.description).length).toBeLessThanOrEqual(1024);
    const recordedAsHarmless = new Set(['name', 'description', 'metadata', 'license', 'disable-slash-command']);
    for (const key of Object.keys(meta)) expect(recordedAsHarmless, `${skill}: ${key}`).toContain(key);
  });

  it('shadow no built-in slash command except the one recorded', () => {
    const builtIns = builtInCommands();
    const collisions = skillNames.filter(name => builtIns.has(name));
    expect(collisions).toEqual(KNOWN_COLLISIONS);
  });

  it('ship no host-specific copy: a portable skill is served from .agents/skills, and Antigravity has no workflow artifact to replace one', () => {
    expect(fs.existsSync(path.join(registry, 'hosts/antigravity/skills'))).toBe(false);
    expect(fs.existsSync(path.join(registry, 'hosts/antigravity/workflows'))).toBe(false);
    const profile = JSON.parse(read(path.join(registry, 'hosts/antigravity/profile.json'))) as { features: Record<string, { status: string }> };
    expect(profile.features.workflows.status).toBe('deprecated');
  });

  it('record the keys the docs do not document as listed by the host but not as honoured: a real folder copy of a registry skill was listed, what disable-slash-command does was not tried', () => {
    const profile = JSON.parse(read(path.join(registry, 'hosts/antigravity/profile.json'))) as { features: Record<string, { status: string; note: string }> };
    const feature = profile.features.skillFrontmatterExtras;
    expect(feature.status).toBe('observed');
    expect(feature.note).toMatch(/metadata/);
    expect(feature.note).toMatch(/disable-slash-command/);
    expect(feature.note).toMatch(/listed/i);
    expect(feature.note).toMatch(/not (tried|exercised)/i);
  });

  it('record that a skill folder installed as a link is not seen by the host (observed), so the default symlink install is not served on this host', () => {
    const profile = JSON.parse(read(path.join(registry, 'hosts/antigravity/profile.json'))) as { features: Record<string, { status: string; note: string }> };
    const feature = profile.features.skillInstallMethod;
    expect(feature.status).toBe('observed');
    expect(feature.note).toMatch(/junction/i);
    expect(feature.note).toMatch(/not listed/i);
    expect(feature.note).toMatch(/--copy/);
    expect(feature.note).toMatch(/unverified|not established/i);
  });

  it('record the name that is still not clean for this host (grill-me) as unverified, and the rename of generative-ui, so a reader of the profile is not told it works', () => {
    const profile = JSON.parse(read(path.join(registry, 'hosts/antigravity/profile.json'))) as { features: Record<string, { status: string; note: string }> };
    const feature = profile.features.skillNames;
    expect(feature.status).toBe('unverified');
    expect(feature.note).toContain('generative-ui');
    for (const name of [...KNOWN_NAME_EXCEPTIONS, ...KNOWN_COLLISIONS]) expect(feature.note).toContain(name);
  });
});

describe('the native lane serves the skills of a bundle byte for byte', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-native-antigravity-skills');
  const agentsDir = path.join(workspace, '.agents');
  const bundles = JSON.parse(read(path.join(registry, 'bundles.json'))) as { bundles?: Record<string, { skills?: string[] }> } & Record<string, { skills?: string[] }>;
  const skills = (bundles.bundles ?? bundles)['software-engineering'].skills ?? [];

  beforeEach(async () => {
    fs.rmSync(workspace, { recursive: true, force: true });
    fs.mkdirSync(workspace, { recursive: true });
  });
  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('installs every skill of software-engineering unchanged with the lane on, native agents and rules beside them', async () => {
    await new InstallEngine().install('software-engineering', { targetDir: agentsDir, method: 'copy', nativeLane: true });
    expect(skills.length).toBeGreaterThan(30);
    for (const skill of skills) {
      const installed = path.join(agentsDir, 'skills', skill, 'SKILL.md');
      expect(fs.existsSync(installed), skill).toBe(true);
      expect(read(installed), skill).toBe(read(path.join(registry, 'skills', skill, 'SKILL.md')));
    }
    expect(fs.existsSync(path.join(agentsDir, 'agents', 'code-reviewer.md'))).toBe(true);
  });
});
