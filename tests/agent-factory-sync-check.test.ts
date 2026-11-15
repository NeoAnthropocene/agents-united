/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { CHECKER, canonical, digest, pinOf, prepareSyncJob, treeOf, writeSeam } from './helpers/sync-job.js';
import type { Json, SyncJobFixture } from './helpers/sync-job.js';

const fixtures: SyncJobFixture[] = [];
const make = async (): Promise<SyncJobFixture> => {
  const fixture = await prepareSyncJob();
  fixtures.push(fixture);
  return fixture;
};
afterEach(async () => { await Promise.all(fixtures.splice(0).map(fixture => fixture.cleanup())); });

function failure(result: SpawnSyncReturns<string>, code: string, phase: string, status?: 'failed' | 'unavailable'): Json {
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim().split('\n'), result.stderr).toHaveLength(1);
  const out = JSON.parse(result.stderr) as Json;
  expect(out).toMatchObject({
    version: 1, kind: 'deterministic', phase, code,
    proposalOnly: true, implemented: false, quality: 'pending', executionProof: 'unverified', live: 'unverified',
  });
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

async function untouched<T>(fx: SyncJobFixture, act: () => T): Promise<T> {
  const before = await treeOf(fx.root);
  const value = act();
  expect(await treeOf(fx.root)).toEqual(before);
  return value;
}

const hex = (ch: string): string => ch.repeat(64);

async function canSymlink(root: string): Promise<boolean> {
  const target = path.join(root, 'symlink-probe-target');
  const link = path.join(root, 'symlink-probe-link');
  await fs.mkdir(target, { recursive: true });
  try {
    await fs.symlink(target, link, 'junction');
    await fs.remove(link);
    await fs.remove(target);
    return true;
  } catch {
    await fs.remove(target);
    return false;
  }
}

describe('check-sync help and usage', () => {
  it('prints two usage lines on stdout and exits 0', () => {
    const result = spawnSync(process.execPath, [CHECKER, '--help'], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 30_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim().split('\n')).toHaveLength(2);
    expect(result.stdout).toContain('--job');
    expect(result.stdout).toContain('--result');
    expect(result.stdout.trim().startsWith('{')).toBe(false);
  });

  it.each<[string, (fx: SyncJobFixture) => string[]]>([
    ['a duplicate --job selector', fx => ['--job', fx.jobFile, '--job', fx.jobFile]],
    ['a duplicate --result selector', fx => ['--job', fx.jobFile, '--result', fx.planFile, '--result', fx.planFile]],
    ['a duplicate --help selector', () => ['--help', '--help']],
    ['an unknown flag', fx => ['--job', fx.jobFile, '--unreviewed']],
    ['a positional argument', fx => ['--job', fx.jobFile, 'extra']],
    ['a relative job path', () => ['--job', 'sync-job.json']],
    ['a relative result path', fx => ['--job', fx.jobFile, '--result', 'sync-plan.json']],
    ['a traversal alias in the job path', fx => ['--job', `${path.dirname(fx.jobFile)}${path.sep}..${path.sep}evidence${path.sep}sync-job.json`]],
    ['--result without --job', fx => ['--result', fx.planFile]],
    ['--help together with --job', fx => ['--help', '--job', fx.jobFile]],
    ['--job without a value', () => ['--job']],
    ['no arguments', () => []],
  ])('refuses %s with USAGE and changes nothing', async (_label, argv) => {
    const fx = await make();
    failure(await untouched(fx, () => fx.check(argv(fx))), 'USAGE', 'usage');
  });
});

describe('preflight of a valid sync job', () => {
  it('passes preflight with the default fixture, counts and no mutation', async () => {
    const fx = await make();
    const out = success(await untouched(fx, () => fx.pre()));
    expect(out).toEqual({
      version: 1,
      kind: 'deterministic',
      phase: 'preflight',
      recordValid: true,
      job: await pinOf(fx.jobFile),
      jobId: 'claude-sync-2026-11',
      host: 'claude',
      jobDigest: digest(canonical(fx.job)),
      counts: {
        targets: 2,
        affected: 1,
        changedInputs: 3,
        unpinnedChanges: 2,
        heldSources: 1,
      },
      claimsNotAccepted: ['targets-complete', 'untracked-old-hash', 'held-candidate', 'reason'],
      proposalOnly: true,
      implemented: false,
      heldSourcesAdvanced: false,
      quality: 'pending',
      executionProof: 'unverified',
      live: 'unverified',
    });
  });

  it('accepts a removed input when the file is absent on disk and the key is gone from the current lock', async () => {
    const fx = await make();
    await fs.remove(fx.libPath('pages/skill/skills.md'));
    delete fx.lock.files['pages/skill/skills.md'];
    await fx.repinLock();
    fx.job.changedInputs[1] = {
      path: fx.libPath('pages/skill/skills.md'),
      oldSha256: fx.hashes.skillsOld,
      newSha256: null,
    };
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(success(await untouched(fx, () => fx.pre())).recordValid).toBe(true);
    expect(success(await untouched(fx, () => fx.post())).recordValid).toBe(true);
  });

  it('accepts a created input when oldSha256 is null and the key is absent from previousLock', async () => {
    const fx = await make();
    delete fx.previousLock.files['pages/skill/skills.md'];
    await fx.repinPreviousLock();
    fx.job.changedInputs[1] = {
      path: fx.libPath('pages/skill/skills.md'),
      oldSha256: null,
      newSha256: fx.hashes.skillsNew,
    };
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(success(await untouched(fx, () => fx.pre())).recordValid).toBe(true);
    expect(success(await untouched(fx, () => fx.post())).recordValid).toBe(true);
  });
  it('accepts empty changedInputs, heldSources and targets with two equal locks in both phases', async () => {
    const fx = await make();
    fx.previousLock = structuredClone(fx.lock);
    await fx.repinPreviousLock();
    fx.job.changedInputs = [];
    fx.job.heldSources = [];
    fx.job.targets = [];
    fx.targetFiles = [];
    fx.targetRecords = [];
    await fx.saveJob();
    fx.plan = fx.buildPlan(fx.job, []);
    await fx.savePlan();
    const pre = success(await untouched(fx, () => fx.pre()));
    expect(pre.counts).toEqual({ targets: 0, affected: 0, changedInputs: 0, unpinnedChanges: 0, heldSources: 0 });
    const post = success(await untouched(fx, () => fx.post()));
    expect(post.recordValid).toBe(true);
    expect(post.counts).toEqual({ targets: 0, affected: 0, changedInputs: 0, unpinnedChanges: 0, heldSources: 0 });
  });

  it('accepts two targets pinning the same changed input as both affected and excludes it from unpinnedChanges', async () => {
    const fx = await make();
    fx.targetRecords[1]!.inputs.push({
      kind: 'snapshot',
      path: fx.libPath('pages/agent/sub-agents.md'),
      sha256: fx.hashes.subAgentsOld,
    });
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(true);
    expect(fx.plan.artifacts[1].affected).toBe(true);
    expect(fx.plan.unpinnedChanges).not.toContain(fx.libPath('pages/agent/sub-agents.md'));
    expect(success(await untouched(fx, () => fx.pre())).counts.affected).toBe(2);
    const post = success(await untouched(fx, () => fx.post()));
    expect(post.counts.affected).toBe(2);
    expect(post.counts.unpinnedChanges).toBe(2);
  });

  it('accepts a held source the locks never tracked (lockedSha256 null) in both phases', async () => {
    const fx = await make();
    fx.job.heldSources.push({
      path: fx.libPath('pages/untracked.md'),
      lockedSha256: null,
      candidateSha256: hex('8'),
      rule: 'quarantine-hold',
      reason: 'Untracked candidate held before lock admission.',
    });
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(success(await untouched(fx, () => fx.pre())).counts.heldSources).toBe(2);
    expect(success(await untouched(fx, () => fx.post())).counts.heldSources).toBe(2);
  });
});

