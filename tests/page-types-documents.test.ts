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
  const TYPED = '`/design` or `/slides` command that you type to a role directly, with its brief, is your go-ahead for that one page';

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
    expect(entry).toContain('when the user approved a Design or Slides page and the account does not offer that type, and the user, asked once, chose it (declined or unanswered, the files stand); for any other type the account does not offer, the files in the project are the deliverable (ADR 0078)');
    expect(entry).not.toContain('when the account does not offer the type needed');
  });

  it('ADR 0077: the third step names the Design or Slides type it falls back from', () => {
    expect(ADR_0077()).toContain('an HTML page when the account does not offer the Design or Slides type the role needs');
    expect(ADR_0077()).not.toContain('an HTML page when the account does not offer the type the role needs');
  });

  it('ADR 0078: the limits say what a session without the Design or Slides type gets and what any other missing type gets', () => {
    const text = ADR_0078();
    expect(text).toContain('A session whose account does not offer the Design or Slides type gets one question to the user and, on the answer "Publish an HTML page", an HTML page for a Design or Slides deliverable; an account that does not offer another type, or a session without the connector, gets the files, with the reason.');
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
    expect(OBSERVATION()).not.toMatch(/`run[0-9]`/);
    expect(OBSERVATION()).toContain('- Workspace: a new git folder, installed from a checkout of this branch');
  });
});

describe('the HTML fallback asks the user once (the maintainer\'s decision of 2026-11-23)', () => {
  const ASK = 'ask once before an HTML page replaces it';

  it('ADR 0078 records it as decision 19 of the maintainer, with the options, and the session decision moves to 20', () => {
    const text = ADR_0078();
    expect(text).toContain('Decisions 18 and 19 are the maintainer\'s, of 2026-11-23');
    expect(text).toMatch(/\n19\. \*\*The HTML fallback asks once\.\*\*[^\n]*"Ask once more"[^\n]*Keep it in the project\*\* first[^\n]*Publish an HTML page\*\*/);
    expect(text).toMatch(/\n20\. \(C\) \*\*Creation, refusal and read-back\.\*\*/);
    expect(text).toContain('decisions 9 to 17 and decision 20');
    expect(text).not.toContain('it stays the fallback when the account does not offer the Design or Slides type.');
  });

  it('CONTEXT, ADR 0077 and ADR 0078 limits state the one extra question', () => {
    expect(CONTEXT()).toContain('when the user approved a Design or Slides page and the account does not offer that type, and the user, asked once, chose it (declined or unanswered, the files stand)');
    expect(ADR_0077()).toContain('ADR 0078 decision 19 adds one question to the user before that HTML page, when the user approved a Design or Slides page and the account does not offer that type; declined or unanswered, the files stand');
    expect(ADR_0078()).toContain('gets one question to the user and, on the answer "Publish an HTML page", an HTML page for a Design or Slides deliverable');
  });

  it('no document keeps a looser statement of the fallback', () => {
    for (const [name, text] of [['ADR 0078', ADR_0078()], ['CONTEXT', CONTEXT()], ['README', README()]] as const) {
      expect(text, name).not.toMatch(/(?:publish|use|gets) an HTML page when the account does not offer/);
    }
    expect(ASK.length).toBeGreaterThan(0);
  });
});

describe('the fourth review: the sources of two claims, the requirement of decision 18 and the state of the factory check', () => {
  it('ADR 0078: the parent session\'s connector tools are listed as callable, and decision 18 states the requirement and the record that showed a modified copy', () => {
    const text = ADR_0078();
    expect(text).not.toMatch(/\(callable\)/);
    expect(text).toContain('`__guide`, `__update` (listed as callable)');
    expect(text).toContain('The requirement is that the published page equals the project files; the record cited below showed a modified copy');
  });

  it('ADR 0078: the factory check is described as it is, with the connector tool of a connector holder expected', () => {
    const text = ADR_0078();
    expect(text).not.toContain('`factory-check --artifact` refuses an `mcp__` entry');
    expect(text).toContain('`factory-check --artifact` expects the connector tool on the tools line of a connector holder, so it checks the 24 connector holders');
  });
});

describe('the third review: sharing of a new page and of an update, and the look of a project that has its own design system page', () => {
  it('ADR 0078 and CONTEXT say a new page is private and an update leaves sharing as it was', () => {
    expect(ADR_0078()).toContain('A new page is private; an update leaves sharing as it was.');
    expect(ADR_0078()).not.toContain('Pages are always private.');
    expect(CONTEXT()).toContain('A new page is private; an update leaves sharing as it was;');
    expect(CONTEXT()).not.toContain('A published page is private;');
  });

  it("ADR 0078: the project's own design system page is followed before the default", () => {
    expect(ADR_0078()).toContain("otherwise the project's own design system page is followed, or else the default is used without asking");
  });
});

