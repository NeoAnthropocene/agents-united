/**
 * Plan 033 P20 test helper: a small self-contained registry and valid Bundle proposals in a temp folder.
 *
 * The valid Domain and Organization proposals are built from the real `author-bundle` Skill: the manifest comes from the
 * JSON block of `examples/domain.md` / `examples/organization.md`, and the leader responsibility from
 * `assets/leader-responsibility.template.md` with every placeholder span replaced. Nothing here touches the real registry
 * except to read those Skill files.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const authorBundle = fileURLToPath(new URL('../../registry/skills/author-bundle/', import.meta.url));
export const REAL_REGISTRY = fileURLToPath(new URL('../../registry/', import.meta.url));
export const SHARED_SKILLS = ['host-agent-router', 'handoff', 'git-guardrails'] as const;
export const PROPOSAL_FILES = ['bundles.json', 'leader-responsibility.md', 'bindings.json', 'report.json'] as const;
export const REPORT_KEYS = ['job', 'files', 'template', 'bindings', 'checks', 'provenance', 'quality', 'openItems', 'upstream'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export interface Proposal { manifest: Json; leader: string; bindings: Json; report: Json }

const read = (relative: string): string => fs.readFileSync(path.join(authorBundle, relative), 'utf8').replace(/\r\n/g, '\n');

/** The manifest of the Skill's own worked example (first fenced json block). */
function exampleManifest(kind: 'domain' | 'organization'): Json {
  const match = read(`examples/${kind}.md`).match(/```json\n([\s\S]*?)\n```/);
  if (!match) throw new Error(`No json block in examples/${kind}.md`);
  return JSON.parse(match[1]!);
}

/** The leader template with each backtick placeholder span replaced, in order, by the given texts. */
function fillLeader(replacements: string[]): string {
  const template = read('assets/leader-responsibility.template.md');
  let index = 0;
  const filled = template.replace(/`<[^`\n]*>`/g, () => {
    const next = replacements[index];
    index += 1;
    if (next === undefined) throw new Error('The leader template has more placeholders than the helper fills.');
    return next;
  });
  if (index !== replacements.length) throw new Error(`The leader template has ${index} placeholders, the helper fills ${replacements.length}.`);
  return filled.replace('# Leader responsibility — replace placeholders', '# Leader responsibility');
}

function bindingsFor(manifest: Json): Json {
  const bundles = Object.values<Json>(manifest.bundles);
  return {
    bundles: bundles.map(bundle => bundle.name),
    note: 'Proposal record, not an installer schema.',
    edges: bundles.flatMap(bundle => [
      ...(bundle.orchestrator ? [{ bundle: bundle.name, kind: 'orchestrator', name: bundle.orchestrator, source: 'existing', delivery: 'unverified' }] : []),
      ...(bundle.agents as string[]).map(agent => ({ bundle: bundle.name, kind: 'agent', name: agent, source: 'existing', delivery: 'unverified' })),
      ...(bundle.skills as string[]).map(skill => ({ bundle: bundle.name, kind: 'skill', name: skill, source: 'existing', delivery: 'unverified' })),
      ...(bundle.prerequisites.requiredMcps as Array<{ name: string }>).map(mcp => ({ bundle: bundle.name, kind: 'mcp', name: mcp.name, availability: 'unavailable' })),
    ]),
  };
}

/** Rewrites bindings.json from the manifest as it is now, so a test that changes the manifest keeps the record consistent with it. */
export function rebind(proposal: Proposal): void {
  proposal.bindings = bindingsFor(proposal.manifest);
}

function reportFor(manifest: Json): Json {
  const bundle = Object.values<Json>(manifest.bundles)[0]!;
  return {
    job: { id: 'job-fixture', operation: 'create', template: bundle.tier, bundle: bundle.name },
    files: 'Inventory and hashes are carried by the caller; this report is listed with its own hash deferred.',
    template: 'Sections used as named in the leader responsibility.',
    bindings: 'Edges as recorded in bindings.json; native edges unavailable.',
    checks: 'No deterministic check was run by the author; unavailable.',
    provenance: 'Original proposal; rights not cleared by this fixture.',
    quality: 'pending',
    openItems: ['Independent review and native realization remain open.'],
    upstream: { intent: 'local', sent: false },
  };
}

export function domainProposal(): Proposal {
  const manifest = exampleManifest('domain');
  return {
    manifest,
    leader: fillLeader([
      'example-review-domain',
      'domain',
      'none',
      'a local review of a supplied change using the reviewed planner-orchestrator posture',
      'none: no integration, package or environment variable is needed',
      'the reviewer is an existing registry agent; native realization is separate and unavailable',
      'no command was run by the author; the review is pending and nothing is installed',
      'original proposal; rights not cleared; the next action is an independent review',
    ]),
    bindings: bindingsFor(manifest),
    report: reportFor(manifest),
  };
}

export function organizationProposal(): Proposal {
  const manifest = exampleManifest('organization');
  return {
    manifest,
    leader: fillLeader([
      'example-cross-functional',
      'organization',
      'orchestrator-digital-agency.md',
      'a local cross-functional planning draft using the reviewed subagent-first posture',
      'github is an optional integration and is unavailable in the session; the leader keeps the provisioning responsibility',
      'the lead and specialists are existing registry agents; native realization is separate and unavailable',
      'no command was run by the author; quality is pending and nothing is installed',
      'original proposal; rights not cleared; the next action is an independent review',
    ]),
    bindings: bindingsFor(manifest),
    report: reportFor(manifest),
  };
}

export const bundleOf = (proposal: Proposal): Json => Object.values<Json>(proposal.manifest.bundles)[0];

/** The four files as text, in the authored form (two-space JSON, trailing newline). */
export function serialize(proposal: Proposal): Record<string, string> {
  return {
    'bundles.json': `${JSON.stringify(proposal.manifest, null, 2)}\n`,
    'leader-responsibility.md': proposal.leader,
    'bindings.json': `${JSON.stringify(proposal.bindings, null, 2)}\n`,
    'report.json': `${JSON.stringify(proposal.report, null, 2)}\n`,
  };
}

/** Writes the files under a folder (creating parents); a null value is skipped, which lets a test leave a file out. */
export function writeFiles(directory: string, files: Record<string, string | Buffer | null>): void {
  for (const [relative, content] of Object.entries(files)) {
    if (content === null) continue;
    const file = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

// ---------------------------------------------------------------------------------------------
// The small self-contained registry
// ---------------------------------------------------------------------------------------------

export const FIXTURE_AGENTS = ['subagent-code-reviewer.md', 'orchestrator-digital-agency.md', 'subagent-marketing-creative-designer.md'] as const;
export const FIXTURE_SKILLS = ['requesting-code-review', ...SHARED_SKILLS] as const;

export function fixtureRegistryManifest(): Json {
  const core = (name: string, extra: Json): Json => ({
    name, version: '1.0.0', category: 'Fixture', status: 'stable', skills: [...SHARED_SKILLS], workflows: [],
    prerequisites: { requiredMcps: [], requiredPackages: [], requiredEnvVars: [] }, ...extra,
  });
  return {
    $schema: 'https://example.invalid/bundles.v1.json',
    version: 1,
    bundles: {
      'existing-domain': core('existing-domain', {
        description: 'An existing Domain bundle of the fixture registry.', domain: 'engineering', tier: 'domain',
        agents: ['subagent-code-reviewer.md'], aliases: ['existing-alias', 'old-name'],
        planningLoop: { enabled: true, mode: 'planner-orchestrator' },
      }),
      'existing-org': core('existing-org', {
        description: 'An existing Organization bundle of the fixture registry.', domain: 'organization', tier: 'organization',
        orchestrator: 'orchestrator-digital-agency.md', agents: ['subagent-code-reviewer.md'],
      }),
    },
  };
}

/** Writes the fixture registry (manifest, agents, skills, one rule) and lets a test change the manifest first. */
export function writeFixtureRegistry(registry: string, change?: (manifest: Json) => void): void {
  const manifest = fixtureRegistryManifest();
  change?.(manifest);
  const files: Record<string, string> = { 'bundles.json': `${JSON.stringify(manifest, null, 2)}\n`, 'rules/skill-attribution.md': '# Attribution\n' };
  for (const agent of FIXTURE_AGENTS) files[`agents/${agent}`] = `---\nname: ${agent.replace(/\.md$/, '')}\n---\n# ${agent}\n`;
  for (const skill of FIXTURE_SKILLS) files[`skills/${skill}/SKILL.md`] = `---\nname: ${skill}\n---\n# ${skill}\n`;
  writeFiles(registry, files);
}

