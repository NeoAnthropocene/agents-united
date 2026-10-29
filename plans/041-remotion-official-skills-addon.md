# Plan 041: Remotion official skills add-on, version currency and optional Studio

Status: **R0–R4 complete; R5 green for the targeted/security gates, with two 5-second
whole-catalogue projector tests still timing out under the larger catalogue. Optional Studio was
started and served HTTP 200 on the pinned pilot project.** No paid pilot, commit or push is part of
this slice.

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
| R4 | Install verification | PASS: disposable install exit 0 with 12 official skills (add-on also installs its parent digital-agency team: 12 agents, 80 skills, verified); Remotion pilot got them; Native pilot remains without them; dedupe protects projector size |
| R5 | Final gates | targeted/add-on/security/registry/typecheck/hostlib gates green; `skill-evals-not-installed` whole-catalogue and `inventory` fanout cases exceed their 5-second budget after the optional-package additions; no commit/push without approval |

## Boundaries

No automatic package upgrade, network install or `npx skills` call during render. No runtime
entitlement is inferred from the add-on. Studio is optional and must not replace proof review or
the final helper-export gate. Exact upstream terms, package and skill versions remain dated facts.

## Verification log (2026-10-29)

| Check | Result |
|---|---|
| `tests/remotion-agent-skills.test.ts` (add-on, licence, links, audit note, version, Studio choice, roles) | 8 passed |
| `tests/plan-030-licence-aware-skills.test.ts` (licence tiers incl. `source-available`) | 91 passed |
| `tests/media-remotion.test.ts` (helper contracts and release-drift comparison) | 3 passed |
| `tests/registry.test.ts`, `tests/prerequisites.test.ts`, `tests/bundle-skill-refs.test.ts`, `tests/skill-quality-ratchet.test.ts`, `tests/skill-layout.test.ts`, `tests/agency-media-roles.test.ts`, `tests/native-claude-agents.test.ts`, `tests/hostlib-licences.test.ts`, `tests/hostlib-restore*.test.ts` | passed |
| `npm run typecheck` | exit 0 |
| `npm run hostlib:verify` | pass |
| `npm run skills:remotion-release` | pinned 4.0.539 = latest, exit 0 |
| `hostlib:audit` over the 12 official skills | 11 `pass`; `remotion-maps` `needs-review` (7 low/medium findings), manually inspected and recorded in `SECURITY-REVIEW.md` |
| Add-on install into a disposable Claude project | exit 0; 12 official skills + parent team; `LICENSE.md`/`NOTICE.md`/`SECURITY-REVIEW.md` retained |
| Add-on install into `scratch/pilot-040/remotion` | exit 0; Native pilot untouched (0 official skills) |
| Studio smoke | `remotion studio index.jsx --no-open --port 3459` → HTTP 200, “Built in 12227ms” |
| Known red | `skill-evals-not-installed` whole-catalogue plan and `inventory` fanout case exceed their 5 s per-test budget on this machine; assertions are unrelated to the add-on and the failures are timeouts/cleanup races |

Not verified: official host plugins, Codex/Cursor/Antigravity/Cline installs of this add-on,
interactive Studio editing/write-back, rendered output of the official guidance, entitlement
