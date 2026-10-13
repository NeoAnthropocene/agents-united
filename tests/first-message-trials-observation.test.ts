import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The first-message trials of 2026-10-13 (Claude Code 2.1.296, headless, Sonnet at low effort): 29 runs of the digital-agency lead in six folders that differ in the lead's section "The first message", to find out
 * whether taking out the welcome and making the Operation Mode information the first message removes the hook errors, as the maintainer asked after Sitting U. The record is kept beside the observation, and this suite
 * makes it checkable: the counts of the observation are the counts of the kept table, the variants are the texts that ran, the log of the waiting gate is the one that was written, and ADR 0053 quotes the same figures.
 * What the trials cannot show is stated in the observation: a headless session saves its transcript promptly, so the lag of the interactive sessions is for Sitting V.
 */

const OBS_DIR = path.resolve('host-library/claude/observations');
const OBSERVATION = path.join(OBS_DIR, '2026-10-13-claude-2.1.296-first-message-trials.md');
const RECORDS = path.join(OBS_DIR, '2026-10-13-first-message-trials-records');
const text = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const summary = text(path.join(RECORDS, 'trials-summary.txt'));
const rows = summary.split('\n').filter(l => /^fm-(base|a|b|c|d|e)-p[12]-\d+ /.test(l)).map(l => {
  const [name, session, gate, holds, ...rest] = l.trim().split(/\s+/);
  return { name: name!, session: session!, gate: gate!, holds: Number(holds), rest: rest.join(' ') };
});

