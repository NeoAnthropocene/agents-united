import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import { splitTools } from '../src/core/native-guard.js';
import { checkRoster, domainTypes } from '../src/core/native-roster.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import { allowlist, bundles, rosterTypes } from './helpers/native-coordinator.js';
import { withoutPublishingBlock } from './helpers/artifact-holders.js';

/**
 * The native lead of the system-architecture bundle family, a twin of tests/native-orchestrator.test.ts (which pins the engineering lead): it runs as the main thread,
 * may spawn exactly the six types of the architecture domain, and carries a generated domain map. What differs from the engineering lead: it holds no `Workflow` tool
 * and does not run saved workflows (its plan does not depend on them: no Bundle of the architecture domain installs them, and when `full` does install workflow-review,
 * workflow-implement and workflow-test the lead still fans out with parallel `Agent` calls), and security architecture is routed to the user, not delegated.
 */

const BUNDLE = 'system-architecture';
const file = path.resolve('registry/hosts/claude/agents/orchestrator-system-architecture.md');
const read = (): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
// The generated requests block (ADR 0076) is not authored text: scans of the authored wording leave it out.
const withoutRequests = (value: string): string => value.replace(/<!-- agents-united:requests:start[^>]*-->[\s\S]*?<!-- agents-united:requests:end -->\n?/, '');
const frontmatter = (): Record<string, any> => yaml.parse(/^---\n([\s\S]*?)\n---\n/.exec(read())![1]);

