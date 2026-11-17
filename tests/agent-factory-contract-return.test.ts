/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CHECKER, CONTRIBUTION_TEMPLATE, INSTALLED_RELATIVES, VALIDATOR, canonical, defaultCore, digest, inventoryOf, pinOf, prepareContractTask, renderCoreText, shortPinOf, treeOf, writeSeam,
} from './helpers/contract-task.js';
import type { ContractTaskFixture, Json } from './helpers/contract-task.js';
import { NO_ALT, NO_CASE, NO_SHORT, altLeafOf, otherCaseOf, shortNameOf } from './helpers/path-spellings.js';

// The seam is the real source script as a child process (process.execPath, argv arrays) on disposable roots, with a real
// candidate folder, a real run of registry/skills/author-contract/scripts/draft-pair.mjs as the producer emulation, and the real
// built dist/cli.js as the validator pin. Every case carries exactly one fault and asserts machine codes and exit codes.

const fixtures: ContractTaskFixture[] = [];
const make = async (options?: Parameters<typeof prepareContractTask>[0]): Promise<ContractTaskFixture> => {
  const fixture = await prepareContractTask(options);
  fixtures.push(fixture);
  return fixture;
};
afterEach(async () => { await Promise.all(fixtures.splice(0).map(fixture => fixture.cleanup())); });

/** One JSON object on stderr, nothing on stdout, exit 1, the closed failure envelope. */
function failure(result: SpawnSyncReturns<string>, code: string, phase: string, status?: 'failed' | 'unavailable'): Json {
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim().split('\n')).toHaveLength(1);
  const out = JSON.parse(result.stderr) as Json;
  expect(out).toMatchObject({ version: 1, kind: 'deterministic', phase, code, quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false });
  expect(['failed', 'unavailable']).toContain(out.status);
  if (status) expect(out.status).toBe(status);
  expect(typeof out.reason).toBe('string');
  return out;
}
function success(result: SpawnSyncReturns<string>): Json {
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.trim().split('\n')).toHaveLength(1);
  return JSON.parse(result.stdout) as Json;
}
/** Run `act` and assert that no byte of the whole fixture root (task, return, candidate, pins, installed files) changed. */
async function untouched<T>(fx: ContractTaskFixture, act: () => T): Promise<T> {
  const before = await treeOf(fx.root);
  const value = act();
  expect(await treeOf(fx.root)).toEqual(before);
  return value;
}
const hex = (character: string): string => character.repeat(64);

describe('check-contract-return help and usage', () => {
  it('prints usage text on stdout stating what it does not prove, exits 0 and claims no validation', () => {
    const result = spawnSync(process.execPath, [CHECKER, '--help'], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 30_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('--job <absolute-contract-task.json> [--result <absolute-contract-return.json>]');
    expect(result.stdout).toContain('does not run draft-pair.mjs');
    expect(result.stdout).toContain('who ran');
    expect(result.stdout).toContain('exactly once');
    expect(result.stdout).toContain('usefulness');
    expect(result.stdout.trim().startsWith('{')).toBe(false);
  });

  it.each<[string, (fx: ContractTaskFixture) => string[]]>([
    ['a duplicate --job selector', fx => ['--job', fx.taskFile, '--job', fx.taskFile]],
    ['a duplicate --result selector', fx => ['--job', fx.taskFile, '--result', fx.returnFile, '--result', fx.returnFile]],
    ['a duplicate --help selector', () => ['--help', '--help']],
    ['an unknown flag', fx => ['--job', fx.taskFile, '--unreviewed']],
    ['a positional argument', fx => ['--job', fx.taskFile, 'extra']],
    ['a relative task path', () => ['--job', 'contract-task.json']],
    ['a relative result path', fx => ['--job', fx.taskFile, '--result', 'contract-return.json']],
    ['a traversal alias in the task path', fx => ['--job', `${path.dirname(fx.taskFile)}${path.sep}..${path.sep}evidence${path.sep}contract-task.json`]],
    ['--result without --job', fx => ['--result', fx.returnFile]],
    ['--help together with --job', fx => ['--help', '--job', fx.taskFile]],
    ['--job without a value', () => ['--job']],
    ['no arguments', () => []],
  ])('refuses %s with USAGE and changes nothing', async (_label, argv) => {
    const fx = await make();
    failure(await untouched(fx, () => fx.check(argv(fx))), 'USAGE', 'usage');
  });
});

describe('preflight of a valid task', () => {
  it('passes a create task with the full record, the recomputed pins and no mutation', async () => {
    const fx = await make();
    const out = success(await untouched(fx, () => fx.pre()));
    expect(out).toMatchObject({
      version: 1, kind: 'deterministic', phase: 'preflight', recordValid: true,
      task: await pinOf(fx.taskFile), taskId: 'subagent-review-notes', revision: 'r0', operation: 'create', intent: 'local',
      definition: 'subagent-review-notes', pairPaths: { core: fx.corePath, contract: fx.contractPath },
      taskDigest: digest(canonical(fx.task)), baselineDigest: null,
      quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false,
    });
    expect(out.pins.runtime).toEqual(fx.task.runtime.executable);
    expect(out.pins.checker).toEqual(await pinOf(CHECKER));
    expect(out.pins.validator).toEqual(fx.task.runtime.validator);
    expect(out.pins.installed).toEqual(fx.task.installed);
    expect(out.pins.installed).toHaveLength(19);
    expect(out).not.toHaveProperty('candidate');
    expect(await fs.pathExists(fx.draft)).toBe(false);
  });

  it('passes a reuse task whose source pair pins match the selected source registry', async () => {
    const fx = await make({ operation: 'reuse' });
    const out = success(await untouched(fx, () => fx.pre()));
    expect(out).toMatchObject({
      phase: 'preflight', operation: 'reuse', definition: 'subagent-review-notes',
      pairPaths: { core: fx.corePath, contract: fx.contractPath }, baselineDigest: null, recordValid: true,
    });
    expect(await fs.pathExists(fx.draft)).toBe(false);
  });

  it('passes an update task whose baseline equals the live draft, with the canonical baseline digest', async () => {
    const fx = await make({ operation: 'update' });
    const out = success(await untouched(fx, () => fx.pre()));
    expect(out).toMatchObject({ phase: 'preflight', operation: 'update', recordValid: true });
    const inventory = fx.task.baseline.map((entry: Json) => ({ path: entry.path, kind: 'file', bytes: entry.bytes, sha256: entry.sha256 }))
      .sort((a: Json, b: Json) => (a.path < b.path ? -1 : 1));
    expect(out.baselineDigest).toBe(digest(canonical(inventory)));
    expect(out.baselineDigest).toBe(digest(canonical(await inventoryOf(fx.draft))));
  });

  it('passes an upstream task with its pinned contribution template inside the checkout', async () => {
    const fx = await make({ intent: 'upstream' });
    expect(success(await untouched(fx, () => fx.pre()))).toMatchObject({ intent: 'upstream', recordValid: true });
  });

  it('accepts the r1 update repair of a produced r0 draft, linked to the r0 task and return', async () => {
    const fx = await make();
    await fx.produce();
    const before = await fs.readFile(fx.returnFile);
    await fx.reviseToUpdate();
    expect(fx.task.previous.returnSha256).toBe(digest(before));
    expect(success(await untouched(fx, () => fx.pre()))).toMatchObject({ revision: 'r1', operation: 'update', phase: 'preflight' });
  });
});

describe('preflight refusals: task record', () => {
  const cases: Array<[string, string, ((fx: ContractTaskFixture) => void | Promise<void>), ('failed' | 'unavailable')?]> = [
    ['an unknown task key', 'JOB_INVALID', fx => { fx.task.unreviewed = true; }],
    ['a missing task key', 'JOB_INVALID', fx => { delete fx.task.objective; }],
    ['a wrong kind constant', 'JOB_INVALID', fx => { fx.task.kind = 'skill-task'; }],
    ['a previous link on revision r0', 'JOB_INVALID', fx => { fx.task.previous = { taskId: 'subagent-review-notes', taskDigest: hex('a'), returnSha256: hex('b'), reviewResultSha256: null }; }],
    ['no previous link on revision r1', 'JOB_INVALID', fx => { fx.task.revision = 'r1'; fx.task.operation = 'update'; }],
    ['a revision r1 with operation create instead of update', 'JOB_INVALID', fx => {
      fx.task.revision = 'r1';
      fx.task.previous = { taskId: 'subagent-review-notes', taskDigest: hex('a'), returnSha256: hex('b'), reviewResultSha256: null };
    }],
    ['a revision beyond r1', 'JOB_INVALID', fx => { fx.task.revision = 'r2'; }],
    ['an id that is not kebab-case', 'JOB_INVALID', fx => { fx.task.id = 'Not Kebab'; }],
    ['a definition that is not kebab-case', 'JOB_INVALID', fx => { fx.task.definition = 'Not_Kebab'; }],
    ['a malformed digest in a pin', 'JOB_INVALID', fx => { fx.task.installed[0].sha256 = 'xyz'; }],
    ['eighteen installed pins instead of nineteen', 'JOB_INVALID', fx => { fx.task.installed.pop(); }],
    ['both host version fields set', 'JOB_INVALID', fx => { fx.task.authoringHost.observedVersion = '2.1.0'; }],
    ['a native target', 'JOB_INVALID', fx => { fx.task.target = { host: 'claude' }; }],
    ['publication enabled in the budget', 'JOB_INVALID', fx => { fx.task.budget.publication = true; }],
    ['a candidate file budget above the maximum', 'JOB_INVALID', fx => { fx.task.budget.maxCandidateFiles = 33; }],
    ['duplicate acceptance ids', 'JOB_INVALID', fx => { fx.task.acceptance.push({ ...fx.task.acceptance[0] }); }],
    ['duplicate fixed value names', 'JOB_INVALID', fx => { fx.task.fixedValues.push({ ...fx.task.fixedValues[0] }); }],
    ['roles without the core file as a subject', 'JOB_INVALID', fx => { fx.task.roles[0].role = 'support'; }],
    ['roles without the contract file as a subject', 'JOB_INVALID', fx => { fx.task.roles[1].role = 'support'; }],
    ['a role list that omits an allowed path', 'JOB_INVALID', fx => { fx.task.roles.pop(); }],
  ];
  it.each(cases)('refuses %s', async (_label, code, change, status) => {
    const fx = await make();
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), code, 'preflight', status);
  });

  it('refuses a task that is not at the fixed evidence path', async () => {
    const fx = await make();
    const elsewhere = path.join(fx.root, 'elsewhere', 'contract-task.json');
    await fs.outputFile(elsewhere, JSON.stringify(fx.task));
    failure(await untouched(fx, () => fx.check(['--job', elsewhere])), 'JOB_INVALID', 'preflight');
  });

  it('refuses bytes that are not JSON, and a missing task, as unavailable', async () => {
    const fx = await make();
    await fs.writeFile(fx.taskFile, 'not json\n');
    failure(fx.pre(), 'JOB_INVALID', 'preflight');
    await fs.remove(fx.taskFile);
    failure(fx.pre(), 'JOB_INVALID', 'preflight', 'unavailable');
  });

  it('refuses a task envelope beyond 256 KiB as unavailable', async () => {
    const fx = await make();
    await fs.writeFile(fx.taskFile, JSON.stringify({ ...fx.task, objective: 'x'.repeat(300_000) }));
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight', 'unavailable');
  });
});

