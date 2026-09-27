# Plan 027: Third-Party Skill Ingestion — Batch 1 (Engineering, Security, SRE, ML/Data)

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source evidence: owner-supplied source
> `github.com/VoltAgent/awesome-agent-skills#official-skills-by`, triaged 2026-09-27 into the
> shortlist below. Runs in parallel with Plans 025/026/028. Files touched: new
> `registry/skills/<name>/**`, the `skills` arrays of the bundles named below plus `full` in
> `registry/bundles.json`, the specialists named below, the pinned skill counts, README Credits.

## Status

- **State**: AUTHORIZED — owner approved the 10-skill shortlist as-is, 2026-09-27 (via project
  thread). Step 0's upstream/licence/SHA verification and overlap checks still run before any
  skill is authored — approval covers the shortlist, not a waiver of that verification.
- **EXECUTED — 2026-09-27** on `feat/third-party-skills-batch-1`. Step 0 verification against
  the real upstream repos (not the aggregator's own descriptions) changed the shortlist:
  **shipped 7/10** in full (#1, #4, #6, #7, #8, #9, #10 — real upstream + licence recorded in
  each `SKILL.md`'s `metadata` block), **skipped 1 on overlap** (#2 `web-perf-audit`: the real
  upstream `cloudflare/skills` `web-perf` skill is a Chrome-DevTools Core-Web-Vitals auditor,
  materially redundant with the catalog's existing `debug-optimize-lcp`/`performance-
  optimization`/`modern-web-guidance`), and **shipped 2 as link-only stubs on licence** (#3
  `terraform-test-patterns`: `hashicorp/agent-skills` is MPL-2.0; #5 `threat-modeling`:
  `trailofbits/skills` is CC-BY-SA-4.0 — neither is on the MIT/Apache-2.0/BSD/CC-BY
  redistribution allow-list, so both attribute and link upstream instead of vendoring). The
  other three overlap checks (#4 vs `security-audit`, #6 vs `telemetry-monitoring`/
  `workflow-incident-triage`, #8 vs `hf-model-evaluation`) found real, non-redundant scope and
  those three shipped in full. See `plans/README.md`'s row for the full disposition and sources.
- **Priority**: P2 · **Effort**: L · **Risk**: Low–Medium (additive; licence and fidelity
  are the real risks)
- **Depends on**: none. Follows the intake checklist below, which Plan 026 later publishes as
  `docs/skill-intake.md`. If Plan 025 has landed, add Skill Consultation Map rows; if not, add
  frontmatter `skills:` entries and Plan 025 picks them up.
- **Category**: catalog / skills
- **Branch**: `feat/third-party-skills-batch-1` (cut fresh from `dev` when authorized)

## Why this exists

The owner asked for the most important skills from a large vendor aggregator, placed in the
right bundles, excluding what the catalog already covers (TDD, debugging, git, code review,
RAG/vector DBs, IaC). The aggregator is a README of links: skill names, licences and quality
were not verified at the upstream repos during triage, so this plan starts by verifying them.

## Shortlist (10)

| # | Skill (working name) | Upstream | Scope | Bundle (all addons) | Specialist wired |
|---|---|---|---|---|---|
| 1 | `postgres-best-practices` | Supabase | Postgres indexing, query plans, schema patterns | `backend-distributed-systems`, `system-architecture-data` | `data-engineer`, `distributed-systems-architect`, `database-administrator` |
| 2 | `web-perf-audit` | Cloudflare | Core Web Vitals audit and tuning | `frontend-engineering` | `frontend-architect` |
| 3 | `terraform-test-patterns` | HashiCorp | Terraform test/acceptance patterns | `devops-engineering` | `devops-engineer` |
| 4 | `edge-security-audit` | Cloudflare | Security audit for edge/Workers apps | `secops-cloud-security` | `cloud-security-architect` |
| 5 | `threat-modeling` | Trail of Bits (one skill synthesized from their set) | Threat modeling and adversarial review | `secops-application-security` | `appsec-penetration-tester` |
| 6 | `sentry-incident-triage` | Sentry (one skill from their set) | Error/alert setup and issue triage | `sysops-sre` | `sysops-sre-lead` |
| 7 | `clickhouse-architecture-advisor` | ClickHouse | Analytical schema/system design | `system-architecture-data` | `database-administrator` |
| 8 | `hf-model-training` | Hugging Face (TRL) | Fine-tuning workflow | `ai-ml-engineering` | `ai-model-architect` |
| 9 | `hf-managed-jobs` | Hugging Face (hf CLI / Jobs) | Running ML jobs on managed compute | `ai-ml-engineering` | `ml-platform-engineer` |
| 10 | `expo-cicd-workflows` | Expo | EAS build/submit CI pipelines | `mobile-development` | `cross-platform-specialist` |

Changes from the first draft: every target is now an **addon** — vendor skills do not go into
Essentials (`security-operations` → `secops-cloud-security`, `system-architecture` →
`system-architecture-data`), per the Essentials-first rule (Plan 009). Dropped:
`wp-performance-audit` (no PHP/WordPress stack anywhere in the catalog) and
`neon-postgres-egress-optimizer` (single-vendor cost niche). Also not taken: a 50+ framework E2E
set (overlaps Playwright/TDD skills), Netlify/Vercel deploy skills (covered by
`vercel-deploy-best-practices`), Sanity CMS skills, Composio (integration glue).

**Overlap checks Step 0 must settle** (STOP if a candidate adds nothing):
#2 vs `debug-optimize-lcp`, `modern-web-guidance`, `performance-optimization`;
#4 vs `security-audit`; #6 vs `telemetry-monitoring` and `workflow-incident-triage`;
#8 vs `hf-model-evaluation`.

## Intake checklist (applies to every skill)

1. Upstream exists at a real repo; record `metadata.source` as repo URL + commit SHA.
2. Licence permits redistribution (MIT, Apache-2.0, BSD, CC-BY). Otherwise STOP: link to the
   upstream instead of vendoring, or drop.
3. Name passes Claude and Cline rules (lowercase, digits, hyphens, ≤64 chars, equals directory
   name, no "claude"/"anthropic").
4. SKILL.md has the PROJECT.md §7.2 sections; long material goes in `references/`.
5. Bundled scripts run on Windows and POSIX (Node or Python, no bash-only syntax) and never
   write, deploy or call paid APIs without an explicit confirmation step in the runbook.
6. Commands and APIs are the vendor's real ones, cited from upstream docs; nothing invented.
7. Placed in addon bundles and `full`; wired to the named specialist.
8. README Credits entry; catalog counts updated (tests, README, PROJECT.md).

## Objective

1. Owner approves or trims the shortlist (Step 0), after upstream, licence and overlap checks.
2. Author each approved skill under `registry/skills/<name>/` per the checklist.
3. Wire bundles, `full`, and specialists; add Credits.
4. Replace the literal skill count (`166` in `tests/e2e-skills-depth.test.ts`,
   `tests/gate-command-portability.test.ts`, `tests/skills-cli-command.test.ts`) with a count
   derived from `registry/skills/` if it is still literal, so Plans 027 and 028 do not fight
   over the same constant; update the counts in README/PROJECT.md prose.

## Implementation steps (TDD)

**Step 0 — verification and sign-off (delegate: `subagent-repo-index` for upstream/licence
fetch; owner for the decision).** For each row: confirm the upstream skill exists, record
licence and SHA, run the overlap check. Present the table with results. STOP until the owner
approves the final list.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).** Every bundle-listed skill
exists; new skills have non-placeholder `metadata.author`/`metadata.source` with a SHA and a
`metadata.license`; names pass the portability rules; derived skill count.

**Step 2 — author skills (delegate: the specialist in the table for each row).** One skill per
invocation, grounded in the pinned upstream.

**Step 3 — wiring (delegate: `subagent-backend-architect`).** Bundles, `full`, specialist map
rows or `skills:` entries, Credits, count prose.

**Step 4 — adversarial audit (delegate: `subagent-code-reviewer`).** Spot-check at least three
skills against upstream docs for invented commands; confirm only the listed bundles changed;
run a bundled script on Windows-style paths if any skill ships one.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` green.
2. Every approved skill passes the intake checklist; licences and SHAs recorded.
3. Only the listed addon bundles and `full` changed in `registry/bundles.json`.
4. `agents find <skill>` and `agents list` show each skill under its bundle.
5. **Owner manual check (Windows)**: install `secops-application-security` with
   `--fanout claude,cline`; on Claude Code, Antigravity and Cline ask for a threat model of a
   small service. Pass = `threat-modeling` is loaded (visible skill read) and the output follows
   its runbook.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Licence does not allow vendoring | High | checklist item 2; link instead of copy |
| R2 | Skill content invents vendor commands | High | pinned upstream + Step 4 spot-check |
| R3 | Vendored copy drifts from upstream | Med | SHA pin makes drift visible; updates are a deliberate re-intake |
| R4 | Merge conflict with Plan 028 on `full` and counts | Low | derived count; `full` edits are append-only, rebase resolves |
| R5 | Synthesizing one skill from a large vendor set loses depth | Med | at most two skills per vendor set, scope fixed by the table |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` + owner | upstream/licence/overlap verification, sign-off |
| Step 1 | `subagent-qa-automation-lead` | RED tests |
| Step 2 | specialists in the shortlist table | authoring |
| Step 3 | `subagent-backend-architect` | wiring, credits, counts |
| Step 4 | `subagent-code-reviewer` | adversarial audit |

## References

- Evidence: triage of `github.com/VoltAgent/awesome-agent-skills#official-skills-by`,
  2026-09-27.
- Convention: README "Skill & Agent Contribution Standard"; Plan 009 (Essentials stay lean);
  Plan 026 (`docs/skill-intake.md`, host matrix); Plan 025 (Skill Consultation Map).
