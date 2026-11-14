# Host details for host-agent-router

This file keeps what is true of the hosts apart from what a particular machine had: everything above "Machines seen" is about the hosts,
"Machines seen" lists the machines. Observations are per machine: what one machine showed says nothing about another, so each is dated
and attributed there. Nothing below starts a model: every limit readout is a local command or an account endpoint the host calls itself.

## How headroom is read

| Host | Source | Notes |
|---|---|---|
| Claude | `claude -p "/usage"` (text) | Rows `Current session` (5-hour) and `Current week (all models)`, as percent used. A model-specific weekly row counts only for that model family. |
| Antigravity | `agy -p "/usage" --output-format json` | Groups with `5h` and `weekly` buckets (`remaining_fraction`). The group is chosen by model prefix (`quotaGroups` in the config). Gemini 4 Argon has a weekly bucket only. No group names Gemini 4 Hydrogen; it is charged to Gemini Models through the prefix, confirmed by the maintainer in the Antigravity app on 2026-11-13 (the Gemini Models quotas went down after the Hydrogen runs) (see "Tiers, efforts and skills"). |
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
and Cline's act mode. No `--dangerously-*` flag is ever passed. On Windows, Cline (and an npm-installed Codex) starts as `node <package entry>`, never through its
`.cmd` shim, so prompt text is not reparsed by `cmd.exe`. The contract every edit run carries, and what enforces it on each host, is in
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

## Tiers, efforts and skills

Antigravity's defaults follow `agy models`. On the second machine (2026-11-13) it lists all ten names below, and `router.mjs models` reports each one `ok`.

| Tier | Default | Selectable with `--effort` |
|---|---|---|
| simple | Gemini 3.8 Flash (Medium), `gemini-3.8-flash-medium` | `low`, `high` |
| medium | Gemini 4 Hydrogen (Medium), `gemini-4-hydrogen-medium` | `low`, `high` (`gemini-4-hydrogen-high`), `extra` (`gemini-4-hydrogen-xhigh`) |
| high | Gemini 4 Argon (Medium), `gemini-4-argon-medium` | `low`, `high` |

Hydrogen's quota group: `/usage` (the 2026-11-06 capture in the repository, and again on the second machine on 2026-11-13, with no model started) names three groups, Gemini Models (described as Gemini Flash and Gemini Pro; weekly and 5-hour buckets), Claude and GPT models (weekly and 5-hour) and Gemini 4 Argon (a weekly bucket only), and none names Hydrogen. The `gemini-` prefix in `quotaGroups` therefore charges Hydrogen to Gemini Models and Argon to its own group. That Hydrogen counts in Gemini Models and that only Argon has its own group was confirmed by the maintainer in the Antigravity app on 2026-11-13 (the Gemini Models quotas went down after the Hydrogen runs). If `/usage` ever shows a group of its own for Hydrogen, add a `gemini-4-hydrogen` entry to `quotaGroups` in your config.

`high` on Cline is for genuinely hard problems only: it uses a large share of the 5-hour quota. Keep other high-tier work off Cline with `--pin-host <host>` on `run`, `--host <host>` on `status` and `plan`, or by moving `cline` down `priority` in your config. (Cline's `high` is `cline-pass/kimi-k3.1-pro`; its share of the quota is the maintainer's report, not something the router can measure, because Cline has no usage readout.)