describe('preflight refusals: roots', () => {
  const bothDraft = (fx: ContractTaskFixture, draft: string): void => { fx.task.roots.draft = draft; fx.task.draftJobTemplate.draftRoot = draft; };
  const cases: Array<[string, (fx: ContractTaskFixture) => void | Promise<void>]> = [
    ['producer and evidence roots that are equal', fx => { fx.task.roots.producer = fx.evidence; }],
    ['a draft root inside the producer root', fx => bothDraft(fx, path.join(fx.producer, 'draft'))],
    ['a draft root that contains the evidence root', fx => bothDraft(fx, fx.root)],
    ['a managed root that contains the evidence root', fx => { fx.task.roots.managed = [fx.evidence]; fx.task.draftJobTemplate.managedRoots = [fx.evidence]; }],
    ['a protected root that is the producer root', fx => { fx.task.roots.protected = [fx.producer]; fx.task.draftJobTemplate.protectedRoots = [fx.producer]; }],
    ['a draft root inside the source checkout', fx => bothDraft(fx, path.join(fx.task.source.checkout, 'tmp-draft-never-created'))],
    ['a draft root under a .codex directory', fx => bothDraft(fx, path.join(fx.root, '.codex', 'candidate', fx.definition))],
    ['a draft root under a .claude directory', fx => bothDraft(fx, path.join(fx.root, '.claude', 'candidate', fx.definition))],
    ['a producer root under a .cline directory', fx => { fx.task.roots.producer = path.join(fx.root, '.cline', 'producer'); }],
    ['a draft parent holding a stray entry', async fx => { await fs.outputFile(path.join(path.dirname(fx.draft), 'stray.txt'), 'not the draft\n'); }],
    ['a draft parent holding the producer root', async fx => { fx.task.roots.producer = path.join(path.dirname(fx.draft), 'producer'); await fs.ensureDir(fx.task.roots.producer); }],
    ['a linked ancestor of the producer root', async fx => {
      const alias = path.join(fx.root, 'linked-parent');
      await fs.symlink(fx.root, alias, 'junction');
      fx.task.roots.producer = path.join(alias, 'producer');
    }],
    ['a missing source checkout', fx => { fx.task.source.checkout = path.join(fx.root, 'absent-checkout'); fx.task.draftJobTemplate.source.checkout = fx.task.source.checkout; }],
    ['a missing source registry', fx => { fx.task.source.registry = path.join(fx.root, 'absent-registry'); fx.task.draftJobTemplate.source.registry = fx.task.source.registry; }],
  ];
  it.each(cases)('refuses %s with ROOT_CONFLICT', async (_label, change) => {
    const fx = await make();
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });

  it.skipIf(process.platform === 'win32')('refuses a case-variant sibling of the draft folder in the draft parent with ROOT_CONFLICT, on a case-sensitive platform only (skipped on win32)', async () => {
    const fx = await make();
    await fs.ensureDir(path.join(path.dirname(fx.draft), 'Subagent-Review-Notes'));
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });
});

describe('preflight refusals: baseline and live draft state', () => {
  it('refuses a create task whose draft root already exists', async () => {
    const fx = await make();
    await fs.outputFile(path.join(fx.draft, fx.corePath), 'An existing draft.\n');
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });
  it('refuses a reuse task whose draft root already exists', async () => {
    const fx = await make({ operation: 'reuse' });
    await fs.outputFile(path.join(fx.draft, fx.corePath), 'An existing draft.\n');
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });
  it('refuses a create task that carries a baseline', async () => {
    const fx = await make();
    fx.task.baseline = [{ path: fx.corePath, bytes: 1, sha256: hex('a'), snapshot: path.join(fx.evidence, 'x.md') }];
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });

  const update: Array<[string, (fx: ContractTaskFixture) => void | Promise<void>, ('failed' | 'unavailable')?]> = [
    ['a stale baseline (the draft changed after it was taken)', async fx => { await fs.appendFile(path.join(fx.draft, fx.corePath), 'edited later\n'); }],
    ['a draft file that the baseline does not list', async fx => { await fs.outputFile(path.join(fx.draft, 'extra.md'), 'new file\n'); }],
    ['a baseline file that the draft lacks', async fx => { await fs.remove(path.join(fx.draft, 'notes', 'user.md')); }],
    ['an edited baseline snapshot', async fx => { await fs.appendFile(fx.task.baseline[0].snapshot, 'edited\n'); }, 'failed'],
    ['a missing baseline snapshot', async fx => { await fs.remove(fx.task.baseline[0].snapshot); }, 'unavailable'],
    ['a baseline snapshot outside the evidence root', async fx => {
      const moved = path.join(fx.pins, 'moved-snapshot.md');
      await fs.move(fx.task.baseline[0].snapshot, moved);
      fx.task.baseline[0].snapshot = moved;
      fx.task.draftJobTemplate.baseline[0].snapshot.path = moved;
    }],
    ['an empty baseline for an update', fx => { fx.task.baseline = []; fx.task.draftJobTemplate.baseline = []; }],
    ['a missing draft root', async fx => { await fs.remove(fx.draft); }],
  ];
  it.each(update)('refuses an update with %s', async (_label, change, status) => {
    const fx = await make({ operation: 'update' });
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight', status);
  });

  it('refuses a baseline missing from the roles with JOB_INVALID', async () => {
    const fx = await make({ operation: 'update' });
    fx.task.roles = fx.task.roles.filter((role: Json) => role.path !== 'notes/user.md');
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
  });

  it('refuses a linked entry inside the draft folder', async () => {
    const fx = await make({ operation: 'update' });
    await fs.symlink(fx.pins, path.join(fx.draft, 'linked-pins'), 'junction');
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });

  it('refuses a draft over the task file-count and per-file byte budgets with LIMIT', async () => {
    const files = await make({ operation: 'update' });
    files.task.budget.maxCandidateFiles = 1;
    await files.save();
    failure(await untouched(files, () => files.pre()), 'LIMIT', 'preflight');
    const bytes = await make({ operation: 'update' });
    bytes.task.budget.maxCandidateFileBytes = 8;
    await bytes.save();
    failure(await untouched(bytes, () => bytes.pre()), 'LIMIT', 'preflight');
  });
});

