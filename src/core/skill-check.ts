/**
 * Plan 033 P8a: `agents skill-check`, the read-only deterministic QA of one candidate Skill folder.
 *
 * It composes the real existing gates (contract, layout, portability, licence, frozen-corpus measure) with a
 * bounded metadata composition for the `agents-united-original` policy (ADR 0052), over one bounded byte
 * inventory that is read back after the gates ran. The candidate is data: nothing in it is imported, required,
 * spawned or evaluated. No terminal I/O here; `src/cli.ts` prints the result and sets the exit code.
 *
 * Passing means the deterministic gates passed on unchanged bytes. It does not mean useful, legally cleared,
 * correctly attributed, installable or live (`quality` stays pending, `live` unverified).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { validateRewrittenSkill } from './skill-contract.js';
import { checkSkillLayout, supportingText } from './skill-layout.js';
import { lintSkillPortability } from './skill-portability-lint.js';
import { lintSkillLicence } from './skill-licence-lint.js';
import { STUB_MAX_LINES, TEMPLATED_THRESHOLD, measureSkill, verdictOf } from './skill-quality.js';
import type {
  SkillCheckCheckId, SkillCheckCode, SkillCheckFinding, SkillCheckGate, SkillCheckInput, SkillCheckInventoryItem,
  SkillCheckResult, SkillCheckStatus,
} from './types.js';

/** SHA-256 of the reviewed LF bytes of `registry/quality/skill-boilerplate-corpus.txt`. No other bytes are accepted. */
export const SKILL_CHECK_CORPUS_SHA256 = '39840b497ae274b48be9220684c6d89ea8f886f06a687409e1c2ed887a51b705';
export const SKILL_CHECK_POLICY = 'agents-united-original';

const CHECK_IDS: readonly SkillCheckCheckId[] = ['metadata', 'contract', 'layout', 'portability', 'licence', 'frozen-corpus'];
const MAX_FILES = 32;
const MAX_TOTAL_BYTES = 1024 * 1024;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_DIRECTORIES = 128;
/** Every entry looked at (files, directories, links, specials), so a tree of links cannot make the walk unbounded. */
const MAX_ENTRIES = 1024;
const MAX_FINDINGS = 256;
const MAX_OUTPUT_BYTES = 256 * 1024;
/** The reviewed corpus is about 6 KB; a bigger file is a different file, hashed only up to this many bytes. */
const MAX_CORPUS_BYTES = 64 * 1024;

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
/** Codes that make a result unavailable (exit 2) rather than a deterministic failure (exit 1). */
const UNAVAILABLE_CODES: ReadonlySet<SkillCheckCode> = new Set<SkillCheckCode>([
  'USAGE', 'POLICY_UNSUPPORTED', 'INPUT_UNAVAILABLE', 'CORPUS_MISMATCH', 'CANDIDATE_DRIFT', 'OUTPUT_LIMIT',
]);

export function skillCheckExitCode(result: SkillCheckResult): 0 | 1 | 2 {
  return result.status === 'passed' ? 0 : result.status === 'failed' ? 1 : 2;
}

const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
const finding = (code: SkillCheckCode, filePath: string | null, message: string): SkillCheckFinding => ({ code, path: filePath, message });
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const errorCode = (error: unknown): string => (error as NodeJS.ErrnoException | undefined)?.code ?? errorText(error);

/** The P5 check-review canonical form: recursively sorted keys, no whitespace. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const digestOf = (inventory: SkillCheckInventoryItem[]): string => sha256(canonical(inventory));

// ---------------------------------------------------------------------------------------------
// Result assembly
// ---------------------------------------------------------------------------------------------

interface Draft {
  artifact: string | null;
  policy: string | null;
  corpusPath: string | null;
  corpusSha: string | null;
  inventory: SkillCheckInventoryItem[];
  inventoryComplete: boolean;
  candidateDigest: string | null;
  checks: SkillCheckGate[];
  /** Findings that belong to the run rather than to one gate (usage, inputs, limits, drift). */
  before: SkillCheckFinding[];
  after: SkillCheckFinding[];
}

