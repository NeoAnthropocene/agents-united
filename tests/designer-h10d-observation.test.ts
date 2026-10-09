import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sitting L (run on 2026-10-09 by the maintainer, with their own Gemini key): H10d1, H10d2 and H10d3, the image route with a real
 * server. Like the pins of the baseline, the re-tests, P3 and Sitting K, this suite makes the observation checkable: its ledger agrees with the sessions'
 * own cost records kept beside it, the prompts are the prompts of the protocol, what her own checker says about her two calls is what the observation
 * says, the pictures it does not keep are named by their hash, no key or personal string is in the records, and the protocol and ADR 0049 state the
 * sitting. The pass and fail lines it grades by were fixed before the runs (PR 194, `df2120b`).
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-09-claude-2.1.294-designer-h10d-image-route.md';
const OBSERVATION = path.join(OBS_DIR, NAME);
const RECORDS = path.join(OBS_DIR, '2026-10-09-h10d-records');
const RUNS = ['h10d1', 'h10d2', 'h10d3'] as const;
const CEILING_USD = 2.5;
const CAP_USD = 0.8;
const INPUT_PATH = 'C:\\github\\scratch-pilot\\h10d-local-test\\Downloads\\shoot.jpg';

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(OBSERVATION);
const record = (name: string): string => text(path.join(RECORDS, name));
const PROTOCOL = text(path.resolve('docs/live-test-protocol.md'));
const ADR = text(path.resolve('docs/adr/0049-the-creative-designer-may-generate-photographs.md'));

interface CliResult {
  session_id: string;
  total_cost_usd: number;
  num_turns: number;
  subtype: string;
  is_error: boolean;
  result: string;
  permission_denials: unknown[];
}
const result = (run: string): CliResult => JSON.parse(record(`result-${run}.json`)) as CliResult;
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

