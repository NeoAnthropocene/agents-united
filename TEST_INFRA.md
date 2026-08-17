# E2E Test Infra: Agents United Ecosystem Expansion

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation internals.
- Derived from `ORIGINAL_REQUEST.md` and user-facing specifications.
- Complete coverage across all 44 inventoried features and 18 bundles.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory & Test Coverage Mapping
| # | Feature | Requirement Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Real-World) |
|---|---------|-------------------|:----------------:|:-----------------:|:----------------------:|:-------------------:|
| 1 | `subagent-marketing-creative-designer.md` | R1 | 5 | 5 | ✓ | ✓ |
| 2 | `growth-marketing` Base Modularization | R1 | 5 | 5 | ✓ | ✓ |
| 3 | `seo-content-marketing` Addon Bundle | R1 | 5 | 5 | ✓ | ✓ |
| 4 | `performance-paid-acquisition` Addon Bundle | R1 | 5 | 5 | ✓ | ✓ |
| 5 | `product-led-growth` Addon Bundle | R1 | 5 | 5 | ✓ | ✓ |
| 6 | `lifecycle-email-marketing` Addon Bundle | R1 | 5 | 5 | ✓ | ✓ |
| 7 | Recommendation: `orchestrator-engineering.md` | R2 | 5 | 5 | ✓ | ✓ |
| 8 | Recommendation: `orchestrator-marketing.md` | R2 | 5 | 5 | ✓ | ✓ |
| 9 | Recommendation: `orchestrator-system-architecture.md` | R2 | 5 | 5 | ✓ | ✓ |
| 10 | Recommendation: `orchestrator-design.md` | R2 | 5 | 5 | ✓ | ✓ |
| 11 | Recommendation: `orchestrator-research.md` | R2 | 5 | 5 | ✓ | ✓ |
| 12 | Recommendation: `orchestrator-business.md` | R2 | 5 | 5 | ✓ | ✓ |
| 13 | Recommendation: `orchestrator-security.md` | R2 | 5 | 5 | ✓ | ✓ |
| 14 | `ai-ml-engineering` Sub-Bundle | R3 | 5 | 5 | ✓ | ✓ |
| 15 | `subagent-ml-platform-engineer.md` | R3 | 5 | 5 | ✓ | ✓ |
| 16 | `subagent-ai-model-architect.md` | R3 | 5 | 5 | ✓ | ✓ |
| 17 | `modal-serverless-python` Skill | R3 | 5 | 5 | ✓ | ✓ |
| 18 | `replicate-model-inference` Skill | R3 | 5 | 5 | ✓ | ✓ |
| 19 | `runpod-gpu-orchestration` Skill | R3 | 5 | 5 | ✓ | ✓ |
| 20 | `local-llm-inference` Skill | R3 | 5 | 5 | ✓ | ✓ |
| 21 | `rag-vector-pipeline` Skill | R3 | 5 | 5 | ✓ | ✓ |
| 22 | `hf-model-evaluation` Skill | R3 | 5 | 5 | ✓ | ✓ |
| 23 | `vector-database-design` Skill | R3 | 5 | 5 | ✓ | ✓ |
| 24 | Scoped AI Safety: Secret Redaction | R3 | 5 | 5 | ✓ | ✓ |
| 25 | Scoped AI Safety: GPU Cost Ceilings | R3 | 5 | 5 | ✓ | ✓ |
| 26 | Scoped AI Safety: Training PII Scrubbing | R3 | 5 | 5 | ✓ | ✓ |
| 27 | `workflow-ml-eval.md` | R3 | 5 | 5 | ✓ | ✓ |
| 28 | `workflow-rag-pipeline-deploy.md` | R3 | 5 | 5 | ✓ | ✓ |
| 29 | `workflow-serverless-gpu-deploy.md` | R3 | 5 | 5 | ✓ | ✓ |
| 30 | `vercel-deploy-best-practices` Skill | R4 | 5 | 5 | ✓ | ✓ |
| 31 | `ai-prototype-refactoring` Skill | R4 | 5 | 5 | ✓ | ✓ |
| 32 | `supabase-backend-architecture` Skill | R4 | 5 | 5 | ✓ | ✓ |
| 33 | `turso-distributed-sqlite` Skill | R4 | 5 | 5 | ✓ | ✓ |
| 34 | `azure-infrastructure-bicep` Skill | R4 | 5 | 5 | ✓ | ✓ |
| 35 | Frontend Architect Platform Updates | R4 | 5 | 5 | ✓ | ✓ |
| 36 | Backend Architect Platform Updates | R4 | 5 | 5 | ✓ | ✓ |
| 37 | DevOps Engineer Platform Updates | R4 | 5 | 5 | ✓ | ✓ |
| 38 | Designer Toolkit Platform Updates | R4 | 5 | 5 | ✓ | ✓ |
| 39 | Complete Registry Manifest `bundles.json` | R5 | 5 | 5 | ✓ | ✓ |
| 40 | CLI Sync in `src/cli.ts` | R5 | 5 | 5 | ✓ | ✓ |
| 41 | Ubiquitous Domain Dictionary `CONTEXT.md` | R5 | 5 | 5 | ✓ | ✓ |
| 42 | Ecosystem Matrix & Attributions `README.md` | R5 | 5 | 5 | ✓ | ✓ |
| 43 | Test Suite Count Synchronization | R5 | 5 | 5 | ✓ | ✓ |
| 44 | CLI End-to-End & Doctor Verification | Acceptance | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Vitest (`npm test`)
- **Compilation**: TypeScript (`npm run build`)
- **Validation Engine**: 4-Tier validation (`tests/e2e-agents-schema.test.ts`, `tests/e2e-agents-prompts.test.ts`, `tests/e2e-skills-depth.test.ts`, `tests/e2e-workflows-gates.test.ts`, `tests/cli-e2e.test.ts`, `tests/registry.test.ts`, `tests/doctor.test.ts`).

## Real-World Application Scenarios (Tier 4)
1. **Scenario 1 (Growth Marketing Full Funnel)**: User requests complete growth stack with creative ads, programmatic SEO, paid PPC attribution, PLG onboarding funnel, and email nurture sequences (`growth-marketing` + 4 addons).
2. **Scenario 2 (Dynamic Cross-Bundle Recommendation)**: User asks engineering orchestrator for serverless GPU inference and mobile deployment; orchestrator recommends `agents add ai-ml-engineering` and `agents add mobile-development`.
3. **Scenario 3 (Autonomous AI/ML Serverless Pipeline)**: User deploys Modal GPU endpoint with vLLM, builds RAG pipeline with Qdrant vector DB, and evaluates accuracy with HF benchmark while enforcing zero-secret leakage and GPU cost ceiling.
4. **Scenario 4 (Modern Full-Stack Cloud Architecture)**: User asks for frontend (Vercel Next.js 15), backend (Supabase + Turso edge replicas), and IaC (Azure Bicep) with AI prototype refactoring from Lovable/v0.
5. **Scenario 5 (CLI Lifecycle & Workspace Doctor)**: User runs `agents list`, `agents add domain:marketing`, `agents add ai-ml-engineering`, `agents doctor`, and verifies healthy multi-agent environment.

## Coverage Thresholds
- Tier 1: >= 5 test cases per feature
- Tier 2: >= 5 boundary / edge test cases per feature
- Tier 3: Pairwise coverage of all major bundle and agent interactions
- Tier 4: >= 5 realistic multi-bundle application scenarios
- Acceptance: 100% test pass rate with 0 TypeScript compiler errors.
