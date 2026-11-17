/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CHECKER, CONTRIBUTION_TEMPLATE, INSTALLED_SOURCES, VALIDATOR, canonical, digest, inventoryOf, pinOf, prepareSkillTask, treeOf, writeSeam,
} from './helpers/skill-task.js';
import type { Json, SkillTaskFixture } from './helpers/skill-task.js';
import { NO_ALT, NO_CASE, NO_SHORT, altLeafOf, otherCaseOf, shortNameOf } from './helpers/path-spellings.js';

// The seam is the real source script as a child process (process.execPath, argv arrays) on disposable roots, with a real
// candidate folder, a real run of registry/skills/author-skill/scripts/draft.mjs as the producer emulation, and the real
// built dist/cli.js as the validator pin. Every case carries exactly one fault and asserts machine codes and exit codes.

const fixtures: SkillTaskFixture[] = [];
const make = async (options?: Parameters<typeof prepareSkillTask>[0]): Promise<SkillTaskFixture> => {
  const fixture = await prepareSkillTask(options);
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
async function untouched<T>(fx: SkillTaskFixture, act: () => T): Promise<T> {
  const before = await treeOf(fx.root);
  const value = act();
  expect(await treeOf(fx.root)).toEqual(before);
  return value;
}
const hex = (character: string): string => character.repeat(64);

describe('check-skill-return help and usage', () => {
  it('prints one usage text on stdout, exits 0 and claims no validation', () => {
    const result = spawnSync(process.execPath, [CHECKER, '--help'], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 30_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('--job <absolute-skill-task.json> [--result <absolute-skill-return.json>]');
    expect(result.stdout).toContain('does not run draft.mjs');
    expect(result.stdout.trim().startsWith('{')).toBe(false);
  });

  it.each<[string, (fx: SkillTaskFixture) => string[]]>([
    ['a duplicate --job selector', fx => ['--job', fx.taskFile, '--job', fx.taskFile]],
    ['a duplicate --result selector', fx => ['--job', fx.taskFile, '--result', fx.returnFile, '--result', fx.returnFile]],
    ['a duplicate --help selector', () => ['--help', '--help']],
    ['an unknown flag', fx => ['--job', fx.taskFile, '--unreviewed']],
    ['a positional argument', fx => ['--job', fx.taskFile, 'extra']],
    ['a relative task path', () => ['--job', 'skill-task.json']],
    ['a relative result path', fx => ['--job', fx.taskFile, '--result', 'skill-return.json']],
    ['a traversal alias in the task path', fx => ['--job', `${path.dirname(fx.taskFile)}${path.sep}..${path.sep}evidence${path.sep}skill-task.json`]],
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
      task: await pinOf(fx.taskFile), taskId: 'incident-actions', revision: 'r0', operation: 'create', intent: 'local',
      taskDigest: digest(canonical(fx.task)), baselineDigest: null,
      quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false,
    });
    expect(out.pins.runtime).toEqual(fx.task.runtime.executable);
    expect(out.pins.checker).toEqual(await pinOf(CHECKER));
    expect(out.pins.validator).toEqual(fx.task.runtime.validator);
    expect(out.pins.corpus).toEqual(fx.task.runtime.corpus);
    expect(out.pins.installed).toEqual(fx.task.installed);
    expect(out.pins.installed).toHaveLength(9);
    expect(out).not.toHaveProperty('candidate');
    expect(await fs.pathExists(fx.draft)).toBe(false);
  });

  it('passes a repair task whose baseline equals the live draft, with the canonical baseline digest', async () => {
    const fx = await make({ operation: 'repair' });
    const out = success(await untouched(fx, () => fx.pre()));
    expect(out).toMatchObject({ phase: 'preflight', operation: 'repair', recordValid: true });
    const inventory = fx.task.baseline.map((entry: Json) => ({ path: entry.path, kind: 'file', bytes: entry.bytes, sha256: entry.sha256 }))
      .sort((a: Json, b: Json) => (a.path < b.path ? -1 : 1));
    expect(out.baselineDigest).toBe(digest(canonical(inventory)));
    expect(out.baselineDigest).toBe(digest(canonical(await inventoryOf(fx.draft))));
  });

  it('passes an upstream task with its pinned contribution template inside the checkout', async () => {
    const fx = await make({ intent: 'upstream' });
    expect(success(await untouched(fx, () => fx.pre()))).toMatchObject({ intent: 'upstream', recordValid: true });
  });

  it('accepts the r1 repair of a produced r0 draft, linked to the r0 task and return', async () => {
    const fx = await make();
    await fx.produce();
    const before = await fs.readFile(fx.returnFile);
    await fx.reviseToRepair();
    expect(fx.task.previous.returnSha256).toBe(digest(before));
    expect(success(await untouched(fx, () => fx.pre()))).toMatchObject({ revision: 'r1', operation: 'repair', phase: 'preflight' });
  });
});

