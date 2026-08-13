# E2E Test Infra: agents-united

## Test Philosophy
- Opaque-box, requirement-driven E2E test suite. Independent of internal code design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing across Tiers 1-4.

## Feature Inventory
| # | Feature | Target Test File | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|------------------|:------:|:------:|:------:|:------:|
| 1 | Agent Frontmatter & Schema Validation | tests/e2e-agents-schema.test.ts | 5 | 4 | 3 | 2 |
| 2 | Agent Prompt Length & Hooks Validation | tests/e2e-agents-prompts.test.ts | 5 | 4 | 3 | 2 |
| 3 | Skill Progressive Frontmatter & Depth | tests/e2e-skills-depth.test.ts | 5 | 5 | 3 | 2 |
| 4 | Workflow Metadata & Phase Gates | tests/e2e-workflows-gates.test.ts | 5 | 5 | 3 | 2 |
| 5 | Doctor & CLI Integration Verification | tests/e2e-doctor-cli.test.ts | 4 | 4 | 3 | 2 |

## Test Architecture
- Test runner: Vitest (`npm test` or `npx vitest run`)
- Type checker: TypeScript (`npm run typecheck`)
- Location: `tests/e2e-*.test.ts`
- Opaque-box CLI verification: Child process execution of `node dist/cli.js doctor` and live filesystem parsing of `registry/`.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised |
|---|----------|--------------------|
| 1 | Complete Workspace Audit via Doctor CLI | Doctor CLI, Agents, Skills, Workflows |
| 2 | Full Registry Metadata & Schema Verification | Agent, Skill, Workflow schemas |

## Coverage Summary
- E2E Tests: 71
- Total Suite Tests: 92 (21 unit + 71 E2E)
- All 11 test files passing 100%.
