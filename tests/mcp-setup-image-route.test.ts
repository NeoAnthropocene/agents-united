import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S18 and its amendment of 2026-10-09: the install route of the optional image server. The maintainer chose Gemini through their own Google AI
 * Studio key (2026-10-08), then asked for the latest tag of the package and for the other providers to be wired (2026-10-09). The rule of every credentialed
 * server in `mcp-setup` holds: the lead prints the command with placeholders and the user runs it in their own terminal; no key is asked for in the chat or
 * written to a file. The package is pinned to the NUMBER the `latest` tag pointed to on the day (a floating tag would run unread code with the user's keys),
 * and the section says what was read for the pin and what was not run. The server is an optional extra: it is not in the required list, so the doctor, the
 * install gate and the Antigravity MCP sync do not move.
 */

const SKILL_DIR = path.resolve('registry/skills/mcp-setup');
const read = (rel: string): string => fs.readFileSync(path.join(SKILL_DIR, rel), 'utf8').replace(/\r\n/g, '\n');
const VERSION = '0.18.0';
const COMMAND = `claude mcp add --scope local image-gen --env GEMINI_API_KEY=<your-ai-studio-key> --env IMAGE_PROVIDER=gemini --env SKIP_PROMPT_ENHANCEMENT=true --env IMAGE_OUTPUT_DIR=<absolute path of the project>/assets/generated -- npx -y mcp-image@${VERSION}`;

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
    expect(s).not.toMatch(/npx -y mcp-image(?!@0\.18\.0)/);
    expect(s).not.toMatch(/mcp-image@latest/);
  });

  it('adds a provider by adding one key pair, and says which key each provider needs, where to get it and what it must have', () => {
    const s = section();
    expect(s).toContain('--env OPENAI_API_KEY=<your-openai-key>');
    expect(s).toContain('--env ARK_API_KEY=<your-byteplus-ark-key>');
    expect(s).toMatch(/one key pair for each other provider|add one `--env` pair for each other provider/i);
    expect(s).toContain('IMAGE_PROVIDER');
    expect(s).toMatch(/a provider without its key|names a provider whose key is not set/i);
    for (const where of ['aistudio.google.com/apikey', 'platform.openai.com/api-keys', 'console.byteplus.com']) expect(s, where).toContain(where);
    expect(s).toMatch(/organization verification|verified organization|verification/i);
    expect(s).toMatch(/ap-southeast-1|AP region/);
    expect(s).toMatch(/billing/i);
  });

  // The maintainer, 2026-10-13: Gemini is the only provider whose key they hold, and the user must be able to choose the others. A user with one key of another provider needs a command to print, not a
  // rule to apply to the Gemini one. The wiring of both commands was checked with the server itself on 2026-10-13 (made-up keys, no image): see the observation of the same day.
  it('prints a command for a user who has the key of one other provider only (OpenAI, or Seedream): its own key pair, its own IMAGE_PROVIDER, the key of no other provider', () => {
    const s = section();
    const PAIR = { gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY', seedream: 'ARK_API_KEY' } as const;
    const commands = [...s.matchAll(/```bash\n([^`]*?)```/g)].flatMap(m => m[1]!.trim().split('\n').filter(l => l.startsWith('claude mcp add')));

    expect(commands.map(c => /--env IMAGE_PROVIDER=(\w+)/.exec(c)?.[1])).toEqual(['gemini', 'openai', 'seedream']);
    for (const command of commands) {
      const provider = /--env IMAGE_PROVIDER=(\w+)/.exec(command)![1] as keyof typeof PAIR;
      const keys = Object.values(PAIR).filter(key => command.includes(`--env ${key}=<`));
      expect(keys, command).toEqual([PAIR[provider]]);
      expect(command, command).toMatch(/^claude mcp add --scope local image-gen --env \w+=<[a-z -]+> --env IMAGE_PROVIDER=\w+ --env SKIP_PROMPT_ENHANCEMENT=true --env IMAGE_OUTPUT_DIR=<absolute path of the project>\/assets\/generated -- npx -y mcp-image@0\.18\.0$/);
    }
    expect(commands[1]).toContain('--env OPENAI_API_KEY=<your-openai-key>');
    expect(commands[2]).toContain('--env ARK_API_KEY=<your-byteplus-ark-key>');
    expect(s).toMatch(/started and called on 2026-10-13 with a made-up key/);
    expect(s).toContain('2026-10-13-mcp-image-0.18.0-provider-wiring-smoke.md');
    expect(s).toMatch(/No image was made with OpenAI or Seedream/);
  });

  // Sitting X, 2026-10-13: the lead printed the command with no folder. The maintainer ran it in the folder a terminal opens in (their home folder), where Claude Code stored the server under that
  // folder's entry, so the session started in the project listed nothing; only the second run, after a cd into the project folder, showed `image-gen` Connected there.
  it('starts every printed command with a cd into the project folder and says why: a --scope local server belongs to the folder it is added from, and a terminal opens in the home folder (Sitting X)', () => {
    const s = section();
    const blocks = [...s.matchAll(/```bash\n([^`]*?)```/g)].map(m => m[1]!.trim()).filter(b => b.includes('claude mcp add'));
    expect(blocks).toHaveLength(3);
    for (const block of blocks) expect(block.split('\n')[0], block).toBe('cd <absolute path of the project>');
    expect(s).toMatch(/\*\*Run it in the project folder\.\*\*/);
    expect(s).toMatch(/belongs to the folder it is added from/);
    expect(s).toMatch(/home folder/);
    expect(s).toMatch(/the folder the team is started in/);
    expect(s).toMatch(/`claude mcp list` from that folder/);
    expect(s).toMatch(/wrong folder[^.]*`claude mcp remove image-gen --scope local`/);
    expect(s).toMatch(/Sitting X/);
  });

  it('holds no key, no key shape and no value for any key variable', () => {
    for (const text of [read('references/claude-code.md'), read('SKILL.md')]) {
      expect(text).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(text).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      for (const m of text.matchAll(/(GEMINI|OPENAI|ARK)_API_KEY\s*[=:]\s*['"]?([^\s'"`]+)/g)) expect(m[2], `${m[1]}_API_KEY value`).toMatch(/^<[a-z -]+>$/);
    }
  });

  it('is an optional extra the lead offers and the user runs: never in the required list, never run by the lead, never a key in the chat', () => {
    const s = section();
    expect(s).toMatch(/optional extra/i);
    expect(s).toMatch(/never part of the required list|not in the required list/i);
    expect(s).toMatch(/The lead never runs it/);
    expect(s).toMatch(/never asks for a key in the chat|never asks for the key in the chat/);
    expect(s).toMatch(/in their own terminal/);
    expect(s).toMatch(/shared with the team|stays out of the shared file/);
  });

  it('names the server `image-gen` exactly, because the role grant names it, and the one tool', () => {
    const s = section();
    expect(s).toMatch(/must be named `image-gen`/);
    expect(s).toContain('mcp__image-gen__generate_image');
  });

  it('says why this version: the number the latest tag pointed to, pinned to the number and not to the tag, what was read (the diff against 0.14.0), what was not run, and the pin refresh', () => {
    const s = section();
    expect(s).toContain(`\`mcp-image@${VERSION}\``);
    expect(s).toMatch(/`latest` tag/);
    expect(s).toMatch(/2026-10-09/);
    expect(s).toMatch(/published 2026-10-08/);
    expect(s).toMatch(/pinned to the number|pinned to that number/i);
    expect(s).toMatch(/floating tag|unread release|runs? with (the user's )?keys?/i);
    expect(s).toMatch(/maintainer asked/i);
    expect(s).toMatch(/MIT/);
    expect(s).toMatch(/no install script/i);
    expect(s).toMatch(/no npm provenance/i);
    expect(s).toMatch(/Node 22/);
    expect(s).toMatch(/Read, not run/);
    expect(s).toMatch(/0\.14\.0/);
    expect(s).toMatch(/Not run here/);
    expect(s).toContain('npm view mcp-image');
  });

  it('says what the server reads, writes and sends, what it does not check, and what each setting in the command is for', () => {
    const s = section();
    expect(s).toMatch(/Google/);
    expect(s).toMatch(/OpenAI/);
    expect(s).toMatch(/BytePlus/);
    expect(s).toContain('IMAGE_OUTPUT_DIR');
    expect(s).toMatch(/overwrites/);
    expect(s).toMatch(/creates the folder/);
    expect(s).toMatch(/input images?/i);
    expect(s).toContain('SKIP_PROMPT_ENHANCEMENT=true');
    expect(s).toContain('IMAGE_PROVIDER=gemini');
    expect(s).toMatch(/inside the project/);
    expect(s).toMatch(/cannot move a file|holds no shell/);
    expect(s).toMatch(/no check that the path is inside the project/);
    expect(s).toMatch(/skills install/);
    expect(s).toContain('inputImagePaths');
  });

  it('says what it costs and who pays, and points to the skill that holds the table', () => {
    const s = section();
    expect(s).toMatch(/no free tier/i);
    expect(s).toMatch(/billing/i);
    expect(s).toMatch(/budget/i);
    expect(s).toMatch(/by token|per token/i);
    expect(s).toContain('image-generation');
    expect(s).toContain('references/providers.md');
  });

  it('checks the install with ToolSearch for a role that holds the tool, says the restart applies and that a local-scope server needs no approval, and gives the undo with the revoke', () => {
    const s = section();
    expect(s).toContain('claude mcp get image-gen');
    expect(s).toContain('ToolSearch');
    expect(s).toMatch(/restart/i);
    // Sitting T: the lead's allowlist hid the tool, so its search found nothing and the restarts were in vain; and no approval prompt belongs to a local server.
    expect(s).toMatch(/`ToolSearch` lists `mcp__image-gen__generate_image` for a role whose `tools` names it/);
    expect(s).toMatch(/the lead holds it so that the designer's pool has it/);
    expect(s).toMatch(/A role that does not hold it never lists it, whatever `claude mcp list` says/);
    expect(s).toMatch(/A `--scope local` server needs no approval/);
    expect(s).toContain('claude mcp remove image-gen --scope local');
    expect(s).toMatch(/revoke the key/i);
  });

  it('is pointed to from the Claude Code step of the runbook, and the credentialed commands above it are untouched', () => {
    const skill = read('SKILL.md');
    const phase3 = skill.slice(skill.indexOf('### Phase 3'));
    expect(phase3).toContain('image-gen');
    expect(phase3).toContain('references/claude-code.md');
    expect(phase3).toMatch(/key or keys|keys/);
    expect(read('references/claude-code.md')).toContain('claude mcp add --scope local firecrawl --env FIRECRAWL_API_KEY=<your-api-key> -- npx -y firecrawl-mcp@3.27.3');
  });

  it('uses the same version everywhere the route is described', () => {
    const adr = fs.readFileSync(path.resolve('docs/adr/0049-the-creative-designer-may-generate-photographs.md'), 'utf8');
    const providers = fs.readFileSync(path.resolve('registry/skills/image-generation/references/providers.md'), 'utf8');
    for (const [name, text] of [['providers.md', providers], ['the section', section()]] as const) expect(text, name).toContain(`mcp-image@${VERSION}`);
    // not just the string: the ADR must say that this is the number it pins (its old text mentions 0.18.0 as a release it did not pin)
    expect(adr, 'ADR 0049 pins the same number').toMatch(new RegExp(`pinned to \\*\\*${VERSION.replace(/\./g, '\\.')}\\*\\*`));
    const pinned = [...section().matchAll(/mcp-image@(\d+\.\d+\.\d+)/g)].map(m => m[1]);
    expect([...new Set(pinned)]).toEqual([VERSION]);
  });
});
