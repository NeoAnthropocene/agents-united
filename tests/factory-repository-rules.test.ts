import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import { checkFactoryArtifact } from '../src/core/factory-check.js';
import { checkSharedPair } from '../src/core/shared-pair.js';
import { inspectNativeAgent } from '../src/core/native-guard.js';
import { loadSemanticCore } from '../src/core/semantic-core.js';
import {
  canonicalDirectives, canonicalFloorProblems, canonicalGuardrails, canonicalServerTools, coverageFileProblems, invariantCoverageProblems,
  evidencePlaceAt, nativePosture, nativeToolOrder, nativeToolsWanted, postureProblems, sessionTrackingProblems, type EvidencePlace,
} from '../src/core/native-repository-rules.js';
import { evidenceFor } from './helpers/native-invariant-evidence.js';
import { loadNativeDeltas, NATIVE_ROLES } from './helpers/native-roles.js';

/**
 * ADR 0072: the repository's rules for a native Claude role live in src/core/native-repository-rules.ts, and two callers use them: the repository's
 * own conformance tests (for the committed roster) and the factory's checks (factory-check, contract-check) for a candidate. The pilot's original
 * devops-engineer candidates (2026-11-18) passed every factory check and failed five repository tests; the same candidates, brought into the
 * repository by hand (PR #237), pass. The originals are fixtures in tests/fixtures/pilot-devops/original; the final member is read from the
 * registry itself (registry/hosts/claude/agents/devops-engineer.md and registry/core/subagent-devops-engineer.*), so it cannot drift from what the
 * repository holds. Only its coverage file is a fixture (tests/fixtures/pilot-devops/final).
 */

