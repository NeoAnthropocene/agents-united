import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type Fixture, type Proposal, REAL_REGISTRY, digest, domainProposal, makeFileLink, makeFixture, makeLink, organizationProposal, rebind, serialize, treeImage, writeFiles,
} from './helpers/bundle-proposal.js';

const CHECK_IDS = ['inventory', 'shape', 'registry-rules', 'references', 'bundle-rules', 'consistency'];
const checkout = process.cwd();
const cli = path.resolve(checkout, 'dist/cli.js');

interface Finding { code: string; path: string | null; message: string }
interface Check { id: string; status: string; reason: string | null; findings: Finding[] }
interface BundleCheckJson {
  version: number; kind: string; status: string; operation: string | null; allowUnresolved: boolean; artifact: string | null; registry: string | null;
  bundleNames: string[]; candidateDigest: string | null; registryDigest: string | null; inventoryComplete: boolean; findingsComplete: boolean;
  inventory: Array<{ path: string; kind: string; bytes: number; sha256: string }>; preserved: string[]; replaces: string[];
  unresolved: Array<{ bundle: string; kind: string; name: string }>; checks: Check[]; findings: Finding[];
  quality: string; live: string; delivery: string; provisioning: string; licensing: string; acceptedDraft: boolean;
}

describe('bundle-check through the real built public CLI', () => {
  /** Every temp folder a test creates is tracked and removed afterwards, however many fixtures one test builds. */
  const fixtures: Fixture[] = [];
  afterEach(() => { for (const made of fixtures.splice(0)) fs.rmSync(made.root, { recursive: true, force: true }); });

  function build(proposal: Proposal = domainProposal(), extra: Record<string, string | null> = {}): Fixture {
    const made = makeFixture('au-p20-cli-');
    fixtures.push(made);
    writeFiles(made.proposal, { ...serialize(proposal), ...extra });
    return made;
  }

  /** Runs the real CLI and proves the proposal, the registry, the working directory and dist/cli.js are byte-identical afterwards. */
  function run(f: Fixture, argv: string[]): { status: number | null; stdout: string; stderr: string; json: BundleCheckJson } {
    const before = treeImage(f.root), cliBefore = digest(fs.readFileSync(cli));
    const actual = spawnSync(process.execPath, [cli, 'bundle-check', ...argv], { cwd: f.unrelated, encoding: 'utf8', timeout: 20_000 });
    expect(actual.error).toBeUndefined();
    // Nothing is written to stderr for any normal outcome: the JSON result on stdout is the whole report.
    expect(actual.stderr).toBe('');
    expect(treeImage(f.root)).toEqual(before);
    expect(digest(fs.readFileSync(cli))).toBe(cliBefore);
    let json: BundleCheckJson | undefined;
    try { json = JSON.parse(actual.stdout) as BundleCheckJson; } catch { /* asserted by callers that need a result */ }
    return { status: actual.status, stdout: actual.stdout, stderr: actual.stderr, json: json as BundleCheckJson };
  }
  const full = (f: Fixture, overrides: Partial<Record<'artifact' | 'registry', string>> = {}): string[] =>
    ['--artifact', overrides.artifact ?? f.proposal, '--registry', overrides.registry ?? f.registry];
  /** The distinct finding codes; the top-level list repeats the findings of the checks. */
  const codes = (json: BundleCheckJson): string[] => [...new Set([...json.findings.map(f => f.code), ...json.checks.flatMap(c => c.findings.map(f => f.code))])];

  it('accepts a valid Domain proposal against the fixture registry, exit 0, and changes no byte', () => {
    const f = build();
    const r = run(f, full(f));
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.json).toMatchObject({
      version: 1, kind: 'deterministic', status: 'passed', operation: 'create', allowUnresolved: false, artifact: f.proposal, registry: f.registry,
      bundleNames: ['example-review-domain'], inventoryComplete: true, findingsComplete: true, preserved: [], replaces: [], unresolved: [],
      quality: 'pending', live: 'unverified', delivery: 'unverified', provisioning: 'unverified', licensing: 'unverified', acceptedDraft: false,
    });
    expect(r.json.candidateDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(r.json.registryDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(r.json.checks.map(c => c.id)).toEqual(CHECK_IDS);
    for (const check of r.json.checks) expect(check.status, check.id).toBe('passed');
    expect(r.json.findings).toEqual([]);
  });

  // -------------------------------------------------------------------------------------------
  // Usage (exit 2, always a JSON result)
  // -------------------------------------------------------------------------------------------

  const usageMessages = (json: BundleCheckJson): string[] => json.findings.filter(item => item.code === 'USAGE').map(item => item.message);

  it('routes an unknown option through the JSON exit-2 USAGE result', () => {
    const f = build();
    const r = run(f, [...full(f), '--bogus', 'value']);
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(r.json, r.stdout).toBeDefined();
    expect(r.json).toMatchObject({ version: 1, kind: 'deterministic', status: 'unavailable', quality: 'pending', live: 'unverified', delivery: 'unverified', provisioning: 'unverified', licensing: 'unverified', acceptedDraft: false });
    expect(usageMessages(r.json)).toEqual(['Unknown option --bogus.']);
    for (const check of r.json.checks) expect(check.status).toBe('not-run');
  });

  for (const missing of ['--artifact', '--registry']) {
    it(`routes a missing ${missing} through the JSON exit-2 USAGE result`, () => {
      const f = build();
      const argv = full(f);
      argv.splice(argv.indexOf(missing), 2);
      const r = run(f, argv);
      expect(r.status, r.stdout + r.stderr).toBe(2);
      expect(r.json, r.stdout).toBeDefined();
      expect(r.json).toMatchObject({ version: 1, kind: 'deterministic', status: 'unavailable' });
      expect(usageMessages(r.json)).toEqual([`${missing} <absolute-${missing === '--artifact' ? 'proposal' : 'registry'}-folder> is required.`]);
    });
  }

  it('reports an empty --artifact= and a flag-only --artifact as needing one value, as skill-check does', () => {
    const f = build();
    const empty = run(f, ['--artifact=', '--registry', f.registry]);
    expect(empty.status).toBe(2);
    expect(usageMessages(empty.json)).toEqual(['--artifact needs exactly one text value.']);
    const flagOnly = run(f, ['--artifact', '--registry', f.registry]);
    expect(flagOnly.status).toBe(2);
    expect(usageMessages(flagOnly.json)).toContain('--artifact needs exactly one text value.');
  });

  it('reports a duplicated --registry as needing exactly one value', () => {
    const f = build();
    const r = run(f, [...full(f), '--registry', f.registry]);
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(usageMessages(r.json)).toEqual(['--registry needs exactly one text value.']);
  });

  it('reports a positional argument and arguments after -- as USAGE', () => {
    const f = build();
    const positional = run(f, [...full(f), 'stray']);
    expect(positional.status, positional.stdout + positional.stderr).toBe(2);
    expect(usageMessages(positional.json)).toEqual(['Unexpected argument "stray"; use --artifact, --registry, --operation and --allow-unresolved.']);
    const after = run(f, [...full(f), '--', 'more']);
    expect(after.status, after.stdout + after.stderr).toBe(2);
    expect(usageMessages(after.json).length).toBeGreaterThan(0);
  });

  it('reports relative paths and . or .. segments as USAGE, without reading the disk', () => {
    const f = build();
    const relative = run(f, ['--artifact', 'draft/bundle-proposal', '--registry', 'registry']);
    expect(relative.status, relative.stdout + relative.stderr).toBe(2);
    expect(usageMessages(relative.json)).toEqual(['--artifact must be an absolute path.', '--registry must be an absolute path.']);
    const dotted = run(f, ['--artifact', `${f.proposal}${path.sep}..${path.sep}${path.basename(f.proposal)}`, '--registry', `${f.registry}${path.sep}.`]);
    expect(dotted.status, dotted.stdout + dotted.stderr).toBe(2);
    expect(usageMessages(dotted.json)).toEqual(['--artifact must be an absolute path without . or .. segments.', '--registry must be an absolute path without . or .. segments.']);
  });

  it('reports an unsupported --operation as USAGE and a flag-only --operation as needing one value', () => {
    const f = build();
    const bogus = run(f, [...full(f), '--operation', 'bogus']);
    expect(bogus.status, bogus.stdout + bogus.stderr).toBe(2);
    expect(bogus.json.operation).toBe('bogus');
    expect(usageMessages(bogus.json)).toEqual(['--operation must be one of create, update, reuse; got "bogus".']);
    const flagOnly = run(f, ['--operation', ...full(f)]);
    expect(flagOnly.status, flagOnly.stdout + flagOnly.stderr).toBe(2);
    expect(usageMessages(flagOnly.json)).toContain('--operation needs exactly one text value.');
  });

  it('accepts --allow-unresolved only as a flag without a value', () => {
    const f = build();
    const withValue = run(f, [...full(f), '--allow-unresolved=yes']);
    expect(withValue.status, withValue.stdout + withValue.stderr).toBe(2);
    expect(usageMessages(withValue.json)).toEqual(['--allow-unresolved is a flag and takes no value.']);
    const negated = run(f, [...full(f), '--no-allow-unresolved']);
    expect(negated.status, negated.stdout + negated.stderr).toBe(2);
    expect(usageMessages(negated.json).length).toBeGreaterThan(0);
  });

  it('prints conventional help for --help alone, exits 0 and makes no validation claim', () => {
    const f = build();
    const r = run(f, ['--help']);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain('bundle-check');
    expect(r.stdout).toContain('--allow-unresolved');
    expect(r.json).toBeUndefined();
    expect(r.stdout).not.toContain('"candidateDigest"');
    expect(r.stdout).not.toContain('"acceptedDraft"');
  });

  // -------------------------------------------------------------------------------------------
  // Outcomes
  // -------------------------------------------------------------------------------------------

  it('accepts a valid Organization proposal with exit 0', () => {
    const f = build(organizationProposal());
    const r = run(f, full(f));
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.json).toMatchObject({ status: 'passed', bundleNames: ['example-cross-functional'], unresolved: [], replaces: [] });
    for (const check of r.json.checks) expect(check.status, check.id).toBe('passed');
  });

  it('fails a proposal with a missing file as INVENTORY with exit 1, naming no digest', () => {
    const f = build(domainProposal(), { 'report.json': null });
    const r = run(f, full(f));
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.json).toMatchObject({ status: 'failed', candidateDigest: null, inventoryComplete: false, quality: 'pending', acceptedDraft: false });
    expect(codes(r.json)).toEqual(['INVENTORY']);
    expect(r.json.checks.map(c => c.status)).toEqual(['failed', 'not-run', 'not-run', 'not-run', 'not-run', 'not-run']);
  });

  it('fails one fault in each of the checks with exit 1 and the right code', () => {
    const faults: Array<[string, Proposal, Record<string, string | null>, string]> = [];
    const shape = domainProposal(); delete (shape.manifest.bundles['example-review-domain'] as Record<string, unknown>).category;
    faults.push(['shape', shape, {}, 'SHAPE']);
    const conflict = domainProposal(); conflict.manifest.bundles['example-review-domain'].aliases = ['existing-org'];
    faults.push(['registry-rules', conflict, {}, 'BUNDLE_CONFLICT']);
    const rule = domainProposal(); rule.manifest.bundles['example-review-domain'].rules = ['missing-rule.md'];
    faults.push(['registry-rules', rule, {}, 'REGISTRY_RULE']);
    const reference = domainProposal(); reference.manifest.bundles['example-review-domain'].agents = ['subagent-missing.md'];
    faults.push(['references', reference, {}, 'REGISTRY_REF']);
    const shared = domainProposal(); shared.manifest.bundles['example-review-domain'].skills = ['handoff', 'git-guardrails'];
    faults.push(['bundle-rules', shared, {}, 'BUNDLE_RULE']);
    faults.push(['bundle-rules', domainProposal(), { 'leader-responsibility.md': '\n' }, 'BUNDLE_RULE']);
    const unbound = domainProposal(); unbound.bindings = { nothing: true };
    faults.push(['consistency', unbound, {}, 'CONSISTENCY']);
    for (const [check, proposal, extra, code] of faults) {
      const f = build(proposal, extra);
      const r = run(f, full(f));
      expect(r.status, `${check} ${code}: ${r.stdout}`).toBe(1);
      expect(r.json.status).toBe('failed');
      expect(r.json.checks.find(c => c.id === check)!.findings.map(item => item.code), `${check} ${code}`).toContain(code);
    }
  });

  it('lists an unrealized leader as unresolved: exit 1 by default, exit 0 with --allow-unresolved', () => {
    const proposal = organizationProposal();
    proposal.manifest.bundles['example-cross-functional'].orchestrator = 'orchestrator-example-unrealized.md';
    rebind(proposal);
    const f = build(proposal);
    const strict = run(f, full(f));
    expect(strict.status, strict.stdout + strict.stderr).toBe(1);
    expect(strict.json.unresolved).toEqual([{ bundle: 'example-cross-functional', kind: 'orchestrator', name: 'orchestrator-example-unrealized.md' }]);
    expect(codes(strict.json)).toEqual(['REGISTRY_REF']);
    const lenient = run(f, [...full(f), '--allow-unresolved']);
    expect(lenient.status, lenient.stdout + lenient.stderr).toBe(0);
    expect(lenient.json).toMatchObject({ status: 'passed', allowUnresolved: true, findings: [] });
    expect(lenient.json.unresolved).toEqual(strict.json.unresolved);
    expect(lenient.json.checks.find(c => c.id === 'references')).toMatchObject({ status: 'passed', reason: 'unresolved references allowed by --allow-unresolved', findings: [] });
  });

  it('accepts --operation update with a preserved note and a replaced registry bundle, and lists both', () => {
    const proposal = domainProposal();
    const bundle = proposal.manifest.bundles['example-review-domain'];
    bundle.name = 'existing-domain';
    proposal.manifest.bundles = { 'existing-domain': bundle };
    rebind(proposal);
    const note = 'Owner: unknown\nDo not change this note.\n';
    const f = build(proposal, { 'protected-notes.txt': note });
    const update = run(f, [...full(f), '--operation', 'update']);
    expect(update.status, update.stdout + update.stderr).toBe(0);
    expect(update.json).toMatchObject({ operation: 'update', preserved: ['protected-notes.txt'], replaces: ['existing-domain'], bundleNames: ['existing-domain'] });
    expect(update.json.inventory.find(item => item.path === 'protected-notes.txt')).toMatchObject({ bytes: Buffer.byteLength(note), sha256: digest(note) });
    const reuse = run(f, [...full(f), '--operation=reuse']);
    expect(reuse.status, reuse.stdout + reuse.stderr).toBe(0);
    expect(reuse.json.operation).toBe('reuse');
    // The same folder is not a create proposal.
    const create = run(f, full(f));
    expect(create.status, create.stdout + create.stderr).toBe(1);
    expect(codes(create.json)).toEqual(expect.arrayContaining(['INVENTORY']));
  });

  it('reports a registry that is missing, or invalid on its own, as unavailable with exit 2', () => {
    const f = build();
    const missing = run(f, full(f, { registry: path.join(f.root, 'no-such-registry') }));
    expect(missing.status, missing.stdout + missing.stderr).toBe(2);
    expect(missing.json).toMatchObject({ status: 'unavailable', candidateDigest: null, registryDigest: null, inventoryComplete: false });
    expect(codes(missing.json)).toEqual(['INPUT_UNAVAILABLE']);
    const manifestFile = path.join(f.registry, 'bundles.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as { bundles: Record<string, Record<string, unknown>> };
    manifest.bundles['existing-org']!.rules = ['missing-rule.md'];
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    const invalid = run(f, full(f));
    expect(invalid.status, invalid.stdout + invalid.stderr).toBe(2);
    expect(codes(invalid.json)).toEqual(['INPUT_UNAVAILABLE']);
    expect(invalid.json.findings[0]!.message).toContain('missing-rule.md');
  });

  it('reports a proposal folder that is missing, or is the folder above the proposal, as unavailable with exit 2', () => {
    const f = build();
    expect(run(f, full(f, { artifact: path.join(f.root, 'no-such-proposal') })).status).toBe(2);
    const parent = run(f, full(f, { artifact: path.dirname(f.proposal) }));
    expect(parent.status, parent.stdout + parent.stderr).toBe(2);
    expect(codes(parent.json)).toEqual(['INPUT_UNAVAILABLE']);
  });

  it('refuses a junction at the proposal root, at an ancestor, at the registry root and at its bundles.json, with exit 1', ctx => {
    const f = build();
    const proposalLink = path.join(f.root, 'linked-proposal');
    const registryLink = path.join(f.root, 'linked-registry');
    const draftLink = path.join(f.root, 'linked-draft');
    if (!makeLink(f.proposal, proposalLink) || !makeLink(f.registry, registryLink) || !makeLink(path.dirname(f.proposal), draftLink)) return ctx.skip();
    for (const overrides of [
      { artifact: proposalLink }, { artifact: path.join(draftLink, path.basename(f.proposal)) }, { registry: registryLink }, { registry: path.join(registryLink, 'x') },
    ]) {
      const r = run(f, full(f, overrides));
      expect(r.status, JSON.stringify(overrides) + r.stdout).toBe(1);
      expect(codes(r.json)).toContain('PATH_UNSAFE');
      expect(r.json.candidateDigest).toBeNull();
    }
    const manifestFile = path.join(f.registry, 'bundles.json');
    const moved = path.join(f.root, 'moved-bundles.json');
    fs.renameSync(manifestFile, moved);
    if (!makeFileLink(moved, manifestFile)) { fs.renameSync(moved, manifestFile); return ctx.skip(); }
    const r = run(f, full(f));
    expect(r.status, r.stdout).toBe(1);
    expect(codes(r.json)).toEqual(['PATH_UNSAFE']);
  });

  it('refuses a link inside the proposal folder with exit 1', ctx => {
    const f = build();
    const outside = path.join(f.root, 'outside');
    fs.mkdirSync(outside);
    if (!makeLink(outside, path.join(f.proposal, 'linked'))) return ctx.skip();
    for (const extra of [[], ['--operation', 'update']]) {
      const r = run(f, [...full(f), ...extra]);
      expect(r.status, r.stdout).toBe(1);
      expect(r.json.checks[0]!.findings).toEqual([expect.objectContaining({ code: 'PATH_UNSAFE', path: 'linked' })]);
    }
  });

  it.skipIf(process.platform !== 'win32')('reads forward, mixed and trailing separators in --artifact and --registry on Windows, and echoes them as given', () => {
    const f = build();
    const forward = (value: string): string => value.replaceAll('\\', '/');
    const variants: Array<[string, string]> = [
      [forward(f.proposal), forward(f.registry)],
      [`${f.proposal}\\`, `${f.registry}\\`],
      [`${forward(f.proposal)}/`, `${forward(f.registry)}/`],
      [f.proposal.replace('\\draft\\', '/draft\\'), f.registry.replace(`${path.basename(f.root)}\\`, `${path.basename(f.root)}/`)],
    ];
    for (const [artifact, registry] of variants) {
      const r = run(f, ['--artifact', artifact, '--registry', registry]);
      expect(r.status, `${artifact} | ${registry}: ${r.stdout}`).toBe(0);
      expect(r.json.artifact).toBe(artifact);
      expect(r.json.registry).toBe(registry);
    }
  });

  it.skipIf(process.platform !== 'win32')('refuses a junction leaf written with a trailing backslash or slash on Windows', ctx => {
    const f = build();
    const linked = path.join(f.root, 'linked-proposal');
    if (!makeLink(f.proposal, linked)) return ctx.skip();
    for (const artifact of [`${linked}\\`, `${linked}/`, `${linked.replaceAll('\\', '/')}/`]) {
      const r = run(f, ['--artifact', artifact, '--registry', f.registry]);
      expect(r.status, artifact + r.stdout).toBe(1);
      expect(codes(r.json)).toContain('PATH_UNSAFE');
    }
  });

  it('checks a valid Domain proposal against the real registry of this checkout, and changes no byte of it', () => {
    const f = build();
    const registryBefore = treeImage(REAL_REGISTRY);
    const r = run(f, ['--artifact', f.proposal, '--registry', REAL_REGISTRY]);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.json).toMatchObject({ status: 'passed', registry: REAL_REGISTRY, unresolved: [], replaces: [], acceptedDraft: false });
    for (const check of r.json.checks) expect(check.status, check.id).toBe('passed');
    expect(treeImage(REAL_REGISTRY)).toEqual(registryBefore);
  });

  it('prints one JSON document and nothing else, indented with two spaces', () => {
    const f = build();
    const r = run(f, full(f));
    expect(r.stdout.endsWith('\n')).toBe(true);
    expect(JSON.stringify(JSON.parse(r.stdout), null, 2)).toBe(r.stdout.trimEnd());
  });

  // -------------------------------------------------------------------------------------------
  // Fix round (independent review)
  // -------------------------------------------------------------------------------------------

  it('refuses an empty --operation as USAGE with exit 2, not as create', () => {
    const f = build();
    const r = run(f, [...full(f), '--operation', '']);
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(r.json.status).toBe('unavailable');
    expect(r.json.findings.map(item => item.code)).toEqual(['USAGE']);
    expect(r.json.findings[0]!.message).toContain('--operation');
    const equals = run(f, [...full(f), '--operation=']);
    expect(equals.status, equals.stdout + equals.stderr).toBe(2);
    expect(equals.json.findings.map(item => item.code)).toEqual(['USAGE']);
  });

  it('refuses an empty --artifact "" and an empty --registry "" as USAGE with exit 2', () => {
    const f = build();
    const artifact = run(f, ['--artifact', '', '--registry', f.registry]);
    expect(artifact.status, artifact.stdout + artifact.stderr).toBe(2);
    expect(artifact.json.findings.map(item => item.code)).toEqual(['USAGE']);
    expect(artifact.json.findings[0]!.message).toContain('--artifact');
    const registry = run(f, ['--artifact', f.proposal, '--registry', '']);
    expect(registry.status, registry.stdout + registry.stderr).toBe(2);
    expect(registry.json.findings[0]!.message).toContain('--registry');
  });

  it('refuses --allow-unresolved=false and a repeated --allow-unresolved as USAGE with exit 2', () => {
    const f = build();
    const falsy = run(f, [...full(f), '--allow-unresolved=false']);
    expect(falsy.status, falsy.stdout + falsy.stderr).toBe(2);
    expect(falsy.json.findings.map(item => item.code)).toEqual(['USAGE']);
    const twice = run(f, [...full(f), '--allow-unresolved', '--allow-unresolved']);
    expect(twice.status, twice.stdout + twice.stderr).toBe(2);
    expect(twice.json.findings.map(item => item.code)).toEqual(['USAGE']);
  });
});
