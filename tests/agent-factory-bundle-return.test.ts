/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTHORED, CHECKER, CONTRIBUTION_TEMPLATE, INSTALLED_RELATIVES, VALIDATOR, canonical, digest, inventoryOf, pinOf, prepareBundleTask, treeOf, writeSeam,
} from './helpers/bundle-task.js';
import type { BundleTaskFixture, Json } from './helpers/bundle-task.js';
import { renderNativeSkill } from '../src/core/native-package.js';

// The seam is the real source checker as a child process (process.execPath, argv arrays) on disposable roots. The fork is emulated by
// ordinary file writes followed by one run of the real installed author-bundle scripts/bundle-return.mjs; the validator pin is the real
// built dist/cli.js, and the route's last step runs that dist/cli.js bundle-check. Every refusal case carries exactly one fault.

const fixtures: BundleTaskFixture[] = [];
const make = async (options?: Parameters<typeof prepareBundleTask>[0]): Promise<BundleTaskFixture> => {
  const fixture = await prepareBundleTask(options);
  fixtures.push(fixture);
  return fixture;
};
afterEach(async () => { await Promise.all(fixtures.splice(0).map(fixture => fixture.cleanup())); });

const CONSTANTS = { quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false } as const;

function failure(result: SpawnSyncReturns<string>, code: string, phase: string, status?: 'failed' | 'unavailable'): Json {
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim().split('\n')).toHaveLength(1);
  const out = JSON.parse(result.stderr) as Json;
  expect(out).toMatchObject({ version: 1, kind: 'deterministic', phase, code, ...CONSTANTS });
  expect(['failed', 'unavailable']).toContain(out.status);
  if (status) expect(out.status).toBe(status);
  expect(typeof out.reason).toBe('string');
  return out;
}
function success(result: SpawnSyncReturns<string>): Json {
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.trim().split('\n')).toHaveLength(1);
  const out = JSON.parse(result.stdout) as Json;
  expect(out).toMatchObject(CONSTANTS);
  return out;
}
async function untouched<T>(fx: BundleTaskFixture, act: () => T): Promise<T> {
  const before = await treeOf(fx.root);
  const value = act();
  expect(await treeOf(fx.root)).toEqual(before);
  return value;
}
const hex = (character: string): string => character.repeat(64);
const blockedNotes = { status: 'blocked' as const, openItems: [{ id: 'roster-missing', description: 'The roster owner did not answer.' }] };

describe('check-bundle-return help and usage', () => {
  it('prints usage text on stdout stating what it does not prove, exits 0 and claims no validation', () => {
    const result = spawnSync(process.execPath, [CHECKER, '--help'], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 30_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('--job <absolute-bundle-task.json> [--result <absolute-bundle-return.json>]');
    expect(result.stdout).toContain('does not run bundle-return.mjs');
    expect(result.stdout).toContain('bundle-check');
    expect(result.stdout).toContain('who wrote');
    expect(result.stdout).toContain('usefulness');
    expect(result.stdout.trim().startsWith('{')).toBe(false);
  });

  it.each<[string, (fx: BundleTaskFixture) => string[]]>([
    ['a duplicate --job selector', fx => ['--job', fx.taskFile, '--job', fx.taskFile]],
    ['a duplicate --result selector', fx => ['--job', fx.taskFile, '--result', fx.returnFile, '--result', fx.returnFile]],
    ['a duplicate --help selector', () => ['--help', '--help']],
    ['an unknown flag', fx => ['--job', fx.taskFile, '--unreviewed']],
    ['a positional argument', fx => ['--job', fx.taskFile, 'extra']],
    ['a relative task path', () => ['--job', 'bundle-task.json']],
    ['a relative result path', fx => ['--job', fx.taskFile, '--result', 'bundle-return.json']],
    ['a traversal alias in the task path', fx => ['--job', `${path.dirname(fx.taskFile)}${path.sep}..${path.sep}evidence${path.sep}bundle-task.json`]],
    ['--result without --job', fx => ['--result', fx.returnFile]],
    ['--help together with --job', fx => ['--help', '--job', fx.taskFile]],
    ['--job without a value', () => ['--job']],
    ['no arguments', () => []],
  ])('refuses %s with USAGE and changes nothing', async (_label, argv) => {
    const fx = await make();
    failure(await untouched(fx, () => fx.check(argv(fx))), 'USAGE', 'usage');
  });
});

describe('the route end to end without a Host', () => {
  it('runs preflight, the emulated fork, the helper, postflight and the built bundle-check, each exiting 0', async () => {
    const fx = await make();
    const pre = success(await untouched(fx, () => fx.pre()));
    expect(pre).toMatchObject({
      version: 1, kind: 'deterministic', phase: 'preflight', recordValid: true, task: await pinOf(fx.taskFile),
      taskId: 'example-bundle-task', revision: 'r0', operation: 'create', intent: 'local',
      bundleName: fx.bundleName, tier: 'domain', bundlePaths: [...AUTHORED], taskDigest: digest(canonical(fx.task)), baselineDigest: null,
      validation: { allowUnresolved: false },
    });
    expect(pre.pins.installed).toHaveLength(20);
    expect(pre.pins.validator).toEqual(fx.task.runtime.validator);
    expect(pre.pins.checker).toEqual(await pinOf(CHECKER));
    expect(pre).not.toHaveProperty('candidate');

    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    expect(produced.ret!.taskDigest).toBe(pre.taskDigest);

    const post = success(await untouched(fx, () => fx.post()));
    const inventory = await inventoryOf(fx.draft);
    expect(post).toMatchObject({
      phase: 'postflight', recordValid: true, result: await pinOf(fx.returnFile), returnStatus: 'draft',
      claimsNotAccepted: ['inventory', 'changed', 'report', 'claimedChecks', 'openItems', 'unverified', 'upstreamPreparation'],
      producerIdentity: 'unauthenticated',
    });
    expect(post.candidate).toEqual({
      draftRoot: fx.draft, bundleName: fx.bundleName, tier: 'domain', bundlePaths: [...AUTHORED], inventory,
      candidateDigest: digest(canonical(inventory)),
      changed: [...AUTHORED].sort().map(file => ({ path: file, operation: 'create' })), preserved: [],
    });
    expect(post.bundleCheck).toEqual({
      validator: fx.task.runtime.validator.path,
      args: ['bundle-check', '--artifact', fx.draft, '--registry', fx.sourceRegistry, '--operation', 'create'],
    });

    const validated = await untouched(fx, () => spawnSync(process.execPath, [VALIDATOR, ...post.bundleCheck.args], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000 }));
    expect(validated.status, validated.stdout + validated.stderr).toBe(0);
    expect(JSON.parse(validated.stdout)).toMatchObject({ status: 'passed' });
    expect(fx.bundleCheck().status).toBe(0);
  });

  it('adds --allow-unresolved to the bundle-check arguments only when the task allows unresolved members', async () => {
    const fx = await make();
    fx.task.validation.allowUnresolved = true;
    await fx.save();
    await fx.produce();
    expect(success(fx.post()).bundleCheck.args).toEqual(['bundle-check', '--artifact', fx.draft, '--registry', fx.sourceRegistry, '--operation', 'create', '--allow-unresolved']);
  });

  it('refuses a fifth file in the draft root with SCOPE_VIOLATION', async () => {
    const fx = await make();
    await fx.produce({ files: { ...fx.files, 'extra.md': 'An unrequested fifth file.\n' } });
    failure(await untouched(fx, () => fx.post()), 'SCOPE_VIOLATION', 'postflight');
  });

  it('refuses a byte changed after the helper ran with INVENTORY_MISMATCH', async () => {
    const fx = await make();
    await fx.produce();
    await fs.appendFile(path.join(fx.draft, 'leader-responsibility.md'), 'Edited after the helper ran.\n');
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
  });

  it('refuses a return record from another task with DIGEST_MISMATCH', async () => {
    const fx = await make();
    await fx.produce();
    const other = await make();
    other.task.objective = 'A different task with its own digest.';
    await other.save();
    await other.produce();
    await fs.copy(other.returnFile, fx.returnFile, { overwrite: true });
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
  });

  it('refuses a bundles.json whose Bundle name differs from the task with BYTES_MISMATCH', async () => {
    const fx = await make();
    const manifest = JSON.parse(fx.files['bundles.json']!);
    manifest.bundles['renamed-bundle'] = { ...manifest.bundles[fx.bundleName], name: 'renamed-bundle' };
    delete manifest.bundles[fx.bundleName];
    await fx.produce({ files: { ...fx.files, 'bundles.json': `${JSON.stringify(manifest, null, 2)}\n` } });
    failure(await untouched(fx, () => fx.post()), 'BYTES_MISMATCH', 'postflight');
  });

  it('refuses a blocked return over a changed draft with BLOCKED_STATE', async () => {
    const fx = await make();
    const produced = await fx.produce({ notes: blockedNotes });
    expect(produced.run.status, produced.run.stderr).toBe(0);
    expect(produced.ret!.status).toBe('blocked');
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses an upstream task without the template pin with JOB_INVALID', async () => {
    const fx = await make({ intent: 'upstream' });
    fx.task.contributionTemplate = null;
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
  });

  it('refuses an update that changes a preservation-only file with PRESERVATION', async () => {
    const fx = await make({ operation: 'update' });
    await fx.produce({ files: { ...fx.files, 'notes/user.md': 'Rewritten by the fork.\n' } });
    failure(await untouched(fx, () => fx.post()), 'PRESERVATION', 'postflight');
  });

  it('refuses a task whose roots overlap with ROOT_CONFLICT', async () => {
    const fx = await make();
    fx.task.roots.draft = path.join(fx.producer, 'draft');
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });
});

