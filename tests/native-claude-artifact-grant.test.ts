import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFloor } from '../src/core/native-floor.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { NATIVE_ROLES, nativeText } from './helpers/native-roles.js';

/**
 * Plan 036 S12 and ADR 0047: the creative designer holds the `Artifact` tool, and no other native role does. The tool is the
 * capability class `artifacts` of her Semantic Core, so her `tools:` line follows from the class (regenerated with
 * `UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts`); one safety line of the floor says what leaves the project;
 * her authored body says when she may publish and what she does without the tool; the lead offers publishing as an optional extra and
 * asks the user's go-ahead for each publish; and the lead's roster says which role can publish.
 */

const tools = (role: string): string[] => /^tools: (.*)$/m.exec(nativeText(role))![1]!.split(',').map(t => t.trim());
const authored = (role: string): string => nativeText(role).split('<!-- agents-united:floor:end -->')[1] ?? '';
const HER = 'agency-creative-designer';
const HER_STEM = 'subagent-marketing-creative-designer';
const LEAD = 'orchestrator-digital-agency';

describe('the grant: one role holds Artifact', () => {
  it('has the artifacts class in her core, and in no other native role\'s core', async () => {
    const cores = await loadSemanticCore('registry');
    for (const stem of new Set(NATIVE_ROLES.map(r => r.stem))) {
      const has = (cores.get(stem)!.capabilities ?? []).includes('artifacts');
      expect(has, stem).toBe(stem === HER_STEM);
    }
  });

  it('has Artifact in her tools line, and in no other native role\'s', () => {
    for (const { role } of NATIVE_ROLES) expect(tools(role).includes('Artifact'), role).toBe(role === HER);
  });

  it('keeps her other tools as they were: no shell, no delegation, the editors and the connected servers', () => {
    const held = tools(HER);
    for (const forbidden of ['Bash', 'PowerShell', 'Agent', 'Workflow', 'CronCreate']) expect(held, forbidden).not.toContain(forbidden);
    for (const needed of ['Edit', 'Write', 'Read', 'Glob', 'Grep', 'Skill', 'SendMessage', 'mcp__figma', 'mcp__stitch']) expect(held, needed).toContain(needed);
  });
});

describe('the floor: what leaves the project', () => {
  it('says in one line, named for the option the user sees (Publish Artifact), that she publishes only when asked, keeps it private and leaves sharing to the user', async () => {
    const core = (await loadSemanticCore('registry')).get(HER_STEM)!;
    const bullet = core.safety.split('\n').find(l => /Publish Artifact/.test(l)) ?? '';
    expect(bullet).not.toBe('');
    expect(bullet.trim()).toMatch(/^- \*\*Publish Artifact\*\*: /);
    expect(bullet).toMatch(/only when the user asked for it/);
    expect(bullet).toMatch(/private/);
    expect(bullet).toMatch(/leave who can see it to the user/);
    expect(bullet).toMatch(/client material has left the project/);
    expect(bullet).not.toMatch(/`Artifact`|Claude Design/);
    expect(core.safety).not.toMatch(/Opt-In Publishing/);
    expect(core.safety.trim()).toMatch(/\.$/);
  });

  it('carries the three earlier safety lines unchanged, and the generated block of her role is exactly the core\'s', async () => {
    const core = (await loadSemanticCore('registry')).get(HER_STEM)!;
    for (const earlier of ['Zero Deceptive Advertising', 'Accessibility & Contrast', 'Safe Zone Adherence']) expect(core.safety, earlier).toContain(earlier);
    expect(checkFloor(nativeText(HER), core)).toEqual([]);
  });
});

describe('her authored body and the lead\'s', () => {
  it('tells her when she may publish, that it is private, what the tool needs and what she does without it', () => {
    const body = authored(HER);
    expect(body).toMatch(/publish to Claude Design only when the user asks/);
    expect(body).toMatch(/\*\*Publish Artifact\*\*/);
    expect(body).toMatch(/private/);
    expect(body).toMatch(/Pro or higher plan/);
    expect(body).toMatch(/write the files/);
    expect(body).toMatch(/`design-artifact-publishing`/);
  });

  it('has the lead offer publishing as an optional extra, as the option Publish Artifact with its explanation, with the user\'s go-ahead for each publish, and name no tool it does not hold', () => {
    const body = authored(LEAD);
    expect(body).toMatch(/Publishing to Claude Design is an optional extra/);
    expect(body).toMatch(/never by default/);
    expect(body).toMatch(/go-ahead for each publish/);
    expect(body).toMatch(/`AskUserQuestion`/);
    expect(body).toMatch(/option \*\*Publish Artifact\*\*/);
    expect(body).toMatch(/\*\*Keep it in the project\*\*/);
    // the explanation that goes into the option's description: where it goes, who sees it, what it needs, what leaves the project
    expect(body).toMatch(/private page on your claude\.ai account/);
    expect(body).toMatch(/Pro or higher plan/);
    expect(body).toMatch(/signed-in Claude Code/);
    expect(body).toMatch(/unless you share it/);
    expect(body).toMatch(/Anthropic-hosted page/);
    expect(body).not.toMatch(/`Artifact`/);
  });

  it('has the lead\'s roster say which role can publish', () => {
    const row = authored(LEAD).split('\n').find(l => l.startsWith('| `agency-creative-designer` |')) ?? '';
    expect(row).toMatch(/publishes pages/);
    const others = authored(LEAD).split('\n').filter(l => /^\| `agency-[a-z-]+` \|/.test(l) && !l.startsWith('| `agency-creative-designer` |'));
    expect(others.length).toBeGreaterThan(5);
    for (const line of others) expect(line, line.slice(0, 40)).not.toMatch(/publishes pages/);
  });
});

describe('the state of the record', () => {
  it('has the ADR say the grant is built, and the plan mark S12 as done', () => {
    const adr = fs.readdirSync(path.resolve('docs/adr')).find(f => /^0047-.*\.md$/.test(f))!;
    const text = fs.readFileSync(path.resolve('docs/adr', adr), 'utf8').replace(/\r\n/g, '\n');
    expect(text).toMatch(/The grant is built \(Plan 036 S12\)/);
    const plan = fs.readFileSync(path.resolve('plans/036-claude-creative-designer-improvement.md'), 'utf8').replace(/\r\n/g, '\n');
    const s12 = plan.split('\n').find(l => /^\| S12 \|/.test(l)) ?? '';
    expect(s12).toMatch(/in review|done/);
  });
});
