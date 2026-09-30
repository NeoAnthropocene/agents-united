/** Plan 032 — `llms.txt` index parsing and page-list diffing. */
import type { IndexLink } from './types.ts';

const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

export function parseIndex(text: string): IndexLink[] {
  const seen = new Set<string>();
  const links: IndexLink[] = [];
  for (const match of text.matchAll(LINK)) {
    const url = match[2];
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ title: match[1], url });
  }
  return links;
}

export interface IndexDiff {
  added: IndexLink[];
  removed: IndexLink[];
}

export function diffIndex(previous: IndexLink[], next: IndexLink[]): IndexDiff {
  const before = new Set(previous.map(link => link.url));
  const after = new Set(next.map(link => link.url));
  return {
    added: next.filter(link => !before.has(link.url)),
    removed: previous.filter(link => !after.has(link.url)),
  };
}
