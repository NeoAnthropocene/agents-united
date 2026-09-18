import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Plan 015 §5.9 items 1-2 — catalog portability guard.
 *
 * A live Cline field test in an external project (§5.8) proved two runbook
 * assumptions that do not hold outside this repository:
 *   1. Gate tables cite literal project scripts (`npm test`, `npm run lint`,
 *      `npm run test:coverage`) that a consumer project may never have defined.
 *   2. The Automated Rollback Protocol assumed git, which greenfield projects
 *      legitimately lack.
 *
 * Permanent guard: every script-invoking gate literal must be absent-tolerant
 * (`--if-present`) and every git-based rollback line must carry a non-git
 * fallback. Built-in commands (`npm audit`) and third-party runners
 * (`npx agents-united doctor`, `npx playwright test`, `git ...`) stay untouched.
 */
const skillsDir = path.resolve(process.cwd(), 'registry', 'skills');

const listSkillFiles = (): string[] => {
  const files: string[] = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
    if (fs.existsSync(skillMd)) files.push(skillMd);
  }
  return files;
};

interface GateRow {
  file: string;
  line: number;
  row: string;
}

const collectGateRows = (files: string[]): GateRow[] => {
  const rows: GateRow[] = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((row, index) => {
      if (row.startsWith('| Phase')) {
        rows.push({ file: path.relative(process.cwd(), file), line: index + 1, row });
      }
    });
  }
  return rows;
};

/** Backticked command spans, split on `&&` so compound gate cells are inspected too. */
const commandLiterals = (row: string): string[] => {
  const literals: string[] = [];
  for (const match of row.matchAll(/`([^`]*)`/g)) {
    for (const segment of match[1].split('&&')) {
      const trimmed = segment.trim();
      if (trimmed.length > 0) literals.push(trimmed);
    }
  }
  return literals;
};

/** `npm test` and `npm run <script>` invoke package scripts; `npm audit` is built-in. */
const isScriptInvocation = (literal: string): boolean =>
  literal.startsWith('npm run ') || literal.startsWith('npm test');

describe('Gate command portability (Plan 015 §5.9 item 1)', () => {
  const files = listSkillFiles();
  const gateRows = collectGateRows(files);

  it('scans the full canonical skill catalog', () => {
    // Catalog contract (ADR 0016 cutover, post PR #42 merge): 166 canonical SKILL.md files.
    expect(files.length).toBe(166);
  });

  it('still finds the phase-gate tables (guard is not vacuous)', () => {
    // Measured 2026-09-18 (post-change): 207 gate rows across the catalog.
    expect(gateRows.length).toBeGreaterThan(190);
  });

  it('never cites a bare npm test as a gate command', () => {
    const offenders = gateRows
      .filter(({ row }) => /\bnpm test\b/.test(row))
      .map(({ file, line, row }) => `${file}:${line}: ${row.trim()}`);

    expect(offenders).toEqual([]);
  });

  it('requires --if-present on every npm script gate command', () => {
    const offenders: string[] = [];
    for (const { file, line, row } of gateRows) {
      for (const literal of commandLiterals(row)) {
        if (!isScriptInvocation(literal)) continue;
        if (!literal.includes('--if-present')) {
          offenders.push(`${file}:${line}: ${literal}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('leaves built-in and third-party gate commands untouched', () => {
    const offenders = gateRows
      .filter(({ row }) =>
        /`npm audit --if-present`|`npx [^`]*--if-present|`git [^`]*--if-present/.test(row),
      )
      .map(({ file, line, row }) => `${file}:${line}: ${row.trim()}`);

    expect(offenders).toEqual([]);
    // The built-in audit gate must survive the rewrite (scope discipline).
    expect(gateRows.some(({ row }) => row.includes('`npm audit`'))).toBe(true);
  });
});

describe('Git-less rollback fallback (Plan 015 §5.9 item 2)', () => {
  const rollbackRunbooks = [
    'registry/skills/workflow-implement/SKILL.md',
    'registry/skills/workflow-cleanup/SKILL.md',
    'registry/skills/workflow-test/SKILL.md',
  ];

  for (const relPath of rollbackRunbooks) {
    it(`${relPath} keeps git guidance and adds a non-git fallback`, () => {
      const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
      const line = content
        .split(/\r?\n/)
        .find((candidate) => candidate.includes('**Automated Rollback Protocol**'));

      expect(line, `missing Automated Rollback Protocol line in ${relPath}`).toBeDefined();
      expect(line).toMatch(/is-inside-work-tree|not a git repository/i);
      // The original git-based guidance must remain (additive change).
      expect(line).toContain('git ');
    });
  }
});
