/**
 * Marker handling shared by the generated blocks of a native Claude role (the requests block of ADR 0076, the publishing block of ADR 0077).
 * A block is the text between two comment markers; it is found, checked, written and inserted the same way whatever its wording.
 * Pure string work: no I/O, no clock.
 */

export interface BlockMarkers {
  /** The word the messages use for the block: `requests`, `publishing`. */
  label: string;
  start: string;
  end: string;
}

/** The headings a block is placed before when the file has no better anchor: the boundaries section, else the session task tracking section. */
export const BLOCK_ANCHOR_HEADINGS = ['## Boundaries of this host', '## Session task tracking'] as const;

export const lf = (text: string): string => text.replace(/\r\n/g, '\n');

/** Where the block sits in the text: `undefined` without markers, an error with a damaged pair. */
export function locateBlock(text: string, markers: BlockMarkers): { start: number; bodyStart: number; end: number } | undefined {
  const start = text.indexOf(markers.start);
  const end = text.indexOf(markers.end);
  if (start < 0 && end < 0) return undefined;
  if (start < 0 || end < start || text.indexOf(markers.start, start + 1) >= 0 || text.indexOf(markers.end, end + 1) >= 0) {
    throw new Error(`Native ${markers.label} error: the file needs exactly one pair of ${markers.label} markers, start before end.`);
  }
  return { start, bodyStart: start + markers.start.length, end };
}

/** The index of the first anchor heading the text has. */
export function anchorHeadingPoint(text: string, markers: BlockMarkers): number {
  for (const heading of BLOCK_ANCHOR_HEADINGS) {
    const found = new RegExp(`^${heading}$`, 'm').exec(text);
    if (found) return found.index;
  }
  throw new Error(
    `Native ${markers.label} error: the file has neither a "${BLOCK_ANCHOR_HEADINGS[0]}" nor a "${BLOCK_ANCHOR_HEADINGS[1]}" heading to place the ${markers.label} block before.`,
  );
}

/** Writes the block: replaces what is between the markers, or inserts the whole block at the index `at` gives. */
export function writeBlock(text: string, markers: BlockMarkers, body: string, at: (source: string) => number): string {
  const source = lf(text);
  const found = locateBlock(source, markers);
  if (found) return `${source.slice(0, found.bodyStart)}\n${body}\n${source.slice(found.end)}`;
  const point = at(source);
  return `${source.slice(0, point)}${markers.start}\n${body}\n${markers.end}\n\n${source.slice(point)}`;
}

/** Takes the block and the blank line after it out of the text; a text without markers is returned as LF text. */
export function removeBlock(text: string, markers: BlockMarkers): string {
  const source = lf(text);
  const found = locateBlock(source, markers);
  if (!found) return source;
  return `${source.slice(0, found.start)}${source.slice(found.end + markers.end.length).replace(/^\n\n?/, '')}`;
}

export function checkBlock(text: string, markers: BlockMarkers, body: string): string[] {
  const source = lf(text);
  const found = locateBlock(source, markers);
  if (!found) return [`Native ${markers.label} block missing: the file has no ${markers.label} markers (regenerate with UPDATE_NATIVE=1).`];
  return source.slice(found.bodyStart, found.end) === `\n${body}\n`
    ? []
    : [`Native ${markers.label} block stale: the block between the ${markers.label} markers differs from the generated text (regenerate with UPDATE_NATIVE=1).`];
}
