# Host details for host-agent-router

Observed 2026-11-06 on one machine (Windows 11 plus WSL Ubuntu): Claude Code 2.1.319 (both sides), Codex 0.167.0 (Windows app bundle,
WSL standalone), Antigravity `agy` 1.5.2 (WSL only), Cline 3.0.74 (Windows only). Nothing below starts a model: every limit readout is a
local command or an account endpoint the host calls itself.

## How headroom is read

| Host | Source | Notes |
|---|---|---|
| Claude | `claude -p "/usage"` (text) | Rows `Current session` (5-hour) and `Current week (all models)`, as percent used. A model-specific weekly row counts only for that model family. |
| Antigravity | `agy -p "/usage" --output-format json` | Groups with `5h` and `weekly` buckets (`remaining_fraction`). The group is chosen by model prefix (`quotaGroups` in the config). Gemini 4 Argon has a weekly bucket only. |
| Codex | `codex app-server`, JSON-RPC `account/rateLimits/read` | `primary` is 300 minutes (5-hour), `secondary` is 10080 (weekly). If that fails, the newest session log is used and a window whose reset time has passed counts as unused. |
| Cline | none | ClinePass has 5-hour, weekly and monthly limits, shown only on the web dashboard. Headroom is unknown, so Cline is tried first as configured, and a refused request falls through. See "Cline quota" below. |

## What `run` executes

| Host | Command shape | Prompt via |
|---|---|---|
| Claude | `claude -p --model <id> --effort <e> --permission-mode plan\|acceptEdits [--allowedTools Bash(<cmd>:*)... --disallowedTools Bash(<cmd>:*)...] --output-format text` | stdin |
| Codex | `codex exec -m <slug> -c model_reasoning_effort="<e>" -s read-only\|workspace-write --skip-git-repo-check --color never -C <cwd> -` | stdin |
| Antigravity | `agy -p <prompt> --model <slug> --mode plan\|accept-edits [--sandbox --settings '{"permissions":{"allow":["command(<exact line>)"]}}'] --output-format json` (the effort is part of the slug) | argv |
| Cline | `cline [--config <isolated dir with the hook> --data-dir <real data dir>] -P cline-pass -m <id> --thinking <e> --json [--plan] -c <cwd> -- <prompt>` | argv |

`read-only` is Claude `plan`, Codex `read-only`, Antigravity `plan`, Cline `--plan`. `edit` is `acceptEdits`, `workspace-write`, `accept-edits`
and Cline's act mode. No `--dangerously-*` flag is ever passed. On Windows, Cline starts as `node <package entry>`, never through its `.cmd`
shim, so prompt text is not reparsed by `cmd.exe`. The contract every edit run carries, and what enforces it on each host, is in
[worker-contract.md](worker-contract.md).

The hosts differ in what they do without a rule. Codex `workspace-write` is a sandbox. Claude and Antigravity deny every command that is not
allowed. Cline's act mode allows everything, shell commands included (its docs say the CLI has no allow or deny list), so the router gives
each Cline run a `PreToolUse` hook (`guardDecision`) in a throwaway `--config` directory. `--config` alone loses the login (Cline answers
"Unauthorized"), so the real `--data-dir` is passed too; the `--hooks-dir` flag and `CLINE_HOOKS_DIR` did not load a hook in tests. A
cancelled call ends the run with exit 0 and `finishReason: "aborted"`, so the router judges the finish reason and the blocked list, not the exit code.

Cline runs with `--json` so that `output` is the final answer and not the activity log: plain text mode printed 4.6k characters of thinking
and tool calls before a one-file task's report. A run that never reaches its final line (killed, crashed) comes back as a short `partial`
summary (events, iterations, tools used, last words) and not as the raw stream, which filled the 200,000-character cap. Cline's refusal path,
seen once (an unauthorised run): exit 1, a JSON `error` line on stderr, and a `run_result` with `finishReason: "error"` carrying the message.

Antigravity (headless) has its own quirks, all seen live. A command that is not allowed is denied and **ends the run with exit 0, status
SUCCESS and an empty response** (the message is on stderr; `--output-format json` adds `denied_actions`). Its allow rules match an exact command
line or a bare program name (`command(npm test)`, `command(npm)`); wildcards of every form tried are ignored. The router therefore allows exact
lines, tells the worker to run them exactly, and treats an empty or denied exit-0 run as a failure that did no work.

## Editing: what the router does around a run

