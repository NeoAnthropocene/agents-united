import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const routerCli = fileURLToPath(new URL('./registry/skills/host-agent-router/scripts/router.mjs', import.meta.url)).replace(/\\/g, '/');

export default defineConfig({
  plugins: [{
    name: 'host-agent-router-cli-hashbang',
    enforce: 'pre',
    transform(code, id) {
      // Vite SSR prepends exports before this Node CLI's hashbang; vite-node then
      // misses its leading-hashbang cleanup. Preserve every source position.
      if (id.split('?')[0].replace(/\\/g, '/') !== routerCli || !code.startsWith('#!')) return;
      return { code: code.replace(/^#![^\r\n]*/, line => ' '.repeat(line.length)), map: null };
    },
  }],
  test: {
    // host-library/ holds untrusted upstream snapshots (skills, docs). They are data: their own
    // test files must never be discovered or executed by this suite (Plan 032 / ADR 0025).
    // Ignored scratch checkouts are archived test data, not this candidate's suite.
    exclude: [...configDefaults.exclude, 'host-library/**', 'scratch/**'],
  },
});
