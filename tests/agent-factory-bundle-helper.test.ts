/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import type { SpawnSyncReturns } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { AUTHORED, HELPER_SOURCE, badEntry, canonical, digest, inventoryOf, pinOf, prepareBundleTask, treeOf } from './helpers/bundle-task.js';
import type { BundleTaskFixture, Json } from './helpers/bundle-task.js';

// The author-bundle return helper (registry/skills/author-bundle/scripts/bundle-return.mjs), run installed as a child process on
// disposable roots. It writes exactly one file, <roots.producer>/bundle-return.json, and nothing else.

const fixtures: BundleTaskFixture[] = [];
const make = async (options?: Parameters<typeof prepareBundleTask>[0]): Promise<BundleTaskFixture> => {
  const fixture = await prepareBundleTask(options);
  fixtures.push(fixture);
  return fixture;
};
afterEach(async () => { await Promise.all(fixtures.splice(0).map(fixture => fixture.cleanup())); });

/** Exit 1, an empty stdout and one blocked JSON line on stderr: the draft-pair.mjs convention. */
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
/** Run the helper and require that no byte under the fixture root changed (a refusal writes nothing). */
async function refusedUnchanged(fx: BundleTaskFixture, args: string[], reason?: RegExp): Promise<Json> {
  const before = await treeOf(fx.root);
  const out = refused(fx.helper(args), reason);
  expect(await treeOf(fx.root)).toEqual(before);
  return out;
}

