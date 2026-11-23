/**
 * Plan 033 P20: `agents bundle-check`, the read-only deterministic check of one drafted Bundle proposal folder against one registry folder.
 *
 * The proposal (the four files the `author-bundle` Skill returns: `bundles.json`, `leader-responsibility.md`, `bindings.json`,
 * `report.json`) is data: nothing in it is imported, required, spawned or evaluated, and nothing is written anywhere. The registry folder
 * is only read: its `bundles.json`, and the existence and kind of the files the proposal names. The checks reuse the real manifest rules
 * (`collectBundleManifestIssues`, the rules `RegistryResolver.loadBundles` applies) on the registry manifest merged with the proposal.
 *
 * Passing means the deterministic checks passed on unchanged bytes. It does not mean useful, installable, provisioned, licensed or
 * live: `quality` stays pending and `live`, `delivery`, `provisioning` and `licensing` stay unverified. No terminal I/O here;
 * `src/cli.ts` prints the result and sets the exit code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { listNativeWorkflows } from './native-package.js';
import { collectBundleManifestIssues, nativeLeadState, nativeWorkflowLead } from './registry.js';
import {
  MAX_DIRECTORIES, MAX_ECHO_CHARS, MAX_ENTRIES, MAX_FINDINGS, MAX_OUTPUT_BYTES, byPath, canonical, errorCode, errorText, hasTraversalAlias,
  linkedAncestorOf, sha256, shortened, unsafeEntryName, validUtf8, withoutTrailingSeparators,
} from './skill-check.js';
import type {
  BundleCheckCheckId, BundleCheckCode, BundleCheckFinding, BundleCheckGate, BundleCheckInput, BundleCheckOperation, BundleCheckResult,
  BundleCheckStatus, BundleCheckUnresolved, BundlesManifest, SkillCheckInventoryItem,
} from './types.js';

export const BUNDLE_CHECK_OPERATIONS: readonly BundleCheckOperation[] = ['create', 'update', 'reuse'];
/** The four files `author-bundle` returns, at the top level of the proposal folder. */
export const PROPOSAL_FILES = ['bundles.json', 'leader-responsibility.md', 'bindings.json', 'report.json'] as const;
/** `registry/skills/author-bundle/references/bundle-shape.md`: every proposed Bundle declares these three Skills exactly once. */
export const SHARED_SKILLS = ['host-agent-router', 'handoff', 'git-guardrails'] as const;
/** `registry/skills/author-bundle/assets/report.json`: the nine sections of the handback report. */
export const REPORT_KEYS = ['job', 'files', 'template', 'bindings', 'checks', 'provenance', 'quality', 'openItems', 'upstream'] as const;
/** Every key a `BundleDefinition` of `src/core/types.ts` can carry; another key in a proposal is an invented field. */
export const KNOWN_BUNDLE_KEYS: readonly string[] = [
  'name', 'version', 'description', 'category', 'domain', 'tier', 'status', 'parentBundle', 'recommendedAddons', 'aliases', 'orchestrator',
  'agents', 'workflows', 'skills', 'prerequisites', 'modes', 'planningLoop', 'personaAliases', 'nativeRoles', 'hostAvailability', 'rules',
];
const BUNDLE_STATUSES: readonly string[] = ['stable', 'experimental', 'under-construction', 'needs-audit', 'deprecated'];
const MODE_KEYS: readonly string[] = ['operational', 'limited-operational', 'brainstorming'];

const CHECK_IDS: readonly BundleCheckCheckId[] = ['inventory', 'shape', 'registry-rules', 'references', 'bundle-rules', 'consistency'];
/**
 * `references/job.md`: at most four authored files, 256 KiB each and 1 MiB total; 32 preserved files and 2 MiB. Four files of at most
 * 256 KiB cannot exceed 1 MiB, so only the per-file bound is checked.
 */
const MAX_AUTHORED_FILE_BYTES = 256 * 1024;
const MAX_PRESERVED_FILES = 32;
const MAX_PRESERVED_BYTES = 2 * 1024 * 1024;
/** The real registry manifest is about 64 KB; a bigger file is not read. */
const MAX_REGISTRY_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_PLACEHOLDER_FINDINGS = 32;
/** Codes that make a result unavailable (exit 2) rather than a deterministic failure (exit 1). */
const UNAVAILABLE_CODES: ReadonlySet<BundleCheckCode> = new Set<BundleCheckCode>([
  'USAGE', 'INPUT_UNAVAILABLE', 'CANDIDATE_DRIFT', 'REGISTRY_DRIFT', 'OUTPUT_LIMIT',
]);

export function bundleCheckExitCode(result: BundleCheckResult): 0 | 1 | 2 {
  return result.status === 'passed' ? 0 : result.status === 'failed' ? 1 : 2;
}

const finding = (code: BundleCheckCode, filePath: string | null, message: string): BundleCheckFinding => ({ code, path: filePath, message });
const gate = (id: BundleCheckCheckId, status: BundleCheckGate['status'], reason: string | null, findings: BundleCheckFinding[] = []): BundleCheckGate =>
  ({ id, status, reason, findings });
const digestOf = (inventory: SkillCheckInventoryItem[]): string => sha256(canonical(inventory));
const cut = (text: string, length = 300): string => (text.length > length ? `${text.slice(0, length)}...` : text);

type Json = unknown;
type Plain = Record<string, unknown>;
const isPlain = (value: unknown): value is Plain => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isNonEmptyString);
const has = (record: Plain, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);

// ---------------------------------------------------------------------------------------------
// Result assembly
// ---------------------------------------------------------------------------------------------

interface Draft {
  operation: string | null;
  allowUnresolved: boolean;
  artifact: string | null;
  registry: string | null;
  bundleNames: string[];
  inventory: SkillCheckInventoryItem[];
  inventoryComplete: boolean;
  candidateDigest: string | null;
  registryDigest: string | null;
  preserved: string[];
  replaces: string[];
  unresolved: BundleCheckUnresolved[];
  checks: BundleCheckGate[];
  /** Findings that belong to the run rather than to one check (usage, inputs, drift). */
  before: BundleCheckFinding[];
  after: BundleCheckFinding[];
}

function idleChecks(status: 'not-run' | 'unavailable', reason: string): BundleCheckGate[] {
  return CHECK_IDS.map(id => gate(id, status, reason));
}

function draftOf(partial: Partial<Draft>): Draft {
  return {
    operation: null, allowUnresolved: false, artifact: null, registry: null, bundleNames: [], inventory: [], inventoryComplete: false,
    candidateDigest: null, registryDigest: null, preserved: [], replaces: [], unresolved: [],
    checks: idleChecks('not-run', 'no check ran'), before: [], after: [], ...partial,
  };
}

