import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderNativeRole } from '../src/core/native-package.js';

const source = fs.readFileSync(path.resolve('registry/hosts/claude/agents/orchestrator-digital-agency.md'), 'utf8').replace(/\r\n/g, '\n');
const installed = renderNativeRole(source, 'agents/orchestrator-digital-agency.md');

describe('completion report independent of shutdown notifications (ADR 0055)', () => {
  // Advisor Plan 003: the shutdown table and structured request belong to coordinated teammates; an ordinary subagent that reported gets
  // the same immediate, stable delivery without them.
  it('binds the shutdown table to coordinated teammates and gives ordinary subagents the same immediate delivery', () => {
    expect(installed).toContain('send every coordinated teammate the structured shutdown request described above');
    expect(installed).toContain('deliver the final **Completion report** at once and write that no team shutdown applies');
    expect(installed).toContain('Delivery stays complete after a late notice in both mechanisms.');
  });

  it('ships the verified-work and accepted-dispatch report rule in the installed native lead', () => {
    expect(installed).toContain('**Completion report and shutdown evidence.**');
    expect(installed).toContain('When the deliverables and specialist reports are verified');
    expect(installed).toContain('Once all requests are accepted, immediately deliver your final **Completion report** and return control to the user.');
    expect(installed).toContain('Do not wait for shutdown approvals or `teammate_terminated` notices before delivering that report');
  });

  it('reports dispatch, approval and termination separately, including failures and user-reported UI evidence', () => {
    expect(installed).toContain('An accepted request proves dispatch, not termination.');
    expect(installed).toContain("each teammate's name, request status, approval observed and host termination observed");
    expect(installed).toContain('mark a missing event **not observed**, not **still running**');
    expect(installed).toContain('If a request fails, state the failure and the unresolved state in the report');
    expect(installed).toContain('record that as **user-reported**, separately from host evidence');
  });

  it('keeps completed delivery complete on a late notice instead of restarting a shutdown wait', () => {
    expect(installed).toContain('After delivering the Completion report, delivery stays complete even when lifecycle evidence is absent.');
    expect(installed).toContain('state **Delivery remains complete**');
    expect(installed).toContain('Do not say you are waiting for a missing approval or termination notice, enter a polling loop, or ask the user to supply it.');
    expect(installed).toContain('Never message an already-finished teammate merely to obtain a termination notice.');
  });

  it('retains the observed initial reports and marks the additional late-event rule as unverified live', () => {
    const adr = fs.readFileSync(path.resolve('docs/adr/0055-completion-does-not-wait-for-shutdown-notices.md'), 'utf8');
    expect(adr).toContain('not yet verified live');
    const evidence = JSON.parse(fs.readFileSync(path.resolve('host-library/claude/observations/2026-10-13-completion-evidence.json'), 'utf8')) as {
      cases: Array<{ case: string; finalReportAt: string; stage2At: string; secondsAfterLastRequest: number; terminationNoticesBeforeReport: number; lateWaitingUpdateObserved: boolean }>;
    };
    expect(evidence.cases.map(c => c.case)).toEqual(['control', 'intent', 'restricted']);
    for (const run of evidence.cases) {
      expect(run.finalReportAt < run.stage2At).toBe(true);
      expect(run.secondsAfterLastRequest).toBeGreaterThan(0);
      expect(run.secondsAfterLastRequest).toBeLessThan(8);
      expect(run.terminationNoticesBeforeReport).toBe(0);
    }
    expect(evidence.cases.find(c => c.case === 'restricted')?.lateWaitingUpdateObserved).toBe(true);
  });
});
