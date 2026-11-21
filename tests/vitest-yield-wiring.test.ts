import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Pins the wiring of the setup file that lets the test worker's event loop turn between
// tests (see that file for the reason). It reads the files; it does not test timing,
// because showing the real limit takes over a minute.
const root = resolve(__dirname, '..');
const setupPath = 'tests/setup/yield-to-runner.ts';

describe('vitest setup file that yields to the runner', () => {
  it('is listed in setupFiles of the vitest configuration', () => {
    const config = readFileSync(resolve(root, 'vitest.config.ts'), 'utf8');
    expect(config).toMatch(/setupFiles\s*:\s*\[[^\]]*['"]tests\/setup\/yield-to-runner\.ts['"]/);
  });

  it('registers a beforeEach hook that awaits a turn of the event loop', () => {
    const setup = readFileSync(resolve(root, setupPath), 'utf8');
    expect(setup).toMatch(/import\s*\{[^}]*\bbeforeEach\b[^}]*\}\s*from\s*['"]vitest['"]/);
    expect(setup).toMatch(/beforeEach\(\s*async\s*\(\)\s*=>/);
    expect(setup).toMatch(/await\s+new Promise<void>\(\(resolve\)\s*=>\s*\{\s*setImmediate\(resolve\)/);
  });
});
