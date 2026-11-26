import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 052 step 1 prep (ADR 0080). Two repository consistencies that nothing checked: a relative link in the root documents,
 * docs/ and plans/ points at a file that exists (with the exact case, as on Linux CI), and every plan is reachable from
 * plans/README.md (linked there, or from a numbered plan that is). Images are not navigation. A link inside a code fence or a
 * code span is an example, not a link; a link whose label holds a code span or runs over two lines is a link.
 *
 * Known limits of this scanner (a regular-expression reading, not a full CommonMark parser; none of these forms is in the
 * repository today): fences inside blockquotes or list items, a stray backtick pairing across a heading, destinations in angle
 * brackets with spaces or with parentheses, reference-style links, and a root folder whose case differs on Windows.
 */

const ROOT = path.resolve(__dirname, '..');
const ROOT_DOCS = ['README.md', 'PROJECT.md', 'CONTEXT.md', 'ROADMAP.md', 'AGENTS.md', 'CLAUDE.md', 'TEST_INFRA.md', 'CHANGELOG.md', 'TEST_READY.md'];
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
/** A closing fence carries no info string: only the fence characters and spaces. */
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
/** A code span: equal backtick runs inside one paragraph (CommonMark); an unmatched backtick stays literal. */
const CODE_SPAN = /(?<!`)(`+)(?!`)((?:(?!\n[ \t]*\n)[\s\S])*?)(?<!`)\1(?!`)/g;
/** An inline link or image; the label may hold one nested bracket pair and line breaks, never a blank line; `\![` is a link. */
const INLINE_LINK = /((?<!\\)!)?\[((?:(?!\n[ \t]*\n)(?:[^[\]]|\[[^[\]]*\]))*)\]\(\s*<?([^()\s<>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

interface Link { target: string; image: boolean }

/** Inline links and images outside fences; brackets and parentheses inside code spans are blanked so an example is not read. */
function inlineLinks(markdown: string): Link[] {
  const kept: string[] = [];
  let fence: string | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const open = FENCE.exec(line);
    if (fence !== undefined) {
      const close = CLOSING_FENCE.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = undefined;
      kept.push('');
    } else if (open) {
      fence = open[1];
      kept.push('');
    } else kept.push(line);
  }
  const text = kept.join('\n').replace(CODE_SPAN, span => span.replace(/[[\]()]/g, ' '));
  return [...text.matchAll(INLINE_LINK)].map(match => ({ image: match[1] === '!', target: match[3] }));
}

function relativeTarget(target: string): string | undefined {
  if (target.startsWith('#') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) || target.startsWith('/') || target.startsWith('~')) return undefined;
  let file = target.split('#')[0];
  try { file = decodeURI(file); } catch { /* a malformed escape is checked as written */ }
  return file === '' ? undefined : file;
}

/** Whether the path lies inside the repository and exists with this exact case in every segment. A link out of the repository is broken. */
function existsExactly(absolute: string): boolean {
  const rel = path.relative(ROOT, absolute);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return false;
  let dir = ROOT;
  for (const segment of rel.split(path.sep).filter(Boolean)) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || !fs.readdirSync(dir).includes(segment)) return false;
    dir = path.join(dir, segment);
  }
  return true;
}

function markdownUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownUnder(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function resolvedLinks(file: string): { absolute: string; target: string; image: boolean }[] {
  return inlineLinks(fs.readFileSync(file, 'utf8')).flatMap(link => {
    const rel = relativeTarget(link.target);
    return rel === undefined ? [] : [{ absolute: path.resolve(path.dirname(file), rel), target: link.target, image: link.image }];
  });
}

describe('the link scanner of this test', () => {
  it('reads multiline labels and code-span labels, and skips fences and code-span examples', () => {
    const md = [
      'See [the\nplan](a.md) and [`b.md`](b.md) and ![pic](c.png).',
      'An example: `[x](not-a-link.md)`.',
      '```',
      '[y](fenced.md)',
      '```',
      '[z](d.md#part "title")',
      '```',
      '```still in the fence',
      '[w](still-fenced.md)',
      '```',
      'Unmatched `',
      '',
      '[real](e.md) and `[example](example.md)`',
      '``[two](f.md)` still code``',
      '[split',
      '',
      'label](not-a-link.md) and \\![escaped](g.md) and [odd](100%.md)',
    ].join('\n');
    expect(inlineLinks(md)).toEqual([
      { image: false, target: 'a.md' },
      { image: false, target: 'b.md' },
      { image: true, target: 'c.png' },
      { image: false, target: 'd.md#part' },
      { image: false, target: 'e.md' },
      { image: false, target: 'g.md' },
      { image: false, target: '100%.md' },
    ]);
    expect(relativeTarget('100%.md')).toBe('100%.md');
  });

  it('treats a link out of the repository as broken, and a name starting with two dots as inside', () => {
    expect(existsExactly(path.resolve(ROOT, '..', 'README.md'))).toBe(false);
    expect(existsExactly(path.join(ROOT, '..notes.md'))).toBe(false);
    expect(existsExactly(path.join(ROOT, 'README.md'))).toBe(true);
    expect(existsExactly(path.join(ROOT, 'readme.md'))).toBe(false);
  });
});

describe('relative links in the root documents, docs/ and plans/', () => {
  const files = [
    ...ROOT_DOCS.map(name => path.join(ROOT, name)).filter(file => fs.existsSync(file)),
    ...markdownUnder(path.join(ROOT, 'docs')),
    ...markdownUnder(path.join(ROOT, 'plans')),
  ];

  it('point at files that exist, with the exact case', () => {
    const broken = files.flatMap(file =>
      resolvedLinks(file).filter(link => !existsExactly(link.absolute)).map(link => `${path.relative(ROOT, file)} -> ${link.target}`));
    expect(broken).toEqual([]);
  });

  it('never point into the ignored scratch/ folder', () => {
    const intoScratch = files.flatMap(file =>
      resolvedLinks(file)
        .filter(link => path.relative(ROOT, link.absolute).split(path.sep)[0].toLowerCase() === 'scratch')
        .map(link => `${path.relative(ROOT, file)} -> ${link.target}`));
    expect(intoScratch).toEqual([]);
  });
});

describe('plans/README.md', () => {
  const plansDir = path.join(ROOT, 'plans');
  const isPlan = (file: string): boolean => path.dirname(file) === plansDir && /^\d{3}-.*\.md$/.test(path.basename(file));
  const plansLinkedFrom = (file: string): string[] => resolvedLinks(file).filter(link => !link.image && isPlan(link.absolute)).map(link => link.absolute);

  it('reaches every plan, directly or through a numbered plan it links', () => {
    const direct = new Set(plansLinkedFrom(path.join(plansDir, 'README.md')));
    const reached = new Set(direct);
    for (const plan of direct) if (fs.existsSync(plan)) for (const target of plansLinkedFrom(plan)) reached.add(target);

    const unreached = fs.readdirSync(plansDir).map(name => path.join(plansDir, name)).filter(isPlan).filter(plan => !reached.has(plan));
    expect(unreached.map(plan => path.basename(plan))).toEqual([]);
  });
});
