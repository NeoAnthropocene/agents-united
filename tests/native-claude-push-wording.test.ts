import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { NATIVE_AGENTS_DIR, nativeText } from './helpers/native-roles.js';

/**
 * The roles that hold the whole `mcp__github` server hold `push_files` and `merge_pull_request`, which the guard does not see. The repository rule
 * (`registry/rules/git-guardrails.md`, item 2) never allows a forced push, so the role text cannot let a request authorise one: a push or a merge
 * needs the user's explicit word, and a force push is never done.
 */

const VARIANT_1 = [
  'android-architect', 'appsec-penetration-tester', 'backend-architect', 'cloud-security-architect', 'cross-platform-specialist', 'devops-engineer',
  'distributed-systems-architect', 'ios-architect', 'orchestrator-security', 'security-engineer',
];
const VARIANT_2 = ['cloud-infrastructure-architect', 'sysops-sre-lead', 'system-architect'];

const ONE = "Pull-request and repository reads go through `mcp__github`; push or merge only on the user's explicit word, and never force a push.";
const TWO = "so pushing or merging only on the user's explicit word, never forcing a push, and creating nothing there unasked, is your own obligation.";

describe('the roles that hold the GitHub server push or merge only on the user\'s word, and never force a push', () => {
  it.each(VARIANT_1)('%s: states the rule in the form of the Boundaries bullet', role => {
    expect(nativeText(role)).toContain(ONE);
  });

  it.each(VARIANT_2)('%s: states the rule where the guard does not see the server calls', role => {
    expect(nativeText(role)).toContain(TWO);
  });

  it('no role keeps the wording that let a request authorise a force push', () => {
    for (const file of fs.readdirSync(NATIVE_AGENTS_DIR).filter(name => name.endsWith('.md'))) {
      const text = nativeText(file.replace(/\.md$/, ''));
      expect(text, file).not.toContain('do not push, merge or force anything without being asked');
      expect(text, file).not.toContain('not pushing, merging or creating anything there without being asked');
    }
  });
});