const gate = (id: SkillCheckCheckId, status: SkillCheckGate['status'], reason: string | null, findings: SkillCheckFinding[] = [], measure: SkillCheckGate['measure'] = null): SkillCheckGate =>
  ({ id, status, reason, measure, findings });

function idleChecks(status: 'not-run' | 'unavailable', reason: string): SkillCheckGate[] {
  return CHECK_IDS.map(id => gate(id, status, reason));
}

function draftOf(partial: Partial<Draft>): Draft {
  return {
    artifact: null, policy: null, corpusPath: null, corpusSha: null, inventory: [], inventoryComplete: false, candidateDigest: null,
    checks: idleChecks('not-run', 'no gate ran'), before: [], after: [], ...partial,
  };
}

/** Echoed text (a path or a policy name taken from the command line) is shortened to this many characters in the last-resort result. */
const MAX_ECHO_CHARS = 512;
const shortened = (value: string | null): string | null => (value !== null && value.length > MAX_ECHO_CHARS ? `${value.slice(0, MAX_ECHO_CHARS)}...` : value);

function finish(draft: Draft): SkillCheckResult {
  const gateFindings = draft.checks.flatMap(check => check.findings);
  /** The order findings are shown in. */
  const all = [...draft.before, ...gateFindings, ...draft.after];
  /** The order findings are kept in when some must be cut: the reasons of the run itself (usage, inputs, limits, drift) before any gate's own findings. */
  const priority = [...draft.before, ...draft.after, ...gateFindings];
  const unavailable = all.some(item => UNAVAILABLE_CODES.has(item.code)) || draft.checks.some(check => check.status === 'unavailable');
  const failed = all.length > 0 || draft.checks.some(check => check.status === 'failed');
  let status: SkillCheckStatus = unavailable ? 'unavailable' : failed ? 'failed' : draft.checks.every(check => check.status === 'passed') ? 'passed' : 'unavailable';

  const assemble = (keep: number, complete: boolean): SkillCheckResult => {
    const kept = new Set(priority.slice(0, keep));
    const shown = all.filter(item => kept.has(item));
    const limit = complete ? [] : [finding('OUTPUT_LIMIT', null, `The result has more findings or bytes than the ${MAX_FINDINGS}-finding / ${MAX_OUTPUT_BYTES / 1024} KiB bound; ${all.length - shown.length} of ${all.length} findings are not shown.`)];
    const checks = draft.checks.map(check => {
      const shown = check.findings.filter(item => kept.has(item));
      const cut = shown.length !== check.findings.length;
      return { ...check, findings: shown, reason: cut ? (check.reason ?? 'Some findings of this check are not shown (OUTPUT_LIMIT).') : check.reason };
    });
    return {
      version: 1,
      kind: 'deterministic',
      status: complete ? status : 'unavailable',
      policy: draft.policy,
      artifact: draft.artifact,
      corpus: { path: draft.corpusPath, sha256: draft.corpusSha, expectedSha256: SKILL_CHECK_CORPUS_SHA256 },
      candidateDigest: draft.inventoryComplete ? draft.candidateDigest : null,
      inventoryComplete: draft.inventoryComplete,
      findingsComplete: complete,
      inventory: draft.inventory,
      checks,
      findings: [...shown, ...limit],
      quality: 'pending',
      live: 'unverified',
      acceptedDraft: false,
    };
  };
  const size = (result: SkillCheckResult): number => Buffer.byteLength(JSON.stringify(result, null, 2));

  if (all.length <= MAX_FINDINGS) {
    const whole = assemble(all.length, true);
    if (size(whole) <= MAX_OUTPUT_BYTES) return whole;
  }
  let keep = Math.min(all.length, MAX_FINDINGS - 1);
  status = 'unavailable';
  let cut = assemble(keep, false);
  while (keep > 0 && size(cut) > MAX_OUTPUT_BYTES) {
    keep = Math.floor(keep / 2);
    cut = assemble(keep, false);
  }
  if (size(cut) <= MAX_OUTPUT_BYTES) return cut;

  // Not even zero findings fit (a path or policy taken from the command line is enormous, or the inventory is): the last resort
  // is a small unavailable result that says so. No digest, no inventory and no gate result is vouched for.
  return {
    version: 1,
    kind: 'deterministic',
    status: 'unavailable',
    policy: shortened(draft.policy),
    artifact: shortened(draft.artifact),
    corpus: { path: shortened(draft.corpusPath), sha256: draft.corpusSha, expectedSha256: SKILL_CHECK_CORPUS_SHA256 },
    candidateDigest: null,
    inventoryComplete: false,
    findingsComplete: false,
    inventory: [],
    checks: draft.checks.map(check => gate(check.id, 'unavailable', 'The result is larger than the output bound, so no detail of this check is shown (OUTPUT_LIMIT).')),
    findings: [finding('OUTPUT_LIMIT', null, `The result is larger than the ${MAX_OUTPUT_BYTES / 1024} KiB bound even without findings; echoed paths are shortened to ${MAX_ECHO_CHARS} characters and no inventory, digest or check detail is shown.`)],
    quality: 'pending',
    live: 'unverified',
    acceptedDraft: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Inputs: the frozen corpus and the bounded candidate inventory
// ---------------------------------------------------------------------------------------------

type CorpusOutcome =
  | { kind: 'ok'; sha256: string; lines: Set<string> }
  | { kind: 'mismatch'; sha256: string | null; finding: SkillCheckFinding }
  | { kind: 'unavailable'; finding: SkillCheckFinding };

function readCorpus(file: string): CorpusOutcome {
  let fd: number | undefined;
  try {
    // A regular file by lstat before anything is opened: opening a named pipe would block, and a link is never followed.
    const entry = fs.lstatSync(file);
    if (entry.isSymbolicLink()) return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The frozen corpus path is a link, not a regular file: ${file}`) };
    if (!entry.isFile()) return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The frozen corpus path is not a regular file: ${file}`) };
    // O_NOFOLLOW and O_NONBLOCK do not exist on Windows (undefined there); where they do, they close the gap between the lstat and the open.
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    if (!fs.fstatSync(fd).isFile()) return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The frozen corpus path is not a regular file: ${file}`) };
    const buffer = Buffer.alloc(MAX_CORPUS_BYTES + 1);
    let length = 0;
    for (;;) {
      const read = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (read === 0) break;
      length += read;
      if (length > MAX_CORPUS_BYTES) {
        return { kind: 'mismatch', sha256: null, finding: finding('CORPUS_MISMATCH', null, `The supplied corpus is larger than ${MAX_CORPUS_BYTES} bytes; only the reviewed frozen corpus (sha256 ${SKILL_CHECK_CORPUS_SHA256}) is accepted.`) };
      }
    }
    const bytes = buffer.subarray(0, length);
    const actual = sha256(bytes);
    if (actual !== SKILL_CHECK_CORPUS_SHA256) {
      return { kind: 'mismatch', sha256: actual, finding: finding('CORPUS_MISMATCH', null, `The supplied corpus has sha256 ${actual}; only the reviewed frozen corpus (sha256 ${SKILL_CHECK_CORPUS_SHA256}) is accepted.`) };
    }
    // The same line set `loadCorpus` yields for these bytes, taken from the bytes that were just verified.
    return { kind: 'ok', sha256: actual, lines: new Set(bytes.toString('utf8').split(/\r?\n/).filter(line => line !== '')) };
  } catch (error) {
    return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The frozen corpus cannot be read (${errorCode(error)}): ${file}`) };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

