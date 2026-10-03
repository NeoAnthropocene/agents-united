/**
 * Plan 032 Phase 8 — a host binary's own changelog as a changelog source (Antigravity: `agy changelog`).
 *
 * The docs changelog lags the CLI (agy 1.2.16 installed, the docs snapshot at 1.2.11), and `agy changelog` is free: it makes no model
 * call. Its output is `<version>:` followed by `· item` lines, newest first. It is run with fixed arguments and no shell, skipped when
 * the binary is not installed (CI has none), and rendered into the sectioned markdown that `parseChangelog` already reads, so
 * detection, classification, the audit gate and the hash lock need no special case. Maintainer tooling only: never imported by `src/`.
 */
import { spawn } from 'node:child_process';

export type CommandResult = { ok: true; text: string } | { ok: false; missing: boolean; error: string };

/** Runs a binary with fixed arguments and returns what it printed. Injected into check and refresh so tests need no binary. */
export type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandResult>;

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
/** A third-party binary is not handed the maintainer's credentials: variables named like a secret are dropped from its environment. */
const SECRET_NAME = /TOKEN|SECRET|KEY|PASSWORD|PASSWD|CREDENTIAL|AUTH/i;

function cleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !SECRET_NAME.test(name)));
}

/**
 * Run `command` with `args`, no shell: each argument reaches the program as one literal argument. Stdin is closed at once so a binary
 * that waits for input cannot hang, and the run is cut off after `timeoutMs`. A binary that is not installed is `missing`, not an error.
 */
export const execCommand = (command: string, args: readonly string[], options: { timeoutMs?: number } = {}): Promise<CommandResult> =>
  new Promise(resolve => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let settled = false;
    const finish = (result: CommandResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const child = spawn(command, [...args], { shell: false, windowsHide: true, env: cleanEnv(process.env), stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, missing: false, error: `${command} timed out after ${timeoutMs} ms` });
    }, timeoutMs);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let size = 0;
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) {
        child.kill();
        finish({ ok: false, missing: false, error: `${command} printed more than ${MAX_OUTPUT_BYTES} bytes` });
        return;
      }
      out.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', (error: NodeJS.ErrnoException) => {
      finish({ ok: false, missing: error.code === 'ENOENT', error: error.code === 'ENOENT' ? `${command} is not installed (${error.message})` : error.message });
    });
    child.on('close', code => {
      if (code === 0) finish({ ok: true, text: Buffer.concat(out).toString('utf8') });
      else finish({ ok: false, missing: false, error: `${command} exited with status ${code}: ${Buffer.concat(err).toString('utf8').trim().slice(0, 300)}` });
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end();
  });

const VERSION_LINE = /^(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?):\s*$/;
const ITEM = /^·\s?(.*)$/;

/**
 * Render `agy changelog` output as one sectioned changelog (`## <section>` with `### [<version>]`), newest first. Anything before the
 * first version line is dropped; an item becomes a bullet; a line that continues an item stays with it; a markdown heading inside the
 * text becomes a bold line, so release text can never open a version or a section of the changelog.
 */
export function renderAgyChangelog(text: string, options: { section: string }): string {
  const releases: Array<{ version: string; lines: string[] }> = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const version = VERSION_LINE.exec(line.trim());
    if (version) {
      releases.push({ version: version[1], lines: [] });
      continue;
    }
    const current = releases[releases.length - 1];
    if (!current || line.trim() === '') continue;
    const item = ITEM.exec(line.trim());
    if (item) {
      current.lines.push(`- ${item[1]}`);
      continue;
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    current.lines.push(heading ? `**${heading[1]}**` : line);
  }
  if (releases.length === 0) throw new Error('no version line (`<version>:`) in the output, so it is not a changelog');
  const sections = releases.map(release => `### [${release.version}]\n\n${release.lines.join('\n')}\n`);
  return `## ${options.section}\n\n${sections.join('\n')}`.trimEnd() + '\n';
}
