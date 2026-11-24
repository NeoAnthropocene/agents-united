import { describe, expect, it } from 'vitest';
import { PUBLISH_FLOOR_LINE, withoutPublishingBlock } from './helpers/artifact-holders.js';
import { describeMarketingRole, OUT_OF_DEPARTMENT_HANDOFF } from './helpers/native-marketing-role.js';
import { bundles } from './helpers/native-coordinator.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `marketing-creative-designer` (growth-marketing): the second native file on the core the digital agency's creative designer stands on, in the Tier 1 form of `devops-engineer`.
 * It holds the `Artifact` tool because its core has the artifacts class (the ceiling test demands equality), and the one tool of the optional image server, as the agency's creative
 * designer does (ADR 0079, the maintainer's choice of 2026-11-24: the image tool is shared with marketing). What every marketing specialist keeps is in
 * tests/helpers/native-marketing-role.ts; this file holds what only the creative designer says.
 */

describeMarketingRole({
  role: 'marketing-creative-designer',
  type: 'subagent-marketing-creative-designer',
  agency: 'agency-creative-designer',
  servers: ['figma', 'stitch', 'image-gen'],
  image: true,
  artifact: true,
  peers: ['marketing-conversion-specialist', 'marketing-campaign-specialist', 'marketing-content-strategist', 'marketing-growth-strategist', 'paid-acquisition-specialist'],
  returns: 'the specification',
});

const text = (): string => nativeText('marketing-creative-designer');
// The generated publishing block (ADR 0077) names the skill design-artifact-publishing for every holder; the role's own text still names no skill of the image route.
const body = (): string => withoutPublishingBlock(text().split('<!-- agents-united:floor:end -->')[1]!);
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())?.[1] ?? '';
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section('How to work'))?.[0] ?? '';

describe('native marketing-creative-designer: the image tool, in the words of the agency copy (ADR 0079)', () => {
  const agency = (): string => nativeText('agency-creative-designer');
  const agencyStep3 = (): string => new RegExp('^3\\. .*$', 'm').exec(agency().split('## How to work')[1]!)?.[0] ?? '';
  const generatedPictures = (text: string): string => text.split('\n').find(line => line.startsWith('**Generated pictures.**')) ?? '';
  const tableRow = (text: string, skill: string): string => text.split('\n').find(line => line.startsWith('|') && line.split('|')[2]?.trim() === `\`${skill}\``) ?? '';
  const SENTENCE = 'You hold `mcp__image-gen__generate_image`, but it works only when the optional image server is connected (`ToolSearch` lists it), you call it only after the user or the lead has said go, and you never install it.';

  it('holds the one tool and says so in the steps, with the agency copy\'s sentence word for word, and no longer says that no image tool is bound', () => {
    expect(step(3)).toContain(SENTENCE);
    expect(agencyStep3()).toContain(SENTENCE);
    expect(step(3)).toMatch(/a call to the generation tool follows the skill `image-generation`, which you load before it/);
    expect(step(3)).toMatch(/placeholder frame with an explicit image brief/);
    expect(step(3)).not.toMatch(/no image-generation tool is bound/i);
    expect(text()).not.toMatch(/no image-generation tool is bound|No image tool is bound/i);
  });

  it('carries the paragraph of hard rules for a generated picture exactly as the agency copy has it, because a skill is loaded on demand and a teammate applies no `skills`', () => {
    expect(generatedPictures(body())).not.toBe('');
    expect(generatedPictures(body())).toBe(generatedPictures(agency()));
  });

  it('has the rows of the two image skills in its skill table, as the agency copy has them, and the skills are in the bundles that install it', () => {
    for (const skill of ['image-creation', 'image-generation']) {
      expect(tableRow(body(), skill), skill).not.toBe('');
      expect(tableRow(body(), skill), skill).toBe(tableRow(agency(), skill));
    }
    for (const name of ['growth-marketing', 'performance-paid-acquisition']) {
      expect(bundles()[name]!.skills, name).toEqual(expect.arrayContaining(['image-creation', 'image-generation']));
    }
  });

  it('says in the Boundaries that it holds the one tool of an optional server and what happens while the server is not connected', () => {
    const boundaries = section('Boundaries of this host');
    expect(boundaries).toContain('You hold the one image tool `mcp__image-gen__generate_image` of the optional `image-gen` server');
    expect(boundaries).toMatch(/while the server is not connected, a photograph or raster scene is an image brief/i);
    expect(boundaries).toContain('never say an image was generated that was not');
    expect(boundaries).not.toMatch(/No image-generation tool is bound/);
  });

  it('says in its description that photographs come only through the optional image server, within 300 characters', () => {
    const description = /^description: (.*)$/m.exec(text())![1]!;
    expect(description.length).toBeLessThanOrEqual(300);
    expect(description).toMatch(/photos only via the optional image server/i);
    expect(description).not.toMatch(/No image tool is bound/);
  });

  it('names no skill of the department that it does not install: only the two image skills are new here', () => {
    for (const skill of ['design-artifact-publishing', 'brand-consistency-audit', 'color-theory', 'ux-writing']) expect(body(), skill).not.toContain(`\`${skill}\``);
  });
});

describe('native marketing-creative-designer: when it may publish', () => {
  it('holds Artifact and says it publishes only with the user\'s go-ahead for that page, keeps it private, never changes who sees it, and writes the files without the tool', () => {
    expect(/^tools: (.*)$/m.exec(text())![1]!.split(', ')).toContain('Artifact');
    expect(step(3)).toContain('You hold `Artifact`: publish a page to Claude Design only with the user\'s go-ahead for that page');
    expect(step(3)).toContain('**Publish Artifact**');
    expect(step(3)).toContain('keep it private, and never change who can see it');
    expect(step(3)).toContain('Pro or higher plan and a signed-in CLI; without it, say so and write the files.');
  });

  it('keeps the Claude Design brief as a brief that publishes nothing', () => {
    expect(step(3)).toContain('end your report with its Claude Design brief, which publishes nothing');
  });

  it('keeps the floor line that says what leaves the project', () => {
    expect(text()).toContain(PUBLISH_FLOOR_LINE);
  });
});

describe('native marketing-creative-designer: design, not copy or code', () => {
  it('reviews the identity first and hands design tokens back to the lead as a fixed input before the production build', () => {
    expect(step(1)).toMatch(/^1\. \*\*Review the identity first\.\*\*/);
    expect(section('Boundaries of this host')).toContain('Design tokens go back to `orchestrator-marketing` as a fixed input before the production build starts, for whoever builds the page (the user\'s implementation team); copy belongs to `marketing-conversion-specialist`. Never produce either one\'s deliverable, and never build the production UI.');
  });

  it('sources licensed stock through the skill and asks the lead to run the fetch, because it holds no shell', () => {
    expect(step(3)).toContain('the skill `commercial-stock-sourcer`');
    expect(step(3)).toMatch(/you hold editors and no shell, so put its candidate fetch command as a `run-command` entry under `Requests for the lead`/);
  });
});

describe('native marketing-creative-designer: the hand-off outside the department', () => {
  it('carries the one sentence that sends a hand-off to a role outside marketing through the lead', () => {
    expect(body()).toContain(OUT_OF_DEPARTMENT_HANDOFF);
    expect(body().split(OUT_OF_DEPARTMENT_HANDOFF).length).toBe(2);
  });
});