describe('preflight of a valid task', () => {
  it('passes an Organization create task', async () => {
    const fx = await make({ tier: 'organization' });
    expect(success(await untouched(fx, () => fx.pre()))).toMatchObject({ tier: 'organization', operation: 'create', recordValid: true });
  });
  it('passes a reuse task with an absent draft', async () => {
    const fx = await make({ operation: 'reuse' });
    expect(success(await untouched(fx, () => fx.pre()))).toMatchObject({ operation: 'reuse', baselineDigest: null });
  });
  it('passes an update task whose baseline equals the live draft, with the canonical baseline digest', async () => {
    const fx = await make({ operation: 'update' });
    const out = success(await untouched(fx, () => fx.pre()));
    expect(out.baselineDigest).toBe(digest(canonical(await inventoryOf(fx.draft))));
  });
  it('passes an upstream task with its pinned contribution template inside the checkout', async () => {
    const fx = await make({ intent: 'upstream' });
    expect(success(await untouched(fx, () => fx.pre()))).toMatchObject({ intent: 'upstream' });
  });
  it('accepts the r1 update repair of a produced r0 draft', async () => {
    const fx = await make();
    await fx.produce();
    await fx.reviseToUpdate();
    expect(success(await untouched(fx, () => fx.pre()))).toMatchObject({ revision: 'r1', operation: 'update' });
  });
});

describe('preflight refusals: task record', () => {
  const cases: Array<[string, string, ((fx: BundleTaskFixture) => void | Promise<void>), ('failed' | 'unavailable')?]> = [
    ['an unknown task key', 'JOB_INVALID', fx => { fx.task.unreviewed = true; }],
    ['a missing task key', 'JOB_INVALID', fx => { delete fx.task.objective; }],
    ['a wrong kind constant', 'JOB_INVALID', fx => { fx.task.kind = 'contract-task'; }],
    ['a previous link on revision r0', 'JOB_INVALID', fx => { fx.task.previous = { taskId: 'x', taskDigest: hex('a'), returnSha256: hex('b'), reviewResultSha256: null }; }],
    ['no previous link on revision r1', 'JOB_INVALID', fx => { fx.task.revision = 'r1'; fx.task.operation = 'update'; }],
    ['a revision r1 with operation create', 'JOB_INVALID', fx => { fx.task.revision = 'r1'; fx.task.previous = { taskId: 'x', taskDigest: hex('a'), returnSha256: hex('b'), reviewResultSha256: null }; }],
    ['both host version fields set', 'JOB_INVALID', fx => { fx.task.authoringHost.observedVersion = '2.1.0'; }],
    ['a native target', 'JOB_INVALID', fx => { fx.task.target = { host: 'claude' }; }],
    ['nineteen installed pins instead of twenty', 'JOB_INVALID', fx => { fx.task.installed.pop(); }],
    ['a tier outside domain and organization', 'JOB_INVALID', fx => { fx.task.bundle.tier = 'essentials'; }],
    ['a Bundle name that is not kebab-case', 'JOB_INVALID', fx => { fx.task.bundle.name = 'Not Kebab'; }],
    ['shared Skills without git-guardrails', 'JOB_INVALID', fx => { fx.task.bundle.skills = fx.task.bundle.skills.filter((skill: string) => skill !== 'git-guardrails'); }],
    ['shared Skills with handoff twice', 'JOB_INVALID', fx => { fx.task.bundle.skills.push('handoff'); }],
    ['duplicate acceptance ids', 'JOB_INVALID', fx => { fx.task.acceptance.push({ ...fx.task.acceptance[0] }); }],
    ['duplicate fixed value names', 'JOB_INVALID', fx => { fx.task.fixedValues.push({ ...fx.task.fixedValues[0] }); }],
    ['duplicate selected check ids', 'JOB_INVALID', fx => { fx.task.selectedChecks = [{ id: 'a', command: 'x' }, { id: 'a', command: 'y' }]; }],
    ['more selected checks than the check budget', 'JOB_INVALID', fx => { fx.task.budget.maxChecks = 1; fx.task.selectedChecks = [{ id: 'a', command: 'x' }, { id: 'b', command: 'y' }]; }],
    ['publication enabled in the budget', 'JOB_INVALID', fx => { fx.task.budget.publication = true; }],
    ['an authored file budget above 256 KiB', 'JOB_INVALID', fx => { fx.task.budget.maxAuthoredFileBytes = 262145; }],
    ['unresolved provenance', 'JOB_INVALID', fx => { fx.task.provenance.unresolved = ['Owner unknown']; }],
    ['adapted provenance without evidence', 'JOB_INVALID', fx => { fx.task.provenance.disposition = 'adapted'; }],
    ['a blank provenance author', 'JOB_INVALID', fx => { fx.task.provenance.author = '   '; }],
    ['an allowed path outside the four proposal files', 'JOB_INVALID', fx => { fx.task.allowedPaths[0] = 'notes.md'; }],
    ['a create task that allows only three files', 'JOB_INVALID', fx => { fx.task.allowedPaths.pop(); }],
    ['bundles.json with role support', 'JOB_INVALID', fx => { fx.task.roles[0].role = 'support'; }],
    ['report.json with role subject', 'JOB_INVALID', fx => { fx.task.roles[3].role = 'subject'; }],
    ['a role list that omits a proposal file', 'JOB_INVALID', fx => { fx.task.roles.pop(); }],
    ['a contribution pin on a local task', 'JOB_INVALID', async fx => { fx.task.contributionTemplate = await pinOf(CONTRIBUTION_TEMPLATE); }],
    ['an input pin with the wrong hash', 'JOB_INVALID', fx => { fx.task.inputPins[0].sha256 = hex('c'); }],
    ['an input pin inside the draft root', 'JOB_INVALID', fx => { fx.task.inputPins[0].path = path.join(fx.draft, 'input.md'); }],
    ['a missing input pin file', 'JOB_INVALID', fx => { fx.task.inputPins[0].path = path.join(fx.pins, 'absent.md'); }, 'unavailable'],
  ];
  it.each(cases)('refuses %s', async (_label, code, change, status) => {
    const fx = await make();
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), code, 'preflight', status);
  });

  it('refuses a task that is not at the fixed evidence path', async () => {
    const fx = await make();
    const elsewhere = path.join(fx.root, 'elsewhere', 'bundle-task.json');
    await fs.outputFile(elsewhere, JSON.stringify(fx.task));
    failure(await untouched(fx, () => fx.check(['--job', elsewhere])), 'JOB_INVALID', 'preflight');
  });
  it('refuses bytes that are not JSON, a missing task and an envelope over 256 KiB', async () => {
    const fx = await make();
    await fs.writeFile(fx.taskFile, 'not json\n');
    failure(fx.pre(), 'JOB_INVALID', 'preflight');
    await fs.remove(fx.taskFile);
    failure(fx.pre(), 'JOB_INVALID', 'preflight', 'unavailable');
    await fs.writeFile(fx.taskFile, JSON.stringify({ ...fx.task, objective: 'x'.repeat(300_000) }));
    failure(fx.pre(), 'JOB_INVALID', 'preflight', 'unavailable');
  });
  it('refuses more pinned inputs than the pin budget with LIMIT', async () => {
    const fx = await make();
    fx.task.budget.maxPinnedInputs = 1;
    fx.task.inputPins.push({ ...fx.task.inputPins[0], kind: 'binding' });
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'LIMIT', 'preflight', 'unavailable');
  });
  it('refuses pinned inputs over the byte budget with LIMIT', async () => {
    const fx = await make();
    fx.task.budget.maxPinnedInputBytes = 4;
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'LIMIT', 'preflight', 'unavailable');
  });
  it('refuses an upstream template pin outside the checkout with JOB_INVALID', async () => {
    const fx = await make({ intent: 'upstream' });
    const outside = path.join(fx.pins, 'artifact-contribution.md');
    await fs.copy(CONTRIBUTION_TEMPLATE, outside);
    fx.task.contributionTemplate = await pinOf(outside);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
  });
});

