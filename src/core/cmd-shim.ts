import path from 'node:path';
import fs from 'fs-extra';
import type { CmdShimHost, CmdShimTarget } from './types.js';

/**
 * How each host is named in a refusal, and the way out that its resolver really accepts:
 *   - Claude Code: `CLAUDE_BIN_PATH` naming a `claude.exe` is spawned directly (the native installer's file), and a
 *     `.cmd` shim of the standard npm shape is read.
 *   - Cline: `CLINE_BIN_PATH` is read as a native executable or a `.cmd` shim of the standard npm shape. Cline is
 *     installed with npm (package `cline`), so no `cline.exe` is assumed; the advice is the npm reinstall.
 */
export const CLAUDE_SHIM_HOST: CmdShimHost = {
  label: 'Claude Code',
  advice: 'Set CLAUDE_BIN_PATH to the full path of claude.exe and run the command again.',
};
export const CLINE_SHIM_HOST: CmdShimHost = {
  label: 'Cline',
  advice:
    'Reinstall Cline with npm (npm install -g cline) so its shim has the standard npm shape, then run the command again. ' +
    'CLINE_BIN_PATH only helps when it names a native Cline executable or a .cmd shim of that standard shape.',
};

/**
 * Windows `.cmd` shims and why a session is never started through one.
 *
 * Node >= 18.20 / 20.12 / 24 refuses to spawn a `.cmd` or `.bat` file with `shell: false` (EINVAL), so the
 * only way to run a shim is `cmd.exe /c <shim> <args>`. That route cannot carry a session's first message:
 *   - `cmd.exe` ends the command string at the first line feed, so a multi-line message is cut to its
 *     first line, and there is no escape that keeps a line feed in a command string;
 *   - `cmd.exe /c` keeps the quotes around the program path only when the whole string holds exactly two
 *     quote characters, and the quoted first message makes more, so a shim path with a space is run up to
 *     its first space; and a path with `&`, `^` or `@` breaks even a bare `--version` (observed by a run).
 * So the launcher reads the program a shim starts (`resolveCmdShimTarget`) and spawns that directly, and
 * refuses a bridge it cannot avoid (`cmdShimRefusalFor`, checked by the launchers, the dry run and doctor).
 *
 * The governing rule is that a wrong silent reading is worse than a refusal: the reader returns null unless
 * it recognises the whole file.
 */

// What the reader accepts, written from the real shims of npm's cmd-shim (cline.cmd, codex.cmd, agents.cmd on the
// maintainer's machine) and the older cmd-shim shape. Every non-blank line must be one of these, so a hand-written
// wrapper (`set`, `cd`, `call`, `if`, `rem`), a `NODE_PATH` assignment, another interpreter (bun, deno, pnpm's node
// wrapper) or an interpreter flag gives null instead of being dropped:
//
//   Node script, cmd-shim 4 and later (npm 7+):
//     @ECHO off / GOTO start / :find_dp0 / SET dp0=%~dp0 / EXIT /b / :start / SETLOCAL / CALL :find_dp0
//     IF EXIST "%dp0%\node.exe" (  SET "_prog=%dp0%\node.exe"  ) ELSE (  SET "_prog=node"  SET PATHEXT=%PATHEXT:;.JS;=;%  )
//     endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\<script>" %*
//   Node script, older cmd-shim (`%~dp0`, one program line per branch):
//     @IF EXIST "%~dp0\node.exe" (  "%~dp0\node.exe"  "%~dp0\<script>" %*  ) ELSE (  @SETLOCAL  @SET PATHEXT=...  node  "%~dp0\<script>" %*  )
//   Native program (no interpreter):
//     the same head, then   [endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & ]"%dp0%\<program>.exe"   %*
//
// Structure: the file must be exactly one of these shapes, line for line and in this order. So the `goto` and `exit` lines
// are accepted only inside the complete head; the only other `goto` is the `endLocal & goto` prefix on the program line
// itself; the `_prog` block is accepted only whole (the IF EXIST gate, the node.exe set, ELSE, the plain-node set, the
// PATHEXT line, the close), never a `SET "_prog=..."` without its gate; and the program line stands outside the block
// (older shape: one program line in each branch, naming the same target). Nothing is added, removed or moved.
//
// Differences from the shim, on purpose: nothing between the interpreter and the script is carried (a flag gives
// null), and a shim that falls back to plain `node` from PATH runs on the running Node (`process.execPath`) here,
// as the adjacent-wrapper branch of the probes already does. A `node.exe` beside the shim is used, as the shim does.
// A byte order mark needs no handling: `trim()` removes U+FEFF with the other white space (the BOM test pins it).
const DP0 = String.raw`(?:%dp0%|%~dp0)`;
const NODE_EXE = String.raw`"${DP0}\\node\.exe"`;
const TARGET = String.raw`"${DP0}\\?([^"%\r\n]+)"`;
const PROG_PREFIX = String.raw`(?:endlocal & goto #_undefined_# 2>nul \|\| title %comspec% & )?`;

