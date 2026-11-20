import { describe, expect, it } from 'vitest';
import { describeMarketingRole, OUT_OF_DEPARTMENT_HANDOFF } from './helpers/native-marketing-role.js';
import { nativeText } from './helpers/native-roles.js';

/**
 * `marketing-creative-designer` (growth-marketing, slice 1): the second native file on the core the digital agency's creative designer stands on, in the Tier 1 form of `devops-engineer`.
 * It holds the `Artifact` tool because its core has the artifacts class (the ceiling test demands equality), and no image server: no image-generation tool is bound in this lane
 * (decided during the roll-out, 2026-11-20), so visual assets are delivered as specifications and briefs. What every marketing specialist keeps is in
 * tests/helpers/native-marketing-role.ts; this file holds what only the creative designer says.
 */

describeMarketingRole({
  role: 'marketing-creative-designer',
  type: 'subagent-marketing-creative-designer',
  agency: 'agency-creative-designer',
  servers: ['figma', 'stitch'],
  artifact: true,
  peers: ['marketing-conversion-specialist', 'marketing-campaign-specialist', 'marketing-content-strategist', 'marketing-growth-strategist', 'paid-acquisition-specialist'],
  returns: 'the specification',
});

const text = (): string => nativeText('marketing-creative-designer');
const body = (): string => text().split('<!-- agents-united:floor:end -->')[1]!;
const section = (heading: string): string => new RegExp(`\\n## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text())?.[1] ?? '';
const step = (n: number): string => new RegExp(`^${n}\\. .*$`, 'm').exec(section('How to work'))?.[0] ?? '';

describe('native marketing-creative-designer: no image generation', () => {
  it('says plainly that no image-generation tool is bound in this lane, in the steps and in the Boundaries, and what is delivered instead', () => {
    expect(step(3)).toContain('no image-generation tool is bound in this lane');
    expect(step(3)).toMatch(/placeholder frame with an explicit image brief/);
    expect(step(3)).toContain('never say an image was generated');
    expect(section('Boundaries of this host')).toContain('No image-generation tool is bound in this lane.');
    expect(section('Boundaries of this host')).toMatch(/image brief, and the picture is produced outside this session/);
  });

  it('names no image server, no image tool and no skill that belongs to the image route', () => {
    expect(text()).not.toMatch(/\bimage-gen\b|generate_image/);
    for (const skill of ['image-generation', 'image-creation', 'design-artifact-publishing', 'brand-consistency-audit', 'color-theory', 'ux-writing']) expect(body(), skill).not.toContain(`\`${skill}\``);
  });
});

describe('native marketing-creative-designer: when it may publish', () => {
  it('holds Artifact and says it publishes only when the user asks, keeps it private, never changes who sees it, and writes the files without the tool', () => {
    expect(/^tools: (.*)$/m.exec(text())![1]!.split(', ')).toContain('Artifact');
    expect(step(3)).toContain('You hold `Artifact`: publish to Claude Design only when the user asks you to');
    expect(step(3)).toContain('**Publish Artifact**');
    expect(step(3)).toContain('keep it private, and never change who can see it');
    expect(step(3)).toContain('Pro or higher plan and a signed-in CLI; without it, say so and write the files.');
  });

  it('keeps the Claude Design brief as a brief that publishes nothing', () => {
    expect(step(3)).toContain('end your report with its Claude Design brief, which publishes nothing');
  });

  it('keeps the floor line that says what leaves the project', () => {
    expect(text()).toContain('- **Publish Artifact**: Publish a design to a hosted page only when the user asked for it, keep it private, leave who can see it to the user, and say in your report that client material has left the project.');
  });
});

describe('native marketing-creative-designer: design, not copy or code', () => {
  it('reviews the identity first and hands design tokens back to the lead as a fixed input before the production build', () => {
    expect(step(1)).toMatch(/^1\. \*\*Review the identity first\.\*\*/);
    expect(section('Boundaries of this host')).toContain('Design tokens go back to `orchestrator-marketing` as a fixed input before the production build starts, for whoever builds the page (the user\'s implementation team); copy belongs to `marketing-conversion-specialist`. Never produce either one\'s deliverable, and never build the production UI.');
  });

  it('sources licensed stock through the skill and asks the lead to run the fetch, because it holds no shell', () => {
    expect(step(3)).toContain('the skill `commercial-stock-sourcer`');
    expect(step(3)).toMatch(/you hold editors and no shell, so put its candidate fetch command under `Open items` for the lead/);
  });
});

describe('native marketing-creative-designer: the hand-off outside the department', () => {
  it('carries the one sentence that sends a hand-off to a role outside marketing through the lead', () => {
    expect(body()).toContain(OUT_OF_DEPARTMENT_HANDOFF);
    expect(body().split(OUT_OF_DEPARTMENT_HANDOFF).length).toBe(2);
  });
});