describe('preflight refusals: roots', () => {
  const cases: Array<[string, (fx: BundleTaskFixture) => void | Promise<void>]> = [
    ['producer and evidence roots that are equal', fx => { fx.task.roots.producer = fx.evidence; }],
    ['a draft root that contains the evidence root', fx => { fx.task.roots.draft = fx.root; }],
    ['a managed root that contains the evidence root', fx => { fx.task.roots.managed = [fx.evidence]; }],
    ['a protected root that is the producer root', fx => { fx.task.roots.protected = [fx.producer]; }],
    ['a draft root inside the source checkout', fx => { fx.task.roots.draft = path.join(fx.task.source.checkout, 'tmp-draft-never-created'); }],
    ['a draft root under a .claude directory', fx => { fx.task.roots.draft = path.join(fx.root, '.claude', 'candidate', fx.bundleName); }],
    ['a producer root under a .codex directory', fx => { fx.task.roots.producer = path.join(fx.root, '.codex', 'producer'); }],
    ['a linked ancestor of the producer root', async fx => {
      const alias = path.join(fx.root, 'linked-parent');
      await fs.symlink(fx.root, alias, 'junction');
      fx.task.roots.producer = path.join(alias, 'producer');
    }],
    ['a missing source registry', fx => { fx.task.source.registry = path.join(fx.root, 'absent-registry'); }],
  ];
  it.each(cases)('refuses %s with ROOT_CONFLICT', async (_label, change) => {
    const fx = await make();
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });
});

describe('preflight refusals: baseline and live draft state', () => {
  it('refuses a create task whose draft root already exists', async () => {
    const fx = await make();
    await fx.writeDraft();
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });
  it('refuses a reuse task that carries a baseline', async () => {
    const fx = await make({ operation: 'reuse' });
    fx.task.baseline = [{ path: 'bundles.json', bytes: 1, sha256: hex('a'), snapshot: path.join(fx.evidence, 'x.json') }];
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });
  const update: Array<[string, (fx: BundleTaskFixture) => void | Promise<void>, ('failed' | 'unavailable')?]> = [
    ['a stale baseline', async fx => { await fs.appendFile(path.join(fx.draft, 'leader-responsibility.md'), 'edited later\n'); }],
    ['a draft file the baseline does not list', async fx => { await fs.outputFile(path.join(fx.draft, 'extra.md'), 'new\n'); }],
    ['an edited baseline snapshot', async fx => { await fs.appendFile(fx.task.baseline[0].snapshot, 'edited\n'); }, 'failed'],
    ['a missing baseline snapshot', async fx => { await fs.remove(fx.task.baseline[0].snapshot); }, 'unavailable'],
    ['a baseline snapshot outside the evidence root', async fx => {
      const moved = path.join(fx.pins, 'moved-snapshot.json');
      await fs.move(fx.task.baseline[0].snapshot, moved);
      fx.task.baseline[0].snapshot = moved;
    }],
    ['an empty baseline', fx => { fx.task.baseline = []; }],
    ['a baseline without one of the four proposal files', fx => {
      fx.task.baseline = fx.task.baseline.filter((item: Json) => item.path !== 'bindings.json');
    }],
    ['a protected note that is not in the baseline', fx => { fx.task.protectedNotes = [{ path: 'notes/user.md', contains: 'Not in the baseline.' }]; }],
    ['a missing draft root', async fx => { await fs.remove(fx.draft); }],
  ];
  it.each(update)('refuses an update with %s', async (_label, change, status) => {
    const fx = await make({ operation: 'update' });
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight', status);
  });
  it('refuses protected notes on a create task with BASELINE_MISMATCH', async () => {
    const fx = await make();
    fx.task.protectedNotes = [{ path: 'bundles.json', contains: 'x' }];
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });
  it('refuses a linked entry inside the draft folder with ROOT_CONFLICT', async () => {
    const fx = await make({ operation: 'update' });
    await fs.symlink(fx.pins, path.join(fx.draft, 'linked-pins'), 'junction');
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });
  it('refuses an update baseline over the preserved-file budget with LIMIT (the baseline check; the live snapshot is tested separately)', async () => {
    const fx = await make({ operation: 'update' });
    fx.task.budget.maxPreservedFiles = 0;
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'LIMIT', 'preflight', 'unavailable');
  });
});

