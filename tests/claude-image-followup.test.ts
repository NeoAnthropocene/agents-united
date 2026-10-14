import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderNativeRole } from '../src/core/native-package.js';

const read = (file: string): string => fs.readFileSync(path.resolve(file), 'utf8').replace(/\r\n/g, '\n');
const installed = (name: string): string => renderNativeRole(read(`registry/hosts/claude/agents/${name}.md`), `agents/${name}.md`);

describe('Sitting X follow-up: image records and credential-safe diagnosis', () => {
  it('defines the sidecar stem where the designer loads it and in both installed roles', () => {
    const skill = read('registry/skills/image-generation/SKILL.md');
    const designer = installed('agency-creative-designer');
    const lead = installed('orchestrator-digital-agency');
    for (const text of [skill, designer, lead]) {
      expect(text).toContain('file name without its final image extension');
      expect(text).toContain('hero.jpg');
      expect(text).toContain('hero.provenance.json');
    }
  });

  it('removes the credential-dumping fallback from the installed lead', () => {
    const lead = installed('orchestrator-digital-agency');
    expect(lead).not.toContain('claude mcp get image-gen');
    expect(lead).toContain('Do not run `claude mcp get`');
    expect(lead).toContain('redaction afterwards cannot remove a key');
    expect(lead).toContain("connection status in this client's `/mcp` UI");
  });

  it('keeps the image setup reference free of get-based diagnosis and preserves tool discovery', () => {
    const ref = read('registry/skills/mcp-setup/references/claude-code.md');
    const section = ref.slice(ref.indexOf('## Photographic images'), ref.indexOf('## Check an install'));
    expect(section).not.toContain('claude mcp get image-gen');
    expect(section).toContain('Never run `claude mcp get`');
    expect(section).toContain('report only the connection status');
    expect(section).toContain('mcp__image-gen__generate_image');
    const runbook = read('registry/skills/mcp-setup/SKILL.md');
    expect(runbook).toContain('Do not read credential-bearing MCP configuration');
    expect(runbook).toContain('Claude Desktop Chat');
    expect(runbook).toContain('Claude Desktop Code tab');
  });
});
