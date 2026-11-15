/**
 * Plan 033 P8a and P9: `agents skill-check`, the read-only deterministic QA of one candidate Skill folder.
 *
 * It composes the real existing gates (contract, layout, portability, licence, frozen-corpus measure) with a
 * bounded metadata composition for the supported authorship policies (ADR 0052 `agents-united-original`; P9
 * `private-owner` and `adapted-source`), over one bounded byte inventory that is read back after the gates ran.
 * The candidate is data: nothing in it is imported, required, spawned or evaluated. No terminal I/O here;
 * `src/cli.ts` prints the result and sets the exit code.
 *
 * Passing means the deterministic gates passed on unchanged bytes. It does not mean useful, legally cleared,
 * correctly attributed, installable or live (`quality` stays pending, `live` unverified).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { validateRewrittenSkill } from './skill-contract.js';
import { checkSkillLayout, plainText, supportLinkTargets, supportingText } from './skill-layout.js';
import { lintSkillPortability } from './skill-portability-lint.js';
import { lintSkillLicence, lintSkillPolicyLicence, parseSource } from './skill-licence-lint.js';
import { STUB_MAX_LINES, TEMPLATED_THRESHOLD, measureSkill, verdictOf } from './skill-quality.js';
import type {
  SkillCheckCheckId, SkillCheckCode, SkillCheckFinding, SkillCheckGate, SkillCheckInput, SkillCheckInventoryItem,
  SkillCheckPolicy, SkillCheckResult, SkillCheckStatus,
} from './types.js';

/** SHA-256 of the reviewed LF bytes of `registry/quality/skill-boilerplate-corpus.txt`. No other bytes are accepted. */
export const SKILL_CHECK_CORPUS_SHA256 = '39840b497ae274b48be9220684c6d89ea8f886f06a687409e1c2ed887a51b705';
export const SKILL_CHECK_POLICY = 'agents-united-original';
/**
 * The three maintainer-approved `--policy` values (Plan 033 P9): an original Agents United Skill, a privately owned
 * original Skill by another author, and a Skill adapted from one pinned upstream commit. Anything else is POLICY_UNSUPPORTED.
 */
export const SKILL_CHECK_POLICIES: readonly SkillCheckPolicy[] = ['agents-united-original', 'private-owner', 'adapted-source'];

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

/**
 * Every separator the platform accepts in a path: both `\` and `/` on Windows (a path written with forward or mixed slashes names the
 * same folder), only `/` elsewhere, where a backslash is an ordinary character of a name.
 */
const PATH_SEPARATORS = path.sep === '\\' ? /[\\/]+/ : /\/+/;
const isPathSeparator = (char: string | undefined): boolean => char === '/' || (path.sep === '\\' && char === '\\');

/**
 * The path without its trailing separators, never cutting into a bare root (`/`, `C:\`). lstat(2) on a POSIX host resolves a
 * symbolic link written with a trailing slash, so the leaf is inspected under its own name: a link is then seen as a link.
 */
export function withoutTrailingSeparators(value: string): string {
  const rootLength = path.parse(value).root.length;
  let end = value.length;
  while (end > rootLength && isPathSeparator(value[end - 1])) end -= 1;
  return value.slice(0, end);
}

/**
 * The linked-ancestor walk of the two registry checker scripts (review finding F13): `absolute()` in
 * registry/skills/evaluate-artifact/scripts/check-review.mjs:27-36 and check-skill-return.mjs:49-60 lstat every
 * component from the root down, so a link (symbolic link or junction) on the way to a pinned input is refused.
 * Only the strict ancestors are checked here: the leaf itself is vetted by its own reader (takeInventory for the
 * candidate folder, readCorpus for the corpus file). Returns the first linked ancestor, or null when there is none.
 */
function linkedAncestorOf(leaf: string): string | null {
  let current = path.parse(leaf).root;
  const parts = leaf.slice(current.length).split(PATH_SEPARATORS).filter(part => part !== '');
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    let stat: fs.Stats | undefined;
    try {
      stat = fs.lstatSync(current, { throwIfNoEntry: false });
    } catch {
      // An ancestor that cannot be inspected here is reported by the reader of the leaf itself, exactly as before.
      return null;
    }
    if (stat?.isSymbolicLink()) return current;
  }
  return null;
}