function finish(draft: Draft): BundleCheckResult {
  const gateFindings = draft.checks.flatMap(check => check.findings);
  /** The order findings are shown in. */
  const all = [...draft.before, ...gateFindings, ...draft.after];
  /** The order findings are kept in when some must be cut: the reasons of the run itself before any check's own findings. */
  const priority = [...draft.before, ...draft.after, ...gateFindings];
  const unavailable = all.some(item => UNAVAILABLE_CODES.has(item.code)) || draft.checks.some(check => check.status === 'unavailable');
  const failed = all.length > 0 || draft.checks.some(check => check.status === 'failed');
  let status: BundleCheckStatus = unavailable ? 'unavailable' : failed ? 'failed' : draft.checks.every(check => check.status === 'passed') ? 'passed' : 'unavailable';

  const assemble = (keep: number, complete: boolean): BundleCheckResult => {
    const kept = new Set(priority.slice(0, keep));
    const shown = all.filter(item => kept.has(item));
    const limit = complete ? [] : [finding('OUTPUT_LIMIT', null, `The result has more findings or bytes than the ${MAX_FINDINGS}-finding / ${MAX_OUTPUT_BYTES / 1024} KiB bound; ${all.length - shown.length} of ${all.length} findings are not shown.`)];
    const checks = draft.checks.map(check => {
      const own = check.findings.filter(item => kept.has(item));
      const trimmed = own.length !== check.findings.length;
      return { ...check, findings: own, reason: trimmed ? (check.reason ?? 'Some findings of this check are not shown (OUTPUT_LIMIT).') : check.reason };
    });
    return {
      version: 1,
      kind: 'deterministic',
      status: complete ? status : 'unavailable',
      operation: draft.operation,
      allowUnresolved: draft.allowUnresolved,
      artifact: draft.artifact,
      registry: draft.registry,
      bundleNames: draft.bundleNames,
      candidateDigest: draft.inventoryComplete ? draft.candidateDigest : null,
      registryDigest: draft.inventoryComplete ? draft.registryDigest : null,
      inventoryComplete: draft.inventoryComplete,
      findingsComplete: complete,
      inventory: draft.inventory,
      preserved: draft.preserved,
      replaces: draft.replaces,
      unresolved: draft.unresolved,
      checks,
      findings: [...shown, ...limit],
      quality: 'pending',
      live: 'unverified',
      delivery: 'unverified',
      provisioning: 'unverified',
      licensing: 'unverified',
      acceptedDraft: false,
    };
  };
  const size = (result: BundleCheckResult): number => Buffer.byteLength(JSON.stringify(result, null, 2));

  if (all.length <= MAX_FINDINGS) {
    const whole = assemble(all.length, true);
    if (size(whole) <= MAX_OUTPUT_BYTES) return whole;
  }
  let keep = Math.min(all.length, MAX_FINDINGS - 1);
  status = 'unavailable';
  let trimmed = assemble(keep, false);
  while (keep > 0 && size(trimmed) > MAX_OUTPUT_BYTES) {
    keep = Math.floor(keep / 2);
    trimmed = assemble(keep, false);
  }
  if (size(trimmed) <= MAX_OUTPUT_BYTES) return trimmed;

  // Not even zero findings fit (a path from the command line is enormous, or the inventory or the lists are): the last resort is a
  // small unavailable result that says so. No digest, no inventory, no list and no check result is vouched for.
  return {
    version: 1,
    kind: 'deterministic',
    status: 'unavailable',
    operation: shortened(draft.operation),
    allowUnresolved: draft.allowUnresolved,
    artifact: shortened(draft.artifact),
    registry: shortened(draft.registry),
    bundleNames: [],
    candidateDigest: null,
    registryDigest: null,
    inventoryComplete: false,
    findingsComplete: false,
    inventory: [],
    preserved: [],
    replaces: [],
    unresolved: [],
    checks: draft.checks.map(check => gate(check.id, 'unavailable', 'The result is larger than the output bound, so no detail of this check is shown (OUTPUT_LIMIT).')),
    findings: [finding('OUTPUT_LIMIT', null, `The result is larger than the ${MAX_OUTPUT_BYTES / 1024} KiB bound even without findings; echoed paths are shortened to ${MAX_ECHO_CHARS} characters and no inventory, digest, list or check detail is shown.`)],
    quality: 'pending',
    live: 'unverified',
    delivery: 'unverified',
    provisioning: 'unverified',
    licensing: 'unverified',
    acceptedDraft: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Public API: usage, the check, internal errors
// ---------------------------------------------------------------------------------------------

/** A usage result (exit 2) for an invocation problem the caller found before any input was read, e.g. an unknown option. */
export function bundleCheckUsageResult(problems: string[], input: BundleCheckInput = {}): BundleCheckResult {
  return finish(draftOf({
    operation: typeof input.operation === 'string' ? input.operation : null,
    allowUnresolved: input.allowUnresolved === true,
    artifact: typeof input.artifact === 'string' ? input.artifact : null,
    registry: typeof input.registry === 'string' ? input.registry : null,
    checks: idleChecks('not-run', 'The invocation was not valid, so no check ran.'),
    before: problems.map(message => finding('USAGE', null, message)),
  }));
}

export function checkBundle(input: BundleCheckInput): BundleCheckResult {
  // Only these four fields and the seam are read; any other key of the input object is ignored.
  const supplied = input ?? {};
  const artifact = typeof supplied.artifact === 'string' && supplied.artifact !== '' ? supplied.artifact : undefined;
  const registryPath = typeof supplied.registry === 'string' && supplied.registry !== '' ? supplied.registry : undefined;
  // An empty --operation is a value the caller wrote, so it is refused below rather than read as the default.
  const operationText = typeof supplied.operation === 'string' ? supplied.operation : undefined;

  const usage: string[] = [];
  if (artifact === undefined) usage.push('--artifact <absolute-proposal-folder> is required.');
  else if (!path.isAbsolute(artifact)) usage.push('--artifact must be an absolute path.');
  if (registryPath === undefined) usage.push('--registry <absolute-registry-folder> is required.');
  else if (!path.isAbsolute(registryPath)) usage.push('--registry must be an absolute path.');
  // The traversal-alias rule of the registry checker scripts: a `.` or `..` segment makes the folder the argument names depend on how
  // the caller resolves it, so such an argument never reaches the disk.
  if (artifact !== undefined && path.isAbsolute(artifact) && hasTraversalAlias(artifact)) usage.push('--artifact must be an absolute path without . or .. segments.');
  if (registryPath !== undefined && path.isAbsolute(registryPath) && hasTraversalAlias(registryPath)) usage.push('--registry must be an absolute path without . or .. segments.');
  if (operationText !== undefined && !(BUNDLE_CHECK_OPERATIONS as readonly string[]).includes(operationText)) {
    usage.push(`--operation must be one of ${BUNDLE_CHECK_OPERATIONS.join(', ')}; got ${JSON.stringify(cut(operationText, 80))}.`);
  }
  if (supplied.allowUnresolved !== undefined && typeof supplied.allowUnresolved !== 'boolean') usage.push('--allow-unresolved is a flag and takes no value.');
  const echo = {
    operation: operationText ?? (usage.length > 0 ? null : 'create'),
    allowUnresolved: supplied.allowUnresolved === true,
    artifact: artifact ?? null,
    registry: registryPath ?? null,
  };
  if (usage.length > 0) return finish(draftOf({ ...echo, checks: idleChecks('not-run', 'The invocation was not valid, so no check ran.'), before: usage.map(message => finding('USAGE', null, message)) }));

  const operation = (operationText ?? 'create') as BundleCheckOperation;
  return runChecks(artifact!, registryPath!, operation, supplied.allowUnresolved === true, echo, supplied.seam);
}

// ---------------------------------------------------------------------------------------------
// Inputs: the bounded proposal inventory and the registry manifest
// ---------------------------------------------------------------------------------------------

interface Proposed {
  /** The parsed `bundles.json`, `bindings.json` and `report.json`, and the text of `leader-responsibility.md`. */
  bundles: Json;
  bindings: Json;
  report: Json;
  leader: string;
}
interface Inventoried { items: SkillCheckInventoryItem[]; preserved: string[]; proposed: Proposed }
type InventoryOutcome =
  | { kind: 'ok'; inventory: Inventoried }
  | { kind: 'unavailable'; finding: BundleCheckFinding }
  | { kind: 'rejected'; findings: BundleCheckFinding[] };

export type BoundedRead =
  | { kind: 'ok'; bytes: Buffer }
  | { kind: 'too-large' }
  | { kind: 'not-a-file' }
  | { kind: 'error'; code: string };

/**
 * Reads one file the way `readCorpus` in skill-check.ts reads the corpus, so what an earlier `lstat` saw cannot be swapped for something
 * else: opened with O_NOFOLLOW and O_NONBLOCK where the platform has them (a link, or a pipe that would block, is not followed or waited
 * for), `fstat` must say regular file, and at most `limit` bytes are read (one more is a refusal, never an unbounded read). Where
 * O_NOFOLLOW does not exist (Windows) a file that is not the one `expected` (the lstat taken earlier: same device and inode) is refused too.
 */
export function readBounded(file: string, limit: number, expected?: fs.Stats): BoundedRead {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    const opened = fs.fstatSync(fd);
    if (!opened.isFile()) return { kind: 'not-a-file' };
    if (expected !== undefined && expected.ino !== 0 && opened.ino !== 0 && (expected.ino !== opened.ino || expected.dev !== opened.dev)) return { kind: 'not-a-file' };
    const chunks: Buffer[] = [];
    let length = 0;
    for (;;) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, limit + 1 - length));
      const read = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (read === 0) break;
      length += read;
      if (length > limit) return { kind: 'too-large' };
      chunks.push(chunk.subarray(0, read));
    }
    return { kind: 'ok', bytes: Buffer.concat(chunks, length) };
  } catch (error) {
    return { kind: 'error', code: errorCode(error) };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

const isAuthored = (relative: string): boolean => (PROPOSAL_FILES as readonly string[]).includes(relative);

/**
 * Walks the proposal with lstat only (nothing is read or followed until the whole tree passed the link, case, special-file, name and
 * size checks), then reads every file once. A create folder holds exactly the four files; update and reuse allow other files, which
 * are inventoried and hashed as preservation-only and never decoded or parsed. Never truncates to meet a bound.
 */
function takeInventory(given: string, operation: BundleCheckOperation): InventoryOutcome {
  // The folder is inspected under its own name, before the ancestor walk or any lstat (see withoutTrailingSeparators).
  const root = withoutTrailingSeparators(given);
  const linkedAncestor = linkedAncestorOf(root);
  if (linkedAncestor !== null) {
    return { kind: 'rejected', findings: [finding('PATH_UNSAFE', null, `The proposal folder is reached through a link or junction (${linkedAncestor}); pass the real path of the proposal folder.`)] };
  }
  let rootStat: fs.Stats;
  try {
    rootStat = fs.lstatSync(root);
  } catch (error) {
    return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The proposal folder cannot be read (${errorCode(error)}): ${root}`) };
  }
  if (rootStat.isSymbolicLink()) return { kind: 'rejected', findings: [finding('PATH_UNSAFE', null, `The proposal folder is a link, not a folder: ${root}`)] };
  if (!rootStat.isDirectory()) return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The proposal path is not a folder: ${root}`) };

  // A proposal folder holds at least one of the four files. Any other folder (the parent of the proposal, a wrong path) is not a
  // proposal at all, so it is unavailable input rather than a proposal that fails, and it is not walked.
  let topNames: string[];
  try {
    topNames = fs.readdirSync(root).sort();
  } catch (error) {
    return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The proposal folder cannot be listed (${errorCode(error)}): ${root}`) };
  }
  if (!topNames.some(isAuthored)) {
    return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The proposal folder holds none of the four files (${PROPOSAL_FILES.join(', ')}), so it is not a proposal folder (is this the proposal's own folder and not its parent?): ${root}`) };
  }

  const problems: BundleCheckFinding[] = [];
  const files: Array<{ rel: string; abs: string; size: number; stat: fs.Stats }> = [];
  const topKinds = new Map<string, 'file' | 'other'>();
  let directories = 1;
  let entries = 0;
  let preservedFiles = 0;
  let preservedBytes = 0;
  let overDirectories = false, overPreservedFiles = false, overPreservedBytes = false, overEntries = false;
  const stack: Array<{ abs: string; rel: string; names: string[] }> = [{ abs: root, rel: '', names: topNames }];
  while (stack.length > 0 && !overEntries) {
    const { abs, rel, names: knownNames } = stack.pop()!;
    let names = knownNames;
    if (rel !== '') {
      try {
        names = fs.readdirSync(abs).sort();
      } catch (error) {
        return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', rel.replace(/\/$/, ''), `A proposal folder cannot be listed (${errorCode(error)}): ${abs}`) };
      }
    }
    const seen = new Map<string, string>();
    for (const name of names) {
      entries += 1;
      if (entries > MAX_ENTRIES) {
        overEntries = true;
        problems.push(finding('INPUT_LIMIT', null, `The proposal folder has more than ${MAX_ENTRIES} entries; the walk stopped.`));
        break;
      }
      const relPath = `${rel}${name}`;
      const topLevel = rel === '';
      const key = name.normalize('NFC').toLowerCase();
      const clash = seen.get(key);
      if (clash !== undefined) problems.push(finding('PATH_UNSAFE', relPath, `${relPath} and ${rel}${clash} differ only by letter case.`));
      else seen.set(key, name);
      // The entry-name rule of the registry checker scripts: such an entry is never inspected beyond its name.
      const unsafeName = unsafeEntryName(name);
      if (unsafeName !== null) {
        problems.push(finding('PATH_UNSAFE', relPath, `${relPath} ${unsafeName}; the checker scripts of evaluate-artifact and coordinate-artifact refuse such a name, and so does this inventory.`));
        continue;
      }
      const full = path.join(abs, name);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(full);
      } catch (error) {
        return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', relPath, `A proposal entry cannot be inspected (${errorCode(error)}): ${relPath}`) };
      }
      if (stat.isSymbolicLink()) {
        problems.push(finding('PATH_UNSAFE', relPath, `${relPath} is a link (symbolic link or junction); links are never followed.`));
        if (topLevel && isAuthored(name)) topKinds.set(name, 'other');
      } else if (stat.isDirectory()) {
        if (topLevel && isAuthored(name)) {
          topKinds.set(name, 'other');
          problems.push(finding('INVENTORY', relPath, `${relPath} is a folder; it must be a regular file.`));
        } else if (operation === 'create') {
          problems.push(finding('INVENTORY', relPath, `${relPath} is a folder; a create proposal holds exactly the four files (${PROPOSAL_FILES.join(', ')}), so no other entry is allowed.`));
        } else {
          directories += 1;
          if (directories > MAX_DIRECTORIES) {
            if (!overDirectories) problems.push(finding('INPUT_LIMIT', relPath, `The proposal folder has more than ${MAX_DIRECTORIES} folders including its root.`));
            overDirectories = true;
          } else {
            stack.push({ abs: full, rel: `${relPath}/`, names: [] });
          }
        }
      } else if (stat.isFile()) {
        const authored = topLevel && isAuthored(name);
        if (authored) {
          topKinds.set(name, 'file');
          if (stat.size > MAX_AUTHORED_FILE_BYTES) problems.push(finding('INPUT_LIMIT', relPath, `${relPath} is ${stat.size} bytes (limit ${MAX_AUTHORED_FILE_BYTES} per authored file).`));
        } else if (operation === 'create') {
          problems.push(finding('INVENTORY', relPath, `${relPath} is not one of the four files (${PROPOSAL_FILES.join(', ')}); a create proposal holds exactly those and no other entry.`));
        } else {
          preservedFiles += 1;
          preservedBytes += stat.size;
          if (preservedFiles > MAX_PRESERVED_FILES && !overPreservedFiles) {
            overPreservedFiles = true;
            problems.push(finding('INPUT_LIMIT', null, `The proposal folder has more than ${MAX_PRESERVED_FILES} preservation-only files.`));
          }
          if (preservedBytes > MAX_PRESERVED_BYTES && !overPreservedBytes) {
            overPreservedBytes = true;
            problems.push(finding('INPUT_LIMIT', null, `The preservation-only files are larger than ${MAX_PRESERVED_BYTES} bytes in total.`));
          }
        }
        files.push({ rel: relPath, abs: full, size: stat.size, stat });
      } else if (topLevel && isAuthored(name)) {
        topKinds.set(name, 'other');
        problems.push(finding('PATH_UNSAFE', relPath, `${relPath} is neither a regular file nor a folder.`));
      } else {
        problems.push(finding('PATH_UNSAFE', relPath, `${relPath} is neither a regular file nor a folder.`));
      }
    }
  }
  for (const name of PROPOSAL_FILES) {
    if (!topKinds.has(name)) problems.push(finding('INVENTORY', name, `${name} is missing from the proposal folder; the four files are required at its top level.`));
  }
  if (problems.length > 0) return { kind: 'rejected', findings: problems };

  const items: SkillCheckInventoryItem[] = [];
  const bytes = new Map<string, Buffer>();
  const bad: BundleCheckFinding[] = [];
  for (const file of files) {
    // Bounded by what the walk allows (an authored file, or the preservation-only total), never by the file's current size.
    const read = readBounded(file.abs, isAuthored(file.rel) ? MAX_AUTHORED_FILE_BYTES : MAX_PRESERVED_BYTES, file.stat);
    if (read.kind === 'error') return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', file.rel, `A proposal file cannot be read (${read.code}): ${file.rel}`) };
    if (read.kind !== 'ok') return { kind: 'unavailable', finding: finding('CANDIDATE_DRIFT', file.rel, `${file.rel} changed while the inventory was taken (it grew past its limit or is no longer the regular file that was inspected).`) };
    const content = read.bytes;
    if (content.length !== file.size) return { kind: 'unavailable', finding: finding('CANDIDATE_DRIFT', file.rel, `${file.rel} changed while the inventory was taken.`) };
    items.push({ path: file.rel, kind: 'file', bytes: content.length, sha256: sha256(content) });
    bytes.set(file.rel, content);
  }
  const parsed: Record<string, Json> = {};
  for (const name of PROPOSAL_FILES) {
    const content = bytes.get(name)!;
    // The fatal-TextDecoder rule of the registry checker scripts; preservation-only files are never decoded.
    if (!validUtf8(content)) {
      bad.push(finding('ENCODING', name, `${name} is not valid UTF-8, so its bytes are not text a check can read.`));
      continue;
    }
    if (name.endsWith('.json')) {
      try {
        parsed[name] = JSON.parse(content.toString('utf8'));
      } catch (error) {
        bad.push(finding('JSON_INVALID', name, `${name} is not valid JSON: ${cut(errorText(error), 200)}`));
      }
    }
  }
  if (bad.length > 0) return { kind: 'rejected', findings: bad };
  items.sort(byPath);
  const preserved = items.map(item => item.path).filter(item => !isAuthored(item));
  return {
    kind: 'ok',
    inventory: {
      items,
      preserved,
      proposed: { bundles: parsed['bundles.json'], bindings: parsed['bindings.json'], report: parsed['report.json'], leader: bytes.get('leader-responsibility.md')!.toString('utf8') },
    },
  };
}