describe('preflight refusals: the installed author-bundle closure, loader and runtime', () => {
  it.each(INSTALLED_RELATIVES)('refuses a missing installed %s with CLOSURE_MISSING', async rel => {
    const fx = await make();
    await fs.remove(fx.inst(rel));
    failure(await untouched(fx, () => fx.pre()), 'CLOSURE_MISSING', 'preflight', 'unavailable');
  });
  it.each(INSTALLED_RELATIVES)('refuses an edited installed %s with CLOSURE_MISSING', async rel => {
    const fx = await make();
    await fs.appendFile(fx.inst(rel), '\nAn unreviewed edit.\n');
    failure(await untouched(fx, () => fx.pre()), 'CLOSURE_MISSING', 'preflight', 'failed');
  });
  it('refuses an installed folder that is not named author-bundle', async () => {
    const fx = await make();
    const renamed = path.join(path.dirname(fx.installedRoot), 'author-bundle-copy');
    await fs.copy(fx.installedRoot, renamed);
    fx.task.installed = await Promise.all(INSTALLED_RELATIVES.map(rel => pinOf(path.join(renamed, ...rel.split('/')))));
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'CLOSURE_MISSING', 'preflight');
  });
  it('refuses an installed template asset that is not JSON with CLOSURE_MISSING', async () => {
    const fx = await make();
    await fs.writeFile(fx.inst('assets/report.json'), 'not json\n');
    await fx.repinInstalled('assets/report.json');
    failure(await untouched(fx, () => fx.pre()), 'CLOSURE_MISSING', 'preflight');
  });
  const loader: Array<[string, (text: string) => string]> = [
    ['no fork context', text => text.replace(/^context: fork\r?\n/m, '')],
    ['a wrong built-in agent', text => text.replace('agent: general-purpose', 'agent: Explore')],
    ['background: true', text => text.replace('background: false', 'background: true')],
    ['a disable-model-invocation flag', text => text.replace(/^background: false\r?\n/m, 'background: false\ndisable-model-invocation: true\n')],
    ['a different skill name', text => text.replace('name: author-bundle', 'name: other-skill')],
  ];
  it.each(loader)('refuses %s in the installed entry with LOADER_MECHANISM', async (_label, edit) => {
    const fx = await make();
    const file = fx.inst('SKILL.md');
    const original = await fs.readFile(file, 'utf8');
    const edited = edit(original);
    expect(edited).not.toBe(original);
    await fs.writeFile(file, edited);
    await fx.repinInstalled('SKILL.md');
    failure(await untouched(fx, () => fx.pre()), 'LOADER_MECHANISM', 'preflight');
  });
  it('refuses a binding receipt without the helper in requiredSupport with LOADER_MECHANISM', async () => {
    const fx = await make();
    const file = fx.inst('assets/claude-binding.json');
    const binding = await fs.readJson(file);
    binding.requiredSupport = binding.requiredSupport.filter((rel: string) => rel !== 'scripts/bundle-return.mjs');
    await fs.writeFile(file, JSON.stringify(binding, null, 2) + '\n');
    await fx.repinInstalled('assets/claude-binding.json');
    failure(await untouched(fx, () => fx.pre()), 'LOADER_MECHANISM', 'preflight');
  });
  const runtime: Array<[string, (fx: BundleTaskFixture) => void | Promise<void>, ('failed' | 'unavailable')?]> = [
    ['an executable that is not the running Node', async fx => { fx.task.runtime.executable = await pinOf(fx.inst('scripts/bundle-return.mjs')); }, 'failed'],
    ['an executable pin with the wrong hash', fx => { fx.task.runtime.executable.sha256 = hex('d'); }, 'failed'],
    ['a checker that is not this script', async fx => { fx.task.runtime.checker = await pinOf(fx.inst('scripts/bundle-return.mjs')); }, 'failed'],
    ['a validator pin with the wrong hash', fx => { fx.task.runtime.validator.sha256 = hex('e'); }, 'failed'],
    ['a validator that is not <checkout>/dist/cli.js', async fx => {
      const copy = path.join(fx.pins, 'cli.js');
      await fs.copy(VALIDATOR, copy);
      fx.task.runtime.validator = await pinOf(copy);
    }, 'failed'],
    ['a missing validator', fx => { fx.task.runtime.validator.path = path.join(fx.root, 'absent', 'cli.js'); }, 'unavailable'],
  ];
  it.each(runtime)('refuses %s with RUNTIME_MISMATCH', async (_label, change, status) => {
    const fx = await make();
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'RUNTIME_MISMATCH', 'preflight', status);
  });
  it('refuses a checkout whose HEAD is not the pinned head with CHECKOUT_HEAD', async () => {
    const fx = await make();
    fx.task.source.head = '0'.repeat(40);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'CHECKOUT_HEAD', 'preflight');
  });
  it('refuses a pinned input that changes during the preflight with STALE_INPUT', async () => {
    const fx = await make();
    const preload = await writeSeam(fx.root);
    const result = fx.check(['--job', fx.taskFile], { preload, env: { SEAM_WHEN: path.join('references', 'job.md'), SEAM_TARGET: fx.taskFile } });
    failure(result, 'STALE_INPUT', 'preflight', 'unavailable');
  });
});

describe('postflight of a produced draft', () => {
  it('passes an Organization create run', async () => {
    const fx = await make({ tier: 'organization' });
    await fx.produce();
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ tier: 'organization', returnStatus: 'draft' });
    expect(fx.bundleCheck().status).toBe(0);
  });
  it('passes a reuse run', async () => {
    const fx = await make({ operation: 'reuse' });
    await fx.produce();
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ operation: 'reuse', returnStatus: 'draft' });
  });
  it('passes an update run that preserves the maintainer note and the unchanged files, and lists what it preserved', async () => {
    const fx = await make({ operation: 'update' });
    await fx.produce();
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.candidate.changed).toEqual([{ path: 'leader-responsibility.md', operation: 'update' }, { path: 'report.json', operation: 'update' }]);
    expect(out.candidate.preserved).toEqual(['bindings.json', 'bundles.json', 'notes/user.md']);
    expect(out.bundleCheck.args).toContain('update');
  });
  it('passes the r1 repair after r0, and refuses the r0 return presented for r1 with DIGEST_MISMATCH', async () => {
    const fx = await make();
    await fx.produce();
    const r0Return = await fs.readFile(fx.returnFile);
    await fx.reviseToUpdate();
    await fs.outputFile(fx.returnFile, r0Return);
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
    await fx.produce();
    expect(success(fx.post())).toMatchObject({ revision: 'r1', operation: 'update', candidate: { changed: [{ path: 'leader-responsibility.md', operation: 'update' }] } });
  });
  it('passes an upstream run whose preparation is unsent, based on dev and begins with the pinned template', async () => {
    const fx = await make({ intent: 'upstream' });
    const produced = await fx.produce({ notes: { upstreamEvidence: 'Prepared Bundle evidence for review.' } });
    expect(produced.ret!.upstreamPreparation).toMatchObject({ base: 'dev', sent: false, templatePath: CONTRIBUTION_TEMPLATE });
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ intent: 'upstream', returnStatus: 'draft' });
  });
  it('passes a truthful blocked return that leaves the create draft absent', async () => {
    const fx = await make();
    const produced = await fx.produce({ write: false, notes: blockedNotes });
    expect(produced.ret).toMatchObject({ status: 'blocked', inventory: [], changed: [], report: null, upstreamPreparation: null });
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ returnStatus: 'blocked', candidate: null });
  });
  it('passes a blocked update return over the untouched baseline', async () => {
    const fx = await make({ operation: 'update' });
    await fx.produce({ write: false, notes: blockedNotes });
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ returnStatus: 'blocked', candidate: null });
  });
  it('executes nothing supplied by the task, the return or the candidate', async () => {
    const fx = await make();
    const marker = path.join(fx.root, 'must-not-exist.txt');
    const payload = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')`;
    fx.task.selectedChecks = [{ id: 'hostile', command: `node -e "${payload}"` }];
    await fx.save();
    expect(success(fx.pre()).recordValid).toBe(true);
    const produced = await fx.produce({ notes: { claimedChecks: [{ name: 'hostile', command: `node -e "${payload}"`, exitCode: 0, raw: null }] } });
    expect(produced.run.status, produced.run.stderr).toBe(0);
    success(await untouched(fx, () => fx.post()));
    expect(await fs.pathExists(marker)).toBe(false);
  });
});

