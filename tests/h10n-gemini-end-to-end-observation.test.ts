import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, Sitting X (H10n, run on 2026-10-13 by the maintainer, Claude Code 2.1.296): the Gemini route end to end in one session, with the maintainer's own key typed only into their own terminal.
 * The lead offered the choice, printed the command and did not run it; the maintainer ran it (first in their home folder, where Claude Code stored it under that folder's entry, then in the project folder, where
 * `claude mcp list` showed it Connected); after the restart the tool was in the pool of the lead and of Jamileh, neither pool listed `ListAgents`, and Jamileh made one image whose record the lead had to rename.
 * Like the pins of the earlier sittings, this suite makes the observation checkable: the ledger agrees with the kept cost record, the table of pass lines agrees with the kept records, the image's hash is the
 * same in two records, her call and her record agree, no record holds a key, and the fix of the printed block (a `cd` into the project folder) is pinned where the lead and the user read it.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const NAME = '2026-10-13-claude-2.1.296-gemini-end-to-end.md';
const RECORDS = path.join(OBS_DIR, '2026-10-13-gemini-end-to-end-records');
const SESSION = '4bfbec0f-9fcf-43ae-8d63-1e1e7befe6ea';

const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const observation = (): string => text(path.join(OBS_DIR, NAME));
const record = (name: string): string => text(path.join(RECORDS, name));
const json = (name: string): any => {
  const t = record(name);
  return JSON.parse(t.slice(t.indexOf('{')));
};
const PROTOCOL = text(path.resolve('docs/live-test-protocol.md'));
const ROADMAP = text(path.resolve('ROADMAP.md'));
const REFERENCE = text(path.resolve('registry/skills/mcp-setup/references/claude-code.md'));
const LEAD = text(path.resolve('registry/hosts/claude/agents/orchestrator-digital-agency.md'));
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const rowOf = (o: string, n: number): string => {
  const row = o.split('\n').find(l => l.startsWith(`| ${n} | `));
  expect(row, `row ${n}`).toBeTruthy();
  return row!;
};

