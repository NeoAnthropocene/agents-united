import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

/**
 * Plan 016 Step 2 / ADR 0018 — catalog conformance guards for the Claude lane.
 *
 * These guards need no implementation module, so most pass today; the skill-name
 * guard is a REAL Red failure because `registry/skills/generative_ui/` violates the
 * Agent Skills name rule that every dialect enforces.
 */

const NAME_RULE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const registryDir = path.resolve(process.cwd(), 'registry');

/**
 * Documented, deliberately narrow exception list: canonical names that the Claude lane normalizes at
 * projection time instead of renaming in the store (see Plan 016 decision "generative_ui"). The
 * canonical rename is deferred to the follow-up branch because it is a cross-host migration that
 * would touch the Cline lane. A test below asserts this list cannot silently grow.
 */
const KNOWN_PROJECTION_RENAMES: Record<string, string> = {
  generative_ui: 'generative-ui',
};

function frontmatter(file: string): Record<string, unknown> {
  const match = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  return (yaml.parse(match[1]) as Record<string, unknown>) || {};
}

describe('Claude lane catalog conformance (Plan 016 Step 2)', () => {
  const agentFiles = fs.readdirSync(path.join(registryDir, 'agents')).filter(f => f.endsWith('.md'));
  const skillDirs = fs
    .readdirSync(path.join(registryDir, 'skills'))
    .filter(d => fs.statSync(path.join(registryDir, 'skills', d)).isDirectory());

  it('every agent basename matches the dialect name rule, before and after prefix stripping', () => {
    const violations: string[] = [];
    for (const file of agentFiles) {
      const base = file.replace(/\.md$/, '');
      const stripped = base.replace(/^subagent-/, '');
      if (!NAME_RULE.test(base)) violations.push(`basename:${base}`);
      if (!NAME_RULE.test(stripped)) violations.push(`stripped:${stripped}`);
    }
    expect(violations).toEqual([]);
  });

  it('stripped agent names are unique (no projection path collisions)', () => {
    const stripped = agentFiles.map(f => f.replace(/\.md$/, '').replace(/^subagent-/, ''));
    const seen = new Map<string, number>();
    for (const name of stripped) seen.set(name, (seen.get(name) ?? 0) + 1);
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
    expect(duplicates).toEqual([]);
  });

  it('every skill directory name and frontmatter name matches the dialect name rule', () => {
    const violations: string[] = [];
    for (const dir of skillDirs) {
      const skillFile = path.join(registryDir, 'skills', dir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) {
        violations.push(`${dir}:missing-SKILL.md`);
        continue;
      }
      const declared = String(frontmatter(skillFile).name ?? '');
      const expectedDir = KNOWN_PROJECTION_RENAMES[dir] ?? dir;
      const expectedName = KNOWN_PROJECTION_RENAMES[declared] ?? declared;
      if (!NAME_RULE.test(expectedDir)) violations.push(`dir:${dir}`);
      if (!NAME_RULE.test(expectedName)) violations.push(`name:${dir}=${declared}`);
      if (declared !== dir) violations.push(`declared-name-mismatch:${dir}=${declared}`);
    }
    expect(violations).toEqual([]);
  });

  it('normalizes every canonical skill name into a dialect-valid name (the Claude lane contract)', async () => {
    const { ClaudeProjector } = await import('../src/core/claude-projector.js');
    const invalid = skillDirs.filter(
      dir => !ClaudeProjector.CLAUDE_DIALECT.nameRegex.test(ClaudeProjector.normalizeSkillName(dir))
    );
    expect(invalid).toEqual([]);
  });

  it('keeps the projection-rename exception list minimal and necessary', () => {
    const entries = Object.entries(KNOWN_PROJECTION_RENAMES);
    expect(entries.map(([from]) => from)).toEqual(['generative_ui']);
    for (const [from, to] of entries) {
      expect(`raw ${from} is invalid: ${NAME_RULE.test(from)}`).toBe(`raw ${from} is invalid: false`);
      expect(NAME_RULE.test(to)).toBe(true);
    }
  });

  it('keeps every skill name+description inside the Claude 1,536-character listing cap', () => {
    const worst: Array<{ skill: string; length: number }> = [];
    for (const dir of skillDirs) {
      const skillFile = path.join(registryDir, 'skills', dir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;
      const meta = frontmatter(skillFile);
      const length = String(meta.name ?? '').length + 1 + String(meta.description ?? '').length;
      worst.push({ skill: dir, length });
    }
    const over = worst.filter(w => w.length > 1536);
    expect(over).toEqual([]);
    worst.sort((a, b) => b.length - a.length);
    expect(worst[0].length).toBeLessThanOrEqual(1536);
  });

  it('keeps the projected subagent description budget under 15,000 tokens', () => {
    let chars = 0;
    for (const file of agentFiles) {
      const meta = frontmatter(path.join(registryDir, 'agents', file));
      chars += String(meta.name ?? '').length + 1 + String(meta.description ?? '').length;
    }
    expect(Math.round(chars / 4)).toBeLessThan(15000);
  });

  it('only declares effort levels Claude accepts', () => {
    const allowed = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
    const violations: string[] = [];
    for (const file of agentFiles) {
      const effort = frontmatter(path.join(registryDir, 'agents', file)).effort;
      if (effort !== undefined && !allowed.has(String(effort))) violations.push(`${file}=${String(effort)}`);
    }
    expect(violations).toEqual([]);
  });
});
