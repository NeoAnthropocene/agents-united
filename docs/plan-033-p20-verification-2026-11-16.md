# Plan 033 P20, the native guard hooks block when they cannot run: verification, 2026-11-16

P20 makes the native Claude guard hooks block the tool call when the hook cannot run (`onFailure: "block"`), answering finding S4-A2 of the 2026-11-16 interactive sittings ([the interactive stage-proof observation](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-stage-proof-interactive.md)). Committed locally as `859e0fd` ("fix(factory): P20, native guard hooks fail closed (onFailure: block)"; 32 files changed, 324 insertions, 53 deletions) on top of `7c06115`, on the branch of draft pull request 219 (`codex/plan-033-claude-delivery-nov10` against `dev`). Built by one Claude subagent (Sonnet) in its own worktree, with two fix rounds and an independent read-only review by Antigravity (Gemini 4 Hydrogen High), and gated on Windows before commit `859e0fd`. Nothing of P20 ran on the real Host: whether Claude Code 2.1.295 or later honours `onFailure: "block"` in an agent's frontmatter is taken from Host documentation and is **not observed** (unverified). See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (section dated 2026-11-16).

## Scope and baseline

- Date: 2026-11-16.
- Slice: P20.
- Branch: `codex/plan-033-claude-delivery-nov10`, draft pull request 219 against `dev`.
- Baseline: `7c06115`.
- Local commit: `859e0fd` ("fix(factory): P20, native guard hooks fail closed (onFailure: block)").
- Diff scope: 32 files changed, 324 insertions, 53 deletions:
  - 22 native agent files under `registry/hosts/claude/agents/` (one generated hooks line each: 22 insertions, 22 deletions; 18 naming `agents-united-guard.js`, 4 naming `agents-united-readonly-guard.js`);
  - 4 source files (`src/core/guard.ts`, `src/core/readonly-guard.ts`, `src/core/doctor.ts`, `src/core/claude-capabilities.ts`);
  - 1 script (`scripts/factory-proof-scenarios.mjs`);
  - 4 existing test or helper files (`tests/helpers/claude-host-hooks.ts`, `tests/native-claude-guard-file.test.ts`, `tests/native-claude-readonly-attempt.test.ts`, `tests/readonly-guard.test.ts`);
  - 1 new test file (`tests/guard-fail-closed.test.ts`, 187 lines, 63 tests).
- Gate environment: Windows. Nothing of P20 ran on the real Host; Linux CI for `859e0fd` was not yet read when these records were written.

## The observation that caused it (finding S4-A2) and the Host documentation

- **Finding S4-A2** (interactive sitting of 2026-11-16 on Claude Code 2.1.325, Windows, permission mode `auto`, scenario S4 part A `51a0014c-723f-49d0-9f01-e48220864a36`, step 5; [the interactive stage-proof observation](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-stage-proof-interactive.md), section "S4-A2: the guard fails open when its script is missing"):
  - With `.claude\hooks\agents-united-guard.js` moved away outside the session, `PowerShell` `echo git push --force` triggered Node failure `MODULE_NOT_FOUND` (exit code `1`, Node `"Error: Cannot find module '<workspace>\s4a-factory-guards\.claude\hooks\agents-united-guard.js'"`). The Host recorded `hook_non_blocking_error` (`"Failed with non-blocking status code:"` for `PreToolUse:PowerShell`) and ran the guarded command. Because `agents-united-guard.js` blocks with exit code `2` and a crashed Node process exits `1`, the Host treated the failure as non-blocking and the guard failed open when its script was missing. This was shown for `PowerShell` once; behaviour for `Bash` or other hook failures was not shown.
