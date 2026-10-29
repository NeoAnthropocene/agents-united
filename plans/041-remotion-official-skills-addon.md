# Plan 041: Remotion official skills add-on, version currency and optional Studio

Status: **Implementation, multi-host install verification and full-suite CI fixes complete; publication under review.**
Optional Studio served HTTP 200 in the recorded local smoke test; interactive editing is still
unverified. The publication review reopened the official skills redistribution/licence scope
question; the draft PR must not be merged or published until that question is resolved.

Date: 2026-10-29 (Europe/Berlin). Branch: `codex/sound-model-catalogue`.

## Goal

Make the official Remotion Agent Skills available only to projects that choose Remotion, resolve
their source-available licence honestly, keep the pinned Remotion runtime current, and offer the
user an optional hands-on remotion Studio path without displacing agentic production.

## Source and decisions

- Official skills: `remotion-dev/skills` at `30d4553ecd46fbc5212fd0ff006ae43af522158b`,
  version 4.0.539, 12 skill folders.
- Governing licence: [Remotion LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md),
  source-available and not MIT. Free eligibility is limited to individuals, non-profits, eligible
  small for-profit organizations and noncommercial evaluation; larger companies need a Company
  License. Relicensing/sublicensing a derivative is prohibited. This is not legal advice.
- Current public npm `latest` for `remotion`, `@remotion/bundler`, `@remotion/renderer` and
  `@remotion/cli` is 4.0.539, so the runtime pin moves from 4.0.538 to 4.0.539.
- Official plugins (Claude Code, Codex, Cursor, GitHub Copilot, Kimi Code) include the same skill
  content and are alternatives, never an additional duplicate install.

## Jobs

| Job | Scope | Done criteria |
|---|---|---|
| R0 | Red tests | source-available licence class, add-on bundle/licence/notice, host/Studio docs, release checker, role choice |
| R1 | Licence and add-on | `LicenseRef-Remotion` tier; 12 pinned skill folders with `LICENSE.md`/`NOTICE.md`; optional `remotion-agent-skills` child bundle, absent from `full` |
| R2 | Version currency | 4.0.539 pin everywhere current; pure/CLI release checker; runtime docs |
| R3 | Hosts and Studio | host matrix for Claude/Codex/Cursor/Antigravity/Cline/OpenCode/Copilot/Kimi; agent-only default and optional Studio choice in lead + Motion; Studio VERIFIED on the pinned pilot project — `remotion studio index.jsx --no-open --port 3459` served HTTP 200 after “Built in 12227ms” (the bare `studio` command failed with no entrypoint; the scaffold now ships `scripts.studio`) |
| R4 | Install verification | PASS: disposable install exit 0 across Antigravity (`.agents/skills/`), Claude (`.claude/skills/`), Cline (`.agents/plugins/remotion-agent-skills/skills/`), Cursor (`.cursor/agents/`), Codex (`AGENTS.md`) and OpenCode (`.opencode/agent/`) with 12 official skills and `LICENSE.md`/`NOTICE.md`/`SECURITY-REVIEW.md` retained; Remotion Pilot 040 got them; Native pilot remains without them; dedupe protects projector size |
| R5 | Final gates | PASS: all 4 add-on CI regressions fixed (`remotion-*/SKILL.md` top-level `version` key removed and recorded in `NOTICE.md`; 12 `third-party-pinned` provenance entries added to `host-library/_upstream/skills.json`; `OPTIONAL_ADDON_BUNDLES` excluded from `full` bundle comparison in `tests/e2e-skills-depth.test.ts`; public Algolia DocSearch key in `remotion-docs/SKILL.md` bound in `tests/plan-029-orchestrator-mcp-and-antigravity.test.ts`); `skill-evals-not-installed` (2.97s) and `inventory` (4.06s) pass within budget; full 231/231 test suite green |

## Boundaries

No automatic package upgrade, network install or `npx skills` call during render. No runtime
entitlement is inferred from the add-on. Studio is optional and must not replace proof review or
the final helper-export gate. Exact upstream terms, package and skill versions remain dated facts.

