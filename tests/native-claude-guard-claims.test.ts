import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { NATIVE_AGENTS_DIR, nativeText } from './helpers/native-roles.js';

/**
 * The destructive guard script also blocks a call whose hook input it cannot read, a shell command it could not analyse, and (the handler
 * carries `onFailure: 'block'`) every call when the hook cannot run. A role text that says what the guard blocks "and nothing else", or that a
 * write to `.env` is "the only thing" it stops, leaves those out and is not true. The texts that matter here are the ones that make an
 * exclusive claim; the others name a list and say nothing about what else it does.
 */

const roles = fs.readdirSync(NATIVE_AGENTS_DIR).filter(name => name.endsWith('.md')).map(name => name.replace(/\.md$/, ''));
const EXCLUSIVE: RegExp[] = [
  /it blocks nothing else/,
  /It enforces nothing else/,
  /Apart from that and a call whose input it cannot read, it enforces nothing/,
  /the only thing the guard bound to this role can stop/,
  /\.env` files made with the editing tools and the shell forms named above, and nothing else/,
];

describe('no role text says what its guard stops in a way that leaves out unreadable input, unanalysable commands and a hook that cannot run', () => {
  it.each(roles)('%s', role => {
    const text = nativeText(role);
    for (const claim of EXCLUSIVE) expect(text, String(claim)).not.toMatch(claim);
  });

  it('the nine marketing roles name the calls the script blocks besides its list, and the rest of the tail is unchanged', () => {
    for (const role of ['lifecycle-email-specialist', 'marketing-campaign-specialist', 'marketing-content-strategist', 'marketing-conversion-specialist', 'marketing-creative-designer', 'marketing-growth-strategist', 'paid-acquisition-specialist', 'plg-strategist', 'seo-specialist']) {
      expect(nativeText(role), role).toContain('It also blocks a call it cannot read or analyse, and every call when it cannot run, and it enforces nothing else, so the rules in your Safety section are your own obligation. Never try to get around it.');
    }
  });

  it('the business lead says what its guard also blocks', () => {
    expect(nativeText('orchestrator-business')).toContain('refuses writes to `.env` files made with the editing tools and the shell forms named above, and also a call it cannot read or analyse and every call when it cannot run; the limits of step 6 above are yours to keep.');
  });

  it('the design roles and the accessibility lead say what a shell-less role\'s editor calls meet', () => {
    for (const role of ['design-ops-lead', 'design-researcher', 'design-systems-architect', 'designer-toolkit-expert', 'interaction-designer', 'prototype-tester', 'ui-designer', 'ux-strategist']) {
      expect(nativeText(role), role).toContain('so the guard bound to this role stops a write to a `.env` file (`.env.example` passes), an editor call whose input it cannot read, and every call when it cannot run.');
    }
    expect(nativeText('accessibility-lead').split('a call whose input it cannot read, and every call when it cannot run;')).toHaveLength(3);
  });

  it('the two shell-less architecture roles say what else the guard blocks', () => {
    for (const role of ['sysops-sre-lead', 'system-architect']) {
      expect(nativeText(role), role).toContain('it also blocks an editor call it cannot read and every call when it cannot run, and `permissionMode: acceptEdits`');
    }
  });
});
