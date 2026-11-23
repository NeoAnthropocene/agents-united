import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ADR 0078 - the documents that state the page type rules in prose (the ADR itself, ADR 0077's open items, README.md, CONTEXT.md and the record of the
 * design capability's live check) say the same thing as the generated block and the skill: the typed-command and own-request exceptions with their
 * conditions, one fallback to an HTML page (Design or Slides only), one comment ban, and no routing metadata or scratch folder name in committed text.
 */

const read = (file: string): string => fs.readFileSync(path.resolve(file), 'utf8').replace(/\r\n/g, '\n');
const ADR_0078 = (): string => read('docs/adr/0078-the-roles-hold-the-other-page-types-by-role-fit.md');
const ADR_0077 = (): string => read('docs/adr/0077-roles-that-make-documents-publish-pages-with-a-go-ahead.md');
const README = (): string => read('README.md');
const CONTEXT = (): string => read('CONTEXT.md');
const OBSERVATION = (): string => read('host-library/claude/observations/2026-11-22-claude-2.1.330-design-capability-live.md');
const publishingParagraph = (): string => README().split('\n').find(line => line.startsWith('**Publishing pages (Claude Code):**')) ?? '';

describe('the typed command and the user\'s own request, with their conditions (review finding 8)', () => {
  const TYPED = 'a `/design` or `/slides` command that you type to a role directly, with its brief, is your go-ahead for that one page';

  it('README: the lead asks before each new page unless the user\'s own request names the deliverable and says to publish it, and a typed command counts only for that page, with its brief, to a role directly', () => {
    const p = publishingParagraph();
    expect(p).not.toBe('');
    expect(p).toContain(TYPED);
    expect(p).toContain('a second page or a page of another type from the same request is new');
    expect(p).toContain('unless your own request names the deliverable and says to publish it as a page on your claude.ai account: then it does not ask again for that one page');
    expect(p).not.toContain('A `/design` or `/slides` line you type is your go-ahead');
  });

  it('CONTEXT: the go-ahead entry carries the same conditions', () => {
    const entry = CONTEXT().split('\n').find(line => line.startsWith('The user\'s approval of one new page')) ?? '';
    expect(entry).toContain('a `/design` or `/slides` command that the user typed for that page to a role directly, with its brief, counts as the go-ahead for the one page it asks for');
    expect(entry).toContain('a user\'s own request that names the deliverable and says to publish it as a page counts for that one page');
    expect(entry).not.toContain('a `/design` or `/slides` line the user typed');
  });

  it('ADR 0078 decision 4: the same conditions', () => {
    const decision = ADR_0078().split('\n').find(line => line.startsWith('4. **Go-ahead.**')) ?? '';
    expect(decision).toContain('A command that the user typed for that page, with its brief, counts as the go-ahead for the one page it asks for, when the user talks to the role directly');
    expect(decision).toContain('a second page or a page of another type from the same request is new');
    expect(decision).not.toContain('A typed command for that page counts as the go-ahead.');
  });
});

describe('the HTML page is the fallback for Design or Slides only (review finding 9)', () => {
  it('CONTEXT: the Page Type entry says Design or Slides and files for any other type', () => {
    const entry = CONTEXT().split('\n').find(line => line.startsWith('One of the kinds of page that a claude.ai account offers')) ?? '';
    expect(entry).toContain('when the account does not offer the Design or Slides type needed; for any other type the account does not offer, the files in the project are the deliverable (ADR 0078)');
    expect(entry).not.toContain('when the account does not offer the type needed');
  });

  it('ADR 0078: the limits say what a session without the Design or Slides type gets and what any other missing type gets', () => {
    const text = ADR_0078();
    expect(text).toContain('A session whose account does not offer the Design or Slides type gets an HTML page for a Design or Slides deliverable; an account that does not offer another type, or a session without the connector, gets the files, with the reason.');
    expect(text).not.toContain('A plan or session without the types, or without the connector, gets the files, with the reason.');
  });
});

describe('one comment ban everywhere (review finding 13)', () => {
  it('says never read, post or answer comments in the ADR, CONTEXT and not "never comment"', () => {
    expect(ADR_0078()).toContain('No role reads, posts or answers comments');
    expect(ADR_0078()).toContain('never reading, posting or answering comments');
    expect(CONTEXT()).toContain('never reads, posts or answers comments');
    expect(CONTEXT()).not.toContain('never comments');
  });
});

describe('what the ADR claims about the Host, and from what source (review findings 23, 24, 25)', () => {
  const adr = (): string => ADR_0078();

  it('says "off by default under `-p`" in both places', () => {
    expect(adr()).not.toContain('because artifacts are off under `-p`');
    expect(adr()).toContain('because artifacts are off by default under `-p`');
  });

  it('labels the connector without Artifact an inference from two separate pages, and the background prompt as not established', () => {
    expect(adr()).toContain('Not established: whether a session that is signed in with a subscription login and runs under `-p` can hold the connector while `Artifact` is off. It is an inference from two separate documentation pages, not a documented case');
    expect(adr()).toContain('can, by an inference from two separate documentation pages (not shown), be present while artifacts are off');
    expect(adr()).toContain('How a background specialist handles such a prompt is not established; no source was read for it.');
    expect(adr()).not.toContain('A background specialist cannot answer such a prompt.');
  });

  it('cites the evidence of the schema lookup and labels the subagent\'s report as its own', () => {
    expect(adr()).toContain('the result of a `ToolSearch` call with `select:ArtifactData` in that session (the session record is kept outside this repository, so this is the coordinating session\'s report of it)');
    expect(adr()).toContain('The subagent\'s own report, not a tool result');
  });

  it('counts five more types, and says the one reason that is not from an output contract', () => {
    expect(adr()).toContain('for five more types and six more roles');
    expect(adr()).not.toContain('six more types');
    expect(adr()).toContain('The one exception is the Data row of `operations-strategist`, whose reason is from the role\'s body');
  });

  it('has no routing metadata of a review session', () => {
    expect(adr()).toContain('An independent read-only review (it ran no command and changed no file) checked the table');
    expect(adr()).not.toMatch(/Antigravity session|medium tier|routed/);
  });
});

describe('the store tool outcome is one table in both places (review finding 26)', () => {
  it('decision 17 and the live check say the same: leads only after a lead was seen calling it, no holders when neither could', () => {
    const text = ADR_0078();
    expect(text).toContain('Data stays for leads only only after a lead was seen calling the store tool in the sitting; if neither a specialist nor a lead could call it, no role holds a store type.');
    expect(text).toContain('If only a specialist cannot call it and a lead was seen calling it, Data is leads only and Whiteboard waits. If neither a specialist nor a lead could call it, Whiteboard and Data have no holder');
    expect(text).not.toContain('The fallback for Data is leads only.');
  });
});

describe('the live check plan has the unprompted Design poster (review finding 28)', () => {
  it('names six prompts, and the poster as one of them', () => {
    const text = ADR_0078();
    expect(text).toContain('Six prompts on four leads');
    expect(text).toMatch(/\n6\. Design lead, after the first prompt: a poster for a fictional event[^\n]*unprompted/);
  });
});

describe('ADR 0077 and the observation record attribute the second copy to the designer, and name no scratch folder (review findings 24 and 34)', () => {
  it('ADR 0077 gives the designer\'s reason, not a rule of the Host', () => {
    const text = ADR_0077();
    expect(text).not.toContain('as the Host\'s page format asks');
    expect(text).toContain('for the designer\'s own reason');
  });

  it('the observation names no workspace label', () => {
    expect(OBSERVATION()).not.toContain('`run3`');
    expect(OBSERVATION()).toContain('- Workspace: a new git folder, installed from a checkout of this branch');
  });
});