interface Inventoried { items: SkillCheckInventoryItem[]; bytes: Map<string, Buffer> }
type InventoryOutcome =
  | { kind: 'ok'; inventory: Inventoried }
  | { kind: 'unavailable'; finding: SkillCheckFinding }
  | { kind: 'rejected'; findings: SkillCheckFinding[] };

const byPath = (a: { path: string }, b: { path: string }): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/**
 * Walks the candidate with lstat only (nothing is read or followed until the whole tree passed the link, case,
 * special-file and size checks), then reads every file once. Never truncates to meet a bound.
 */
function takeInventory(root: string): InventoryOutcome {
  let rootStat: fs.Stats;
  try {
    rootStat = fs.lstatSync(root);
  } catch (error) {
    return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The candidate folder cannot be read (${errorCode(error)}): ${root}`) };
  }
  if (rootStat.isSymbolicLink()) return { kind: 'rejected', findings: [finding('PATH_UNSAFE', null, `The candidate folder is a link, not a folder: ${root}`)] };
  if (!rootStat.isDirectory()) return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The candidate path is not a folder: ${root}`) };

  // A Skill folder holds SKILL.md. Any other folder (the parent of the Skill, a wrong path) is not a candidate at all, so it is
  // unavailable input rather than a Skill that fails, and it is not walked. Only a missing entry or a folder is decided here;
  // a link or any other trouble with the entry is reported by the walk below.
  try {
    if (fs.lstatSync(path.join(root, 'SKILL.md')).isDirectory()) {
      return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', 'SKILL.md', `SKILL.md in the candidate folder is a folder, not a file: ${root}`) };
    }
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', 'SKILL.md', `SKILL.md is missing from the candidate folder, so it is not a Skill folder (is this the Skill's own folder and not its parent?): ${root}`) };
    }
  }

  const problems: SkillCheckFinding[] = [];
  const files: Array<{ rel: string; abs: string; size: number }> = [];
  let directories = 1;
  let entries = 0;
  let total = 0;
  let overFiles = false, overDirectories = false, overTotal = false, overEntries = false;
  const stack: Array<{ abs: string; rel: string }> = [{ abs: root, rel: '' }];
  while (stack.length > 0 && !overEntries) {
    const { abs, rel } = stack.pop()!;
    let names: string[];
    try {
      names = fs.readdirSync(abs).sort();
    } catch (error) {
      return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', rel === '' ? null : rel.replace(/\/$/, ''), `A candidate folder cannot be listed (${errorCode(error)}): ${abs}`) };
    }
    const seen = new Map<string, string>();
    for (const name of names) {
      entries += 1;
      if (entries > MAX_ENTRIES) {
        overEntries = true;
        problems.push(finding('INPUT_LIMIT', null, `The candidate has more than ${MAX_ENTRIES} entries; the walk stopped.`));
        break;
      }
      const relPath = `${rel}${name}`;
      const key = name.normalize('NFC').toLowerCase();
      const clash = seen.get(key);
      if (clash !== undefined) problems.push(finding('PATH_UNSAFE', relPath, `${relPath} and ${rel}${clash} differ only by letter case.`));
      else seen.set(key, name);
      const full = path.join(abs, name);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(full);
      } catch (error) {
        return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', relPath, `A candidate entry cannot be inspected (${errorCode(error)}): ${relPath}`) };
      }
      if (stat.isSymbolicLink()) {
        problems.push(finding('PATH_UNSAFE', relPath, `${relPath} is a link (symbolic link or junction); links are never followed.`));
      } else if (stat.isDirectory()) {
        directories += 1;
        if (directories > MAX_DIRECTORIES) {
          if (!overDirectories) problems.push(finding('INPUT_LIMIT', relPath, `The candidate has more than ${MAX_DIRECTORIES} directories including its root.`));
          overDirectories = true;
        } else {
          stack.push({ abs: full, rel: `${relPath}/` });
        }
      } else if (stat.isFile()) {
        files.push({ rel: relPath, abs: full, size: stat.size });
        if (files.length > MAX_FILES && !overFiles) {
          overFiles = true;
          problems.push(finding('INPUT_LIMIT', null, `The candidate has more than ${MAX_FILES} files.`));
        }
        if (stat.size > MAX_FILE_BYTES) problems.push(finding('INPUT_LIMIT', relPath, `${relPath} is ${stat.size} bytes (limit ${MAX_FILE_BYTES}).`));
        total += stat.size;
        if (total > MAX_TOTAL_BYTES && !overTotal) {
          overTotal = true;
          problems.push(finding('INPUT_LIMIT', null, `The candidate is larger than ${MAX_TOTAL_BYTES} bytes in total.`));
        }
      } else {
        problems.push(finding('PATH_UNSAFE', relPath, `${relPath} is neither a regular file nor a folder.`));
      }
    }
  }
  if (problems.length > 0) return { kind: 'rejected', findings: problems };

  const items: SkillCheckInventoryItem[] = [];
  const bytes = new Map<string, Buffer>();
  for (const file of files) {
    let content: Buffer;
    try {
      content = fs.readFileSync(file.abs);
    } catch (error) {
      return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', file.rel, `A candidate file cannot be read (${errorCode(error)}): ${file.rel}`) };
    }
    if (content.length !== file.size) return { kind: 'unavailable', finding: finding('CANDIDATE_DRIFT', file.rel, `${file.rel} changed while the inventory was taken.`) };
    items.push({ path: file.rel, kind: 'file', bytes: content.length, sha256: sha256(content) });
    bytes.set(file.rel, content);
  }
  // The exact name SKILL.md (a case-insensitive filesystem can find skill.md above) is what the gates read.
  if (!bytes.has('SKILL.md')) return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', 'SKILL.md', `SKILL.md (this exact name) is missing from the candidate folder, so it is not a Skill folder: ${root}`) };
  items.sort(byPath);
  return { kind: 'ok', inventory: { items, bytes } };
}

// ---------------------------------------------------------------------------------------------
// SKILL.md links that leave the candidate folder
// ---------------------------------------------------------------------------------------------

const MAX_ESCAPING_LINKS = 32;
/** The target of a markdown inline link: `](target)`, `](target "title")`, `](<target>)`. */
const LINK_TARGET = /\]\(\s*<?([^)\s>]*)/g;

function leavesFolder(raw: string): boolean {
  const slashed = raw.replace(/[?#].*$/, '').replace(/\\/g, '/');
  // Only the targets the layout gate looks up (it matches a support folder prefix) matter; sibling-skill links, absolute paths,
  // drive letters and URLs are never looked up by anything here, so they are not this check's business.
  if (!/^(?:examples|references|assets|scripts)\//.test(slashed)) return false;
  const normal = path.posix.normalize(slashed);
  return normal === '..' || normal.startsWith('../');
}

/**
 * The distinct targets of SKILL.md support-folder links (`examples/`, `references/`, `assets/`, `scripts/`) that normalise to a place
 * outside the candidate folder; other links (sibling skills, absolute paths, URLs) are not flagged. This is text analysis only: nothing
 * is looked up, so the folder's surroundings are never inspected on account of what the candidate says.
 */
function escapingLinks(skillText: string): string[] {
  const found = new Set<string>();
  for (const match of skillText.matchAll(LINK_TARGET)) {
    if (leavesFolder(match[1]!)) found.add(match[1]!);
    if (found.size >= MAX_ESCAPING_LINKS) break;
  }
  return [...found];
}

// ---------------------------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------------------------

/**
 * yaml reports an unresolved tag and similar oddities through process.emitWarning, which would print a fragment of the candidate on
 * stderr. The result carries every finding, so those warnings are dropped while the gates run. Only a warning named YAMLWarning is
 * dropped, other warnings are passed on, and a real parse error is thrown, never emitted, so none can be swallowed here.
 */
function withoutYamlWarnings<T>(run: () => T): T {
  const original = process.emitWarning;
  process.emitWarning = ((warning: unknown, ...rest: unknown[]) => {
    if (typeof warning === 'object' && warning !== null && (warning as { name?: unknown }).name === 'YAMLWarning') return undefined;
    return (original as (...args: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return run();
  } finally {
    process.emitWarning = original;
  }
}

interface Parsed { meta: Record<string, unknown>; body: string; raw: string }

function parseSkill(raw: string): Parsed | string {
  const front = raw.match(FRONT_MATTER);
  if (!front) return 'SKILL.md has no front matter block (--- ... ---).';
  let meta: unknown;
  try {
    meta = YAML.parse(front[1]!);
  } catch (error) {
    return `The front matter is not valid YAML: ${errorText(error)}`;
  }
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) return 'The front matter is not a YAML mapping.';
  return { meta: meta as Record<string, unknown>, body: raw.slice(front[0].length), raw };
}

const present = (value: unknown): boolean => value !== undefined && value !== null && value !== '' && value !== false;

/** ADR 0052: an original Agents United Skill names its author, carries a version and a licence, and declares no upstream. */
function originalPolicyFindings(meta: Record<string, unknown>): SkillCheckFinding[] {
  const out: SkillCheckFinding[] = [];
  const problem = (message: string): void => { out.push(finding('ORIGINAL_POLICY', 'SKILL.md', message)); };
  const block = meta.metadata;
  if (block === null || typeof block !== 'object' || Array.isArray(block)) {
    problem('metadata is missing: the agents-united-original policy needs metadata.author, metadata.version and metadata.license.');
    return out;
  }
  const md = block as Record<string, unknown>;
  if (md.author !== 'agents-united') problem(`metadata.author must be agents-united, is ${JSON.stringify(md.author ?? null)}.`);
  const version = md.version;
  if (!((typeof version === 'string' && version.trim() !== '') || (typeof version === 'number' && Number.isFinite(version)))) problem('metadata.version is missing.');
  if (typeof md.license !== 'string' || md.license.trim() === '') problem('metadata.license is missing.');
  if (present(md.source)) problem('An original Skill declares no metadata.source (an upstream makes it an adaptation, which this policy does not cover).');
  if (present(md.adaptedFrom)) problem('An original Skill declares no metadata.adaptedFrom (an upstream makes it an adaptation, which this policy does not cover).');
  return out;
}

function runGate(id: SkillCheckCheckId, code: SkillCheckCode, filePath: string | null, fn: () => string[]): SkillCheckGate {
  let messages: string[];
  try {
    messages = fn();
  } catch (error) {
    messages = [`The ${id} gate raised while reading the candidate: ${errorText(error)}`];
  }
  return messages.length === 0 ? gate(id, 'passed', null) : gate(id, 'failed', null, messages.map(message => finding(code, filePath, message)));
}

function runGates(artifact: string, inventory: Inventoried, corpus: CorpusOutcome): SkillCheckGate[] {
  const resolved = path.resolve(artifact);
  const dirName = path.basename(resolved);
  const parent = path.dirname(resolved);
  // takeInventory only returns an inventory that holds SKILL.md.
  const skillBytes = inventory.bytes.get('SKILL.md')!;
  const checks: SkillCheckGate[] = [];

  const parsed = parseSkill(skillBytes.toString('utf8'));

  if (typeof parsed === 'string') {
    checks.push(gate('metadata', 'failed', null, [finding('FRONTMATTER_INVALID', 'SKILL.md', parsed)]));
    const reason = 'SKILL.md front matter did not parse, so this gate has nothing to read.';
    for (const id of ['contract', 'layout', 'portability', 'licence'] as const) checks.push(gate(id, 'not-run', reason));
  } else {
    const { meta, body, raw } = parsed;
    const md = (meta.metadata !== null && typeof meta.metadata === 'object' ? meta.metadata : {}) as Record<string, unknown>;
    const files = inventory.items.map(item => item.path);
    const scripts = files.filter(file => file.startsWith('scripts/')).map(file => ({ relPath: file, content: inventory.bytes.get(file)!.toString('utf8') }));
    const originals = originalPolicyFindings(meta);
    checks.push(originals.length === 0 ? gate('metadata', 'passed', null) : gate('metadata', 'failed', null, originals));
    checks.push(runGate('contract', 'CONTRACT', 'SKILL.md', () => validateRewrittenSkill(dirName, raw, supportingText(resolved))));
    checks.push(runGate('layout', 'LAYOUT', null, () => checkSkillLayout(parent, dirName)));
    checks.push(runGate('portability', 'PORTABILITY', null, () => lintSkillPortability({
      dirName, name: typeof meta.name === 'string' ? meta.name : String(meta.name ?? ''), body, scripts,
    })));
    checks.push(runGate('licence', 'LICENCE', null, () => lintSkillLicence({
      dirName,
      license: typeof md.license === 'string' ? md.license : undefined,
      source: typeof md.source === 'string' ? md.source : undefined,
      files,
    })));
  }

  if (corpus.kind !== 'ok') {
    checks.push(gate('frozen-corpus', 'unavailable', corpus.kind === 'mismatch' ? 'The supplied corpus is not the reviewed frozen corpus.' : 'The frozen corpus could not be read.'));
  } else {
    try {
      const measure = measureSkill(parent, dirName, corpus.lines);
      const verdict = verdictOf(measure);
      const shown = { lines: measure.lines, templatedLines: measure.templatedLines, share: measure.share, extraFiles: measure.extraFiles, thirdParty: measure.thirdParty, verdict };
      if (verdict === 'ok') checks.push(gate('frozen-corpus', 'passed', null, [], shown));
      else if (verdict === 'templated') {
        checks.push(gate('frozen-corpus', 'failed', null, [finding('TEMPLATED', 'SKILL.md', `${dirName}: ${measure.templatedLines} of ${measure.lines} content lines (${(measure.share * 100).toFixed(1)}%) are lines of the frozen boilerplate corpus (threshold ${TEMPLATED_THRESHOLD * 100}%).`)], shown));
      } else {
        checks.push(gate('frozen-corpus', 'failed', null, [finding('STUB', 'SKILL.md', `${dirName}: ${measure.lines} content lines (a Skill under ${STUB_MAX_LINES} lines needs supporting files) and ${measure.extraFiles} supporting files.`)], shown));
      }
    } catch (error) {
      checks.push(gate('frozen-corpus', 'unavailable', `The measure could not read the candidate (${errorCode(error)}).`, [finding('INPUT_UNAVAILABLE', 'SKILL.md', `The frozen-corpus measure could not read the candidate: ${errorText(error)}`)]));
    }
  }
  return checks;
}

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

/** A usage result (exit 2) for an invocation problem the caller found before any input was read, e.g. an unknown option. */
export function skillCheckUsageResult(problems: string[], input: SkillCheckInput = {}): SkillCheckResult {
  return finish(draftOf({
    artifact: typeof input.artifact === 'string' ? input.artifact : null,
    policy: typeof input.policy === 'string' ? input.policy : null,
    corpusPath: typeof input.corpus === 'string' ? input.corpus : null,
    checks: idleChecks('not-run', 'The invocation was not valid, so no gate ran.'),
    before: problems.map(message => finding('USAGE', null, message)),
  }));
}

export function checkSkill(input: SkillCheckInput): SkillCheckResult {
  // Only these three fields and the seam are read; any other key of the input object is ignored.
  const supplied = input ?? {};
  const artifact = typeof supplied.artifact === 'string' && supplied.artifact !== '' ? supplied.artifact : undefined;
  const corpusPath = typeof supplied.corpus === 'string' && supplied.corpus !== '' ? supplied.corpus : undefined;
  const policy = typeof supplied.policy === 'string' && supplied.policy !== '' ? supplied.policy : undefined;

  const usage: string[] = [];
  if (artifact === undefined) usage.push('--artifact <absolute-skill-folder> is required.');
  else if (!path.isAbsolute(artifact)) usage.push('--artifact must be an absolute path.');
  if (corpusPath === undefined) usage.push('--corpus <absolute-frozen-corpus> is required.');
  else if (!path.isAbsolute(corpusPath)) usage.push('--corpus must be an absolute path.');
  if (policy === undefined) usage.push(`--policy <name> is required (supported: ${SKILL_CHECK_POLICY}).`);
  const echo = { artifact: artifact ?? null, policy: policy ?? null, corpusPath: corpusPath ?? null };
  if (usage.length > 0) return finish(draftOf({ ...echo, checks: idleChecks('not-run', 'The invocation was not valid, so no gate ran.'), before: usage.map(message => finding('USAGE', null, message)) }));
  if (policy !== SKILL_CHECK_POLICY) {
    return finish(draftOf({
      ...echo,
      checks: idleChecks('not-run', `The policy is not supported, so no gate ran.`),
      before: [finding('POLICY_UNSUPPORTED', null, `Policy ${JSON.stringify(policy)} is not supported; only ${SKILL_CHECK_POLICY} is (private-owner and adapted-source policies are not available).`)],
    }));
  }

  // The corpus is read and its hash checked before any gate runs.
  const corpus = readCorpus(corpusPath!);
  const corpusSha = corpus.kind === 'unavailable' ? null : corpus.sha256;
  const before: SkillCheckFinding[] = corpus.kind === 'ok' ? [] : [corpus.finding];

  const first = takeInventory(artifact!);
  if (first.kind === 'unavailable') {
    return finish(draftOf({ ...echo, corpusSha, checks: idleChecks('unavailable', 'The candidate could not be inventoried.'), before: [first.finding, ...before] }));
  }
  if (first.kind === 'rejected') {
    return finish(draftOf({ ...echo, corpusSha, checks: idleChecks('not-run', 'The candidate was rejected before any gate ran (limits or unsafe paths).'), before: [...first.findings, ...before] }));
  }

  // Reasons found in SKILL.md text alone, before any gate runs: a gate would look the link target up.
  const leaving = escapingLinks(first.inventory.bytes.get('SKILL.md')!.toString('utf8'));
  if (leaving.length > 0) {
    return finish(draftOf({
      ...echo, corpusSha,
      checks: idleChecks('not-run', 'SKILL.md links to a place outside the candidate folder, so no gate ran.'),
      before: [...leaving.map(target => finding('PATH_UNSAFE', 'SKILL.md', `SKILL.md links to ${JSON.stringify(target)}, which points outside the candidate folder; nothing outside the folder is inspected.`)), ...before],
    }));
  }

  const checks = withoutYamlWarnings(() => runGates(artifact!, first.inventory, corpus));
  supplied.seam?.beforeReadback?.();

  // Byte-based readback: the same complete inventory must come back, or nothing about the candidate is vouched for.
  const digest = digestOf(first.inventory.items);
  const again = takeInventory(artifact!);
  const unchanged = again.kind === 'ok' && digestOf(again.inventory.items) === digest;
  if (!unchanged) {
    const settled = checks.map(check => (check.status === 'passed' ? gate(check.id, 'unavailable', 'The candidate changed while the gates ran.') : check));
    return finish(draftOf({
      ...echo, corpusSha, checks: settled, before,
      after: [finding('CANDIDATE_DRIFT', null, 'The candidate folder changed between the inventory and the final readback; no digest is vouched for.')],
    }));
  }
  return finish(draftOf({ ...echo, corpusSha, inventory: first.inventory.items, inventoryComplete: true, candidateDigest: digest, checks, before }));
}

/** The result for a defect inside skill-check itself: one unavailable result, never a pass, naming the internal error. */
export function skillCheckInternalErrorResult(error: unknown, input: SkillCheckInput = {}): SkillCheckResult {
  const supplied = input ?? {};
  const text = errorText(error);
  return finish(draftOf({
    artifact: typeof supplied.artifact === 'string' ? supplied.artifact : null,
    policy: typeof supplied.policy === 'string' ? supplied.policy : null,
    corpusPath: typeof supplied.corpus === 'string' ? supplied.corpus : null,
    checks: idleChecks('unavailable', 'An internal error stopped the check, so no gate result is vouched for.'),
    before: [finding('INPUT_UNAVAILABLE', null, `skill-check stopped on an internal error (a defect, not a finding about the candidate): ${text.length > 500 ? `${text.slice(0, 500)}...` : text}`)],
  }));
}

/** The entry point the command uses: checkSkill, with any unexpected exception turned into one unavailable result (exit 2). It never throws. */
export function runSkillCheck(input: SkillCheckInput): SkillCheckResult {
  try {
    return checkSkill(input);
  } catch (error) {
    return skillCheckInternalErrorResult(error, input);
  }
}
