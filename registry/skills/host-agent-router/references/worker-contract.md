# The worker contract

One contract for every routed worker, on every host: the rules of the `git-guardrails` skill, then a `handoff` report. The router puts the
rules in the prompt of every edit run (the same words for all four hosts), uses each host's own controls to enforce what it can, and keeps
its own record of what changed. A rule in a prompt is a request; a control is enforcement; the record is the check.

## The rules (from `git-guardrails`, plus staying in place)

1. Never push, never force-push. Do not commit: the lead integrates the work after review.
2. Never touch a protected branch (`main`, `master`, `production`, `release/*`).
3. Never read, print or stage a secret (`.env` files, keys, tokens, credentials).
4. Edit only inside the working directory; no global installs; leave no process running; kill none.

## The report (from `handoff`)

The worker's whole reply, in the reply and not in a file: **Done**, **Changed files**, **Checks run** (command and result), **Not done or
blocked**, **Next steps**. A worker that can see the `handoff` skill follows its state-capture and remaining-work steps; one that cannot
still gets the headings from the prompt. The lead compares **Changed files** with the router's `changed`.

## What enforces it, per host (checked on 2026-11-07, Plan 049)

| Host | Control the router uses | Seen live |
|---|---|---|
| Cline | A `PreToolUse` hook in an isolated `--config` directory (with the real `--data-dir`, which keeps the login). It judges every `read_files`, `editor`, `apply_patch` and `run_commands` call and cancels the forbidden ones: push, commit, rebase and the like, reset --hard, clean -f, branch -D, writes or deletes outside the directory or into `.git`, secret files, privilege, global installs, publishing, killing processes, a download piped into a shell, and the same inside `bash -c` and `powershell -Command`. | Asked to `git commit`, the hook cancelled it; Cline exited 0 with `finishReason: "aborted"`, and the router reported the run as failed with `guard.blocked`. A token check, not a shell parser. |
| Claude | `--permission-mode acceptEdits`, `--allowedTools Bash(<cmd>:*)` for the listed commands, `--disallowedTools` for the dangerous ones. | `git commit` denied, an allowed command ran, a write outside the working directory refused. |
| Codex | `-s workspace-write`. On WSL `.git` and everything outside the workspace are read-only. | `git commit`: "Read-only file system" on `.git/index.lock`; outside write refused. The Windows sandbox started in `C:\`, without `node`, so edits go to WSL (`editSide`). |
| Antigravity | `--mode accept-edits --sandbox` and `--settings` with exact `command(<line>)` allow rules. Anything not allowed is denied, and one denial ends the run with exit 0 and no output. | Rules match an exact command line or a program name; wildcards are ignored. |

The commands a worker may run are `workerCommands.allow` in the config plus the lead's `--allow-cmd` (its acceptance command, as an exact
line). `workerCommands.deny` feeds Claude's `--disallowedTools` and the Cline hook.

## What the router gives back

`changed` (created, modified, deleted, `head_moved`) from its own look at the directory; `stopped` when an attempt changed files and then
failed; `guard.blocked` when a tool call was cancelled; `failure` for `limit`, `auth`, `model`, `missing`, `timeout`, `empty`, `denied`,
`guard` or `unfinished`. A run that exited 0 but was blocked, unfinished, denied or silent is not `ok`.

## Getting the two skills to the worker

The prompt carries the rules and the report shape, so a worker without the skills still follows the contract (Claude, in one run, said it
could not see either skill and used the prompt). The skills help where the worker can see them: both ship in every bundle that ships the
router (a test holds that), and installing the bundle globally puts them in the store Cline and Codex read, in `~/.claude/skills`, and in
Antigravity's skills folder. A git worktree does not inherit untracked, installed skill folders, which is one more reason the prompt must
carry the contract.

## Limits

- The Cline hook is conservative token matching: a creative command can pass it. It is why editing belongs in a throwaway worktree, and why `changed` exists.
- Not enforced anywhere: reading files outside the directory that are not secrets, network use by a command that is allowed.
- Not seen live: a Claude or Antigravity denial of a forbidden command in a router run (the controls were checked directly); Codex on Windows.
