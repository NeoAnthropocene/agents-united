import path from 'node:path';
import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import type { prepareFactoryEvaluator } from './factory-evaluator.js';

const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
type EvaluationFixture = Pick<Awaited<ReturnType<typeof prepareFactoryEvaluator>>, 'root' | 'registry' | 'source' | 'installed'>;
export async function reviewPin(file: string) {
  const bytes = await fs.readFile(file);
  return { path: path.resolve(file), bytes: bytes.length, sha256: digest(bytes) };
}

export async function evaluationTree(root: string): Promise<Record<string, string>> {
  const tree: Record<string, string> = {};
  const visit = async (directory: string, prefix = ''): Promise<void> => {
    for (const name of (await fs.readdir(directory)).sort()) {
      const rel = prefix + name, file = path.join(directory, name), stat = await fs.lstat(file);
      if (stat.isSymbolicLink()) tree[rel] = `link:${await fs.readlink(file)}`;
      else if (stat.isDirectory()) { tree[`${rel}/`] = 'directory'; await visit(file, `${rel}/`); }
      else if (stat.isFile()) tree[rel] = digest(await fs.readFile(file));
      // A named pipe, socket or device is recorded by name and never opened: reading a FIFO never returns.
      else tree[rel] = 'special';
    }
  };
  await visit(root);
  return tree;
}

/** Data-rich, offline worked case: the caller really runs its pinned tiny fixture validator. */
export async function prepareEvaluationJob(fixture: EvaluationFixture) {
  const candidate = path.join(fixture.root, 'candidate');
  const evidence = path.join(fixture.root, 'review');
  const checks = path.join(evidence, 'checks');
  await fs.ensureDir(checks);
  const text = '---\nname: sample-skill\ndescription: Inspect a selected file.\nlicense: MIT\n---\n# Sample\nRead only the supplied path.\n';
  await fs.outputFile(path.join(candidate, 'SKILL.md'), text);
  const filePin = await reviewPin(path.join(candidate, 'SKILL.md'));
  // Worked canonical inventory: fixed alphabetical keys, as specified by the protocol.
  const inventory = [{ bytes: filePin.bytes, kind: 'file', path: 'SKILL.md', sha256: filePin.sha256 }];
  const candidateDigest = digest(JSON.stringify(inventory));
  const validator = path.join(fixture.root, 'fixture-validator.mjs');
  await fs.writeFile(validator, 'import fs from "node:fs"; const text=fs.readFileSync(process.argv[2],"utf8"); if(!text.includes("name: sample-skill"))process.exit(1); console.log("selected fixture layout checked");\n');
  const runtime = await reviewPin(await fs.realpath(process.execPath));
  const command = { executable: runtime, argv: [validator, path.join(candidate, 'SKILL.md')], cwd: fixture.root };
  const run = spawnSync(command.executable.path, command.argv, { cwd: command.cwd, encoding: 'utf8', timeout: 10_000 });
  if (run.status !== 0) throw new Error(`Fixture validation failed: ${run.stderr}`);
  const rawFile = path.join(checks, 'skill-layout.raw.txt');
  await fs.writeFile(rawFile, run.stdout + run.stderr);
  const raw = await reviewPin(rawFile);
  const receiptFile = path.join(checks, 'skill-layout.receipt.json');
  await fs.writeJson(receiptFile, { version: 1, id: 'skill-layout', kind: 'deterministic', command, candidateDigest,
    status: 'passed', exit: run.status, raw });
  const root = fixture.installed('.claude/skills/evaluate-artifact');
  const binding = await fs.readJson(path.join(root, 'assets/claude-binding.json')) as {
    requiredSupport: string[]; references: Array<{ installed: string }>; roles: Array<{ installed: string }>;
  };
  const loadingFiles = [path.join(root, 'SKILL.md'), path.join(root, 'assets/claude-binding.json'),
    ...binding.requiredSupport.map(rel => path.join(root, rel)), ...binding.references.map(ref => fixture.installed(ref.installed)),
    ...binding.roles.map(role => fixture.installed(role.installed))];
  const selected: Array<[string, string, string]> = [
    ...loadingFiles.map((file, index) => [`loading-${index}`, 'loading', file] as [string, string, string]),
    ['guard', 'guard', fixture.installed('.claude/hooks/agents-united-readonly-guard.js')],
    ['skill-guide', 'guide', path.resolve('host-library/claude/guide/skill.md')],
    ['skill-page', 'snapshot', path.resolve('host-library/claude/pages/skill/skills.md')],
    ['library-lock', 'library-lock', path.resolve('host-library/claude/library.lock.json')],
    ['profile', 'profile', fixture.source('hosts/claude/profile.json')],
    ['tool-policy', 'tool-policy', fixture.source('hosts/claude/tool-policy.json')],
    ['validator', 'validator', validator],
    ['provenance', 'provenance', fixture.source('rules/skill-attribution.md')],
  ];
  const inputs = await Promise.all(selected.map(async ([id, kind, file]) => ({ id, kind, ...await reviewPin(file),
    sections: kind === 'guide' ? ['Anatomy and locations'] : [], status: 'clear', required: true })));
  const rubricFile = path.join(root, 'assets/rubric.json');
  const rubric = await fs.readJson(rubricFile) as { criteria: Array<{ id: string }> };
  const job = {
    version: 1, id: 'sample-review', operation: 'review', intent: 'local',
    authoringHost: { host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native', observedVersion: null,
      unverifiedReason: 'Offline fixture; no Claude process invoked.' },
    subject: { kind: 'skill', identity: 'sample-skill', definition: null as string | null,
      target: null as null | Record<string, string | null>, paths: ['SKILL.md'] },
    objective: 'Review the fixed sample Skill without changing it.', fixedValues: [{ name: 'skill-name', value: 'sample-skill' }],
    constraints: ['No repair, installation, publication or live invocation.'], acceptance: [{ id: 'task-fit', description: 'The Skill names its selected-path boundary.' }],
    source: { checkout: process.cwd(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), registry: fixture.registry },
    roots: { candidate, read: [fixture.registry, fixture.installed('.claude'), path.resolve('host-library/claude'), validator], review: evidence,
      managed: [fixture.installed('.claude')], protected: [] },
    candidate: { files: [{ path: 'SKILL.md', kind: 'file', bytes: filePin.bytes, sha256: filePin.sha256, role: 'subject' }] },
    inputs, runtime: { executable: runtime, checker: await reviewPin(path.join(root, 'scripts/check-review.mjs')) },
    rubric: { ...await reviewPin(rubricFile), version: 1, criteria: rubric.criteria.map(({ id }) => ({ id,
      required: !['shared-semantics', 'host-fit'].includes(id), applicable: !['shared-semantics', 'host-fit'].includes(id),
      reason: ['shared-semantics', 'host-fit'].includes(id) ? 'Portable Skill adds no subagent or native target.' : 'Required for this fixed artifact review.' })) },
    checks: [{ id: 'skill-layout', required: true, status: 'passed', command, candidateDigest, exit: 0, raw, receipt: await reviewPin(receiptFile) }],
    provenance: { disposition: 'original', author: 'Fixture author', evidence: ['provenance'], unresolved: [], notices: [] },
    budget: { maxCandidateFiles: 32, maxCandidateFileBytes: 262144, maxCandidateBytes: 1048576,
      maxEvidenceFiles: 64, maxEvidenceFileBytes: 1048576, maxEvidenceBytes: 8388608,
      maxResultBytes: 262144, maxFindings: 32, maxOpenItems: 16, maxChecks: 6, maxSeconds: 600, maxLogBytes: 524288,
      maxExecutableBytes: 134217728, externalCalls: 0, publication: false, repair: false },
  };
  const jobFile = path.join(evidence, 'job.json');
  await fs.writeJson(jobFile, job);
  return { job, jobFile, candidate, evidence, inventory, candidateDigest, rawFile, receiptFile };
}