/** The traversal-alias rule of the same `absolute()` helpers: a `.` or `..` segment makes the argument name a different folder per reader. */
const hasTraversalAlias = (value: string): boolean => value.split(/[\\/]/).some(part => part === '.' || part === '..');

/**
 * The entry-name rule of the same two scripts (review finding F7): `relative()` in check-review.mjs:37-41 and the
 * identical per-segment rule in check-skill-return.mjs:62-65 refuse a name that contains one of < > : " \ | ? * or a
 * control character, that ends with a dot or a space, or that is a Windows reserved device name with or without an
 * extension. Returns the reason the name is refused, or null when the name is portable.
 *
 * Exported as the pure form of the rule, so a host whose file system refuses such a name on disk cannot leave the
 * rule itself untested (the two disk cases in tests/skill-check.test.ts skip on such a host).
 */
const UNSAFE_NAME_CHARS = /[<>:"\\|?*\u0000-\u001f\u007f-\u009f]/;
const TRAILING_DOT_OR_SPACE = /[. ]$/;
const WINDOWS_RESERVED_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function unsafeEntryName(name: string): string | null {
  if (UNSAFE_NAME_CHARS.test(name)) return 'contains one of < > : " \\ | ? * or a control character (U+0000 to U+001F, DEL, U+0080 to U+009F)';
  if (TRAILING_DOT_OR_SPACE.test(name)) return 'ends with a dot or a space';
  if (WINDOWS_RESERVED_DEVICE_NAME.test(name)) return 'is a Windows reserved device name (CON, PRN, AUX, NUL, COM1 to COM9, LPT1 to LPT9)';
  return null;
}

/**
 * The encoding rule of the same scripts (`decode`, a fatal TextDecoder): a file whose bytes are not valid UTF-8 is
 * not text any gate could read (review finding F7).
 */
const utf8Decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function validUtf8(bytes: Buffer): boolean {
  try {
    utf8Decoder.decode(bytes);
    return true;
  } catch {
    return false;
  }
}

type CorpusOutcome =
  | { kind: 'ok'; sha256: string; lines: Set<string> }
  | { kind: 'mismatch'; sha256: string | null; finding: SkillCheckFinding }
  | { kind: 'unavailable'; finding: SkillCheckFinding };

function readCorpus(file: string): CorpusOutcome {
  let fd: number | undefined;
  try {
    // A path that ends in a separator names a folder, never the corpus file (and some hosts would follow a link written that way): refused before any lstat.
    if (isPathSeparator(file[file.length - 1])) {
      return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The frozen corpus path ends with a path separator, so it does not name a file; pass the real path of the corpus file: ${file}`) };
    }
    // Review finding F13: a corpus reached through a link or junction is not the pinned file; the real path is the only accepted form.
    const linkedAncestor = linkedAncestorOf(file);
    if (linkedAncestor !== null) {
      return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', null, `The frozen corpus path is reached through a link or junction (${linkedAncestor}); pass the real path of the corpus file.`) };
    }
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
function takeInventory(given: string): InventoryOutcome {
  // The folder is inspected under its own name, before the ancestor walk or any lstat (see withoutTrailingSeparators).
  const root = withoutTrailingSeparators(given);
  // Review finding F13: the real path of the candidate folder is the only accepted form, as with the corpus above.
  const linkedAncestor = linkedAncestorOf(root);
  if (linkedAncestor !== null) {
    return { kind: 'rejected', findings: [finding('PATH_UNSAFE', null, `The candidate folder is reached through a link or junction (${linkedAncestor}); pass the real path of the candidate folder.`)] };
  }
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
      // Review finding F7: the entry-name rule of the two registry checker scripts; such an entry is never inspected
      // beyond its name, so nothing under a reserved or unportable name is listed or read.
      const unsafeName = unsafeEntryName(name);
      if (unsafeName !== null) {
        problems.push(finding('PATH_UNSAFE', relPath, `${relPath} ${unsafeName}; the checker scripts of evaluate-artifact and coordinate-artifact refuse such a name, and so does this inventory (which also refuses DEL and the C1 controls).`));
        continue;
      }
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
  const notUtf8: SkillCheckFinding[] = [];
  for (const file of files) {
    let content: Buffer;
    try {
      content = fs.readFileSync(file.abs);
    } catch (error) {
      return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', file.rel, `A candidate file cannot be read (${errorCode(error)}): ${file.rel}`) };
    }
    if (content.length !== file.size) return { kind: 'unavailable', finding: finding('CANDIDATE_DRIFT', file.rel, `${file.rel} changed while the inventory was taken.`) };
    // Review finding F7: the fatal-TextDecoder rule of the two checker scripts. A file that is not valid UTF-8 makes
    // the whole run fail (exit 1): FRONTMATTER_INVALID when it is SKILL.md, a LAYOUT finding naming any other file.
    if (!validUtf8(content)) {
      const message = file.rel === 'SKILL.md'
        ? 'SKILL.md is not valid UTF-8, so its front matter is not readable text.'
        : `${file.rel} is not valid UTF-8, so its bytes are not text a gate can read.`;
      notUtf8.push(finding(file.rel === 'SKILL.md' ? 'FRONTMATTER_INVALID' : 'LAYOUT', file.rel, message));
    }
    items.push({ path: file.rel, kind: 'file', bytes: content.length, sha256: sha256(content) });
    bytes.set(file.rel, content);
  }
  // The exact name SKILL.md (a case-insensitive filesystem can find skill.md above) is what the gates read.
  if (!bytes.has('SKILL.md')) return { kind: 'unavailable', finding: finding('INPUT_UNAVAILABLE', 'SKILL.md', `SKILL.md (this exact name) is missing from the candidate folder, so it is not a Skill folder: ${root}`) };
  if (notUtf8.length > 0) return { kind: 'rejected', findings: notUtf8 };
  items.sort(byPath);
  return { kind: 'ok', inventory: { items, bytes } };
}

// ---------------------------------------------------------------------------------------------
// SKILL.md links that leave the candidate folder
// ---------------------------------------------------------------------------------------------

const MAX_ESCAPING_LINKS = 32;
/** The target of a markdown inline link: `](target)`, `](target "title")`, `](<target>)`. */
const LINK_TARGET = /\]\(\s*<?([^)\s>]*)/g;

function leavesFolder(raw: string, keepQuery = false): boolean {
  const slashed = (keepQuery ? raw : raw.replace(/[?#].*$/, '')).replace(/\\/g, '/');
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
  // The targets the layout gate itself looks up, read with its own pattern: a character the pattern above stops at (a `>`, say)
  // cannot hide a `..` from this check while the gate still sees it. The query part is kept: a `?` is an ordinary character there.
  for (const target of supportLinkTargets(skillText)) {
    if (found.size >= MAX_ESCAPING_LINKS) break;
    if (leavesFolder(target, true)) found.add(target);
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

/** The own keys of a metadata mapping that spell `name` in any letter case, ignoring surrounding whitespace. */
const keysNamed = (md: Record<string, unknown>, name: string): string[] => Object.keys(md).filter(key => key.trim().toLowerCase() === name.toLowerCase());
const hasKey = (md: Record<string, unknown>, name: string): boolean => keysNamed(md, name).length > 0;

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

/** Plan 033 P9 (`private-owner`): an original Skill by another author; like the original policy, it declares no upstream at all. */
function privatePolicyFindings(meta: Record<string, unknown>): SkillCheckFinding[] {
  const out: SkillCheckFinding[] = [];
  const problem = (message: string): void => { out.push(finding('PRIVATE_POLICY', 'SKILL.md', message)); };
  const block = meta.metadata;
  if (block === null || typeof block !== 'object' || Array.isArray(block)) {
    problem('metadata is missing: the private-owner policy needs metadata.author, metadata.version and metadata.license.');
    return out;
  }
  const md = block as Record<string, unknown>;
  if (typeof md.author !== 'string' || md.author.trim() === '') problem('metadata.author must be a non-empty string naming the Skill\'s real owner, and not agents-united.');
  else if (md.author.trim().toLowerCase() === 'agents-united') problem('metadata.author is agents-united; an original Agents United Skill is checked under the agents-united-original policy.');
  const version = md.version;
  if (!((typeof version === 'string' && version.trim() !== '') || (typeof version === 'number' && Number.isFinite(version)))) problem('metadata.version is missing.');
  if (typeof md.license !== 'string' || md.license.trim() === '') problem('metadata.license is missing.');
  // The key itself is the declaration: in any letter case, and whatever it holds (false, an empty string and null included).
  if (hasKey(md, 'source')) problem('A privately owned Skill declares no metadata.source (an upstream makes it an adaptation, which is the adapted-source policy).');
  if (hasKey(md, 'adaptedFrom')) problem('A privately owned Skill declares no metadata.adaptedFrom (an upstream makes it an adaptation, which is the adapted-source policy).');
  if (hasKey(md, 'commit')) problem('A privately owned Skill declares no metadata.commit (a pinned upstream commit makes it an adaptation, which is the adapted-source policy).');
  return out;
}

/**
 * True when the path of a source URL names this repository (NeoAnthropocene/agents-united), whatever the letter case, however many
 * times its slash is percent-encoded and however many slashes separate the two names. Decoding stops after four rounds.
 */
function namesThisRepository(url: URL): boolean {
  let text = url.pathname;
  for (let round = 0; round < 4; round += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(text);
    } catch {
      break;
    }
    if (decoded === text) break;
    text = decoded;
  }
  return /neoanthropocene\/agents-united/i.test(text.replace(/\/{2,}/g, '/'));
}

const SOURCE_PROBLEMS: Record<'whitespace' | 'not-a-url' | 'not-https' | 'user-info', string> = {
  whitespace: 'metadata.source must be one URL with no whitespace in it.',
  'not-a-url': 'metadata.source must be an https:// URL (the upstream the Skill was adapted from); this value does not parse as a URL.',
  'not-https': 'metadata.source must use the https: scheme (the upstream URL the Skill was adapted from).',
  'user-info': 'metadata.source must not carry a user name or a password in the URL.',
};

/** Plan 033 P9 (`adapted-source`): a Skill adapted from one pinned upstream commit, its adaptation by another author. */
function adaptedPolicyFindings(meta: Record<string, unknown>): SkillCheckFinding[] {
  const out: SkillCheckFinding[] = [];
  const problem = (message: string): void => { out.push(finding('ADAPTED_POLICY', 'SKILL.md', message)); };
  const block = meta.metadata;
  if (block === null || typeof block !== 'object' || Array.isArray(block)) {
    problem('metadata is missing: the adapted-source policy needs metadata.author, metadata.version, metadata.license and metadata.source.');
    return out;
  }
  const md = block as Record<string, unknown>;
  if (typeof md.author !== 'string' || md.author.trim() === '') problem('metadata.author must be a non-empty string naming who made the adaptation, and not agents-united.');
  else if (md.author.trim().toLowerCase() === 'agents-united') problem('metadata.author is agents-united; an original Agents United Skill is checked under the agents-united-original policy.');
  const version = md.version;
  if (!((typeof version === 'string' && version.trim() !== '') || (typeof version === 'number' && Number.isFinite(version)))) problem('metadata.version is missing.');
  if (typeof md.license !== 'string' || md.license.trim() === '') problem('metadata.license is missing.');
  const source = md.source;
  if (!present(source)) problem('metadata.source is missing: the adapted-source policy names the upstream commit the Skill was adapted from.');
  else if (typeof source !== 'string') problem(`metadata.source must be a string carrying an https:// upstream URL and its 40-character lowercase commit SHA, is ${JSON.stringify(source)}.`);
  else {
    // Plan 033 P12: the source is read as a URL (https:, no user-info) whose path pins the commit as a whole segment.
    const parsed = parseSource(source);
    if (!parsed.ok) problem(SOURCE_PROBLEMS[parsed.reason]);
    else {
      const sha = parsed.commit;
      if (sha === null) problem('metadata.source must carry the 40-character lowercase hexadecimal commit SHA of the upstream commit as a whole segment of its path.');
      // The first-party pattern `isThirdPartySource` in skill-quality.ts uses, on the raw text, and on the decoded path: this repository is not a third-party upstream.
      if (/NeoAnthropocene\/agents-united/i.test(source) || namesThisRepository(parsed.url)) problem('metadata.source names this repository (NeoAnthropocene/agents-united): the adapted-source policy is for a third-party upstream, and this project\'s own Skills are checked under the agents-united-original policy.');
      // A commit key (in any letter case) that is present must equal the SHA, whatever it holds: false, an empty string, null or a number is a mismatch.
      if (sha !== null) {
        for (const key of keysNamed(md, 'commit')) {
          if (md[key] !== sha) problem(`metadata.commit, when present, must be exactly the 40-character commit SHA of metadata.source (${sha}).`);
        }
      }
    }
  }
  if (present(md.adaptedFrom) && (typeof md.adaptedFrom !== 'string' || md.adaptedFrom.trim() === '')) problem('metadata.adaptedFrom, when present, must be a non-empty string naming the upstream Skill.');
  return out;
}