describe('native orchestrator-system-architecture (a main-thread coordinator)', () => {
  it('may spawn exactly the six specialist types of the architecture domain, through an Agent allowlist and never a bare Agent', () => {
    const tools = splitTools(frontmatter().tools);
    expect(tools.filter(tool => tool.startsWith('Agent'))).toEqual([allowlist(BUNDLE)]);
    expect(tools).not.toContain('Agent');
    expect(allowlist(BUNDLE).slice('Agent('.length, -1).split(', ')).toEqual([
      'backend-architect', 'cloud-infrastructure-architect', 'database-administrator', 'finops-cost-engineer', 'sysops-sre-lead', 'system-architect',
    ]);
  });

  it('carries the domain map exactly as generated from the bundles and the native agents', () => {
    expect(checkRoster(read(), rosterTypes(BUNDLE))).toEqual([]);
  });

  it('names every type of its domain in the map, with the bundles that provide it', () => {
    const body = read();
    for (const type of domainTypes(bundles(), BUNDLE)) {
      expect(body, type.name).toContain(`| \`${type.name}\` | ${type.bundles.map(bundle => `\`${bundle}\``).join(', ')} |`);
      for (const bundle of type.bundles) expect(Object.keys(bundles()), bundle).toContain(bundle);
    }
  });

  it('tells the user how to install a missing type and refresh the running session', () => {
    const body = read();
    expect(body).toContain('agents add <bundle>');
    expect(body).toContain('/reload-skills');
  });

  it('states that it must run as the main thread, and what it does when it cannot', () => {
    const body = read();
    expect(body).toContain('claude --agent orchestrator-system-architecture');
    expect(body).toContain('agents start system-architecture --host claude');
    expect(body).toMatch(/AskUserQuestion is not available to a subagent/);
  });

  it('refers only to slash commands that exist as skills, and to bundles that exist', () => {
    // The generated publishing block (ADR 0077) names the commands of the design capability; its own suite checks it.
    const body = withoutPublishingBlock(read());
    for (const match of body.matchAll(/`\/([a-z0-9-]+)`/g)) {
      if (match[1] === 'reload-skills' || match[1] === 'config') continue; // Claude Code commands, not skills of ours
      expect(fs.existsSync(path.resolve('registry/skills', match[1], 'SKILL.md')), `/${match[1]}`).toBe(true);
    }
    for (const match of body.matchAll(/agents add ([a-z][a-z0-9:-]*)/g)) {
      const name = match[1].replace(/^domain:/, '');
      expect(match[1].startsWith('domain:') || Object.keys(bundles()).includes(name), `agents add ${match[1]}`).toBe(true);
    }
  });

  it('recommends the whole suite by a domain that exists, and every bundle of the cross-bundle table', () => {
    const body = read();
    const domains = new Set(Object.values(bundles()).map((bundle: any) => bundle.domain));
    expect(domains.has('architecture')).toBe(true);
    expect(body).toContain('agents add domain:architecture');
    for (const bundle of ['sysops-sre', 'system-architecture-cloud', 'system-architecture-data', 'system-architecture-finops', 'backend-distributed-systems', 'devops-engineering', 'security-operations', 'ai-ml-engineering']) {
      expect(Object.keys(bundles()), bundle).toContain(bundle);
      expect(body, bundle).toContain(`agents add ${bundle}`);
    }
  });

  it('is a coordinator, so it delegates every domain implementation slice and does not carry the implementation skills', () => {
    expect(frontmatter().skills ?? []).toEqual([]);
    expect(read()).toMatch(/delegate every (domain )?(implementation|slice)/i);
  });

  // The plan does not depend on saved workflows: no Bundle of the architecture domain installs them (`full` does list the lead and installs them, and the lead still fans out with parallel Agent calls).
  it('holds no Workflow tool and does not run saved workflows, because its plan does not depend on them', () => {
    const tools = splitTools(frontmatter().tools).map(tool => tool.split('(')[0]);
    expect(tools).not.toContain('Workflow');
    expect(withoutRequests(read())).not.toContain('`Workflow`');
    expect(read()).not.toMatch(/workflow-(review|implement|test)\b/);
    for (const name of ['workflow-review', 'workflow-implement', 'workflow-test']) {
      expect(bundles()[BUNDLE].skills, name).not.toContain(name);
    }
  });

  it('does not delegate security work: security-engineer is not in the allowlist, and the user is pointed to security-operations', () => {
    const entry = splitTools(frontmatter().tools).find(tool => tool.startsWith('Agent('))!;
    expect(entry).not.toContain('security-engineer');
    const body = read();
    expect(body).not.toMatch(/security-engineer/);
    expect(body).toContain('agents add security-operations');
    expect(body).toMatch(/Security architecture is not delegated/);
  });
});

describe('native orchestrator-system-architecture: the shared core carries the canonical lead\'s duties', () => {
  const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();
  const canonical = (): string => fs.readFileSync(path.resolve('registry/agents/orchestrator-system-architecture.md'), 'utf8').replace(/\r\n/g, '\n');
  const scope = async (): Promise<string> => normalize((await loadSemanticCore('registry')).get('orchestrator-system-architecture')!.scope_boundaries);

  it('keeps the three Boundary Constraints of the canonical lead, in the core\'s own wording (sentence case, no backticks)', async () => {
    // The canonical bullets, so a change to them is noticed: the core lower-cases the first word of each rule.
    const bullets = [...(/\n## [^\n]*Boundary Constraints[^\n]*\n([\s\S]*?)(?=\n## )/.exec(canonical())?.[1] ?? '').matchAll(/^- \*\*(.+?)\*\*: (.+)$/gm)].map(match => match[1]!.toLowerCase());
    expect(bullets).toEqual(['explicit domain boundaries', 'resilience design', 'documented adrs']);
    const text = await scope();
    expect(text).toContain('Boundary constraints:');
    for (const rule of [
      '- **Explicit domain boundaries**: enforce strict separation of concerns and clear bounded contexts; prevent circular dependencies between modules.',
      '- **Resilience design**: require circuit breakers, retry backoffs and fallback handling for all network calls.',
      '- **Documented ADRs**: every major architectural decision is captured in an ADR document under docs/adr/.',
    ]) expect(text, rule).toContain(rule);
  });

  it('keeps the planning consultation gate, and names no security-engineer as a delegate', async () => {
    const text = await scope();
    expect(text).toContain('Planning consultation. Before finalizing any delegation map:');
    expect(text).toContain('**Mandatory specialist consult gate (unconditional)**: consult at least one relevant specialist during planning before emitting the delegation map, unless the user explicitly waives it.');
    expect(text).toContain('Specialists advise only; they write no deliverable files during planning.');
    expect(text).toContain('**Then the delegation map**:');
    expect(text).not.toMatch(/security-engineer/);
  });
});
