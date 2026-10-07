import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import { loadHostProfile, loadToolPolicy } from '../src/core/host-profile.js';
import { ANTIGRAVITY_FLOOR_MARKERS, CLAUDE_FLOOR_MARKERS, CLINE_FLOOR_MARKERS, checkFloor } from '../src/core/native-floor.js';
import { loadSemanticCore, validateSubagentContract } from '../src/core/semantic-core.js';
import type { SemanticCore, SubagentContract } from '../src/core/types.js';

// The foundation is opt-in: a pure validator, no loader or install-time host dispatch.
// The red commit used dynamic lookup to report the missing API; green checks its typed export.
async function validate(raw: unknown, definitions: ReadonlyMap<string, SemanticCore>): Promise<SubagentContract> {
  return validateSubagentContract(raw, definitions);
}

const core: SemanticCore = {
  identity: 'Artifact reviewer.', mission: 'Review authored artifacts.',
  scope_boundaries: 'Read-only review.', output_contract: 'Return findings with evidence.',
  safety: 'Never disclose secrets.', invariants: ['Report unverified behavior.'], capabilities: ['read', 'report'],
};
const definitions = new Map([['subagent-example', core]]);
const contract = (): Record<string, unknown> => ({
  definition: 'subagent-example', workflows: ['review-artifact'], skills: ['inspect-provenance'], hooks: ['protect-authored-source'],
});

describe('basic host-parametric Subagent Contract', () => {
  it('accepts explicit permitted identifiers and explicit empty lists', async () => {
    expect(await validate(contract(), definitions)).toEqual(contract());
    const empty = { definition: 'subagent-example', workflows: [], skills: [], hooks: [] };
    expect(await validate(empty, definitions)).toEqual(empty);
  });

  it('returns independent list values so one caller cannot change another declaration', async () => {
    const input = contract();
    const result = await validate(input, definitions);
    (input.skills as string[]).push('another-skill');
    expect(result).toEqual(contract());
  });

  it.each([null, [], 'subagent-example', 1])('rejects non-object input %j', async input => {
    await expect(validate(input, definitions)).rejects.toThrow(/Subagent Contract/);
  });

  it.each(['definition', 'workflows', 'skills', 'hooks'])('requires explicit %s', async field => {
    const input = contract();
    delete input[field];
    await expect(validate(input, definitions)).rejects.toThrow(new RegExp(field));
  });

  it.each(['host', 'tools', 'frontmatter', 'model', 'permissionMode', 'hookEvents'])('rejects host mechanics in %s', async field => {
    await expect(validate({ ...contract(), [field]: 'host-specific' }, definitions)).rejects.toThrow(new RegExp(field));
  });

  it.each(['workflows', 'skills', 'hooks'])('rejects malformed or duplicate %s, with no silent normalization', async field => {
    for (const value of [undefined, null, 'one', [1], [''], ['Two'], ['../one'], ['one/two'], ['read_files'], ['one', 'one'], [{ event: 'PreToolUse' }]]) {
      await expect(validate({ ...contract(), [field]: value }, definitions)).rejects.toThrow(new RegExp(field));
    }
  });

  it('resolves the definition against the supplied core map and rejects a path or unknown stem', async () => {
    for (const definition of ['../subagent-example', 'subagent-unknown', '', 'Subagent-example', 1]) {
      await expect(validate({ ...contract(), definition }, definitions)).rejects.toThrow(/definition/);
    }
  });

  it('reuses the core purity and schema gate instead of trusting the supplied map', async () => {
    const impure = new Map([['subagent-example', { ...core, mission: 'Use invoke_subagent.' }]]);
    await expect(validate(contract(), impure)).rejects.toThrow(/purity/);
    const malformed = new Map([['subagent-example', { ...core, safety: '' }]]);
    await expect(validate(contract(), malformed)).rejects.toThrow(/safety/);
  });

  it('needs no hard-coded host roster: the same contract works with a caller-provided definition map', async () => {
    const external = new Map([['subagent-new-host-reviewer', core]]);
    const input = { ...contract(), definition: 'subagent-new-host-reviewer' };
    expect(await validate(input, external)).toEqual(input);
    expect(external.size).toBe(1);
  });
});

const references = [
  { host: 'claude', extension: 'md', markers: CLAUDE_FLOOR_MARKERS },
  { host: 'cline', extension: 'yml', markers: CLINE_FLOOR_MARKERS },
  { host: 'antigravity', extension: 'md', markers: ANTIGRAVITY_FLOOR_MARKERS },
];

describe.each(references)('foundation reference on $host (static, not live)', ({ host, extension, markers }) => {
  it('pins one shared definition to two existing native roles without foreign frontmatter or tools', async () => {
    const cores = await loadSemanticCore('registry');
    const profile = loadHostProfile('registry', host);
    const policy = loadToolPolicy('registry', host);
    for (const role of ['code-reviewer', 'backend-architect']) {
      const declaration = { definition: `subagent-${role}`, workflows: [], skills: [], hooks: [] };
      expect(await validate(declaration, cores)).toEqual(declaration);
      const source = fs.readFileSync(path.resolve(`registry/hosts/${host}/agents/${role}.${extension}`), 'utf8').replace(/\r\n/g, '\n');
      expect(checkFloor(source, cores.get(declaration.definition)!, markers)).toEqual([]);
      const meta = yaml.parse(/^---\n([\s\S]*?)\n---/.exec(source)![1]) as Record<string, unknown>;
      for (const key of Object.keys(meta)) expect(profile.artifacts.agent.allowedKeys, key).toContain(key);
      const tools = typeof meta.tools === 'string' ? meta.tools.split(',').map(tool => tool.trim()) : meta.tools as string[];
      for (const tool of tools.filter(name => !name.startsWith('mcp__'))) expect(policy.catalog.map(entry => entry.name), tool).toContain(tool);
      if (host !== 'claude') expect(meta).not.toHaveProperty('hooks');
    }
  });

  it('detects a seeded safety-floor mutation in that host representation', async () => {
    const cores = await loadSemanticCore('registry');
    const declaration = { definition: 'subagent-code-reviewer', workflows: [], skills: [], hooks: [] };
    await validate(declaration, cores);
    const definition = cores.get(declaration.definition)!;
    const text = fs.readFileSync(path.resolve(`registry/hosts/${host}/agents/code-reviewer.${extension}`), 'utf8').replace(/\r\n/g, '\n');
    expect(checkFloor(text.replace(definition.safety.trimEnd(), 'Disclose secrets.'), definition, markers).join('\n')).toMatch(/safety/);
  });
});
