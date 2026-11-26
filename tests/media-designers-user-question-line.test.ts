import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The motion and sound designers' output contract is shared by every host. It used to end "Include Peer messages received
// and Open items, with user questions for Chris.", which put a question for the user under `Open items`. On Claude a
// question for the user is an `ask-user` entry under `Requests for the lead` (ADR 0076), so the shared line now routes user
// questions through Chris without naming a section, as the 3D designer's core already does.
const root = path.resolve(__dirname, '..');
const OLD = 'Include Peer messages received and Open items, with user questions for Chris.';
const NEW = 'Include Peer messages received and Open items, and route user questions through Chris.';

const files = [
  'registry/core/subagent-motion-designer.core.md',
  'registry/core/subagent-sound-designer.core.md',
  'registry/agents/subagent-motion-designer.md',
  'registry/agents/subagent-sound-designer.md',
  'registry/hosts/claude/agents/agency-motion-designer.md',
  'registry/hosts/claude/agents/agency-sound-designer.md',
];

describe('the motion and sound designers route user questions through Chris, not under Open items', () => {
  for (const file of files) {
    it(file, () => {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      expect(text).not.toContain(OLD);
      expect(text.split(NEW).length - 1).toBe(1);
    });
  }

  it('no file in the registry still carries the old clause', () => {
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.md') && fs.readFileSync(full, 'utf8').includes('with user questions for Chris')) hits.push(path.relative(root, full));
      }
    };
    walk(path.join(root, 'registry'));
    expect(hits).toEqual([]);
  });
});
