import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
it('offline media provider safety cases', () => {
  const run=spawnSync(process.execPath,['--test','tests/skill-scripts/media-provider.cases.mjs'],{encoding:'utf8'});
  expect(run.status,run.stdout+run.stderr).toBe(0);
});