describe('bundle-return.mjs writes the return record', () => {
  it('writes exactly one file, the producer-root bundle-return.json, and prints one JSON line', async () => {
    const fx = await make();
    await fx.writeDraft();
    const before = await treeOf(fx.root);
    const run = fx.helper(['--job', fx.taskFile]);
    expect(run.status, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout.trim().split('\n')).toHaveLength(1);
    const after = await treeOf(fx.root);
    const added = Object.keys(after).filter(rel => !(rel in before));
    expect(added).toEqual([path.relative(fx.root, fx.returnFile).split(path.sep).join('/')]);
    for (const rel of Object.keys(before)) expect(after[rel], rel).toBe(before[rel]);
    const out = JSON.parse(run.stdout) as Json;
    expect(out).toMatchObject({ status: 'return-written', returnStatus: 'draft', taskDigest: digest(canonical(fx.task)) });
    expect(out.return).toEqual(await pinOf(fx.returnFile));
  });

  it('records the inventory, the changed list against the baseline and the report pin computed from the bytes', async () => {
    const fx = await make();
    await fx.writeDraft();
    expect(fx.helper(['--job', fx.taskFile]).status).toBe(0);
    const ret = await fs.readJson(fx.returnFile) as Json;
    expect(ret).toMatchObject({
      version: 1, kind: 'bundle-return', taskId: fx.task.id, status: 'draft', claimedChecks: [], openItems: [], unverified: [], externalActions: [],
      upstreamPreparation: null, report: await pinOf(path.join(fx.draft, 'report.json')),
    });
    expect(ret.inventory).toEqual(await inventoryOf(fx.draft, false));
    expect(ret.changed).toEqual([...AUTHORED].sort().map(file => ({ path: file, operation: 'create' })));
  });

  it('computes the task digest by exactly the rule the coordinator checker uses', async () => {
    const fx = await make({ operation: 'update' });
    const pre = fx.pre();
    expect(pre.status, pre.stderr).toBe(0);
    const checkerDigest = JSON.parse(pre.stdout).taskDigest as string;
    await fx.writeDraft();
    expect(fx.helper(['--job', fx.taskFile]).status).toBe(0);
    const ret = await fs.readJson(fx.returnFile) as Json;
    expect(ret.taskDigest).toBe(checkerDigest);
    expect(ret.taskDigest).toBe(digest(canonical(fx.task)));
    // Key order in the task file does not change the digest.
    const reordered = Object.fromEntries(Object.entries(fx.task).reverse());
    await fs.writeFile(fx.taskFile, JSON.stringify(reordered));
    expect(fx.helper(['--job', fx.taskFile]).status).toBe(0);
    expect((await fs.readJson(fx.returnFile) as Json).taskDigest).toBe(checkerDigest);
  });

  it('takes status, open items, unverified statements, claimed checks and the upstream evidence from the notes file', async () => {
    const fx = await make({ intent: 'upstream' });
    await fx.writeDraft();
    const notes = {
      openItems: [{ id: 'review-open', description: 'Independent review remains open.' }], unverified: ['Live loading is unverified.'],
      claimedChecks: [{ name: 'layout', command: 'node --version', exitCode: 0, raw: null }], upstreamEvidence: 'Prepared evidence.',
    };
    const notesFile = path.join(fx.producer, 'bundle-notes.json');
    await fs.writeJson(notesFile, notes);
    expect(fx.helper(['--job', fx.taskFile, '--notes', notesFile]).status).toBe(0);
    const ret = await fs.readJson(fx.returnFile) as Json;
    expect(ret).toMatchObject({ status: 'draft', openItems: notes.openItems, unverified: notes.unverified, claimedChecks: notes.claimedChecks });
    const template = await fs.readFile(fx.task.contributionTemplate.path, 'utf8');
    expect(ret.upstreamPreparation).toMatchObject({ templatePath: fx.task.contributionTemplate.path, base: 'dev', sent: false });
    expect(ret.upstreamPreparation.body.startsWith(template)).toBe(true);
    expect(ret.upstreamPreparation.body).toContain('Prepared evidence.');
  });

  it('writes a blocked return with the named open item and no upstream preparation', async () => {
    const fx = await make({ intent: 'upstream' });
    const notesFile = path.join(fx.producer, 'bundle-notes.json');
    await fs.writeJson(notesFile, { status: 'blocked', openItems: [{ id: 'missing-roster', description: 'No roster.' }] });
    expect(fx.helper(['--job', fx.taskFile, '--notes', notesFile]).status).toBe(0);
    expect(await fs.readJson(fx.returnFile)).toMatchObject({ status: 'blocked', inventory: [], changed: [], report: null, upstreamPreparation: null });
  });

  it('reads only Node standard modules and imports nothing from another Skill', async () => {
    const text = await fs.readFile(HELPER_SOURCE, 'utf8');
    const imports = [...text.matchAll(/^import .* from '([^']+)';/gm)].map(match => match[1]!);
    expect(imports.length).toBeGreaterThan(0);
    for (const name of imports) expect(name, name).toMatch(/^node:/);
    expect(text).not.toMatch(/coordinate-artifact|check-bundle-return|import\(/);
  });
});

describe('bundle-return.mjs refusals', () => {
  it('refuses a task that is not a bundle-task', async () => {
    const fx = await make();
    await fx.writeDraft();
    fx.task.kind = 'contract-task';
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile], /bundle-task/);
  });
  it('refuses a task that is not the evidence-root bundle-task.json the task names', async () => {
    const fx = await make();
    await fx.writeDraft();
    const elsewhere = path.join(fx.pins, 'bundle-task.json');
    await fs.writeFile(elsewhere, JSON.stringify(fx.task));
    await refusedUnchanged(fx, ['--job', elsewhere], /evidence/);
  });
  it('refuses a producer root that does not exist', async () => {
    const fx = await make();
    await fx.writeDraft();
    fx.task.roots.producer = path.join(fx.root, 'absent-producer');
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile], /producer/i);
  });
  it('refuses overlapping roots', async () => {
    const fx = await make();
    await fx.writeDraft();
    fx.task.roots.producer = fx.draft;
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile], /overlap/i);
  });
  it('refuses a draft root that contains a link', async () => {
    const fx = await make();
    await fx.writeDraft();
    await fs.symlink(fx.pins, path.join(fx.draft, 'linked-pins'), 'junction');
    await refusedUnchanged(fx, ['--job', fx.taskFile], /link/i);
  });
  it('refuses a draft file above the task budget', async () => {
    const fx = await make();
    fx.task.budget.maxAuthoredFileBytes = 64;
    await fx.save();
    await fx.writeDraft();
    await refusedUnchanged(fx, ['--job', fx.taskFile], /budget/i);
  });
  it('refuses more preserved files than the task budget', async () => {
    const fx = await make({ operation: 'update' });
    fx.task.budget.maxPreservedFiles = 0;
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile], /budget/i);
  });
  it('refuses a blocked status without an open item, an unknown notes key and a notes file outside the producer root', async () => {
    const fx = await make();
    await fx.writeDraft();
    const notesFile = path.join(fx.producer, 'bundle-notes.json');
    await fs.writeJson(notesFile, { status: 'blocked' });
    await refusedUnchanged(fx, ['--job', fx.taskFile, '--notes', notesFile], /open item/i);
    await fs.writeJson(notesFile, { accepted: true });
    await refusedUnchanged(fx, ['--job', fx.taskFile, '--notes', notesFile], /accepted/);
    const outside = path.join(fx.pins, 'bundle-notes.json');
    await fs.writeJson(outside, {});
    await refusedUnchanged(fx, ['--job', fx.taskFile, '--notes', outside], /producer/i);
  });
  it('refuses relative paths, unknown flags, positionals and a missing --job', async () => {
    const fx = await make();
    await fx.writeDraft();
    for (const args of [['--job', 'bundle-task.json'], ['--job', fx.taskFile, '--force'], ['--job', fx.taskFile, 'extra'], [], ['--job', fx.taskFile, '--job', fx.taskFile]]) {
      await refusedUnchanged(fx, args);
    }
  });
  it('refuses an upstream task whose pinned template changed', async () => {
    const fx = await make({ intent: 'upstream' });
    await fx.writeDraft();
    fx.task.contributionTemplate.sha256 = '0'.repeat(64);
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile], /template/i);
  });
});