interface RegistryRead { root: string; manifestSha: string; manifest: BundlesManifest }
type RegistryOutcome =
  | { kind: 'ok'; registry: RegistryRead }
  | { kind: 'unavailable'; finding: BundleCheckFinding }
  | { kind: 'rejected'; findings: BundleCheckFinding[] };

/**
 * Reads the registry's own `bundles.json` and checks it on its own with the real manifest rules. A registry that cannot be read, is not
 * a bundles manifest or does not pass the rules by itself makes the result unavailable: nothing can then be said about the proposal.
 */
function readRegistry(given: string): RegistryOutcome {
  const root = withoutTrailingSeparators(given);
  const linkedAncestor = linkedAncestorOf(root);
  if (linkedAncestor !== null) {
    return { kind: 'rejected', findings: [finding('PATH_UNSAFE', null, `The registry folder is reached through a link or junction (${linkedAncestor}); pass the real path of the registry folder.`)] };
  }
  let rootStat: fs.Stats;
  try {
    rootStat = fs.lstatSync(root);
  } catch (error) {
    return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The registry folder cannot be read (${errorCode(error)}): ${root}`) };
  }
  if (rootStat.isSymbolicLink()) return { kind: 'rejected', findings: [finding('PATH_UNSAFE', null, `The registry folder is a link, not a folder: ${root}`)] };
  if (!rootStat.isDirectory()) return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The registry path is not a folder: ${root}`) };

  const manifestPath = path.join(root, 'bundles.json');
  const unavailable = (message: string): RegistryOutcome => ({ kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, message) });
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(manifestPath);
  } catch (error) {
    return unavailable(`The registry's bundles.json cannot be read (${errorCode(error)}): ${manifestPath}`);
  }
  if (stat.isSymbolicLink()) return { kind: 'rejected', findings: [finding('PATH_UNSAFE', null, `The registry's bundles.json is a link, not a regular file: ${manifestPath}`)] };
  if (!stat.isFile()) return unavailable(`The registry's bundles.json is not a regular file: ${manifestPath}`);
  if (stat.size > MAX_REGISTRY_MANIFEST_BYTES) return unavailable(`The registry's bundles.json is larger than ${MAX_REGISTRY_MANIFEST_BYTES} bytes, so it is not read: ${manifestPath}`);
  const read = readBounded(manifestPath, MAX_REGISTRY_MANIFEST_BYTES, stat);
  if (read.kind === 'error') return unavailable(`The registry's bundles.json cannot be read (${read.code}): ${manifestPath}`);
  if (read.kind === 'too-large') return unavailable(`The registry's bundles.json is larger than ${MAX_REGISTRY_MANIFEST_BYTES} bytes, so it is not read: ${manifestPath}`);
  if (read.kind === 'not-a-file') return unavailable(`The registry's bundles.json changed while it was read (it is no longer the regular file that was inspected): ${manifestPath}`);
  const bytes = read.bytes;
  if (!validUtf8(bytes)) return unavailable(`The registry's bundles.json is not valid UTF-8: ${manifestPath}`);
  let manifest: unknown;
  try {
    manifest = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    return unavailable(`The registry's bundles.json is not valid JSON (${cut(errorText(error), 200)}): ${manifestPath}`);
  }
  if (!isPlain(manifest) || !isPlain(manifest.bundles) || !Object.values(manifest.bundles).every(isPlain)) {
    return unavailable(`The registry's bundles.json is not a bundles manifest (an object with a "bundles" object of bundle objects): ${manifestPath}`);
  }
  let issues: string[];
  try {
    issues = collectBundleManifestIssues(manifest as unknown as BundlesManifest, root);
  } catch (error) {
    return unavailable(`The registry's own manifest cannot be evaluated against the manifest rules (${cut(errorText(error), 200)}), so nothing can be said about the proposal.`);
  }
  if (issues.length > 0) {
    return unavailable(`The registry's own bundles.json does not pass the manifest rules, so nothing can be said about the proposal. First problem: ${issues[0]}`);
  }
  return { kind: 'ok', registry: { root, manifestSha: sha256(bytes), manifest: manifest as unknown as BundlesManifest } };
}

