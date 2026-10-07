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
 * `.env*` writes (not `.env.example`) via Write/Edit/NotebookEdit or a shell redirect.
 *
 * Testing this by hand? Asking a session hypothetically tests the model, not the hook — see
 * `docs/guard-testing.md` (Plan 024 S5) for a model-proof test protocol.
 */
export const GUARD_SCRIPT = String.raw`let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let i={};try{i=JSON.parse(s)}catch(e){}const t=i.tool_input||{},c=String(t.command||""),f=String(t.file_path||"").replace(/\\/g,"/");let r="";if(/\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/.test(c))r="git push --force";else if(/\bvercel\b[^;&|]*--prod\b/.test(c))r="vercel --prod";else if(/(^|\/)\.env(\.(?!example$)[^\/]+)?$/.test(f)||/>\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/.test(c))r="a .env write";if(r){process.stderr.write("Blocked by agents-united guard: "+r+" requires explicit human approval outside the agent session.\n");process.exit(2)}})`;

/** The exec-form handler: `node -e <script>`, no shell on any OS. */
export function guardHandler(): { type: 'command'; command: string; args: string[] } {
  return { type: 'command', command: 'node', args: ['-e', GUARD_SCRIPT] };
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
 * A hook whose script cannot start does not block (it fails open), so the doctor warns when the file is gone.
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

/** The exec-form handler that runs a guard script file: `node <file>`, no shell on any OS. */
export function guardFileHandler(kind: NativeGuardKind): { type: 'command'; command: string; args: string[] } {
  return { type: 'command', command: 'node', args: [NATIVE_GUARD_FILES[kind].reference] };
}

/** The destructive-command guard of a native agent, as a script file (project scope): the matchers of `nativeGuardHooks`, a file handler. */
export function nativeGuardFileHooks(): { PreToolUse: Array<{ matcher: string; hooks: ReturnType<typeof guardFileHandler>[] }> } {
  return { PreToolUse: nativeGuardHooks().PreToolUse.map(group => ({ matcher: group.matcher, hooks: [guardFileHandler('destructive')] })) };
}

/**
 * Plan 032 PR E — the destructive-command guard for native agents: same script and exec form, but the shell matcher
 * also covers `PowerShell` (a class-derived grant holds it on Windows, and the legacy `Bash`-only matcher would let a
 * forced push through it). `managedGuardHooks` stays as is: the legacy projection goldens pin it.
 */
export function nativeGuardHooks(): { PreToolUse: Array<{ matcher: string; hooks: ReturnType<typeof guardHandler>[] }> } {
  return {
    PreToolUse: [
      { matcher: 'Bash|PowerShell', hooks: [guardHandler()] },
      { matcher: 'Write|Edit|MultiEdit|NotebookEdit', hooks: [guardHandler()] },
    ],
  };
}
