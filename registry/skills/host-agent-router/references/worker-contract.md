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
| Cline | A `PreToolUse` hook in an isolated `--config` directory (with the real `--data-dir`, which keeps the login). It judges every `read_files`, `editor`, `apply_patch` and `run_commands` call and cancels the forbidden ones: push, commit, rebase and the like, reset --hard, clean -f, branch -D, writes or deletes outside the directory or into `.git`, secret files, privilege, global installs, publishing, killing processes, a download piped into a shell, and the same inside `bash -c` and `powershell -Command`. | Asked to `git commit`, the hook cancelled it; Cline exited 0 with `finishReason: "aborted"`, and the router reported the run as failed with `guard.blocked`. Seen again on the second machine on 2026-11-13: the worker issued `git commit -am fixed` only when the brief insisted, the hook cancelled it (exit 1, `failure: "guard"`, one `run_commands` entry, HEAD unmoved). A token check, not a shell parser. |
| Claude | `--permission-mode acceptEdits`, `--allowedTools Bash(<cmd>:*)` for the listed commands, `--disallowedTools` for the dangerous ones. | `git commit` denied, an allowed command ran, a write outside the working directory refused. |
| Codex | `-s workspace-write`. On WSL `.git` and everything outside the workspace are read-only. | `git commit`: "Read-only file system" on `.git/index.lock`; outside write refused. The Windows sandbox started in `C:\`, without `node`, so edits go to WSL (`editSide`). |
| Antigravity | `--mode accept-edits --sandbox` and `--settings` with exact `command(<line>)` allow rules. Anything not allowed is denied, and one denial ends the run with exit 0 and no output. | Rules match an exact command line or a program name; wildcards are ignored. The host-level denial was confirmed by a direct call on 2026-11-13 (called directly, outside the router: allow `command(node --test)`, a prompt to run `whoami`; exit 0, `status` `SUCCESS`, empty `response`, `denied_actions` `{"action":"command","display_name":"Bash"}`, and a stderr line that headless mode cannot prompt for the `command` permission). Through the router it was not reached in three attempts on the second machine (two `git commit` briefs, one `whoami` brief): each time the worker declined from the prompt contract, because the router's note lists the allowed commands. On Windows an allowed `.exe` program also gets a full-path rule (see hosts.md). |

The commands a worker may run are `workerCommands.allow` in the config plus the lead's `--allow-cmd` (its acceptance command, as an exact
line). `workerCommands.deny` feeds Claude's `--disallowedTools` and the Cline hook.

The prompt rule is the first line of defence and it held on both hosts it was tried on (2026-11-13): a worker told by the brief to commit declined, on
Cline and on Antigravity, from the contract alone. The host-level control was reached only when the brief insisted, and only Cline's was seen to act.

The Cline hook's block record belongs to the routed run alone. Its path is written into that run's own hook file and is not exported in the
environment: a hook that a worker's commands start (the repository's tests start one, with no policy) inherits the environment, and when the path was
exported it wrote its fail-closed entry into the routed run's record, so correct work was reported as `failure: "guard"` (seen on 2026-11-13). Such a
hook now writes to its own file, or nowhere. The real hook still fails closed when it has no policy, and records that. This closes the accidental route and
adds no secret: a worker that deliberately reached the record's folder could append a false entry (a false `guard`, the safe direction) or try to empty it. The hook
refuses edits and the shell writes it recognises inside a `har-guard-` folder, a token check like the rest, and `changed` (the router's own before and after look at the
directory) does not depend on the record. That was true before this change; the change makes no hiding easier.

## What the router gives back

`changed` (created, modified, deleted, `head_moved`; in a git work tree the paths git ignores are summarised apart as `ignored`, counted in `count`) from its own look at the directory; `stopped` when an attempt changed files and then
failed; `guard.blocked` when a tool call was cancelled; `failure` for `limit`, `auth`, `model`, `missing`, `timeout`, `empty`, `denied`,
`guard` or `unfinished`. A run that exited 0 but was blocked, unfinished, denied or silent is not `ok`.

## Getting the two skills to the worker

The prompt carries the rules and the report shape, so a worker without the skills still follows the contract (Claude, in one run, said it
could not see either skill and used the prompt). The skills help where the worker can see them: both ship in every bundle that ships the
router (a test holds that), and installing the bundle globally puts them in the store Cline and Codex read, in `~/.claude/skills`, and in
Antigravity's skills folder. A git worktree does not inherit untracked, installed skill folders, which is one more reason the prompt must
carry the contract.

## Attaching skills with `--skill`

The lead can name registry skills that will help one worker: `run --skill <name>`, repeated, at most three. The router finds each `SKILL.md`
in the folder beside its own (the skill's folder is `${CLAUDE_SKILL_DIR}`; its siblings sit next to it in `registry/skills/` and in an installed
skills folder) and puts the text into the worker's prompt after the contract, each under a heading of its own, with the front matter removed
and at most 20,000 characters each. Only a skill's `SKILL.md` text is sent, never its `references/` or `scripts/`. An attached skill is guidance:
the contract above it stays first, word for word, and no skill overrides it. `--skill git-guardrails` or `--skill handoff` adds the full text of
that skill and is allowed.

An unknown name, a name with a path separator or `..`, a folder with no `SKILL.md`, a skill over the limit, a fourth skill or a name given twice
is a usage error before any host starts. `--dry-run` lists the skills attached and the size of the prompt each host would get. Cline and
Antigravity take the prompt as a command-line argument, so the router skips them, with the reason, when it would not fit (about 30,000
characters on Windows).

## Limits

- The Cline hook is conservative token matching: a creative command can pass it. It is why editing belongs in a throwaway worktree, and why `changed` exists.
- Not enforced anywhere: reading files outside the directory that are not secrets, network use by a command that is allowed.
- Not seen live: a Claude or Antigravity denial of a forbidden command in a router run (the controls were checked directly; the Antigravity denial was confirmed by a direct call on 2026-11-13, and the router's workers declined first); Codex on Windows beyond two simple-tier runs; a real limit refusal on any host.
- Antigravity's sandbox on Windows: observed directly on 2026-11-13 (called directly, outside the router), `node --version` was permitted but the sandbox's shell did not find `node`, because its PATH lacks the directory of the `node` the lead's shell finds (`C:\nvm4w\nodejs`); the same line with the absolute path, `C:\nvm4w\nodejs\node.exe --version`, ran and returned `v24.19.0`. The router therefore also allows the full-path form of an allowed `.exe` program (hosts.md). A `.cmd` shim such as `npm` is not rewritten: start the acceptance command with `node`, or run it yourself.
