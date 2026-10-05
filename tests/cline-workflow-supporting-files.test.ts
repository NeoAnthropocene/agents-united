import crypto from 'node:crypto';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClineProjector } from '../src/core/cline-projector.js';
import { DoctorEngine } from '../src/core/doctor.js';
import { InstallEngine } from '../src/core/installer.js';
import { listMarkdownLinks, isRelativeTarget } from '../src/core/markdown-links.js';
import { isMaintainerOnlySkillPath } from '../src/core/skill-folder.js';
import type { BundleDefinition, InstallScope } from '../src/core/types.js';

/**
 * Plan 035, ADR 0016 decision 6 amendment (2026-10-05). The Cline projection of a workflow skill is `.cline/workflows/<slug>.md`,
 * written from the body of `SKILL.md` alone, so a relative link to `examples/` pointed at a folder the workflow file does not have.
 * The projection now names the copy the install already holds: `.agents/skills/<name>/<file>` from the project root, and the absolute
 * path of the same file in the global scope (the host reads a relative path against the process's working directory, which is not the
 * home directory, and does not expand `~`: observed in the source of Cline CLI 3.0.68, host-library/cline/observations).
 */

const REGISTRY = path.resolve(process.cwd(), 'registry');
const SKILLS = path.join(REGISTRY, 'skills');
const WORKFLOW_SKILLS = fs
  .readdirSync(SKILLS)
  .filter(name => name.startsWith('workflow-') && fs.existsSync(path.join(SKILLS, name, 'SKILL.md')))
  .sort();

/** The files an install carries for a skill, POSIX paths relative to the skill folder, `evals/` left out. */
function carriedFiles(skill: string): string[] {
  const dir = path.join(SKILLS, skill);
  return (fs.readdirSync(dir, { recursive: true, withFileTypes: true }) as fs.Dirent[])
    .filter(entry => entry.isFile())
    .map(entry => path.relative(dir, path.join(entry.parentPath, entry.name)).replace(/\\/g, '/'))
    .filter(rel => !isMaintainerOnlySkillPath(rel))
    .sort();
}

const hasSupportingFiles = (skill: string): boolean => carriedFiles(skill).some(rel => rel !== 'SKILL.md');
const PLAYBOOKS = WORKFLOW_SKILLS.filter(hasSupportingFiles);

/** The projection as it was written before this change: front matter slimmed to name and description, the marker, the body. */
function legacyProjection(skillMd: string, canonicalRel: string): string {
  const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)!;
  const front = yaml.parse(match[1]) as Record<string, unknown>;
  const slug = ClineProjector.workflowSlug(skillMd, canonicalRel);
  const description = typeof front.description === 'string' && front.description.trim() ? front.description.trim() : undefined;
  const slim = yaml.stringify(description ? { name: slug, description } : { name: slug }).trim();
  const marker = `<!-- managed-by: agents-united | profile: cline | canonical: ${canonicalRel} | do not edit -->`;
  return `---\n${slim}\n---\n${marker}\n\n${match[2].trim()}\n`;
}

const stripFences = (text: string): string => text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');

const DEMO = `---
name: workflow-demo
description: "A demo playbook."
---
# Demo

Load [examples/worked-example.md](examples/worked-example.md) for a case. The playbook works without it.
See [the checklist](references/checklist.md) and [the site](https://example.com), then [section](./examples/worked-example.md#case).

\`\`\`mermaid
A[Start](references/not-a-link.md)
\`\`\`
`;
const DEMO_FILES = ['SKILL.md', 'examples/worked-example.md', 'references/checklist.md'];

