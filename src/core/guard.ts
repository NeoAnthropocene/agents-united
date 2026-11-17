/**
 * Plan 022 H5 / Plan 023 A0 — the managed PreToolUse guard, single-sourced for every lane that
 * wires it (role frontmatter today; the plain-session settings entry in Plan 023 A1–A2).
 *
 * Verified against the Claude Code references: frontmatter hooks fire for spawned subagents and
 * for `--agent` main sessions; a command hook exiting 2 blocks the call and its stderr is shown as
 * the reason. EXEC FORM (Plan 023 A0): `command` + `args` is spawned directly with no shell. The
 * earlier shell form (`node -e '<js>'`) runs under PowerShell on Windows without Git Bash, whose
 * native-argument quoting can mangle the script and let the guarded command through (fail open).
 * The script blocks `git push --force`/`-f` (not `--force-with-lease`), `vercel --prod`, and
 * `.env*` writes (not `.env.example`) via Write, Edit or MultiEdit (target in `tool_input.file_path`), NotebookEdit (target in
 * `tool_input.notebook_path`; the script reads `file_path`, else `notebook_path`) or a shell redirect.
 *
 * Input it cannot read (empty or white space, not JSON, or JSON that is not an object) is blocked with exit 2 and a message that
 * starts `Blocked by agents-united guard: unreadable hook input` (the maintainer's decision of 2026-11-17). A BOM is trimmed first.
 * A valid object, including `{}` and one without `tool_input`, is read as before.
 *
 * Testing this by hand? Asking a session hypothetically tests the model, not the hook — see
 * `docs/guard-testing.md` (Plan 024 S5) for a model-proof test protocol.
 */
export function guardScript(): string {
  // The session guard (`session-guard.ts`) does not call this with text: it builds its script by inserting its hint after the unreadable-input sentence of GUARD_SCRIPT.
  return String.raw`let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let i;try{i=JSON.parse(s.trim())}catch(e){}if(i===null||typeof i!=="object"||Array.isArray(i)){process.stderr.write("Blocked by agents-united guard: unreadable hook input. The input of this tool call could not be read, so the guard cannot tell whether it is safe.\n");process.exit(2)}const t=i.tool_input||{},c=String(t.command||""),f=String(t.file_path||t.notebook_path||"").replace(/\\/g,"/");let r="";if(/\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/.test(c))r="git push --force";else if(/\bvercel\b[^;&|]*--prod\b/.test(c))r="vercel --prod";else if(/(^|\/)\.env(\.(?!example$)[^\/]+)?$/.test(f)||/>\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/.test(c))r="a .env write";if(r){process.stderr.write("Blocked by agents-united guard: "+r+" requires explicit human approval outside the agent session.\n");process.exit(2)}})`;
}

/** The generic script: the role guards and the legacy inline form carry exactly this text. */
export const GUARD_SCRIPT = guardScript();

/**
 * The destructive guard script as it was before it blocked unreadable input (the maintainer's decision of 2026-11-17), kept so that an
 * entry written by that version is recognised as ours and renewed. Same ownership marker as the current script. The one list: the session
 * guard (`session-guard.ts`) and the native role check (`native-guard.ts`) both read it.
 */
export const EARLIER_GUARD_SCRIPTS: readonly string[] = [
  // [0] before the unreadable-input change; [1] the script that blocked unreadable input but read only `tool_input.file_path`
  // (a NotebookEdit to a protected path went through, because it sends `notebook_path`).
  String.raw`let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let i={};try{i=JSON.parse(s)}catch(e){}const t=i.tool_input||{},c=String(t.command||""),f=String(t.file_path||"").replace(/\\/g,"/");let r="";if(/\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/.test(c))r="git push --force";else if(/\bvercel\b[^;&|]*--prod\b/.test(c))r="vercel --prod";else if(/(^|\/)\.env(\.(?!example$)[^\/]+)?$/.test(f)||/>\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/.test(c))r="a .env write";if(r){process.stderr.write("Blocked by agents-united guard: "+r+" requires explicit human approval outside the agent session.\n");process.exit(2)}})`,
  String.raw`let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let i;try{i=JSON.parse(s.trim())}catch(e){}if(i===null||typeof i!=="object"||Array.isArray(i)){process.stderr.write("Blocked by agents-united guard: unreadable hook input. The input of this tool call could not be read, so the guard cannot tell whether it is safe.\n");process.exit(2)}const t=i.tool_input||{},c=String(t.command||""),f=String(t.file_path||"").replace(/\\/g,"/");let r="";if(/\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/.test(c))r="git push --force";else if(/\bvercel\b[^;&|]*--prod\b/.test(c))r="vercel --prod";else if(/(^|\/)\.env(\.(?!example$)[^\/]+)?$/.test(f)||/>\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/.test(c))r="a .env write";if(r){process.stderr.write("Blocked by agents-united guard: "+r+" requires explicit human approval outside the agent session.\n");process.exit(2)}})`,
];

/** Text every version of the destructive guard script carries: the ownership marker (the read-only guard says "read-only guard", so it never matches). */
export const GUARD_OWNERSHIP_MARKER = 'Blocked by agents-united guard';

/**
 * The exec-form handler: `node -e <script>`, no shell on any OS. It carries `onFailure: 'block'` (Claude Code 2.1.295 or later; the
 * maintainer's decision of 2026-11-17): the legacy inline form and the settings-level session guard block when the script cannot run.
 */
