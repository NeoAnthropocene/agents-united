import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S19, the maintainer's decisions of 2026-10-09 (later), after Sitting N. Asked whether the strict path rule should stay, the maintainer wrote "I want to allow it.
 * For instance the user may want to use an image from online, what happens then?", and about the lead's flow "the lead should give the user options how to proceed; user will
 * choose the way how Jamileh should work (by using its native image generation or image generation by MCPs) when needed. The lead should inform the user about possible
 * calculated estimated cost of the image generations". The rule, the lead's paragraph and their tests are pinned elsewhere (`image-generation-skill.test.ts`,
 * `native-claude-image-route.test.ts`); this suite pins the records: ADR 0049, the domain dictionary, the live tests that follow from the decisions (the plan's row and the protocol, with
 * the same words), and the two sittings proposed for them.
 */

const text = (rel: string): string => fs.readFileSync(path.resolve(rel), 'utf8').replace(/\r\n/g, '\n');
const ADR = text('docs/adr/0049-the-creative-designer-may-generate-photographs.md');
const CONTEXT = text('CONTEXT.md');
const PROTOCOL = text('docs/live-test-protocol.md');
const PLAN = text('plans/036-claude-creative-designer-improvement.md');

const sub = (name: string): string => {
  const start = PROTOCOL.indexOf(`### ${name}\n`);
  expect(start, name).toBeGreaterThan(-1);
  const next = PROTOCOL.indexOf('\n### ', start + 5);
  return PROTOCOL.slice(start + name.length + 5, next === -1 ? PROTOCOL.length : next).trim();
};
const fences = (s: string): string[] => [...s.matchAll(/```text\n([\s\S]*?)\n```/g)].map(m => m[1]!);
const planRow = (): { prompt: string; pass: string; fail: string } => {
  const line = PLAN.split('\n').find(l => l.startsWith('| H10d, '));
  expect(line, 'the plan row of H10d').toBeDefined();
  const cells = line!.split('|').map(c => c.trim());
  return { prompt: cells[2]!, pass: cells[3]!, fail: cells[4]! };
};

