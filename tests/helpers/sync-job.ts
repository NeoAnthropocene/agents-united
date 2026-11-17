/* eslint-disable @typescript-eslint/no-explicit-any */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { evaluationTree } from './factory-evaluation.js';

export type Json = Record<string, any>;
export interface Pin { path: string; bytes: number; sha256: string }

export const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
export const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Json)[key])}`).join(',')}}`
    : JSON.stringify(value);
export async function pinOf(file: string): Promise<Pin> {
  const bytes = await fs.readFile(file);
  return { path: path.resolve(file), bytes: bytes.length, sha256: digest(bytes) };
}

export const CHECKER = path.resolve('registry/skills/sync-host/scripts/check-sync.mjs');
export const treeOf = (root: string): Promise<Record<string, string>> => evaluationTree(root);

const foldName = (name: string): string => process.platform === 'win32' ? name.toLowerCase() : name;
export const folded = (file: string): string => foldName(path.resolve(file));

export interface SyncJobFixture {
  root: string;
  workspace: string;
  checkout: string;
  library: string;
  evidence: string;
  lockFile: string;
  previousLockFile: string;
  jobFile: string;
  planFile: string;
  targetFiles: string[];
  targetRecords: Json[];
  lock: Json;
  previousLock: Json;
  hashes: {
    subAgentsOld: string;
    subAgentsNew: string;
    skillsOld: string;
    skillsNew: string;
    mcpLocked: string;
    mcpCandidate: string;
    guideOld: string;
    guideNew: string;
  };
  job: Json;
  plan: Json;
  libPath(rel: string): string;
  buildPlan(jobOverride?: Json, targetsOverride?: Json[]): Json;
  saveJob(): Promise<void>;
  savePlan(): Promise<void>;
  repinLock(): Promise<void>;
  repinPreviousLock(): Promise<void>;
  repinTargets(): Promise<void>;
  check(args: string[], options?: { env?: Record<string, string>; preload?: string }): SpawnSyncReturns<string>;
  pre(): SpawnSyncReturns<string>;
  post(file?: string): SpawnSyncReturns<string>;
  cleanup(): Promise<void>;
}

const ensureDir = async (dir: string): Promise<void> => { await fs.mkdir(dir, { recursive: true }); };
const writeText = async (file: string, text: string | Buffer): Promise<void> => {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, text);
};

