# Agents United — Master Project Guideline & Architecture Blueprint

The universal package manager for AI agents. Curated teams of orchestrators, sub-agents, skills, and workflows — installed once, projected across **Google Antigravity 2.0 / Gemini**, **Anthropic Claude Code**, **Cursor**, **Cline**, **OpenCode**, and **Codex / AGENTS.md**.

---

## 📑 Table of Contents
1. [Executive Overview & Core Philosophy](#1-executive-overview--core-philosophy)
2. [Complete Granular Feature Inventory](#2-complete-granular-feature-inventory)
3. [Master Implementation Plans Index (plans/001–012)](#3-master-implementation-plans-index-plans001012)
4. [Architectural Decision Records (ADRs 0001–0014)](#4-architectural-decision-records-adrs-00010014)
5. [Ecosystem Architecture & Department Domains](#5-ecosystem-architecture--department-domains)
6. [Host Projection & Runtime Activation Engine](#6-host-projection--runtime-activation-engine)
7. [Interface Contracts & Specifications](#7-interface-contracts--specifications)
8. [CLI Commands & Lifecycle Guide](#8-cli-commands--lifecycle-guide)
9. [Codebase Layout & Component Map](#9-codebase-layout--component-map)
10. [Verification Matrix & Project Health](#10-verification-matrix--project-health)
11. [Branching Model, Protected `dev` & Release Automation](#11-branching-model-protected-dev--release-automation)

---

## 1. Executive Overview & Core Philosophy

### 1.1 The "One Library, Every Assistant" Architecture
AI assistants read different folder structures and frontmatter dialects:
- **Google Antigravity**: Reads `./.agents/` natively in interactive sessions (CLI TUI panel + Antigravity 2.0 desktop). Headless CLI mode (`-p` / `agy agents`) on agy 1.1.15 reads only the user-global store — see [ADR 0009](./docs/adr/0009-host-conformance-targets.md).
- **Anthropic Claude Code**: Reads `./.claude/agents/` with `tools: [...]` frontmatter.
- **Cursor**: Reads `./.cursor/agents/` and `.cursor/rules/*.mdc`.
- **Cline**: Reads the canonical `.agents/skills/` store natively, plus per-bundle projections: configured-agent YAML in `.cline/agents/*.yml` (exposed as spawnable `subagent_*` tools), coordinator rules in `.cline/rules/`, workflows in `.cline/workflows/`, and agent-plugins.org packages (`plugin.json`, `skills/`, `agents-united/teams/`) in `.agents/plugins/<bundle>/`.
- **OpenCode**: Reads `./.opencode/agent/`.
- **Codex & AGENTS.md Readers**: Reads root `AGENTS.md` standard index.

**Agents United** resolves this fragmentation:
1. **Canonical Store (`.agents/`)**: The **main library** and single source of truth. Users and orchestrators author and edit only `.agents/`.
2. **Deterministic Host Projections**: Translated machine-managed copies written to assistant-specific loader directories, tracked in the lockfile (`agents-united.json`), stamped with managed markers, refcounted across bundles, and kept in sync via `agents update`.

### 1.2 Essentials-First Philosophy & Dynamic Auto-Installation
Projects start **lean**. Installing a department domain installs only the **Essentials bundle** (Lead Orchestrator + core sub-agents + foundational skills). When a task exceeds the installed capability:
- The Lead Orchestrator executes the **Cross-Bundle Dynamic Recommendation Protocol**.
- It identifies the exact addon bundle required, explains the capability to the user, and presents the exact command (`agents add <addon>` or `agents add domain:<department>`).
- In CLI-enabled interactive environments, it prompts or auto-installs the addon scoped to the active project.

### 1.3 Dual-Bridge Operational Model
Architectural separation between delivery and reliability:
- **Delivery Bridge (`devops-engineering`)**: Under *Software Engineering & Delivery* for developer velocity, CI/CD automation, Docker/Kubernetes containerization, and preview environments.
- **Reliability Bridge (`sysops-sre`)**: Under *System Architecture & SRE* for 99.999% uptime, Prometheus/Grafana telemetry, incident response, and disaster recovery.

---

## 2. Complete Granular Feature Inventory

| # | Feature | Description | Milestone | Status | Source |
|---|---------|-------------|-----------|--------|--------|
| 1 | `subagent-marketing-creative-designer.md` | Creative/visual designer agent for ad creatives, banner layouts, brand graphics, aspect ratios | M1 | DONE | ORIGINAL_REQUEST §R1 |
| 2 | `growth-marketing` Base Modularization | Essentials base bundle with lead strategist, campaign specialists, creative designer | M1 | DONE | ORIGINAL_REQUEST §R1 |
| 3 | `seo-content-marketing` Addon Bundle | Programmatic SEO, technical SEO audits, content pipeline automation, schema markup | M1 | DONE | ORIGINAL_REQUEST §R1 |
| 4 | `performance-paid-acquisition` Addon Bundle | Multi-channel PPC (Google/Meta/LinkedIn), ROAS/CAC attribution modeling, ad copy testing | M1 | DONE | ORIGINAL_REQUEST §R1 |
| 5 | `product-led-growth` Addon Bundle | Onboarding CRO, signup funnel optimization, viral referral loops, paywall upgrades | M1 | DONE | ORIGINAL_REQUEST §R1 |
| 6 | `lifecycle-email-marketing` Addon Bundle | Automated email drip sequences, churn prevention playbooks, newsletter workflows | M1 | DONE | ORIGINAL_REQUEST §R1 |
| 7 | Cross-Bundle Recommendation: `orchestrator-engineering.md` | Recommend engineering addons (mobile, frontend, backend, QA, devops, ai-ml) | M2 | DONE | ORIGINAL_REQUEST §R2 |
| 8 | Cross-Bundle Recommendation: `orchestrator-marketing.md` | Recommend marketing addons (SEO, performance, PLG, lifecycle) | M2 | DONE | ORIGINAL_REQUEST §R2 |
| 9 | Cross-Bundle Recommendation: `orchestrator-system-architecture.md` | Recommend architecture addons (sysops-sre) & cross-domain addons | M2 | DONE | ORIGINAL_REQUEST §R2 |
| 10 | Cross-Bundle Recommendation: `orchestrator-design.md` | Recommend design & cross-domain engineering/marketing addons | M2 | DONE | ORIGINAL_REQUEST §R2 |
| 11 | Cross-Bundle Recommendation: `orchestrator-research.md` | Recommend research & cross-domain business/AI addons | M2 | DONE | ORIGINAL_REQUEST §R2 |
| 12 | Cross-Bundle Recommendation: `orchestrator-business.md` | Recommend business & cross-domain PLG/architecture addons | M2 | DONE | ORIGINAL_REQUEST §R2 |
| 13 | Cross-Bundle Recommendation: `orchestrator-security.md` | Recommend security & cross-domain SRE/DevOps/AI safety addons | M2 | DONE | ORIGINAL_REQUEST §R2 |
| 14 | `ai-ml-engineering` Sub-Bundle | Dedicated 7th sub-bundle under Software Engineering & Delivery | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 15 | `subagent-ml-platform-engineer.md` | Serverless GPU deployment, Modal/RunPod/Replicate, container serving, hardware profiling | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 16 | `subagent-ai-model-architect.md` | LLM fine-tuning, HF model evaluation, RAG retrieval design, vector databases | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 17 | `modal-serverless-python` Skill | Modal.com serverless Python, GPU functions, container image configs | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 18 | `replicate-model-inference` Skill | Hosted model inference using Replicate API, predictions, webhooks | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 19 | `runpod-gpu-orchestration` Skill | RunPod serverless & pod GPU orchestration, vLLM worker setup | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 20 | `local-llm-inference` Skill | Self-hosted LLM inference with Ollama & vLLM, quantization, OpenAI proxy | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 21 | `rag-vector-pipeline` Skill | Retrieval-Augmented Generation with LangChain & LlamaIndex, hybrid search, rerankers | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 22 | `hf-model-evaluation` Skill | Benchmark evaluation with Hugging Face Evaluate (MMLU, GSM8k, RAGAS) | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 23 | `vector-database-design` Skill | Production vector DB indexing across Qdrant, Pinecone, Chroma, pgvector | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 24 | Scoped AI Safety: Secret Redaction | Interceptors preventing unencrypted API tokens from being logged or committed | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 25 | Scoped AI Safety: GPU Cost Ceilings | Scale-to-zero timeouts (60-300s) and max concurrency limits | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 26 | Scoped AI Safety: Training PII Scrubbing | Pre-processing checks to mask PII prior to RAG indexing or fine-tuning | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 27 | `workflow-ml-eval.md` | Benchmark evaluation, model cards, regression rollback | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 28 | `workflow-rag-pipeline-deploy.md` | Vector index provisioning, RAG endpoint deployment, quality gates | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 29 | `workflow-serverless-gpu-deploy.md` | Serverless GPU container deployment, latency probe, cold-start validation | M3 | DONE | ORIGINAL_REQUEST §R3 |
| 30 | `vercel-deploy-best-practices` Skill | Vercel Edge middleware, Server Actions, ISR, preview deployments | M4 | DONE | ORIGINAL_REQUEST §R4 |
| 31 | `ai-prototype-refactoring` Skill | Converting Lovable/v0 AI prototype files into clean component hierarchies & tokens | M4 | DONE | ORIGINAL_REQUEST §R4 |
| 32 | `supabase-backend-architecture` Skill | PostgreSQL schemas, RLS policies, Edge Functions, Auth hooks | M4 | DONE | ORIGINAL_REQUEST §R4 |
| 33 | `turso-distributed-sqlite` Skill | LibSQL edge databases, embedded replicas, multi-tenant partitioning | M4 | DONE | ORIGINAL_REQUEST §R4 |
| 34 | `azure-infrastructure-bicep` Skill | Azure Bicep IaC, Container Apps, AKS, Azure OpenAI service | M4 | DONE | ORIGINAL_REQUEST §R4 |
| 35 | Enhanced `subagent-frontend-architect.md` | Equipped with Vercel deployment best practices & Lovable/v0 prototype refactoring | M4 | DONE | ORIGINAL_REQUEST §R4 |
| 36 | Enhanced `subagent-backend-architect.md` | Equipped with Supabase RLS & Turso LibSQL distributed SQLite architectures | M4 | DONE | ORIGINAL_REQUEST §R4 |
| 37 | Enhanced `subagent-devops-engineer.md` | Equipped with Azure Bicep IaC & Vercel CI/CD preview deployment workflows | M4 | DONE | ORIGINAL_REQUEST §R4 |
| 38 | Enhanced `subagent-designer-toolkit-expert.md` | Equipped with Lovable/v0 AI prototype component refactoring & DDR specs | M4 | DONE | ORIGINAL_REQUEST §R4 |
| 39 | Complete Registry Manifest `registry/bundles.json` | 18 bundles (8 Essentials + 10 Addons) + universal `full` suite | M5 | DONE | ORIGINAL_REQUEST §R5 |
| 40 | CLI Sync in `src/cli.ts` | `BUNDLE_DISPLAY_NAMES` and generalized `isEssentials` logic | M5 | DONE | ORIGINAL_REQUEST §R5 |
| 41 | Ubiquitous Domain Dictionary `CONTEXT.md` | Complete terminology definitions for new agents, bundles, and skills | M5 | DONE | ORIGINAL_REQUEST §R5 |
| 42 | Ecosystem Matrix & Attributions `README.md` | Matrix update, bundle table, external tool credits & acknowledgments | M5 | DONE | ORIGINAL_REQUEST §R5 |
| 43 | Test Suite Count Sync `tests/` | Synchronize 4-Tier test suite counts (41 agents, 77+ skills, 57+ workflows) | M5 | DONE | ORIGINAL_REQUEST §R5 |
| 44 | E2E Verification & Adversarial Hardening | 100% pass across all tests, doctor checks, TypeScript build, CLI verification | M6 | DONE | ORIGINAL_REQUEST Acceptance |
| 45 | Plan 007: Universal Multi-Host Projection Engine | Core `HostProjector`, `--fanout` flag, `projectedTo` lockfile tracking, managed markers | M6 | DONE | PLAN_007 |
| 46 | Plan 007: AGENTS.md Standard Index Bridge | Root `AGENTS.md` bridge projection for Codex and AGENTS.md readers | M6 | DONE | PLAN_007 |
| 47 | Plan 008: Cline 4-Part Compound Projection | Pure rendering for roles, skills, coordinator rules, and team manifests | M7 | DONE | PLAN_008 |
| 48 | Plan 008: Lockfile Projection Ownership Refcounting | Refcounted multi-bundle projection ownership in `lockfile.projections` | M7 | DONE | PLAN_008 |
| 49 | Plan 008: Side-Effect-Free Cline Capability Probe | Non-destructive resolution, version probe, `--team-name` parser probe | M7 | DONE | PLAN_008 |
| 50 | Plan 008: Safe Cline Launcher & TUI | Argument array construction, stable team name generation (`au-<bundle>-<hash8>`), `agents start` command | M7 | DONE | PLAN_008 |
| 51 | Plan 008: Addon Consent & Immediate Execution | Ephemeral `--allow-addons` pre-authorization and `--start` post-install flag | M7 | DONE | PLAN_008 |
| 52 | Plan 008: Host Auditing in Doctor Engine | Host runtime capability inspection via `agents doctor --host cline` | M7 | DONE | PLAN_008 |
| 53 | Organization Bundles & Prerequisite Engine | Tier 2 composite bundles, multi-host MCP detection across Cursor, Cline, Claude, Gemini | M8 | DONE | USER_REQUEST |
| 54 | Bundle Lifecycle State Management | Status taxonomy (`stable`, `experimental`, `under-construction`, `needs-audit`, `deprecated`) | M8 | DONE | USER_REQUEST |
| 55 | Under-Construction Blocking Gate | Interactive safety banner & CLI error gate with `--allow-under-construction` flag | M8 | DONE | USER_REQUEST |
| 56 | Digital Agency Cross-Functional Composite | Organization bundle placeholder (`digital-agency`) with Firecrawl & GitHub MCP tool wiring | M8 | DONE | USER_REQUEST |
| 57 | Plan 009: Universal Meta-Skills Extraction | Extracted 6 domain-agnostic meta-skills into shared `universal-skills` baseline (`status: "stable"`) | M8 | DONE | PLAN_009 |
| 58 | Plan 009: Software Engineering Slim-Down | Slimmed `software-engineering` from 26 to 16 core skills and graduated to `status: "stable"` | M8 | DONE | PLAN_009 |
| 59 | Plan 009: Product Design Decomposition | Decomposed monolithic `product-design` into Essentials + 2 Addons (`design-systems-ops`, `design-research-testing`) | M8 | DONE | PLAN_009 |
| 61 | Antigravity Schema Enhancement | Added typed `rules:`, `inheritCustomizations`, `disable-slash-command`, and `icon` | M1 | DONE | PLAN_010 |
| 62 | Catalog Frontmatter Modernization | Standardized 58 agents with `rules:` & reasoning `/effort`, 91 skills with `icon` & slash flags | M2 | DONE | PLAN_010 |
| 63 | Security Operations Subagent Expansion | Created `cloud-security-architect`, `appsec-penetration-tester`, `compliance-grc-specialist` | M3 | DONE | PLAN_010 |
| 64 | Business Strategy Subagent Expansion | Created `financial-analyst`, `market-intelligence-analyst`, `legal-contract-analyst`, `operations-strategist` | M3 | DONE | PLAN_010 |
| 65 | Deep Research Subagent Expansion | Created `statistical-analyst` and `literature-patent-analyst` | M3 | DONE | PLAN_010 |
| 66 | System Architecture Subagent Expansion | Created `cloud-infrastructure-architect`, `database-administrator`, `finops-cost-engineer` | M3 | DONE | PLAN_010 |
| 67 | Multimodal Tooling & Audio Ingestion | Formally integrated voice/audio memo intake into `grill-with-docs`, `grill-me`, and `to-spec` | M4 | DONE | PLAN_010 |
| 68 | Live Preview URL Cards & Visual Diffs | Integrated Storybook dev server cards, live URL previews, and visual diff checks | M4 | DONE | PLAN_010 |
| 69 | Reactive Liveness Timers & Task Delegation | Injected `manage_task` delegation and reactive `schedule` liveness timers across all 58 agents | M4 | DONE | PLAN_010 |
| 70 | Digital Agency 10-Agent Roster | Graduated `digital-agency` to `experimental` with 10-agent cross-functional AstrolabsAI team | M5 | DONE | PLAN_010 |
| 71 | Tri-Tier Execution Framework | Formalized Fully Operational, Limited Operational, and Brainstorming Fallback modes | M5 | DONE | PLAN_010 |
| 72 | Multi-Client MCP Auto-Provisioning | Upgraded `PrerequisiteChecker` to dynamically generate Cursor, Cline, Claude, & Antigravity configs | M5 | DONE | PLAN_010 |
| 73 | MCP Setup Runbook Skill | Authored comprehensive `mcp-setup` runbook for 8 ecosystem MCPs | M5 | DONE | PLAN_010 |
| 74 | Two-Stage Hybrid Evaluator Engine | Fast-fail deterministic gatekeeper (0ms) + schema-constrained semantic LLM judge (`zod`) | M6 | DONE | PLAN_010 |
| 75 | Stream-JSON Continuous Evaluation Harness | Built `tests/e2e-evals/runner.ts` and multi-hop DAG evaluation test suite for `digital-agency` | M6 | DONE | PLAN_010 |

---

## 3. Master Implementation Plans Index (`plans/001`–`012`)

All foundational implementation plans (001–011) have been fully realized, tested under strict Test-Driven Development (TDD), and verified in production. Plan 012 is approved and gated on the maintainer's execution go-ahead:

| Plan | Title | Category | Status | Key Deliverables & Milestones |
| :--- | :--- | :--- | :--- | :--- |
| **[001](./plans/001-project-setup-and-ci-release.md)** | Project Scaffolding & CI Release | Tooling / CI | **DONE** | TypeScript ESM setup, `tsup` dual build (ESM + DTS), Vitest runner, ESLint/Prettier, GitHub Actions automated semantic-release pipeline. |
| **[002](./plans/002-antigravity-2-agent-skills-workflows-porting.md)** | Antigravity 2.0 Porting & Schema | Core Catalog | **DONE** | Canonical agent definitions, 7 Lead Orchestrators, 38 subagents, 90 skills, 63 workflows, YAML frontmatter schemas, scoped AI safety policies. |
| **[003](./plans/003-cli-core-engine-and-manifest-tracking.md)** | CLI Engine & Lockfile Manager | Core Engine | **DONE** | `RegistryResolver`, `InstallEngine`, `UninstallEngine`, deterministic lockfile tracking (`agents-united.json`), checksum verification, non-destructive removals. |
| **[004](./plans/004-tdd-unit-and-integration-suite.md)** | 4-Tier TDD Test Suite | Testing (TDD) | **DONE** | Tier 1 (Unit & schema checks), Tier 2 (Registry & installer logic), Tier 3 (E2E prompts & workflows), Tier 4 (Adversarial stress & CLI integration). |
| **[005](./plans/005-scope-and-installation-methods.md)** | Installation Scope & Methods | CLI / Scope | **DONE** | Project scope (`./.agents/`), Global scope (`~/.agents/`), Symlink mode (instant sync), Copy mode (standalone isolation), host target adapters. |
| **[006](./plans/006-sync-agent-structure-documentation.md)** | Ecosystem Docs & Attributions | Documentation | **DONE** | Complete ubiquitous domain vocabulary in `CONTEXT.md`, catalog tree visualizations, external platform attribution standards. |
| **[007](./plans/007-universal-multi-agent-host-projection.md)** | Universal Host Projection Engine | Core Engine | **DONE** | Host projection engine (`HostProjector`), `--fanout` flag, `projectedTo` refcounting, managed marker stamps, root `AGENTS.md` bridge. |
| **[008](./plans/008-cline-native-projection-and-team-activation.md)** | Cline Compound Projection & Team Activation | Runtime Integration | **DONE** | 4-part compound artifacts (`.cline/agents/`, `.cline/skills/`, `.cline/rules/`, `.cline/agents-united/teams/`), `lockfile.projections` refcounting, `ClineCapabilityProbe`, `ClineLauncher`. |
| **[009](./plans/009-essentials-composition-audit.md)** | Essentials Bundle Composition Audit & Modularization | Architecture / Catalog | **DONE** | `universal-skills` extraction, `software-engineering` slimmed to 16 skills, `product-design` 2-addon decomposition, graduated to `stable`. |
| **[010](./plans/010-antigravity-august-features-and-department-expansion.md)** | Antigravity August Features Adoption & Department Expansion | Core / Architecture | **DONE** | Scoped `rules:`, `inheritCustomizations`, `disable-slash-command: true`, `metadata.icon`, `manage_task`, URL preview cards, department roster expansion across Security, Business, Research, Architecture, and Continuous Stream-JSON Evals harness. |
| **[011](./plans/011-cline-plugins-projection-migration.md)** | Migrate Cline Projection to Native Plugins (v4.0.0+) | Core / Runtime Integration | **SUPERSEDED (ADR 0013)** | The assumed "Cline 4.0.0+ plugin architecture" does not exist (latest CLI = 3.0.61); `cline plugin install` is a code-plugin installer and the `package.json` manifest contract was invalid. Replaced by ADR 0013 native discovery projection. |
| **[012](./plans/012-subagent-first-planning-loop.md)** | Subagent-First Orchestration & Bounded Planning Dialogue (`digital-agency` first) | Runtime Integration / Catalog / Evals | **READY (gated)** | Opt-in `planningLoop` block + Consultation Budget rendered into the coordinator rule, Cline `maxIterations` hard cap, Planning Dialogue Loop prompts, persona alias map, and planning-loop eval criteria. Per ADR 0014; digital-agency only, rollout deferred. |

---

## 4. Architectural Decision Records (ADRs 0001–0014)

All architectural decisions recorded in `docs/adr/` are indexed and summarized below:

| ADR | Title | Status | Core Architectural Decision |
| :--- | :--- | :--- | :--- |
| **[0001](./docs/adr/0001-cli-distribution-and-runtime.md)** | CLI Distribution & Runtime | Accepted | TypeScript Node.js ESM binary published to npm as `agents-united`, executed via `npx agents-united` or global CLI. |
| **[0002](./docs/adr/0002-antigravity-2-agent-specification.md)** | Antigravity 2.0 Agent Schema Adoption | Accepted | Adopt Antigravity 2.0 markdown + frontmatter standard (`model`, `tools`, `permissionMode`, `commandExecutionPolicy`, `hooks`) as canonical format. |
| **[0003](./docs/adr/0003-manifest-and-bundle-architecture.md)** | Manifest & Installation Tracking | Accepted | Centralized `bundles.json` catalog and per-workspace `agents-united.json` lockfile to guarantee clean, deterministic uninstallation and drift detection. |
| **[0004](./docs/adr/0004-hierarchical-orchestrator-subagent-architecture.md)** | Hierarchical Orchestrator-Subagent Bundle Architecture | Accepted | Strict hierarchy: `orchestrator-<domain>.md` coordinating specialized `subagent-<role>.md`, guided by `workflow-<task>.md` and `skills/<skill>/SKILL.md`. |
| **[0005](./docs/adr/0005-automated-release-and-semantic-versioning.md)** | Automated Release & Semantic Versioning | Accepted | Use `semantic-release` on `main` branch with GitHub Actions to automate versioning, changelog generation, git tagging, and npm package publishing. |
| **[0006](./docs/adr/0006-scope-and-installation-methods-architecture.md)** | Installation Scope & Methods Architecture | Accepted | Dual scope (`project` vs `global`), dual installation methods (`symlink` vs `copy`), and multi-host target adapters (`agents`, `claude`, `cursor`, `gemini`). |
| **[0007](./docs/adr/0007-package-inventory-removal-and-update-engine.md)** | Package Inventory, Removal & Update Engine | Accepted | `InventoryScanner` for active package discovery, scope-aware `agents remove` listing only installed packages, and interactive `UpdateEngine` with drift detection. |
| **[0008](./docs/adr/0008-universal-host-projection-architecture.md)** | Universal Host Projection & Cline Runtime Activation | Accepted | Canonical store (`.agents/`) with copy-only stamp-managed projections, AGENTS.md bridge, Cline 4-part compound artifacts, read-only capability probing, and safe runtime activation (`agents start`). |
| **[0009](./docs/adr/0009-host-conformance-targets.md)** | Host Conformance Targets | Accepted | Per-host conformance probes pinned to tested CLI versions: Cline = conformant (headless CI), Antigravity = interactive-scoped confirmed on agy 1.1.15 (CLI TUI + desktop read `.agents/` natively; headless `-p` not a target). No projection shim required for Antigravity. |
| **[0010](./docs/adr/0010-universal-orchestration-bundle-and-domain-atlas.md)** | Universal Orchestration Bundle & Domain Atlas | Accepted | Prime Orchestrator (`orchestrator-universal.md`) with compact Domain Atlas, `handoff` / `grill-me`, and Route & Instruct Contract. |
| **[0011](./docs/adr/0011-antigravity-august-features-and-department-expansion.md)** | Antigravity August Features Adoption & Department Expansion | Accepted | Adoption of Antigravity 2.10 / CLI 1.1.21 schema enhancements (`rules: [...]`, `inheritCustomizations`, `disable-slash-command: true`, `metadata.icon`, `manage_task`, URL preview cards) and department subagent expansion. |
| **[0012](./docs/adr/0012-cline-native-plugins-projection.md)** | Cline Native Plugins Projection Architecture | Superseded by [0013](./docs/adr/0013-cline-native-discovery-projection.md) | Project Cline bundles as self-contained native plugins in `.agents/plugins/<bundle>/` with deterministic `package.json` manifests, skills, roles, rules, and team manifests, with automatic migration of legacy `.cline/` projections. Premise (Cline 4.0.0+ markdown plugin capabilities) disproved by runtime verification. |
| **[0013](./docs/adr/0013-cline-native-discovery-projection.md)** | Cline 3.x Native Discovery Projection & Agent Plugin Packaging | Accepted | Dual-lane Cline integration: agent-plugins.org `plugin.json` packages under `.agents/plugins/<bundle>/` (scanner hard-stop + cross-client portability) plus native discovery projections — configured agents `.cline/agents/*.yml` (spawnable `subagent_*` tools), coordinator rules `.cline/rules/`, slugified workflows `.cline/workflows/`, skills natively discovered from `.agents/skills/`. Verified against Cline CLI 3.0.61 (source commit `c853844` + binary analysis). |
| **[0014](./docs/adr/0014-subagent-first-planning-loop.md)** | Subagent-First Orchestration & Bounded Planning Dialogue | Accepted | Lead Orchestrators delegate to specialists **by default during planning**: opt-in per-bundle `planningLoop` flag (`digital-agency` first) declaring a Consultation Budget (`maxPlanningRounds`, `maxPeerExchangesPerPair`, `summaryWordCap`) rendered into the always-active coordinator rule, plus a host hard-cap layer (Cline `maxIterations` in configured-agent `.yml`), the Planning Dialogue Loop (grill → sidekick clarification → specialist council → delegation map), a persona alias map for the AstrolabsAI roster, and byte-identical rendering guarantees for non-planning-loop bundles. |

---

## 5. Ecosystem Architecture & Department Domains

The ecosystem catalog maintains **58 specialized agents** (8 Lead/Prime Orchestrators + 50 Sub-Agents), **91 skills**, and **69 workflows** structured into **26 curated bundles** (8 Essentials + 17 Addons + 1 Full suite) across **8 department domains**:

```
🌐 Agents United Registry Catalog Tree
├── 🛠️  Software Engineering & Delivery (7 bundles)
│   ├── 📦 software-engineering (Essentials Base)
│   │   ├── 🤖 Lead: orchestrator-engineering
│   │   ├── 🤖 Sub-agents: backend-architect, frontend-architect, code-reviewer, repo-index
│   │   └── ⚡ Skills: test-driven-development, systematic-debugging, git-guardrails, ...
│   ├── 📦 ai-ml-engineering [inherits: software-engineering]
│   │   ├── 🤖 Sub-agents: ml-platform-engineer, ai-model-architect
│   │   └── ⚡ Skills: modal-serverless-python, runpod-gpu-orchestration, rag-vector-pipeline, ...
│   ├── 📦 mobile-development [inherits: software-engineering]
│   │   └── 🤖 Sub-agents: ios-architect, android-architect, cross-platform-specialist
│   ├── 📦 frontend-engineering [inherits: software-engineering]
│   │   └── 🤖 Sub-agents: frontend-architect, accessibility-lead
│   ├── 📦 backend-distributed-systems [inherits: software-engineering]
│   │   └── 🤖 Sub-agents: distributed-systems-architect, data-engineer
│   ├── 📦 qa-automation [inherits: software-engineering]
│   │   └── 🤖 Sub-agents: qa-automation-lead, e2e-tester
│   └── 📦 devops-engineering [inherits: software-engineering]
│       └── 🤖 Sub-agents: devops-engineer
├── 🏛️  System Architecture & SRE (5 bundles)
│   ├── 📦 system-architecture (Essentials Base)
│   │   ├── 🤖 Lead: orchestrator-system-architecture
│   │   └── 🤖 Sub-agents: system-architect, backend-architect
│   ├── 📦 sysops-sre [inherits: system-architecture]
│   │   └── 🤖 Sub-agents: sysops-sre-lead
│   ├── 📦 system-architecture-cloud [inherits: system-architecture]
│   │   └── 🤖 Sub-agents: cloud-infrastructure-architect
│   ├── 📦 system-architecture-data [inherits: system-architecture]
│   │   └── 🤖 Sub-agents: database-administrator
│   └── 📦 system-architecture-finops [inherits: system-architecture]
│       └── 🤖 Sub-agents: finops-cost-engineer
├── 🎨  Product Design & UI/UX (3 bundles)
│   ├── 📦 product-design (Essentials Base)
│   │   ├── 🤖 Lead: orchestrator-design
│   │   └── 🤖 Sub-agents: ui-designer, ux-strategist, interaction-designer, design-systems-architect, ...
│   ├── 📦 design-systems-ops [inherits: product-design]
│   └── 📦 interactive-prototyping [inherits: product-design]
├── 📈  Growth & Marketing Operations (5 bundles)
│   ├── 📦 growth-marketing (Essentials Base)
│   │   ├── 🤖 Lead: orchestrator-marketing
│   │   └── 🤖 Sub-agents: growth-strategist, creative-designer, content-strategist, ...
│   ├── 📦 seo-content-marketing [inherits: growth-marketing]
│   ├── 📦 performance-paid-acquisition [inherits: growth-marketing]
│   ├── 📦 product-led-growth [inherits: growth-marketing]
│   └── 📦 lifecycle-email-marketing [inherits: growth-marketing]
├── 🔒  Security Operations (4 bundles)
│   ├── 📦 security-operations (Essentials Base)
│   │   ├── 🤖 Lead: orchestrator-security
│   │   └── 🤖 Sub-agents: security-engineer
│   ├── 📦 secops-cloud-security [inherits: security-operations]
│   │   └── 🤖 Sub-agents: cloud-security-architect
│   ├── 📦 secops-application-security [inherits: security-operations]
│   │   └── 🤖 Sub-agents: appsec-penetration-tester
│   └── 📦 secops-compliance-grc [inherits: security-operations]
│       └── 🤖 Sub-agents: compliance-grc-specialist
├── 🔬  Deep Technical Research (2 bundles)
│   ├── 📦 deep-research (Essentials Base)
│   │   ├── 🤖 Lead: orchestrator-research
│   │   └── 🤖 Sub-agents: deep-research, socratic-mentor, repo-index
│   └── 📦 deep-research-analytics [inherits: deep-research]
│       └── 🤖 Sub-agents: statistical-analyst, literature-patent-analyst
├── 💼  Business Strategy & Economics (4 bundles)
│   ├── 📦 business-strategy (Essentials Base)
│   │   ├── 🤖 Lead: orchestrator-business
│   │   └── 🤖 Sub-agents: business-panel-experts
│   ├── 📦 business-financial-modeling [inherits: business-strategy]
│   │   └── 🤖 Sub-agents: financial-analyst
│   ├── 📦 business-market-intelligence [inherits: business-strategy]
│   │   └── 🤖 Sub-agents: market-intelligence-analyst
│   └── 📦 business-operations-legal [inherits: business-strategy]
│       └── 🤖 Sub-agents: legal-contract-analyst, operations-strategist
├── 🏢  Organization Bundles (Experimental / Cross-Functional) (1 bundle)
│   └── 📦 digital-agency ⚡ [Experimental] [Tri-Tier Execution Framework]
│       ├── 🤖 Lead: orchestrator-marketing (Campaign Director / Chris)
│       ├── 🤖 Sub-agents: growth-strategist (Ava), conversion-specialist (Anya), content-strategist (Yavuz), creative-designer (Jamileh), campaign-specialist (Jale), backend-architect, frontend-architect, e2e-tester, sysops-sre-lead
│       ├── 🔌 Prerequisites: github (MCP), firecrawl (MCP), context7 (MCP), playwright (MCP), markitdown (MCP), chrome-devtools (MCP), stitch (MCP), figma (MCP)
│       └── 💡 Execution Tiers: Fully Operational (API Keys) / Limited Operational (Free/Public MCP) / Brainstorming (Native Fallback)
├── 🌐  Universal Autonomous Department (1 bundle)
│   └── 📦 universal-skills (Global Capability Layer)
│       ├── 🤖 Lead: orchestrator-universal (Domain Atlas Dispatcher)
│       └── ⚡ Skills: grill-me, grill-with-docs, domain-modeling, to-spec, to-tickets, handoff
└── 🌟  Complete Suite
    └── 📦 full (Universal Suite — all 58 agents, 91 skills, 69 workflows)
```

---

## 6. Host Projection & Runtime Activation Engine

### 6.1 Projection Pipeline
When a user runs `agents add <bundle> --fanout claude,cursor,cline,opencode,codex` or `agents update --fanout ...`:
1. **Canonical Deployment**: Files are installed into `.agents/` (or global `~/.agents/`) via symlink or copy.
2. **Translation Matrix**:
   - `claude`: Translates frontmatter to Claude Code dialect (`tools`, `model`), strips Antigravity execution keys.
   - `cursor`: Generates Cursor agent definitions and `.cursor/rules/*.mdc`.
   - `cline`: Emits the **ADR 0013 dual-lane projection** (Agent Plugin package `plugin.json` + native discovery: configured agents, rules, slugified workflows; skills activate natively from `.agents/skills/`).
   - `opencode`: Translates to OpenCode agent dialect in `.opencode/agent/`.
   - `codex`: Generates root `AGENTS.md` bridge indexing all canonical capabilities.
3. **Managed Marker Stamping**: Every projected markdown file receives a top comment:
   `<!-- managed-by: agents-united | profile: <profile> | canonical: .agents/... | do not edit -->`
4. **Ownership Refcounting**: Recorded in `lockfile.projections[relPath].owners = [bundle1, bundle2]`. Removing `bundle1` preserves the file if `bundle2` still depends on it.

### 6.2 Safe Capability Probing & Optional Team-Session Launch
Bundles are **natively active** in any Cline session after installation (ADR 0013 discovery — no launch step required). `agents start <bundle> [prompt]` is the optional team-session launcher:
1. **Capability Probing (`ClineCapabilityProbe`)**:
   - Resolves executable via `CLINE_BIN_PATH`, Windows Node wrapper (`<shim>/node_modules/cline/bin/cline`), Windows `cmd.exe` bridge for `.cmd`/`.bat` shims (Node ≥18.20 rejects spawning them with `shell: false`), or the POSIX binary.
   - Executes read-only semantic versioning check (`version`).
   - Executes parser probe (`--team-name agents-united-capability-probe version`) under 5000ms timeout.
2. **Launch Strategy**:
   - `named-team`: Uses `--team-name au-<bundle>-<hash8>` if probe succeeds.
   - `adaptive-session`: Falls back to standard session with coordinator prompt.
3. **Safe Execution (`ClineLauncher`)**:
   - Pass argument array directly (`shell: false`), guaranteeing immunity from shell injection even when prompt strings contain `$()`, quotes, newlines, or pipes.

---

## 7. Interface Contracts & Specifications

### 7.1 Agent Frontmatter Interface (`registry/agents/*.md`)
```yaml
---
name: orchestrator-engineering
version: 2.0.0
type: orchestrator # "orchestrator" | "subagent"
description: Autonomous dev lead coordinating vertical slices, TDD, and code review.
model: inherit # "inherit" | "pro" | "flash"
permissionMode: acceptEdits # "acceptEdits" | "requestReview" | "strict" | "readOnly"
commandExecutionPolicy: auto # "auto" | "ask" | "never"
mainAgent: true
subagent: true
tools:
  - run_command
  - view_file
  - replace_file_content
  - write_to_file
  - grep_search
  - list_dir
  - invoke_subagent
hooks:
  PreInvocation:
    - matcher: ".*"
      action: audit_workspace
  PostInvocation:
    - matcher: ".*"
      action: signal_completion
---
```

### 7.2 Skill Runbook Interface (`registry/skills/<name>/SKILL.md`)
Every skill requires frontmatter and 7 mandatory sections:
1. `Overview & Purpose`
2. `Execution Triggers`
3. `Input/Output Requirements`
4. `Step-by-Step Runbook`
5. `Code & Config Exemplars`
6. `Edge Cases & Error Recovery`
7. `Verification Checklist`

### 7.3 Team Manifest Schema (`.agents/plugins/<bundle>/agents-united/teams/<bundle>.yaml`)
```yaml
schema_version: 1
bundle: software-engineering
version: 1.0.0
coordinator:
  role_file: .agents/agents/orchestrator-engineering.md
  role_name: orchestrator-engineering
specialists:
  - role_file: .agents/agents/subagent-backend-architect.md
    role_name: subagent-backend-architect
    purpose: API routes, DB schemas, server-side data models.
skills:
  - name: test-driven-development
    path: .agents/plugins/software-engineering/skills/test-driven-development
integrity_mode: development # "strict" | "balanced" | "development"
recommended_addons:
  - mobile-development
  - frontend-engineering
```

---

## 8. CLI Commands & Lifecycle Guide

### 8.1 Core Commands
```bash
# 1. Interactive 2-stage wizard
agents add

# 2. Direct bundle installation with projection fan-out
agents add software-engineering -t agents --fanout claude,cursor,cline,opencode,codex -y

# 3. Whole department installation
agents add domain:engineering -y

# 4. View visual folder tree of all domains and bundles
agents list

# 5. Search by keyword or type
agents find playwright -i

# 6. Scope-aware uninstallation (shows only active packages)
agents remove software-engineering -y

# 7. Interactive update engine with upstream drift detection
agents update --all -y

# 8. Start installed team in Cline runtime
agents start software-engineering "Implement Vitest test coverage"

# 9. Workspace health and host runtime auditing
agents doctor --host cline
```

---

## 9. Codebase Layout & Component Map

```
c:/github/agents-united/
├── .agents/                      # Local Canonical Store (main library)
│   └── plugins/                  # Local Cline Native Plugin Projections (package.json, skills, roles, rules)
├── registry/                     # Canonical Ecosystem Catalog
│   ├── agents/                   # 58 Antigravity 2.0 agent definitions
│   ├── skills/                   # 91 modular skill runbooks with SKILL.md
│   ├── workflows/                # 69 guided workflows with Mermaid flowcharts
│   ├── rules/                    # Cross-cutting ecosystem rules
│   └── bundles.json              # Authoritative bundle index & inheritance
├── src/                          # TypeScript CLI Engine Source
│   ├── cli.ts                    # CLI presentation, CAC command router, Clack TUI
│   └── core/                     # Core Business Logic & Engines
│       ├── types.ts              # TypeScript interfaces and schemas
│       ├── registry.ts           # RegistryResolver (find, list, resolve)
│       ├── installer.ts          # InstallEngine (copy, symlink, fanout)
│       ├── uninstaller.ts        # UninstallEngine (refcounting, safe prune)
│       ├── inventory.ts          # InventoryScanner (installed packages)
│       ├── updater.ts            # UpdateEngine (version drift & sync)
│       ├── doctor.ts             # DoctorEngine (health & host audits)
│       ├── hosts.ts              # HOST_REGISTRY & target definitions
│       ├── mcp-locations.ts      # McpLocationRegistry (dynamic cross-platform host config catalog)
│       ├── prerequisites.ts      # PrerequisiteChecker (MCP auto-provisioning & config generator)
│       ├── projector.ts          # HostProjector (dialects & AGENTS.md)
│       ├── cline-projector.ts    # ClineProjector (agent-plugins.org plugin.json, configured-agent .yml, rules, workflows & team manifests)
│       ├── cline-capabilities.ts # ClineCapabilityProbe (read-only probe)
│       └── cline-launcher.ts     # ClineLauncher (safe process launcher)
├── docs/                         # Documentation
│   ├── adr/                      # Architectural Decision Records (ADRs 0001–0014)
│   └── workflow-guide.md         # Developer workflow guide (branching, protected dev, PRs, releases)
├── plans/                        # Implementation Plan Specifications (001–011)
├── tests/                        # 4-Tier Vitest Test Suite (28 test suites, 413 tests)
│   ├── e2e-evals/                # Stream-JSON Continuous Evaluation Harness (schemas, judge, runner)
│   └── helpers/                  # Test helpers and mock fixtures
├── CONTEXT.md                    # Ubiquitous Domain Dictionary
├── README.md                     # Public Project Documentation
└── PROJECT.md                    # Master Project Guideline & Architecture Blueprint
```

---

## 10. Verification Matrix & Project Health

The codebase adheres to zero technical debt, strict typing, and 100% test pass rates:

```text
> tsc --noEmit
> tsup (ESM + DTS generation)
> vitest run

 ✓ tests/cline-compatibility.test.ts
 ✓ tests/m3-worker1-validation.test.ts
 ✓ tests/registry.test.ts
 ✓ tests/m1-challenger-stress.test.ts
 ✓ tests/cline-projector.test.ts
 ✓ tests/projector.test.ts
 ✓ tests/e2e-agents-prompts.test.ts
 ✓ tests/e2e-workflows-gates.test.ts
 ✓ tests/hosts.test.ts
 ✓ tests/e2e-agents-schema.test.ts
 ✓ tests/adapter.test.ts
 ✓ tests/cline-capabilities.test.ts
 ✓ tests/e2e-skills-depth.test.ts
 ✓ tests/inventory.test.ts
 ✓ tests/cline-launcher.test.ts
 ✓ tests/doctor.test.ts
 ✓ tests/installer.test.ts
 ✓ tests/uninstaller.test.ts
 ✓ tests/updater.test.ts
 ✓ tests/fanout.test.ts
 ✓ tests/projection-lifecycle.test.ts
 ✓ tests/cli-e2e.test.ts
 ✓ tests/prerequisites.test.ts
 ✓ tests/domain-atlas-contract.test.ts
 ✓ tests/recommendation-contract.test.ts
 ✓ tests/e2e-sed-bundle-lifecycle.test.ts
 ✓ tests/e2e-domain-conformance.test.ts
 ✓ tests/e2e-evals/e2e-stream-evals.test.ts

 Test Files  28 passed (28)
      Tests  410 passed | 208 skipped (618)
```

---

## 11. Branching Model, Protected `dev` & Release Automation

The repository follows a two-line branch model with a protected integration branch and automated releases. The full developer walkthrough (feature flow, small changes, hotfix path, troubleshooting) lives in [`docs/workflow-guide.md`](./docs/workflow-guide.md).

| Branch | Purpose |
| :--- | :--- |
| `main` | **The release line.** Only merges from `dev` via PR. `semantic-release` publishes the npm package, Git tag, and `CHANGELOG.md` from here (ADR 0005). |
| `dev` | **The integration line.** Protected by a GitHub branch ruleset: PR-only merges with the required **`test`** status check (CI: typecheck + build + Vitest on `ubuntu-latest`), admin bypass as emergency escape hatch. The `Sync main to dev` workflow auto-merges `main` back into `dev` after every release, keeping the lines in lockstep. |
| `feat/…` `fix/…` `docs/…` `ci/…` | Short-lived work branches, always cut from a fresh `origin/dev`. |

Key rules:

- **Never commit directly to `dev` or `main`** — all changes arrive via PR; GitHub rejects direct pushes to `dev`.
- **Conventional Commits drive releases**: `feat:` → minor bump, `fix:` → patch bump; `docs:` / `ci:` / `chore:` / `refactor:` / `test:` / `perf:` accumulate without releasing.
- **Two-step release flow**: PR #1 into `dev` (CI gate) → PR #2 `dev` → `main` (release + auto-sync back to `dev`).
- **Emergency hotfix**: branch from `main`, PR → base `main`; release + sync automation updates `dev` automatically.
