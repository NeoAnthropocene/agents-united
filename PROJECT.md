# Agents United — Master Project Guideline & Architecture Blueprint

The universal package manager for AI agents. Curated teams of orchestrators, sub-agents, skills, and workflows — installed once, projected across **Google Antigravity 2.0 / Gemini**, **Anthropic Claude Code**, **Cursor**, **Cline**, **OpenCode**, and **Codex / AGENTS.md**.

---

## 📑 Table of Contents
1. [Executive Overview & Core Philosophy](#1-executive-overview--core-philosophy)
2. [Complete Granular Feature Inventory](#2-complete-granular-feature-inventory)
3. [Master Implementation Plans Index (plans/001–008)](#3-master-implementation-plans-index-plans001008)
4. [Architectural Decision Records (ADRs 0001–0009)](#4-architectural-decision-records-adrs-00010009)
5. [Ecosystem Architecture & Department Domains](#5-ecosystem-architecture--department-domains)
6. [Host Projection & Runtime Activation Engine](#6-host-projection--runtime-activation-engine)
7. [Interface Contracts & Specifications](#7-interface-contracts--specifications)
8. [CLI Commands & Lifecycle Guide](#8-cli-commands--lifecycle-guide)
9. [Codebase Layout & Component Map](#9-codebase-layout--component-map)
10. [Verification Matrix & Project Health](#10-verification-matrix--project-health)

---

## 1. Executive Overview & Core Philosophy

### 1.1 The "One Library, Every Assistant" Architecture
AI assistants read different folder structures and frontmatter dialects:
- **Google Antigravity**: Reads `./.agents/` natively in interactive sessions (CLI TUI panel + Antigravity 2.0 desktop). Headless CLI mode (`-p` / `agy agents`) on agy 1.1.15 reads only the user-global store — see [ADR 0009](./docs/adr/0009-host-conformance-targets.md).
- **Anthropic Claude Code**: Reads `./.claude/agents/` with `tools: [...]` frontmatter.
- **Cursor**: Reads `./.cursor/agents/` and `.cursor/rules/*.mdc`.
- **Cline**: Reads `.cline/agents/`, `.cline/skills/`, `.cline/rules/`, and `.cline/agents-united/teams/`.
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
| 60 | Plan 009: Universal Department Priority | Positioned Universal Department first in TUI wizard and catalog list with `[Recommended]` badge | M8 | DONE | PLAN_009 |

---

## 3. Master Implementation Plans Index (`plans/001`–`009`)

All 9 foundational implementation plans have been fully realized, tested under strict Test-Driven Development (TDD), and verified in production:

| Plan | Title | Category | Status | Key Deliverables & Milestones |
| :--- | :--- | :--- | :--- | :--- |
| **[001](./plans/001-project-setup-and-ci-release.md)** | Project Scaffolding & CI Release | Tooling / CI | **DONE** | TypeScript ESM setup, `tsup` dual build (ESM + DTS), Vitest runner, ESLint/Prettier, GitHub Actions automated semantic-release pipeline. |
| **[002](./plans/002-antigravity-2-agent-skills-workflows-porting.md)** | Antigravity 2.0 Porting & Schema | Core Catalog | **DONE** | Canonical agent definitions, 7 Lead Orchestrators, 38 subagents, 90 skills, 63 workflows, YAML frontmatter schemas, scoped AI safety policies. |
| **[003](./plans/003-cli-core-engine-and-manifest-tracking.md)** | CLI Engine & Lockfile Manager | Core Engine | **DONE** | `RegistryResolver`, `InstallEngine`, `UninstallEngine`, deterministic lockfile tracking (`agents-united.json`), checksum verification, non-destructive removals. |
| **[004](./plans/004-tdd-unit-and-integration-suite.md)** | 4-Tier TDD Test Suite | Testing (TDD) | **DONE** | Tier 1 (Unit & schema checks), Tier 2 (Registry & installer logic), Tier 3 (E2E prompts & workflows), Tier 4 (Adversarial stress & CLI integration). |
| **[005](./plans/005-scope-and-installation-methods.md)** | Installation Scope & Methods | CLI / Scope | **DONE** | Project scope (`./.agents/`), Global scope (`~/.agents/`), Symlink mode (instant sync), Copy mode (standalone isolation), host target adapters. |
| **[006](./plans/006-sync-agent-structure-documentation.md)** | Ecosystem Docs & Attributions | Documentation | **DONE** | Complete ubiquitous domain vocabulary in `CONTEXT.md`, catalog tree visualizations, external platform attribution standards. |
| **[007](./plans/007-universal-multi-agent-host-projection.md)** | Universal Host Projection Engine | Core Engine | **DONE** | Host projection engine (`HostProjector`), `--fanout` flag, `projectedTo` refcounting, managed marker stamps, root `AGENTS.md` bridge. |
| **[008](./plans/008-cline-native-projection-and-team-activation.md)** | Cline Compound Projection & Team Activation | Runtime Integration | **DONE** | 4-part compound artifacts (`.cline/agents/`, `.cline/skills/`, `.cline/rules/`, `.cline/agents-united/teams/`), `lockfile.projections` refcounting, `ClineCapabilityProbe`, `ClineLauncher`, `agents start`, `--start`, `doctor --host cline`. |
| **[009](./plans/009-essentials-composition-audit.md)** | Essentials Bundle Composition Audit & Modularization | Architecture / Catalog | **DONE** | `universal-skills` extraction, `software-engineering` slimmed to 16 skills, `product-design` 2-addon decomposition, graduated to `stable`. |

---

## 4. Architectural Decision Records (ADRs 0001–0009)

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
| | **[0009](./docs/adr/0009-host-conformance-targets.md)** | Host Conformance Targets | Accepted | Per-host conformance probes pinned to tested CLI versions: Cline = conformant (headless CI), Antigravity = interactive-scoped confirmed on agy 1.1.15 (CLI TUI + desktop read `.agents/` natively; headless `-p` not a target). No projection shim required for Antigravity. |

---

## 5. Ecosystem Architecture & Department Domains

The ecosystem catalog maintains **45 specialized agents** (7 Lead Orchestrators + 38 Sub-Agents), **90 skills**, and **63 workflows** structured into **18 curated bundles** across **8 department domains**:

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
├── 🏛️  System Architecture & SRE (2 bundles)
│   ├── 📦 system-architecture (Essentials Base)
│   │   ├── 🤖 Lead: orchestrator-system-architecture
│   │   └── 🤖 Sub-agents: system-architect, backend-architect
│   └── 📦 sysops-sre [inherits: system-architecture]
│       └── 🤖 Sub-agents: sysops-sre-lead
├── 🎨  Product Design & UI/UX (1 bundle)
│   └── 📦 product-design (Essentials Base)
│       ├── 🤖 Lead: orchestrator-design
│       └── 🤖 Sub-agents: ui-designer, ux-strategist, interaction-designer, design-systems-architect, ...
├── 📈  Growth & Marketing Operations (5 bundles)
│   ├── 📦 growth-marketing (Essentials Base)
│   │   ├── 🤖 Lead: orchestrator-marketing
│   │   └── 🤖 Sub-agents: growth-strategist, creative-designer, content-strategist, ...
│   ├── 📦 seo-content-marketing [inherits: growth-marketing]
│   ├── 📦 performance-paid-acquisition [inherits: growth-marketing]
│   ├── 📦 product-led-growth [inherits: growth-marketing]
│   └── 📦 lifecycle-email-marketing [inherits: growth-marketing]
├── 🔒  Security Operations (1 bundle)
│   └── 📦 security-operations (Essentials Base)
│       ├── 🤖 Lead: orchestrator-security
│       └── 🤖 Sub-agents: security-engineer
├── 🔬  Deep Technical Research (1 bundle)
│   └── 📦 deep-research (Essentials Base)
│       ├── 🤖 Lead: orchestrator-research
│       └── 🤖 Sub-agents: deep-research, socratic-mentor, repo-index
├── 💼  Business Strategy & Economics (1 bundle)
│   └── 📦 business-strategy (Essentials Base)
│       ├── 🤖 Lead: orchestrator-business
│       └── 🤖 Sub-agents: business-panel-experts
├── 🏢  Organization Bundles (Experimental / Cross-Functional) (1 bundle)
│   └── 📦 digital-agency 🚧 [Under Construction (TBA)] [Prerequisites Required]
│       ├── 🤖 Lead: orchestrator-digital-agency-director
│       ├── 🤖 Sub-agents: strategy-planner, lead-intelligence, creative-copywriter, design-uiux, dev-frontend, growth-marketer, privacy-engineer, adtech-compliance, qa-compliance
│       ├── 🔌 Prerequisites: firecrawl (MCP), github (MCP), @playwright/test (Pkg), FIRECRAWL_API_KEY (Env)
│       └── 💡 Execution Modes: Operational / Brainstorming
└── 🌐  Universal Autonomous Department (1 bundle)
    └── 📦 full (Universal Suite — all 45 agents, 90 skills, 63 workflows)
```

---

## 6. Host Projection & Runtime Activation Engine

### 6.1 Projection Pipeline
When a user runs `agents add <bundle> --fanout claude,cursor,cline,opencode,codex` or `agents update --fanout ...`:
1. **Canonical Deployment**: Files are installed into `.agents/` (or global `~/.agents/`) via symlink or copy.
2. **Translation Matrix**:
   - `claude`: Translates frontmatter to Claude Code dialect (`tools`, `model`), strips Antigravity execution keys.
   - `cursor`: Generates Cursor agent definitions and `.cursor/rules/*.mdc`.
   - `cline`: Emits **Compound Projection** (Role definitions, skills, coordinator rule, and team manifest).
   - `opencode`: Translates to OpenCode agent dialect in `.opencode/agent/`.
   - `codex`: Generates root `AGENTS.md` bridge indexing all canonical capabilities.
3. **Managed Marker Stamping**: Every projected markdown file receives a top comment:
   `<!-- managed-by: agents-united | profile: <profile> | canonical: .agents/... | do not edit -->`
4. **Ownership Refcounting**: Recorded in `lockfile.projections[relPath].owners = [bundle1, bundle2]`. Removing `bundle1` preserves the file if `bundle2` still depends on it.

### 6.2 Safe Capability Probing & Runtime Activation
When running `agents start <bundle> [prompt]`:
1. **Capability Probing (`ClineCapabilityProbe`)**:
   - Resolves executable via `CLINE_BIN_PATH`, Windows Node wrapper (`<shim>/node_modules/cline/bin/cline`), or POSIX binary.
   - Executes read-only semantic versioning check (`version`).
   - Executes parser probe (`--team-name agents-united-capability-probe version`) under 5000ms timeout.
2. **Activation Strategy**:
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

### 7.3 Team Manifest Schema (`.cline/agents-united/teams/<bundle>.yaml`)
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
    path: .cline/skills/test-driven-development
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
├── .cline/                       # Local Cline Projections (compound artifacts)
├── registry/                     # Canonical Ecosystem Catalog
│   ├── agents/                   # 45 Antigravity 2.0 agent definitions
│   ├── skills/                   # 90 modular skill runbooks with SKILL.md
│   ├── workflows/                # 63 guided workflows with Mermaid flowcharts
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
│       ├── projector.ts          # HostProjector (dialects & AGENTS.md)
│       ├── cline-projector.ts    # ClineProjector (compound manifest & rules)
│       ├── cline-capabilities.ts # ClineCapabilityProbe (read-only probe)
│       └── cline-launcher.ts     # ClineLauncher (safe process launcher)
├── docs/adr/                     # Architectural Decision Records (ADRs 0001–0009)
├── plans/                        # Implementation Plan Specifications (001–009)
├── tests/                        # 4-Tier Vitest Test Suite (22 test suites, 211 tests)
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

 ✓ tests/cline-compatibility.test.ts (4 tests)
 ✓ tests/m3-worker1-validation.test.ts (12 tests)
 ✓ tests/registry.test.ts (11 tests)
 ✓ tests/m1-challenger-stress.test.ts (35 tests)
 ✓ tests/cline-projector.test.ts (7 tests)
 ✓ tests/projector.test.ts (16 tests)
 ✓ tests/e2e-agents-prompts.test.ts (10 tests)
 ✓ tests/e2e-workflows-gates.test.ts (9 tests)
 ✓ tests/hosts.test.ts (12 tests)
 ✓ tests/e2e-agents-schema.test.ts (11 tests)
 ✓ tests/adapter.test.ts (4 tests)
 ✓ tests/cline-capabilities.test.ts (4 tests)
 ✓ tests/e2e-skills-depth.test.ts (10 tests)
 ✓ tests/inventory.test.ts (5 tests)
 ✓ tests/cline-launcher.test.ts (8 tests)
 ✓ tests/doctor.test.ts (3 tests)
 ✓ tests/installer.test.ts (5 tests)
 ✓ tests/uninstaller.test.ts (3 tests)
 ✓ tests/updater.test.ts (5 tests)
 ✓ tests/fanout.test.ts (7 tests)
 ✓ tests/projection-lifecycle.test.ts (11 tests)
 ✓ tests/cli-e2e.test.ts (19 tests)

 Test Files  22 passed (22)
      Tests  211 passed (211)
```
