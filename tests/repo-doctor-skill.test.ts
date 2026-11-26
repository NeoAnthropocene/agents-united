import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Plan 052 step 1 (ADR 0080 decisions 1 and 2): the `repo-doctor` factory Skill. Its script runs the fast, mechanical reads
 * of the repository's consistency (README counts, relative links, plans index, ADR numbers) and writes nothing but the report
 * it is asked for. Each finding carries its evidence and a proposed fix. The maintainer chose (2026-11-26) fast checks run by
 * the Skill, slow results only read, and an untracked `.repo-doctor-report.md` in the worktree.
 */

const ROOT = path.resolve(__dirname, '..');
const SKILL = path.join(ROOT, 'registry', 'skills', 'repo-doctor');
const SCRIPT = path.join(SKILL, 'scripts', 'doctor.mjs');

interface Finding { check: string; evidence: string; proposedFix: string }
interface Result { ok: boolean; findings: Finding[]; checks: string[]; skipped: string[] }

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function write(root: string, rel: string, text: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/** A small checkout whose README counts, links, plans index and ADR numbers all agree. */
function cleanFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-doctor-'));
  temps.push(root);
  write(root, 'package.json', JSON.stringify({ name: 'agents-united' }));
  write(root, 'registry/bundles.json', JSON.stringify({ bundles: {
    one: { name: 'one' }, two: { name: 'two' }, wip: { name: 'wip', status: 'under-construction' },
  } }));
  write(root, 'registry/agents/orchestrator-one.md', '# one\n');
  write(root, 'registry/agents/subagent-a.md', '# a\n');
  write(root, 'registry/agents/subagent-b.md', '# b\n');
  write(root, 'registry/skills/alpha/SKILL.md', '# alpha\n');
  write(root, 'registry/skills/workflow-beta/SKILL.md', '# beta\n');
  write(root, 'README.md', [
    '# Fixture',
    '',
    '**In numbers:** 2 end-user bundles · 3 canonical agents (1 orchestrators + 2 sub-agents) · 2 skills (1 domain skills + 1 workflow playbooks).',
    '',
    'See [the plans](plans/README.md) and `[an example](missing.md)`.',
    '',
  ].join('\n'));
  write(root, 'plans/README.md', '# Plans\n\n- [001](001-first.md)\n');
  write(root, 'plans/001-first.md', '# Plan 001\n\nDecided in [ADR 0001](../docs/adr/0001-first.md).\n');
  write(root, 'docs/adr/0001-first.md', '# ADR 0001\n');
  write(root, 'docs/adr/0002-second.md', '# ADR 0002\n');
  return root;
}

function run(root: string, ...args: string[]): { status: number | null; result: Result; stdout: string; stderr: string } {
  const child = spawnSync(process.execPath, [SCRIPT, '--root', root, '--offline', ...args], { encoding: 'utf8' });
  let result = { ok: false, findings: [], checks: [], skipped: [] } as Result;
  try { result = JSON.parse(child.stdout.trim().split(/\r?\n/).pop() ?? '') as Result; } catch { /* asserted below */ }
  return { status: child.status, result, stdout: child.stdout, stderr: child.stderr };
}

function listTree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(`${path.relative(root, full)}:${createHash('sha256').update(fs.readFileSync(full)).digest('hex')}`);
    }
  };
  walk(root);
  return out.sort();
}

describe('the repo-doctor script on a clean checkout', () => {
  it('runs every fast check, finds nothing and exits 0', () => {
    const { status, result, stderr } = run(cleanFixture());
    expect(stderr).toBe('');
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checks).toEqual(['readme-counts', 'relative-links', 'plans-index', 'adr-numbers']);
    expect(result.skipped).toEqual(['open-pr-adr-numbers: --offline']);
    expect(status).toBe(0);
  });

  it('writes nothing without --out, and only the named report with it', () => {
    const root = cleanFixture();
    const before = listTree(root);
    run(root);
    expect(listTree(root)).toEqual(before);

    const report = path.join(root, '.repo-doctor-report.md');
    const { status } = run(root, '--out', report);
    expect(status).toBe(0);
    expect(listTree(root).filter(entry => !entry.startsWith('.repo-doctor-report.md:'))).toEqual(before);
    expect(fs.readFileSync(report, 'utf8')).toMatch(/^# Repo doctor report/m);
  });
});

