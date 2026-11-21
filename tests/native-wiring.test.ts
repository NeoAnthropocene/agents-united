import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- a plain ES module of the contributor tooling, without type declarations.
import { applyWiring, checkManifest, planWiring } from '../scripts/native-wiring.mjs';
// @ts-expect-error -- a plain ES module of the contributor tooling, without type declarations.
import { conformanceFiles } from '../scripts/run-native-conformance.mjs';

/**
 * ADR 0075: the test wiring of a role brought into the Claude native lane is generated from a batch manifest, outside the factory and never at
 * install time. The proof is PR #237's own wiring of `devops-engineer`: removed from a copy of the files, the generator restores it, byte for byte
 * where the placement rule is fixed and line for line or match for match where #237 was written by hand (ADR 0075, decision 3).
 */

type Json = Record<string, any>;
const ROOT = path.resolve('.');
const MANIFEST = path.resolve('tests/fixtures/native-wiring/devops-engineering.manifest.json');
const lf = (text: string): string => text.replace(/\r\n/g, '\n');
const read = (file: string): string => lf(fs.readFileSync(file, 'utf8'));
const manifest = (): Json => fs.readJsonSync(MANIFEST);

/** The files the generator may write. */
const WIRED = ['tests/helpers/native-roles.ts', 'tests/native-claude-agents.test.ts', 'tests/helpers/native-invariant-evidence.ts',
  'tests/native-claude-own-session.test.ts', 'tests/native-install-lane.test.ts', 'tests/cli-e2e.test.ts'];
/**
 * The repository as PR #237 left it (commit 908c521), frozen: the six wired files and the generator's inputs, each stored as `<path>.frozen` so the
 * test runner and the type check leave them alone. The live files change with every role that lands, so the proof never reads them.
 */
const FROZEN = path.resolve('tests/fixtures/native-wiring/908c521');
const COVERAGE = 'tests/fixtures/pilot-devops/final/agent/devops-engineer.coverage.json';

let work = '';
beforeEach(async () => { work = await fs.mkdtemp(path.join(os.tmpdir(), 'au-native-wiring-')); });
afterEach(async () => { await fs.remove(work); });

/** Every frozen file, by its repository path. */
function frozenFiles(dir = FROZEN): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? frozenFiles(path.join(dir, entry.name))
    : [path.relative(FROZEN, path.join(dir, entry.name)).replace(/\\/g, '/').replace(/\.frozen$/, '')]);
}
const frozen = (rel: string): string => read(path.join(FROZEN, `${rel}.frozen`));

/**
 * A checkout as it was at 908c521: the frozen files, the devops-engineer coverage file, and one placeholder native file for each other role of
 * the frozen roster (the generator only counts those; it reads the files of the roles it wires).
 */