describe('postflight refusals: the return record', () => {
  it('refuses a return that is not at the fixed producer path with RESULT_PATH', async () => {
    const fx = await make();
    await fx.produce();
    const other = path.join(fx.producer, 'other-return.json');
    await fs.copy(fx.returnFile, other);
    failure(await untouched(fx, () => fx.post(other)), 'RESULT_PATH', 'postflight');
  });
  it('refuses a missing return as unavailable', async () => {
    const fx = await make();
    failure(await untouched(fx, () => fx.post()), 'RESULT_INVALID', 'postflight', 'unavailable');
  });
  const record: Array<[string, (ret: Json) => void]> = [
    ['an unknown return key', ret => { ret.unreviewed = true; }],
    ['a missing return key', ret => { delete ret.unverified; }],
    ['a wrong kind constant', ret => { ret.kind = 'contract-return'; }],
    ['a status outside draft and blocked', ret => { ret.status = 'accepted'; }],
    ['a malformed task digest', ret => { ret.taskDigest = 'not-a-digest'; }],
    ['a blocked status without open items', ret => { ret.status = 'blocked'; ret.openItems = []; }],
    ['more claimed checks than the check budget', ret => { ret.claimedChecks = Array.from({ length: 7 }, (_, i) => ({ name: `c${i}`, command: 'x', exitCode: 0, raw: null })); }],
    ['duplicate inventory paths', ret => { ret.inventory.push({ ...ret.inventory[0] }); }],
    ['an upstream preparation on a local task', ret => { ret.upstreamPreparation = { templatePath: CONTRIBUTION_TEMPLATE, base: 'dev', sent: false, body: 'x' }; }],
  ];
  it.each(record)('refuses %s with RESULT_INVALID', async (_label, change) => {
    const fx = await make();
    const produced = await fx.produce();
    change(produced.ret!);
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'RESULT_INVALID', 'postflight');
  });
  it('refuses a stale task digest and a different task id with DIGEST_MISMATCH', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.ret!.taskDigest = hex('0');
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
    produced.ret!.taskDigest = digest(canonical(fx.task));
    produced.ret!.taskId = 'another-task';
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
  });
  it('refuses a task changed after the return was written with DIGEST_MISMATCH', async () => {
    const fx = await make();
    await fx.produce();
    fx.task.objective = 'A different objective than the one the fork saw.';
    await fx.save();
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
  });
  it('refuses non-empty externalActions with EXTERNAL_ACTION', async () => {
    const fx = await make();
    const produced = await fx.produce({ notes: { externalActions: ['pushed a branch'] } });
    expect(produced.run.status, produced.run.stderr).toBe(0);
    failure(await untouched(fx, () => fx.post()), 'EXTERNAL_ACTION', 'postflight');
  });
  const upstream: Array<[string, (ret: Json) => void, string]> = [
    ['sent true', ret => { ret.upstreamPreparation.sent = true; }, 'RESULT_INVALID'],
    ['a base other than dev', ret => { ret.upstreamPreparation.base = 'main'; }, 'RESULT_INVALID'],
    ['a body that does not begin with the pinned template', ret => { ret.upstreamPreparation.body = `Invented.\n${ret.upstreamPreparation.body}`; }, 'EXTERNAL_ACTION'],
    ['a relative template path', ret => { ret.upstreamPreparation.templatePath = '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md'; }, 'HELPER_RECORD'],
    ['no preparation on an upstream draft', ret => { ret.upstreamPreparation = null; }, 'EXTERNAL_ACTION'],
  ];
  it.each(upstream)('refuses an upstream preparation with %s', async (_label, edit, code) => {
    const fx = await make({ intent: 'upstream' });
    const produced = await fx.produce();
    edit(produced.ret!);
    await produced.save();
    failure(await untouched(fx, () => fx.post()), code, 'postflight');
  });
});

describe('postflight refusals: blocked state', () => {
  it('refuses a blocked return that claims changes with BLOCKED_STATE', async () => {
    const fx = await make({ operation: 'update' });
    const produced = await fx.produce({ write: false, notes: blockedNotes });
    produced.ret!.changed = [{ path: 'report.json', operation: 'update' }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });
  it('refuses a blocked update return over a modified draft with BLOCKED_STATE', async () => {
    const fx = await make({ operation: 'update' });
    await fx.produce({ write: false, notes: blockedNotes });
    await fs.appendFile(path.join(fx.draft, 'report.json'), ' ');
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });
  it('refuses a blocked return with an upstream preparation with BLOCKED_STATE', async () => {
    const fx = await make({ intent: 'upstream' });
    const produced = await fx.produce({ write: false, notes: blockedNotes });
    produced.ret!.upstreamPreparation = { templatePath: CONTRIBUTION_TEMPLATE, base: 'dev', sent: false, body: 'x' };
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });
  it('refuses a draft return over an absent draft with SCOPE_VIOLATION', async () => {
    const fx = await make();
    const produced = await fx.produce({ write: false, notes: blockedNotes });
    Object.assign(produced.ret!, { status: 'draft', openItems: [] });
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'SCOPE_VIOLATION', 'postflight');
  });
});