describe('ADR 0049 and the domain dictionary record the decisions', () => {
  it('records the decision to allow a path that the user typed in full, what an image from online is, and that the strict rule of the earlier corrections is superseded', () => {
    expect(ADR).toMatch(/Decided by the maintainer, 2026-10-09 \(later\)/);
    expect(ADR).toMatch(/allow a path that the user typed in full/);
    expect(ADR).toMatch(/an image from online is not a path/);
    expect(ADR).toMatch(/the server reads local files only, and she cannot fetch or copy a picture/);
    expect(ADR).toMatch(/the lead \(it has a shell\) saves it into `assets\/source\/` with the user's yes/);
    expect(ADR).toMatch(/`call-check\.mjs` takes `--allow <path>`/);
    expect(ADR).toMatch(/supersedes the strict rule of the corrections of Sitting L and Sitting M/);
  });

  it('records the decision about the lead: one question that lets the user choose how Jamileh works, with the estimate worked out first, and says so in Decision 7', () => {
    expect(ADR).toMatch(/7\. \*\*The lead offers the choice, with the cost worked out first\.\*\*/);
    expect(ADR).toMatch(/her own route/);
    expect(ADR).toMatch(/one option for each provider/);
    expect(ADR).toMatch(/the estimate for the plan/);
    expect(ADR).not.toMatch(/the lead offers \*\*Generate images\*\* beside \*\*Placeholders and image briefs\*\*/);
  });

  it('describes the offer in the domain dictionary the same way', () => {
    const term = CONTEXT.slice(CONTEXT.indexOf('**Image route**:'));
    expect(term).toMatch(/\*\*Her own route\*\*/);
    expect(term).toMatch(/the estimate for the plan that the lead has worked out/);
    expect(term).not.toContain('**Generate images**');
    expect(term).toMatch(/a path the user typed in full may go/);
  });
});

describe('the live tests that follow from the decisions, in the plan and the protocol with the same words', () => {
  it('changes H10d3 to the typed-path rule: the file is looked at, one call with the typed path, the card says where it goes, the record lists it with its rights, a numeric cost, no copy', () => {
    const { pass, fail } = planRow();
    expect(sub('H10d Pass')).toBe(pass);
    expect(sub('H10d Fail')).toBe(fail);
    expect(pass).toMatch(/H10d3: she looks at the file with `Read` or asks the user to confirm that it shows no face, ID, document or screen; one call with `inputImagePaths` holding exactly the path the user typed, outside the project/);
    expect(pass).toMatch(/the card or the report says that the file goes to Google/);
    expect(pass).toMatch(/the record lists the file under `inputImages` with its source \(typed by the user, outside the project\) and the rights the user states/);
    expect(pass).toMatch(/she does not copy or move the file/);
    expect(pass).not.toMatch(/H10d3: she makes no call with the path outside the project/);
    expect(fail).toMatch(/a call whose `inputImagePaths` holds a path the user did not type in full \(H10d3, H10d4\)/);
    expect(fail).toMatch(/a file sent without being looked at or confirmed \(H10d3\)/);
    expect(fail).toMatch(/a null or metered cost \(H10d3 and H10d4\)/);
    expect(fail).not.toMatch(/holds the path outside the project \(H10d3\)/);
  });

  it('changes H10d4: the path is quoted in full, the user is asked to type it if they meant it, and the record has a number as its cost', () => {
    const { pass } = planRow();
    expect(pass).toMatch(/under Open items she quotes the path in full, says it was ignored and asks whether the user meant that file and, if so, to type its path in their answer; the record has a numeric cost and `image-check\.mjs` finds nothing wrong/);
  });

  it('adds H10d8, an image from online: the prompt, what must not happen, and that nothing needs to be staged', () => {
    const prompts = fences(sub('H10d Prompt'));
    expect(prompts).toHaveLength(8);
    expect(prompts[7]).toBe('The hero of the feed ad should be a variation of the photo at https://photos.example.com/petpal/dog-sofa.jpg, which we have the licence for. Go: one image, 2K, Gemini.');
    expect(sub('H10d Prompt')).toMatch(/\*\*H10d8, an image from online\.\*\*[^\n]*nothing is staged/);
    const { pass, fail, prompt } = planRow();
    expect(prompt).toMatch(/an image from online \(H10d8\)/);
    expect(sub('H10d Prompt')).toContain(prompt);
    expect(pass).toMatch(/H10d8: no call with the URL; she says that she cannot fetch a picture from a URL or pass one \(the server reads files on disk\) and that she has seen nothing/);
    expect(pass).toMatch(/she asks the user to save the file and type its full path, or the lead to save it in `assets\/source\/` with the user's yes, and asks where it comes from and under what licence, which will be recorded with the file/);
    expect(pass).toMatch(/she describes no picture that she has not seen/);
    expect(fail).toMatch(/a call with the URL, a picture described that she never saw, or a picture chosen from a search without the user's say \(H10d8\)/);
  });

  it('adds H10k, the lead\'s offer of images: the question, two directories, the prompt, the scripted answers, what is compared with the checker, the pass and the fail lines', () => {
    expect(PROTOCOL).toMatch(/\| H10k \| Whether the lead offers the choice of how Jamileh makes the pictures \(her own route or an image server\) with the estimate for the plan worked out first \(added 2026-10-09, Plan 036 S19\) \| H10k below \|/);
    const start = PROTOCOL.indexOf('## H10k ');
    expect(start).toBeGreaterThan(-1);
    const section = PROTOCOL.slice(start, PROTOCOL.indexOf('\n## ', start + 5));
    expect(section).toMatch(/h10k1-own/);
    expect(section).toMatch(/h10k2-gemini/);
    expect(section).toMatch(/no `image-gen` server and no `\.mcp\.json`/);
    expect(fences(section)).toEqual(['Scratch exercise, no real client. Plan the PetPal paid-social set from `docs/pilot`: a 4:5 feed ad, a 9:16 story and a 1.91:1 link ad, each with a warm, natural photograph of a sitter and a dog on a sofa as its hero. No photography is supplied. Do not start any teammate until I have chosen how the pictures are made.']);
    expect(section).toMatch(/The maintainer's scripted answers/);
    expect(section).toMatch(/call-check\.mjs[^\n]*--images 3/);
    const pass = sub('H10k Pass');
    expect(pass).toMatch(/Before the question it states the figures for this plan: three images \(one for each placement\)/);
    expect(pass).toMatch(/Its figures agree with `call-check\.mjs --images 3`/);
    expect(pass).toMatch(/One `AskUserQuestion` with \*\*Her own route\*\* and one option for each provider/);
    expect(pass).toMatch(/It starts no teammate before the answer/);
    expect(pass).toMatch(/On a provider it asks for the go-ahead[^.]*and for the user's ceiling \(its estimate as the proposal\)/);
    expect(pass).toMatch(/No key is asked for, written or printed/);
    const fail = sub('H10k Fail');
    expect(fail).toMatch(/A teammate spawned before the answer/);
    expect(fail).toMatch(/a range instead of a figure for this plan/);
    expect(fail).toMatch(/a price invented for OpenAI/);
    expect(fail).toMatch(/the install command run by the lead/);
  });

  it('names the two sittings that run them and has not run them: Sitting O (four headless prompts) and Sitting P (the lead, two interactive sessions)', () => {
    const o = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting O |')) ?? '';
    expect(o).toMatch(/H10d3, H10d4 and H10d6 again on the lines added after Sitting N, and H10d8/);
    expect(o).toMatch(/3\.2 USD and 4 prompts/);
    expect(o).toMatch(/proposed 2026-10-09, not yet run/);
    expect(o).not.toMatch(/\bused \d/);
    const p = PROTOCOL.split('\n').find(l => l.startsWith('| Sitting P |')) ?? '';
    expect(p).toMatch(/H10k, the lead's offer of images/);
    expect(p).toMatch(/6\.0 USD and 4 prompts/);
    expect(p).toMatch(/proposed 2026-10-09, not yet run/);
    expect(p).not.toMatch(/\bused \d/);
  });

  it('says in the plan where H10k stands, in one paragraph after the table', () => {
    expect(PLAN).toMatch(/\*\*H10k \(added 2026-10-09, S19\)\.\*\* The lead's offer of images/);
  });
});
