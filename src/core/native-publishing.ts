/**
 * ADR 0077 - the "publishing" block of a native Claude role that holds `Artifact`. Such a role may also publish a finished deliverable as a
 * private page on the user's claude.ai account, but only with the user's go-ahead for that page: a specialist gets the go-ahead in its brief or
 * asks for it through the lead (ADR 0076), and a lead asks the user. The wording is generated here, once, between two markers, and a role
 * carries it exactly when its `tools:` line holds `Artifact`, so the text is one wording and true by construction.
 * Pure string work: no I/O, no clock.
 */
import { anchorHeadingPoint, checkBlock, removeBlock, writeBlock, type BlockMarkers } from './native-blocks.js';
import { REQUESTS_START } from './native-requests.js';

export const PUBLISHING_START =
  '<!-- agents-united:publishing:start (generated from src/core/native-publishing.ts and the tools line, regenerate with UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts, do not edit) -->';
export const PUBLISHING_END = '<!-- agents-united:publishing:end -->';

const MARKERS: BlockMarkers = { label: 'publishing', start: PUBLISHING_START, end: PUBLISHING_END };

/** A specialist publishes (`specialist`); a lead (`coordinator`) asks the user and passes the answer on. */
export type PublishingKind = 'specialist' | 'coordinator';

const SPECIALIST_TEXT: readonly string[] = [
  '## Publishing a page',
  '',
  'You hold `Artifact`. A finished deliverable that has a page form (a prototype or a screen flow, a poster or a one-pager, a deck) can also be published as a page on the user\'s claude.ai account, where the user reviews and edits it in a browser. The files in the project come first and are always delivered; the page is a second copy of them.',
  '',
  '- **Go-ahead first.** Publish a new page only with the user\'s go-ahead for that page. It reaches you in one of two ways. Your brief says that the user approved publishing this deliverable. Or you ask: finish the files, report, and put one `ask-user` entry under `Requests for the lead`, `blocking` for the publish only, with the options **Keep it in the project** and **Publish Artifact**, and with `If declined or unanswered`: the files stand. Publish when the lead\'s answer comes back `answered` with **Publish Artifact**.',
  '- **An update needs no new go-ahead.** An update is a publish to the URL that your brief names or that you published yourself in this piece of work. Anything else is a new page.',
  '- **How, the first of these that this session offers:**',
  '  1. If the list of skills available to you shows `design` (for a deck: `slides`), invoke it through `Skill` with the brief. This host may not offer that skill to you; its absence from your list is not an error. If it answers that the user must run `/design consent` or sign in, report that and take step 2; never ask for `/design-login` or `/design-sync`.',
  '  2. Otherwise load the skill `design-artifact-publishing` and start the Design type (for a deck: the Slides type) through `Artifact`. When the account offers neither type, publish an HTML page.',
  '  3. If `Artifact` is missing or refuses, do not look for a way round it: the files in the project are the deliverable, and your report says why there is no page.',
  '- **Private, always.** A new page is private. Never share it, never ask the user to share it as a step of the work, never delete or pin an artifact, and declare no runtime capabilities unless the brief asks for them. Who can see the page is the user\'s own act in the browser.',
  '- **Report.** The link, the type, what you published, what you did not check (not rendered, not read back), and that project material has left the project.',
];

const COORDINATOR_TEXT: readonly string[] = [
  '## Publishing pages',
  '',
  'You hold `Artifact`, and so does every specialist whose roster row says "publishes pages". A deliverable that has a page form (a prototype or a screen flow, a poster or a one-pager, a deck) can also be published as a private page on the user\'s claude.ai account, where the user reviews and edits it in a browser. The files in the project are always delivered; the page is a second copy of them.',
  '',
  '- **The user\'s go-ahead for each new page.** Whenever the work produces a deliverable with a page form (a prototype, a deck, a one-pager or a visual asset), ask once for that deliverable; the files are written first in every case. Ask with `AskUserQuestion`: the option **Keep it in the project** first, then **Publish Artifact** with this description: "Publishes the finished work as a private page on your claude.ai account. It needs a Pro or higher plan and a signed-in Claude Code. Nobody else can open it unless you share it, and the project\'s material then sits on an Anthropic-hosted page." A specialist\'s `ask-user` entry for a publish is this same question: ask it with these two options and return the answer to the same specialist.',
  '- **No question for an update.** A publish to the URL of a page the user already approved is an update. A second page, a page of another type, or a page nobody approved is new.',
  '- **Say it in the brief.** When the user approved, the brief names the deliverable and says that the user approved publishing it as a private page; when the page exists, the brief names its URL. A brief without that sentence gives no go-ahead.',
  '- **Your own pages** (a synthesis as a deck or a one-pager) follow the same rule and the same order: if the list of skills available to you shows `design` (for a deck: `slides`), invoke it through `Skill`; if it answers that the user must run `/design consent` or sign in, tell the user and go on with `Artifact`, and never ask for `/design-login` or `/design-sync`; otherwise load `design-artifact-publishing` and start the Design or the Slides type through `Artifact`, an HTML page when the account offers neither; if `Artifact` is missing or refuses, the files in the project are the deliverable.',
  '- **Check a link before you pass it on.** Read the page a specialist reports with `Artifact`; when you cannot, say that the link is unchecked.',
  '- **Never share.** Never share a page, never ask the user to share it as a step of the work, and never delete or pin an artifact. A user who wants no publishing at all has two switches of their own: `"enableArtifact": false` in the settings, or `Artifact` in `permissions.deny`. Name them when the user declines for good.',
  '- **As a subagent** you hold no `AskUserQuestion`: put the question in plain prose with the two options.',
  '- **Your final report** lists every page: its link, its type, who published it, and that project material has left the project.',
];

/** True exactly when the tool names (an `Agent(...)` allowlist reduced to `Agent`) include `Artifact`. */
export function holdsPublishing(tools: readonly string[]): boolean {
  return tools.some(tool => tool.split('(')[0] === 'Artifact');
}

/** The text between the markers: a specialist's or a lead's. */
export function renderPublishing(kind: PublishingKind): string {
  return (kind === 'coordinator' ? COORDINATOR_TEXT : SPECIALIST_TEXT).join('\n');
}

/** Places a new block before the requests block when the file has one, else before the boundaries (else the session task tracking) section. */
function insertionPoint(source: string): number {
  const requests = source.indexOf(REQUESTS_START);
  return requests >= 0 ? requests : anchorHeadingPoint(source, MARKERS);
}

/** Writes the block of a holder (replace or insert) and takes it out of a role that holds no `Artifact`. */
export function syncPublishing(text: string, kind: PublishingKind, tools: readonly string[]): string {
  if (!holdsPublishing(tools)) return removeBlock(text, MARKERS);
  return writeBlock(text, MARKERS, renderPublishing(kind), insertionPoint);
}

export function checkPublishing(text: string, kind: PublishingKind, tools: readonly string[]): string[] {
  if (holdsPublishing(tools)) return checkBlock(text, MARKERS, renderPublishing(kind));
  const source = text.replace(/\r\n/g, '\n');
  return source.includes(PUBLISHING_START) || source.includes(PUBLISHING_END)
    ? ['Native publishing block unwanted: the role holds no Artifact tool and must carry no publishing markers.']
    : [];
}