describe('renderWorkflowProjection names the supporting files of a workflow skill', () => {
  const render = (scope: InstallScope, root?: string, files: readonly string[] = DEMO_FILES): string =>
    ClineProjector.renderWorkflowProjection(DEMO, 'skills/workflow-demo/SKILL.md', { skillName: 'workflow-demo', files, scope, root });

  it('project scope: a relative link becomes the backticked path of the installed copy, from the project root', () => {
    const out = render('project');
    expect(out).toContain('Load `.agents/skills/workflow-demo/examples/worked-example.md` for a case. The playbook works without it.');
    expect(out).toContain('See the checklist (`.agents/skills/workflow-demo/references/checklist.md`) and [the site](https://example.com), then');
    expect(stripFences(out)).not.toMatch(/\]\((?:\.\/)?(?:examples|references)\//);
  });

  it('keeps the front matter and the marker, and leaves a fenced block alone', () => {
    const out = render('project');
    const [, front] = /^---\n([\s\S]*?)\n---\n/.exec(out)!;
    expect(yaml.parse(front)).toEqual({ name: 'workflow-demo', description: 'A demo playbook.' });
    expect(out).toContain('<!-- managed-by: agents-united | profile: cline | canonical: skills/workflow-demo/SKILL.md | do not edit -->');
    expect(out).toContain('```mermaid\nA[Start](references/not-a-link.md)\n```');
  });

  it('drops a fragment, and reads ./ as the skill folder', () => {
    expect(render('project')).toContain('then section (`.agents/skills/workflow-demo/examples/worked-example.md`).');
  });

  it('global scope: the absolute path of the same file, with forward slashes whatever the root looks like', () => {
    expect(render('global', 'C:\\Users\\someone\\')).toContain('Load `C:/Users/someone/.agents/skills/workflow-demo/examples/worked-example.md` for a case.');
    expect(render('global', '/home/someone')).toContain('Load `/home/someone/.agents/skills/workflow-demo/examples/worked-example.md` for a case.');
    expect(render('global', '/home/someone/')).toContain('(`/home/someone/.agents/skills/workflow-demo/references/checklist.md`)');
  });

  it('global scope without a root names the home directory', () => {
    const home = os.homedir().replace(/\\/g, '/').replace(/\/+$/, '');
    expect(render('global')).toContain(`Load \`${home}/.agents/skills/workflow-demo/examples/worked-example.md\` for a case.`);
  });

  it('leaves a link alone when the install does not carry the file (evals, a missing file, another skill)', () => {
    const body = '[a](evals/evals.json) [b](examples/none.md) [c](../other/SKILL.md) [d](examples/worked-example.md)';
    const skill = `---\nname: workflow-demo\ndescription: d\n---\n${body}\n`;
    const out = ClineProjector.renderWorkflowProjection(skill, 'skills/workflow-demo/SKILL.md', {
      skillName: 'workflow-demo',
      files: DEMO_FILES,
      scope: 'project',
    });
    expect(out).toContain('[a](evals/evals.json) [b](examples/none.md) [c](../other/SKILL.md) d (`.agents/skills/workflow-demo/examples/worked-example.md`)');
  });

  it('is byte-identical to the previous projection with no supporting file information, or with nothing to rewrite', () => {
    expect(ClineProjector.renderWorkflowProjection(DEMO, 'skills/workflow-demo/SKILL.md')).toBe(legacyProjection(DEMO, 'skills/workflow-demo/SKILL.md'));
    const plain = '---\nname: workflow-plain\ndescription: Plain.\n---\n# Plain\n\nNo links but [one](https://example.com).\n';
    expect(
      ClineProjector.renderWorkflowProjection(plain, 'skills/workflow-plain/SKILL.md', { skillName: 'workflow-plain', files: ['SKILL.md'], scope: 'global', root: '/home/x' }),
    ).toBe(legacyProjection(plain, 'skills/workflow-plain/SKILL.md'));
  });
});

describe('the workflow projections of the whole catalog', () => {
  const bundle: BundleDefinition = { name: 'catalog-guard', description: 'Every workflow skill', skills: WORKFLOW_SKILLS };
  const resolved = { targetBundle: 'catalog-guard', agents: [], skills: WORKFLOW_SKILLS, workflows: [], rules: [] };
  const plan = async (scope: InstallScope, root?: string) =>
    (await ClineProjector.planCompoundProjection(bundle, scope, resolved, REGISTRY, [], false, root)).filter(a => a.kind === 'workflow');

  it('has the six agency playbooks as the only workflow skills with a supporting file', () => {
    expect(PLAYBOOKS).toEqual([
      'workflow-agency-ad-creative-sprint',
      'workflow-agency-brand-design-system',
      'workflow-agency-client-pitch-proposal',
      'workflow-agency-cro-funnel-teardown',
      'workflow-agency-full-campaign',
      'workflow-agency-seo-content-engine',
    ]);
    expect(WORKFLOW_SKILLS.length).toBeGreaterThan(60);
  });

  it.each<[InstallScope, string | undefined]>([['project', undefined], ['global', '/home/someone']])(
    '%s scope: a skill with only SKILL.md projects exactly as before, a playbook names its example',
    async (scope, root) => {
      const artifacts = await plan(scope, root);
      expect(artifacts.map(a => a.relPath).sort()).toEqual(WORKFLOW_SKILLS.map(name => `.cline/workflows/${name}.md`).sort());
      for (const skill of WORKFLOW_SKILLS) {
        const artifact = artifacts.find(a => a.relPath === `.cline/workflows/${skill}.md`)!;
        const canonicalRel = `skills/${skill}/SKILL.md`;
        const skillMd = fs.readFileSync(path.join(SKILLS, skill, 'SKILL.md'), 'utf8');
        if (!hasSupportingFiles(skill)) {
          expect(artifact.content, skill).toBe(legacyProjection(skillMd, canonicalRel));
        } else {
          const prefix = scope === 'global' ? `${root}/` : '';
          expect(artifact.content, skill).toContain(`\`${prefix}.agents/skills/${skill}/examples/worked-example.md\``);
          expect(artifact.content, skill).not.toContain('](examples/');
        }
      }
    },
  );

  it.each<[InstallScope, string | undefined]>([['project', undefined], ['global', '/home/someone']])(
    '%s scope: no projected workflow keeps a relative link, and every path it names is a file the install carries',
    async (scope, root) => {
      for (const artifact of await plan(scope, root)) {
        const body = artifact.content!;
        const skill = path.basename(artifact.relPath, '.md');
        const prose = stripFences(body);
        // The scanner of the rewriter, and a blunter pattern that does not depend on it (angle brackets, spaces, anything after `](`).
        expect(listMarkdownLinks(body).filter(l => isRelativeTarget(l.target)).map(l => l.target), skill).toEqual([]);
        expect(prose.match(/\]\((?!https?:|mailto:|#)[^)]*\)/g) ?? [], skill).toEqual([]);
        const named = [...body.matchAll(/`((?:\/|[A-Za-z]:\/)?[^`\s]*\.agents\/skills\/([\w-]+)\/([^`\s]+))`/g)];
        for (const [, full, name, rel] of named) {
          expect(full.startsWith(scope === 'global' ? `${root}/.agents/skills/` : '.agents/skills/'), `${skill}: ${full}`).toBe(true);
          expect(carriedFiles(name), `${skill} names ${full}`).toContain(rel);
        }
      }
    },
  );

  it('names only files the same plan copies into the plugin package: one list of what an install carries', async () => {
    const all = await ClineProjector.planCompoundProjection(bundle, 'project', resolved, REGISTRY);
    for (const skill of WORKFLOW_SKILLS) {
      const prefix = `.agents/plugins/catalog-guard/skills/${skill}/`;
      const copied = all.filter(a => a.relPath.startsWith(prefix)).map(a => a.relPath.slice(prefix.length)).sort();
      expect(copied, skill).toEqual(carriedFiles(skill));
    }
  });

  it('keeps the source honest: every relative link in a workflow SKILL.md points at a file the install carries', () => {
    for (const skill of WORKFLOW_SKILLS) {
      const text = fs.readFileSync(path.join(SKILLS, skill, 'SKILL.md'), 'utf8');
      const carried = new Set(carriedFiles(skill));
      for (const link of listMarkdownLinks(text).filter(l => isRelativeTarget(l.target))) {
        const rel = path.posix.normalize(link.target.split('#')[0]);
        expect(carried.has(rel), `${skill} links to ${link.target}`).toBe(true);
      }
    }
  });
});

describe('a Cline install of the agency playbooks, in both scopes', () => {
  const BUNDLE = 'digital-agency';
  const PLAYBOOK = 'workflow-agency-full-campaign';
  const EXAMPLE = '.agents/skills/workflow-agency-full-campaign/examples/worked-example.md';
  const base = path.resolve(process.cwd(), 'scratch/test-cline-workflow-links');

  beforeEach(async () => {
    await fs.remove(base);
    await fs.ensureDir(base);
  });
  afterEach(async () => {
    await fs.remove(base);
  });

  async function installInto(root: string, scope: InstallScope): Promise<{ agentsDir: string; workflow: string }> {
    const agentsDir = path.join(root, '.agents');
    await new InstallEngine().install(BUNDLE, { targetDir: agentsDir, scope, method: 'copy', fanout: ['cline'] });
    return { agentsDir, workflow: fs.readFileSync(path.join(root, '.cline', 'workflows', `${PLAYBOOK}.md`), 'utf8') };
  }

  const freshness = (warnings: string[]): string[] => warnings.filter(w => /Outdated projection|Content drift|Missing projection|Stale projection/.test(w));

  it('project scope: the workflow names an example that exists in the project, and doctor finds every projection fresh', { timeout: 30_000 }, async () => {
    const root = path.join(base, 'project');
    const { agentsDir, workflow } = await installInto(root, 'project');
    expect(workflow).toContain(`\`${EXAMPLE}\``);
    expect(workflow).not.toContain('](examples/');
    expect(fs.existsSync(path.join(root, ...EXAMPLE.split('/')))).toBe(true);
    expect(freshness((await DoctorEngine.runDoctor(agentsDir)).warnings)).toEqual([]);
  });

  // Doctor used to re-render every install as `project`, so a global install already showed one outdated projection before this change
  // (its coordinator rule names `~/.agents/...`); the six playbooks would have made it seven. The scope and root now reach the renderer.
  it('global scope: the workflow names the absolute path of an example that exists under the home directory, and doctor finds every projection fresh', { timeout: 30_000 }, async () => {
    const home = path.join(base, 'home');
    const { agentsDir, workflow } = await installInto(home, 'global');
    const absolute = `${home.replace(/\\/g, '/')}/${EXAMPLE}`;
    expect(workflow).toContain(`\`${absolute}\``);
    expect(path.isAbsolute(absolute)).toBe(true);
    expect(fs.existsSync(absolute)).toBe(true);
    expect(freshness((await DoctorEngine.runDoctor(agentsDir)).warnings)).toEqual([]);
  });

  it('an install made before this change is reported outdated, and the next install brings the path of the example', { timeout: 30_000 }, async () => {
    const root = path.join(base, 'migrate');
    const { agentsDir, workflow } = await installInto(root, 'project');
    const relPath = `.cline/workflows/${PLAYBOOK}.md`;
    const older = legacyProjection(fs.readFileSync(path.join(SKILLS, PLAYBOOK, 'SKILL.md'), 'utf8'), `skills/${PLAYBOOK}/SKILL.md`);
    expect(older).not.toBe(workflow);
    // What the previous renderer left behind: its text on disk, and the hash it recorded for that text.
    fs.writeFileSync(path.join(root, relPath), older, 'utf8');
    const lockPath = path.join(agentsDir, 'agents-united.json');
    const lockfile = await fs.readJson(lockPath);
    lockfile.projections[relPath].hash = `sha256:${crypto.createHash('sha256').update(older).digest('hex')}`;
    await fs.writeJson(lockPath, lockfile);

    const outdated = (await DoctorEngine.runDoctor(agentsDir)).warnings.filter(w => w.includes('Outdated projection'));
    expect(outdated).toHaveLength(1);
    expect(outdated[0]).toContain(relPath);

    await new InstallEngine().install(BUNDLE, { targetDir: agentsDir, method: 'copy', fanout: ['cline'] });
    expect(fs.readFileSync(path.join(root, relPath), 'utf8')).toBe(workflow);
    expect(freshness((await DoctorEngine.runDoctor(agentsDir)).warnings)).toEqual([]);
  });

  it('a second install changes nothing', { timeout: 30_000 }, async () => {
    const root = path.join(base, 'twice');
    const first = await installInto(root, 'project');
    const second = await installInto(root, 'project');
    expect(second.workflow).toBe(first.workflow);
  });
});
