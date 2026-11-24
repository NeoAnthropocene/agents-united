import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { NATIVE_AGENTS_DIR, nativeText } from './helpers/native-roles.js';

/**
 * ADR 0076: a question for the user is an `ask-user` entry under `Requests for the lead`, and a question for a peer stays under `Open items`.
 * The peers section of a native role names the two report sections that are always present; its `Open items` line says what goes there and
 * points a question for the user to the requests block, which every role with a peers section carries.
 */

const OLD = '`Open items` (unanswered questions, missing peer input and blockers, or "none")';
const NEW = '`Open items` (what you could not do or verify, a question for a peer, or "none"; a question for the user goes under `Requests for the lead`)';

const roles = fs.readdirSync(NATIVE_AGENTS_DIR).filter(name => name.endsWith('.md')).map(name => name.replace(/\.md$/, ''));
const withPeers = roles.filter(role => nativeText(role).includes('- **Report sections, always present:** `Peer messages received`'));

describe('the peers section: what `Open items` holds', () => {
  it('59 native roles carry the peers section', () => {
    expect(withPeers).toHaveLength(59);
  });

  it.each(withPeers)('%s: names what goes under `Open items` and where a question for the user goes', role => {
    const text = nativeText(role);
    expect(text).toContain(`and ${NEW}.`);
    expect(text).not.toContain(OLD);
  });

  it.each(withPeers)('%s: carries the requests block the line points to', role => {
    const text = nativeText(role);
    expect(text).toContain('<!-- agents-united:requests:start');
    expect(text).toContain('Requests for the lead');
  });
});
