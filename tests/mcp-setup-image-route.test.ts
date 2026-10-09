import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S18: the install route of the optional image server. The maintainer chose Gemini through their own Google AI Studio key (2026-10-08). The rule of
 * every credentialed server in `mcp-setup` holds: the lead prints the command with a placeholder and the user runs it in their own terminal; the key is never
 * asked for in the chat and never written to a file. The package is pinned to a release old enough to have been seen by others, and the section says what was
 * read for the pin and what was not run. The server is an optional extra: it is not in the required list, so the doctor, the install gate and the Antigravity
 * MCP sync do not move.
 */

const SKILL_DIR = path.resolve('registry/skills/mcp-setup');
const read = (rel: string): string => fs.readFileSync(path.join(SKILL_DIR, rel), 'utf8').replace(/\r\n/g, '\n');
const COMMAND =
  'claude mcp add --scope local image-gen --env GEMINI_API_KEY=<your-ai-studio-key> --env IMAGE_PROVIDER=gemini --env SKIP_PROMPT_ENHANCEMENT=true --env IMAGE_OUTPUT_DIR=<absolute path of the project>/assets/generated -- npx -y mcp-image@0.14.0';

const section = (): string => {
  const text = read('references/claude-code.md');
  const start = text.indexOf('\n## Photographic images: the optional `image-gen` server\n');
  expect(start, 'the section exists').toBeGreaterThan(-1);
  const next = text.indexOf('\n## ', start + 5);
  return text.slice(start, next === -1 ? undefined : next);
};

describe('mcp-setup: the optional image server', () => {
  it('prints one command with placeholders, in the local scope, with the `--` and the pinned package', () => {
    const s = section();
    expect(s).toContain(COMMAND);
    expect(s).toMatch(/```bash\n[^`]*image-gen[^`]*```/);
    expect(s).not.toMatch(/npx -y mcp-image(?!@0\.14\.0)/);
    expect(s).not.toMatch(/@latest/);
  });

  it('holds no key, no key shape and no value for the key variable', () => {
    for (const text of [read('references/claude-code.md'), read('SKILL.md')]) {
      expect(text).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      for (const m of text.matchAll(/GEMINI_API_KEY\s*[=:]\s*['"]?([^\s'"`]+)/g)) expect(m[1], 'GEMINI_API_KEY value').toMatch(/^<[a-z -]+>$/);
    }
  });

  it('is an optional extra the lead offers and the user runs: never in the required list, never run by the lead, never a key in the chat', () => {
    const s = section();
    expect(s).toMatch(/optional extra/i);
    expect(s).toMatch(/never part of the required list|not in the required list/i);
    expect(s).toMatch(/The lead never runs it/);
    expect(s).toMatch(/never asks for the key in the chat/);
    expect(s).toMatch(/in their own terminal/);
    expect(s).toMatch(/shared with the team|stays out of the shared file/);
  });

  it('names the server `image-gen` exactly, because the role grant names it, and the one tool', () => {
    const s = section();
    expect(s).toMatch(/must be named `image-gen`/);
    expect(s).toContain('mcp__image-gen__generate_image');
  });

  it('says why this version: the newest release older than two weeks on the day, what was read, what was not run, and the pin refresh', () => {
    const s = section();
    expect(s).toContain('`mcp-image@0.14.0`');
    expect(s).toMatch(/published 2026-09-08/);
    expect(s).toMatch(/older than two weeks/);
    expect(s).toMatch(/MIT/);
    expect(s).toMatch(/no install script/i);
    expect(s).toMatch(/no npm provenance/i);
    expect(s).toMatch(/Node 22/);
    expect(s).toMatch(/Read, not run/);
    expect(s).toMatch(/Not run here/);
    expect(s).toContain('npm view mcp-image');
  });

  it('says what the server reads, writes and sends, and what each setting in the command is for', () => {
    const s = section();
    expect(s).toMatch(/Google/);
    expect(s).toContain('IMAGE_OUTPUT_DIR');
    expect(s).toMatch(/overwrites/);
    expect(s).toMatch(/creates the folder/);
    expect(s).toMatch(/input image/i);
    expect(s).toContain('SKIP_PROMPT_ENHANCEMENT=true');
    expect(s).toContain('IMAGE_PROVIDER=gemini');
    expect(s).toMatch(/inside the project/);
    expect(s).toMatch(/cannot move a file|holds no shell/);
  });

  it('says what it costs and who pays, and points to the skill that holds the table', () => {
    const s = section();
    expect(s).toMatch(/no free tier/i);
    expect(s).toMatch(/billing/i);
    expect(s).toMatch(/budget/i);
    expect(s).toContain('image-creation');
    expect(s).toContain('references/server-and-cost.md');
  });

  it('checks the install with ToolSearch, says the restart applies, and gives the undo with the revoke', () => {
    const s = section();
    expect(s).toContain('claude mcp get image-gen');
    expect(s).toContain('ToolSearch');
    expect(s).toMatch(/restart/i);
    expect(s).toContain('claude mcp remove image-gen --scope local');
    expect(s).toMatch(/revoke the key/i);
  });

  it('is pointed to from the Claude Code step of the runbook, and the credentialed commands above it are untouched', () => {
    const skill = read('SKILL.md');
    const phase3 = skill.slice(skill.indexOf('### Phase 3'));
    expect(phase3).toContain('image-gen');
    expect(phase3).toContain('references/claude-code.md');
    expect(read('references/claude-code.md')).toContain('claude mcp add --scope local firecrawl --env FIRECRAWL_API_KEY=<your-api-key> -- npx -y firecrawl-mcp@3.27.3');
  });
});
