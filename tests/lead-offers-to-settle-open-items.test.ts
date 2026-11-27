import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { renderFloor } from '../src/core/native-floor.js';
import { RegistryResolver } from '../src/core/registry.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * ADR 0084 (2026-11-27, the maintainer's choice after the live Sitting 1 of the Claude pilot): when a lead's final report or handoff
 * leaves open items that only the user can settle, the lead offers to settle them now or stop, and settling runs grill-me with those
 * items as its goal. "Every lead": the nine Tier-2 lead cores and their Claude native files. The agent-factory lead is the Plan 052
 * session's area and may take the same rule later. The rule sits in `invariants`, which no renderer copies, so each Claude lead binds
 * it in an authored section with one wording.
 */

const RULE =
  'When the final report or handoff leaves open items that only the user can settle, it ends by asking whether to settle them now or stop here; to settle them, grill-me runs with those items as its goal.';
const LEADS = ['business', 'design', 'digital-agency', 'engineering', 'marketing', 'research', 'security', 'system-architecture', 'universal'].map(
  lead => `orchestrator-${lead}`,
);
const MAY_FOLLOW = new Set(['orchestrator-agent-factory']);
const HEADING = '## Open items the user can settle';
const PARAGRAPH =
  'When your final report or handoff leaves open items that only the user can settle (a choice, an approval, or a fact only they hold), end it by offering two choices: settle them now, or stop here. Deliver the report, the handoff and any shutdown requests first, as your other rules say; the offer comes last and starts an optional new round. Name only those items, and leave out open items that belong to someone else, such as a decision for whoever builds the page later; when no open item needs the user, offer nothing. Ask with `AskUserQuestion` when you have it; otherwise write the two choices as a numbered list and wait for the reply; when you run as a subagent, put the offer in your report for your caller instead. When the user chooses to settle them, run the Skill tool with `skill: "grill-me"` and the open items in `args`, so that it starts from them and does not ask again what the session already settled. Then report what was settled. A change that follows is new work under the same gates as any other (an accepted plan or delegation map where your rules require one, and the same verification): update a file you own yourself, such as your synthesis or handoff; send a change to a specialist\'s file to that specialist, continuing it when it is still available or briefing a new one when it has shut down; and when you hold no specialist for the work, record the settlement in your handoff for the session that will do it. Note the change instead when the user says so.';

const cores = await loadSemanticCore('registry');

/** Frontmatter and body of a native file. */
function split(text: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('no frontmatter');
  return { frontmatter: yaml.parse(match[1]) as Record<string, unknown>, body: match[2] };
}

/** The level-2 headings of a body, outside fenced blocks and HTML comments, with the lines under each. */
function sections(body: string): Array<{ heading: string; lines: string[] }> {
  const out: Array<{ heading: string; lines: string[] }> = [];
  let fenced = false;
  let comment = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (!fenced && line.includes('<!--') && !line.includes('-->')) comment = true;
    if (!fenced && !comment && line.startsWith('## ')) out.push({ heading: line, lines: [] });
    else if (out.length) out[out.length - 1].lines.push(line);
    if (comment && line.includes('-->')) comment = false;
  }
  return out;
}

const toolNames = (value: unknown): string[] =>
  String(value ?? '')
    .split(/,\s*(?![^()]*\))/)
    .map(name => name.trim())
    .filter(Boolean);

describe('the open-items rule in the Semantic Core', () => {
  it.each(LEADS)('is an invariant of %s, exactly once', stem => {
    const core = cores.get(stem);
    expect(core, stem).toBeDefined();
    expect(core!.invariants.filter(invariant => invariant === RULE)).toHaveLength(1);
  });

  it('is stated by no other core (the agent-factory lead may follow)', () => {
    const others = [...cores.entries()]
      .filter(([stem, core]) => !LEADS.includes(stem) && !MAY_FOLLOW.has(stem) && core.invariants.some(invariant => invariant.includes('settle them now')))
      .map(([stem]) => stem);
    expect(others).toEqual([]);
  });

  it('names no host or host tool', () => {
    expect(RULE).not.toMatch(/antigravity|claude|cline|codex|gemini|AskUserQuestion|mcp|\//i);
  });

  it('is left out of the rendered Contract Floor', () => {
    for (const stem of LEADS) expect(renderFloor(cores.get(stem)!), stem).not.toContain('settle them now');
  });
});

describe('the Claude realization in every lead', () => {
  it.each(LEADS)('%s has the section as a real heading, word for word, right before the host boundaries', role => {
    const all = sections(split(nativeText(role)).body);
    const at = all.findIndex(section => section.heading === HEADING);
    expect(at, role).toBeGreaterThanOrEqual(0);
    expect(all.filter(section => section.heading === HEADING), role).toHaveLength(1);
    expect(all[at].lines.join('\n').trim(), role).toBe(PARAGRAPH);
    expect(all[at + 1]?.heading, role).toBe('## Boundaries of this host');
  });

  it.each(LEADS)('%s is granted the tools the section names, and none is denied', role => {
    const { frontmatter } = split(nativeText(role));
    const granted = toolNames(frontmatter.tools);
    const denied = toolNames(frontmatter.disallowedTools);
    for (const tool of ['AskUserQuestion', 'Skill']) {
      expect(granted, `${role} grants ${tool}`).toContain(tool);
      expect(denied, `${role} denies ${tool}`).not.toContain(tool);
    }
  });

  it('every bundle whose resolved agents hold one of these leads installs grill-me', async () => {
    const resolver = new RegistryResolver(path.resolve('registry'));
    const names = Object.keys(JSON.parse(fs.readFileSync('registry/bundles.json', 'utf8')).bundles as Record<string, unknown>);
    const led: string[] = [];
    const missing: string[] = [];
    for (const name of names) {
      let resolved;
      try {
        resolved = await resolver.resolve(name);
      } catch {
        continue; // an unavailable empty contributor shell
      }
      if (!resolved.agents.some(agent => LEADS.includes(agent.replace(/\.md$/, '')))) continue;
      led.push(name);
      if (!resolved.skills.includes('grill-me')) missing.push(name);
    }
    expect(led.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});

describe('the record of the decision', () => {
  it('is ADR 0084, with the rule word for word', () => {
    const adr = fs.readdirSync('docs/adr').find(name => name.startsWith('0084-'));
    expect(adr).toBeDefined();
    expect(fs.readFileSync(`docs/adr/${adr}`, 'utf8')).toContain(RULE);
  });
});
