import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

it('measures PCM onset independently of cue placement and rejects unsupported evidence', () => {
  const run = spawnSync(process.execPath, ['--test', 'tests/skill-scripts/audio-onset.cases.mjs'], {
    encoding: 'utf8', windowsHide: true, timeout: 20000,
  });
  expect(run.status, [run.error?.message, run.stdout, run.stderr].filter(Boolean).join('\n')).toBe(0);
});
