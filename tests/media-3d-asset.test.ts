import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it } from 'vitest';
const run = promisify(execFile);
describe('3D asset validation', () => {
  it('checks the offline validator boundary and optional real-runtime fixtures', async () => {
    await run(process.execPath, ['--test', 'tests/media-3d-asset.runtime.mjs', 'tests/media-3d-privacy.runtime.mjs'], { timeout: 120_000 });
  }, 150_000);
});
