import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRelativeTarget, listMarkdownLinks } from '../src/core/markdown-links.js';

/**
 * Plan 052 step 1 prep (ADR 0080). Two repository consistencies that nothing checked: a relative link in the root documents,
 * docs/ and plans/ points at a file that exists, and every plan is reachable from plans/README.md (linked there, or from a plan
 * that is). Links inside code fences and code spans are not links (src/core/markdown-links.ts).
 */

const ROOT = path.resolve(__dirname, '..');
const ROOT_DOCS = ['README.md', 'PROJECT.md', 'CONTEXT.md', 'ROADMAP.md', 'AGENTS.md', 'CLAUDE.md', 'TEST_INFRA.md'];

function markdownUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownUnder(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function relativeTargets(file: string): string[] {
  return listMarkdownLinks(fs.readFileSync(file, 'utf8'))
    .map(link => link.target)
    .filter(isRelativeTarget)
    .map(target => decodeURI(target.split('#')[0]))
    .filter(target => target !== '');
}

describe('relative links in the root documents, docs/ and plans/', () => {
  const files = [
    ...ROOT_DOCS.map(name => path.join(ROOT, name)).filter(file => fs.existsSync(file)),
    ...markdownUnder(path.join(ROOT, 'docs')),
    ...markdownUnder(path.join(ROOT, 'plans')),
  ];

  it('point at files that exist', () => {
    const broken: string[] = [];
    for (const file of files) {
      for (const target of relativeTargets(file)) {
        if (!fs.existsSync(path.resolve(path.dirname(file), target))) broken.push(`${path.relative(ROOT, file)} -> ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('never point into the ignored scratch/ folder', () => {
    const intoScratch: string[] = [];
    const scratch = path.join(ROOT, 'scratch') + path.sep;
    for (const file of files) {
      for (const target of relativeTargets(file)) {
        if (path.resolve(path.dirname(file), target).startsWith(scratch)) intoScratch.push(`${path.relative(ROOT, file)} -> ${target}`);
      }
    }
    expect(intoScratch).toEqual([]);
  });
});

describe('plans/README.md', () => {
  const plansDir = path.join(ROOT, 'plans');
  const index = path.join(plansDir, 'README.md');

  it('reaches every plan, directly or through a plan it links', () => {
    const linkedFrom = (file: string): string[] =>
      relativeTargets(file).map(target => path.resolve(path.dirname(file), target)).filter(target => path.dirname(target) === plansDir);
    const direct = new Set(linkedFrom(index));
    const reached = new Set(direct);
    for (const plan of direct) if (plan.endsWith('.md') && fs.existsSync(plan)) for (const target of linkedFrom(plan)) reached.add(target);

    const unreached = fs
      .readdirSync(plansDir)
      .filter(name => /^\d{3}-.*\.md$/.test(name))
      .filter(name => !reached.has(path.join(plansDir, name)));
    expect(unreached).toEqual([]);
  });
});
