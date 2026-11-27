import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nativeText } from './helpers/native-roles.js';

/**
 * The maintainer's decision of 2026-11-27, after the interactive open-items sitting: git is not assumed for every user need. A lead
 * that finds no git repository leaves the folder as it is, creates none unless the user asks for one, skips the steps that need a
 * repository and names the files it wrote in its report, and says the same in every brief so that a specialist creates no repository
 * either. In a repository the guardrails stay as they were.
 *
 * The eight Claude native leads that verify before delivering carry one wording as a numbered step of "Verify before delivering": the
 * first step in six leads, step 5 in business and step 4 in design. In six leads the guard sentence follows "branch first." directly
 * (pinned in the per-lead tests); research and security keep their guard text elsewhere. The Cline engineering lead's skill carries
 * the same wording as its first verify step, followed by its guard-plugin sentence. Engineering's `workflow-implement` bullet, which
 * tells the lead to commit what the workflow wrote, gives the non-repository case too.
 */

const STEP =
  'Run `git status` first. When the folder is not a git repository, leave it so: run no `git init` unless the user asks for one, skip every step that needs a repository (a branch, a commit, a worktree), and name the files you wrote in your report. Say the same in every brief: a specialist creates no repository either. In a repository, never commit to `main`, `master`, `production` or `release/*`; branch first.';
const OLD = 'Run `git status` first. Never commit to';
const OLD_PRESUPPOSITION = 'name the files you wrote in your report instead of committing';
const LEADS = ['business', 'design', 'digital-agency', 'engineering', 'marketing', 'research', 'security', 'system-architecture'].map(
  lead => `orchestrator-${lead}`,
);
const AGENTS = path.resolve('registry/hosts/claude/agents');
const CLAUDE_HOST = path.resolve('registry/hosts/claude');
const SKILLS = path.resolve('registry/skills');
const CLINE_LEAD = path.resolve('registry/hosts/cline/skills/orchestrator-engineering/SKILL.md');
const IMPLEMENT_OLD =
  'It never commits: check `git branch --show-current` first, then review the diff yourself and commit on a feature branch.';
const IMPLEMENT_NEW =
  'It never commits. In a repository, check `git branch --show-current` first, then review the diff yourself and commit on a feature branch; outside one, review the files it changed and name them in your report.';
/** A text check for `git init`: also matches extra spaces and a `-C <dir>` option between `git` and `init`. */
const GIT_INIT = /\bgit\s+(?:-C\s+\S+\s+)?init\b/;

const read = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

/** Every `.md` file under a folder, recursively. */
function markdownUnder(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter(name => name.endsWith('.md'))
    .map(name => path.join(dir, name))
    .filter(file => fs.statSync(file).isFile());
}

/** The lines under a heading, up to the next heading of the same level. */
function section(text: string, heading: string): string[] {
  const lines = text.split('\n');
  const start = lines.indexOf(heading);
  if (start < 0) return [];
  const prefix = `${heading.split(' ')[0]} `;
  const end = lines.findIndex((line, at) => at > start && line.startsWith(prefix));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

describe('a lead does not assume git', () => {
  it.each(LEADS)('%s carries the step word for word, once, as a visible numbered step of Verify before delivering', role => {
    const text = nativeText(role);
    expect(text.split(STEP), role).toHaveLength(2);
    expect(text, role).not.toContain(OLD);
    expect(text, role).not.toContain(OLD_PRESUPPOSITION);
    const steps = section(text, '## Verify before delivering').filter(
      line => /^\d+\. /.test(line) && line.replace(/^\d+\. /, '').startsWith(STEP),
    );
    expect(steps, role).toHaveLength(1);
  });

  it('the Cline engineering lead carries the same step, once, as the first step of Verify before delivering, with its guard-plugin sentence after it', () => {
    const text = read(CLINE_LEAD);
    expect(text.split(STEP)).toHaveLength(2);
    expect(text).not.toContain('Run `git status` first, and never commit to');
    expect(text).not.toContain(OLD_PRESUPPOSITION);
    const steps = section(text, '## 3. Verify before delivering').filter(line => /^\d+\. /.test(line));
    expect(steps[0]).toBe(
      `1. ${STEP} The guard plugin blocks forced pushes, production deploys and \`.env\` writes, but it works only on the CLI: the IDE extensions load no plugins, so there you are the only guard.`,
    );
  });

  it("engineering's workflow-implement bullet commits only in a repository and names the changed files outside one", () => {
    const text = nativeText('orchestrator-engineering');
    expect(text.split(IMPLEMENT_NEW)).toHaveLength(2);
    expect(text).not.toContain(IMPLEMENT_OLD);
  });

  it('a text check for `git init`: no Markdown under the Claude host or the skills, nor the Cline engineering lead, names it except the one approved step', () => {
    // The approved step is exempted once in each listed lead and in the Cline lead; nothing else matched when this check was widened.
    const approved = new Set([...LEADS.map(lead => path.join(AGENTS, `${lead}.md`)), CLINE_LEAD]);
    const files = [...markdownUnder(CLAUDE_HOST), ...markdownUnder(SKILLS), CLINE_LEAD];
    expect(files.length).toBeGreaterThan(LEADS.length + 1);
    const offenders = files
      .filter(file => {
        const text = read(file);
        return GIT_INIT.test(approved.has(file) ? text.replace(STEP, '') : text);
      })
      .map(file => path.relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });

  it('the text check catches the spellings it names', () => {
    for (const form of ['git init', 'git  init', 'git -C . init', 'run `git init` here']) expect(form).toMatch(GIT_INIT);
    for (const form of ['git status', 'git initial', 'digit init']) expect(form).not.toMatch(GIT_INIT);
  });

  it('every Claude native lead that states the old rule ("branch first" or "never commit to") is in the list', () => {
    const others = fs
      .readdirSync(AGENTS)
      .filter(name => name.startsWith('orchestrator-') && name.endsWith('.md'))
      .filter(name => {
        const text = read(path.join(AGENTS, name));
        return text.includes('branch first') || /never commit to/i.test(text);
      })
      .map(name => name.replace(/\.md$/, ''))
      .filter(role => !LEADS.includes(role));
    expect(others).toEqual([]);
  });
});
