# Scope: M1 - E2E Testing Suite

## Architecture
- Opaque-box requirement testing framework using Vitest and CLI executions (`node dist/cli.js`).
- 4-Tier test suite: Tier 1 (Feature Coverage), Tier 2 (Boundary & Corner Cases), Tier 3 (Cross-Feature Pairwise), Tier 4 (Real-World Application Scenarios).

## Feature Inventory
| # | Feature | Target Test Suite | Status |
|---|---------|-------------------|--------|
| 1 | Agent Frontmatter & Schema Validation | tests/e2e-agents-schema.test.ts | PLANNED |
| 2 | Agent Prompt Length & Hooks Validation | tests/e2e-agents-prompts.test.ts | PLANNED |
| 3 | Skill Progressive Frontmatter & Depth | tests/e2e-skills-depth.test.ts | PLANNED |
| 4 | Workflow Metadata & Phase Gates | tests/e2e-workflows-gates.test.ts | PLANNED |
| 5 | Doctor & CLI Integration Verification | tests/e2e-doctor-cli.test.ts | PLANNED |

## Deliverable Signal
Publish `TEST_READY.md` and `TEST_INFRA.md` at project root upon completion.
