import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, 2026-10-13: the wiring of the three image providers of `mcp-image@0.18.0`, checked with the server itself and no real key. The maintainer holds a Gemini key only, so the live tests of OpenAI and
 * Seedream cannot be run; what can be run is the server: it starts, lists its one tool, routes a call to the provider the call names (or to `IMAGE_PROVIDER`), says "not configured" for a provider whose key is
 * missing, and answers 401 (400 for Google) from the provider's own API when the key is made up. No image was made. This suite makes the observation checkable against the kept output, and pins the
 * ROADMAP entry that holds what is left: the real generation tests for the providers without a tested key.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-13-mcp-image-0.18.0-provider-wiring-smoke.md';
const RECORDS = path.join(OBS_DIR, '2026-10-13-provider-wiring-smoke-records');

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(path.join(OBS_DIR, NAME));
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

interface Block { content: Array<{ type: string; text: string }>; isError?: boolean }
interface Failure { code: string; message: string; suggestion?: string; details?: { provider?: string; statusCode?: number; stage?: string; upstreamMessage?: string } }
type Result = Record<string, unknown> & { server?: { name: string; version: string }; tools?: { tools: Array<{ name: string; inputSchema: { properties: Record<string, { enum?: string[] }> } }> }; stderr?: string[] };

const results = (): Record<string, Result> => {
  const raw = text(path.join(RECORDS, 'results.txt'));
  const out: Record<string, Result> = {};
  for (const part of raw.split(/^=== /m).slice(1)) {
    const name = part.slice(0, part.indexOf('\n'));
    if (name.startsWith('images written')) continue;
    out[name] = JSON.parse(part.slice(part.indexOf('\n') + 1)) as Result;
  }
  return out;
};
const failure = (block: unknown): Failure => (JSON.parse((block as Block).content[0]!.text) as { error: Failure }).error;