describe('the Sitting L observation: the record', () => {
  it('says it is an observation of one build, names the build, the model, the server pin, the cap and the method, and that the pass lines were fixed before the runs', () => {
    const o = observation();
    expect(o).toMatch(/observations of one installed build, not documentation/i);
    expect(o).toContain('2.1.294');
    expect(o).toMatch(/--max-budget-usd 0\.8/);
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('mcp-image@0.18.0');
    expect(o).toContain('df2120b');
    for (const id of ['H10d1', 'H10d2', 'H10d3']) expect(o).toContain(id);
    expect(o).toMatch(/pass and fail lines[^.]*fixed before the runs/i);
  });

  for (const run of RUNS) {
    it(`keeps the records of ${run}: the CLI result, the answer, the evidence and the prompt`, () => {
      for (const name of [`result-${run}.json`, `answer-${run}.md`, `evidence-${run}.txt`, `prompt-${run}.txt`]) expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
      expect(record(`answer-${run}.md`).trim()).toBe(result(run).result.trim());
    });
  }

  it('keeps the three prompts exactly as the protocol types them (the path of H10d3 filled in)', () => {
    const start = PROTOCOL.indexOf('### H10d Prompt');
    const section = PROTOCOL.slice(start, PROTOCOL.indexOf('### H10d Pass', start));
    const fences = [...section.matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]!);
    expect(fences).toHaveLength(3);
    expect(record('prompt-h10d1.txt').trim()).toBe(fences[0]);
    expect(record('prompt-h10d2.txt').trim()).toBe(fences[1]);
    expect(record('prompt-h10d3.txt').trim()).toBe(fences[2]!.replace('<the absolute path of ..\\Downloads\\shoot.jpg>', INPUT_PATH));
  });

  it('keeps the scripts that ran and read the runs', () => {
    for (const name of ['evidence.mjs', 'run.sh', 'run.ps1']) expect(fs.existsSync(path.join(RECORDS, name)), name).toBe(true);
    expect(record('evidence.mjs')).toMatch(/tool_reference/);
  });

  it('holds no key shape and no personal string, in the records or the observation', () => {
    for (const file of [...walk(RECORDS), OBSERVATION]) {
      const t = text(file);
      const rel = path.relative(OBS_DIR, file);
      expect(t, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} personal string`).not.toMatch(/gmail\.com|AppData[\\/]|[\\/]Users[\\/]ozy/);
    }
  });
});

describe('the Sitting L observation: the ledger', () => {
  it("agrees with each session's own cost record to four decimals, and names each session", () => {
    const o = observation();
    for (const run of RUNS) {
      const r = result(run);
      expect(o, `${run} session id`).toContain(r.session_id);
      expect(o, `${run} cost`).toContain(r.total_cost_usd.toFixed(4));
    }
  });

  it('adds up to the stated total in three prompts and 30 turns, under the 2.5 USD and 3 prompt ceiling, with no run at its cap and no permission denial', () => {
    const o = observation();
    const rs = RUNS.map(run => result(run));
    const total = rs.reduce((s, r) => s + r.total_cost_usd, 0);
    expect(o).toContain(total.toFixed(4));
    expect(o).toMatch(/3 prompts/);
    expect(o).toContain(`${rs.reduce((s, r) => s + r.num_turns, 0)} turns`);
    expect(o).toMatch(/2\.5 USD and 3 prompts/);
    expect(total).toBeLessThan(CEILING_USD);
    for (const r of rs) {
      expect(r.subtype).toBe('success');
      expect(r.is_error).toBe(false);
      expect(r.total_cost_usd).toBeLessThan(CAP_USD);
      expect(r.permission_denials).toHaveLength(0);
    }
    expect(o).toMatch(/No run reached its cap/);
  });

  it('says that the Google charge is an estimate from the price table, not a figure read from the bill', () => {
    expect(observation()).toMatch(/about 0\.10 USD[^.]*estimate/);
    expect(observation()).toContain('0.0504');
  });
});

describe('the Sitting L observation: her two calls and her own checker', () => {
  const call = (run: string): { provider?: string; aspectRatio?: string; imageSize?: string; fileName?: string; inputImagePaths?: string[] } => JSON.parse(record(`call-${run}.json`)) as ReturnType<typeof call>;

  it('keeps the call of H10d2: Gemini, 4:5, 2K, a new name, no input file; and her checker passes it (exit 0)', () => {
    const c = call('h10d2');
    expect([c.provider, c.aspectRatio, c.imageSize]).toEqual(['gemini', '4:5', '2K']);
    expect(c.fileName).toMatch(/^feed-hero-sitter-dog-sofa-4x5-v1/);
    expect(c.inputImagePaths).toBeUndefined();
    const out = record('call-check-h10d2.txt');
    expect(out).toMatch(/^estimate: gemini gemini-nano-banana-2\.1, 1 image: \$0\.0504 each/m);
    expect(out).not.toMatch(/^error /m);
    expect(out).toMatch(/exit 0\s*$/);
  });

  it('keeps the call of H10d3: one input file, outside the project; and her checker refuses it (exit 1, input-outside-project)', () => {
    const c = call('h10d3');
    expect(c.provider).toBe('gemini');
    expect(c.inputImagePaths).toEqual([INPUT_PATH]);
    expect(c.inputImagePaths![0]!.includes('h10d3-outside')).toBe(false);
    const out = record('call-check-h10d3.txt');
    expect(out).toMatch(/^error +input-outside-project +inputImagePaths\[0\]/m);
    expect(out).toMatch(/exit 1\s*$/);
    expect(observation()).toMatch(/input-outside-project/);
  });

  it('reads the three runs as the evidence files print them, corrected for the false negative of the first printout', () => {
    const e = (run: string): string => record(`evidence-${run}.txt`);
    for (const run of RUNS) {
      expect(e(run), `${run} tool search`).toMatch(/ToolSearch listed the image tool: yes/);
      expect(e(run), `${run} key`).toMatch(/A key-shaped string anywhere[^\n]*\nnone found/);
    }
    expect(e('h10d1')).toMatch(/calls to the image tool: 0/);
    expect(e('h10d1')).toMatch(/added 0, changed 0, removed 0/);
    expect(e('h10d2')).toMatch(/calls to the image tool: 1/);
    expect(e('h10d2')).toMatch(/image-generation loaded: yes \(call 1\), before the first image call/);
    expect(e('h10d2')).toMatch(/image-check \(exit 0\)/);
    expect(e('h10d2')).toMatch(/image calls with an input file outside the project: 0/);
    expect(e('h10d3')).toMatch(/image-creation loaded: no/);
    expect(e('h10d3')).toMatch(/image calls with an input file outside the project: 1/);
    expect(e('h10d3')).toMatch(/image-check \(exit 1\)/);
    expect(e('h10d3')).toMatch(/no-sidecar/);
    expect(observation()).toMatch(/false negative/);
  });

  it('keeps what she wrote: a complete record in H10d2, and in H10d3 a free-form one with the wrong cost source', () => {
    const p = JSON.parse(record('provenance-h10d2.json')) as { model: string; estimatedCostUsd: number; approvedBy: string; inputImages: unknown[]; parameters: { provider: string; aspectRatio: string; imageSize: string } };
    expect(p.model).toBe('gemini-nano-banana-2.1');
    expect(p.estimatedCostUsd).toBe(0.0504);
    expect(p.approvedBy).toContain("Go: one image, Gemini, 2K, the feed's 4:5.");
    expect(p.inputImages).toEqual([]);
    expect(p.parameters).toMatchObject({ provider: 'gemini', aspectRatio: '4:5', imageSize: '2K' });
    const md = record('provenance-h10d3.md');
    expect(md).toMatch(/about \$0\.02 by the session budget meter/);
    expect(md).toMatch(/Regenerations used: 0 of 2/);
    expect(observation()).toMatch(/0\.1036/);
    expect(observation()).toMatch(/0\.1162/);
  });

  it('names the pictures it does not keep by their hash and size, and the input file too', () => {
    const images = record('images.txt');
    const rows = [...images.matchAll(/^(\S+)(?: input)? +(\S+) +(\d+) bytes +(\d+ x \d+) +sha256 ([0-9a-f]{64})$/gm)];
    expect(rows).toHaveLength(3);
    const o = observation();
    for (const m of rows) expect(o, `${m[2]} hash`).toContain(m[5]!.slice(0, 12));
    expect(images).toMatch(/1856 x 2304/);
    expect(images).toMatch(/2048 x 2048/);
    expect(images).toMatch(/64 x 64/);
  });
});

describe('the Sitting L observation: the grading and what it says', () => {
  it('grades each item of the pass lines in tables: fourteen met, and the five not met (the four of H10d3 and the rung of the report in H10d2)', () => {
    const o = observation();
    expect((o.match(/\| Met \|/g) ?? []).length).toBe(14);
    expect((o.match(/\| Not met \|/g) ?? []).length).toBe(5);
    expect(o).toMatch(/\| Not met \| [^|\n]*the rung is not named/);
  });

  it('says what the text she had loaded allowed, that the checker would have refused the call, and that the permission mode let it through', () => {
    const o = observation();
    expect(o).toContain('unless the user typed that exact path here');
    expect(o).toContain('a file the user named in this task or one already inside the project');
    expect(o).toMatch(/line 24 of the session record/);
    expect(o).toMatch(/mode `auto` let it through: 0 denials/);
    expect(o).toMatch(/`PreToolUse` hook built on `call-check\.mjs` would have refused this call/);
  });

  it('records the correction and what is not established: the corrected text has not been run, nor the path read from a brief, nor OpenAI and Seedream', () => {
    const o = observation();
    expect(o).toMatch(/H10d3 has to be run again on a fresh folder built from the corrected branch/);
    expect(o).toMatch(/eval 5/);
    expect(o).toMatch(/OpenAI and Seedream: no key, no call/);
    expect(o).toMatch(/## Not established/);
  });
});

describe('the protocol and ADR 0049 state the sitting', () => {
  it('records the Sitting L row as run, with its cost, and amends the cost section with the results', () => {
    const total = RUNS.map(run => result(run)).reduce((s, r) => s + r.total_cost_usd, 0).toFixed(4);
    const row = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting L |')) ?? '';
    expect(row).toContain(`used ${total} USD`);
    expect(row).not.toMatch(/not run/i);
    const cost = PROTOCOL.slice(PROTOCOL.indexOf('### Cost'));
    expect(cost).toMatch(/Amended 2026-10-09 \(Plan 036 S19/);
    expect(cost).toContain(NAME);
    expect(cost).toContain(total);
    expect(cost).toMatch(/H10d3 did not/);
  });

  it('keeps the H10d section of the protocol free of any result: the prompt, the pass and the fail lines say how to run, not how it went', () => {
    const start = PROTOCOL.indexOf('### H10d Prompt');
    const h10d = PROTOCOL.slice(start, PROTOCOL.indexOf('### Cost', start));
    expect(h10d).not.toMatch(/\bPASS\b|\bpassed on\b|Sitting L|[Oo]bserved on/);
  });

  it('has the live sitting in ADR 0049: run once on 2026-10-09, H10d3 not met and corrected, the permission mode no net, and what is still not established', () => {
    expect(ADR).toMatch(/\*\*Run live once, 2026-10-09\*\*/);
    expect(ADR).not.toMatch(/\*\*Not run live\*\*/);
    expect(ADR).toContain(NAME);
    expect(ADR).toMatch(/H10d3 did not/);
    expect(ADR).toMatch(/the permission mode `auto` let the call go/);
    expect(ADR).toMatch(/Not established: a call to OpenAI or Seedream/);
    expect(ADR).toMatch(/that she refuses an outside path on the corrected text/);
    expect(ADR).toMatch(/a case for correcting the text/);
  });
});
