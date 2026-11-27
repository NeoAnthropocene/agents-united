/**
 * ADR 0082: workflow-check is stricter than the Claude compound projection: it passes only workflows the projector emits intact,
 * with their content. It does not establish installability (Bundle membership, an unmanaged destination that needs --force).
 *
 * The test drives `ClaudeProjector.planCompoundProjection` with the native lane on, on a temporary registry that holds a
 * workflow with a Skill of the same name, a second one, a workflow with no Skill and a workflow whose name the native package
 * never lists. Then it asks `workflow-check` about each file.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeProjector, type PlannedClaudeArtifact } from '../src/core/claude-projector.js';
import { renderNativeWorkflow } from '../src/core/native-package.js';
import { runWorkflowCheck } from '../src/core/workflow-check.js';
import type { BundleDefinition, ResolvedAssets } from '../src/core/types.js';

const script = (name: string): string => `export const meta = {
  name: '${name}',
  description: 'The ${name} workflow.',
  phases: [{ title: 'Find' }],
}

phase('Find')
const found = await agent('look for ${name}', { agentType: 'code-reviewer', phase: 'Find' })
return { found }
`;

/** The workflows of the fixture: file name -> source. */
const WORKFLOWS: Record<string, string> = {
  'demo-flow.js': script('demo-flow'),
  'other-flow.js': toCrlf(script('other-flow')),
  'lonely-flow.js': script('lonely-flow'),
  'Bad-Name.js': script('bad-name'),
};
/** Skills the registry holds: the first, second and fourth workflow have a Skill of the same name, the third does not. */
const SKILLS = ['demo-flow', 'other-flow', 'Bad-Name', 'plain-skill'];

function toCrlf(text: string): string {
  return text.replace(/\r?\n/g, '\r\n');
}

describe('workflow-check agrees with the Claude compound projection', () => {
  let base: string;
  let registry: string;
  beforeEach(() => {
    // The registry folder is named exactly `registry`, as workflow-check requires.
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'au-workflow-projection-')));
    registry = path.join(base, 'registry');
    fs.mkdirSync(registry);
    const bundle = { name: 'workflow-proof', description: 'A bundle that only references skills.', skills: SKILLS };
    fs.writeFileSync(path.join(registry, 'bundles.json'), JSON.stringify({ version: 1, bundles: { [bundle.name]: bundle } }, null, 2));
    for (const skill of SKILLS) {
      fs.mkdirSync(path.join(registry, 'skills', skill), { recursive: true });
      fs.writeFileSync(path.join(registry, 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\ndescription: The ${skill} skill.\n---\n# ${skill}\n`);
    }
    fs.mkdirSync(path.join(registry, 'hosts', 'claude', 'agents'), { recursive: true });
    fs.writeFileSync(path.join(registry, 'hosts', 'claude', 'agents', 'code-reviewer.md'), '---\nname: code-reviewer\ndescription: Reviews code.\n---\nReview.\n');
    fs.mkdirSync(path.join(registry, 'hosts', 'claude', 'workflows'), { recursive: true });
    for (const [name, text] of Object.entries(WORKFLOWS)) fs.writeFileSync(path.join(registry, 'hosts', 'claude', 'workflows', name), text);
  });
  afterEach(() => { fs.rmSync(base, { recursive: true, force: true }); });

  const bundle: BundleDefinition = { name: 'workflow-proof', description: 'A bundle that only references skills.', agents: [], skills: SKILLS };
  const resolved: ResolvedAssets = { targetBundle: 'workflow-proof', agents: [], skills: [...SKILLS, 'lonely-flow'], workflows: [], rules: [] };
  const sourceOf = (name: string): string => fs.readFileSync(path.join(registry, 'hosts', 'claude', 'workflows', name), 'utf8');
  const checked = (name: string) => runWorkflowCheck({ artifact: path.join(registry, 'hosts', 'claude', 'workflows', name) });
  const codes = (name: string): string[] => [...new Set(checked(name).findings.map(item => item.code))].sort();

  async function emitted(nativeLane = true): Promise<PlannedClaudeArtifact[]> {
    const artifacts = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registry, undefined, nativeLane);
    return artifacts.filter(item => item.kind === 'workflow');
  }

  it('emits each workflow that has a Skill of the same name, as the native package renders it, and workflow-check passes it', async () => {
    const artifacts = await emitted();
    for (const name of ['demo-flow', 'other-flow']) {
      const artifact = artifacts.find(item => item.relPath === `.claude/workflows/${name}.js`);
      expect(artifact, name).toBeDefined();
      expect(artifact?.content, name).toBe(renderNativeWorkflow(sourceOf(`${name}.js`), `skills/${name}/SKILL.md`));
      expect(artifact?.canonical, name).toBe(`skills/${name}/SKILL.md`);
      expect(checked(`${name}.js`).status, name).toBe('passed');
    }
  });

  it('emits nothing for the workflow without a Skill, and workflow-check fails it with SKILL_PAIR only', async () => {
    expect((await emitted()).map(item => item.relPath)).not.toContain('.claude/workflows/lonely-flow.js');
    expect(codes('lonely-flow.js')).toEqual(['SKILL_PAIR']);
  });

  it('emits nothing for the workflow whose name the native package never lists, and workflow-check fails it with NAME only (the name check fails before the file is read)', async () => {
    const artifacts = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registry, undefined, true);
    expect(artifacts.map(item => item.relPath)).not.toContain('.claude/workflows/Bad-Name.js');
    // The Skill of that name is installed as a Skill instead.
    expect(artifacts.some(item => item.kind === 'skill' && item.canonical === 'skills/Bad-Name/SKILL.md')).toBe(true);
    expect(codes('Bad-Name.js')).toEqual(['NAME']);
  });

  it('emits no workflow at all with the native lane off, which workflow-check does not model', async () => {
    expect(await emitted(false)).toEqual([]);
  });

  it('passes workflow-check only for workflows the projector emits intact (in this fixture the two sets coincide)', async () => {
    const artifacts = await emitted();
    const installed = artifacts.map(item => path.posix.basename(item.relPath)).sort();
    expect(installed).toEqual(['demo-flow.js', 'other-flow.js']);
    const passing = Object.keys(WORKFLOWS).filter(name => checked(name).status === 'passed').sort();
    expect(passing).toEqual(installed);
    // What was installed is what workflow-check promised: LF-normalised source with trailing newlines collapsed, then one managed
    // marker as the last line, and the whole marker line is the one the native package writes (canonical path, profile, source hash).
    for (const artifact of artifacts) {
      const name = path.posix.basename(artifact.relPath);
      const lines = String(artifact.content).split('\n');
      expect(lines.pop()).toBe('');
      const marker = lines.pop();
      const body = `${lines.join('\n')}\n`;
      expect(body).toBe(`${sourceOf(name).replace(/\r\n/g, '\n').replace(/\n*$/, '')}\n`);
      const hash = crypto.createHash('sha256').update(body).digest('hex');
      expect(marker).toBe(`// managed-by: agents-united | profile: claude-native | canonical: skills/${name.slice(0, -3)}/SKILL.md | source: sha256:${hash} | do not edit`);
    }
  });
});
