import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstallEngine } from '../src/core/installer.js';
import { RegistryResolver } from '../src/core/registry.js';
import { prepareProductionEvaluator } from './helpers/factory-evaluator.js';
import { evaluationResult, prepareEvaluationJob, reviewPin } from './helpers/factory-evaluation.js';

/**
 * ADR 0071: the citations of the three pilot results that the record check refused for their line numbers (2026-11-18, the factory's first real
 * member, host-library/claude/observations/2026-11-18-claude-2.1.325-factory-pilot-devops-engineering.md), with the exact files they cite, copied
 * unchanged into tests/fixtures/pilot-citations. Written the way the new rule asks (source, path, quote; `line` only for a quote that occurs more
 * than once, taken from the evaluator's own start line), every one of them is accepted. The line ranges the evaluators gave are kept in the fixture
 * as `given`, to show that these are the refused results: some of those ranges break the earlier rule.
 */

const FIXTURES = path.resolve('tests/fixtures/pilot-citations');
interface PilotCitation { where: string; sourceId: string; inputKind: string; path: string; quote: string; given: { startLine: number; endLine: number } }
interface PilotCase { origin: string; subjectKind: string; citations: PilotCitation[] }
const CASES: Array<[string, number]> = [['j1-shared-pair', 3], ['j2-claude-agent', 2], ['r2-claude-agent', 2]];
const lf = (text: string): string => text.replace(/\r\n?/g, '\n');
const startsOf = (text: string, quote: string): number[] => {
  const found: number[] = [];
  for (let at = text.indexOf(quote); at >= 0; at = text.indexOf(quote, at + 1)) found.push(text.slice(0, at).split('\n').length);
  return found;
};