## Verification log (2026-10-29)

| Check | Result |
|---|---|
| `tests/remotion-agent-skills.test.ts` (add-on, licence, links, rendering-modes, audit note, quality measure, host/Studio docs, version, role choice, multi-host disposable install) | 10 passed |
| `tests/native-antigravity-skills.test.ts` (Antigravity frontmatter compliance across all 226 skills incl. `remotion-*`) | 228 passed |
| `tests/hostlib-provenance.test.ts` (provenance lockfile coverage for all 226 skills incl. 12 `remotion-*`) | 4 passed |
| `tests/e2e-skills-depth.test.ts` (depth, bundle reachability and optional add-on exclusion from `full`) | 10 passed |
| `tests/plan-029-orchestrator-mcp-and-antigravity.test.ts` (R4 secret scan with bound public DocSearch search key for `remotion-docs`) | 37 passed |
| `tests/plan-030-licence-aware-skills.test.ts` (licence tiers incl. `source-available`) | 91 passed |
| `tests/media-remotion.test.ts` (helper contracts and release-drift comparison) | 3 passed |
| `tests/skill-evals-not-installed.test.ts` and `tests/inventory.test.ts` | 2 files / 16 tests passed (5.86s total; 2.97s and 4.06s individually) |
| `tests/registry.test.ts`, `tests/prerequisites.test.ts`, `tests/bundle-skill-refs.test.ts`, `tests/skill-quality-ratchet.test.ts`, `tests/skill-layout.test.ts`, `tests/agency-media-roles.test.ts`, `tests/native-claude-agents.test.ts`, `tests/hostlib-licences.test.ts`, `tests/hostlib-restore*.test.ts` | passed |
| `npm run typecheck` | exit 0 |
| `npm run hostlib:verify` | pass |
| `npm run skills:remotion-release` | pinned 4.0.539 = latest, exit 0 |
| `hostlib:audit` over the 12 official skills | 11 `pass`; `remotion-maps` `needs-review` (7 low/medium findings), manually inspected and recorded in `SECURITY-REVIEW.md` and `host-library/_upstream/skills.json` |
| Add-on install into a disposable multi-host project (Antigravity, Claude, Cline, Cursor, Codex, OpenCode) | exit 0; 12 official skills + parent team projected cleanly; `LICENSE.md`/`NOTICE.md`/`SECURITY-REVIEW.md` retained |
| Add-on install into `scratch/pilot-040/remotion` | exit 0; Native pilot untouched (0 official skills) |
| Studio smoke | `remotion studio index.jsx --no-open --port 3459` → HTTP 200, “Built in 12227ms” |
| Full repository test suite (`tests/*.test.ts`) | 231/231 test files passed (0 failures) |

## 2026-10-29 publication review amendment

This amendment supersedes earlier statements that licence ambiguity was fully resolved. The
maintainer supplied the Remotion runtime licence; upstream package metadata points to
`remotion-dev/remotion/packages/skills`, supporting common lineage. However, carrying another
repository's licence is not itself proof that this standalone snapshot is covered or that our
redistribution in an npm package is authorized. Optional installation does not remove that
question: the package's `files: ["dist", "registry"]` includes the vendored content.

**Merge/release hold:** obtain pinned upstream scope and redistribution evidence or explicit
upstream clarification before merging/publishing this add-on. The current `LicenseRef-Remotion`
classification and copies of `LICENSE.md` are recorded implementation choices, not an entitlement
or redistribution ruling. Direct installation of the official repository/plugin remains a user
choice under its actual terms. The PR is draft while this review remains open.

Installation correction: Pilot 040 received the 12 official skills; Pilot 041's harness installed
`digital-agency` alone. Do not describe Pilot 041 as proof of official-skills use or effectiveness.

Not verified: official host plugins (`npx skills add`), interactive Studio editing/write-back,
rendered output of the official guidance, entitlement or redistribution clearance.
