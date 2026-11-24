import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { NATIVE_AGENTS_DIR, nativeText } from './helpers/native-roles.js';

/**
 * Host library, `agent/sub-agents.md` (background subagents and forks): a background subagent that outlives the agent that spawned it reports to
 * the main conversation, and a fork returns to the main conversation. So a hand-off goes to the spawning agent, or to the main conversation when
 * that agent has already ended. The line is the same in every role that states it.
 */

const roles = fs.readdirSync(NATIVE_AGENTS_DIR).filter(name => name.endsWith('.md')).map(name => name.replace(/\.md$/, ''));
const withLine = roles.filter(role => nativeText(role).includes('A hand-off goes back to the agent that spawned you'));
const FRESH = 'A hand-off goes back to the agent that spawned you, or, for a background subagent whose spawner has already ended, to the main conversation';

describe('the hand-off line', () => {
  it('50 native roles state it: 47 with the team clause, 3 Tier-1 specialists with the short form', () => {
    expect(withLine).toHaveLength(50);
    expect(withLine.filter(role => nativeText(role).includes(`${FRESH}; in a team the host delivers your final answer to the lead when you go idle.`))).toHaveLength(47);
    expect(withLine.filter(role => nativeText(role).includes(`${FRESH}. Do not message a sibling subagent;`))).toHaveLength(3);
  });

  it.each(withLine)('%s: names the main conversation as the place a hand-off goes when the spawning agent has ended', role => {
    const text = nativeText(role);
    expect(text.split(FRESH)).toHaveLength(2);
    expect(text).not.toMatch(/A hand-off goes back to the agent that spawned you[;.]/);
  });
});