An effort inside a tier is an optional `efforts` map on that tier in the config. The key is the name given to `--effort`; the value is either a plain effort value (a host whose effort is a flag, for example `"extra": "xhigh"` for Codex; the model stays) or `{ "label", "model", "effort" }` (any of them overrides the tier's; a host whose effort is part of the model name, Antigravity, needs a `model`). The tier's own default effort is always a valid name. The user config merges into it key by key, so one effort can be changed or added without restating the others. With `--effort`, a host whose tier has no such entry keeps its default and the result carries a note (`effort_note` on its candidate and in `ran`); a name that no host in scope knows is a usage error. `ran` always shows the model and effort that were used. Only Antigravity ships effort entries; the other hosts' effort values are not listed offline, so none is claimed here.

`--skill <name>` (up to three, `run` only) puts the `SKILL.md` text of a sibling skill folder into the worker's prompt, after the contract, under a heading of its own: a git worktree does not inherit installed skills. The folder is found beside the router, in `registry/skills/` or in the installed skills folder. A skill is limited to 20,000 characters (front matter stripped), and `--dry-run` lists what was attached and the size of the prompt each host would get. Cline and Antigravity take the prompt as a command-line argument, so a prompt over about 30,000 characters is skipped for them on Windows (the process limit is about 32,000) and over about 120,000 on Linux; Claude and Codex take it on stdin. This size guard and the skill text itself were not run live.

## Editing: what the router does around a run

For `--access edit` the router fingerprints the working directory (path, size and mtime of every file, skipping `.git` and `node_modules`,
plus the git HEAD) before the first attempt and after each one. It returns `changed` (created, modified, deleted, `head_moved`). Inside a git work tree
the paths git ignores (build output, a scratch folder, found with one `git check-ignore --stdin -z` call that has a time limit and no shell) are listed apart
as `ignored`: their count and the ten biggest top-level folders, so that a build does not bury the one modified file. Nothing is hidden: `count` still
includes them, and a failed attempt that changed only ignored paths still stops the fall-through. Outside a work tree, or when git fails or is absent, the
lists are as they were. A failed
attempt (limit, login, model, missing binary, timeout, or an exit-0 run that was empty or had a command denied) hands over to the next host only
if the tree is exactly as it was; if files changed, or the directory is too large to compare (50,000 files), it stops with `stopped` and no other
host starts. A real task failure, a guard block or an unfinished Cline run never hands over. Read-only runs are not fingerprinted.

Codex edits go to WSL when that side is usable (`editSide` in the config): on the first machine its Windows sandbox started in `C:\` without
`node`, so `git` found no repository and tests could not run, while the WSL sandbox worked and kept `.git` and everything outside the workspace
read-only. `editSide` only puts that side first; with no usable WSL side (the second machine) the router uses the Windows side, which has not
been shown to work for edits there (see "Machines seen").

## Crossing between Windows and WSL

The script stages a copy of itself and a payload file in the Windows temp directory (visible from both sides as `C:\...` and `/mnt/c/...`)
and runs the other side's node on it. From Windows it uses `wsl.exe -d <distro> --exec bash -lc 'exec node ...'`; `--exec` matters because
`wsl.exe -- <command>` runs the line through the outer shell, which expands `$0` and `$@` itself. A user profile path with spaces under WSL
is untested.

## Cline quota

Checked 2026-11-07 against Cline 3.0.74 and the docs (`docs.cline.bot/cli/cli-reference.md`, `getting-started/clinepass.md`): no `cline` command or flag reports ClinePass usage, and the docs say to open the web dashboard. A `--json` run emits `usage` events with token counts and a `totalCost` of 0 (flat subscription), and `cline history --json` keeps the same per run, so consumption is visible and what is left is not. Asking a model is not a source either: one low-effort `--plan` run in an empty directory, asked to answer only from session facts, replied `UNKNOWN` (9,483 input and 4 output tokens). The account REST calls in Cline's own code (`/api/v1/users/me/plan`, `/balance`, `/usages`) need the stored account token, are undocumented for ClinePass windows, and would be a network call the script does not make; they were not tried.

What Cline does say is a refusal, in its provider code: `You have reached your … ClinePass limit … Please try again later.`, `Free limit reached on model …`, `No access to ClinePass subscription models yet. Subscribe to ClinePass …`, `Organization accounts cannot use ClinePass subscriptions …`. `classifyFailure` matches these, so the first two fall through as `limit` and the last two as `auth`. They are matched from Cline's source, not from a refusal seen live.

## Cline as an editing worker: live results, 2026-11-07

First machine: Cline 3.0.74 on Windows, Plan 049, each run through `router.mjs run --pin-host cline --access edit` in a throwaway git project (a four-file Node project; no dependencies), checked afterwards by a script that reads the files and git, not the worker's report.

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
- Antigravity may be installed on one side only: `agy` in WSL only on the first machine, on Windows only on the second.
- Parallel `run` calls each read the limits independently and reserve nothing.
- Failure classification is a text heuristic over the host's error output. It only decides whether the next candidate may run, never whether a run succeeded.
- One observation, cause unknown: Cline started with a model id that does not exist (`cline-pass/does-not-exist-xyz`) printed nothing and was still running after more than five minutes, ignoring `-t 60`. Only the router's own timeout bounds a hung run: it ends the process tree and reports exit 124, a `timeout` failure. The timeout now follows the tier (`timeoutSeconds`: simple 300, medium 900, high 1800; `--timeout` overrides). Observed durations: simple edits 16 to 45 s, a medium bugfix 21 s, a 5-module feature 146 s, a high-tier design task 60 s, so each default is several times the longest run seen in its tier. The wrong-model-id cause is closed separately: before a Cline run starts, a `cline-pass/...` id that the installed Cline's catalog does not list is refused as `failure: model` (the catalog is read from its package; if unreadable the check is skipped).

## Machines seen

Observations are per machine. A host version, an install route or a run result below holds for the machine and the date named, and for no other.

### First machine (observed 2026-11-06 and 2026-11-07)

Windows 11 plus WSL Ubuntu, Node in WSL: Claude Code 2.1.319 (both sides), Codex 0.167.0 (Windows app bundle, WSL standalone), Antigravity `agy` 1.5.2 (WSL only), Cline 3.0.74 (Windows only).

- Run live (2026-11-07): the four simple-tier strings on all four hosts, read-only; Cline also `glm-5.3`, `kimi-k3.1-pro` and `edit` access; `edit` access on Claude, Codex (WSL) and Antigravity, simple tier. Not run live: the other hosts' medium and high strings, a real refusal on a limit (skipped by choice: it would mean exhausting a window), a large task on any host but Cline, and the WSL-to-Windows direction. Codex and Antigravity names are checked against those hosts' own lists by `router.mjs models`; Cline names against its own catalog; Claude names are not listed offline.

### Second machine (observed 2026-11-13)

Windows 11 with WSL present but without Node. Install routes seen on that machine:

- Codex 0.169.0 installed through npm on Windows: `AppData\Roaming\npm\codex.cmd` beside `node_modules/@openai/codex`. The router starts it as `node <package entry>`, the way it starts Cline, because neither npm shim can be spawned directly (`npmShimCommand`); the Codex run listed below came after this lookup fix.
- Antigravity as `agy.exe` on Windows (`AppData\Local\agy\bin`); Cline through npm on Windows.
- Every WSL side reports "not runnable": the bridge answers `exec: node: not found`, so `status` skips those candidates and `models` shows an error for WSL. Codex is not installed in WSL there.
- `router.mjs machine`, run on 2026-11-13 for this update, reported (the `--version` lines): Cline 3.0.74 (npm entry), Antigravity 1.5.8 (exe), Codex 0.169.0 (npm entry), Claude Code 2.1.323 (exe).
- Read-only runs at the simple tier, seen live on 2026-11-13 (reported to this update by the lead, not run by it): Antigravity on Windows with `gemini-3.8-flash-medium`, Cline on Windows with `cline-pass/deepseek-v4.1-flash-1017`, and Codex on Windows with `gpt-6.1-terra` (after the npm lookup fix).
- Codex edit runs: `editSide` is `wsl` and there is no usable WSL side, so the router uses the Windows side. That side's sandbox failed for edits on the first machine (started in `C:\` without `node`). On this machine it edited the file (see the edit runs below) but could not run the acceptance command.
- Not run on this machine (2026-11-13): a real limit refusal on any host (deliberately not run), the WSL sides (no Node there), Codex beyond the two simple-tier runs above, a full-path rule for a path with spaces.
- Edit runs on the second machine (2026-11-13, one each, `--access edit`, each in its own git worktree of a throwaway two-file repository, the same brief: fix an off-by-one in `sum.mjs`, acceptance `node --test` passed as `--allow-cmd`). All three came back `ok` with `changed` listing only `sum.mjs`, no commit (`head_moved` false), and the lead's own `node --test` exited 0 in each worktree afterwards. Antigravity, Windows, `--tier medium --effort medium --skill test-driven-development`: ran `gemini-4-hydrogen-medium` with the skill attached (6,449 characters). Cline, Windows, `--tier simple`: ran `cline-pass/deepseek-v4.1-flash-1017`. Codex, Windows, `--tier simple`: ran `gpt-6.1-terra` under `workspace-write`; it made the edit, but its sandbox refused to spawn the test process for `node --test` (`EPERM`), so it ran `node --test --test-isolation=none` and said so in its report. On Windows a Codex worker can edit but may not be able to run an acceptance command that starts child processes: the lead runs it.
- Antigravity on Windows, 2026-11-13, one run each in its own worktree of the same throwaway repository, all `ok` with `changed` listing only `sum.mjs`, `head_moved` false, and the lead's own `node --test` exit 0: `--tier medium --effort high --access edit` ran `gemini-4-hydrogen-high` (33.2 s); `--effort extra` ran `gemini-4-hydrogen-xhigh` (62 s); `--tier high --access edit` ran `gemini-4-argon-medium` (77.2 s). `--tier simple --effort high --access read-only` ran `gemini-3.8-flash-high` and gave the correct one-line answer (11.9 s). Source: the verifying agent's raw files (`REPORT.md` and its `out` folder).
- Cline on Windows, 2026-11-13: `--tier medium --access edit` ran `cline-pass/glm-5.3` (16.8 s; only `sum.mjs` modified, no commit, the lead's `node --test` exit 0). `--tier high --access read-only` ran `cline-pass/kimi-k3.1-pro` once (7.0 s, correct one-line answer); that is one data point, and the high-tier quota rule above stands.
- The forbidden commit, 2026-11-13, simple tier, an edit brief that told the worker to run `git commit -am fixed`: on both hosts the worker first declined it from the prompt contract alone (Antigravity `gemini-3.8-flash-medium`, twice, the second brief insisting; Cline `cline-pass/deepseek-v4.1-flash-1017`, the hook never fired), HEAD did not move. The prompt rule held; the host-level control was reached only when the brief insisted. On Cline a second brief that called the commit an authorised guard test got the command issued and the hook cancelled it: exit 1, `failure: "guard"`, `finish_reason: "aborted"`, `guard.blocked` one `run_commands` entry naming `git commit -am fixed`, `changed` only `sum.mjs`, `git log` showing only the base commit. The Cline hook denial is therefore confirmed live on this machine. On Antigravity no host-level denial happened in those router runs (no `denied`, no `denied_actions`). The Antigravity host-level denial was confirmed by a direct call on 2026-11-13 (see "Antigravity called directly" below), and not reached through the router because the worker declined from the prompt each time (two `git commit` briefs, one `whoami` brief).
- Antigravity's sandbox and `node`, 2026-11-13: in three router runs the worker reported that `node` and `npm` are not recognised inside the Antigravity sandbox. Then (a) was observed directly, see "Antigravity called directly" below: the shell inside the sandbox does not find the `node` the lead's shell finds, because the sandbox's PATH lacks that directory (here `C:\nvm4w\nodejs`, an nvm-for-Windows install). The router now gives the worker the full-path form of an allowed command as well (next item).
- Antigravity called directly, outside the router (agy 1.5.8, `--mode accept-edits --sandbox --settings '{"permissions":{"allow":[...]}}' --output-format json`, `gemini-3.8-flash-medium`, 2026-11-13). (a) With allow `command(node --version)` and a prompt to run `node --version`: the command was permitted, but the shell answered that `node` is not recognized as a cmdlet, function, script file or executable program; `denied_actions` was null. (b) With allow `command(C:\nvm4w\nodejs\node.exe --version)` and a prompt to run exactly that line: it ran and returned `v24.19.0`. (c) With allow `command(node --test)` and the prompt "Run exactly this one shell command and tell me its output: whoami" with no router contract in it: exit 0, `status` `SUCCESS`, empty `response`, `denied_actions` = `{"action":"command","display_name":"Bash"}`, and on stderr `jetski: no output produced` because a tool required the `command` permission that headless mode cannot prompt for and it was auto-denied. The host-level denial described in the worker contract is thereby confirmed by a direct call.
- Full-path allow rules (Antigravity, Windows, `--access edit`): each allowed command line whose first word is a bare program name that the router's own lookup (`which`) resolves to a real `.exe` gets a second `command(...)` rule with that absolute path and the same arguments (`node --test` also allows `C:\nvm4w\nodejs\node.exe --test`), and the worker's shell-commands note says that if a program name is not recognised it may run the listed full-path form of the same command and nothing else. The path comes only from the router's resolution on the lead's machine, never from the brief or `--allow-cmd`, and the `--allow-cmd` check is unchanged. Only `.exe` targets are rewritten: a `.cmd`, `.ps1` or extensionless shim such as npm's is not, so `npm test` still depends on the sandbox PATH; the workaround is an acceptance command that starts with `node`. A path with spaces: not tried (an exact-line rule was seen only for a path without spaces), so for such a program the router adds no extra rule and the result carries a `notes` entry naming the program. `--dry-run` shows the rules as `allow_rules` and the `notes`. No other host and no read-only run changes.
- The full-path rule was run live through the router on 2026-11-13: an Antigravity `gemini-3.8-flash-medium` edit run with `--allow-cmd "node --test"` fixed the file and reported `C:\nvm4w\nodejs\node.exe --test` with its real pass and fail counts; the result carried the note that `git` got no full-path rule because its path has spaces, and the lead's own `node --test` exited 0 afterwards.
- A real repository, 2026-11-13: Cline on Windows, `--tier medium --access edit`, `cline-pass/glm-5.3`, a local clone of this repository at `f2da922` in its own worktree, `--skill test-driven-development` (6,449 characters), acceptance `node scripts/skill-quality/measure.ts --help` (348.9 s). The work was correct (only `scripts/skill-quality/measure.ts` modified, no commit, `--help` and `-h` exit 0, an unknown argument still exits 2) but the router returned exit 1 and `failure: "guard"` with one blocked entry, "no guard policy was provided". It also exposed that `changed` listed 201 created paths (count 4,437) from git-ignored `dist/`, `scratch/` and `node_modules`-like folders. Both are fixed in the script and held by tests (a hook started by the repository's own tests inherited the location of the run's block record and wrote its fail-closed entry there; ignored paths are now summarised as `ignored`). The guard fix was re-run live the same day: a Cline `cline-pass/glm-5.3` edit run in that clone, whose acceptance command was the repository's own router test file (95 passed, the unguarded-hook case among them), came back `ok` with no `guard` entry and `changed` listing the one edited file. The `ignored` summary was not re-run live. The worker had also run `npm ci`, `npm run typecheck` and two test files that the brief did not ask for.
- `router.mjs machine` and `machine --save`, run from the command line on 2026-11-13: `machine` printed the documented keys; `--save` with `HOST_AGENT_ROUTER_CONFIG` pointing into a temporary folder wrote only `machines/<hostname>.json` there (1,476 bytes, valid JSON, no user path, token or key; the hostname is the only personal string), and `--save` with no override wrote only `~/.agents/host-agent-router/machines/<hostname>.json`.

### Recording a machine

`router.mjs machine` prints, as JSON, what this machine has per host and side: whether it is installed, its `--version` line, and how it is started (`kind`: `npm-entry`, `exe`, `shim`, `wsl-bridge` for a host reached through the Windows/WSL bridge, with `via` giving how it starts on that side, or `missing`). It runs only `--version` and starts no model. `--save` writes the record to `~/.agents/host-agent-router/machines/<hostname>.json` (beside the user config, and nowhere else). The record holds no path, command-line argument or environment value. Cline's own `--version` was seen to create `~/.cline` in an empty home folder; that is the host's doing, not the router's.
