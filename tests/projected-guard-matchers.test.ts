import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'yaml';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { guardHandler, managedGuardHooks, nativeGuardHooks } from '../src/core/guard.js';

/**
 * A specialist that is still a projection (a canonical agent with no native Claude file) carries the guard as an inline hook. On Windows
 * its shell is PowerShell and its multi-file writer is MultiEdit, so the guard must cover both, as the native guard does.
 */
describe('the guard a projected role carries covers PowerShell and MultiEdit', () => {
  const rel = 'agents/subagent-appsec-penetration-tester.md';
  const rendered = ClaudeProjector.renderRole(fs.readFileSync(path.resolve('registry', rel), 'utf8'), rel).content.replace(/\r\n/g, '\n');
  const front = yaml.parse(/^---\n([\s\S]*?)\n---/.exec(rendered)![1]!) as { hooks: { PreToolUse: Array<{ matcher: string; hooks: unknown[] }> } };

  it('uses the matchers of the native guard, with the same inline handler', () => {
    expect(front.hooks.PreToolUse.map(group => group.matcher)).toEqual(['Bash|PowerShell', 'Write|Edit|MultiEdit|NotebookEdit']);
    expect(front.hooks.PreToolUse.map(group => group.matcher)).toEqual(nativeGuardHooks().PreToolUse.map(group => group.matcher));
    for (const group of front.hooks.PreToolUse) expect(group.hooks).toEqual([guardHandler()]);
  });

  it('managedGuardHooks is the one source of those groups', () => {
    expect(managedGuardHooks().PreToolUse.map(group => group.matcher)).toEqual(['Bash|PowerShell', 'Write|Edit|MultiEdit|NotebookEdit']);
  });
});