- **Host documentation** ([hooks.md](../host-library/claude/pages/hook/hooks.md)):
  - **Command hook fields table, row `onFailure` (line 456):** `"Requires Claude Code v2.1.295 or later"`. The row describes `onFailure` as whether the action that triggered the hook goes ahead when the hook fails: `"continue"` or `"block"`.
  - **Section "Block the action when a hook fails" (lines 914–966):**
    - `"On most events, when a hook fails or times out, Claude Code still carries out the action. A policy hook with a wrong path or a crashing script then lets everything through."` Setting `onFailure` to `"block"` on a `command` or `http` hook blocks the action instead (`"Requires Claude Code v2.1.295 or later."`).
    - On failure, Claude Code blocks the call and the error includes `failed; blocking because onFailure is "block"` followed by node's own error output. "After a timeout, the message says `timed out` instead of `failed`." "Without `onFailure` set, the same missing script is a non-blocking error and `ls` runs."
    - What counts as a failure:
      - **Can't start:** a command hook fails to start, for example because the script or executable doesn't exist.
      - **Exit code other than 0 or 2:** counts for a command hook even if it printed JSON that allows the action, such as `permissionDecision: "allow"` (to return a JSON decision, exit 0).
      - **HTTP error:** an HTTP hook's connection fails, or the response status isn't 2xx.
      - **Timeout:** the hook reaches its `timeout`.
      - **Invalid output:** the JSON output can't be parsed or fails schema validation (for an HTTP hook, a 2xx body that is neither empty nor a JSON object also counts; plain-text stdout from a command hook isn't a failure).
    - Hooks the field has no effect on: `Stop`, `SubagentStop`, `TaskCompleted`, and `TeammateIdle` hooks (where exit code 2 sends Claude back to keep working, and Claude can't repair a hook that won't run), and background command hooks that set `async` or `asyncRewake`.
  - **Section "Failed hooks on Windows without Git Bash" (lines 968–987):** without Git Bash, a shell-form `PreToolUse` or `PermissionRequest` command hook with `onFailure` unset can block the tool call (`"blocking because Git Bash wasn't found, so only exit code 0 or 2 counts as this hook's verdict."`), and stops doing so once Git for Windows is installed; the section directs using exec form (`command` and `args`) and `onFailure: "block"` so a failure or timeout blocks the call with or without Git Bash.
- **Two limits of the Host documentation:**
  1. The documentation's example for `onFailure` is a `PreToolUse` hook in `.claude/settings.json`; the lines read do not say whether the field also applies to hooks in an agent's frontmatter.
  2. The lines read do not say what a Host older than 2.1.295 does with the field.

## The decision

- **The maintainer's decision:** to the question `"Should a guard whose script cannot run block the tool call?"`, the maintainer answered **`"Yes, fail closed"`**. He had been told beforehand that the hook entry is generated and shared by every native role of every Bundle, so the change is wider than the factory.
- **Lead's choices (the maintainer has not been asked about each):**
  - Do not add `onFailure: "block"` to the mode-line gate (`agents-united-mode-line-gate.js`).
  - Do not add `onFailure: "block"` to the legacy inline guard (`guardHandler()` / `managedGuardHooks()`) or the settings-level session guard (`src/core/session-guard.ts`) in this slice; offered to the maintainer as a possible follow-up slice, not decided.
  - Keep `registry/hosts/claude/profile.json` unchanged (`minVersion` stays `2.1.271`, no new feature entry) and add a doctor warning when the probed Claude Code version is known and older than `2.1.295`.

## The change