describe('preflight refusals: draft job template', () => {
  const cases: Array<[string, (fx: ContractTaskFixture) => void | Promise<void>]> = [
    ['a create template that already carries a proposal', fx => { fx.task.draftJobTemplate.proposal = fx.proposal; }],
    ['a template with an unknown key', fx => { fx.task.draftJobTemplate.command = 'node run.mjs'; }],
    ['a traversal allowed path', fx => { fx.task.draftJobTemplate.allowedPaths[1] = '../escape.json'; }],
    ['an allowed path that is not one of the two derived pair paths', fx => { fx.task.draftJobTemplate.allowedPaths[1] = 'core/other.contract.json'; }],
    ['a single allowed path on a create task', fx => { fx.task.draftJobTemplate.allowedPaths = [fx.corePath]; }],
    ['case-colliding allowed paths', fx => { fx.task.draftJobTemplate.allowedPaths = [fx.corePath, fx.corePath.toUpperCase()]; }],
    ['an empty allowed path list', fx => { fx.task.draftJobTemplate.allowedPaths = []; }],
    ['a non-existent provenance disposition', fx => { fx.task.draftJobTemplate.provenance.disposition = 'borrowed'; }],
    ['a blank provenance author', fx => { fx.task.draftJobTemplate.provenance.author = '   '; }],
    ['unresolved provenance items', fx => { fx.task.draftJobTemplate.provenance.unresolved = ['Owner unknown']; }],
    ['adapted disposition without upstream block', fx => { fx.task.draftJobTemplate.provenance.disposition = 'adapted'; }],
    ['upstream block on original disposition', async fx => {
      const f = path.join(fx.pins, 'src.md');
      await fs.outputFile(f, 'src\n');
      const p = await shortPinOf(f);
      fx.task.draftJobTemplate.provenance.upstream = {
        repository: 'https://example.invalid/r', path: 'a.md', commit: 'a'.repeat(40),
        source: p, license: p, comparison: p, notices: [{ source: p, targetPath: fx.corePath, mode: 'fragment' }],
      };
    }],
    ['a mode that differs from the operation', fx => { fx.task.draftJobTemplate.mode = 'update'; }],
    ['an intent that differs from the task intent', fx => { fx.task.draftJobTemplate.intent = 'upstream'; }],
    ['a definition that differs from the task definition', fx => { fx.task.draftJobTemplate.definition = 'other-def'; }],
    ['a draft root that differs from the task root', fx => { fx.task.draftJobTemplate.draftRoot = path.join(fx.root, 'other', 'draft'); }],
    ['an evidence root that differs from the task evidence root', fx => { fx.task.draftJobTemplate.evidenceRoot = path.join(fx.root, 'other', 'evidence'); }],
    ['a source checkout that differs from the task checkout', fx => { fx.task.draftJobTemplate.source.checkout = path.join(fx.root, 'other-checkout'); }],
    ['a source registry that differs from the task registry', fx => { fx.task.draftJobTemplate.source.registry = path.join(fx.root, 'other-registry'); }],
    ['a source head that differs from the task head', fx => { fx.task.draftJobTemplate.source.head = 'a'.repeat(40); }],
    ['a loading entry that is not the installed entry', fx => { fx.task.draftJobTemplate.loading.entry.path = fx.inst('references/job.md'); }],
    ['an attribution path that is not the installed rule', fx => { fx.task.draftJobTemplate.loading.attribution.path = fx.inst('references/job.md'); }],
    ['a binding path that is not the installed binding receipt', fx => { fx.task.draftJobTemplate.loading.binding.path = fx.inst('references/job.md'); }],
    ['a required file that is not an installed pin', async fx => {
      const extra = path.join(fx.pins, 'extra.txt');
      await fs.outputFile(extra, 'extra\n');
      fx.task.draftJobTemplate.loading.requiredFiles[0] = await shortPinOf(extra);
    }],
    ['a validator cli that is not the pinned validator', fx => { fx.task.draftJobTemplate.validator.cli.path = fx.inst('scripts/draft-pair.mjs'); }],
    ['a validator runtime that is not the pinned executable', fx => { fx.task.draftJobTemplate.validator.runtime.path = fx.inst('scripts/draft-pair.mjs'); }],
    ['a contribution template on a local task', async fx => { fx.task.draftJobTemplate.contributionTemplate = await shortPinOf(CONTRIBUTION_TEMPLATE); }],
    ['a contribution pin on a local task', async fx => { fx.task.contributionTemplate = await pinOf(CONTRIBUTION_TEMPLATE); }],
    ['duplicate binding declarations in the template', fx => {
      fx.task.draftJobTemplate.bindings = [
        { kind: 'skill', id: 'review-notes', required: false, evidence: [] },
        { kind: 'skill', id: 'review-notes', required: false, evidence: [] },
      ];
    }],
    ['a required binding whose evidence file is absent', fx => {
      fx.task.draftJobTemplate.bindings = [{
        kind: 'skill', id: 'review-notes', required: true,
        evidence: [{ path: path.join(fx.sourceRegistry, 'skills', 'absent-skill', 'SKILL.md'), sha256: hex('a') }],
      }];
    }],
  ];
  it.each(cases)('refuses %s with TEMPLATE_INVALID', async (_label, change) => {
    const fx = await make();
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'TEMPLATE_INVALID', 'preflight');
  });

  it('refuses a reuse task whose template omits proposal or points outside the source registry with TEMPLATE_INVALID', async () => {
    const missing = await make({ operation: 'reuse' });
    delete missing.task.draftJobTemplate.proposal;
    await missing.save();
    failure(await untouched(missing, () => missing.pre()), 'TEMPLATE_INVALID', 'preflight');

    const wrongPath = await make({ operation: 'reuse' });
    const copy = path.join(wrongPath.pins, 'copied.core.md');
    await fs.copy(wrongPath.task.draftJobTemplate.proposal.coreFile.path, copy);
    wrongPath.task.draftJobTemplate.proposal.coreFile = await shortPinOf(copy);
    await wrongPath.save();
    failure(await untouched(wrongPath, () => wrongPath.pre()), 'TEMPLATE_INVALID', 'preflight');

    const badHash = await make({ operation: 'reuse' });
    badHash.task.draftJobTemplate.proposal.coreFile.sha256 = hex('9');
    await badHash.save();
    failure(await untouched(badHash, () => badHash.pre()), 'TEMPLATE_INVALID', 'preflight');
  });

  it('refuses an update task whose protectedNote substring is absent from the baseline with TEMPLATE_INVALID', async () => {
    const fx = await make({ operation: 'update' });
    fx.task.draftJobTemplate.protectedNotes = [{ path: fx.corePath, contains: 'This substring is not in the baseline.' }];
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'TEMPLATE_INVALID', 'preflight');
  });

  const upstream: Array<[string, (fx: ContractTaskFixture) => void | Promise<void>]> = [
    ['an upstream task without a contribution template', fx => { delete fx.task.draftJobTemplate.contributionTemplate; fx.task.contributionTemplate = null; }],
    ['an upstream task without the template pin', fx => { fx.task.contributionTemplate = null; }],
    ['a template pin that differs from the file', fx => { fx.task.contributionTemplate.sha256 = hex('c'); }],
    ['a template outside the pinned checkout', async fx => {
      const outside = path.join(fx.pins, 'artifact-contribution.md');
      await fs.copy(CONTRIBUTION_TEMPLATE, outside);
      fx.task.draftJobTemplate.contributionTemplate = await shortPinOf(outside);
      fx.task.contributionTemplate = await pinOf(outside);
    }],
  ];
  it.each(upstream)('refuses %s with TEMPLATE_INVALID', async (_label, change) => {
    const fx = await make({ intent: 'upstream' });
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'TEMPLATE_INVALID', 'preflight');
  });
});

