import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import { nativeText, NATIVE_AGENTS_DIR } from './helpers/native-roles.js';

/**
 * Plan 036 S19, ADR 0049: the creative designer may generate photographs through the optional `image-gen` server. The skill that teaches it and the
 * install route are the previous slice (S18). This slice is the grant and the offer, and the tests pin what must stay true of them: the grant is the one
 * tool and not the server; no other role holds it; the server is in no required list and in no canonical agent's `mcpServers`, so the doctor, the install
 * gate and the Antigravity sync do not move; her body and the lead's say when the route may be used and what the user is told; the decision is recorded;
 * the live test is gated, not claimed.
 */

const TOOL = 'mcp__image-gen__generate_image';
const read = (rel: string): string => fs.readFileSync(path.resolve(rel), 'utf8').replace(/\r\n/g, '\n');
const frontmatter = (role: string): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(nativeText(role))![1]!);
const tools = (role: string): string[] => String(frontmatter(role).tools).split(',').map(t => t.trim());
const body = (role: string): string => nativeText(role).split('<!-- agents-united:floor:end -->')[1]!;
type Bundles = Record<string, { prerequisites?: { requiredMcps?: Array<{ name: string }> } }>;
const bundles = (): Bundles => (JSON.parse(read('registry/bundles.json')) as { bundles: Bundles }).bundles;

describe('the grant: one tool, one role', () => {
  it('gives the creative designer the tool and not the whole server', () => {
    const held = tools('agency-creative-designer');
    expect(held).toContain(TOOL);
    expect(held).not.toContain('mcp__image-gen');
    expect(held.filter(t => t.includes('image-gen'))).toEqual([TOOL]);
  });

  it('gives it to no other native role', () => {
    const others = fs.readdirSync(NATIVE_AGENTS_DIR).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')).filter(r => r !== 'agency-creative-designer');
    expect(others.length).toBeGreaterThan(5);
    for (const role of others) expect(tools(role).filter(t => t.includes('image-gen')), role).toEqual([]);
  });

  it('keeps the shell and delegation out of her hands: the image route widened nothing else', () => {
    const held = tools('agency-creative-designer');
    for (const forbidden of ['Bash', 'PowerShell', 'Agent', 'Workflow']) expect(held, forbidden).not.toContain(forbidden);
  });
});

describe('the server is an optional extra that nothing else knows about', () => {
  it('is in no bundle\'s required list and in no canonical agent\'s mcpServers', () => {
    for (const [name, bundle] of Object.entries(bundles())) {
      expect((bundle.prerequisites?.requiredMcps ?? []).map(m => m.name), name).not.toContain('image-gen');
    }
    for (const file of fs.readdirSync(path.resolve('registry/agents')).filter(f => f.endsWith('.md'))) {
      const meta = yaml.parse(/^---\n([\s\S]*?)\n---/.exec(read(path.join('registry/agents', file)))![1]!) as { mcpServers?: Array<{ name: string } | string> };
      const names = (meta.mcpServers ?? []).map(s => (typeof s === 'string' ? s : s.name));
      expect(names, file).not.toContain('image-gen');
    }
  });

  it('leaves the Antigravity catalog alone: the designer there keeps her own generate_image tool', () => {
    const catalog = JSON.parse(read('registry/hosts/antigravity/mcp/servers.json')) as { servers: Record<string, unknown> };
    expect(Object.keys(catalog.servers)).not.toContain('image-gen');
    expect(read('registry/agents/subagent-marketing-creative-designer.md')).toMatch(/^ {2}- generate_image$/m);
  });
});

describe('her body: when the route may be used', () => {
  const step3 = (): string => body('agency-creative-designer').split('\n').find(l => l.startsWith('3. **Design with the connected tools.**')) ?? '';

  it('names the skill and the tool, ties the call to ToolSearch and a go, and says she never installs the server', () => {
    const s = step3();
    expect(s).toContain('`image-creation`');
    expect(s).toContain(`\`${TOOL}\``);
    expect(s).toMatch(/`ToolSearch` lists it/);
    expect(s).toMatch(/only after the user or the lead has said go/);
    expect(s).toMatch(/never install it/);
  });

  it('keeps the code route as her home, and no longer says without an exception that she renders no raster image', () => {
    const s = step3();
    expect(s).toMatch(/vector and markup assets \(SVG, HTML, CSS\) are your home route/);
    expect(s).not.toMatch(/you do not render raster images\./);
    expect(s).toMatch(/Publish Artifact/);
  });

  it('has the skill in her table, and a description that stays within 300 characters and names the optional server', () => {
    expect(nativeText('agency-creative-designer')).toMatch(/\| `image-creation` \|/);
    const d = String(frontmatter('agency-creative-designer').description);
    expect(d.length).toBeLessThanOrEqual(300);
    expect(d).toMatch(/optional image server/);
    expect(d).not.toMatch(/no image generation/);
  });
});

