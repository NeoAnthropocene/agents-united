import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Read a registry text with LF line endings, whatever the checkout converted them to. */
const read = (rel: string): string => fs.readFileSync(`registry/${rel}`, 'utf8').replace(/\r\n/g, '\n');
const plan = read('skills/sync-host/references/plan.md');
const handback = read('skills/sync-host/references/handback.md');
const agent = read('hosts/claude/agents/factory-sync.md');
const skill = read('skills/sync-host/SKILL.md');
const nativeSkill = read('hosts/claude/skills/sync-host/SKILL.md');
const afterFloor = agent.slice(agent.indexOf('<!-- agents-united:floor:end -->'));

describe('sync-host runbook text matches the checker', () => {
  it('starts both omission bullets of the changedPins rule from a counted input that matches', () => {
    const bullets = plan.split('\n').filter(line => /^ {3}- /.test(line) && line.includes('changed.newSha256'));
    expect(bullets).toHaveLength(2);
    for (const bullet of bullets) expect(bullet).toMatch(/^ {3}- If a counted input matches/);
  });

  it.each([['references/plan.md', plan], ['the factory-sync agent body', afterFloor]])('states the path rules of the job, of each target and the case rule in %s', (_label, text) => {
    expect(text).toMatch(/path rules of the machine the checker runs on/);
    expect(text).toMatch(/form of that target's own checkout/);
    expect(text).toMatch(/case is ignored when the checker runs on Windows or the target is Windows form/);
    expect(text).toMatch(/hint/i);
    expect(text).not.toMatch(/can tell the caller's platform|determine the caller's platform/);
  });

  it('shows real JSON for the changedPins entry and explains pinnedAtPrevious', () => {
    const block = /```json\n([\s\S]*?)\n\s*```/.exec(plan.slice(plan.indexOf('`changedPins`')))![1]!;
    const entries = JSON.parse(block) as Array<Record<string, unknown>>;
    expect(Array.isArray(entries)).toBe(true);
    const hex = /^[0-9a-f]{64}$/;
    for (const entry of entries) {
      expect(entry.pinnedSha256).toMatch(hex);
      expect(entry.oldSha256 === null || hex.test(String(entry.oldSha256))).toBe(true);
      expect(entry.newSha256 === null || hex.test(String(entry.newSha256))).toBe(true);
      expect(entry.pinnedAtPrevious).toBe(entry.pinnedSha256 === entry.oldSha256);
    }
    expect(entries.some(entry => entry.newSha256 === null)).toBe(true);
    expect(entries.some(entry => typeof entry.newSha256 === 'string')).toBe(true);
    expect(entries.some(entry => entry.pinnedAtPrevious === false)).toBe(true);
    expect(plan).toMatch(/`pinnedAtPrevious` is `match\.sha256 === changed\.oldSha256`/);
  });

  it('adds no 64-character hex string to either SKILL.md', () => {
    expect(skill).not.toMatch(/[0-9a-f]{64}/);
    expect(nativeSkill).not.toMatch(/[0-9a-f]{64}/);
  });

  it('keeps the worker search tools on the sync job and the listed target records only', () => {
    expect(afterFloor).not.toMatch(/read-only context referenced by the job/);
    expect(afterFloor).toMatch(/only on the sync job and the listed target records/);
  });

  it('uses SubagentHandback only when supplied and keeps ReportFindings optional', () => {
    expect(handback).not.toMatch(/^\d\. Call `SubagentHandback`/m);
    expect(handback).not.toMatch(/^\d\. Call `ReportFindings`/m);
    expect(handback).toMatch(/`SubagentHandback` when the Host supplies it/);
    expect(handback).toMatch(/otherwise[^\n]*ordinary final response/);
    // P22: a background run does not supply ReportFindings, so the text qualifies it with "when supplied".
    expect(handback).toMatch(/`ReportFindings`, when supplied, is optional and never replaces/);
    for (const text of [skill, nativeSkill]) {
      const step = text.split('\n').find(line => line.startsWith('5. **Hand-off the plan record**'))!;
      expect(step).toMatch(/when the Host supplies it/);
      expect(step).toMatch(/ordinary final response/);
    }
  });

  it('keeps the two SKILL.md entries identical but for the native loader line and standing rules, each within its size limits', () => {
    const strip = (text: string): string => text.split('\n').filter(line => line !== 'user-invocable: false' && !line.startsWith('- **Standing Rules**')).join('\n');
    expect(strip(nativeSkill)).toBe(skill);
    for (const text of [skill, nativeSkill]) {
      expect(text.length).toBeLessThanOrEqual(6000);
      expect(text.split('\n').length - 1).toBeLessThanOrEqual(90);
    }
  });

  it('tells the caller what else the postflight refuses, with the numbers of the checker and the schema', () => {
    expect(handback).toMatch(/directly in `roots\.evidence`/);
    expect(handback).toMatch(/job file/);
    expect(handback).toMatch(/262144/);
    expect(handback).toMatch(/`version: 1`/);
    expect(handback).toMatch(/`kind: "host-update-sync-plan"`/);
    expect(handback).toMatch(/256[^.\n]*`artifacts`/);
    expect(handback).toMatch(/64[^.\n]*`heldPins`/);
    expect(handback).toMatch(/1\.\.512/);
  });
});

describe('agent-factory bundle documentation names the sync worker', () => {
  it('describes read-only host-update sync planning in the bundle description', () => {
    const catalog = JSON.parse(fs.readFileSync('registry/bundles.json', 'utf8')) as { bundles: Record<string, { description: string }> };
    expect(catalog.bundles['agent-factory']!.description).toMatch(/read-only host-update sync planning/);
  });

  it('names factory-sync with its sync-host runbook beside the realizer and the evaluator in the README', () => {
    const readme = fs.readFileSync('README.md', 'utf8').replace(/\r\n/g, '\n');
    const paragraph = readme.split('\n').find(line => line.startsWith('The under-construction `agent-factory` Domain Bundle contains'))!;
    expect(paragraph).toMatch(/`factory-sync` worker with its required `sync-host` runbook/);
    expect(paragraph).toMatch(/read-only host-update sync planning/);
    expect(paragraph).toMatch(/coordinator starts it and runs its checker before and after/);
    expect(readme).toMatch(/For host-update sync planning, the coordinator/);
  });
});
