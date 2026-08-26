# Agents United — Roadmap

> Living document tracking planned improvements, design tasks, and architectural decisions.
> See also: `CONTEXT.md` (domain vocabulary) and `README.md` (contributor guidelines).

---

## Status Legend

| Symbol | Meaning |
|---|---|
| `🔲` | Planned — not started |
| `🔄` | In Progress |
| `✅` | Complete |
| `❄️` | On Hold |

---

## Milestone 1 — Essentials Bundle Audit & CLI Guard

**Status**: `🔄 In Progress` (Part A Completed)
**Priority**: High
**Effort**: Medium (M)
**Domain**: Core Architecture + CLI

### Problem Statement

The **Essentials-First Install Model** is a first-class architectural principle (see `CONTEXT.md`). Two gaps exist:

1. **Bundle composition drift**: Resolved in Plan 009 (`software-engineering` slimmed to 16 core skills, `product-design` decomposed into Essentials + 2 Addons, `universal-skills` extracted as recommended baseline).
2. **CLI enforcement**: `agents add domain:<dept>` resolves to the Essentials bundle only by convention — CLI-layer guard enforcement.

### Current State (grounded in bundles.json audit — 2026-08-17)

| Essentials Bundle | Status Tag | Agents | Skills | Notes |
|---|---|---|---|---|
| `universal-skills` | `stable ⭐` | 0 | 6 | Universal meta-skills baseline (grill-me, grill-with-docs, domain-modeling, to-spec, to-tickets, handoff) |
| `software-engineering` | `stable` | 4 | 16 | Audited & lean core skills (TDD, debugging, refactoring, code review, git guardrails) |
| `product-design` | `stable` | 3 | 7 | Audited & decomposed. 2 Addons: `design-systems-ops`, `design-research-testing` |
| `growth-marketing` | `stable` | 5 | 12 | Clean |
| `system-architecture` | `stable` | 2 | 11 | Clean |
| `security-operations` | `stable` | 1 | 2 | Clean |
| `deep-research` | `stable` | 3 | 5 | Clean |
| `business-strategy` | `stable` | 1 | 2 | Clean |

### Tasks

#### Part A — Bundle Composition Audit (Completed in Plan 009)
- [x] Review all 26 skills in `software-engineering` and extract universal meta-skills to `universal-skills` bundle.
- [x] Decompose `product-design` into lean Essentials base (3 agents: UI, UX, Interaction Designer) + 2 merged Addons (`design-systems-ops`, `design-research-testing`).
- [x] Update `bundles.json` to transition audited bundles to `status: "stable"`.
- [x] Position Universal Department first in TUI with `universal-skills` marked as `[Recommended]`.
- [x] Run `npm test` — all 23 test suites (222 tests) pass with 100% success rate.

#### Part B — CLI Guard Implementation
- [ ] Add CLI-layer guard in `domain:<dept>` resolution path so it installs **Essentials bundle only**
- [ ] Print clear message listing available Addon sub-bundles with descriptions after Essentials install
- [ ] Add unit test asserting `agents add domain:engineering` does NOT install `ai-ml-engineering`, `mobile-development`, etc.
- [ ] Update `CONTEXT.md` → Domain-Level Installation entry to reflect the new strict behavior

#### Verification
```bash
npm run build && npm test
agents add domain:engineering --dry-run  # Must show only software-engineering
agents add domain:marketing --dry-run    # Must show only growth-marketing
```

---

## Milestone 2 — GitHub Pages Public Site

**Status**: `🔲 Planned`
**Priority**: Medium
**Effort**: Large (L)
**URL**: https://neoanthropocene.github.io/agents-united
**Domain**: Design + Frontend

### Problem Statement

Agents United has no public-facing documentation or marketing site. Developers discovering the project via npm or GitHub have only the README as entry point. A purpose-built site improves adoption, reduces time-to-first-install, and communicates the value proposition visually.

### Design Brief

**Audience**: Developers building with AI agents (Antigravity/Gemini, Claude Code, Cursor), team leads evaluating agent tooling, open-source contributors.

**Core message**: *"Start lean. Grow on demand. The right agents for every job."*

**Visual direction**:
- Dark theme primary, light mode toggle
- Clean terminal aesthetic (monospace accents, CLI output previews)
- Minimal, functional — no bento-box overload, no gradient keyword fills
- Inspired by: Vercel docs, Linear marketing, shadcn/ui simplicity

**Tech stack options** (to be decided in design session):
- Option A: **Astro** — static, fast, Markdown-first, ideal for docs
- Option B: **Next.js** (App Router) — more dynamic, better for interactive CLI demos
- Option C: **Plain HTML/CSS** — zero dependency, maximum control

### Page Structure (Wireframe Outline)

Hero > Essentials-First Explainer (3-step visual) > Ecosystem Matrix (8 department cards) > Platform & Cloud Tooling (logo row) > Quickstart (3 steps) > CLI Reference > Footer

Full wireframe detail to be produced in a dedicated design session.

### Tasks

