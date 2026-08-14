# Agents United

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/package/@neoanthropocene/agents-united)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests: Vitest](https://img.shields.io/badge/tests-67%20passing-brightgreen.svg)](https://vitest.dev/)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)

Universal package manager and registry CLI for open AI agents, skills, workflows, and rules across AI assistant ecosystems (**Google Antigravity 2.0 / Gemini**, **Anthropic Claude Code**, **Cursor / Codex**, and **Universal Multi-Agent Runtimes**).

---

## 🌟 Key Features

- **Department Domain Hierarchy**: Discover and install curated teams organized into 8 functional departments (Software Engineering, System Architecture, Product Design, Growth & Marketing, Security, Research, Business Strategy, and Universal Suite).
- **Two-Stage Progressive TUI**: Interactive `@clack/prompts` drill-down menu for effortless browsing without command-line parameter memorization.
- **Folder Tree Visualizations**: Human-friendly terminal catalog view (`agents list`) displaying orchestrators, sub-agents, skills, workflows, and bundle inheritance.
- **Multi-Host Target Adapters**: Simultaneously equip `.agents/`, `.gemini/`, `.claude/`, and `.cursor/` runtimes with automatic workspace detection.
- **Flexible Scopes & Installation Modes**: Support for **Project Scope** (Git-tracked team lockfiles) and **Global Scope** (`~/.agents/`), with zero-duplication **Symlink Mode** or isolated **Copy Mode**.
- **Whole-Department Installation**: One-click installation of entire department suites (`domain:engineering`, `domain:architecture`) with interactive safety confirmation prompts.
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

## 📦 Ecosystem Matrix & Department Domains

Agents United provides **13 curated bundles**, **38 specialized agents**, **65 skills**, and **54 workflows** across 8 department domains:

| Department Domain | Bundles | Description | Orchestrator & Key Roles |
|---|---|---|---|
| **🛠️ Software Engineering & Delivery** | `software-engineering` (Essentials)<br>`mobile-development`<br>`frontend-engineering`<br>`backend-distributed-systems`<br>`qa-automation`<br>`devops-engineering` | Full lifecycle software engineering, mobile (iOS/Android/Cross-Platform), modern web frontend, microservices, Playwright E2E automation, and CI/CD delivery pipelines. | `orchestrator-engineering`<br>`ios-architect`<br>`android-architect`<br>`frontend-architect`<br>`distributed-systems-architect`<br>`qa-automation-lead`<br>`devops-engineer` |
| **🏛️ System Architecture & SRE** | `system-architecture` (Essentials)<br>`sysops-sre` | High-level system design, distributed data models, ADR governance, 99.999% uptime, Prometheus telemetry, and incident triage. | `orchestrator-system-architecture`<br>`system-architect`<br>`sysops-sre-lead` |
| **🎨 Product Design & UI/UX** | `product-design` | User research, wireframing, design systems, design token management, and micro-interactions. | `orchestrator-design`<br>`ui-designer`<br>`ux-strategist`<br>`interaction-designer` |
| **📈 Growth & Marketing Operations** | `growth-marketing` | Growth strategy, content pipeline generation, conversion funnel optimization, and A/B test experiments. | `orchestrator-marketing`<br>`marketing-growth-strategist`<br>`marketing-content-strategist` |
| **🔒 Security Operations** | `security-operations` | Application security audits, STRIDE threat modeling, dependency vulnerability scanning, and hardening. | `orchestrator-security`<br>`security-engineer` |
| **🔬 Deep Technical Research** | `deep-research` | Technical literature review, deep research synthesis, Socratic mentoring, and repository indexing. | `orchestrator-research`<br>`deep-research`<br>`socratic-mentor` |
| **💼 Business Strategy & Economics** | `business-strategy` | Market sizing, unit economics, SaaS monetization models, and executive technical specification panels. | `orchestrator-business`<br>`business-panel-experts` |
| **🌐 Universal Autonomous Department** | `full` | Complete enterprise suite containing all 13 team bundles, 38 agents, 65 skills, and 54 workflows. | All 7 Lead Orchestrators + 31 Sub-Agents |

---

## 💻 CLI Command Reference

### `agents add [bundle|item]`
Installs a bundle, agent, skill, workflow, or whole department. If run without arguments in a terminal, launches the interactive 2-stage wizard.

```bash
# Interactive mode (Guides through Host -> Scope -> Method -> Department -> Bundle)
agents add

# Install by bundle name or alias
agents add software-engineering
agents add mobile
agents add devops

# Install an entire department domain
agents add domain:engineering
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
- `-t, --target <hosts>`: Target agent host runtimes (`agents`, `gemini`, `claude`, `cursor`). Default: `agents`.
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
agents find playwright
agents find mobile

# Filter by domain category
agents find -c engineering
agents find -c architecture

# Filter by item type (bundle, agent, skill, workflow)
agents find test -t skill

# Interactive selection to install match
agents find react -i

# Output search results as JSON
agents find security --json
```

---

### `agents remove <identifier>` (alias: `agents rm`)
Uninstalls managed assets safely while verifying `agents-united.json` lockfile integrity.

```bash
# Remove bundle from project workspace
agents remove mobile-development

# Remove global bundle
agents remove mobile-development -g -y
```

---

### `agents doctor`
Audits workspace agent directories, verifies frontmatter schema validity, validates declarative lifecycle hooks, and reports synchronization status.

```bash
agents doctor
```

---

## 🛡️ Built-in Safety & Git Guardrails

Agents United keeps your codebases safe by enforcing hard-coded version control policies across all installed orchestrators and sub-agents:

- **Protected Branch Guard**: Prevents autonomous agents from directly committing to `main`, `master`, `production`, or `release/*` branches.
- **Zero Force-Pushes**: Hard-coded safety policies disallow destructive force pushes (`git push --force` or `git push -f`) under all circumstances.
- **Pre-Staging Secret Scanning**: Intercepts accidental staging of `.env` files, API keys, private tokens, or credentials before any commit is generated.
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

Agents United proudly builds upon, adapts, and integrates contributions from creators across the open AI agent and developer tooling ecosystem:

- **Matt Pocock** ([@mattpocock](https://github.com/mattpocock) / [mattpocock/skills](https://github.com/mattpocock/skills)):
  - **`/grill-with-docs`** & **`/grill-me`**: Socratic alignment grilling, requirements clarification, and ADR authoring.
  - **`/domain-modeling`**: Ubiquitous language definition and `CONTEXT.md` domain dictionary maintenance.
  - **`/to-spec`** & **`/to-tickets`**: PRD/spec generation and task ticket decomposition.
  - **`/diagnosing-bugs`**: Evidence-driven bug diagnosis and root-cause analysis.
  - **`/git-guardrails`**: Version control safety rules and protection policies.
  - **`/handoff`**: Session progress persistence and context handoff notes.
- **Vercel Engineering** ([@vercel](https://github.com/vercel) / [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)):
  - **`react-best-practices`**: Next.js App Router, Server Components & Core Web Vitals optimization.
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
