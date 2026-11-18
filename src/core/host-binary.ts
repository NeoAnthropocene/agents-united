import path from 'node:path';
import fs from 'fs-extra';
import { cmdShimRefusalFor, resolveCmdShimTarget } from './cmd-shim.js';
import type { CmdShimHost, CmdShimTarget } from './types.js';

/**
 * One resolver for the host binary of the Claude Code, Cline and Antigravity lanes (see cmd-shim.ts for why a Windows
 * `.cmd` shim is read and never started through `cmd.exe`). The three capability probes used to carry this logic each;
 * what still differs per host is the parameter set below, nothing else.
 *
 * Order: an absolute, existing `<ENV>_BIN_PATH` wins; then the PATH scan. On Windows the first folder with a hit
 * decides, with the name order `.exe`, `.cmd`, `.bat`, bare name (so only an `.exe` beside an unreadable shim wins
 * over it, and a later folder never wins over an unreadable shim). On other platforms the bare name is the only name.
 */

/** Where a resolved command came from; the Antigravity union has no `node-wrapper` member. */
export type HostBinarySource = 'env-binary' | 'node-wrapper' | 'path-executable';

export interface PlainHostBinarySpec {
  /** The binary's base name: `claude`, `cline`, `agy`. The PATH scan tries `<name>.exe`, `<name>.cmd`, `<name>.bat`, `<name>`. */
  binaryName: string;
  /** The environment variable naming the binary, e.g. `CLAUDE_BIN_PATH`. */
  envVar: string;
}

/** A host whose npm install can leave a Node script beside the shim (`node_modules/...`), which is then run on the current Node. */
export interface WrappedHostBinarySpec extends PlainHostBinarySpec {
  /** Path segments under the PATH folder, checked in order for any name hit, before the shim itself is looked at. */
  adjacentWrappers: ReadonlyArray<readonly string[]>;
  /** The `source` reported for a PATH `.cmd`/`.bat` that was read. */
  shimSource: (target: CmdShimTarget) => 'node-wrapper' | 'path-executable';
}

export type HostBinarySpec = PlainHostBinarySpec | WrappedHostBinarySpec;

export interface PlainHostBinaryCommand {
  executable: string;
  prefixArgs: string[];
  source: 'env-binary' | 'path-executable';
}

export interface WrappedHostBinaryCommand {
  executable: string;
  prefixArgs: string[];
  source: HostBinarySource;
}

/**
 * A `.cmd`/`.bat` that was not read is a `cmd.exe` bridge, as data only: the probe never runs it and the launcher
 * refuses to start a session through it (the plan carries `cmdShimRefusal`).
 */
function shimCommand(shimPath: string, source: HostBinarySource, shimSource?: (target: CmdShimTarget) => HostBinarySource): WrappedHostBinaryCommand {
  const target = resolveCmdShimTarget(shimPath);
  if (target) {
    return { executable: target.executable, prefixArgs: target.prefixArgs, source: shimSource ? shimSource(target) : source };
  }
  return { executable: 'cmd.exe', prefixArgs: ['/c', shimPath], source };
}

function isShimExtension(file: string): boolean {
  return ['.cmd', '.bat'].includes(path.extname(file).toLowerCase());
}

// The wrapped overload comes first: a wrapped spec is also assignable to the plain one, and would otherwise lose 'node-wrapper' from its return type.
export function resolveHostBinary(spec: WrappedHostBinarySpec): WrappedHostBinaryCommand | null;
export function resolveHostBinary(spec: PlainHostBinarySpec): PlainHostBinaryCommand | null;
export function resolveHostBinary(spec: HostBinarySpec): WrappedHostBinaryCommand | null {
  const wrapped = 'adjacentWrappers' in spec ? spec : undefined;

  // 1. Explicit override
  const envBin = process.env[spec.envVar];
  if (envBin && path.isAbsolute(envBin) && fs.existsSync(envBin)) {
    // A .cmd/.bat override cannot be spawned with shell:false (EINVAL): read the program it starts, or keep the
    // cmd.exe bridge as data so the start ends in the same clear refusal as a PATH hit.
    if (process.platform === 'win32' && isShimExtension(envBin)) {
      return shimCommand(envBin, 'env-binary');
    }
    return { executable: envBin, prefixArgs: [], source: 'env-binary' };
  }

  // 2. PATH scanning
  const dirs = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':').filter(Boolean);

  if (process.platform === 'win32') {
    const names = [`${spec.binaryName}.exe`, `${spec.binaryName}.cmd`, `${spec.binaryName}.bat`, spec.binaryName];
    for (const dir of dirs) {
      for (const name of names) {
        const fullPath = path.join(dir, name);
        if (!fs.existsSync(fullPath)) continue;

        // Adjacent Node wrapper in npm / nvm / volta structure
        for (const segments of wrapped?.adjacentWrappers ?? []) {
          const wrapper = path.join(dir, ...segments);
          if (fs.existsSync(wrapper)) {
            return { executable: process.execPath, prefixArgs: [wrapper], source: 'node-wrapper' };
          }
        }

        // Windows hardening (ADR 0013 §5): Node >= 18.20 / 20.12 / 24 rejects spawning .cmd/.bat shims with shell:false (EINVAL).
        if (isShimExtension(fullPath)) {
          return shimCommand(fullPath, 'path-executable', wrapped?.shimSource ?? (() => 'path-executable'));
        }
        return { executable: fullPath, prefixArgs: [], source: 'path-executable' };
      }
    }
    return null;
  }

  for (const dir of dirs) {
    const fullPath = path.join(dir, spec.binaryName);
    if (fs.existsSync(fullPath)) {
      return { executable: fullPath, prefixArgs: [], source: 'path-executable' };
    }
  }
  return null;
}

/**
 * The `cmdShimRefusal` field of an activation plan: the refusal text when the plan would start the host through
 * `cmd.exe /c <shim>`, otherwise an empty object (spread it into the plan).
 */
export function cmdShimRefusalField(host: CmdShimHost, executable: string, argv: readonly string[]): { cmdShimRefusal?: string } {
  const cmdShimRefusal = cmdShimRefusalFor(host, executable, argv);
  return cmdShimRefusal ? { cmdShimRefusal } : {};
}

/** Throw the refusal when a plan would start the host through `cmd.exe /c <shim>`; judged from the plan's own shape, so a fabricated plan is refused too. */
export function assertNoCmdShimBridge(host: CmdShimHost, executable: string, argv: readonly string[]): void {
  const refusal = cmdShimRefusalFor(host, executable, argv);
  if (refusal) throw new Error(refusal);
}
