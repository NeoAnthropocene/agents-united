/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { canonical, digest, inventoryOf, pinOf, prepareSkillTask, treeOf } from './helpers/skill-task.js';
import type { Json, PrepareSkillTaskOptions, Produced, SkillTaskFixture } from './helpers/skill-task.js';

// The author-skill return script (registry/skills/author-skill/scripts/skill-return.mjs), run installed as a child process on
// disposable roots. It writes exactly one file, <roots.producer>/skill-return.json, and nothing else. Every legal return of
// skill-return.schema.json it can write must pass the coordinator's checker: that checker stays the authority.

const SCRIPT_SOURCE = path.resolve('registry/skills/author-skill/scripts/skill-return.mjs');
const fixtures: SkillTaskFixture[] = [];
const make = async (options?: PrepareSkillTaskOptions): Promise<SkillTaskFixture> => {
  const fixture = await prepareSkillTask(options);
  fixtures.push(fixture);
  return fixture;
};
afterEach(async () => { await Promise.all(fixtures.splice(0).map(fixture => fixture.cleanup())); });

const script = (fx: SkillTaskFixture, args: string[]): SpawnSyncReturns<string> =>
  spawnSync(process.execPath, [fx.inst('scripts/skill-return.mjs'), ...args], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000 });
const helperFlags = (fx: SkillTaskFixture, produced: Produced): string[] => [
  '--job', fx.taskFile, '--saved-job', produced.jobFile, '--stdout', produced.stdoutFile, '--stderr', produced.stderrFile, '--exit-code', String(produced.run.status),
];
/** The fixture writes a hand-built return of its own; the script under test starts from an empty return path. */
async function produce(fx: SkillTaskFixture, options?: Parameters<SkillTaskFixture['produce']>[0]): Promise<Produced> {
  const produced = await fx.produce(options);
  await fs.remove(fx.returnFile);
  return produced;
}
const writeNotes = async (fx: SkillTaskFixture, notes: Json): Promise<string> => {
  const file = path.join(fx.producer, 'skill-notes.json');
  await fs.writeJson(file, notes);
  return file;
};
/** Changes that draft.mjs refuses (an entry without front matter) while the saved job still equals the template plus changes. */
const BLOCKED: { changes: Record<string, string> } = { changes: { 'SKILL.md': 'No front matter at all.\n' } };
const OPEN = [{ id: 'helper-blocked', description: 'draft.mjs refused the saved job.' }];

/** Exit 1, an empty stdout and one blocked JSON line on stderr: the draft.mjs convention. */
function refused(result: SpawnSyncReturns<string>, reason?: RegExp): Json {
  expect(result.status, result.stdout + result.stderr).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim().split('\n')).toHaveLength(1);
  const out = JSON.parse(result.stderr) as Json;
  expect(out.status).toBe('blocked');
  expect(typeof out.reason).toBe('string');
  if (reason) expect(out.reason).toMatch(reason);
  return out;
}
/** Run the script and require that no byte under the fixture root changed (a refusal writes nothing). */
async function refusedUnchanged(fx: SkillTaskFixture, args: string[], reason?: RegExp): Promise<Json> {
  const before = await treeOf(fx.root);
  const out = refused(script(fx, args), reason);
  expect(await treeOf(fx.root)).toEqual(before);
  return out;
}
/** The script's one JSON line, then the coordinator's postflight check of what it wrote. */
function written(fx: SkillTaskFixture, run: SpawnSyncReturns<string>): Json {
  expect(run.status, run.stdout + run.stderr).toBe(0);
  expect(run.stderr).toBe('');
  expect(run.stdout.trim().split('\n')).toHaveLength(1);
  const post = fx.post();
  expect(post.status, post.stdout + post.stderr).toBe(0);
  return JSON.parse(run.stdout) as Json;
}