// ---------------------------------------------------------------------------------------------
// The shape check
// ---------------------------------------------------------------------------------------------

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** A string that is, as a whole, an unreplaced template placeholder such as `<bundle-name>`. */
const PLACEHOLDER = /^\s*<[^<>]*>\s*$/;
const PREREQUISITE_KEYS: readonly string[] = ['requiredMcps', 'requiredPackages', 'requiredEnvVars'];
const MCP_KEYS: readonly string[] = ['name', 'purpose', 'optional', 'optionalForBrainstorming'];
const PLANNING_LOOP_KEYS: readonly string[] = ['enabled', 'mode', 'budget', 'sidekicks'];
const BUDGET_KEYS: readonly string[] = ['maxPlanningRounds', 'maxPeerExchangesPerPair', 'summaryWordCap', 'maxIterations'];
const REQUIRED_STRINGS: readonly string[] = ['name', 'version', 'description', 'category', 'domain'];
const REQUIRED_LISTS: readonly string[] = ['agents', 'skills', 'workflows'];
const OPTIONAL_LISTS: readonly string[] = ['recommendedAddons', 'aliases'];

/** A name that is used as one file or folder name under a registry folder, never as a path. */
function isSafeSegment(name: string): boolean {
  return name !== '' && !/[\\/]/.test(name) && name !== '.' && name !== '..' && !path.isAbsolute(name) && unsafeEntryName(name) === null;
}

/**
 * The problems of one `BundleDefinition` against the type in `src/core/types.ts`. With `requireProposalFields` the fields an
 * `author-bundle` proposal must carry explicitly (name, version, description, category, domain, tier, status, the three lists and the
 * three prerequisite lists) are required; without it only the types of the fields that are present are checked, which is the rule the
 * real registry's bundles are held to in the tests. `nativeRoles` and `hostAvailability` are left to the manifest rules, whose messages
 * they are.
 */