export interface Fixture { root: string; registry: string; proposal: string; unrelated: string }

/** A temp folder with a fixture registry, a proposal path (not created) and an unrelated working directory. */
export function makeFixture(prefix = 'au-p20-'): Fixture {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  const fixture = { root, registry: path.join(root, 'registry'), proposal: path.join(root, 'draft', 'bundle-proposal'), unrelated: path.join(root, 'unrelated-working-directory') };
  fs.mkdirSync(fixture.unrelated, { recursive: true });
  writeFixtureRegistry(fixture.registry);
  return fixture;
}

// ---------------------------------------------------------------------------------------------
// Images and links
// ---------------------------------------------------------------------------------------------

export const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

export interface TreeEntry { path: string; kind: 'file' | 'dir' | 'link'; bytes: number; sha256: string }

/** Every entry under a folder by lstat (links are recorded, never followed), with the SHA-256 of each file. */
export function treeImage(root: string): TreeEntry[] {
  const walk = (directory: string): TreeEntry[] =>
    fs.readdirSync(directory).sort().flatMap((name): TreeEntry[] => {
      const full = path.join(directory, name);
      const relative = path.relative(root, full).replaceAll('\\', '/');
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) return [{ path: relative, kind: 'link', bytes: 0, sha256: '' }];
      if (stat.isDirectory()) return [{ path: relative, kind: 'dir', bytes: 0, sha256: '' }, ...walk(full)];
      const bytes = fs.readFileSync(full);
      return [{ path: relative, kind: 'file', bytes: bytes.length, sha256: digest(bytes) }];
    });
  return walk(root);
}

/** A junction (a symbolic link where the platform has no junctions); false when the OS refuses to create one. */
export function makeLink(target: string, at: string): boolean {
  try {
    fs.symlinkSync(target, at, 'junction');
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'EACCES') return false;
    throw error;
  }
}

/** A file symbolic link; false when the OS refuses to create one. */
export function makeFileLink(target: string, at: string): boolean {
  try {
    fs.symlinkSync(target, at, 'file');
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'EACCES') return false;
    throw error;
  }
}
