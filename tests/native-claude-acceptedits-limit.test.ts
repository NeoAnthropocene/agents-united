import { describe, expect, it } from 'vitest';
import { NATIVE_AGENTS_DIR, nativeText } from './helpers/native-roles.js';
import fs from 'node:fs';

/**
 * A native role says what `permissionMode: acceptEdits` approves (file edits, and for some roles common file commands) without asking. That holds only
 * while the host applies the role's own mode. Host library, `agent/sub-agents.md` (the `permissionMode` field): when the main conversation is in
 * `bypassPermissions`, `acceptEdits` or auto mode, the subagent runs in that same mode and the field is ignored; when the main conversation is in
 * `plan` mode, the subagent stays in plan mode; under `default` or `dontAsk` the declared mode is used. `orchestration/agent-teams.md`: a new teammate starts
 * with the lead's mode (Manual under a `dontAsk` lead), and per-teammate modes cannot be set at spawn time. The docs do not say which mode a role has
 * when it runs as the main session with `--agent`, so the two leads say "your file sets", not "you run in". Every sentence that states the effect
 * carries one clause, in the same words, saying so.
 */

const LIMITS = "(the main session's `acceptEdits`, `auto` or `bypassPermissions` mode replaces it, its `plan` mode keeps you in plan mode, and as a teammate your mode is set by the lead's)";
const CLAUSE = `, when that mode is in force ${LIMITS}`;
const REWORDED = ` while \`acceptEdits\` is in force ${LIMITS}`;

/** The sentence families, by the words that open each one; the files are those that carry it. `after` is what follows the phrase (the clause, unless the family words the condition itself). */
const FAMILIES: Array<{ name: string; phrase: string; after?: string; roles: string[] }> = [
  {
    name: 'step 5 of the mobile, data and QA engineers',
    phrase: '`permissionMode: acceptEdits` approves your file edits and common file commands such as `mkdir`, `mv` and `cp` in the working folder without asking',
    roles: ['ai-model-architect', 'android-architect', 'cross-platform-specialist', 'data-engineer', 'distributed-systems-architect', 'e2e-tester', 'ios-architect', 'ml-platform-engineer', 'qa-automation-lead'],
  },
  {
    name: 'the analysts',
    phrase: 'file edits inside the working folder are approved without a prompt',
    roles: ['business-panel-experts', 'deep-research', 'financial-analyst', 'legal-contract-analyst', 'market-intelligence-analyst', 'operations-strategist', 'literature-patent-analyst', 'statistical-analyst'],
  },
  {
    name: 'the two leads whose file sets the mode',
    phrase: 'Your file sets `acceptEdits`, so file edits inside the working folder are approved without a prompt',
    roles: ['orchestrator-business', 'orchestrator-universal'],
  },
  {
    name: 'the design roles',
    phrase: 'The host approves your file edits inside the working folder without asking',
    after: REWORDED,
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
  it.each(FAMILIES)('$name: the sentence is followed by the clause', ({ phrase, after, roles }) => {
    for (const role of roles) {
      const parts = nativeText(role).split(phrase);
      expect(parts, role).toHaveLength(2);
      expect(parts[1].startsWith(after ?? CLAUSE), `${role}: the clause does not follow the sentence`).toBe(true);
    }
  });

  it('states no condition twice: the design roles word it once', () => {
    for (const role of FAMILIES.find(family => family.after)!.roles) expect(nativeText(role), role).not.toContain('Under `acceptEdits` the host approves');
  });

  it('the two leads do not claim to run in the mode', () => {
    for (const role of ['orchestrator-business', 'orchestrator-universal']) expect(nativeText(role), role).not.toContain('You run in `acceptEdits` mode');
  });

  it('no role keeps the first wording of the clause', () => {
    for (const file of fs.readdirSync(NATIVE_AGENTS_DIR).filter(name => name.endsWith('.md'))) {
      expect(nativeText(file.replace(/\.md$/, '')), file).not.toContain("a parent session's mode can override it");
    }
  });

  it('no other role states the effect without the clause: 47 roles, one sentence each', () => {
    const effectLines = (role: string): string[] => nativeText(role).split('\n').filter(line => /acceptEdits/.test(line) && /without (asking|a prompt)/.test(line));
    const stated = fs.readdirSync(NATIVE_AGENTS_DIR).filter(name => name.endsWith('.md')).map(name => name.replace(/\.md$/, '')).filter(role => effectLines(role).length > 0);
    expect(stated).toHaveLength(47);
    expect([...stated].sort()).toEqual(FAMILIES.flatMap(family => family.roles).sort());
    for (const role of stated) {
      expect(effectLines(role), role).toHaveLength(1);
      expect(effectLines(role)[0], role).toMatch(/without (asking|a prompt)(, when that mode is in force| while `acceptEdits` is in force) \(the main session's `acceptEdits`, `auto` or `bypassPermissions` mode replaces it, its `plan` mode keeps you in plan mode, and as a teammate your mode is set by the lead's\)/);
    }
  });
});
