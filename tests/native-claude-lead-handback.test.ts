import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Two rules of the digital-agency lead that the H9 retest (2026-10-06, Claude Code 2.1.291) showed it did not keep:
 * - the mode report comes first. In session `ac925a6d` the prompt said "First report your operating mode and which of the eight integrations are callable"; the
 *   lead's first text was "Emre is working on the consultation" and the mode was never reported;
 * - a consultant is shut down like any teammate. In session `eb6d017a` the lead printed a restart command with Defne, its consultant, still running (the helper's
 *   H1b line read "not seen": no request at all), and a resume restores no teammate.
 * Both sit after the generated Contract Floor, which belongs to the shared core and is checked byte for byte elsewhere.
 */

const LEAD = fs.readFileSync(path.resolve('registry/hosts/claude/agents/orchestrator-digital-agency.md'), 'utf8').replace(/\r\n/g, '\n');
const AFTER_FLOOR = LEAD.split('<!-- agents-united:floor:end -->')[1] ?? '';

describe('the lead reports its mode first', () => {
  it('says the mode comes before any question, consultation or spawn, and what skipping it looked like', () => {
    expect(AFTER_FLOOR).toMatch(/Your first answer in a session reports the operating mode, before you ask the user anything, consult a specialist or spawn anyone/);
    expect(AFTER_FLOOR).toMatch(/went straight to a consultation and never reported it/);
  });

  it('keeps the rule for how the mode is named', () => {
    expect(AFTER_FLOOR).toMatch(/Say \*\*Fully Operational\*\* only when all eight are callable; otherwise say \*\*Limited Operational\*\* and name the missing ones/);
  });
});

describe('the lead shuts a consultant down', () => {
  it('treats an answer as a delivery and asks the consultant to shut down with the structured request', () => {
    expect(AFTER_FLOOR).toMatch(/A consultant has delivered when it has answered: shut it down by name with the same structured request/);
  });

  it('shuts every teammate down, consultants included, before it gives a restart command or ends', () => {
    expect(AFTER_FLOOR).toMatch(/Before you give the user a restart command, or end the session, every teammate you spawned, consultants included, has been asked to shut down/);
    expect(AFTER_FLOOR).toMatch(/a lead printed a restart command with its consultant still running/);
  });

  it('keeps the structured form of the request', () => {
    expect(AFTER_FLOOR).toContain('`SendMessage` with the message `{"type":"shutdown_request","reason":"<why>"}`');
  });
});
