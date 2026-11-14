import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts', 'session-report': 'scripts/hostlib/session-entry.ts' },
  format: ['esm'],
  target: 'node24',
  clean: true,
  dts: { entry: 'src/cli.ts' },
  minify: false,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