describe('postflight refusals: scope, preservation and the bytes bound to the task', () => {
  it('refuses a missing proposal file with SCOPE_VIOLATION', async () => {
    const fx = await make();
    await fx.produce({ files: { ...fx.files, 'bindings.json': null } });
    failure(await untouched(fx, () => fx.post()), 'SCOPE_VIOLATION', 'postflight');
  });
  it('refuses a deleted baseline file with SCOPE_VIOLATION', async () => {
    const fx = await make({ operation: 'update' });
    await fx.produce();
    await fs.remove(path.join(fx.draft, 'notes', 'user.md'));
    failure(await untouched(fx, () => fx.post()), 'SCOPE_VIOLATION', 'postflight');
  });
  it('refuses an update that changes a proposal file outside allowedPaths with PRESERVATION', async () => {
    const fx = await make({ operation: 'update' });
    await fx.produce({ files: { ...fx.files, 'bindings.json': '{"edited": true}\n' } });
    failure(await untouched(fx, () => fx.post()), 'PRESERVATION', 'postflight');
  });
  it('refuses an update that drops a protected note with PRESERVATION', async () => {
    const fx = await make({ operation: 'update' });
    fx.task.allowedPaths = ['leader-responsibility.md', 'report.json'];
    fx.task.protectedNotes = [{ path: 'leader-responsibility.md', contains: 'example-review-domain' }];
    await fx.save();
    expect(success(fx.pre()).recordValid).toBe(true);
    await fx.produce({ files: { ...fx.files, 'leader-responsibility.md': '# Leader responsibility\nRewritten without the name.\n' } });
    failure(await untouched(fx, () => fx.post()), 'PRESERVATION', 'postflight');
  });
  const bytes: Array<[string, (fx: BundleTaskFixture) => Record<string, string>]> = [
    ['bundles.json that is not JSON', fx => ({ ...fx.files, 'bundles.json': '{ not json\n' })],
    ['bindings.json that is not JSON', fx => ({ ...fx.files, 'bindings.json': 'not json\n' })],
    ['report.json that is an array', fx => ({ ...fx.files, 'report.json': '[]\n' })],
    ['leader-responsibility.md that is not UTF-8', fx => ({ ...fx.files, 'leader-responsibility.md': '' })],
    ['a Bundle version that differs from the task', fx => {
      const manifest = JSON.parse(fx.files['bundles.json']!);
      manifest.bundles[fx.bundleName].version = '9.9.9';
      return { ...fx.files, 'bundles.json': `${JSON.stringify(manifest, null, 2)}\n` };
    }],
    ['a Bundle tier that differs from the task', fx => {
      const manifest = JSON.parse(fx.files['bundles.json']!);
      manifest.bundles[fx.bundleName].tier = 'organization';
      return { ...fx.files, 'bundles.json': `${JSON.stringify(manifest, null, 2)}\n` };
    }],
    ['a missing fixed value', fx => {
      const manifest = JSON.parse(fx.files['bundles.json']!);
      manifest.bundles[fx.bundleName].agents = [];
      const bindings = JSON.parse(fx.files['bindings.json']!);
      bindings.edges = bindings.edges.filter((edge: Json) => edge.kind !== 'agent');
      return { ...fx.files, 'bundles.json': `${JSON.stringify(manifest, null, 2)}\n`, 'bindings.json': `${JSON.stringify(bindings, null, 2)}\n` };
    }],
  ];
  it.each(bytes)('refuses %s with BYTES_MISMATCH', async (_label, files) => {
    const fx = await make();
    const given = files(fx);
    if (given['leader-responsibility.md'] === '') {
      await fx.writeDraft({ ...fx.files });
      await fs.writeFile(path.join(fx.draft, 'leader-responsibility.md'), Buffer.from([0xff, 0xfe, 0xfd]));
      await fx.produce({ write: false });
    } else await fx.produce({ files: given });
    failure(await untouched(fx, () => fx.post()), 'BYTES_MISMATCH', 'postflight');
  });
  it('refuses a proposal file grown over the authored budget after the helper ran with LIMIT', async () => {
    const fx = await make();
    await fx.produce();
    await fs.writeFile(path.join(fx.draft, 'leader-responsibility.md'), 'x'.repeat(262_145));
    failure(await untouched(fx, () => fx.post()), 'LIMIT', 'postflight', 'unavailable');
  });
});

