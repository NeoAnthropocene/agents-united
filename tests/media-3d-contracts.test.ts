import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it } from 'vitest';
const run = promisify(execFile);
describe('strict 3D project and Shot Handoff contracts', () => {
  it('creates a deterministic original GLB fixture', async () => {
    await run(process.execPath, ['--test', 'tests/media-3d-demo.runtime.mjs'], { timeout: 120_000 });
  }, 150_000);
  it('checks project/provenance scope, hashes and confined writes', async () => {
    await run(process.execPath, ['--test', 'tests/media-3d-project.runtime.mjs'], { timeout: 120_000 });
  }, 150_000);
  it('binds source, renderer, exact frames and canonical timeline freshness', async () => {
    await run(process.execPath, ['--test', 'tests/media-3d-shot.runtime.mjs'], { timeout: 120_000 });
  }, 150_000);
});