describe('postflight of a valid sync plan', () => {
  it('passes postflight with the default fixture, result pin and no mutation', async () => {
    const fx = await make();
    const out = success(await untouched(fx, () => fx.post()));
    expect(out).toEqual({
      version: 1,
      kind: 'deterministic',
      phase: 'postflight',
      recordValid: true,
      job: await pinOf(fx.jobFile),
      jobId: 'claude-sync-2026-11',
      host: 'claude',
      jobDigest: digest(canonical(fx.job)),
      counts: {
        targets: 2,
        affected: 1,
        changedInputs: 3,
        unpinnedChanges: 2,
        heldSources: 1,
      },
      result: await pinOf(fx.planFile),
      claimsNotAccepted: ['targets-complete', 'untracked-old-hash', 'held-candidate', 'reason'],
      proposalOnly: true,
      implemented: false,
      heldSourcesAdvanced: false,
      quality: 'pending',
      executionProof: 'unverified',
      live: 'unverified',
    });
  });

  it('marks a pin at a third hash (neither old nor new) as affected with pinnedAtPrevious: false', async () => {
    const fx = await make();
    const thirdHash = hex('9');
    fx.targetRecords[0]!.inputs[0]!.sha256 = thirdHash;
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(true);
    expect(fx.plan.artifacts[0].changedPins[0].pinnedSha256).toBe(thirdHash);
    expect(fx.plan.artifacts[0].changedPins[0].pinnedAtPrevious).toBe(false);
    expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(1);
  });

  it('marks a target that already pins the new hash as not affected', async () => {
    const fx = await make();
    fx.targetRecords[0]!.inputs[0]!.sha256 = fx.hashes.subAgentsNew;
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(false);
    expect(fx.plan.artifacts[0].changedPins).toEqual([]);
    expect(fx.plan.unpinnedChanges).toContain(fx.libPath('pages/agent/sub-agents.md'));
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.counts.affected).toBe(0);
    expect(out.counts.unpinnedChanges).toBe(3);
  });

  it('joins target input paths to changed inputs case-insensitively only on win32', async () => {
    const fx = await make();
    const upperVariant = fx.libPath('pages/agent/SUB-AGENTS.md');
    fx.targetRecords[0]!.inputs[0]!.path = upperVariant;
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    if (process.platform === 'win32') {
      expect(fx.plan.artifacts[0].affected).toBe(true);
      expect(fx.plan.artifacts[0].changedPins).toHaveLength(1);
      expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(1);
    } else {
      expect(fx.plan.artifacts[0].affected).toBe(false);
      expect(fx.plan.artifacts[0].changedPins).toHaveLength(0);
      expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(0);
    }
  });

  it('joins a target recorded in another checkout that pins the changed page at the previous hash', async () => {
    const fx = await make();
    const otherCheckout = path.join(fx.root, 'other-checkout');
    fx.targetRecords[0]!.source.checkout = otherCheckout;
    fx.targetRecords[0]!.inputs[0]!.path = path.join(otherCheckout, 'host-library', 'claude', 'pages', 'agent', 'sub-agents.md');
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(true);
    expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(1);
  });

  it('joins a held source pinned by a target recorded in another checkout', async () => {
    const fx = await make();
    const otherCheckout = path.join(fx.root, 'other-checkout');
    fx.targetRecords[1]!.source.checkout = otherCheckout;
    fx.targetRecords[1]!.inputs[0]!.path = path.join(otherCheckout, 'host-library', 'claude', 'pages', 'mcp', 'mcp.md');
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[1].heldPins).toHaveLength(1);
    expect(success(await untouched(fx, () => fx.post())).recordValid).toBe(true);
  });

  it('does not pin a target input outside its own library even when it names the job library file', async () => {
    const fx = await make();
    fx.targetRecords[0]!.source.checkout = path.join(fx.root, 'other-checkout');
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(false);
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.counts.affected).toBe(0);
    expect(out.counts.unpinnedChanges).toBe(3);
  });

  it('joins a Windows-form target that pins the changed page at the previous hash', async () => {
    const fx = await make();
    fx.targetRecords[0]!.source.checkout = 'C:\\remote\\checkout';
    fx.targetRecords[0]!.inputs = [
      { kind: 'snapshot', path: 'C:\\remote\\checkout\\host-library\\claude\\pages\\agent\\sub-agents.md', sha256: fx.hashes.subAgentsOld },
    ];
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(true);
    expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(1);
  });

  it('joins a POSIX-form target that pins the changed page at the previous hash', async () => {
    const fx = await make();
    fx.targetRecords[0]!.source.checkout = '/remote/checkout';
    fx.targetRecords[0]!.inputs = [
      { kind: 'snapshot', path: '/remote/checkout/host-library/claude/pages/agent/sub-agents.md', sha256: fx.hashes.subAgentsOld },
    ];
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(true);
    expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(1);
  });

  it('joins a Windows-form target whose input differs only by case from the job relative path', async () => {
    const fx = await make();
    fx.targetRecords[0]!.source.checkout = 'C:\\remote\\checkout';
    fx.targetRecords[0]!.inputs = [
      { kind: 'snapshot', path: 'C:\\remote\\checkout\\host-library\\claude\\PAGES\\AGENT\\SUB-AGENTS.MD', sha256: fx.hashes.subAgentsOld },
    ];
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(true);
    expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(1);
  });

  it('joins a POSIX-form target whose input differs only by case on win32 and not elsewhere', async () => {
    const fx = await make();
    fx.targetRecords[0]!.source.checkout = '/remote/checkout';
    fx.targetRecords[0]!.inputs = [
      { kind: 'snapshot', path: '/remote/checkout/host-library/claude/PAGES/AGENT/SUB-AGENTS.MD', sha256: fx.hashes.subAgentsOld },
    ];
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    if (process.platform === 'win32') {
      expect(fx.plan.artifacts[0].affected).toBe(true);
      expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(1);
    } else {
      expect(fx.plan.artifacts[0].affected).toBe(false);
      expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(0);
    }
  });

  it('computes the plan for a single target with 1,000 inputs and 256 changed inputs', async () => {
    const fx = await make();
    const extraInputs: Json[] = [];
    for (let i = 0; i < 253; i++) {
      const rel = `pages/extra/doc-${i}.md`;
      const content = Buffer.from(`# Extra ${i}\n`, 'utf8');
      const file = fx.libPath(rel);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content);
      const newSha = digest(content);
      const oldSha = hex('4');
      fx.job.changedInputs.push({ path: file, oldSha256: oldSha, newSha256: newSha });
      extraInputs.push({
        kind: 'snapshot',
        path: file,
        sha256: i < 197 ? oldSha : newSha,
      });
    }
    const targetInputs: Json[] = [
      { kind: 'snapshot', path: fx.libPath('pages/agent/sub-agents.md'), sha256: fx.hashes.subAgentsOld },
      { kind: 'snapshot', path: fx.libPath('pages/skill/skills.md'), sha256: fx.hashes.skillsOld },
      { kind: 'snapshot', path: fx.libPath('guide/agent.md'), sha256: fx.hashes.guideOld },
      ...extraInputs,
      ...Array.from({ length: 744 }, (_, i) => ({
        kind: 'snapshot',
        path: fx.libPath(`pages/unused/u-${i}.md`),
        sha256: hex('a'),
      })),
    ];
    fx.targetRecords = [{ ...fx.targetRecords[0]!, inputs: targetInputs }];
    fx.targetFiles = [fx.targetFiles[0]!];
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan(fx.job, fx.targetRecords);
    await fx.savePlan();
    const pre = success(await untouched(fx, () => fx.pre()));
    expect(pre.counts).toEqual({ targets: 1, affected: 1, changedInputs: 256, unpinnedChanges: 56, heldSources: 1 });
    const post = success(await untouched(fx, () => fx.post()));
    expect(post.counts).toEqual({ targets: 1, affected: 1, changedInputs: 256, unpinnedChanges: 56, heldSources: 1 });
  });

  it('accepts target fields exactly at schema bounds in both preflight and postflight', async () => {
    const fx = await make();
    fx.targetRecords[0]!.artifact = {
      type: 't'.repeat(128),
      definition: 'd'.repeat(128),
      paths: ['p'.repeat(8192)],
    };
    fx.targetRecords[0]!.inputs[0]!.kind = 'k'.repeat(128);
    fx.targetRecords[1]!.artifact.paths = Array.from({ length: 1000 }, (_, i) => `p-${i}.md`);
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(success(await untouched(fx, () => fx.pre())).recordValid).toBe(true);
    expect(success(await untouched(fx, () => fx.post())).recordValid).toBe(true);
  });
});