export function bundleDefinitionProblems(key: string, bundle: unknown, requireProposalFields: boolean): string[] {
  const label = `bundles.${key}`;
  if (!isPlain(bundle)) return [`${label} must be an object.`];
  const problems: string[] = [];
  const need = (field: string): boolean => {
    if (has(bundle, field)) return true;
    if (requireProposalFields) problems.push(`${label}.${field} is required.`);
    return false;
  };
  for (const name of Object.keys(bundle)) {
    if (!KNOWN_BUNDLE_KEYS.includes(name)) problems.push(`${label} has unknown key ${JSON.stringify(name)}; a proposal uses only the BundleDefinition fields.`);
  }
  for (const field of REQUIRED_STRINGS) {
    if (need(field) && !isNonEmptyString(bundle[field])) problems.push(`${label}.${field} must be a non-empty string.`);
  }
  if (has(bundle, 'name') && isNonEmptyString(bundle.name) && bundle.name !== key) problems.push(`${label}.name ${JSON.stringify(bundle.name)} must equal the key ${JSON.stringify(key)}.`);
  if (need('tier') && bundle.tier !== 'domain' && bundle.tier !== 'organization') problems.push(`${label}.tier must be "domain" or "organization".`);
  if (need('status') && !(typeof bundle.status === 'string' && BUNDLE_STATUSES.includes(bundle.status))) problems.push(`${label}.status must be one of ${BUNDLE_STATUSES.join(', ')}.`);
  for (const field of REQUIRED_LISTS) {
    if (need(field) && !isStringList(bundle[field])) problems.push(`${label}.${field} must be a list of non-empty strings.`);
  }
  for (const field of OPTIONAL_LISTS) {
    if (has(bundle, field) && !isStringList(bundle[field])) problems.push(`${label}.${field} must be a list of non-empty strings.`);
  }
  for (const field of ['orchestrator', 'parentBundle']) {
    if (has(bundle, field) && !isNonEmptyString(bundle[field])) problems.push(`${label}.${field} must be a non-empty string.`);
  }
  if (has(bundle, 'rules')) {
    if (!isStringList(bundle.rules)) problems.push(`${label}.rules must be a list of non-empty strings.`);
    else for (const rule of bundle.rules) if (!isSafeSegment(rule)) problems.push(`${label}.rules entry ${JSON.stringify(rule)} must be a single file name of registry/rules/.`);
  }
  if (has(bundle, 'modes')) {
    const modes = bundle.modes;
    if (!isPlain(modes)) problems.push(`${label}.modes must be an object.`);
    else {
      for (const [mode, text] of Object.entries(modes)) {
        if (!MODE_KEYS.includes(mode)) problems.push(`${label}.modes has unknown key ${JSON.stringify(mode)}.`);
        else if (typeof text !== 'string') problems.push(`${label}.modes.${mode} must be a string.`);
      }
    }
  }
  if (has(bundle, 'personaAliases')) {
    const aliases = bundle.personaAliases;
    if (!isPlain(aliases)) problems.push(`${label}.personaAliases must be an object.`);
    else for (const [alias, role] of Object.entries(aliases)) if (typeof role !== 'string') problems.push(`${label}.personaAliases.${alias} must be a string.`);
  }
  if (has(bundle, 'planningLoop')) {
    const loop = bundle.planningLoop;
    if (!isPlain(loop)) problems.push(`${label}.planningLoop must be an object.`);
    else {
      for (const name of Object.keys(loop)) if (!PLANNING_LOOP_KEYS.includes(name)) problems.push(`${label}.planningLoop has unknown key ${JSON.stringify(name)}.`);
      if (typeof loop.enabled !== 'boolean') problems.push(`${label}.planningLoop.enabled must be a boolean.`);
      if (has(loop, 'mode') && typeof loop.mode !== 'string') problems.push(`${label}.planningLoop.mode must be a string.`);
      if (has(loop, 'budget')) {
        const budget = loop.budget;
        if (!isPlain(budget)) problems.push(`${label}.planningLoop.budget must be an object.`);
        else {
          for (const [name, value] of Object.entries(budget)) {
            if (!BUDGET_KEYS.includes(name)) problems.push(`${label}.planningLoop.budget has unknown key ${JSON.stringify(name)}.`);
            // With planning enabled, maxIterations is judged by the manifest rule that owns its message (a positive integer); that rule
            // returns early when planning is not enabled, so it is judged here then.
            else if (name !== 'maxIterations' && !(typeof value === 'number' && Number.isFinite(value))) problems.push(`${label}.planningLoop.budget.${name} must be a number.`);
          }
          const cap = (budget as Plain).maxIterations;
          if (loop.enabled !== true && !(typeof cap === 'number' && Number.isInteger(cap) && cap >= 1)) problems.push(`${label}.planningLoop.budget.maxIterations must be a positive integer (the manifest rule that judges it applies only when planning is enabled).`);
        }
      }
      if (has(loop, 'sidekicks')) {
        const sidekicks = loop.sidekicks;
        if (!isPlain(sidekicks)) problems.push(`${label}.planningLoop.sidekicks must be an object.`);
        else {
          for (const [name, value] of Object.entries(sidekicks)) {
            if (name !== 'max') problems.push(`${label}.planningLoop.sidekicks has unknown key ${JSON.stringify(name)}.`);
            else if (!(typeof value === 'number' && Number.isFinite(value))) problems.push(`${label}.planningLoop.sidekicks.max must be a number.`);
          }
        }
      }
    }
  }
  if (has(bundle, 'prerequisites') || requireProposalFields) {
    const prerequisites = bundle.prerequisites;
    if (!has(bundle, 'prerequisites')) problems.push(`${label}.prerequisites is required; record explicitly empty lists when there are none.`);
    else if (!isPlain(prerequisites)) problems.push(`${label}.prerequisites must be an object.`);
    else {
      for (const name of Object.keys(prerequisites)) if (!PREREQUISITE_KEYS.includes(name)) problems.push(`${label}.prerequisites has unknown key ${JSON.stringify(name)}; no optional package or variable objects are invented.`);
      for (const name of PREREQUISITE_KEYS) {
        if (!has(prerequisites, name)) {
          if (requireProposalFields) problems.push(`${label}.prerequisites.${name} is required (an explicit empty list when there is none).`);
          continue;
        }
        const list = prerequisites[name];
        if (name === 'requiredMcps') {
          if (!Array.isArray(list)) { problems.push(`${label}.prerequisites.requiredMcps must be a list of objects.`); continue; }
          list.forEach((entry: unknown, index: number) => {
            const where = `${label}.prerequisites.requiredMcps[${index}]`;
            if (!isPlain(entry)) { problems.push(`${where} must be an object.`); return; }
            for (const field of Object.keys(entry)) if (!MCP_KEYS.includes(field)) problems.push(`${where} has unknown key ${JSON.stringify(field)}.`);
            if (!isNonEmptyString(entry.name)) problems.push(`${where}.name must be a non-empty string.`);
            if (has(entry, 'purpose') && typeof entry.purpose !== 'string') problems.push(`${where}.purpose must be a string.`);
            for (const flag of ['optional', 'optionalForBrainstorming']) if (has(entry, flag) && typeof entry[flag] !== 'boolean') problems.push(`${where}.${flag} must be a boolean.`);
          });
        } else if (!isStringList(list)) {
          problems.push(`${label}.prerequisites.${name} must be a list of non-empty strings.`);
        }
      }
    }
  }
  return problems;
}

/** Every string value or object key of a document that is a whole `<...>` placeholder, in document order, with where it stands. */
function placeholdersIn(root: unknown): Array<{ where: string; text: string }> {
  const found: Array<{ where: string; text: string }> = [];
  const stack: Array<{ value: unknown; where: string }> = [{ value: root, where: '$' }];
  while (stack.length > 0) {
    const { value, where } = stack.pop()!;
    if (typeof value === 'string') {
      if (PLACEHOLDER.test(value)) found.push({ where, text: value });
    } else if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) stack.push({ value: value[index], where: `${where}[${index}]` });
    } else if (isPlain(value)) {
      const entries = Object.entries(value);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [name, child] = entries[index]!;
        stack.push({ value: child, where: `${where}.${name}` });
        if (PLACEHOLDER.test(name)) found.push({ where: `${where} (key)`, text: name });
      }
    }
  }
  return found;
}

function placeholderFindings(file: string, document: unknown): BundleCheckFinding[] {
  const found = placeholdersIn(document);
  const listed = found.slice(0, MAX_PLACEHOLDER_FINDINGS).map(item => finding('SHAPE', file, `${file} holds the unreplaced template placeholder ${JSON.stringify(item.text.trim())} at ${item.where}.`));
  if (found.length > listed.length) listed.push(finding('SHAPE', file, `${found.length - listed.length} more placeholder(s) in ${file} are not listed.`));
  return listed;
}

interface ShapedBundle { key: string; bundle: Plain }

function shapeGate(proposed: Proposed): { gate: BundleCheckGate; bundles: ShapedBundle[] } {
  const findings: BundleCheckFinding[] = [];
  const add = (file: string, messages: string[]): void => { for (const message of messages) findings.push(finding('SHAPE', file, message)); };
  const doc = proposed.bundles;
  const shaped: ShapedBundle[] = [];
  if (!isPlain(doc)) {
    add('bundles.json', ['bundles.json must be a JSON object (a bundles manifest with "version" and "bundles").']);
  } else {
    for (const name of Object.keys(doc)) if (name !== '$schema' && name !== 'version' && name !== 'bundles') add('bundles.json', [`bundles.json has unknown top-level key ${JSON.stringify(name)}.`]);
    if (has(doc, '$schema') && typeof doc.$schema !== 'string') add('bundles.json', ['bundles.json $schema must be a string.']);
    if (doc.version !== 1) add('bundles.json', ['bundles.json version must be 1.']);
    if (!isPlain(doc.bundles) || Object.keys(doc.bundles).length === 0) {
      add('bundles.json', ['bundles.json bundles must be a non-empty object keyed by bundle name.']);
    } else {
      for (const [key, bundle] of Object.entries(doc.bundles)) {
        if (!SLUG.test(key)) add('bundles.json', [`bundles.json bundle key ${JSON.stringify(key)} must be lower-case words joined by hyphens (letters and digits).`]);
        const problems = bundleDefinitionProblems(key, bundle, true);
        add('bundles.json', problems);
        if (problems.length === 0 && SLUG.test(key)) shaped.push({ key, bundle: bundle as Plain });
      }
    }
    findings.push(...placeholderFindings('bundles.json', doc));
  }
  if (!isPlain(proposed.bindings)) add('bindings.json', ['bindings.json must be a JSON object (a proposal record).']);
  else {
    if (Object.keys(proposed.bindings).length === 0) add('bindings.json', ['bindings.json must not be empty; it records the proposal\'s source, location, loading, ownership and evidence edges.']);
    findings.push(...placeholderFindings('bindings.json', proposed.bindings));
  }
  if (!isPlain(proposed.report)) add('report.json', ['report.json must be a JSON object carrying the nine report sections.']);
  else {
    for (const name of REPORT_KEYS) if (!has(proposed.report, name)) add('report.json', [`report.json lacks the section ${JSON.stringify(name)} of the report guide (${REPORT_KEYS.join(', ')}).`]);
  }
  return { gate: findings.length === 0 ? gate('shape', 'passed', null) : gate('shape', 'failed', null, findings), bundles: findings.length === 0 ? shaped : [] };
}

// ---------------------------------------------------------------------------------------------
// The registry-rules check: the merge, conflicts and the manifest rules of the registry
// ---------------------------------------------------------------------------------------------

const aliasesOf = (bundle: Plain): string[] => (Array.isArray(bundle.aliases) ? bundle.aliases.filter((alias): alias is string => typeof alias === 'string') : []);

interface RegistryRulesOutcome { gate: BundleCheckGate; replaces: string[]; merged: Record<string, Plain> }

/**
 * The registry's `bundles.json` merged with the proposal: a proposed bundle replaces a registry bundle of the same name (update and
 * reuse) or is added; a create proposal may not reuse a name. Names and aliases must stay unambiguous in every operation. The real
 * manifest rules then run on the merged manifest, so every problem they find is attributed to the proposal (the registry passed them
 * on its own).
 */