describe('the refused pilot citations, quote-located, pass the record check', () => {
  let fixture: Awaited<ReturnType<typeof prepareProductionEvaluator>>;
  beforeEach(async () => {
    fixture = await prepareProductionEvaluator(await fs.mkdtemp(path.join(os.tmpdir(), 'au-pilot-citations-')));
    await new InstallEngine(new RegistryResolver(fixture.registry)).install('agent-factory', fixture.options);
  });
  afterEach(async () => { await fs.remove(fixture.root); });
  const run = (args: string[]) => spawnSync(process.execPath, [fixture.installed('.claude/skills/evaluate-artifact/scripts/check-review.mjs'), ...args], {
    cwd: fixture.workspace, encoding: 'utf8', timeout: 20_000,
  });

  /** A review job whose candidate holds the pilot's cited candidate files and whose inputs pin the pilot's cited evidence, under the pilot's ids. */
  async function prepare(name: string) {
    const pilot = await fs.readJson(path.join(FIXTURES, name, 'citations.json')) as PilotCase;
    const selected = await prepareEvaluationJob(fixture);
    const sources = path.join(FIXTURES, name, 'sources');
    await fs.copy(path.join(sources, 'candidate'), selected.candidate);
    const files = (await fs.readdir(selected.candidate, { recursive: true }) as string[]).map(rel => rel.replace(/\\/g, '/'))
      .filter(rel => fs.statSync(path.join(selected.candidate, rel)).isFile()).sort();
    selected.inventory = await Promise.all(files.map(async rel => {
      const pin = await reviewPin(path.join(selected.candidate, rel));
      return { bytes: pin.bytes, kind: 'file', path: rel, sha256: pin.sha256 };
    }));
    selected.candidateDigest = (await import('node:crypto')).createHash('sha256').update(JSON.stringify(selected.inventory)).digest('hex');
    selected.job.candidate.files = selected.inventory.map(item => ({ ...item, role: item.path === 'SKILL.md' ? 'subject' : 'support' }));
    const inputs = path.join(fixture.root, 'pilot-inputs');
    for (const id of [...new Set(pilot.citations.map(cite => cite.sourceId))].filter(id => id !== 'candidate')) {
      const cite = pilot.citations.find(item => item.sourceId === id)!;
      const file = path.join(inputs, id, cite.path);
      await fs.copy(path.join(sources, id, cite.path), file);
      selected.job.inputs.push({ id, kind: 'observation', ...await reviewPin(file), sections: [], status: 'clear', required: true });
    }
    selected.job.roots.read.push(inputs);
    // The receipt of the fixture check names the candidate digest; it is rewritten for the new candidate as the helper does for its own kinds.
    const receipt = await fs.readJson(selected.receiptFile) as Record<string, unknown>;
    await fs.writeJson(selected.receiptFile, { ...receipt, candidateDigest: selected.candidateDigest });
    selected.job.checks[0]!.candidateDigest = selected.candidateDigest;
    selected.job.checks[0]!.receipt = await reviewPin(selected.receiptFile);
    await fs.writeJson(selected.jobFile, selected.job);
    const preflight = run(['--job', selected.jobFile]);
    expect(preflight.status, preflight.stderr).toBe(0);
    const textOf = (cite: PilotCitation): string => lf(fs.readFileSync(cite.sourceId === 'candidate' ? path.join(selected.candidate, cite.path) : path.join(inputs, cite.sourceId, cite.path), 'utf8'));
    const pinOf = (cite: PilotCitation): string => cite.sourceId === 'candidate'
      ? selected.inventory.find(item => item.path === cite.path)!.sha256 : selected.job.inputs.find(input => input.id === cite.sourceId)!.sha256;
    return { pilot, selected, preflight, textOf, pinOf };
  }

  /** The pilot's citations as findings of a result (at most eight citations each), written the way the new rule asks. */
  function resultWith(p: Awaited<ReturnType<typeof prepare>>, withLine: boolean) {
    const result = evaluationResult(p.selected, JSON.parse(p.preflight.stdout));
    result.coverage = p.selected.inventory.map(item => ({ path: item.path, status: 'reviewed', rationale: 'Pilot citation fixture.' }));
    const cites = p.pilot.citations.map(cite => {
      const repeated = startsOf(p.textOf(cite), lf(cite.quote)).length > 1;
      return { sourceId: cite.sourceId, path: cite.path, sha256: p.pinOf(cite), quote: cite.quote, ...(withLine && repeated ? { line: cite.given.startLine } : {}) };
    });
    const findings = [];
    for (let index = 0; index < cites.length; index += 8) {
      findings.push({ id: `pilot-citations-${index / 8 + 1}`, criterionId: 'clarity-maintainability', severity: 'INFO', confidence: 'high',
        citations: cites.slice(index, index + 8), rationale: 'Citations copied from a refused pilot result.', correction: 'None; a fixture.' });
    }
    (result as { findings: unknown[] }).findings = findings;
    return result;
  }

  it.each(CASES)('%s: the fixture holds the refused result: %i of its given line ranges break the earlier rule', async (name, broken) => {
    const pilot = await fs.readJson(path.join(FIXTURES, name, 'citations.json')) as PilotCase;
    const bad = pilot.citations.filter(cite => {
      const text = lf(fs.readFileSync(path.join(FIXTURES, name, 'sources', cite.sourceId, cite.path), 'utf8'));
      const inside = text.split('\n').slice(cite.given.startLine - 1, cite.given.endLine).join('\n').includes(lf(cite.quote));
      return !inside || cite.given.endLine - cite.given.startLine >= 5;
    });
    expect(bad.map(cite => cite.where)).toHaveLength(broken);
    // Every quote of the pilot stands, verbatim, in the file it cites.
    for (const cite of pilot.citations) {
      const text = lf(fs.readFileSync(path.join(FIXTURES, name, 'sources', cite.sourceId, cite.path), 'utf8'));
      expect(startsOf(text, lf(cite.quote)).length, cite.where).toBeGreaterThan(0);
    }
  });

  it.each(CASES)('%s: every citation, quote-located, is accepted, and each refused one is placed where its quote stands', async name => {
    const p = await prepare(name);
    const file = path.join(p.selected.evidence, 'result.json');
    await fs.writeJson(file, resultWith(p, true));
    const checked = run(['--job', p.selected.jobFile, '--result', file]);
    expect(checked.status, checked.stderr).toBe(0);
    const printed = (JSON.parse(checked.stdout) as { citations: Array<{ where: string; startLine: number }> }).citations;
    const placed = printed.filter(item => item.where.startsWith('finding pilot-citations-'));
    expect(placed).toHaveLength(p.pilot.citations.length);
    p.pilot.citations.forEach((cite, index) => {
      const starts = startsOf(p.textOf(cite), lf(cite.quote));
      // A unique quote is placed where it stands; a repeated one where its `line` (the evaluator's own start line) says.
      expect(placed[index]!.startLine, cite.where).toBe(starts.length === 1 ? starts[0] : cite.given.startLine);
    });
  });

  it('refuses the one repeated pilot quote when it names no line, and names the lines where it begins', async () => {
    const p = await prepare('r2-claude-agent');
    const repeated = p.pilot.citations.filter(cite => startsOf(p.textOf(cite), lf(cite.quote)).length > 1);
    expect(repeated).toHaveLength(1);
    const file = path.join(p.selected.evidence, 'result.json');
    await fs.writeJson(file, resultWith(p, false));
    const refused = run(['--job', p.selected.jobFile, '--result', file]);
    expect(refused.status).toBe(1);
    const reason = (JSON.parse(refused.stderr) as { reason: string }).reason;
    expect(reason).toMatch(/^Citation quote occurs more than once and names no line\./);
    expect(reason).toContain(`beginning on lines ${startsOf(p.textOf(repeated[0]!), lf(repeated[0]!.quote)).join(', ')}`);
  });
});
