/**
 * ADR 0077 - the "publishing" block of a native Claude role that holds `Artifact`. A specialist's text says when it may publish a page and how;
 * a lead's text says how it asks the user and what it passes on. Both are generated from src/core/native-publishing.ts and sit between two
 * markers; a role carries the block exactly when its `tools:` line holds `Artifact`. This suite checks the module and the repository rule on
 * synthetic text; the committed roster is wired in later, with the grant itself.
 */
import { describe, expect, it } from 'vitest';
import {
  PUBLISHING_END,
  PUBLISHING_START,
  checkPublishing,
  holdsPublishing,
  renderPublishing,
  syncPublishing,
} from '../src/core/native-publishing.js';
import { REQUESTS_END, REQUESTS_START } from '../src/core/native-requests.js';
import { publishingBlockProblems } from '../src/core/native-repository-rules.js';

const BOUNDARIES = '## Boundaries of this host';
const TRACKING = '## Session task tracking';
const frontmatter = '---\nname: x\n---\n';
const base = `${frontmatter}# X\n\nBody.\n\n${BOUNDARIES}\n\nBounds.\n\n${TRACKING}\n\nTracking.\n`;
const block = (kind: 'specialist' | 'coordinator'): string => `${PUBLISHING_START}\n${renderPublishing(kind)}\n${PUBLISHING_END}`;
const withBlock = (kind: 'specialist' | 'coordinator'): string => base.replace(`${BOUNDARIES}\n`, `${block(kind)}\n\n${BOUNDARIES}\n`);

/** The sentences of a text, one list marker and one bold label stripped from the front of each line. */
const sentences = (text: string): string[] =>
  text
    .split('\n')
    .map(line => line.replace(/^\s*(?:\d+\.|-)\s+/, '').replace(/^\*\*[^*]+\*\*\s*/, ''))
    .flatMap(line => line.split(/(?<=[.!?])\s+/))
    .filter(Boolean);
const SKILL_MENTION = /`(?:design|slides)`/;
const CONDITION = 'If the list of skills available to you shows';
/** Every mention of the standalone site's commands, with the text of its line before it. */
const standaloneMentions = (text: string): string[] =>
  text.split('\n').flatMap(line => [...line.matchAll(/\/design-(?:login|sync)/g)].map(found => line.slice(0, found.index)));

describe('the markers', () => {
  it('are the exact comment lines', () => {
    expect(PUBLISHING_START).toBe(
      '<!-- agents-united:publishing:start (generated from src/core/native-publishing.ts and the tools line, regenerate with UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts, do not edit) -->',
    );
    expect(PUBLISHING_END).toBe('<!-- agents-united:publishing:end -->');
  });
});

describe('holdsPublishing', () => {
  it('is true exactly when the tool names include Artifact', () => {
    expect(holdsPublishing(['Read', 'Artifact'])).toBe(true);
    expect(holdsPublishing(['Artifact'])).toBe(true);
    expect(holdsPublishing(['Read', 'Write'])).toBe(false);
    expect(holdsPublishing([])).toBe(false);
  });

  it('does not take a longer name or an MCP tool for Artifact', () => {
    expect(holdsPublishing(['ArtifactComments'])).toBe(false);
    expect(holdsPublishing(['mcp__server__Artifact'])).toBe(false);
  });
});

describe('the specialist text', () => {
  const text = renderPublishing('specialist');

  it('opens with its heading and names the tool it holds', () => {
    expect(text.startsWith('## Publishing a page\n')).toBe(true);
    expect(text).toContain('You hold `Artifact`.');
  });

  it('carries the words of the go-ahead, the request entry and the report', () => {
    for (const phrase of ['Requests for the lead', '`ask-user`', '**Publish Artifact**', '**Keep it in the project**', 'needs no new go-ahead', 'Never share']) {
      expect(text, phrase).toContain(phrase);
    }
    expect(text).toContain('`blocking` for the publish only');
    expect(text).toContain('`If declined or unanswered`: the files stand');
  });

  it('puts the files in the project first and never asks the user itself', () => {
    expect(text).toContain('The files in the project come first and are always delivered');
    expect(text).not.toContain('AskUserQuestion');
  });

  it('names the three steps in order, each a condition the role can see', () => {
    const first = text.indexOf(CONDITION);
    const second = text.indexOf('Otherwise load the skill `design-artifact-publishing`');
    const third = text.indexOf('If `Artifact` is missing or refuses');
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(text).toContain('its absence from your list is not an error');
  });

  it('mentions the bundled skill only inside a sentence that begins with the condition on the list of skills', () => {
    const mentions = sentences(text).filter(sentence => SKILL_MENTION.test(sentence));
    expect(mentions.length).toBeGreaterThan(0);
    for (const sentence of mentions) expect(sentence.startsWith(CONDITION), sentence).toBe(true);
    expect(text).not.toContain('invoke `design`');
    expect(text).not.toContain('invoke `slides`');
  });

  it('names the standalone site commands only after the words "never ask for", and never says a page is public', () => {
    expect(text).toContain('/design-login');
    expect(text).toContain('/design-sync');
    for (const before of standaloneMentions(text)) expect(before).toContain('never ask for');
    expect(text).toContain('If it answers that the user must run `/design consent` or sign in, report that and take step 2; never ask for `/design-login` or `/design-sync`.');
    expect(text).not.toContain('publicly');
  });
});

