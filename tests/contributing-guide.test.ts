import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRelativeTarget, listMarkdownLinks } from '../src/core/markdown-links.js';

/**
 * Plan 052 step 2, ADR 0080 decision 3. `CONTRIBUTING.md` is the maintainer and contributor guide; `README.md` stays user-facing
 * and links to it once. The guide names commands and files, so this test pins them: every relative link resolves, every
 * `npm run <script>` exists in package.json and every `tests/<file>` exists. A rename then fails here instead of going stale.
 */

const ROOT = path.resolve('.');
const GUIDE = path.join(ROOT, 'CONTRIBUTING.md');
const read = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const guide = (): string => read(GUIDE);

/** The path part of a relative link target, without a fragment or a query, decoded. */
const linkPath = (target: string): string => decodeURIComponent(target.replace(/[#?].*$/, ''));

describe('CONTRIBUTING.md', () => {
  it('exists at the repository root', () => {
    expect(fs.existsSync(GUIDE)).toBe(true);
  });

  it('has relative links, and every one resolves to a file or folder in the repository', () => {
    const relative = listMarkdownLinks(guide()).map(l => l.target).filter(isRelativeTarget);
    expect(relative.length).toBeGreaterThan(0);
    const missing = relative.filter(t => linkPath(t) !== '' && !fs.existsSync(path.resolve(ROOT, linkPath(t))));
    expect(missing).toEqual([]);
  });

  it('names only npm scripts that package.json defines', () => {
    const scripts = Object.keys((JSON.parse(read(path.join(ROOT, 'package.json'))) as { scripts: Record<string, string> }).scripts);
    const named = [...guide().matchAll(/npm run ([A-Za-z0-9:_-]+)/g)].map(m => m[1]);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter(s => !scripts.includes(s))).toEqual([]);
  });

  it('names only test files that exist', () => {
    const named = [...guide().matchAll(/\btests\/[A-Za-z0-9._/-]+\.(?:ts|mjs|js)\b/g)].map(m => m[0]);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter(f => !fs.existsSync(path.join(ROOT, f)))).toEqual([]);
  });

  it('names only CLI subcommands that src/cli.ts registers', () => {
    const cli = read(path.join(ROOT, 'src/cli.ts'));
    const named = [...guide().matchAll(/node dist\/cli\.js ([a-z][a-z-]*)/g)].map(m => m[1]);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter(c => !cli.includes(`.command('${c}'`))).toEqual([]);
  });

  it('has a heading for every in-page anchor it links to', () => {
    const slug = (h: string): string => h.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s/g, '-');
    const headings = guide().split('\n').filter(l => /^#{1,6} /.test(l)).map(l => slug(l.replace(/^#+ /, '')));
    const anchors = listMarkdownLinks(guide()).map(l => l.target).filter(t => t.startsWith('#')).map(t => t.slice(1));
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.filter(a => !headings.includes(a))).toEqual([]);
  });
});

describe('README.md', () => {
  it('links to CONTRIBUTING.md exactly once', () => {
    const links = listMarkdownLinks(read(path.join(ROOT, 'README.md')))
      .map(l => l.target)
      .filter(isRelativeTarget)
      .filter(t => linkPath(t).replace(/^\.\//, '') === 'CONTRIBUTING.md');
    expect(links).toHaveLength(1);
  });
});
