import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { anchorsOf, checkGuides, parseGuide, slugify } from '../scripts/hostlib/guides.ts';
import { refreshHost } from '../scripts/hostlib/library.ts';
import type { Fetcher } from '../scripts/hostlib/types.ts';

const roots: string[] = [];
afterEach(() => {
  while (roots.length > 0) fs.rmSync(roots.pop()!, { recursive: true, force: true });
});

const SOURCES = {
  host: 'demo',
  label: 'Demo host',
  indexes: [{ url: 'https://docs.demo.test/llms.txt', role: 'primary', snapshot: 'llms.txt' }],
  changelog: { url: 'https://raw.demo.test/CHANGELOG.md', snapshot: 'changelog.md' },
  pages: { hook: [{ url: 'https://docs.demo.test/hooks.md', slug: 'hooks' }] },
  keywords: { hook: ['\\bhooks?\\b'] },
  domains: ['docs.demo.test', 'raw.demo.test'],
};

const HOOKS_PAGE = '# Hooks\n\n## Exit code 2\n\nBlocks.\n\n<h3 id="custom-id">Custom</h3>\n\n```bash\n# not a heading\n```\n\n## Exit code 2\n\nAgain.\n';

const files: Record<string, string> = {
  'https://docs.demo.test/llms.txt': '- [Hooks](https://docs.demo.test/hooks.md): hooks\n',
  'https://raw.demo.test/CHANGELOG.md': '# Changelog\n\n## 1.0.0\n\n- Initial\n',
  'https://docs.demo.test/hooks.md': HOOKS_PAGE,
};
const fetcher: Fetcher = async url => (url in files ? { ok: true, status: 200, text: files[url] } : { ok: false, status: 404, text: '', error: 'HTTP 404' });

async function makeHost(guides: Record<string, string>): Promise<string> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hostlib-guides-'));
  roots.push(root);
  const hostDir = path.join(root, 'demo');
  fs.mkdirSync(path.join(hostDir, 'guide'), { recursive: true });
  fs.writeFileSync(path.join(hostDir, 'sources.json'), JSON.stringify(SOURCES));
  await refreshHost(hostDir, fetcher, { all: true, advanceChangelog: true });
  for (const [name, text] of Object.entries(guides)) fs.writeFileSync(path.join(hostDir, 'guide', name), text);
  return hostDir;
}

const GOOD = [
  '---',
  'host: demo',
  'artifact: hook',
  'reviewedAgainst: "1.0.0"',
  '---',
  '# Demo hook guide',
  '',
  '## Rules',
  '',
  '### Blocking',
  '',
  '- **Block with exit 2.** Exit 2 blocks the call. [hooks § Exit code 2](../pages/hook/hooks.md#exit-code-2)',
  '  A wrapped continuation line is part of the same rule.',
  '- **Second occurrence.** [hooks § Exit code 2 (again)](../pages/hook/hooks.md#exit-code-2-1)',
  '',
  '## Authoring notes',
  '',
  '- Uncited bullets outside "Rules" are allowed (agents-united guidance, not host behaviour).',
  '',
].join('\n');

describe('slugify / anchorsOf', () => {
  it('slugifies like GitHub: lowercase, punctuation dropped, spaces to hyphens, code ticks removed', () => {
    expect(slugify('Frontmatter reference')).toBe('frontmatter-reference');
    expect(slugify('`SubagentStart` & friends (v2)')).toBe('subagentstart--friends-v2');
    expect(slugify('Hooks in skills and agents')).toBe('hooks-in-skills-and-agents');
  });

  it('collects heading slugs, explicit ids and duplicate suffixes, and ignores headings inside code fences', () => {
    const anchors = anchorsOf(HOOKS_PAGE);
    expect(anchors).toEqual(new Set(['hooks', 'exit-code-2', 'exit-code-2-1', 'custom-id']));
    expect(anchors.has('not-a-heading')).toBe(false);
  });
});

describe('parseGuide', () => {
  it('reads frontmatter and only the bullets under "## Rules", with wrapped lines and their citations', () => {
    const guide = parseGuide(GOOD);
    expect(guide.frontmatter).toEqual({ host: 'demo', artifact: 'hook', reviewedAgainst: '1.0.0' });
    expect(guide.rules).toHaveLength(2);
    expect(guide.rules[0].text).toContain('wrapped continuation');
    expect(guide.rules[0].citations).toEqual([{ file: 'pages/hook/hooks.md', anchor: 'exit-code-2' }]);
    expect(guide.rules[0].line).toBe(12);
  });
});