describe('preflight refusals: the installed author-contract closure and loader', () => {
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
  it('refuses an installed pin set that is not the reviewed nineteen (one path renamed)', async () => {
    const fx = await make();
    await fs.copy(fx.inst('references/reuse.md'), fx.inst('references/reuse-copy.md'));
    fx.task.installed[3] = await pinOf(fx.inst('references/reuse-copy.md'));
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'CLOSURE_MISSING', 'preflight');
  });
  it('refuses an installed folder that is not named author-contract', async () => {
    const fx = await make();
    const renamed = path.join(path.dirname(fx.installedRoot), 'author-contract-copy');
    await fs.copy(fx.installedRoot, renamed);
    fx.task.installed = await Promise.all(INSTALLED_RELATIVES.map(rel => pinOf(path.join(renamed, ...rel.split('/')))));
    fx.task.draftJobTemplate.loading.entry = { path: path.join(renamed, 'SKILL.md'), sha256: fx.task.installed[0].sha256 };
    fx.task.draftJobTemplate.loading.binding = { path: path.join(renamed, 'assets', 'claude-binding.json'), sha256: fx.task.installed[1].sha256 };
    fx.task.draftJobTemplate.loading.attribution = {
      path: path.join(renamed, 'references', 'skill-attribution.md'),
      sha256: fx.task.installed.find((p: Json) => p.path.endsWith('skill-attribution.md')).sha256,
    };
    fx.task.draftJobTemplate.loading.requiredFiles = fx.task.installed.map((p: Json) => ({ path: p.path, sha256: p.sha256 }));
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'CLOSURE_MISSING', 'preflight');
  });

  const loader: Array<[string, (text: string) => string]> = [
    ['no fork context', text => text.replace(/^context: fork\r?\n/m, '')],
    ['a wrong built-in agent', text => text.replace('agent: general-purpose', 'agent: Explore')],
    ['a foreground-flag change (background: true)', text => text.replace('background: false', 'background: true')],
    ['a missing background flag', text => text.replace(/^background: false\r?\n/m, '')],
    ['a disable-model-invocation flag', text => text.replace(/^background: false\r?\n/m, 'background: false\ndisable-model-invocation: true\n')],
    ['a different skill name', text => text.replace('name: author-contract', 'name: other-skill')],
    ['a repeated background key after the real one', text => text.replace(/^(background: false\r?\n)/m, '$1background: true\n')],
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

  it('refuses a tampered binding receipt that changes the loading role or skill name with LOADER_MECHANISM', async () => {
    const fx = await make();
    const file = fx.inst('assets/claude-binding.json');
    const binding = await fs.readJson(file);
    binding.loadingRole.background = true;
    await fs.writeFile(file, JSON.stringify(binding, null, 2) + '\n');
    await fx.repinInstalled('assets/claude-binding.json');
    failure(await untouched(fx, () => fx.pre()), 'LOADER_MECHANISM', 'preflight');
  });

  it('scans a frontmatter line with 20,000 spaces and a Unicode line separator within two seconds and matches the result without the separator', async () => {
    const fx = await make();
    const file = fx.inst('SKILL.md');
    const original = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, original.replace('agent: general-purpose', `agent: general-purpose${' '.repeat(20_000)}`));
    await fx.repinInstalled('SKILL.md');
    expect(success(fx.pre()).recordValid).toBe(true);
    await fs.writeFile(file, original.replace('agent: general-purpose', `agent: general-purpose${' '.repeat(20_000)}\u2028`));
    await fx.repinInstalled('SKILL.md');
    const started = Date.now();
    const result = await untouched(fx, () => fx.pre());
    expect(Date.now() - started).toBeLessThan(2000);
    expect(success(result).recordValid).toBe(true);
  });
});

describe('preflight refusals: runtime pins and checkout head', () => {
  const cases: Array<[string, (fx: ContractTaskFixture) => void | Promise<void>, ('failed' | 'unavailable')?]> = [
    ['an executable that is not the running Node', async fx => { fx.task.runtime.executable = await pinOf(fx.inst('scripts/draft-pair.mjs')); }, 'failed'],
    ['an executable pin with the wrong hash', fx => { fx.task.runtime.executable.sha256 = hex('d'); }, 'failed'],
    ['a checker that is not this installed script', async fx => { fx.task.runtime.checker = await pinOf(fx.inst('scripts/draft-pair.mjs')); }, 'failed'],
    ['a checker pin with the wrong length', fx => { fx.task.runtime.checker.bytes += 1; }, 'failed'],
    ['a validator pin with the wrong hash', fx => { fx.task.runtime.validator.sha256 = hex('e'); }, 'failed'],
    ['a validator pin that is not <checkout>/dist/cli.js', async fx => {
      const copy = path.join(fx.pins, 'cli.js');
      await fs.copy(VALIDATOR, copy);
      fx.task.runtime.validator = await pinOf(copy);
      fx.task.draftJobTemplate.validator.cli = await shortPinOf(copy);
    }, 'failed'],
    ['a missing validator', fx => { fx.task.runtime.validator.path = path.join(fx.root, 'absent', 'cli.js'); }, 'unavailable'],
  ];
  it.each(cases)('refuses %s with RUNTIME_MISMATCH', async (_label, change, status) => {
    const fx = await make();
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'RUNTIME_MISMATCH', 'preflight', status);
  });

  it('refuses a checkout whose HEAD is not the pinned head with CHECKOUT_HEAD', async () => {
    const fx = await make();
    fx.task.source.head = '0'.repeat(40);
    fx.task.draftJobTemplate.source.head = '0'.repeat(40);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'CHECKOUT_HEAD', 'preflight');
  });

  it('refuses a pinned input that changes between its first read and the final recheck with STALE_INPUT', async () => {
    const fx = await make();
    const preload = await writeSeam(fx.root);
    const result = fx.check(['--job', fx.taskFile], { preload, env: { SEAM_WHEN: path.join('references', 'job.md'), SEAM_TARGET: fx.taskFile } });
    failure(result, 'STALE_INPUT', 'preflight', 'unavailable');
  });
});

