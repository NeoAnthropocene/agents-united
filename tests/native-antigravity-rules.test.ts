import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadHostProfile } from '../src/core/host-profile.js';

/**
 * Plan 032 Phase 8 / ADR 0030 — the native Antigravity rules. The legacy lane copies `registry/rules/*.md` into `.agents/rules/` byte for
 * byte, and those files have no frontmatter; the rules guide (from the docs snapshot) says every `.md` inside `rules/` must start with
 * frontmatter declaring a valid `trigger`, or Antigravity silently discards the rule. Whether the installed build really drops them is
 * unverified, so the native rule is the same text behind a valid trigger. The body of each file is generated from the registry rule
 * (regenerate with `UPDATE_NATIVE=1 npx vitest run tests/native-antigravity-rules.test.ts`), so the two cannot drift.
 */

const registry = path.resolve('registry');
const RULES_DIR = path.join(registry, 'hosts/antigravity/rules');
const SNAPSHOT = fs.readFileSync(path.resolve('host-library/antigravity/pages/rule/rules.md'), 'utf8').replace(/\r\n/g, '\n');
const lf = (text: string): string => text.replace(/\r\n/g, '\n');

/** The rules the engineering bundles install; host entrypoint files (GEMINI.md, AGENTS.md, ...) are a different mechanism. */
const NAMES = ['clean-code-and-architecture', 'domain-modeling-and-adr', 'git-guardrails', 'multi-agent-coordination', 'quality-aesthetics-accessibility', 'test-driven-development'];
const ALWAYS_ON = ['git-guardrails', 'test-driven-development'];
const fileOf = (name: string): string => path.join(RULES_DIR, `${name}.md`);
const registryBody = (name: string): string => lf(fs.readFileSync(path.join(registry, 'rules', `${name}.md`), 'utf8')).replace(/^\n+/, '').replace(/\n*$/, '\n');
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

/** Triggers and keys as the docs snapshot states them. */
const TRIGGERS = /trigger: model_decision\s+# Required: ([a-z_ |]+)\n/.exec(SNAPSHOT)![1].split('|').map(item => item.trim());
const KEYS = ['trigger', 'description', 'globs', 'glob'];

beforeAll(() => {
  if (process.env.UPDATE_NATIVE !== '1') return;
  for (const name of NAMES.filter(entry => fs.existsSync(fileOf(entry)))) {
    const text = lf(fs.readFileSync(fileOf(name), 'utf8'));
    const front = FRONTMATTER.exec(text)![0];
    fs.writeFileSync(fileOf(name), `${front}\n${registryBody(name)}`);
  }
});

describe('the native Antigravity rules', () => {
  it('ship exactly the six rules the engineering bundles install, and no host entrypoint file', () => {
    expect(fs.readdirSync(RULES_DIR).sort()).toEqual(NAMES.map(name => `${name}.md`).sort());
    for (const name of NAMES) expect(fs.existsSync(path.join(registry, 'rules', `${name}.md`)), name).toBe(true);
  });

  it('read the valid triggers from the docs snapshot, so a new mode there is seen here', () => {
    expect(TRIGGERS).toEqual(['always_on', 'model_decision', 'glob', 'manual']);
  });

  it('exist because the registry rules carry no frontmatter, which is what the docs say Antigravity discards', () => {
    for (const name of NAMES) expect(lf(fs.readFileSync(path.join(registry, 'rules', `${name}.md`), 'utf8')).startsWith('---'), `registry rule ${name}`).toBe(false);
    expect(SNAPSHOT).toMatch(/Every `\.md` file inside `rules\/` must start with YAML frontmatter/);
    expect(SNAPSHOT).toMatch(/silently discards the rule/);
  });
});

describe.each(NAMES)('native Antigravity rule %s', name => {
  const read = (): string => lf(fs.readFileSync(fileOf(name), 'utf8'));
  const meta = (): Record<string, unknown> => yaml.parse(FRONTMATTER.exec(read())![1]) as Record<string, unknown>;

  it('starts with frontmatter holding a valid trigger and only documented keys', () => {
    expect(read().startsWith('---\n')).toBe(true);
    for (const key of Object.keys(meta())) expect(KEYS, `unknown key ${key}`).toContain(key);
    expect(TRIGGERS).toContain(meta().trigger);
  });

  it(ALWAYS_ON.includes(name) ? 'is always on: the safety and test-first rules cost their text every turn' : 'is model-decided, with a description that says when to apply it', () => {
    if (ALWAYS_ON.includes(name)) {
      expect(meta().trigger).toBe('always_on');
    } else {
      expect(meta().trigger).toBe('model_decision');
      const description = String(meta().description);
      expect(description.length).toBeGreaterThan(40);
      expect(description.length).toBeLessThanOrEqual(300);
      expect(description).toMatch(/^Apply when/);
    }
  });

  it('carries the registry rule verbatim after the frontmatter', () => {
    expect(read().slice(FRONTMATTER.exec(read())![0].length).replace(/^\n+/, '')).toBe(registryBody(name));
  });

  it('is far below the 24,000-byte per-file limit', () => {
    expect(Buffer.byteLength(read())).toBeLessThan(6000);
  });
});

describe('the budget', () => {
  it('keeps the always-on rules well inside the 20,000-token aggregate shared with the user\'s own rules (about 4 characters a token)', () => {
    const total = ALWAYS_ON.map(name => fs.readFileSync(fileOf(name), 'utf8').length).reduce((sum, size) => sum + size, 0);
    expect(total / 4).toBeLessThan(2500);
    expect(SNAPSHOT).toMatch(/20,000-token aggregate rules budget/);
  });
});

describe('the Antigravity profile records the frontmatter rule', () => {
  it('as a feature, observed: the legacy files were dropped and the native ones loaded', () => {
    const feature = loadHostProfile(registry, 'antigravity').features.rulesFrontmatter;
    expect(feature.status).toBe('observed');
    expect(feature.note).toMatch(/silently discard/i);
    expect(feature.note).toMatch(/NONE/);
    expect(feature.note).toMatch(/always_on/);
  });

  it('and records that GEMINI.md is read without frontmatter, in .agents/ and in .agents/rules/, beside the native rules (observed), with the symlinked copy not established', () => {
    const feature = loadHostProfile(registry, 'antigravity').features.geminiMd;
    expect(feature.status).toBe('observed');
    expect(feature.note).toMatch(/\.agents\/rules\/GEMINI\.md/);
    expect(feature.note).toMatch(/\.agents\/GEMINI\.md/);
    expect(feature.note).toMatch(/frontmatter/i);
    expect(feature.note).toMatch(/twice|both|duplicate|overlap/i);
    expect(feature.note).toMatch(/symlink/i);
    expect(feature.note).toMatch(/not established/i);
  });
});