describe('the repo-doctor script finds drift, with evidence and a proposed fix', () => {
  it('a README count that differs from the registry', () => {
    const root = cleanFixture();
    write(root, 'registry/skills/gamma/SKILL.md', '# gamma\n');
    const { status, result } = run(root);
    expect(status).toBe(1);
    const counts = result.findings.filter(finding => finding.check === 'readme-counts');
    expect(counts.map(finding => finding.evidence)).toEqual([
      'README.md says 2 skills; registry/skills has 3.',
      'README.md says 1 domain skills; registry/skills has 2.',
    ]);
    for (const finding of counts) expect(finding.proposedFix).toMatch(/README\.md/);
  });

  it('a broken relative link, a link into scratch/ and a link with the wrong case, but not a code-span example', () => {
    const root = cleanFixture();
    write(root, 'docs/notes.md', '[gone](gone.md) [log](../scratch/run.log) [case](ADR/0001-first.md) `[example](nowhere.md)`\n');
    const { result } = run(root);
    expect(result.findings.filter(finding => finding.check === 'relative-links').map(finding => finding.evidence)).toEqual([
      'docs/notes.md:1 links gone.md, which does not exist.',
      'docs/notes.md:1 links ../scratch/run.log, inside the ignored scratch/ folder.',
      'docs/notes.md:1 links ADR/0001-first.md, which does not exist.',
    ]);
  });

  it('a missing count in the README line and a stale catalogue sentence', () => {
    const root = cleanFixture();
    const readme = path.join(root, 'README.md');
    fs.writeFileSync(readme, fs.readFileSync(readme, 'utf8')
      .replace(' · 3 canonical agents (1 orchestrators + 2 sub-agents)', '')
      .concat('\nThe 5 skills are open-standard. 1 are **domain skills** and 1 are **workflow playbooks**.\n'));
    const evidence = run(root).result.findings.filter(finding => finding.check === 'readme-counts').map(finding => finding.evidence);
    expect(evidence).toEqual([
      'README.md:3 "**In numbers:**" line states no count of canonical agents.',
      'README.md:3 "**In numbers:**" line states no count of orchestrators.',
      'README.md:3 "**In numbers:**" line states no count of sub-agents.',
      'README.md:7 says 5 skills; registry/skills has 2.',
    ]);
  });

  it('a plan that plans/README.md does not reach', () => {
    const root = cleanFixture();
    write(root, 'plans/002-orphan.md', '# Plan 002\n');
    const { result } = run(root);
    const plans = result.findings.filter(finding => finding.check === 'plans-index');
    expect(plans.map(finding => finding.evidence)).toEqual(['plans/002-orphan.md is not reached from plans/README.md.']);
    expect(plans[0].proposedFix).toMatch(/plans\/README\.md/);
  });

  it('a plan reached only through a linked plan is reached; a wrong-case link reaches nothing; a missing index is a finding', () => {
    const root = cleanFixture();
    write(root, 'plans/001-first.md', '# Plan 001\n\nSee [the follow-up](002-follow-up.md) and [ADR 0001](../docs/adr/0001-first.md).\n');
    write(root, 'plans/002-follow-up.md', '# Plan 002\n');
    write(root, 'plans/README.md', '# Plans\n\n- [001](001-first.md)\n- [003](003-Third.md)\n');
    write(root, 'plans/003-third.md', '# Plan 003\n');
    const evidence = run(root).result.findings.filter(finding => finding.check === 'plans-index').map(finding => finding.evidence);
    expect(evidence).toEqual(['plans/003-third.md is not reached from plans/README.md.']);

    fs.rmSync(path.join(root, 'plans', 'README.md'));
    expect(run(root).result.findings.filter(finding => finding.check === 'plans-index').map(finding => finding.evidence))
      .toEqual(['plans/README.md is missing; 3 numbered plans have no index.']);
  });

  it('two ADRs with one number', () => {
    const root = cleanFixture();
    write(root, 'docs/adr/0002-clash.md', '# ADR 0002 again\n');
    const { result } = run(root);
    expect(result.findings.filter(finding => finding.check === 'adr-numbers').map(finding => finding.evidence))
      .toEqual(['ADR 0002 is used by docs/adr/0002-clash.md and docs/adr/0002-second.md.']);
  });
});