| Place | Before | After |
| :- | :- | :- |
| `src/core/guard.ts`, types and version | no `GUARD_ON_FAILURE_MIN_VERSION` or `FailClosedHandler` | `GUARD_ON_FAILURE_MIN_VERSION` = `'2.1.295'`; `FailClosedHandler` (`type`, `command`, `args`, `onFailure: 'block'`, in that key order) |
| `src/core/guard.ts`, builders | `guardFileHandler(kind)` returned `{ type, command, args }`; `nativeGuardHooks()` used `guardHandler()` | `guardFileHandler(kind)` returns `FailClosedHandler` for `destructive` and `read-only` and no `onFailure` for `mode-line`; new `nativeGuardHandler()` (inline `node -e` destructive guard with `onFailure: 'block'`); `nativeGuardHooks()` and `nativeGuardFileHooks()` use handlers with `onFailure: 'block'`; `guardHandler()` and `managedGuardHooks()` unchanged |
| `src/core/readonly-guard.ts` | `readOnlyGuardHandler()` (inline) returned `{ type, command, args }` | `readOnlyGuardHandler()` carries `onFailure: 'block'`; `readOnlyGuardFileHooks()` uses `guardFileHandler('read-only')` with `onFailure: 'block'` |
| `src/core/doctor.ts`, missing-script warning | generic missing-script text | per-kind `MISSING_SCRIPT_EFFECT`: destructive guard blocks the shell and file-write tools it guards until restored; read-only guard blocks every tool call its matcher covers (shells, file writers, the delegation tools `Agent`, `Workflow`, `CronCreate`, `EnterWorktree`, `Artifact` and `SendUserFile`, and every connected-server `mcp__` tool); mode-line gate prints `"The gate does not run, so the lead's first-message check is not enforced; nothing is blocked."` Both guard texts say that below `2.1.295` the behaviour with the field is unverified |
| `src/core/doctor.ts`, older Host version | no version check against `2.1.295` | on a native-lane Claude install with at least one guarded role, when the probed Claude Code version is known and older than `2.1.295`, warns and says `"Update Claude Code."`; an unknown version does not warn |
| `src/core/claude-capabilities.ts` | `supportsVersion` unexported | `supportsVersion` exported (used by the doctor); no behaviour change |
| 22 native agent files under `registry/hosts/claude/agents/` | generated hooks line without `onFailure` (18 naming `agents-united-guard.js`, 4 naming `agents-united-readonly-guard.js`) | regenerated with `UPDATE_NATIVE=1`; each guard handler gains `,"onFailure":"block"` as its last key |
| `registry/hosts/claude/agents/factory-evaluator.md` (example guard handler) | `{"type":"command","command":"node","args":["${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-readonly-guard.js"]}` | `{"type":"command","command":"node","args":["${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-readonly-guard.js"],"onFailure":"block"}` |
| `registry/hosts/claude/agents/orchestrator-digital-agency.md` (mode-line handler) | `{"type":"command","command":"node","args":["${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-mode-line-gate.js"]}` | unchanged: `{"type":"command","command":"node","args":["${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-mode-line-gate.js"]}` |
| `scripts/factory-proof-scenarios.mjs` (S4 part A, step 5) | did not expect `onFailure: "block"` refusal | expects "The command is REFUSED, and the message contains `failed; blocking because onFailure is "block"`: the guard fails closed when its script is gone." and, if not, `"If the command ran, write that down, it is the finding (the guard failed open on this Host version)."`; paste-back item asks whether refused and for the exact message |
| Tests and helpers | 4 existing files (`tests/helpers/claude-host-hooks.ts`, `tests/native-claude-guard-file.test.ts`, `tests/native-claude-readonly-attempt.test.ts`, `tests/readonly-guard.test.ts`) | those 4 updated plus new `tests/guard-fail-closed.test.ts` (187 lines, 63 tests) |

## What did not change and why

