import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { checkFactoryArtifact } from '../src/core/factory-check.js';
import { checkSharedPair } from '../src/core/shared-pair.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import {
  canonicalDirectives, canonicalFloorProblems, canonicalGuardrails, canonicalServerTools, coverageFileProblems, invariantCoverageProblems,
  nativePosture, nativeToolOrder, postureProblems, sessionTrackingProblems,
} from '../src/core/native-repository-rules.js';

/**
 * ADR 0072: the repository's rules for a native Claude role live in src/core/native-repository-rules.ts, and two callers use them: the repository's
 * own conformance tests (for the committed roster) and the factory's checks (factory-check, contract-check) for a candidate. The pilot's original
 * devops-engineer candidates (2026-11-18) passed every factory check and failed five repository tests; the same candidates, brought into the
 * repository by hand (feat/devops-engineer-claude-lane, cdc1e0d), pass. Both are fixtures in tests/fixtures/pilot-devops.
 */

const ROOT = path.resolve('.');
const FIXTURES = path.resolve('tests/fixtures/pilot-devops');
const STEM = 'subagent-devops-engineer';
const read = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const canonicalOf = (stem: string): string => read(path.join(ROOT, 'registry/agents', `${stem}.md`));
const nativeOf = (role: string): string => read(path.join(ROOT, 'registry/hosts/claude/agents', `${role}.md`));

