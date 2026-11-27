import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { renderFloor } from '../src/core/native-floor.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * ADR 0084 (2026-11-27, the maintainer's choice after the live Sitting 1 of the Claude pilot): when a lead's final report leaves open
 * items that only the user can settle, the lead asks whether to settle them now or stop, and settling runs grill-me with those items as
 * its goal. "Every lead": the nine Tier-2 lead cores and their Claude native files. The agent-factory lead is the Plan 052 session's
 * area and is left out here. The rule sits in `invariants`, which no renderer copies, so each Claude lead binds it in an authored
 * section with one wording, and an Antigravity native lead must state it when it is written.
 */

const RULE =
  'When the final report leaves open items that only the user can settle, it ends by asking whether to settle them now or stop here; to settle them, grill-me runs with those items as its goal.';
const LEADS = ['business', 'design', 'digital-agency', 'engineering', 'marketing', 'research', 'security', 'system-architecture', 'universal'].map(
  lead => `orchestrator-${lead}`,
);
const SECTION = [
  '## Open items the user can settle',
  '',
  'When your final report leaves open items that only the user can settle (a choice, an approval, or a fact only they hold), end the report with one `AskUserQuestion`: settle them now, or stop here. Name those items in the question and leave out open items that belong to someone else, such as a decision for whoever builds the page later; when no open item needs the user, ask nothing. When the user chooses to settle them, run the Skill `grill-me` with those items as its goal, so that it starts from them and does not ask again what the session already settled. Then report what was settled, and send a change to a delivered file to the specialist that owns it, or note the change when the user says so.',
  '',
].join('\n');

const cores = await loadSemanticCore('registry');

describe('the open-items rule in the Semantic Core', () => {
  it.each(LEADS)('is an invariant of %s, exactly once', stem => {
    const core = cores.get(stem);
    expect(core, stem).toBeDefined();
    expect(core!.invariants.filter(invariant => invariant === RULE)).toHaveLength(1);
  });

  it('is stated by no other core, the agent-factory lead included', () => {
    const others = [...cores.entries()].filter(([stem, core]) => !LEADS.includes(stem) && core.invariants.includes(RULE)).map(([stem]) => stem);
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
  it.each(LEADS)('%s carries the section word for word, once, before the host boundaries', role => {
    const text = nativeText(role);
    expect(text.split(SECTION).length - 1, role).toBe(1);
    const at = text.indexOf(SECTION);
    const boundaries = text.indexOf('## Boundaries of this host');
    expect(boundaries, role).toBeGreaterThan(at);
    expect(text.slice(at + SECTION.length, boundaries).trim(), role).toBe('');
  });

  it.each(LEADS)('%s holds the tools the section names', role => {
    const tools = nativeText(role).match(/^tools: (.*)$/m)?.[1] ?? '';
    const names = tools.split(/,\s*(?![^()]*\))/).map(name => name.trim());
    expect(names, role).toContain('AskUserQuestion');
    expect(names, role).toContain('Skill');
  });

  it('every bundle led by one of these leads installs grill-me', () => {
    const bundles = JSON.parse(fs.readFileSync('registry/bundles.json', 'utf8')).bundles as Record<
      string,
      { orchestrator?: string; skills?: string[]; parentBundle?: string }
    >;
    const skillsOf = (id: string): Set<string> => {
      const bundle = bundles[id];
      const own = new Set(bundle.skills ?? []);
      if (bundle.parentBundle && bundles[bundle.parentBundle]) for (const skill of skillsOf(bundle.parentBundle)) own.add(skill);
      return own;
    };
    const led = Object.entries(bundles).filter(([, bundle]) => LEADS.includes(String(bundle.orchestrator ?? '').replace(/\.md$/, '')));
    expect(led.length).toBeGreaterThan(0);
    const missing = led.filter(([id]) => !skillsOf(id).has('grill-me')).map(([id]) => id);
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
