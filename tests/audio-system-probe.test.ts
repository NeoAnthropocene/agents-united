import { execFileSync } from 'node:child_process';
import { describe, it } from 'vitest';

describe('audio system capability probe', () => {
  it('decides local, local-model and external sound routes from measured specs', () => {
    execFileSync(process.execPath, ['--test', 'tests/audio-system-probe.runtime.mjs'], { stdio: 'pipe' });
  }, 30_000);
});