// Fix round after the independent review (report points 2, 3, 4, 5, 7, 11 and 12).
describe('bundle-return.mjs never writes through a link and reads every file bounded (point 2)', () => {
  it('refuses a symbolic link at the return path and leaves its target unchanged', async () => {
    const fx = await make();
    await fx.writeDraft();
    await fs.symlink(path.join(fx.draft, 'report.json'), fx.returnFile, 'file');
    await refusedUnchanged(fx, ['--job', fx.taskFile], /link|regular/i);
  });
  it('replaces a hard-linked return by a rename and leaves the other name of the inode untouched', async () => {
    const fx = await make();
    await fx.writeDraft();
    const other = path.join(fx.pins, 'precious.txt');
    await fs.writeFile(other, 'precious bytes');
    await fs.link(other, fx.returnFile);
    const run = fx.helper(['--job', fx.taskFile]);
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(await fs.readFile(other, 'utf8')).toBe('precious bytes');
    expect((await fs.readJson(fx.returnFile) as Json).kind).toBe('bundle-return');
    const post = fx.post();
    expect(post.status, post.stdout + post.stderr).toBe(0);
    expect((await fs.readdir(fx.producer)).filter(name => name.endsWith('.tmp'))).toEqual([]);
  });
  it('refuses another spelling of the return itself as an input (the same physical file)', async () => {
    const fx = await make();
    await fx.writeDraft();
    await fs.writeFile(fx.returnFile, '{}');
    // The notes file is the bundle script's only input besides the task that could name the return.
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
    for (const spelling of spellings) await refusedUnchanged(fx, ['--job', fx.taskFile, '--notes', spelling], /other than the return/i);
  });
  it('writes through a completion loop and compares the bytes read back', async () => {
    const text = await fs.readFile(HELPER_SOURCE, 'utf8');
    expect(text).toContain('function writeAll');
    expect(text).not.toContain('fs.writeSync(fd, text)');
    expect(text).toContain('differs from the bytes written');
  });
  it('refuses a folder at the return path', async () => {
    const fx = await make();
    await fx.writeDraft();
    await fs.ensureDir(fx.returnFile);
    await refusedUnchanged(fx, ['--job', fx.taskFile], /regular|link/i);
  });
  it('reads with a bounded open and read, never with an unbounded readFileSync, and writes without following a link', async () => {
    const text = await fs.readFile(HELPER_SOURCE, 'utf8');
    expect(text).not.toContain('readFileSync');
    expect(text).not.toContain('writeFileSync');
    expect(text).toContain('O_NOFOLLOW');
  });
});

