import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareEvaluationKind, reviewPin } from './helpers/factory-evaluation.js';
import { installPackedPackage } from './helpers/packed-package.js';

describe('evaluator from the actual offline npm package', () => {
  let root: string | undefined;
  afterEach(async () => { if (root) await fs.remove(root); });

  it('installs production closure and checks a caller-saved synthetic opinion using only installed helper code', async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'au-evaluator-pack-')));
    const npmCli = path.join(path.dirname(process.env.npm_execpath ?? ''), 'npm-cli.js');
    if (!await fs.pathExists(npmCli)) throw new Error('Use npm to supply its offline packaging CLI.');
    const packed = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', root], {
      cwd: process.cwd(), encoding: 'utf8',
    })) as Array<{ filename: string }>;
    const runtime = path.join(root, 'runtime');
    installPackedPackage({ npmCli, prefix: runtime, tarball: path.join(root, packed[0]!.filename) });
    const packageRoot = path.join(runtime, 'node_modules/agents-united');
    const registry = path.join(packageRoot, 'registry'), consumer = path.join(root, 'consumer');
    await fs.ensureDir(consumer);
    const cli = path.join(packageRoot, 'dist/cli.js');
    const installed = spawnSync(process.execPath, [cli, 'add', 'agent-factory', '-t', 'claude', '--native', '--copy', '--allow-under-construction', '-y'], {
      cwd: consumer, encoding: 'utf8', env: { ...process.env, CI: 'true' }, timeout: 30_000,
    });
    expect(installed.status, installed.stdout + installed.stderr).toBe(0);
    const skill = path.join(consumer, '.claude/skills/evaluate-artifact');
    const binding = await fs.readJson(path.join(skill, 'assets/claude-binding.json')) as {
      requiredSupport: string[]; references: Array<{ installed: string }>; roles: Array<{ installed: string }>;
    };
    for (const file of [path.join(skill, 'SKILL.md'), path.join(skill, 'assets/claude-binding.json'),
      ...binding.requiredSupport.map(rel => path.join(skill, rel)), ...binding.references.map(ref => path.join(consumer, ref.installed)),
      ...binding.roles.map(role => path.join(consumer, role.installed)), path.join(consumer, '.claude/hooks/agents-united-readonly-guard.js')]) {
      expect((await fs.stat(file)).isFile(), file).toBe(true);
    }
    expect(await fs.pathExists(path.join(skill, 'evals'))).toBe(false);
    const checker = path.join(skill, 'scripts/check-review.mjs');
    expect(await fs.readFile(checker)).toEqual(await fs.readFile(path.join(registry, 'skills/evaluate-artifact/scripts/check-review.mjs')));
    // The package registry is never replaced or overlaid. External reviewed library
    // inputs come from the explicit validation checkout, as required by the design.
    const fixture = { root, registry, source: (rel: string) => path.join(registry, ...rel.split('/')),
      installed: (rel: string) => path.join(consumer, ...rel.split('/')) };
    const selected = await prepareEvaluationKind(fixture, 'shared-pair', cli);
    const before = await Promise.all(selected.inventory.map(async item => ({ relative: item.path, ...await reviewPin(path.join(selected.candidate, item.path)) })));
    const run = (...args: string[]) => spawnSync(process.execPath, [checker, '--job', selected.jobFile, ...args], {
      cwd: consumer, encoding: 'utf8', timeout: 15_000,
    });
    const preflight = run();
    expect(preflight.status, preflight.stderr).toBe(0);
    const checked = JSON.parse(preflight.stdout);
    expect(checked).toMatchObject({ recordValid: true, ready: true, checks: [{ id: 'contract-check', status: 'passed', exit: 0 }] });
    expect(JSON.parse(await fs.readFile(selected.rawFile, 'utf8'))).toMatchObject({ valid: true, kind: 'deterministic' });
    const corePath = 'core/subagent-factory-evaluator.core.md';
    const citation = { sourceId: 'candidate', path: corePath, sha256: selected.inventory.find(item => item.path === corePath)!.sha256,
      quote: 'identity: You are an independent artifact-quality evaluator reviewing one fixed candidate against its original brief.' };
    const resultFile = path.join(selected.evidence, 'result.json');
    const opinion = { version: 2, jobId: selected.job.id, jobDigest: checked.jobDigest, candidateDigest: selected.candidateDigest,
      status: 'reviewed', opinion: 'no-blocking-findings', subject: selected.job.subject, inventory: selected.inventory, inventorySource: 'caller-provided',
      coverage: selected.inventory.map(item => ({ path: item.path, status: 'reviewed', rationale: 'Synthetic package-proof coverage; no model was invoked.' })),
      criteria: selected.job.rubric.criteria.map(item => ({ id: item.id, outcome: item.applicable ? 'satisfactory' : 'not-applicable',
        rationale: 'Synthetic record exercises the fixed criterion protocol, not an actual quality judgment.', citations: item.applicable ? [citation] : [] })),
      findings: [], deterministicEvidence: selected.job.checks.map(check => ({ id: check.id, status: check.status, exit: check.exit,
        rawSha256: check.raw.sha256, receiptSha256: check.receipt.sha256, observation: 'Caller executed the actual packaged contract-check on the fixed pair.' })),
      limitations: ['No reviewer, Host, model, provider or private session was invoked.'], live: 'unverified', openItems: [], acceptedDraft: false };
    await fs.writeJson(resultFile, opinion);
    const actual = run('--result', resultFile);
    expect(actual.status, actual.stderr).toBe(0);
    expect(JSON.parse(actual.stdout)).toMatchObject({ recordValid: true, result: await reviewPin(resultFile), candidateMatch: true,
      opinion: 'no-blocking-findings', quality: 'pending', executionProof: 'unverified', live: 'unverified', acceptedDraft: false });
    for (const item of before) expect(await reviewPin(path.join(selected.candidate, item.relative))).toMatchObject({ bytes: item.bytes, sha256: item.sha256 });
    opinion.criteria[0]!.citations[0]!.quote = 'Fabricated evidence absent from the source.';
    await fs.writeJson(resultFile, opinion);
    const refused = run('--result', resultFile);
    expect(refused.status).toBe(1);
    expect(JSON.parse(refused.stderr).reason).toMatch(/citation.*quote/i);
  }, 60_000);
});
