import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { HOLDER_STEMS } from './helpers/artifact-holders.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * Plan 036 S11, the Design artifact skill (the maintainer's answer to Q8 after probe P3: "we should add skills that teach how to
 * use Design Artifact of Claude", then test again). P3 showed what she gets wrong without it: she skipped the skill that holds the
 * placement rule, read nothing back, wrote a round time she was not given, miscounted her own report and put inferences in a
 * brand book under a sentence that denied them. The skill teaches those rules, not the vendor's format, which she reads live
 * through the type's own instructions. It is a canonical skill whose description says "Claude Code only" (the registry has no
 * host-only skill lane; `mcp-setup` is the precedent), carried by the digital-agency bundle and loaded from her table.
 */

const SKILL = 'design-artifact-publishing';
const DIR = path.resolve('registry/skills', SKILL);
const read = (rel: string): string => fs.readFileSync(path.join(DIR, rel), 'utf8').replace(/\r\n/g, '\n');
const skill = (): string => read('SKILL.md');
const body = (): string => skill().replace(/^---\n[\s\S]*?\n---\n/, '');
const meta = (): { name: string; description: string; metadata: { author: string; version: string }; [k: string]: unknown } =>
  YAML.parse(/^---\n([\s\S]*?)\n---/.exec(skill())![1]!) as ReturnType<typeof meta>;
const section = (heading: string): string => {
  const b = body();
  const start = b.indexOf(`\n## ${heading}\n`);
  expect(start, `## ${heading}`).toBeGreaterThan(-1);
  const next = b.indexOf('\n## ', start + 5);
  return b.slice(start, next === -1 ? undefined : next);
};

