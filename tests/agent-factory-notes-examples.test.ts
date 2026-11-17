/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareSkillTask } from './helpers/skill-task.js';
import type { SkillTaskFixture } from './helpers/skill-task.js';
import { prepareContractTask } from './helpers/contract-task.js';
import type { ContractTaskFixture } from './helpers/contract-task.js';
import { prepareBundleTask } from './helpers/bundle-task.js';
import type { BundleTaskFixture } from './helpers/bundle-task.js';

// The notes example that author-skill and author-contract document in references/job.md must be accepted by their return scripts,
// and the author-bundle notes shape (with a raw pin) by bundle-return.mjs. A documented shape that a script refuses costs a fork
// failed attempts (Sitting C of the factory proof).

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { await Promise.all(cleanups.splice(0).map(fn => fn())); });

/** The fenced json block of a reference that shows claimedChecks, with the placeholder pin path replaced by a real absolute path. */
async function documentedNotes(skill: string, absolutePath: string): Promise<any> {
  const text = (await fs.readFile(path.resolve('registry/skills', skill, 'references/job.md'), 'utf8')).replace(/\r\n/g, '\n');
  const block = [...text.matchAll(/```json\n([\s\S]*?)\n```(?:\n|$)/g)].find(match => match[1].includes('claimedChecks'));
  expect(block, `${skill} job.md shows a json notes example closed by a fence line of its own`).toBeDefined();
  return JSON.parse(block![1].split('<absolute path of the saved output>').join(absolutePath.replace(/\\/g, '/')));
}

describe('documented notes examples', () => {
  it('author-skill: the example in job.md is accepted by skill-return.mjs', async () => {
    const fx: SkillTaskFixture = await prepareSkillTask();
    cleanups.push(() => fx.cleanup());
    const produced = await fx.produce();
    await fs.remove(fx.returnFile);
    const notesFile = path.join(fx.producer, 'skill-notes.json');
    await fs.writeJson(notesFile, await documentedNotes('author-skill', path.join(fx.producer, 'check.log')));
    const run = spawnSync(process.execPath, [fx.inst('scripts/skill-return.mjs'), '--job', fx.taskFile, '--saved-job', produced.jobFile, '--stdout', produced.stdoutFile,
      '--stderr', produced.stderrFile, '--exit-code', String(produced.run.status), '--notes', notesFile], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000 });
    expect(run.status, run.stderr).toBe(0);
    const ret = await fs.readJson(fx.returnFile);
    expect(ret.claimedChecks).toHaveLength(2);
    expect(ret.openItems).toHaveLength(1);
  });

  it('author-contract: the example in job.md is accepted by contract-return.mjs', async () => {
    const fx: ContractTaskFixture = await prepareContractTask();
    cleanups.push(() => fx.cleanup());
    const produced = await fx.produce();
    await fs.remove(fx.returnFile);
    const notesFile = path.join(fx.producer, 'contract-notes.json');
    await fs.writeJson(notesFile, await documentedNotes('author-contract', path.join(fx.producer, 'check.log')));
    const run = spawnSync(process.execPath, [fx.inst('scripts/contract-return.mjs'), '--job', fx.taskFile, '--saved-job', produced.jobFile, '--stdout', produced.stdoutFile,
      '--stderr', produced.stderrFile, '--exit-code', String(produced.run.status), '--notes', notesFile], { cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000 });
    expect(run.status, run.stderr).toBe(0);
    const ret = await fs.readJson(fx.returnFile);
    expect(ret.claimedChecks).toHaveLength(2);
    expect(ret.openItems).toHaveLength(1);
  });

  it('author-bundle: the example in job.md is accepted by bundle-return.mjs', async () => {
    const fx: BundleTaskFixture = await prepareBundleTask();
    cleanups.push(() => fx.cleanup());
    await fx.writeDraft();
    const notesFile = path.join(fx.producer, 'bundle-notes.json');
    await fs.writeJson(notesFile, await documentedNotes('author-bundle', path.join(fx.producer, 'check.log')));
    const run = fx.helper(['--job', fx.taskFile, '--notes', notesFile]);
    expect(run.status, run.stderr).toBe(0);
  });

  it('the author-bundle text documents the tighter raw limit its script enforces', async () => {
    const text = await fs.readFile(path.resolve('registry/skills/author-bundle/references/job.md'), 'utf8');
    expect(text).toContain('budget.maxCheckLogBytes');
  });

  it('the job.md texts name every key of the claimed-check entry and of the raw pin', async () => {
    for (const skill of ['author-skill', 'author-contract', 'author-bundle']) {
      const text = await fs.readFile(path.resolve('registry/skills', skill, 'references/job.md'), 'utf8');
      for (const word of ['claimedChecks', 'exitCode', 'raw', 'sha256', 'bytes']) expect(text, `${skill} ${word}`).toContain(word);
    }
  });
});