describe('the second review: README, the table header, the live check plan and the fallback of the look (review round two)', () => {
  it('README: no second question for a user who named the deliverable, and the exceptions stated once', () => {
    const p = publishingParagraph();
    expect(p).not.toContain('the lead asks you before each of them as well');
    expect(p).not.toContain('with the same question first');
    expect(p).toContain('each is a new page with its own go-ahead');
    expect(p).toContain('with the same go-ahead as any page (ADR 0078)');
    expect(p.split('then it does not ask again for that one page')).toHaveLength(2);
    expect(p.split('is your go-ahead for that one page')).toHaveLength(2);
  });

  it('ADR 0078: the table header says one reason is not from the output contract, and the store fallback is conditional on what a lead could call', () => {
    const text = ADR_0078();
    expect(text).toContain('| Reason (from the output contract; one exception noted in its row) |');
    expect(text).toContain('If the live check shows that only a lead can call the store tool, leads only is the only version that can work.');
    expect(text).not.toContain('If the live check shows that a role cannot call the store tool, leads only is the only version that can work.');
  });

  it('ADR 0078: some saved design systems without a default are named and asked about, in decision 6 and in the block paragraph', () => {
    const text = ADR_0078();
    expect(text).toContain('If some exist and none is the default, the lead names them and asks once.');
    expect(text).toContain('when some are saved and none is the default, the lead names them and asks once');
    expect(text).not.toContain('If several exist and none is the default');
  });

  it('ADR 0078: the live check names the six pages it attempts, no Slides page, a failed store call leading to removal, and the connector-off check apart', () => {
    const text = ADR_0078();
    expect(text).toContain('Six pages are attempted, one per prompt: Design System, Docs, Sheets, Whiteboard, Data and the unprompted Design poster (the Design type). No Slides page is attempted.');
    expect(text).toContain('Each is attempted once, and a page that succeeds is private');
    expect(text).toContain('A failed store call leads to the removal below.');
    expect(text).toContain('A separate optional check, which is not a prompt of the list, publishes no page');
    expect(text).not.toContain('Each type is published once');
    expect(text).not.toContain('An optional sixth step');
    expect(text).toContain('The plan as it now stands, with six pages and no Slides page, is under "The live check"');
  });

  it('ADR 0078: the subagent\'s tool list is reported, not asserted', () => {
    expect(ADR_0078()).toContain('the three connector tools listed as callable in its own tool list');
  });
});

describe('the live check of ADR 0078, sat on 2026-11-23: the record and what the ADR says of it', () => {
  const RECORD_PATH = 'host-library/claude/observations/2026-11-23-claude-2.1.330-page-types-live.md';
  const RECORD = (): string => read(RECORD_PATH);

  it('the record says who sat it, on which commit, host version and mode, and what was graded', () => {
    const text = RECORD();
    expect(text).toContain('An AI session (the coordinating session\'s sitter) sat it, through a terminal bridge');
    expect(text).toContain('No human typed in any session.');
    expect(text).toContain('commit `9f229ea9`');
    expect(text).toContain('Claude Code 2.1.330');
    expect(text).toContain('Permission mode: `auto`');
    for (const heading of ['## How it was run', '## Answers given', '## What was seen, by prompt', '## The central question: could the store tool be called at all?', '## Pages created', '## Findings, slips and deviations', '## Second run (the design session, P1 then P7)', '## What this shows and what it does not']) {
      expect(text, heading).toContain(heading);
    }
    expect(text).toContain('Unsanctioned Communication');
    expect(text).toContain('Sitter\'s slip, business P6.');
  });

  it('the record carries no page link, scratch folder, session id, local path, routing metadata or em dash', () => {
    const text = RECORD();
    expect(text).not.toMatch(/https?:\/\/claude\.ai\/(?:code\/)?artifact\//);
    expect(text).not.toMatch(/[A-Za-z]:\\/);
    expect(text).not.toMatch(/pages-live|pageslive|sit-0078|session_0/);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    expect(text).not.toMatch(/Antigravity|Codex|router/i);
    expect(text).not.toContain(String.fromCharCode(0x2014));
  });

  it('ADR 0078 is Accepted with the record linked, and its Consequences say what was shown and not shown', () => {
    const text = ADR_0078();
    const status = text.split('\n').find(line => line.startsWith('- **Status:**')) ?? '';
    expect(status).toMatch(/^- \*\*Status:\*\* Accepted, 2026-11-23, after the live check of decision 17 was sat once; \[the record\]\(\.\.\/\.\.\/host-library\/claude\/observations\/2026-11-23-claude-2\.1\.330-page-types-live\.md\) is linked/);
    expect(status).not.toContain('has not been run');
    expect(text).toContain('### The sitting of 2026-11-23');
    expect(text).toContain('Sat once by the coordinating AI session through the terminal bridge on commit `9f229ea9`, Claude Code 2.1.330, auto mode; no human typed.');
    for (const shown of [
      'Sheets (`financial-analyst`, through the connector) and Docs (the business lead, through the connector)',
      'Whiteboard (`system-architect`): `ToolSearch`, then `ArtifactData`, 21 writes and 20 documents read back. The store tool is callable from a specialist.',
      'The lead asked first, unprompted, with **Keep it in the project** first, in every session.',
      'No Host dialog. Nothing was shared, deleted or pinned.',
      'With the connector off, no question was asked and the file stayed.',
    ]) expect(text, shown).toContain(shown);
    for (const notShown of [
      'Design System and Design: the Host\'s auto-mode classifier refused the specialists\' create of the type twice as "Unsanctioned Communication", with no dialog. The roles did not retry and reported it.',
      'Data: the lead chose Docs for the funnel overview. The Data column stays the weakest, as above.',
      'The lead\'s store route; the HTML fallback question (the account offers Design); per-page privacy; Slides; other modes.',
    ]) expect(text, notShown).toContain(notShown);
    expect(text).toContain('A plan answer of "local work only" was read as narrowing a go-ahead already given.');
    expect(text).toContain('The third option of the design-system proposal, **Use <the default>**, was not seen as the text says.');
    expect(text).toContain('Decision 17 after the sitting: Whiteboard was shown from a specialist, so no store row comes out.');
  });
});
