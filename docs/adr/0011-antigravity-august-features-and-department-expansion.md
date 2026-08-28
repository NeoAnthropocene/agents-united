# ADR 0011: Antigravity August 2026 Features Adoption & Department Subagent Ecosystem Expansion

## Status

Accepted

## Context

The release of Google Antigravity 2.0 (v2.6.0–v2.10.0) and Antigravity CLI (v1.1.10–v1.1.21) in August 2026 introduced significant capabilities:
1. **Declarative Agent Frontmatter & Rule Scoping**:
   - `rules:` key: Agents can explicitly name their required rule files rather than inheriting all workspace rules.
   - `inheritCustomizations`: Single boolean switch to control inheritance of workspace skills, rules, and subagents.
   - `disable-slash-command: true`: Skills can be hidden from the interactive `/` slash menu while remaining fully discoverable by models.
   - `metadata.icon`: Visual Unicode emoji branding across catalog lists and inspection headers.
   - Reasoning effort (`/effort`) and `model:` tiers for granular reasoning control.
2. **Subagent Tree Lifecycle & Concurrency**:
   - Cascading tree termination: Stopping a subagent cleanly halts all child subagents and background tasks.
   - `manage_task` available to declarative custom agents for non-polling background process management.
   - Non-polling `schedule` timers with sender ID early-termination triggers.
3. **Multimodal Deliverables & Previews**:
   - In-app URL Artifact Cards for local dev servers and cloud docs.
   - Visual side-by-side image/SVG diffs and image region-selection comments.
   - Audio file attachments (.mp3, .wav, .m4a up to 20MB) and `/voice` transcription.
4. **Native MCP CLI Management**:
   - CLI `mcp` subcommands (`agy mcp add|remove|list|enable|disable`) and disk offloading for large binary payloads.
5. **Department Roster Gaps**:
   - An ecosystem audit revealed critical subagent deficits in `security` (only 1 subagent), `business` (only 1 generic panel subagent), `research` (missing quantitative and literature analysts), and `architecture` (missing cloud topology, DBA, and FinOps specialists).

## Decision

### 1. Frontmatter Schema & Projection Protocol
- Update the canonical agent schema in `registry/agents/*.md` to support `rules: string[]`, `inheritCustomizations: boolean`, and `model: inherit | flash | pro`.
- Update `src/core/types.ts` and `src/core/projector.ts` so these keys are cleanly preserved for Antigravity and translated or safely stripped for projected hosts (`claude`, `cursor`, `cline`, `opencode`, `codex`).
- Update `registry/skills/**/SKILL.md` to declare `metadata.icon` (e.g. `⚡`, `🔍`, `🎨`) and set `disable-slash-command: true` on internal subagent runbooks, preserving slash commands exclusively for high-level user-facing actions.

### 2. Department-by-Department Roster Expansion
Expand the four under-represented department domains with specialized sub-bundles and dedicated subagents:

- **Security Operations (`security`)**:
  - `secops-cloud-security`: `subagent-cloud-security-architect.md` (IAM, cloud posture, secrets, Bicep/Terraform security).
  - `secops-application-security`: `subagent-appsec-penetration-tester.md` (SAST/DAST, OWASP Top 10, CVE auditing, API fuzzing).
  - `secops-compliance-grc`: `subagent-compliance-grc-specialist.md` (SOC2 Type II, ISO 27001, HIPAA, GDPR audit pipelines).
- **Business Strategy & Economics (`business`)**:
  - `business-financial-modeling`: `subagent-financial-analyst.md` (SaaS unit economics, CAC/LTV, burn rate, pricing models).
  - `business-market-intelligence`: `subagent-market-intelligence-analyst.md` (TAM/SAM/SOM sizing, competitor teardowns, Porter's 5 Forces).
  - `business-operations-legal`: `subagent-legal-contract-analyst.md`, `subagent-operations-strategist.md` (ToS, vendor SLAs, OKRs, hiring plans).
- **Deep Technical Research (`research`)**:
  - Add `subagent-statistical-analyst.md` (quantitative modeling, benchmark statistics, dataset analysis).
  - Add `subagent-literature-patent-analyst.md` (academic paper synthesis, arXiv/Semantic Scholar indexing, prior art).
- **System Architecture & SRE (`architecture`)**:
  - `cloud-infrastructure-architect`: Multi-region cloud topology, VPC peering, Kubernetes cluster design.
  - `database-administrator`: WAL tuning, replication topologies, zero-downtime schema migrations.
  - `finops-cost-engineer`: Cloud spend attribution, spot optimization, egress minimization.

### 3. Native MCP Provisioning & Organization Bundle Activation
- Integrate `agy mcp` CLI calls into `src/core/prerequisites.ts` to automatically provision required MCP servers (Firecrawl, GitHub) for `digital-agency`.
- Graduate `digital-agency` from `status: "under-construction"` to `status: "experimental"`.

### 4. Multimodal & Reactive Task Tooling
- Equip `subagent-frontend-architect`, `product-design`, and `devops-engineering` to emit URL Artifact Cards for live dev servers.
- Equip `subagent-ui-designer` and `subagent-e2e-tester` with visual side-by-side image diff and region commenting runbooks.
- Equip `grill-me`, `grill-with-docs`, and `to-spec` with audio file intake guidelines.
- Equip DevOps, SysOps, and QA leads with `manage_task` for background task management and reactive `schedule` liveness timers.

## Consequences

- Token consumption and context clutter in Antigravity sessions are significantly reduced by scoped `rules:` and `inheritCustomizations`.
- The user-facing slash command palette remains focused and responsive by hiding internal subagent skills via `disable-slash-command: true`.
- Department coverage across Security, Business, Research, and Architecture reaches parity with Software Engineering.
- Zero-drift guarantee: Multi-host projections continue to work seamlessly across Claude Code, Cursor, Cline, OpenCode, and Codex.