const ROOT = path.resolve('.');
const FIXTURES = path.resolve('tests/fixtures/pilot-devops');
const FINAL_AGENT = path.join(ROOT, 'registry/hosts/claude/agents/devops-engineer.md');
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

  it('lets one well-formed Agent(...) allowlist stand for Agent only in a role that can delegate', () => {
    const expected = ['Agent', 'Read', 'mcp__github'];
    expect(nativeToolsWanted(expected, ['Agent(a-role, b-role)', 'Read', 'mcp__github'], { coordinator: true })).toEqual(['Agent(a-role, b-role)', 'Read', 'mcp__github']);
    // A specialist, a malformed or duplicated list, or a bare Agent beside the list gets no stand-in, so the comparison refuses it.
    expect(nativeToolsWanted(expected, ['Agent(a-role)', 'Read', 'mcp__github'], { coordinator: false })).toEqual(expected);
    expect(nativeToolsWanted(expected, ['Agent(a-role,b-role)', 'Read'], { coordinator: true })).toEqual(expected);
    expect(nativeToolsWanted(expected, ['Agent(Bad Name)', 'Read'], { coordinator: true })).toEqual(expected);
    expect(nativeToolsWanted(expected, ['Agent(a-role, a-role)', 'Read'], { coordinator: true })).toEqual(expected);
    expect(nativeToolsWanted(expected, ['Agent', 'Agent(a-role)', 'Read'], { coordinator: true })).toEqual(expected);
    // Every committed lead's line is accepted in this form.
    for (const role of ['orchestrator-engineering', 'orchestrator-digital-agency']) {
      const tools = inspectNativeAgent(nativeOf(role)).tools;
      const plain = tools.map(tool => (tool.startsWith('Agent(') ? 'Agent' : tool));
      expect(nativeToolsWanted(plain, tools, { coordinator: true }), role).toEqual(tools);
    }
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
    const agent = read(FINAL_AGENT);
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
    // With the expected names, the file must name the checked agent and its pair.
    expect(coverageFileProblems(core, agent, coverage, { role: 'devops-engineer', definition: STEM })).toEqual([]);
    expect(coverageFileProblems(core, agent, coverage, { role: 'other-role', definition: STEM }).join('\n')).toContain('role must be "other-role"');
    expect(coverageFileProblems(core, agent, coverage, { role: 'devops-engineer', definition: 'subagent-other' }).join('\n')).toContain('definition must be "subagent-other"');
  });

  it('checks that evidence declares its place, sits there as a complete sentence or list item, and is shared only when both entries say so', async () => {
    const final = path.join(FIXTURES, 'final');
    const core = (await loadSemanticCore(await stage(final))).get(STEM)!;
    const agent = read(FINAL_AGENT);
    const coverage = await fs.readJson(path.join(final, 'agent/devops-engineer.coverage.json')) as { invariants: Array<Record<string, unknown>> };
    const items = coverage.invariants;
    const withEntry = (index: number, entry: Record<string, unknown>) => ({ ...coverage, invariants: items.map((item, at) => (at === index ? entry : item)) });
    const problems = (file: unknown) => coverageFileProblems(core, agent, file).join('\n');
    // The fixture binds five invariants through floor Safety lines and five through the body.
    expect(items.filter(item => item.in === 'floor')).toHaveLength(5);
    expect(items.filter(item => item.in === 'body')).toHaveLength(5);
    // Place: declared, and true.
    const { in: _place, ...unplaced } = items[6]!;
    expect(problems(withEntry(6, unplaced))).toContain('must declare its place');
    expect(problems(withEntry(6, { ...items[6]!, in: 'floor' }))).toContain('is not in the agent\'s Contract Floor');
    expect(problems(withEntry(0, { ...items[0]!, in: 'body' }))).toContain('own body (outside every generated block)');
    // A fragment is not evidence; a complete sentence inside a list item is.
    expect(problems(withEntry(6, { ...items[6]!, evidence: 'use `SendMessage` to push results' }))).toContain('not a complete sentence or list item');
    expect(problems(withEntry(6, { ...items[6]!, evidence: 'Do not use `SendMessage` to push results to the lead mid-run.' }))).toBe('');
    // Shared evidence: refused unless both entries name each other; a named share must be real.
    const shared = { ...coverage, invariants: items.map((item, at) => (at === 7 ? { ...item, evidence: items[6]!.evidence } : item)) };
    expect(problems(shared)).toContain('share evidence; each must name the other');
    const declared = { ...coverage, invariants: items.map((item, at) => (at === 6 ? { ...item, sharedWith: [items[7]!.invariant] } : at === 7 ? { ...item, evidence: items[6]!.evidence, sharedWith: [items[6]!.invariant] } : item)) };
    expect(problems(declared)).toBe('');
    const oneSided = { ...coverage, invariants: items.map((item, at) => (at === 7 ? { ...item, evidence: items[6]!.evidence, sharedWith: [items[6]!.invariant] } : item)) };
    expect(problems(oneSided)).toContain('share evidence; each must name the other');
    expect(problems(withEntry(8, { ...items[8]!, sharedWith: [items[9]!.invariant] }))).toContain('do not share evidence');
    expect(problems(withEntry(8, { ...items[8]!, sharedWith: [items[8]!.invariant] }))).toContain('names itself in "sharedWith"');
  });

  it('accepts what the repository accepts: every committed native role\'s bindings, written as a coverage file, pass the rule (ADR 0072 audit)', async () => {
    const cores = await loadSemanticCore(path.join(ROOT, 'registry'));
    const deltas = loadNativeDeltas(path.join(ROOT, 'registry'), 'claude');
    let floorBound = 0, sharedEntries = 0;
    for (const { role, stem } of NATIVE_ROLES) {
      const agent = nativeOf(role);
      const core = cores.get(stem)!;
      const invariants = core.invariants.map(invariant => {
        const delta = deltas.find(item => item.roles.includes(role) && item.feature === invariant);
        if (delta) return { invariant, delta: { disposition: delta.disposition, rationale: delta.rationale } };
        const rule = evidenceFor(role, invariant)!;
        const flags = rule.flags.includes('g') ? rule.flags : `${rule.flags}g`;
        const match = [...agent.matchAll(new RegExp(rule.source, flags))].find(m => evidencePlaceAt(agent, m.index!, m.index! + m[0].length) !== undefined);
        expect(match, `${role}: "${invariant}" has a bound place`).toBeDefined();
        const [start, end] = enclosingUnit(agent, match!.index!, match!.index! + match![0].length);
        return { invariant, evidence: agent.slice(start, end), in: evidencePlaceAt(agent, start, end)! };
      });
      const evidenced = invariants.filter((item): item is { invariant: string; evidence: string; in: EvidencePlace } => 'evidence' in item);
      for (const item of evidenced) {
        const partners = evidenced.filter(other => other !== item && (other.evidence.includes(item.evidence) || item.evidence.includes(other.evidence))).map(other => other.invariant);
        if (partners.length > 0) { Object.assign(item, { sharedWith: partners }); sharedEntries++; }
        if (item.in === 'floor') floorBound++;
      }
      expect(coverageFileProblems(core, agent, { version: 1, role, definition: stem, invariants }, { role, definition: stem }), role).toEqual([]);
    }
    // The design's reason (ADR 0072): bindings in the floor and shared sentences exist in what the repository accepts.
    expect(floorBound).toBeGreaterThan(0);
    expect(sharedEntries).toBeGreaterThan(0);
  });
});

