import { describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { NATIVE_ROLES, nativeText } from './helpers/native-roles.js';

const TASKS = ['TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite'];

describe('Claude session task protocol', () => {
  it('derives the current tracking tools for every native role, without TaskOutput', async () => {
    const cores = await loadSemanticCore('registry');
    const policy = loadToolPolicy('registry', 'claude');
    for (const role of NATIVE_ROLES) {
      const core = cores.get(role.stem)!;
      expect(core.capabilities, role.role).toContain('task-tracking');
      const tools = resolveGrant(policy, core.capabilities ?? [], { subagent: !role.coordinator, background: false }).tools;
      for (const task of TASKS) expect(tools, `${role.role}: ${task}`).toContain(task);
      expect(tools).not.toContain('TaskOutput');
      const text = nativeText(role.role);
      for (const task of TASKS) expect(text.split('\n').find(line => line.startsWith('tools: ')), role.role).toContain(task);
      expect(text).toContain('## Session task tracking');
      expect(text).toMatch(/actually available/i);
      expect(text).toContain('TodoWrite');
      expect(text).toMatch(/neither/i);
      expect(text, role.role).toMatch(/reopen[^\n]*`in_progress`[^\n]*revision/i);
      expect(text, role.role).toMatch(/dependent[^\n]*acceptance[^\n]*invalid/i);
      expect(text, role.role).toMatch(/linked fix task[^\n]*returned ID[^\n]*owner/i);
      expect(text, role.role).toMatch(/Do not leave unresolved fixes marked complete/i);
      expect(text, role.role).toMatch(/Read back the changed outputs[^\n]*rechecks before closing/i);
      expect(text, role.role).toMatch(/cannot update[^\n]*when delegated[^\n]*task ID[^\n]*lead/i);
      expect(text, role.role).toMatch(/otherwise record the revision and status in the existing fallback/i);
      if (!role.coordinator) {
        expect(text).toMatch(/ordinary background subagents/i);
        expect(text).toContain('TaskGet');
        expect(text).toMatch(/verify blockers are completed before `in_progress`/i);
        expect(text).toMatch(/without an assigned ID, track your own/i);
        expect(text).toMatch(/record `completed` only after evidence and readback/i);
      } else {
        expect(text).toMatch(/take its ID from the actual tool result/i);
        expect(text).toMatch(/consultation ownership does not authorize a deliverable/i);
        expect(text).toMatch(/already accepted map/i);
      }
    }
  });

  it('keeps ordinary background Task tools unavailable while classifying coordination as nonmutating', () => {
    const policy = loadToolPolicy('registry', 'claude');
    for (const name of TASKS.slice(0, 4)) {
      const entry = policy.catalog.find(tool => tool.name === name)!;
      expect(entry.backgroundSubagent, name).toBe(false);
      expect(entry.mutating, name).toBe(false);
    }
    const foreground = resolveGrant(policy, ['task-tracking'], { subagent: true, background: false }).tools;
    const background = resolveGrant(policy, ['task-tracking'], { subagent: true, background: true }).tools;
    expect(foreground).toEqual(expect.arrayContaining(TASKS));
    for (const task of TASKS.slice(0, 4)) expect(background).not.toContain(task);
    expect(background).toContain('TodoWrite');
    // Teammate exception is documented as a condition; the resolver has no teammate context.
    expect(policy.catalog.find(tool => tool.name === 'TaskGet')!.conditions.some(condition => /teammates/i.test(condition.detail))).toBe(true);
  });

  it('does not change Cline or Antigravity grants for the same roles', async () => {
    const cores = await loadSemanticCore('registry');
    for (const host of ['cline', 'antigravity']) {
      const policy = loadToolPolicy('registry', host);
      for (const role of NATIVE_ROLES) {
        const capabilities = cores.get(role.stem)!.capabilities ?? [];
        const context = { subagent: !role.coordinator, background: false };
        const withTracking = resolveGrant(policy, capabilities, context).tools;
        const withoutTracking = resolveGrant(policy, capabilities.filter(capability => capability !== 'task-tracking'), context).tools;
        expect(withTracking, `${host}: ${role.role}`).toEqual(withoutTracking);
      }
    }
  });
});