describe('skill-return.mjs writes a return that the checker accepts', () => {
  it('writes exactly one file, the producer-root skill-return.json, after exit 0 and prints one JSON line', async () => {
    const fx = await make();
    const produced = await produce(fx);
    expect(produced.run.status, produced.run.stderr).toBe(0);
    const before = await treeOf(fx.root);
    const out = written(fx, script(fx, helperFlags(fx, produced)));
    const after = await treeOf(fx.root);
    expect(Object.keys(after).filter(rel => !(rel in before))).toEqual([path.relative(fx.root, fx.returnFile).split(path.sep).join('/')]);
    for (const rel of Object.keys(before)) expect(after[rel], rel).toBe(before[rel]);
    expect(out).toMatchObject({ status: 'return-written', returnStatus: 'draft', taskDigest: digest(canonical(fx.task)), helperRuns: 1 });
    expect(out.return).toEqual(await pinOf(fx.returnFile));
  });

  it('computes status, id, digest, helper pins, inventory, changed list and nothing the fork did not hand over (exit 0, create)', async () => {
    const fx = await make();
    const produced = await produce(fx);
    written(fx, script(fx, helperFlags(fx, produced)));
    const ret = await fs.readJson(fx.returnFile) as Json;
    expect(ret).toEqual({
      version: 1, kind: 'skill-return', taskId: fx.task.id, taskDigest: digest(canonical(fx.task)), status: 'draft',
      helper: { draftJob: await pinOf(produced.jobFile), stdout: await pinOf(produced.stdoutFile), stderr: await pinOf(produced.stderrFile), exitCode: 0, runs: 1 },
      inventory: await inventoryOf(fx.draft, false),
      changed: Object.keys(fx.changes).sort().map(file => ({ path: file, operation: 'create' })),
      report: null, claimedChecks: [], openItems: [], unverified: [], externalActions: [],
    });
  });

  it('pins the report when one is handed over and takes the claims from the notes file', async () => {
    const fx = await make();
    const produced = await produce(fx);
    const notes = await writeNotes(fx, {
      claimedChecks: [{ name: 'layout', command: 'node --version', exitCode: 0, raw: null }], unverified: ['Live loading is unverified.'], openItems: [{ id: 'review-open', description: 'Review remains open.' }],
    });
    written(fx, script(fx, [...helperFlags(fx, produced), '--report', produced.reportFile, '--notes', notes]));
    expect(await fs.readJson(fx.returnFile)).toMatchObject({
      status: 'draft', report: await pinOf(produced.reportFile), unverified: ['Live loading is unverified.'], openItems: [{ id: 'review-open', description: 'Review remains open.' }],
      claimedChecks: [{ name: 'layout', command: 'node --version', exitCode: 0, raw: null }], externalActions: [],
    });
  });

  it('reaches draft for a repair task, listing the preserved note as unchanged, and for an r1 repair that changes only the allowed file', async () => {
    const repair = await make({ operation: 'repair' });
    const repaired = await produce(repair);
    expect(repaired.run.status, repaired.run.stderr).toBe(0);
    written(repair, script(repair, helperFlags(repair, repaired)));
    const ret = await fs.readJson(repair.returnFile) as Json;
    expect(ret.changed).toEqual([{ path: 'SKILL.md', operation: 'update' }, { path: 'references/usage.md', operation: 'update' }]);
    expect(ret.inventory.map((item: Json) => item.path)).toEqual(['SKILL.md', 'notes/user.md', 'references/usage.md'].sort());

    const fx = await make();
    await fx.produce();
    await fx.reviseToRepair();
    const next = await produce(fx);
    expect(next.run.status, next.run.stderr).toBe(0);
    written(fx, script(fx, helperFlags(fx, next)));
    expect((await fs.readJson(fx.returnFile) as Json).changed).toEqual([{ path: 'SKILL.md', operation: 'update' }]);
  });

  it('reaches blocked after a helper exit 1 with the named open item, an untouched draft and no changed files', async () => {
    const fx = await make();
    const produced = await produce(fx, BLOCKED);
    expect(produced.run.status).toBe(1);
    const notes = await writeNotes(fx, { openItems: OPEN });
    const out = written(fx, script(fx, [...helperFlags(fx, produced), '--notes', notes]));
    expect(out).toMatchObject({ returnStatus: 'blocked', helperRuns: 1 });
    expect(await fs.readJson(fx.returnFile)).toMatchObject({ status: 'blocked', helper: { exitCode: 1, runs: 1 }, inventory: [], changed: [], openItems: OPEN });
  });

  it('reaches blocked after a helper exit 1 for a repair task whose draft is still the baseline', async () => {
    const fx = await make({ operation: 'repair' });
    const produced = await produce(fx, BLOCKED);
    expect(produced.run.status).toBe(1);
    const notes = await writeNotes(fx, { openItems: OPEN });
    written(fx, script(fx, [...helperFlags(fx, produced), '--notes', notes]));
    const ret = await fs.readJson(fx.returnFile) as Json;
    expect(ret).toMatchObject({ status: 'blocked', changed: [], helper: { exitCode: 1, runs: 1 } });
    expect(ret.inventory).toEqual(await inventoryOf(fx.draft, false));
  });

  it('reaches blocked when the helper never ran, for a create task and for a repair task whose draft is the baseline', async () => {
    const fx = await make();
    const notes = await writeNotes(fx, { openItems: [{ id: 'no-helper', description: 'The task lacked an input.' }] });
    written(fx, script(fx, ['--job', fx.taskFile, '--no-helper', '--notes', notes]));
    expect(await fs.readJson(fx.returnFile)).toMatchObject({
      status: 'blocked', helper: { draftJob: null, stdout: null, stderr: null, exitCode: null, runs: 0 }, inventory: [], changed: [], report: null,
    });

    const repair = await make({ operation: 'repair' });
    const repairNotes = await writeNotes(repair, { openItems: OPEN });
    written(repair, script(repair, ['--job', repair.taskFile, '--no-helper', '--notes', repairNotes]));
    const ret = await fs.readJson(repair.returnFile) as Json;
    expect(ret).toMatchObject({ status: 'blocked', changed: [], helper: { runs: 0 } });
    expect(ret.inventory).toEqual(await inventoryOf(repair.draft, false));
  });

  it('computes the task digest by exactly the rule the coordinator checker uses, whatever the key order of the task file', async () => {
    const fx = await make();
    const pre = fx.pre();
    expect(pre.status, pre.stderr).toBe(0);
    const checkerDigest = JSON.parse(pre.stdout).taskDigest as string;
    const produced = await produce(fx);
    await fs.writeFile(fx.taskFile, JSON.stringify(Object.fromEntries(Object.entries(fx.task).reverse())));
    written(fx, script(fx, helperFlags(fx, produced)));
    expect((await fs.readJson(fx.returnFile) as Json).taskDigest).toBe(checkerDigest);
  });

  it('writes valid JSON for path-valued fields that contain backslashes', async () => {
    const fx = await make();
    const produced = await produce(fx);
    // On Windows every real path holds backslashes. Elsewhere a backslash is a legal file-name character, so the saved job is
    // copied to a file whose name holds one; the escaping under test is the same JSON.stringify of the same kind of string.
    let savedJob = produced.jobFile;
    if (process.platform !== 'win32') {
      savedJob = path.join(fx.producer, 'saved\\draft-job.json');
      await fs.copy(produced.jobFile, savedJob);
    }
    const flags = helperFlags(fx, produced);
    flags[flags.indexOf('--saved-job') + 1] = savedJob;
    written(fx, script(fx, flags));
    const raw = await fs.readFile(fx.returnFile, 'utf8');
    expect(savedJob).toContain('\\');
    expect(raw).toContain(JSON.stringify(savedJob));
    expect(raw).toContain('\\\\');
    expect((JSON.parse(raw) as Json).helper.draftJob.path).toBe(savedJob);
  });

  it('reads only Node standard modules and imports nothing from another Skill', async () => {
    const text = (await fs.readFile(SCRIPT_SOURCE, 'utf8')).split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n');
    const imports = [...text.matchAll(/^import .* from '([^']+)';/gm)].map(match => match[1]!);
    expect(imports.length).toBeGreaterThan(0);
    for (const name of imports) expect(name, name).toMatch(/^node:/);
    expect(text).not.toMatch(/coordinate-artifact|check-skill-return|import\(|child_process/);
  });
});

describe('skill-return.mjs refusals', () => {
  const ready = async (options?: PrepareSkillTaskOptions) => {
    const fx = await make(options);
    const produced = await produce(fx);
    return { fx, produced, flags: helperFlags(fx, produced) };
  };
  const replaceFlag = (flags: string[], name: string, value: string): string[] => {
    const next = [...flags];
    next[next.indexOf(name) + 1] = value;
    return next;
  };

  it('refuses a relative path, an unknown flag, a positional, a duplicate flag and a missing --job', async () => {
    const { fx, flags } = await ready();
    for (const args of [replaceFlag(flags, '--job', 'skill-task.json'), replaceFlag(flags, '--stdout', 'draft.stdout.json'), [...flags, '--force'], [...flags, 'extra'], [...flags, '--exit-code', '0'], flags.slice(2)]) {
      await refusedUnchanged(fx, args);
    }
  });
  it('refuses a linked path in front of a helper file and a link inside the draft', async () => {
    const { fx, produced, flags } = await ready();
    const linked = path.join(fx.producer, 'linked');
    await fs.symlink(fx.producer, linked, 'junction');
    await refusedUnchanged(fx, replaceFlag(flags, '--saved-job', path.join(linked, path.basename(produced.jobFile))), /link/i);
    await fs.remove(linked);
    await fs.symlink(fx.pins, path.join(fx.draft, 'linked-pins'), 'junction');
    await refusedUnchanged(fx, flags, /link/i);
  });
  it('refuses a helper file, a report and a notes file outside the producer root, and the return itself as an input', async () => {
    const { fx, produced, flags } = await ready();
    const outside = path.join(fx.pins, 'outside.json');
    await fs.writeFile(outside, '{}');
    for (const name of ['--saved-job', '--stdout', '--stderr']) await refusedUnchanged(fx, replaceFlag(flags, name, outside), /producer/i);
    await refusedUnchanged(fx, [...flags, '--report', outside], /producer/i);
    await refusedUnchanged(fx, [...flags, '--notes', outside], /producer/i);
    await refusedUnchanged(fx, replaceFlag(flags, '--saved-job', fx.returnFile), /producer|missing/i);
    expect(produced.run.status).toBe(0);
  });
  it('replaces a hard-linked return by a rename and leaves the other name of the inode untouched', async () => {
    const { fx, flags } = await ready();
    const other = path.join(fx.pins, 'precious.txt');
    await fs.writeFile(other, 'precious bytes');
    await fs.link(other, fx.returnFile);
    written(fx, script(fx, flags));
    expect(await fs.readFile(other, 'utf8')).toBe('precious bytes');
    expect((await fs.readJson(fx.returnFile) as Json).kind).toBe('skill-return');
    expect((await fs.readdir(fx.producer)).filter(name => name.endsWith('.tmp'))).toEqual([]);
  });
  it('refuses a blocked return over a draft that is not in the state the checker needs', async () => {
    const create = await make();
    await fs.outputFile(path.join(create.draft, 'SKILL.md'), 'A draft appeared.\n');
    const notes = await writeNotes(create, { openItems: OPEN });
    await refusedUnchanged(create, ['--job', create.taskFile, '--no-helper', '--notes', notes], /absent draft/i);
    const repair = await make({ operation: 'repair' });
    const repairNotes = await writeNotes(repair, { openItems: OPEN });
    await fs.appendFile(path.join(repair.draft, 'references', 'usage.md'), 'edited while blocked\n');
    await refusedUnchanged(repair, ['--job', repair.taskFile, '--no-helper', '--notes', repairNotes], /baseline/i);
  });
  it('refuses a draft return without a draft folder, a stray beside the draft and external actions', async () => {
    const { fx, flags } = await ready();
    await fs.writeFile(path.join(path.dirname(fx.draft), 'stray.txt'), 'x');
    await refusedUnchanged(fx, flags, /besides the draft/i);
    await fs.remove(path.join(path.dirname(fx.draft), 'stray.txt'));
    const notes = await writeNotes(fx, { externalActions: ['pushed a branch'] });
    await refusedUnchanged(fx, [...flags, '--notes', notes], /externalActions/);
    await fs.remove(notes);
    await fs.remove(fx.draft);
    await refusedUnchanged(fx, flags, /needs a draft folder/i);
  });
  it('refuses a draft that differs from the saved job: a changed byte, an extra file, a missing entry, a file that is not UTF-8 text', async () => {
    const { fx, flags } = await ready();
    const entry = path.join(fx.draft, 'SKILL.md');
    const original = await fs.readFile(entry);
    await fs.appendFile(entry, 'edited after the helper ran\n');
    await refusedUnchanged(fx, flags, /Final bytes differ/);
    await fs.writeFile(entry, original);
    await fs.outputFile(path.join(fx.draft, 'extra.md'), 'not in the job\n');
    await refusedUnchanged(fx, flags, /neither a change nor baseline/);
    await fs.remove(path.join(fx.draft, 'extra.md'));
    await fs.outputFile(path.join(fx.draft, 'examples', 'actions.md'), Buffer.from([0xff, 0xfe, 0x00]));
    await refusedUnchanged(fx, flags, /not UTF-8/);
    await fs.remove(entry);
    await fs.outputFile(path.join(fx.draft, 'examples', 'actions.md'), fx.changes['examples/actions.md']!);
    await refusedUnchanged(fx, flags, /Final bytes differ|SKILL\.md/);
  });
  it('refuses a saved job that differs from the template, in any helper run, and a changes key outside the allowed paths', async () => {
    const { fx, produced, flags } = await ready();
    const job = await fs.readJson(produced.jobFile) as Json;
    await fs.writeJson(produced.jobFile, { ...job, intent: 'upstream' });
    await refusedUnchanged(fx, flags, /differs from the template at intent/);
    await fs.writeJson(produced.jobFile, { ...job, changes: { ...job.changes, 'notes/outside.md': 'Outside.\n' } });
    await refusedUnchanged(fx, flags, /outside the allowed paths/);
    const blocked = await make();
    const refusedRun = await produce(blocked, BLOCKED);
    expect(refusedRun.run.status).toBe(1);
    await fs.writeJson(refusedRun.jobFile, { ...(await fs.readJson(refusedRun.jobFile) as Json), mode: 'repair' });
    const notes = await writeNotes(blocked, { openItems: OPEN });
    await refusedUnchanged(blocked, [...helperFlags(blocked, refusedRun), '--notes', notes], /differs from the template at mode/);
  });
  it('refuses a repair draft whose preservation-only note was edited', async () => {
    const { fx, flags } = await ready({ operation: 'repair' });
    await fs.appendFile(path.join(fx.draft, 'notes', 'user.md'), 'overwritten\n');
    await refusedUnchanged(fx, flags, /preserved baseline file/);
  });
  it('refuses another spelling of the return itself as an input (the same physical file)', async () => {
    const { fx, flags } = await ready();
    await fs.writeFile(fx.returnFile, '{}');
    const spellings: string[] = [];
    // Another case of the file name: a spelling of the same file only where the volume ignores case (found out by looking it up).
    const flipped = path.join(path.dirname(fx.returnFile), path.basename(fx.returnFile).toUpperCase());
    if (await fs.pathExists(flipped)) spellings.push(flipped);
    // The Windows short name, where the volume has 8.3 names enabled.
    if (process.platform === 'win32') {
      const short = spawnSync('cmd', ['/d', '/s', '/c', `"for %I in ("${fx.returnFile}") do @echo %~sI"`], { encoding: 'utf8', windowsVerbatimArguments: true }).stdout.trim();
      if (short && short.toLowerCase() !== fx.returnFile.toLowerCase() && await fs.pathExists(short)) spellings.push(short);
    }
    spellings.push(fx.returnFile);
    for (const spelling of spellings) await refusedUnchanged(fx, [...flags, '--report', spelling], /other than the return/i);
  });
  it('writes through a completion loop and a cleanup scope, and compares the bytes read back', async () => {
    const text = await fs.readFile(SCRIPT_SOURCE, 'utf8');
    expect(text).toContain('function writeAll');
    expect(text).not.toContain('fs.writeSync(fd, text)');
    expect(text).toContain('differs from the bytes written');
  });
  it('refuses an existing directory at the return path', async () => {
    const { fx, flags } = await ready();
    await fs.ensureDir(fx.returnFile);
    await refusedUnchanged(fx, flags, /return path/i);
  });
  it('refuses contradictory flags: --no-helper with helper flags, a missing helper flag, and an exit code that does not match the files', async () => {
    const { fx, flags } = await ready();
    await refusedUnchanged(fx, [...flags, '--no-helper'], /--no-helper/);
    await refusedUnchanged(fx, flags.slice(0, -2), /--exit-code|--no-helper/);
    await refusedUnchanged(fx, replaceFlag(flags, '--exit-code', '1'), /Exit 1/);
    await refusedUnchanged(fx, replaceFlag(flags, '--exit-code', '2'), /0 or 1/);
    const blocked = await make();
    const produced = await produce(blocked, BLOCKED);
    await refusedUnchanged(blocked, replaceFlag(helperFlags(blocked, produced), '--exit-code', '0'), /Exit 0/);
  });
  it('refuses a blocked return without an open item, an unknown notes key and a status written as a note', async () => {
    const fx = await make();
    await refusedUnchanged(fx, ['--job', fx.taskFile, '--no-helper'], /open item/i);
    const notes = await writeNotes(fx, { status: 'draft' });
    await refusedUnchanged(fx, ['--job', fx.taskFile, '--no-helper', '--notes', notes], /status/);
    await fs.writeJson(notes, { accepted: true });
    await refusedUnchanged(fx, ['--job', fx.taskFile, '--no-helper', '--notes', notes], /accepted/);
  });
  it('refuses a task that is not a skill-task and one that is not the evidence-root skill-task.json', async () => {
    const { fx, flags } = await ready();
    const elsewhere = path.join(fx.pins, 'skill-task.json');
    await fs.writeFile(elsewhere, JSON.stringify(fx.task));
    await refusedUnchanged(fx, replaceFlag(flags, '--job', elsewhere), /evidence/);
    fx.task.kind = 'bundle-task';
    await fx.save();
    await refusedUnchanged(fx, flags, /skill-task/);
  });
  it('refuses overlapping roots and a missing producer root', async () => {
    const { fx, flags } = await ready();
    fx.task.roots.producer = fx.draft;
    await fx.save();
    await refusedUnchanged(fx, flags, /overlap/i);
    fx.task.roots.producer = path.join(fx.root, 'absent-producer');
    await fx.save();
    await refusedUnchanged(fx, flags, /producer/i);
  });
  it('refuses a draft file above the task budget', async () => {
    const { fx, flags } = await ready();
    fx.task.budget.maxCandidateFileBytes = 64;
    await fx.save();
    await refusedUnchanged(fx, flags, /budget/i);
  });
});

describe('skill-return.mjs compares physical roots, not path strings (review of P25-B, point 1)', () => {
  const overlapRefusal = /overlaps a source, managed or protected root/;
  const shortNameOf = (dir: string): string | undefined => {
    const short = spawnSync('cmd', ['/d', '/s', '/c', `"for %I in ("${dir}") do @echo %~sI"`], { encoding: 'utf8', windowsVerbatimArguments: true }).stdout.trim();
    return short && short.toLowerCase() !== dir.toLowerCase() && fs.pathExistsSync(short) ? short : undefined;
  };
  // A second spelling of one existing folder: the NTFS short name on Windows, else another case where the volume ignores case.
  // lexicallyDistinct: the checker must see a different string (on Windows it folds case, so only a short name counts there).
  const altSpelling = (dir: string, lexicallyDistinct: boolean): string | undefined => {
    if (process.platform === 'win32') {
      const short = shortNameOf(dir);
      if (short || lexicallyDistinct) return short;
    }
    const flipped = path.join(path.dirname(dir), path.basename(dir).toUpperCase());
    return flipped !== dir && fs.pathExistsSync(flipped) ? flipped : undefined;
  };
  const NO_ALT = 'no second spelling of an existing folder on this volume (a short name on Windows, another case on a case-insensitive volume)';
  it('refuses a draft root under a protected root that does not exist yet (a plain string comparison refuses this too: it only runs the absent-tail walk of physical() on every platform and is not proof of the alias comparison)', async () => {
    const fx = await make();
    const prot = path.join(fx.root, 'absent-protected');
    fx.task.roots.protected = [prot];
    fx.task.roots.draft = path.join(prot, 'candidate', 'x');
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile], overlapRefusal);
  });
  it('refuses a producer root reached through another case of a protected folder (runs where the volume ignores case, skipped otherwise)', async ctx => {
    const fx = await make();
    const prot = path.join(fx.root, 'prot-dir');
    await fs.ensureDir(path.join(prot, 'out'));
    const flipped = path.join(fx.root, 'PROT-DIR', 'out');
    if (!fs.pathExistsSync(flipped)) ctx.skip('this volume is case-sensitive: another case names another folder');
    fx.task.roots.protected = [prot];
    fx.task.roots.producer = flipped;
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile], overlapRefusal);
  });
  it('refuses a producer root reached through the NTFS short name of a protected folder (runs on Windows with short names enabled, skipped otherwise)', async ctx => {
    if (process.platform !== 'win32') ctx.skip('NTFS short names exist only on Windows');
    const fx = await make();
    const prot = path.join(fx.root, 'Protected Folder');
    await fs.ensureDir(path.join(prot, 'out'));
    const short = shortNameOf(prot);
    if (!short) ctx.skip('this volume has no 8.3 short names');
    fx.task.roots.protected = [prot];
    fx.task.roots.producer = path.join(short!, 'out');
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile], overlapRefusal);
  });
  it('refuses a helper file given in another spelling of the producer root than the task uses, before anything is written', async ctx => {
    const fx = await make();
    const produced = await produce(fx);
    const alt = altSpelling(fx.producer, true);
    if (!alt) ctx.skip(NO_ALT);
    fx.task.roots.producer = alt!;
    await fx.save();
    await refusedUnchanged(fx, helperFlags(fx, produced), /same spelling/);
  });
  it('writes a return the checker accepts when a folder that overlaps nothing is given in another spelling', async ctx => {
    const fx = await make();
    const produced = await produce(fx);
    const alt = altSpelling(path.dirname(fx.taskFile), false);
    if (!alt) ctx.skip(NO_ALT);
    const flags = helperFlags(fx, produced);
    flags[flags.indexOf('--job') + 1] = path.join(alt!, path.basename(fx.taskFile));
    written(fx, script(fx, flags));
  });
  it('walks up only on ENOENT or ENOTDIR and refuses any other real-path error (source text; EACCES cannot be produced portably)', async () => {
    const text = await fs.readFile(SCRIPT_SOURCE, 'utf8');
    expect(text).toMatch(/error\?\.code !== 'ENOENT' && error\?\.code !== 'ENOTDIR'/);
    expect(text).toContain('Cannot resolve the physical path of');
    expect(text).not.toMatch(/catch \{ \/\* absent/);
  });
  it('reads the script with one resolver for every root, file and return comparison', async () => {
    const text = await fs.readFile(SCRIPT_SOURCE, 'utf8');
    expect(text).toContain('fs.realpathSync.native(current)');
    expect(text).toMatch(/const folded = file => foldName\(physical\(file\)\)/);
  });
});