describe('the skill: what it is and where it lives', () => {
  it('is an in-house skill with the layout of the others: front matter, the seven headings, links that resolve, evals', () => {
    expect(meta().name).toBe(SKILL);
    expect(meta().metadata.author).toBe('agents-united');
    for (const rel of ['references/claude-design.md', 'references/publish-and-read-back.md', 'examples/worked-example.md', 'evals/evals.json']) {
      expect(fs.existsSync(path.join(DIR, rel)), rel).toBe(true);
    }
    for (const link of body().matchAll(/\]\(((?:examples|references)\/[^)#\s]+)\)/g)) expect(fs.existsSync(path.join(DIR, link[1]!)), link[1]).toBe(true);
    expect(fs.existsSync(path.resolve('tests/fixtures/laid-out-skills', SKILL)), 'listed in laid-out-skills, so skill-layout.test.ts holds it to the layout').toBe(true);
  });

  it('says in its description that it is for Claude Code and the Artifact tool, gives trigger phrases and says when to skip it', () => {
    const d = meta().description.replace(/\s+/g, ' ');
    expect(d).toMatch(/^Use when /);
    expect(d).toMatch(/Claude Design/);
    expect(d).toMatch(/Artifact tool/);
    expect(d).toMatch(/Claude Code only/);
    expect(d).toMatch(/trigger phrases:/);
    expect(d).toMatch(/\bskip\b/i);
    expect(d).toMatch(/Slides/);
    expect(d.length).toBeLessThanOrEqual(1024);
  });

  it('names no tool of another host, and no script: the role that loads it has no shell', () => {
    for (const token of ['write_to_file', 'view_file', 'run_command', 'ArtifactMetadata', 'agent-embed', 'generate_image']) expect(skill(), token).not.toContain(token);
    expect(fs.existsSync(path.join(DIR, 'scripts'))).toBe(false);
  });

  it('is carried by every Bundle that has a holder (ADR 0077, ADR 0078) and loaded from the creative designer\'s table, for a Claude Design canvas or brand book', () => {
    const bundles = JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8')) as { bundles: Record<string, { skills?: string[]; agents?: string[]; orchestrator?: string }> };
    const withHolder = Object.entries(bundles.bundles).filter(([, bundle]) =>
      [...(bundle.agents ?? []), ...(bundle.orchestrator ? [bundle.orchestrator] : [])].some(agent => HOLDER_STEMS.includes(agent.replace(/\.md$/, ''))),
    );
    expect(withHolder.length, 'Bundles that contain a holder role or a holder lead').toBeGreaterThanOrEqual(21);
    for (const [name, bundle] of withHolder) expect(bundle.skills, name).toContain(SKILL);
    const row = nativeText('agency-creative-designer').split('\n').find(l => l.startsWith('|') && l.split('|')[2]?.trim() === `\`${SKILL}\``) ?? '';
    expect(row).not.toBe('');
    expect(row).toMatch(/Claude Design/);
  });
});

describe('the runbook teaches the rules that P3 showed she skips', () => {
  const runbook = (): string => section('Step-by-Step Runbook');

  it('publishes only when asked, keeps the artifact private and never changes sharing', () => {
    expect(section('Execution Triggers')).toMatch(/asks for a Claude Design/);
    expect(runbook()).toMatch(/the user's go-ahead for that page/);
    expect(runbook()).toMatch(/needs no new go-ahead/);
    expect(runbook()).toMatch(/Keep it private and never change sharing/);
    expect(section('Execution Triggers')).toMatch(/Share control/);
    expect(section('Execution Triggers')).not.toMatch(/Share menu/);
    expect(runbook()).toMatch(/the files stand/);
    expect(section('Edge Cases & Error Recovery')).toMatch(/delete or share[\s\S]*not yours/i);
  });

  it('loads the placement and token skills before building, and follows the type\'s own instructions rather than memory', () => {
    const r = runbook();
    expect(r).toMatch(/Load the skills that hold the rules before you build/);
    expect(r).toMatch(/when the page is a design/);
    for (const name of ['ad-creative-design', 'design-system-tokens', 'brand-identity']) expect(r, name).toContain(`\`${name}\``);
    expect(r).toMatch(/type's own instructions/);
    expect(r).toMatch(/not from memory/);
    expect(r).toMatch(/no other design system/i);
  });

  it('builds everything locally and publishes once', () => {
    expect(runbook()).toMatch(/Build everything locally, then publish once/);
    expect(read('references/publish-and-read-back.md')).toMatch(/Publishing after every board/);
  });

  it('keeps to the source (the rules are in the read-back reference, the runbook points to it): copy verbatim, token colours only, claims to Defne, inferences written as inferred, no time she was not given', () => {
    expect(runbook()).toMatch(/Keep to the source and read back/);
    expect(runbook()).toContain('references/publish-and-read-back.md');
    const r = read('references/publish-and-read-back.md');
    expect(r).toMatch(/word for word/);
    expect(r).toMatch(/only token colours/);
    expect(r).toMatch(/Defne/);
    expect(r).toMatch(/written as inferred/);
    expect(r).toMatch(/T00:00:00Z/);
    expect(r).toMatch(/placeholder/);
    expect(r).toMatch(/`12:00:00Z`/);
  });

  it('reads back what she published, with the list and read calls, and counts instead of estimating', () => {
    const r = read('references/publish-and-read-back.md');
    expect(r).toMatch(/Read back what you published/);
    expect(r).toMatch(/`list`/);
    expect(r).toMatch(/`read` each one you wrote/);
    expect(r).toMatch(/count/);
    expect(r).toMatch(/recompute any contrast figure/);
    expect(r).toMatch(/11 of 12/);
  });

  it('reports what was not checked, and sends the render ask to the lead because she cannot look', () => {
    const r = runbook();
    expect(r).toMatch(/not rendered/);
    expect(r).toMatch(/platform specs/);
    expect(r).toMatch(/render ask to the lead/);
    expect(section('Verification Checklist')).toMatch(/says what was not checked/);
  });

  it('falls back to files when the tool is missing, and reads before editing a canvas the user changed', () => {
    const e = section('Edge Cases & Error Recovery');
    expect(e).toMatch(/tool is missing or denied/);
    expect(e).toMatch(/write the files/);
    expect(e).toMatch(/a denied or refused call stops/);
    expect(e).toMatch(/read it back before you change it/);
    expect(e).not.toMatch(/re-saves it/);
  });

  it('stops at a denied or refused call and completes only an approved publish that partly landed, to the same URL through the same tool, when the result can be checked (review finding 4)', () => {
    const e = section('Edge Cases & Error Recovery');
    expect(e).not.toMatch(/do not retry in a loop|ask the lead; do not/);
    expect(e).toMatch(/files and the reason/);
    expect(e).toMatch(/approved publish that partly landed/);
    expect(e).toMatch(/same URL, through the same tool/);
    expect(e).toMatch(/only when the result can be checked/);
    expect(e).toMatch(/Design and Slides only; never after a refusal, which stops/);
    expect(e).toMatch(/After a connector or store write fails, the type's own rule holds: leave the page as it is and try no other route/);
  });

  it('asks once before an HTML page replaces a Design or Slides type the account does not offer, in the skill and in its pages reference (the maintainer\'s decision of 2026-11-23)', () => {
    expect(section("Edge Cases & Error Recovery")).toMatch(/Design or Slides type not offered\*\*: when the user approved the page, ask once before an HTML page replaces it; declined or unanswered, the files stand/);
    expect(read('references/pages-decks-and-the-design-skill.md')).not.toContain('- Use an HTML page when the account does not offer');
  });

  it('reads the reference of the kind and the read-back reference before the first write call, and the look reference when a look is needed (review finding 21)', () => {
    const r = section('Step-by-Step Runbook');
    expect(r).toMatch(/Before the first write call, read/);
    expect(r).toContain('](references/publish-and-read-back.md)');
    expect(r).toMatch(/design-systems\.md\) \(also for a look\)/);
    expect(r).toMatch(/and the reference of step 5/);
  });

  it('scopes the one-call publish to Design and Slides, and gives the Design System, connector and store types their own sequence (review finding 17)', () => {
    const r = section('Step-by-Step Runbook');
    expect(r).toMatch(/Design and Slides publish once, in one call/);
    expect(r).toMatch(/Design and Slides publish once, in one call \(not yet observed for Slides\)/);
    expect(r).toMatch(/other types follow their reference/);
    expect(r).not.toMatch(/then publish in one call/);
  });

  it('creates an empty page only after the go-ahead, and keeps the repository\'s rules over the type\'s own instructions (review findings 1 and 20)', () => {
    const r = section('Step-by-Step Runbook');
    expect(r).toMatch(/Starting any type creates a new page, an empty one too/);
    expect(r).toMatch(/for the page's content only/);
    expect(r).toMatch(/go-ahead, tool and sharing rules stay in force/);
  });

  it('has the lead tell the user that sharing is their own act, and reports who can see a page only when a tool result shows it (review finding 14)', () => {
    const e = section('Edge Cases & Error Recovery');
    expect(e).toMatch(/lead tells the user that sharing is their own act/);
    expect(e).not.toMatch(/hand off to the lead/);
    expect(section('Step-by-Step Runbook')).toMatch(/who can see it only when a tool result shows it/);
  });
});

describe('the references, the example and the evals', () => {
  it('keeps the observations dated and sourced, and defers to the vendor\'s own instructions where they differ', () => {
    const r = read('references/claude-design.md');
    expect(r).toMatch(/observations of Claude Code 2\.1\.294/i);
    expect(r).toMatch(/2026-10-08/);
    expect(r).toMatch(/designer-p3-artifact-probe/);
    expect(r).toMatch(/win where they differ from this page, for the page's content only/);
    expect(r).toMatch(/go-ahead, tool and sharing rules stay in force/);
    for (const fact of [/Pro or higher plan/, /CLAUDE_CODE_ARTIFACT_AUTO_OPEN=0/, /canvas\.json/, /\.dc\.html/, /tokens\.json/, /Cover\/preview\.html/, /re-serialised/]) expect(r).toMatch(fact);
  });

  it('gives the read-back as a table of checks and the report as a skeleton', () => {
    const r = read('references/publish-and-read-back.md');
    for (const check of ['Files', 'Sizes', 'Boards', 'Colours', 'Copy', 'Tokens', 'Contrast', 'Zones']) expect(r, check).toMatch(new RegExp(`\\| ${check} \\|`));
    expect(r).toMatch(/## The report/);
    expect(r).toMatch(/Private; sharing untouched/);
  });

  it('scopes the one-call sequence to the types that use it, gives the read-back by type, and compares the encoded bytes (review findings 17 and 18)', () => {
    const r = read('references/publish-and-read-back.md');
    expect(r).toMatch(/## The calls for Design and Slides, in order/);
    expect(r).toMatch(/Design System, Docs, Sheets, Whiteboard and Data are not published this way/);
    expect(r).toMatch(/the Slides argument has not yet been observed in this repository/);
    expect(r).toMatch(/the one-call procedure for Slides has not yet been observed in this repository/);
    expect(r).toMatch(/## Read back by type/);
    for (const kind of ['Design, Slides and Design System', 'Docs and Sheets', 'Whiteboard and Data']) expect(r, kind).toContain(kind);
    expect(r).toMatch(/a read-back, or a stated failure to read back/);
    expect(r).toMatch(/link check is not a content check/);
    expect(r).not.toMatch(/equals the number of characters/);
    expect(r).toMatch(/byte length of the file as you wrote it, encoded as the page stores it/);
    expect(r).toMatch(/New page: "Private; sharing untouched\."/);
    expect(r).toMatch(/Update: "sharing as it was"/);
    expect(r).toMatch(/who can see it only when a tool result shows it/);
  });

  it('has a worked example with a read-back table and a report', () => {
    const w = read('examples/worked-example.md');
    expect(w).toMatch(/worked example/i);
    expect(w).toMatch(/\| File \| Bytes \|/);
    expect(w).toMatch(/Not checked/);
  });

  it('has exactly five evals, each with a prompt and an expected output, pinned by a distinctive phrase each (ADR 0078)', () => {
    const e = JSON.parse(read('evals/evals.json')) as { skill_name: string; evals: Array<{ id: number; prompt: string; expected_output: string }> };
    expect(e.skill_name).toBe(SKILL);
    expect(e.evals.map(x => x.id)).toEqual([1, 2, 3, 4, 5]);
    for (const x of e.evals) {
      expect(x.expected_output.length, 'eval ' + x.id).toBeGreaterThan(80);
      expect(x.prompt, 'eval ' + x.id).toMatch(/no real client/i);
    }
    const [system, memo, sheet, data, update] = e.evals as [typeof e.evals[number], typeof e.evals[number], typeof e.evals[number], typeof e.evals[number], typeof e.evals[number]];
    // 1: Design System, no go-ahead in the brief: the lead proposes the project's own design system once (decision 6), files first
    expect(system.prompt).toMatch(/design system/i);
    expect(system.prompt).toMatch(/no go-ahead/i);
    expect(system.expected_output).toMatch(/proposes? (?:it|one) once/i);
    expect(system.expected_output).toContain('**Keep it in the project** first');
    expect(system.expected_output).toMatch(/files in the project first/i);
    expect(system.expected_output).toMatch(/lists the files and reads back each file it wrote/i);
    expect(system.expected_output).toMatch(/does not edit a saved design system/i);
    // 2: a Docs memo with the go-ahead and the connector present
    expect(memo.prompt).toMatch(/memo/i);
    expect(memo.prompt).toMatch(/Claude Docs connector/);
    expect(memo.expected_output).toMatch(/project file first/i);
    expect(memo.expected_output).toMatch(/through the Claude Docs connector/);
    expect(memo.expected_output).toMatch(/no files into the page/i);
    expect(memo.expected_output).toMatch(/never deletes/i);
    expect(memo.expected_output).toMatch(/never reads, posts or answers comments/i);
    expect(memo.expected_output).toMatch(/Checks that the Claude Docs connector is among its tools before it creates anything/);
    // 3: a Sheets model with no connector among the tools: files, the reason, no request to sign in
    expect(sheet.prompt).toMatch(/financial model/i);
    expect(sheet.prompt).toMatch(/not among your tools/);
    expect(sheet.expected_output).toMatch(/files in the project/i);
    expect(sheet.expected_output).toMatch(/no page because the connector is missing/);
    expect(sheet.expected_output).toMatch(/does not ask the user to sign in/i);
    // 3, other branch: with the connector present, the range is read first and a cell nobody can attribute is left alone
    expect(sheet.expected_output).toMatch(/reads the range before it writes/i);
    expect(sheet.expected_output).toMatch(/cell that a person typed/i);
    // 4: a Data dashboard from a CSV, no live query, and a store tool that is refused: the success branch is conditional, the refused branch is exercised
    expect(data.prompt).toMatch(/CSV/);
    expect(data.prompt).toMatch(/store tool/i);
    expect(data.prompt).toMatch(/refused/i);
    expect(data.expected_output).toMatch(/loads the store tool through tool search/i);
    expect(data.expected_output).toMatch(/keeps the files and says why/i);
    expect(data.expected_output).toMatch(/no live query/i);
    expect(data.expected_output).toMatch(/never a stored call that changes anything/i);
    expect(data.expected_output).toMatch(/If the store call works, reports the dataset counts counted from the store/);
    expect(data.expected_output).toMatch(/If the store call is refused or fails, leaves the page as it is, tries no other route and reports the link, the content it confirmed by reading back and unknown where the read-back failed/);
    expect(data.expected_output).not.toMatch(/private empty page/);
    expect(data.expected_output).not.toMatch(/Reports the link, the type, the dataset counts/);
    // 5: an update of an approved Whiteboard, read back through the store tool, with a request to share it
    expect(update.prompt).toMatch(/already approved/i);
    expect(update.prompt).toMatch(/whiteboard/i);
    expect(update.prompt).toMatch(/share/i);
    expect(update.expected_output).toMatch(/no new question/i);
    expect(update.expected_output).toMatch(/same link/i);
    expect(update.expected_output).toMatch(/reads the board back through the store tool/i);
    expect(update.expected_output).toMatch(/the lead says sharing is the user's own act/);
    expect(update.expected_output).not.toMatch(/Share control/);
    expect(update.expected_output).toMatch(/sharing as it was/);
    expect(update.expected_output).toMatch(/who can see it only when a tool result shows it/);
    expect(update.expected_output).not.toMatch(/hands the share request to the lead|the page is private and sharing untouched/);
  });
});

describe('the other page types (ADR 0078): the skill picks the type, three references say how each kind is filled', () => {
  const REFS = ['references/design-systems.md', 'references/docs-and-sheets.md', 'references/whiteboards-and-dashboards.md'];

  it('is at version 1.2.0 or later, within the layout limits (6,000 characters and 90 lines)', () => {
    const [major, minor] = meta().metadata.version.split('.').map(Number) as [number, number];
    expect(major > 1 || (major === 1 && minor >= 2), meta().metadata.version).toBe(true);
    expect(skill().length).toBeLessThanOrEqual(6000);
    expect(skill().split('\n').length).toBeLessThanOrEqual(90);
    expect(meta().description.length).toBeLessThanOrEqual(1024);
  });

  it('names the five types in its description and its inputs, and keeps Claude Code only and the Artifact tool', () => {
    const d = meta().description.replace(/\s+/g, ' ');
    for (const type of ['Docs', 'Sheets', 'Whiteboard', 'Data', 'Design System', 'Slides']) expect(d, type).toContain(type);
    expect(d).toMatch(/Claude Code only/);
    expect(section('Input/Output Requirements')).toMatch(/Docs, Sheets, Whiteboard or Data/);
  });

  it('starts by picking the type from the account\'s own list by title, never a stored link, and links the three references', () => {
    const r = section('Step-by-Step Runbook');
    expect(r).toMatch(/Pick the type/);
    expect(r).toMatch(/`list`/);
    expect(r).toMatch(/`types`/);
    expect(r).toMatch(/by title/);
    expect(r).toMatch(/never a (?:stored|hard-coded) link/);
    for (const ref of REFS) {
      expect(fs.existsSync(path.join(DIR, ref)), ref).toBe(true);
      expect(body(), ref).toContain(`](${ref})`);
    }
  });

  it('puts the moved rules into the read-back reference: keep to the source, read back, the anti-patterns', () => {
    const r = read('references/publish-and-read-back.md');
    expect(r).toMatch(/## Keep to the source/);
    expect(r).toMatch(/## Read back what you published/);
    expect(r).toMatch(/## Anti-patterns, each with its reason/);
    expect(skill()).not.toMatch(/Anti-patterns, each with its reason/);
    expect(skill()).toMatch(/anti-patterns are in the same file/i);
  });

  it('says in every new reference which facts are the vendor\'s and which are this repository\'s rule, and the dates', () => {
    for (const ref of REFS) {
      const r = read(ref);
      expect(r, ref).toMatch(/vendor/i);
      expect(r, ref).toMatch(/this repository's rule/i);
      expect(r, ref).toContain('2026-11-22');
      expect(r, ref).toMatch(/Start the type titled|Find the type/);
      expect(r, ref).toMatch(/title and no files/);
      expect(r, ref).toMatch(/another party's text/);
    }
  });

  it('design-systems.md: files under the page\'s project folder, the index last, real sources, no edit of a saved design system, the lead\'s one proposal', () => {
    const r = read('references/design-systems.md');
    expect(r).toMatch(/index/i);
    expect(r).toMatch(/last/);
    expect(r).toMatch(/project's real sources|real sources/);
    expect(r).toMatch(/Never edit a saved design system unless that is the task/);
    expect(r).toMatch(/use the one marked default without asking/);
    expect(r).toMatch(/if some are listed but none is default, name them and ask/i);
    expect(r).toMatch(/proposes? one once/i);
    expect(r).toContain('**Keep it in the project** first');
    expect(r).toMatch(/no such proposal was declined in this piece of work/i);
    expect(r).toMatch(/motion/);
  });

  it('design-systems.md: starting the type creates the page after the go-ahead, the proposal has the block\'s conditions, and one list says what follows each outcome (review findings 1, 11, 12)', () => {
    const r = read('references/design-systems.md');
    expect(r).toMatch(/Starting the type creates the new page, so the go-ahead comes first/);
    expect(r).toMatch(/Only a lead whose list holds the Design System type proposes one, and only when a design, a deck or a dashboard needs a look/);
    expect(r).toMatch(/the question you relay carries the options of that proposal: two, or three with \*\*Use <the default>\*\*/);
    expect(r).toMatch(/## What follows each answer/);
    for (const outcome of ['Keep it in the project', 'Publish Artifact', 'Use <the default>', 'no answer', 'a design system page of its own', 'exactly one saved design system and none marked default']) {
      expect(r, outcome).toContain(outcome);
    }
    expect(r).toMatch(/sequence: the files in the project, then the go-ahead, then the empty page, then the files with the index last, then the read-back/);
  });

  it('docs-and-sheets.md: the project file first, the connector, the bans, the missing connector, a document that belongs in the codebase', () => {
    const r = read('references/docs-and-sheets.md');
    expect(r).toMatch(/Claude Docs connector/);
    expect(r).toMatch(/project file first/i);
    expect(r).toMatch(/connector's own server text/i);
    expect(r).toMatch(/new page[\s\S]*go-ahead|go-ahead[\s\S]*new page/);
    expect(r).toMatch(/Never delete a doc or a sheet/);
    expect(r).toMatch(/never read, post or answer comments/i);
    expect(r).not.toMatch(/Answer no comments/);
    expect(r).toMatch(/never overwrite a cell (?:that )?a person typed/i);
    expect(r).toMatch(/Read the range before you write it/);
    expect(r).toMatch(/leave a cell alone when you cannot tell who wrote it/);
    expect(r).toMatch(/Starting the type creates the new page, so the go-ahead comes first/);
    expect(r).toMatch(/never a second way to create a page/);
    expect(r).toMatch(/With `Artifact` missing or refused: the files and the reason, also when the connector is among your tools/);
    expect(r).toMatch(/Check that the connector is among your tools before you create or change anything/);
    expect(r).toMatch(/An update of a page the user already approved goes to its existing URL and never starts the type again/);
    expect(r.indexOf('The project file comes first')).toBeLessThan(r.indexOf('Then create it with a title and no files'));
    expect(r).toMatch(/A listed connector whose write fails: the files and the reason/);
    expect(r).toMatch(/Leave the page as it is and try no other route; report the link, the content you confirmed by reading it back, and "unknown" where the read-back failed/);
    expect(r).not.toMatch(/`batch` creates and binds|although the connector alone could create a doc/);
    expect(r).toMatch(/no new page because the connector is missing/);
    expect(r).toMatch(/an existing page is left as it is/);
    expect(r).toMatch(/never ask the user to sign in or to connect it/i);
    expect(r).toMatch(/belongs in the codebase[\s\S]*file/);
    expect(r).toMatch(/500 cells/);
  });

  it('whiteboards-and-dashboards.md: the store tool through tool search, files when it is not offered, what a Data page may hold, and what is not established', () => {
    const r = read('references/whiteboards-and-dashboards.md');
    expect(r).toMatch(/ToolSearch/);
    expect(r).toMatch(/keep the files and say why/i);
    expect(r).toMatch(/For Data, use files you made and numbers you saved; run, configure or store a live query on a connector only when the user asked for it, and never store a call that changes anything/);
    expect(r).not.toMatch(/use only files you made/i);
    expect(r).toMatch(/live query/i);
    expect(r).toMatch(/every reader/);
    expect(r).toMatch(/never store a call that changes anything|never a stored call that changes anything/i);
    expect(r).toMatch(/not established/i);
    expect(r).toMatch(/800 elements/);
    expect(r).toMatch(/never published with `file_path`/);
    expect(r).toMatch(/Data files go up as asset uploads through `Artifact`; the content goes in the store/);
    expect(r).toMatch(/Starting the type creates the new page, so the go-ahead comes first/);
  });

  it('whiteboards-and-dashboards.md: a store tool that is not offered, refused or failing keeps the files, and an existing page is reported as it is (review finding 5)', () => {
    const r = read('references/whiteboards-and-dashboards.md');
    expect(r).toMatch(/## If the store tool is not offered, refused or failing/);
    expect(r).toMatch(/Leave any page as it is and try no other route; report the link of a page that was created, the content you confirmed by reading it back, and "unknown" where the read-back failed/);
    expect(r).not.toMatch(/private empty page/);
    expect(r).toMatch(/An update of a page the user already approved goes to its existing URL and never starts the type again/);
    expect(r.indexOf('Write the files in the project first')).toBeLessThan(r.indexOf('Then create it with a title and no files'));
    expect(r).toMatch(/run, configure or store a live query/);
  });

  it('uses the same words for the rules as the generated block, so a role reads one wording', () => {
    const all = [skill(), ...REFS.map(read)].join('\n');
    expect(all).toContain('Keep it in the project');
    expect(all).toContain('no new page because the connector is missing');
    expect(all).not.toMatch(/ArtifactData`? (?:is|goes) on (?:a|the) tools line/);
  });
});

describe('the skill for every holder, for decks and for the go-ahead of each page (ADR 0077)', () => {
  const REF = 'references/pages-decks-and-the-design-skill.md';
  const CONDITION = 'If the list of skills available to you shows';

  it('says it is for any role that holds the Artifact tool, and still triggers on a Claude Design ask, a deck and a one-pager', () => {
    expect(section('Overview & Purpose')).toContain('any role that holds the `Artifact` tool');
    expect(section('Execution Triggers')).toMatch(/asks for a Claude Design/);
    expect(section('Execution Triggers')).toMatch(/deck/);
    expect(section('Execution Triggers')).toMatch(/one-pager/);
  });

  it('has a reference file for pages, decks and the bundled design skill, linked from SKILL.md', () => {
    expect(fs.existsSync(path.join(DIR, REF)), REF).toBe(true);
    expect(body()).toContain(REF);
    expect(body()).toMatch(/\]\(references\/pages-decks-and-the-design-skill\.md\)/);
  });

  it('states in that reference the condition for the bundled skill, the fallbacks, the update rule, the limits of what is known and the dated sources', () => {
    const r = read(REF);
    for (const phrase of [
      CONDITION + ' `design`',
      '`slides`',
      'not established',
      '2026-11-21',
      '`/design consent`',
      'Slides type',
      'HTML page',
      'the URL of a page the user already approved',
      'runtime capabilities',
      'v2.1.281',
      'A new artifact is visible only to you',
      'MCP-server contexts',
      'If the call fails',
      'When the user approved a Design or Slides page and the account does not offer that type, ask once before an HTML page replaces it: say that the type is not available, with **Keep it in the project** first and **Publish an HTML page** second; publish the HTML page only on that answer; if it is declined or unanswered, the files stand',
      'Write the files in the project first',
    ]) {
      expect(r, phrase).toContain(phrase);
    }
    // These two begin a bullet now, so they are pinned without regard to the case of the first letter.
    expect(r.toLowerCase()).toContain('never ask for `/design-login` or `/design-sync`');
    expect(r.toLowerCase()).toContain('never delete or pin');
    expect(r).not.toContain('the URL that your brief names or that you published yourself');
    expect(r).toContain('- If the user talks to you directly, a command they typed for that page (`/design` or `/slides` for a canvas or a deck), with its brief, is the go-ahead for the one page it asks for. A second page or a page of another type from the same request is new.');
    expect(r).not.toContain('A `/design` or `/slides` line that the user typed');
    expect(r).toContain('- Write the brief for the page yourself, from the work done: the subject, the audience or use, the content it must carry, the look or design system to follow, the size or format. Never ask the user to type `/design` or `/slides` so that a page can be made.');
    expect(r.indexOf('- Write the brief for the page yourself, from the work done: the subject, the audience or use, the content it must carry, the look or design system to follow, the size or format. Never ask the user to type `/design` or `/slides` so that a page can be made.')).toBe(r.indexOf('- Write the files in the project first on every route: the page is a second copy.\n') + '- Write the files in the project first on every route: the page is a second copy.\n'.length);
    expect(r.split('\n').slice(0, 4).join('\n')).not.toContain('The host rules below are from the host documentation');
    const sentences = r.split(/(?<=[.!?])\s+/);
    expect(sentences.some(s => s.includes('Slides type') && s.includes('has been observed')), 'a sentence that says nothing about the files of the Slides type has been observed').toBe(true);
  });

  it('names the bundled skill design or slides next to the word invoke only under the condition on the list of skills', () => {
    const lines = (skill() + '\n' + read(REF)).split('\n').filter(line => /\binvoke\b/i.test(line) && /`(?:design|slides)`/.test(line));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line, line.slice(0, 80)).toContain(CONDITION);
  });

  it('says in the edge cases that a bundled skill missing from the list is not an error, and in the checklist that the go-ahead for this page is checked', () => {
    expect(section('Edge Cases & Error Recovery')).toMatch(/not in your list/);
    expect(section('Edge Cases & Error Recovery')).toMatch(/not an error/);
    expect(section('Verification Checklist')).toMatch(/go-ahead for this page/);
  });

  it('is at version 1.1.0 or later', () => {
    const [major, minor] = meta().metadata.version.split('.').map(Number) as [number, number];
    expect(major > 1 || (major === 1 && minor >= 1), meta().metadata.version).toBe(true);
  });
});
