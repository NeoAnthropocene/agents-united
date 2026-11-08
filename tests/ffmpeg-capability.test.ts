import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('FFmpeg capability provisioning', () => {
  it('resolves, verifies, plans and consent-gates install and PATH changes', async () => {
    await execFileAsync(process.execPath, ['--test', 'tests/ffmpeg-capability.runtime.mjs'], { timeout: 120_000 });
  }, 150_000);
});