describe('preflight refusals: job schema and structure', () => {
  const cases: Array<[string, (fx: SyncJobFixture) => void]> = [
    ['an unknown job key', fx => { fx.job.extraKey = true; }],
    ['a missing job key', fx => { delete fx.job.host; }],
    ['a wrong kind constant', fx => { fx.job.kind = 'skill-task'; }],
    ['a non-kebab id', fx => { fx.job.id = 'Invalid_ID'; }],
    ['a non-kebab host', fx => { fx.job.host = 'ClaudeHost'; }],
    ['a changed input with both hashes null', fx => { fx.job.changedInputs[2].oldSha256 = null; fx.job.changedInputs[2].newSha256 = null; }],
    ['a changed input with old equal to new', fx => { fx.job.changedInputs[2].oldSha256 = fx.hashes.guideNew; fx.job.changedInputs[2].newSha256 = fx.hashes.guideNew; }],
    ['duplicate path in changedInputs', fx => { fx.job.changedInputs.push({ ...fx.job.changedInputs[0] }); }],
    ['duplicate path in heldSources', fx => { fx.job.heldSources.push({ ...fx.job.heldSources[0] }); }],
    ['duplicate path in targets', fx => { fx.job.targets.push({ ...fx.job.targets[0] }); }],
    ['changedInput path outside host library', fx => { fx.job.changedInputs[2].path = path.join(fx.workspace, 'outside.md'); }],
    ['heldSource path outside host library', fx => { fx.job.heldSources[0].path = path.join(fx.workspace, 'outside.md'); }],
    ['library.lock.path not at <checkout>/host-library/<host>/library.lock.json', fx => { fx.job.library.lock.path = fx.previousLockFile; }],
    ['library.previousLock.path outside evidence', fx => { fx.job.library.previousLock.path = fx.lockFile; }],
  ];
  it.each(cases)('refuses %s with JOB_INVALID', async (_label, edit) => {
    const fx = await make();
    edit(fx);
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
  });

  it('refuses a job file outside roots.evidence or in a nested subfolder of roots.evidence with JOB_INVALID', async () => {
    const fx = await make();
    const outside = path.join(fx.workspace, 'sync-job.json');
    await fs.writeFile(outside, JSON.stringify(fx.job, null, 2));
    failure(await untouched(fx, () => fx.check(['--job', outside])), 'JOB_INVALID', 'preflight');

    const nested = path.join(fx.evidence, 'nested', 'sync-job.json');
    await fs.mkdir(path.dirname(nested), { recursive: true });
    await fs.writeFile(nested, JSON.stringify(fx.job, null, 2));
    failure(await untouched(fx, () => fx.check(['--job', nested])), 'JOB_INVALID', 'preflight');
  });

  it('refuses a missing job file or job over envelope cap as unavailable, and invalid JSON as failed', async () => {
    const fx = await make();
    await fs.writeFile(fx.jobFile, 'not json\n');
    failure(fx.pre(), 'JOB_INVALID', 'preflight', 'failed');
    await fs.writeFile(fx.jobFile, JSON.stringify({ ...fx.job, id: 'x'.repeat(300_000) }));
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight', 'unavailable');
    await fs.remove(fx.jobFile);
    failure(fx.pre(), 'JOB_INVALID', 'preflight', 'unavailable');
  });

  it('refuses a lock file whose files entry lacks valid sha256 prefix with JOB_INVALID', async () => {
    const fx = await make();
    fx.lock.files['pages/mcp/mcp.md'].sha256 = fx.hashes.mcpLocked; // missing sha256: prefix
    await fx.repinLock();
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
  });

  it.each<[string, string]>([
    ['a .. segment', 'pages/../pages/mcp/mcp.md'],
    ['a leading /', '/pages/mcp/mcp.md'],
    ['a backslash', 'pages\\mcp\\mcp.md'],
  ])('refuses a lock key with %s with JOB_INVALID', async (_label, badKey) => {
    const fx = await make();
    fx.lock.files[badKey] = structuredClone(fx.lock.files['pages/mcp/mcp.md']);
    await fx.repinLock();
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
  });
});

