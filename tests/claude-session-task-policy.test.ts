import { describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { loadToolPolicy, resolveGrant } from '../src/core/host-profile.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';
import { sessionTrackingProblems } from '../src/core/native-repository-rules.js';
import { NATIVE_ROLES, nativeText } from './helpers/native-roles.js';

const TASKS = ['TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TodoWrite'];

describe('Claude session task protocol', () => {
  it('preserves tracking for end-user roles and the bounded factory workers without Task tools', async () => {
    const cores = await loadSemanticCore('registry');
    const policy = loadToolPolicy('registry', 'claude');
    for (const role of NATIVE_ROLES) {
      const core = cores.get(role.stem)!;
      const tools = resolveGrant(policy, core.capabilities ?? [], { subagent: !role.coordinator, background: false }).tools;
      const text = nativeText(role.role);
      const nativeTools = inspectNativeAgent(text).tools;
      if (role.role === 'factory-realizer' || role.role === 'factory-evaluator' || role.role === 'factory-sync') {
        // These fixed-job workers return progress to their caller; tracking belongs
        // to the main factory coordinator, outside their reviewed grant ceilings.
        expect(core.capabilities, role.role).not.toContain('task-tracking');
        for (const task of [...TASKS, 'TaskOutput']) {
          expect(tools, `${role.role}: ${task}`).not.toContain(task);
          expect(nativeTools, role.role).not.toContain(task);
        }
        continue;
      }
      expect(core.capabilities, role.role).toContain('task-tracking');
      for (const task of TASKS) expect(tools, `${role.role}: ${task}`).toContain(task);
      expect(tools).not.toContain('TaskOutput');
      for (const task of TASKS) expect(nativeTools, role.role).toContain(task);
      expect(sessionTrackingProblems(text, { coordinator: role.coordinator }), role.role).toEqual([]);
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
