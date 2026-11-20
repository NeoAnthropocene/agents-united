import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

it('system-specs collector cases (fake runner, privacy rule, freshness, exit codes, real-machine smoke)', () => {
  const run = spawnSync(process.execPath, ['--test', 'tests/skill-scripts/system-specs.cases.mjs'], {
    encoding: 'utf8', windowsHide: true, timeout: 120000,
  });
  expect(run.status, [run.error?.message, run.stdout, run.stderr].filter(Boolean).join('\n')).toBe(0);
}, 130000);