describe('the coordinator text', () => {
  const text = renderPublishing('coordinator');

  it('opens with its heading and names the question, the two switches and the roster phrase', () => {
    expect(text.startsWith('## Publishing pages\n')).toBe(true);
    for (const phrase of ['AskUserQuestion', '"enableArtifact": false', 'permissions.deny', 'publishes pages', '**Keep it in the project**', '**Publish Artifact**']) {
      expect(text, phrase).toContain(phrase);
    }
  });

  it('asks once for every page-form deliverable, the files first, with the two options', () => {
    expect(text).toContain("- **The user's go-ahead for each new page.** Whenever the work produces a deliverable with a page form (a prototype, a deck, a one-pager or a visual asset), ask once for that deliverable; the files are written first in every case.");
  });

  it('asks in prose whenever the question tool is not among its tools, the option to keep it in the project first', () => {
    expect(text).toContain('- **When `AskUserQuestion` is not among your tools** (you run as a subagent, or the session has no user at the terminal), put the question in plain prose with the two options, **Keep it in the project** first.');
    expect(text).not.toContain('**As a subagent** you hold no `AskUserQuestion`');
    expect(text).not.toContain('As a subagent');
  });

  it('mentions the bundled skill only after a condition on the list of skills, in the same sentence', () => {
    const mentions = sentences(text).filter(sentence => SKILL_MENTION.test(sentence));
    expect(mentions.length).toBeGreaterThan(0);
    for (const sentence of mentions) {
      const condition = sentence.toLowerCase().indexOf(CONDITION.toLowerCase());
      expect(condition, sentence).toBeGreaterThan(-1);
      expect(condition, sentence).toBeLessThan(sentence.search(SKILL_MENTION));
    }
  });

  it('names the standalone site commands only after the words "never ask for", and never says a page is public', () => {
    expect(text).toContain('/design-login');
    expect(text).toContain('/design-sync');
    for (const before of standaloneMentions(text)) expect(before).toContain('never ask for');
    expect(text).toContain('tell the user and go on with `Artifact`, and never ask for `/design-login` or `/design-sync`');
    expect(text).not.toContain('publicly');
  });

  it('is the same for every lead', () => {
    expect(renderPublishing('coordinator')).toBe(text);
  });
});

describe('publishingBlockProblems', () => {
  const holder = { kind: 'specialist' as const, name: 'x', tools: ['Read', 'Artifact'] };
  const plain = { kind: 'specialist' as const, name: 'x', tools: ['Read'] };

  it('returns nothing for a holder that carries exactly the rendered block', () => {
    expect(publishingBlockProblems(withBlock('specialist'), holder)).toEqual([]);
    expect(publishingBlockProblems(withBlock('coordinator'), { kind: 'coordinator', name: 'lead', tools: ['Agent', 'Artifact'] })).toEqual([]);
  });

  it('returns nothing for a role without Artifact that carries no markers', () => {
    expect(publishingBlockProblems(base, plain)).toEqual([]);
  });

  it('returns a problem for a holder without the block', () => {
    expect(publishingBlockProblems(base, holder)).toEqual([expect.stringContaining('missing')]);
  });

  it('returns a problem when the block differs by one character', () => {
    const stale = withBlock('specialist').replace('Never share it', 'Never share is');
    expect(stale).not.toBe(withBlock('specialist'));
    expect(publishingBlockProblems(stale, holder)).toEqual([expect.stringContaining('stale')]);
  });

  it('returns a problem when a specialist carries the lead text, and the other way round', () => {
    expect(publishingBlockProblems(withBlock('coordinator'), holder)).toEqual([expect.stringContaining('stale')]);
    expect(publishingBlockProblems(withBlock('specialist'), { kind: 'coordinator', name: 'lead', tools: ['Artifact'] })).toEqual([expect.stringContaining('stale')]);
  });

  it('returns a problem for a role without Artifact that carries the markers', () => {
    expect(publishingBlockProblems(withBlock('specialist'), plain)).toEqual([expect.stringContaining('Artifact')]);
  });

  it('never throws on a damaged pair of markers', () => {
    const damaged = `${base}\n${PUBLISHING_START}\n${PUBLISHING_START}\n`;
    expect(publishingBlockProblems(damaged, holder)).toEqual([expect.stringContaining('exactly one pair')]);
  });

  it('accepts CRLF input', () => {
    expect(publishingBlockProblems(withBlock('specialist').replace(/\n/g, '\r\n'), holder)).toEqual([]);
  });
});

