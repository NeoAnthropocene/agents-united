import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AGENTS.md is the instruction file that OpenAI Codex and other agents read by convention (Claude Code reads CLAUDE.md). It
 * must point at the rules that already exist and must not copy them, so that there is one set of rules: CLAUDE.md, the
 * standing rules projected into .claude/rules/ from registry/rules/ and the session gate docs/session-start.md. The projection
 * is ignored install output, so a clean checkout must be checked against the tracked source. `/AGENTS.md` is in .gitignore (the installer
 * generates one for the Codex host), so the file is tracked by force and the test fails if it is ever dropped from the index.
 */

const read = (p: string): string => fs.readFileSync(path.resolve(p), 'utf8').replace(/\r\n/g, '\n');

describe('AGENTS.md', () => {
  const existsSync = fs.existsSync;
  beforeEach(() => {
    // A clean CI checkout has no generated Claude rule projection, even when the local workspace does.
    vi.spyOn(fs, 'existsSync').mockImplementation(target =>
      target === path.resolve('.claude/rules/') ? false : existsSync(target),
    );
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('exists and stays a short pointer file', () => {
    expect(fs.existsSync(path.resolve('AGENTS.md')), 'AGENTS.md exists').toBe(true);
    expect(read('AGENTS.md').trimEnd().split('\n').length).toBeLessThanOrEqual(40);
  });

  it('points at CLAUDE.md, the standing rules and the session gate, whose sources exist in a clean checkout', () => {
    const agents = read('AGENTS.md');
    for (const target of ['CLAUDE.md', '.claude/rules/', 'docs/session-start.md']) {
      expect(agents, `names ${target}`).toContain(target);
      const source = target === '.claude/rules/' ? 'registry/rules/' : target;
      expect(fs.existsSync(path.resolve(source)), `${source} exists`).toBe(true);
    }
  });

  it('keeps the non-negotiables a reader must not miss, and says that live host sessions are the maintainer\'s to type', () => {
    const agents = read('AGENTS.md');
    expect(agents).toMatch(/origin\/dev/);
    expect(agents).toMatch(/never `?main`?/i);
    expect(agents).toMatch(/force-push/i);
    expect(agents).toMatch(/test first/i);
    expect(agents).toMatch(/npm run typecheck && npm test/);
    expect(agents).toMatch(/hostlib:session/);
    expect(agents).toMatch(/maintainer types/i);
  });

  it('uses no em or en dashes (the repository prose does not)', () => {
    expect(read('AGENTS.md')).not.toMatch(/[–—]/);
  });
});
