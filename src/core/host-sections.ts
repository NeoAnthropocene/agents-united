/**
 * ADR 0079 - host sections: a marked part of a canonical agent body that is for one host.
 *
 *     <!-- agents-united:host antigravity -->
 *     ...text for that host only...
 *     <!-- agents-united:host-end -->
 *
 * Each marker is a whole line (a sentence that quotes one is prose). `hostSections(body, host)` keeps the inner text of the sections of `host` and drops their two marker lines, and removes
 * every other section whole, markers included. It is the only place that reads the markers, and every reader of a canonical agent body applies it (the Claude, Cline and generic
 * projectors, the store copy of the install, the canonical checks of the factory). It also refuses a body that is not well formed, so a reader that sees a half-marked section fails and
 * does not leak the text of another host. Only `antigravity` is a host name for now: another name is refused here and in the registry test, not dropped.
 */

/** The hosts a section may name. A new host is added here, with its readers, by an ADR. */
export const HOST_SECTION_HOSTS: readonly string[] = ['antigravity'];

const MARKER_PREFIX = '<!-- agents-united:host';
const OPEN = /^<!-- agents-united:host ([^ ]*) -->$/;
const END = '<!-- agents-united:host-end -->';

type Line = { text: string; eol: string };

function linesOf(text: string): Line[] {
  const parts = text.split(/(\r?\n)/);
  const lines: Line[] = [];
  for (let index = 0; index < parts.length; index += 2) lines.push({ text: parts[index]!, eol: parts[index + 1] ?? '' });
  return lines;
}

/** What is wrong with the markers of a body, in reading order; empty when it is well formed. */
export function hostSectionProblems(text: string): string[] {
  if (!text.includes(MARKER_PREFIX)) return [];
  const problems: string[] = [];
  let openedAt = 0;
  for (const [index, line] of linesOf(text).entries()) {
    const number = index + 1;
    if (line.text === END) {
      if (openedAt === 0) problems.push(`Host section: an end marker without a start at line ${number}.`);
      openedAt = 0;
      continue;
    }
    if (!line.text.startsWith(MARKER_PREFIX)) continue;
    const open = OPEN.exec(line.text);
    if (open === null) {
      problems.push(`Host section: line ${number} is a marker that is not well formed.`);
      continue;
    }
    if (!HOST_SECTION_HOSTS.includes(open[1]!)) problems.push(`Host section: line ${number} names the host "${open[1]}"; only ${HOST_SECTION_HOSTS.join(', ')} may be named.`);
    if (openedAt !== 0) problems.push(`Host section: the section at line ${number} is nested in the one opened at line ${openedAt}.`);
    else openedAt = number;
  }
  if (openedAt !== 0) problems.push(`Host section: the section opened at line ${openedAt} is not closed.`);
  return problems;
}

/** Whether a body has any marker line at all (a quick test for a reader that has nothing to render). */
export function hasHostSections(text: string): boolean {
  return text.includes(MARKER_PREFIX);
}

/** The body as `host` sees it: its own sections open, every other host's removed. Throws on a body that is not well formed. */
export function hostSections(text: string, host: string): string {
  if (!hasHostSections(text)) return text;
  const problems = hostSectionProblems(text);
  if (problems.length > 0) throw new Error(problems.join(' '));
  let section: string | undefined;
  let removed = false;
  let out = '';
  for (const line of linesOf(text)) {
    if (section === undefined) {
      const open = OPEN.exec(line.text);
      if (open !== null) {
        section = open[1]!;
        continue;
      }
      // A section that was removed between two blank lines leaves one separator, not two.
      const separator = line.text.trim() === '' && (out === '' || out.endsWith('\n\n') || out.endsWith('\r\n\r\n'));
      if (removed && separator) {
        removed = false;
        continue;
      }
      removed = false;
      out += line.text + line.eol;
    } else if (line.text === END) {
      removed = section !== host;
      section = undefined;
    } else if (section === host) {
      out += line.text + line.eol;
    }
  }
  return out;
}