describe('bundle-return.mjs applies the checker root rules (point 3): the same bad tasks are refused by both scripts', () => {
  const cases: Array<[string, (fx: BundleTaskFixture) => void | Promise<void>]> = [
    ['a producer root under a .claude folder', async fx => { fx.task.roots.producer = path.join(fx.root, '.claude', 'producer'); await fs.ensureDir(fx.task.roots.producer); }],
    ['a draft root under a .codex folder', fx => { fx.task.roots.draft = path.join(fx.root, '.codex', 'candidate', fx.bundleName); }],
    ['a draft root inside the source checkout', fx => { fx.task.roots.draft = path.join(fx.task.source.checkout, 'tmp-draft-never-created'); }],
    ['a producer root inside the source registry', async fx => { fx.task.roots.producer = path.join(fx.sourceRegistry, 'producer'); await fs.ensureDir(fx.task.roots.producer); }],
    ['a draft root inside a managed root', fx => { fx.task.roots.managed = [path.dirname(fx.draft)]; }],
    ['a producer root that is a protected root', fx => { fx.task.roots.protected = [fx.producer]; }],
    ['a missing source checkout', fx => { fx.task.source.checkout = path.join(fx.root, 'absent-checkout'); }],
    ['a relative managed root', fx => { fx.task.roots.managed = ['relative/managed']; }],
  ];
  it.each(cases)('refuses %s', async (_label, change) => {
    const fx = await make();
    await change(fx);
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile]);
    const pre = fx.pre();
    expect(pre.status, pre.stdout).toBe(1);
    expect(JSON.parse(pre.stderr).code).toBe('ROOT_CONFLICT');
  });
  it('refuses an upstream contribution template outside the checkout, like the checker', async () => {
    const fx = await make({ intent: 'upstream' });
    const outside = path.join(fx.pins, 'artifact-contribution.md');
    await fs.copy(fx.task.contributionTemplate.path, outside);
    fx.task.contributionTemplate = await pinOf(outside);
    await fx.save();
    await fx.writeDraft();
    await refusedUnchanged(fx, ['--job', fx.taskFile], /template/i);
    expect(JSON.parse(fx.pre().stderr).code).toBe('JOB_INVALID');
  });
});

describe('a byte-order mark in bundle-task.json (point 4): both scripts refuse it, as check-contract-return.mjs does', () => {
  it('refuses a BOM-prefixed task in the helper and in the checker', async () => {
    const fx = await make();
    await fx.writeDraft();
    await fs.writeFile(fx.taskFile, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(fx.task))]));
    await refusedUnchanged(fx, ['--job', fx.taskFile], /JSON/i);
    const pre = fx.pre();
    expect(pre.status).toBe(1);
    expect(JSON.parse(pre.stderr).code).toBe('JOB_INVALID');
  });
});

describe('draft entry names (point 5): one table of refused names, run against both scripts', () => {
  // On win32 these entries are injected into the listing (see badEntry); on POSIX they are real files.
  it.each(['con.md', 'a:b.md', 'trailing.', 'space ', 'question?.md', 'User.md'])('refuses notes/%s in the helper and in the checker', async name => {
    const fx = await make({ operation: 'update' });
    const options = await badEntry(fx.root, path.join(fx.draft, 'notes'), name);
    const before = await treeOf(fx.root);
    refused(fx.helper(['--job', fx.taskFile], options), /entry name|differ only in case/i);
    expect(await treeOf(fx.root)).toEqual(before);
    const pre = fx.check(['--job', fx.taskFile], options);
    expect(pre.status, pre.stdout).toBe(1);
    expect(JSON.parse(pre.stderr).code).toBe('BASELINE_MISMATCH');
  });
});

