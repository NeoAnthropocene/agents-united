# Plan 033 P12, review fixes, branch hygiene and decisions: offline verification, 2026-11-15

P12 delivers three review-and-fix rounds on work that had no second-model review, one branch-hygiene round, and the maintainer decisions of 2026-11-15 for the factory hooks, guard failure mode, installed contribution runbook and Bundle route slices, integrated offline in the working tree on top of local commit `2bbeb95` (uncommitted). No new feature is added; 26 tracked files are changed and 2 new test files are added (`tests/agent-factory-sync-text.test.ts`, `tests/plan-033-no-local-paths.test.ts`). Everything in this record is offline. No live Host, model or provider run took place, and no private records were accessed. See [ADR 0067](adr/0067-claude-factory-realization-delivery.md) (sections dated 2026-11-15), [the P11 verification record](plan-033-p11-verification-2026-11-15.md), [the P10 slice 1 verification record](plan-033-p10-verification-2026-11-15.md) and [the P9 verification record](plan-033-p9-verification-2026-11-15.md).

## Scope and baseline

- Date: 2026-11-15.
- Branch: `codex/plan-033-claude-delivery-nov10`. Local commits, none pushed: `2fd7f2d`, `552746d`, `3c48421`, `a9dae87` (P9), `2db25b0` (sync slice 1 with the P9 and P10 records), `2bbeb95` (sync slice 2, the 21 design-rule tests, the P11 records). This work ("P12") sits on top of `2bbeb95` in the working tree and is not committed when these records are written.
- Node 24.19.0, Windows. No live Host, model or provider run of the factory. No private records.
- The earlier records of the same day are committed (`2db25b0` and `2bbeb95`); this work adds to them without rewriting them.
- Separate from Plan 033: PR #218 (`host-agent-router` 1.1.1) is open against `dev` (commits `cf2fe88`, `31e32ee`, `1ba31e0` on 2026-11-15); not merged; not part of this branch.

## What P12 is

Three review-and-fix rounds on work that had no second-model review, one hygiene round, and maintainer decisions of 2026-11-15 for the factory hooks, guard failure mode, contribution runbook and Bundle route slices. No new feature. 26 tracked files changed and 2 new test files (`tests/agent-factory-sync-text.test.ts`, `tests/plan-033-no-local-paths.test.ts`).

## Part 1: review of the `skill-check` policy code and its fixes

Independent read-only review of commit `a9dae87` (P9 slice A) by another model (Antigravity, Gemini 4 Hydrogen High; `review-skill-policies.report.md` in the scratch records): three blockers, five major, four minor, one note. Verdict: not acceptable without fixes.

Taken findings were reproduced first by a failing test and fixed test-first (in code comments this work is labelled P12, fixed in worktree `p13-skill-check-fixes`). Severities are the review report's; "Further" marks points beyond its eight numbered findings.