For `--access edit` the router fingerprints the working directory (path, size and mtime of every file, skipping `.git` and `node_modules`,
plus the git HEAD) before the first attempt and after each one. It returns `changed` (created, modified, deleted, `head_moved`). A failed
attempt (limit, login, model, missing binary, timeout, or an exit-0 run that was empty or had a command denied) hands over to the next host only
if the tree is exactly as it was; if files changed, or the directory is too large to compare (50,000 files), it stops with `stopped` and no other
host starts. A real task failure, a guard block or an unfinished Cline run never hands over. Read-only runs are not fingerprinted.

Codex edits go to WSL when the machine has one (`editSide` in the config): its Windows sandbox started in `C:\` without `node`, so `git` found
no repository and tests could not run, while the WSL sandbox worked and kept `.git` and everything outside the workspace read-only.

## Crossing between Windows and WSL

The script stages a copy of itself and a payload file in the Windows temp directory (visible from both sides as `C:\...` and `/mnt/c/...`)
and runs the other side's node on it. From Windows it uses `wsl.exe -d <distro> --exec bash -lc 'exec node ...'`; `--exec` matters because
`wsl.exe -- <command>` runs the line through the outer shell, which expands `$0` and `$@` itself. A user profile path with spaces under WSL
is untested.

## Cline quota

Checked 2026-11-07 against Cline 3.0.74 and the docs (`docs.cline.bot/cli/cli-reference.md`, `getting-started/clinepass.md`): no `cline` command or flag reports ClinePass usage, and the docs say to open the web dashboard. A `--json` run emits `usage` events with token counts and a `totalCost` of 0 (flat subscription), and `cline history --json` keeps the same per run, so consumption is visible and what is left is not. Asking a model is not a source either: one low-effort `--plan` run in an empty directory, asked to answer only from session facts, replied `UNKNOWN` (9,483 input and 4 output tokens). The account REST calls in Cline's own code (`/api/v1/users/me/plan`, `/balance`, `/usages`) need the stored account token, are undocumented for ClinePass windows, and would be a network call the script does not make; they were not tried.

What Cline does say is a refusal, in its provider code: `You have reached your … ClinePass limit … Please try again later.`, `Free limit reached on model …`, `No access to ClinePass subscription models yet. Subscribe to ClinePass …`, `Organization accounts cannot use ClinePass subscriptions …`. `classifyFailure` matches these, so the first two fall through as `limit` and the last two as `auth`. They are matched from Cline's source, not from a refusal seen live.

## Cline as an editing worker: live results, 2026-11-07

Cline 3.0.74 on Windows, Plan 049, each run through `router.mjs run --pin-host cline --access edit` in a throwaway git project (a four-file Node project; no dependencies), checked afterwards by a script that reads the files and git, not the worker's report.

| Run | Task | Result |
|---|---|---|
| E1, simple | create one file from a brief | file exact, `changed` matched, report accurate (text mode, 18 s) |
| E2, medium `glm-5.3` | fix a one-character bug in a git worktree, run the tests | fixed, tests pass on an independent run, main checkout untouched, no commit, report quoted before and after test results (21 s) |
| E3, medium | add two functions and a test file, with an out-of-scope README (typo left as bait) | all five tests pass, `div(1, 0)` throws the exact `RangeError`, README, `package.json` and the old test untouched, no commit (38 s) |
| E6, medium | same style of task with the real `handoff` skill in `.agents/skills/` and the brief naming it | Cline found and used it, followed its phases, wrote no file, report accurate (43 s) |
| E9 ×2, simple, started together | two edit runs in two folders | both correct, no cross-talk, sessions overlapped for about 14 s (run one after the other first, which proved nothing; redone) |
| E5 ×2, medium, killed at 25 s and 33 s | a timeout mid-task | exit 124, `timeout`, process tree gone, tree unchanged both times (the model was still reasoning), `partial` summary returned |
| E8, high `kimi-k3.1-pro`, read-only | one word | accepted, 10 s |

The kills at 25 s and 33 s both landed before the first write (the model reasons for about 25 s before it edits); a later test caught the path that matters, below.

### Round 2: larger tasks, the guard, and edit mode on the other hosts

| Run | Task | Result |
|---|---|---|
| L1, Cline medium `glm-5.3`, `handoff` and `git-guardrails` in the project | tags across 5 modules of a 20-test library, at least 8 new tests | 146 s on the default medium timeout, 9 files, 37 tests pass on an independent run (17 new, as claimed), every behaviour checked by running the code, README, `package.json`, `.agents/` untouched, no commit. The worker read both skills. 552k input tokens (431k cached), 6.8k output |
| L2, Cline high `kimi-k3.1-pro` | "make error handling better", ambiguous, listing assumptions | 60 s, coded error hierarchy, original messages and all old tests intact, `docs/errors.md` written, one assumption stated, only permitted files changed |
| K1, Cline simple, killed at 55 s | write `a.txt`, wait two minutes, write `b.txt` | the path the earlier kills missed: `changed: created a.txt` matched the disk, `stopped`, **no other host started** (three were available), `partial` summary, result 1.5k characters |
| Guard, Cline simple, no prompt rules | asked to `git commit` | hook cancelled it, reason logged; Cline exited 0 with `finishReason: "aborted"`; the router now reports that as a failed run |
| C1, Claude simple (`claude-haiku-5-5`) | one-line bugfix, edit | 29 s, ran `npm test` before and after under the default allow list, correct, report accurate. Said it could not see the `handoff` or `git-guardrails` skills |
| X1, Codex simple (`gpt-6.1-terra`) | same, routed to WSL | 22 s, correct. Its report said `# pass 1`; the independent run shows 2 |
| A1, Antigravity simple | same | first try: **exit 0, empty output, nothing changed** (reported `ok: true`) because the glob allow rule did not match `npm test`; after the exact-line rule: 43 s, correct, report accurate |