const LICENCE_OR_NOTICE_FILE = /^(?:LICEN[CS]E(?:\.(?:md|txt))?|NOTICE\.md)$/i;

/**
 * The inventoried files that count as supporting files for the adapted-source STUB rule: not SKILL.md, not empty, not a top-level
 * licence file or NOTICE.md (either case), not under evals/. Computed from the vetted inventory, not from a second walk of the disk.
 */
function countSupportingFiles(items: SkillCheckInventoryItem[]): number {
  return items.filter(item => item.path !== 'SKILL.md' && item.bytes > 0 && !LICENCE_OR_NOTICE_FILE.test(item.path) && !item.path.toLowerCase().startsWith('evals/')).length;
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

function runGates(artifact: string, inventory: Inventoried, corpus: CorpusOutcome, policy: SkillCheckPolicy): SkillCheckGate[] {
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
    // The metadata rule of the declared authorship policy (Plan 033 P9); the gates below read the same front matter their own way.
    const policyFindings = policy === 'agents-united-original'
      ? originalPolicyFindings(meta)
      : policy === 'private-owner' ? privatePolicyFindings(meta) : adaptedPolicyFindings(meta);
    checks.push(policyFindings.length === 0 ? gate('metadata', 'passed', null) : gate('metadata', 'failed', null, policyFindings));
    checks.push(runGate('contract', 'CONTRACT', 'SKILL.md', policy === 'agents-united-original'
      ? () => validateRewrittenSkill(dirName, raw, supportingText(resolved))
      // The licence-carrying policies: the author and source rules are the metadata gate's business here, and top-level
      // licence or notice prose is no substitute for substance (the excludeTopLevelNotices option of supportingText).
      : () => validateRewrittenSkill(
        dirName, raw, supportingText(resolved, { excludeTopLevelNotices: true }),
        policy === 'private-owner' ? { requireProjectAuthor: false, forbidSource: true } : { requireProjectAuthor: false, forbidSource: false },
      )));
    checks.push(runGate('layout', 'LAYOUT', null, () => checkSkillLayout(parent, dirName)));
    checks.push(runGate('portability', 'PORTABILITY', null, () => lintSkillPortability({
      dirName, name: plainText(meta.name ?? ''), body, scripts,
    })));
    const licenceInput = {
      dirName,
      license: typeof md.license === 'string' ? md.license : undefined,
      source: typeof md.source === 'string' ? md.source : undefined,
    };
    checks.push(runGate('licence', 'LICENCE', null, policy === 'agents-united-original'
      ? () => lintSkillLicence({ ...licenceInput, files })
      // The files, their byte sizes and the notice text come from the inventory this run already vetted: the notice is
      // decoded from those same bytes, never from a second read of the disk (Plan 033 P9).
      : () => lintSkillPolicyLicence(policy, {
        ...licenceInput,
        files: inventory.items.map(item => ({ path: item.path, bytes: item.bytes })),
        noticeText: inventory.bytes.get('NOTICE.md')?.toString('utf8'),
      })));
  }

  if (corpus.kind !== 'ok') {
    checks.push(gate('frozen-corpus', 'unavailable', corpus.kind === 'mismatch' ? 'The supplied corpus is not the reviewed frozen corpus.' : 'The frozen corpus could not be read.'));
  } else {
    try {
      const measure = measureSkill(parent, dirName, corpus.lines);
      // Plan 033 P9: under adapted-source, a candidate whose verdict would be ok only because it declares an upstream
      // source (extraFiles === 0 and few content lines) is still a stub — an attribution is not substance.
      const real = verdictOf(measure);
      // Under adapted-source the files that make a short Skill more than an attribution are the real supporting files: a
      // top-level licence file, NOTICE.md and evals/ are required by the policy or the layout gate, and an empty file says nothing.
      const supporting = policy === 'adapted-source' ? countSupportingFiles(inventory.items) : measure.extraFiles;
      const verdict = real === 'ok' && policy === 'adapted-source' && measure.thirdParty && supporting === 0 && measure.lines < STUB_MAX_LINES ? 'stub' : real;
      const shown = { lines: measure.lines, templatedLines: measure.templatedLines, share: measure.share, extraFiles: measure.extraFiles, thirdParty: measure.thirdParty, verdict };
      if (verdict === 'ok') checks.push(gate('frozen-corpus', 'passed', null, [], shown));
      else if (verdict === 'templated') {
        checks.push(gate('frozen-corpus', 'failed', null, [finding('TEMPLATED', 'SKILL.md', `${dirName}: ${measure.templatedLines} of ${measure.lines} content lines (${(measure.share * 100).toFixed(1)}%) are lines of the frozen boilerplate corpus (threshold ${TEMPLATED_THRESHOLD * 100}%).`)], shown));
      } else {
        checks.push(gate('frozen-corpus', 'failed', null, [finding('STUB', 'SKILL.md', `${dirName}: ${measure.lines} content lines (a Skill under ${STUB_MAX_LINES} lines needs supporting files) and ${supporting} supporting files.`)], shown));
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
  if (policy === undefined) usage.push(`--policy <name> is required (supported: ${SKILL_CHECK_POLICIES.join(', ')}).`);
  // Review finding F13: the traversal-alias rule of the two registry checker scripts — a `.` or `..` segment makes
  // the folder the argument names depend on how the caller resolves it, so such an argument never reaches the disk.
  if (artifact !== undefined && path.isAbsolute(artifact) && hasTraversalAlias(artifact)) usage.push('--artifact must be an absolute path without . or .. segments.');
  if (corpusPath !== undefined && path.isAbsolute(corpusPath) && hasTraversalAlias(corpusPath)) usage.push('--corpus must be an absolute path without . or .. segments.');
  const echo = { artifact: artifact ?? null, policy: policy ?? null, corpusPath: corpusPath ?? null };
  if (usage.length > 0) return finish(draftOf({ ...echo, checks: idleChecks('not-run', 'The invocation was not valid, so no gate ran.'), before: usage.map(message => finding('USAGE', null, message)) }));
  if (policy === undefined || !(SKILL_CHECK_POLICIES as readonly string[]).includes(policy)) {
    return finish(draftOf({
      ...echo,
      checks: idleChecks('not-run', `The policy is not supported, so no gate ran.`),
      before: [finding('POLICY_UNSUPPORTED', null, `Policy ${JSON.stringify(policy)} is not supported; the supported policies are ${SKILL_CHECK_POLICIES.join(', ')}.`)],
    }));
  }
  // The check above ran against the flat list, so the narrowing to the union is written out by hand.
  const policyValue = policy as SkillCheckPolicy;

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

  const checks = withoutYamlWarnings(() => runGates(artifact!, first.inventory, corpus, policyValue));
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
