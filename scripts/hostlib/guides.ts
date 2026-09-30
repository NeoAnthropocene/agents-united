/**
 * Plan 032 / ADR 0025 decision 4 — distilled authoring guides (`host-library/<host>/guide/<type>.md`).
 * Every rule in a guide must cite a `pages/` snapshot, and every citation must resolve to a real
 * snapshot file and heading, so a refresh that renames upstream headings fails loudly here instead
 * of leaving a guide that points at nothing. Maintainer tooling only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadLock, loadSources } from './library.ts';
import { ARTIFACT_TYPES } from './types.ts';

export interface Citation {
  /** Snapshot path relative to the host directory, e.g. `pages/agent/sub-agents.md`. */
  file: string;
  /** Anchor without the leading `#`, or empty when the whole page is cited. */
  anchor: string;
}

export interface GuideRule {
  line: number;
  text: string;
  citations: Citation[];
}

export interface ParsedGuide {
  frontmatter: Record<string, string>;
  rules: GuideRule[];
  /** Every citation in the file, including those outside the Rules section. */
  citations: Citation[];
}

const LINK = /\]\((\.\.\/pages\/[^)\s]+)\)/g;

function stripFences(markdown: string): string {
  let inFence = false;
  return markdown
    .split(/\r?\n/)
    .map(line => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return '';
      }
      return inFence ? '' : line;
    })
    .join('\n');
}

/** GitHub-style slug of a heading's visible text. */
export function slugify(heading: string): string {
  return heading
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** Anchors a snapshot exposes: explicit `id="…"` attributes plus (deduplicated) heading slugs. */
export function anchorsOf(markdown: string): Set<string> {
  const anchors = new Set<string>();
  for (const match of markdown.matchAll(/\bid="([^"]+)"/g)) anchors.add(match[1]);
  const seen = new Map<string, number>();
  for (const line of stripFences(markdown).split('\n')) {
    const heading = /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
    if (!heading) continue;
    const base = slugify(heading[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

function citationsIn(text: string): Citation[] {
  const found: Citation[] = [];
  for (const match of text.matchAll(LINK)) {
    const target = match[1].replace(/^\.\.\//, '');
    const hash = target.indexOf('#');
    found.push(hash === -1 ? { file: target, anchor: '' } : { file: target.slice(0, hash), anchor: decodeURIComponent(target.slice(hash + 1)) });
  }
  return found;
}

export function parseGuide(markdown: string): ParsedGuide {
  const frontmatter: Record<string, string> = {};
  let body = markdown.replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(body);
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
      if (kv) frontmatter[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
    }
    // Blank the frontmatter instead of cutting it so reported line numbers match the file.
    body = fm[0].replace(/[^\n]/g, '') + body.slice(fm[0].length);
  }
  const lines = stripFences(body).split('\n');
  const rules: GuideRule[] = [];
  let inRules = false;
  let current: GuideRule | undefined;
  lines.forEach((line, index) => {
    if (/^## /.test(line)) {
      inRules = /^## Rules\s*$/.test(line);
      current = undefined;
      return;
    }
    if (!inRules) return;
    if (/^- /.test(line)) {
      current = { line: index + 1, text: line, citations: [] };
      rules.push(current);
    } else if (current && /^\s+\S/.test(line)) {
      current.text += `\n${line}`;
    } else if (line.trim() === '' || /^#{3,} /.test(line)) {
      current = undefined;
    }
    if (current) current.citations = citationsIn(current.text);
  });
  return { frontmatter, rules, citations: citationsIn(stripFences(body)) };
}

const REQUIRED_FRONTMATTER = ['host', 'artifact', 'reviewedAgainst'] as const;

/** Problems in `<hostDir>/guide/*.md`; empty when every guide is well-formed and every citation resolves. */
export function checkGuides(hostDir: string): string[] {
  const guideDir = path.join(hostDir, 'guide');
  if (!fs.existsSync(guideDir)) return [];
  const sources = loadSources(hostDir);
  const lock = loadLock(hostDir, sources.host);
  const problems: string[] = [];
  const anchorCache = new Map<string, Set<string>>();

  for (const name of fs.readdirSync(guideDir).filter(file => file.endsWith('.md')).sort()) {
    const where = `${sources.host}/guide/${name}`;
    const type = name.replace(/\.md$/, '');
    if (!(ARTIFACT_TYPES as readonly string[]).includes(type)) problems.push(`${where}: "${type}" is not a known artifact type`);
    const guide = parseGuide(fs.readFileSync(path.join(guideDir, name), 'utf8'));

    for (const key of REQUIRED_FRONTMATTER) if (!guide.frontmatter[key]) problems.push(`${where}: frontmatter is missing "${key}"`);
    if (guide.frontmatter.host && guide.frontmatter.host !== sources.host) problems.push(`${where}: frontmatter host "${guide.frontmatter.host}" does not match ${sources.host}`);
    if (guide.frontmatter.artifact && guide.frontmatter.artifact !== type) problems.push(`${where}: frontmatter artifact "${guide.frontmatter.artifact}" does not match the file name`);
    if (guide.rules.length === 0) problems.push(`${where}: has no bullets under "## Rules"`);

    for (const rule of guide.rules) {
      if (rule.citations.length === 0) problems.push(`${where}:${rule.line}: rule cites no pages/ snapshot`);
    }
    for (const citation of guide.citations) {
      const abs = path.join(hostDir, citation.file);
      if (!(citation.file in lock.files)) {
        problems.push(`${where}: cites ${citation.file}, which is not a locked snapshot`);
        continue;
      }
      if (!fs.existsSync(abs)) {
        problems.push(`${where}: cites ${citation.file}, which is missing on disk`);
        continue;
      }
      if (citation.anchor === '') continue;
      let anchors = anchorCache.get(citation.file);
      if (!anchors) {
        anchors = anchorsOf(fs.readFileSync(abs, 'utf8'));
        anchorCache.set(citation.file, anchors);
      }
      if (!anchors.has(citation.anchor)) problems.push(`${where}: ${citation.file}#${citation.anchor} matches no heading or id in the snapshot`);
    }
  }
  return problems;
}