let templateRootPromise: Promise<{ root: string; head: string }> | undefined;
async function getTemplateGit(): Promise<{ root: string; head: string }> {
  if (!templateRootPromise) {
    templateRootPromise = (async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-sync-git-tpl-'));
      const library = path.join(root, 'host-library', 'claude');
      await ensureDir(library);
      const libPath = (rel: string): string => path.join(library, ...rel.split('/'));
      const subAgentsNewBytes = Buffer.from('# Sub-agents (v2)\n\nUpdated sub-agents snapshot with new frontmatter rules.\n', 'utf8');
      const skillsNewBytes = Buffer.from('# Skills (v2)\n\nUpdated skills snapshot.\n', 'utf8');
      const mcpBytes = Buffer.from('# MCP (v1)\n\nLocked MCP snapshot.\n', 'utf8');
      const guideNewBytes = Buffer.from('# Agent Guide (v2)\n\nUpdated guide text.\n', 'utf8');
      await writeText(libPath('pages/agent/sub-agents.md'), subAgentsNewBytes);
      await writeText(libPath('pages/skill/skills.md'), skillsNewBytes);
      await writeText(libPath('pages/mcp/mcp.md'), mcpBytes);
      await writeText(libPath('guide/agent.md'), guideNewBytes);
      const lockEntry = (rel: string, hexHash: string): Json => ({
        url: `https://code.claude.com/docs/en/${path.basename(rel)}`,
        sha256: `sha256:${hexHash}`,
        fetchedAt: '2026-11-15T09:00:00.000Z',
        via: 'http',
      });
      const lock: Json = {
        files: {
          'pages/agent/sub-agents.md': lockEntry('pages/agent/sub-agents.md', digest(subAgentsNewBytes)),
          'pages/skill/skills.md': lockEntry('pages/skill/skills.md', digest(skillsNewBytes)),
          'pages/mcp/mcp.md': lockEntry('pages/mcp/mcp.md', digest(mcpBytes)),
        },
      };
      await writeText(libPath('library.lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
      execFileSync('git', ['init', root], { stdio: 'ignore' });
      execFileSync('git', ['-C', root, 'config', 'user.email', 'fixture@example.com'], { stdio: 'ignore' });
      execFileSync('git', ['-C', root, 'config', 'user.name', 'Fixture'], { stdio: 'ignore' });
      execFileSync('git', ['-C', root, 'add', '.'], { stdio: 'ignore' });
      execFileSync('git', ['-C', root, 'commit', '-m', 'Initial fixture library'], { stdio: 'ignore' });
      const head = execFileSync('git', ['-C', root, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim();
      process.on('exit', () => { try { fs.removeSync(root); } catch { /* ignore */ } });
      return { root, head };
    })();
  }
  return templateRootPromise;
}

export async function prepareSyncJob(): Promise<SyncJobFixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'au-sync-check-'));
  const workspace = path.join(root, 'workspace');
  const checkout = path.join(root, 'checkout');
  const library = path.join(checkout, 'host-library', 'claude');
  const evidence = path.join(workspace, 'evidence');
  const targetsDir = path.join(workspace, 'targets');
  const tpl = await getTemplateGit();
  await fs.copy(tpl.root, checkout);
  await ensureDir(evidence);
  await ensureDir(targetsDir);

  const libPath = (rel: string): string => path.join(library, ...rel.split('/'));

  const subAgentsOldBytes = Buffer.from('# Sub-agents (v1)\n\nInitial sub-agents snapshot.\n', 'utf8');
  const subAgentsNewBytes = Buffer.from('# Sub-agents (v2)\n\nUpdated sub-agents snapshot with new frontmatter rules.\n', 'utf8');
  const skillsOldBytes = Buffer.from('# Skills (v1)\n\nInitial skills snapshot.\n', 'utf8');
  const skillsNewBytes = Buffer.from('# Skills (v2)\n\nUpdated skills snapshot.\n', 'utf8');
  const mcpBytes = Buffer.from('# MCP (v1)\n\nLocked MCP snapshot.\n', 'utf8');
  const guideOldBytes = Buffer.from('# Agent Guide (v1)\n\nInitial guide text.\n', 'utf8');
  const guideNewBytes = Buffer.from('# Agent Guide (v2)\n\nUpdated guide text.\n', 'utf8');

  const hashes = {
    subAgentsOld: digest(subAgentsOldBytes),
    subAgentsNew: digest(subAgentsNewBytes),
    skillsOld: digest(skillsOldBytes),
    skillsNew: digest(skillsNewBytes),
    mcpLocked: digest(mcpBytes),
    mcpCandidate: digest(Buffer.from('# MCP (candidate)\n\nQuarantined MCP snapshot.\n', 'utf8')),
    guideOld: digest(guideOldBytes),
    guideNew: digest(guideNewBytes),
  };

  const lockEntry = (rel: string, hexHash: string): Json => ({
    url: `https://code.claude.com/docs/en/${path.basename(rel)}`,
    sha256: `sha256:${hexHash}`,
    fetchedAt: '2026-11-15T09:00:00.000Z',
    via: 'http',
  });

  const previousLock: Json = {
    files: {
      'pages/agent/sub-agents.md': lockEntry('pages/agent/sub-agents.md', hashes.subAgentsOld),
      'pages/skill/skills.md': lockEntry('pages/skill/skills.md', hashes.skillsOld),
      'pages/mcp/mcp.md': lockEntry('pages/mcp/mcp.md', hashes.mcpLocked),
    },
  };
  const lock: Json = {
    files: {
      'pages/agent/sub-agents.md': lockEntry('pages/agent/sub-agents.md', hashes.subAgentsNew),
      'pages/skill/skills.md': lockEntry('pages/skill/skills.md', hashes.skillsNew),
      'pages/mcp/mcp.md': lockEntry('pages/mcp/mcp.md', hashes.mcpLocked),
    },
  };

  const lockFile = libPath('library.lock.json');
  const previousLockFile = path.join(evidence, 'previous-library.lock.json');
  await writeText(previousLockFile, `${JSON.stringify(previousLock, null, 2)}\n`);
  const head = tpl.head;

  const target1: Json = {
    id: 'realize-code-reviewer',
    source: { checkout },
    artifact: {
      type: 'agent',
      definition: 'subagent-code-reviewer',
      paths: ['.claude/agents/code-reviewer.md'],
    },
    inputs: [
      { kind: 'snapshot', path: libPath('pages/agent/sub-agents.md'), sha256: hashes.subAgentsOld },
      { kind: 'snapshot', path: libPath('pages/mcp/mcp.md'), sha256: hashes.mcpLocked },
    ],
  };
  const target2: Json = {
    id: 'realize-mcp-helper',
    source: { checkout },
    artifact: {
      type: 'agent',
      definition: 'subagent-mcp-helper',
      paths: ['.claude/agents/mcp-helper.md'],
    },
    inputs: [
      { kind: 'snapshot', path: libPath('pages/mcp/mcp.md'), sha256: hashes.mcpLocked },
    ],
  };

  const targetFile1 = path.join(targetsDir, 'target-1.job.json');
  const targetFile2 = path.join(targetsDir, 'target-2.job.json');
  const targetFiles = [targetFile1, targetFile2];
  const targetRecords = [target1, target2];
  await writeText(targetFile1, `${JSON.stringify(target1, null, 2)}\n`);
  await writeText(targetFile2, `${JSON.stringify(target2, null, 2)}\n`);

  const job: Json = {
    version: 1,
    kind: 'host-update-sync-job',
    id: 'claude-sync-2026-11',
    host: 'claude',
    source: { checkout, head },
    roots: { workspace, evidence },
    library: {
      lock: await pinOf(lockFile),
      previousLock: await pinOf(previousLockFile),
    },
    changedInputs: [
      { path: libPath('pages/agent/sub-agents.md'), oldSha256: hashes.subAgentsOld, newSha256: hashes.subAgentsNew },
      { path: libPath('pages/skill/skills.md'), oldSha256: hashes.skillsOld, newSha256: hashes.skillsNew },
      { path: libPath('guide/agent.md'), oldSha256: hashes.guideOld, newSha256: hashes.guideNew },
    ],
    heldSources: [
      {
        path: libPath('pages/mcp/mcp.md'),
        lockedSha256: hashes.mcpLocked,
        candidateSha256: hashes.mcpCandidate,
        rule: 'quarantine-hold',
        reason: 'Candidate MCP page is held pending maintainer verification.',
      },
    ],
    targets: [await pinOf(targetFile1), await pinOf(targetFile2)],
  };

  const targetFlavour = (checkout: string): 'win32' | 'posix' => {
    if (/^[A-Za-z]:[\\/]/.test(checkout) || checkout.startsWith('\\\\')) return 'win32';
    if (checkout.startsWith('/') && !checkout.startsWith('//')) return 'posix';
    throw new Error(`Invalid target checkout in fixture: ${checkout}`);
  };

  const buildPlan = (jobOverride: Json = job, targetsOverride: Json[] = targetRecords): Json => {
    const staleChangedPaths = new Set<string>();
    const jobLibrary = path.join(jobOverride.source.checkout, 'host-library', jobOverride.host);
    const libraryRel = (library: string, file: string): string => path.relative(library, path.resolve(file)).split(path.sep).join('/');
    const jobChanged = jobOverride.changedInputs.map((changed: Json) => {
      const relExact = libraryRel(jobLibrary, changed.path);
      return { changed, relExact, relLower: relExact.toLowerCase(), foldedPath: folded(changed.path) };
    });
    const jobHeld = jobOverride.heldSources.map((held: Json) => {
      const relExact = libraryRel(jobLibrary, held.path);
      return { held, relExact, relLower: relExact.toLowerCase() };
    });
    const artifacts = jobOverride.targets.map((targetPin: Json, idx: number) => {
      const target = targetsOverride[idx]!;
      const flavour = targetFlavour(target.source.checkout);
      const mod = flavour === 'win32' ? path.win32 : path.posix;
      const ignoreCase = process.platform === 'win32' || flavour === 'win32';
      const targetLibrary = mod.join(target.source.checkout, 'host-library', jobOverride.host);
      const libBase = ignoreCase ? mod.resolve(targetLibrary).toLowerCase() : mod.resolve(targetLibrary);
      const byRel = new Map<string, Json>();
      for (const inp of target.inputs) {
        const inpResolved = ignoreCase ? mod.resolve(inp.path).toLowerCase() : mod.resolve(inp.path);
        const rel = mod.relative(libBase, inpResolved);
        const inside = rel === '' || (rel !== '..' && !rel.startsWith(`..${mod.sep}`) && !mod.isAbsolute(rel));
        if (!inside) continue;
        byRel.set(rel.split(mod.sep).join('/'), inp);
      }
      const changedPins: Json[] = [];
      for (const { changed, relExact, relLower, foldedPath } of jobChanged) {
        const match = byRel.get(ignoreCase ? relLower : relExact);
        if (match && (changed.newSha256 === null || match.sha256 !== changed.newSha256)) {
          staleChangedPaths.add(foldedPath);
          changedPins.push({
            kind: match.kind,
            path: changed.path,
            pinnedSha256: match.sha256,
            oldSha256: changed.oldSha256,
            newSha256: changed.newSha256,
            pinnedAtPrevious: match.sha256 === changed.oldSha256,
          });
        }
      }
      const heldPins: Json[] = [];
      for (const { held, relExact, relLower } of jobHeld) {
        const match = byRel.get(ignoreCase ? relLower : relExact);
        if (match) {
          heldPins.push({
            path: held.path,
            pinnedSha256: match.sha256,
          });
        }
      }
      const affected = changedPins.length > 0;
      return {
        job: { path: targetPin.path, sha256: targetPin.sha256 },
        jobId: target.id,
        artifact: structuredClone(target.artifact),
        affected,
        changedPins,
        heldPins,
        reason: affected ? 'Target pins a changed library snapshot at a stale hash.' : 'All pinned inputs match current hashes.',
      };
    });
    const unpinnedChanges = jobOverride.changedInputs
      .filter((changed: Json) => !staleChangedPaths.has(folded(changed.path)))
      .map((changed: Json) => changed.path);
    const heldSources = jobOverride.heldSources.map((held: Json) => ({
      path: held.path,
      lockedSha256: held.lockedSha256,
      candidateSha256: held.candidateSha256,
      disposition: 'not advanced, no action',
    }));
    return {
      version: 1,
      kind: 'host-update-sync-plan',
      jobId: jobOverride.id,
      host: jobOverride.host,
      jobDigest: digest(canonical(jobOverride)),
      proposalOnly: true,
      implemented: false,
      heldSourcesAdvanced: false,
      quality: 'pending',
      live: 'unverified',
      artifacts,
      unpinnedChanges,
      heldSources,
    };
  };

  const jobFile = path.join(evidence, 'sync-job.json');
  const planFile = path.join(evidence, 'sync-plan.json');
  const fx: SyncJobFixture = {
    root,
    workspace,
    checkout,
    library,
    evidence,
    lockFile,
    previousLockFile,
    jobFile,
    planFile,
    targetFiles,
    targetRecords,
    lock,
    previousLock,
    hashes,
    job,
    plan: buildPlan(),
    libPath,
    buildPlan,
    saveJob: async () => { await writeText(jobFile, `${JSON.stringify(fx.job, null, 2)}\n`); },
    savePlan: async () => { await writeText(planFile, `${JSON.stringify(fx.plan, null, 2)}\n`); },
    repinLock: async () => {
      await writeText(lockFile, `${JSON.stringify(fx.lock, null, 2)}\n`);
      fx.job.library.lock = await pinOf(lockFile);
    },
    repinPreviousLock: async () => {
      await writeText(previousLockFile, `${JSON.stringify(fx.previousLock, null, 2)}\n`);
      fx.job.library.previousLock = await pinOf(previousLockFile);
    },
    repinTargets: async () => {
      for (let i = 0; i < fx.targetFiles.length; i++) {
        await writeText(fx.targetFiles[i]!, `${JSON.stringify(fx.targetRecords[i], null, 2)}\n`);
      }
      fx.job.targets = await Promise.all(fx.targetFiles.map(pinOf));
    },
    check: (args, extra = {}) => spawnSync(process.execPath, [...(extra.preload ? ['--import', extra.preload] : []), CHECKER, ...args], {
      cwd: os.tmpdir(), encoding: 'utf8', timeout: 60_000, env: { ...process.env, ...extra.env },
    }),
    pre: () => fx.check(['--job', fx.jobFile]),
    post: (file = fx.planFile) => fx.check(['--job', fx.jobFile, '--result', file]),
    cleanup: async () => { await fs.remove(root); },
  };
  await fx.saveJob();
  await fx.savePlan();
  return fx;
}

/** A Node preload that, on the first open of a path containing SEAM_WHEN, appends to SEAM_TARGET (a controlled mid-run change). */
export async function writeSeam(root: string): Promise<string> {
  void root;
  const code = [
    "import fs from 'node:fs';",
    'let done = false;',
    'const open = fs.openSync;',
    'fs.openSync = function (target, ...rest) {',
    "  if (!done && typeof target === 'string' && target.includes(process.env.SEAM_WHEN)) {",
    '    done = true;',
    "    fs.appendFileSync(process.env.SEAM_TARGET, '\\nchanged during the run\\n');",
    '  }',
    '  return open.call(this, target, ...rest);',
    '};',
    '',
  ].join('\n');
  return `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`;
}
