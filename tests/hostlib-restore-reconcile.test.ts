import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditDirectory } from '../scripts/hostlib/audit.ts';
import { classifyExtra, droppedExtras, listFiles } from '../scripts/hostlib/provenance.ts';
import { missingUpstreamFiles, recordRestoreInNotice, restoreExtras, stripAttributionHeader } from '../scripts/hostlib/restore.ts';

/**
 * Plan 032 PR D, bundle qa-automation. Two tooling gaps the bundle exposed:
 *  - the provenance "dropped extras" lists count files a port only renamed (Terraform, mutation-testing), so a
 *    restore plan built on them promises work that is already done;
 *  - a restore must leave the skill's NOTICE.md saying what was restored, not only the commit message.
 * Then the restore itself: playwright-best-practices (MIT, 58 documents in eight topic folders).
 */

const roots: string[] = [];
afterEach(() => {
  while (roots.length > 0) fs.rmSync(roots.pop()!, { recursive: true, force: true });
});
const tmp = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hostlib-reconcile-'));
  roots.push(dir);
  return dir;
};
const write = (root: string, rel: string, text: string): void => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
const lf = (text: string): string => text.replace(/\r\n/g, '\n');

describe('missingUpstreamFiles', () => {
  it('counts a file present under a case- or separator-renamed name as present (Terraform style)', () => {
    const up = tmp();
    const local = tmp();
    write(up, 'references/CI_CD.md', '# CI\n');
    write(local, 'references/ci-cd.md', '# CI edited\n');
    expect(missingUpstreamFiles(up, local)).toEqual([]);
  });

  it('counts a file present under a different name and folder with the same content as present (mutation-testing style)', () => {
    const up = tmp();
    const local = tmp();
    write(up, 'workflows/bug-hunter.md', '# Bug hunter\n\nSteps.\n');
    write(local, 'references/workflow-bug-hunter.md', '<!-- Adapted from upstream. Licence: see ../LICENSE. -->\n\n# Bug hunter\n\nSteps.\n');
    expect(missingUpstreamFiles(up, local)).toEqual([]);
  });

  it('keeps a file missing when nothing local matches by name or content', () => {
    const up = tmp();
    const local = tmp();
    write(up, 'rules/a.md', '# A\n');
    write(up, 'rules/b.md', '# B\n');
    write(local, 'references/other.md', '# Different\n');
    expect(missingUpstreamFiles(up, local)).toEqual(['rules/a.md', 'rules/b.md']);
  });

  it('never reports SKILL.md, licence files or git metadata', () => {
    const up = tmp();
    const local = tmp();
    for (const file of ['SKILL.md', 'LICENSE', 'LICENSE.md', 'NOTICE.md', '.gitignore']) write(up, file, 'x\n');
    expect(missingUpstreamFiles(up, local)).toEqual([]);
  });

  it('agrees with droppedExtras on plain names', () => {
    const up = tmp();
    const local = tmp();
    write(up, 'rules/a.md', '# A\n');
    write(local, 'rules/a.md', '# A\n');
    write(up, 'rules/b.md', '# B\n');
    expect(missingUpstreamFiles(up, local)).toEqual(droppedExtras(listFiles(up), listFiles(local)));
  });
});

