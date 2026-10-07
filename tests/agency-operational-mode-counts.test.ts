import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The operational mode of the digital-agency lead counts six required integrations (Plan 035 N1, slice 0, 2026-10-07).
 *
 * The maintainer took MarkItDown and Stitch out of the Fully Operational list. The suite stays eight servers (the bundle declares them and the lead can use
 * them), but the mode needs GitHub, Firecrawl, Context7, Playwright, Chrome DevTools and Figma; the other two are optional extras that the lead names under
 * Connected when it can call them and never as missing. The edit first reached two lines of the canonical agent and left "the 8 canonical agency MCPs" above a
 * list of six, a list of eight in the tier envelope and "all eight" in the Claude body. These tests pin every place that counts them, so that they agree.
 *
 * `registry/bundles.json` keeps its eight `requiredMcps` on purpose: it is the install prerequisite list that the doctor and `agents list` read, a different
 * layer from the mode the lead reports.
 */

const read = (relative: string): string => fs.readFileSync(path.resolve(relative), 'utf8').replace(/\r\n/g, '\n');

const between = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start + from.length);
  return start >= 0 && end > start ? text.slice(start, end) : '';
};

const REQUIRED = ['GitHub', 'Firecrawl', 'Context7', 'Playwright', 'Chrome DevTools', 'Figma'];
const REQUIRED_IDS = ['github', 'firecrawl', 'context7', 'playwright', 'chrome-devtools-mcp', 'figma'];
const REQUIRED_LIST = REQUIRED.join(', ');
const REQUIRED_ID_LIST = REQUIRED_IDS.map(id => `\`${id}\``).join(', ');
const EXTRAS_SENTENCE = 'MarkItDown and Stitch are optional extras';

const CANONICAL = read('registry/agents/orchestrator-digital-agency.md');
const WITH_SERVERS = between(CANONICAL, '**If `<mcp_servers>` is present', '**If `<mcp_servers>` is NOT present');
const WITHOUT_SERVERS = between(CANONICAL, '**If `<mcp_servers>` is NOT present', '2. You MUST format');
const NOTE = CANONICAL.split('\n').find(line => line.startsWith('*(Note: You must ONLY output')) ?? '';
const ENVELOPE = CANONICAL.split('\n').find(line => line.startsWith('   - **Fully Operational**: Uses authenticated MCP servers')) ?? '';

const CLAUDE_LEAD = read('registry/hosts/claude/agents/orchestrator-digital-agency.md');
const AFTER_FLOOR = CLAUDE_LEAD.split('<!-- agents-united:floor:end -->')[1] ?? '';

describe('the canonical lead cross-checks six required integrations', () => {
  it('finds the two greeting branches and the two lines it checks, so that no test below passes on an empty match', () => {
    expect(WITH_SERVERS).not.toBe('');
    expect(WITHOUT_SERVERS).not.toBe('');
    expect(NOTE).not.toBe('');
    expect(ENVELOPE).not.toBe('');
  });

  it('names the six required agency MCPs where Claude Code, Cursor, Cline and the others cross-check, and says no count of eight', () => {
    expect(WITHOUT_SERVERS).toContain(`against the 6 required agency MCPs: ${REQUIRED_LIST}.`);
    expect(CANONICAL).not.toMatch(/\b(8|eight) canonical\b/i);
  });

  it('names the same six where a host lists `<mcp_servers>` (Antigravity)', () => {
    expect(WITH_SERVERS).toContain(`Required agency MCPs (${REQUIRED_LIST}) completely absent from \`<mcp_servers>\``);
    expect(WITH_SERVERS).not.toContain('Prerequisite bundle tools');
  });

  it('names the same six in the note on Fully Operational', () => {
    expect(NOTE).toContain(`EVERY SINGLE tool in the required list (${REQUIRED_LIST})`);
    expect(NOTE).toContain(EXTRAS_SENTENCE);
  });

  it('says in both greeting branches that MarkItDown and Stitch are optional extras that are never missing', () => {
    expect(WITH_SERVERS).toContain(`${EXTRAS_SENTENCE}: list them under Connected when they have callable tools`);
    expect(WITHOUT_SERVERS).toContain(`${EXTRAS_SENTENCE}: list them under Connected when you can actively call them`);
    expect(WITH_SERVERS).toMatch(/never mark them as Missing/);
    expect(WITHOUT_SERVERS).toMatch(/never mark them as Missing/);
  });

  it('lists the six servers in the Fully Operational tier and the two extras as extras', () => {
    const requiredPart = ENVELOPE.split('with valid API tokens')[0];
    expect(requiredPart).toContain(`(${REQUIRED_ID_LIST})`);
    expect(requiredPart).not.toMatch(/markitdown|stitch/);
    expect(ENVELOPE).toContain('`markitdown` and `stitch` are optional extras: reported under Connected when callable, never counted for the mode');
  });

  it('keeps all eight servers declared for the lead to use', () => {
    const frontmatter = CANONICAL.split('\n---\n')[0];
    for (const server of [...REQUIRED_IDS, 'markitdown', 'stitch']) expect(frontmatter).toContain(`- name: ${server}`);
  });
});

