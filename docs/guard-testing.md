# Testing the Managed Guard (Plan 022/023 hook)

> Owner finding, field test (2026-09-27): asking a Claude session hypothetically ("would you run
> `vercel deploy --prod`?") tests the *model's* judgement, not the hook. The model often refuses
> on its own — citing `git-guardrails.md` or its own safety reasoning — before the guard even
> gets a chance to run, or it reasons about what it *would* do without emitting a tool call at
> all. Neither proves the hook fires. This is Plan 024 Step S5.

## The problem

The managed guard (`src/core/guard.ts`) is a `PreToolUse` hook: it only runs when the model
actually attempts a matching tool call. A verbal answer to a hypothetical question never invokes
the hook, so "yes, it would create the file" or "I won't run that" tells you nothing about
whether `.claude/settings.json` or the role's own frontmatter hook is correctly wired.

## The model-proof test

Ask the session to run a command that **matches the guard's patterns** but is otherwise harmless
enough that the model has no reason to refuse it on its own — an `echo` that never touches git,
Vercel, or a real file. The guard's script is a plain string match against the literal command
text, so it fires identically whether the command is real or wrapped in `echo`:

```
echo git push --force
echo x > .env.test
echo vercel deploy --prod
```

Each of these must come back refused by the **hook**, not by the model's own reasoning:

```
Blocked by agents-united guard: git push --force requires explicit human approval outside the agent session.
```

with the tool call's exit code `2`. If the session instead complies (prints the text, or creates
`.env.test`), the guard is **not wired** for that session — check `/hooks` (below) and
`agents doctor`.

A harmless control command should NOT be blocked, to confirm the guard isn't over-blocking:

```
echo hello world
```

### Input the guard cannot read

The destructive guard blocks a call whose hook input it cannot read (the maintainer's decision of 2026-11-17): stdin that is empty or only white space, is not JSON, or is JSON that is not an object (`null`, an array, a string, a number). It exits `2` with a message that starts `Blocked by agents-united guard: unreadable hook input`. A valid object, including `{}` and one without `tool_input`, is read as before, and a byte order mark in front of valid JSON is skipped. To check it offline, pipe such input into the script: `echo null | node .claude/hooks/agents-united-guard.js; echo $?` prints the message and `2`. Claude Code itself always sends a valid object, so this case does not come up in a normal session.

### Why these three specifically

| Command | Matches | Why it's safe to run |
|---|---|---|
| `echo git push --force` | the guard's `git … push … --force` pattern | never actually pushes — `echo` just prints the text |
| `echo x > .env.test` | the guard's `.env` write pattern (shell redirect) | writes to `.env.test`, a throwaway file the pattern also catches; delete it afterward |
| `echo vercel deploy --prod` | the guard's `vercel … --prod` pattern | never actually deploys |

`git push --force-with-lease`, a `.env.example` write, and a plain `vercel deploy` (no `--prod`)
must all be **allowed** — if any of those is blocked too, the guard is over-matching.

## Confirming which hook layer is active

> **Observed on Claude Code 2.1.288 (2026-10-03):** `/hooks` lists settings-file hooks only. In a `claude --agent orchestrator-engineering` session whose guard is in the role's own frontmatter, `/hooks` showed "No hooks configured for this event" for `PreToolUse`, yet the guard blocked `echo git push --force` and `echo x > .env.test` (exit 2, the agents-united message in the tool result) and let `echo hello world` through. So an empty `/hooks` does not mean an unguarded role: use the model-proof commands above, not `/hooks`, to confirm a role's frontmatter guard.

Run `/hooks` inside the session. You should see the agents-united `PreToolUse` entries listed
from at least one of:

- **The role's own frontmatter** (`.claude/agents/<role>.md`) — always present on a projected
  role, fires for that subagent and for a `claude --agent <role>` main session (Plan 022 H5).
- **The workspace settings file** (`.claude/settings.json` or `.claude/settings.local.json`) —
  present only if the workspace opted into the plain-session guard (Plan 023 A, `--session-guard`)
  — fires for **any** session in the repo, including one with no role loaded at all.

A plain `claude` session (no `--agent`, no spawned subagent) is guarded **only** if the settings
entry exists. If `--session-guard` was never requested, `/hooks` will show nothing from
agents-united in a plain session, and that is correct, not a defect — see
`plans/023-storeless-installs-and-session-guard.md` Workstream A.

## Native Claude roles: the guard is a script file (ADR 0035)

With `agents add <bundle> --native` (project scope) a role's frontmatter hook is `node ${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-guard.js`
(writers) or `.../agents-united-readonly-guard.js` (reviewers), so the host's block message is short instead of a 600-character script. The
model-proof commands above are unchanged. Two things to know when a block does not come:

- A hook whose script cannot start does **not** block (the host lets the call through; observed on Claude Code 2.1.288: the command ran and the TUI showed a one-line `PreToolUse:Bash hook error`, exit 1). If `echo git push --force` is not refused, check
  that the script exists: `agents doctor` names a missing one and the command that restores it.
- A **global** install keeps the inline `node -e` form (a user-level role cannot name a script portably), so the long message is expected there.

What the read-only guard refuses (ADR 0038): every shell and file writer, a mutating tool of a connected server, and the six tools that hand work or
output outside the role: `Agent`, `Workflow`, `CronCreate`, `EnterWorktree`, `Artifact` and `SendUserFile`. The coordination tools stay open
(`SendMessage`, `ToolSearch`, `ListAgents`, `SubagentHandback`, the read-only Task and Cron listings). A reviewer is not offered any of them anyway;
the guard is for the day a later edit grants one. The guard of a role installed before the widening stays the narrower one until `agents add --native`
is run again.

`tests/helpers/claude-host-hooks.ts` is a stand-in for the host's hook rules (allowlist, matcher, `${CLAUDE_PROJECT_DIR}`, exec form, exit 2
blocks) that the tests use to attempt a call against an installed role. It proves what the files say; only a real session proves the host.