| Finding | Severity | What was changed | Files |
| --- | --- | --- | --- |
| `adapted-source` stub rule could not fire for a candidate carrying the required `LICENSE` | Blocker | Supporting files now counted without `LICENSE`, `NOTICE.md`, `evals/` and empty files (`countSupportingFiles`). | `src/core/skill-check.ts`, `tests/skill-check.test.ts` |
| Candidate or corpus reached through a junction or symbolic link was accepted on Windows when written with forward or mixed slashes | Blocker | Ancestors are split on both separators on Windows (`PATH_SEPARATORS`). Confirmed by the orchestrating session against the built command with a real junction before the fix; refused in all three separator forms after it. | `src/core/skill-check.ts`, `tests/skill-check.test.ts` |
| Link given with a trailing separator | Blocker | `withoutTrailingSeparators` (exported) is applied before the first `lstat`. Not reproduced on Windows by the orchestrating session (which first told the worker to leave it); the worker showed it is real on POSIX (`lstat` of a link written with a trailing slash follows the link). Fixed; the POSIX test is skipped on Windows and has not run anywhere yet. | `src/core/skill-check.ts`, `tests/skill-check.test.ts` |
| `SKILL.md` link containing `>` made the layout check look up a path outside the candidate folder | Major | Link targets come from one function (`supportLinkTargets`), and a link with a `..` segment is never looked up. | `src/core/skill-layout.ts`, `src/core/skill-check.ts`, `tests/skill-policy-gates.test.ts`, `tests/skill-check.test.ts` |
| `metadata.source` scheme, user-info, self-repo and commit validation | Major | Parsed as a URL (`parseSource`): must be `https:` without user information; this project's own repository is recognised after decoding (`namesThisRepository`); the pinned commit must be a whole path segment of 40 hexadecimal characters (`pinnedCommitOf`). | `src/core/skill-licence-lint.ts`, `src/core/skill-check.ts`, `tests/skill-policy-gates.test.ts`, `tests/skill-check.test.ts` |
| `NOTICE.md` inspection allowed commented or substring tokens and untrimmed licence values | Major | HTML comments are removed before inspection (`withoutHtmlComments`); the commit and the licence are matched with token boundaries; the `license` value is trimmed. | `src/core/skill-licence-lint.ts`, `tests/skill-policy-gates.test.ts`, `tests/skill-check.test.ts` |
| Objects in front matter where a string is expected raised a `TypeError`; non-string eval prompts/expected outputs | Major | `plainText` and `showValue` avoid `TypeError`; evaluation prompts and expected outputs must be strings. | `src/core/skill-layout.ts`, `src/core/skill-contract.ts`, `src/core/skill-check.ts`, `tests/skill-policy-gates.test.ts`, `tests/skill-check.test.ts` |
| Test `"rejects the project author"` tested another author and passed with the rule deleted | Major | Updated the `ADAPTED_METADATA` case (`the project author`) to test the project author (`agents-united`). | `tests/skill-check.test.ts` |
| Control characters U+007F to U+009F in candidate entry names | Further | Added `\u007f-\u009f` to `UNSAFE_NAME_CHARS` in `unsafeEntryName`. | `src/core/skill-check.ts`, `tests/skill-check.test.ts` |
| Duplicate metadata keys that differ in letter case | Further | Added case- and whitespace-insensitive key helpers (`keysNamed`, `hasKey`) for upstream/commit checks. | `src/core/skill-check.ts`, `tests/skill-check.test.ts` |
| `NOTICE.md` file name in another letter case | Further | Matched `NOTICE.md` case-insensitively in `isTopLevelNoticeOrLicence` and `LICENCE_OR_NOTICE_FILE`. | `src/core/skill-layout.ts`, `src/core/skill-check.ts`, `tests/skill-policy-gates.test.ts`, `tests/skill-check.test.ts` |

- **Not taken:** Unicode look-alikes of the author name (the command does not verify the truth of the declaration).
- **Known and left:** the `adapted-source` author comparison is slightly strict.
- **Orchestrating session's acceptance run in the worker's worktree:** `typecheck` exit 0; 32 test files, 956 passed, 7 skipped.

## Part 2: review of the sync slice 1 wiring and its fixes

Independent read-only review of commit `2db25b0` by another model (Antigravity, Gemini 4 Hydrogen High; `review-sync-wiring.report.md`): four major, six minor, one note. Nine points taken, two not.

- **Taken (brief `p16-wiring-review-fixes.brief.md`):**
  - `registry/skills/sync-host/references/plan.md` and `registry/skills/sync-host/references/handback.md`: wording and example faults corrected against the schema and the checker.
  - `registry/hosts/claude/agents/factory-sync.md`: one body sentence was wider than the core's scope (`Grep`, `Glob`, `ListMcpResourcesTool`, `ReadMcpResourceTool` narrowed to the sync job and the listed target records only); `SubagentHandback` was stated as unconditional (aligned in the `sync-host` runbook and `handback.md` to `SubagentHandback` when supplied by the Host, otherwise the ordinary final response).
  - Leftovers of the worker-table refactor in `src/core/claude-factory-declaration.ts`, `src/core/claude-factory-binding.ts` and `src/core/claude-factory-start.ts`: each `FACTORY_WORKERS` row now carries `capabilities`, `capabilitiesWhen` (`'coordinated'` or `'always'`) and `capabilityRefusal`; the binder reads the capability classes and `requiredInstalled` from the table; two new consistency refusals (a worker found by Skill and by role name must be one row; a caller's Skill and guard class must be the table's for a worker role). The refusal texts for the realizer and the evaluator are unchanged.
  - `registry/bundles.json` (the `agent-factory` description) and the `README.md` paragraph now name the sync worker (`factory-sync` and `sync-host`).
  - Both `sync-host` entries (`registry/skills/sync-host/SKILL.md` and `registry/hosts/claude/skills/sync-host/SKILL.md`): shared 5,360 characters, 63 lines; native 5,936 characters, 65 lines (limit 6,000 and 90).
  - Tests added: `tests/agent-factory-sync-text.test.ts` (new), and cases in `tests/agent-factory-sync-delivery.test.ts`, `tests/agent-factory-sync-lifecycle.test.ts` and `tests/agent-factory-worker-lookup.test.ts` (native-only widening, `context: fork`, update of an older workspace, mismatched helper arguments).
