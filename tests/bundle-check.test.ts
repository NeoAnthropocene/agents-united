import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RegistryResolver, collectBundleManifestIssues } from '../src/core/registry.js';
import type { BundlesManifest } from '../src/core/types.js';
import {
  BUNDLE_CHECK_OPERATIONS, BUNDLE_RULES, KNOWN_BUNDLE_KEYS, PROPOSAL_FILES, REPORT_KEYS, RegistryProbe, SHARED_SKILLS, bundleCheckExitCode, bundleDefinitionProblems, leaderResponsibilityProblems, readBounded, runBundleCheck,
} from '../src/core/bundle-check.js';
import type { BundleCheckCheckId, BundleCheckInput, BundleCheckResult } from '../src/core/types.js';
import {
  type Fixture, type Json, type Proposal, REAL_REGISTRY, bundleOf, digest, domainProposal, makeFileLink, makeFixture, makeLink,
  organizationProposal, rebind, serialize, treeImage, writeFiles, writeFixtureRegistry,
} from './helpers/bundle-proposal.js';

// ---------------------------------------------------------------------------------------------
// The extraction of the manifest rules out of RegistryResolver.validateBundles (no behaviour change)
// ---------------------------------------------------------------------------------------------

describe('collectBundleManifestIssues: the manifest rules of the registry, collected', () => {
  const folders: string[] = [];
  afterEach(() => { for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true }); });

  const bundle = (name: string, extra: Json = {}): Json => ({ name, description: `${name} bundle`, tier: 'domain', domain: 'engineering', agents: ['a.md'], skills: ['s'], ...extra });
  const manifestOf = (...bundles: Json[]): BundlesManifest => ({ version: 1, bundles: Object.fromEntries(bundles.map(b => [b.name, b])) });

  /** A registry folder with a rules/ folder holding the files named, and the manifest as bundles.json. */
  function registryWith(manifest: unknown, rules: string[] = ['known.md']): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'au-p20-collect-'));
    folders.push(dir);
    fs.mkdirSync(path.join(dir, 'rules'));
    for (const rule of rules) fs.writeFileSync(path.join(dir, 'rules', rule), '# rule\n');
    fs.writeFileSync(path.join(dir, 'bundles.json'), JSON.stringify(manifest));
    return dir;
  }
  const thrownBy = async (dir: string): Promise<string | null> => {
    try { await new RegistryResolver(dir).loadBundles(); return null; } catch (error) { return (error as Error).message; }
  };

  /** The literal first message of each case, recorded from the code before the extraction (RegistryResolver.validateBundles throwing at the first problem). */
  const cases: Array<[string, BundlesManifest, string]> = [
    ['an invalid hostAvailability', manifestOf(bundle('x', { hostAvailability: { claude: { lane: 'legacy', scopes: ['workspace'] } } })), "Registry validation error: bundle \"x\" hostAvailability must allow named hosts with lane \"native\" and nonempty scopes (workspace/global)."],
    ['full including a contributor-only skill', manifestOf(bundle('c', { domain: 'contributor', agents: [], skills: ['only-contrib'] }), bundle('full', { agents: [], skills: ['only-contrib'] })), "Registry validation error: full includes contributor-only skills \"only-contrib\"."],
    ['a populated agent-factory without hostAvailability', manifestOf(bundle('agent-factory', { domain: 'contributor' })), "Registry validation error: populated agent-factory requires hostAvailability for its reviewed delivery."],
    ['an ordinary bundle inheriting a contributor bundle', manifestOf(bundle('c', { domain: 'contributor' }), bundle('x', { parentBundle: 'c' })), "Registry validation error: ordinary bundle \"x\" cannot inherit contributor bundle \"c\"."],
    ['an ordinary bundle recommending a contributor department', manifestOf(bundle('x', { recommendedAddons: ['domain:contributor'] })), "Registry validation error: ordinary bundle \"x\" cannot recommend contributor department \"domain:contributor\"."],
    ['an ordinary bundle recommending a contributor bundle', manifestOf(bundle('c', { domain: 'contributor' }), bundle('x', { recommendedAddons: ['c'] })), "Registry validation error: ordinary bundle \"x\" cannot recommend contributor bundle \"c\"."],
    ['a rule that does not exist', manifestOf(bundle('x', { rules: ['missing.md'] })), "Registry validation error: bundle \"x\" references rule \"missing.md\" which does not exist in registry/rules/."],
    ['nativeRoles that is not an object', manifestOf(bundle('x', { nativeRoles: 'x' })), "Registry validation error: bundle \"x\" nativeRoles must be an object mapping an agent file to a native role name."],
    ['a nativeRoles key that is not an agent', manifestOf(bundle('x', { nativeRoles: { 'other.md': 'role' } })), "Registry validation error: bundle \"x\" nativeRoles key \"other.md\" is not one of its agents."],
    ['a nativeRoles value that is not a role name', manifestOf(bundle('x', { nativeRoles: { 'a.md': 'Bad Role' } })), "Registry validation error: bundle \"x\" nativeRoles value \"Bad Role\" for \"a.md\" is not a valid role name (lowercase letters, digits and hyphens)."],
    ['two agents mapped to one role', manifestOf(bundle('x', { agents: ['a.md', 'b.md'], nativeRoles: { 'a.md': 'same', 'b.md': 'same' } })), "Registry validation error: bundle \"x\" maps more than one agent to the native role \"same\"."],
    ['a role that collides with another agent default role', manifestOf(bundle('x', { agents: ['a.md', 'b.md'], nativeRoles: { 'a.md': 'b' } })), "Registry validation error: bundle \"x\" native role \"b\" for \"a.md\" collides with the default role name of \"b.md\"."],
    ['an unknown planningLoop mode', manifestOf(bundle('x', { planningLoop: { enabled: true, mode: 'weird' } })), "Registry validation error: bundle \"x\" has unknown planningLoop.mode \"weird\". Valid modes: subagent-first, planner-orchestrator"],
    ['a budget on a domain bundle', manifestOf(bundle('x', { planningLoop: { enabled: true, mode: 'subagent-first', budget: { maxIterations: 3 } } })), "Registry validation error: bundle \"x\" declares a Consultation Budget but is not an organization-tier bundle. Iteration caps (planningLoop.budget.maxIterations) are Tier-2-only."],
    ['a non-positive maxIterations', manifestOf(bundle('x', { tier: 'organization', planningLoop: { enabled: true, mode: 'subagent-first', budget: { maxIterations: 0 } } })), "Registry validation error: bundle \"x\" has planningLoop.budget.maxIterations 0; expected a positive integer."],
    ['a budget with planner-orchestrator mode', manifestOf(bundle('x', { tier: 'organization', planningLoop: { enabled: true, mode: 'planner-orchestrator', budget: { maxIterations: 3 } } })), "Registry validation error: bundle \"x\" has planningLoop.mode \"planner-orchestrator\" but also declares a Consultation Budget (budget). Planner-orchestrator bundles must not declare budget."],
    ['sidekicks with planner-orchestrator mode', manifestOf(bundle('x', { planningLoop: { enabled: true, mode: 'planner-orchestrator', sidekicks: { max: 2 } } })), "Registry validation error: bundle \"x\" has planningLoop.mode \"planner-orchestrator\" but also declares sidekicks. Planner-orchestrator bundles must not declare sidekicks."],
  ];

  it.each(cases)('keeps loadBundles throwing exactly the recorded message, and collects it first, for %s', async (_label, manifest, expected) => {
    const dir = registryWith(manifest);
    expect(await thrownBy(dir)).toBe(expected);
    expect(collectBundleManifestIssues(manifest, dir)[0]).toBe(expected);
  });

  it('returns no issue for a valid manifest and for the real registry manifest', () => {
    const dir = registryWith(manifestOf(bundle('x', { planningLoop: { enabled: true, mode: 'planner-orchestrator' } })));
    expect(collectBundleManifestIssues(manifestOf(bundle('x')), dir)).toEqual([]);
    const real = JSON.parse(fs.readFileSync(path.join(REAL_REGISTRY, 'bundles.json'), 'utf8')) as BundlesManifest;
    expect(collectBundleManifestIssues(real, REAL_REGISTRY)).toEqual([]);
  });

  it('collects every problem, in the order the first-throw code meets them', () => {
    const manifest = manifestOf(
      bundle('a', { rules: ['missing.md'], nativeRoles: { 'other.md': 'role' } }),
      bundle('b', { planningLoop: { enabled: true, mode: 'weird' } }),
    );
    const dir = registryWith(manifest);
    expect(collectBundleManifestIssues(manifest, dir)).toEqual([
      'Registry validation error: bundle "a" references rule "missing.md" which does not exist in registry/rules/.',
      'Registry validation error: bundle "a" nativeRoles key "other.md" is not one of its agents.',
      'Registry validation error: bundle "b" has unknown planningLoop.mode "weird". Valid modes: subagent-first, planner-orchestrator',
    ]);
  });

  it('does not crash after a first issue on a malformed later part of the same manifest', () => {
    const manifest = manifestOf(
      bundle('a', { rules: ['missing.md'] }),
      bundle('b', { agents: 'not-an-array', nativeRoles: { x: 'y' } }),
    );
    const dir = registryWith(manifest);
    const issues = collectBundleManifestIssues(manifest, dir);
    expect(issues[0]).toBe('Registry validation error: bundle "a" references rule "missing.md" which does not exist in registry/rules/.');
  });

  it('still throws the same raw error as before when the manifest is malformed before any issue is found', async () => {
    const manifest = { version: 1 } as unknown as BundlesManifest;
    const dir = registryWith(manifest);
    const thrown = await thrownBy(dir);
    expect(thrown).not.toBeNull();
    expect(() => collectBundleManifestIssues(manifest, dir)).toThrow(thrown!);
  });
});

// ---------------------------------------------------------------------------------------------
// The check itself, called directly
// ---------------------------------------------------------------------------------------------

