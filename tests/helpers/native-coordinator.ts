import fs from 'node:fs';
import path from 'node:path';
import { inspectNativeAgent } from '../../src/core/native-guard.js';
import { domainTypes } from '../../src/core/native-roster.js';
import type { RosterType } from '../../src/core/native-roster.js';

/** The bundle whose coordinator is the native orchestrator under test. */
export const COORDINATOR_BUNDLE = 'software-engineering';

export const bundles = (): Record<string, any> => {
  const raw = JSON.parse(fs.readFileSync(path.resolve('registry/bundles.json'), 'utf8'));
  return raw.bundles ?? raw;
};

/** The domain map as the orchestrator carries it: every type of its domain, with the facts of each native agent as committed. */
export const rosterTypes = (): RosterType[] =>
  domainTypes(bundles(), COORDINATOR_BUNDLE).map(type => {
    const file = path.resolve('registry/hosts/claude/agents', `${type.name}.md`);
    if (!fs.existsSync(file)) return type;
    const facts = inspectNativeAgent(fs.readFileSync(file, 'utf8'));
    return { ...type, native: { description: String(facts.meta.description ?? ''), tools: facts.tools, guard: facts.guard } };
  });

/** The coordinator's `Agent(...)` allowlist: exactly the types of its domain. */
export const allowlist = (): string => `Agent(${domainTypes(bundles(), COORDINATOR_BUNDLE).map(type => type.name).join(', ')})`;
