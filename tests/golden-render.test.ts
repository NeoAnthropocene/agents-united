import { describe, it, expect } from 'vitest';
import {
  captureClaudeGoldens,
  GOLDEN_SET,
  readGolden,
  syncGolden,
} from './helpers/golden.js';

/**
 * Plan 017 — pre-refactor golden pin (acceptance gates 3 & 8).
 *
 * GOLDEN-PIN SUITE: must PASS on today's renderer. These snapshots freeze the Claude
 * lane's bytes BEFORE the Step 4 `HOST_DIALECTS` refactor; after the refactor this suite
 * must still pass with an EMPTY snapshot diff (gate 3 — any byte change is a STOP).
 * Regeneration is an explicit, reviewed maintainer act (gate 8):
 *
 *   UPDATE_GOLDEN=1 npx vitest run tests/golden-render.test.ts
 */

describe('Golden pin — Claude lane pre-refactor snapshots (tests/golden/claude/**)', () => {
  it('renders the fixed golden set byte-identically to the committed snapshots', async () => {
    const artifacts = await captureClaudeGoldens();
    for (const artifact of artifacts) syncGolden(artifact);

    const missing = artifacts.filter(a => readGolden(a) === undefined).map(a => a.relPath);
    expect(
      missing,
      `snapshots missing — capture them with UPDATE_GOLDEN=1 (${missing.join(', ')})`
    ).toEqual([]);

    for (const artifact of artifacts) {
      // Byte-for-byte comparison: strings read as utf8 and written as utf8, so identity
      // of the code units is identity of the bytes.
      expect(artifact.content, `snapshot drift for ${artifact.relPath} (${artifact.file})`).toBe(
        readGolden(artifact)
      );
    }
  });

  it('pins exactly five software-engineering roles, one skill, one rule, and the plugin manifest', () => {
    expect(GOLDEN_SET.map(e => e.relPath)).toEqual([
      '.claude/agents/orchestrator-engineering.md',
      '.claude/agents/backend-architect.md',
      '.claude/agents/frontend-architect.md',
      '.claude/agents/code-reviewer.md',
      '.claude/agents/repo-index.md',
      '.claude/skills/git-guardrails/SKILL.md',
      '.claude/rules/git-guardrails.md',
      '.agents/plugins/software-engineering/.claude-plugin/plugin.json',
    ]);
  });

  it('is deterministic: a repeated capture is byte-identical (gate 8)', async () => {
    const first = await captureClaudeGoldens();
    const second = await captureClaudeGoldens();
    expect(second.map(a => `${a.relPath}:${a.content}`)).toEqual(
      first.map(a => `${a.relPath}:${a.content}`)
    );
  });

  it('regeneration is idempotent: every snapshot equals a fresh capture byte-for-byte (gate 8)', async () => {
    const artifacts = await captureClaudeGoldens();
    for (const artifact of artifacts) {
      expect(readGolden(artifact), `snapshot ${artifact.file} is stale — run UPDATE_GOLDEN=1`).toBe(
        artifact.content
      );
    }
  });
});
