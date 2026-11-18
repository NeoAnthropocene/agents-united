import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * H: the doctor's early branch (nothing installed, or an unreadable lockfile) prints the issues it fails on, so the exit code and the
 * output agree. Runs the built CLI (`npm test` builds first) against temp folders; the home directory is faked and `claude` is not looked for.
 */

const ROOT = path.join(os.tmpdir(), `agents-united-doctor-early-${process.pid}`);
const HOME = path.join(ROOT, 'home');
const WORK = path.join(ROOT, 'work');

const doctor = (...args: string[]) => {
  const env: Record<string, string | undefined> = { ...process.env, HOME, USERPROFILE: HOME };
  delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  const result = spawnSync(process.execPath, [path.resolve('dist/cli.js'), 'doctor', ...args], { cwd: WORK, encoding: 'utf8', env: env as NodeJS.ProcessEnv, timeout: 120000 });
  return { status: result.status, text: `${result.stdout}\n${result.stderr}` };
};

beforeEach(async () => {
  await fs.remove(ROOT);
  await fs.ensureDir(HOME);
  await fs.ensureDir(WORK);
});
afterEach(async () => {
  await fs.remove(ROOT);
});

describe('agents doctor on a workspace it cannot read', () => {
  it('a corrupt lockfile: the issue is printed and the exit code is 1', async () => {
    await fs.outputFile(path.join(WORK, '.agents', 'agents-united.json'), '{ not json');
    const run = doctor();
    expect(run.text).toMatch(/Corrupt lockfile/);
    expect(run.status).toBe(1);
  });

  it('an empty workspace has no issue and exits 0', () => {
    const run = doctor();
    expect(run.text).toMatch(/No agents or bundles installed/);
    expect(run.status).toBe(0);
  });
});