describe('skill-return.mjs follows the checker on case collisions and on stderr (review of P25-B, points 2 and 3)', () => {
  it('accepts a successful helper run that printed a warning on stderr and pins that stderr as it is', async () => {
    const fx = await make();
    const produced = await produce(fx);
    await fs.writeFile(produced.stderrFile, '(node:1) ExperimentalWarning: a runtime warning\n');
    written(fx, script(fx, helperFlags(fx, produced)));
    expect((await fs.readJson(fx.returnFile) as Json).helper.stderr).toEqual(await pinOf(produced.stderrFile));
  });
  it('still refuses an exit 0 whose stdout is empty', async () => {
    const fx = await make();
    const produced = await produce(fx);
    await fs.writeFile(produced.stdoutFile, '');
    await refusedUnchanged(fx, helperFlags(fx, produced), /Exit 0 needs a report/);
  });
  it('still refuses an exit 1 whose stderr is empty', async () => {
    const fx = await make();
    const produced = await produce(fx, BLOCKED);
    expect(produced.run.status).toBe(1);
    await fs.writeFile(produced.stderrFile, '');
    const notes = await writeNotes(fx, { openItems: OPEN });
    await refusedUnchanged(fx, [...helperFlags(fx, produced), '--notes', notes], /Exit 1 needs/);
  });
  it('accepts a draft whose directories differ only in case when the files do not, on a case-sensitive platform (first run on Linux CI)', async ctx => {
    const probe = await make();
    const sensitive = path.join(probe.root, 'CaseProbe');
    await fs.ensureDir(sensitive);
    if (fs.pathExistsSync(path.join(probe.root, 'caseprobe'))) ctx.skip('this volume ignores case: Refs and refs are one folder');
    const fx = await make({ changes: { ...probe.changes, 'Refs/a.md': 'a\n', 'refs/b.md': 'b\n' } });
    const produced = await produce(fx);
    expect(produced.run.status, produced.run.stderr).toBe(0);
    written(fx, script(fx, helperFlags(fx, produced)));
  });
});
