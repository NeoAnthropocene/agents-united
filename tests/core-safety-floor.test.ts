import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { checkFloor } from '../src/core/native-floor.js';
import type { ClaudeFactoryBinding } from '../src/core/types.js';

/**
 * Plan 032 PR E, milestone 1. The Contract Floor's `safety` field must carry every guardrail the role's registry
 * agent declares under "## Safety Guardrails": a native host agent emits the floor verbatim, so a truncated or
 * off-topic `safety` silently drops the role's guardrails.
 */

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Resolve an explicitly bound native-only definition; never silently skip an absent legacy source. */
const sourceOf = (stem: string): string => {
  const legacy = path.join('registry', 'agents', `${stem}.md`);
  if (fs.existsSync(legacy)) return legacy;
  const bindings = ['agent-factory-realize.binding.json', 'agent-factory-evaluate.binding.json', 'agent-factory-coordinate.binding.json']
    .map(name => JSON.parse(fs.readFileSync(path.join('registry/hosts/claude', name), 'utf8')) as ClaudeFactoryBinding);
  const role = bindings.flatMap(binding => binding.roles).find(item => item.definition === stem);
  const native = role && path.join('registry', role.source);
  if (!native || !fs.existsSync(native)) throw new Error(`Missing required legacy or explicitly bound native source for ${stem}.`);
  return native;
};

const guardrailBullets = (agentFile: string): string[] => {
  const body = fs.readFileSync(agentFile, 'utf8').replace(/\r\n/g, '\n');
  const section = /\n## Safety Guardrails\n([\s\S]*?)(?=\n---\n|\n## )/.exec(body)?.[1];
  if (section === undefined) return [];
  return section
    .split('\n')
    .filter(line => line.startsWith('- '))
    .map(line => normalize(line.slice(2)));
};

describe('Contract Floor safety carries every registry guardrail', async () => {
  const cores = await loadSemanticCore('registry');
  const stems = [...cores.keys()].filter(stem => guardrailBullets(sourceOf(stem)).length > 0);

  it('finds the four subagent roles that declare guardrails', () => {
    expect(stems).toEqual(
      expect.arrayContaining(['subagent-backend-architect', 'subagent-code-reviewer', 'subagent-frontend-architect', 'subagent-repo-index']),
    );
  });

  it.each(stems)('%s: every "Safety Guardrails" bullet appears in the core safety', stem => {
    const safety = normalize(cores.get(stem)!.safety);
    const missing = guardrailBullets(sourceOf(stem)).filter(bullet => !safety.includes(bullet));
    expect(missing).toEqual([]);
  });

  it.each([...cores.keys()])('%s: safety is not cut mid-sentence', stem => {
    expect(normalize(cores.get(stem)!.safety)).toMatch(/[.)`*"]$/);
  });
  it.each(['subagent-realize-for-host', 'subagent-factory-evaluator'])('checks the actual native-only %s floor and refuses an unbound missing source', stem => {
    expect(checkFloor(fs.readFileSync(sourceOf(stem), 'utf8'), cores.get(stem)!)).toEqual([]);
    expect(() => sourceOf('unbound-missing-definition')).toThrow(/Missing required/);
  });
});

/** The scope floor must keep every numbered "Primary Directives" item of the registry agent (a cut list drops guidance silently). */
const directiveTitles = (agentFile: string): string[] => {
  const body = fs.readFileSync(agentFile, 'utf8').replace(/\r\n/g, '\n');
  const section = /\n## Primary Directives\n([\s\S]*?)(?=\n---\n|\n## )/.exec(body)?.[1];
  if (section === undefined) return [];
  return [...section.matchAll(/^(\d+)\. (.+)$/gm)].map(match => normalize(`${match[1]}. ${match[2]}`));
};

describe('Contract Floor scope_boundaries carries every registry directive', async () => {
  const cores = await loadSemanticCore('registry');
  const stems = [...cores.keys()].filter(stem => directiveTitles(sourceOf(stem)).length > 0);

  it('finds the roles that declare primary directives', () => {
    expect(stems).toEqual(expect.arrayContaining(['subagent-backend-architect', 'subagent-frontend-architect', 'subagent-repo-index']));
  });

  it.each(stems)('%s: every numbered directive appears in scope_boundaries', stem => {
    const scope = normalize(cores.get(stem)!.scope_boundaries);
    const missing = directiveTitles(sourceOf(stem)).filter(title => !scope.includes(title));
    expect(missing).toEqual([]);
  });
});