function registryRulesGate(context: Context, proposedBundles: ShapedBundle[]): RegistryRulesOutcome {
  const existing = context.registry.manifest.bundles as unknown as Record<string, Plain>;
  const proposedByKey = new Map(proposedBundles.map(item => [item.key, item.bundle]));
  const merged: Record<string, Plain> = { ...existing };
  for (const [key, bundle] of proposedByKey) merged[key] = bundle;
  const replaces: string[] = [];
  const conflicts: BundleCheckFinding[] = [];
  const conflict = (message: string): void => { conflicts.push(finding('BUNDLE_CONFLICT', 'bundles.json', message)); };
  const seenPairs = new Set<string>();

  for (const [key, bundle] of proposedByKey) {
    if (has(existing, key)) {
      if (context.operation === 'create') conflict(`Bundle ${JSON.stringify(key)} is already a bundle of the registry; a create proposal needs a new name (use --operation update to replace it).`);
      else replaces.push(key);
    }
    for (const [otherKey, other] of Object.entries(merged)) {
      if (otherKey === key) continue;
      const proposedOther = proposedByKey.has(otherKey);
      const owner = proposedOther ? 'proposed' : 'registry';
      if (!proposedOther && aliasesOf(other).includes(key)) conflict(`Bundle ${JSON.stringify(key)} is an alias of the registry bundle ${JSON.stringify(otherKey)}.`);
      for (const alias of aliasesOf(bundle)) {
        const pair = [key, otherKey].sort().join('\u0000') + `\u0000${alias}`;
        if (proposedOther && seenPairs.has(pair)) continue;
        if (alias === otherKey) conflict(`Alias ${JSON.stringify(alias)} of bundle ${JSON.stringify(key)} is the name of the ${owner} bundle ${JSON.stringify(otherKey)}.`);
        else if (aliasesOf(other).includes(alias)) conflict(`Alias ${JSON.stringify(alias)} of bundle ${JSON.stringify(key)} is already an alias of the ${owner} bundle ${JSON.stringify(otherKey)}.`);
        else continue;
        if (proposedOther) seenPairs.add(pair);
      }
    }
  }
  replaces.sort();

  if (conflicts.length > 0) {
    return { gate: gate('registry-rules', 'failed', 'The manifest rules were not run because the proposal conflicts with the registry (BUNDLE_CONFLICT), so there is no single merged manifest to check.', conflicts), replaces, merged };
  }
  const manifest = { ...(context.registry.manifest as unknown as Plain), bundles: merged } as unknown as BundlesManifest;
  let issues: string[];
  try {
    issues = collectBundleManifestIssues(manifest, context.registry.root, { allowUnresolvedLeads: context.allowUnresolved });
  } catch (error) {
    issues = [`The manifest rules could not be evaluated on the merged manifest: ${cut(errorText(error), 300)}`];
  }
  const findings = issues.map(message => finding('REGISTRY_RULE', 'bundles.json', message));
  return { gate: findings.length === 0 ? gate('registry-rules', 'passed', null) : gate('registry-rules', 'failed', null, findings), replaces, merged };
}

// ---------------------------------------------------------------------------------------------
// The references check: what the proposal names must exist in the registry
// ---------------------------------------------------------------------------------------------

/**
 * Looks up registry entries without ever following a link. Each name is matched exactly against the folder's listing (so a name that
 * differs only by letter case does not resolve on a case-insensitive file system either) and every step is an lstat. Everything it saw
 * is recorded, so the readback can look the same entries up again and compare.
 */
export class RegistryProbe {
  readonly record = new Map<string, string>();
  private readonly listings = new Map<string, string[] | null>();

  constructor(readonly root: string) {}

  private list(directory: string): string[] | null {
    if (!this.listings.has(directory)) {
      try {
        this.listings.set(directory, fs.readdirSync(directory));
      } catch {
        this.listings.set(directory, null);
      }
    }
    return this.listings.get(directory)!;
  }