describe('preflight refusals: roots, links and checkout HEAD', () => {
  it('refuses evidence outside workspace with ROOT_CONFLICT', async () => {
    const fx = await make();
    const otherEvidence = path.join(fx.root, 'outside-evidence');
    await fs.mkdir(otherEvidence, { recursive: true });
    const otherPrevLock = path.join(otherEvidence, 'prev.lock.json');
    await fs.copyFile(fx.previousLockFile, otherPrevLock);
    fx.job.roots.evidence = otherEvidence;
    fx.job.library.previousLock = await pinOf(otherPrevLock);
    const otherJob = path.join(otherEvidence, 'sync-job.json');
    await fs.writeFile(otherJob, JSON.stringify(fx.job, null, 2));
    failure(await untouched(fx, () => fx.check(['--job', otherJob])), 'ROOT_CONFLICT', 'preflight');
  });

  it('refuses evidence inside the checkout with ROOT_CONFLICT', async () => {
    const fx = await make();
    fx.job.roots.workspace = fx.root;
    const insideEvidence = path.join(fx.checkout, 'evidence-in-checkout');
    await fs.mkdir(insideEvidence, { recursive: true });
    const insideJob = path.join(insideEvidence, 'sync-job.json');
    fx.job.roots.evidence = insideEvidence;
    await fs.writeFile(insideJob, JSON.stringify(fx.job, null, 2));
    failure(await untouched(fx, () => fx.check(['--job', insideJob])), 'ROOT_CONFLICT', 'preflight');
  });

  it('refuses evidence containing the checkout with ROOT_CONFLICT', async () => {
    const fx = await make();
    fx.job.roots.workspace = fx.root;
    fx.job.roots.evidence = fx.root;
    const rootJob = path.join(fx.root, 'sync-job.json');
    await fs.writeFile(rootJob, JSON.stringify(fx.job, null, 2));
    failure(await untouched(fx, () => fx.check(['--job', rootJob])), 'ROOT_CONFLICT', 'preflight');
  });

  it('refuses a linked ancestor of roots with ROOT_CONFLICT', async ctx => {
    const fx = await make();
    if (!(await canSymlink(fx.root))) {
      ctx.skip();
      return;
    }
    const linkedWorkspace = path.join(fx.root, 'linked-workspace');
    await fs.symlink(fx.workspace, linkedWorkspace, 'junction');
    fx.job.roots.workspace = linkedWorkspace;
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });

  it('refuses a wrong checkout HEAD with CHECKOUT_HEAD', async () => {
    const fx = await make();
    fx.job.source.head = '0'.repeat(40);
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'CHECKOUT_HEAD', 'preflight');
  });
});

describe('preflight refusals: pins and lock delta', () => {
  it('refuses a tampered library.lock pin with PIN_MISMATCH', async () => {
    const fx = await make();
    fx.job.library.lock.sha256 = hex('a');
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'PIN_MISMATCH', 'preflight');
  });

  it('refuses a tampered library.previousLock pin with PIN_MISMATCH', async () => {
    const fx = await make();
    fx.job.library.previousLock.bytes += 1;
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'PIN_MISMATCH', 'preflight');
  });

  it('refuses a tampered target pin with PIN_MISMATCH', async () => {
    const fx = await make();
    fx.job.targets[0].sha256 = hex('b');
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'PIN_MISMATCH', 'preflight');
  });

  it('refuses a lock difference missing from changedInputs with LOCK_DELTA_MISMATCH', async () => {
    const fx = await make();
    fx.job.changedInputs = fx.job.changedInputs.filter((item: Json) => !item.path.endsWith('skills.md'));
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'LOCK_DELTA_MISMATCH', 'preflight');
  });

  it('refuses a lock-tracked changedInputs entry whose oldSha256 disagrees with previousLock with LOCK_DELTA_MISMATCH', async () => {
    const fx = await make();
    fx.job.changedInputs[0].oldSha256 = hex('c');
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'LOCK_DELTA_MISMATCH', 'preflight');
  });

  it('refuses a lock-tracked changedInputs entry whose newSha256 disagrees with current lock with LOCK_DELTA_MISMATCH', async () => {
    const fx = await make();
    fx.job.changedInputs[0].newSha256 = hex('d');
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'LOCK_DELTA_MISMATCH', 'preflight');
  });

  it('refuses a lock-tracked changedInputs entry when the two locks actually agree on that key with LOCK_DELTA_MISMATCH', async () => {
    const fx = await make();
    fx.job.heldSources = [];
    fx.job.changedInputs.push({
      path: fx.libPath('pages/mcp/mcp.md'),
      oldSha256: fx.hashes.mcpLocked,
      newSha256: hex('e'),
    });
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'LOCK_DELTA_MISMATCH', 'preflight');
  });

  it('refuses a changed file whose bytes on disk disagree with its newSha256 with PIN_MISMATCH', async () => {
    const fx = await make();
    await fs.writeFile(fx.libPath('guide/agent.md'), 'Tampered guide on disk.\n');
    failure(await untouched(fx, () => fx.pre()), 'PIN_MISMATCH', 'preflight');
  });

  it('refuses a removed input (newSha256 null) when the file still exists on disk with PIN_MISMATCH', async () => {
    const fx = await make();
    delete fx.lock.files['pages/skill/skills.md'];
    await fx.repinLock();
    fx.job.changedInputs[1] = {
      path: fx.libPath('pages/skill/skills.md'),
      oldSha256: fx.hashes.skillsOld,
      newSha256: null,
    };
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'PIN_MISMATCH', 'preflight');
  });

  it('ends the run with status unavailable when an ancestor of a record path cannot be lstat\'d', async ctx => {
    // On win32 lstat maps every unreachable path form to ENOENT, which throwIfNoEntry suppresses; only POSIX reports a real error (ENOTDIR).
    if (process.platform === 'win32') { ctx.skip(); return; }
    const fx = await make();
    // A file used as a directory: POSIX lstat reports ENOTDIR, which throwIfNoEntry does not suppress.
    fx.job.changedInputs[0].path = path.join(fx.jobFile, 'child.md');
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight', 'unavailable');
  });

  it('refuses case-colliding lock keys on win32 and keeps both keys on other platforms', async () => {
    const fx = await make();
    fx.lock.files['Pages/mcp/MCP.md'] = structuredClone(fx.lock.files['pages/mcp/mcp.md']);
    fx.previousLock.files['Pages/mcp/MCP.md'] = structuredClone(fx.previousLock.files['pages/mcp/mcp.md']);
    await fx.repinLock();
    await fx.repinPreviousLock();
    await fx.saveJob();
    if (process.platform === 'win32') {
      failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
    } else {
      expect(success(await untouched(fx, () => fx.pre())).recordValid).toBe(true);
    }
  });
});