/** Actual shared/native validator receipts, without invoking a Host or generated code. */
export async function prepareEvaluationKind(fixture: EvaluationFixture, kind: 'shared-pair' | 'claude-agent', cli = path.resolve('dist/cli.js')) {
  const selected = await prepareEvaluationJob(fixture);
  const stem = 'subagent-factory-evaluator';
  const paths = kind === 'shared-pair' ? [`core/${stem}.core.md`, `core/${stem}.contract.json`] : ['hosts/claude/agents/factory-evaluator.md'];
  await fs.remove(path.join(selected.candidate, 'SKILL.md'));
  for (const rel of paths) await fs.copy(fixture.source(rel), path.join(selected.candidate, rel));
  selected.inventory = await Promise.all([...paths].sort().map(async rel => {
    const pin = await reviewPin(path.join(selected.candidate, rel));
    return { bytes: pin.bytes, kind: 'file', path: rel, sha256: pin.sha256 };
  }));
  selected.candidateDigest = digest(JSON.stringify(selected.inventory));
  selected.job.candidate.files = selected.inventory.map(item => ({ ...item, role: 'subject' }));
  selected.job.subject = { kind, identity: kind === 'shared-pair' ? stem : 'factory-evaluator', definition: stem,
    target: kind === 'claude-agent' ? selected.job.authoringHost : null, paths };
  selected.job.rubric.criteria = selected.job.rubric.criteria.map(item => ({ ...item,
    required: item.id !== 'host-fit' || kind === 'claude-agent', applicable: item.id !== 'host-fit' || kind === 'claude-agent',
    reason: item.id === 'host-fit' && kind === 'shared-pair' ? 'Shared pair is host neutral.' : 'Required for the selected subject.' }));
  const extras: Array<[string, string, string]> = [
    ['shared-core', 'shared-core', fixture.source(`core/${stem}.core.md`)],
    ['shared-contract', 'shared-contract', fixture.source(`core/${stem}.contract.json`)],
  ];
  if (kind === 'claude-agent') for (const name of ['agent', 'hook', 'tools', 'orchestration']) {
    extras.push([`${name}-guide`, 'guide', path.resolve(`host-library/claude/guide/${name}.md`)]);
    const page = { agent: 'agent/sub-agents', hook: 'hook/hooks', tools: 'tools/tools-reference', orchestration: 'orchestration/workflows' }[name];
    extras.push([`${name}-page`, 'snapshot', path.resolve(`host-library/claude/pages/${page}.md`)]);
  }
  for (const [id, inputKind, file] of extras) selected.job.inputs.push({ id, kind: inputKind, ...await reviewPin(file), sections: [], status: 'clear', required: true });
  Object.assign(selected.job.inputs.find(input => input.kind === 'validator')!, await reviewPin(cli));
  selected.job.roots.read.push(cli);
  const id = kind === 'shared-pair' ? 'contract-check' : 'factory-check';
  const argv = [cli, id, '--registry', kind === 'shared-pair' ? selected.candidate : fixture.registry, '--definition', stem,
    ...(kind === 'claude-agent' ? ['--artifact', path.join(selected.candidate, paths[0]!), '--required-skills', '["evaluate-artifact"]'] : [])];
  const command = { executable: selected.job.runtime.executable, argv, cwd: fixture.root };
  const actual = spawnSync(command.executable.path, argv, { cwd: command.cwd, encoding: 'utf8', timeout: 10_000 });
  if (actual.status !== 0) throw new Error(`Actual ${id} failed: ${actual.stdout}${actual.stderr}`);
  selected.rawFile = path.join(selected.evidence, 'checks', `${id}.raw.txt`);
  selected.receiptFile = path.join(selected.evidence, 'checks', `${id}.receipt.json`);
  await fs.writeFile(selected.rawFile, actual.stdout + actual.stderr);
  const raw = await reviewPin(selected.rawFile);
  await fs.writeJson(selected.receiptFile, { version: 1, id, kind: 'deterministic', command, candidateDigest: selected.candidateDigest,
    status: 'passed', exit: actual.status, raw });
  selected.job.checks = [{ id, required: true, status: 'passed', command, candidateDigest: selected.candidateDigest,
    exit: 0, raw, receipt: await reviewPin(selected.receiptFile) }];
  await fs.writeJson(selected.jobFile, selected.job);
  return selected;
}