  /** `file` for a regular file; otherwise `missing`, `link` (a link on the way or at the end), `folder`, `not-a-folder` or `other`. */
  state(segments: readonly string[]): string {
    const key = segments.join('/');
    const known = this.record.get(key);
    if (known !== undefined) return known;
    let result = 'missing';
    let current = this.root;
    for (let index = 0; index < segments.length; index += 1) {
      const names = this.list(current);
      if (names === null || !names.includes(segments[index]!)) break;
      const next = path.join(current, segments[index]!);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(next);
      } catch {
        break;
      }
      if (stat.isSymbolicLink()) { result = 'link'; break; }
      if (index === segments.length - 1) {
        result = stat.isFile() ? 'file' : stat.isDirectory() ? 'folder' : 'other';
        break;
      }
      if (!stat.isDirectory()) { result = 'not-a-folder'; break; }
      current = next;
    }
    this.record.set(key, result);
    return result;
  }

  /** Whether `rules/<rule>` exists, the way the manifest rules ask (`fs.existsSync`). */
  ruleState(rule: string): string {
    const key = `rule:${rule}`;
    const known = this.record.get(key);
    if (known !== undefined) return known;
    const result = fs.existsSync(path.join(this.root, 'rules', rule)) ? 'exists' : 'absent';
    this.record.set(key, result);
    return result;
  }

  /** The names of the native Claude workflows the manifest rules list (`hosts/claude/workflows/`), recorded. */
  nativeWorkflowNames(): Set<string> {
    const key = 'native:workflows';
    let known = this.record.get(key);
    if (known === undefined) {
      known = JSON.stringify(listNativeWorkflows(this.root, 'claude'));
      this.record.set(key, known);
    }
    return new Set(JSON.parse(known) as string[]);
  }

  /** What the native role file of a lead says about the `Workflow` tool (the manifest rules read it), recorded. */
  nativeLeadState(role: string): string {
    const key = `native:lead:${role}`;
    const known = this.record.get(key);
    if (known !== undefined) return known;
    const result = nativeLeadState(this.root, role);
    this.record.set(key, result);
    return result;
  }

  /** The canonical text of everything looked up so far. */
  snapshot(): string {
    return canonical([...this.record.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }

  /** Looks every recorded entry up again, on a fresh probe, and returns that probe's snapshot. */
  replay(): string {
    const again = new RegistryProbe(this.root);
    for (const key of this.record.keys()) {
      if (key.startsWith('rule:')) again.ruleState(key.slice('rule:'.length));
      else if (key === 'native:workflows') again.nativeWorkflowNames();
      else if (key.startsWith('native:lead:')) again.nativeLeadState(key.slice('native:lead:'.length));
      else again.state(key.split('/'));
    }
    return again.snapshot();
  }
}

type FileKind = 'orchestrator' | 'agent' | 'skill' | 'workflow' | 'rule';
const SEGMENTS: Record<FileKind, (name: string) => string[]> = {
  orchestrator: name => ['agents', name],
  agent: name => ['agents', name],
  skill: name => ['skills', name, 'SKILL.md'],
  workflow: name => ['workflows', name],
  rule: name => ['rules', name],
};

interface ReferencesOutcome { gate: BundleCheckGate; unresolved: BundleCheckUnresolved[] }

/**
 * The agents (the orchestrator and `agents[]`), the Skills (`skills[]`), the workflows (`workflows[]`) and the rules (`rules[]`) are regular
 * files of the registry under the same names the installer copies them from: `agents/<name>`, `skills/<id>/SKILL.md`,
 * `workflows/<name>`, `rules/<name>`. The parent Bundle and the recommended addons (but not a `domain:` department) are keys or aliases
 * of the merged manifest, as the loader looks them up. A rule the loader's own manifest rule also misses is reported by both checks. A name is looked up only when it
 * is a single safe name; a link anywhere on the way does not resolve. Whatever does not resolve is always listed; it fails the check
 * unless `--allow-unresolved` was given.
 */
function referencesGate(context: Context, proposedBundles: ShapedBundle[], mergedNames: ReadonlySet<string>, probe: RegistryProbe): ReferencesOutcome {
  const findings: BundleCheckFinding[] = [];
  const unresolved: BundleCheckUnresolved[] = [];
  const seen = new Set<string>();
  const unresolvedFindings: BundleCheckFinding[] = [];

  for (const { key, bundle } of proposedBundles) {
    const refs: Array<{ kind: BundleCheckUnresolved['kind']; name: string }> = [];
    if (typeof bundle.orchestrator === 'string') refs.push({ kind: 'orchestrator', name: bundle.orchestrator });
    for (const name of (bundle.agents as string[] | undefined) ?? []) refs.push({ kind: 'agent', name });
    for (const name of (bundle.skills as string[] | undefined) ?? []) refs.push({ kind: 'skill', name });
    for (const name of (bundle.workflows as string[] | undefined) ?? []) refs.push({ kind: 'workflow', name });
    for (const name of (bundle.rules as string[] | undefined) ?? []) refs.push({ kind: 'rule', name });
    if (typeof bundle.parentBundle === 'string') refs.push({ kind: 'parentBundle', name: bundle.parentBundle });
    for (const name of (bundle.recommendedAddons as string[] | undefined) ?? []) if (!name.startsWith('domain:')) refs.push({ kind: 'recommendedAddon', name });

    for (const ref of refs) {
      const id = `${key}\u0000${ref.kind}\u0000${ref.name}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (ref.kind === 'parentBundle' || ref.kind === 'recommendedAddon') {
        if (mergedNames.has(ref.name)) continue;
        unresolved.push({ bundle: key, kind: ref.kind, name: ref.name });
        unresolvedFindings.push(finding('REGISTRY_REF', 'bundles.json', `${ref.kind} ${JSON.stringify(ref.name)} of bundle ${JSON.stringify(key)} is neither a key nor an alias of a bundle of the merged manifest (the registry's bundles and this proposal's).`));
        continue;
      }
      if (!isSafeSegment(ref.name)) {
        findings.push(finding('SHAPE', 'bundles.json', `${ref.kind} ${JSON.stringify(ref.name)} of bundle ${JSON.stringify(key)} is not a single safe file or folder name (no separator, no . or .., not absolute), so it is not looked up in the registry.`));
        continue;
      }
      const segments = SEGMENTS[ref.kind as FileKind](ref.name);
      const state = probe.state(segments);
      if (state === 'file') continue;
      unresolved.push({ bundle: key, kind: ref.kind, name: ref.name });
      const where = segments.join('/');
      const why = state === 'link' ? 'is reached through a link, which does not resolve' : state === 'missing' ? 'is not in the registry' : 'is not a regular file';
      unresolvedFindings.push(finding('REGISTRY_REF', 'bundles.json', `${ref.kind} ${JSON.stringify(ref.name)} of bundle ${JSON.stringify(key)} ${why} (expected a regular file at ${where}).`));
    }
  }

  if (!context.allowUnresolved) findings.push(...unresolvedFindings);
  const reason = context.allowUnresolved && unresolved.length > 0 && findings.length === 0 ? 'unresolved references allowed by --allow-unresolved' : null;
  return { gate: findings.length === 0 ? gate('references', 'passed', reason) : gate('references', 'failed', null, findings), unresolved };
}

// ---------------------------------------------------------------------------------------------
// The bundle-rules check
// ---------------------------------------------------------------------------------------------

export interface BundleRule {
  id: string;
  applies(bundle: Plain): boolean;
  problems(key: string, bundle: Plain): string[];
}

const planningPosture = (bundle: Plain): string | null => {
  const loop = bundle.planningLoop;
  if (!isPlain(loop) || loop.enabled !== true) return null;
  return typeof loop.mode === 'string' ? loop.mode : 'subagent-first';
};

/**
 * The rules of `author-bundle` (`references/bundle-shape.md`) a proposed Bundle is held to. Each one holds for every end-user bundle of
 * the real registry (contributor bundles and `full` excepted; tests/bundle-check.test.ts proves it), so none rejects what the
 * registry itself ships. One rule that was considered, "an Organization names an orchestrator", is not here because the real
 * `agency-3d-production` bundle has no orchestrator.
 */
export const BUNDLE_RULES: readonly BundleRule[] = [
  {
    id: 'shared-skills-once',
    applies: () => true,
    problems: (key, bundle) => {
      const skills = Array.isArray(bundle.skills) ? bundle.skills : [];
      return SHARED_SKILLS.flatMap(skill => {
        const count = skills.filter(id => id === skill).length;
        return count === 1 ? [] : [`Bundle ${JSON.stringify(key)} must declare the shared Skill ${JSON.stringify(skill)} exactly once in skills; it declares it ${count} times.`];
      });
    },
  },
  {
    id: 'domain-is-not-organization',
    applies: bundle => bundle.tier === 'domain',
    problems: (key, bundle) => (typeof bundle.domain === 'string' && bundle.domain.toLowerCase() === 'organization'
      ? [`Bundle ${JSON.stringify(key)} has tier "domain", so its domain must not be "organization" (that is the Organization tier's domain).`] : []),
  },
  {
    id: 'domain-planning-posture',
    applies: bundle => bundle.tier === 'domain',
    problems: (key, bundle) => (planningPosture(bundle) === 'subagent-first'
      ? [`Bundle ${JSON.stringify(key)} has tier "domain" but enables a planningLoop with the subagent-first posture; a Domain leader follows the planner-orchestrator posture.`] : []),
  },
  {
    id: 'organization-domain',
    applies: bundle => bundle.tier === 'organization',
    problems: (key, bundle) => (typeof bundle.domain === 'string' && bundle.domain.toLowerCase() === 'organization'
      ? [] : [`Bundle ${JSON.stringify(key)} has tier "organization", so its domain must be "organization".`]),
  },
];

/**
 * The contents of the code spans of one line: a run of N backticks opens a span that the next run of exactly N backticks closes
 * (CommonMark); a run that never closes is literal text. A span that is wholly `<...>` is an unreplaced template placeholder.
 */
function codeSpans(line: string): string[] {
  const runs = [...line.matchAll(/`+/g)].map(match => ({ start: match.index!, length: match[0].length }));
  const spans: string[] = [];
  for (let open = 0; open < runs.length; open += 1) {
    const close = runs.findIndex((run, index) => index > open && run.length === runs[open]!.length);
    if (close === -1) continue;
    spans.push(line.slice(runs[open]!.start + runs[open]!.length, runs[close]!.start));
    open = close;
  }
  return spans;
}

/** The leader responsibility is checked only for being present text and for holding no unreplaced template placeholder. */
export function leaderResponsibilityProblems(text: string): string[] {
  if (text.trim() === '') return ['leader-responsibility.md is empty; it must record the leader responsibility (or its explicit absence).'];
  const found: string[] = [];
  for (const line of text.split(/\r?\n/)) for (const span of codeSpans(line)) if (PLACEHOLDER.test(span)) found.push(span.trim());
  const listed = found.slice(0, MAX_PLACEHOLDER_FINDINGS).map(item => `leader-responsibility.md holds the unreplaced template placeholder \`${item}\`.`);
  if (found.length > listed.length) listed.push(`${found.length - listed.length} more placeholder(s) in leader-responsibility.md are not listed.`);
  return listed;
}

function bundleRulesGate(proposedBundles: ShapedBundle[], leader: string): BundleCheckGate {
  const findings: BundleCheckFinding[] = [];
  for (const { key, bundle } of proposedBundles) {
    for (const rule of BUNDLE_RULES) {
      if (rule.applies(bundle)) for (const message of rule.problems(key, bundle)) findings.push(finding('BUNDLE_RULE', 'bundles.json', message));
    }
  }
  for (const message of leaderResponsibilityProblems(leader)) findings.push(finding('BUNDLE_RULE', 'leader-responsibility.md', message));
  return findings.length === 0 ? gate('bundle-rules', 'passed', null) : gate('bundle-rules', 'failed', null, findings);
}

// ---------------------------------------------------------------------------------------------
// The consistency check
// ---------------------------------------------------------------------------------------------

/** Every string key and string value of a document, at any depth (iterative, so a deeply nested document cannot overflow the stack). */
function stringsOf(root: unknown): string[] {
  const found: string[] = [];
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (typeof value === 'string') found.push(value);
    else if (Array.isArray(value)) for (const child of value) stack.push(child);
    else if (isPlain(value)) for (const [name, child] of Object.entries(value)) { found.push(name); stack.push(child); }
  }
  return found;
}

/** An identifier character: a name is not mentioned by a longer word that merely contains it. */
const IDENTIFIER_CHAR = /[A-Za-z0-9_-]/;

/** Whether `text` holds `needle` as a whole token: not directly preceded or followed by a character of `[A-Za-z0-9_-]`. */
function mentions(text: string, needle: string): boolean {
  let from = text.indexOf(needle);
  while (from !== -1) {
    const before = from === 0 ? '' : text[from - 1]!;
    const after = text[from + needle.length] ?? '';
    if (!(before !== '' && IDENTIFIER_CHAR.test(before)) && !(after !== '' && IDENTIFIER_CHAR.test(after))) return true;
    from = text.indexOf(needle, from + 1);
  }
  return false;
}

/**
 * `bindings.json` has no schema (it is a proposal record, not an installer configuration), so it is checked only for naming what the
 * manifest declares: each proposed bundle, its orchestrator, each agent and each required MCP occurs in at least one string key or
 * string value of the document as a whole token (not inside a longer identifier), letter case significant.
 */
function consistencyGate(proposedBundles: ShapedBundle[], bindings: unknown): BundleCheckGate {
  const strings = stringsOf(bindings);
  const findings: BundleCheckFinding[] = [];
  const seen = new Set<string>();
  const need = (key: string, label: string, needle: string): void => {
    const id = `${key}\u0000${label}\u0000${needle}`;
    if (seen.has(id)) return;
    seen.add(id);
    if (!strings.some(text => mentions(text, needle))) findings.push(finding('CONSISTENCY', 'bindings.json', `bindings.json does not mention the ${label} ${JSON.stringify(needle)} of bundle ${JSON.stringify(key)}.`));
  };
  for (const { key, bundle } of proposedBundles) {
    need(key, 'bundle name', key);
    if (typeof bundle.orchestrator === 'string') need(key, 'orchestrator', bundle.orchestrator);
    for (const agent of (bundle.agents as string[] | undefined) ?? []) need(key, 'agent', agent);
    const prerequisites = bundle.prerequisites;
    const mcps = isPlain(prerequisites) && Array.isArray(prerequisites.requiredMcps) ? prerequisites.requiredMcps : [];
    for (const mcp of mcps) if (isPlain(mcp) && typeof mcp.name === 'string') need(key, 'required MCP', mcp.name);
  }
  return findings.length === 0 ? gate('consistency', 'passed', null) : gate('consistency', 'failed', null, findings);
}

// ---------------------------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------------------------

/** The names the proposal's bundles.json declares, whatever the shape check says about them. */
function proposedNames(proposed: Proposed): string[] {
  return isPlain(proposed.bundles) && isPlain(proposed.bundles.bundles) ? Object.keys(proposed.bundles.bundles) : [];
}

interface Context {
  operation: BundleCheckOperation;
  allowUnresolved: boolean;
  proposed: Proposed;
  registry: RegistryRead;
  /** Everything the checks look up in the registry is recorded here, for the registry digest and the readback. */
  probe: RegistryProbe;
}

function runGates(context: Context): { checks: BundleCheckGate[]; replaces: string[]; unresolved: BundleCheckUnresolved[] } {
  const shape = shapeGate(context.proposed);
  if (shape.gate.status !== 'passed') {
    return { checks: [shape.gate, ...CHECK_IDS.slice(2).map(id => gate(id, 'not-run', 'The shape check failed, so this check did not run.'))], replaces: [], unresolved: [] };
  }
  const rules = registryRulesGate(context, shape.bundles);
  // The manifest rules ask whether each declared rule file exists; record the answers so the readback sees a change in them.
  for (const bundle of Object.values(rules.merged)) {
    if (Array.isArray(bundle.rules)) {
      for (const rule of bundle.rules) {
        if (typeof rule !== 'string') continue;
        context.probe.ruleState(rule);
        if (isSafeSegment(rule)) context.probe.state(['rules', rule]);
      }
    }
  }
  // The manifest rules also list the native Claude workflows and read the native role file of each lead that must hold `Workflow`.
  const nativeWorkflows = context.probe.nativeWorkflowNames();
  for (const bundle of Object.values(rules.merged)) {
    const lead = nativeWorkflowLead(bundle as never, rules.merged as never, nativeWorkflows);
    if (lead !== undefined) context.probe.nativeLeadState(lead.leadRole);
  }
  // Own keys and aliases only, as the loader looks a bundle up (a name such as `toString` is not a bundle).
  const names = new Set<string>(Object.keys(rules.merged));
  for (const bundle of Object.values(rules.merged)) for (const alias of aliasesOf(bundle)) names.add(alias);
  const references = referencesGate(context, shape.bundles, names, context.probe);
  const bundleRules = bundleRulesGate(shape.bundles, context.proposed.leader);
  return { checks: [shape.gate, rules.gate, references.gate, bundleRules, consistencyGate(shape.bundles, context.proposed.bindings)], replaces: rules.replaces, unresolved: references.unresolved };
}

/** The digest of everything read from the registry: its manifest bytes and every lookup the checks made. */
const registryDigestOf = (read: RegistryRead, probe: RegistryProbe): string => sha256(canonical({ manifest: read.manifestSha, lookups: probe.snapshot() }));

function runChecks(
  artifact: string, registryPath: string, operation: BundleCheckOperation, allowUnresolved: boolean,
  echo: Pick<Draft, 'operation' | 'allowUnresolved' | 'artifact' | 'registry'>, seam: BundleCheckInput['seam'],
): BundleCheckResult {
  const registry = readRegistry(registryPath);
  const first = takeInventory(artifact, operation);

  const before: BundleCheckFinding[] = [];
  if (registry.kind === 'unavailable') before.push(registry.finding);
  if (registry.kind === 'rejected') before.push(...registry.findings);
  if (first.kind === 'unavailable') before.push(first.finding);
  if (registry.kind === 'unavailable' || first.kind === 'unavailable') {
    if (first.kind === 'rejected') before.push(...first.findings);
    return finish(draftOf({ ...echo, checks: idleChecks('unavailable', 'An input could not be read, so no check ran.'), before }));
  }
  if (registry.kind === 'rejected') {
    const reason = 'The registry folder was rejected (unsafe path), so this check did not run.';
    // The inventory did run: keep its verdict and its findings when it was rejected too.
    if (first.kind === 'rejected') return finish(draftOf({ ...echo, checks: [gate('inventory', 'failed', null, first.findings), ...CHECK_IDS.slice(1).map(id => gate(id, 'not-run', reason))], before }));
    return finish(draftOf({ ...echo, checks: idleChecks('not-run', 'The registry folder was rejected (unsafe path), so no check ran.'), before }));
  }
  if (first.kind === 'rejected') {
    return finish(draftOf({
      ...echo,
      checks: [gate('inventory', 'failed', null, first.findings), ...CHECK_IDS.slice(1).map(id => gate(id, 'not-run', 'The inventory check failed, so this check did not run.'))],
    }));
  }

  const probe = new RegistryProbe(registry.registry.root);
  const { checks, replaces, unresolved } = runGates({ operation, allowUnresolved, proposed: first.inventory.proposed, registry: registry.registry, probe });
  seam?.beforeReadback?.();

  // Byte-based readback: the same complete inventory must come back, and the registry manifest and every lookup must read the same,
  // or nothing about the proposal is vouched for.
  const digest = digestOf(first.inventory.items);
  const again = takeInventory(artifact, operation);
  const proposalStable = again.kind === 'ok' && digestOf(again.inventory.items) === digest;
  const registryAgain = readRegistry(registryPath);
  const registryStable = registryAgain.kind === 'ok' && registryAgain.registry.manifestSha === registry.registry.manifestSha && probe.replay() === probe.snapshot();
  const bundleNames = proposedNames(first.inventory.proposed);
  if (!proposalStable || !registryStable) {
    const reasons = [...(proposalStable ? [] : ['The proposal changed while the checks ran.']), ...(registryStable ? [] : ['The registry changed while the checks ran.'])].join(' ');
    const settled = checks.map(check => (check.status === 'passed' ? gate(check.id, 'unavailable', reasons) : check));
    return finish(draftOf({
      ...echo, bundleNames,
      checks: [gate('inventory', 'unavailable', reasons), ...settled],
      after: [
        ...(proposalStable ? [] : [finding('CANDIDATE_DRIFT', null, 'The proposal folder changed between the inventory and the final readback; no digest is vouched for.')]),
        ...(registryStable ? [] : [finding('REGISTRY_DRIFT', null, 'The registry changed between the checks and the final readback (its bundles.json, or a file, a folder, a link or a rule the proposal names); no digest is vouched for.')]),
      ],
    }));
  }
  return finish(draftOf({
    ...echo,
    inventory: first.inventory.items, inventoryComplete: true, candidateDigest: digest, registryDigest: registryDigestOf(registry.registry, probe),
    preserved: first.inventory.preserved, replaces, unresolved, bundleNames,
    checks: [gate('inventory', 'passed', null), ...checks],
  }));
}

/** The result for a defect inside bundle-check itself: one unavailable result, never a pass, naming the internal error. */
export function bundleCheckInternalErrorResult(error: unknown, input: BundleCheckInput = {}): BundleCheckResult {
  const supplied = input ?? {};
  return finish(draftOf({
    operation: typeof supplied.operation === 'string' ? supplied.operation : null,
    allowUnresolved: supplied.allowUnresolved === true,
    artifact: typeof supplied.artifact === 'string' ? supplied.artifact : null,
    registry: typeof supplied.registry === 'string' ? supplied.registry : null,
    checks: idleChecks('unavailable', 'An internal error stopped the check, so no check result is vouched for.'),
    before: [finding('INPUT_UNAVAILABLE', null, `bundle-check stopped on an internal error (a defect, not a finding about the proposal): ${cut(errorText(error), 500)}`)],
  }));
}

/** The entry point the command uses: checkBundle, with any unexpected exception turned into one unavailable result (exit 2). It never throws. */
export function runBundleCheck(input: BundleCheckInput): BundleCheckResult {
  try {
    return checkBundle(input);
  } catch (error) {
    return bundleCheckInternalErrorResult(error, input);
  }
}

