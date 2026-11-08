import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it } from 'vitest';

const run = promisify(execFile);
describe('Remotion read-only diagnostics', () => {
  it('reports scoped probe results without implicit network or writes', async () => {
    await run(process.execPath, ['--test', 'tests/remotion-diagnostics.runtime.mjs'], { timeout: 120_000 });
  }, 150_000);
});
