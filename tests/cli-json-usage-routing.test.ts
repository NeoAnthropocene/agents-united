/**
 * ADR 0082: which command lines get the JSON usage guarantee of the read-only check commands (rule-check, skill-check,
 * bundle-check). The guarantee covers the documented command-first form, `agents <command> ...`: the command is taken only
 * from the first argument. An option-first form, or any other first argument, keeps CAC's own behaviour unchanged.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const cli = path.resolve('dist/cli.js');

describe('the JSON usage guarantee covers the command-first form only', () => {
  const made: string[] = [];
  afterEach(() => { for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
  function run(...argv: string[]): { status: number | null; stdout: string; stderr: string } {
    const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'au-cli-routing-')));
    made.push(cwd);
    const done = spawnSync(process.execPath, [cli, ...argv], { cwd, encoding: 'utf8', timeout: 30_000 });
    return { status: done.status, stdout: done.stdout, stderr: done.stderr };
  }
  const isCheckJson = (stdout: string): boolean => stdout.includes('"kind": "deterministic"');

  it('answers a dotted option after a check command given first with that command\'s JSON usage result', () => {
    for (const command of ['rule-check', 'skill-check', 'bundle-check']) {
      const done = run(command, '--help.topic');
      expect(done.status, command).toBe(2);
      expect(isCheckJson(done.stdout), command).toBe(true);
      expect(done.stderr, command).toBe('');
    }
  });

  it('does not route an option value that names a check command to that command', () => {
    const done = run('--type', 'skill-check', 'find', '--help.topic');
    expect(isCheckJson(done.stdout)).toBe(false);
    expect(done.stdout).not.toContain('option names with a dot');
  });

  it('leaves an option-first form to CAC: --help.topic prints the usage text and exits 0', () => {
    const done = run('--artifact', '/p', 'skill-check', '--help.topic');
    expect(done.status).toBe(0);
    expect(isCheckJson(done.stdout)).toBe(false);
    expect(done.stdout).toContain('Usage');
  });

  it('does not treat an inherited object key such as constructor as a check command', () => {
    const done = run('constructor', '--extra.part');
    expect(isCheckJson(done.stdout)).toBe(false);
    expect(done.stdout).not.toContain('option names with a dot');
  });
});
