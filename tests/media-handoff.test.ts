import { execFileSync } from 'node:child_process';
import { test } from 'vitest';

test('media timeline, audio, captions and persisted project handoffs', () => {
  execFileSync(process.execPath, ['--test', 'tests/skill-scripts/media-handoff.cases.mjs'], { stdio: 'pipe' });
}, 60000);