describe('preflight refusals: task record', () => {
  const cases: Array<[string, string, ((fx: SkillTaskFixture) => void | Promise<void>), ('failed' | 'unavailable')?]> = [
    ['an unknown task key', 'JOB_INVALID', fx => { fx.task.unreviewed = true; }],
    ['a missing task key', 'JOB_INVALID', fx => { delete fx.task.objective; }],
    ['a wrong kind constant', 'JOB_INVALID', fx => { fx.task.kind = 'review-job'; }],
    ['a previous link on revision r0', 'JOB_INVALID', fx => { fx.task.previous = { taskId: 'incident-actions', taskDigest: hex('a'), returnSha256: hex('b'), reviewResultSha256: null }; }],
    ['no previous link on revision r1', 'JOB_INVALID', fx => { fx.task.revision = 'r1'; }],
    ['a revision beyond r1', 'JOB_INVALID', fx => { fx.task.revision = 'r2'; }],
    ['an id that is not kebab-case', 'JOB_INVALID', fx => { fx.task.id = 'Not Kebab'; }],
    ['a malformed digest in a pin', 'JOB_INVALID', fx => { fx.task.installed[0].sha256 = 'xyz'; }],
    ['eight installed pins instead of nine', 'JOB_INVALID', fx => { fx.task.installed.pop(); }],
    ['both host version fields set', 'JOB_INVALID', fx => { fx.task.authoringHost.observedVersion = '2.1.0'; }],
    ['a native target', 'JOB_INVALID', fx => { fx.task.target = { host: 'claude' }; }],
    ['publication enabled in the budget', 'JOB_INVALID', fx => { fx.task.budget.publication = true; }],
    ['a candidate file budget above the maximum', 'JOB_INVALID', fx => { fx.task.budget.maxCandidateFiles = 33; }],
    ['duplicate acceptance ids', 'JOB_INVALID', fx => { fx.task.acceptance.push({ ...fx.task.acceptance[0] }); }],
    ['roles without SKILL.md as the subject', 'JOB_INVALID', fx => { fx.task.roles[0].role = 'support'; }],
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
    const elsewhere = path.join(fx.root, 'elsewhere', 'skill-task.json');
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
  const bothDraft = (fx: SkillTaskFixture, draft: string): void => { fx.task.roots.draft = draft; fx.task.draftJobTemplate.draftRoot = draft; };
  const cases: Array<[string, (fx: SkillTaskFixture) => void | Promise<void>]> = [
    ['producer and evidence roots that are equal', fx => { fx.task.roots.producer = fx.evidence; }],
    ['a draft root inside the producer root', fx => bothDraft(fx, path.join(fx.producer, 'draft'))],
    ['a draft root that contains the evidence root', fx => bothDraft(fx, fx.root)],
    ['a managed root that contains the evidence root', fx => { fx.task.roots.managed = [fx.evidence]; }],
    ['a protected root that is the producer root', fx => { fx.task.roots.protected = [fx.producer]; }],
    ['a draft root inside the source checkout', fx => bothDraft(fx, path.join(fx.task.source.checkout, 'tmp-draft-never-created'))],
    ['a draft root under a .codex directory', fx => bothDraft(fx, path.join(fx.root, '.codex', 'candidate', 'incident-actions'))],
    ['a draft root under a .claude directory', fx => bothDraft(fx, path.join(fx.root, '.claude', 'candidate', 'incident-actions'))],
    ['a producer root under a .cline directory', fx => { fx.task.roots.producer = path.join(fx.root, '.cline', 'producer'); }],
    ['a draft parent holding a stray entry', async fx => { await fs.outputFile(path.join(path.dirname(fx.draft), 'stray.txt'), 'not the draft\n'); }],
    ['a draft parent holding the producer root', async fx => { fx.task.roots.producer = path.join(path.dirname(fx.draft), 'producer'); await fs.ensureDir(fx.task.roots.producer); }],
    ['a linked ancestor of the producer root', async fx => {
      const alias = path.join(fx.root, 'linked-parent');
      await fs.symlink(fx.root, alias, 'junction');
      fx.task.roots.producer = path.join(alias, 'producer');
    }],
    ['a missing source checkout', fx => { fx.task.source.checkout = path.join(fx.root, 'absent-checkout'); fx.task.draftJobTemplate.sourceRoot = fx.task.source.checkout; }],
  ];
  it.each(cases)('refuses %s with ROOT_CONFLICT', async (_label, change) => {
    const fx = await make();
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });

  it.skipIf(process.platform === 'win32')('refuses a case-variant sibling of the draft folder in the draft parent with ROOT_CONFLICT, on a case-sensitive platform only (skipped on win32)', async () => {
    const fx = await make();
    await fs.ensureDir(path.join(path.dirname(fx.draft), 'Incident-Actions'));
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });
});

describe('preflight refusals: baseline and live draft state', () => {
  it('refuses a create task whose draft root already exists', async () => {
    const fx = await make();
    await fs.outputFile(path.join(fx.draft, 'SKILL.md'), 'An existing draft.\n');
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });
  it('refuses a create task that carries a baseline', async () => {
    const fx = await make();
    fx.task.baseline = [{ path: 'SKILL.md', bytes: 1, sha256: hex('a'), snapshot: path.join(fx.evidence, 'x.md') }];
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight');
  });

  const repair: Array<[string, (fx: SkillTaskFixture) => void | Promise<void>, ('failed' | 'unavailable')?]> = [
    ['a stale baseline (the draft changed after it was taken)', async fx => { await fs.appendFile(path.join(fx.draft, 'SKILL.md'), 'edited later\n'); }],
    ['a draft file that the baseline does not list', async fx => { await fs.outputFile(path.join(fx.draft, 'extra.md'), 'new file\n'); }],
    ['a baseline file that the draft lacks', async fx => { await fs.remove(path.join(fx.draft, 'notes', 'user.md')); }],
    ['an edited baseline snapshot', async fx => { await fs.appendFile(fx.task.baseline[0].snapshot, 'edited\n'); }, 'failed'],
    ['a missing baseline snapshot', async fx => { await fs.remove(fx.task.baseline[0].snapshot); }, 'unavailable'],
    ['a baseline snapshot outside the evidence root', async fx => {
      const moved = path.join(fx.pins, 'moved-snapshot.md');
      await fs.move(fx.task.baseline[0].snapshot, moved);
      fx.task.baseline[0].snapshot = moved;
    }],
    ['an empty baseline for a repair', fx => { fx.task.baseline = []; }],
    ['a missing draft root', async fx => { await fs.remove(fx.draft); }],
  ];
  it.each(repair)('refuses a repair with %s', async (_label, change, status) => {
    const fx = await make({ operation: 'repair' });
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'BASELINE_MISMATCH', 'preflight', status);
  });

  it('refuses a baseline missing from the roles with JOB_INVALID', async () => {
    const fx = await make({ operation: 'repair' });
    fx.task.roles = fx.task.roles.filter((role: Json) => role.path !== 'notes/user.md');
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'JOB_INVALID', 'preflight');
  });

  it('refuses a linked entry inside the draft folder', async () => {
    const fx = await make({ operation: 'repair' });
    await fs.symlink(fx.pins, path.join(fx.draft, 'linked-pins'), 'junction');
    failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight');
  });

  it('refuses a draft over the task file-count and per-file byte budgets with LIMIT', async () => {
    const files = await make({ operation: 'repair' });
    files.task.budget.maxCandidateFiles = 1;
    await files.save();
    failure(await untouched(files, () => files.pre()), 'LIMIT', 'preflight');
    const bytes = await make({ operation: 'repair' });
    bytes.task.budget.maxCandidateFileBytes = 8;
    await bytes.save();
    failure(await untouched(bytes, () => bytes.pre()), 'LIMIT', 'preflight');
  });
});