describe('the repo-doctor script on open pull requests (gh output given with --pr-json)', () => {
  function gitFixture(): string {
    const root = cleanFixture();
    const git = (...args: string[]): void => {
      const child = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
      expect(child.status, child.stderr).toBe(0);
    };
    git('init', '-q');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    return root;
  }

  it('reports a number taken on the base and a number two pull requests share, and ignores an edit of a base ADR', () => {
    const root = gitFixture();
    const prs = path.join(root, '..', `${path.basename(root)}-prs.json`);
    temps.push(prs);
    fs.writeFileSync(prs, JSON.stringify([
      { number: 10, files: [{ path: 'docs/adr/0002-other.md' }, { path: 'docs/adr/0001-first.md' }] },
      { number: 11, files: [{ path: 'docs/adr/0003-a.md' }] },
      { number: 12, files: [{ path: 'docs/adr/0003-b.md' }, { path: 'README.md' }] },
    ]));
    const { status, result } = run(root, '--pr-json', prs, '--base', 'HEAD');
    expect(status).toBe(1);
    expect(result.checks).toContain('open-pr-adr-numbers');
    expect(result.findings.filter(finding => finding.check === 'open-pr-adr-numbers').map(finding => finding.evidence)).toEqual([
      'ADR 0002 is added by #10 (docs/adr/0002-other.md) and HEAD already has docs/adr/0002-second.md.',
      'ADR 0003 is added by #11 (docs/adr/0003-a.md) and #12 (docs/adr/0003-b.md).',
    ]);
  });

  it('skips, never passes, when the base ref cannot be read', () => {
    const root = gitFixture();
    const prs = path.join(root, '..', `${path.basename(root)}-prs.json`);
    temps.push(prs);
    fs.writeFileSync(prs, '[]');
    const { result } = run(root, '--pr-json', prs, '--base', 'no-such-ref');
    expect(result.checks).not.toContain('open-pr-adr-numbers');
    expect(result.skipped).toEqual(['open-pr-adr-numbers: no-such-ref not readable (git ls-tree); fetch it or pass --base']);
  });
});

describe('the repo-doctor script writes its report only at the checkout root, as a plain untracked file', () => {
  it('refuses another --out path and writes nothing', () => {
    const root = cleanFixture();
    const before = listTree(root);
    const { status, stdout } = run(root, '--out', path.join(root, 'README.md'));
    expect(status).toBe(2);
    expect(stdout).toMatch(/--out must be/);
    expect(listTree(root)).toEqual(before);
  });

  it('refuses a report path that is a directory', () => {
    const root = cleanFixture();
    fs.mkdirSync(path.join(root, '.repo-doctor-report.md'));
    const { status, stdout } = run(root, '--out', path.join(root, '.repo-doctor-report.md'));
    expect(status).toBe(2);
    expect(stdout).toMatch(/is not a plain file/);
  });
});

describe('the repo-doctor script refuses what is not an agents-united checkout', () => {
  it('exits 2 with a reason and writes nothing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-doctor-not-'));
    temps.push(root);
    const child = spawnSync(process.execPath, [SCRIPT, '--root', root, '--offline', '--out', path.join(root, '.repo-doctor-report.md')], { encoding: 'utf8' });
    expect(child.status).toBe(2);
    expect(child.stdout).toMatch(/not an agents-united checkout/);
    expect(fs.readdirSync(root)).toEqual([]);
  });
});

describe('the repo-doctor Skill in the repository', () => {
  it('belongs to the agent-factory Bundle', () => {
    const bundles = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry', 'bundles.json'), 'utf8')) as { bundles: Record<string, { skills: string[] }> };
    expect(bundles.bundles['agent-factory'].skills).toContain('repo-doctor');
  });

  it('keeps its report out of git', () => {
    const ignored = spawnSync('git', ['check-ignore', '-q', '.repo-doctor-report.md'], { cwd: ROOT });
    expect(ignored.status).toBe(0);
  });

  it('finds nothing on this repository with --offline', () => {
    const { status, result } = run(ROOT);
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
    expect(status).toBe(0);
  });
});