describe('postflight refusals: the claimed inventory, report pin and changed list', () => {
  it('refuses an inventory that omits a path, adds a path or misstates a hash with INVENTORY_MISMATCH', async () => {
    const fx = await make();
    const produced = await fx.produce();
    const original = structuredClone(produced.ret!.inventory);
    produced.ret!.inventory = original.slice(1);
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
    produced.ret!.inventory = [...original, { path: 'invented.md', bytes: 1, sha256: hex('1') }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
    produced.ret!.inventory = original.map((item: Json, index: number) => (index === 0 ? { ...item, sha256: hex('2') } : item));
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
  });
  it('refuses a report pin that is null, names another file or misstates the hash with INVENTORY_MISMATCH', async () => {
    const fx = await make();
    const produced = await fx.produce();
    const original = structuredClone(produced.ret!.report);
    produced.ret!.report = null;
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
    produced.ret!.report = { ...original, path: path.join(fx.draft, 'bindings.json') };
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
    produced.ret!.report = { ...original, sha256: hex('3') };
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
  });
  it('refuses a false changed list with DIFF_MISMATCH', async () => {
    const fx = await make({ operation: 'update' });
    const produced = await fx.produce();
    produced.ret!.changed = [{ path: 'leader-responsibility.md', operation: 'update' }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'DIFF_MISMATCH', 'postflight');
    produced.ret!.changed = [{ path: 'leader-responsibility.md', operation: 'create' }, { path: 'report.json', operation: 'update' }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'DIFF_MISMATCH', 'postflight');
  });
  it('refuses a pinned input that changes during the postflight with STALE_INPUT', async () => {
    const fx = await make();
    await fx.produce();
    const preload = await writeSeam(fx.root);
    const result = fx.check(['--job', fx.taskFile, '--result', fx.returnFile], { preload, env: { SEAM_WHEN: 'bundle-return.json', SEAM_TARGET: fx.taskFile } });
    failure(result, 'STALE_INPUT', 'postflight', 'unavailable');
  });
  it('reports a preflight fault as phase preflight even when a return was supplied', async () => {
    const fx = await make();
    await fx.produce();
    fx.task.source.head = '0'.repeat(40);
    await fx.save();
    failure(await untouched(fx, () => fx.post()), 'CHECKOUT_HEAD', 'preflight');
  });
});

describe('the route is named where it is loaded', () => {
  const lf = async (rel: string): Promise<string> => (await fs.readFile(path.resolve(rel), 'utf8')).replace(/\r\n/g, '\n');
  it.each(['registry/skills/coordinate-artifact/SKILL.md', 'registry/hosts/claude/skills/coordinate-artifact/SKILL.md'])('%s names the reference at its trigger and the checker and schemas at step 7', async rel => {
    const text = await lf(rel);
    expect(text).toContain('a Bundle proposal [bundle authoring](references/bundle-authoring.md); the maintainer types `/author-skill`, `/author-contract` or `/author-bundle <task path>`.');
    const step = text.split('\n').find(line => /^7\. /.test(line)) ?? '';
    for (const needle of ['`node "${CLAUDE_SKILL_DIR}/<checker>"`', 'Bundle `assets/bundle-task.schema.json`, `scripts/check-bundle-return.mjs`, `assets/bundle-return.schema.json`',
      'Skill `assets/skill-task.schema.json`, `scripts/check-skill-return.mjs`, `assets/skill-return.schema.json`',
      'shared pair `assets/contract-task.schema.json`, `scripts/check-contract-return.mjs`, `assets/contract-return.schema.json`', 'Never rerun `draft.mjs` or `draft-pair.mjs`.']) expect(step, needle).toContain(needle);
  });
  it.each(['coordinate-artifact', 'author-bundle'])('keeps the installed native %s entry, with its managed header, within 6,000 characters', async skill => {
    const text = await fs.readFile(path.resolve(`registry/hosts/claude/skills/${skill}/SKILL.md`), 'utf8');
    expect(renderNativeSkill(text, `skills/${skill}/SKILL.md`, 'claude').replace(/\r\n/g, '\n').length).toBeLessThanOrEqual(6000);
  });
  it.each(['registry/skills/author-bundle/SKILL.md', 'registry/hosts/claude/skills/author-bundle/SKILL.md'])('%s keeps the self-contained job and adds the task-path rule with the helper', async rel => {
    const text = await lf(rel);
    expect(text).toContain('A one-path invocation naming a `bundle-task.json` is the job: draft the four files in its `roots.draft`, run `node "${CLAUDE_SKILL_DIR}/scripts/bundle-return.mjs" --job <task path>` once, reply with the paths.');
    expect(text).toMatch(/\[(?:fixed )?job\]\(references\/job\.md\)/);
    expect(text.length).toBeLessThanOrEqual(6000);
    expect(text.split('\n').length).toBeLessThanOrEqual(90);
    expect(text).not.toMatch(/[0-9a-f]{64}/i);
    // The installed native entry carries a managed header: its rendered form is what the layout cap applies to.
    if (rel.startsWith('registry/hosts/')) expect(renderNativeSkill(text, 'skills/author-bundle/SKILL.md', 'claude').replace(/\r\n/g, '\n').length).toBeLessThanOrEqual(6000);
  });
  it('states the notes file, the one written file and the exit convention in references/job.md', async () => {
    const text = await lf('registry/skills/author-bundle/references/job.md');
    for (const needle of ['Task-path mode', '`<roots.producer>/bundle-return.json`', 'writes nothing in the draft and executes nothing', '`--notes <absolute path>`', '`status` (`draft` or `blocked`; blocked needs an open item)', 'Without notes the status is `draft`', 'Exit 0 prints one JSON line; exit 1']) expect(text, needle).toContain(needle);
  });
  it('gives the Bundle route its own paragraph in the coordinator main: the maintainer invokes the fork and no P5 review follows', async () => {
    const body = await lf('registry/hosts/claude/agents/orchestrator-agent-factory.md');
    const section = body.slice(body.indexOf('## One Bundle proposal'), body.indexOf('## One host-update sync'));
    for (const needle of ['references/bundle-authoring.md', 'This main has no Skill tool and does not start the `author-bundle` fork', '`/author-bundle <absolute task path>`', 'postflight check and `agents bundle-check`', 'never reruns `bundle-return.mjs`', 'independent quality review is unavailable', 'separate tasks']) expect(section, needle).toContain(needle);
    expect(body).toContain('the maintainer, not this main, invokes the `author-skill`, `author-contract` and `author-bundle` forks');
  });
  it('states in the reference what bundle-check does not show and the evidence the hand-back carries', async () => {
    const text = await lf('registry/skills/coordinate-artifact/references/bundle-authoring.md');
    for (const needle of ['`bundle-check` does not show the leader file\'s content, the report\'s content and hashes, licence truth or quality', 'No evaluator step', 'independent quality review of a whole Bundle is unavailable',
      '--allow-unresolved` only when `validation.allowUnresolved` is true', 'Save the command, stdout, stderr and exit code in the evidence root', 'a nonzero exit is rework', 'at most one']) expect(text, needle).toContain(needle);
  });
});

// Fix round after the independent review (report points 1, 6, 8, 9, 10, 11 and 13; lead additions A and B).
describe('return paths must be absolute, alias-free and the ones the task implies (point 1)', () => {
  it('refuses a report pin path with a .. alias and a relative report pin path with HELPER_RECORD', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.ret!.report.path = `${fx.draft}${path.sep}..${path.sep}${path.basename(fx.draft)}${path.sep}report.json`;
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    produced.ret!.report.path = 'report.json';
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
  });
  it('refuses an upstream template path with a .. alias or another spelling with HELPER_RECORD', async () => {
    const fx = await make({ intent: 'upstream' });
    const produced = await fx.produce();
    const pinned = fx.task.contributionTemplate.path as string;
    produced.ret!.upstreamPreparation.templatePath = `${path.dirname(pinned)}${path.sep}..${path.sep}PULL_REQUEST_TEMPLATE${path.sep}${path.basename(pinned)}`;
    expect(produced.ret!.upstreamPreparation.templatePath.split(/[\\/]/)).toContain('..');
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    produced.ret!.upstreamPreparation.templatePath = pinned.toUpperCase();
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
  });
});

describe('folders in the draft root count (point 6)', () => {
  it('refuses a draft return with an empty folder the baseline did not have with SCOPE_VIOLATION', async () => {
    const fx = await make();
    await fx.writeDraft();
    await fs.ensureDir(path.join(fx.draft, 'scripts'));
    await fx.produce({ write: false });
    failure(await untouched(fx, () => fx.post()), 'SCOPE_VIOLATION', 'postflight');
  });
  it('refuses a blocked update return over a draft that gained an empty folder with BLOCKED_STATE', async () => {
    const fx = await make({ operation: 'update' });
    await fs.ensureDir(path.join(fx.draft, 'extra-dir'));
    await fx.produce({ write: false, notes: blockedNotes });
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });
  it('refuses an update preflight over a draft with an empty folder the baseline does not imply with BASELINE_MISMATCH', async () => {
    const fx = await make({ operation: 'update' });
    await fs.ensureDir(path.join(fx.draft, 'extra-dir'));
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });
  it('still passes an update whose baseline folder (notes/) stays', async () => {
    const fx = await make({ operation: 'update' });
    await fx.produce();
    expect(success(fx.post()).returnStatus).toBe('draft');
  });
});

describe('fixed values are whole tokens in the three authored proposal files (point 8)', () => {
  it('refuses a fixed value that appears only in report.json with BYTES_MISMATCH', async () => {
    const fx = await make();
    fx.task.fixedValues = [{ name: 'note', value: 'Independent review and native realization remain open.' }];
    await fx.save();
    await fx.produce();
    failure(await untouched(fx, () => fx.post()), 'BYTES_MISMATCH', 'postflight');
  });
  it('refuses a fixed value that appears only inside a longer token with BYTES_MISMATCH', async () => {
    const fx = await make();
    fx.task.fixedValues = [{ name: 'part', value: 'code-reviewer' }];
    await fx.save();
    await fx.produce();
    failure(await untouched(fx, () => fx.post()), 'BYTES_MISMATCH', 'postflight');
  });
});