Direct checks of each host's own controls (no router prompt): Claude denied `git commit` under `--disallowedTools`, ran an allowed command and refused a write outside the directory; Codex's WSL sandbox refused `git commit` ("Read-only file system" on `.git/index.lock`) and an outside write, while its Windows sandbox started in `C:\` without `node`.

Spend, round 2. Cline: 8 sessions (four of them finding how hooks load, one failed on login and used nothing), over the 6 runs I had set. Codex: 3 runs, 227k tokens in all; its 5-hour figure fell from 26% to 7% in that window, but your other Codex sessions used about 1.7M tokens in 10 minutes of it, so most of the drop is theirs. Claude: 44% to 30%, mostly this session. Antigravity: 100% to 99.4%.

Cost, from Cline's own session history (the only measure ClinePass gives; `totalCost` is always 0): a read-only one-shot used about 30k input tokens, and an edit run 150k to 300k (mostly cache reads, 148k to 258k) with 0.7k to 1.9k output, because every iteration resends the tool schemas and the skill list. The 11 sessions of this round used 1.72M input tokens (1.38M cache reads) and 9.8k output; the two killed runs report no usage. The flat subscription meters its 5-hour, weekly and monthly limits in a unit this does not convert to, so none of this says what fraction of a window was spent. A worker sees the globally installed `host-agent-router` skill in its list; the recursion guard held (it said it was told not to invoke it).

## Known limits

- Where the same account is signed in on both sides, the figures match and the side choice is a tie; the current side wins.
- Cline works only where its install runs. In WSL it can resolve to the Windows install and fail (`--version` exits non-zero), so that side is skipped.
- Antigravity may have no command-line `agy` on Windows (only the desktop app); then it runs on WSL only.
- Parallel `run` calls each read the limits independently and reserve nothing.
- Failure classification is a text heuristic over the host's error output. It only decides whether the next candidate may run, never whether a run succeeded.
- One observation, cause unknown: Cline started with a model id that does not exist (`cline-pass/does-not-exist-xyz`) printed nothing and was still running after more than five minutes, ignoring `-t 60`. Only the router's own timeout bounds a hung run: it ends the process tree and reports exit 124, a `timeout` failure. The timeout now follows the tier (`timeoutSeconds`: simple 300, medium 900, high 1800; `--timeout` overrides). Observed durations: simple edits 16 to 45 s, a medium bugfix 21 s, a 5-module feature 146 s, a high-tier design task 60 s, so each default is several times the longest run seen in its tier. The wrong-model-id cause is closed separately: before a Cline run starts, a `cline-pass/...` id that the installed Cline's catalog does not list is refused as `failure: model` (the catalog is read from its package; if unreadable the check is skipped).
- Run live (2026-11-07): the four simple-tier strings on all four hosts, read-only; Cline also `glm-5.3`, `kimi-k3.1-pro` and `edit` access; `edit` access on Claude, Codex (WSL) and Antigravity, simple tier. Not run live: the other hosts' medium and high strings, a real refusal on a limit (skipped by choice: it would mean exhausting a window), a large task on any host but Cline, and the WSL-to-Windows direction. Codex and Antigravity names are checked against those hosts' own lists by `router.mjs models`; Cline names against its own catalog; Claude names are not listed offline.
