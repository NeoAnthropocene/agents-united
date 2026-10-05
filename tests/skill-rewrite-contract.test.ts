import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_AGENTS_DIR, NATIVE_ROLES } from './helpers/native-roles.ts';
import { MAX_CHARS, validateRewrittenSkill } from './helpers/skill-contract.ts';
import { supportingText } from './helpers/skill-layout.ts';

/**
 * Plan 035 (ADR 0040): the contract of a rewritten skill.
 *
 * A rewrite is recognised by `metadata.version: 3.0.0`. It keeps the seven mandatory sections and the
 * metadata, stays inside the host size limits, carries none of the template's tell-tale phrases, and
 * has the four things a fit skill has: a worked example, anti-patterns, the evidence it must produce,
 * and a hand-off. A rewritten skill in the digital-agency bundle must be loaded by a native role.
 */

const ROOT = process.cwd();
const SKILLS = path.join(ROOT, 'registry', 'skills');
const MARKERS = path.join(ROOT, 'tests', 'fixtures', 'templated-skills');

const GOOD = `---
name: sample-skill
description: A sample skill that explains, for one role, when and how to do one thing well.
metadata:
  author: agents-united
  version: 3.0.0
  icon: x
---

# Sample Skill

## Overview & Purpose
Text.

## Execution Triggers
Text.

## Input/Output Requirements
Evidence to produce: a table.

## Step-by-Step Runbook
Hand off the result to Kaan.

## Code & Config Exemplars
### Worked example
Numbers.

Anti-patterns: none.

## Edge Cases & Error Recovery
Text.

## Verification Checklist
- [ ] Text.
`;

describe('the rewritten-skill contract (validator)', () => {
  it('accepts a skill with the seven sections, a worked example, anti-patterns, evidence and a hand-off', () => {
    expect(validateRewrittenSkill('sample-skill', GOOD)).toEqual([]);
  });

  it('rejects a missing section, a template phrase, a source and an over-long skill', () => {
    const bad = GOOD.replace('## Edge Cases & Error Recovery', '## Other').replace('Text.', 'This provides a deterministic framework. Run npm run typecheck.').replace('author: agents-united', 'author: agents-united\n  source: https://example.com/x');
    const errors = validateRewrittenSkill('sample-skill', bad).join('\n');
    expect(errors).toContain('missing section "## Edge Cases & Error Recovery"');
    expect(errors).toContain('deterministic framework');
    expect(errors).toContain('npm run typecheck');
    expect(errors).toContain('carries no metadata.source');
    expect(validateRewrittenSkill('sample-skill', GOOD + 'x'.repeat(MAX_CHARS)).join('\n')).toContain('characters');
  });

  it('rejects a skill with no worked example, no anti-patterns, no evidence or no hand-off', () => {
    const bare = GOOD.replace(/worked example/gi, 'sample').replace(/anti-patterns/gi, 'notes').replace(/evidence/gi, 'output').replace(/hand off/gi, 'send');
    const errors = validateRewrittenSkill('sample-skill', bare).join('\n');
    expect(errors).toContain('no "worked example"');
    expect(errors).toContain('no anti-patterns');
    expect(errors).toContain('names no evidence');
    expect(errors).toContain('no hand-off');
  });

  it('rejects a front matter name that differs from the folder', () => {
    expect(validateRewrittenSkill('other-name', GOOD).join('\n')).toContain('front matter name is sample-skill');
  });
});

describe('every rewritten skill of the catalog (version 3.0.0)', () => {
  const rewritten = fs
    .readdirSync(SKILLS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(SKILLS, e.name, 'SKILL.md')))
    .map((e) => e.name)
    .filter((n) => /^\s+version:\s*['"]?3\.0\.0/m.test(fs.readFileSync(path.join(SKILLS, n, 'SKILL.md'), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''));

  it('meets the contract', () => {
    const errors = rewritten.flatMap((n) => validateRewrittenSkill(n, fs.readFileSync(path.join(SKILLS, n, 'SKILL.md'), 'utf8'), supportingText(path.join(SKILLS, n))));
    expect(errors).toEqual([]);
  });

  it('has deleted its allowlist marker', () => {
    const still = rewritten.filter((n) => fs.existsSync(path.join(MARKERS, n)));
    expect(still, `Delete tests/fixtures/templated-skills/<name> for: ${still.join(', ')}`).toEqual([]);
  });

  it('is loaded by a native agency role when it belongs to the digital-agency bundle', () => {
    const bundle: string[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry', 'bundles.json'), 'utf8')).bundles['digital-agency'].skills;
    const roleText = NATIVE_ROLES.filter((r) => r.tier === 2).map((r) => fs.readFileSync(path.join(NATIVE_AGENTS_DIR, `${r.role}.md`), 'utf8'));
    const unwired = rewritten.filter((n) => bundle.includes(n) && !roleText.some((t) => t.includes(`\`${n}\``) || t.includes(`/${n}`)));
    expect(unwired, `Rewritten but loaded by no native role: ${unwired.join(', ')}`).toEqual([]);
  });

});
