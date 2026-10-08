import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036, evidence document 2: `docs/skill-quality/claude-design-exploration.md`. It is a dated exploration that
 * proposes and builds nothing, so this suite pins what keeps it honest: every claim carries a status, it says what was
 * not done, it names its sources, it offers the options with a recommendation and two probes that wait for a yes, and
 * the few facts about this repository that its argument rests on still hold (the Artifact tool is catalogued for
 * subagents, neither designer holds it today, and her tokens are in the format the Design System type cannot read).
 */

const DOC = fs.readFileSync(path.resolve('docs/skill-quality/claude-design-exploration.md'), 'utf8').replace(/\r\n/g, '\n');
const read = (p: string): string => fs.readFileSync(path.resolve(p), 'utf8').replace(/\r\n/g, '\n');

function section(heading: string): string {
  const start = DOC.indexOf(`\n## ${heading}\n`);
  expect(start, `section ${heading}`).toBeGreaterThan(-1);
  const next = DOC.indexOf('\n## ', start + 5);
  return DOC.slice(start, next === -1 ? undefined : next);
}

describe('the Claude Design exploration: how far it goes', () => {
  it('says what was read and what was not done, with the three statuses defined', () => {
    expect(DOC).toMatch(/\*\*How far the evidence goes\.\*\*/);
    expect(DOC).toMatch(/\*\*Not done:\*\*[^\n]*no artifact was published/);
    expect(DOC).toMatch(/`DesignSync` was not called/);
    expect(DOC).toMatch(/no subagent was given the Artifact tool/);
    for (const status of ['verified', 'sourced', 'unverified']) expect(DOC).toContain(`**${status}**`);
  });

  it('has the sections of an evidence document, in order', () => {
    const headings = [...DOC.matchAll(/^## (.+)$/gm)].map(m => m[1]);
    expect(headings).toEqual([
      'What Claude Design is',
      'What an agent can do with it today',
      'Two facts that shape the fit',
      'Fit with the roles',
      'Options',
      'Probes proposed, not run',
      'Risks and cautions',
      'Not verified',
      'Sources',
    ]);
  });

  it('gives a status to every row of its two evidence tables', () => {
    for (const heading of ['What Claude Design is', 'What an agent can do with it today']) {
      const rows = section(heading).split('\n').filter(l => /^\| /.test(l) && !/^\|[-| ]+\|$/.test(l)).slice(1);
      expect(rows.length, heading).toBeGreaterThanOrEqual(4);
      for (const row of rows) expect(row, row.slice(0, 60)).toMatch(/\| (verified|sourced|unverified)[^|]*\|\s*$/i);
    }
  });
});

describe('the Claude Design exploration: what it proposes', () => {
  it('lists five options, recommends the cheap ones first, and asks for a yes before any grant', () => {
    const s = section('Options');
    for (const o of ['O1', 'O2', 'O3', 'O4', 'O5']) expect(s, o).toContain(`| ${o} |`);
    expect(s).toMatch(/\*\*Recommended:\*\* O1 now, O2 next/);
    expect(s).toMatch(/optional extra that is never required/);
  });

  it('proposes two probes with ceilings and does not run them', () => {
    const s = section('Probes proposed, not run');
    expect(s).toMatch(/\*\*P3/);
    expect(s).toMatch(/\*\*P4/);
    expect(s).toMatch(/Ceiling proposal: 1\.0 USD and 2 prompts/);
    expect(s).toMatch(/Ceiling proposal: 1\.5 USD and 2 prompts/);
    expect(s).toMatch(/needs his yes first/);
  });

  it('names the primary sources by address and says the third-party ones are not confirmed by Anthropic', () => {
    const s = section('Sources');
    for (const address of ['anthropic.com/news/claude-design-anthropic-labs', 'support.claude.com/en/articles/14604416-get-started-with-claude-design', 'code.claude.com/docs/en/artifacts']) expect(s, address).toContain(address);
    expect(s).toMatch(/not confirmed by Anthropic/);
  });
});

describe('the Claude Design exploration: the repository facts its argument rests on', () => {
  it('the tool policy catalogues Artifact for subagents, in the class the exploration names', () => {
    const policy = JSON.parse(read('registry/hosts/claude/tool-policy.json')) as { catalog: Array<{ name: string; class: string; subagents: string }> };
    const artifact = policy.catalog.find(t => t.name === 'Artifact');
    expect(artifact).toBeDefined();
    expect(artifact!.class).toBe('artifacts');
    expect(artifact!.subagents).toBe('available');
    expect(DOC).toMatch(/`artifacts` capability class/);
    expect(DOC).toMatch(/`subagents: available`/);
  });

  it('neither designer holds Artifact today, and both hold Stitch, as the exploration says', () => {
    const tools = (file: string): string[] => /^tools: (.+)$/m.exec(read(file))![1]!.split(',').map(t => t.trim());
    for (const file of ['registry/hosts/claude/agents/agency-creative-designer.md', 'registry/hosts/claude/agents/agency-frontend-architect.md', 'registry/hosts/claude/agents/frontend-architect.md']) {
      expect(tools(file), file).not.toContain('Artifact');
      expect(tools(file), file).toContain('mcp__stitch');
    }
    expect(tools('registry/hosts/claude/agents/agency-frontend-architect.md')).toContain('WebFetch');
  });

  it('her token skill writes the community format with $value, which the Design System type cannot read', () => {
    const skill = read('registry/skills/design-system-tokens/SKILL.md');
    expect(skill).toMatch(/community token format \(`\$value`, `\$type`/);
    expect(DOC).toMatch(/`\$value` and `\$type`/);
    expect(DOC).toMatch(/CANNOT read/);
  });

  it('holds no secret, token or key', () => {
    expect(DOC).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
    expect(DOC).not.toMatch(/\bghp_[A-Za-z0-9]{10,}/);
    expect(DOC).not.toMatch(/(api[_-]?key|password)\s*[:=]\s*\S{8,}/i);
  });
});