describe('checkGuides', () => {
  it('accepts a well-formed guide whose citations resolve', async () => {
    expect(checkGuides(await makeHost({ 'hook.md': GOOD }))).toEqual([]);
  });

  it('returns no problems for a host without a guide directory', async () => {
    const hostDir = await makeHost({});
    fs.rmSync(path.join(hostDir, 'guide'), { recursive: true });
    expect(checkGuides(hostDir)).toEqual([]);
  });

  it.each([
    ['a rule with no citation', GOOD.replace('[hooks § Exit code 2 (again)](../pages/hook/hooks.md#exit-code-2-1)', 'no cite'), /demo\/guide\/hook\.md:14: rule cites no pages\/ snapshot/],
    ['a dead anchor', GOOD.replace('#exit-code-2)', '#exit-code-3)'), /hooks\.md#exit-code-3 matches no heading or id/],
    ['a snapshot that is not in the lock', GOOD.replace('pages/hook/hooks.md#exit-code-2)', 'pages/hook/nope.md#x)'), /pages\/hook\/nope\.md, which is not a locked snapshot/],
    ['missing frontmatter keys', GOOD.replace('reviewedAgainst: "1.0.0"\n', ''), /frontmatter is missing "reviewedAgainst"/],
    ['a host mismatch', GOOD.replace('host: demo', 'host: claude'), /frontmatter host "claude" does not match demo/],
    ['an artifact that disagrees with the file name', GOOD.replace('artifact: hook', 'artifact: skill'), /frontmatter artifact "skill" does not match the file name/],
    ['no rules at all', GOOD.replace(/- \*\*Block[\s\S]*?- \*\*Second[^\n]*\n/, ''), /has no bullets under "## Rules"/],
  ])('flags %s', async (_name, text, expected) => {
    expect(checkGuides(await makeHost({ 'hook.md': text })).join('\n')).toMatch(expected);
  });

  it('rejects guides whose file name is not an artifact type', async () => {
    expect(checkGuides(await makeHost({ 'bogus.md': GOOD.replace('artifact: hook', 'artifact: bogus') })).join('\n')).toMatch(/"bogus" is not a known artifact type/);
  });

  it('does not treat a link inside a code fence as a citation', async () => {
    const text = `${GOOD}\n\`\`\`md\n[x](../pages/hook/gone.md#nowhere)\n\`\`\`\n`;
    expect(checkGuides(await makeHost({ 'hook.md': text }))).toEqual([]);
  });
});

describe('the committed Claude guides', () => {
  const hostDir = path.resolve('host-library/claude');
  const GUIDES = ['agent', 'skill', 'hook', 'tools', 'orchestration', 'plugin', 'mcp', 'permissions'];
  const read = (type: string): string => fs.readFileSync(path.join(hostDir, 'guide', `${type}.md`), 'utf8');

  it.each(GUIDES)('ships guide/%s.md with at least eight cited rules', type => {
    expect(fs.existsSync(path.join(hostDir, 'guide', `${type}.md`)), `guide/${type}.md`).toBe(true);
    expect(parseGuide(read(type)).rules.length).toBeGreaterThanOrEqual(8);
  });

  it('cites only resolvable snapshots and headings, with a cite on every rule', () => {
    expect(checkGuides(hostDir)).toEqual([]);
  });

  it('is reviewed against the changelog baseline the library is pinned to', () => {
    const lock = JSON.parse(fs.readFileSync(path.join(hostDir, 'library.lock.json'), 'utf8')) as { changelog: { lastSeen: Record<string, string> } };
    const baseline = Object.values(lock.changelog.lastSeen)[0];
    for (const type of GUIDES) expect(parseGuide(read(type)).frontmatter.reviewedAgainst, type).toBe(baseline);
  });

  it('every guide cites a page of its own artifact type first (the page map in sources.json)', () => {
    for (const type of GUIDES) {
      const first = parseGuide(read(type)).citations[0];
      expect(first?.file.startsWith(`pages/${type}/`), `${type} first cites ${first?.file}`).toBe(true);
    }
  });

  it('records the platform conditions Plan 032 depends on', () => {
    const tools = read('tools');
    expect(tools).toMatch(/Glob/);
    expect(tools).toMatch(/absent by default on macOS, Linux, and WSL/i);
    expect(tools).toMatch(/LSP/);
    expect(tools).toMatch(/ReportFindings/);
    const orchestration = read('orchestration');
    expect(orchestration).toMatch(/Workflow/);
    expect(orchestration).toMatch(/withheld from subagents|removed from every subagent|never available to subagents/i);
    expect(orchestration).toMatch(/no `?import`?|import\(\)/i);
  });
});