/** Synthetic opinion, explicitly distinct from an invoked evaluator. */
export function evaluationResult(selected: Awaited<ReturnType<typeof prepareEvaluationJob>>, preflight: { jobDigest: string }) {
  // A quote-located citation (ADR 0071): the checker finds the line; `line` is optional and only names one occurrence of a repeated quote.
  const citation: { sourceId: string; path: string; sha256: string; quote: string; line?: number } = { sourceId: 'candidate', path: 'SKILL.md',
    sha256: selected.inventory[0]!.sha256, quote: 'Read only the supplied path.' };
  return {
    version: 2, jobId: selected.job.id, jobDigest: preflight.jobDigest, candidateDigest: selected.candidateDigest,
    status: 'reviewed', opinion: 'no-blocking-findings', subject: selected.job.subject, inventory: selected.inventory, inventorySource: 'caller-provided',
    coverage: [{ path: 'SKILL.md', status: 'reviewed', rationale: 'Synthetic worked coverage record.' }],
    criteria: selected.job.rubric.criteria.map(item => ({ id: item.id,
      outcome: item.applicable ? 'satisfactory' : 'not-applicable', rationale: item.reason,
      citations: item.applicable ? [citation] : [] })),
    findings: [], deterministicEvidence: selected.job.checks.map(check => ({ id: check.id, status: check.status, exit: check.exit,
      rawSha256: check.raw.sha256, receiptSha256: check.receipt.sha256, observation: 'Caller-run fixture result; authenticity and production adequacy unverified.' })),
    limitations: ['Synthetic result fixture; no reviewer or Host was invoked.'], live: 'unverified', openItems: [], acceptedDraft: false,
  };
}