describe('preflight refusals: holds', () => {
  it('refuses a hold whose lockedSha256 disagrees with the current lock with HOLD_VIOLATION', async () => {
    const fx = await make();
    const diskBytes = Buffer.from('# MCP (only lock disagrees)\n', 'utf8');
    await fs.writeFile(fx.libPath('pages/mcp/mcp.md'), diskBytes);
    fx.job.heldSources[0].lockedSha256 = digest(diskBytes);
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'HOLD_VIOLATION', 'preflight');
  });

  it('refuses a hold that advanced between previousLock and current lock with HOLD_VIOLATION', async () => {
    const fx = await make();
    fx.previousLock.files['pages/mcp/mcp.md'].sha256 = `sha256:${hex('2')}`;
    await fx.repinPreviousLock();
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'HOLD_VIOLATION', 'preflight');
  });

  it('refuses a hold whose candidateSha256 equals lockedSha256 with HOLD_VIOLATION', async () => {
    const fx = await make();
    fx.job.heldSources[0].candidateSha256 = fx.hashes.mcpLocked;
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'HOLD_VIOLATION', 'preflight');
  });

  it('refuses a held path that also appears in changedInputs with HOLD_VIOLATION', async () => {
    const fx = await make();
    fx.job.heldSources.push({
      path: fx.libPath('guide/agent.md'),
      lockedSha256: null,
      candidateSha256: fx.hashes.guideNew,
      rule: 'quarantine-hold',
      reason: 'Untracked guide held while also in changedInputs.',
    });
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'HOLD_VIOLATION', 'preflight');
  });

  it('refuses a held lock-tracked unchanged path added to changedInputs with HOLD_VIOLATION', async () => {
    const fx = await make();
    fx.job.changedInputs.push({
      path: fx.libPath('pages/mcp/mcp.md'),
      oldSha256: fx.hashes.mcpLocked,
      newSha256: hex('3'),
    });
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'HOLD_VIOLATION', 'preflight');
  });

  it('refuses a hold whose on-disk bytes disagree with lockedSha256 with HOLD_VIOLATION', async () => {
    const fx = await make();
    await fs.writeFile(fx.libPath('pages/mcp/mcp.md'), 'Tampered MCP on disk.\n');
    failure(await untouched(fx, () => fx.pre()), 'HOLD_VIOLATION', 'preflight');
  });
});