/** A line template: an exact line (compared in lower case), or a pattern whose first group, if any, is a target. */
type LineTemplate = string | RegExp;

// The three whole shapes, line by line. A file is accepted only when ALL its non-blank lines match one of them in
// order, so nothing can be added, removed, moved or put in a different branch of the IF block and still be read.
const HEAD: readonly LineTemplate[] = ['echo off', 'goto start', ':find_dp0', 'set dp0=%~dp0', 'exit /b', ':start', 'setlocal', 'call :find_dp0'];
const PATHEXT_LINE = 'set pathext=%pathext:;.js;=;%';
const IF_NODE_EXE = new RegExp(String.raw`^if exist ${NODE_EXE} \($`, 'i');
const SET_PROG_SIDECAR = new RegExp(String.raw`^set "_prog=${DP0}\\node\.exe"$`, 'i');
const SET_PROG_PLAIN = /^set "_prog=node"$/i;
const PROGRAM_SIDECAR_NODE = new RegExp(String.raw`^${NODE_EXE}[ \t]+${TARGET}[ \t]+%\*$`, 'i');
const PROGRAM_PLAIN_NODE = new RegExp(String.raw`^node(?:\.exe)?[ \t]+${TARGET}[ \t]+%\*$`, 'i');
const PROGRAM_PROG_VARIABLE = new RegExp(String.raw`^${PROG_PREFIX}"%_prog%"[ \t]+${TARGET}[ \t]+%\*$`, 'i');
const PROGRAM_NATIVE = new RegExp(String.raw`^${PROG_PREFIX}${TARGET}[ \t]+%\*$`, 'i');

/** Shape A: cmd-shim 4+ for a Node script. The `_prog` block is whole (gate, node.exe, ELSE, plain node, PATHEXT, close), then the program line. */
const SHAPE_NODE_SCRIPT: readonly LineTemplate[] = [...HEAD, IF_NODE_EXE, SET_PROG_SIDECAR, ') else (', SET_PROG_PLAIN, PATHEXT_LINE, ')', PROGRAM_PROG_VARIABLE];
/** Shape B: cmd-shim 4+ for a native program. */
const SHAPE_NATIVE: readonly LineTemplate[] = [...HEAD, PROGRAM_NATIVE];
/** Shape C: the older cmd-shim, one program line per branch of the IF block. */
const SHAPE_OLD_NODE: readonly LineTemplate[] = [IF_NODE_EXE, PROGRAM_SIDECAR_NODE, ') else (', 'setlocal', PATHEXT_LINE, PROGRAM_PLAIN_NODE, ')'];

const NODE_TARGET_EXTENSIONS: ReadonlySet<string> = new Set(['.js', '.cjs', '.mjs', '']);

interface ShimProgram {
  kind: 'node' | 'native';
  /** The target as written, relative to the shim folder. */
  relative: string;
}