- **The mode-line gate (`agents-united-mode-line-gate.js`):** lead's choice not to add `onFailure: "block"`. It is not a guard of what a role may do, and its matcher fires on every tool call of the lead, so a lead whose gate script is missing could make no tool call at all. The maintainer's decision was about guards.
- **The legacy inline guard (`guardHandler()` / `managedGuardHooks()`) and the settings-level session guard (`src/core/session-guard.ts`):** lead's choice for this slice not to add `onFailure: "block"`. The legacy inline guard is used by the legacy projection lane (roles without a committed native agent, or installs without the native lane) and by the settings-level session guard across project, local and user settings. These surfaces therefore still fail open when the hook process cannot run. Reasons: the handler is an inline `node -e` script, so there is no script file that can go missing; changing it moves the session guard's handler hash (existing installs would need upgrade logic) and the legacy projection goldens. Offered to the maintainer as a possible follow-up slice; not decided.
- **Guard script sources:** `registry/hosts/claude/hooks/agents-united-guard.js`, `agents-united-readonly-guard.js` and `agents-united-mode-line-gate.js` are byte-identical to before; which commands a guard blocks is unchanged.
- **Other Hosts:** the Antigravity and Cline guards and their registry files (`src/core/antigravity-hooks.ts`, `src/core/antigravity-projector.ts`, `src/core/cline-projector.ts`, `registry/hosts/cline/plugins/agents-united-guard.js`, `registry/hosts/antigravity/`, `registry/hosts/cline/`) are unchanged.
- **The profile and the floor (`registry/hosts/claude/profile.json`):** `minVersion` stays `2.1.271` (raising the floor is the maintainer's decision; not asked). A feature entry for `onFailure` was tried and removed again: the profile's feature statuses are only `available`, `experimental` and `unsupported`, and the profile is reviewed against `2.1.285`, so an entry `"available since 2.1.295"` would have been inconsistent.

## Exit codes of the two guard scripts

Run with `node` and crafted standard input; pinned in `tests/guard-fail-closed.test.ts`:

| Input | Destructive guard | Read-only guard |
| :- | :- | :- |
| a call the guard blocks | 2 | 2 |
| a harmless call | 0 | 0 |
| an unknown tool name | 0 | 0 |
| an empty JSON object | 0 | 0 |
| empty standard input | 0 (existing deliberate allow) | 2 |
| text that is not JSON | 0 (existing deliberate allow) | 2 |
| JSON `null` | 1 (an uncaught error, not a deliberate decision; with the field this now blocks) | 2 |
| the script file is missing | Node exits 1 | Node exits 1 |

So `onFailure: "block"` changes what happens when the hook process fails (cannot start, exits with a code other than 0 or 2, times out, prints invalid JSON output); it does not change a script's own decision. Limit: the destructive guard still allows a call whose input it cannot read (empty or unparseable input exits 0); only the read-only guard blocks there. "Fail closed" in the records therefore means "blocks when the hook cannot run", not "blocks on every doubt".

## Tests

- **Shown offline (the Host is never started):**
  - The shape and key order (`type`, `command`, `args`, `onFailure`) of every generated guard handler in both script-file and inline forms (`guardFileHandler`, `nativeGuardHandler`, `readOnlyGuardHandler`, `nativeGuardHooks`, `nativeGuardFileHooks`, `readOnlyGuardHooks`, `readOnlyGuardFileHooks`), and the absence of `onFailure` on `guardFileHandler('mode-line')`, `modeLineGateHooks()`, `guardHandler()` and `managedGuardHooks()`.
  - That every one of the 22 committed native agent files with a hooks block carries `onFailure: "block"` on each guard handler and on no mode-line handler.
  - That each committed native agent file's hooks block equals what the real generator functions render for it (`nativeGuardFileHooks`, `readOnlyGuardFileHooks`, `modeLineGateHooks`, `renderHooks`); `tests/guard-fail-closed.test.ts` re-implements two choices from `UPDATE_NATIVE=1` in `tests/native-claude-agents.test.ts` (which guard kind a role has via `inspectNativeAgent`, and the mode-line group of `orchestrator-digital-agency.md`) because no single exported function renders a role's whole hooks block, and states so in a comment; an agent without a guard has no `agents-united:hooks:start` block.
  - That the inline global-install form (`ClaudeProjector.nativeRoleContent(..., 'inline')` for `backend-architect` and `code-reviewer`) carries `onFailure: "block"` on each guard handler.
  - That no Antigravity or Cline registry file mentions `onFailure`, and that `src/core/antigravity-hooks.ts`, `src/core/antigravity-projector.ts`, `src/core/cline-projector.ts` and `registry/hosts/cline/plugins/agents-united-guard.js` do not use the Claude handler builders.
  - The exit codes of both guard scripts in the table above (`tests/guard-fail-closed.test.ts`, plus updated assertions in `tests/readonly-guard.test.ts` and `tests/native-claude-guard-file.test.ts` including doctor missing-script and older-version warnings).
- **A model, not the Host:** `tests/helpers/claude-host-hooks.ts` imitates the Host's hook evaluation; its constant `ON_FAILURE_BLOCK_MESSAGE` (`failed; blocking because onFailure is "block"`) is the text the documentation prints, labelled in source as documented text (`A model of the Host, NOT an observation of it`). A test that expects this text (`tests/native-claude-readonly-attempt.test.ts`) proves the helper, not the Host.
- **What was not checked:** whether the new tests fail against the unchanged code (`7c06115`) was not checked by the lead (the old handlers have no `onFailure` key, so the shape assertions cannot pass there; that is an inference, not a run).

## How the work was done

- **Worker:** a Claude subagent (Sonnet) of the lead session, in its own worktree at `7c06115`, from a written brief; it never committed. Brief and reports are in `scratch/plan-033-implementation/routed-2026-11-14/`.
- **Fix round 1 (lead's review):** the doctor text had asserted what an older Host does (not known) and was reworded; a test was added that ties every agent file's hooks block to the generator functions; both acceptance commands were re-run in full (the worker's first report had partial runs).
- **Independent review:** Antigravity (Gemini 4 Hydrogen High), read-only, through `host-agent-router`; it changed nothing. It named two blockers, four majors, three minors and two notes.
  - **Taken in fix round 2:** doctor text per kind (the same fail-closed text had been printed for the mode-line gate, and the read-only matcher was understated); the doctor warning below `2.1.295`; the `profile.json` feature entry (removed); the helper's message (`ON_FAILURE_BLOCK_MESSAGE`) labelled as documented text; Cline sources added to the import check; the tie test made honest about what it re-implements; coverage of the inline native form.
  - **Standing as recorded limits:** nothing observed on the real Host; the legacy inline guard and the session guard stay fail open; the destructive guard allows unreadable input.
- **Fault of the working method, recorded:** four background shells of the worker's first round hung (one waited on standard input, three polled a file for a line that never came); the lead first told the maintainer nothing was stuck after looking only at the worker's files, then checked properly and stopped all four. Briefs now require foreground commands and forbid waiting loops.
- **Second part of the same brief (became P21):** the same brief carried a second part for the Skill fixture of the typed-routes sitting (finding S3-C). Result: no fixture change alone can make a compliant authoring fork pass `skill-check`, because the layout gate requires `evals/evals.json` under every policy and the `author-skill` route gives no file name or format and the fixture's allowed paths exclude it. Nothing was changed for it in P20. The maintainer decided `"Yes, route writes it"` (to `"Should the authoring route write the evals file that skill-check requires?"`); that is slice P21, in work, not part of commit `859e0fd`.

## Lead's acceptance and gate

- **Lead's acceptance in the worker's worktree after fix round 2:**
  - `npm run typecheck`: exit `0`.
  - Nine guard, native, doctor and proof test files: exit `0` (438 passed, 110.58 s).
  - Tests selected by `-t doctor`: exit `0` (35 files, 128 passed).
- **Gate (Windows, main checkout, the change applied on `7c06115`, before commit `859e0fd`):** raw files in `logs/plan-033-p20-2026-11-16/` (each step has `.command.txt`, `.stdout.txt`, `.stderr.txt`, `.exit.txt`).

| Step | Command | Exit | Result |
| :- | :- | :- | :- |
| `hostlib-verify` | `npm run hostlib:verify` | 0 | "host library snapshots match their lockfiles and every guide citation resolves" |
| `typecheck` | `npm run typecheck` | 0 | no error |
| `full-test-serial` | `env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false` | 0 | 308 test files passed; 7,758 tests passed, 224 skipped (7,982); 1722.49 s |
| `addon-matrix` | `AGENTS_CI_FULL=1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false` | 0 | 1 test file passed; 317 tests passed; 465.13 s |

- Linux CI for commit `859e0fd`: not yet read when these records were written (the Windows gate is not a CI result).

## Not observed on the real Host

1. Whether Claude Code 2.1.295 or later honours `onFailure: "block"` in a hook of an agent's frontmatter (the documentation's example is a settings file), in the script-file form and in the inline form; and whether the block message there contains `failed; blocking because onFailure is "block"`.
2. What Claude Code 2.1.271 to 2.1.294 (inside the supported floor) does with the field: ignore it (then the guard fails open as before), or something else. The library does not say.
3. A timeout: no generated handler sets `timeout`; the documented default for a command hook is 600 seconds; a guard that hangs would now block after that time with a message that says `timed out`. Not tried.
4. `Monitor`: according to the hooks page the matcher (`Bash` or `PowerShell`) also fires for `Monitor` commands on newer Hosts, so a failed guard would block those too. Not tried.
5. Read-only roles and connected-server tools: the read-only matcher includes `mcp__.*`, so while the read-only guard script is missing, a read-only role also loses the connected-server reads it is otherwise allowed (for example `repo-index` or `code-reviewer`). Follows from the matcher; not tried.
6. The JSON `null` case on the real Host (exit 1 of the destructive guard was seen only with `node` directly).
7. Frontmatter hooks do not run in headless sessions (ADR 0042), so the observation needs an interactive sitting: a short re-sitting of S4 part A step 5 is prepared for the maintainer. If the Host ignored the field in frontmatter, the result would be no worse than before the change (fail open, as observed in S4-A2).

## Open items for the maintainer

1. A short re-sitting of S4 part A step 5 to observe the field in agent frontmatter (prepared after commit `859e0fd`).
2. Whether the legacy inline guard and the settings-level session guard should also block when they cannot run (follow-up slice; needs upgrade logic for existing installs).
3. Whether the supported floor should be raised to 2.1.295 (today: floor 2.1.271, a doctor warning below 2.1.295).
4. Whether the destructive guard should block a call whose input it cannot read (today it allows).
5. Unchanged from before: whether the seconds and bytes of the dropped aggregate budget should have stayed (P18); the `Skill` tool grant for the coordinator; reliance on the fallback read because the interactive main session does not preload `coordinate-artifact` (S3-A); the launcher's `.cmd` shim fault (own pull request); a full interactive realize-and-review journey.

## Next

P21 (the `author-skill` route writes `evals/evals.json`, the maintainer's decision) is in work in its own worktree on top of `859e0fd`.