describe('preflight refusals: targets, limits and stale input', () => {
  const targetCases: Array<[string, (target: Json, fx: SyncJobFixture) => void]> = [
    ['missing target id', target => { delete target.id; }],
    ['empty target id', target => { target.id = ''; }],
    ['missing artifact object', target => { delete target.artifact; }],
    ['non-string artifact.type', target => { target.artifact.type = 123; }],
    ['non-array artifact.paths', target => { target.artifact.paths = 'not-an-array'; }],
    ['empty inputs array', target => { target.inputs = []; }],
    ['input with relative path', target => { target.inputs[0].path = 'relative/path.md'; }],
    ['input with malformed sha256', target => { target.inputs[0].sha256 = 'not-hex'; }],
    ['duplicate input paths in one target', target => { target.inputs.push({ ...target.inputs[0] }); }],
    ['missing source.checkout', target => { delete target.source; }],
    ['non-absolute source.checkout', target => { target.source.checkout = 'relative/checkout'; }],
    ['source.checkout starting with // (neither Windows nor POSIX form)', target => { target.source.checkout = '//server/share/checkout'; }],
    ['source.checkout starting with single backslash (neither form)', target => { target.source.checkout = '\\checkout'; }],
    ['source.checkout as drive-relative path (neither form)', target => { target.source.checkout = 'C:relative/checkout'; }],
    ['POSIX-form checkout with Windows-form input path', target => { target.source.checkout = '/remote/checkout'; target.inputs[0].path = 'C:\\remote\\checkout\\host-library\\claude\\pages\\agent\\sub-agents.md'; }],
    ['POSIX-form input with a .. segment', target => { target.source.checkout = '/remote/checkout'; target.inputs[0].path = '/remote/checkout/host-library/claude/../claude/pages/agent/sub-agents.md'; }],
    ['Windows-form input with a .. segment', target => { target.source.checkout = 'C:\\remote\\checkout'; target.inputs[0].path = 'C:\\remote\\checkout\\host-library\\claude\\..\\claude\\pages\\agent\\sub-agents.md'; }],
    ['Windows-form duplicate inputs differing only by case', target => {
      target.source.checkout = 'C:\\remote\\checkout';
      target.inputs[0].path = 'C:\\remote\\checkout\\host-library\\claude\\pages\\agent\\sub-agents.md';
      target.inputs.push({ ...target.inputs[0], path: 'C:\\remote\\checkout\\host-library\\claude\\PAGES\\AGENT\\SUB-AGENTS.MD' });
    }],
    ['artifact.type over 128 chars', target => { target.artifact.type = 't'.repeat(129); }],
    ['artifact.definition over 128 chars', target => { target.artifact.definition = 'd'.repeat(129); }],
    ['artifact.paths over 1000 items', target => { target.artifact.paths = Array.from({ length: 1001 }, (_, i) => `p-${i}.md`); }],
    ['artifact.paths item over 8192 chars', target => { target.artifact.paths = ['p'.repeat(8193)]; }],
    ['input.kind over 128 chars', target => { target.inputs[0].kind = 'k'.repeat(129); }],
  ];
  it.each(targetCases)('refuses a target record with %s with TARGET_INVALID', async (_label, edit) => {
    const fx = await make();
    edit(fx.targetRecords[0]!, fx);
    await fx.repinTargets();
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'TARGET_INVALID', 'preflight');
  });

  it('refuses case-colliding inputs in a POSIX-form target on win32 and keeps both on other platforms', async () => {
    const fx = await make();
    fx.targetRecords[0]!.source.checkout = '/remote/checkout';
    fx.targetRecords[0]!.inputs = [
      { kind: 'snapshot', path: '/remote/checkout/host-library/claude/pages/agent/sub-agents.md', sha256: fx.hashes.subAgentsOld },
      { kind: 'snapshot', path: '/remote/checkout/host-library/claude/PAGES/AGENT/SUB-AGENTS.MD', sha256: fx.hashes.subAgentsOld },
    ];
    fx.targetRecords[1]!.source.checkout = '/remote/checkout';
    fx.targetRecords[1]!.inputs = [
      { kind: 'snapshot', path: '/remote/checkout/host-library/claude/pages/mcp/mcp.md', sha256: fx.hashes.mcpLocked },
    ];
    await fx.repinTargets();
    await fx.saveJob();
    if (process.platform === 'win32') {
      failure(await untouched(fx, () => fx.pre()), 'TARGET_INVALID', 'preflight');
    } else {
      fx.plan = fx.buildPlan();
      await fx.savePlan();
      expect(success(await untouched(fx, () => fx.post())).recordValid).toBe(true);
    }
  });

  it('accepts a target whose inputs name a path on a location that does not exist', async () => {
    const fx = await make();
    // A file used as a parent directory can never exist; target inputs are form-checked, never read or walked.
    fx.targetRecords[0]!.inputs[0]!.path = path.join(fx.lockFile, 'child.md');
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.counts.affected).toBe(0);
    expect(out.counts.unpinnedChanges).toBe(3);
  });

  it('refuses a target with > 1000 inputs with LIMIT and status unavailable', async () => {
    const fx = await make();
    fx.targetRecords[0]!.inputs = Array.from({ length: 1001 }, (_, i) => ({
      kind: 'snapshot',
      path: path.join(fx.library, `file-${i}.md`),
      sha256: hex('a'),
    }));
    await fx.repinTargets();
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'LIMIT', 'preflight', 'unavailable');
  });

  it('refuses a watched file that changes before the final recheck with STALE_INPUT and status unavailable', async () => {
    const fx = await make();
    const preload = await writeSeam(fx.root);
    const result = fx.check(['--job', fx.jobFile], {
      preload,
      env: { SEAM_WHEN: 'target-2.job.json', SEAM_TARGET: fx.jobFile },
    });
    failure(result, 'STALE_INPUT', 'preflight', 'unavailable');
  });
});

describe('postflight refusals: plan record, digest, affected computation and holds', () => {
  it('refuses a plan file outside roots.evidence or equal to the job file with RESULT_INVALID', async () => {
    const fx = await make();
    const outside = path.join(fx.workspace, 'sync-plan.json');
    await fs.writeFile(outside, JSON.stringify(fx.plan, null, 2));
    failure(await untouched(fx, () => fx.post(outside)), 'RESULT_INVALID', 'postflight');
    failure(await untouched(fx, () => fx.post(fx.jobFile)), 'RESULT_INVALID', 'postflight');
  });

  const invalidPlanCases: Array<[string, (plan: Json) => void]> = [
    ['an unknown key in plan', plan => { plan.extra = true; }],
    ['wrong kind constant', plan => { plan.kind = 'host-update-sync-job'; }],
    ['proposalOnly flipped to false', plan => { plan.proposalOnly = false; }],
    ['implemented flipped to true', plan => { plan.implemented = true; }],
    ['heldSourcesAdvanced flipped to true', plan => { plan.heldSourcesAdvanced = true; }],
    ['quality flipped to passed', plan => { plan.quality = 'passed'; }],
    ['live flipped to verified', plan => { plan.live = 'verified'; }],
    ['empty reason on an artifact', plan => { plan.artifacts[0].reason = ''; }],
    ['reason over 512 chars on an artifact', plan => { plan.artifacts[0].reason = 'r'.repeat(513); }],
    ['wrong disposition on heldSources', plan => { plan.heldSources[0].disposition = 'advanced'; }],
  ];
  it.each(invalidPlanCases)('refuses %s with RESULT_INVALID', async (_label, edit) => {
    const fx = await make();
    edit(fx.plan);
    await fx.savePlan();
    failure(await untouched(fx, () => fx.post()), 'RESULT_INVALID', 'postflight');
  });

  it('refuses wrong jobId, wrong host or wrong jobDigest with DIGEST_MISMATCH', async () => {
    const fx = await make();
    fx.plan.jobDigest = hex('0');
    await fx.savePlan();
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');

    fx.plan = fx.buildPlan();
    fx.plan.jobId = 'wrong-job-id';
    await fx.savePlan();
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');

    fx.plan = fx.buildPlan();
    fx.plan.host = 'codex';
    await fx.savePlan();
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
  });

  const affectedCases: Array<[string, (plan: Json, fx: SyncJobFixture) => void]> = [
    ['an artifact missing', plan => { plan.artifacts.pop(); }],
    ['an extra artifact', plan => { plan.artifacts.push(structuredClone(plan.artifacts[0])); }],
    ['artifacts reordered', plan => { plan.artifacts.reverse(); }],
    ['affected flipped true -> false', plan => { plan.artifacts[0].affected = false; }],
    ['affected flipped false -> true', plan => { plan.artifacts[1].affected = true; }],
    ['a changedPin missing', plan => { plan.artifacts[0].changedPins = []; }],
    ['a changedPin with a wrong pinnedSha256', plan => { plan.artifacts[0].changedPins[0].pinnedSha256 = hex('5'); }],
    ['a changedPin with a wrong oldSha256', plan => { plan.artifacts[0].changedPins[0].oldSha256 = hex('5'); }],
    ['a changedPin with a wrong newSha256', plan => { plan.artifacts[0].changedPins[0].newSha256 = hex('5'); }],
    ['pinnedAtPrevious wrong', plan => { plan.artifacts[0].changedPins[0].pinnedAtPrevious = false; }],
    ['a heldPin missing', plan => { plan.artifacts[0].heldPins = []; }],
    ['artifacts[].job.sha256 wrong', plan => { plan.artifacts[0].job.sha256 = hex('6'); }],
    ['artifacts[].jobId wrong', plan => { plan.artifacts[0].jobId = 'wrong-target-id'; }],
    ['artifacts[].artifact.definition wrong', plan => { plan.artifacts[0].artifact.definition = 'wrong-definition'; }],
    ['changedPins[].kind wrong', plan => { plan.artifacts[0].changedPins[0].kind = 'guide'; }],
    ['heldPins[].pinnedSha256 wrong', plan => { plan.artifacts[0].heldPins[0].pinnedSha256 = hex('6'); }],
    ['unpinnedChanges wrong', plan => { plan.unpinnedChanges.pop(); }],
  ];
  it.each(affectedCases)('refuses %s with AFFECTED_MISMATCH', async (_label, edit) => {
    const fx = await make();
    edit(fx.plan, fx);
    await fx.savePlan();
    failure(await untouched(fx, () => fx.post()), 'AFFECTED_MISMATCH', 'postflight');
  });

  it('refuses heldSources[].lockedSha256 wrong in the plan with HOLD_VIOLATION', async () => {
    const fx = await make();
    fx.plan.heldSources[0].lockedSha256 = hex('6');
    await fx.savePlan();
    failure(await untouched(fx, () => fx.post()), 'HOLD_VIOLATION', 'postflight');
  });

  it('refuses a missing heldSource in the plan with HOLD_VIOLATION', async () => {
    const fx = await make();
    fx.plan.heldSources = [];
    await fx.savePlan();
    failure(await untouched(fx, () => fx.post()), 'HOLD_VIOLATION', 'postflight');
  });

  it('refuses a held source path inside changedPins with HOLD_VIOLATION', async () => {
    const fx = await make();
    fx.plan.artifacts[0].changedPins.push({
      kind: 'snapshot',
      path: fx.libPath('pages/mcp/mcp.md'),
      pinnedSha256: fx.hashes.mcpLocked,
      oldSha256: fx.hashes.mcpLocked,
      newSha256: fx.hashes.mcpCandidate,
      pinnedAtPrevious: true,
    });
    await fx.savePlan();
    failure(await untouched(fx, () => fx.post()), 'HOLD_VIOLATION', 'postflight');
  });
});