- [ ] Finalize tech stack decision (design session)
- [ ] Create detailed wireframes for each section
- [ ] Design the Essentials-First 3-step visual explainer
- [ ] Build animated CLI terminal demo component
- [ ] Create interactive Ecosystem Matrix card grid
- [ ] Implement platform logo row with skill runbook deep-links
- [ ] Set up GitHub Actions deploy to gh-pages branch
- [ ] Add SEO: OpenGraph tags, Twitter card, sitemap, robots.txt
- [ ] Verify Core Web Vitals: LCP < 2.5s, CLS = 0, INP < 200ms

#### Verification
```bash
npx lighthouse https://neoanthropocene.github.io/agents-united --only-categories=performance,seo,accessibility
# Target: Performance >= 90, SEO = 100, Accessibility >= 95
```

---

## Milestone 3 — Organization Bundles, Lifecycle States & Prerequisite Engine

**Status**: `🔄 In Progress`
**Priority**: High
**Effort**: Large (L)
**Domain**: Multi-Agent Orchestration + MCP Integration

### Problem Statement

Previous bundles operate as single-domain discipline packages (engineering, design, marketing) that run purely on system prompts and basic shell tools. Real-world organizations (e.g. "Digital Agency", "Growth Accelerator") are **cross-functional composites** that require live tool integrations — such as Model Context Protocol (MCP) servers (Firecrawl, GitHub, Supabase), specific npm packages, and environment API keys.

To protect the user experience and prevent broken runtime executions, Organization Bundles require:
1. Declarative prerequisite manifests (`requiredMcps`, `requiredPackages`, `requiredEnvVars`).
2. Multi-host prerequisite evaluation engine (`PrerequisiteChecker`).
3. 3-way resolution blocking gate during CLI installation (Abort / Brainstorming Mode / Force Operational).
4. Dual execution envelopes: **Fully Operational Mode** (live MCP tool calling) and **Brainstorming Mode** (fallback ideation/spec generation without live tool dependencies).
5. Formal **Bundle Lifecycle States** (`stable`, `experimental`, `under-construction`, `needs-audit`, `deprecated`) and a blocking **Under-Construction Gate** preventing accidental deployment of draft bundles.

### Tasks

- [x] Extend `BundleDefinition` schema with `tier`, `status` (`stable`, `experimental`, `under-construction`, `needs-audit`, `deprecated`), `prerequisites`, and `modes`.
- [x] Implement multi-host `PrerequisiteChecker` inspecting Cursor (`.cursor/mcp.json`), Cline (`cline_mcp_settings.json`), Gemini (`.gemini/antigravity/mcp/`), Claude (`claude.json`), and environment variables.
- [x] Implement 3-way interactive prerequisite gate in `agents add` with `--mode <operational|brainstorming>` and `--allow-missing-prereqs` flags.
- [x] Implement blocking **Under-Construction Gate** with `--allow-under-construction` flag.
- [x] Add placeholder `digital-agency` (status: `under-construction`) in `registry/bundles.json`.
- [x] Redesign `agents list` TUI to display Organization Bundles in a distinct dedicated section with `🚧 [Under Construction (TBA)]` and `⚠️ [Needs Audit]` badges.
- [ ] Author canonical `orchestrator-digital-agency.md` with dynamic MCP tool capability probing and mode switching.
- [ ] Implement digital agency specialized workflows (`workflow-client-pitch.md`, `workflow-fullstack-delivery.md`, `workflow-seo-audit.md`).
- [ ] Add E2E multi-agent integration tests verifying tool dispatch in both Operational and Brainstorming modes.

#### Verification
```bash
npm run build && npm test
agents list # Shows distinct Organization Bundles section and status badges
agents add digital-agency -y --dry-run # Blocked by Under-Construction Gate
agents add digital-agency --allow-under-construction --mode brainstorming --dry-run # Passes
```

---

## Future Ideas (Unscoped)

| Idea | Domain | Signal |
|---|---|---|
| `universal-skills` bundle — shared meta-skills (grill-me, handoff, to-spec) decoupled from any domain | Core Architecture | Identified in Milestone 1 audit |
| `venture-studio` Organization Bundle — idea incubation, cap table modeling, prototype build & seed pitch deck | Multi-Agent Org | Organization taxonomy expansion |
| `growth-accelerator` Organization Bundle — performance marketing, PLG funnels & paid acquisition multi-agent squad | Multi-Agent Org | Organization taxonomy expansion |
| Agent hot-reload — detect .agents/ changes and re-load without restarting host | CLI / DX | Common dev pain point |
| `agents publish` — CLI command to publish a local bundle to a personal registry | Registry | Community-contributed bundles |
| `agents chat` — conversational TUI routing to the right orchestrator by intent | CLI | Reduces time-to-delegation. The in-session counterpart is the `universal-orchestration` bundle (Prime Orchestrator / Domain Atlas). |
| VS Code / Cursor extension — sidebar for browsing and installing bundles | IDE Integration | Wider discoverability surface |
| Webhook-driven self-update — agents self-update when registry publishes new version | Automation | Reduces manual `agents update` friction |

---

*Last updated: 2026-08-17 | Maintained by: NeoAnthropocene*