describe('preflight refusals: draft job template', () => {
  const cases: Array<[string, (fx: SkillTaskFixture) => void | Promise<void>]> = [
    ['a template that carries changes', fx => { fx.task.draftJobTemplate.changes = { 'SKILL.md': 'text' }; }],
    ['a template that carries a baseline map', fx => { fx.task.draftJobTemplate.baseline = {}; }],
    ['a template with an unknown key', fx => { fx.task.draftJobTemplate.command = 'node run.mjs'; }],
    ['a traversal allowed path', fx => { fx.task.draftJobTemplate.allowedPaths[1] = '../escape.md'; }],
    ['an absolute allowed path', fx => { fx.task.draftJobTemplate.allowedPaths[1] = path.join(fx.root, 'absolute.md'); }],
    ['a backslash allowed path', fx => { fx.task.draftJobTemplate.allowedPaths[1] = 'examples\\actions.md'; }],
    ['a colon allowed path', fx => { fx.task.draftJobTemplate.allowedPaths[1] = 'c:actions.md'; }],
    ['case-colliding allowed paths', fx => { fx.task.draftJobTemplate.allowedPaths = ['SKILL.md', 'skill.md']; }],
    ['a dot segment in an allowed path', fx => { fx.task.draftJobTemplate.allowedPaths[1] = 'examples/./actions.md'; }],
    ['an empty allowed path list', fx => { fx.task.draftJobTemplate.allowedPaths = []; }],
    ['an unsupported licence', fx => { fx.task.draftJobTemplate.provenance.license = 'GPL-3.0'; }],
    ['a non-original provenance disposition', fx => { fx.task.draftJobTemplate.provenance.disposition = 'adapted'; }],
    ['a blank owner', fx => { fx.task.draftJobTemplate.provenance.owner = '   '; }],
    ['a mode that differs from the operation', fx => { fx.task.draftJobTemplate.mode = 'repair'; }],
    ['an intent that differs from the task intent', fx => { fx.task.draftJobTemplate.intent = 'upstream'; }],
    ['a draft root that differs from the task root', fx => { fx.task.draftJobTemplate.draftRoot = path.join(fx.root, 'other', 'draft'); }],
    ['a source root that differs from the checkout', fx => { fx.task.draftJobTemplate.sourceRoot = path.join(fx.root, 'other-checkout'); }],
    ['a blank loading role', fx => { fx.task.draftJobTemplate.loading.role = '  '; }],
    ['an entry path that is not the installed entry', fx => { fx.task.draftJobTemplate.loading.entryPath = fx.inst('references/job.md'); }],
    ['an attribution path that is not the installed rule', fx => { fx.task.draftJobTemplate.loading.attributionPath = fx.inst('references/job.md'); }],
    ['a required file that is not an installed pin', fx => { fx.task.draftJobTemplate.loading.requiredFiles.push(path.join(fx.pins, 'skill-boilerplate-corpus.txt')); }],
    ['required tools without the pinned validator', fx => { fx.task.draftJobTemplate.requiredTools = [{ name: 'draft', path: fx.inst('scripts/draft.mjs') }]; }],
    ['a required tool whose file is missing', fx => { fx.task.draftJobTemplate.requiredTools.push({ name: 'absent', path: path.join(fx.root, 'absent-tool.mjs') }); }],
    ['a contribution template on a local task', fx => { fx.task.draftJobTemplate.contributionTemplate = CONTRIBUTION_TEMPLATE; }],
    ['a contribution pin on a local task', async fx => { fx.task.contributionTemplate = await pinOf(CONTRIBUTION_TEMPLATE); }],
  ];
  it.each(cases)('refuses %s with TEMPLATE_INVALID', async (_label, change) => {
    const fx = await make();
    await change(fx);
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'TEMPLATE_INVALID', 'preflight');
  });

  const upstream: Array<[string, (fx: SkillTaskFixture) => void | Promise<void>]> = [
    ['an upstream task without a contribution template', fx => { delete fx.task.draftJobTemplate.contributionTemplate; fx.task.contributionTemplate = null; }],
    ['an upstream task without the template pin', fx => { fx.task.contributionTemplate = null; }],
    ['a template pin that differs from the file', fx => { fx.task.contributionTemplate.sha256 = hex('c'); }],
    ['a template outside the pinned checkout', async fx => {
      const outside = path.join(fx.pins, 'artifact-contribution.md');
      await fs.copy(CONTRIBUTION_TEMPLATE, outside);
      fx.task.draftJobTemplate.contributionTemplate = outside;
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

describe('preflight refusals: the installed author-skill closure and loader', () => {
  const relatives = INSTALLED_SOURCES.map(([rel]) => rel);
  it.each(relatives)('refuses a missing installed %s with CLOSURE_MISSING', async rel => {
    const fx = await make();
    await fs.remove(fx.inst(rel));
    failure(await untouched(fx, () => fx.pre()), 'CLOSURE_MISSING', 'preflight', 'unavailable');
  });
  it.each(relatives)('refuses an edited installed %s with CLOSURE_MISSING', async rel => {
    const fx = await make();
    await fs.appendFile(fx.inst(rel), '\nAn unreviewed edit.\n');
    failure(await untouched(fx, () => fx.pre()), 'CLOSURE_MISSING', 'preflight', 'failed');
  });
  it('refuses an installed pin set that is not the reviewed nine (one path renamed)', async () => {
    const fx = await make();
    await fs.copy(fx.inst('references/quality.md'), fx.inst('references/quality-copy.md'));
    fx.task.installed[3] = await pinOf(fx.inst('references/quality-copy.md'));
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'CLOSURE_MISSING', 'preflight');
  });
  it('refuses an installed folder that is not named author-skill', async () => {
    const fx = await make();
    const renamed = path.join(path.dirname(fx.installedRoot), 'author-skill-copy');
    await fs.copy(fx.installedRoot, renamed);
    fx.task.installed = await Promise.all(INSTALLED_SOURCES.map(([rel]) => pinOf(path.join(renamed, ...rel.split('/')))));
    fx.task.draftJobTemplate.loading.entryPath = path.join(renamed, 'SKILL.md');
    fx.task.draftJobTemplate.loading.attributionPath = path.join(renamed, 'references', 'skill-attribution.md');
    fx.task.draftJobTemplate.loading.requiredFiles = ['references/job.md', 'references/provenance.md', 'references/quality.md', 'examples/one-draft.md', 'assets/report.md', 'scripts/draft.mjs']
      .map(rel => path.join(renamed, ...rel.split('/')));
    await fx.save();
    failure(await untouched(fx, () => fx.pre()), 'CLOSURE_MISSING', 'preflight');
  });

  // The working tree may hold CRLF text (core.autocrlf), so every anchor accepts either line ending.
  const loader: Array<[string, (text: string) => string]> = [
    ['no fork context', text => text.replace(/^context: fork\r?\n/m, '')],
    ['a wrong built-in agent', text => text.replace('agent: general-purpose', 'agent: Explore')],
    ['a foreground-flag change (background: true)', text => text.replace('background: false', 'background: true')],
    ['a missing background flag', text => text.replace(/^background: false\r?\n/m, '')],
    ['a disable-model-invocation flag', text => text.replace(/^background: false\r?\n/m, 'background: false\ndisable-model-invocation: true\n')],
    ['a different skill name', text => text.replace('name: author-skill', 'name: other-skill')],
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
  const cases: Array<[string, (fx: SkillTaskFixture) => void | Promise<void>, ('failed' | 'unavailable')?]> = [
    ['an executable that is not the running Node', async fx => { fx.task.runtime.executable = await pinOf(fx.inst('scripts/draft.mjs')); }, 'failed'],
    ['an executable pin with the wrong hash', fx => { fx.task.runtime.executable.sha256 = hex('d'); }, 'failed'],
    ['a checker that is not this installed script', async fx => { fx.task.runtime.checker = await pinOf(fx.inst('scripts/draft.mjs')); }, 'failed'],
    ['a checker pin with the wrong length', fx => { fx.task.runtime.checker.bytes += 1; }, 'failed'],
    ['a validator pin with the wrong hash', fx => { fx.task.runtime.validator.sha256 = hex('e'); }, 'failed'],
    ['a missing validator', fx => { fx.task.runtime.validator.path = path.join(fx.root, 'absent', 'cli.js'); }, 'unavailable'],
    ['a corpus pin with the wrong hash', fx => { fx.task.runtime.corpus.sha256 = hex('f'); }, 'failed'],
    ['an edited corpus file', async fx => { await fs.appendFile(fx.task.runtime.corpus.path, 'an edited line\n'); }, 'failed'],
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
  it('passes a create run: recomputed inventory, changed list, preserved list and the digest skill-check reports', async () => {
    const fx = await make();
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    const out = success(await untouched(fx, () => fx.post()));
    const inventory = await inventoryOf(fx.draft);
    expect(out).toMatchObject({
      version: 1, kind: 'deterministic', phase: 'postflight', recordValid: true, taskId: 'incident-actions', operation: 'create',
      taskDigest: digest(canonical(fx.task)), result: await pinOf(fx.returnFile), helper: { exitCode: 0, reportStatus: 'draft-prepared' },
      claimsNotAccepted: ['inventory', 'changed', 'claimedChecks'], producerIdentity: 'unauthenticated',
      quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false,
    });
    expect(out.candidate).toEqual({
      draftRoot: fx.draft, inventory, candidateDigest: digest(canonical(inventory)),
      changed: [{ path: 'SKILL.md', operation: 'create' }, { path: 'evals/evals.json', operation: 'create' }, { path: 'examples/actions.md', operation: 'create' }], preserved: [],
    });
    // The same digest by the three tools' shared convention: sorted keys (bytes, kind, path, sha256), no whitespace.
    expect(out.candidate.candidateDigest).toBe(digest(JSON.stringify(inventory.map(({ bytes, kind, path: file, sha256 }) => ({ bytes, kind, path: file, sha256 })))));
    const validator = spawnSync(process.execPath, [VALIDATOR, 'skill-check', '--artifact', fx.draft, '--corpus', fx.task.runtime.corpus.path, '--policy', 'agents-united-original'],
      { cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000 });
    const validated = JSON.parse(validator.stdout) as Json;
    expect(validated.inventoryComplete).toBe(true);
    expect(validated.candidateDigest).toBe(out.candidate.candidateDigest);
    expect(validated.inventory).toEqual(out.candidate.inventory);
  });

  it('passes a repair run that preserves the maintainer notes, and lists what it preserved', async () => {
    const fx = await make({ operation: 'repair' });
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    const out = success(await untouched(fx, () => fx.post()));
    expect(out.candidate.changed).toEqual([{ path: 'SKILL.md', operation: 'update' }, { path: 'evals/evals.json', operation: 'create' }, { path: 'references/usage.md', operation: 'update' }]);
    expect(out.candidate.preserved).toEqual(['notes/user.md']);
    expect(await fs.readFile(path.join(fx.draft, 'notes', 'user.md'), 'utf8')).toBe('The maintainer wrote this note by hand.\n');
    expect(out.baselineDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('passes an upstream run whose report prepares the pinned template with sent false', async () => {
    const fx = await make({ intent: 'upstream' });
    const produced = await fx.produce();
    expect(produced.report?.upstreamPreparation).toMatchObject({ base: 'dev', sent: false });
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ intent: 'upstream', phase: 'postflight', helper: { reportStatus: 'draft-prepared' } });
  });

  it('passes the r1 repair after r0, and refuses the r0 return presented for r1 with DIGEST_MISMATCH', async () => {
    const fx = await make();
    await fx.produce();
    const r0Return = await fs.readFile(fx.returnFile);
    await fx.reviseToRepair();
    await fs.outputFile(fx.returnFile, r0Return);
    failure(await untouched(fx, () => fx.post()), 'DIGEST_MISMATCH', 'postflight');
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    expect(success(fx.post())).toMatchObject({ revision: 'r1', operation: 'repair', helper: { reportStatus: 'draft-prepared' } });
  });

  it('passes a truthful blocked return and leaves the draft absent', async () => {
    const fx = await make();
    const produced = await fx.produce({ changes: { 'SKILL.md': 'No front matter at all.\n' } });
    expect(produced.run.status).toBe(1);
    expect(JSON.parse(produced.run.stderr).status).toBe('blocked');
    const out = success(await untouched(fx, () => fx.post()));
    expect(out).toMatchObject({ helper: { exitCode: 1, reportStatus: 'blocked' }, candidate: null, acceptedDraft: false });
    expect(await fs.pathExists(fx.draft)).toBe(false);
  });

  it('passes a blocked return that never ran the helper (runs 0) when the draft is untouched', async () => {
    const fx = await make();
    const produced = await fx.produce({ changes: { 'SKILL.md': 'No front matter at all.\n' } });
    Object.assign(produced.ret, { helper: { draftJob: null, stdout: null, stderr: null, exitCode: null, runs: 0 }, inventory: [], changed: [] });
    await produced.save();
    expect(success(await untouched(fx, () => fx.post()))).toMatchObject({ helper: { exitCode: null, reportStatus: 'blocked' }, candidate: null });
  });

  it('executes nothing supplied by the task, the return or the candidate', async () => {
    const fx = await make();
    const marker = path.join(fx.root, 'must-not-exist.txt');
    const payload = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')`;
    fx.changes['scripts/run.mjs'] = `import fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(marker)}, 'executed');\n`;
    fx.changes['package.json'] = JSON.stringify({ name: 'x', scripts: { postinstall: 'node scripts/run.mjs' } }) + '\n';
    fx.task.draftJobTemplate.allowedPaths.push('scripts/run.mjs', 'package.json');
    fx.task.roles.push({ path: 'scripts/run.mjs', role: 'support' }, { path: 'package.json', role: 'support' });
    await fx.save();
    expect(success(fx.pre()).recordValid).toBe(true);
    const produced = await fx.produce();
    expect(produced.run.status, produced.run.stderr).toBe(0);
    produced.ret.claimedChecks = [{ name: 'hostile', command: `node -e "${payload}"`, exitCode: 0, raw: null }];
    await produced.save();
    const out = success(await untouched(fx, () => fx.post()));
    expect(out).toMatchObject({ executionProof: 'unverified', acceptedDraft: false, claimsNotAccepted: ['inventory', 'changed', 'claimedChecks'] });
    expect(await fs.pathExists(marker)).toBe(false);
    expect(out.candidate.inventory.map((item: Json) => item.path)).toEqual(['SKILL.md', 'evals/evals.json', 'examples/actions.md', 'package.json', 'scripts/run.mjs']);
  });

  it('refuses, and changes no byte of, a create preflight over a draft root that a run already created', async () => {
    const fx = await make();
    await fx.produce();
    // The state-dependent preflight rule (create needs an absent root) is refused rather than "fixed".
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
    const variant = path.join(fx.producer, 'Skill-Return.json');
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
    ['a wrong kind constant', ret => { ret.kind = 'skill-task'; }],
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
    const produced = await fx.produce({ changes: { 'SKILL.md': 'No front matter at all.\n' } });
    await fs.writeFile(produced.stderrFile, Buffer.from([0xff, 0xfe, 0xfd]));
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight', 'failed');
  });

  it('refuses a forged validation text in the helper report', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.report!.validation = { status: 'passed', reason: 'All validators passed.' };
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
  });

  it('refuses a helper report with a different mode or an unknown key', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.report!.mode = 'repair';
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
    produced.report!.mode = 'create';
    produced.report!.published = true;
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'HELPER_RECORD', 'postflight');
  });
});

describe('postflight refusals: blocked and staging state', () => {
  it('refuses a draft status over a blocked helper run with BLOCKED_STATE', async () => {
    const fx = await make();
    const produced = await fx.produce({ changes: { 'SKILL.md': 'No front matter at all.\n' } });
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
    await fx.produce({ changes: { 'SKILL.md': 'No front matter at all.\n' } });
    await fs.outputFile(path.join(fx.draft, 'SKILL.md'), 'A draft appeared behind the blocked return.\n');
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses a blocked repair return over a modified draft', async () => {
    const fx = await make({ operation: 'repair' });
    const produced = await fx.produce({ changes: { 'SKILL.md': 'No front matter at all.\n' } });
    expect(produced.run.status).toBe(1);
    await fs.appendFile(path.join(fx.draft, 'SKILL.md'), 'edited while blocked\n');
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses a blocked return that claims changes', async () => {
    const fx = await make();
    const produced = await fx.produce({ changes: { 'SKILL.md': 'No front matter at all.\n' } });
    produced.ret.changed = [{ path: 'SKILL.md', operation: 'create' }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses a staging sibling left in the draft parent', async () => {
    const fx = await make();
    await fx.produce();
    await fs.ensureDir(path.join(path.dirname(fx.draft), '.author-skill-abc123'));
    failure(await untouched(fx, () => fx.post()), 'BLOCKED_STATE', 'postflight');
  });

  it('refuses a blocked return with non-empty externalActions with EXTERNAL_ACTION', async () => {
    const fx = await make();
    const produced = await fx.produce({ changes: { 'SKILL.md': 'No front matter at all.\n' } });
    produced.ret.externalActions = ['pushed a branch while blocked'];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'EXTERNAL_ACTION', 'postflight');
  });
});

describe('postflight refusals: saved draft job', () => {
  const cases: Array<[string, (job: Json) => void]> = [
    ['a different provenance owner', job => { job.provenance.owner = 'Someone Else'; }],
    ['a different draft root', job => { job.draftRoot = path.join(os.tmpdir(), 'elsewhere-draft'); }],
    ['an extra job key', job => { job.command = 'node run.mjs'; }],
    ['a missing job key', job => { delete job.requiredTools; }],
    ['a changes key outside the allowed paths', job => { job.changes['evil.md'] = 'outside the authorized scope\n'; }],
    ['a changes key with traversal', job => { job.changes['../escape.md'] = 'outside\n'; }],
    ['empty changes', job => { job.changes = {}; }],
  ];
  it.each(cases)('refuses %s with DRAFT_JOB_MISMATCH', async (_label, edit) => {
    const fx = await make();
    const produced = await fx.produce();
    edit(produced.job);
    await fs.writeFile(produced.jobFile, JSON.stringify(produced.job, null, 2));
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'DRAFT_JOB_MISMATCH', 'postflight');
  });

  it('refuses a repair job whose baseline map differs from the task baseline', async () => {
    const fx = await make({ operation: 'repair' });
    const produced = await fx.produce();
    produced.job.baseline['notes/user.md'] = hex('9');
    await fs.writeFile(produced.jobFile, JSON.stringify(produced.job, null, 2));
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'DRAFT_JOB_MISMATCH', 'postflight');
  });

  it('refuses a create job that carries a baseline', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.job.baseline = {};
    await fs.writeFile(produced.jobFile, JSON.stringify(produced.job, null, 2));
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'DRAFT_JOB_MISMATCH', 'postflight');
  });
});

