import { describe, expect, it } from 'vitest';
import { isRelativeTarget, listMarkdownLinks, rewriteMarkdownLinks } from '../src/core/markdown-links.js';

/**
 * Plan 035, ADR 0016 decision 6 amendment. A workflow skill reaches Cline as one markdown file, so its relative links have to be
 * found, and rewritten, without touching a code fence or a code span (a flowchart or an example may show a link on purpose).
 */

describe('isRelativeTarget', () => {
  it.each<[string, boolean]>([
    ['examples/worked-example.md', true],
    ['./examples/x.md', true],
    ['../other-skill/SKILL.md', true],
    ['examples/x.md#section', true],
    ['x.md', true],
    ['', false],
    ['#anchor', false],
    ['https://example.com/a', false],
    ['http://example.com', false],
    ['mailto:someone@example.com', false],
    ['/abs/path.md', false],
    ['\\\\server\\share\\a.md', false],
    ['~/notes.md', false],
    ['C:/Users/x/a.md', false],
    ['C:\\Users\\x\\a.md', false],
  ])('%j is relative: %s', (target, expected) => {
    expect(isRelativeTarget(target)).toBe(expected);
  });
});

describe('listMarkdownLinks', () => {
  it('finds inline links and images in document order, with label and target and without a title', () => {
    const md = 'See [the example](examples/a.md) and ![chart](assets/c.png "Chart") then [home](https://example.com).\n';
    expect(listMarkdownLinks(md).map(l => [l.label, l.target, l.image])).toEqual([
      ['the example', 'examples/a.md', false],
      ['chart', 'assets/c.png', true],
      ['home', 'https://example.com', false],
    ]);
    expect(listMarkdownLinks(md)[1].raw).toBe('![chart](assets/c.png "Chart")');
  });

  it('ignores fenced code of either marker, longer fences, an info string, and a fence that is never closed', () => {
    const md = [
      'before [a](a.md)',
      '```mermaid',
      'X[one](not-a-link.md)',
      '```',
      '~~~',
      '[b](b.md)',
      '~~~',
      '````md',
      '```',
      '[c](c.md)',
      '```',
      '````',
      'after [d](d.md)',
      '```',
      '[e](e.md)',
    ].join('\n');
    expect(listMarkdownLinks(md).map(l => l.target)).toEqual(['a.md', 'd.md']);
  });

  it('ignores inline code spans and still finds a link later on the same line', () => {
    const md = 'Write `[label](target.md)` like this, or see [it](real.md). Use ``a ` b [x](y.md)`` too.\n';
    expect(listMarkdownLinks(md).map(l => l.target)).toEqual(['real.md']);
  });

  it('does not take a bracketed word, a parenthesis, or a reference-style link for an inline link', () => {
    const md = 'A [word] and (aside), a [ref][1] link, and [a] (spaced).\n\n[1]: examples/x.md\n';
    expect(listMarkdownLinks(md)).toEqual([]);
  });
});

describe('rewriteMarkdownLinks', () => {
  it('replaces the whole link with what the callback returns and keeps every other byte, CRLF included', () => {
    const md = 'Load [examples/a.md](examples/a.md) for the case.\r\nSee also [site](https://example.com).\r\n';
    const out = rewriteMarkdownLinks(md, link => (isRelativeTarget(link.target) ? `\`root/${link.target}\`` : undefined));
    expect(out).toBe('Load `root/examples/a.md` for the case.\r\nSee also [site](https://example.com).\r\n');
  });

  it('returns the text unchanged when the callback keeps every link', () => {
    const md = 'A [link](a.md) and ![img](b.png).\n```\n[code](c.md)\n```\n';
    expect(rewriteMarkdownLinks(md, () => undefined)).toBe(md);
  });

  it('does not offer a link inside code to the callback, and replaces several links on one line', () => {
    const seen: string[] = [];
    const md = '[a](a.md) [b](b.md) `[c](c.md)`\n```\n[d](d.md)\n```\n';
    const out = rewriteMarkdownLinks(md, link => {
      seen.push(link.target);
      return `<${link.label}>`;
    });
    expect(seen).toEqual(['a.md', 'b.md']);
    expect(out).toBe('<a> <b> `[c](c.md)`\n```\n[d](d.md)\n```\n');
  });

  it('tells an image from a link and replaces the leading bang with the rest', () => {
    const images: boolean[] = [];
    const out = rewriteMarkdownLinks('![alt](x.png) and [t](y.md)', link => {
      images.push(link.image);
      return link.image ? `IMG(${link.label})` : `LINK(${link.label})`;
    });
    expect(images).toEqual([true, false]);
    expect(out).toBe('IMG(alt) and LINK(t)');
  });

  it('survives an empty document and a document with no link', () => {
    expect(rewriteMarkdownLinks('', () => 'x')).toBe('');
    expect(rewriteMarkdownLinks('No links here.\n', () => 'x')).toBe('No links here.\n');
  });
});
