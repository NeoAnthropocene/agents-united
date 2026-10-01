/**
 * Plan 032 PR E — the read-only PreToolUse guard for Claude roles whose Semantic Core never mutates.
 *
 * A tool allowlist already omits the write tools; this guard enforces what an allowlist cannot: a later edit that
 * grants one, a connected server's mutating tool, and a shell. Same delivery as `guard.ts` — EXEC FORM
 * (`node -e <script>`, spawned directly with no shell, so PowerShell quoting cannot mangle it), exit 2 blocks and
 * the stderr text is shown as the reason. Unlike the destructive-command guard it fails CLOSED on unreadable input:
 * its matcher only fires for tools a read-only role must never call.
 */
export const READ_ONLY_GUARD_SCRIPT = String.raw`let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let n="";try{n=String(JSON.parse(s).tool_name||"")}catch(e){process.stderr.write("Blocked by agents-united read-only guard: unreadable hook input.\n");process.exit(2)}const t=n.split("__").pop();if(/^(Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit)$/.test(n)||(/^mcp__/.test(n)&&/^(create|update|delete|push|merge|write|edit|fork|add|remove|set|run|execute|apply|deploy|upload|reset|rebase|restore|cancel|approve|issue_write|sub_issue_write|request)/.test(t))){process.stderr.write("Blocked by agents-united read-only guard: "+n+" would change state, and this role only reads and reports.\n");process.exit(2)}})`;

/** Tools the guard intercepts: every shell and file writer, plus any connected-server tool (the script filters by verb). */
export const READ_ONLY_GUARD_MATCHER = 'Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit|mcp__.*';

export function readOnlyGuardHandler(): { type: 'command'; command: string; args: string[] } {
  return { type: 'command', command: 'node', args: ['-e', READ_ONLY_GUARD_SCRIPT] };
}

export function readOnlyGuardHooks(): { PreToolUse: Array<{ matcher: string; hooks: ReturnType<typeof readOnlyGuardHandler>[] }> } {
  return { PreToolUse: [{ matcher: READ_ONLY_GUARD_MATCHER, hooks: [readOnlyGuardHandler()] }] };
}
