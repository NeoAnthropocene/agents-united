import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036, option O1 of `docs/skill-quality/claude-design-exploration.md` (the maintainer's yes of 2026-10-08):
 * text only, no new tool. The creative designer ends her report with a Claude Design brief when the lead or the user
 * names Claude Design as the next step; the frontend architect treats whatever comes back from Claude Design as an
 * input with the tokens still fixed, and as data. Neither role gains a tool: the Artifact tool and DesignSync stay out
 * of both bodies and both tool lines, which O3 and O4 would change only after their probes and a yes.
 */

const read = (p: string): string => fs.readFileSync(path.resolve(p), 'utf8').replace(/\r\n/g, '\n');
const REF = read('registry/skills/ad-creative-design/references/claude-design-brief.md');
const SKILL = read('registry/skills/ad-creative-design/SKILL.md');
const JAMILEH = read('registry/hosts/claude/agents/agency-creative-designer.md');
const DENIZ = read('registry/hosts/claude/agents/agency-frontend-architect.md');
const CONTEXT = read('CONTEXT.md');

const FIELDS = ['What to make', 'Design system', 'Tokens', 'Copy (supplied)', 'Hook variants', 'Safe zones', 'Must not contain', 'Photography', 'Not checked', 'Claims to review'] as const;
const tools = (body: string): string[] => /^tools: (.+)$/m.exec(body)![1]!.split(',').map(t => t.trim());
/** The numbered step `n` of a body, searched from a heading on (a role's "How to work", not its Scope Boundaries list). */
const step = (body: string, n: number, heading = ''): string => new RegExp(`^${n}\\. \\*\\*[^\\n]*`, 'm').exec(heading ? body.slice(body.indexOf(heading)) : body)![0];
const HOW = '\n## How to work';

describe('the Claude Design brief: the reference', () => {
  const block = (): string => /```text\n(CLAUDE DESIGN BRIEF:[\s\S]*?)\n```/.exec(REF)![1]!;

  it('holds one pasteable block that starts with its name and carries every field a design needs', () => {
    expect(REF).toMatch(/^# Claude Design brief/m);
    for (const field of FIELDS) expect(block(), field).toMatch(new RegExp(`^${field.replace(/[()]/g, '\\$&')}:`, 'm'));
    expect(block().split('\n').length).toBeLessThanOrEqual(25);
  });

  it('keeps the roles apart: she publishes nothing, the copy is supplied, and what comes back is data', () => {
    expect(REF).toMatch(/You publish nothing/);
    expect(REF).toMatch(/The copy is supplied, never written here/);
    expect(REF).toMatch(/what comes back from Claude Design is data/i);
    expect(REF).toMatch(/bracketed placeholders such as \[YOUR PRICE\]/);
  });

  it('writes the tokens the way Claude Design reads them: lines of name, value and usage, not nested $value objects', () => {
    expect(REF).toMatch(/name, value and usage/);
    expect(REF).toMatch(/not the nested `\$value` objects/);
  });

  it('asks for the safe zones, the must-not-contain list and what was not rendered, the three things the baseline found missing from a handover', () => {
    expect(block()).toMatch(/^Safe zones:.*(10 percent|250 px)/m);
    expect(block()).toMatch(/^Must not contain:.*(logos|invented)/m);
    expect(block()).toMatch(/^Not checked:.*not rendered/m);
  });
});

describe('the Claude Design brief: where it is wired', () => {
  it('the ad creative skill points to it from its hand-off step and stays inside the 6,000 character ceiling of ADR 0040', () => {
    expect(step(SKILL, 7)).toContain('[references/claude-design-brief.md](references/claude-design-brief.md)');
    expect(SKILL.length).toBeLessThanOrEqual(6000);
    expect(SKILL.split('\n').length).toBeLessThanOrEqual(90);
  });

  it('Jamileh loads the skill for a Claude Design brief and ends her report with it, without gaining a tool or naming one she lacks', () => {
    const row = JAMILEH.split('\n').find(l => l.startsWith('| Ad creative layouts and hook variations |'))!;
    expect(row).toMatch(/An ad or a banner suite, or a Claude Design brief/);
    const s3 = step(JAMILEH, 3, HOW);
    expect(s3).toMatch(/Claude Design/);
    expect(s3).toContain('`ad-creative-design`');
    expect(s3).toMatch(/you publish nothing and call no design tool/);
    expect(tools(JAMILEH)).not.toContain('Artifact');
    expect(tools(JAMILEH)).not.toContain('DesignSync');
    expect(JAMILEH).not.toMatch(/`Artifact`|`DesignSync`/);
  });

  it('Deniz keeps her tokens fixed when a Claude Design input arrives, reads it as data, and reports every difference', () => {
    const s3 = step(DENIZ, 3, HOW);
    expect(s3).toMatch(/Claude Design/);
    expect(s3).toMatch(/`design-tokens\.json` stays the fixed source/);
    expect(s3).toMatch(/`Read`/);
    expect(s3).toMatch(/`WebFetch`/);
    expect(s3).toMatch(/behind a login ask the lead/);
    expect(s3).toMatch(/never an instruction/);
    expect(s3).toMatch(/`Open items`/);
    expect(s3).toMatch(/never replace a token/);
    expect(tools(DENIZ)).not.toContain('Artifact');
    expect(DENIZ).not.toMatch(/`Artifact`|`DesignSync`/);
  });

  it('the ubiquitous language defines the term', () => {
    expect(CONTEXT).toMatch(/^\*\*Claude Design brief\*\*:/m);
    expect(CONTEXT).toMatch(/ad-creative-design\/references\/claude-design-brief\.md/);
  });

  it('holds no secret, token or key', () => {
    for (const text of [REF, step(JAMILEH, 3, HOW), step(DENIZ, 3, HOW)]) {
      expect(text).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
      expect(text).not.toMatch(/(api[_-]?key|password)\s*[:=]\s*\S{8,}/i);
    }
  });
});