/** The smallest run of whole sentences or list items around [start, end): back to a line start or a sentence end, on to a sentence end or the line end. */
function enclosingUnit(agent: string, start: number, end: number): [number, number] {
  const lineStart = agent.lastIndexOf('\n', start - 1) + 1;
  const firstLine = agent.slice(lineStart, agent.indexOf('\n', lineStart) === -1 ? agent.length : agent.indexOf('\n', lineStart));
  const indent = /^\s*/.exec(firstLine)![0].length;
  let from = lineStart + indent;
  for (const m of firstLine.matchAll(/[.!?][*`)"]*\s+/g)) if (lineStart + m.index! + m[0].length <= start) from = lineStart + m.index! + m[0].length;
  const lineEndAt = agent.indexOf('\n', Math.max(end - 1, start)) === -1 ? agent.length : agent.indexOf('\n', Math.max(end - 1, start));
  const lastLineStart = agent.lastIndexOf('\n', lineEndAt - 1) + 1;
  let to = lineEndAt;
  for (const m of agent.slice(lastLineStart, lineEndAt).matchAll(/[.!?][*`)"]*(?=\s)/g)) {
    const at = lastLineStart + m.index! + m[0].length;
    if (at >= end && at < to) to = at;
  }
  while (to > from && /\s/.test(agent[to - 1]!)) to--;
  return [from, to];
}

/** A registry holding the repository's cores, profile, tool policy, bindings and canonical agents, with the pair of `variant` (when it has one) in place of the devops pair. */
let scratch = '';
async function stage(variant: string): Promise<string> {
  const registry = path.join(scratch || (scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'au-repo-rules-'))), path.basename(variant), 'registry');
  if (await fs.pathExists(registry)) return registry;
  for (const rel of ['core', 'hosts/claude', 'agents']) await fs.copy(path.join(ROOT, 'registry', rel), path.join(registry, rel));
  if (await fs.pathExists(path.join(variant, 'core'))) {
    for (const name of ['subagent-devops-engineer.core.md', 'subagent-devops-engineer.contract.json']) await fs.copy(path.join(variant, 'core', name), path.join(registry, 'core', name));
  }
  return registry;
}

beforeEach(() => { scratch = ''; });
afterEach(async () => { if (scratch) await fs.remove(scratch); });

describe('the factory\'s checks use the same rules', () => {

  it('factory-check accepts the devops-engineer as it was brought into the repository', async () => {
    const final = path.join(FIXTURES, 'final');
    const registry = await stage(final);
    const result = await checkFactoryArtifact({ registryDir: registry, definition: STEM, host: 'claude', artifactPath: FINAL_AGENT,
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
    const agent = read(FINAL_AGENT).replace(/^(tools: .*)$/m, '$1, mcp__stitch');
    const file = path.join(scratch, 'devops-engineer.md');
    await fs.writeFile(file, agent);
    const result = await checkFactoryArtifact({ registryDir: registry, definition: STEM, host: 'claude', artifactPath: file, loading: 'subagent', requiredSkills: [],
      coverageFile: path.join(final, 'agent/devops-engineer.coverage.json') });
    expect(result.ok).toBe(false);
    expect(result.findings.join('\n')).toContain('Native tools differ from the generator\'s form');
  });

  it('factory-check holds the factory\'s own coordinator to its fixed delegate list (the function native-delta uses)', async () => {
    const registry = await stage(path.join(FIXTURES, 'final'));
    const committed = nativeOf('orchestrator-agent-factory');
    const check = async (text: string) => {
      const file = path.join(scratch, 'orchestrator-agent-factory.md');
      await fs.writeFile(file, text);
      return (await checkFactoryArtifact({ registryDir: registry, definition: 'orchestrator-agent-factory', host: 'claude', artifactPath: file, loading: 'main', requiredSkills: [] })).findings.join('\n');
    };
    const fixed = 'coordinate-artifact requires exactly Agent(factory-realizer, factory-evaluator, factory-sync)';
    expect(await check(committed)).not.toContain(fixed);
    expect(await check(committed)).not.toContain('Native tools differ');
    // A well-formed but different list would pass the generic stand-in; the factory coordinator's own rule refuses it.
    expect(await check(committed.replace(/Agent\([^)]*\)/, 'Agent(factory-realizer, factory-evaluator)'))).toContain(fixed);
  });

  it('factory-check refuses a relative canonical or coverage path', async () => {
    const final = path.join(FIXTURES, 'final');
    const registry = await stage(final);
    const base = { registryDir: registry, definition: STEM, host: 'claude', artifactPath: FINAL_AGENT, loading: 'subagent' as const, requiredSkills: [] };
    const relCanonical = await checkFactoryArtifact({ ...base, canonicalFile: 'agents/subagent-devops-engineer.md', coverageFile: path.join(final, 'agent/devops-engineer.coverage.json') });
    expect(relCanonical.findings.join('\n')).toContain('Canonical agent must be an absolute path');
    const relCoverage = await checkFactoryArtifact({ ...base, coverageFile: 'devops-engineer.coverage.json' });
    expect(relCoverage.findings.join('\n')).toContain('coverage file must be an absolute path');
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