async function copyCheckout(): Promise<string> {
  const checkout = path.join(work, 'checkout');
  for (const rel of frozenFiles()) await fs.outputFile(path.join(checkout, rel), frozen(rel));
  await fs.copy(path.join(ROOT, COVERAGE), path.join(checkout, COVERAGE));
  for (const [, role] of frozen('tests/helpers/native-roles.ts').matchAll(/^ {2}\{ role: '([a-z0-9-]+)'/gm)) {
    const file = path.join(checkout, 'registry/hosts/claude/agents', `${role}.md`);
    if (!fs.existsSync(file)) await fs.outputFile(file, `---\nname: ${role}\n---\nPlaceholder: only counted.\n`);
  }
  return checkout;
}

/** Removes exactly the wiring PR #237 added for devops-engineer, so the generator can be asked to restore it. */
/** Removes from `start` through `end` (or up to `end` when `keepEnd`), each found exactly once. */
function cut(text: string, start: string, end: string, keepEnd = false): string {
  const from = text.indexOf(start);
  expect(from, `start of ${start.slice(0, 60)}`).toBeGreaterThanOrEqual(0);
  expect(text.indexOf(start, from + 1), `one start ${start.slice(0, 60)}`).toBe(-1);
  const to = text.indexOf(end, from + start.length);
  expect(to, `end after ${start.slice(0, 60)}`).toBeGreaterThanOrEqual(from + start.length);
  return text.slice(0, from) + text.slice(keepEnd ? to : to + end.length);
}
async function unwire(checkout: string): Promise<void> {
  const edit = async (rel: string, change: (text: string) => string) => {
    const file = path.join(checkout, rel);
    const before = read(file);
    const after = change(before);
    expect(after, rel).not.toBe(before);
    await fs.writeFile(file, after);
  };
  await edit('tests/helpers/native-roles.ts', text => cut(text, "  { role: 'devops-engineer',", '\n'));
  await edit('tests/native-claude-agents.test.ts', text => cut(text, "  { name: 'devops-engineer',", '\n'));
  await edit('tests/helpers/native-invariant-evidence.ts', text => cut(text, '  // `devops-engineer` (the factory pilot', "\n  },\n"));
  await edit('tests/native-claude-own-session.test.ts', text => text.replace('expect(files).toHaveLength(23);', 'expect(files).toHaveLength(22);'));
  await edit('tests/native-install-lane.test.ts', text => cut(cut(text, " 'devops-engineer',", ''),
    "  it('installs the native devops-engineer for the devops-engineering bundle", "  it('records the lane", true));
  await edit('tests/cli-e2e.test.ts', text => cut(text, "  it('installs the native devops-engineer for devops-engineering with -t claude --native'", "  it.each(['domain:contributor'", true));
}

/** `'<invariant>': /<pattern>/flags` (or `[COMMS.name]: ...`) lines of a block of the evidence helper that opens with `header`, at `indent` spaces. */
function patternsOf(text: string, header: string, indent: number): Map<string, RegExp> {
  const start = text.indexOf(header);
  if (start < 0) return new Map();
  const end = text.indexOf(`\n${' '.repeat(indent - 2)}}`, start);
  const named = new Map([...(/const COMMS = \{([\s\S]*?)\}/.exec(text)?.[1] ?? '').matchAll(/^\s+(\w+): '((?:[^'\\]|\\.)*)',$/gm)].map(m => [m[1]!, m[2]!]));
  const line = new RegExp(`^ {${indent}}(?:'((?:[^'\\\\]|\\\\.)*)'|\\[COMMS\\.(\\w+)\\]): \\/(.*)\\/([a-z]*),$`);
  const patterns = new Map<string, RegExp>();
  for (const row of text.slice(start, end).split('\n').slice(1)) {
    const match = line.exec(row);
    const key = match && (match[1] !== undefined ? match[1].replace(/\\'/g, "'") : named.get(match[2]!));
    if (match && key) patterns.set(key, new RegExp(match[3]!, match[4]));
  }
  return patterns;
}
const evidenceBlock = (text: string, role: string): Map<string, RegExp> => patternsOf(text, `\n  '${role}': {\n`, 4);
const sharedEvidence = (text: string): Map<string, RegExp> => patternsOf(text, 'export const EVIDENCE: Record<string, RegExp> = {', 2);

describe('the batch manifest (ADR 0075, decision 1)', () => {
  it('accepts the devops-engineer manifest against the frozen checkout', async () => {
    expect(checkManifest(manifest(), await copyCheckout())).toEqual([]);
  });

  it('refuses an unknown bundle, a role named twice, a missing canonical agent, a missing native file and an undated decision', async () => {
    const m = manifest();
    const at = await copyCheckout();
    expect(checkManifest({ ...m, roles: [{ ...m.roles[0], bundle: 'no-such-bundle' }] }, at).join('\n')).toContain('no-such-bundle');
    expect(checkManifest({ ...m, roles: [m.roles[0], m.roles[0]] }, at).join('\n')).toContain('more than once');
    expect(checkManifest({ ...m, roles: [{ ...m.roles[0], canonical: 'registry/agents/no-such-agent.md' }] }, at).join('\n')).toContain('no-such-agent.md');
    expect(checkManifest({ ...m, roles: [{ ...m.roles[0], native: 'registry/hosts/claude/agents/no-such-role.md' }] }, at).join('\n')).toContain('no-such-role.md');
    expect(checkManifest({ ...m, decisions: [{ ...m.decisions[0], date: null }] }, at).join('\n')).toContain('date');
    expect(checkManifest({ ...m, version: 2 }, at).join('\n')).toContain('version');
    // The base is a commit name, and a lead names its Bundle and a roster of kebab-case roles.
    expect(checkManifest({ ...m, base: 'not a commit' }, at).join('\n')).toContain('base');
    expect(checkManifest({ ...m, leads: [{ lead: 'orchestrator-engineering', bundle: 'no-such-bundle', roster: [] }] }, at).join('\n')).toContain('no-such-bundle');
    expect(checkManifest({ ...m, leads: [{ lead: 'orchestrator-engineering', bundle: 'software-engineering', roster: ['Not Kebab'] }] }, at).join('\n')).toContain('roster');
    expect(checkManifest({ ...m, leads: [{ lead: 'orchestrator-engineering', bundle: 'software-engineering', roster: ['devops-engineer'] }] }, at)).toEqual([]);
  });

  it('holds back only the roles an open decision names', async () => {
    const m = manifest();
    const open = { ...m, decisions: [{ ...m.decisions[0], answer: null, date: null, by: 'maintainer' }] };
    const plan = planWiring(open, await copyCheckout(), {});
    expect(plan.held).toEqual([{ role: 'devops-engineer', decision: 'devops-messaging' }]);
    expect(plan.edits).toEqual([]);
    // In a batch of two, the open decision holds back the role it names; the other is wired.
    const checkout = await copyCheckout();
    await unwire(checkout);
    const mixed = { ...open, roles: [m.roles[0], { ...m.roles[0], role: 'backend-architect', definition: 'subagent-backend-architect', bundle: 'software-engineering',
      canonical: 'registry/agents/subagent-backend-architect.md', native: 'registry/hosts/claude/agents/backend-architect.md' }] };
    const both = planWiring(mixed, checkout, {});
    expect(both.held).toEqual([{ role: 'devops-engineer', decision: 'devops-messaging' }]);
    expect(both.edits.some((edit: Json) => edit.role === 'backend-architect')).toBe(true);
    expect(both.edits.some((edit: Json) => edit.role === 'devops-engineer')).toBe(false);
  });

  it('refuses, and writes nothing, when an anchor it inserts at is missing', async () => {
    const checkout = await copyCheckout();
    await unwire(checkout);
    for (const [rel, from, to] of [
      ['tests/helpers/native-roles.ts', 'export const NATIVE_ROLES', 'export const SOME_OTHER_LIST'],
      ['tests/helpers/native-invariant-evidence.ts', 'export const ROLE_EVIDENCE', 'export const OTHER_EVIDENCE'],
      ['tests/native-install-lane.test.ts', 'const COMMITTED_NATIVE_ROLES = [', 'const OTHER_ROLES = ['],
    ]) {
      const file = path.join(checkout, rel);
      const original = read(file);
      await fs.writeFile(file, original.replace(from, to));
      const plan = planWiring(manifest(), checkout, {});
      expect(plan.refusals.join('\n'), rel).toContain(rel);
      expect(() => applyWiring(plan, checkout)).toThrow(/refus/i);
      await fs.writeFile(file, original);
    }
    // The committed-role list entry before the new one must end in a comma, or there is no safe place to insert.
    const list = path.join(checkout, 'tests/native-install-lane.test.ts');
    const listText = read(list);
    const listStart = listText.indexOf('const COMMITTED_NATIVE_ROLES = [');
    await fs.writeFile(list, listText.slice(0, listStart) + listText.slice(listStart).replace("'code-reviewer',", "'code-reviewer'"));
    const plan = planWiring(manifest(), checkout, {});
    expect(plan.refusals.join('\n')).toContain('each entry must end in a comma');
  });
});

describe('the wiring generator (ADR 0075, decisions 2 and 3)', () => {
  it('finds PR #237\'s wiring already complete in the frozen checkout: nothing to write', async () => {
    const plan = planWiring(manifest(), await copyCheckout(), {});
    expect(plan.refusals).toEqual([]);
    // The frozen tree holds no role test file, so the only edit is its stub.
    expect(plan.edits.filter((edit: Json) => edit.action !== 'unchanged').map((edit: Json) => [edit.file, edit.action]))
      .toEqual([['tests/native-claude-devops-engineer.test.ts', 'create']]);
  });

  it('restores PR #237\'s wiring of devops-engineer after it is removed from a copy', async () => {
    const checkout = await copyCheckout();
    const original = new Map(WIRED.map(rel => [rel, read(path.join(checkout, rel))]));
    await unwire(checkout);
    const plan = planWiring(manifest(), checkout, {});
    expect(plan.refusals).toEqual([]);
    applyWiring(plan, checkout);
    const now = (rel: string) => read(path.join(checkout, rel));
    // Byte for byte where the placement rule is fixed.
    for (const rel of ['tests/native-claude-agents.test.ts', 'tests/native-claude-own-session.test.ts', 'tests/native-install-lane.test.ts', 'tests/cli-e2e.test.ts']) {
      expect(now(rel), rel).toBe(original.get(rel));
      expect(now(rel), `${rel} is #237's file`).toBe(frozen(rel));
    }
    // Line for line in the roster helper (#237 placed the row by family; the generator ends its tier).
    const lines = (text: string) => text.split('\n').sort();
    expect(lines(now('tests/helpers/native-roles.ts'))).toEqual(lines(original.get('tests/helpers/native-roles.ts')!));
    // Match for match in the evidence helper: for every evidenced invariant, the role's pattern (or the shared one) matches the same text.
    const agent = read(path.join(checkout, 'registry/hosts/claude/agents/devops-engineer.md'));
    const generated = evidenceBlock(now('tests/helpers/native-invariant-evidence.ts'), 'devops-engineer');
    const coverage = fs.readJsonSync(path.join(checkout, 'tests/fixtures/pilot-devops/final/agent/devops-engineer.coverage.json')) as { invariants: Json[] };
    const frozenHelper = frozen('tests/helpers/native-invariant-evidence.ts');
    const frozenRole = evidenceBlock(frozenHelper, 'devops-engineer');
    const shared = sharedEvidence(frozenHelper);
    expect(frozenRole.size, '#237 bound eight invariants in its own block').toBe(8);
    for (const entry of coverage.invariants.filter(item => typeof item.evidence === 'string')) {
      const before = (frozenRole.get(entry.invariant) ?? shared.get(entry.invariant))!;
      const after = (generated.get(entry.invariant) ?? shared.get(entry.invariant))!;
      expect(before, entry.invariant).toBeDefined();
      expect(after, entry.invariant).toBeDefined();
      expect(after.exec(agent)?.[0], entry.invariant).toBe(before.exec(agent)?.[0]);
    }
    // The role's own test file did not exist in the copy: a stub with its exact tool set, and a case that fails until its claims are written.
    const stub = now('tests/native-claude-devops-engineer.test.ts');
    const toolsLine = /^tools: (.*)$/m.exec(agent)![1]!;
    expect(stub).toContain(`expect(toolsOf(text())).toEqual([${toolsLine.split(', ').map(tool => `'${tool}'`).join(', ')}]);`);
    expect(stub).toContain('throw new Error(');
    // Run again: nothing left to write.
    expect(planWiring(manifest(), checkout, {}).edits.filter((edit: Json) => edit.action !== 'unchanged')).toEqual([]);
  });

  it('marks a must-hold list it derived, in the row and in the plan, so a reviewer sees it was not a judgment', async () => {
    const checkout = await copyCheckout();
    await unwire(checkout);
    const m = manifest();
    delete m.roles[0].mustHold;
    const plan = planWiring(m, checkout, {});
    expect(plan.refusals).toEqual([]);
    const row = plan.edits.find((edit: Json) => edit.file === 'tests/native-claude-agents.test.ts' && edit.action === 'insert');
    expect(row).toMatchObject({ derived: ['mustHold'] });
    applyWiring(plan, checkout);
    const line = read(path.join(checkout, 'tests/native-claude-agents.test.ts')).split('\n').find(text => text.startsWith("  { name: 'devops-engineer',"))!;
    expect(line).toMatch(/\}, \/\/ mustHold derived from the tools line, not a reviewer's choice$/);
    // The derived set is #237's set (another order).
    expect(/mustHold: \[([^\]]*)\]/.exec(line)![1]!.split(', ').sort()).toEqual(manifest().roles[0].mustHold.map((tool: string) => `'${tool}'`).sort());
  });

  it('refuses an existing entry that differs, and writes nothing', async () => {
    const checkout = await copyCheckout();
    const file = path.join(checkout, 'tests/helpers/native-roles.ts');
    await fs.writeFile(file, read(file).replace("{ role: 'devops-engineer', stem: 'subagent-devops-engineer', tier: 1,", "{ role: 'devops-engineer', stem: 'subagent-devops-engineer', tier: 2,"));
    const before = new Map(WIRED.map(rel => [rel, read(path.join(checkout, rel))]));
    const plan = planWiring(manifest(), checkout, {});
    expect(plan.refusals.join('\n')).toContain('tests/helpers/native-roles.ts');
    expect(() => applyWiring(plan, checkout)).toThrow(/refus/i);
    for (const rel of WIRED) expect(read(path.join(checkout, rel)), rel).toBe(before.get(rel));
  });

  it('never plans a change to the bundles, the tool policy or src/, and writes deltas.json only when asked', async () => {
    const checkout = await copyCheckout();
    await unwire(checkout);
    const m = manifest();
    // A coverage file with a delta entry, so the plan has a deltas proposal.
    const coverageFile = path.join(checkout, m.roles[0].coverage);
    const coverage = fs.readJsonSync(coverageFile) as { invariants: Json[] };
    coverage.invariants[8] = { invariant: coverage.invariants[8]!.invariant, delta: { disposition: 'approximated', rationale: 'A test of the deltas proposal.' } };
    await fs.writeJson(coverageFile, coverage);
    const forbidden = (rel: string) => rel === 'registry/bundles.json' || rel.endsWith('tool-policy.json') || rel.startsWith('src/');
    const plan = planWiring(m, checkout, {});
    expect(plan.edits.map((edit: Json) => edit.file).filter(forbidden)).toEqual([]);
    expect(plan.edits.map((edit: Json) => edit.file)).not.toContain('registry/hosts/claude/deltas.json');
    expect(plan.proposals.join('\n')).toContain('deltas.json');
    const withDeltas = planWiring(m, checkout, { deltas: true });
    expect(withDeltas.edits.map((edit: Json) => edit.file)).toContain('registry/hosts/claude/deltas.json');
  });

  it('prints its plan as JSON from the command line and writes only with --write', async () => {
    const checkout = await copyCheckout();
    await unwire(checkout);
    const before = read(path.join(checkout, 'tests/helpers/native-roles.ts'));
    const dry = spawnSync(process.execPath, ['scripts/native-wiring.mjs', '--manifest', MANIFEST, '--checkout', checkout], { cwd: ROOT, encoding: 'utf8' });
    expect(dry.status, dry.stderr).toBe(0);
    expect(JSON.parse(dry.stdout).edits.some((edit: Json) => edit.action === 'insert')).toBe(true);
    expect(read(path.join(checkout, 'tests/helpers/native-roles.ts'))).toBe(before);
    const write = spawnSync(process.execPath, ['scripts/native-wiring.mjs', '--manifest', MANIFEST, '--checkout', checkout, '--write'], { cwd: ROOT, encoding: 'utf8' });
    expect(write.status, write.stderr).toBe(0);
    expect(read(path.join(checkout, 'tests/helpers/native-roles.ts'))).toContain("{ role: 'devops-engineer',");
  });
});

describe('the conformance runner (ADR 0075, decision 4)', () => {
  it('refuses to start while the named hold file exists, and does nothing else', async () => {
    const hold = path.join(work, 'HOLD');
    await fs.writeFile(hold, 'a full gate is running\n');
    const run = spawnSync(process.execPath, ['scripts/run-native-conformance.mjs', '--manifest', MANIFEST, '--checkout', ROOT, '--hold-file', hold, '--out', path.join(work, 'report.json')],
      { cwd: ROOT, encoding: 'utf8' });
    expect(run.status).toBe(3);
    expect(run.stderr).toContain('hold');
    expect(await fs.pathExists(path.join(work, 'report.json'))).toBe(false);
  });

  it('names the focused test files a role\'s wiring touches, never the whole suite', () => {
    const files: string[] = conformanceFiles(manifest(), ROOT);
    expect(files).toEqual(expect.arrayContaining(['tests/native-claude-agents.test.ts', 'tests/native-claude-devops-engineer.test.ts', 'tests/native-install-lane.test.ts',
      'tests/cli-e2e.test.ts', 'tests/native-claude-own-session.test.ts', 'tests/native-invariant-coverage.test.ts', 'tests/core-safety-floor.test.ts',
      'tests/claude-session-task-policy.test.ts', 'tests/factory-repository-rules.test.ts']));
    for (const file of files) expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
    expect(files.length).toBeLessThan(40);
  });
});
