import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import { loadToolPolicy } from '../src/core/host-profile.js';
import { nativeText, NATIVE_AGENTS_DIR } from './helpers/native-roles.js';

/**
 * Plan 036 S1, finding F1 and F10: a skill that a Claude native role loads must not tell the model to call a tool that
 * only another host has. `generative-ui` was written for Antigravity (`write_to_file`, `<agent-embed>`,
 * `ArtifactMetadata`) and the creative designer's table loaded it; the portability lint could not see it because it
 * does not know host primitives. The tokens here are derived, not listed: the underscore-bearing tool names on the
 * `tools:` lines of the canonical agents (`registry/agents/*.md`) that the Claude tool policy does not catalogue (the
 * Antigravity and Cline primitives such as `write_to_file`, `view_file`, `run_command`), plus three names that no
 * `tools:` line carries. Every skill that a skill table of a Claude native role loads is scanned, `SKILL.md` and its
 * supporting files (not `evals/`), for those tokens as whole tokens.
 */

const REGISTRY = path.resolve('registry');
const SKILLS = path.join(REGISTRY, 'skills');
/** Names of another host that appear in a skill's text and on no `tools:` line. */
const EXTRA_FOREIGN_TOKENS = ['ArtifactMetadata', 'agent-embed', 'MediaResolution'] as const;
/** A skill that names another host's tools on purpose, with the reason. A stale entry fails its own test. */
const EXEMPT: Record<string, string> = {
  'mcp-setup': 'it documents the route of every host, so it names each host\'s tools on purpose (a row per host)',
};
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|woff2?|ttf)$/i;

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function frontmatter(source: string): Record<string, unknown> {
  const m = /^---\n([\s\S]*?)\n---/.exec(source.replace(/\r\n/g, '\n'));
  return m ? (yaml.parse(m[1]!) as Record<string, unknown>) : {};
}

/** The tool names of the canonical agents that Claude Code does not catalogue and that carry an underscore (never an MCP name). */
function foreignToolNames(): string[] {
  const catalogued = new Set(loadToolPolicy(REGISTRY, 'claude').catalog.map(tool => tool.name));
  const names = new Set<string>();
  for (const file of fs.readdirSync(path.join(REGISTRY, 'agents')).filter(f => f.endsWith('.md'))) {
    const raw = frontmatter(text(path.join(REGISTRY, 'agents', file))).tools;
    const tools = typeof raw === 'string' ? raw.split(',').map(s => s.trim()) : Array.isArray(raw) ? raw : [];
    for (const tool of tools) {
      if (typeof tool === 'string' && tool.includes('_') && !tool.startsWith('mcp__') && !catalogued.has(tool)) names.add(tool);
    }
  }
  return [...names].sort();
}

const foreignTokens = (): string[] => [...foreignToolNames(), ...EXTRA_FOREIGN_TOKENS];

/** Skill name to the native roles whose skill table loads it (a command such as `/grill-me` is not a skill folder). */
function loadedSkills(): Map<string, string[]> {
  const loaded = new Map<string, string[]>();
  for (const file of fs.readdirSync(NATIVE_AGENTS_DIR).filter(f => f.endsWith('.md'))) {
    const role = file.replace(/\.md$/, '');
    const lines = nativeText(role).split('\n');
    lines.forEach((line, h) => {
      if (!/^\|\s*Situation\s*\|\s*Skill[^|]*\|\s*Load when\s*\|/.test(line)) return;
      for (let i = h + 2; i < lines.length && lines[i]!.startsWith('|'); i++) {
        const m = /^`([^`/][^`]*)`$/.exec(lines[i]!.split('|')[2]?.trim() ?? '');
        if (m) loaded.set(m[1]!, [...(loaded.get(m[1]!) ?? []), role]);
      }
    });
  }
  return loaded;
}

function filesOf(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return entry.name === 'evals' ? [] : filesOf(path.join(dir, entry.name));
    return BINARY.test(entry.name) ? [] : [path.join(dir, entry.name)];
  });
}