describe('postflight of a produced draft', () => {
  it('passes a create run: recomputed inventory, changed list, preserved list, definition/pairPaths and contract-check compatibility', async () => {
    const fx = await make();
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    const out = success(await untouched(fx, () => fx.post()));
    const inventory = await inventoryOf(fx.draft);
    expect(out).toMatchObject({
      version: 1, kind: 'deterministic', phase: 'postflight', recordValid: true,
      taskId: 'subagent-review-notes', operation: 'create', definition: 'subagent-review-notes',
      pairPaths: { core: fx.corePath, contract: fx.contractPath },
      taskDigest: digest(canonical(fx.task)), result: await pinOf(fx.returnFile), helper: { exitCode: 0, reportStatus: 'draft-prepared' },
      claimsNotAccepted: ['inventory', 'changed', 'claimedChecks'], producerIdentity: 'unauthenticated',
      quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false,
    });
    expect(out.candidate).toEqual({
      draftRoot: fx.draft, definition: 'subagent-review-notes', pairPaths: { core: fx.corePath, contract: fx.contractPath },
      inventory, candidateDigest: digest(canonical(inventory)),
      changed: [{ path: fx.contractPath, operation: 'create' }, { path: fx.corePath, operation: 'create' }], preserved: [],
    });
    expect(out.candidate.candidateDigest).toBe(digest(JSON.stringify(inventory.map(({ bytes, kind, path: file, sha256 }) => ({ bytes, kind, path: file, sha256 })))));
    const validator = spawnSync(process.execPath, [VALIDATOR, 'contract-check', '--registry', fx.draft, '--definition', out.candidate.definition],
      { cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000 });
    expect(validator.status, validator.stdout + validator.stderr).toBe(0);
    const validated = JSON.parse(validator.stdout) as Json;
    expect(validated).toMatchObject({ valid: true, definition: 'subagent-review-notes', delivery: 'unverified', quality: 'pending', live: 'unverified' });
  });

  it('passes a reuse run that copies the source pair byte-for-byte without normalizing CRLF or JSON key order', async () => {
    const fx = await make({ operation: 'reuse' });
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.operation).toBe('reuse');
    expect(out.candidate.changed).toEqual([{ path: fx.contractPath, operation: 'create' }, { path: fx.corePath, operation: 'create' }]);
    expect(await fs.readFile(path.join(fx.draft, ...fx.corePath.split('/')))).toEqual(await fs.readFile(fx.proposal.coreFile.path));
    expect(await fs.readFile(path.join(fx.draft, ...fx.contractPath.split('/')))).toEqual(await fs.readFile(fx.proposal.contractFile.path));
  });

  it('passes an update run that preserves the companion and maintainer notes, and lists what it preserved', async () => {
    const fx = await make({ operation: 'update' });
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.candidate.changed).toEqual([{ path: fx.corePath, operation: 'update' }]);
    expect(out.candidate.preserved).toEqual([fx.contractPath, 'notes/user.md']);
    expect(await fs.readFile(path.join(fx.draft, 'notes', 'user.md'), 'utf8')).toBe('The maintainer wrote this note by hand.\n');
    expect(out.baselineDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('passes an update run that changes both pair files and a report whose diff entries are in reverse order', async () => {
    const fx = await make({ operation: 'update' });
    fx.task.draftJobTemplate.allowedPaths = [fx.corePath, fx.contractPath];
    fx.task.baseline.reverse();
    fx.task.draftJobTemplate.baseline.reverse();
    fx.proposal = {
      coreText: fx.proposal.coreText,
      contract: { definition: fx.definition, workflows: ['review-flow'], skills: [], hooks: [] },
    };
    await fx.save();
    expect(success(fx.pre()).recordValid).toBe(true);
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.candidate.changed).toEqual([
      { path: fx.contractPath, operation: 'update' },
      { path: fx.corePath, operation: 'update' },
    ]);
    expect(out.candidate.preserved).toEqual(['notes/user.md']);
    produced.report!.diff.reverse();
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    expect(success(await untouched(fx, () => fx.post())).candidate.changed).toEqual([
      { path: fx.contractPath, operation: 'update' },
      { path: fx.corePath, operation: 'update' },
    ]);
  });

  it('passes an upstream run whose report prepares the pinned template with sent false', async () => {
    const fx = await make({ intent: 'upstream' });
    const produced = await fx.produce();
    expect(produced.report?.upstreamPreparation).toMatchObject({ base: 'dev', sent: false });
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ intent: 'upstream', phase: 'postflight', helper: { reportStatus: 'draft-prepared' } });
  });

  it('passes an adapted provenance run with retained notice bytes and checked binding evidence', async () => {
    const fx = await make();
    const upstreamSource = path.join(fx.pins, 'upstream.core.md');
    const upstreamLicense = path.join(fx.pins, 'LICENSE');
    const comparison = path.join(fx.pins, 'comparison.md');
    const skillSource = path.join(fx.sourceRegistry, 'skills', 'review-notes', 'SKILL.md');
    const noticeText = 'Copyright 2026 Upstream Fixture. Retained verbatim.\n';
    await fs.outputFile(upstreamSource, 'Upstream core fixture.\n');
    await fs.outputFile(upstreamLicense, noticeText);
    await fs.outputFile(comparison, 'Comparison record.\n');
    await fs.outputFile(skillSource, 'Skill source.\n');
    const licensePin = await shortPinOf(upstreamLicense);
    const skillPin = await shortPinOf(skillSource);
    fx.task.draftJobTemplate.provenance = {
      disposition: 'adapted', author: 'Fixture Author', license: 'MIT', evidence: [], unresolved: [],
      upstream: {
        repository: 'https://example.invalid/upstream', path: 'core/reviewer.core.md', commit: fx.task.source.head,
        source: await shortPinOf(upstreamSource), license: licensePin, comparison: await shortPinOf(comparison),
        notices: [{ source: licensePin, targetPath: fx.corePath, mode: 'fragment' }],
      },
    };
    fx.task.draftJobTemplate.bindings = [{ kind: 'skill', id: 'review-notes', required: true, evidence: [skillPin] }];
    fx.proposal.body += noticeText;
    fx.proposal.contract.skills = ['review-notes'];
    await fx.save();
    expect(success(fx.pre()).recordValid).toBe(true);
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ phase: 'postflight', helper: { reportStatus: 'draft-prepared' } });
  });

  it('passes preflight and postflight when an optional binding has absent evidence, and refuses a forged verified finding for it', async () => {
    const fx = await make();
    const absentPin = { path: path.join(fx.sourceRegistry, 'skills', 'absent-skill', 'SKILL.md'), sha256: hex('a') };
    fx.task.draftJobTemplate.bindings = [{ kind: 'skill', id: 'absent-skill', required: false, evidence: [absentPin] }];
    fx.proposal.contract.skills = ['absent-skill'];
    await fx.save();
    expect(success(await untouched(fx, () => fx.pre())).recordValid).toBe(true);
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    expect(produced.report?.bindingFindings).toMatchObject([
      { kind: 'skill', id: 'absent-skill', required: false, source: 'unavailable', execution: 'unverified', evidence: [] },
    ]);
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ phase: 'postflight', helper: { reportStatus: 'draft-prepared' } });
    produced.report!.bindingFindings = [
      { kind: 'skill', id: 'absent-skill', required: false, source: 'checked', execution: 'unverified', evidence: [absentPin] },
    ];
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
  });

  it('passes the r1 update repair after r0, and refuses the r0 return presented for r1 with DIGEST_MISMATCH', async () => {
    const fx = await make();
    await fx.produce();
    const r0Return = await fs.readFile(fx.returnFile);
    await fx.reviseToUpdate();
    await fs.outputFile(fx.returnFile, r0Return);
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    expect(success(fx.post())).toMatchObject({ revision: 'r1', operation: 'update', helper: { reportStatus: 'draft-prepared' } });
  });

  it('passes a truthful blocked return and leaves the draft absent', async () => {
    const fx = await make();
    const produced = await fx.produce({ proposal: { ...fx.proposal, body: 'Missing the fixed value.\n' } });
    expect(produced.run.status).toBe(1);
    expect(JSON.parse(produced.run.stderr).status).toBe('blocked');
    const out = success(await untouched(fx, () => fx.post()));
    expect(out).toMatchObject({ helper: { exitCode: 1, reportStatus: 'blocked' }, candidate: null, acceptedDraft: false });
    expect(await fs.pathExists(fx.draft)).toBe(false);
  });

  it('passes a blocked return that never ran the helper (runs 0) when the draft is untouched', async () => {
    const fx = await make();
    const produced = await fx.produce({ proposal: { ...fx.proposal, body: 'Missing the fixed value.\n' } });
    Object.assign(produced.ret, { helper: { draftJob: null, stdout: null, stderr: null, exitCode: null, runs: 0 }, inventory: [], changed: [] });
    await produced.save();
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ helper: { exitCode: null, reportStatus: 'blocked' }, candidate: null });
  });

  it('executes nothing supplied by the task, the return or the candidate', async () => {
    const fx = await make();
    const marker = path.join(fx.root, 'must-not-exist.txt');
    const payload = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')`;
    expect(success(fx.pre()).recordValid).toBe(true);
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    produced.ret.claimedChecks = [{ name: 'hostile', command: `node -e "${payload}"`, exitCode: 0, raw: null }];
    await produced.save();
    const out = success(await untouched(fx, () => fx.post()));
    expect(out).toMatchObject({ executionProof: 'unverified', acceptedDraft: false, claimsNotAccepted: ['inventory', 'changed', 'claimedChecks'] });
    expect(await fs.pathExists(marker)).toBe(false);
  });

  it('refuses, and changes no byte of, a create preflight over a draft root that a run already created', async () => {
    const fx = await make();
    await fx.produce();
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });
});

