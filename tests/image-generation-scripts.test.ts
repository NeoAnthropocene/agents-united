import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Plan 036, the skill `image-generation` (the maintainer, 2026-10-09: the floor bullet on generated imagery and the guard on the image path the server
 * reads are carried by a skill, "a detailed skill ... with usage prompt examples for various cases"). A skill is prose, and prose is not enforcement, so
 * the rules that can be checked are also a script: `call-check.mjs` reads a planned call to `mcp__image-gen__generate_image` and says what the server would
 * refuse (it knows mcp-image 0.18.0's limits per provider) and what the server would NOT refuse but this team does: an input image outside the project.
 * It is read-only, never runs the tool and never reads a pixel. A lead with a shell runs it; a hook could import it later.
 */

const SCRIPT = path.resolve('registry/skills/image-generation/scripts/call-check.mjs');

interface Finding {
  code: string;
  severity: 'error' | 'warn';
  field: string;
  message: string;
}
interface Result {
  findings: Finding[];
  estimate: { provider: string; model: string | null; perImageUsd: number | null; images: number; totalUsd: number | null; worstCaseUsd: number | null; basis: string; note: string };
}
interface Api {
  checkCall: (call: Record<string, unknown>, options?: Record<string, unknown>) => Result;
  PRICES: Record<string, unknown>;
  RATIOS: string[];
  MAX_INPUT_IMAGES: Record<string, number>;
}

let tmp: string;
let project: string;
let outputDir: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'au-call-check-'));
  project = path.join(tmp, 'petpal');
  outputDir = path.join(project, 'assets', 'generated');
  fs.mkdirSync(path.join(project, 'assets', 'source'), { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const api = async (): Promise<Api> => (await import(`${SCRIPT.startsWith('/') ? '' : 'file:///'}${SCRIPT.replace(/\\/g, '/')}`)) as Api;
const source = (name: string, bytes = 12): string => {
  const file = path.join(project, 'assets', 'source', name);
  fs.writeFileSync(file, Buffer.alloc(bytes, 1));
  return file;
};
const codes = (r: Result, severity?: 'error' | 'warn'): string[] => r.findings.filter(f => !severity || f.severity === severity).map(f => f.code);
const clean = { prompt: 'A photograph of a cream linen sofa in a sunlit room, soft window light from the left, an empty plain wall above.', aspectRatio: '4:5', imageSize: '2K', fileName: 'petpal-hero-sofa-a1' };

describe('call-check: the module and the command line', () => {
  it('exports the checker, the price table, the ratios and the per-provider input limits', async () => {
    const a = await api();
    expect(typeof a.checkCall).toBe('function');
    expect(a.RATIOS).toEqual(['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9']);
    expect(a.MAX_INPUT_IMAGES).toEqual({ gemini: 14, openai: 16, seedream: 10 });
    expect(Object.keys(a.PRICES).sort()).toEqual(['gemini', 'openai', 'seedream']);
  });

  it('exits 0 on a clean call, 1 on an error, 2 on a missing or unreadable file, and prints JSON on request', () => {
    const ok = path.join(tmp, 'ok.json');
    fs.writeFileSync(ok, JSON.stringify({ arguments: clean }));
    const good = spawnSync(process.execPath, [SCRIPT, ok, '--output-dir', outputDir, '--json'], { encoding: 'utf8' });
    expect(good.status, good.stdout + good.stderr).toBe(0);
    expect((JSON.parse(good.stdout) as Result).findings).toEqual([]);

    const bad = path.join(tmp, 'bad.json');
    fs.writeFileSync(bad, JSON.stringify({ ...clean, aspectRatio: '7:3' }));
    expect(spawnSync(process.execPath, [SCRIPT, bad], { encoding: 'utf8' }).status).toBe(1);
    expect(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status).toBe(2);
    expect(spawnSync(process.execPath, [SCRIPT, path.join(tmp, 'missing.json')], { encoding: 'utf8' }).status).toBe(2);
    const broken = path.join(tmp, 'broken.json');
    fs.writeFileSync(broken, '{ not json');
    expect(spawnSync(process.execPath, [SCRIPT, broken], { encoding: 'utf8' }).status).toBe(2);
  });

  it('accepts the arguments bare or wrapped, and prints a readable line per finding and one line of estimate', () => {
    const file = path.join(tmp, 'bare.json');
    fs.writeFileSync(file, JSON.stringify({ ...clean, provider: 'seedream', imageSize: '4K' }));
    const r = spawnSync(process.execPath, [SCRIPT, file], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/error\s+image-size/);
    expect(r.stdout).toMatch(/estimate:/);
  });

  it('writes nothing: the project and the output folder are the same before and after', () => {
    const png = source('packshot.png');
    const file = path.join(tmp, 'call.json');
    fs.writeFileSync(file, JSON.stringify({ ...clean, inputImagePaths: [png] }));
    const before = fs.readdirSync(project, { recursive: true }).join('|');
    spawnSync(process.execPath, [SCRIPT, file, '--project', project, '--output-dir', outputDir], { encoding: 'utf8' });
    expect(fs.readdirSync(project, { recursive: true }).join('|')).toBe(before);
  });
});

describe('call-check: the fields the server accepts, and the limits of each provider (mcp-image 0.18.0)', () => {
  it('refuses the three retired input fields by name', async () => {
    const { checkCall } = await api();
    for (const field of ['inputImagePath', 'inputImage', 'inputImageMimeType']) {
      const r = checkCall({ ...clean, [field]: 'x' });
      expect(codes(r, 'error'), field).toContain('retired-field');
      expect(r.findings.find(f => f.code === 'retired-field')!.field).toBe(field);
    }
  });

  it('holds the prompt to 1 to 4,000 characters of text, and warns about text, logos and names asked of the picture', async () => {
    const { checkCall } = await api();
    expect(codes(checkCall({ ...clean, prompt: '' }), 'error')).toContain('prompt');
    expect(codes(checkCall({ ...clean, prompt: 42 }), 'error')).toContain('prompt');
    expect(codes(checkCall({ ...clean, prompt: 'x'.repeat(4001) }), 'error')).toContain('prompt');
    expect(codes(checkCall({ ...clean, prompt: 'x'.repeat(4000) }), 'error')).not.toContain('prompt');
    for (const risky of ['A sign that says "OPEN 24 HOURS" over the door.', 'The brand logo on the box.', 'A slogan across the top.', 'A portrait of a happy customer named Sarah.']) {
      expect(codes(checkCall({ ...clean, prompt: risky }), 'warn'), risky).toContain('prompt-content');
    }
    expect(codes(checkCall(clean))).not.toContain('prompt-content');
  });

  it('knows the three providers and the three qualities, and takes the server default when none is given', async () => {
    const { checkCall } = await api();
    expect(codes(checkCall({ ...clean, provider: 'midjourney' }), 'error')).toContain('provider');
    expect(codes(checkCall({ ...clean, quality: 'ultra' }), 'error')).toContain('quality');
    for (const provider of ['gemini', 'openai', 'seedream']) expect(codes(checkCall({ ...clean, provider }), 'error'), provider).toEqual([]);
    expect(checkCall(clean).estimate.provider).toBe('gemini');
    expect(checkCall(clean, { defaultProvider: 'openai' }).estimate.provider).toBe('openai');
  });

  it('checks the ratio against the 14 the tool lists and against each provider: OpenAI has none beyond 3:1, the Pro model has no 1:4, 1:8, 4:1 or 8:1', async () => {
    const { checkCall } = await api();
    expect(codes(checkCall({ ...clean, aspectRatio: '7:3' }), 'error')).toContain('aspect-ratio');
    for (const ratio of ['1:4', '1:8', '4:1', '8:1']) {
      expect(codes(checkCall({ ...clean, provider: 'openai', aspectRatio: ratio }), 'error'), `openai ${ratio}`).toContain('aspect-ratio');
      expect(codes(checkCall({ ...clean, quality: 'quality', aspectRatio: ratio }), 'error'), `gemini quality ${ratio}`).toContain('aspect-ratio');
      expect(codes(checkCall({ ...clean, aspectRatio: ratio }), 'error'), `gemini fast ${ratio}`).not.toContain('aspect-ratio');
      expect(codes(checkCall({ ...clean, provider: 'seedream', aspectRatio: ratio }), 'error'), `seedream ${ratio}`).not.toContain('aspect-ratio');
    }
    expect(codes(checkCall({ ...clean, provider: 'openai', aspectRatio: '21:9' }), 'error')).not.toContain('aspect-ratio');
  });

  it('checks the size: 1K, 2K or 4K, and no 4K on Seedream; and warns when it is left out, because the estimate and the placement depend on it', async () => {
    const { checkCall } = await api();
    expect(codes(checkCall({ ...clean, imageSize: '8K' }), 'error')).toContain('image-size');
    expect(codes(checkCall({ ...clean, provider: 'seedream', imageSize: '4K' }), 'error')).toContain('image-size');
    for (const provider of ['gemini', 'openai']) expect(codes(checkCall({ ...clean, provider, imageSize: '4K' }), 'error'), provider).not.toContain('image-size');
    const { imageSize: _dropped, ...noSize } = clean;
    expect(codes(checkCall(noSize), 'warn')).toContain('image-size-missing');
  });

  it('allows Google Search grounding on Gemini only', async () => {
    const { checkCall } = await api();
    expect(codes(checkCall({ ...clean, useGoogleSearch: true }), 'error')).toEqual([]);
    for (const provider of ['openai', 'seedream']) expect(codes(checkCall({ ...clean, provider, useGoogleSearch: true }), 'error'), provider).toContain('google-search');
    expect(codes(checkCall({ ...clean, provider: 'openai', useGoogleSearch: false }), 'error')).toEqual([]);
  });

  it('warns about a field the tool does not have', async () => {
    const { checkCall } = await api();
    expect(codes(checkCall({ ...clean, negativePrompt: 'blurry' }), 'warn')).toContain('unknown-field');
  });
});

describe('call-check: the file name, and an image that is already there', () => {
  it('refuses a name with a path in it, and refuses to overwrite a file of the same name in the output folder, with or without an extension', async () => {
    const { checkCall } = await api();
    for (const bad of ['../hero', 'assets/hero', 'C:\\hero', 'hero\0']) expect(codes(checkCall({ ...clean, fileName: bad }), 'error'), JSON.stringify(bad)).toContain('file-name');
    fs.writeFileSync(path.join(outputDir, 'petpal-hero-sofa-a1.png'), 'x');
    expect(codes(checkCall(clean, { outputDir }), 'error')).toContain('overwrite');
    expect(codes(checkCall({ ...clean, fileName: 'petpal-hero-sofa-a1.png' }, { outputDir }), 'error')).toContain('overwrite');
    expect(codes(checkCall({ ...clean, fileName: 'petpal-hero-sofa-a2' }, { outputDir }), 'error')).not.toContain('overwrite');
  });

  it('warns when the name is left out, because the server then invents one that no record names', async () => {
    const { checkCall } = await api();
    const { fileName: _dropped, ...noName } = clean;
    expect(codes(checkCall(noName), 'warn')).toContain('file-name-missing');
  });
});

describe('call-check: the input images, the guard the server does not have', () => {
  it('passes a file inside the project that exists, with a supported extension', async () => {
    const { checkCall } = await api();
    const png = source('packshot.png');
    const r = checkCall({ ...clean, inputImagePaths: [png] }, { projectRoot: project });
    expect(codes(r, 'error')).toEqual([]);
  });

  it('refuses a file outside the project, and says which one, even when it exists and is a picture', async () => {
    const { checkCall } = await api();
    const outside = path.join(tmp, 'Downloads', 'passport-scan.jpg');
    fs.mkdirSync(path.dirname(outside), { recursive: true });
    fs.writeFileSync(outside, 'x');
    const r = checkCall({ ...clean, inputImagePaths: [outside] }, { projectRoot: project });
    expect(codes(r, 'error')).toContain('input-outside-project');
    expect(r.findings.find(f => f.code === 'input-outside-project')!.message).toContain('passport-scan.jpg');
  });

  it('lets a file outside the project through as a warning when the user typed its full path (the option allow), and only that file', async () => {
    const { checkCall } = await api();
    const typed = path.join(tmp, 'Downloads', 'shoot.jpg');
    const other = path.join(tmp, 'Downloads', 'other.jpg');
    fs.mkdirSync(path.dirname(typed), { recursive: true });
    fs.writeFileSync(typed, 'x');
    fs.writeFileSync(other, 'x');
    const allowed = checkCall({ ...clean, inputImagePaths: [typed] }, { projectRoot: project, allow: [typed] });
    expect(codes(allowed, 'error')).toEqual([]);
    expect(codes(allowed, 'warn')).toContain('input-outside-project-typed');
    expect(allowed.findings.find(f => f.code === 'input-outside-project-typed')!.message).toContain('goes to gemini');
    const both = checkCall({ ...clean, inputImagePaths: [typed, other] }, { projectRoot: project, allow: [typed] });
    expect(codes(both, 'error')).toEqual(['input-outside-project']);
    expect(both.findings.find(f => f.code === 'input-outside-project')!.message).toContain('other.jpg');
    // without the option the file is still refused, as the server would not refuse it
    expect(codes(checkCall({ ...clean, inputImagePaths: [typed] }, { projectRoot: project }), 'error')).toContain('input-outside-project');
    // and the message of the refusal says what lets a file go
    expect(both.findings.find(f => f.code === 'input-outside-project')!.message).toMatch(/pass it only if the user typed its full path in this task \(--allow\)/);
  });

  it('does not let the option excuse a file inside the project, and says nothing about one inside it', async () => {
    const { checkCall } = await api();
    const png = source('packshot.png');
    const r = checkCall({ ...clean, inputImagePaths: [png] }, { projectRoot: project, allow: [png] });
    expect(codes(r)).not.toContain('input-outside-project-typed');
    expect(codes(r, 'error')).toEqual([]);
  });

  it('reads the option on the command line, once for each path: exit 0 with a warning for the typed path, 1 for any other, 2 for an option without a value', () => {
    const typed = path.join(tmp, 'Downloads', 'shoot.jpg');
    const other = path.join(tmp, 'Downloads', 'other.jpg');
    fs.mkdirSync(path.dirname(typed), { recursive: true });
    fs.writeFileSync(typed, 'x');
    fs.writeFileSync(other, 'x');
    const call = path.join(tmp, 'call.json');
    fs.writeFileSync(call, JSON.stringify({ ...clean, inputImagePaths: [typed, other] }));
    const run = (extra: string[]) => spawnSync(process.execPath, [SCRIPT, call, '--project', project, '--output-dir', outputDir, ...extra], { encoding: 'utf8' });
    const one = run(['--allow', typed]);
    expect(one.status).toBe(1);
    expect(one.stdout).toMatch(/^warn {3}input-outside-project-typed {2}inputImagePaths\[0\]/m);
    expect(one.stdout).toMatch(/^error {2}input-outside-project {2}inputImagePaths\[1\]/m);
    const both = run(['--allow', typed, '--allow', other]);
    expect(both.status).toBe(0);
    expect([...both.stdout.matchAll(/^warn {3}input-outside-project-typed/gm)]).toHaveLength(2);
    expect(run([]).status).toBe(1);
    expect(run(['--allow']).status).toBe(2);
  });

  it.skipIf(process.platform !== 'win32')('compares a typed path without regard to case on Windows, where a path is the same path in any case', async () => {
    const { checkCall } = await api();
    const typed = path.join(tmp, 'Downloads', 'shoot.jpg');
    fs.mkdirSync(path.dirname(typed), { recursive: true });
    fs.writeFileSync(typed, 'x');
    const r = checkCall({ ...clean, inputImagePaths: [typed] }, { projectRoot: project, allow: [typed.toUpperCase()] });
    expect(codes(r, 'error')).toEqual([]);
    expect(codes(r, 'warn')).toContain('input-outside-project-typed');
  });

  it('refuses an input image when it is not told where the project is, because it cannot tell inside from outside', async () => {
    const { checkCall } = await api();
    const r = checkCall({ ...clean, inputImagePaths: [source('packshot.png')] });
    expect(codes(r, 'error')).toContain('input-project-unknown');
  });

  it('refuses a relative path, a path with .., a missing file, a folder, an unsupported extension and a file over 10 MiB', async () => {
    const { checkCall } = await api();
    const opts = { projectRoot: project };
    expect(codes(checkCall({ ...clean, inputImagePaths: ['assets/source/packshot.png'] }, opts), 'error')).toContain('input-relative');
    source('packshot.png');
    // path.join would normalise the ".." away; the model writes the string as it is
    const withDots = `${path.join(project, 'assets', 'source')}${path.sep}..${path.sep}source${path.sep}packshot.png`;
    expect(withDots).toContain('..');
    expect(codes(checkCall({ ...clean, inputImagePaths: [withDots] }, opts), 'error')).toContain('input-traversal');
    expect(codes(checkCall({ ...clean, inputImagePaths: [path.join(project, 'assets', 'source', 'nothing.png')] }, opts), 'error')).toContain('input-missing');
    expect(codes(checkCall({ ...clean, inputImagePaths: [path.join(project, 'assets', 'source')] }, opts), 'error')).toContain('input-missing');
    expect(codes(checkCall({ ...clean, inputImagePaths: [source('moodboard.gif')] }, opts), 'error')).toContain('input-extension');
    const big = path.join(project, 'assets', 'source', 'big.png');
    fs.closeSync(fs.openSync(big, 'w'));
    fs.truncateSync(big, 10 * 1024 * 1024 + 1);
    expect(codes(checkCall({ ...clean, inputImagePaths: [big] }, opts), 'error')).toContain('input-size');
    fs.truncateSync(big, 10 * 1024 * 1024);
    expect(codes(checkCall({ ...clean, inputImagePaths: [big] }, opts), 'error')).not.toContain('input-size');
  });

  it('holds the count to the provider: 14 for Gemini, 16 for OpenAI, 10 for Seedream; an empty list is an error', async () => {
    const { checkCall } = await api();
    const many = (n: number): string[] => Array.from({ length: n }, (_, i) => source(`ref-${i}.png`));
    const opts = { projectRoot: project };
    expect(codes(checkCall({ ...clean, inputImagePaths: many(14) }, opts), 'error')).not.toContain('input-count');
    expect(codes(checkCall({ ...clean, inputImagePaths: many(15) }, opts), 'error')).toContain('input-count');
    expect(codes(checkCall({ ...clean, provider: 'openai', inputImagePaths: many(16) }, opts), 'error')).not.toContain('input-count');
    expect(codes(checkCall({ ...clean, provider: 'openai', inputImagePaths: many(17) }, opts), 'error')).toContain('input-count');
    expect(codes(checkCall({ ...clean, provider: 'seedream', inputImagePaths: many(10) }, opts), 'error')).not.toContain('input-count');
    expect(codes(checkCall({ ...clean, provider: 'seedream', inputImagePaths: many(11) }, opts), 'error')).toContain('input-count');
    expect(codes(checkCall({ ...clean, inputImagePaths: [] }, opts), 'error')).toContain('input-count');
    expect(codes(checkCall({ ...clean, inputImagePaths: 'a.png' }, opts), 'error')).toContain('input-count');
  });

  it('takes WebP everywhere but Seedream, which takes PNG and JPEG only', async () => {
    const { checkCall } = await api();
    const webp = source('ref.webp');
    const opts = { projectRoot: project };
    expect(codes(checkCall({ ...clean, inputImagePaths: [webp] }, opts), 'error')).toEqual([]);
    expect(codes(checkCall({ ...clean, provider: 'openai', inputImagePaths: [webp] }, opts), 'error')).toEqual([]);
    expect(codes(checkCall({ ...clean, provider: 'seedream', inputImagePaths: [webp] }, opts), 'error')).toContain('input-extension');
  });

  it('warns about a file whose name says it is a document, an identity picture or a screen, and asks for the user\'s word', async () => {
    const { checkCall } = await api();
    for (const name of ['passport.png', 'driving-licence.jpg', 'id-card-front.png', 'bank-statement.png', 'screenshot-2026-10-09.png', 'selfie.jpg', 'invoice-0042.png']) {
      const r = checkCall({ ...clean, inputImagePaths: [source(name)] }, { projectRoot: project });
      expect(codes(r, 'warn'), name).toContain('input-sensitive-name');
      expect(codes(r, 'error'), name).toEqual([]);
    }
    expect(codes(checkCall({ ...clean, inputImagePaths: [source('packshot.png')] }, { projectRoot: project }), 'warn')).not.toContain('input-sensitive-name');
  });

  it.skipIf(process.platform === 'win32')('resolves a link before it judges the path: a link inside the project to a file outside it is outside', async () => {
    const { checkCall } = await api();
    const outside = path.join(tmp, 'private.png');
    fs.writeFileSync(outside, 'x');
    const link = path.join(project, 'assets', 'source', 'innocent.png');
    fs.symlinkSync(outside, link);
    expect(codes(checkCall({ ...clean, inputImagePaths: [link] }, { projectRoot: project }), 'error')).toContain('input-outside-project');
  });
});

describe('call-check: the inside test is exact', () => {
  it('counts only a real parent segment as outside: a folder or file whose name starts with two dots is inside', async () => {
    const mod = (await api()) as unknown as { isInside: (root: string, file: string) => boolean };
    const root = path.resolve(tmp, 'p');
    expect(mod.isInside(root, root)).toBe(true);
    expect(mod.isInside(root, path.join(root, 'assets', 'source', 'a.png'))).toBe(true);
    expect(mod.isInside(root, path.join(root, '..cache', 'a.png'))).toBe(true);
    expect(mod.isInside(root, path.join(root, '..a.png'))).toBe(true);
    expect(mod.isInside(root, path.resolve(root, '..'))).toBe(false);
    expect(mod.isInside(root, path.resolve(root, '..', 'q', 'a.png'))).toBe(false);
    expect(mod.isInside(root, path.resolve(tmp, 'pp', 'a.png'))).toBe(false);
  });
});

describe('call-check: the estimate for the go-ahead', () => {
  it('prices Gemini by model and size: $0.0336, $0.0504 and $0.113 on the default model, $0.134 and $0.24 on the Pro model', async () => {
    const { checkCall } = await api();
    const at = (quality: string, imageSize: string, images = 1): Result['estimate'] => checkCall({ ...clean, quality, imageSize }, { images }).estimate;
    expect(at('fast', '1K').perImageUsd).toBe(0.0336);
    expect(at('fast', '2K').perImageUsd).toBe(0.0504);
    expect(at('balanced', '4K').perImageUsd).toBe(0.113);
    expect(at('quality', '1K').perImageUsd).toBe(0.134);
    expect(at('quality', '2K').perImageUsd).toBe(0.134);
    expect(at('quality', '4K').perImageUsd).toBe(0.24);
    expect(at('fast', '2K').model).toBe('gemini-nano-banana-2.1');
    expect(at('quality', '2K').model).toBe('gemini-3-pro-image');
    const two = at('fast', '2K', 2);
    expect(two.totalUsd).toBe(0.1008);
    expect(two.worstCaseUsd).toBe(0.3024);
  });

  it('prices Seedream at $0.045 up to 1K-class and $0.09 above, plus $0.003 for each reference image after the first', async () => {
    const { checkCall } = await api();
    expect(checkCall({ ...clean, provider: 'seedream', imageSize: '1K' }).estimate.perImageUsd).toBe(0.045);
    expect(checkCall({ ...clean, provider: 'seedream', imageSize: '2K' }).estimate.perImageUsd).toBe(0.09);
    const refs = ['a.png', 'b.png', 'c.png'].map(n => source(n));
    const r = checkCall({ ...clean, provider: 'seedream', imageSize: '2K', inputImagePaths: refs }, { projectRoot: project });
    expect(r.estimate.perImageUsd).toBe(0.096);
    expect(r.estimate.model).toBe('dola-seedream-5-0-pro-260628');
  });

  it('gives no price for OpenAI, says why, and names the first image as the probe', async () => {
    const { checkCall } = await api();
    const e = checkCall({ ...clean, provider: 'openai' }, { images: 2 }).estimate;
    expect(e.perImageUsd).toBeNull();
    expect(e.totalUsd).toBeNull();
    expect(e.basis).toBe('unpublished');
    expect(e.note).toMatch(/probe|first image/i);
    expect(e.model).toBe('gpt-image-2.5-flare');
    expect(checkCall({ ...clean, provider: 'openai', quality: 'quality' }).estimate.model).toBe('gpt-image-2.5-sunburst');
  });
});
