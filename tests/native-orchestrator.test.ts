import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import { splitTools } from '../src/core/native-guard.js';
import { checkRoster, domainTypes } from '../src/core/native-roster.js';
import { COORDINATOR_BUNDLE, allowlist, bundles, rosterTypes } from './helpers/native-coordinator.js';

/**
 * Plan 032 PR E — what is specific to the native orchestrator, beyond the checks every native agent gets in
 * native-claude-agents.test.ts: it runs as the main thread, may spawn exactly the types of its domain, and carries a
 * generated domain map that tells the user which bundle to install when a type is missing.
 */

const file = path.resolve('registry/hosts/claude/agents/orchestrator-engineering.md');
const read = (): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const frontmatter = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(read())![1]);

describe('native orchestrator-engineering (a main-thread coordinator)', () => {
  it('may spawn exactly the specialist types of its domain, through an Agent allowlist and never a bare Agent', () => {
    const tools = splitTools(frontmatter().tools);
    expect(tools.filter(tool => tool.startsWith('Agent'))).toEqual([allowlist()]);
    expect(tools).not.toContain('Agent');
    expect(allowlist().split(', ')).toHaveLength(15);
  });

  it('carries the domain map exactly as generated from the bundles and the native agents', () => {
    expect(checkRoster(read(), rosterTypes())).toEqual([]);
  });

  it('names every type of its domain in the map, with the bundles that provide it', () => {
    const body = read();
    for (const type of domainTypes(bundles(), COORDINATOR_BUNDLE)) {
      expect(body, type.name).toContain(`| \`${type.name}\` | ${type.bundles.map(bundle => `\`${bundle}\``).join(', ')} |`);
      for (const bundle of type.bundles) expect(Object.keys(bundles()), bundle).toContain(bundle);
    }
  });

  it('tells the user how to install a missing type and refresh the running session', () => {
    const body = read();
    expect(body).toContain('agents add <bundle>');
    expect(body).toContain('/reload-skills');
  });

  it('states that it must run as the main thread, and what it does when it cannot', () => {
    const body = read();
    expect(body).toContain('claude --agent orchestrator-engineering');
    expect(body).toMatch(/Workflow and AskUserQuestion are not available/);
  });

  it('refers only to slash commands that exist as skills, and to bundles that exist', () => {
    const body = read();
    for (const match of body.matchAll(/`\/([a-z0-9-]+)`/g)) {
      if (match[1] === 'reload-skills' || match[1] === 'config') continue; // Claude Code commands, not skills of ours
      expect(fs.existsSync(path.resolve('registry/skills', match[1], 'SKILL.md')), `/${match[1]}`).toBe(true);
    }
    for (const match of body.matchAll(/agents add ([a-z][a-z0-9:-]*)/g)) {
      const name = match[1].replace(/^domain:/, '');
      expect(match[1].startsWith('domain:') || Object.keys(bundles()).includes(name), `agents add ${match[1]}`).toBe(true);
    }
  });

  it('is a coordinator, so it delegates every domain implementation slice and does not carry the implementation skills', () => {
    expect(frontmatter().skills ?? []).toEqual([]);
    expect(read()).toMatch(/delegate every (domain )?(implementation|slice)/i);
  });
});
