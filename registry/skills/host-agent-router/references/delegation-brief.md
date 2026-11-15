# Delegation brief and review

The worker sees only its prompt: not this conversation, not the plan, not what you already tried. The brief is the whole job; the report it
returns is the only account of what happened until you check the tree. The router adds the worker contract ([worker-contract.md](worker-contract.md):
the `git-guardrails` rules, then a `handoff` report) to every edit run, so the brief carries the task, not the housekeeping.

An edit run is a normal use: one specific task per worker, with the guardrails, in its own worktree. The access default stays `read-only`;
`--access edit` is what you pass when you delegate a change, after a `--dry-run`, never to ask a question. Name the skills that will help
with `--skill <name>` (up to three; a worktree does not inherit installed skills) instead of pasting their text into the brief, and choose a
heavier or lighter setting inside the tier with `--effort` when the job calls for it; the worker contract is unchanged by either.

A worker with room to explore will use it: a real-repository run (2026-11-13) was asked for one file and ran `npm ci`, the type check and two test files as well, 349 s in all. Say what not to run.
Antigravity's sandbox cannot see a program that lives inside the user profile (a Node from nvm, volta or fnm) unless a `read_file` rule mounts its folder read-only (its sandbox docs); the router adds that rule for the folder of each allowed program and the dry run lists it, so `node` is found by its bare name (the full-path form of an allowed `.exe` is also allowed). Codex's Windows sandbox refused to spawn the test runner's child processes (`EPERM`). A worker's "not run" is therefore not a failure: run it yourself (the acceptance command), or pick one that starts no child process.

Name the commands the worker needs with `--allow-cmd "<exact command line>"`, usually the acceptance command (`npm test` and `node --test` are
allowed by default). Claude and Antigravity deny every command not on the list, and Antigravity matches the exact line and ends the whole run on
the first denial, so give it the line you want run, not a pattern. Many long lines also lengthen the command line that carries the prompt (see
`too_long` below); `--allow-cmd-file <file>` takes one line per line and avoids shell quoting.

**Antigravity.** List and number every command line the worker may run, exactly as it must be typed, in the brief and in `--allow-cmd` or `--allow-cmd-file`: the host allows a command only when the whole line matches, so `node node_modules/vitest/vitest.mjs run` does not cover `node node_modules/vitest/vitest.mjs run tests/x.test.ts` (the router refuses such a brief with exit 64, also under `--dry-run`; `--allow-prefix-ok` turns that into a note). Put no environment variable (`FOO=1 npm test`) and no directory change (`cd dir && ...`) in front of a command: that is a different line, and `--cwd` already sets the directory. The shell is not for listing or reading files: tell the worker to use its file tools for that. A drive path such as `C:/work/x` or `D:\work\y` is accepted in an allowed line; any other colon is not. A read-only Antigravity worker can only read files by path, with no listing or search tool, so name every file it should read; do not ask it to search.

## Brief template

```
Goal: <the outcome in one sentence, not the steps>
Context: <what the worker cannot see: why this is needed, decisions already made, constraints>
Scope, may change: <files or folders; new files by name>
Out of scope, must not touch: <files, folders, config, dependencies, and anything you noticed but do not want fixed here>
Requirements: <behaviour, names, signatures, edge cases, one line each>
Acceptance: <the exact command and the result that means done; ask for the summary line to be quoted>
Do not run: <the repository's whole install, build or test suite, unless the acceptance needs it>
Report: use the `handoff` skill if you have it; reply with the report, do not write a file; cite files as repository-relative path:line, never an absolute path.
```

Split work so each brief has one goal and a disjoint scope; two workers never share a file.

## Isolate the edit

Give each editing run its own checkout so a half-finished or wrong run is thrown away, not repaired:
`git worktree add <dir> -b task/<name>`, then `--cwd <dir>`. Review there, merge or delete the worktree. Outside git, copy the folder.
The router also reports `changed` (created, modified, deleted, head moved) from its own look at the directory, which does not depend on the worker.

## Review before you accept

1. `ok`, `failure`, `stopped` and `guard`. `stopped` means the attempt changed files and then failed; no other host was started. Decide:
   continue from this tree with a new brief that says what exists, or discard the worktree. `guard.blocked` lists what the guard cancelled
   (the run is not ok even if the host exited 0). `empty` and `denied` mean a host exited 0 having done nothing. `too_long` means every candidate
   was skipped because its command line would be too long for the host (a long brief, attached skills or many long allowed lines); nothing ran, so
   shorten the brief, attach fewer skills or allow fewer lines. A `--dry-run` shows the same reason as `skip` on each attempt.
2. Compare the report's "Changed files" with the router's `changed`. A file in one list and not the other means the report is not reliable.
3. Read the diff. Run the acceptance command yourself; do not accept "tests pass" as quoted.
4. Check out-of-scope files and the commit count (`head_moved` true means the worker committed against the brief).
5. Only then integrate, and say in your own report which host and model did the work.
