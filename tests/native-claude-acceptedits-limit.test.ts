import { describe, expect, it } from 'vitest';
import { NATIVE_AGENTS_DIR, nativeText } from './helpers/native-roles.js';
import fs from 'node:fs';

/**
 * A native role says what `permissionMode: acceptEdits` approves (file edits, and for some roles common file commands) without asking. That holds only
 * while the host applies the role's own mode. Host library, `agent/sub-agents.md` (the `permissionMode` field): when the main conversation is in
 * `bypassPermissions`, `acceptEdits` or auto mode, the subagent runs in that same mode and the field is ignored; when the main conversation is in
 * `plan` mode, the subagent stays in plan mode. `orchestration/agent-teams.md`: a new teammate starts with the lead's mode, and per-teammate modes
 * cannot be set at spawn time. So every sentence that states the effect carries one clause, in the same words, saying so.
 */

const CLAUSE = ", when that mode is in force (a parent session's mode can override it, and a teammate takes the lead's mode)";

/** The sentence families, by the words that open each one; the files are those that carry it. */
const FAMILIES: Array<{ name: string; phrase: string; roles: string[] }> = [
  {
    name: 'step 5 of the mobile, data and QA engineers',
    phrase: '`permissionMode: acceptEdits` approves your file edits and common file commands such as `mkdir`, `mv` and `cp` in the working folder without asking',
    roles: ['ai-model-architect', 'android-architect', 'cross-platform-specialist', 'data-engineer', 'distributed-systems-architect', 'e2e-tester', 'ios-architect', 'ml-platform-engineer', 'qa-automation-lead'],
  },
  {
    name: 'the analysts and the two leads that run in this mode',
    phrase: 'file edits inside the working folder are approved without a prompt',
    roles: ['business-panel-experts', 'deep-research', 'financial-analyst', 'legal-contract-analyst', 'market-intelligence-analyst', 'operations-strategist', 'literature-patent-analyst', 'statistical-analyst', 'orchestrator-business', 'orchestrator-universal'],
  },
  {
    name: 'the design roles',
    phrase: 'Under `acceptEdits` the host approves your file edits inside the working folder without asking',
    roles: ['design-ops-lead', 'designer-toolkit-expert', 'design-researcher', 'design-systems-architect', 'interaction-designer', 'prototype-tester', 'ui-designer', 'ux-strategist'],
  },
  {
    name: 'the security roles',
    phrase: 'common file commands such as `rm`, `mv` and `sed` inside the working folder without asking',
    roles: ['appsec-penetration-tester', 'cloud-security-architect', 'compliance-grc-specialist', 'security-engineer', 'orchestrator-security'],
  },
  {
    name: 'the infrastructure, database and operations roles',
    phrase: '`permissionMode: acceptEdits` approves your file edits without asking',
    roles: ['cloud-infrastructure-architect', 'database-administrator', 'finops-cost-engineer', 'sysops-sre-lead', 'system-architect'],
  },
  {
    name: 'the accessibility lead',
    phrase: '`permissionMode: acceptEdits` approves your file edits in the working folder without asking',
    roles: ['accessibility-lead'],
  },
  {
    name: 'the marketing roles',
    phrase: 'Your permission mode is `acceptEdits`: edits to project files go through without a prompt',
    roles: ['lifecycle-email-specialist', 'marketing-campaign-specialist', 'marketing-content-strategist', 'marketing-conversion-specialist', 'marketing-creative-designer', 'marketing-growth-strategist', 'paid-acquisition-specialist', 'plg-strategist', 'seo-specialist'],
  },
];

describe('the sentences that state what acceptEdits approves also say when it holds', () => {
  it.each(FAMILIES)('$name: the sentence is followed by the clause', ({ phrase, roles }) => {
    for (const role of roles) {
      const text = nativeText(role);
      const parts = text.split(phrase);
      expect(parts, role).toHaveLength(2);
      expect(parts[1].startsWith(CLAUSE), `${role}: the clause does not follow the sentence`).toBe(true);
    }
  });

  it('no other role states the effect without the clause: 47 roles, one sentence each', () => {
    const stated = fs.readdirSync(NATIVE_AGENTS_DIR)
      .filter(name => name.endsWith('.md'))
      .map(name => name.replace(/\.md$/, ''))
      .filter(role => nativeText(role).split('\n').some(line => /acceptEdits/.test(line) && /without (asking|a prompt)/.test(line)));
    expect(stated).toHaveLength(47);
    expect([...stated].sort()).toEqual(FAMILIES.flatMap(family => family.roles).sort());
    for (const role of stated) {
      const lines = nativeText(role).split('\n').filter(line => /acceptEdits/.test(line) && /without (asking|a prompt)/.test(line));
      expect(lines, role).toHaveLength(1);
      expect(lines[0], role).toMatch(/without (asking|a prompt), when that mode is in force \(a parent session's mode can override it, and a teammate takes the lead's mode\)/);
    }
  });
});