- **Two points not taken, with their reasons:**
  - **Point 1:** a worker's support files, references and hooks are checked through the coordinator's dependency check and not on their own. Not taken: unchanged behaviour shared with the evaluator; the bundle always ships the coordinator, and since slice 2 the coordinator requires the sync closure. Recorded as known and left.
  - **Point 2 (not taken here):** the read-only guard's matcher does not name several Host tools (for example `Monitor`, `Skill`, `SendMessage`, scheduling and web tools). Moved to the hooks design (Part 4), because the worker's `tools` line is the allowlist and the matcher is shared by every read-only role.
- **Wrong statement in the review:** the statement that `host-library/_upstream/skills.json` has no `sync-host` entry (it has one).

## Part 3: branch hygiene

- Four tracked documents carried a local absolute path added on this branch (`docs/plan-033-handoff-2026-11-10.md`, `docs/plan-033-slice-4-handoff.md`, `plans/033-slice-4-claude-realize-design.md`, `plans/033-slice-4-p8-skill-design.md`): replaced by `<worktree>` and `<temp folder>`. New test `tests/plan-033-no-local-paths.test.ts` keeps them out of the Plan 033 documents.
- `tests/agent-factory-coordinator-launcher.test.ts`: a patch of a copied `dist/cli.js` that matched nothing in the current build is now an assertion that fails when the build is stale.
- `src/cli.ts`: `underConstructionNotice` is exported and names the three workers (`factory-realizer`, `factory-evaluator`, `factory-sync`); `tests/cli-contributor-wizards.test.ts` pins it.
- Orchestrating session's run: 5 test files, 129 passed.

## Part 4: maintainer decisions of 2026-11-15

Two read-only design papers preceded the hooks and contribution decisions (each with quoted lines checked mechanically: `p17-factory-hooks-design.paper.md` had 21 quoted lines confirmed, 4 quotes not found on their cited lines, 68 shortened citations not checked; `p18-contribution-runbook-design.paper.md` had 16 quoted lines confirmed, 1 quote on line 26 rather than cited line 19 of `registry/skills/author-bundle/SKILL.md`, 24 shortened citations not checked). Option labels below are quoted verbatim:

- **Contribution runbook:** **"Reference + same wording (Recommended)"**. One reference file in the coordinator's Skill, named at the hand-off step, and the same upstream wording in every authoring Skill; no grant, preload or bundle change. Not built yet.
- **Factory hooks:** **"Nothing new, record limits (Recommended)"**. The two existing guards stay (the destructive-operation guard on the coordinator and the realizer; the read-only guard on the evaluator and the sync worker). No protected-branch guard and no guard for generated or pinned files is built. Limits recorded:
  - Each read-only worker's `tools` line is the boundary: `Glob, Grep, ListMcpResourcesTool, Read, ReadMcpResourceTool, ReportFindings, SubagentHandback` (seven tools).
  - The read-only guard's matcher is `Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit|Agent|Workflow|CronCreate|EnterWorktree|Artifact|SendUserFile|mcp__.*`. It does not name every tool the Host documents (for example `Monitor`, `Skill`, `SendMessage`, scheduling and web tools). It is a second line behind the `tools` list, not a complete list.
  - Whether a `PreToolUse` hook in the frontmatter of a worker started with the `Agent` tool runs at all is not proven for this factory; it waits for a live sitting. A headless run does not run a project agent's frontmatter hooks (ADR 0042).
  - The matcher is shared by every native Claude role that carries the read-only guard, so widening it is not a factory-only change.
