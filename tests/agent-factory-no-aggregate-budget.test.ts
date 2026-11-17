import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

function walk(rel: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(child));
    else out.push(child);
  }
  return out;
}

const AGENT = 'registry/hosts/claude/agents/orchestrator-agent-factory.md';
const CORE = 'registry/core/orchestrator-agent-factory.core.md';
const SKILL = 'registry/skills/coordinate-artifact';
const REFS = `${SKILL}/references`;
const SENTENCE = 'A journey has no aggregate process, time or output budget';
const INVARIANT = 'Repair only within the accepted count, scope and per-job budgets.';
const REMOVED = /24 processes|<=24 processes|validationProcessesMaximum|secondsMaximum|rawOutputBytesMaximum|maxProcesses|aggregate budget|aggregate limits|aggregate counter|aggregate in \[repair\]/i;

describe('the agent factory states no aggregate journey budget', () => {
  const files = [
    ...walk(SKILL),
    ...walk('registry/hosts/claude/skills/coordinate-artifact'),
    AGENT,
    CORE,
    'scripts/prepare-factory-proof.mjs',
  ];

  it('removes every aggregate figure and phrase from the runbook, the agent, the contract and the proof preparation', () => {
    for (const file of files) expect(read(file), file).not.toMatch(REMOVED);
  });

  it('says once, in one wording, that a journey has no aggregate budget', () => {
    for (const file of [`${REFS}/repair.md`, `${REFS}/job.md`, `${REFS}/skill-authoring.md`, `${REFS}/contract-authoring.md`, `${REFS}/bundle-authoring.md`, `${REFS}/host-sync.md`, AGENT]) {
      expect(read(file).toLowerCase(), file).toContain(SENTENCE.toLowerCase());
    }
  });

  it('bounds repair by the accepted count, scope and per-job budgets', () => {
    for (const file of [CORE, AGENT, `${REFS}/repair.md`]) expect(read(file), file).toContain(INVARIANT);
  });

  it('names no process limit in step 6 of either coordinate-artifact entry and names the job caps and the turn/repair limits', () => {
    const stated = "account for each job's caps and the turn/repair limits";
    for (const file of [`${SKILL}/SKILL.md`, 'registry/hosts/claude/skills/coordinate-artifact/SKILL.md']) {
      const text = read(file);
      expect(text, file).not.toContain('process/byte/time');
      expect(text, file).not.toContain('process limit');
      expect(text, file).toContain(stated);
    }
  });

  it('keeps only the turn and repair limits in the report guide', () => {
    const report = JSON.parse(read(`${SKILL}/assets/report.json`)) as { limits: Record<string, number> };
    expect(Object.keys(report.limits).sort()).toEqual(['authorizedRepairsMaximum', 'automaticRepairsDefault', 'workerTurnsMaximum']);
  });
});
