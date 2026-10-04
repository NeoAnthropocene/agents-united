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

`tests/helpers/claude-host-hooks.ts` is a stand-in for the host's hook rules (allowlist, matcher, `${CLAUDE_PROJECT_DIR}`, exec form, exit 2
blocks) that the tests use to attempt a call against an installed role. It proves what the files say; only a real session proves the host.

## Agent Teams: a teammate is guarded by the settings-level hook only (ADR 0036)

Observed on Claude Code 2.1.288: an in-process teammate that reuses a definition does **not** get the definition's frontmatter hook, but a hook in
`.claude/settings.json` or `.claude/settings.local.json` does fire for it. To test a team, install the guard with `--session-guard` and ask a teammate to
run `echo git push --force` and to write `.env.test`; both must come back refused by the hook, and a teammate with no `Write` in its `tools:` list is never
offered it. Without the settings-level guard the same teammate's calls go through (`agents doctor` warns about it).

## Windows-specific check

The guard renders in **exec form** (`command: "node"`, `args: ["-e", <script>]`, or in a native project install `args: [<script file>]`), so the same
three test commands must still block **identically** on a Windows machine with no Git Bash
installed (Claude Code falls back to PowerShell for shell-form hooks there; exec form has no
shell in the path at all — Plan 024 field finding, `plans/023-…md` Workstream A, Step A0).

## What this does not test

This protocol proves the hook **fires**. It does not exercise:
- **Peer messaging / relay vs. team mode** — see the Plan 022 comms-law tests
  (`tests/subagent-comms.test.ts`) and the field-test log in `plans/024-field-test-fixes.md`.
- **The command-permission preset** (`--permission-preset`, Plan 024 S4) — that is a separate,
  opt-in allowlist in `.claude/settings.local.json`; run `agents doctor` to check its state.