describe('the first-message trials: the record', () => {
  it('says it is an observation of installed builds, with its limit stated first: headless saves promptly, so Sitting V has to show the lag', () => {
    const o = text(OBSERVATION);
    expect(o).toMatch(/observations of installed builds, not documentation/i);
    expect(o).toContain('2.1.296');
    expect(o).toMatch(/claude-sonnet-5-5/);
    expect(o).toContain('1bf058c');
    expect(o).toMatch(/headless session saves its transcript promptly/);
    expect(o).toMatch(/Sitting V \(H11\) has to show/);
    expect(o).toMatch(/\*\*29 runs\*\*/);
  });

  it('keeps the table, and it has 29 runs: 26 with the gate on and 3 without (the frontmatter hooks of a project agent are skipped by claude -p)', () => {
    expect(rows).toHaveLength(29);
    expect(rows.filter(r => r.gate === 'on')).toHaveLength(26);
    expect(rows.filter(r => r.gate === 'off').map(r => r.name)).toEqual(['fm-base-p1-1', 'fm-a-p1-1', 'fm-b-p1-1']);
    expect(summary).toContain('runs: 29; gate on: 26; gate off: 3');
    expect(text(OBSERVATION)).toMatch(/the first three runs \(`fm-base-p1-1`, `fm-a-p1-1`, `fm-b-p1-1`\) met no gate/);
    expect(text(OBSERVATION)).toMatch(/other \*\*26 runs\*\*/);
  });

  it('counts the holds as the observation does: base 2 and 2, a 0, 1 and 0, and none in b, c, d and e', () => {
    expect(summary).toMatch(/variant base: gated runs 3 \(gate on 2\), holds with the gate on 2,2, line in an EARLIER message than the first gated call in 0/);
    expect(summary).toMatch(/variant a: gated runs 4 \(gate on 3\), holds with the gate on 0,1,0, line in an EARLIER message than the first gated call in 3, in the same message in 1/);
    expect(summary).toMatch(/variant b: gated runs 4 \(gate on 3\), holds with the gate on 0,0,0, line in an EARLIER message than the first gated call in 4/);
    expect(summary).toMatch(/variant c: gated runs 3 \(gate on 3\), holds with the gate on 0,0,0, line in an EARLIER message than the first gated call in 3/);
    expect(summary).toMatch(/variant d: gated runs 3 \(gate on 3\), holds with the gate on 0,0,0, line in an EARLIER message than the first gated call in 3/);
    expect(summary).toMatch(/variant e: gated runs 4 \(gate on 4\), holds with the gate on 0,0,0,0, line in an EARLIER message than the first gated call in 4/);
    const o = text(OBSERVATION);
    expect(o).toMatch(/none of 3 task runs wrote the line before its first gated call/);
    expect(o).toMatch(/\(`a` and `e`\), 7 of 8 did/);
    expect(o).toMatch(/0 of 13 gated runs with the gate on/);
  });

  it('counts the early line as the observation does: written first in 15 of 15, in disagreement with the lead\'s own searches in 4 of 15, and the line after the searches in agreement in 5 of 5', () => {
    expect(summary).toContain('line first from the start list (variants b, c, d): 15 runs, line in message 1 in 15, line NOT in agreement with the lead\'s own searches in 4');
    expect(summary).toContain('line after the searches (variant e): 5 runs, line in message 2 in 5, in agreement with the lead\'s own searches in 5');
    const disagreed = rows.filter(r => /^fm-[bcd]-/.test(r.name) && /\bNO\b/.test(r.rest.replace(/^\S+\s+\S+\s+/, '')));
    expect(disagreed.map(r => r.name)).toEqual(['fm-c-p1-2', 'fm-c-p1-3', 'fm-c-p2-2', 'fm-d-p1-2']);
    const o = text(OBSERVATION);
    expect(o).toMatch(/disagreed with the lead's own searches in 4 of 15/);
    expect(o).toMatch(/Correction: Firecrawl turned out to be callable/);
  });

  it('shows the welcome on a bare "Hi" in base, a and b and not in c, d and e', () => {
    const welcomed = rows.filter(r => /I'm Chris/.test(r.rest)).map(r => r.name);
    expect(welcomed).toEqual(['fm-base-p2-1', 'fm-a-p2-1', 'fm-b-p2-1']);
    const detail = text(path.join(RECORDS, 'trials-detail.txt'));
    expect(detail).toContain("My team is: - Ava (growth strategy) - Kaan (conversion copy)");
    expect(detail).toContain('Hi, I\'m Chris, the lead for this digital agency team.');
    expect(detail).toContain('Hi. What would you like to work on?');
  });

  it('keeps the texts of the variants: only the base keeps the introduction, and the five others name what is left out or remove it', () => {
    const v = text(path.join(RECORDS, 'variants.txt'));
    expect(v).toMatch(/=== variant base[^\n]*\n[^\n]*then the introduction/);
    for (const name of ['a', 'b', 'c', 'd', 'e']) expect(v, name).toMatch(new RegExp(`=== variant ${name}\\n[^\\n]*\\n\\s+\\("Under the line, introduce yourself as Chris and name your team." is removed\\)`));
    expect(v.match(/\*\*No welcome\.\*\*/g)).toHaveLength(3);
  });

  it('keeps the decision log of the waiting gate: in the four gated runs of e the line was already in the file at the first look, and the call under judgment was not', () => {
    const log = text(path.join(RECORDS, 'gate-log-variant-e.txt'));
    const entries = [...log.matchAll(/^\{.*\}$/gm)].map(m => JSON.parse(m[0]) as Record<string, unknown>);
    expect(entries).toHaveLength(4);
    for (const e of entries) {
      expect(e).toMatchObject({ tool: 'Read', event: 'released', by: 'line', firstOwn: false, firstTexts: 1 });
      expect(Number(e.waitedMs)).toBeLessThan(50);
    }
    expect(log).toContain('(no log)');
    expect(text(OBSERVATION)).toMatch(/`firstOwn: false`/);
  });

  it('keeps the prompts and the scripts that made the runs', () => {
    expect(text(path.join(RECORDS, 'prompts.txt'))).toContain('Read docs/pilot/hero.ts and tell me what its first line is, in one sentence');
    for (const s of ['new-first-message-folders.ps1', 'patch-first-message.mjs', 'add-settings-gate.mjs', 'spike-wait-hook.mjs', 'first-message.mjs', 'run-first-message.mjs', 'summarize-trials.mjs']) {
      expect(fs.existsSync(path.join(RECORDS, 'scripts', s)), s).toBe(true);
    }
  });

  it('holds no key shape and no personal string, in the records or the observation', () => {
    const files = [OBSERVATION, ...walk(RECORDS)];
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const t = text(f);
      const rel = path.relative(OBS_DIR, f);
      expect(t, `${rel} Google key shape`).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} sk- key shape`).not.toMatch(/\bsk-[0-9A-Za-z_-]{20,}/);
      expect(t, `${rel} personal string`).not.toMatch(/gmail\.com|AppData[\\/]|[\\/]Users[\\/]ozy|Europe\/Berlin|altay|\bozy\b|bridgeSession|ownerAccount/i);
    }
  });

  it('is the record that ADR 0053 names, with the figures that it quotes', () => {
    const adr = text(path.resolve('docs/adr/0053-the-opening-of-a-tier-2-orchestrator-is-its-operation-mode-information.md'));
    expect(adr).toContain('2026-10-13-claude-2.1.296-first-message-trials.md');
    expect(adr).toMatch(/29 runs/);
    expect(adr).toMatch(/in none of its 3 task runs did the line come in an earlier message/);
    expect(adr).toMatch(/in 7 of 8 task runs/);
    expect(adr).toMatch(/15 of 15 and none of the 9 gated runs with the gate on was held/);
    expect(adr).toMatch(/disagreed with the lead's own searches in 4 of 15/);
  });
});
