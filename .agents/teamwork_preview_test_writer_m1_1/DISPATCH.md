## 2026-08-13T16:38:30Z
You are teamwork_preview_test_writer for Milestone M1 (E2E Testing Track).
Working directory: c:\github\agents-united\.agents\teamwork_preview_test_writer_m1_1
Original Request Path: c:\github\agents-united\ORIGINAL_REQUEST.md
Scope Document Path: c:\github\agents-united\.agents\sub_orch_m1_e2e\SCOPE.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task:
1. Read ORIGINAL_REQUEST.md, SCOPE.md, and the explorer reports in:
   - `c:\github\agents-united\.agents\teamwork_preview_explorer_m1_1\analysis.md`
   - `c:\github\agents-united\.agents\teamwork_preview_explorer_m1_2\analysis.md`
   - `c:\github\agents-united\.agents\teamwork_preview_explorer_m1_3\analysis.md`

2. Implement 5 comprehensive, opaque-box, requirement-driven E2E test files in `tests/` covering Tiers 1-4 using Vitest:
   - `tests/e2e-agents-schema.test.ts`: Frontmatter schema parsing for all 28 agents (`name`, `version`, `type`, `description`, `model`, `permissionMode`, `commandExecutionPolicy`), valid types, valid permissionMode. Tier 1-4 tests (happy path, corrupt/invalid frontmatter checks, boundary checks, full inventory audit).
   - `tests/e2e-agents-prompts.test.ts`: System prompt line counts >= 40 lines per agent across all 28 agents, presence of explicit lifecycle hooks (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`). Tier 1-4 tests.
   - `tests/e2e-skills-depth.test.ts`: Skill frontmatter parsing (`name`, `description`, `metadata: { author, version }`) for all 48 skills, runbook line counts >= 50 lines per skill, exemplars & sections presence. Tier 1-4 tests.
   - `tests/e2e-workflows-gates.test.ts`: Workflow frontmatter parsing (`name`, `description`, `bundle`, `estimatedDuration`) for all 44 workflows, phase-by-phase flowcharts, phase transition criteria, deterministic phase gates, validation checkpoints, rollback protocols. Tier 1-4 tests.
   - `tests/e2e-doctor-cli.test.ts`: Opaque-box CLI execution tests running `node dist/cli.js doctor`, `node dist/cli.js --help`, `node dist/cli.js --version`. Verifies exit code 0, stdout formatting, error code handling for bad flags, and workspace health report output. Tier 1-4 tests.

3. Run `npm test` and `npm run typecheck` to verify that all new E2E tests and existing unit tests pass cleanly.

4. Write a detailed report `changes.md` and `handoff.md` in your working directory `.agents/teamwork_preview_test_writer_m1_1/` with exact test counts, test commands, and test results. Notify parent when finished.
