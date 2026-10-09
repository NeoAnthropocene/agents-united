import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { nativeText } from './helpers/native-roles.js';

/**
 * Plan 036 S18, `image-creation` (the maintainer, 2026-10-08: "for the photographic image creation needs you can use the MCP ... wire an MCP usage
 * skill for image creation", then "Gemini with my AI Studio key"). Claude cannot make an image, and the creative designer holds no shell, so the skill
 * is the judgment around one optional tool: which rung of the sourcing ladder a picture is on, what the go-ahead has to say before a paid call, how a
 * photographic prompt is written, the cap of two regenerations, how the saved file is looked at, and the provenance file that stays beside it. The tool
 * itself (the `image-gen` server, `mcp__image-gen__generate_image`) is wired by the next slice; this one is inert without it, and says so.
 */

const SKILL = 'image-creation';
const DIR = path.resolve('registry/skills', SKILL);
const read = (rel: string): string => fs.readFileSync(path.join(DIR, rel), 'utf8').replace(/\r\n/g, '\n');
const skill = (): string => read('SKILL.md');
const body = (): string => skill().replace(/^---\n[\s\S]*?\n---\n/, '');
const meta = (): { name: string; description: string; metadata: { author: string; version: string; source?: string }; [k: string]: unknown } =>
  YAML.parse(/^---\n([\s\S]*?)\n---/.exec(skill())![1]!) as ReturnType<typeof meta>;
const section = (heading: string): string => {
  const b = body();
  const start = b.indexOf(`\n## ${heading}\n`);
  expect(start, `## ${heading}`).toBeGreaterThan(-1);
  const next = b.indexOf('\n## ', start + 5);
  return b.slice(start, next === -1 ? undefined : next);
};
const allFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? allFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const bundles = (): Record<string, { skills?: string[] }> => (JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles: Record<string, { skills?: string[] }> }).bundles;
const tableRow = (role: string): string => nativeText(role).split('\n').find(l => l.startsWith('|') && l.split('|')[2]?.trim() === `\`${SKILL}\``) ?? '';
const TOOL = 'mcp__image-gen__generate_image';

