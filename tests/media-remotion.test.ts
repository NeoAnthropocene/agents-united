import { execFileSync } from 'node:child_process';
import { describe, it } from 'vitest';

describe('Remotion production helpers', () => {
  it('passes the independent Remotion preflight and scaffold cases', () => {
    execFileSync(process.execPath, ['--test', 'tests/media-remotion.runtime.mjs'], { stdio: 'pipe' });
  });
  it('passes the independent Remotion render pipeline contract cases with fake runtime IO', () => {
    execFileSync(process.execPath, ['--test', 'tests/media-remotion-render.runtime.mjs'], { stdio: 'pipe' });
  });
  it('passes the explicit source-preserving approved refresh cases', () => {
    execFileSync(process.execPath, ['--test', 'tests/media-remotion-refresh.runtime.mjs'], { stdio: 'pipe' });
  });
});
