import { describe, expect, it } from 'vitest';
import { FLOOR_END, FLOOR_START, checkFloor, renderFloor, syncFloor } from '../src/core/native-floor.js';
import { validateContractFloor } from '../src/core/semantic-core.js';
import type { SemanticCore } from '../src/core/types.js';

/**
 * Plan 032 PR E, milestone 1 — a native host agent is authored, but its Contract Floor is never typed: the floor
 * block between two markers is regenerated from the Semantic Core, so the floor cannot drift or be truncated.
 */

const core: SemanticCore = {
  identity: 'You are a reviewer.',
  mission: 'Review code.\n\n- one\n- two',
  scope_boundaries: '1. Read-only.',
  output_contract: '## Report\n\nSeverity first.',
  safety: '- Never echo a secret.\n- No false positives.',
  invariants: ['Hand your result back, not across.'],
  capabilities: ['read'],
} as SemanticCore;

const template = `---\nname: "x"\n---\n\nIntro.\n\n${FLOOR_START}\nstale\n${FLOOR_END}\n\nOutro.\n`;

describe('native floor block', () => {
  it('renders the five floor sections verbatim, in order', () => {
    const block = renderFloor(core);
    const order = ['## Identity', '## Mission', '## Scope Boundaries', '## Output Contract', '## Safety'].map(h => block.indexOf(h));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(validateContractFloor(block, core)).toEqual([]);
  });

  it('syncFloor replaces only what sits between the markers, and is idempotent', () => {
    const once = syncFloor(template, core);
    expect(once.startsWith('---\nname: "x"\n---\n\nIntro.\n\n')).toBe(true);
    expect(once.endsWith('\n\nOutro.\n')).toBe(true);
    expect(once).not.toContain('stale');
    expect(validateContractFloor(once, core)).toEqual([]);
    expect(syncFloor(once, core)).toBe(once);
  });

  it('syncFloor refuses a file with missing, duplicated or reversed markers', () => {
    expect(() => syncFloor('no markers', core)).toThrow(/floor markers/);
    expect(() => syncFloor(`${FLOOR_START}\n${FLOOR_START}\n${FLOOR_END}`, core)).toThrow(/floor markers/);
    expect(() => syncFloor(`${FLOOR_END}\n${FLOOR_START}`, core)).toThrow(/floor markers/);
  });

  it('checkFloor names the floor fields that drifted, and passes once synced', () => {
    const drifted = syncFloor(template, core).replace('Never echo a secret', 'Echo secrets freely');
    expect(checkFloor(drifted, core).join('\n')).toMatch(/safety/);
    expect(checkFloor(syncFloor(template, core), core)).toEqual([]);
  });

  it('checkFloor reports a stale block even when the verbatim text still appears elsewhere', () => {
    const synced = syncFloor(template, core);
    const stale = synced.replace(/(<!-- agents-united:floor:start[^>]*-->)[\s\S]*?(<!-- agents-united:floor:end -->)/, '$1\nold\n$2') + `\n${core.safety}\n`;
    expect(checkFloor(stale, core).length).toBeGreaterThan(0);
  });
});