describe('the module on synthetic text', () => {
  const tools = ['Read', 'Artifact'];

  it('inserts the block before the boundaries section, then is idempotent', () => {
    const synced = syncPublishing(base, 'specialist', tools);
    expect(synced.indexOf(PUBLISHING_START)).toBeGreaterThan(-1);
    expect(synced.indexOf(PUBLISHING_START)).toBeLessThan(synced.indexOf(BOUNDARIES));
    expect(synced).toContain(`${PUBLISHING_END}\n\n${BOUNDARIES}`);
    expect(syncPublishing(synced, 'specialist', tools)).toBe(synced);
    expect(checkPublishing(synced, 'specialist', tools)).toEqual([]);
  });

  it('sits directly after the requests block when the file has one', () => {
    const requests = `${REQUESTS_START}\n## Requests for the lead\n${REQUESTS_END}\n\n`;
    const text = base.replace(`${BOUNDARIES}\n`, `${requests}${BOUNDARIES}\n`);
    const synced = syncPublishing(text, 'specialist', tools);
    expect(synced).toContain(`${REQUESTS_END}\n\n${PUBLISHING_START}`);
    expect(synced).toContain(`${PUBLISHING_END}\n\n${BOUNDARIES}`);
    expect(syncPublishing(synced, 'specialist', tools)).toBe(synced);
    expect(syncPublishing(synced, 'specialist', ['Read'])).toBe(text);
  });

  it('falls back to the session task tracking section', () => {
    const text = `${frontmatter}# X\n\nBody.\n\n${TRACKING}\n\nTracking.\n`;
    expect(syncPublishing(text, 'coordinator', tools)).toContain(`${PUBLISHING_END}\n\n${TRACKING}`);
  });

  it('replaces a stale block and writes LF', () => {
    const synced = syncPublishing(base, 'specialist', tools);
    const stale = synced.replace('Never share it', 'Never share is').replace(/\n/g, '\r\n');
    expect(checkPublishing(stale, 'specialist', tools)).toHaveLength(1);
    const fixed = syncPublishing(stale, 'specialist', tools);
    expect(fixed).toBe(synced);
    expect(fixed).not.toContain('\r');
  });

  it('removes the block from a role that no longer holds Artifact', () => {
    const synced = syncPublishing(base, 'specialist', tools);
    expect(syncPublishing(synced, 'specialist', ['Read'])).toBe(base);
  });

  it('leaves a role without Artifact and without markers as it is', () => {
    expect(syncPublishing(base, 'specialist', ['Read'])).toBe(base);
  });

  it('throws when a holder has neither anchor', () => {
    expect(() => syncPublishing(`${frontmatter}# X\n\nBody.\n`, 'specialist', tools)).toThrow(/Boundaries of this host[\s\S]*Session task tracking/);
  });

  it('throws on two start markers', () => {
    const synced = syncPublishing(base, 'specialist', tools);
    expect(() => syncPublishing(`${synced}\n${PUBLISHING_START}\n`, 'specialist', tools)).toThrow(/exactly one pair/);
  });

  it('reports a missing block and a stale block', () => {
    expect(checkPublishing(base, 'specialist', tools)).toEqual([expect.stringMatching(/^Native publishing block missing: /)]);
    const [stale] = checkPublishing(syncPublishing(base, 'specialist', tools).replace('Never share it', 'Never share is'), 'specialist', tools);
    expect(stale).toMatch(/^Native publishing block stale: .*\(regenerate with UPDATE_NATIVE=1\)\.$/);
  });
});