describe('bundle-return.mjs validates what it writes (point 7)', () => {
  const item = { id: 'open-item', description: 'Open.' };
  const check = { name: 'layout', command: 'node --version', exitCode: 0, raw: null };
  const notes: Array<[string, Record<string, unknown>]> = [
    ['an unknown status', { status: 'accepted' }],
    ['seventeen open items', { openItems: Array.from({ length: 17 }, (_, i) => ({ id: `item-${i}`, description: 'x' })) }],
    ['an open item id that is not kebab-case', { openItems: [{ id: 'Bad ID', description: 'x' }] }],
    ['an open item id over 80 characters', { openItems: [{ id: 'a'.repeat(81), description: 'x' }] }],
    ['an empty open item description', { openItems: [{ id: 'a', description: '' }] }],
    ['an open item description over 8192 characters', { openItems: [{ id: 'a', description: 'x'.repeat(8193) }] }],
    ['duplicate open item ids', { openItems: [item, item] }],
    ['an open item with an extra key', { openItems: [{ ...item, owner: 'x' }] }],
    ['thirty-three unverified statements', { unverified: Array.from({ length: 33 }, () => 'x') }],
    ['an unverified statement over 8192 characters', { unverified: ['x'.repeat(8193)] }],
    ['seven claimed checks', { claimedChecks: Array.from({ length: 7 }, (_, i) => ({ ...check, name: `c${i}` })) }],
    ['a claimed check name over 512 characters', { claimedChecks: [{ ...check, name: 'x'.repeat(513) }] }],
    ['an empty claimed check command', { claimedChecks: [{ ...check, command: '' }] }],
    ['a claimed check exit code of 256', { claimedChecks: [{ ...check, exitCode: 256 }] }],
    ['a claimed check raw pin without a hash', { claimedChecks: [{ ...check, raw: { path: '/x', bytes: 1 } }] }],
    ['a claimed check raw pin over the check log budget', { claimedChecks: [{ ...check, raw: { path: '/x', bytes: 524289, sha256: 'a'.repeat(64) } }] }],
    ['seventeen external actions', { externalActions: Array.from({ length: 17 }, () => 'x') }],
    ['an external action over 8192 characters', { externalActions: ['x'.repeat(8193)] }],
    ['an empty upstream evidence text', { upstreamEvidence: '' }],
  ];
  it.each(notes)('refuses notes with %s and writes nothing', async (_label, value) => {
    const fx = await make();
    await fx.writeDraft();
    const notesFile = path.join(fx.producer, 'bundle-notes.json');
    await fs.writeJson(notesFile, value);
    await refusedUnchanged(fx, ['--job', fx.taskFile, '--notes', notesFile]);
  });
  const tasks: Array<[string, (task: Json) => void]> = [
    ['an id that is not kebab-case', task => { task.id = 'Not Kebab'; }],
    ['no id', task => { delete task.id; }],
    ['an intent outside local and upstream', task => { task.intent = 'remote'; }],
    ['roots without a managed list', task => { delete task.roots.managed; }],
    ['a source without a registry', task => { delete task.source.registry; }],
    ['a baseline that is not a list', task => { task.baseline = {}; }],
    ['a baseline entry without a hash', task => { task.baseline = [{ path: 'bundles.json' }]; }],
    ['a budget above the schema maximum', task => { task.budget.maxPreservedFiles = 33; }],
    ['a contribution template on a local task', task => { task.contributionTemplate = { path: '/x', bytes: 1, sha256: 'a'.repeat(64) }; }],
  ];
  it.each(tasks)('refuses a task with %s', async (_label, change) => {
    const fx = await make();
    await fx.writeDraft();
    change(fx.task);
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile]);
  });
  it('refuses an upstream task without its template pin', async () => {
    const fx = await make({ intent: 'upstream' });
    await fx.writeDraft();
    fx.task.contributionTemplate = null;
    await fx.save();
    await refusedUnchanged(fx, ['--job', fx.taskFile], /template/i);
  });
});

