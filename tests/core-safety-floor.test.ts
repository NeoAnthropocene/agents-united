import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSemanticCore } from '../src/core/semantic-core.js';

/**
 * Plan 032 PR E, milestone 1. The Contract Floor's `safety` field must carry every guardrail the role's registry
 * agent declares under "## Safety Guardrails": a native host agent emits the floor verbatim, so a truncated or
 * off-topic `safety` silently drops the role's guardrails.
 */

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

const guardrailBullets = (agentFile: string): string[] => {
  const body = fs.readFileSync(agentFile, 'utf8').replace(/\r\n/g, '\n');
  const section = /\n## Safety Guardrails\n([\s\S]*?)(?=\n---\n|\n## )/.exec(body)?.[1];
  if (section === undefined) return [];
  return section
    .split('\n')
    .filter(line => line.startsWith('- '))
    .map(line => normalize(line.slice(2)));
};

describe('Contract Floor safety carries every registry guardrail', async () => {
  const cores = await loadSemanticCore('registry');
  const stems = [...cores.keys()].filter(stem => guardrailBullets(path.join('registry', 'agents', `${stem}.md`)).length > 0);

  it('finds the four subagent roles that declare guardrails', () => {
    expect(stems).toEqual(
      expect.arrayContaining(['subagent-backend-architect', 'subagent-code-reviewer', 'subagent-frontend-architect', 'subagent-repo-index']),
    );
  });

  it.each(stems)('%s: every "Safety Guardrails" bullet appears in the core safety', stem => {
    const safety = normalize(cores.get(stem)!.safety);
    const missing = guardrailBullets(path.join('registry', 'agents', `${stem}.md`)).filter(bullet => !safety.includes(bullet));
    expect(missing).toEqual([]);
  });

  it.each([...cores.keys()])('%s: safety is not cut mid-sentence', stem => {
    expect(normalize(cores.get(stem)!.safety)).toMatch(/[.)`*"]$/);
  });
});