describe('postflight refusals: return record and helper files', () => {
  it('refuses a return that is not at the fixed producer path with RESULT_PATH', async () => {
    const fx = await make();
    await fx.produce();
    const other = path.join(fx.producer, 'other-return.json');
    await fs.copy(fx.returnFile, other);
    failure(await untouched(fx, () => fx.post(other)), 'RESULT_PATH', 'postflight');
  });

  it.skipIf(process.platform === 'win32')('refuses a return presented under a case-variant name with RESULT_PATH, on a case-sensitive platform only (skipped on win32)', async () => {
    const fx = await make();
    await fx.produce();
    const variant = path.join(fx.producer, 'Contract-Return.json');
    await fs.move(fx.returnFile, variant);
    failure(await untouched(fx, () => fx.post(variant)), 'RESULT_PATH', 'postflight');
  });

  it('refuses a missing return as unavailable', async () => {
    const fx = await make();
    failure(await untouched(fx, () => fx.post()), 'RESULT_INVALID', 'postflight', 'unavailable');
  });

  const record: Array<[string, (ret: Json) => void]> = [
    ['an unknown return key', ret => { ret.unreviewed = true; }],
    ['a missing return key', ret => { delete ret.unverified; }],
    ['a wrong kind constant', ret => { ret.kind = 'skill-return'; }],
    ['a status outside draft and blocked', ret => { ret.status = 'accepted'; }],
    ['a helper exit code of 2', ret => { ret.helper.exitCode = 2; }],
    ['more than sixteen claimed checks', ret => { ret.claimedChecks = Array.from({ length: 17 }, () => ({ name: 'c', command: 'x', exitCode: 0, raw: null })); }],
    ['a malformed task digest', ret => { ret.taskDigest = 'not-a-digest'; }],
    ['a blocked status without open items', ret => { ret.status = 'blocked'; ret.openItems = []; }],
    ['runs 0 together with helper file pins', ret => { ret.helper.runs = 0; }],
    ['a helper stderr pin claiming 65537 bytes', ret => { ret.helper.stderr.bytes = 65537; }],
  ];
  it.each(record)('refuses %s with RESULT_INVALID', async (_label, change) => {
    const fx = await make();
    const produced = await fx.produce();
    change(produced.ret);
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'RESULT_INVALID', 'postflight');
  });

  it('refuses return bytes that are not JSON, and a return beyond 256 KiB as unavailable', async () => {
    const fx = await make();
    const produced = await fx.produce();
    await fs.writeFile(fx.returnFile, 'not json\n');
    failure(fx.post(), 'RESULT_INVALID', 'postflight');
    produced.ret.unverified = ['x'.repeat(300_000)];
    await fs.writeFile(fx.returnFile, JSON.stringify(produced.ret));
    failure(await untouched(fx, () => fx.post()), 'RESULT_INVALID', 'postflight', 'unavailable');
  });

  it('refuses a stale task digest and a different task id with DIGEST_MISMATCH', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.ret.taskDigest = hex('0');
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
    produced.ret.taskDigest = digest(canonical(fx.task));
    produced.ret.taskId = 'another-task';
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
  });

  it('refuses a task changed after the return was written (the return echoes the old digest)', async () => {
    const fx = await make();
    await fx.produce();
    fx.task.objective = 'A different objective than the one the fork saw.';
    await fx.save();
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
  });

  it('refuses a stdout whose bytes changed after pinning, by hash and by length', async () => {
    const fx = await make();
    const produced = await fx.produce();
    const original = await fs.readFile(produced.stdoutFile, 'utf8');
    await fs.writeFile(produced.stdoutFile, original.replace('draft-prepared', 'draft-prepareD'));
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    await fs.writeFile(produced.stdoutFile, `${original} `);
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
  });

  it('refuses a changed stderr, a changed saved job and a missing helper file', async () => {
    const fx = await make();
    const produced = await fx.produce();
    await fs.appendFile(produced.stderrFile, 'late text\n');
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    await fs.writeFile(produced.stderrFile, produced.run.stderr);
    await fs.appendFile(produced.jobFile, '\n');
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    await fs.writeFile(produced.jobFile, JSON.stringify(produced.job, null, 2));
    await fs.remove(produced.stdoutFile);
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight', 'unavailable');
  });

  it('refuses a helper pin outside the producer root and a report pin that is missing', async () => {
    const fx = await make();
    const produced = await fx.produce();
    const outside = path.join(fx.pins, 'draft.stdout.json');
    await fs.copy(produced.stdoutFile, outside);
    produced.ret.helper.stdout = await pinOf(outside);
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    produced.ret.helper.stdout = await pinOf(produced.stdoutFile);
    await produced.save();
    await fs.remove(produced.reportFile);
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight', 'unavailable');
  });

  it('refuses an exit code claim that contradicts the pinned files', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.ret.helper.exitCode = 1;
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
  });

  it('refuses a blocked helper run whose saved stderr is not valid UTF-8 with HELPER_RECORD and status failed', async () => {
    const fx = await make();
    const produced = await fx.produce({ proposal: { ...fx.proposal, body: 'Missing the fixed value.\n' } });
    await fs.writeFile(produced.stderrFile, Buffer.from([0xff, 0xfe, 0xfd]));
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight', 'failed');
  });

  it('refuses a forged validation, quality or digest field in the helper report', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.report!.validation = 'passed';
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    produced.report!.validation = 'unverified';
    produced.report!.digest = hex('1');
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
  });

  it('refuses a helper report with a different mode, a forged bindingFindings entry, or an unknown key', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.report!.mode = 'update';
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    produced.report!.mode = 'create';
    produced.report!.bindingFindings = [{ kind: 'skill', id: 'invented', required: false, source: 'checked', execution: 'unverified', evidence: [] }];
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    produced.report!.bindingFindings = [];
    produced.report!.published = true;
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
  });
});