describe('the skill: what it is and where it lives', () => {
  it('is an original in-house skill laid out like the others: the seven headings, every supporting file referenced and present, evals', () => {
    expect(meta().name).toBe(SKILL);
    expect(meta().metadata.author).toBe('agents-united');
    expect(meta().metadata.source, 'original work carries no source').toBeUndefined();
    const files = [
      'references/ladder.md',
      'references/prompting.md',
      'references/server-and-cost.md',
      'references/provenance-and-disclosure.md',
      'assets/image-brief-template.md',
      'assets/provenance-template.json',
      'examples/worked-example.md',
      'scripts/image-check.mjs',
      'evals/evals.json',
    ];
    for (const rel of files) {
      expect(fs.existsSync(path.join(DIR, rel)), rel).toBe(true);
      if (!rel.startsWith('evals/')) expect(body(), `SKILL.md mentions ${rel}`).toContain(rel);
    }
    expect(fs.existsSync(path.resolve('tests/fixtures/laid-out-skills', SKILL))).toBe(true);
  });

  it('leads with the use case, gives trigger phrases, says what it teaches, and says when to skip it', () => {
    const d = meta().description.replace(/\s+/g, ' ');
    expect(d).toMatch(/^Use when /);
    expect(d).toMatch(/trigger phrases:/);
    for (const phrase of ['generate a photo', 'hero photo', 'AI image', 'Nano Banana', 'image-gen']) expect(d, phrase).toContain(phrase);
    for (const taught of ['sourcing ladder', 'go-ahead', 'two-regeneration cap', 'provenance']) expect(d, taught).toContain(taught);
    expect(d).toMatch(/\bSkip it when\b/);
    for (const other of ['brand-identity', 'SVG', 'real person', 'real product']) expect(d, other).toContain(other);
    expect(d.length).toBeLessThanOrEqual(1024);
  });

  it('names the tool only by its full name, names no tool of another host, and runs its one script through CLAUDE_SKILL_DIR', () => {
    for (const rel of allFiles(DIR).map(f => path.relative(DIR, f).replace(/\\/g, '/')).filter(f => !f.startsWith('evals/') && /\.(md|mjs|json)$/.test(f))) {
      const text = read(rel);
      for (const token of ['write_to_file', 'view_file', 'run_command', 'ArtifactMetadata', 'agent-embed', 'MediaResolution']) expect(text, `${rel} ${token}`).not.toContain(token);
      // The bare name is another host's built-in tool (the host-fit guard); this skill's tool is the MCP tool with its server in the name.
      expect(text.replace(/mcp__image-gen__generate_image/g, ''), `${rel} bare generate_image`).not.toMatch(/(?<![\w-])generate_image(?![\w-])/);
    }
    expect(skill()).toContain(TOOL);
    expect(fs.readdirSync(path.join(DIR, 'scripts'))).toEqual(['image-check.mjs']);
    expect(body()).toContain('${CLAUDE_SKILL_DIR}/scripts/image-check.mjs');
  });

  it('holds no key, and no command with a real-looking value: placeholders only', () => {
    for (const file of allFiles(DIR)) {
      const text = fs.readFileSync(file, 'utf8');
      const rel = path.relative(DIR, file);
      expect(text, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(text, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      for (const m of text.matchAll(/GEMINI_API_KEY\s*[=:]\s*['"]?([^\s'"`<]+)/g)) expect(m[1], `${rel} GEMINI_API_KEY value`).toMatch(/^\$\{?GEMINI_API_KEY\}?$|^<|^your|^\.\.\.|^xxx/i);
    }
  });

  it('is carried by the digital-agency bundle and the full suite, and loaded from the creative designer\'s table only', () => {
    expect(bundles()['digital-agency']!.skills).toContain(SKILL);
    expect(bundles().full!.skills).toContain(SKILL);
    expect(tableRow('agency-creative-designer')).toMatch(/photograph|photo/i);
    expect(tableRow('agency-creative-designer')).toMatch(/none is supplied|no photography|not supplied/i);
    expect(tableRow('agency-frontend-architect')).toBe('');
  });

  it('points only to skills that exist', () => {
    const named = [...new Set([...body().matchAll(/`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g)].map(m => m[1]!))];
    for (const name of ['brand-identity', 'color-theory', 'mcp-setup', 'accessibility-audit', 'image-generation']) expect(named, name).toContain(name);
    for (const n of named.filter(x => !/^(image-check|image-gen|mcp-image|mjs)/.test(x))) expect(fs.existsSync(path.resolve('registry/skills', n, 'SKILL.md')), `${n} exists`).toBe(true);
  });
});

describe('the runbook teaches a route that is honest, cheap and recorded', () => {
  const runbook = (): string => section('Step-by-Step Runbook');

  it('climbs the ladder in order, says which rung each image is on, and never draws a photograph in SVG', () => {
    const r = runbook();
    expect(r).toMatch(/Climb the ladder/);
    expect(r).toMatch(/supplied or owned.*licensed.*generated.*placeholder/i);
    expect(r).toMatch(/which rung each image is on and why/);
    expect(r).toMatch(/Never an SVG drawn to pass as a photograph/);
  });

  it('checks that the tool is connected with ToolSearch, falls back to the placeholder, and never installs a server or touches a key', () => {
    const r = runbook();
    expect(r).toContain('ToolSearch');
    expect(r).toContain(TOOL);
    expect(r).toMatch(/Not listed: the placeholder/);
    expect(r).toMatch(/never install a server, ask for a key or put one in a file/);
  });

  it('gets the go-ahead before the first call, with the number of images, the size, the model, the estimate and where the prompt goes', () => {
    const r = runbook();
    expect(r).toMatch(/go-ahead before the first call/);
    for (const part of ['number of images', 'provider', 'size', 'model', 'estimate', 'goes to the provider']) expect(r, part).toContain(part);
  });

  it('writes the prompt as a scene, under 4,000 characters, records exactly what was sent, and keeps text, logos and people out', () => {
    const r = runbook();
    expect(r).toMatch(/Write the prompt/);
    expect(r).toMatch(/under 4,000 characters/);
    expect(r).toMatch(/the prompt you send is the prompt you record/i);
    for (const never of ['text', 'logos', 'real people']) expect(r, never).toContain(never);
  });

  it('loads image-generation before the first call: the rules, the provider and the recipes are there, not here', () => {
    const r = runbook();
    expect(r).toContain('`image-generation`');
    expect(r).toMatch(/load `image-generation`/i);
    expect(skill()).toMatch(/provider/);
  });

  it('calls once per image with a ratio for the placement, a size that fits it and a new file name, and caps regeneration at two', () => {
    const r = runbook();
    expect(r).toMatch(/aspectRatio/);
    expect(r).toMatch(/imageSize/);
    expect(r).toMatch(/new descriptive `fileName`/);
    expect(r).toMatch(/never reuse a name/);
    expect(r).toMatch(/At most two regenerations per asset/);
  });

  it('looks at the saved file with Read and says what a downscaled copy hid, then records and places the image and reports the cost', () => {
    const r = runbook();
    expect(r).toMatch(/`Read`/);
    expect(r).toMatch(/downscaled/);
    expect(r).toMatch(/provenance/);
    expect(r).toMatch(/estimated cost/);
    expect(r).toMatch(/Open items/);
    expect(body()).toMatch(/holds no shell|hold no shell/);
  });

  it('lists the failures with their reasons: a faked photo, a generated endorser, the real product, text in the picture, an unbounded loop, a reused name', () => {
    const a = section('Code & Config Exemplars');
    for (const pattern of [/photograph faked in SVG/, /generated face as a customer, reviewer or endorser/, /generated picture of the client's real product/, /text asked of the model/i, /regenerating until it is perfect/i, /reused file name/, /go-ahead assumed/]) {
      expect(a, String(pattern)).toMatch(pattern);
    }
  });

  it('keeps the edge cases: no tool, a tool error, a refusal, an input photo, a ratio the server does not offer, a key in the chat', () => {
    const e = section('Edge Cases & Error Recovery');
    expect(e).toMatch(/No tool|Tool not listed/i);
    expect(e).toMatch(/billing|quota/i);
    expect(e).toMatch(/refuses|refused/i);
    expect(e).toMatch(/inputImagePaths/);
    expect(e).toMatch(/1\.91:1/);
    expect(e).toMatch(/key pasted in the chat/);
  });
});

describe('the references, the assets, the example and the evals', () => {
  it('has the ladder with its four rungs, a table of what may be generated, and the rule on faces', () => {
    const l = read('references/ladder.md');
    for (const rung of ['1. **Supplied or owned**', '2. **Licensed stock the user chooses**', '3. **Generated**', '4. **Placeholder**']) expect(l, rung).toContain(rung);
    expect(l).toMatch(/\| Subject \| Generate it\? \| Why \|/);
    expect(l).toMatch(/never a generated or stock face as a customer, reviewer or endorser/i);
    expect(l).toMatch(/the real product/i);
  });

  it('has the prompt parts, the placement table (ratio and size per placement, with the final pixel width) and good and weak prompts', () => {
    const p = read('references/prompting.md');
    for (const part of ['Subject', 'Setting', 'Light', 'Camera', 'Composition', 'Copy zone', 'Palette in words']) expect(p, part).toContain(part);
    expect(p).toMatch(/\| Placement \| aspectRatio \| imageSize \| Pixels at that size \|/);
    for (const row of ['| Feed 4:5 (1080 x 1350)', '| Story 9:16 (1080 x 1920)', '| Banner 16:9', '| Square 1:1']) expect(p, row).toContain(row);
    expect(p).toContain('1856 x 2304');
    expect(p).toMatch(/semantic negative|what you want, not what you do not/i);
    expect(p).toContain('image-generation');
    expect(p).toMatch(/Gemini's pixel sizes|pixel sizes are Gemini's|Gemini model's/i);
    expect(p).toMatch(/Weak:/);
    expect(p).toMatch(/Better:/);
  });

  it('has the estimate and the caps: the tool, the three providers, the arithmetic, the default model\'s prices (dated), the cap of three calls, the probe for a provider with no published price, and where the full table lives', () => {
    const s = read('references/server-and-cost.md');
    expect(s).toContain(TOOL);
    for (const provider of ['Gemini', 'OpenAI', 'Seedream']) expect(s, provider).toContain(provider);
    expect(s).toContain('image-generation');
    expect(s).toContain('references/providers.md');
    for (const price of ['$0.0336', '$0.0504', '$0.113']) expect(s, price).toContain(price);
    expect(s).toMatch(/Prices read on 2026-10-09/);
    expect(s).toMatch(/no free tier/i);
    expect(s).toMatch(/three calls/i);
    expect(s).toMatch(/probe/i);
    expect(s).toMatch(/go(es)? to the provider/i);
    expect(s).toMatch(/SynthID/);
    expect(s, 'the old default model\'s prices are gone').not.toMatch(/\$0\.067|\$0\.101|\$0\.151/);
  });

  it('has the provenance fields, the disclosure rule and the never-generate list', () => {
    const d = read('references/provenance-and-disclosure.md');
    for (const field of ['file', 'asset', 'attempt', 'createdAt', 'server', 'model', 'prompt', 'parameters', 'approvedBy', 'estimatedCostUsd', 'disclosure', 'inputImages']) expect(d, field).toContain(`\`${field}\``);
    expect(d).toMatch(/provider/);
    expect(d).not.toContain('`inputImage`');
    expect(d).toMatch(/Never generate/);
    for (const never of ['a real person', 'a customer', 'a logo', 'a screenshot']) expect(d, never).toContain(never);
    expect(d).toMatch(/SynthID/);
    expect(d).toMatch(/the placement's own rule|the platform's own rule/);
  });

  it('has a brief template with the fields, and a provenance template that the script accepts as complete', () => {
    const t = read('assets/image-brief-template.md');
    for (const field of ['Asset id', 'Placement', 'Subject', 'Copy zone', 'Must not contain', 'Rung and why', 'Go-ahead']) expect(t, field).toContain(field);
    const template = JSON.parse(read('assets/provenance-template.json')) as Record<string, unknown>;
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'au-image-template-'));
    try {
      const chunk = (type: string, data: Buffer): Buffer => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), data])));
        return Buffer.concat([len, Buffer.from(type), data, crc]);
      };
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(1856, 0);
      ihdr.writeUInt32BE(2304, 4);
      ihdr.set([8, 2, 0, 0, 0], 8);
      const file = String(template.file);
      fs.writeFileSync(path.join(folder, file), Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IEND', Buffer.alloc(0))]));
      fs.writeFileSync(path.join(folder, file.replace(/\.\w+$/, '.provenance.json')), JSON.stringify(template));
      const r = spawnSync(process.execPath, [path.join(DIR, 'scripts/image-check.mjs'), folder, '--json'], { encoding: 'utf8' });
      expect(JSON.parse(r.stdout).findings, r.stdout).toEqual([]);
      expect(r.status).toBe(0);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it('has a worked example whose script output is the output of the script on the folder it describes', () => {
    const w = read('examples/worked-example.md');
    expect(w).toMatch(/worked example/i);
    const header = (kind: 'png', width: number, height: number): Buffer => {
      const u32 = (n: number): Buffer => {
        const b = Buffer.alloc(4);
        b.writeUInt32BE(n);
        return b;
      };
      const chunk = (type: string, data: Buffer): Buffer => Buffer.concat([u32(data.length), Buffer.from(type), data, u32(zlib.crc32(Buffer.concat([Buffer.from(type), data])))]);
      expect(kind).toBe('png');
      return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])])), chunk('IEND', Buffer.alloc(0))]);
    };
    const card = (file: string, asset: string, attempt: number, aspectRatio: string, imageSize: string): object => ({
      file,
      asset,
      attempt,
      createdAt: '2026-10-09T09:12:00Z',
      server: 'image-gen (mcp-image 0.18.0)',
      model: 'gemini-nano-banana-2.1',
      prompt: 'A scene.',
      parameters: { aspectRatio, imageSize, quality: 'fast' },
      approvedBy: 'the user: go, two images, 2K',
      estimatedCostUsd: 0.0504,
      disclosure: 'Generated with Gemini; invisible SynthID mark; no platform label required, checked 2026-10-09.',
    });
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'au-image-example-'));
    try {
      for (const [file, asset, attempt, ratio, w2, h2] of [
        ['petpal-hero-sofa-a1.png', 'petpal-hero-sofa', 1, '4:5', 1856, 2304],
        ['petpal-hero-sofa-a2.png', 'petpal-hero-sofa', 2, '4:5', 1856, 2304],
        ['petpal-banner-park-a1.png', 'petpal-banner-park', 1, '16:9', 2048, 2048],
      ] as const) {
        fs.writeFileSync(path.join(folder, file), header('png', w2, h2));
        fs.writeFileSync(path.join(folder, file.replace('.png', '.provenance.json')), JSON.stringify(card(file, asset, attempt, ratio, '2K')));
      }
      const r = spawnSync(process.execPath, [path.join(DIR, 'scripts/image-check.mjs'), folder], { encoding: 'utf8' });
      expect(r.status).toBe(1);
      const normalised = r.stdout.replace(/\d+ B\b/g, '<bytes> B').replace(/sha256:[0-9a-f]{12}/g, 'sha256:<sha>').trimEnd();
      const block = [...w.matchAll(/```text\n([\s\S]*?)```/g)].map(m => m[1]!.trimEnd()).find(b => b.includes('checked 3 images'));
      expect(block, 'the example shows the output of image-check').toBeDefined();
      expect(block).toBe(normalised);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it('has evals for a hero photo with the tool connected, no tool, a customer portrait, a loop of regenerations, and a key in the chat', () => {
    const e = JSON.parse(read('evals/evals.json')) as { skill_name: string; evals: Array<{ id: number; prompt: string; expected_output: string }> };
    expect(e.skill_name).toBe(SKILL);
    expect(e.evals.length).toBeGreaterThanOrEqual(5);
    const prompts = e.evals.map(x => x.prompt).join('\n');
    expect(prompts).toMatch(/hero photo/i);
    expect(prompts).toMatch(/not connected|no image server/i);
    expect(prompts).toMatch(/testimonial|customer/i);
    expect(prompts).toMatch(/regenerate until|keep regenerating/i);
    expect(prompts).toMatch(/API key/i);
    for (const x of e.evals) expect(x.expected_output.length, `eval ${x.id}`).toBeGreaterThan(80);
  });
});

describe('the catalog records', () => {
  it('records the skill as in-house and in the audit table', () => {
    const prov = JSON.parse(fs.readFileSync(path.resolve('host-library/_upstream/skills.json'), 'utf8')) as { skills: Record<string, { provenance: string }> };
    expect(prov.skills[SKILL]?.provenance).toBe('in-house');
    expect(fs.readFileSync(path.resolve('docs/skill-quality/digital-agency-audit.md'), 'utf8')).toMatch(/\| `image-creation` \| Jamileh/);
  });
});
