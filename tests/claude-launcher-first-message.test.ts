import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { ClaudeLauncher } from '../src/core/claude-launcher.js';
import type { ClaudeCapabilityReport } from '../src/core/types.js';

/**
 * Plan 035 N2 slice (b), the `agents start` path (2026-10-07).
 *
 * Live test 1 (session `3c47fef7`, `agents start digital-agency --host claude`, the lead on Opus at medium effort): the kickoff prompt was delivered at last, and the
 * lead ran eight `ToolSearch` calls and a `Bash` call and then wrote its introduction with no mode line. The kickoff said "Please introduce your coordinator role to
 * the user and ask for their first task", and the lead followed that user-turn instruction over the section of its own definition that asks for the mode line. The
 * kickoff is the one instruction the launcher controls, so it points the lead at the rule before it asks for the introduction.
 * The launcher knows no bundle: the sentence names the section, and a definition without that section has nothing to follow.
 */

const SENTENCE = 'If your coordinator definition has a section named "The first message", follow it in your first message, before the introduction and before anything else.';

describe('Plan 035 N2 slice (b): the kickoff prompt points the lead at its first-message rule', () => {
  const workspace = path.resolve(process.cwd(), 'scratch/test-claude-launcher-first-message');
  const report: ClaudeCapabilityReport = {
    installed: true,
    version: '2.1.292 (Claude Code)',
    command: { executable: 'claude', prefixArgs: [], source: 'path-executable' },
    pluginSupport: true,
    agentTeamsExperimental: true,
    subagentHandback: true,
    diagnostics: [],
  };

  const plan = (options: Partial<Parameters<ClaudeLauncher['planActivation']>[0]> = {}) =>
    new ClaudeLauncher().planActivation({
      bundleName: 'digital-agency',
      orchestrator: 'orchestrator-digital-agency.md',
      workspace,
      scope: 'project',
      report,
      ...options,
    });

  it('carries the sentence once, before the request to introduce the role', () => {
    const prompt = plan().bootstrapPrompt;

    expect(prompt.split(SENTENCE)).toHaveLength(2);
    expect(prompt.indexOf(SENTENCE)).toBeLessThan(prompt.indexOf('Please introduce your coordinator role to the user and ask for their first task.'));
  });

  it('carries it before a task the user gave, too', () => {
    const prompt = plan({ prompt: 'Draft a launch plan for a flat SaaS.' }).bootstrapPrompt;

    expect(prompt.indexOf(SENTENCE)).toBeGreaterThan(-1);
    expect(prompt.indexOf(SENTENCE)).toBeLessThan(prompt.indexOf('User task: Draft a launch plan for a flat SaaS.'));
  });

  it('keeps the whole prompt in the single final argv element, with the sentence after the instruction to read the definition', () => {
    const activation = plan();
    const last = activation.argv[activation.argv.length - 1];

    expect(last).toBe(activation.bootstrapPrompt);
    expect(last.indexOf('coordinator role definition')).toBeLessThan(last.indexOf(SENTENCE));
    expect(activation.argv.filter(entry => entry.includes('The first message'))).toHaveLength(1);
  });

  it('names no bundle-specific rule, so that every bundle can carry it', () => {
    const prompt = plan({ bundleName: 'software-engineering', orchestrator: 'orchestrator-engineering.md' }).bootstrapPrompt;

    expect(prompt).toContain(SENTENCE);
    expect(SENTENCE).not.toMatch(/mode|operational|digital|agency/i);
  });
});