describe('postflight refusals: blocked and staging state', () => {
  it('refuses a draft status over a blocked helper run with BLOCKED_STATE', async () => {
    const fx = await make();
    const produced = await fx.produce({ proposal: { ...fx.proposal, body: 'Missing the fixed value.\n' } });
    produced.ret.status = 'draft';
    produced.ret.openItems = [];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses a blocked status over a prepared helper run with BLOCKED_STATE', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.ret.status = 'blocked';
    produced.ret.openItems = [{ id: 'x', description: 'claims a block' }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses a blocked return over a draft root that appeared', async () => {
    const fx = await make();
    await fx.produce({ proposal: { ...fx.proposal, body: 'Missing the fixed value.\n' } });
    await fs.outputFile(path.join(fx.draft, fx.corePath), 'A draft appeared behind the blocked return.\n');
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses a blocked update return over a modified draft', async () => {
    const fx = await make({ operation: 'update' });
    const produced = await fx.produce({ proposal: { coreText: 'Missing the fixed value.\n' } });
    expect(produced.run.status).toBe(1);
    await fs.appendFile(path.join(fx.draft, fx.corePath), 'edited while blocked\n');
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses a blocked return that claims changes', async () => {
    const fx = await make();
    const produced = await fx.produce({ proposal: { ...fx.proposal, body: 'Missing the fixed value.\n' } });
    produced.ret.changed = [{ path: fx.corePath, operation: 'create' }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses a staging sibling left in the draft parent', async () => {
    const fx = await make();
    await fx.produce();
    await fs.ensureDir(path.join(path.dirname(fx.draft), '.author-contract-abc123'));
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses a blocked return with non-empty externalActions with EXTERNAL_ACTION', async () => {
    const fx = await make();
    const produced = await fx.produce({ proposal: { ...fx.proposal, body: 'Missing the fixed value.\n' } });
    produced.ret.externalActions = ['pushed a branch while blocked'];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'EXTERNAL_ACTION', 'postflight');
  });
});

describe('postflight refusals: saved draft job', () => {
  const cases: Array<[string, (job: Json) => void]> = [
    ['a different provenance author', job => { job.provenance.author = 'Someone Else'; }],
    ['a different draft root', job => { job.draftRoot = path.join(os.tmpdir(), 'elsewhere-draft'); }],
    ['an extra job key', job => { job.command = 'node run.mjs'; }],
    ['a missing job key', job => { delete job.validator; }],
    ['a proposal with an extra key in create mode', job => { job.proposal.coreText = 'not allowed in create\n'; }],
    ['a proposal with an unknown core key', job => { job.proposal.core.tools = ['Bash']; }],
    ['a proposal contract whose definition differs from the task definition', job => { job.proposal.contract.definition = 'other-def'; }],
    ['a proposal missing the fixed value', job => { job.proposal.body = '## Notes\nNo fixed value here.\n'; }],
  ];
  it.each(cases)('refuses %s with DRAFT_JOB_MISMATCH', async (_label, edit) => {
    const fx = await make();
    const produced = await fx.produce();
    edit(produced.job);
    await fs.writeFile(produced.jobFile, JSON.stringify(produced.job, null, 2));
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'DRAFT_JOB_MISMATCH', 'postflight');
  });

  it('refuses an update job whose baseline differs from the task template baseline or updates a disallowed path', async () => {
    const fx = await make({ operation: 'update' });
    const produced = await fx.produce();
    produced.job.baseline[0].sha256 = hex('9');
    await fs.writeFile(produced.jobFile, JSON.stringify(produced.job, null, 2));
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'DRAFT_JOB_MISMATCH', 'postflight');

    const outOfScope = await make({ operation: 'update' });
    const produced2 = await outOfScope.produce();
    produced2.job.proposal.contract = { definition: outOfScope.definition, workflows: [], skills: [], hooks: [] };
    await fs.writeFile(produced2.jobFile, JSON.stringify(produced2.job, null, 2));
    await produced2.repin();
    failure(await untouched(outOfScope, () => outOfScope.post()), 'DRAFT_JOB_MISMATCH', 'postflight');
  });

  it('refuses a reuse job whose proposal differs from the template proposal', async () => {
    const fx = await make({ operation: 'reuse' });
    const produced = await fx.produce();
    produced.job.proposal.coreFile.sha256 = hex('7');
    await fs.writeFile(produced.jobFile, JSON.stringify(produced.job, null, 2));
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'DRAFT_JOB_MISMATCH', 'postflight');
  });
});

describe('postflight refusals: final bytes against baseline, scope, protected notes and proposal', () => {
  it('refuses an extra file with SCOPE_VIOLATION', async () => {
    const fx = await make();
    await fx.produce();
    await fs.outputFile(path.join(fx.draft, 'extra.md'), 'not authorized\n');
    failure(await untouched(fx, () => fx.post()), 'SCOPE_VIOLATION', 'postflight');
  });

  it('refuses a deleted baseline file with SCOPE_VIOLATION', async () => {
    const fx = await make({ operation: 'update' });
    await fx.produce();
    await fs.remove(path.join(fx.draft, 'notes', 'user.md'));
    failure(await untouched(fx, () => fx.post()), 'SCOPE_VIOLATION', 'postflight');
  });

  it('refuses a changed preservation-only note with PRESERVATION', async () => {
    const fx = await make({ operation: 'update' });
    await fx.produce();
    await fs.writeFile(path.join(fx.draft, 'notes', 'user.md'), 'Rewritten after the run.\n');
    failure(await untouched(fx, () => fx.post()), 'PRESERVATION', 'postflight');
  });

  it('refuses a baseline file outside the proposal changes that differs from its baseline bytes with PRESERVATION', async () => {
    const fx = await make({ operation: 'update' });
    await fx.produce();
    await fs.writeFile(path.join(fx.draft, ...fx.contractPath.split('/')), '{"definition":"subagent-review-notes","workflows":["x"],"skills":[],"hooks":[]}\n');
    failure(await untouched(fx, () => fx.post()), 'PRESERVATION', 'postflight');
  });

  it('refuses an update whose proposal drops a protectedNotes substring with PRESERVATION', async () => {
    const fx = await make({ operation: 'update' });
    const produced = await fx.produce();
    const dropped = renderCoreText(defaultCore(), '## Notes\nOwner: unknown\nDropped the protected note.\n');
    produced.job.proposal = { coreText: dropped };
    await fs.writeFile(produced.jobFile, JSON.stringify(produced.job, null, 2));
    await fs.writeFile(path.join(fx.draft, ...fx.corePath.split('/')), dropped);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'PRESERVATION', 'postflight');
  });

  it('refuses final bytes that differ from the saved proposal with BYTES_MISMATCH', async () => {
    const fx = await make();
    await fx.produce();
    await fs.appendFile(path.join(fx.draft, ...fx.corePath.split('/')), 'Edited after the helper ran.\n');
    failure(await untouched(fx, () => fx.post()), 'BYTES_MISMATCH', 'postflight');
  });

  it('refuses a pair file that is missing from the final draft with BYTES_MISMATCH', async () => {
    const fx = await make();
    await fx.produce();
    await fs.remove(path.join(fx.draft, ...fx.contractPath.split('/')));
    failure(await untouched(fx, () => fx.post()), 'BYTES_MISMATCH', 'postflight');
  });
});