describe('recordRestoreInNotice', () => {
  const NOTICE = '# NOTICE — `demo`\n\n## Source\n\n- Upstream: x\n\n## What changed\n\n- SKILL.md was adapted.\n';

  it('appends a section naming the count, the folders and the date, and keeps the rest', () => {
    const dir = tmp();
    write(dir, 'NOTICE.md', NOTICE);
    recordRestoreInNotice(dir, ['core/a.md', 'core/b.md', 'advanced/c.md'], '2026-09-30');
    const text = fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8');
    expect(text.startsWith(NOTICE)).toBe(true);
    expect(text).toContain('## Restored documents');
    expect(text).toContain('3 upstream documents');
    expect(text).toContain('`core/` (2)');
    expect(text).toContain('`advanced/` (1)');
    expect(text).toContain('2026-09-30');
  });

  it('replaces its own section on a second call instead of adding another', () => {
    const dir = tmp();
    write(dir, 'NOTICE.md', NOTICE);
    recordRestoreInNotice(dir, ['core/a.md'], '2026-09-30');
    recordRestoreInNotice(dir, ['core/a.md', 'core/b.md'], '2026-10-01');
    const text = fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8');
    expect(text.match(/## Restored documents/g)).toHaveLength(1);
    expect(text).toContain('2 upstream documents');
    expect(text).toContain('2026-10-01');
  });

  it('keeps a section that follows its own', () => {
    const dir = tmp();
    write(dir, 'NOTICE.md', `${NOTICE}\n## Restored documents (Plan 032 PR D)\n\nold\n\n## Upstream NOTICE (verbatim)\n\nkeep me\n`);
    recordRestoreInNotice(dir, ['core/a.md'], '2026-09-30');
    const text = fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8');
    expect(text).toContain('## Upstream NOTICE (verbatim)\n\nkeep me');
    expect(text).not.toContain('\nold\n');
  });

  it('refuses when there is no NOTICE.md', () => {
    expect(() => recordRestoreInNotice(tmp(), ['core/a.md'], '2026-09-30')).toThrow(/NOTICE\.md/);
  });
});

describe('restoreExtras records itself in the skill NOTICE.md', () => {
  it('adds the section when it restores, and leaves NOTICE.md alone when there is nothing to restore', () => {
    const root = tmp();
    write(root, '_upstream/demo/rules/a.md', '# A\n');
    write(root, 'skills/demo/LICENSE', 'MIT License\n');
    write(root, 'skills/demo/NOTICE.md', '# N\n');
    write(root, 'skills/demo/SKILL.md', '---\nname: demo\n---\n');
    const record = { skill: 'demo', provenance: 'third-party-pinned', repo: 'a/b', path: 'p', sha: 'e'.repeat(40), declaredLicence: 'MIT', snapshot: true, audit: { verdict: 'pass', findings: [] }, droppedExtras: ['rules/a.md'] } as never;
    restoreExtras({ skillsDir: path.join(root, 'skills'), upstreamDir: path.join(root, '_upstream'), record, today: '2026-09-30' });
    expect(fs.readFileSync(path.join(root, 'skills/demo/NOTICE.md'), 'utf8')).toContain('1 upstream document');
    const empty = { ...(record as object), droppedExtras: [] } as never;
    write(root, 'skills/demo/NOTICE.md', '# N\n');
    restoreExtras({ skillsDir: path.join(root, 'skills'), upstreamDir: path.join(root, '_upstream'), record: empty, today: '2026-09-30' });
    expect(fs.readFileSync(path.join(root, 'skills/demo/NOTICE.md'), 'utf8')).toBe('# N\n');
  });
});

describe('every restored skill keeps SKILL.md small and pointing at what was restored', () => {
  const skillsDir = path.resolve('registry/skills');
  const provenance = (JSON.parse(fs.readFileSync(path.resolve('host-library/_upstream/skills.json'), 'utf8')) as { skills: Record<string, Record<string, unknown>> }).skills;
  const restored = Object.entries(provenance).filter(([, record]) => record.restoredAt).map(([name]) => name);

  it('finds the restored skills (pilot + qa-automation)', () => {
    expect(restored).toEqual(expect.arrayContaining(['postgres-best-practices', 'clickhouse-architecture-advisor', 'playwright-best-practices']));
  });

  it.each(restored)('%s: a compact "Reference files" section naming every restored folder', name => {
    const dir = path.join(skillsDir, name);
    const body = lf(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'));
    const section = /### Reference files\n([\s\S]*?)(?=\n## )/.exec(body)?.[1];
    expect(section, `${name} needs a "### Reference files" section`).toBeDefined();
    expect(section!.length, 'SKILL.md is loaded on every invocation: keep the pointer small').toBeLessThan(900);
    const restoredFiles = listFiles(dir).filter(file => lf(fs.readFileSync(path.join(dir, file), 'utf8')).includes('Restored verbatim from upstream'));
    expect(restoredFiles.length).toBeGreaterThan(0);
    for (const folder of new Set(restoredFiles.filter(file => file.includes('/')).map(file => file.split('/')[0]))) {
      expect(section, `the pointer must name ${folder}/`).toContain(`${folder}/`);
    }
  });
});

describe('the restored qa-automation bundle', () => {
  const provenance = (JSON.parse(fs.readFileSync(path.resolve('host-library/_upstream/skills.json'), 'utf8')) as { skills: Record<string, Record<string, any>> }).skills;
  const skill = 'playwright-best-practices';
  const dir = path.resolve('registry/skills', skill);
  const upstream = path.resolve('host-library/_upstream', skill);

  it('restores all 58 upstream documents byte-for-byte behind their headers, in upstream layout', () => {
    const files = listFiles(upstream).filter(file => file !== 'SKILL.md' && classifyExtra(file) === 'content');
    expect(files).toHaveLength(58);
    for (const file of files) {
      const text = lf(fs.readFileSync(path.join(dir, file), 'utf8'));
      expect(lf(stripAttributionHeader(file, text)), file).toBe(lf(fs.readFileSync(path.join(upstream, file), 'utf8')));
      expect(text, file).toContain('Restored verbatim from upstream (repository and commit pinned in');
    }
  });

  it('records the restore in NOTICE.md and keeps the licence text and pinned commit', () => {
    const notice = fs.readFileSync(path.join(dir, 'NOTICE.md'), 'utf8');
    expect(notice).toContain('## Restored documents');
    expect(notice).toContain('58 upstream documents');
    expect(notice).toContain(provenance[skill].sha);
    expect(fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8')).toMatch(/Permission is hereby granted/);
  });

  it('provenance lists nothing left to restore for playwright, and mutation-testing is reconciled (its files were renamed, not dropped)', () => {
    expect(provenance[skill].droppedExtras ?? []).toEqual([]);
    expect(provenance[skill].restoredAt).toBe('2026-09-30');
    expect(provenance['mutation-testing'].droppedExtras ?? []).toEqual([]);
    expect(provenance['mutation-testing'].restoredAt).toBeUndefined();
    expect(fs.existsSync(path.resolve('registry/skills/mutation-testing/workflows'))).toBe(false);
  });

  it('the rest of the qa-automation bundle has no documents left to restore', () => {
    const bundles = (JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles?: Record<string, { skills: string[] }> } & Record<string, { skills: string[] }>);
    const table = bundles.bundles ?? bundles;
    const left = table['qa-automation'].skills.filter(name => (provenance[name]?.droppedExtras ?? []).length > 0);
    expect(left).toEqual([]);
  });

  it('the restored folder passes the security audit gate', () => {
    const report = auditDirectory(dir, { mode: 'skill' });
    expect(report.findings.filter(finding => finding.severity !== 'low')).toEqual([]);
    expect(report.verdict).toBe('pass');
  });

  it('restores no script, asset or packaging file', () => {
    const extra = listFiles(dir).filter(file => file !== 'SKILL.md' && ['packaging', 'script', 'asset'].includes(classifyExtra(file)));
    expect(extra).toEqual([]);
  });
});