describe('the rules, one implementation', () => {
  it('names the posture of each kind of role: a specialist and a coordinator from the Claude dialect, a factory worker inherited', () => {
    expect(nativePosture('specialist')).toEqual({ model: ClaudeProjector.CLAUDE_DIALECT.roleModelDefaults!.specialist, effort: ClaudeProjector.CLAUDE_DIALECT.roleEffortDefaults!.specialist });
    expect(nativePosture('coordinator')).toEqual({ model: ClaudeProjector.CLAUDE_DIALECT.roleModelDefaults!.coordinator, effort: ClaudeProjector.CLAUDE_DIALECT.roleEffortDefaults!.coordinator });
    expect(nativePosture('factory-worker')).toEqual({ model: 'inherit', effort: 'medium' });
    expect(nativePosture('specialist')).toEqual({ model: 'sonnet', effort: 'medium' });
  });

  it('refuses another posture, naming both', () => {
    expect(postureProblems({ model: 'sonnet', effort: 'medium' }, 'specialist')).toEqual([]);
    const problems = postureProblems({ model: 'inherit', effort: 'medium' }, 'specialist');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Model posture inherit/medium differs from the specialist posture sonnet/medium');
    expect(postureProblems({}, 'specialist')[0]).toContain('Model posture (none)/(none)');
    // The finding names the kind it measured against, not always the specialist.
    expect(postureProblems({ model: 'sonnet', effort: 'medium' }, 'factory-worker')[0]).toContain('differs from the factory-worker posture inherit/medium');
  });

  it('requires the Session task tracking section of an end-user role, with the specialist or the coordinator wording', () => {
    expect(sessionTrackingProblems(nativeOf('backend-architect'), { coordinator: false })).toEqual([]);
    expect(sessionTrackingProblems(nativeOf('orchestrator-engineering'), { coordinator: true })).toEqual([]);
    const without = nativeOf('backend-architect').replace('## Session task tracking', '## Something else');
    expect(sessionTrackingProblems(without, { coordinator: false }).join('\n')).toContain('Session task tracking');
    // A specialist's section is not a coordinator's: the wordings differ.
    expect(sessionTrackingProblems(nativeOf('backend-architect'), { coordinator: true })).not.toEqual([]);
  });

  it('orders tools as the generator does: the class tools sorted, then the server tools in the canonical agent\'s order', () => {
    expect(nativeToolOrder(['Read', 'ListMcpResourcesTool', 'Grep', 'Bash'], ['mcp__github', 'mcp__context7'])).toEqual(['Bash', 'Grep', 'ListMcpResourcesTool', 'Read', 'mcp__github', 'mcp__context7']);
  });

  it('derives the server tools from the canonical agent: a server grant for a writable role, pinned read-only tools for a read-only role', () => {
    expect(canonicalServerTools(canonicalOf('subagent-backend-architect'))).toEqual(['mcp__github', 'mcp__context7']);
    expect(canonicalServerTools(canonicalOf('subagent-frontend-architect'))).toEqual(['mcp__stitch', 'mcp__context7', 'mcp__chrome-devtools-mcp']);
    expect(canonicalServerTools(canonicalOf('subagent-code-reviewer'))).toEqual(['mcp__github__search_code', 'mcp__github__get_file_contents', 'mcp__github__list_pull_requests',
      'mcp__github__pull_request_read', 'mcp__context7__resolve-library-id', 'mcp__context7__query-docs']);
    expect(canonicalServerTools(canonicalOf(STEM))).toEqual(['mcp__github', 'mcp__context7']);
    // The committed roles that have a canonical agent hold exactly these, in this order, after their class tools.
    for (const [role, stem] of [['backend-architect', 'subagent-backend-architect'], ['frontend-architect', 'subagent-frontend-architect'], ['code-reviewer', 'subagent-code-reviewer']]) {
      const tools = /^tools: (.*)$/m.exec(nativeOf(role))![1]!.split(', ');
      expect(tools.filter(tool => tool.startsWith('mcp__')), role).toEqual(canonicalServerTools(canonicalOf(stem)));
    }
  });

  it('reads the canonical guardrails and numbered directives, and refuses a core that drops one', async () => {
    const cores = await loadSemanticCore(path.join(ROOT, 'registry'));
    expect(canonicalGuardrails(canonicalOf('subagent-backend-architect')).length).toBeGreaterThan(0);
    expect(canonicalDirectives(canonicalOf('subagent-backend-architect')).length).toBeGreaterThan(0);
    expect(canonicalFloorProblems(cores.get('subagent-backend-architect')!, canonicalOf('subagent-backend-architect'))).toEqual([]);
    const titles = canonicalDirectives(canonicalOf(STEM));
    expect(titles).toHaveLength(4);
    const cut = { ...cores.get('subagent-backend-architect')!, scope_boundaries: 'Only this.' };
    expect(canonicalFloorProblems(cut, canonicalOf('subagent-backend-architect')).join('\n')).toContain('canonical directive');
    const unsafe = { ...cores.get('subagent-backend-architect')!, safety: 'Be careful.' };
    expect(canonicalFloorProblems(unsafe, canonicalOf('subagent-backend-architect')).join('\n')).toContain('canonical guardrail');
  });

  it('counts an invariant as covered when it is bound or declared, and names the one that is neither', async () => {
    const cores = await loadSemanticCore(path.join(ROOT, 'registry'));
    const core = cores.get('subagent-backend-architect')!;
    expect(invariantCoverageProblems(core, () => true, [])).toEqual([]);
    const [first, ...rest] = core.invariants;
    expect(invariantCoverageProblems(core, invariant => rest.includes(invariant), [])).toEqual([expect.stringContaining(first!)]);
    expect(invariantCoverageProblems(core, invariant => rest.includes(invariant), [{ feature: first!, host: 'claude', disposition: 'approximated', rationale: 'A reason.' }])).toEqual([]);
  });

  it('checks a candidate\'s coverage file: every invariant once, evidence verbatim in the agent, a delta with a disposition and a rationale', async () => {
    const final = path.join(FIXTURES, 'final');
    const core = (await loadSemanticCore(await stage(final))).get(STEM)!;
    const agent = read(path.join(final, 'agent/devops-engineer.md'));
    const coverage = await fs.readJson(path.join(final, 'agent/devops-engineer.coverage.json')) as { invariants: Array<Record<string, unknown>> };
    expect(coverageFileProblems(core, agent, coverage)).toEqual([]);
    const missing = { ...coverage, invariants: coverage.invariants.slice(1) };
    expect(coverageFileProblems(core, agent, missing).join('\n')).toContain(core.invariants[0]!);
    const invented = { ...coverage, invariants: coverage.invariants.map((item, index) => index === 0 ? { ...item, evidence: 'A sentence the agent does not contain at all.' } : item) };
    expect(coverageFileProblems(core, agent, invented).join('\n')).toContain('not found in the agent');
    const delta = { ...coverage, invariants: coverage.invariants.map((item, index) => index === 0 ? { invariant: item.invariant, delta: { disposition: 'approximated', rationale: '' } } : item) };
    expect(coverageFileProblems(core, agent, delta).join('\n')).toContain('rationale');
    const twice = { ...coverage, invariants: [...coverage.invariants, coverage.invariants[0]!] };
    expect(coverageFileProblems(core, agent, twice).join('\n')).toContain('more than once');
    expect(coverageFileProblems(core, agent, null)).not.toEqual([]);
  });
});