describe('postflight refusals: the claimed inventory, diff, provenance and external actions', () => {
  it('refuses an inventory that omits a path, adds a path or misstates a hash with INVENTORY_MISMATCH', async () => {
    const fx = await make();
    const produced = await fx.produce();
    const original = structuredClone(produced.ret.inventory);
    produced.ret.inventory = original.slice(1);
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
    produced.ret.inventory = [...original, { path: 'invented.md', bytes: 1, sha256: hex('1') }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
    produced.ret.inventory = original.map((item: Json, index: number) => (index === 0 ? { ...item, sha256: hex('2') } : item));
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
  });

  it('refuses a helper report inventory that omits or adds a path with INVENTORY_MISMATCH', async () => {
    const fx = await make();
    const produced = await fx.produce();
    const original = structuredClone(produced.report!.inventory);
    produced.report!.inventory = original.slice(1);
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
    produced.report!.inventory = [...original, { path: 'invented.md', sha256: hex('1'), bytes: 1 }];
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
  });

  it('refuses a helper report unchanged list that disagrees with the recomputed unchanged files with INVENTORY_MISMATCH', async () => {
    const fx = await make({ operation: 'update' });
    const produced = await fx.produce();
    produced.report!.unchanged = [];
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
  });

  it('refuses a false diff in the helper report with DIFF_MISMATCH', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.report!.diff[0].after = 'A diff that the bytes do not support.\n';
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'DIFF_MISMATCH', 'postflight');
  });

  it('refuses a false changed list in the return with DIFF_MISMATCH', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.ret.changed = [{ path: fx.contractPath, operation: 'update' }, { path: fx.corePath, operation: 'create' }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'DIFF_MISMATCH', 'postflight');
    produced.ret.changed = [{ path: fx.corePath, operation: 'create' }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'DIFF_MISMATCH', 'postflight');
  });

  it('refuses a false provenance block or altered retainedNotices with PROVENANCE_MISMATCH', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.report!.provenance.license = 'Apache-2.0';
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'PROVENANCE_MISMATCH', 'postflight');
    produced.report!.provenance.license = 'MIT';
    delete produced.report!.provenance.review;
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'PROVENANCE_MISMATCH', 'postflight');
  });

  it('refuses non-empty externalActions in the report and in the return with EXTERNAL_ACTION', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.ret.externalActions = ['pushed a branch'];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'EXTERNAL_ACTION', 'postflight');
    produced.ret.externalActions = [];
    produced.report!.externalActions = ['sent a pull request'];
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'EXTERNAL_ACTION', 'postflight');
  });

  const upstream: Array<[string, (report: Json) => void]> = [
    ['sent true', report => { report.upstreamPreparation.sent = true; }],
    ['a base other than dev', report => { report.upstreamPreparation.base = 'main'; }],
    ['a body that does not begin with the pinned template', report => { report.upstreamPreparation.body = `Invented body.\n${report.upstreamPreparation.body}`; }],
  ];
  it.each(upstream)('refuses an upstream preparation with %s with EXTERNAL_ACTION', async (_label, edit) => {
    const fx = await make({ intent: 'upstream' });
    const produced = await fx.produce();
    edit(produced.report!);
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'EXTERNAL_ACTION', 'postflight');
  });

  it('refuses an upstream preparation on a local task and a missing one on an upstream task', async () => {
    const local = await make();
    const produced = await local.produce();
    produced.report!.upstreamPreparation = { base: 'dev', sent: false, templatePath: CONTRIBUTION_TEMPLATE, body: 'x' };
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(local, () => local.post()), 'HELPER_RECORD', 'postflight');
    const remote = await make({ intent: 'upstream' });
    const prepared = await remote.produce();
    delete prepared.report!.upstreamPreparation;
    await fs.writeFile(prepared.stdoutFile, `${JSON.stringify(prepared.report, null, 2)}\n`);
    await prepared.repin();
    failure(await untouched(remote, () => remote.post()), 'HELPER_RECORD', 'postflight');
  });

  it('refuses an upstream preparation whose templatePath is relative or differently cased with HELPER_RECORD', async () => {
    const fx = await make({ intent: 'upstream' });
    const produced = await fx.produce();
    produced.report!.upstreamPreparation.templatePath = '.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md';
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    produced.report!.upstreamPreparation.templatePath = fx.task.draftJobTemplate.contributionTemplate.path.toUpperCase();
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
  });

  it('refuses a pinned input that changes between its first read and the final recheck with STALE_INPUT', async () => {
    const fx = await make();
    await fx.produce();
    const preload = await writeSeam(fx.root);
    const result = fx.check(['--job', fx.taskFile, '--result', fx.returnFile], { preload, env: { SEAM_WHEN: 'contract-return.json', SEAM_TARGET: fx.taskFile } });
    failure(result, 'STALE_INPUT', 'postflight', 'unavailable');
  });

  it('reports a preflight fault as phase preflight even when a return was supplied', async () => {
    const fx = await make();
    await fx.produce();
    fx.task.source.head = '0'.repeat(40);
    fx.task.draftJobTemplate.source.head = '0'.repeat(40);
    await fx.save();
    failure(await untouched(fx, () => fx.post()), 'CHECKOUT_HEAD', 'preflight');
  });
});

// The preflight refuses what contract-return.mjs refuses, for the same root reason, before draft-pair.mjs writes anything: every string
// comparison stays and the physical comparison is added (P26-A). Each alias case looks its spelling up on the real volume and skips when
// there is none.
describe('preflight compares roots by physical path as well as by string (P26-A)', () => {
  const overlap = /overlaps a source, managed or protected root/;
  const bothDraft = (fx: ContractTaskFixture, draft: string): void => { fx.task.roots.draft = draft; fx.task.draftJobTemplate.draftRoot = draft; };
  const bothProtected = (fx: ContractTaskFixture, roots: string[]): void => { fx.task.roots.protected = roots; fx.task.draftJobTemplate.protectedRoots = roots; };
  const place = (fx: ContractTaskFixture, which: 'draft' | 'producer', dir: string): void => {
    if (which === 'draft') bothDraft(fx, path.join(dir, fx.definition));
    else fx.task.roots.producer = dir;
  };
  it.for(['draft', 'producer'] as const)('refuses a %s root under the NTFS short name of a protected folder with ROOT_CONFLICT (runs on Windows with short names, skipped otherwise)', async (which, ctx) => {
    const fx = await make();
    const prot = path.join(fx.root, 'Protected Folder');
    await fs.ensureDir(path.join(prot, 'out'));
    const short = shortNameOf(prot);
    if (!short) ctx.skip(NO_SHORT);
    bothProtected(fx, [fx.pins, prot]);
    place(fx, which, path.join(short!, 'out'));
    await fx.save();
    expect(failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight').reason).toMatch(overlap);
  });
  it.for(['draft', 'producer'] as const)('refuses a %s root under another case of a protected folder with ROOT_CONFLICT (runs where the volume ignores case, skipped otherwise; a compatibility case that a string comparison refuses too, not proof of the physical comparison)', async (which, ctx) => {
    const fx = await make();
    const prot = path.join(fx.root, 'prot-dir');
    await fs.ensureDir(path.join(prot, 'out'));
    const flipped = otherCaseOf(prot);
    if (!flipped) ctx.skip(NO_CASE);
    bothProtected(fx, [fx.pins, prot]);
    place(fx, which, path.join(flipped!, 'out'));
    await fx.save();
    expect(failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight').reason).toMatch(overlap);
  });
  it('refuses an evidence root reached through the NTFS short name of the source registry (runs on Windows with short names, skipped otherwise)', async ctx => {
    const fx = await make();
    const short = shortNameOf(fx.sourceRegistry);
    if (!short) ctx.skip(NO_SHORT);
    const evidence = path.join(short!, 'evidence');
    fx.task.roots.evidence = evidence;
    fx.task.draftJobTemplate.evidenceRoot = evidence;
    const taskFile = path.join(evidence, 'contract-task.json');
    await fs.outputFile(taskFile, JSON.stringify(fx.task, null, 2));
    expect(failure(await untouched(fx, () => fx.check(['--job', taskFile])), 'ROOT_CONFLICT', 'preflight').reason).toMatch(/overlaps the evidence root/);
  });
  it('passes a legal task whose disjoint roots are given in two spellings (a protected folder by its short name or other case, the rest long)', async ctx => {
    const fx = await make();
    const prot = path.join(fx.root, 'Protected Folder');
    await fs.ensureDir(prot);
    const alt = altLeafOf(prot, false);
    if (!alt) ctx.skip(NO_ALT);
    bothProtected(fx, [fx.pins, alt!]);
    await fx.save();
    success(await untouched(fx, () => fx.pre()));
  });
  it('passes an update whose draft root is another spelling of its own folder: the draft folder is not a stray in its parent', async ctx => {
    const fx = await make({ operation: 'update' });
    const leaf = altLeafOf(fx.draft, false);
    if (!leaf) ctx.skip(NO_ALT);
    bothDraft(fx, leaf!);
    await fx.save();
    success(await untouched(fx, () => fx.pre()));
  });
  it('still refuses a stray beside a draft root given in another spelling of its own folder', async ctx => {
    const fx = await make({ operation: 'update' });
    const leaf = altLeafOf(fx.draft, false);
    if (!leaf) ctx.skip(NO_ALT);
    bothDraft(fx, leaf!);
    await fx.save();
    await fs.outputFile(path.join(path.dirname(fx.draft), 'stray.txt'), 'not the draft\n');
    expect(failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight').path).toBe('stray.txt');
  });
  it('still refuses a link beside the draft folder that points at it: entries are compared by name, never by what a link resolves to', async () => {
    const fx = await make({ operation: 'update' });
    await fs.symlink(fx.draft, path.join(path.dirname(fx.draft), 'alias-of-draft'), 'junction');
    expect(failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight').path).toBe('alias-of-draft');
  });
  it('resolves physical paths by walking up only on ENOENT or ENOTDIR and refuses any other real-path error (source text; EACCES cannot be produced portably)', async () => {
    const text = await fs.readFile(CHECKER, 'utf8');
    expect(text).toMatch(/error\?\.code !== 'ENOENT' && error\?\.code !== 'ENOTDIR'/);
    expect(text).toContain('Cannot resolve the physical path of');
    expect(text).toContain('fs.realpathSync.native(current)');
    expect(text).toContain("const overlaps = (a, b) => withinEither(a, b, 'ROOT_CONFLICT') || withinEither(b, a, 'ROOT_CONFLICT');");
    expect(text).not.toMatch(/catch \{ \/\* absent/);
  });
});
