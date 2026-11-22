import { execFileSync } from 'node:child_process';

/** Runs one command and returns its stdout; throws on a non-zero exit (the shape of execFileSync). */
export type CommandRunner = (command: string, args: string[]) => string;

export interface InstallPackedOptions {
  /** The npm-cli.js that launched the test. */
  npmCli: string;
  /** The --prefix directory the tarball is installed into. */
  prefix: string;
  /** Absolute path of the packed tarball. */
  tarball: string;
  /** Injected in the helper's own unit test; defaults to a real child process. */
  run?: CommandRunner;
  /** Where the one-line retry notice goes; defaults to stderr. */
  warn?: (line: string) => void;
}

const realRunner: CommandRunner = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** Everything a failed child process can tell: its message and both captured streams. */
function failureText(error: unknown): string {
  const e = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  return [e?.message, e?.stdout, e?.stderr].map(part => (part == null ? '' : String(part))).join('\n');
}

const installArgs = (mode: '--offline' | '--prefer-offline', options: InstallPackedOptions): string[] =>
  [options.npmCli, 'install', mode, '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', options.prefix, options.tarball];

export interface PackedTarballEntry {
  filename: string;
  files: Array<{ path: string }>;
}

/** Normalizes `npm pack --json` output across npm <= 10 (array) and npm >= 11 (object keyed by package name). */
export function parseNpmPackJson(stdout: string): PackedTarballEntry[] {
  const parsed: unknown = JSON.parse(stdout);
  if (Array.isArray(parsed)) return parsed as PackedTarballEntry[];
  if (parsed && typeof parsed === 'object') return Object.values(parsed as Record<string, PackedTarballEntry>);
  throw new Error('Unexpected npm pack --json output shape.');
}

/**
 * Installs a packed tarball into a temp prefix, offline. A lockfile install (`npm ci`) caches the dependency
 * tarballs but not the registry metadata documents that resolving a tarball's dependency ranges needs, so a
 * clean CI machine can fail with ENOTCACHED. Only then is the install retried once with --prefer-offline.
 * Any other failure, and a failure of the retry, is thrown with npm's output in the message.
 */
export function installPackedPackage(options: InstallPackedOptions): void {
  const run = options.run ?? realRunner;
  const warn = options.warn ?? ((line: string) => { process.stderr.write(`${line}\n`); });
  try {
    run(process.execPath, installArgs('--offline', options));
    return;
  } catch (first) {
    const text = failureText(first);
    if (!text.includes('ENOTCACHED')) throw new Error(`npm install --offline failed:\n${text}`);
  }
  warn('packed-package: the offline install needed the registry for dependency metadata (ENOTCACHED); retrying with --prefer-offline');
  try {
    run(process.execPath, installArgs('--prefer-offline', options));
  } catch (second) {
    throw new Error(`npm install --prefer-offline failed after an ENOTCACHED offline attempt:\n${failureText(second)}`);
  }
}
