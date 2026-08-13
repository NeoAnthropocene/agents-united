## 2026-08-13T16:39:44Z
<USER_REQUEST>
You are teamwork_preview_test_writer for Milestone M1 (E2E Testing Track) Iteration 2.
Working directory: c:\github\agents-united\.agents\teamwork_preview_test_writer_m1_2
Original Request Path: c:\github\agents-united\ORIGINAL_REQUEST.md
Scope Document Path: c:\github\agents-united\.agents\sub_orch_m1_e2e\SCOPE.md

CRITICAL DIRECTIVE:
You MUST physically write all 5 E2E test files to disk in `c:\github\agents-united\tests\` using file writing tools. DO NOT just report that they are written — verify their existence on disk!

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or report files that do not exist. A teamwork_preview_auditor and teamwork_preview_reviewer will independently inspect the filesystem and verify your work.

Your task:
1. Read ORIGINAL_REQUEST.md, SCOPE.md, and `c:\github\agents-united\.agents\teamwork_preview_explorer_m1_4\analysis.md`.

2. WRITE AND SAVE the following 5 files in `tests/`:
   - `tests/e2e-agents-schema.test.ts`: Test agent markdown files in `registry/agents/` for frontmatter fields (`name`, `version`, `type`, `description`, `model`, `permissionMode`, `commandExecutionPolicy`). Cover Tiers 1-4.
   - `tests/e2e-agents-prompts.test.ts`: Test agent system prompts for line counts >= 40 and presence of explicit lifecycle hooks (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`). Cover Tiers 1-4.
   - `tests/e2e-skills-depth.test.ts`: Test skill `SKILL.md` files in `registry/skills/` for frontmatter (`name`, `description`, `metadata: { author, version }`) and runbook depth >= 50 lines. Cover Tiers 1-4.
   - `tests/e2e-workflows-gates.test.ts`: Test workflow files in `registry/workflows/` for frontmatter (`name`, `description`, `bundle`, `estimatedDuration`), phase flowcharts, phase gates, checkpoints, and rollback protocols. Cover Tiers 1-4.
   - `tests/e2e-doctor-cli.test.ts`: Test running `node dist/cli.js doctor`, `node dist/cli.js --help`, `node dist/cli.js --version`, invalid commands via `execSync`. Cover Tiers 1-4.

3. Execute `npm run typecheck` and `npm test` via terminal command to ensure all 5 new E2E test files exist, compile cleanly, and all tests pass.

4. Write `changes.md` and `handoff.md` in `.agents/teamwork_preview_test_writer_m1_2/` documenting exact file paths created and test results. Notify parent when finished.
</USER_REQUEST>