describe('the roster is bound to the task (addition A)', () => {
  const edit = (fx: BundleTaskFixture, change: (bundle: Json) => void): Record<string, string> => {
    const manifest = JSON.parse(fx.files['bundles.json']!);
    change(manifest.bundles[fx.bundleName]);
    return { ...fx.files, 'bundles.json': `${JSON.stringify(manifest, null, 2)}\n` };
  };
  const cases: Array<[string, 'domain' | 'organization', (bundle: Json) => void]> = [
    ['a dropped agent', 'organization', bundle => { bundle.agents = bundle.agents.slice(0, 1); }],
    ['a reordered skills list', 'domain', bundle => { bundle.skills = [...bundle.skills].reverse(); }],
    ['an added skill', 'domain', bundle => { bundle.skills = [...bundle.skills, 'extra-skill']; }],
    ['a changed orchestrator', 'organization', bundle => { bundle.orchestrator = 'orchestrator-other.md'; }],
    ['an orchestrator where the task has none', 'domain', bundle => { bundle.orchestrator = 'orchestrator-digital-agency.md'; }],
    ['a parent where the task has none', 'domain', bundle => { bundle.parentBundle = 'existing-domain'; }],
  ];
  it.each(cases)('refuses %s with BYTES_MISMATCH', async (_label, tier, change) => {
    const fx = await make({ tier });
    await fx.produce({ files: edit(fx, change) });
    failure(await untouched(fx, () => fx.post()), 'BYTES_MISMATCH', 'postflight');
  });
  it('accepts a parent equal to the task parent, and an explicit null orchestrator where the task has none', async () => {
    const fx = await make();
    fx.task.bundle.parentBundle = 'existing-domain';
    await fx.save();
    await fx.produce({ files: edit(fx, bundle => { bundle.parentBundle = 'existing-domain'; bundle.orchestrator = null; }) });
    expect(success(fx.post()).returnStatus).toBe('draft');
  });
});

describe('budgets reach the draft snapshot (point 10)', () => {
  it('refuses a draft that gained a preserved file over the budget after preflight with LIMIT', async () => {
    const fx = await make({ operation: 'update' });
    fx.task.budget.maxPreservedFiles = 1;
    await fx.save();
    expect(success(fx.pre()).recordValid).toBe(true);
    await fx.produce();
    await fs.outputFile(path.join(fx.draft, 'notes', 'second.md'), 'A second preserved file.\n');
    failure(await untouched(fx, () => fx.post()), 'LIMIT', 'postflight', 'unavailable');
  });
});

describe('checker paths not covered before (point 11)', () => {
  it('refuses a non-proposal role other than preservation-only with JOB_INVALID', async () => {
    const fx = await make({ operation: 'update' });
    fx.task.roles = fx.task.roles.map((role: Json) => (role.path === 'notes/user.md' ? { ...role, role: 'support' } : role));
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
  });
  it('refuses a baseline file the roles omit with JOB_INVALID', async () => {
    const fx = await make({ operation: 'update' });
    fx.task.roles = fx.task.roles.filter((role: Json) => role.path !== 'notes/user.md');
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
  });
  it('refuses a claimed check raw pin over the check log budget with RESULT_INVALID', async () => {
    const fx = await make();
    fx.task.budget.maxCheckLogBytes = 10;
    await fx.save();
    const produced = await fx.produce();
    produced.ret!.claimedChecks = [{ name: 'c', command: 'x', exitCode: 0, raw: { path: path.join(fx.producer, 'raw.txt'), bytes: 11, sha256: hex('4') } }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'RESULT_INVALID', 'postflight');
  });
  it('refuses a bundles record whose own name differs from its key and the task with BYTES_MISMATCH', async () => {
    const fx = await make();
    const manifest = JSON.parse(fx.files['bundles.json']!);
    manifest.bundles[fx.bundleName].name = 'other-name';
    await fx.produce({ files: { ...fx.files, 'bundles.json': `${JSON.stringify(manifest, null, 2)}\n` } });
    failure(await untouched(fx, () => fx.post()), 'BYTES_MISMATCH', 'postflight');
  });
  it('refuses a draft over the 128-folder walk budget with LIMIT', async () => {
    const fx = await make({ operation: 'update' });
    for (let i = 0; i < 130; i += 1) await fs.ensureDir(path.join(fx.draft, `d${i}`));
    failure(await untouched(fx, () => fx.pre()), 'LIMIT', 'preflight', 'unavailable');
  });
  it.skipIf(process.platform === 'win32')('refuses a named pipe in the draft root (POSIX only: win32 has no mkfifo; skipped on win32)', async () => {
    const fx = await make({ operation: 'update' });
    const made = spawnSync('mkfifo', [path.join(fx.draft, 'pipe')]);
    expect(made.status).toBe(0);
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });
  it('refuses a missing source checkout with ROOT_CONFLICT', async () => {
    const fx = await make();
    fx.task.source.checkout = path.join(fx.root, 'absent-checkout');
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight', 'unavailable');
  });
  it('refuses an evidence root under a .agents folder with ROOT_CONFLICT', async () => {
    const fx = await make();
    const evidence = path.join(fx.root, '.agents', 'evidence');
    fx.task.roots.evidence = evidence;
    fx.taskFile = path.join(evidence, 'bundle-task.json');
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });
});

describe('the route reference states the coverage split and the evidence (points 9 and 13, addition A)', () => {
  const lf = async (rel: string): Promise<string> => (await fs.readFile(path.resolve(rel), 'utf8')).replace(/\r\n/g, '\n');
  it('says what the checker leaves unchecked, that bundle-check checks it, and what neither checks', async () => {
    const text = await lf('registry/skills/coordinate-artifact/references/bundle-authoring.md');
    for (const needle of [
      'The checker does not check placeholders, other Bundle records in `bundles.json`, field shapes, the members the roster names, `bindings.json` beyond parsing, the leader file beyond UTF-8 or `report.json` beyond being an object',
      'step 9 (`bundle-check`) checks placeholders, the manifest shape, the references to registry members and the Bundle rules',
      'licence truth or quality, and neither does the checker',
      'whole token (not directly preceded or followed by a letter, digit, `_` or `-`) in `bundles.json`, `leader-responsibility.md` or `bindings.json`; `report.json` does not count',
      'the same `agents` and `skills` (same entries, same order) and the same `orchestrator` and `parentBundle` (absent or null where the task has null)',
      'and the notes file `bundle-notes.json` when the fork wrote one',
    ]) expect(text, needle).toContain(needle);
  });
  it('describes the roster binding in the task schema', async () => {
    const schema = await fs.readJson(path.resolve('registry/skills/coordinate-artifact/assets/bundle-task.schema.json'));
    for (const key of ['agents', 'skills', 'orchestrator', 'parentBundle']) expect(schema.properties.bundle.properties[key].description, key).toMatch(/bundles\.json/);
  });
});

describe('the two author-bundle entries stay in step (addition B)', () => {
  const lf = async (rel: string): Promise<string> => (await fs.readFile(path.resolve(rel), 'utf8')).replace(/\r\n/g, '\n');
  it('keeps the whole-Bundle review rule in references/verification.md, named by step 5 of both entries, and out of the entries', async () => {
    expect(await lf('registry/skills/author-bundle/references/verification.md')).toContain('Existing P5 evaluation supports only its declared subject kinds; partition supported component reviews or record whole-Bundle review unavailable.');
    for (const rel of ['registry/skills/author-bundle/SKILL.md', 'registry/hosts/claude/skills/author-bundle/SKILL.md']) {
      const text = await lf(rel);
      const step = text.split('\n').find(line => /^5\. /.test(line)) ?? '';
      expect(step, rel).toContain('(references/verification.md)');
      expect(text, rel).not.toContain('P5 cannot review a whole Bundle');
    }
  });
});