const CHECK_IDS: BundleCheckCheckId[] = ['inventory', 'shape', 'registry-rules', 'references', 'bundle-rules', 'consistency'];
// The P5 check-review canonical convention, written out independently of the implementation.
const canonicalText = (value: unknown): string => Array.isArray(value)
  ? `[${value.map(canonicalText).join(',')}]`
  : value !== null && typeof value === 'object'
    ? `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${canonicalText((value as Record<string, unknown>)[key])}`).join(',')}}`
    : JSON.stringify(value);

describe('checkBundle', () => {
  /** Every temp folder a test creates is tracked and removed afterwards, however many fixtures one test builds. */
  const fixtures: Fixture[] = [];
  afterEach(() => { for (const made of fixtures.splice(0)) fs.rmSync(made.root, { recursive: true, force: true }); });

  function build(proposal: Proposal = domainProposal(), extra: Record<string, string | Buffer | null> = {}, change?: (registry: string) => void): Fixture {
    const made = makeFixture('au-p20-core-');
    fixtures.push(made);
    writeFiles(made.proposal, { ...serialize(proposal), ...extra });
    change?.(made.registry);
    return made;
  }
  const run = (f: Fixture, overrides: Partial<BundleCheckInput> = {}): BundleCheckResult => runBundleCheck({ artifact: f.proposal, registry: f.registry, ...overrides });
  const codes = (r: BundleCheckResult): string[] => [...r.findings.map(item => item.code), ...r.checks.flatMap(check => check.findings.map(item => item.code))];
  const checkOf = (r: BundleCheckResult, id: BundleCheckCheckId) => r.checks.find(check => check.id === id)!;
  const statuses = (r: BundleCheckResult): string[] => r.checks.map(check => `${check.id}:${check.status}`);

  describe('usage', () => {
    it('refuses missing, relative and traversal arguments, an unknown operation and a non-boolean flag as USAGE (unavailable, exit 2)', () => {
      const cases: Array<[BundleCheckInput, string[]]> = [
        [{}, ['--artifact <absolute-proposal-folder> is required.', '--registry <absolute-registry-folder> is required.']],
        [{ artifact: 'relative/proposal', registry: 'relative/registry' }, ['--artifact must be an absolute path.', '--registry must be an absolute path.']],
        [{ artifact: `${os.tmpdir()}${path.sep}a${path.sep}..${path.sep}b`, registry: `${os.tmpdir()}${path.sep}.${path.sep}r` }, ['--artifact must be an absolute path without . or .. segments.', '--registry must be an absolute path without . or .. segments.']],
        [{ artifact: os.tmpdir(), registry: os.tmpdir(), operation: 'delete' }, ['--operation must be one of create, update, reuse; got "delete".']],
        [{ artifact: os.tmpdir(), registry: os.tmpdir(), allowUnresolved: 'yes' as unknown as boolean }, ['--allow-unresolved is a flag and takes no value.']],
      ];
      for (const [input, messages] of cases) {
        const r = runBundleCheck(input);
        expect(r.status).toBe('unavailable');
        expect(bundleCheckExitCode(r)).toBe(2);
        expect(r.findings.map(item => item.code)).toEqual(messages.map(() => 'USAGE'));
        expect(r.findings.map(item => item.message)).toEqual(messages);
        expect(r.checks.map(check => check.status)).toEqual(CHECK_IDS.map(() => 'not-run'));
        expect(r.inventoryComplete).toBe(false);
        expect(r.candidateDigest).toBeNull();
      }
    });

    it('never throws, whatever the input object is', () => {
      expect(runBundleCheck(undefined as unknown as BundleCheckInput).status).toBe('unavailable');
      expect(runBundleCheck(null as unknown as BundleCheckInput).status).toBe('unavailable');
    });

    it('lists the three supported operations', () => {
      expect([...BUNDLE_CHECK_OPERATIONS]).toEqual(['create', 'update', 'reuse']);
    });
  });

  describe('the registry as an input', () => {
    const registryProblem = (r: BundleCheckResult): string => r.findings.find(item => item.code === 'INPUT_UNAVAILABLE')!.message;

    it('is unavailable, with every check unavailable, when the registry folder is missing, is a file, or has no bundles.json', () => {
      const f = build();
      const missing = run(f, { registry: path.join(f.root, 'no-such-registry') });
      expect(missing.status).toBe('unavailable');
      expect(bundleCheckExitCode(missing)).toBe(2);
      expect(codes(missing)).toEqual(['INPUT_UNAVAILABLE']);
      expect(statuses(missing)).toEqual(CHECK_IDS.map(id => `${id}:unavailable`));
      expect(missing.inventoryComplete).toBe(false);
      expect(missing.candidateDigest).toBeNull();
      expect(missing.registryDigest).toBeNull();

      const file = path.join(f.root, 'registry-as-file');
      fs.writeFileSync(file, 'x');
      expect(codes(run(f, { registry: file }))).toEqual(['INPUT_UNAVAILABLE']);

      fs.rmSync(path.join(f.registry, 'bundles.json'));
      const noManifest = run(f);
      expect(noManifest.status).toBe('unavailable');
      expect(registryProblem(noManifest)).toContain('bundles.json');
    });

    it('is unavailable when its bundles.json is a folder, is not valid UTF-8, is not JSON, or is not a bundles manifest', () => {
      const f = build();
      const manifestPath = path.join(f.registry, 'bundles.json');
      const original = fs.readFileSync(manifestPath);
      const attempts: Array<[string, Buffer | null, string]> = [
        ['a folder', null, 'not a regular file'],
        ['not UTF-8', Buffer.from([0xff, 0xfe, 0x7b, 0x7d]), 'UTF-8'],
        ['not JSON', Buffer.from('{ "bundles": '), 'JSON'],
        ['an array', Buffer.from('[]'), 'bundles manifest'],
        ['no bundles member', Buffer.from('{"version":1}'), 'bundles manifest'],
        ['a bundle that is not an object', Buffer.from('{"version":1,"bundles":{"x":5}}'), 'bundles manifest'],
      ];
      for (const [label, bytes, expected] of attempts) {
        fs.rmSync(manifestPath, { recursive: true, force: true });
        if (bytes === null) fs.mkdirSync(manifestPath); else fs.writeFileSync(manifestPath, bytes);
        const r = run(f);
        expect(r.status, label).toBe('unavailable');
        expect(bundleCheckExitCode(r), label).toBe(2);
        expect(registryProblem(r), label).toContain(expected);
        expect(statuses(r), label).toEqual(CHECK_IDS.map(id => `${id}:unavailable`));
      }
      fs.rmSync(manifestPath, { recursive: true, force: true });
      fs.writeFileSync(manifestPath, original);
      expect(run(f).status).toBe('passed');
    });

    it('is unavailable, naming the first problem, when its own manifest does not pass the manifest rules', () => {
      const f = build(domainProposal(), {}, registry => {
        const manifestPath = path.join(registry, 'bundles.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Json;
        manifest.bundles['existing-domain'].rules = ['missing-rule.md'];
        manifest.bundles['existing-org'].nativeRoles = { 'other.md': 'role' };
        fs.writeFileSync(manifestPath, JSON.stringify(manifest));
      });
      const r = run(f);
      expect(r.status).toBe('unavailable');
      expect(bundleCheckExitCode(r)).toBe(2);
      expect(codes(r)).toEqual(['INPUT_UNAVAILABLE']);
      expect(registryProblem(r)).toContain('Registry validation error: bundle "existing-domain" references rule "missing-rule.md" which does not exist in registry/rules/.');
      expect(registryProblem(r)).not.toContain('nativeRoles');
    });

    it('is unavailable when its bundles.json is larger than the bound', () => {
      const f = build();
      fs.writeFileSync(path.join(f.registry, 'bundles.json'), `{"version":1,"bundles":{},"pad":"${'x'.repeat(4 * 1024 * 1024)}"}`);
      const r = run(f);
      expect(r.status).toBe('unavailable');
      expect(registryProblem(r)).toContain('larger than');
    });

    it('refuses a registry folder that is a junction, or reached through one, as PATH_UNSAFE (failed, exit 1)', ctx => {
      const f = build();
      const linked = path.join(f.root, 'linked-registry');
      if (!makeLink(f.registry, linked)) return ctx.skip();
      const leaf = run(f, { registry: linked });
      expect(leaf.status).toBe('failed');
      expect(bundleCheckExitCode(leaf)).toBe(1);
      expect(codes(leaf)).toEqual(['PATH_UNSAFE']);
      expect(statuses(leaf)).toEqual(CHECK_IDS.map(id => `${id}:not-run`));
      expect(leaf.candidateDigest).toBeNull();
      const through = run(f, { registry: path.join(linked, 'sub') });
      expect(codes(through)).toEqual(['PATH_UNSAFE']);
    });

    it('refuses a bundles.json that is a link as PATH_UNSAFE and never reads through it', ctx => {
      const f = build();
      const manifestPath = path.join(f.registry, 'bundles.json');
      const elsewhere = path.join(f.root, 'elsewhere-bundles.json');
      fs.renameSync(manifestPath, elsewhere);
      if (!makeFileLink(elsewhere, manifestPath)) { fs.renameSync(elsewhere, manifestPath); return ctx.skip(); }
      const r = run(f);
      expect(r.status).toBe('failed');
      expect(codes(r)).toEqual(['PATH_UNSAFE']);
      expect(r.findings[0]!.message).toContain('bundles.json');
    });
  });

  describe('the inventory check', () => {
    it('inventories the four files, sorted, with sizes and SHA-256, and a digest over the inventory', () => {
      const f = build();
      const r = run(f);
      expect(r.status, JSON.stringify(r.findings)).toBe('passed');
      expect(r.inventory.map(item => item.path)).toEqual([...PROPOSAL_FILES].sort());
      for (const item of r.inventory) {
        const bytes = fs.readFileSync(path.join(f.proposal, item.path));
        expect(item).toEqual({ path: item.path, kind: 'file', bytes: bytes.length, sha256: digest(bytes) });
      }
      expect(r.candidateDigest).toBe(digest(canonicalText(r.inventory)));
      expect(r.inventoryComplete).toBe(true);
      expect(r.preserved).toEqual([]);
      expect(checkOf(r, 'inventory')).toEqual({ id: 'inventory', status: 'passed', reason: null, findings: [] });
    });

    it('reads the same folder written with forward, mixed or trailing separators, and echoes the argument as given', () => {
      const f = build();
      const forward = (value: string): string => value.replaceAll('\\', '/');
      const variants: Array<[string, string]> = [
        [forward(f.proposal), forward(f.registry)],
        [`${f.proposal}${path.sep}`, `${f.registry}${path.sep}`],
        [`${forward(f.proposal)}/`, `${forward(f.registry)}//`],
        [f.proposal.replace(`draft${path.sep}`, 'draft/'), f.registry],
      ];
      for (const [artifact, registry] of variants) {
        const r = run(f, { artifact, registry });
        expect(r.status, `${artifact} | ${registry}: ${JSON.stringify(r.findings)}`).toBe('passed');
        expect(r.artifact).toBe(artifact);
        expect(r.registry).toBe(registry);
      }
    });

    it('is unavailable when the proposal folder is missing, is a file, or holds none of the four files', () => {
      const f = build();
      const missing = run(f, { artifact: path.join(f.root, 'no-such-proposal') });
      expect(missing.status).toBe('unavailable');
      expect(bundleCheckExitCode(missing)).toBe(2);
      expect(codes(missing)).toEqual(['INPUT_UNAVAILABLE']);
      expect(statuses(missing)).toEqual(CHECK_IDS.map(id => `${id}:unavailable`));

      const asFile = path.join(f.root, 'proposal-as-file');
      fs.writeFileSync(asFile, 'x');
      expect(codes(run(f, { artifact: asFile }))).toEqual(['INPUT_UNAVAILABLE']);

      const empty = path.join(f.root, 'empty-folder');
      fs.mkdirSync(empty);
      fs.writeFileSync(path.join(empty, 'README.md'), 'not a proposal');
      const none = run(f, { artifact: empty });
      expect(none.status).toBe('unavailable');
      expect(codes(none)).toEqual(['INPUT_UNAVAILABLE']);
      expect(none.findings[0]!.message).toContain('none of the four');
    });

    it.each([...PROPOSAL_FILES])('fails INVENTORY, with the later checks not run, when %s is missing', name => {
      const f = build(domainProposal(), { [name]: null });
      const r = run(f);
      expect(r.status).toBe('failed');
      expect(bundleCheckExitCode(r)).toBe(1);
      const inventory = checkOf(r, 'inventory');
      expect(inventory.status).toBe('failed');
      expect(inventory.findings).toEqual([expect.objectContaining({ code: 'INVENTORY', path: name })]);
      expect(statuses(r)).toEqual(['inventory:failed', ...CHECK_IDS.slice(1).map(id => `${id}:not-run`)]);
      expect(r.candidateDigest).toBeNull();
      expect(r.inventoryComplete).toBe(false);
      expect(r.inventory).toEqual([]);
    });

    it('fails INVENTORY for every other entry of a create folder: a file, an empty folder and a hidden file', () => {
      const f = build(domainProposal(), { 'notes.txt': 'extra', '.hidden': 'x' });
      fs.mkdirSync(path.join(f.proposal, 'empty-dir'));
      const r = run(f);
      expect(r.status).toBe('failed');
      expect(checkOf(r, 'inventory').findings.map(item => [item.code, item.path])).toEqual([
        ['INVENTORY', '.hidden'], ['INVENTORY', 'empty-dir'], ['INVENTORY', 'notes.txt'],
      ]);
    });

    it('fails INVENTORY for a name that is a folder where one of the four files belongs', () => {
      const f = build(domainProposal(), { 'report.json': null });
      fs.mkdirSync(path.join(f.proposal, 'report.json'));
      const r = run(f);
      expect(r.status).toBe('failed');
      expect(checkOf(r, 'inventory').findings.map(item => item.code)).toContain('INVENTORY');
      expect(checkOf(r, 'inventory').findings.some(item => item.path === 'report.json')).toBe(true);
    });

    it('fails INVENTORY for a file whose name differs from a required name only by case (the exact names are required)', ctx => {
      const f = build(domainProposal(), { 'report.json': null, 'Report.json': '{}' });
      if (!fs.readdirSync(f.proposal).includes('Report.json')) return ctx.skip();
      const r = run(f);
      expect(r.status).toBe('failed');
      const paths = checkOf(r, 'inventory').findings.map(item => item.path);
      expect(paths).toContain('report.json');
      expect(paths).toContain('Report.json');
    });

    it('fails INPUT_LIMIT for an authored file over 256 KiB, naming it, and accepts one of exactly 256 KiB', () => {
      const f = build();
      fs.writeFileSync(path.join(f.proposal, 'bindings.json'), `{"pad":"${'x'.repeat(256 * 1024)}"}`);
      const r = run(f);
      expect(r.status).toBe('failed');
      expect(checkOf(r, 'inventory').findings).toEqual([expect.objectContaining({ code: 'INPUT_LIMIT', path: 'bindings.json' })]);
      const pad = 256 * 1024 - '{"pad":""}'.length;
      fs.writeFileSync(path.join(f.proposal, 'bindings.json'), `{"pad":"${'x'.repeat(pad)}"}`);
      expect(fs.statSync(path.join(f.proposal, 'bindings.json')).size).toBe(256 * 1024);
      expect(codes(run(f))).not.toContain('INPUT_LIMIT');
    });

    it('fails ENCODING for a file that is not valid UTF-8, and JSON_INVALID for malformed JSON, each naming the file', () => {
      for (const name of ['leader-responsibility.md', 'bundles.json', 'bindings.json', 'report.json']) {
        const f = build(domainProposal(), { [name]: Buffer.from([0x23, 0x20, 0xc3, 0x28, 0x0a]) });
        const r = run(f);
        expect(r.status, name).toBe('failed');
        expect(checkOf(r, 'inventory').findings, name).toEqual([expect.objectContaining({ code: 'ENCODING', path: name })]);
      }
      for (const name of ['bundles.json', 'bindings.json', 'report.json']) {
        const f = build(domainProposal(), { [name]: '{ "broken": ' });
        const r = run(f);
        expect(r.status, name).toBe('failed');
        expect(checkOf(r, 'inventory').findings, name).toEqual([expect.objectContaining({ code: 'JSON_INVALID', path: name })]);
      }
      const bom = build(domainProposal(), { 'report.json': `﻿${JSON.stringify(domainProposal().report)}` });
      expect(checkOf(run(bom), 'inventory').findings).toEqual([expect.objectContaining({ code: 'JSON_INVALID', path: 'report.json' })]);
    });

    it('refuses a junction at the proposal root, or an ancestor of it, as PATH_UNSAFE (failed, exit 1)', ctx => {
      const f = build();
      const linked = path.join(f.root, 'linked-proposal');
      if (!makeLink(f.proposal, linked)) return ctx.skip();
      const leaf = run(f, { artifact: linked });
      expect(leaf.status).toBe('failed');
      expect(bundleCheckExitCode(leaf)).toBe(1);
      expect(checkOf(leaf, 'inventory').findings).toEqual([expect.objectContaining({ code: 'PATH_UNSAFE' })]);
      expect(leaf.candidateDigest).toBeNull();
      const linkedParent = path.join(f.root, 'linked-draft');
      if (!makeLink(path.dirname(f.proposal), linkedParent)) return ctx.skip();
      const through = run(f, { artifact: path.join(linkedParent, path.basename(f.proposal)) });
      expect(through.status).toBe('failed');
      expect(checkOf(through, 'inventory').findings).toEqual([expect.objectContaining({ code: 'PATH_UNSAFE' })]);
      expect(checkOf(through, 'inventory').findings[0]!.message).toContain(linkedParent);
    });

    it('refuses a link inside the folder as PATH_UNSAFE and never reads through it, in every operation', ctx => {
      const f = build(domainProposal());
      const outside = path.join(f.root, 'outside');
      fs.mkdirSync(outside);
      fs.writeFileSync(path.join(outside, 'secret.txt'), 'not for the inventory');
      if (!makeLink(outside, path.join(f.proposal, 'linked-folder'))) return ctx.skip();
      const outsideBefore = treeImage(outside);
      for (const operation of ['create', 'update', 'reuse']) {
        const r = run(f, { operation });
        expect(r.status, operation).toBe('failed');
        expect(checkOf(r, 'inventory').findings, operation).toEqual([expect.objectContaining({ code: 'PATH_UNSAFE', path: 'linked-folder' })]);
        expect(JSON.stringify(r)).not.toContain('secret.txt');
      }
      expect(treeImage(outside)).toEqual(outsideBefore);
    });

    it('refuses a file symbolic link standing in for one of the four files as PATH_UNSAFE (skipped when the OS refuses to create one)', ctx => {
      const f = build();
      const real = path.join(f.root, 'elsewhere-report.json');
      fs.renameSync(path.join(f.proposal, 'report.json'), real);
      if (!makeFileLink(real, path.join(f.proposal, 'report.json'))) return ctx.skip();
      const r = run(f);
      expect(r.status).toBe('failed');
      expect(checkOf(r, 'inventory').findings).toEqual([expect.objectContaining({ code: 'PATH_UNSAFE', path: 'report.json' })]);
    });

    it.skipIf(process.platform !== 'win32')('refuses a junction leaf written with a trailing backslash or slash as PATH_UNSAFE (exit 1)', ctx => {
      const f = build();
      const linked = path.join(f.root, 'linked-proposal');
      if (!makeLink(f.proposal, linked)) return ctx.skip();
      for (const artifact of [`${linked}\\`, `${linked}/`, `${linked.replace(/\\/g, '/')}/`]) {
        const r = run(f, { artifact });
        expect(r.status, artifact).toBe('failed');
        expect(codes(r), artifact).toContain('PATH_UNSAFE');
        expect(r.candidateDigest, artifact).toBeNull();
      }
    });

    it.skipIf(process.platform === 'win32')('refuses a symbolic link leaf written with trailing slashes as PATH_UNSAFE (exit 1)', () => {
      const f = build();
      const linked = path.join(f.root, 'linked-proposal');
      fs.symlinkSync(f.proposal, linked);
      for (const artifact of [linked, `${linked}/`, `${linked}///`]) {
        const r = run(f, { artifact });
        expect(r.status, artifact).toBe('failed');
        expect(codes(r), artifact).toContain('PATH_UNSAFE');
      }
    });

    it.skipIf(process.platform === 'win32')('refuses an entry name the checker scripts refuse as PATH_UNSAFE (Windows cannot create such a name)', () => {
      const f = build(domainProposal(), { 'bad:name.txt': 'x' });
      const r = run(f, { operation: 'update' });
      expect(r.status).toBe('failed');
      expect(checkOf(r, 'inventory').findings).toEqual([expect.objectContaining({ code: 'PATH_UNSAFE', path: 'bad:name.txt' })]);
    });

    describe('update and reuse allow preservation-only files', () => {
      const protectedNote = 'Owner: unknown\nDo not change this note.\n';

      it.each(['update', 'reuse'])('lists them as preserved, inventories and hashes them, and never parses them (%s)', operation => {
        const f = build(domainProposal(), {
          'protected-notes.txt': protectedNote,
          'baseline/binary.bin': Buffer.from([0xff, 0x00, 0xfe, 0xc3, 0x28]),
          'baseline/not-json.json': '{ this is not json',
        });
        const r = run(f, { operation });
        expect(r.status, JSON.stringify(r.findings)).toBe('passed');
        expect(r.operation).toBe(operation);
        expect(r.preserved).toEqual(['baseline/binary.bin', 'baseline/not-json.json', 'protected-notes.txt']);
        expect(r.inventory.map(item => item.path)).toEqual([...PROPOSAL_FILES, 'baseline/binary.bin', 'baseline/not-json.json', 'protected-notes.txt'].sort());
        const note = r.inventory.find(item => item.path === 'protected-notes.txt')!;
        expect(note).toEqual({ path: 'protected-notes.txt', kind: 'file', bytes: Buffer.byteLength(protectedNote), sha256: digest(protectedNote) });
      });

      it('keeps a create folder strict: the same extra files are INVENTORY findings there', () => {
        const f = build(domainProposal(), { 'protected-notes.txt': protectedNote });
        const r = run(f, { operation: 'create' });
        expect(r.status).toBe('failed');
        expect(checkOf(r, 'inventory').findings).toEqual([expect.objectContaining({ code: 'INVENTORY', path: 'protected-notes.txt' })]);
        expect(r.preserved).toEqual([]);
      });

      it('still requires the four files at the top level: a nested copy of one does not stand in for it', () => {
        const f = build(domainProposal(), { 'bindings.json': null, 'baseline/bindings.json': '{"x":1}' });
        const r = run(f, { operation: 'update' });
        expect(r.status).toBe('failed');
        expect(checkOf(r, 'inventory').findings).toEqual([expect.objectContaining({ code: 'INVENTORY', path: 'bindings.json' })]);
      });

      it('fails INPUT_LIMIT beyond 32 preserved files or 2 MiB of them in total', () => {
        const many: Record<string, string> = {};
        for (let index = 0; index < 33; index += 1) many[`baseline/file-${String(index).padStart(2, '0')}.txt`] = 'x';
        const tooMany = run(build(domainProposal(), many), { operation: 'update' });
        expect(tooMany.status).toBe('failed');
        expect(checkOf(tooMany, 'inventory').findings).toEqual([expect.objectContaining({ code: 'INPUT_LIMIT', path: null })]);
        expect(checkOf(tooMany, 'inventory').findings[0]!.message).toContain('32');

        delete many['baseline/file-32.txt'];
        expect(run(build(domainProposal(), many), { operation: 'update' }).status).toBe('passed');

        const big = { 'baseline/a.bin': Buffer.alloc(1024 * 1024), 'baseline/b.bin': Buffer.alloc(1024 * 1024 + 1) };
        const tooBig = run(build(domainProposal(), big), { operation: 'update' });
        expect(tooBig.status).toBe('failed');
        expect(checkOf(tooBig, 'inventory').findings).toEqual([expect.objectContaining({ code: 'INPUT_LIMIT', path: null })]);
        expect(checkOf(tooBig, 'inventory').findings[0]!.message).toContain('2097152');
        const exact = { 'baseline/a.bin': Buffer.alloc(1024 * 1024), 'baseline/b.bin': Buffer.alloc(1024 * 1024) };
        expect(run(build(domainProposal(), exact), { operation: 'update' }).status).toBe('passed');
      });
    });
  });

  describe('the shape check', () => {
    /** Builds the proposal, lets the test change it, runs the check and returns the result. */
    function shaped(kind: 'domain' | 'organization', change: (proposal: Proposal, bundle: Json) => void, overrides: Partial<BundleCheckInput> = {}): BundleCheckResult {
      const proposal = kind === 'domain' ? domainProposal() : organizationProposal();
      change(proposal, bundleOf(proposal));
      return run(build(proposal), overrides);
    }
    const shapeMessages = (r: BundleCheckResult): string[] => checkOf(r, 'shape').findings.map(item => item.message);
    function expectShapeFault(r: BundleCheckResult, file: string, fragment: string): void {
      expect(r.status, JSON.stringify(r.findings)).toBe('failed');
      expect(bundleCheckExitCode(r)).toBe(1);
      const shape = checkOf(r, 'shape');
      expect(shape.status).toBe('failed');
      expect(shape.findings.every(item => item.code === 'SHAPE' && item.path === file), JSON.stringify(shape.findings)).toBe(true);
      expect(shape.findings.map(item => item.message).join('\n')).toContain(fragment);
      expect(checkOf(r, 'inventory').status).toBe('passed');
      for (const id of ['registry-rules', 'references', 'bundle-rules', 'consistency'] as const) expect(checkOf(r, id).status, id).toBe('not-run');
    }

    it('passes the valid Domain and Organization proposals built from the Skill examples', () => {
      for (const proposal of [domainProposal(), organizationProposal()]) {
        const r = run(build(proposal));
        expect(r.status, JSON.stringify(r.findings)).toBe('passed');
        expect(checkOf(r, 'shape')).toEqual({ id: 'shape', status: 'passed', reason: null, findings: [] });
        expect(r.bundleNames).toEqual(Object.keys(proposal.manifest.bundles));
      }
    });

    it.each(['stable', 'experimental', 'under-construction', 'needs-audit', 'deprecated'])('accepts the status %s (any BundleStatus the job supplies)', status => {
      const r = shaped('domain', (_p, bundle) => { bundle.status = status; });
      expect(r.status, JSON.stringify(r.findings)).toBe('passed');
    });

    describe('bundles.json envelope', () => {
      it('refuses a document that is not an object, has a wrong version, a missing or empty bundles object, or an unknown key', () => {
        expectShapeFault(shaped('domain', p => { p.manifest = []; }), 'bundles.json', 'must be a JSON object');
        expectShapeFault(shaped('domain', p => { p.manifest.version = 2; }), 'bundles.json', 'version must be 1');
        expectShapeFault(shaped('domain', p => { delete p.manifest.version; }), 'bundles.json', 'version must be 1');
        expectShapeFault(shaped('domain', p => { delete p.manifest.bundles; }), 'bundles.json', 'bundles must be a non-empty object');
        expectShapeFault(shaped('domain', p => { p.manifest.bundles = {}; }), 'bundles.json', 'bundles must be a non-empty object');
        expectShapeFault(shaped('domain', p => { p.manifest.extra = true; }), 'bundles.json', 'unknown top-level key "extra"');
        expectShapeFault(shaped('domain', p => { p.manifest.$schema = 5; }), 'bundles.json', '$schema must be a string');
      });

      it('accepts an optional $schema string', () => {
        const r = shaped('domain', p => { p.manifest.$schema = 'https://example.invalid/bundles.v1.json'; });
        expect(r.status, JSON.stringify(r.findings)).toBe('passed');
      });

      it('refuses a bundle key that is not a lower-case slug, a key that differs from the name, and a bundle that is not an object', () => {
        expectShapeFault(shaped('domain', p => { p.manifest.bundles = { 'Bad_Name': { ...bundleOf(p), name: 'Bad_Name' } }; }), 'bundles.json', 'lower-case words joined by hyphens');
        expectShapeFault(shaped('domain', p => { bundleOf(p).name = 'another-name'; }), 'bundles.json', 'must equal the key');
        expectShapeFault(shaped('domain', p => { p.manifest.bundles = { 'a-bundle': 'text' }; }), 'bundles.json', 'must be an object');
      });
    });

    describe('BundleDefinition fields', () => {
      it.each(['name', 'version', 'description', 'category', 'domain', 'tier', 'status', 'agents', 'skills', 'workflows', 'prerequisites'])('refuses a proposal without %s', field => {
        expectShapeFault(shaped('domain', (_p, bundle) => { delete bundle[field]; }), 'bundles.json', `${field} is required`);
      });

      it('refuses an unknown key (an invented field), naming it', () => {
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.tools = ['Read']; }), 'bundles.json', 'unknown key "tools"');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.apiKey = 'secret'; }), 'bundles.json', 'unknown key "apiKey"');
      });

      it('refuses values of the wrong type, an unknown tier or an unknown status', () => {
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.version = 1; }), 'bundles.json', 'version must be a non-empty string');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.description = ''; }), 'bundles.json', 'description must be a non-empty string');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.tier = 'team'; }), 'bundles.json', 'tier must be "domain" or "organization"');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.status = 'beta'; }), 'bundles.json', 'status must be one of');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.agents = [{ name: 'x' }]; }), 'bundles.json', 'agents must be a list of non-empty strings');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.skills = 'handoff'; }), 'bundles.json', 'skills must be a list of non-empty strings');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.workflows = [3]; }), 'bundles.json', 'workflows must be a list of non-empty strings');
        expectShapeFault(shaped('organization', (_p, bundle) => { bundle.orchestrator = ''; }), 'bundles.json', 'orchestrator must be a non-empty string');
      });

      it('types the optional fields: aliases, recommendedAddons, parentBundle, rules, modes, personaAliases, planningLoop', () => {
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.aliases = 'short'; }), 'bundles.json', 'aliases must be a list of non-empty strings');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.recommendedAddons = [1]; }), 'bundles.json', 'recommendedAddons must be a list of non-empty strings');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.parentBundle = ['x']; }), 'bundles.json', 'parentBundle must be a non-empty string');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.rules = 'skill-attribution.md'; }), 'bundles.json', 'rules must be a list of non-empty strings');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.rules = ['../outside.md']; }), 'bundles.json', 'rules entry "../outside.md" must be a single file name');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.modes = { surprise: 'x' }; }), 'bundles.json', 'modes has unknown key "surprise"');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.modes = { operational: 5 }; }), 'bundles.json', 'modes.operational must be a string');
        expectShapeFault(shaped('organization', (_p, bundle) => { bundle.personaAliases = { a: 5 }; }), 'bundles.json', 'personaAliases.a must be a string');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.planningLoop = { mode: 'planner-orchestrator' }; }), 'bundles.json', 'planningLoop.enabled must be a boolean');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.planningLoop = { enabled: true, mode: 5 }; }), 'bundles.json', 'planningLoop.mode must be a string');
        expectShapeFault(shaped('organization', (_p, bundle) => { bundle.planningLoop = { enabled: true, mode: 'subagent-first', budget: { turns: 3 } }; }), 'bundles.json', 'planningLoop.budget has unknown key "turns"');
        expectShapeFault(shaped('organization', (_p, bundle) => { bundle.planningLoop = { enabled: true, mode: 'subagent-first', sidekicks: { many: 2 } }; }), 'bundles.json', 'planningLoop.sidekicks has unknown key "many"');
      });

      it('accepts every optional field in the shapes the real registry uses', () => {
        const r = shaped('organization', (_p, bundle) => {
          bundle.aliases = ['xfn'];
          bundle.recommendedAddons = ['existing-domain', 'domain:engineering'];
          bundle.parentBundle = 'existing-org';
          bundle.rules = ['skill-attribution.md'];
          bundle.modes = { operational: 'Full', 'limited-operational': 'Some', brainstorming: 'None' };
          bundle.personaAliases = { persona: 'subagent-code-reviewer' };
          bundle.planningLoop = { enabled: true, mode: 'subagent-first', budget: { maxPlanningRounds: 2, maxPeerExchangesPerPair: 2, summaryWordCap: 1000, maxIterations: 100 }, sidekicks: { max: 5 } };
        });
        expect(checkOf(r, 'shape').status, JSON.stringify(checkOf(r, 'shape').findings)).toBe('passed');
      });
    });

    describe('prerequisites', () => {
      it('refuses a prerequisites value that is not an object, has an invented key, or lacks one of the three lists', () => {
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites = []; }), 'bundles.json', 'prerequisites must be an object');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites.optionalPackages = []; }), 'bundles.json', 'prerequisites has unknown key "optionalPackages"');
        expectShapeFault(shaped('domain', (_p, bundle) => { delete bundle.prerequisites.requiredEnvVars; }), 'bundles.json', 'prerequisites.requiredEnvVars is required');
        expectShapeFault(shaped('domain', (_p, bundle) => { delete bundle.prerequisites.requiredMcps; }), 'bundles.json', 'prerequisites.requiredMcps is required');
      });

      it('refuses an object where a package or variable name belongs, and a malformed MCP entry', () => {
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites.requiredPackages = [{ name: 'pkg', optional: true }]; }), 'bundles.json', 'requiredPackages must be a list of non-empty strings');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites.requiredEnvVars = 'TOKEN'; }), 'bundles.json', 'requiredEnvVars must be a list of non-empty strings');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites.requiredMcps = ['github']; }), 'bundles.json', 'requiredMcps[0] must be an object');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites.requiredMcps = [{ purpose: 'x' }]; }), 'bundles.json', 'requiredMcps[0].name must be a non-empty string');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites.requiredMcps = [{ name: 'github', url: 'https://example.invalid' }]; }), 'bundles.json', 'requiredMcps[0] has unknown key "url"');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites.requiredMcps = [{ name: 'github', optional: 'yes' }]; }), 'bundles.json', 'requiredMcps[0].optional must be a boolean');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites.requiredMcps = [{ name: 'github', purpose: 3 }]; }), 'bundles.json', 'requiredMcps[0].purpose must be a string');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites.requiredMcps = [{ name: 'github', optionalForBrainstorming: 1 }]; }), 'bundles.json', 'requiredMcps[0].optionalForBrainstorming must be a boolean');
      });

      it('accepts the four MCP fields and lists of package and variable names', () => {
        const r = shaped('organization', (_p, bundle) => {
          bundle.prerequisites = {
            requiredMcps: [{ name: 'github', purpose: 'Optional repository access', optional: true, optionalForBrainstorming: true }],
            requiredPackages: ['@playwright/test'], requiredEnvVars: ['EXAMPLE_VAR'],
          };
        });
        expect(checkOf(r, 'shape').status, JSON.stringify(checkOf(r, 'shape').findings)).toBe('passed');
      });
    });

    describe('template placeholders', () => {
      it('refuses a value that is a whole <...> placeholder in bundles.json, wherever it stands', () => {
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.name = '<bundle-name>'; }), 'bundles.json', '<bundle-name>');
        expectShapeFault(shaped('organization', (_p, bundle) => { bundle.orchestrator = '<existing-or-proposed-leader.md>'; }), 'bundles.json', '<existing-or-proposed-leader.md>');
        expectShapeFault(shaped('organization', (_p, bundle) => { bundle.agents = ['<existing-or-proposed-specialist.md>']; }), 'bundles.json', '<existing-or-proposed-specialist.md>');
        expectShapeFault(shaped('domain', (_p, bundle) => { bundle.prerequisites.requiredMcps = [{ name: 'github', purpose: '  <purpose>  ' }]; }), 'bundles.json', '<purpose>');
        expectShapeFault(shaped('domain', p => { p.manifest.bundles = { '<bundle-name>': bundleOf(p) }; }), 'bundles.json', '<bundle-name>');
      });

      it('accepts text that merely contains angle brackets', () => {
        const r = shaped('domain', (_p, bundle) => { bundle.description = 'Reviews a <supplied> change and hands off findings.'; });
        expect(r.status, JSON.stringify(r.findings)).toBe('passed');
      });

      it('lists at most a bounded number of placeholders and says how many more there are', () => {
        const r = shaped('domain', (_p, bundle) => { bundle.agents = Array.from({ length: 100 }, (_x, index) => `<agent-${index}>`); });
        const messages = shapeMessages(r);
        expect(messages.length).toBeLessThanOrEqual(34);
        expect(messages.join('\n')).toMatch(/\d+ more placeholder/);
      });
    });

    describe('bindings.json and report.json', () => {
      it('refuses a bindings.json that is not a plain object, is empty, or holds a placeholder', () => {
        expectShapeFault(shaped('domain', p => { p.bindings = []; }), 'bindings.json', 'must be a JSON object');
        expectShapeFault(shaped('domain', p => { p.bindings = 'text'; }), 'bindings.json', 'must be a JSON object');
        expectShapeFault(shaped('domain', p => { p.bindings = null; }), 'bindings.json', 'must be a JSON object');
        expectShapeFault(shaped('domain', p => { p.bindings = {}; }), 'bindings.json', 'must not be empty');
        expectShapeFault(shaped('domain', p => { p.bindings.edges[0].installed = '<installed-path>'; }), 'bindings.json', '<installed-path>');
        expectShapeFault(shaped('domain', p => { p.bindings['<edge>'] = 1; }), 'bindings.json', '<edge>');
      });

      it('refuses a report.json that is not a plain object, or lacks one of the nine sections', () => {
        expectShapeFault(shaped('domain', p => { p.report = []; }), 'report.json', 'must be a JSON object');
        expectShapeFault(shaped('domain', p => { p.report = 'done'; }), 'report.json', 'must be a JSON object');
        for (const key of REPORT_KEYS) {
          expectShapeFault(shaped('domain', p => { delete p.report[key]; }), 'report.json', `"${key}"`);
        }
        expectShapeFault(shaped('domain', p => { p.report = {}; }), 'report.json', '"job"');
      });

      it('accepts a report with further keys and any content in the nine sections, and does not parse hashes or lengths', () => {
        const r = shaped('domain', p => {
          p.report.extra = { anything: ['goes'] };
          p.report.files = [{ path: 'bundles.json', length: 1, sha256: 'unavailable' }];
          p.report.job = 'text';
        });
        expect(r.status, JSON.stringify(r.findings)).toBe('passed');
      });

      it('accepts a bindings.json of any non-empty object shape', () => {
        const r = shaped('domain', p => { p.bindings = { anything: [1, 2], bundle: 'example-review-domain', agent: 'subagent-code-reviewer.md', skills: 'host-agent-router handoff git-guardrails' }; });
        expect(r.status, JSON.stringify(r.findings)).toBe('passed');
      });
    });

    describe('the known BundleDefinition keys', () => {
      const real = JSON.parse(fs.readFileSync(path.join(REAL_REGISTRY, 'bundles.json'), 'utf8')) as { bundles: Record<string, Json> };

      it('cover every key any bundle of the real registry uses', () => {
        const used = new Set(Object.values(real.bundles).flatMap(bundle => Object.keys(bundle as object)));
        const missing = [...used].filter(key => !KNOWN_BUNDLE_KEYS.includes(key));
        expect(missing).toEqual([]);
      });

      it('are all keys of the BundleDefinition type, with no duplicate', () => {
        expect(new Set(KNOWN_BUNDLE_KEYS).size).toBe(KNOWN_BUNDLE_KEYS.length);
        const typeSource = fs.readFileSync(path.join(REAL_REGISTRY, '..', 'src', 'core', 'types.ts'), 'utf8').replace(/\r\n/g, '\n');
        const block = typeSource.match(/export interface BundleDefinition \{([\s\S]*?)\n\}/)![1]!;
        const declared = [...block.matchAll(/^  ([A-Za-z]+)\??:/gm)].map(match => match[1]!);
        expect([...KNOWN_BUNDLE_KEYS].sort()).toEqual([...declared].sort());
      });

      it('type every optional field of every real bundle correctly (the shape check is not stricter than the registry)', () => {
        for (const [key, bundle] of Object.entries(real.bundles)) {
          expect(bundleDefinitionProblems(key, bundle, false), key).toEqual([]);
        }
      });
    });
  });

  describe('the registry-rules check: the merge, conflicts and the manifest rules', () => {
    /** Rewrites the fixture registry's bundles.json after the fixture was built. */
    function rewriteRegistry(f: Fixture, change: (manifest: Json) => void): void {
      const file = path.join(f.registry, 'bundles.json');
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
      change(manifest);
      fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    const contributor = (extra: Json = {}): Json => ({
      name: 'contrib', version: '1.0.0', description: 'A contributor bundle', category: 'Fixture', domain: 'contributor', tier: 'domain', status: 'under-construction',
      agents: [], skills: ['only-contrib', ...SHARED_SKILLS], workflows: [], ...extra,
    });
    function ruled(change: (bundle: Json, proposal: Proposal) => void, options: { kind?: 'domain' | 'organization'; registry?: (manifest: Json) => void; operation?: string } = {}): BundleCheckResult {
      const proposal = options.kind === 'organization' ? organizationProposal() : domainProposal();
      change(bundleOf(proposal), proposal);
      rebind(proposal);
      const f = build(proposal);
      if (options.registry) rewriteRegistry(f, options.registry);
      return run(f, options.operation ? { operation: options.operation } : {});
    }
    const ruleMessages = (r: BundleCheckResult): string[] => checkOf(r, 'registry-rules').findings.filter(item => item.code === 'REGISTRY_RULE').map(item => item.message);

    it('passes both valid proposals, with nothing replaced', () => {
      for (const proposal of [domainProposal(), organizationProposal()]) {
        const r = run(build(proposal));
        expect(checkOf(r, 'registry-rules')).toEqual({ id: 'registry-rules', status: 'passed', reason: null, findings: [] });
        expect(r.replaces).toEqual([]);
      }
    });

    describe('conflicts with the registry (BUNDLE_CONFLICT)', () => {
      const conflict = (r: BundleCheckResult): string[] => checkOf(r, 'registry-rules').findings.filter(item => item.code === 'BUNDLE_CONFLICT').map(item => item.message);
      const rename = (name: string) => (_bundle: Json, proposal: Proposal): void => {
        const bundle = bundleOf(proposal);
        bundle.name = name;
        proposal.manifest.bundles = { [name]: bundle };
      };

      it('refuses a create proposal whose name is already a bundle of the registry, and does not run the manifest rules on a merge it cannot define', () => {
        const r = ruled(rename('existing-domain'));
        expect(r.status).toBe('failed');
        expect(bundleCheckExitCode(r)).toBe(1);
        expect(conflict(r)).toEqual(['Bundle "existing-domain" is already a bundle of the registry; a create proposal needs a new name (use --operation update to replace it).']);
        expect(checkOf(r, 'registry-rules').status).toBe('failed');
        expect(checkOf(r, 'registry-rules').reason).toContain('conflicts');
        expect(r.replaces).toEqual([]);
      });

      it('refuses a name that is an alias of another bundle, in every operation', () => {
        for (const operation of ['create', 'update', 'reuse']) {
          const r = ruled(rename('existing-alias'), { operation });
          expect(conflict(r), operation).toEqual(['Bundle "existing-alias" is an alias of the registry bundle "existing-domain".']);
          expect(r.status, operation).toBe('failed');
        }
      });

      it('refuses an alias that is another bundle\'s name or another bundle\'s alias, in every operation', () => {
        for (const operation of ['create', 'update', 'reuse']) {
          const byName = ruled((bundle) => { bundle.aliases = ['existing-org']; }, { operation });
          expect(conflict(byName), operation).toEqual(['Alias "existing-org" of bundle "example-review-domain" is the name of the registry bundle "existing-org".']);
          const byAlias = ruled((bundle) => { bundle.aliases = ['old-name']; }, { operation });
          expect(conflict(byAlias), operation).toEqual(['Alias "old-name" of bundle "example-review-domain" is already an alias of the registry bundle "existing-domain".']);
        }
      });

      it('allows an updated bundle to keep its own aliases and its own name', () => {
        const r = ruled(rename('existing-domain'), { operation: 'update' });
        expect(r.status, JSON.stringify(r.findings)).toBe('passed');
        const own = ruled((bundle, proposal) => { rename('existing-domain')(bundle, proposal); bundleOf(proposal).aliases = ['existing-alias', 'old-name']; }, { operation: 'update' });
        expect(own.status, JSON.stringify(own.findings)).toBe('passed');
      });

      it('refuses two proposed bundles that collide with each other', () => {
        const r = ruled((_bundle, proposal) => {
          const first = bundleOf(proposal);
          const second = { ...first, name: 'second-bundle', aliases: ['example-review-domain'] };
          proposal.manifest.bundles = { 'example-review-domain': first, 'second-bundle': second };
        });
        expect(conflict(r)).toEqual(['Alias "example-review-domain" of bundle "second-bundle" is the name of the proposed bundle "example-review-domain".']);
      });
    });

    describe('--operation update and reuse: replaces and additions', () => {
      const renamed = (name: string) => (_bundle: Json, proposal: Proposal): void => {
        const bundle = bundleOf(proposal);
        bundle.name = name;
        proposal.manifest.bundles = { [name]: bundle };
      };

      it.each(['update', 'reuse'])('replaces a bundle the registry has and lists it under replaces (%s)', operation => {
        const r = ruled(renamed('existing-domain'), { operation });
        expect(r.status, JSON.stringify(r.findings)).toBe('passed');
        expect(r.replaces).toEqual(['existing-domain']);
        expect(r.bundleNames).toEqual(['existing-domain']);
        expect(r.operation).toBe(operation);
      });

      it.each(['update', 'reuse'])('adds a bundle the registry does not have, replacing nothing (%s)', operation => {
        const r = ruled(() => undefined, { operation });
        expect(r.status, JSON.stringify(r.findings)).toBe('passed');
        expect(r.replaces).toEqual([]);
      });

      it('runs the manifest rules on the manifest after the replacement', () => {
        const r = ruled((bundle, proposal) => {
          renamed('existing-domain')(bundle, proposal);
          bundleOf(proposal).nativeRoles = { 'other.md': 'role' };
        }, { operation: 'update' });
        expect(ruleMessages(r)).toEqual(['Registry validation error: bundle "existing-domain" nativeRoles key "other.md" is not one of its agents.']);
      });
    });

    describe('the manifest rules of the registry, on the merged manifest (REGISTRY_RULE)', () => {
      it('refuses an invalid hostAvailability', () => {
        const r = ruled(bundle => { bundle.hostAvailability = { claude: { lane: 'legacy', scopes: ['workspace'] } }; });
        expect(ruleMessages(r)).toEqual(['Registry validation error: bundle "example-review-domain" hostAvailability must allow named hosts with lane "native" and nonempty scopes (workspace/global).']);
        expect(r.status).toBe('failed');
        expect(checkOf(r, 'registry-rules').findings[0]!.path).toBe('bundles.json');
        expect(ruled(bundle => { bundle.hostAvailability = 7; }).status).toBe('failed');
      });

      it('accepts a valid hostAvailability', () => {
        const r = ruled(bundle => { bundle.hostAvailability = { claude: { lane: 'native', scopes: ['workspace'] } }; });
        expect(checkOf(r, 'registry-rules').status).toBe('passed');
      });

      it('refuses a rule that is not in the registry and accepts one that is', () => {
        const r = ruled(bundle => { bundle.rules = ['missing-rule.md']; });
        expect(ruleMessages(r)).toEqual(['Registry validation error: bundle "example-review-domain" references rule "missing-rule.md" which does not exist in registry/rules/.']);
        expect(checkOf(ruled(bundle => { bundle.rules = ['skill-attribution.md']; }), 'registry-rules').status).toBe('passed');
      });

      it('refuses an invalid nativeRoles in each way the manifest rules know', () => {
        const messages = (nativeRoles: unknown, agents?: string[]): string[] => ruleMessages(ruled(bundle => { bundle.nativeRoles = nativeRoles; if (agents) bundle.agents = agents; }));
        expect(messages('role')).toEqual(['Registry validation error: bundle "example-review-domain" nativeRoles must be an object mapping an agent file to a native role name.']);
        expect(messages({ 'other.md': 'role' })).toEqual(['Registry validation error: bundle "example-review-domain" nativeRoles key "other.md" is not one of its agents.']);
        expect(messages({ 'subagent-code-reviewer.md': 'Bad Role' })).toEqual(['Registry validation error: bundle "example-review-domain" nativeRoles value "Bad Role" for "subagent-code-reviewer.md" is not a valid role name (lowercase letters, digits and hyphens).']);
        expect(messages({ 'subagent-code-reviewer.md': 'same', 'orchestrator-digital-agency.md': 'same' }, ['subagent-code-reviewer.md', 'orchestrator-digital-agency.md']))
          .toEqual(['Registry validation error: bundle "example-review-domain" maps more than one agent to the native role "same".']);
        expect(messages({ 'subagent-code-reviewer.md': 'marketing-creative-designer' }, ['subagent-code-reviewer.md', 'subagent-marketing-creative-designer.md']))
          .toEqual(['Registry validation error: bundle "example-review-domain" native role "marketing-creative-designer" for "subagent-code-reviewer.md" collides with the default role name of "subagent-marketing-creative-designer.md".']);
        expect(messages({ 'subagent-code-reviewer.md': 'code-reviewer-2' })).toEqual([]);
      });

      it('refuses an unknown planning-loop mode, a budget on a domain bundle, a bad iteration cap, and budget or sidekicks on planner-orchestrator', () => {
        const loop = (planningLoop: unknown, kind: 'domain' | 'organization' = 'domain'): string[] => ruleMessages(ruled(bundle => { bundle.planningLoop = planningLoop; }, { kind }));
        expect(loop({ enabled: true, mode: 'weird' })).toEqual(['Registry validation error: bundle "example-review-domain" has unknown planningLoop.mode "weird". Valid modes: subagent-first, planner-orchestrator']);
        expect(loop({ enabled: true, mode: 'subagent-first', budget: { maxIterations: 3 } })[0]).toContain('declares a Consultation Budget but is not an organization-tier bundle');
        expect(loop({ enabled: true, mode: 'subagent-first', budget: { maxIterations: 0 } }, 'organization')).toEqual(['Registry validation error: bundle "example-cross-functional" has planningLoop.budget.maxIterations 0; expected a positive integer.']);
        expect(loop({ enabled: true, mode: 'planner-orchestrator', budget: { maxIterations: 3 } }, 'organization')[0]).toContain('Planner-orchestrator bundles must not declare budget');
        expect(loop({ enabled: true, mode: 'planner-orchestrator', sidekicks: { max: 2 } })[0]).toContain('Planner-orchestrator bundles must not declare sidekicks');
        expect(loop({ enabled: true, mode: 'planner-orchestrator' })).toEqual([]);
      });

      it('refuses an ordinary bundle that inherits or recommends a contributor bundle or the contributor department', () => {
        const withContributor = (manifest: Json): void => { manifest.bundles.contrib = contributor(); };
        expect(ruleMessages(ruled(bundle => { bundle.parentBundle = 'contrib'; }, { registry: withContributor })))
          .toEqual(['Registry validation error: ordinary bundle "example-review-domain" cannot inherit contributor bundle "contrib".']);
        expect(ruleMessages(ruled(bundle => { bundle.recommendedAddons = ['contrib']; }, { registry: withContributor })))
          .toEqual(['Registry validation error: ordinary bundle "example-review-domain" cannot recommend contributor bundle "contrib".']);
        expect(ruleMessages(ruled(bundle => { bundle.recommendedAddons = ['domain:contributor']; })))
          .toEqual(['Registry validation error: ordinary bundle "example-review-domain" cannot recommend contributor department "domain:contributor".']);
      });

      it('refuses a full that includes a skill only a contributor bundle declares, and a populated agent-factory without hostAvailability', () => {
        const full = ruled((bundle, proposal) => {
          bundle.name = 'full';
          bundle.skills = ['only-contrib', ...SHARED_SKILLS];
          proposal.manifest.bundles = { full: bundle };
        }, { operation: 'update', registry: manifest => { manifest.bundles.contrib = contributor(); } });
        expect(ruleMessages(full)).toEqual(['Registry validation error: full includes contributor-only skills "only-contrib".']);
        const factory = ruled((bundle, proposal) => {
          bundle.name = 'agent-factory';
          proposal.manifest.bundles = { 'agent-factory': bundle };
        });
        expect(ruleMessages(factory)).toEqual(['Registry validation error: populated agent-factory requires hostAvailability for its reviewed delivery.']);
      });

      it('reports every problem of the merged manifest, one finding each, in the order the rules meet them', () => {
        const r = ruled(bundle => {
          bundle.rules = ['missing-rule.md'];
          bundle.nativeRoles = { 'other.md': 'role' };
          bundle.planningLoop = { enabled: true, mode: 'weird' };
        });
        expect(ruleMessages(r)).toEqual([
          'Registry validation error: bundle "example-review-domain" references rule "missing-rule.md" which does not exist in registry/rules/.',
          'Registry validation error: bundle "example-review-domain" nativeRoles key "other.md" is not one of its agents.',
          'Registry validation error: bundle "example-review-domain" has unknown planningLoop.mode "weird". Valid modes: subagent-first, planner-orchestrator',
        ]);
      });
    });
  });

  describe('the references check: members and parents that must exist in the registry', () => {
    function referenced(change: (bundle: Json, proposal: Proposal) => void, options: { kind?: 'domain' | 'organization'; registry?: (registry: string) => void; overrides?: Partial<BundleCheckInput> } = {}): BundleCheckResult {
      const proposal = options.kind === 'organization' ? organizationProposal() : domainProposal();
      change(bundleOf(proposal), proposal);
      rebind(proposal);
      const f = build(proposal);
      options.registry?.(f.registry);
      return run(f, options.overrides ?? {});
    }
    const refMessages = (r: BundleCheckResult): string[] => checkOf(r, 'references').findings.filter(item => item.code === 'REGISTRY_REF').map(item => item.message);
    const name = (r: BundleCheckResult) => r.bundleNames[0]!;

    it('passes both valid proposals with nothing unresolved', () => {
      for (const proposal of [domainProposal(), organizationProposal()]) {
        const r = run(build(proposal));
        expect(checkOf(r, 'references')).toEqual({ id: 'references', status: 'passed', reason: null, findings: [] });
        expect(r.unresolved).toEqual([]);
      }
    });

    it.each<[string, string, 'domain' | 'organization', (bundle: Json) => void, string]>([
      ['orchestrator', 'orchestrator-missing.md', 'organization', bundle => { bundle.orchestrator = 'orchestrator-missing.md'; }, 'agents/orchestrator-missing.md'],
      ['agent', 'subagent-missing.md', 'domain', bundle => { bundle.agents = ['subagent-code-reviewer.md', 'subagent-missing.md']; }, 'agents/subagent-missing.md'],
      ['skill', 'missing-skill', 'domain', bundle => { bundle.skills = [...bundle.skills, 'missing-skill']; }, 'skills/missing-skill/SKILL.md'],
      ['workflow', 'workflow-missing.md', 'domain', bundle => { bundle.workflows = ['workflow-missing.md']; }, 'workflows/workflow-missing.md'],
      ['parentBundle', 'no-such-parent', 'domain', bundle => { bundle.parentBundle = 'no-such-parent'; }, 'merged manifest'],
      ['recommendedAddon', 'no-such-addon', 'domain', bundle => { bundle.recommendedAddons = ['no-such-addon']; }, 'merged manifest'],
    ])('lists a missing %s as REGISTRY_REF and in unresolved, and fails', (kind, missing, tier, change, expectedPath) => {
      const r = referenced(change, { kind: tier });
      expect(r.status, JSON.stringify(r.findings)).toBe('failed');
      expect(bundleCheckExitCode(r)).toBe(1);
      expect(r.unresolved).toEqual([{ bundle: name(r), kind, name: missing }]);
      expect(checkOf(r, 'references').status).toBe('failed');
      expect(refMessages(r)).toHaveLength(1);
      expect(refMessages(r)[0]).toContain(missing);
      expect(refMessages(r)[0]).toContain(expectedPath);
      expect(checkOf(r, 'references').findings[0]).toMatchObject({ code: 'REGISTRY_REF', path: 'bundles.json' });
    });

    it('resolves a workflow file, a bundle of the registry as parent, another proposed bundle and a department as addon', () => {
      const r = referenced((bundle, proposal) => {
        bundle.workflows = ['workflow-x.md'];
        bundle.parentBundle = 'existing-domain';
        bundle.recommendedAddons = ['existing-org', 'domain:engineering', 'second-bundle'];
        proposal.manifest.bundles['second-bundle'] = { ...bundle, name: 'second-bundle', parentBundle: undefined, recommendedAddons: undefined, workflows: [] };
      }, { registry: registry => { fs.mkdirSync(path.join(registry, 'workflows')); fs.writeFileSync(path.join(registry, 'workflows', 'workflow-x.md'), '# workflow\n'); } });
      expect(checkOf(r, 'references').status, JSON.stringify(r.findings)).toBe('passed');
      expect(r.unresolved).toEqual([]);
    });

    it('lists each unresolved reference once, even when it is named twice', () => {
      const r = referenced(bundle => { bundle.agents = ['subagent-code-reviewer.md', 'subagent-missing.md', 'subagent-missing.md']; });
      expect(r.unresolved).toHaveLength(1);
      expect(refMessages(r)).toHaveLength(1);
    });

    describe('--allow-unresolved', () => {
      const unrealizedLeader = (bundle: Json): void => { bundle.orchestrator = 'orchestrator-example-unrealized.md'; };

      it('fails an unrealized leader by default and passes it with the flag, listing it all the same (exit 0)', () => {
        const strict = referenced(unrealizedLeader, { kind: 'organization' });
        expect(strict.status).toBe('failed');
        const lenient = referenced(unrealizedLeader, { kind: 'organization', overrides: { allowUnresolved: true } });
        expect(lenient.status, JSON.stringify(lenient.findings)).toBe('passed');
        expect(bundleCheckExitCode(lenient)).toBe(0);
        expect(lenient.allowUnresolved).toBe(true);
        expect(lenient.unresolved).toEqual([{ bundle: 'example-cross-functional', kind: 'orchestrator', name: 'orchestrator-example-unrealized.md' }]);
        expect(checkOf(lenient, 'references')).toEqual({ id: 'references', status: 'passed', reason: 'unresolved references allowed by --allow-unresolved', findings: [] });
        expect(lenient.findings).toEqual([]);
        expect(lenient.acceptedDraft).toBe(false);
      });

      it('passes without a reason when everything resolves', () => {
        const r = referenced(() => undefined, { overrides: { allowUnresolved: true } });
        expect(checkOf(r, 'references')).toEqual({ id: 'references', status: 'passed', reason: null, findings: [] });
      });

      it('does not excuse an unsafe name', () => {
        const r = referenced(bundle => { bundle.agents = ['../secret.md']; }, { overrides: { allowUnresolved: true } });
        expect(r.status).toBe('failed');
        expect(checkOf(r, 'references').findings.map(item => item.code)).toEqual(['SHAPE']);
      });

      it('does not excuse a failure of another check', () => {
        const r = referenced(bundle => { bundle.hostAvailability = 7; bundle.agents = ['subagent-missing.md']; }, { overrides: { allowUnresolved: true } });
        expect(r.status).toBe('failed');
        expect(checkOf(r, 'registry-rules').status).toBe('failed');
        expect(checkOf(r, 'references').status).toBe('passed');
      });
    });

    describe('names that are not a single safe name are SHAPE findings and never joined to a path', () => {
      it.each([
        ['a name with a forward slash', 'sub/agent.md'],
        ['a name with a backslash', 'sub\\agent.md'],
        ['a parent segment', '..'],
        ['a parent path', '../secret.md'],
        ['a current-folder segment', '.'],
        ['an absolute path', path.join(os.tmpdir(), 'secret.md')],
        ['a drive-relative name', 'C:secret.md'],
        ['a name ending with a dot', 'agent.'],
      ])('refuses %s as an agent', (_label, bad) => {
        const r = referenced(bundle => { bundle.agents = ['subagent-code-reviewer.md', bad]; }, {
          registry: registry => { fs.writeFileSync(path.join(registry, 'secret.md'), '# not an agent\n'); },
        });
        expect(r.status).toBe('failed');
        const found = checkOf(r, 'references').findings;
        expect(found.map(item => item.code)).toEqual(['SHAPE']);
        expect(found[0]!.message).toContain('single');
        expect(r.unresolved).toEqual([]);
      });

      it('refuses a skill, a workflow and an orchestrator written with a separator or ..', () => {
        const skill = referenced(bundle => { bundle.skills = [...bundle.skills, '../agents']; });
        expect(checkOf(skill, 'references').findings.map(item => item.code)).toEqual(['SHAPE']);
        const workflow = referenced(bundle => { bundle.workflows = ['a/b.md']; });
        expect(checkOf(workflow, 'references').findings.map(item => item.code)).toEqual(['SHAPE']);
        const leader = referenced(bundle => { bundle.orchestrator = '..\\x.md'; }, { kind: 'organization' });
        expect(checkOf(leader, 'references').findings.map(item => item.code)).toEqual(['SHAPE']);
      });
    });

    describe('what counts as resolved', () => {
      it('does not resolve an entry that is a folder, or a skill folder without SKILL.md', () => {
        const folder = referenced(() => undefined, { registry: registry => {
          fs.rmSync(path.join(registry, 'agents', 'subagent-code-reviewer.md'));
          fs.mkdirSync(path.join(registry, 'agents', 'subagent-code-reviewer.md'));
        } });
        expect(folder.unresolved).toEqual([{ bundle: 'example-review-domain', kind: 'agent', name: 'subagent-code-reviewer.md' }]);
        const noSkillFile = referenced(() => undefined, { registry: registry => { fs.rmSync(path.join(registry, 'skills', 'handoff', 'SKILL.md')); } });
        expect(noSkillFile.unresolved).toEqual([{ bundle: 'example-review-domain', kind: 'skill', name: 'handoff' }]);
        const skillAsFile = referenced(() => undefined, { registry: registry => {
          fs.rmSync(path.join(registry, 'skills', 'handoff'), { recursive: true });
          fs.writeFileSync(path.join(registry, 'skills', 'handoff'), 'a file, not a folder');
        } });
        expect(skillAsFile.unresolved).toEqual([{ bundle: 'example-review-domain', kind: 'skill', name: 'handoff' }]);
      });

      it('looks names up exactly, so a name that differs only by letter case does not resolve on any file system', () => {
        const r = referenced(bundle => { bundle.agents = ['Subagent-Code-Reviewer.md']; });
        expect(r.unresolved).toEqual([{ bundle: 'example-review-domain', kind: 'agent', name: 'Subagent-Code-Reviewer.md' }]);
        const skill = referenced(bundle => { bundle.skills = [...bundle.skills.filter((id: string) => id !== 'handoff'), 'Handoff']; });
        expect(skill.unresolved).toContainEqual({ bundle: 'example-review-domain', kind: 'skill', name: 'Handoff' });
      });

      it('does not resolve a referenced file that is a link (skipped when the OS refuses to create one)', ctx => {
        const f = build();
        const agent = path.join(f.registry, 'agents', 'subagent-code-reviewer.md');
        const real = path.join(f.root, 'elsewhere-agent.md');
        fs.renameSync(agent, real);
        if (!makeFileLink(real, agent)) { fs.renameSync(real, agent); return ctx.skip(); }
        const r = run(f);
        expect(r.status).toBe('failed');
        expect(r.unresolved).toEqual([{ bundle: 'example-review-domain', kind: 'agent', name: 'subagent-code-reviewer.md' }]);
        expect(refMessages(r)[0]).toContain('link');
      });

      it('does not resolve anything under a registry folder that is a link or junction (agents/, skills/ and a skill folder)', ctx => {
        const f = build();
        const agentsReal = path.join(f.root, 'agents-real');
        fs.renameSync(path.join(f.registry, 'agents'), agentsReal);
        if (!makeLink(agentsReal, path.join(f.registry, 'agents'))) { fs.renameSync(agentsReal, path.join(f.registry, 'agents')); return ctx.skip(); }
        const viaAgents = run(f);
        expect(viaAgents.unresolved).toEqual([{ bundle: 'example-review-domain', kind: 'agent', name: 'subagent-code-reviewer.md' }]);

        const g = build();
        const handoffReal = path.join(g.root, 'handoff-real');
        fs.renameSync(path.join(g.registry, 'skills', 'handoff'), handoffReal);
        if (!makeLink(handoffReal, path.join(g.registry, 'skills', 'handoff'))) return ctx.skip();
        const viaSkill = run(g);
        expect(viaSkill.unresolved).toEqual([{ bundle: 'example-review-domain', kind: 'skill', name: 'handoff' }]);
        expect(checkOf(viaSkill, 'references').findings[0]!.message).toContain('link');
      });
    });

    describe('the lookup agrees with what RegistryResolver resolves for the real registry', () => {
      it('finds every agent, orchestrator and skill that resolve() returns for each end-user bundle, as a regular file', async () => {
        const resolver = new RegistryResolver(REAL_REGISTRY);
        const probe = new RegistryProbe(REAL_REGISTRY);
        const bundles = (await resolver.listBundles()).filter(bundle => bundle.domain?.toLowerCase() !== 'contributor');
        expect(bundles.length).toBeGreaterThan(20);
        for (const bundle of bundles) {
          const resolved = await resolver.resolve(bundle.name);
          for (const agent of resolved.agents) expect(probe.state(['agents', agent]), `${bundle.name} agent ${agent}`).toMatch(/^file$/);
          for (const skill of resolved.skills) expect(probe.state(['skills', skill, 'SKILL.md']), `${bundle.name} skill ${skill}`).toMatch(/^file$/);
          for (const workflow of resolved.workflows) expect(probe.state(['workflows', workflow]), `${bundle.name} workflow ${workflow}`).toMatch(/^file$/);
        }
      });

      it('shows that the real registry has no shared workflows folder and no bundle declares a workflow', () => {
        expect(fs.existsSync(path.join(REAL_REGISTRY, 'workflows'))).toBe(false);
        const manifest = JSON.parse(fs.readFileSync(path.join(REAL_REGISTRY, 'bundles.json'), 'utf8')) as { bundles: Record<string, { workflows?: string[] }> };
        expect(Object.values(manifest.bundles).flatMap(bundle => bundle.workflows ?? [])).toEqual([]);
      });
    });
  });

  describe('the bundle-rules check: the rules of a proposed Bundle', () => {
    const ruled = (change: (bundle: Json, proposal: Proposal) => void, kind: 'domain' | 'organization' = 'domain', extra: Record<string, string | null> = {}): BundleCheckResult => {
      const proposal = kind === 'organization' ? organizationProposal() : domainProposal();
      change(bundleOf(proposal), proposal);
      return run(build(proposal, extra));
    };
    const ruleMessages = (r: BundleCheckResult): string[] => checkOf(r, 'bundle-rules').findings.filter(item => item.code === 'BUNDLE_RULE').map(item => item.message);

    describe('every rule holds for every end-user bundle of the real registry (contributor bundles and full excepted)', () => {
      const real = JSON.parse(fs.readFileSync(path.join(REAL_REGISTRY, 'bundles.json'), 'utf8')) as { bundles: Record<string, Json> };
      const endUser = Object.entries(real.bundles).filter(([, bundle]) => bundle.domain?.toLowerCase() !== 'contributor' && bundle.name !== 'full');

      it('has end-user bundles of both tiers to hold the rules against', () => {
        expect(endUser.filter(([, bundle]) => bundle.tier === 'domain').length).toBeGreaterThan(20);
        expect(endUser.filter(([, bundle]) => bundle.tier === 'organization').length).toBeGreaterThanOrEqual(2);
      });

      it.each(BUNDLE_RULES.map(rule => [rule.id, rule] as const))('rule %s', (_id, rule) => {
        const checked = endUser.filter(([, bundle]) => rule.applies(bundle));
        expect(checked.length).toBeGreaterThan(0);
        for (const [key, bundle] of checked) expect(rule.problems(key, bundle), `${key} against ${rule.id}`).toEqual([]);
      });

      it('does not hold the rule "an Organization names an orchestrator", so that rule is not implemented', () => {
        const withoutLeader = endUser.filter(([, bundle]) => bundle.tier === 'organization' && !bundle.orchestrator).map(([key]) => key);
        expect(withoutLeader).toEqual(['agency-3d-production']);
        expect(BUNDLE_RULES.map(rule => rule.id)).toEqual(['shared-skills-once', 'domain-is-not-organization', 'domain-planning-posture', 'organization-domain']);
      });
    });

    it('passes both valid proposals', () => {
      for (const proposal of [domainProposal(), organizationProposal()]) {
        const r = run(build(proposal));
        expect(checkOf(r, 'bundle-rules')).toEqual({ id: 'bundle-rules', status: 'passed', reason: null, findings: [] });
      }
    });

    describe('the three shared Skills, exactly once each', () => {
      it.each([...SHARED_SKILLS])('fails BUNDLE_RULE when %s is missing', skill => {
        const r = ruled(bundle => { bundle.skills = bundle.skills.filter((id: string) => id !== skill); });
        expect(r.status).toBe('failed');
        expect(bundleCheckExitCode(r)).toBe(1);
        expect(ruleMessages(r)).toEqual([`Bundle "example-review-domain" must declare the shared Skill "${skill}" exactly once in skills; it declares it 0 times.`]);
        expect(checkOf(r, 'bundle-rules').findings[0]).toMatchObject({ code: 'BUNDLE_RULE', path: 'bundles.json' });
        expect(checkOf(r, 'bundle-rules').status).toBe('failed');
      });

      it.each([...SHARED_SKILLS])('fails BUNDLE_RULE when %s is declared twice', skill => {
        const r = ruled(bundle => { bundle.skills = [...bundle.skills, skill]; });
        expect(ruleMessages(r)).toEqual([`Bundle "example-review-domain" must declare the shared Skill "${skill}" exactly once in skills; it declares it 2 times.`]);
      });

      it('reports each bundle of a proposal on its own', () => {
        const r = ruled((bundle, proposal) => {
          const second = { ...bundle, name: 'second-bundle', skills: ['handoff', 'git-guardrails'] };
          proposal.manifest.bundles['second-bundle'] = second;
        });
        expect(ruleMessages(r)).toEqual(['Bundle "second-bundle" must declare the shared Skill "host-agent-router" exactly once in skills; it declares it 0 times.']);
      });
    });

    describe('the tier rules', () => {
      it('refuses a Domain bundle whose domain is organization, and an Organization bundle whose domain is not', () => {
        expect(ruleMessages(ruled(bundle => { bundle.domain = 'organization'; }))).toEqual(['Bundle "example-review-domain" has tier "domain", so its domain must not be "organization" (that is the Organization tier\'s domain).']);
        expect(ruleMessages(ruled(bundle => { bundle.domain = 'engineering'; }, 'organization'))).toEqual(['Bundle "example-cross-functional" has tier "organization", so its domain must be "organization".']);
      });

      it('refuses a Domain bundle that takes the Organization posture: planning loop enabled with subagent-first, stated or by default', () => {
        const message = 'Bundle "example-review-domain" has tier "domain" but enables a planningLoop with the subagent-first posture; a Domain leader follows the planner-orchestrator posture.';
        expect(ruleMessages(ruled(bundle => { bundle.planningLoop = { enabled: true, mode: 'subagent-first' }; }))).toEqual([message]);
        expect(ruleMessages(ruled(bundle => { bundle.planningLoop = { enabled: true }; }))).toEqual([message]);
        expect(ruleMessages(ruled(bundle => { bundle.planningLoop = { enabled: true, mode: 'planner-orchestrator' }; }))).toEqual([]);
        expect(ruleMessages(ruled(bundle => { bundle.planningLoop = { enabled: false, mode: 'subagent-first' }; }))).toEqual([]);
      });

      it('accepts the Organization posture on an Organization bundle, and does not demand an orchestrator from it', () => {
        const withLoop = ruled(bundle => { bundle.planningLoop = { enabled: true, mode: 'subagent-first', budget: { maxIterations: 20 } }; }, 'organization');
        expect(ruleMessages(withLoop)).toEqual([]);
        const withoutLeader = ruled(bundle => { delete bundle.orchestrator; }, 'organization');
        expect(ruleMessages(withoutLeader)).toEqual([]);
      });
    });

    describe('leader-responsibility.md: present, not empty, no unreplaced placeholder', () => {
      const leaderMessages = (leader: string): string[] => ruleMessages(ruled((_bundle, proposal) => { proposal.leader = leader; }));

      it('refuses an empty file and a file of white space only', () => {
        for (const leader of ['', '\n', ' \t\r\n  \n']) {
          expect(leaderMessages(leader), JSON.stringify(leader)).toEqual(['leader-responsibility.md is empty; it must record the leader responsibility (or its explicit absence).']);
        }
        expect(checkOf(ruled((_bundle, proposal) => { proposal.leader = ''; }), 'bundle-rules').findings[0]!.path).toBe('leader-responsibility.md');
      });

      it('refuses the unfilled template and any backtick span that is a whole <...> placeholder', () => {
        const template = fs.readFileSync(path.join(REAL_REGISTRY, 'skills', 'author-bundle', 'assets', 'leader-responsibility.template.md'), 'utf8');
        const fromTemplate = leaderMessages(template);
        expect(fromTemplate.length).toBeGreaterThan(0);
        expect(fromTemplate.every(message => message.includes('unreplaced template placeholder'))).toBe(true);
        expect(leaderMessages('Bundle: `<name>`.\n')).toEqual(['leader-responsibility.md holds the unreplaced template placeholder `<name>`.']);
        expect(leaderMessages('Leader: ` <identity or none> `.\n')).toEqual(['leader-responsibility.md holds the unreplaced template placeholder `<identity or none>`.']);
      });

      it('accepts text that only resembles a placeholder, and a short compatible leader record', () => {
        expect(leaderMessages('Use `x <name>` or <name> without backticks, or `a < b > c`.\n')).toEqual([]);
        expect(leaderMessages('Existing compatible leader responsibility; no leader, no current prerequisites.\n')).toEqual([]);
        // The three section headings and the naming of the bundle, tier and leader are not rules of this command.
        expect(leaderMessages('No headings. Nothing about the bundle here.\n')).toEqual([]);
      });

      it('lists at most a bounded number of placeholders', () => {
        const messages = leaderMessages(Array.from({ length: 100 }, (_x, index) => `\`<field-${index}>\``).join('\n'));
        expect(messages.length).toBeLessThanOrEqual(34);
        expect(messages.join('\n')).toMatch(/\d+ more placeholder/);
      });
    });

    it('runs even when the registry-rules check fails, and reports both', () => {
      const r = ruled(bundle => { bundle.hostAvailability = 7; bundle.skills = bundle.skills.filter((id: string) => id !== 'handoff'); });
      expect(checkOf(r, 'registry-rules').status).toBe('failed');
      expect(checkOf(r, 'bundle-rules').status).toBe('failed');
    });
  });

  describe('the consistency check: bindings.json names what the manifest declares', () => {
    const bound = (change: (proposal: Proposal) => void, kind: 'domain' | 'organization' = 'domain'): BundleCheckResult => {
      const proposal = kind === 'organization' ? organizationProposal() : domainProposal();
      change(proposal);
      return run(build(proposal));
    };
    const messages = (r: BundleCheckResult): string[] => checkOf(r, 'consistency').findings.filter(item => item.code === 'CONSISTENCY').map(item => item.message);

    it('passes both valid proposals', () => {
      for (const proposal of [domainProposal(), organizationProposal()]) {
        expect(checkOf(run(build(proposal)), 'consistency')).toEqual({ id: 'consistency', status: 'passed', reason: null, findings: [] });
      }
    });

    it('fails CONSISTENCY when bindings.json does not mention the bundle name', () => {
      const r = bound(proposal => { proposal.bindings = { note: 'a record that names nothing', edges: [{ name: 'subagent-code-reviewer.md' }] }; });
      expect(r.status).toBe('failed');
      expect(bundleCheckExitCode(r)).toBe(1);
      expect(messages(r)).toEqual(['bindings.json does not mention the bundle name "example-review-domain" of bundle "example-review-domain".']);
      expect(checkOf(r, 'consistency').findings[0]).toMatchObject({ code: 'CONSISTENCY', path: 'bindings.json' });
    });

    it('fails CONSISTENCY when the orchestrator, an agent or a required MCP name is not mentioned', () => {
      const withoutLeader = bound(proposal => { proposal.bindings = { bundle: 'example-cross-functional', agents: ['subagent-code-reviewer.md', 'subagent-marketing-creative-designer.md'], mcps: ['github'] }; }, 'organization');
      expect(messages(withoutLeader)).toEqual(['bindings.json does not mention the orchestrator "orchestrator-digital-agency.md" of bundle "example-cross-functional".']);
      const withoutAgent = bound(proposal => { proposal.bindings = { bundle: 'example-cross-functional', leader: 'orchestrator-digital-agency.md', agents: ['subagent-code-reviewer.md'], mcps: ['github'] }; }, 'organization');
      expect(messages(withoutAgent)).toEqual(['bindings.json does not mention the agent "subagent-marketing-creative-designer.md" of bundle "example-cross-functional".']);
      const withoutMcp = bound(proposal => { proposal.bindings = { bundle: 'example-cross-functional', leader: 'orchestrator-digital-agency.md', agents: ['subagent-code-reviewer.md', 'subagent-marketing-creative-designer.md'] }; }, 'organization');
      expect(messages(withoutMcp)).toEqual(['bindings.json does not mention the required MCP "github" of bundle "example-cross-functional".']);
    });

    it('matches a name as a substring of any string key or string value, at any depth, and is case-sensitive', () => {
      const ok = bound(proposal => {
        proposal.bindings = { 'example-review-domain': { deep: [[{ installed: '.claude/agents/subagent-code-reviewer.md (proposed)' }]] } };
      });
      expect(messages(ok)).toEqual([]);
      const wrongCase = bound(proposal => { proposal.bindings = { bundle: 'Example-Review-Domain', agent: 'subagent-code-reviewer.md' }; });
      expect(messages(wrongCase)).toHaveLength(1);
      const inNumberOnly = bound(proposal => { proposal.bindings = { bundle: 'example-review-domain', agent: 7 }; });
      expect(messages(inNumberOnly)).toEqual(['bindings.json does not mention the agent "subagent-code-reviewer.md" of bundle "example-review-domain".']);
    });

    it('checks every proposed bundle, and asks nothing about skills, workflows or an absent orchestrator', () => {
      const r = bound(proposal => {
        const first = bundleOf(proposal);
        proposal.manifest.bundles['second-bundle'] = { ...first, name: 'second-bundle', agents: ['subagent-marketing-creative-designer.md'], skills: [...first.skills, 'requesting-code-review'] };
        proposal.bindings = { bundles: ['example-review-domain', 'second-bundle'], agents: ['subagent-code-reviewer.md'] };
      });
      expect(messages(r)).toEqual(['bindings.json does not mention the agent "subagent-marketing-creative-designer.md" of bundle "second-bundle".']);
    });

    it('runs even when another check fails', () => {
      const r = bound(proposal => { bundleOf(proposal).hostAvailability = 7; proposal.bindings = { unrelated: true }; });
      expect(checkOf(r, 'registry-rules').status).toBe('failed');
      expect(checkOf(r, 'consistency').status).toBe('failed');
    });
  });

  describe('the readback: drift between the checks and the end', () => {
    const drifted = (f: Fixture, change: () => void, overrides: Partial<BundleCheckInput> = {}): BundleCheckResult => {
      const calls: number[] = [];
      const r = run(f, { ...overrides, seam: { beforeReadback: () => { calls.push(1); change(); } } });
      expect(calls).toHaveLength(1);
      return r;
    };
    const expectDrift = (r: BundleCheckResult, code: 'CANDIDATE_DRIFT' | 'REGISTRY_DRIFT'): void => {
      expect(r.status).toBe('unavailable');
      expect(bundleCheckExitCode(r)).toBe(2);
      expect(r.findings.map(item => item.code)).toContain(code);
      expect(r.candidateDigest).toBeNull();
      expect(r.registryDigest).toBeNull();
      expect(r.inventoryComplete).toBe(false);
      expect(r.inventory).toEqual([]);
      expect(r.checks.some(check => check.status === 'passed')).toBe(false);
    };

    it('reports CANDIDATE_DRIFT when an authored file changes after the checks, even by one byte of the same size', () => {
      const f = build();
      const file = path.join(f.proposal, 'report.json');
      const original = fs.readFileSync(file);
      const r = drifted(f, () => { const copy = Buffer.from(original); copy[copy.length - 2] = copy[copy.length - 2] === 0x20 ? 0x0a : 0x20; fs.writeFileSync(file, copy); });
      expectDrift(r, 'CANDIDATE_DRIFT');
      expect(r.checks.find(check => check.id === 'shape')!.reason).toContain('proposal changed');
    });

    it('reports CANDIDATE_DRIFT when a file is added or removed, or a preservation-only file changes', () => {
      const added = build();
      expectDrift(drifted(added, () => fs.writeFileSync(path.join(added.proposal, 'late.txt'), 'late')), 'CANDIDATE_DRIFT');
      const removed = build();
      expectDrift(drifted(removed, () => fs.rmSync(path.join(removed.proposal, 'bindings.json'))), 'CANDIDATE_DRIFT');
      const preserved = build(domainProposal(), { 'notes/protected.txt': 'before' });
      expectDrift(drifted(preserved, () => fs.writeFileSync(path.join(preserved.proposal, 'notes', 'protected.txt'), 'AFTER!'), { operation: 'update' }), 'CANDIDATE_DRIFT');
    });

    it('reports no drift when the same bytes are written again, whatever the timestamps say', () => {
      const f = build();
      const file = path.join(f.proposal, 'report.json');
      const same = fs.readFileSync(file);
      const r = drifted(f, () => { fs.writeFileSync(file, same); fs.utimesSync(file, new Date(), new Date(Date.now() + 5000)); });
      expect(r.status).toBe('passed');
      expect(r.candidateDigest).toMatch(/^[0-9a-f]{64}$/);
    });

    it('reports REGISTRY_DRIFT when the registry manifest changes after the checks', () => {
      const f = build();
      const file = path.join(f.registry, 'bundles.json');
      const r = drifted(f, () => {
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as Json;
        manifest.bundles['existing-org'].description = 'Changed while the checks ran.';
        fs.writeFileSync(file, JSON.stringify(manifest));
      });
      expectDrift(r, 'REGISTRY_DRIFT');
      expect(r.findings.map(item => item.code)).not.toContain('CANDIDATE_DRIFT');
    });

    it('reports REGISTRY_DRIFT when a file the proposal names appears, disappears or is replaced by a folder', () => {
      const gone = build();
      expectDrift(drifted(gone, () => fs.rmSync(path.join(gone.registry, 'agents', 'subagent-code-reviewer.md'))), 'REGISTRY_DRIFT');
      const appears = build(organizationProposal());
      const proposal = organizationProposal();
      bundleOf(proposal).orchestrator = 'orchestrator-late.md';
      rebind(proposal);
      writeFiles(appears.proposal, serialize(proposal));
      expectDrift(drifted(appears, () => fs.writeFileSync(path.join(appears.registry, 'agents', 'orchestrator-late.md'), '# late\n'), { allowUnresolved: true }), 'REGISTRY_DRIFT');
      const folder = build();
      expectDrift(drifted(folder, () => {
        fs.rmSync(path.join(folder.registry, 'agents', 'subagent-code-reviewer.md'));
        fs.mkdirSync(path.join(folder.registry, 'agents', 'subagent-code-reviewer.md'));
      }), 'REGISTRY_DRIFT');
    });

    it('reports REGISTRY_DRIFT when a rule file a bundle declares appears or disappears', () => {
      const proposal = domainProposal();
      bundleOf(proposal).rules = ['skill-attribution.md'];
      const f = build(proposal);
      expectDrift(drifted(f, () => fs.rmSync(path.join(f.registry, 'rules', 'skill-attribution.md'))), 'REGISTRY_DRIFT');
    });

    describe('the native workflow rule reads the registry too', () => {
      /** An organization proposal whose first skill has a native Claude workflow, and whose lead is a native role that holds Workflow. */
      const withWorkflowLead = (): { f: Fixture; skill: string; workflow: string; lead: string } => {
        const proposal = organizationProposal();
        const skill = bundleOf(proposal).skills[0] as string;
        const f = build(proposal, {}, registry => {
          fs.mkdirSync(path.join(registry, 'hosts', 'claude', 'workflows'), { recursive: true });
          fs.mkdirSync(path.join(registry, 'hosts', 'claude', 'agents'), { recursive: true });
          fs.writeFileSync(path.join(registry, 'hosts', 'claude', 'workflows', `${skill}.js`), "export const meta = { name: 'demo' }\n");
          fs.writeFileSync(path.join(registry, 'hosts', 'claude', 'agents', 'orchestrator-digital-agency.md'), '---\nname: orchestrator-digital-agency\ndescription: Lead.\ntools: Read, Workflow\n---\nLead.\n');
        });
        return { f, skill, workflow: path.join(f.registry, 'hosts', 'claude', 'workflows', `${skill}.js`), lead: path.join(f.registry, 'hosts', 'claude', 'agents', 'orchestrator-digital-agency.md') };
      };

      it('passes while those files stay as they were', () => {
        const { f } = withWorkflowLead();
        const r = run(f);
        expect(r.status).toBe('passed');
        expect(r.registryDigest).toMatch(/^[0-9a-f]{64}$/);
      });

      it('reports REGISTRY_DRIFT when the lead role file loses the Workflow tool after the checks', () => {
        const { f, lead } = withWorkflowLead();
        expectDrift(drifted(f, () => fs.writeFileSync(lead, '---\nname: orchestrator-digital-agency\ndescription: Lead.\ntools: Read\n---\nLead.\n')), 'REGISTRY_DRIFT');
      });

      it('reports REGISTRY_DRIFT when the native workflow folder gains or loses a workflow after the checks', () => {
        const { f, workflow } = withWorkflowLead();
        expectDrift(drifted(f, () => fs.rmSync(workflow)), 'REGISTRY_DRIFT');
        const added = withWorkflowLead();
        expectDrift(drifted(added.f, () => fs.writeFileSync(path.join(added.f.registry, 'hosts', 'claude', 'workflows', 'late-workflow.js'), "export const meta = {}\n")), 'REGISTRY_DRIFT');
      });

      it('changes the registry digest when the set of native workflows changes between two runs', () => {
        const { f } = withWorkflowLead();
        const before = run(f).registryDigest;
        expect(before).toMatch(/^[0-9a-f]{64}$/);
        expect(run(f).registryDigest).toBe(before);
        fs.writeFileSync(path.join(f.registry, 'hosts', 'claude', 'workflows', 'late-workflow.js'), 'export const meta = {}\n');
        expect(run(f).registryDigest).not.toBe(before);
      });

      it('leaves a lead that does not exist yet to --allow-unresolved, and refuses it otherwise', () => {
        const proposal = organizationProposal();
        const skill = bundleOf(proposal).skills[0] as string;
        bundleOf(proposal).orchestrator = 'orchestrator-late.md';
        rebind(proposal);
        const f = build(proposal, {}, registry => {
          fs.mkdirSync(path.join(registry, 'hosts', 'claude', 'workflows'), { recursive: true });
          fs.writeFileSync(path.join(registry, 'hosts', 'claude', 'workflows', `${skill}.js`), "export const meta = { name: 'demo' }\n");
          fs.mkdirSync(path.join(registry, 'hosts', 'claude', 'agents'), { recursive: true });
          fs.writeFileSync(path.join(registry, 'hosts', 'claude', 'agents', 'orchestrator-digital-agency.md'), '---\nname: orchestrator-digital-agency\ndescription: Lead.\ntools: Read, Workflow\n---\nLead.\n');
        });
        expect(checkOf(run(f), 'registry-rules').status).toBe('failed');
        expect(checkOf(run(f, { allowUnresolved: true }), 'registry-rules').status).toBe('passed');
      });
    });

    it('reports both codes when the proposal and the registry both change', () => {
      const f = build();
      const r = drifted(f, () => {
        fs.writeFileSync(path.join(f.proposal, 'late.txt'), 'late');
        fs.rmSync(path.join(f.registry, 'skills', 'handoff', 'SKILL.md'));
      });
      expect(r.findings.map(item => item.code).sort()).toEqual(['CANDIDATE_DRIFT', 'REGISTRY_DRIFT']);
    });

    it('does not call a change nobody read drift: an unrelated registry file added, or an unnamed agent changed', () => {
      const f = build();
      const r = drifted(f, () => {
        fs.writeFileSync(path.join(f.registry, 'agents', 'unrelated-agent.md'), '# unrelated\n');
        fs.writeFileSync(path.join(f.registry, 'agents', 'subagent-marketing-creative-designer.md'), '# changed, but not named by this proposal\n');
      });
      expect(r.status, JSON.stringify(r.findings)).toBe('passed');
    });

    it('turns an exception thrown by the seam into one unavailable internal-error result, never a pass and never a throw', () => {
      const f = build();
      const error = run(f, { seam: { beforeReadback: () => { throw new Error('boom from a defect'); } } });
      expect(error.status).toBe('unavailable');
      expect(bundleCheckExitCode(error)).toBe(2);
      expect(error.findings.map(item => item.code)).toEqual(['INPUT_UNAVAILABLE']);
      expect(error.findings[0]!.message).toContain('internal error');
      expect(error.findings[0]!.message).toContain('boom from a defect');
      expect(error.candidateDigest).toBeNull();
      const thrown = run(f, { seam: { beforeReadback: () => { throw 'a plain string'; } } });
      expect(thrown.status).toBe('unavailable');
      const huge = run(f, { seam: { beforeReadback: () => { throw new Error('x'.repeat(1_000_000)); } } });
      expect(Buffer.byteLength(JSON.stringify(huge))).toBeLessThan(256 * 1024);
    });
  });

  describe('what every result says, and how it is bounded', () => {
    const constants = { quality: 'pending', live: 'unverified', delivery: 'unverified', provisioning: 'unverified', licensing: 'unverified', acceptedDraft: false };

    it('carries the constants on every outcome: usage, unavailable, failed, passed and drift', () => {
      const f = build();
      const outcomes: BundleCheckResult[] = [
        runBundleCheck({}),
        run(f, { registry: path.join(f.root, 'missing-registry') }),
        run(f, { operation: 'create', allowUnresolved: false, artifact: path.join(f.root, 'missing-proposal') }),
        (() => { const g = build(domainProposal(), { 'extra.txt': 'x' }); return run(g); })(),
        run(build()),
        run(build(), { seam: { beforeReadback: () => { throw new Error('x'); } } }),
      ];
      expect(outcomes.map(r => r.status)).toEqual(['unavailable', 'unavailable', 'unavailable', 'failed', 'passed', 'unavailable']);
      for (const r of outcomes) expect(r).toMatchObject({ version: 1, kind: 'deterministic', ...constants });
    });

    it('does not read a passed result as an acceptance: the constants say what was not checked', () => {
      const r = run(build());
      expect(r.status).toBe('passed');
      expect(r).toMatchObject(constants);
    });

    it('is deterministic: the same inputs give the same JSON, digests included', () => {
      const f = build();
      const first = run(f);
      const second = run(f);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      expect(first.registryDigest).toMatch(/^[0-9a-f]{64}$/);
    });

    it('changes the digests when the proposal or the registry manifest changes', () => {
      const f = build();
      const base = run(f);
      fs.appendFileSync(path.join(f.proposal, 'report.json'), '\n');
      const proposalChanged = run(f);
      expect(proposalChanged.candidateDigest).not.toBe(base.candidateDigest);
      expect(proposalChanged.registryDigest).toBe(base.registryDigest);
      const manifestFile = path.join(f.registry, 'bundles.json');
      fs.appendFileSync(manifestFile, '\n');
      const registryChanged = run(f);
      expect(registryChanged.registryDigest).not.toBe(base.registryDigest);
    });

    it('writes nothing: the proposal and the registry are byte-identical after every kind of run', () => {
      const f = build(domainProposal(), { 'protected-notes.txt': 'note' });
      const before = treeImage(f.root);
      for (const overrides of [{}, { operation: 'update' }, { operation: 'reuse', allowUnresolved: true }, { registry: path.join(f.root, 'nope') }]) run(f, overrides);
      expect(treeImage(f.root)).toEqual(before);
    });

    it('bounds the result: 5000 unresolved references give one small unavailable OUTPUT_LIMIT result', () => {
      const r = runBundleCheck((() => {
        const proposal = domainProposal();
        bundleOf(proposal).agents = Array.from({ length: 5000 }, (_x, index) => `subagent-missing-${index}.md`);
        const f = build(proposal);
        return { artifact: f.proposal, registry: f.registry };
      })());
      expect(r.status).toBe('unavailable');
      expect(bundleCheckExitCode(r)).toBe(2);
      expect(r.findingsComplete).toBe(false);
      expect(r.findings.map(item => item.code)).toContain('OUTPUT_LIMIT');
      expect(Buffer.byteLength(JSON.stringify(r, null, 2))).toBeLessThanOrEqual(256 * 1024);
      expect(r).toMatchObject(constants);
    });

    it('keeps the findings within 256 and says how many are not shown', () => {
      const r = runBundleCheck((() => {
        const proposal = domainProposal();
        bundleOf(proposal).agents = Array.from({ length: 400 }, (_x, index) => `subagent-missing-${index}.md`);
        const f = build(proposal);
        return { artifact: f.proposal, registry: f.registry };
      })());
      expect(r.status).toBe('unavailable');
      expect(r.findingsComplete).toBe(false);
      expect(r.findings.length).toBeLessThanOrEqual(256);
      expect(r.findings.at(-1)).toMatchObject({ code: 'OUTPUT_LIMIT' });
      expect(r.findings.at(-1)!.message).toMatch(/\d+ of \d+ findings are not shown/);
    });

    it('shortens an enormous echoed path in the last-resort result', () => {
      const huge = path.join(os.tmpdir(), 'x'.repeat(300_000));
      const r = runBundleCheck({ artifact: huge, registry: huge });
      expect(r.status).toBe('unavailable');
      expect(Buffer.byteLength(JSON.stringify(r, null, 2))).toBeLessThanOrEqual(256 * 1024);
      expect(r.artifact!.length).toBeLessThanOrEqual(520);
      expect(r.registry!.length).toBeLessThanOrEqual(520);
    });
  });

  describe('against the real registry of this checkout', () => {
    it('passes a valid Domain proposal and a valid Organization proposal built from the Skill examples, and reads the registry only', () => {
      const registryBefore = treeImage(REAL_REGISTRY);
      for (const proposal of [domainProposal(), organizationProposal()]) {
        const f = build(proposal);
        const r = run(f, { registry: REAL_REGISTRY });
        expect(r.status, JSON.stringify(r.findings)).toBe('passed');
        expect(bundleCheckExitCode(r)).toBe(0);
        expect(r.registry).toBe(REAL_REGISTRY);
        expect(r.unresolved).toEqual([]);
        expect(r.replaces).toEqual([]);
        for (const check of r.checks) expect(check.status, check.id).toBe('passed');
      }
      expect(treeImage(REAL_REGISTRY)).toEqual(registryBefore);
    });

    it('conflicts with a name the real registry already has, and replaces it under --operation update', () => {
      const proposal = domainProposal();
      const bundle = bundleOf(proposal);
      bundle.name = 'software-engineering';
      proposal.manifest.bundles = { 'software-engineering': bundle };
      rebind(proposal);
      const create = run(build(proposal), { registry: REAL_REGISTRY });
      expect(create.findings.concat(...create.checks.map(check => check.findings)).map(item => item.code)).toContain('BUNDLE_CONFLICT');
      const update = run(build(proposal), { registry: REAL_REGISTRY, operation: 'update' });
      expect(update.replaces).toEqual(['software-engineering']);
      expect(checkOf(update, 'registry-rules').findings.filter(item => item.code === 'BUNDLE_CONFLICT')).toEqual([]);
    });
  });

  describe('the bounds of the walk', () => {
    it('rejects names that differ only by letter case as PATH_UNSAFE (skipped on a case-insensitive file system, which cannot hold both)', ctx => {
      const f = build();
      const directory = path.join(f.proposal, 'extras');
      fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, 'Notes.txt'), 'upper\n');
      fs.writeFileSync(path.join(directory, 'notes.txt'), 'lower\n');
      if (fs.readdirSync(directory).length !== 2) return ctx.skip();
      const r = run(f, { operation: 'update' });
      expect(r.status).toBe('failed');
      expect(checkOf(r, 'inventory').findings.map(item => item.code)).toEqual(['PATH_UNSAFE']);
    });

    it('stops at 1024 entries with INPUT_LIMIT, without reading the files', () => {
      const many: Record<string, string> = {};
      for (let index = 0; index < 1100; index += 1) many[`baseline/f${String(index).padStart(4, '0')}.txt`] = 'x';
      const r = run(build(domainProposal(), many), { operation: 'update' });
      expect(r.status).toBe('failed');
      expect(checkOf(r, 'inventory').findings.map(item => item.message).join('\n')).toContain('more than 1024 entries');
      expect(r.inventory).toEqual([]);
    });

    it('stops at 128 folders with INPUT_LIMIT in an update proposal', () => {
      const f = build();
      for (let index = 0; index < 130; index += 1) fs.mkdirSync(path.join(f.proposal, `folder-${String(index).padStart(3, '0')}`));
      const r = run(f, { operation: 'update' });
      expect(r.status).toBe('failed');
      expect(checkOf(r, 'inventory').findings.map(item => item.message).join('\n')).toContain('more than 128 folders');
    });

    it('does not follow a folder of preserved files deeper than it must: a deep chain of folders is walked within the bounds', () => {
      const f = build();
      let deep = path.join(f.proposal, 'a');
      for (let level = 0; level < 20; level += 1) { fs.mkdirSync(deep, { recursive: true }); deep = path.join(deep, `d${level}`); }
      fs.mkdirSync(deep, { recursive: true });
      fs.writeFileSync(path.join(deep, 'note.txt'), 'deep note');
      const r = run(f, { operation: 'update' });
      expect(r.status, JSON.stringify(r.findings)).toBe('passed');
      expect(r.preserved).toHaveLength(1);
      expect(r.preserved[0]!.startsWith('a/d0/d1/')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------------------------
  // Fix round (independent review)
  // ---------------------------------------------------------------------------------------------

  describe('review point 1: rules[] resolve as regular files of registry/rules through the same probe', () => {
    function withRules(rules: string[], options: { registry?: (registry: string) => void; overrides?: Partial<BundleCheckInput> } = {}): BundleCheckResult {
      const proposal = domainProposal();
      bundleOf(proposal).rules = rules;
      const f = build(proposal);
      options.registry?.(f.registry);
      return run(f, options.overrides ?? {});
    }
    const unresolvedRules = (r: BundleCheckResult) => r.unresolved.filter(item => item.kind === 'rule');

    it('resolves a rule that is a regular file of registry/rules', () => {
      const r = withRules(['skill-attribution.md']);
      expect(r.status, JSON.stringify(r.findings)).toBe('passed');
      expect(r.unresolved).toEqual([]);
    });

    it('lists a missing rule as unresolved (kind rule) with a REGISTRY_REF finding, next to the loader\'s own REGISTRY_RULE message', () => {
      const r = withRules(['missing-rule.md']);
      expect(r.status).toBe('failed');
      expect(r.unresolved).toEqual([{ bundle: 'example-review-domain', kind: 'rule', name: 'missing-rule.md' }]);
      expect(checkOf(r, 'references').findings).toEqual([expect.objectContaining({ code: 'REGISTRY_REF', path: 'bundles.json' })]);
      expect(checkOf(r, 'references').findings[0]!.message).toContain('rules/missing-rule.md');
      expect(checkOf(r, 'registry-rules').findings.map(item => item.code)).toEqual(['REGISTRY_RULE']);
    });

    it('with --allow-unresolved the references check passes and lists the rule, while the loader\'s message still fails registry-rules', () => {
      const r = withRules(['missing-rule.md'], { overrides: { allowUnresolved: true } });
      expect(checkOf(r, 'references')).toEqual({ id: 'references', status: 'passed', reason: 'unresolved references allowed by --allow-unresolved', findings: [] });
      expect(unresolvedRules(r)).toHaveLength(1);
      expect(checkOf(r, 'registry-rules').status).toBe('failed');
      expect(r.status).toBe('failed');
    });

    it('does not resolve a rule that is a folder, or whose name differs only by letter case', () => {
      const folder = withRules(['a-folder.md'], { registry: registry => { fs.mkdirSync(path.join(registry, 'rules', 'a-folder.md')); } });
      expect(unresolvedRules(folder)).toHaveLength(1);
      const wrongCase = withRules(['Skill-Attribution.md']);
      expect(unresolvedRules(wrongCase)).toEqual([{ bundle: 'example-review-domain', kind: 'rule', name: 'Skill-Attribution.md' }]);
    });

    it('does not resolve a rule file that is a link, nor anything under a rules/ folder that is a link (the loader\'s existsSync would follow both)', ctx => {
      const f = build();
      const real = path.join(f.registry, 'rules', 'skill-attribution.md');
      const link = path.join(f.registry, 'rules', 'linked.md');
      if (!makeFileLink(real, link)) return ctx.skip();
      const proposal = domainProposal();
      bundleOf(proposal).rules = ['linked.md'];
      writeFiles(f.proposal, serialize(proposal));
      const viaFile = run(f);
      expect(checkOf(run(f), 'registry-rules').status).toBe('passed');
      expect(unresolvedRules(viaFile)).toEqual([{ bundle: 'example-review-domain', kind: 'rule', name: 'linked.md' }]);
      expect(checkOf(viaFile, 'references').findings[0]!.message).toContain('link');

      const g = build();
      const rulesReal = path.join(g.root, 'rules-real');
      fs.renameSync(path.join(g.registry, 'rules'), rulesReal);
      if (!makeLink(rulesReal, path.join(g.registry, 'rules'))) return ctx.skip();
      const proposalG = domainProposal();
      bundleOf(proposalG).rules = ['skill-attribution.md'];
      writeFiles(g.proposal, serialize(proposalG));
      const viaFolder = run(g);
      expect(unresolvedRules(viaFolder)).toHaveLength(1);
    });

    it('keeps the shape rule that an entry is one safe name', () => {
      const r = withRules(['../bundles.json']);
      expect(checkOf(r, 'shape').findings.map(item => item.message).join('\n')).toContain('must be a single file name');
    });

    it('covers the rule lookups in the registry digest: a rule file replaced by a folder after the checks is REGISTRY_DRIFT', () => {
      const proposal = domainProposal();
      bundleOf(proposal).rules = ['skill-attribution.md'];
      const f = build(proposal);
      const file = path.join(f.registry, 'rules', 'skill-attribution.md');
      const r = run(f, { seam: { beforeReadback: () => { fs.rmSync(file); fs.mkdirSync(file); } } });
      expect(r.findings.map(item => item.code)).toContain('REGISTRY_DRIFT');
      expect(r.registryDigest).toBeNull();
    });
  });

  describe('review point 2: reads are bounded and never follow a link', () => {
    let scratch: string;
    beforeEach(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'au-p20-read-')); });
    afterEach(() => { fs.rmSync(scratch, { recursive: true, force: true }); });

    it('reads a regular file up to the limit and refuses one byte more', () => {
      const file = path.join(scratch, 'f.bin');
      fs.writeFileSync(file, Buffer.alloc(100, 7));
      expect(readBounded(file, 100)).toEqual({ kind: 'ok', bytes: Buffer.alloc(100, 7) });
      expect(readBounded(file, 99)).toEqual({ kind: 'too-large' });
      fs.writeFileSync(file, Buffer.alloc(0));
      expect(readBounded(file, 10)).toEqual({ kind: 'ok', bytes: Buffer.alloc(0) });
    });

    it('refuses a file that grew past the limit after it was inspected, without reading it whole', () => {
      const file = path.join(scratch, 'grew.bin');
      fs.writeFileSync(file, Buffer.alloc(10));
      const inspected = fs.lstatSync(file);
      fs.writeFileSync(file, Buffer.alloc(5 * 1024 * 1024));
      expect(readBounded(file, 64, inspected)).toEqual({ kind: 'too-large' });
    });

    it('refuses a folder, and a missing file, as not ok', () => {
      expect(readBounded(scratch, 10).kind).not.toBe('ok');
      expect(readBounded(path.join(scratch, 'missing'), 10).kind).toBe('error');
    });

    it('refuses a file that was replaced by a link after it was inspected (skipped when the OS refuses to create a link)', ctx => {
      const file = path.join(scratch, 'was-file.bin');
      const target = path.join(scratch, 'target.bin');
      fs.writeFileSync(file, 'original');
      fs.writeFileSync(target, 'followed!');
      const inspected = fs.lstatSync(file);
      fs.rmSync(file);
      if (!makeFileLink(target, file)) return ctx.skip();
      expect(readBounded(file, 100, inspected).kind).not.toBe('ok');
    });

    it('ends a registry bundles.json that is a link as PATH_UNSAFE and one that is replaced by a link at read time as unavailable (never read through)', ctx => {
      const f = build();
      const manifest = path.join(f.registry, 'bundles.json');
      const moved = path.join(f.root, 'moved.json');
      fs.renameSync(manifest, moved);
      if (!makeFileLink(moved, manifest)) { fs.renameSync(moved, manifest); return ctx.skip(); }
      expect(codes(run(f))).toEqual(['PATH_UNSAFE']);
    });
  });

  describe('review point 3: budget.maxIterations when planning is not enabled', () => {
    const planned = (planningLoop: unknown, kind: 'domain' | 'organization' = 'organization'): BundleCheckResult => {
      const proposal = kind === 'organization' ? organizationProposal() : domainProposal();
      bundleOf(proposal).planningLoop = planningLoop;
      return run(build(proposal));
    };
    const shapeText = (r: BundleCheckResult): string => checkOf(r, 'shape').findings.map(item => item.message).join('\n');

    it.each([['x'], [null], [{}], [0], [1.5], [-2]])('is a SHAPE finding when planning is disabled and maxIterations is %j', value => {
      const r = planned({ enabled: false, budget: { maxIterations: value } });
      expect(r.status).toBe('failed');
      expect(shapeText(r)).toContain('planningLoop.budget.maxIterations must be a positive integer');
    });

    it('is a SHAPE finding when maxIterations is absent and planning is disabled or not stated', () => {
      expect(shapeText(planned({ enabled: false, budget: {} }))).toContain('maxIterations must be a positive integer');
      expect(shapeText(planned({ enabled: 'yes', budget: { maxIterations: 'x' } }))).toContain('maxIterations must be a positive integer');
    });

    it('accepts a positive integer when planning is disabled', () => {
      const r = planned({ enabled: false, budget: { maxIterations: 3 } });
      expect(checkOf(r, 'shape').status, shapeText(r)).toBe('passed');
    });

    it('leaves maxIterations to the manifest rule when planning is enabled, and reports it once', () => {
      const r = planned({ enabled: true, mode: 'subagent-first', budget: { maxIterations: 'x' } });
      expect(checkOf(r, 'shape').status).toBe('passed');
      expect(checkOf(r, 'registry-rules').findings.map(item => item.message)).toEqual(['Registry validation error: bundle "example-cross-functional" has planningLoop.budget.maxIterations x; expected a positive integer.']);
      const all = r.findings.map(item => item.message).filter(message => message.includes('maxIterations'));
      expect(all).toHaveLength(1);
    });
  });

  describe('review point 4: an empty --operation is a usage error', () => {
    it('refuses operation "" as USAGE (exit 2), not as create', () => {
      const f = build();
      const r = run(f, { operation: '' });
      expect(r.status).toBe('unavailable');
      expect(bundleCheckExitCode(r)).toBe(2);
      expect(r.findings.map(item => item.message)).toEqual(['--operation must be one of create, update, reuse; got "".']);
      expect(r.operation).toBe('');
    });
  });

  describe('review point 5: bindings.json names are matched as whole tokens', () => {
    const bound = (bindings: unknown, kind: 'domain' | 'organization' = 'domain', change?: (bundle: Json) => void): string[] => {
      const proposal = kind === 'organization' ? organizationProposal() : domainProposal();
      change?.(bundleOf(proposal));
      proposal.bindings = bindings;
      return checkOf(run(build(proposal)), 'consistency').findings.map(item => item.message);
    };

    it('does not accept a name inside a longer word or identifier', () => {
      expect(bound({ a: 'example-review-domain-v2', b: 'subagent-code-reviewer.md' })).toHaveLength(1);
      expect(bound({ a: 'my_example-review-domain', b: 'subagent-code-reviewer.md' })).toHaveLength(1);
      expect(bound({ a: 'example-review-domain', b: 'x-subagent-code-reviewer.md' })).toHaveLength(1);
      expect(bound({ a: 'example-review-domain', b: 'subagent-code-reviewer.md2' })).toHaveLength(1);
      expect(bound({ a: 'example-review-domain', b: 'subagent-code-reviewer.md' }, 'domain', bundle => { bundle.agents = ['ops.md', 'subagent-code-reviewer.md']; })).toEqual(['bindings.json does not mention the agent "ops.md" of bundle "example-review-domain".']);
      expect(bound({ a: 'example-cross-functional', b: 'orchestrator-digital-agency.md', c: ['subagent-code-reviewer.md', 'subagent-marketing-creative-designer.md'], d: 'git-guardrails' }, 'organization', bundle => { bundle.prerequisites.requiredMcps = [{ name: 'git' }]; }))
        .toEqual(['bindings.json does not mention the required MCP "git" of bundle "example-cross-functional".']);
    });

    it('accepts a name inside a path, a sentence or punctuation, and a key', () => {
      expect(bound({ a: 'registry/agents/subagent-code-reviewer.md (proposed)', 'example-review-domain': 1 })).toEqual([]);
      expect(bound({ a: 'bundle "example-review-domain", agent: subagent-code-reviewer.md.' })).toEqual([]);
      expect(bound({ a: 'example-review-domain', b: 'C:\\x\\subagent-code-reviewer.md' })).toEqual([]);
      expect(bound({ a: 'example-review-domain', b: 'subagent-code-reviewer.md' }, 'domain', () => undefined)).toEqual([]);
    });

    it('finds a whole-token occurrence that follows a partial one in the same string', () => {
      expect(bound({ a: 'example-review-domain-v2 and example-review-domain', b: 'subagent-code-reviewer.md' })).toEqual([]);
    });
  });

  describe('review point 6: placeholders in code spans of any backtick length', () => {
    it('finds a placeholder in a double or triple backtick span, and still ignores text that only resembles one', () => {
      expect(leaderResponsibilityProblems('Bundle: ``<name>``.\n')).toEqual(['leader-responsibility.md holds the unreplaced template placeholder `<name>`.']);
      expect(leaderResponsibilityProblems('Bundle: ```<name>```.\n')).toHaveLength(1);
      expect(leaderResponsibilityProblems('Bundle: ``  <name>  ``.\n')).toHaveLength(1);
      expect(leaderResponsibilityProblems('Bundle: `<name>` and ``<tier>``.\n')).toHaveLength(2);
      expect(leaderResponsibilityProblems('Bundle: ``x<name>``, `` `<name>` ``, ``a`b<name>``.\n')).toEqual([]);
      expect(leaderResponsibilityProblems('An unmatched ``<name> opener and `<name>`.\n')).toHaveLength(1);
      expect(leaderResponsibilityProblems('Unmatched `<name> only.\n')).toEqual([]);
    });

    it('is reported through the check', () => {
      const proposal = domainProposal();
      proposal.leader = `${proposal.leader}\nLeader: \`\`<identity or none>\`\`\n`;
      const r = run(build(proposal));
      expect(checkOf(r, 'bundle-rules').findings.map(item => item.message)).toEqual(['leader-responsibility.md holds the unreplaced template placeholder `<identity or none>`.']);
    });
  });

  describe('review point 8: parentBundle and recommendedAddons resolve by key or alias, as the loader does', () => {
    const named = (change: (bundle: Json) => void): BundleCheckResult => {
      const proposal = domainProposal();
      change(bundleOf(proposal));
      rebind(proposal);
      return run(build(proposal));
    };

    it('resolves an alias of a registry bundle', () => {
      const r = named(bundle => { bundle.parentBundle = 'existing-alias'; bundle.recommendedAddons = ['old-name']; });
      expect(checkOf(r, 'references'), JSON.stringify(r.findings)).toEqual({ id: 'references', status: 'passed', reason: null, findings: [] });
      expect(r.unresolved).toEqual([]);
    });

    it('resolves an alias of another proposed bundle and the proposed bundle\'s own alias', () => {
      const proposal = domainProposal();
      const first = bundleOf(proposal);
      first.recommendedAddons = ['second-alias'];
      proposal.manifest.bundles['second-bundle'] = { ...first, name: 'second-bundle', recommendedAddons: undefined, aliases: ['second-alias'] };
      rebind(proposal);
      expect(run(build(proposal)).unresolved).toEqual([]);
    });

    it('does not resolve prototype names or an unknown name', () => {
      for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'no-such-alias']) {
        const r = named(bundle => { bundle.parentBundle = name; });
        expect(r.unresolved, name).toEqual([{ bundle: 'example-review-domain', kind: 'parentBundle', name }]);
      }
    });
  });

  describe('review point 9: the inventory result is kept when the registry is rejected too', () => {
    it('reports inventory as failed with its findings, and the other five as not-run, when both folders are rejected', ctx => {
      const f = build();
      const proposalLink = path.join(f.root, 'linked-proposal');
      const registryLink = path.join(f.root, 'linked-registry');
      if (!makeLink(f.proposal, proposalLink) || !makeLink(f.registry, registryLink)) return ctx.skip();
      const r = run(f, { artifact: proposalLink, registry: registryLink });
      expect(r.status).toBe('failed');
      expect(bundleCheckExitCode(r)).toBe(1);
      expect(statuses(r)).toEqual(['inventory:failed', ...CHECK_IDS.slice(1).map(id => `${id}:not-run`)]);
      expect(checkOf(r, 'inventory').findings).toEqual([expect.objectContaining({ code: 'PATH_UNSAFE' })]);
      expect(r.findings.filter(item => item.code === 'PATH_UNSAFE')).toHaveLength(2);
    });

    it('keeps all six not-run when only the registry is rejected', ctx => {
      const f = build();
      const registryLink = path.join(f.root, 'linked-registry');
      if (!makeLink(f.registry, registryLink)) return ctx.skip();
      expect(statuses(run(f, { registry: registryLink }))).toEqual(CHECK_IDS.map(id => `${id}:not-run`));
    });
  });

  describe('review point 10: further cases', () => {
    const shaped = (change: (bundle: Json) => void, kind: 'domain' | 'organization' = 'domain'): BundleCheckResult => {
      const proposal = kind === 'organization' ? organizationProposal() : domainProposal();
      change(bundleOf(proposal));
      return run(build(proposal));
    };
    const shapeText = (r: BundleCheckResult): string => checkOf(r, 'shape').findings.map(item => item.message).join('\n');

    it('(a) reports two proposed bundles that share an alias once, and an alias that is the other\'s name', () => {
      const two = (changeSecond: (second: Json) => void, changeFirst: (first: Json) => void = () => undefined): BundleCheckResult => {
        const proposal = domainProposal();
        const first = bundleOf(proposal);
        const second = { ...first, name: 'second-bundle' };
        changeFirst(first);
        changeSecond(second);
        proposal.manifest.bundles['second-bundle'] = second;
        return run(build(proposal));
      };
      const conflicts = (r: BundleCheckResult): string[] => checkOf(r, 'registry-rules').findings.filter(item => item.code === 'BUNDLE_CONFLICT').map(item => item.message);
      expect(conflicts(two(second => { second.aliases = ['shared']; }, first => { first.aliases = ['shared']; })))
        .toEqual(['Alias "shared" of bundle "example-review-domain" is already an alias of the proposed bundle "second-bundle".']);
      expect(conflicts(two(second => { second.aliases = ['example-review-domain']; })))
        .toEqual(['Alias "example-review-domain" of bundle "second-bundle" is the name of the proposed bundle "example-review-domain".']);
      expect(conflicts(two(() => undefined, first => { first.aliases = ['second-bundle']; })))
        .toEqual(['Alias "second-bundle" of bundle "example-review-domain" is the name of the proposed bundle "second-bundle".']);
    });

    it('(b) refuses a non-object or wrong-typed planningLoop.budget, sidekicks, modes and personaAliases', () => {
      const cases: Array<[string, (bundle: Json) => void, string]> = [
        ['budget a string', bundle => { bundle.planningLoop = { enabled: true, mode: 'subagent-first', budget: 'x' }; }, 'planningLoop.budget must be an object'],
        ['budget an array', bundle => { bundle.planningLoop = { enabled: true, mode: 'subagent-first', budget: [] }; }, 'planningLoop.budget must be an object'],
        ['budget with a text round count', bundle => { bundle.planningLoop = { enabled: true, mode: 'subagent-first', budget: { maxIterations: 3, maxPlanningRounds: 'two' } }; }, 'planningLoop.budget.maxPlanningRounds must be a number'],
        ['sidekicks a number', bundle => { bundle.planningLoop = { enabled: true, mode: 'subagent-first', sidekicks: 5 }; }, 'planningLoop.sidekicks must be an object'],
        ['sidekicks max a string', bundle => { bundle.planningLoop = { enabled: true, mode: 'subagent-first', sidekicks: { max: 'five' } }; }, 'planningLoop.sidekicks.max must be a number'],
        ['planningLoop a string', bundle => { bundle.planningLoop = 'on'; }, 'planningLoop must be an object'],
        ['modes a string', bundle => { bundle.modes = 'x'; }, 'modes must be an object'],
        ['modes an array', bundle => { bundle.modes = []; }, 'modes must be an object'],
        ['personaAliases a string', bundle => { bundle.personaAliases = 'x'; }, 'personaAliases must be an object'],
        ['personaAliases an array', bundle => { bundle.personaAliases = ['x']; }, 'personaAliases must be an object'],
      ];
      for (const [label, change, fragment] of cases) {
        const r = shaped(change, 'organization');
        expect(r.status, label).toBe('failed');
        expect(shapeText(r), label).toContain(fragment);
      }
    });

    it('(c) refuses reference names that are Windows reserved device names, end in a dot or a space, or hold a control character, in every member kind', () => {
      const bad = ['con.md', 'NUL', 'aux.txt', 'COM1.md', 'lpt9', 'agent.md.', 'agent.md ', 'a\u0001b.md', 'a\u007fb.md', 'a|b.md', 'a:b.md'];
      for (const name of bad) {
        const agent = shaped(bundle => { bundle.agents = ['subagent-code-reviewer.md', name]; });
        expect(checkOf(agent, 'references').findings.map(item => item.code), JSON.stringify(name)).toEqual(['SHAPE']);
        expect(agent.unresolved, JSON.stringify(name)).toEqual([]);
      }
      for (const name of ['con', 'skill.', 'a\u0002b']) {
        expect(checkOf(shaped(bundle => { bundle.skills = [...bundle.skills, name]; }), 'references').findings.map(item => item.code), name).toEqual(['SHAPE']);
        expect(checkOf(shaped(bundle => { bundle.workflows = [name]; }), 'references').findings.map(item => item.code), name).toEqual(['SHAPE']);
        expect(checkOf(shaped(bundle => { bundle.orchestrator = name; }, 'organization'), 'references').findings.map(item => item.code), name).toEqual(['SHAPE']);
      }
    });

    it('(e) survives a bindings.json nested thousands of levels deep: a normal result with exit code 0, 1 or 2', () => {
      const depth = 100_000;
      const nested = `{"bundle":"example-review-domain","agent":"subagent-code-reviewer.md","deep":${'['.repeat(depth)}${']'.repeat(depth)}}`;
      expect(Buffer.byteLength(nested)).toBeLessThan(256 * 1024);
      const f = build(domainProposal(), { 'bindings.json': nested });
      const r = run(f);
      expect([0, 1, 2]).toContain(bundleCheckExitCode(r));
      expect(['passed', 'failed', 'unavailable']).toContain(r.status);
      expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThan(256 * 1024);
      expect(r).toMatchObject({ version: 1, kind: 'deterministic', quality: 'pending', acceptedDraft: false });
      if (r.status === 'unavailable') expect(r.findings.map(item => item.message).join('\n')).not.toContain('internal error');
      // The same depth in the nested value of report.json (which is not walked) and in a string-heavy shape.
      const deepReport = `{${REPORT_KEYS.map(key => `"${key}":1`).join(',')},"extra":${'['.repeat(depth)}${']'.repeat(depth)}}`;
      const g = build(domainProposal(), { 'report.json': deepReport });
      expect([0, 1, 2]).toContain(bundleCheckExitCode(run(g)));
    });
  });
});