/** A registry holding the repository's cores, profile, tool policy, bindings and canonical agents, with the pair of `variant` in place of the devops pair. */
let scratch = '';
async function stage(variant: string): Promise<string> {
  const registry = path.join(scratch || (scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'au-repo-rules-'))), path.basename(variant), 'registry');
  if (await fs.pathExists(registry)) return registry;
  for (const rel of ['core', 'hosts/claude', 'agents']) await fs.copy(path.join(ROOT, 'registry', rel), path.join(registry, rel));
  for (const name of ['subagent-devops-engineer.core.md', 'subagent-devops-engineer.contract.json']) await fs.copy(path.join(variant, 'core', name), path.join(registry, 'core', name));
  return registry;
}

beforeEach(() => { scratch = ''; });
afterEach(async () => { if (scratch) await fs.remove(scratch); });

describe('the factory\'s checks use the same rules', () => {

  it('factory-check accepts the devops-engineer as it was brought into the repository', async () => {
    const final = path.join(FIXTURES, 'final');
    const registry = await stage(final);
    const result = await checkFactoryArtifact({ registryDir: registry, definition: STEM, host: 'claude', artifactPath: path.join(final, 'agent/devops-engineer.md'),
      loading: 'subagent', requiredSkills: [], canonicalFile: path.join(registry, 'agents', `${STEM}.md`), coverageFile: path.join(final, 'agent/devops-engineer.coverage.json') });
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('factory-check refuses the pilot\'s original candidate, naming each rule it breaks', async () => {
    const original = path.join(FIXTURES, 'original');
    const registry = await stage(original);
    const result = await checkFactoryArtifact({ registryDir: registry, definition: STEM, host: 'claude', artifactPath: path.join(original, 'agent/devops-engineer.md'),
      loading: 'subagent', requiredSkills: [], canonicalFile: path.join(registry, 'agents', `${STEM}.md`) });
    expect(result.ok).toBe(false);
    const text = result.findings.join('\n');
    expect(text).toContain('Model posture inherit/medium differs from the specialist posture sonnet/medium');
    expect(text).toContain('Session task tracking');
    expect(text).toContain('Native tools differ from the generator\'s form');
    expect(text).toContain('canonical directive');
    expect(text).toContain('Invariant coverage');
  });

  it('factory-check takes the canonical agent from the registry when none is named, and refuses an mcp__ tool the canonical agent does not declare', async () => {
    const final = path.join(FIXTURES, 'final');
    const registry = await stage(final);
    const agent = read(path.join(final, 'agent/devops-engineer.md')).replace(/^(tools: .*)$/m, '$1, mcp__stitch');
    const file = path.join(scratch, 'devops-engineer.md');
    await fs.writeFile(file, agent);
    const result = await checkFactoryArtifact({ registryDir: registry, definition: STEM, host: 'claude', artifactPath: file, loading: 'subagent', requiredSkills: [],
      coverageFile: path.join(final, 'agent/devops-engineer.coverage.json') });
    expect(result.ok).toBe(false);
    expect(result.findings.join('\n')).toContain('Native tools differ from the generator\'s form');
  });

  it('contract-check refuses the pilot\'s original pair against its canonical agent, and accepts the final pair', async () => {
    const originalRegistry = await stage(path.join(FIXTURES, 'original'));
    const refused = await checkSharedPair({ registryDir: originalRegistry, definition: STEM, canonicalFile: path.join(originalRegistry, 'agents', `${STEM}.md`) });
    expect(refused.valid).toBe(false);
    expect(refused.findings.join('\n')).toContain('canonical directive');
    const finalRegistry = await stage(path.join(FIXTURES, 'final'));
    const accepted = await checkSharedPair({ registryDir: finalRegistry, definition: STEM, canonicalFile: path.join(finalRegistry, 'agents', `${STEM}.md`) });
    expect(accepted.findings).toEqual([]);
    expect(accepted.valid).toBe(true);
    // Without a canonical file the pair check is what it was.
    expect((await checkSharedPair({ registryDir: originalRegistry, definition: STEM })).valid).toBe(true);
  });
});
