/**
 * Fixture text for the Windows `.cmd` shim tests (Claude and Cline). Every shim here is a plain text file a
 * test writes into a temp folder; nothing starts a real host.
 */

import fs from 'node:fs';
import path from 'node:path';

/** The built command line, or one clear sentence when `npm run build` has not run (instead of a module-not-found stack from node). */
export function builtCliPath(root: string = process.cwd()): string {
  const cli = path.join(root, 'dist', 'cli.js');
  if (!fs.existsSync(cli)) {
    throw new Error(`dist/cli.js is missing: run "npm run build" first (these tests start the built command line).`);
  }
  return cli;
}

/** Temp folder prefix: spaces and parentheses, like "Program Files (x86)". */
export const FOLDER_PREFIX = 'au shim (x86) ';

export interface NpmShimOptions {
  /** `%dp0%` (npm cmd-shim 4 and later) or `%~dp0` in the target. */
  dpForm?: 'dp0' | 'tilde';
  /** The interpreter the shim chooses; anything but node is not a shape the launcher accepts. */
  prog?: 'node' | 'bun';
  /** Tokens written between the interpreter and the script (interpreter flags). */
  flags?: string;
  /** Lines inserted before the interpreter block, as a hand-written wrapper or a NODE_PATH shim would have. */
  extraLines?: string[];
  /** LF line ends instead of CRLF. */
  lf?: boolean;
  /** A UTF-8 byte order mark at the start of the file. */
  bom?: boolean;
}

const PROG_FINAL = 'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & ';

function finish(lines: string[], options: NpmShimOptions): string {
  const text = lines.join(options.lf ? '\n' : '\r\n') + (options.lf ? '\n' : '\r\n');
  return (options.bom ? String.fromCharCode(0xfeff) : '') + text;
}

/** The shape npm's cmd-shim writes for a Node script: the real text of `cline.cmd` and `codex.cmd`. */
export function npmShim(target: string, options: NpmShimOptions = {}): string {
  const base = options.dpForm === 'tilde' ? '%~dp0' : '%dp0%';
  const prog = options.prog ?? 'node';
  return finish([
    '@ECHO off',
    'GOTO start',
    ':find_dp0',
    'SET dp0=%~dp0',
    'EXIT /b',
    ':start',
    'SETLOCAL',
    'CALL :find_dp0',
    ...(options.extraLines ?? []),
    '',
    `IF EXIST "%dp0%\\${prog}.exe" (`,
    `  SET "_prog=%dp0%\\${prog}.exe"`,
    ') ELSE (',
    `  SET "_prog=${prog}"`,
    '  SET PATHEXT=%PATHEXT:;.JS;=;%',
    ')',
    '',
    `${PROG_FINAL}"%_prog%" ${options.flags ? options.flags + ' ' : ' '}"${base}\\${target}" %*`,
  ], options);
}

/** The shape cmd-shim writes for a native program: no interpreter, the program is the line. */
export function exeShim(target: string, withPrefix = true, options: NpmShimOptions = {}): string {
  return finish([
    '@ECHO off',
    'GOTO start',
    ':find_dp0',
    'SET dp0=%~dp0',
    'EXIT /b',
    ':start',
    'SETLOCAL',
    'CALL :find_dp0',
    '',
    `${withPrefix ? PROG_FINAL : ''}"%dp0%\\${target}"   %*`,
  ], options);
}

/** The older cmd-shim shape (npm 6 and earlier): two program lines, one per branch. */
export function oldNpmShim(target: string, flags = ''): string {
  const spec = `${flags ? flags + ' ' : ''}"%~dp0\\${target}"`;
  return [
    '@IF EXIST "%~dp0\\node.exe" (',
    `  "%~dp0\\node.exe"  ${spec} %*`,
    ') ELSE (',
    '  @SETLOCAL',
    '  @SET PATHEXT=%PATHEXT:;.JS;=;%',
    `  node  ${spec} %*`,
    ')',
    '',
  ].join('\r\n');
}

/** A shim that is not an npm shape: nothing in it names a program the launcher can read. */
export const OPAQUE_SHIM = '@echo off\r\nrem not an npm shim\r\ncall helper.bat %*\r\n';

/** A multi-line first message with the characters a command shell treats as special. */
export const PROMPT = [
  'first line with "double quotes" and \'single quotes\'',
  'percent %PATH% and %USERPROFILE% and %%',
  'amp & pipe | caret ^ lt < gt > bang ! paren ( )',
  'backslash \\ and a quote \\" here',
  'unicode héllo ✓ 日本語',
].join('\n');
