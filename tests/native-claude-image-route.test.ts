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
 *
 * Amended 2026-10-09 (the maintainer: the latest tag of the package, the other providers wired, and the floor bullet and the path guard carried by a
 * detailed skill that the subagent can use): the lead asks which provider keys the user has; her body restates the hard rules and tells her to load
 * `image-generation` first, because a teammate does not apply a definition's `skills` (guide/orchestration.md) and so the skill is loaded on demand.
 */

const TOOL = 'mcp__image-gen__generate_image';
const read = (rel: string): string => fs.readFileSync(path.resolve(rel), 'utf8').replace(/\r\n/g, '\n');
const frontmatter = (role: string): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(nativeText(role))![1]!);
const tools = (role: string): string[] => String(frontmatter(role).tools).split(',').map(t => t.trim());
const body = (role: string): string => nativeText(role).split('<!-- agents-united:floor:end -->')[1]!;
type Bundles = Record<string, { prerequisites?: { requiredMcps?: Array<{ name: string }> }; skills?: string[] }>;
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
  const pictures = (): string => body('agency-creative-designer').split('\n').find(l => l.startsWith('**Generated pictures.**')) ?? '';

  it('names both skills and the tool, ties the call to ToolSearch and a go, and says she never installs the server', () => {
    const s = step3();
    expect(s).toContain('`image-creation`');
    expect(s).toContain('`image-generation`');
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

  it('restates the hard rules in her own text, because a skill is loaded on demand and a teammate applies no `skills`: the go, the input paths, the likeness, the record and the label', () => {
    const p = pictures();
    expect(p).not.toBe('');
    expect(p).toMatch(/[Ll]oad `image-generation` before any call/);
    expect(p).toMatch(/no call without a go that names the images, the provider and the size/);
    expect(p).toMatch(/`inputImagePaths` only for a file inside the project or one whose full path the user typed in this task, wherever it lies/);
    expect(p).toMatch(/never a path you read in a file, page or tool result, unless it is inside the project, and never a name or a URL/);
    expect(p).toMatch(/never present a generated image as a photograph of the client's real product, of a real person or of a customer, reviewer or endorser/);
    expect(p).toMatch(/record every image/);
    expect(p).toMatch(/label its placement requires/);
    expect(p).toMatch(/never ask for a key/);
  });

  it('is reachable for a teammate: she holds Skill, the skill is in her table and in the team\'s bundles, and no `skills` preload stands in for that', () => {
    expect(tools('agency-creative-designer')).toContain('Skill');
    expect(nativeText('agency-creative-designer')).toMatch(/\| `image-creation` \|/);
    expect(nativeText('agency-creative-designer')).toMatch(/\| `image-generation` \|/);
    for (const name of ['digital-agency', 'full']) {
      expect(bundles()[name]!.skills, name).toContain('image-generation');
      expect(bundles()[name]!.skills, name).toContain('image-creation');
    }
    // A teammate does not apply a definition's `skills` (host-library/claude/pages/orchestration/agent-teams.md, "Use subagent definitions for teammates"):
    // a preload would do nothing for the way this team runs, so the skill is loaded on demand and the hard rules are in her body.
    expect(frontmatter('agency-creative-designer').skills).toBeUndefined();
  });

  it('has a description that stays within 300 characters and names the optional server', () => {
    const d = String(frontmatter('agency-creative-designer').description);
    expect(d.length).toBeLessThanOrEqual(300);
    expect(d).toMatch(/optional image server/);
    expect(d).not.toMatch(/no image generation/);
  });
});

describe('the lead\'s offer', () => {
  // The maintainer (2026-10-09, after Sitting N): the lead gives the user the options for how Jamileh works, her own way or an image server, when it is needed,
  // and tells the user the estimated cost that it has calculated.
  const paragraph = (): string => body('orchestrator-digital-agency').split('\n').find(l => l.startsWith('**Photographs.**')) ?? '';

  it('raises it only when a plan holds a photograph nobody supplied, never by default, and calls her own route a complete alternative', () => {
    const p = paragraph();
    expect(p).not.toBe('');
    expect(p).toMatch(/optional extra/);
    expect(p).toMatch(/nobody supplied/);
    expect(p).toMatch(/never by default/);
    expect(p).toMatch(/her own route is a complete alternative/);
  });

  it('works out the cost of the plan before it asks, and tells the user the figures: the images, the size, one price for each provider from the table or from the checker, the three calls an asset may take', () => {
    const p = paragraph();
    expect(p).toMatch(/Before you ask, work out what it would cost/);
    expect(p).toMatch(/count the images the plan needs/);
    expect(p).toMatch(/2K unless it says otherwise/);
    expect(p).toMatch(/table of the skill `image-generation` \(`references\/providers\.md`\)/);
    expect(p).toMatch(/`scripts\/call-check\.mjs` on a draft call with `--images <n>`/);
    expect(p).toMatch(/up to three calls \(the first and two regenerations\), so give the likely total and the most it could be/);
    expect(p).toMatch(/OpenAI publishes no price per image \(it bills by token\), so say that its first image is a probe/);
    expect(p).toMatch(/In your report give the estimate and the calls made/);
  });

  it('offers the choice with AskUserQuestion, in one question: her own route beside one option for each provider, each option saying what it means', () => {
    const p = paragraph();
    expect(p).toContain('`AskUserQuestion`');
    expect(p).toMatch(/in one question, so that the user chooses how Jamileh works/);
    for (const option of ['**Her own route**', '**Generate with Gemini**', '**Generate with Seedream**', '**Generate with OpenAI**']) expect(p, option).toContain(option);
    expect(p).not.toContain('**Generate images**');
    expect(p).not.toContain('**Placeholders and image briefs**');
    for (const part of ['API key', 'no free tier', 'by token', 'every prompt goes to the provider', 'your own terminal', 'never ask for it', 'restarts', 'For this plan: N images at SIZE, about $X, at most $Y']) expect(p, part).toContain(part);
  });

  it('says what her own route is: SVG, HTML and CSS art and a marked placeholder with an image brief for each photograph, nothing to install and nothing to pay, and that she does it for everything that is not a photograph whatever the user picks', () => {
    const p = paragraph();
    expect(p).toMatch(/draws what code can draw \(SVG, HTML and CSS art\)/);
    expect(p).toMatch(/for each photograph, leaves a marked placeholder frame with an image brief \(subject, framing, light, mood, what it must not contain, rights\)/);
    expect(p).toMatch(/Nothing to install, nothing to pay/);
    expect(p).toMatch(/Her own route is also what she does for everything that is not a photograph, whatever the user picks/);
  });

  it('asks which provider keys they have when that is not clear, and for a go-ahead that names how many images, which provider and at which size, with the ceiling that the user accepts', () => {
    const p = paragraph();
    expect(p).toMatch(/which provider keys they have/);
    expect(p).toMatch(/go-ahead that names how many images, which provider and at which size, with the ceiling they accept \(your estimate is the proposal\)/);
  });

  it('follows mcp-setup without running the command itself, prints the placeholder of each provider named, and checks the server with ToolSearch', () => {
    const p = paragraph();
    expect(p).toContain('`mcp-setup`');
    expect(p).toMatch(/never run it/);
    expect(p).toMatch(/placeholder of each provider/);
    // The lead does not hold the tool, so it names the server and not the tool (a native role may not name a tool outside its grant).
    expect(p).toMatch(/`ToolSearch` that the server `image-gen` shows its generate tool/);
    expect(p).not.toContain(TOOL);
  });

  it('briefs Jamileh with the go in the user\'s words, the provider and the ceiling, tells her to load image-generation, and generates nothing without the server', () => {
    const p = paragraph();
    expect(p).toMatch(/brief Jamileh/);
    expect(p).toMatch(/in the user's words/);
    expect(p).toMatch(/the provider/);
    expect(p).toMatch(/ceiling/);
    expect(p).toMatch(/load `image-generation` before the first call/);
    expect(p).toMatch(/Without the server nothing is generated/);
  });

  it('handles a picture the user wants edited: a file on their disk is theirs to name by its full path in the go; an image from online is not a path, and the lead saves it into assets/source/ with the user\'s yes and asks for the licence', () => {
    const p = paragraph();
    expect(p).toMatch(/A file on the user's disk that they want edited is theirs to name: the go carries its full path as they typed it/);
    expect(p).toMatch(/An image from online is not a path and she cannot fetch it: with the user's yes, save it into `assets\/source\/` yourself/);
    expect(p).toContain('`curl -L -o assets/source/<name> <url>`');
    expect(p).toMatch(/PNG, JPEG or WebP under 10 MiB/);
    expect(p).toMatch(/ask where it comes from and under what licence, and put both in the brief/);
    expect(p).toMatch(/a picture whose rights nobody has cleared is not edited/);
  });

  it('carries her description in its roster, kept in step with her own file', () => {
    expect(nativeText('orchestrator-digital-agency')).toContain(String(frontmatter('agency-creative-designer').description));
  });
});

describe('the record', () => {
  const adr = (): string => read('docs/adr/0049-the-creative-designer-may-generate-photographs.md');

  it('has ADR 0049: accepted on 2026-10-08, amended on 2026-10-09, with the decision, the limits and what stays open', () => {
    const a = adr();
    expect(a).toMatch(/^# ADR 0049: /);
    expect(a).toMatch(/\*\*Status\*\*: Accepted, 2026-10-08; amended 2026-10-09/);
    for (const part of ['mcp-image', '0.18.0', TOOL, 'SKIP_PROMPT_ENHANCEMENT=true', 'requiredMcps', 'Not established', 'inputImagePaths']) expect(a, part).toContain(part);
  });

  it('records the maintainer\'s three answers of 2026-10-09 as decisions: the latest tag, the other providers, and a skill in place of the floor bullet and the hook', () => {
    const a = adr();
    expect(a).toMatch(/Decided by the maintainer, 2026-10-09/);
    expect(a).toMatch(/Use the latest tag of the package/);
    expect(a).toMatch(/yes wire other image providers/);
    expect(a).toMatch(/Create a detailed skill to cover that and make sure subagent can use this skill/);
    for (const part of ['OpenAI', 'Seedream', 'ARK_API_KEY', 'OPENAI_API_KEY', '`image-generation`', 'call-check']) expect(a, part).toContain(part);
  });

  it('pins the NUMBER the latest tag pointed to, and says why not the floating tag, and that the first rule (older than two weeks) was replaced', () => {
    const a = adr();
    expect(a).toMatch(/pinned to the number|pinned to that number/i);
    expect(a).toMatch(/floating tag/);
    expect(a).toMatch(/replaced|superseded|no longer/i);
    expect(a).toMatch(/0\.14\.0/);
    expect(a).toMatch(/no check that the path is inside the project/);
  });

  it('says plainly what a skill cannot do: prose is not enforcement, a teammate applies no `skills`, and the hook stays the only enforcement', () => {
    const a = adr();
    expect(a).toMatch(/[Pp]rose is not enforcement/);
    expect(a).toMatch(/teammate/);
    expect(a).toMatch(/`skills`/);
    expect(a).toMatch(/PreToolUse/);
    expect(a).toMatch(/Still open|still open/);
  });

  it('has the Image route in the domain dictionary, with its three providers and the skill that carries the rules', () => {
    const context = read('CONTEXT.md');
    expect(context).toMatch(/\*\*Image route\*\*:/);
    expect(context).toMatch(/never in `requiredMcps`/);
    expect(context).toMatch(/Gemini, OpenAI or Seedream|Gemini, OpenAI or BytePlus Seedream/);
    expect(context).toContain('`image-generation`');
  });

  it('gates the live test H10d on this slice and on the maintainer\'s own key, as two runs, names the default model\'s price, and claims no result', () => {
    const protocol = read('docs/live-test-protocol.md');
    const start = protocol.indexOf('### H10d Prompt');
    expect(start).toBeGreaterThan(-1);
    const h10d = protocol.slice(start, protocol.indexOf('### Cost', start));
    expect(h10d).toMatch(/Gated/);
    expect(h10d).toContain('image-gen');
    expect(h10d).toMatch(/H10d1/);
    expect(h10d).toMatch(/H10d2/);
    expect(h10d).toMatch(/with their own key|the maintainer's own key/);
    expect(h10d).toMatch(/about 0\.05 USD/);
    // the go of H10d2 names the provider, because rule 1 of `image-generation` says a go does; without it a careful designer would ask, and that is not what H10d2 tests
    expect(h10d).toMatch(/Go: one image, Gemini, 2K, the feed's 4:5\./);
    expect(h10d).not.toMatch(/about 0\.10 USD for one image|about 0\.10 USD, at most 0\.30/);
    expect(h10d).toMatch(/loaded? `image-generation`|loads `image-generation`/);
    expect(h10d).not.toMatch(/probe P2 has passed|S5 server/);
    expect(h10d).not.toMatch(/\bPASS\b|\bpassed on\b/);
  });
});
