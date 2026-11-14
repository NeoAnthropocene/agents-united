import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { execFileSync, spawnSync } from 'node:child_process';

export const sha256 = (bytes: Buffer | string): string => crypto.createHash('sha256').update(bytes).digest('hex');
export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

/** Only offline helper processes and a disposable local Git repository. */
export async function factoryJobFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-factory-job-'));
  const workspace = path.join(root, 'work');
  const checkout = path.join(workspace, 'source');
  const registry = path.join(checkout, 'registry');
  const draft = path.join(workspace, 'draft');
  const evidence = path.join(workspace, 'evidence');
  await fs.ensureDir(registry);
  await fs.ensureDir(evidence);
  execFileSync('git', ['init', '--quiet', checkout]);
  execFileSync('git', ['-C', checkout, '-c', 'user.name=Factory test', '-c', 'user.email=factory@example.invalid', 'commit', '--allow-empty', '--quiet', '-m', 'test baseline']);
  const head = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const runtime = await fs.realpath(process.execPath);
  const input = async (kind: string, rel: string) => {
    const file = path.join(checkout, rel);
    await fs.outputFile(file, `${kind} original fixture bytes\n`);
    return { kind, path: file, sha256: sha256(await fs.readFile(file)), sections: ['fixture section'], status: 'clear' };
  };
  const inputs: Array<Awaited<ReturnType<typeof input>>> = await Promise.all([
    input('guide', 'host-library/claude/guide/agent.md'), input('snapshot', 'host-library/claude/pages/agent/sub-agents.md'),
    input('profile', 'registry/hosts/claude/profile.json'), input('tool-policy', 'registry/hosts/claude/tool-policy.json'),
    input('core', 'registry/core/subagent-example.core.md'), input('contract', 'registry/core/subagent-example.contract.json'),
    input('loading', 'registry/hosts/claude/skills/realize-artifact/SKILL.md'), input('guard', 'registry/hosts/claude/hooks/guard.js'),
    input('validator', 'dist/cli.js'),
  ]);
  inputs.push({ kind: 'runtime', path: runtime, sha256: sha256(await fs.readFile(runtime)), sections: ['Node >=24'], status: 'clear' });
  const libraryLock = path.join(checkout, 'host-library/claude/library.lock.json');
  const snapshot = inputs.find(item => item.kind === 'snapshot')!;
  await fs.outputJson(libraryLock, { files: { 'pages/agent/sub-agents.md': { sha256: `sha256:${snapshot.sha256}` } } });
  inputs.push({ kind: 'support', path: libraryLock, sha256: sha256(await fs.readFile(libraryLock)), sections: ['files'], status: 'clear' });
  const job = {
    version: 1, id: 'fixture-1', operation: 'create', intent: 'local',
    artifact: { type: 'agent', definition: 'subagent-example', paths: ['hosts/claude/agents/example.md'], loading: 'subagent', requiredSkills: [] as string[] },
    authoringHost: { host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native', observedVersion: 'unverified', reason: 'Offline test; no host invocation.' },
    targetHost: { host: 'claude', product: 'Claude Code CLI', scope: 'workspace', lane: 'native', observedVersion: 'unverified', reason: 'Offline test.', minimum: '2.1.271', reviewedAgainst: '2.1.285' },
    source: { checkout, head, registry },
    roots: { workspace, draft, evidence, managed: [path.join(workspace, '.claude')], protected: [path.join(workspace, 'private')] },
    inputs, baseline: [] as { path: string; sha256: string; bytes: number; snapshot: string }[], preserved: [] as { path: string; sha256: string }[],
    allowedChanges: { create: ['hosts/claude/agents/example.md'], update: [] as string[], delete: [] as string[] },
    constraints: { maxFiles: 4, maxFileBytes: 65536, maxTotalBytes: 131072, formats: ['.md', '.json'], fixedValues: [{ path: 'hosts/claude/agents/example.md', contains: 'Example reviewer.' }], prohibitedActions: ['publish', 'install', 'start-host', 'spend'] },
    acceptance: [{ id: 'native-validation', description: 'Validate supplied pair and actual native bytes.', requiredChecks: ['native'] }],
    checks: [{ id: 'native', required: true, executable: runtime, argv: [path.join(checkout, 'dist/cli.js'), 'factory-check', '--registry', registry, '--definition', 'subagent-example', '--host', 'claude', '--artifact', path.join(draft, 'hosts/claude/agents/example.md'), '--loading', 'subagent', '--required-skills', '[]'], cwd: checkout, timeoutSeconds: 60 }],
    budget: { maxChecks: 6, maxSeconds: 600, maxLogBytes: 65536, hostSessions: false, modelCalls: false, providerCalls: false, maxUsd: 0, maxPrompts: 0 },
  };
  const jobFile = path.join(evidence, 'job.json');
  const digest = (): string => sha256(canonical(job));
  const save = async (): Promise<void> => { await fs.writeJson(jobFile, job, { spaces: 2 }); };
  // Copy only the installed support tree; no package/checkout imports are available.
  const installed = path.join(root, 'installed');
  if (await fs.pathExists(path.resolve('registry/skills/realize-artifact'))) await fs.copy(path.resolve('registry/skills/realize-artifact'), installed);
  const run = (name: 'check-job' | 'check-handback', args: string[] = []) => {
    const result = spawnSync(process.execPath, [path.join(installed, 'scripts', `${name}.mjs`), '--job', jobFile, ...args], { cwd: root, encoding: 'utf8' });
    let report: { ok: boolean; digest?: string; findings: string[]; quality?: string; live?: string } | undefined;
    try { report = JSON.parse(result.stdout) as typeof report; } catch { /* Missing installed helper is the first red. */ }
    return { exit: result.status, raw: `${result.stdout}${result.stderr}`, report };
  };
  await save();
  return { root, workspace, checkout, registry, draft, evidence, installed, job, jobFile, digest, save, run };
}

export type FactoryJobFixture = Awaited<ReturnType<typeof factoryJobFixture>>;
