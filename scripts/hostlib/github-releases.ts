/**
 * Plan 032 / ADR 0027 addendum — a host's GitHub release stream as a changelog source.
 *
 * Some hosts release several products from one repository (Cline: the CLI as `cli-v3.0.x`, the SDK, the desktop app) and
 * keep release notes only on GitHub releases, so the repository's `CHANGELOG.md` does not describe them. A releases source
 * is fetched from the GitHub API, filtered by tag prefix and rendered into the sectioned markdown that `parseChangelog`
 * already reads (`## <Section>` with `### [<version>] - <date>`), so detection, classification and the audit gate need no
 * special case. Maintainer tooling only: never imported by `src/`.
 */

export const GITHUB_API_HOST = 'api.github.com';
export const RELEASES_PER_PAGE = 100;

export interface RenderOptions {
  /** Tag prefix that selects one product's releases and is stripped to leave the version (`cli-v`, `sdk/sdk/v`). */
  tagPrefix: string;
  /** Changelog section the releases are filed under (also the key of the recorded baseline). */
  section: string;
}

interface Release {
  tag_name?: unknown;
  body?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
  created_at?: unknown;
}

const VERSION = /^\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/;

export function releasesApiUrl(repo: string, page = 1): string {
  return `https://${GITHUB_API_HOST}/repos/${repo}/releases?per_page=${RELEASES_PER_PAGE}&page=${page}`;
}

/** Headers for a fetch: the GitHub API gets its JSON media type and, only there, an optional token. */
export function requestHeaders(target: string, env: Record<string, string | undefined> = {}): Record<string, string> {
  const base = { 'user-agent': 'agents-united-hostlib' };
  let host = '';
  try {
    host = new URL(target).hostname;
  } catch {
    // An unparsable target gets the plain headers; the fetch itself reports the problem.
  }
  if (host !== GITHUB_API_HOST) return { ...base, accept: 'text/markdown, text/plain;q=0.9, */*;q=0.5' };
  const headers: Record<string, string> = { ...base, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  const token = env.GITHUB_TOKEN?.trim();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

/** Release notes are free text: a heading inside one (even in a code fence) must not be read as a version or a section of the changelog. */
function demoteHeadings(body: string): string {
  let inFence = false;
  return body
    .split('\n')
    .map(line => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      // The changelog parser does not track fences, so a `##` or `###` line inside a code block would still open a section.
      if (inFence) return /^#{2,3}\s/.test(line) ? ` ${line}` : line;
      const heading = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
      return heading ? `**${heading[1]}**` : line;
    })
    .join('\n');
}

/** Render a GitHub "list releases" response (one or more pages joined) as one sectioned changelog, newest first. */
export function renderReleases(json: unknown, options: RenderOptions): string {
  if (!Array.isArray(json)) throw new Error('response is not a list of releases');
  const entries = (json as Release[])
    .map((release, index) => {
      const tag = typeof release.tag_name === 'string' ? release.tag_name : '';
      const published = typeof release.published_at === 'string' ? release.published_at : typeof release.created_at === 'string' ? release.created_at : '';
      return {
        index,
        tag,
        version: tag.startsWith(options.tagPrefix) ? tag.slice(options.tagPrefix.length) : '',
        skip: release.draft === true || release.prerelease === true,
        date: published.slice(0, 10),
        time: Number.isNaN(Date.parse(published)) ? 0 : Date.parse(published),
        body: demoteHeadings(String(release.body ?? '').replace(/\r\n/g, '\n').trim()),
      };
    })
    .filter(entry => !entry.skip && VERSION.test(entry.version))
    .sort((a, b) => b.time - a.time || a.index - b.index);
  const sections = entries.map(entry => `### [${entry.version}]${entry.date ? ` - ${entry.date}` : ''}\n\n${entry.body ? `${entry.body}\n` : ''}`);
  return `## ${options.section}\n\n${sections.join('\n')}`.trimEnd() + '\n';
}