/** The tokens that `source` contains as whole tokens: not inside a longer word, name or hyphenated name. */
function wholeTokensIn(source: string, tokens: readonly string[]): string[] {
  return tokens.filter(token => new RegExp(`(?<![\\w-])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(source));
}

interface Hit {
  skill: string;
  token: string;
  file: string;
  roles: string[];
}

function scanLoadedSkills(): Hit[] {
  const tokens = foreignTokens();
  const hits: Hit[] = [];
  for (const [skill, roles] of loadedSkills()) {
    const dir = path.join(SKILLS, skill);
    if (!fs.existsSync(dir)) continue;
    for (const file of filesOf(dir)) {
      for (const token of wholeTokensIn(text(file), tokens)) hits.push({ skill, token, file: path.relative(dir, file).replace(/\\/g, '/'), roles });
    }
  }
  return hits;
}

describe('skill host fit: the tokens are derived from the other hosts, not listed', () => {
  it('holds the Antigravity primitives of the canonical agents, none of which Claude Code catalogues', () => {
    const names = foreignToolNames();
    for (const known of ['write_to_file', 'view_file', 'run_command', 'generate_image', 'invoke_subagent']) expect(names, known).toContain(known);
    expect(names.length).toBeGreaterThanOrEqual(17);
    const catalogued = new Set(loadToolPolicy(REGISTRY, 'claude').catalog.map(tool => tool.name));
    for (const name of names) {
      expect(catalogued.has(name), name).toBe(false);
      expect(name.startsWith('mcp__'), name).toBe(false);
    }
    expect(foreignTokens()).toEqual(expect.arrayContaining([...EXTRA_FOREIGN_TOKENS]));
  });

  it('matches whole tokens only: not inside a longer name, and not a prefix of a hyphenated one', () => {
    const tokens = ['write_to_file', 'agent-embed'];
    expect(wholeTokensIn('Use `write_to_file` to save it.', tokens)).toEqual(['write_to_file']);
    expect(wholeTokensIn('<agent-embed src="x"></agent-embed>', tokens)).toEqual(['agent-embed']);
    expect(wholeTokensIn('my_write_to_file_helper and write_to_file_v2', tokens)).toEqual([]);
    expect(wholeTokensIn('the my-agent-embed-widget and agent-embedded', tokens)).toEqual([]);
  });
});

describe('skill host fit: the skills that Claude native roles load', () => {
  it('finds the skills of every skill table, in both header forms, and each one exists in the registry', () => {
    const loaded = loadedSkills();
    expect(loaded.size).toBeGreaterThanOrEqual(46);
    for (const known of ['ad-creative-design', 'frontend-design', 'design-system-tokens', 'mcp-setup']) expect([...loaded.keys()], known).toContain(known);
    for (const skill of loaded.keys()) expect(fs.existsSync(path.join(SKILLS, skill, 'SKILL.md')), `${skill} is in the registry`).toBe(true);
  });

  it('names no tool of another host in any of them, except the skills that do so on purpose', () => {
    const offenders = scanLoadedSkills().filter(hit => !(hit.skill in EXEMPT));
    expect(
      offenders.map(h => `${h.skill} names ${h.token} in ${h.file}, and ${h.roles.join(', ')} loads it`),
      'a skill a Claude role loads is written for another host: rewrite it for Claude, take the row out of the role table, or exempt it with a reason',
    ).toEqual([]);
  });

  it('keeps no stale exemption: every exempt skill is still loaded by a Claude role and still names a foreign tool', () => {
    const loaded = loadedSkills();
    const hits = scanLoadedSkills();
    for (const skill of Object.keys(EXEMPT)) {
      expect(loaded.has(skill), `${skill} is loaded by a role`).toBe(true);
      expect(hits.some(h => h.skill === skill), `${skill} still names a foreign tool`).toBe(true);
    }
  });
});

describe("the creative designer's table (Plan 036 S1)", () => {
  const body = (): string => nativeText('agency-creative-designer');
  const row = (skill: string): string => body().split('\n').find(l => l.startsWith('|') && l.split('|')[2]?.trim() === `\`${skill}\``) ?? '';

  it('does not load generative-ui, which is written for Antigravity', () => {
    expect(row('generative-ui')).toBe('');
    expect(body()).not.toContain('generative-ui');
  });

  it('sends an interface prototype to frontend-design, with the screens from the connected Stitch server', () => {
    expect(row('frontend-design')).toMatch(/An? landing page, a UI surface or an interface prototype/i);
    expect(body()).toMatch(/`mcp__stitch` generates interface designs/);
  });

  it('keeps the other rows of her table', () => {
    for (const skill of ['ad-creative-design', 'marketing-creative-design', 'design-system-tokens', 'stitch-design-taste', 'brand-identity', 'banner-design', 'ux-writing']) {
      expect(row(skill), skill).not.toBe('');
    }
  });
});
