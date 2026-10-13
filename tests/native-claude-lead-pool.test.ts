import fs from 'node:fs';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import { nativeText, NATIVE_AGENTS_DIR } from './helpers/native-roles.js';

/**
 * Sitting T (2026-10-12, Claude Code 2.1.296): the digital-agency lead could never find the image server's tool, however often the maintainer restarted. Its `tools` is an allowlist,
 * the session's tool pool was cut to it (the session had five servers connected, three of them outside the allowlist, and the pool held tools of two), and Jamileh, a teammate with
 * `mcp__image-gen__generate_image` in her own `tools`, searched the same pool and found nothing. The host says why: "Subagents inherit the built-in tools and MCP tools available in
 * the main conversation" (host-library/claude/pages/agent/sub-agents.md, "Available tools"), and a subagent's `tools` is resolved against that pool, so a role cannot hold an MCP
 * tool that the coordinator which spawns it does not hold. The image route was written (S19) and tested only with Jamileh as the main agent, where her own allowlist is the pool.
 * This suite pins the rule for every coordinator: each MCP tool a role it may spawn holds is covered by the coordinator's own `tools`.
 */

const frontmatter = (role: string): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(nativeText(role))![1]!);
const split = (list: string): string[] => list.split(/,\s*(?![^()]*\))/).map(t => t.trim()).filter(Boolean);
const toolsOf = (role: string): string[] => split(String(frontmatter(role).tools));
const spawnable = (role: string): string[] => {
  const entry = toolsOf(role).find(t => t.startsWith('Agent('));
  return entry ? entry.slice('Agent('.length, -1).split(',').map(r => r.trim()).filter(Boolean) : [];
};
const exists = (role: string): boolean => fs.existsSync(`${NATIVE_AGENTS_DIR}/${role}.md`);
/**
 * Gaps that exist and are NOT closed here, so that the suite states them instead of hiding them: closing one widens a coordinator (here, the engineering lead would hold Stitch), which is the maintainer's call.
 * Found by this suite on 2026-10-12: `frontend-architect` holds `mcp__stitch` and its coordinator `orchestrator-engineering` does not, so a `frontend-architect` spawned by it never gets Stitch.
 */
const KNOWN_GAPS: Record<string, string[]> = {
  'orchestrator-engineering': ['frontend-architect: mcp__stitch'],
};
/** A coordinator's entry covers a role's entry when it is the same, or it names the whole server (`mcp__github` covers `mcp__github__search_code`). */
const covers = (held: string[], wanted: string): boolean => held.some(h => h === wanted || wanted.startsWith(`${h}__`));

describe('the pool of a coordinator: a teammate gets the MCP tools of the main conversation', () => {
  for (const lead of ['orchestrator-digital-agency', 'orchestrator-engineering']) {
    it(`${lead} holds every MCP tool that a role it may spawn holds`, () => {
      const roles = spawnable(lead).filter(exists);
      expect(roles.length, `the roles ${lead} may spawn that have a native file`).toBeGreaterThan(2);
      const held = toolsOf(lead).filter(t => t.startsWith('mcp__'));
      const missing: string[] = [];
      for (const role of roles) {
        for (const tool of toolsOf(role).filter(t => t.startsWith('mcp__'))) if (!covers(held, tool)) missing.push(`${role}: ${tool}`);
      }
      expect(missing, `MCP tools that a spawned role holds and ${lead} does not, so that the role never gets them`).toEqual(KNOWN_GAPS[lead] ?? []);
    });
  }

  it('names the image tool in the lead, and as the one tool and not the server', () => {
    const held = toolsOf('orchestrator-digital-agency');
    expect(held).toContain('mcp__image-gen__generate_image');
    expect(held).not.toContain('mcp__image-gen');
  });
});