## Agent Teams: a teammate is guarded by the settings-level hook only (ADR 0036)

Observed on Claude Code 2.1.288: an in-process teammate that reuses a definition does **not** get the definition's frontmatter hook, but a hook in
`.claude/settings.json` or `.claude/settings.local.json` does fire for it. To test a team, install the guard with `--session-guard` and ask a teammate to
run `echo git push --force` and to write `.env.test`; both must come back refused by the hook, and a teammate with no `Write` in its `tools:` list is never
offered it. Without the settings-level guard the same teammate's calls go through (`agents doctor` warns about it).

## The session guard blocks when it cannot do its work: the way out

The session guard has its own script, built from the same template as the role guards plus the two commands that get you out (the maintainer's decision of 2026-11-17). Since 2026-11-18 (ADR 0068, addendum) the script is a file, `.claude/hooks/agents-united-session-guard.js` beside the settings file (`~/.claude/hooks/agents-united-session-guard.js` for the user file), and the settings entries run `node <that path>`: the host prints a hook's whole command line in front of every refusal, and the inline `node -e` form put the script's source in front of every ordinary block. A missing script file is the one case that prints no way-out message (node cannot load it and the host blocks because of `onFailure`); `agents doctor` reports it as `script-missing` with the two commands. When the script throws, or its input is unreadable, it exits `2` with a message that ends in:
`To get out, run one of these in your own terminal, not in this session (this session's shell calls are blocked): agents update --all (repairs the install) or agents update --all --no-session-guard (removes the session guard).` The message of a guard in `~/.claude/settings.json` has one text whichever install wrote it, because that file is shared and two installs must not rewrite each other: `agents update --all --global (repairs the install) or agents update --all --global --no-session-guard (removes the session guard); if a project installed this guard, run the same commands without --global from that project's folder`. The script cannot name the folder (it is the project's, and the file is shared by every project that records a guard in it), so `agents doctor` names it for a project-recorded guard and shows the commands of the lockfile it reads. The two failure messages (unreadable input, an exception in the script) end with the route that needs no working CLI; an ordinary block message, such as the one for a forced push, does not. The route is by kind of file and without an absolute path: `Without the CLI, delete by hand the hook entries that run agents-united-session-guard.js from .claude/settings.json or .claude/settings.local.json in the project, and then delete the script file .claude/hooks/agents-united-session-guard.js in the project.` (project and local files, which share that one script: removing the guard from one of them keeps the script while the other still runs it) or `... from settings.json in the .claude folder of your home directory, and then delete the script file agents-united-session-guard.js in the hooks folder beside it.` (user file); doctor names the exact files. Deleting a project-file entry by hand leaves the lockfile saying the guard is on, so the next plain `agents update` writes it back; to keep it off, run the removal command or record it off. The two commands do less than their labels in four cases: the repair command skips a package whose files were edited by hand (and says so; the removal command still removes the guard then), a guard entry edited by hand is left in place and reported by both, a settings file that is not valid JSON is never rewritten, and a script file that is not ours (edited by hand, or a path that is a folder or cannot be read) is never wired or removed: the repair command writes nothing and renews nothing until it is deleted or restored, a move to another settings file is refused while the script there is not ours, and the removal command leaves that file and says so. The manual route remains in those cases. The removal command reaches only the install of the scope it addresses (the project's without `--global`, the global one with it) and prints which lockfile it changed and which it left. The failure messages and `agents doctor` word the manual route alike, for the file form (the entries that run the script, then the script file); a text that still names "the hook entries that contain 'agents-united guard'" is an earlier text of ours, reads as `script-outdated` and is renewed by `agents update`. To check it offline, pipe unreadable input into the script file: `echo null | node .claude/hooks/agents-united-session-guard.js` prints the message and exits `2`.

The session guard matches `Bash|PowerShell` and `Write|Edit|MultiEdit|NotebookEdit`, the same tools as the role guards, and reads a PowerShell command from `tool_input.command` like a Bash command (the Claude Code hooks reference lists the same field for both). `echo '{"tool_name":"PowerShell","tool_input":{"command":"git push --force"}}' | node .claude/hooks/agents-united-session-guard.js` exits `2`. A guard written with the earlier matchers (`Bash`, `Write|Edit|NotebookEdit`), or with an earlier script (the one that read only `file_path`, or an earlier user-file message), or in the inline `node -e` form, is reported by `agents doctor` as outdated, and `agents update` renews it where it stands.

The destructive script reads the target path from `tool_input.file_path`, else `tool_input.notebook_path`, so a NotebookEdit to `.env` is blocked as a Write is (NotebookEdit sends `notebook_path`; the permissions page of the Claude Code reference lists it). `echo '{"tool_name":"NotebookEdit","tool_input":{"notebook_path":"/repo/.env","new_source":"x"}}' | node .claude/hooks/agents-united-guard.js` exits `2`. A role installed before this change carries the earlier script and does not guard that call until it is installed again.

`~/.claude/settings.json` is shared by the global install and every project that records a guard there. A plain `agents update` or install never re-creates a guard that is entirely absent from it (a way out may have removed it on purpose); `agents doctor` reports it as missing and prints the command that puts it back, `agents update --all --session-guard user` (with `--global` for the global install). An explicit `--session-guard` writes it; a guard that is present but outdated is renewed.

A host that closes the hook's input (end of file, or a pipe closed at once) ends the stream with `end`, so the script blocks (exit `2`). The script would exit `0` only if it destroyed its own stdin, which no host does; this was run, not assumed (`tests/session-guard-way-out.test.ts`).

What the message does not cover: a hook whose `node` cannot be started prints nothing of this kind, and neither do a timeout or a killed process. With `onFailure: "block"` the call is blocked all the same, but the host prints its own failure line, not these commands. A role's own guard (frontmatter, script file) is not affected: it keeps the generic script and its own message.

## Windows-specific check

The guard renders in **exec form** (`command: "node"`, `args: [<script file>]` for the session guard and for a native project install; `args: ["-e", <script>]` only for a role's inline guard, such as a global install's), so the same
three test commands must still block **identically** on a Windows machine with no Git Bash
installed (Claude Code falls back to PowerShell for shell-form hooks there; exec form has no
shell in the path at all — Plan 024 field finding, `plans/023-…md` Workstream A, Step A0).

## What this does not test

This protocol proves the hook **fires**. It does not exercise:
- **Peer messaging / relay vs. team mode** — see the Plan 022 comms-law tests
  (`tests/subagent-comms.test.ts`) and the field-test log in `plans/024-field-test-fixes.md`.
- **The command-permission preset** (`--permission-preset`, Plan 024 S4) — that is a separate,
  opt-in allowlist in `.claude/settings.local.json`; run `agents doctor` to check its state.
