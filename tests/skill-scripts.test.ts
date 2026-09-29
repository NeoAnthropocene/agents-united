import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * Runs the Python unittest suites for the scripts vendored inside skills (Plan 030 ports of the
 * upstream bash helpers). The scripts use only the standard library and fake `semgrep` / `codeql`
 * binaries, so no scanner needs to be installed. Skipped when no Python 3 is on PATH.
 */

function findPython(): string | undefined {
  for (const cmd of ['python3', 'python', 'py']) {
    const r = spawnSync(cmd, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'], {
      encoding: 'utf8',
    });
    if (r.status === 0) return cmd;
  }
  return undefined;
}

const PYTHON = findPython();

describe('skill helper scripts (Python)', () => {
  it.skipIf(!PYTHON)('unittest suites in tests/skill-scripts pass', () => {
    const dir = path.resolve(process.cwd(), 'tests', 'skill-scripts');
    const r = spawnSync(PYTHON!, ['-B', '-m', 'unittest', 'discover', '-s', dir, '-p', 'test_*.py'], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
    expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
  }, 120_000);
});