describe('the Sitting X observation: the record', () => {
  it('says it is an observation of installed builds, names the build, the model, the session and the clone, and that the key was the maintainer\'s own and never the executor\'s', () => {
    const o = observation();
    expect(o).toMatch(/^# Claude Code 2\.1\.296: H10n, the Gemini route end to end/);
    expect(o).toMatch(/observations of installed builds, not documentation/);
    expect(o).toContain('`claude-sonnet-5-5`');
    expect(o).toContain(`\`${SESSION}\``);
    expect(o).toContain('`789e856`');
    expect(o).toMatch(/typed the key only into their own terminal; the executor never saw it and made no call with it/);
    expect(o).toMatch(/mcp-image@0\.18\.0|the one image tool/);
    expect(record('session-report.txt')).toContain(`# Session ${SESSION}`);
    expect(record('session-report.txt')).toMatch(/Claude Code 2\.1\.296 · agent orchestrator-digital-agency · permission mode auto/);
    expect(record('session-report.txt')).toMatch(/from 2026-10-13T11:31:26\.\d+Z to 2026-10-13T11:48:09\.\d+Z/);
  });

  it('keeps the cost in the ledger only, and the ledger agrees with the cost record kept beside it', () => {
    const cost = json('cost-state.txt');
    expect(cost.hasUnknownModelCost).toBe(false);
    expect(cost.totalCostUSD.toFixed(4)).toBe('1.0677');
    const row = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting X |'))!;
    expect(row).toContain('used 1.0677 USD of model cost by the session\'s own cost record');
    expect(observation()).toContain('1.0677 USD by the session\'s own cost record');
    expect(observation()).toMatch(/no longer interested in cost calculations/);
    expect(observation()).toMatch(/the bill was not read/i);
  });

  it('has the ten pass lines of H10n in order, each with a verdict, and the two lines with a defect or a repair say so', () => {
    const o = observation();
    const heads = ['opening is the line alone', 'four options', 'No teammate before the answer', 'printed command carries', 'lists `mcp__image-gen__generate_image`', 'lists `ListAgents`', 'makes **one** call', 'One image in `assets/generated`', 'structured shutdown', 'No key anywhere'];
    heads.forEach((h, i) => expect(rowOf(o, i + 1), h).toContain(h));
    for (let n = 1; n <= 10; n++) expect(rowOf(o, n), `row ${n}`).toMatch(/\*\*yes/);
    expect(rowOf(o, 4)).toMatch(/yes, with one defect/);
    expect(rowOf(o, 4)).toContain('finding F1');
    expect(rowOf(o, 8)).toMatch(/yes, after a rename/);
    expect(rowOf(o, 8)).toContain('finding F2');
    expect(o).toMatch(/No fail line of H10n was triggered/);
  });
});

describe('the Sitting X observation: the table agrees with the kept records', () => {
  it('row 1: the opening was the line alone and the gate released the first gated call by the line, with no hold', () => {
    const first = record('first-message.txt');
    expect(first).toMatch(/SUMMARY holds=0 in 0 message\(s\) \| line: message 2 at \+6\.6s \| first gated call: message 3 at \+9\.7s \| line written before the first gated call: yes \| line accurate: yes/);
    expect(first).toMatch(/welcome words: none/);
    const decisions = record('gate-log.txt').trim().split('\n').map(l => JSON.parse(l));
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ event: 'released', by: 'line', waitedMs: 2 });
    expect(rowOf(observation(), 1)).toContain('(2 ms)');
  });

  it('rows 5 and 6: the image tool joined the lead\'s pool at the restart and was found by the lead and by Jamileh, and no pool lists ListAgents', () => {
    const pool = record('pool.txt');
    expect(pool).toMatch(/A later change of the pool at 11:41:45 UTC: removed \[\], added \["mcp__image-gen__generate_image"\]/);
    expect(pool).toMatch(/11:41:47 \{"query":"select:mcp__image-gen__generate_image","max_results":1\} {2}pool 45 {2}matches: mcp__image-gen__generate_image/);
    expect(pool).toMatch(/Jamileh's pool in the tool check \(11:41:58 UTC\): 23 deferred tools: \(built-in\) 7, mcp__image-gen 1, mcp__stitch 15/);
    expect(pool).toMatch(/11:47:06 \{"query":"select:mcp__image-gen__generate_image,TaskGet,TaskUpdate","max_results":5\} {2}pool 23 {2}matches: 3/);
    for (const name of ['pool.txt', 'timeline.txt', 'session-report.txt', 'first-message.txt']) expect(record(name), name).not.toContain('ListAgents');
    expect(rowOf(observation(), 6)).toContain('inside the host\'s own description of `SendMessage`');
  });

  it('rows 7 and 8: one call with six arguments and a file name without extension; one image whose hash is the same in both records; her record has every template key and agrees with her call', () => {
    const call = json('jamileh-call.json');
    expect(Object.keys(call).sort()).toEqual(['aspectRatio', 'fileName', 'imageSize', 'prompt', 'provider', 'quality']);
    expect(call).toMatchObject({ aspectRatio: '4:5', imageSize: '2K', fileName: 'petpal-sitter-sofa-4x5', provider: 'gemini', quality: 'fast' });
    expect(call.fileName).not.toMatch(/\.\w+$/);
    expect(call.prompt.length).toBeLessThan(4000);
    expect(record('session-report.txt')).toMatch(/jamileh: image-gen: 1 call\(s\)/);
    expect(record('call-check.txt')).toMatch(/error {2}overwrite {2}fileName {2}petpal-sitter-sofa-4x5\.jpg already exists/);
    expect(record('call-check.txt')).toMatch(/\$0\.0504 each/);

    const check = json('image-check.json');
    expect(check).toMatchObject({ checked: 1, findings: [], calls: 1, costUsd: 0.0504 });
    expect(check.images[0]).toMatchObject({ file: 'petpal-sitter-sofa-4x5.jpg', format: 'jpeg', width: 1856, height: 2304, nearestRatio: '4:5', bytes: 3069023, sidecar: 'ok' });
    const assetsHash = /\t([0-9A-F]{64})\n[^\n]*provenance/.exec(record('assets.txt'))?.[1]?.toLowerCase();
    expect(assetsHash).toBe(check.images[0].sha256);
    expect(observation()).toContain(`\`sha256:${check.images[0].sha256.slice(0, 8)}…${check.images[0].sha256.slice(-5)}\``);

    const card = json('petpal-sitter-sofa-4x5.provenance.json');
    const template = JSON.parse(fs.readFileSync(path.resolve('registry/skills/image-creation/assets/provenance-template.json'), 'utf8'));
    for (const key of Object.keys(template)) expect(card, key).toHaveProperty(key);
    expect(card.parameters).toEqual({ provider: 'gemini', aspectRatio: '4:5', imageSize: '2K', quality: 'fast' });
    expect(card.prompt, 'the record holds the prompt that was sent').toBe(call.prompt);
    expect(card.estimatedCostUsd).toBe(0.0504);
    expect(card.attempt).toBe(1);
    expect(card.inputImages).toEqual([]);
  });

  it('row 9: one structured shutdown request, one approval sent by Jamileh, none received by the lead, as in R4', () => {
    const report = record('session-report.txt');
    expect(report).toMatch(/structured shutdown_request: 1, plain-text shutdown requests: 0, shutdown responses received by the lead: 0 \(none from jamileh\)/);
    expect(report).toMatch(/shutdown responses sent by teammates: 1 of 1 requested \(approved 1\)/);
    expect(observation()).toMatch(/Whether the maintainer saw her close: not reported/);
  });

  it('row 10: no key in the session\'s 756 records, none in the records kept here, none in this observation', () => {
    expect(record('key-scan.txt')).toMatch(/files scanned: 756\nfiles with a Google-key-shaped string: 0/);
    for (const file of [...walk(RECORDS), path.join(OBS_DIR, NAME)]) {
      const t = text(file);
      expect(t, file).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(t, file).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      for (const m of t.matchAll(/(GEMINI|OPENAI|ARK)_API_KEY\s*[=:]\s*['"]?([^\s'"`]+)/g)) expect(m[2], `${file}: ${m[1]}_API_KEY value`).toMatch(/^<[a-z -]+>$/);
    }
  });
});

describe('the Sitting X observation: the printed block and its fix (F1)', () => {
  it('the record shows the block as the lead printed it on 2026-10-13: the placeholder, the project path, no cd, and the lead ran no `claude mcp` command itself', () => {
    const timeline = record('timeline.txt');
    const lines = timeline.split('\n');
    const at = lines.findIndex(l => l.includes('claude mcp add --scope local image-gen --env GEMINI_API_KEY=<your-ai-studio-key>'));
    expect(at).toBeGreaterThan(0);
    expect(lines[at]).toContain('IMAGE_OUTPUT_DIR=C:\\github\\scratch-pilot\\h10d-local-test\\e2e-gemini\\assets\\generated');
    expect(lines[at - 1]).toMatch(/```powershell/);
    expect(lines[at + 1]).toMatch(/claude mcp list/);
    expect(lines.filter(l => /lead \w+ call Bash/.test(l) && /claude mcp/.test(l))).toEqual([]);
    expect(lines.filter(l => /lead \w+ call Bash/.test(l))).toHaveLength(2);
    expect(timeline).toContain('A local-scope server has no approval prompt.');
  });

  it('is fixed where the lead and the user read it: the reference\'s three blocks start with a cd, a paragraph says why, and the lead\'s paragraph says the same', () => {
    const section = REFERENCE.slice(REFERENCE.indexOf('## Photographic images'), REFERENCE.indexOf('## Check an install'));
    const blocks = [...section.matchAll(/```bash\n([^`]*?)```/g)].map(m => m[1]!.trim()).filter(b => b.includes('claude mcp add'));
    expect(blocks).toHaveLength(3);
    for (const b of blocks) expect(b.split('\n')[0]).toBe('cd <absolute path of the project>');
    expect(section).toContain('**Run it in the project folder.**');
    expect(section).toMatch(/observed on 2\.1\.296, Sitting X, 2026-10-13/);
    expect(LEAD).toMatch(/The block starts with a `cd` into the project folder/);
    expect(LEAD).toMatch(/observed on 2\.1\.296, Sitting X/);
    const o = observation();
    expect(o).toMatch(/\*\*Fixed in this PR, test first:\*\*/);
    expect(o).toMatch(/has not been run live/);
    expect(o).toMatch(/home folder/);
  });

  it('names the other findings as findings with proposals and changes none of them: the record\'s name (F2), the lead\'s report on the task (F3), the shutdown (F4), `claude mcp get` (F5)', () => {
    const o = observation();
    for (const f of ['F2', 'F3', 'F4', 'F5']) expect(o, f).toContain(`**${f},`);
    expect(o).toMatch(/Write `<image>\.provenance\.json`/);
    expect(o).toMatch(/petpal-sitter-sofa-4x5\.jpg\.provenance\.json/);
    expect(o).toMatch(/the shared task list never recorded it as done/);
    expect(record('timeline.txt')).toContain('the shared task list never recorded it as done');
    expect(record('timeline.txt')).toContain('Task not found');
    expect(o).toMatch(/claude mcp get image-gen/);
    // F5 is not changed: the lead's paragraph still says what it said
    expect(LEAD).toMatch(/run `claude mcp list` and `claude mcp get image-gen` \(its output can show a key/);
    expect(fs.readFileSync(path.resolve('registry/skills/image-generation/SKILL.md'), 'utf8')).toContain('Write `<image>.provenance.json`');
  });
});

describe('the Sitting X observation: the protocol and the ROADMAP state the sitting', () => {
  it('has the ledger row run, with no ceiling, the model cost, and the result in one line; the total of all ceilings is unchanged', () => {
    const row = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting X |'))!;
    expect(row).toContain('run 2026-10-13');
    expect(row).not.toMatch(/; not yet run \|$/);
    expect(row).toMatch(/every pass line was seen/);
    expect(row).toMatch(/printed block had no `cd`/);
    expect(row).toContain('2026-10-13-claude-2.1.296-gemini-end-to-end.md');
    expect(PROTOCOL).toContain('Total of all ceilings: 55.0 USD, and 65.0 USD with Sitting F.');
  });

  it('amends H10n with the result, the fix and what is still open, and points to the observation', () => {
    const start = PROTOCOL.indexOf('## H10n The Gemini route end to end');
    expect(start).toBeGreaterThan(-1);
    const next = PROTOCOL.indexOf('\n## ', start + 5);
    const h10n = PROTOCOL.slice(start, next === -1 ? undefined : next);
    expect(h10n).toMatch(/\*\*Amended 2026-10-13 \(Plan 036 S19, Sitting X/);
    expect(h10n).toContain('2026-10-13-claude-2.1.296-gemini-end-to-end.md');
    expect(h10n).toMatch(/second terminal opened in the project folder/);
    expect(h10n).toMatch(/home folder/);
    expect(h10n).toMatch(/F2/);
  });

  it('ticks the Gemini task of Milestone 4 and says what it found, and leaves the OpenAI and Seedream tasks open', () => {
    const task = ROADMAP.split('\n').find(l => l.includes('Gemini end to end in one session'))!;
    expect(task).toMatch(/^- \[x\] /);
    expect(task).toContain('Sitting X, run 2026-10-13');
    expect(task).toMatch(/`cd`/);
    expect(task).toContain('2026-10-13-claude-2.1.296-gemini-end-to-end.md');
    expect(ROADMAP).toMatch(/- \[ \] \*\*OpenAI\*\*/);
    expect(ROADMAP).toMatch(/- \[ \] \*\*Seedream\*\*/);
  });
});
