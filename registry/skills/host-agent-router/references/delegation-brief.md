# Delegation brief and review

The worker sees only its prompt: not this conversation, not the plan, not what you already tried. The brief is the whole job; the report it
returns is the only account of what happened until you check the tree. The router adds the worker contract ([worker-contract.md](worker-contract.md):
the `git-guardrails` rules, then a `handoff` report) to every edit run, so the brief carries the task, not the housekeeping.

An edit run is a normal use: one specific task per worker, with the guardrails, in its own worktree. The access default stays `read-only`;
`--access edit` is what you pass when you delegate a change, after a `--dry-run`, never to ask a question. Name the skills that will help
with `--skill <name>` (up to three; a worktree does not inherit installed skills) instead of pasting their text into the brief, and choose a
heavier or lighter setting inside the tier with `--effort` when the job calls for it; the worker contract is unchanged by either.

A worker with room to explore will use it: a real-repository run (2026-11-13) was asked for one file and ran `npm ci`, the type check and two test files as well, 349 s in all. Say what not to run.
On Windows, Antigravity's sandbox did not have `node` on its PATH (the router now also allows the full-path form of an allowed `.exe` program, not a `.cmd` such as `npm`), and Codex's Windows sandbox refused to spawn the test runner's child processes (`EPERM`). A worker's "not run" is therefore not a failure: run it yourself (the acceptance command), or pick one that starts no child process.

Name the commands the worker needs with `--allow-cmd "<exact command line>"`, usually the acceptance command (`npm test` and `node --test` are
allowed by default). Claude and Antigravity deny every command not on the list, and Antigravity matches the exact line and ends the whole run on
the first denial, so give it the line you want run, not a pattern.

## Brief template

```
Goal: <the outcome in one sentence, not the steps>
Context: <what the worker cannot see: why this is needed, decisions already made, constraints>
Scope, may change: <files or folders; new files by name>
Out of scope, must not touch: <files, folders, config, dependencies, and anything you noticed but do not want fixed here>
Requirements: <behaviour, names, signatures, edge cases, one line each>
Acceptance: <the exact command and the result that means done; ask for the summary line to be quoted>
Do not run: <the repository's whole install, build or test suite, unless the acceptance needs it>
Report: use the `handoff` skill if you have it; reply with the report, do not write a file.
```

Split work so each brief has one goal and a disjoint scope; two workers never share a file.

## Isolate the edit

Give each editing run its own checkout so a half-finished or wrong run is thrown away, not repaired:
`git worktree add <dir> -b task/<name>`, then `--cwd <dir>`. Review there, merge or delete the worktree. Outside git, copy the folder.
The router also reports `changed` (created, modified, deleted, head moved) from its own look at the directory, which does not depend on the worker.

## Review before you accept

1. `ok`, `failure`, `stopped` and `guard`. `stopped` means the attempt changed files and then failed; no other host was started. Decide:
   continue from this tree with a new brief that says what exists, or discard the worktree. `guard.blocked` lists what the guard cancelled
   (the run is not ok even if the host exited 0). `empty` and `denied` mean a host exited 0 having done nothing.
2. Compare the report's "Changed files" with the router's `changed`. A file in one list and not the other means the report is not reliable.
3. Read the diff. Run the acceptance command yourself; do not accept "tests pass" as quoted.
4. Check out-of-scope files and the commit count (`head_moved` true means the worker committed against the brief).
5. Only then integrate, and say in your own report which host and model did the work.
