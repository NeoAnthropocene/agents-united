import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // host-library/ holds untrusted upstream snapshots (skills, docs). They are data: their own
    // test files must never be discovered or executed by this suite (Plan 032 / ADR 0025).
    exclude: [...configDefaults.exclude, 'host-library/**'],
  },
});
