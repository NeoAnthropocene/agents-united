import { execFileSync } from 'node:child_process';
import { describe, it } from 'vitest';

describe('FFmpeg capability provisioning', () => {
  it('resolves, verifies, plans and consent-gates install and PATH changes', () => {
    execFileSync(process.execPath, ['--test', 'tests/ffmpeg-capability.runtime.mjs'], { stdio: 'pipe' });
  }, 30_000);
});