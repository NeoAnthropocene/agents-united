import { execFileSync } from 'node:child_process';
import { describe, it } from 'vitest';

describe('motion production helpers', () => {
  it('passes offline rendering contracts and scoped project checks', () => {
    execFileSync(process.execPath, ['--test', 'tests/media-motion.runtime.mjs'], { stdio: 'pipe' });
  });

  it('passes the signature-shot prompt and proof-frame contract cases', () => {
    execFileSync(process.execPath, ['--test', 'tests/skill-scripts/media-motion.cases.mjs'], { stdio: 'pipe' });
  });
});
