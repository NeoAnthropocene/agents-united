import path from 'node:path';
import fs from 'fs-extra';
import { spawnSync } from 'node:child_process';

/**
 * Second spellings of one existing folder, for the tests that prove a root check compares physical paths and not strings: the NTFS 8.3
 * short name where the volume has one (Windows only), another case where the volume ignores case. Each helper looks the spelling up on
 * the real volume and returns undefined when it does not exist, so a test can skip with a clear reason instead of assuming.
 */
export const NO_SHORT = 'NTFS short names exist only on Windows volumes that create them; this one has none';
export const NO_CASE = 'this volume is case-sensitive: another case names another folder';
export const NO_ALT = 'no second spelling of an existing folder on this volume (a short name on Windows, another case on a case-insensitive volume)';

/** The full 8.3 short spelling of an existing path, when it differs from the long one; undefined otherwise. */
export function shortNameOf(file: string): string | undefined {
  if (process.platform !== 'win32') return undefined;
  const short = spawnSync('cmd', ['/d', '/s', '/c', `"for %I in ("${file}") do @echo %~sI"`], { encoding: 'utf8', windowsVerbatimArguments: true }).stdout.trim();
  return short && short.toLowerCase() !== file.toLowerCase() && fs.pathExistsSync(short) ? short : undefined;
}

/** The path with only its last segment in its short name, the parent in its long spelling; undefined where there is no short name. */
export function shortLeafOf(file: string): string | undefined {
  const short = shortNameOf(file);
  if (!short) return undefined;
  const leaf = path.join(path.dirname(file), path.basename(short));
  return leaf.toLowerCase() !== file.toLowerCase() && fs.pathExistsSync(leaf) ? leaf : undefined;
}

/** The path with its last segment in another case, when the volume ignores case; undefined otherwise. */
export function otherCaseOf(file: string): string | undefined {
  const base = path.basename(file);
  const flipped = path.join(path.dirname(file), base === base.toUpperCase() ? base.toLowerCase() : base.toUpperCase());
  return flipped !== file && fs.pathExistsSync(flipped) ? flipped : undefined;
}

/**
 * A second spelling of the last segment of an existing folder: its short name on Windows, else another case where the volume ignores case.
 * lexicallyDistinct: the string must differ even after case folding (the checkers fold case on Windows), so only a short name counts there.
 */
export function altLeafOf(file: string, lexicallyDistinct: boolean): string | undefined {
  if (process.platform === 'win32') {
    const short = shortLeafOf(file);
    if (short || lexicallyDistinct) return short;
  }
  return otherCaseOf(file);
}