/** Match the whole list of lines against one shape; the targets of its program lines, or null when any line differs. */
function matchShape(lines: readonly string[], shape: readonly LineTemplate[]): string[] | null {
  if (lines.length !== shape.length) return null;
  const targets: string[] = [];
  for (let index = 0; index < shape.length; index++) {
    const template = shape[index];
    if (typeof template === 'string') {
      if (lines[index].toLowerCase() !== template) return null;
      continue;
    }
    const match = template.exec(lines[index]);
    if (!match) return null;
    if (match[1] !== undefined) targets.push(match[1]);
  }
  return targets;
}

/** Read the program lines of a whole known shape; null when the file is not exactly one of the shapes. */
function readShimPrograms(text: string): ShimProgram[] | null {
  const lines = text.split(/\r?\n/).map(raw => raw.trim().replace(/^@/, '').trim()).filter(line => line !== '');
  const node = matchShape(lines, SHAPE_NODE_SCRIPT);
  if (node) return node.map(relative => ({ kind: 'node' as const, relative }));
  const native = matchShape(lines, SHAPE_NATIVE);
  if (native) return native.map(relative => ({ kind: 'native' as const, relative }));
  const old = matchShape(lines, SHAPE_OLD_NODE);
  if (old) return old.map(relative => ({ kind: 'node' as const, relative }));
  return null;
}
/**
 * Read the program an npm `.cmd` shim starts, so it can be spawned without `cmd.exe`.
 *
 * Returns `null` (never throws) unless the whole file is a known cmd-shim shape in a known order (see the list above),
 * every program line names the same target, the target is a regular file, and the target fits the interpreter: a
 * native `.exe` for a bare program line, a `.js`/`.cjs`/`.mjs` or extensionless file for `node`. The caller
 * then keeps the `cmd.exe` bridge, which the launchers refuse for a session.
 */
export function resolveCmdShimTarget(shimPath: string): CmdShimTarget | null {
  try {
    const programs = readShimPrograms(fs.readFileSync(shimPath, 'utf8'));
    if (!programs || programs.length === 0) return null;
    const first = programs[0];
    if (!programs.every(program => program.kind === first.kind && program.relative.toLowerCase() === first.relative.toLowerCase())) return null;

    const shimDir = path.dirname(shimPath);
    const target = path.resolve(shimDir, first.relative.split('\\').join(path.sep));
    if (!fs.statSync(target).isFile()) return null;
    const extension = path.extname(target).toLowerCase();

    if (first.kind === 'native') {
      return extension === '.exe' ? { executable: target, prefixArgs: [] } : null;
    }
    if (!NODE_TARGET_EXTENSIONS.has(extension)) return null;
    const nodeBesideShim = path.join(shimDir, 'node.exe');
    return {
      executable: fs.existsSync(nodeBesideShim) ? nodeBesideShim : process.execPath,
      prefixArgs: [target],
    };
  } catch {
    return null;
  }
}

/**
 * True when a plan starts its program as `cmd.exe /c ...` (the `cmd.exe` bridge of an unreadable shim).
 * The check is on the shape only, so it holds on every platform and for a fabricated plan.
 */
export function isCmdShimBridge(executable: string, argv: readonly string[]): boolean {
  const name = path.win32.basename(executable).toLowerCase();
  if (name !== 'cmd' && name !== 'cmd.exe') return false;
  return argv.some(arg => /^\/[ck]$/i.test(arg));
}

/**
 * The refusal text for a plan that would start the host through `cmd.exe /c <shim>`, or `undefined` for any other
 * plan. One place for the text: the plan carries it as data, the launcher throws it, the dry run and doctor print it.
 */
export function cmdShimRefusalFor(host: CmdShimHost, executable: string, argv: readonly string[]): string | undefined {
  if (!isCmdShimBridge(executable, argv)) return undefined;
  const flag = argv.findIndex(arg => /^\/[ck]$/i.test(arg));
  const shim = argv[flag + 1] ?? executable;
  return (
    `${host.label} resolved to the Windows command shim "${shim}", and no program could be read from it. ` +
    `Starting it through cmd.exe would cut the first message at its first line break and fail when the path has a space or an & ^ @ character, so no session is started. ` +
    host.advice
  );
}
