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
