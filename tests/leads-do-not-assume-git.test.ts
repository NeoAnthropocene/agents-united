import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nativeText } from './helpers/native-roles.js';

/**
 * The maintainer's decision of 2026-11-27, after the interactive open-items sitting: git is not assumed for every user need. A lead
 * that finds no git repository leaves the folder as it is, creates none unless the user asks for one, skips the steps that need a
 * repository and reports the files it wrote instead of a commit. In a repository the guardrails stay as they were. The Claude native
 * leads that verify before delivering carry one wording; the guard sentence still follows "branch first." (pinned in the per-lead
 * tests).
 */

const STEP =
  'Run `git status` first. When the folder is not a git repository, leave it so: run no `git init` unless the user asks for one, skip every step that needs a repository (a branch, a commit, a worktree), and name the files you wrote in your report instead of committing. In a repository, never commit to `main`, `master`, `production` or `release/*`; branch first.';
const OLD = 'Run `git status` first. Never commit to';
const LEADS = ['business', 'design', 'digital-agency', 'engineering', 'marketing', 'research', 'security', 'system-architecture'].map(
  lead => `orchestrator-${lead}`,
);
const AGENTS = path.resolve('registry/hosts/claude/agents');
/** A text check for a repository being created: `git init`, with any spacing or a `-C <dir>` option between. */
const GIT_INIT = /\bgit\s+(?:-C\s+\S+\s+)?init\b/;

const read = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

/** The lines under the level-2 heading `## Verify before delivering`, up to the next level-2 heading. */
function verifySection(text: string): string[] {
  const lines = text.split('\n');
  const start = lines.indexOf('## Verify before delivering');
  if (start < 0) return [];
  const end = lines.findIndex((line, at) => at > start && line.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

describe('a lead does not assume git', () => {
  it.each(LEADS)('%s carries the step word for word, once, as a visible numbered step of Verify before delivering', role => {
    const text = nativeText(role);
    expect(text.split(STEP), role).toHaveLength(2);
    expect(text, role).not.toContain(OLD);
    const steps = verifySection(text).filter(line => /^\d+\. /.test(line) && line.replace(/^\d+\. /, '').startsWith(STEP));
    expect(steps, role).toHaveLength(1);
  });

  it('no Claude native agent mentions creating a repository, except the one step in each of these leads', () => {
    const offenders = fs
      .readdirSync(AGENTS)
      .filter(name => name.endsWith('.md'))
      .filter(name => {
        const text = read(path.join(AGENTS, name));
        const rest = LEADS.includes(name.replace(/\.md$/, '')) ? text.replace(STEP, '') : text;
        return GIT_INIT.test(rest);
      });
    expect(offenders).toEqual([]);
  });

  it('the text check catches the spellings it names', () => {
    for (const form of ['git init', 'git  init', 'git -C . init', 'run `git init` here']) expect(form).toMatch(GIT_INIT);
    for (const form of ['git status', 'git initial', 'digit init']) expect(form).not.toMatch(GIT_INIT);
  });

  it('every Claude native lead whose text names "branch first" is in the list (an inventory of that phrase)', () => {
    const others = fs
      .readdirSync(AGENTS)
      .filter(name => name.startsWith('orchestrator-') && name.endsWith('.md'))
      .filter(name => read(path.join(AGENTS, name)).includes('branch first'))
      .map(name => name.replace(/\.md$/, ''))
      .filter(role => !LEADS.includes(role));
    expect(others).toEqual([]);
  });
});