describe('design rules confirmed by the maintainer, 2026-11-15', () => {
  it('marks a target pinning a removed input (newSha256: null, absent on disk and from lock) as affected with newSha256: null and passes postflight', async () => {
    const fx = await make();
    const removedPath = fx.libPath('pages/skill/skills.md');
    await fs.remove(removedPath);
    delete fx.lock.files['pages/skill/skills.md'];
    await fx.repinLock();
    fx.job.changedInputs[1] = { path: removedPath, oldSha256: fx.hashes.skillsOld, newSha256: null };
    fx.targetRecords[1]!.inputs.push({ kind: 'snapshot', path: removedPath, sha256: fx.hashes.skillsOld });
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[1].affected).toBe(true);
    expect(fx.plan.artifacts[1].changedPins).toEqual([
      {
        kind: 'snapshot',
        path: removedPath,
        pinnedSha256: fx.hashes.skillsOld,
        oldSha256: fx.hashes.skillsOld,
        newSha256: null,
        pinnedAtPrevious: true,
      },
    ]);
    expect(fx.plan.unpinnedChanges).not.toContain(removedPath);
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.recordValid).toBe(true);
    expect(out.counts.affected).toBe(2);
  });

  it('marks a target pinning a removed input at a hash other than oldSha256 as affected with pinnedAtPrevious: false', async () => {
    const fx = await make();
    const removedPath = fx.libPath('pages/skill/skills.md');
    await fs.remove(removedPath);
    delete fx.lock.files['pages/skill/skills.md'];
    await fx.repinLock();
    fx.job.changedInputs[1] = { path: removedPath, oldSha256: fx.hashes.skillsOld, newSha256: null };
    fx.targetRecords[1]!.inputs.push({ kind: 'snapshot', path: removedPath, sha256: hex('9') });
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[1].affected).toBe(true);
    expect(fx.plan.artifacts[1].changedPins).toEqual([
      {
        kind: 'snapshot',
        path: removedPath,
        pinnedSha256: hex('9'),
        oldSha256: fx.hashes.skillsOld,
        newSha256: null,
        pinnedAtPrevious: false,
      },
    ]);
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.recordValid).toBe(true);
    expect(out.counts.affected).toBe(2);
  });

  it('refuses a plan that marks a target pinning a removed input as not affected with AFFECTED_MISMATCH', async () => {
    const fx = await make();
    const removedPath = fx.libPath('pages/skill/skills.md');
    await fs.remove(removedPath);
    delete fx.lock.files['pages/skill/skills.md'];
    await fx.repinLock();
    fx.job.changedInputs[1] = { path: removedPath, oldSha256: fx.hashes.skillsOld, newSha256: null };
    fx.targetRecords[1]!.inputs.push({ kind: 'snapshot', path: removedPath, sha256: fx.hashes.skillsOld });
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    fx.plan.artifacts[1].affected = false;
    fx.plan.artifacts[1].changedPins = [];
    fx.plan.unpinnedChanges.push(removedPath);
    await fx.savePlan();
    failure(await untouched(fx, () => fx.post()), 'AFFECTED_MISMATCH', 'postflight');
  });

  const omittedJobFields: Array<[string, (fx: SyncJobFixture) => void]> = [
    ['top-level changelogSignals', fx => { fx.job.changelogSignals = []; }],
    ['top-level budget', fx => { fx.job.budget = {}; }],
    ['top-level constraints', fx => { fx.job.constraints = {}; }],
    ['library.sources', fx => { fx.job.library.sources = structuredClone(fx.job.library.lock); }],
    ['library.lastSeen', fx => { fx.job.library.lastSeen = []; }],
    ['library.verifyStatus', fx => { fx.job.library.verifyStatus = 'pass'; }],
    ['source.previousHead', fx => { fx.job.source.previousHead = '0'.repeat(40); }],
    ['changedInputs[0].kind', fx => { fx.job.changedInputs[0].kind = 'snapshot'; }],
    ['changedInputs[0].artifactTypes', fx => { fx.job.changedInputs[0].artifactTypes = ['agent']; }],
    ['heldSources[0].evidenceLine', fx => { fx.job.heldSources[0].evidenceLine = 1; }],
  ];
  it.each(omittedJobFields)('refuses omitted job field %s with JOB_INVALID in preflight', async (_label, edit) => {
    const fx = await make();
    edit(fx);
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
  });

  it('accepts an arbitrary oldSha256 on an untracked guide in both phases, reports pinnedAtPrevious: false and lists untracked-old-hash in claimsNotAccepted', async () => {
    const fx = await make();
    const guidePath = fx.libPath('guide/agent.md');
    fx.targetRecords[0]!.inputs.push({ kind: 'guide', path: guidePath, sha256: fx.hashes.guideOld });
    await fx.repinTargets();
    fx.job.changedInputs[2].oldSha256 = hex('7');
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    const guidePin = fx.plan.artifacts[0].changedPins.find((pin: Json) => pin.path === guidePath);
    expect(guidePin).toMatchObject({
      kind: 'guide',
      path: guidePath,
      pinnedSha256: fx.hashes.guideOld,
      oldSha256: hex('7'),
      newSha256: fx.hashes.guideNew,
      pinnedAtPrevious: false,
    });
    const pre = success(await untouched(fx, () => fx.pre()));
    expect(pre.recordValid).toBe(true);
    expect(pre.claimsNotAccepted).toContain('untracked-old-hash');
    const post = success(await untouched(fx, () => fx.post()));
    expect(post.recordValid).toBe(true);
    expect(post.claimsNotAccepted).toContain('untracked-old-hash');
  });

  it('refuses an existing source.checkout that is not a git repository with CHECKOUT_HEAD', async () => {
    const fx = await make();
    const plainCheckout = path.join(fx.root, 'plain-checkout');
    await fs.copy(path.join(fx.checkout, 'host-library'), path.join(plainCheckout, 'host-library'));
    fx.job.source.checkout = plainCheckout;
    fx.job.library.lock = await pinOf(path.join(plainCheckout, 'host-library', 'claude', 'library.lock.json'));
    fx.job.changedInputs = fx.job.changedInputs.map((item: Json) => ({
      ...item,
      path: path.join(plainCheckout, path.relative(fx.checkout, item.path)),
    }));
    fx.job.heldSources = fx.job.heldSources.map((item: Json) => ({
      ...item,
      path: path.join(plainCheckout, path.relative(fx.checkout, item.path)),
    }));
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'CHECKOUT_HEAD', 'preflight');
  });

  it('refuses a previously valid job with CHECKOUT_HEAD after a new commit advances the checkout HEAD', async () => {
    const fx = await make();
    expect(success(await untouched(fx, () => fx.pre())).recordValid).toBe(true);
    const commit = spawnSync('git', ['-C', fx.checkout, 'commit', '--allow-empty', '-m', 'Advance fixture HEAD'], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(commit.status, commit.stderr).toBe(0);
    failure(await untouched(fx, () => fx.pre()), 'CHECKOUT_HEAD', 'preflight');
  });

  it('leaves the fixture tree including checkout .git, HEAD and refs untouched after preflight and postflight', async () => {
    const fx = await make();
    const gitOut = (args: string[]): string => {
      const res = spawnSync('git', ['-C', fx.checkout, ...args], { encoding: 'utf8', timeout: 30_000 });
      expect(res.status, res.stderr).toBe(0);
      return res.stdout;
    };
    const beforeTree = await treeOf(fx.root);
    expect(Object.keys(beforeTree).some(key => key.startsWith('checkout/.git/'))).toBe(true);
    const beforeHead = gitOut(['rev-parse', '--verify', 'HEAD']).trim();
    const beforeRefs = gitOut(['show-ref']);
    expect(success(fx.pre()).recordValid).toBe(true);
    expect(success(fx.post()).recordValid).toBe(true);
    expect(await treeOf(fx.root)).toEqual(beforeTree);
    expect(gitOut(['rev-parse', '--verify', 'HEAD']).trim()).toBe(beforeHead);
    expect(gitOut(['show-ref'])).toBe(beforeRefs);
  });

  it('treats a UNC-form target checkout (\\\\server\\share\\repo) as Windows form and joins', async () => {
    const fx = await make();
    fx.targetRecords[0]!.source.checkout = '\\\\server\\share\\repo';
    fx.targetRecords[0]!.inputs = [
      { kind: 'snapshot', path: '\\\\server\\share\\repo\\host-library\\claude\\pages\\agent\\sub-agents.md', sha256: fx.hashes.subAgentsOld },
    ];
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(true);
    expect(fx.plan.artifacts[0].changedPins).toHaveLength(1);
    expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(1);
  });

  it('joins a Windows-form target whose inputs use forward slashes', async () => {
    const fx = await make();
    fx.targetRecords[0]!.source.checkout = 'C:\\repo';
    fx.targetRecords[0]!.inputs = [
      { kind: 'snapshot', path: 'C:/repo/host-library/claude/pages/agent/sub-agents.md', sha256: fx.hashes.subAgentsOld },
    ];
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(true);
    expect(fx.plan.artifacts[0].changedPins).toHaveLength(1);
    expect(success(await untouched(fx, () => fx.post())).counts.affected).toBe(1);
  });

  it('pins nothing for a Windows-form target whose input is inside another checkout library', async () => {
    const fx = await make();
    fx.targetRecords[0]!.source.checkout = 'C:\\remote\\checkout-a';
    fx.targetRecords[0]!.inputs = [
      { kind: 'snapshot', path: 'C:\\remote\\checkout-b\\host-library\\claude\\pages\\agent\\sub-agents.md', sha256: fx.hashes.subAgentsOld },
    ];
    await fx.repinTargets();
    await fx.saveJob();
    fx.plan = fx.buildPlan();
    await fx.savePlan();
    expect(fx.plan.artifacts[0].affected).toBe(false);
    expect(fx.plan.artifacts[0].changedPins).toEqual([]);
    expect(fx.plan.artifacts[0].heldPins).toEqual([]);
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.counts.affected).toBe(0);
    expect(out.counts.unpinnedChanges).toBe(3);
  });

  it('refuses a POSIX-form target checkout containing a .. segment with TARGET_INVALID', async () => {
    const fx = await make();
    fx.targetRecords[0]!.source.checkout = '/remote/a/../checkout';
    await fx.repinTargets();
    await fx.saveJob();
    failure(await untouched(fx, () => fx.pre()), 'TARGET_INVALID', 'preflight');
  });
});