describe('postflight refusals: final bytes against baseline, scope and changes', () => {
  it('refuses an extra file with SCOPE_VIOLATION', async () => {
    const fx = await make();
    await fx.produce();
    await fs.outputFile(path.join(fx.draft, 'extra.md'), 'not authorized\n');
    failure(await untouched(fx, () => fx.post()), 'SCOPE_VIOLATION', 'postflight');
  });

  it('refuses a deleted baseline file with SCOPE_VIOLATION', async () => {
    const fx = await make({ operation: 'repair' });
    await fx.produce();
    await fs.remove(path.join(fx.draft, 'notes', 'user.md'));
    failure(await untouched(fx, () => fx.post()), 'SCOPE_VIOLATION', 'postflight');
  });

  it('refuses a changed preservation-only note with PRESERVATION', async () => {
    const fx = await make({ operation: 'repair' });
    await fx.produce();
    await fs.writeFile(path.join(fx.draft, 'notes', 'user.md'), 'Rewritten after the run.\n');
    failure(await untouched(fx, () => fx.post()), 'PRESERVATION', 'postflight');
  });

  it('refuses a baseline file outside the changes that differs from its baseline bytes', async () => {
    const fx = await make({ operation: 'repair' });
    await fx.produce({ changes: { 'SKILL.md': fx.changes['SKILL.md']! } });
    await fs.writeFile(path.join(fx.draft, 'references', 'usage.md'), 'Edited behind the helper.\n');
    failure(await untouched(fx, () => fx.post()), 'PRESERVATION', 'postflight');
  });

  it('refuses a preservation-only file that the saved job rewrites', async () => {
    const fx = await make({ operation: 'repair' });
    fx.task.draftJobTemplate.allowedPaths.push('notes/user.md');
    await fx.save();
    await fx.produce({ changes: { ...fx.changes, 'notes/user.md': 'The helper rewrote the note.\n' } });
    failure(await untouched(fx, () => fx.post()), 'PRESERVATION', 'postflight');
  });

  it('refuses final bytes that differ from the saved changes with BYTES_MISMATCH', async () => {
    const fx = await make();
    await fx.produce();
    await fs.appendFile(path.join(fx.draft, 'SKILL.md'), 'Edited after the helper ran.\n');
    failure(await untouched(fx, () => fx.post()), 'BYTES_MISMATCH', 'postflight');
  });

  it('refuses a changes file that is missing from the final draft with BYTES_MISMATCH', async () => {
    const fx = await make();
    await fx.produce();
    await fs.remove(path.join(fx.draft, 'examples', 'actions.md'));
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

  it('refuses a helper report inventory that omits a path', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.report!.inventory = produced.report!.inventory.slice(1);
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'INVENTORY_MISMATCH', 'postflight');
  });

  it('refuses a helper report inventory that adds a path', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.report!.inventory = [...produced.report!.inventory, { path: 'invented.md', sha256: hex('1') }];
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
    produced.ret.changed = [{ path: 'SKILL.md', operation: 'update' }, { path: 'examples/actions.md', operation: 'create' }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'DIFF_MISMATCH', 'postflight');
    produced.ret.changed = [{ path: 'SKILL.md', operation: 'create' }];
    await produced.save();
    failure(await untouched(fx, () => fx.post()), 'DIFF_MISMATCH', 'postflight');
  });

  it('refuses a false provenance block with PROVENANCE_MISMATCH', async () => {
    const fx = await make();
    const produced = await fx.produce();
    produced.report!.provenance.license = 'Apache-2.0';
    await fs.writeFile(produced.stdoutFile, `${JSON.stringify(produced.report, null, 2)}\n`);
    await produced.repin();
    failure(await untouched(fx, () => fx.post()), 'PROVENANCE_MISMATCH', 'postflight');
  });

  it('refuses a missing evidenceClaim in the provenance block', async () => {
    const fx = await make();
    const produced = await fx.produce();
    delete produced.report!.provenance.evidenceClaim;
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

  it('refuses a pinned input that changes between its first read and the final recheck with STALE_INPUT', async () => {
    const fx = await make();
    await fx.produce();
    const preload = await writeSeam(fx.root);
    const result = fx.check(['--job', fx.taskFile, '--result', fx.returnFile], { preload, env: { SEAM_WHEN: 'skill-return.json', SEAM_TARGET: fx.taskFile } });
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

// The preflight refuses what skill-return.mjs refuses, for the same root reason, before draft.mjs writes anything: every string comparison
// stays and the physical comparison is added (P26-A). Each alias case looks its spelling up on the real volume and skips when there is none.
describe('preflight compares roots by physical path as well as by string (P26-A)', () => {
  const overlap = /overlaps a source, managed or protected root/;
  const bothDraft = (fx: SkillTaskFixture, draft: string): void => { fx.task.roots.draft = draft; fx.task.draftJobTemplate.draftRoot = draft; };
  const place = (fx: SkillTaskFixture, which: 'draft' | 'producer', dir: string): void => {
    if (which === 'draft') bothDraft(fx, path.join(dir, 'incident-actions'));
    else fx.task.roots.producer = dir;
  };
  it.for(['draft', 'producer'] as const)('refuses a %s root under the NTFS short name of a protected folder with ROOT_CONFLICT (runs on Windows with short names, skipped otherwise)', async (which, ctx) => {
    const fx = await make();
    const prot = path.join(fx.root, 'Protected Folder');
    await fs.ensureDir(path.join(prot, 'out'));
    const short = shortNameOf(prot);
    if (!short) ctx.skip(NO_SHORT);
    fx.task.roots.protected = [prot];
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
    fx.task.roots.protected = [prot];
    place(fx, which, path.join(flipped!, 'out'));
    await fx.save();
    expect(failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight').reason).toMatch(overlap);
  });
  it('refuses a producer root under the NTFS short name of a .claude folder as a managed Host path (runs on Windows with short names, skipped otherwise)', async ctx => {
    const fx = await make();
    const host = path.join(fx.root, '.claude');
    await fs.ensureDir(path.join(host, 'out'));
    const short = shortNameOf(host);
    if (!short) ctx.skip(NO_SHORT);
    fx.task.roots.producer = path.join(short!, 'out');
    await fx.save();
    expect(failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight').reason).toMatch(/managed Host path/);
  });
  it('passes a legal task whose disjoint roots are given in two spellings (a protected folder by its short name or other case, the rest long)', async ctx => {
    const fx = await make();
    const prot = path.join(fx.root, 'Protected Folder');
    await fs.ensureDir(prot);
    const alt = altLeafOf(prot, false);
    if (!alt) ctx.skip(NO_ALT);
    fx.task.roots.protected = [alt!];
    await fx.save();
    success(await untouched(fx, () => fx.pre()));
  });
  it('passes a repair whose draft root is another spelling of its own folder: the draft folder is not a stray in its parent', async ctx => {
    const fx = await make({ operation: 'repair' });
    const leaf = altLeafOf(fx.draft, false);
    if (!leaf) ctx.skip(NO_ALT);
    bothDraft(fx, leaf!);
    await fx.save();
    success(await untouched(fx, () => fx.pre()));
  });
  it('still refuses a stray beside a draft root given in another spelling of its own folder', async ctx => {
    const fx = await make({ operation: 'repair' });
    const leaf = altLeafOf(fx.draft, false);
    if (!leaf) ctx.skip(NO_ALT);
    bothDraft(fx, leaf!);
    await fx.save();
    await fs.outputFile(path.join(path.dirname(fx.draft), 'stray.txt'), 'not the draft\n');
    expect(failure(await untouched(fx, () => fx.pre()), 'ROOT_CONFLICT', 'preflight').path).toBe('stray.txt');
  });
  it('still refuses a link beside the draft folder that points at it: entries are compared by name, never by what a link resolves to', async () => {
    const fx = await make({ operation: 'repair' });
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

// The maintainer's decision of 2026-11-17: postflight refuses a draft without evals/evals.json only where the skill-check policy the task
// pins requires the file. All three policies required it; adapted-source no longer does (src/core/skill-layout.ts holds the table).
describe('postflight: the evals file follows the skill-check policy the task pins', () => {
  const POLICIES = [['agents-united-original', true], ['private-owner', true], ['adapted-source', false]] as const;

  it.each(POLICIES)('%s with the evals file: passes', async (policy) => {
    const fx = await make({ policy });
    expect((await fx.produce()).run.status).toBe(0);
    expect(await fs.pathExists(path.join(fx.draft, 'evals', 'evals.json'))).toBe(true);
    expect(success(fx.post())).toMatchObject({ phase: 'postflight' });
  });

  it.each(POLICIES)('%s without the evals file: follows the table', async (policy, required) => {
    const fx = await make({ policy, evals: false });
    expect((await fx.produce()).run.status).toBe(0);
    const result = fx.post();
    if (!required) {
      expect(success(result)).toMatchObject({ phase: 'postflight' });
      return;
    }
    const out = failure(result, 'EVALS_MISSING', 'postflight');
    expect(out.reason).toContain(policy);
    expect(out.reason).toContain('evals/evals.json');
  });

  it('a repair whose baseline lacks the evals file is refused where the policy requires it, and passes where it does not', async () => {
    const required = await make({ operation: 'repair', policy: 'private-owner', evals: false });
    expect((await required.produce()).run.status).toBe(0);
    failure(required.post(), 'EVALS_MISSING', 'postflight');
    const exempt = await make({ operation: 'repair', policy: 'adapted-source', evals: false });
    expect((await exempt.produce()).run.status).toBe(0);
    expect(success(exempt.post())).toMatchObject({ phase: 'postflight', operation: 'repair' });
  });

  it('a repair that adds the evals file to a baseline that lacked it passes under a requiring policy', async () => {
    const fx = await make({ operation: 'repair', policy: 'agents-united-original' });
    expect((await fx.produce()).run.status).toBe(0);
    expect(success(fx.post()).candidate.changed).toContainEqual({ path: 'evals/evals.json', operation: 'create' });
  });

  it('refuses an old task without the policy field at preflight with JOB_INVALID, never reading it as no requirement', async () => {
    const fx = await make();
    delete fx.task.skillCheckPolicy;
    await fx.save();
    const out = failure(fx.pre(), 'JOB_INVALID', 'preflight');
    expect(out.reason).toContain('skillCheckPolicy');
  });

  it('refuses a policy the table does not know with JOB_INVALID', async () => {
    const fx = await make();
    fx.task.skillCheckPolicy = 'anything-goes';
    await fx.save();
    failure(fx.pre(), 'JOB_INVALID', 'preflight');
  });
});