- **Guard failure mode:** **"Keep, decide at stage proof (Recommended)"**. The guards stay fail-open with the doctor warning. The Host documents `"onFailure": "block"` for command hooks from Claude Code 2.1.295 (`host-library/claude/pages/hook/hooks.md`, section "Block the action when a hook fails"); using it would touch all 22 native Claude roles and is decided with live evidence in the Claude stage proof.
- **Bundle route:** **"Yes, validator first"**. A deterministic `agents bundle-check` command is specified (`p19-bundle-check-spec.spec.md`: 54 quoted lines confirmed, 5 flagged lines read and confirmed across two source lines/line number, 53 shortened citations not checked) and built before the route through the coordinator. Specified (read-only, quotes checked); not built when these records are written.

Pending on the same day, not part of the gated tree: a read-only scripted-workflow options paper (`p23-scripted-workflow-options.paper.md`) recommends shipping none now, because a Claude workflow script has no file system or shell access of its own and takes no user input mid-run (`host-library/claude/pages/orchestration/workflows.md`, the limits table), while every coordinator route runs caller-executed checker scripts between worker turns and has at most four sequential workers. The maintainer's decision is pending.

## How the work was done

- Briefed, reviewed and integrated by the orchestrating Claude Code session.
- The two independent reviews and the design papers: Antigravity (Gemini 4 Hydrogen), read-only.
- The three fix rounds and the hygiene round: Claude subagents (Sonnet 5.5), each in its own worktree, test-first, "not reproduced" allowed. Workers did not commit.
- Working records (untracked): `scratch/plan-033-implementation/routed-2026-11-14/` (`DECISIONS-2026-11-14.md`, `review-skill-policies.report.md`, `review-sync-wiring.report.md`, `p16-wiring-review-fixes.brief.md`, `p17-factory-hooks-design.paper.md`, `p18-contribution-runbook-design.paper.md`, `p19-bundle-check-spec.spec.md`, `p23-scripted-workflow-options.paper.md`, `FACTS-P12.md`) and `scratch/plan-033-implementation/PLAN-033-REMAINING-2026-11-15.md`.

## Gate results

Run by the orchestrating session on the integrated uncommitted tree with all four parts integrated on top of `2bbeb95`, on Windows (Node 24.19.0). Raw files are in `logs/plan-033-p12-2026-11-15/` (each step with `.command.txt`, `.stdout.txt`, `.stderr.txt`, `.exit.txt`; `base-head.txt` is `2bbeb95`, `tree-status.txt` lists the uncommitted files). One run.

| Command | Exit | Counts | Raw files |
| --- | --- | --- | --- |
| `hostlib-verify` | 0 | Passed | `hostlib-verify.{command,stdout,stderr,exit}.txt` |
| `typecheck` | 0 | Passed | `typecheck.{command,stdout,stderr,exit}.txt` |
| `full-test-serial` (`env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false`) | 0 | 298 files passed; 6,928 tests passed, 220 skipped, of 7,148; 1,465.15 s | `full-test-serial.{command,stdout,stderr,exit}.txt` |
| `addon-matrix` (`AGENTS_CI_FULL=1 env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/e2e-domain-conformance.test.ts --maxWorkers=1 --fileParallelism=false`) | 0 | 317 passed, none skipped; 433.31 s | `addon-matrix.{command,stdout,stderr,exit}.txt` |

For comparison, the P11 gate ran 296 files, 6,792 passed, 219 skipped, of 7,011.

Windows only.

## Known and left

- A worker's closure is validated through the coordinator's dependency check only (Part 2, point 1).
- The read-only guard's matcher is not a complete tool list (Part 4).
- Under `adapted-source`, the author comparison is slightly strict.
- From earlier, unchanged: the sync runbook (`references/host-sync.md`) has not been executed end to end; a reordered `Agent(...)` grant is accepted.

## Unverified

- Everything live.
- Linux and CI behaviour of this branch (never pushed). Tests that need a case-sensitive file system, POSIX links (including the POSIX trailing-slash link test in `tests/skill-check.test.ts`) or file names Windows refuses are skipped here and have not run anywhere.
- No second-model review of the fix rounds themselves; the orchestrating session read each change and re-ran each acceptance.

## Next

1. Commit this P12 work locally when directed, then push and open a pull request to `dev` for the first Linux run, on the maintainer's word.
2. Build `agents bundle-check`, then the Bundle route through the coordinator, and build the installed contribution runbook.
3. Run the Claude stage proof (including hooks inside `Agent`-started workers, guard failure mode, P8b stage 2 typed observation, and resolving the pending scripted-workflow decision), then the other Hosts.
