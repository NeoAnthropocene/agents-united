import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it } from 'vitest';
const run = promisify(execFile);
describe('picture event sidecar', () => {
  it('captures and validates contained versioned events without claiming frame accuracy', async () => {
    await run(process.execPath, ['--test', 'tests/motion-events.runtime.mjs'], { timeout: 120_000 });
  }, 150_000);
});
