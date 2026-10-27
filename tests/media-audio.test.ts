import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
it('offline audio synthesis and shared-contract pipeline cases', () => {
  const run = spawnSync(process.execPath, ['--test', 'tests/skill-scripts/media-audio.cases.mjs'], {
    encoding: 'utf8', windowsHide: true, timeout: 20000,
  });
  expect(run.status, [run.error?.message, run.stdout, run.stderr].filter(Boolean).join('\n')).toBe(0);
});
