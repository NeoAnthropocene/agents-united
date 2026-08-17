![Agents United](.assets/image/agents-united-hero-banner.jpg)

# Agents United

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/package/@neoanthropocene/agents-united)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests: Vitest](https://img.shields.io/badge/tests-128%2B%20passing-brightgreen.svg)](https://vitest.dev/)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)

### The universal package manager for AI agents.

Curated teams of orchestrators, sub-agents, skills, and workflows — installed once, projected across **Google Antigravity 2.0 / Gemini**, **Anthropic Claude Code**, **Cursor**, **Cline**, **OpenCode**, and **Codex / AGENTS.md**.

---

## 🌟 Key Features

- **🪶 Small Footprint by Default, On-Demand Growth**: Every department installs as a lean **Essentials bundle** by default. When a task exceeds the installed capability, the Lead Orchestrator automatically detects the gap, names the addon bundle that covers it, and — in CLI-enabled environments — installs it directly into the scope of the active main domain (e.g. `agents add seo-content-marketing`) without any manual discovery needed.
- **Department Domain Hierarchy**: Discover and install curated teams organized into 8 functional departments (Software Engineering, System Architecture, Product Design, Growth & Marketing, Security, Research, Business Strategy, and Universal Suite).
- **18 Curated Bundles**: 8 Essentials foundational base bundles + 10 specialized sub-team addons (including AI/ML Engineering, Mobile, DevOps, SRE, SEO, Paid PPC, PLG, and Lifecycle Email).
- **Cross-Bundle Dynamic Recommendation Protocol**: All 7 Lead Orchestrators possess real-time knowledge of specialized sub-domain bundles and recommend precise `agents add <bundle>` or `agents add domain:<dept>` commands when complex domain tasks are requested.
- **Modern Cloud Platform & AI Ecosystem**: First-class runbooks for Modal.com, Replicate, RunPod, Ollama, vLLM, LangChain, LlamaIndex, Qdrant, Vercel, Lovable/v0, Supabase, Turso, and Azure Bicep.
- **Scoped AI Safety Policies**: Built-in zero secret exposure, GPU cost ceilings (scale-to-zero timeouts), and training data PII scrubbing.
- **Two-Stage Progressive TUI**: Interactive `@clack/prompts` drill-down menu for effortless browsing without command-line parameter memorization.
- **Folder Tree Visualizations**: Human-friendly terminal catalog view (`agents list`) displaying orchestrators, sub-agents, skills, workflows, and bundle inheritance.
- **Multi-Host Target Adapters**: Simultaneously equip `.agents/`, `.gemini/`, `.claude/`, and `.cursor/` runtimes with automatic workspace detection.
- **Flexible Scopes & Installation Modes**: Support for **Project Scope** (Git-tracked team lockfiles) and **Global Scope** (`~/.agents/`), with zero-duplication **Symlink Mode** or isolated **Copy Mode**.
- **Whole-Department Installation**: One-click installation of entire department suites (`domain:engineering`, `domain:marketing`, `domain:architecture`) with interactive safety confirmation prompts.
- **Fast Search & Discovery**: Powerful query engine (`agents find`) with category/type filters and interactive one-click installation.
- **Strict Git Guardrails & Zero-Trust Safety**: Built-in protection against commits to protected branches (`main`/`master`), accidental force pushes, and secret exposure.
- **Deterministic Health Doctor**: Automatic validation of frontmatter schema compliance, lifecycle hooks, and lockfile synchronization (`agents doctor`).

---

## 🚀 Quickstart

### Run with `npx` (Zero Installation)
```bash
npx @neoanthropocene/agents-united add
```

### Global Installation
```bash
npm install -g @neoanthropocene/agents-united
```

Once installed, use the `agents` CLI command anywhere:
```bash
# Launch interactive onboarding wizard
agents add

# List all bundles in a visual folder tree
agents list

# Search for specific skills or workflows
agents find playwright -i

# Validate agent environment health
agents doctor
```

---

## 🪶 Essentials-First Philosophy — Small Footprint, On-Demand Growth

Agents United is designed so that every project starts **lean**. When you install a department, you get the **Essentials bundle** only — the minimum viable team needed to handle the majority of everyday tasks within that domain:

```bash
# Install only the core Growth & Marketing essentials team
agents add growth-marketing
# Installs: orchestrator-marketing + 5 core agents + 6 workflows + foundational skills
# Does NOT install: SEO specialists, PPC analysts, PLG strategists, email sequencers
```

When a task exceeds the installed capability, the **Lead Orchestrator takes over**. It recognizes the gap, names the exact addon bundle that covers it, and provides the install command — or in CLI-enabled environments, installs it automatically **into the scope of the active main domain**:

```
User: "Run a programmatic SEO audit and set up a content pipeline."

orchestrator-marketing: "This task requires the SEO & Content Marketing team.
  Your current installation (growth-marketing) covers strategy and campaigns.
  Installing the required addon now:

  $ agents add seo-content-marketing

  This adds: subagent-seo-specialist, programmatic-seo skill, technical-seo-audit skill,
  schema-markup-strategy skill, and the content pipeline workflow.
  Proceeding with installation into project scope..."
```

This model gives you:
- ✅ **Minimal context footprint** — only agents and skills relevant to your project live in the workspace
- ✅ **Intelligent gap detection** — orchestrators know exactly which addon covers which capability
- ✅ **Zero manual discovery** — the orchestrator installs the right addon for you
- ✅ **Scoped installs** — addons install into the same project scope as the parent essentials bundle

---


Agents United provides **22 curated bundles**, **45 specialized agents** (7 Lead Orchestrators + 38 Sub-Agents), **90 skills**, and **63 workflows** across 8 department domains:

| Department Domain | Bundles | Description | Orchestrator & Key Roles |
|---|---|---|---|
| **🌐 Universal Autonomous Department** | `universal-skills` ⭐ *(Recommended Baseline)*<br>`full` (Universal Suite) | Domain-agnostic meta-skills (Socratic grilling, PRD generation, ADRs, session handoff) and complete enterprise suite containing all 22 bundles and 45 agents. | All 7 Lead Orchestrators + 38 Sub-Agents |
| **🛠️ Software Engineering & Delivery** | `software-engineering` (Essentials Base)<br>`ai-ml-engineering`<br>`mobile-development`<br>`frontend-engineering`<br>`backend-distributed-systems`<br>`qa-automation`<br>`devops-engineering` | Full lifecycle software engineering, AI/ML platform engineering & serverless GPU orchestration, mobile (iOS/Android/Cross-Platform), modern web frontend, microservices, Playwright E2E automation, and CI/CD delivery pipelines. | `orchestrator-engineering`<br>`subagent-backend-architect`<br>`subagent-frontend-architect`<br>`subagent-code-reviewer`<br>`subagent-repo-index`<br>`subagent-ml-platform-engineer`<br>`subagent-ai-model-architect`<br>`subagent-ios-architect`<br>`subagent-android-architect`<br>`subagent-cross-platform-specialist`<br>`subagent-accessibility-lead`<br>`subagent-distributed-systems-architect`<br>`subagent-data-engineer`<br>`subagent-qa-automation-lead`<br>`subagent-e2e-tester`<br>`subagent-devops-engineer` |
| **🏛️ System Architecture & SRE** | `system-architecture` (Essentials Base)<br>`sysops-sre` | High-level system design, distributed data models, ADR governance, 99.999% uptime, Prometheus telemetry, incident triage, and disaster recovery. | `orchestrator-system-architecture`<br>`subagent-system-architect`<br>`subagent-backend-architect`<br>`subagent-sysops-sre-lead` |
| **🎨 Product Design & UI/UX** | `product-design` (Essentials Base)<br>`design-systems-ops`<br>`design-research-testing` | User research, wireframing, design systems governance, token management, sprint handoffs, micro-interactions, and AI prototype refactoring. | `orchestrator-design`<br>`subagent-ui-designer`<br>`subagent-ux-strategist`<br>`subagent-interaction-designer`<br>`subagent-design-systems-architect`<br>`subagent-design-ops-lead`<br>`subagent-design-researcher`<br>`subagent-designer-toolkit-expert`<br>`subagent-prototype-tester` |
| **📈 Growth & Marketing Operations** | `growth-marketing` (Essentials Base)<br>`seo-content-marketing`<br>`performance-paid-acquisition`<br>`product-led-growth`<br>`lifecycle-email-marketing` | Growth strategy, visual creative design, programmatic SEO, multi-channel paid acquisition (Google/Meta/LinkedIn), onboarding funnel CRO, viral loops, and behavioral email nurture sequences. | `orchestrator-marketing`<br>`subagent-marketing-growth-strategist`<br>`subagent-marketing-content-strategist`<br>`subagent-marketing-conversion-specialist`<br>`subagent-marketing-campaign-specialist`<br>`subagent-marketing-creative-designer`<br>`subagent-seo-specialist`<br>`subagent-paid-acquisition-specialist`<br>`subagent-plg-strategist`<br>`subagent-lifecycle-email-specialist` |
| **🔒 Security Operations** | `security-operations` (Essentials Base) | Application security audits, STRIDE threat modeling, dependency vulnerability scanning, secret redaction, and infrastructure hardening. | `orchestrator-security`<br>`subagent-security-engineer` |
| **🔬 Deep Technical Research** | `deep-research` (Essentials Base) | Technical literature review, deep research synthesis, Socratic mentoring, and repository indexing. | `orchestrator-research`<br>`subagent-deep-research`<br>`subagent-socratic-mentor`<br>`subagent-repo-index` |
| **💼 Business Strategy & Economics** | `business-strategy` (Essentials Base) | Market sizing, unit economics, SaaS monetization models, and executive technical specification panels. | `orchestrator-business`<br>`subagent-business-panel-experts` |
| **🏢 Organization Bundles (Tier 2 / Experimental)** | `digital-agency` 🚧 *(Under Construction)* | Cross-functional digital product agency combining web dev, mobile, UI/UX, SEO, and paid growth. Requires MCP servers (`firecrawl`, `github`) and packages. Supports Dual Execution Modes (Operational vs Brainstorming). | `orchestrator-engineering`<br>`subagent-backend-architect`<br>`subagent-frontend-architect`<br>`subagent-ui-designer`<br>`subagent-marketing-growth-strategist`<br>`subagent-seo-specialist` |

---

## ⚡ Platform & Cloud Tooling Ecosystem

Agents United comes pre-configured with operational playbooks for modern cloud, AI, and edge infrastructure:

- **Modal.com** (`modal-serverless-python`): Serverless Python apps, GPU functions (A10G/H100), cold-start layer caching, persistent volumes.
- **Replicate** (`replicate-model-inference`): Hosted model inference, prediction polling/webhooks, hardware provisioning.
- **RunPod** (`runpod-gpu-orchestration`): Cloud & serverless GPU orchestration, vLLM worker containers, network storage.
- **Local LLMs & vLLM** (`local-llm-inference`): Self-hosted LLM serving with Ollama & vLLM, PagedAttention, quantization (AWQ/GPTQ/GGUF).
- **RAG & Vector Pipelines** (`rag-vector-pipeline`, `vector-database-design`): Production RAG with LangChain & LlamaIndex, hybrid search (BM25 + dense), rerankers, Qdrant / Pinecone / Chroma indexing.
- **Hugging Face** (`hf-model-evaluation`): Standardized model evaluation benchmarks (MMLU, GSM8k, RAGAS faithfulness).
- **Vercel** (`vercel-deploy-best-practices`): Edge Middleware (<25ms), Server Actions, ISR revalidation, preview deployments.
- **Lovable / v0 / Bolt** (`ai-prototype-refactoring`): Refactoring single-file AI prototype exports into modular React component hierarchies, design tokens, and a11y standards.
- **Supabase** (`supabase-backend-architecture`): PostgreSQL schemas, Row Level Security (RLS) policies, Deno Edge Functions, Auth triggers, Realtime channels.
- **Turso** (`turso-distributed-sqlite`): LibSQL distributed SQLite, local embedded replicas with auto-sync, CI/CD database branching (`turso db branch`).
- **Microsoft Azure** (`azure-infrastructure-bicep`): Enterprise Bicep IaC, Azure Container Apps (ACA) with Dapr & KEDA scaling, AKS, Azure OpenAI private endpoints.

---

## 💻 CLI Command Reference

### `agents add [bundle|item]`
Installs a bundle, agent, skill, workflow, or whole department. If run without arguments in a terminal, launches the interactive 2-stage wizard.

```bash
# Interactive mode (Guides through Host -> Scope -> Method -> Department -> Bundle)
agents add

# Install by bundle name or alias
agents add software-engineering
agents add mobile-development
agents add ai-ml-engineering

# Install organization bundle in Brainstorming mode (ideation only, skips live MCP checks)
agents add digital-agency --mode brainstorming

# Install whole department domain
agents add domain:engineering
agents add domain:marketing
agents add domain:architecture

# Install globally to user home directory (~/.agents/)
agents add frontend-engineering -g

# Install as standalone independent copy (offline modifications)
agents add qa-automation --copy

# Install directly to specific agent hosts
agents add full -t gemini,claude,cursor -y
```

**Options:**
- `-g, --global`: Install globally into home directory (`~/.agents/`).
- `-s, --symlink`: Create symbolic links to central registry cache (default / recommended).
- `--copy`: Create independent standalone copies of asset files.
- `-t, --target <hosts>`: Target agent host runtimes (`agents`, `gemini`, `claude`, `cursor`, `cline`, `opencode`, `codex`). Default: `agents`.
- `--fanout <hosts>`: Also project translated copies into other assistant folders.
- `--mode <operational|brainstorming>`: Execution mode for organization bundles. Default: `operational`.
- `--allow-missing-prereqs`: Proceed with installation even if some prerequisites are missing.
- `--allow-under-construction`: Bypass the Under-Construction Gate for in-development bundles.
- `-y, --yes`: Skip confirmation prompts.
- `-f, --force`: Force overwrite user-modified files.
- `--dry-run`: Simulate installation without writing files.

---

### `agents list` (alias: `agents ls`)
Displays all registry bundles grouped by department domain in an ASCII/Unicode folder tree view showing orchestrators, sub-agents, skills, and workflows.

```bash
# Formatted folder tree view
agents list

# Output raw JSON manifest
agents list --json
```

---

### `agents find [query]` (alias: `agents search`)
Searches the registry across bundles, agents, skills, and workflows.

```bash
# Search by keyword
agents find modal
agents find seo
agents find playwright
agents find bicep

# Filter by domain category
agents find -c engineering
agents find -c marketing

# Filter by item type (bundle, agent, skill, workflow)
agents find gpu -t skill

# Interactive selection to install match
agents find qdrant -i

# Output search results as JSON
agents find security --json
```

---

### `agents remove [identifier]` (alias: `agents rm`, `agents uninstall`)
Discovers installed packages across project and global scopes with **Scope Location Badges** (`[project: ./.agents]`, `[global: ~/.agents]`), presenting only active installed bundles and standalone assets for safe uninstallation.

```bash
# Interactive installed package selection with scope badges
agents remove

# Remove specific bundle from project workspace
agents remove mobile-development

# Remove global bundle
agents remove mobile-development -g -y
```

---

### `agents start <bundle> [prompt]`
Starts an installed team bundle in its host runtime (such as Cline CLI). Automatically resolves project vs. global installations, verifies compound projection integrity, probes host runtime capabilities, constructs safe non-shell evaluated arguments, and launches the session.

```bash
# Start an installed team in Cline
agents start software-engineering

# Start a team with an initial task prompt
agents start software-engineering "Implement user authentication with Vitest TDD test coverage"

# Start with pre-authorized addon auto-installation for this session
agents start software-engineering --allow-addons

# Override generated team name
agents start software-engineering --team my-custom-squad

# Run headlessly (non-interactive mode)
agents start software-engineering "Run security audit" --headless

# Preview activation plan, strategy, and argv without launching
agents start software-engineering --dry-run
```

**Options:**
- `--host <host>`: Host runtime to activate (auto-detected from lockfile fanout, e.g. `cline`).
- `-g, --global`: Activate globally installed bundle (`~/.agents/`).
- `--team <name>`: Override generated team name (must match `[A-Za-z0-9_-]` max 64 chars).
- `--allow-addons`: Pre-authorize recommended addon installations for this session without prompting.
- `--headless`: Run non-interactively without launching interactive TUI.
- `--dry-run`: Print activation resolution and argv summary without launching.

---

### `agents update [identifier]` (alias: `agents upgrade`)
Inspects installed packages across project and global scopes, detects **Upstream Version Drift** against registry releases, and provides an interactive TUI to batch update all packages or selectively pick specific bundles with user-modification conflict guardrails.

```bash
# Interactive update TUI (shows outdated packages, version diffs, and selective/batch updates)
agents update

# Batch update all installed packages in workspace
agents update --all -y

# Update specific package and re-sync projections across runtimes
agents update software-engineering --fanout cline,claude

# Update and immediately start in Cline
agents update software-engineering --fanout cline --start

# Update specific package with force overwrite of local modifications
agents update software-engineering --force

# Simulate update without modifying files
agents update --dry-run
```

---

### `agents doctor`
Audits workspace agent directories, verifies frontmatter schema validity, validates declarative lifecycle hooks, and reports synchronization status. Can also audit specific host runtimes and capability probing.

```bash
# General workspace health audit
agents doctor

# Audit Cline runtime installation, capability probe, and compound projection integrity
agents doctor --host cline
```
```

---
## 🌐 One Library, Every Assistant

The `.agents/` folder is the **main library** — the *one* folder you edit. **Antigravity reads it directly**; every other assistant (Claude Code, Cursor, Cline, OpenCode, Codex) can't read it natively, so Agents United writes **translated copies** it keeps in sync for you.

- **Edit only `.agents/`.** That's your source of truth — the `agents-united.json` lockfile tracks it.
- **Other assistants get their own translated copies**, in their own folders (`.claude/agents/`, `.cline/agents/`, …). Don't edit those — they're machine-managed and rewritten on every `agents update`.
- **`--fanout` tells Agents United which assistants to make copies for.** It's remembered in the lockfile, so a plain `agents update` keeps them in sync afterwards.

```bash
# Main library + translated copies for Claude, Cursor, Cline, OpenCode, and Codex
agents add software-engineering -t agents --fanout claude,cursor,cline,opencode,codex -y --copy

# Prefer picking an assistant directly? The main library is added and translated copies are made for you.
agents add software-engineering -t cline -y --copy

# Dry-run first to preview exactly what will be written
agents add software-engineering -t agents --fanout claude,cursor -y --copy --dry-run

# You already installed to .agents/ only? Add Cline's translated copies now:
agents update software-engineering --fanout cline
```

```bash
# Canonical .agents/ tree + translated copies for Claude, Cursor, Cline, OpenCode, and Codex
agents add software-engineering -t agents --fanout claude,cursor,cline,opencode,codex -y --copy

# Dry-run first to preview exactly which projections will be written
agents add software-engineering -t agents --fanout claude,cursor -y --copy --dry-run
```

| Flag | Meaning |
| :--- | :--- |
| `--fanout <hosts>` | Comma-separated runtime ids to project into (`claude`, `cursor`, `cline`, `opencode`, `codex`). Invalid ids are dropped with a warning. |

What each runtime receives:
- **Claude Code** → `.claude/agents/`
- **Cursor** → `.cursor/agents/`
- **Cline** → `.cline/agents/`
- **OpenCode** → `.opencode/agent/`
- **Codex & AGENTS.md readers** → a generated root **`AGENTS.md`** bridge indexing the canonical `.agents/` tree (no subagent loader exists for these).

Every projected file is a **copy** (never a symlink) stamped with a managed marker:
```html
<!-- managed-by: agents-united | profile: claude-code | canonical: .agents/agents/<file> | do not edit -->
```
All projections are recorded in `agents-united.json` under `projectedTo`, so `remove`, `update`, and `doctor` stay deterministic — they rewrite or delete exactly the managed files and never touch unmanaged/user-modified ones (unless `--force`).

> ⚠️ **Per-runtime caveats.** Antigravity-only frontmatter keys — `hooks:`, `permissionMode:`, `commandExecutionPolicy:`, `mainAgent:`, `subagent:`, and `type:` — **do not execute** in other runtimes. Projected orchestrator agents degrade gracefully to "system prompt + tool list" subagents; behavior is documented, not faked. Cross-agent `invoke_subagent` orchestration works only in Antigravity and is dropped elsewhere with a warning. To add more runtimes later, re-run `agents add <bundle> -t agents --fanout <hosts>`.

---

## 🛡️ Built-in Safety & Git Guardrails

Agents United keeps your codebases safe by enforcing hard-coded version control and operational safety policies across all installed orchestrators and sub-agents:

- **Protected Branch Guard**: Prevents autonomous agents from directly committing to `main`, `master`, `production`, or `release/*` branches.
- **Zero Force-Pushes**: Hard-coded safety policies disallow destructive force pushes (`git push --force` or `git push -f`) under all circumstances.
- **Pre-Staging Secret Scanning & Redaction**: Intercepts accidental staging of `.env` files, API keys (`OPENAI_API_KEY`, `MODAL_TOKEN_ID`, `REPLICATE_API_TOKEN`, `RUNPOD_API_KEY`), private tokens, or credentials before any commit is generated.
- **GPU Cost Ceilings**: Enforces automatic scale-to-zero timeouts (60–300s) and concurrency limits on serverless compute workloads.
- **Training Data PII Scrubbing**: Pre-processing guardrails to mask sensitive personal data before vector embedding or fine-tuning.
- **Deterministic Health Doctor**: Run `agents doctor` anytime to audit local agent directories, verify schema validity, and ensure clean working tree states.

---

## 🛠️ Developer Setup & Contributing Guide

We welcome open-source contributions from developers across the agentic engineering community!

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher (`node -v`)
- **Package Manager**: `npm` (v10+) or `pnpm`
- **Git**: Configured with a clean working tree

### 2. Local Environment Setup
```bash
# 1. Clone the repository
git clone https://github.com/NeoAnthropocene/agents-united.git
cd agents-united

# 2. Install development dependencies
npm install

# 3. Build the project with tsup
npm run build

# 4. Link binary globally for local development testing
npm link
```

### 3. Running Tests
Agents United enforces a strict **4-Tier Test-Driven Development (TDD)** standard with **100% deterministic testing** (no arbitrary sleeps).

```bash
# Run full Vitest test suite
npm test

# Run tests in watch mode
npm run test:watch
```

### 4. Code Quality & Architecture Guidelines
- **Strict TypeScript**: Never use implicit or explicit `any`. All shared interfaces belong in `src/core/types.ts`.
- **Seams & Decoupling**: Keep business logic (`src/core/`) decoupled from terminal I/O (`src/cli.ts`).
- **Idempotency**: All installer and uninstaller operations must be reversible and tracked in `agents-united.json`.
- **[ ] Essentials Bundle Audit & CLI Guard** *(Development Task)*: Audit all 7 Essentials bundle compositions to verify they contain only core agents/skills. Migrate any non-essential assets into their matching Addon bundle. Add a CLI enforcement layer so that `agents add domain:<dept>` installs only the Essentials bundle by default — Addon bundles must be explicitly requested (`agents add <addon>`) or triggered by the orchestrator's On-Demand Auto-Install protocol. Track progress in [`ROADMAP.md`](ROADMAP.md).
- **[ ] GitHub Pages Site Design** *(Design Task)*: Design and build the public marketing & documentation site at `https://neoanthropocene.github.io/agents-united`. Covers: hero section, interactive CLI demo, ecosystem matrix visualization, quickstart steps, and platform ecosystem showcase. Full brief and wireframe outline tracked in [`ROADMAP.md`](ROADMAP.md).

### 5. Skill & Agent Contribution Standard
When contributing new skills or adapting external skills:
1. **Frontmatter Metadata**: Declare author attribution in `SKILL.md` YAML frontmatter:
   ```yaml
   ---
   name: your-skill-name
   description: High-level summary of capability
   metadata:
     author: "Your Name (@yourhandle)"
     version: "1.0.0"
     source: "https://github.com/your-org/your-repo"
     license: "MIT"
   ---
   ```
2. **Attribution in README**: Add credit under `## Credits & Acknowledgments`.
3. **Deterministic Verifications**: Include clear validation commands, error recovery procedures, and code exemplars.

### 6. Pull Request (PR) Workflow
1. **Create a Feature Branch**: Always branch from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feat/your-feature-name
   ```
2. **Follow TDD (Red-Green-Refactor)**: Author failing unit/E2E tests in `tests/` before implementing code.
3. **Run Pre-PR Verification**:
   ```bash
   npm run build
   npm test
   git diff --cached   # Audit staged files for accidental secrets or temp files
   ```
4. **Submit Pull Request**: Open a PR targeting the `dev` branch with a concise description of changes and test results.

---

## 🤝 Credits & Acknowledgments

Agents United proudly builds upon, adapts, and integrates contributions from creators across the open AI agent, cloud platform, and developer tooling ecosystem:

- **Matt Pocock** ([@mattpocock](https://github.com/mattpocock) / [mattpocock/skills](https://github.com/mattpocock/skills)):
  - **`/grill-with-docs`** & **`/grill-me`**: Socratic alignment grilling, requirements clarification, and ADR authoring.
  - **`/domain-modeling`**: Ubiquitous language definition and `CONTEXT.md` domain dictionary maintenance.
  - **`/to-spec`** & **`/to-tickets`**: PRD/spec generation and task ticket decomposition.
  - **`/diagnosing-bugs`**: Evidence-driven bug diagnosis and root-cause analysis.
  - **`/git-guardrails`**: Version control safety rules and protection policies.
  - **`/handoff`**: Session progress persistence and context handoff notes.
- **Modal Labs** ([@modal-labs](https://github.com/modal-labs) / [modal.com](https://modal.com)):
  - **`modal-serverless-python`**: Serverless Python execution, container image definition, and GPU acceleration patterns.
- **Replicate** ([@replicate](https://github.com/replicate) / [replicate.com](https://replicate.com)):
  - **`replicate-model-inference`**: Hosted machine learning model inference API, webhook callbacks, and prediction streaming.
- **RunPod** ([@runpod](https://github.com/runpod) / [runpod.io](https://runpod.io)):
  - **`runpod-gpu-orchestration`**: Serverless GPU handler architecture and containerized worker management.
- **Ollama & vLLM Teams** ([ollama.com](https://ollama.com) / [vllm.ai](https://vllm.ai)):
  - **`local-llm-inference`**: Self-hosted LLM execution, quantization formats, and high-throughput PagedAttention serving.
- **LangChain & LlamaIndex** ([langchain.com](https://langchain.com) / [llamaindex.ai](https://llamaindex.ai)):
  - **`rag-vector-pipeline`**: Retrieval-Augmented Generation architectures, hybrid retrieval, and re-ranking pipelines.
- **Hugging Face** ([@huggingface](https://github.com/huggingface) / [huggingface.co](https://huggingface.co)):
  - **`hf-model-evaluation`**: Model benchmarking, Evaluate metrics, and model scorecard methodologies.
- **Qdrant, Pinecone & Chroma** ([qdrant.tech](https://qdrant.tech) / [pinecone.io](https://pinecone.io) / [trychroma.com](https://www.trychroma.com)):
  - **`vector-database-design`**: Production vector indexing, HNSW graph tuning, and payload filtering.
- **Vercel Engineering** ([@vercel](https://github.com/vercel) / [vercel.com](https://vercel.com)):
  - **`vercel-deploy-best-practices`**: Edge Middleware routing, Server Actions, and Preview environments.
  - **`react-best-practices`**: Next.js App Router, Server Components & Core Web Vitals optimization.
- **Lovable, v0 (Vercel) & Bolt (StackBlitz)** ([lovable.dev](https://lovable.dev) / [v0.dev](https://v0.dev) / [bolt.new](https://bolt.new)):
  - **`ai-prototype-refactoring`**: Ingestion and modularization methodologies for rapid AI-generated frontend prototypes.
- **Supabase** ([@supabase](https://github.com/supabase) / [supabase.com](https://supabase.com)):
  - **`supabase-backend-architecture`**: PostgreSQL database design, Row Level Security (RLS), Edge Functions, and Realtime sync.
- **ChiselStrike & Turso Community** ([@tursodatabase](https://github.com/tursodatabase) / [turso.tech](https://turso.tech)):
  - **`turso-distributed-sqlite`**: LibSQL distributed SQLite, embedded replicas with auto-sync, and database branching.
- **Microsoft Azure Community** ([learn.microsoft.com/azure/bicep](https://learn.microsoft.com/azure/azure-resource-manager/bicep)):
  - **`azure-infrastructure-bicep`**: Enterprise Bicep Infrastructure-as-Code, Azure Container Apps (ACA), and Azure OpenAI private networking.
- **Currents & Microsoft Playwright Community** ([currents-dev/playwright-best-practices-skill](https://github.com/currents-dev/playwright-best-practices-skill)):
  - **`playwright-best-practices`**: Resilient Page Object Models and deterministic auto-waiting browser tests.
- **wshobson** ([wshobson/agents](https://github.com/wshobson/agents)):
  - **`mobile-ios-design`** & **`mobile-android-design`**: SwiftUI & Jetpack Compose design system patterns.
- **Salesforce** ([forcedotcom/sf-skills](https://github.com/forcedotcom/sf-skills)):
  - **`mobile-platform-offline-validate`**: Offline-first local database caching and conflict resolution.
- **tovimx** ([tovimx/maestro-mobile-testing-skill](https://github.com/tovimx/maestro-mobile-testing-skill)):
  - **`maestro-mobile-testing`**: Declarative cross-platform mobile UI test automation.

---

## 📄 License

MIT © [NeoAnthropocene & Agents United Contributors](LICENSE)
