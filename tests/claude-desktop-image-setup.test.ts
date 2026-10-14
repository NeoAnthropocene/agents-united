import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderNativeRole } from '../src/core/native-package.js';

const read = (file: string): string => fs.readFileSync(path.resolve(file), 'utf8');
const templatePath = 'registry/skills/mcp-setup/assets/claude-desktop-image-gen.mcp.template.json';

describe('accepted Desktop image setup: credential-free project definition', () => {
  it('holds all three provider references with the pinned server name and package, never literal keys', () => {
    const template = JSON.parse(read(templatePath)) as {
      mcpServers: Record<string, { type: string; command: string; args: string[]; env: Record<string, string> }>;
    };
    expect(Object.keys(template.mcpServers)).toEqual(['image-gen']);
    const server = template.mcpServers['image-gen']!;
    expect(server).toMatchObject({ type: 'stdio', command: 'npx', args: ['-y', 'mcp-image@0.18.0'] });
    expect(server.env).toEqual({
      GEMINI_API_KEY: '${AGENTS_UNITED_GEMINI_API_KEY}',
      OPENAI_API_KEY: '${AGENTS_UNITED_OPENAI_API_KEY}',
      ARK_API_KEY: '${AGENTS_UNITED_ARK_API_KEY}',
      IMAGE_PROVIDER: 'gemini',
      SKIP_PROMPT_ENHANCEMENT: 'true',
      IMAGE_OUTPUT_DIR: '<absolute-project-assets-generated>',
    });
    expect(read(templatePath)).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|\bsk-[0-9A-Za-z_-]{20,}/);
  });

  it('routes Desktop setup to the project template and direct human key entry from the skill and native lead', () => {
    const skill = read('registry/skills/mcp-setup/SKILL.md');
    const ref = read('registry/skills/mcp-setup/references/claude-code.md');
    const lead = renderNativeRole(read('registry/hosts/claude/agents/orchestrator-digital-agency.md'), 'agents/orchestrator-digital-agency.md');
    expect(skill).toContain('Desktop Code image setup');
    expect(lead).toContain('Desktop Code image setup');
    expect(ref).toContain('assets/claude-desktop-image-gen.mcp.template.json');
    for (const variable of ['AGENTS_UNITED_GEMINI_API_KEY', 'AGENTS_UNITED_OPENAI_API_KEY', 'AGENTS_UNITED_ARK_API_KEY']) expect(ref).toContain(variable);
    expect(ref).toContain('Remove every key mapping for an unselected provider');
    expect(ref).toContain('all local sessions and preview servers');
    expect(ref).toContain('provide a separate template for the user to merge privately');
    expect(ref).toContain('Live verification of this new route is pending');
  });
});