describe('the Claude lead reports the same six', () => {
  it('lists the six required integrations in the first answer and asks for the mode only when all six are callable', () => {
    expect(AFTER_FLOOR).toContain(`which of the six required integrations (${REQUIRED_LIST}) you can actually call`);
    expect(AFTER_FLOOR).toContain('Say **Fully Operational** only when all six are callable; otherwise say **Limited Operational** and name the missing ones.');
  });

  it('treats MarkItDown and Stitch as extras that are named when callable, never as missing and never counted', () => {
    expect(AFTER_FLOOR).toContain(`${EXTRAS_SENTENCE}: name them as connected when you can call them, never as missing, and never count them toward the mode.`);
  });

  it('no longer counts eight', () => {
    expect(AFTER_FLOOR).not.toMatch(/all eight|eight integrations/i);
  });
});

describe('the documents that count the integrations agree with the lead', () => {
  it('README: the Fully Operational row needs the six, and names the two as optional extras', () => {
    const row = read('README.md').split('\n').find(line => line.startsWith('| **🚀 Fully Operational**')) ?? '';
    expect(row).not.toBe('');
    const required = row.split(';')[0];
    expect(required).toContain(`(${REQUIRED_ID_LIST}`);
    expect(required).not.toMatch(/markitdown|stitch/);
    expect(row).toContain('`markitdown` and `stitch` are optional extras');
  });

  it('CONTEXT.md: the suite is eight servers of which six are required, and the first tier needs the required ones', () => {
    const context = read('CONTEXT.md');
    const term = between(context, '**Canonical Agency MCP Suite**:', '**Multimodal Asset Inlining');
    expect(term).not.toBe('');
    expect(term).toMatch(/The 8 canonical Model Context Protocol tool servers/);
    expect(term).toMatch(/Six are \*\*required\*\* for the lead's Fully Operational mode/);
    expect(term).toMatch(/`markitdown` and `stitch` are \*\*optional extras\*\*/);
    const tier = between(context, '- **1. Fully Operational Mode (Authenticated MCP)**', '- **2. Limited Operational Mode');
    expect(tier).not.toBe('');
    expect(tier).toContain('All required MCP servers');
    expect(tier).not.toContain('All prerequisite MCP servers');
  });

  it('live-test protocol: the H6 prompt and its isolation note count the six, and the amendment is dated', () => {
    const protocol = read('docs/live-test-protocol.md');
    expect(protocol).toContain('which of the six required integrations are callable');
    expect(protocol).not.toMatch(/which of the eight integrations/);
    expect(protocol).not.toMatch(/four of eight/);
    expect(protocol).toMatch(/Amended 2026-10-07 \(Plan 035 N1\)/);
  });
});