export function guardHandler(): FailClosedHandler {
  return { type: 'command', command: 'node', args: ['-e', GUARD_SCRIPT], onFailure: 'block' };
}

/** The PreToolUse groups every guarded surface carries. */
export function managedGuardHooks(): { PreToolUse: Array<{ matcher: string; hooks: ReturnType<typeof guardHandler>[] }> } {
  return {
    PreToolUse: [
      { matcher: 'Bash', hooks: [guardHandler()] },
      { matcher: 'Write|Edit|NotebookEdit', hooks: [guardHandler()] },
    ],
  };
}

/** The two native Claude guards: the destructive-command guard (writers) and the read-only guard (roles that never mutate). */
export type NativeGuardKind = 'destructive' | 'read-only' | 'mode-line';

/**
 * Plan 032 close-out follow-up (6) — the native lane ships each guard as a script file under `.claude/hooks/`, because Claude prints
 * the whole `node -e <script>` in every block message (about 600 characters, which also reaches the model). The file is the same
 * script byte for byte (`registry/hosts/claude/hooks/<name>.js` is generated from `GUARD_SCRIPT` / `READ_ONLY_GUARD_SCRIPT` and a
 * test ties them). The role names it with `${CLAUDE_PROJECT_DIR}`, the only path placeholder a user-owned script can use, so a GLOBAL
 * install (roles in `~/.claude/agents`, where that placeholder is whichever project is open) keeps the inline guard instead.
 * A hook whose script cannot start does not block by default (it fails open). The native guard handlers therefore carry
 * `onFailure: 'block'` (Claude Code 2.1.295 or later): a guard whose script cannot run blocks the calls it guards, so the doctor still
 * warns when the file is gone (the role's shell and write tools are blocked until it is restored). The mode-line gate does not carry it.
 */
export const NATIVE_GUARD_FILES: Record<NativeGuardKind, { name: string; rel: string; reference: string }> = {
  destructive: {
    name: 'agents-united-guard',
    rel: '.claude/hooks/agents-united-guard.js',
    reference: '${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-guard.js',
  },
  'read-only': {
    name: 'agents-united-readonly-guard',
    rel: '.claude/hooks/agents-united-readonly-guard.js',
    reference: '${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-readonly-guard.js',
  },
  // Plan 035 N2 slice (e): not a guard of what a role may do but a gate on the lead's first message (`mode-line-gate.ts`); it rides on the same
  // script-file machinery, so it is installed, refcounted, uninstalled and checked by the doctor like the other two.
  'mode-line': {
    name: 'agents-united-mode-line-gate',
    rel: '.claude/hooks/agents-united-mode-line-gate.js',
    reference: '${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-mode-line-gate.js',
  },
};

/** Claude Code release that introduced the hook handler field `onFailure` (host-library/claude/pages/hook/hooks.md). */
export const GUARD_ON_FAILURE_MIN_VERSION = '2.1.295';

/** A native guard handler: the exec-form command plus `onFailure: 'block'` (a failed or timed-out hook blocks the call), last in key order. */
export interface FailClosedHandler { type: 'command'; command: string; args: string[]; onFailure: 'block' }

/**
 * The exec-form handler that runs a guard script file: `node <file>`, no shell on any OS. The two guards block when their hook cannot run (`onFailure: 'block'`); the destructive guard also blocks (exit 2) a payload it cannot read, as the read-only guard does (the maintainer's decision of 2026-11-17);
 * the mode-line gate does not: it is not a guard of what a role may do, and a lead whose gate script is missing could make no tool call at all.
 */
export function guardFileHandler(kind: 'destructive' | 'read-only'): FailClosedHandler;
export function guardFileHandler(kind: NativeGuardKind): { type: 'command'; command: string; args: string[]; onFailure?: 'block' };
export function guardFileHandler(kind: NativeGuardKind): { type: 'command'; command: string; args: string[]; onFailure?: 'block' } {
  const handler = { type: 'command' as const, command: 'node', args: [NATIVE_GUARD_FILES[kind].reference] };
  return kind === 'mode-line' ? handler : { ...handler, onFailure: 'block' };
}

/** The inline (`node -e`) form of the destructive-command guard for native agents: the file handler's fail-closed field, the script embedded. */
export function nativeGuardHandler(): FailClosedHandler {
  return guardHandler();
}

/** The destructive-command guard of a native agent, as a script file (project scope): the matchers of `nativeGuardHooks`, a file handler. */
export function nativeGuardFileHooks(): { PreToolUse: Array<{ matcher: string; hooks: FailClosedHandler[] }> } {
  return { PreToolUse: nativeGuardHooks().PreToolUse.map(group => ({ matcher: group.matcher, hooks: [guardFileHandler('destructive')] })) };
}

/**
 * Plan 032 PR E — the destructive-command guard for native agents: same script and exec form, but the shell matcher
 * also covers `PowerShell` (a class-derived grant holds it on Windows, and the legacy `Bash`-only matcher would let a
 * forced push through it). `managedGuardHooks` stays as is: the legacy projection goldens pin it.
 */
export function nativeGuardHooks(): { PreToolUse: Array<{ matcher: string; hooks: FailClosedHandler[] }> } {
  return {
    PreToolUse: [
      { matcher: 'Bash|PowerShell', hooks: [nativeGuardHandler()] },
      { matcher: 'Write|Edit|MultiEdit|NotebookEdit', hooks: [nativeGuardHandler()] },
    ],
  };
}
