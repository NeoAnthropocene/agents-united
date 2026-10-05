/**
 * Inline markdown links, found and rewritten without touching code (Plan 035, ADR 0016 decision 6 amendment).
 *
 * A workflow skill reaches Cline as one markdown file, so a relative link in it has to be found, and named another way, without
 * disturbing a fenced block or a code span: a flowchart or an example may show a link on purpose. Only the inline form
 * `[label](target "title")` and its image twin are handled; a reference-style link, a link whose target holds a space or a
 * parenthesis, and a link that spans lines are not recognised (and so are never rewritten). Every other byte of the text,
 * line endings included, is left exactly as it was.
 */

/** One inline link or image found outside code. */
export interface MarkdownLink {
  /** The whole text of the link, with the leading `!` of an image. */
  raw: string;
  label: string;
  /** The target as written, without its title; a fragment is kept. */
  target: string;
  image: boolean;
}

const INLINE_LINK = /(!?)\[([^\]\n]*)\]\(([^()\s]+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\)/g;
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const OPENING_FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Whether a link target points at a file next to the document: not an anchor, a URL (a Windows drive letter reads as a scheme and
 * counts as absolute), an absolute path, or a path from the home directory.
 */
export function isRelativeTarget(target: string): boolean {
  if (target === '' || target.startsWith('#')) return false;
  if (SCHEME.test(target)) return false;
  if (target.startsWith('/') || target.startsWith('\\')) return false;
  if (target === '~' || target.startsWith('~/') || target.startsWith('~\\')) return false;
  return true;
}

/** The parts of one line, each marked as an inline code span or not. A run of backticks with no closing run of its own length is plain text. */
function splitCodeSpans(line: string): Array<{ text: string; code: boolean }> {
  const parts: Array<{ text: string; code: boolean }> = [];
  let last = 0;
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '`') {
      i += 1;
      continue;
    }
    let runEnd = i;
    while (runEnd < line.length && line[runEnd] === '`') runEnd += 1;
    const run = runEnd - i;
    let close = -1;
    let k = runEnd;
    while (k < line.length) {
      if (line[k] !== '`') {
        k += 1;
        continue;
      }
      let m = k;
      while (m < line.length && line[m] === '`') m += 1;
      if (m - k === run) {
        close = m;
        break;
      }
      k = m;
    }
    if (close === -1) {
      i = runEnd;
      continue;
    }
    parts.push({ text: line.slice(last, i), code: false }, { text: line.slice(i, close), code: true });
    last = close;
    i = close;
  }
  parts.push({ text: line.slice(last), code: false });
  return parts;
}

/**
 * Replace each inline link outside code with what `replace` returns for it; a link for which it returns `undefined` stays as written.
 * The callback is never offered a link inside a fenced block or a code span.
 */
export function rewriteMarkdownLinks(markdown: string, replace: (link: MarkdownLink) => string | undefined): string {
  const pieces = markdown.split(/(\r?\n)/); // even indexes are lines, odd ones the line endings between them
  let fence: { char: string; length: number } | undefined;
  for (let index = 0; index < pieces.length; index += 2) {
    const line = pieces[index];
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (closing && closing[1][0] === fence.char && closing[1].length >= fence.length) fence = undefined;
      continue;
    }
    const opening = OPENING_FENCE.exec(line);
    if (opening) {
      fence = { char: opening[1][0], length: opening[1].length };
      continue;
    }
    pieces[index] = splitCodeSpans(line)
      .map(part =>
        part.code
          ? part.text
          : part.text.replace(INLINE_LINK, (raw: string, bang: string, label: string, target: string) => {
              const replacement = replace({ raw, label, target, image: bang === '!' });
              return replacement === undefined ? raw : replacement;
            }),
      )
      .join('');
  }
  return pieces.join('');
}

/** The inline links of a document outside code, in order. */
export function listMarkdownLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  rewriteMarkdownLinks(markdown, link => {
    links.push(link);
    return undefined;
  });
  return links;
}