describe('the lead\'s offer', () => {
  const paragraph = (): string => body('orchestrator-digital-agency').split('\n').find(l => l.startsWith('**Photographs.**')) ?? '';

  it('offers it only when a plan holds a photograph nobody supplied, never by default, and calls the placeholder a complete alternative', () => {
    const p = paragraph();
    expect(p).not.toBe('');
    expect(p).toMatch(/optional extra/);
    expect(p).toMatch(/nobody supplied/);
    expect(p).toMatch(/never by default/);
    expect(p).toMatch(/placeholder with an image brief is a complete alternative/);
  });

  it('offers it with AskUserQuestion as Generate images beside Placeholders and image briefs, with the explanation in the option', () => {
    const p = paragraph();
    expect(p).toContain('`AskUserQuestion`');
    expect(p).toContain('**Generate images**');
    expect(p).toContain('**Placeholders and image briefs**');
    for (const part of ['Gemini', 'AI Studio key', 'billed to your Google project', 'no free tier', 'every prompt goes to Google', 'your own terminal', 'never ask for it', 'restarts']) expect(p, part).toContain(part);
  });

  it('asks for a go-ahead that names how many images and at which size, and follows mcp-setup without running the command itself', () => {
    const p = paragraph();
    expect(p).toMatch(/go-ahead that names how many images and at which size/);
    expect(p).toContain('`mcp-setup`');
    expect(p).toMatch(/never run it/);
    expect(p).toContain('`ToolSearch`');
    expect(p).toContain(`\`${TOOL}\``);
  });

  it('briefs Jamileh with the go in the user\'s words, and generates nothing without the server', () => {
    const p = paragraph();
    expect(p).toMatch(/brief Jamileh/);
    expect(p).toMatch(/in the user's words/);
    expect(p).toMatch(/without the server nothing is generated/i);
  });

  it('carries her description in its roster, kept in step with her own file', () => {
    expect(nativeText('orchestrator-digital-agency')).toContain(String(frontmatter('agency-creative-designer').description));
  });
});

describe('the record', () => {
  it('has ADR 0049: accepted, with the decision, the limits and what stays open for the maintainer', () => {
    const adr = read('docs/adr/0049-the-creative-designer-may-generate-photographs.md');
    expect(adr).toMatch(/^# ADR 0049: /);
    expect(adr).toMatch(/\*\*Status\*\*: Accepted, 2026-10-08/);
    for (const part of ['mcp-image', '0.14.0', TOOL, 'newest release older than two weeks', 'SKIP_PROMPT_ENHANCEMENT=true', 'requiredMcps', 'Open for the maintainer', 'inputImagePath', 'Not established']) expect(adr, part).toContain(part);
  });

  it('has the Image route in the domain dictionary', () => {
    const context = read('CONTEXT.md');
    expect(context).toMatch(/\*\*Image route\*\*:/);
    expect(context).toMatch(/never in `requiredMcps`/);
  });

  it('gates the live test H10d on this slice and on the maintainer\'s own key, as two runs, and claims no result', () => {
    const protocol = read('docs/live-test-protocol.md');
    const start = protocol.indexOf('### H10d Prompt');
    expect(start).toBeGreaterThan(-1);
    const h10d = protocol.slice(start, protocol.indexOf('### Cost', start));
    expect(h10d).toMatch(/Gated/);
    expect(h10d).toContain('image-gen');
    expect(h10d).toMatch(/H10d1/);
    expect(h10d).toMatch(/H10d2/);
    expect(h10d).toMatch(/with their own key|the maintainer's own key/);
    expect(h10d).not.toMatch(/probe P2 has passed|S5 server/);
    expect(h10d).not.toMatch(/\bPASS\b|\bpassed on\b/);
  });
});