describe('bundle-return.mjs refusals not covered before (point 11)', () => {
  it('refuses the return file named as the notes file', async () => {
    const fx = await make();
    await fx.writeDraft();
    await fs.writeJson(fx.returnFile, {});
    await refusedUnchanged(fx, ['--job', fx.taskFile, '--notes', fx.returnFile], /notes/i);
  });
  it('refuses proposal files over the authored total budget', async () => {
    const fx = await make();
    fx.task.budget.maxAuthoredBytes = 2000;
    await fx.save();
    await fx.writeDraft();
    await refusedUnchanged(fx, ['--job', fx.taskFile], /budget/i);
  });
  it('refuses preserved files whose total is over the preserved byte budget, each file within it', async () => {
    const fx = await make({ operation: 'update' });
    fx.task.budget.maxPreservedBytes = 50;
    await fx.save();
    await fs.outputFile(path.join(fx.draft, 'notes', 'second.md'), 'Twenty bytes here.\n');
    await refusedUnchanged(fx, ['--job', fx.taskFile], /budget/i);
  });
  it('refuses notes that are not one JSON object', async () => {
    const fx = await make();
    await fx.writeDraft();
    const notesFile = path.join(fx.producer, 'bundle-notes.json');
    await fs.writeJson(notesFile, ['not', 'an', 'object']);
    await refusedUnchanged(fx, ['--job', fx.taskFile, '--notes', notesFile], /object/i);
  });
});

describe('bundle-return.mjs decodes the contribution template strictly (point 12)', () => {
  it('refuses a pinned template that is not valid UTF-8', async () => {
    const fx = await make({ intent: 'upstream' });
    const checkout = path.join(fx.root, 'fake-checkout');
    const template = path.join(checkout, '.github', 'PULL_REQUEST_TEMPLATE', 'artifact-contribution.md');
    await fs.outputFile(template, Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]));
    fx.task.source.checkout = checkout;
    fx.task.contributionTemplate = await pinOf(template);
    await fx.save();
    await fx.writeDraft();
    await refusedUnchanged(fx, ['--job', fx.taskFile], /UTF-8/i);
  });
});

describe('bundle-return.mjs compares physical roots, not path strings (review of P25-B, point 1)', () => {
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
  it('writes a return the checker accepts when a folder that overlaps nothing is given in another spelling', async ctx => {
    const fx = await make();
    await fx.writeDraft();
    const alt = altSpelling(path.dirname(fx.taskFile), false);
    if (!alt) ctx.skip(NO_ALT);
    const run = fx.helper(['--job', path.join(alt!, path.basename(fx.taskFile))]);
    expect(run.status, run.stderr).toBe(0);
    const post = fx.post();
    expect(post.status, post.stdout + post.stderr).toBe(0);
  });
  it('walks up only on ENOENT or ENOTDIR and refuses any other real-path error (source text; EACCES cannot be produced portably)', async () => {
    const text = await fs.readFile(HELPER_SOURCE, 'utf8');
    expect(text).toMatch(/error\?\.code !== 'ENOENT' && error\?\.code !== 'ENOTDIR'/);
    expect(text).toContain('Cannot resolve the physical path of');
    expect(text).not.toMatch(/catch \{ \/\* absent/);
  });
  it('reads the script with one resolver for every root, file and return comparison', async () => {
    const text = await fs.readFile(HELPER_SOURCE, 'utf8');
    expect(text).toContain('fs.realpathSync.native(current)');
    expect(text).toMatch(/const folded = file => foldName\(physical\(file\)\)/);
  });
});

describe('bundle-return.mjs follows its checker on case collisions (review of P25-B, point 2)', () => {
  it('refuses two directories that differ only in case, as check-bundle-return.mjs does for its whole draft listing (so no change was needed); runs on a case-sensitive platform (first run on Linux CI)', async ctx => {
    const fx = await make();
    await fs.ensureDir(path.join(fx.root, 'CaseProbe'));
    if (fs.pathExistsSync(path.join(fx.root, 'caseprobe'))) ctx.skip('this volume ignores case: Refs and refs are one folder');
    await fx.writeDraft();
    await fs.ensureDir(path.join(fx.draft, 'Refs'));
    await fs.ensureDir(path.join(fx.draft, 'refs'));
    await refusedUnchanged(fx, ['--job', fx.taskFile], /differ only in case/);
  });
});
