import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { renderFloor } from '../src/core/native-floor.js';
import { loadNativeDeltas, nativeText } from './helpers/native-roles.js';

/**
 * ADR 0079 decision 12 (2026-11-26, the maintainer's choice): the host's own image generator comes first, written once in the host-neutral
 * Semantic Core of the three image-making roles. No host is named and no host file changes: the rule sits in `invariants`, which no
 * renderer copies (the Contract Floor block leaves it out), so each host's native role text must bind it or declare it as a delta. The
 * Claude realization declares it (Claude Code has no image generator of its own, so the case does not arise there); the Antigravity native
 * roles of these bundles, when written, must bind it.
 */

const RULE = 'When the host has an image generator of its own, it is offered first and recommended among the image options.';
const CORES = ['orchestrator-digital-agency', 'orchestrator-marketing', 'subagent-marketing-creative-designer'];
const CLAUDE_ROLES = ['agency-creative-designer', 'marketing-creative-designer', 'orchestrator-digital-agency', 'orchestrator-marketing'];

const cores = await loadSemanticCore('registry');

describe('the host image generator rule in the Semantic Core', () => {
  it.each(CORES)('is an invariant of %s, exactly once', stem => {
    const core = cores.get(stem);
    expect(core, stem).toBeDefined();
    expect(core!.invariants.filter(invariant => invariant === RULE)).toHaveLength(1);
  });

  it('is stated by no other core', () => {
    const others = [...cores.entries()].filter(([stem, core]) => !CORES.includes(stem) && core.invariants.includes(RULE)).map(([stem]) => stem);
    expect(others).toEqual([]);
  });

  it('names no host, tool, server or subagent', () => {
    expect(RULE).not.toMatch(/antigravity|claude|cline|codex|gemini|image-gen|image-generator|mcp|subagent|\//i);
  });

  it('is left out of the rendered Contract Floor, so no generated floor block carries it', () => {
    for (const stem of CORES) expect(renderFloor(cores.get(stem)!), stem).not.toContain('image generator of its own');
  });
});

describe('the Claude realization of the rule', () => {
  const deltas = loadNativeDeltas('registry', 'claude');

  it('is one declared delta for exactly the four native roles that stand on those cores, with a rationale', () => {
    const entries = deltas.filter(delta => delta.feature === RULE);
    expect(entries).toHaveLength(1);
    expect([...entries[0].roles].sort()).toEqual(CLAUDE_ROLES);
    expect(entries[0].disposition).toBe('unsupported');
    expect(entries[0].rationale).toMatch(/no image generator of its own/);
  });

  it('leaves the four Claude native files without the rule', () => {
    for (const role of CLAUDE_ROLES) expect(nativeText(role), role).not.toContain('image generator of its own');
  });
});

describe('the record of the decision', () => {
  it('is decision 12 of ADR 0079, with the rule word for word', () => {
    const adr = fs.readFileSync('docs/adr/0079-media-servers-in-the-base-roles-and-the-image-tool-shared-with-marketing.md', 'utf8');
    const decision = adr.split(/\r?\n/).find(line => line.startsWith('  12. **'));
    expect(decision).toBeDefined();
    expect(decision).toContain(RULE);
    expect(decision).toMatch(/must state the rule/);
  });
});