describe('the provider wiring of mcp-image 0.18.0: the kept output', () => {
  it('lists one tool, generate_image, whose provider field takes gemini, openai and seedream, on the pinned version', () => {
    const r = results().list!;
    expect(r.server).toEqual({ name: 'mcp-image-server', version: '0.18.0' });
    expect(r.tools!.tools.map(t => t.name)).toEqual(['generate_image']);
    expect(r.tools!.tools[0]!.inputSchema.properties.provider!.enum).toEqual(['gemini', 'openai', 'seedream']);
  });

  it('says "not configured" for a provider named without its key, asks for that key and a restart, and makes no call to the provider', () => {
    for (const [label, provider, variable] of [['openai-nokey', 'openai', 'OPENAI_API_KEY'], ['seedream-nokey', 'seedream', 'ARK_API_KEY']] as const) {
      const call = results()[label]!.call as Block;
      const e = failure(call);
      expect(call.isError, label).toBe(true);
      expect(e.code, label).toBe('CONFIG_ERROR');
      expect(e.message, label).toBe(`The selected image provider "${provider}" is not configured on this server.`);
      expect(e.suggestion, label).toContain(`configure ${variable} and restart the MCP server`);
      expect(e.suggestion, label).toContain(`retry generate_image with provider "${provider}"`);
      expect(e.details, label).toBeUndefined();
    }
  });

  it('reaches the provider of the call with a made-up key and returns the provider\'s own refusal: OpenAI 401, Seedream 401, Gemini 400', () => {
    const r = results();
    const openai = failure(r['openai-fake']!.call);
    expect(openai).toMatchObject({ code: 'IMAGE_API_ERROR', message: 'Failed to generate image with OpenAI', details: { provider: 'openai', statusCode: 401 } });
    expect(openai.details!.upstreamMessage).toMatch(/Incorrect API key provided: FAKE_OPE\*+TEST/);
    expect(failure(r['seedream-fake']!.call)).toMatchObject({ code: 'IMAGE_API_ERROR', message: 'Seedream image request was rejected', details: { provider: 'seedream', stage: 'image_request', statusCode: 401 } });
    const gemini = failure(r['gemini-fake']!.call);
    expect(gemini).toMatchObject({ code: 'GEMINI_API_ERROR', details: { provider: 'gemini', statusCode: 400 } });
    expect(gemini.details!.upstreamMessage).toMatch(/API key not valid/);
  });

  it('takes the default provider from IMAGE_PROVIDER when a call names none, and the provider of the call when it names one (three keys on one server)', () => {
    const r = results();
    expect(failure(r['default-openai']!.call).details).toMatchObject({ provider: 'openai', statusCode: 401 });
    expect(failure(r['multi-keys']!['call-openai']).details).toMatchObject({ provider: 'openai', statusCode: 401 });
    expect(failure(r['multi-keys']!['call-seedream']).details).toMatchObject({ provider: 'seedream', statusCode: 401 });
    const byDefault = failure(r['multi-keys']!['call-default']);
    expect(byDefault.details).toMatchObject({ provider: 'gemini', statusCode: 400 });
  });

  it('made no image: every call failed, and the run counted none', () => {
    const raw = text(path.join(RECORDS, 'results.txt'));
    expect(raw).toMatch(/^=== images written: 0$/m);
    const blocks: Block[] = Object.values(results()).flatMap(r => [r.call, r['call-openai'], r['call-seedream'], r['call-default']].filter(Boolean) as Block[]);
    expect(blocks).toHaveLength(9);
    for (const b of blocks) expect(b.isError).toBe(true);
  });

  it('keeps the script, which gives the server a whitelist of the environment and made-up keys only, and the pinned package', () => {
    const script = text(path.join(RECORDS, 'mcp-smoke.mjs'));
    expect(script).toContain("const PKG = 'mcp-image@0.18.0';");
    expect(script).toMatch(/const KEEP = \[/);
    expect(script).toContain("FAKE_GEMINI_KEY_FOR_A_WIRING_TEST");
    expect(script).not.toMatch(/process\.env\.(GEMINI|OPENAI|ARK|ANTHROPIC)_API_KEY/);
    expect(script).not.toMatch(/\.\.\.process\.env/);
    expect(script).toContain('is not empty: use a fresh folder');
    const reference = text(path.resolve('registry/skills/mcp-setup/references/claude-code.md'));
    expect(reference).toContain('npx -y mcp-image@0.18.0');
  });

  it('holds no key shape and no personal string, in the records or the observation', () => {
    const files = [path.join(OBS_DIR, NAME), ...walk(RECORDS)];
    expect(files).toHaveLength(3);
    for (const f of files) {
      const t = text(f);
      const rel = path.relative(OBS_DIR, f);
      expect(t, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} personal string`).not.toMatch(/gmail\.com|AppData[\\/]|[\\/]Users[\\/]ozy|Europe\/Berlin|altay|\bozy\b|bridgeSession|ownerAccount/i);
    }
  });
});

describe('the observation and the roadmap say what was checked and what is left', () => {
  it('says it is an observation of an installed package, names the version, the method, the made-up keys, and that no image was made', () => {
    const o = observation();
    expect(o).toMatch(/observations of installed builds, not documentation/i);
    expect(o).toContain('mcp-image@0.18.0');
    expect(o).toMatch(/whitelist of the environment/);
    expect(o).toMatch(/made-up keys/);
    expect(o).toMatch(/\*\*No image was made\*\*/);
    expect(o).toMatch(/the maintainer holds a Gemini key only/i);
  });

  it('has one row for each of the eight cases, with the code and the status that the kept output shows', () => {
    const o = observation();
    for (const label of ['list', 'openai-nokey', 'seedream-nokey', 'openai-fake', 'seedream-fake', 'gemini-fake', 'default-openai', 'multi-keys']) expect(o, label).toContain(`| \`${label}\` |`);
    expect(o).toMatch(/`CONFIG_ERROR`/);
    expect(o).toMatch(/`IMAGE_API_ERROR`/);
    expect(o).toMatch(/`GEMINI_API_ERROR`/);
    expect(o).toMatch(/\*\*Not established\*\*|## Not established/);
    for (const open of ['A real image with OpenAI', 'A real image with Seedream', 'inputImagePaths']) expect(o, open).toContain(open);
  });

  it('flags that OpenAI\'s refusal echoes the beginning and the end of the key, which the designer would see in a tool result', () => {
    const o = observation();
    expect(o).toMatch(/echoes? the (first|beginning)[^\n]*(last|end)[^\n]*of the key/i);
    expect(o).toMatch(/not changed here|left to the maintainer/i);
  });

  it('is pointed to from the mcp-setup reference, and the ROADMAP holds the real generation tests as a planned milestone', () => {
    expect(text(path.resolve('registry/skills/mcp-setup/references/claude-code.md'))).toContain(NAME);
    const roadmap = text(path.resolve('ROADMAP.md'));
    const start = roadmap.indexOf('## Milestone 4 — Image Route: Real Generation Tests for the Providers Without a Tested Key');
    expect(start).toBeGreaterThan(-1);
    const section = roadmap.slice(start, roadmap.indexOf('\n---\n', start));
    expect(section).toMatch(/\*\*Status\*\*: `🔲 Planned`/);
    expect(section).toContain(NAME);
    expect(section).toMatch(/- \[x\] Wiring smoke test/);
    expect(section).toMatch(/- \[ \] \*\*OpenAI\*\*: one real image/);
    expect(section).toMatch(/- \[ \] \*\*Seedream\*\*: one real image/);
    expect(section).toMatch(/- \[ \] Gemini end to end/);
    expect(section).toMatch(/\*\*Blocked by\*\*/);
    expect(roadmap).toMatch(/\*Last updated: 2026-10-13 \| Maintained by: NeoAnthropocene\*/);
  });
});
