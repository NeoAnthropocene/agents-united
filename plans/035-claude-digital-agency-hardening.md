# Plan 035: Claude Digital-Agency Hardening

> **Executor instructions**: the maintainer set this plan in chat on 2026-10-04 and went away until the morning. Everything marked "Decisions taken while the maintainer was away" was decided by the executing session on the conservative default and is reversible. Test first, one reviewed pull request per slice, each from a fresh `origin/dev`, no merge by the executor. The single writer of this file is the plan pull request: slice pull requests do not edit it, so they do not conflict on it.

## Status

- **State**: M1 and M2 offline slices in progress (see the table); M3 prepared and gated on the maintainer; M4 prepared as drafts, gated on M3.
- **Priority**: P1 · **Effort**: L · **Risk**: Medium (rewrites 29 skills that the native roles load; no code path changes except the ratchet test and the report helper).
- **Category**: Catalog / Skills / Runtime conformance.
- **Branch**: `feat/claude-digital-agency-hardening` (this plan); slices on `feat/claude-digital-agency-hardening-<slice>`.
- **Depends on**: ADR 0039 (full native roster, live run `d2f784af`), Plan 032 (native host packages), Plan 030 and `docs/skill-intake.md` (third-party skills).
- **Out of scope until Claude is fully complete**: Antigravity and Cline Tier-2 packages. The `mcp.md` security hold of PR #126 stays untouched.

## Goal

Harden the first Claude pilot of the digital-agency bundle until the `experimental` label can be removed, and make its skills fit for purpose. When this plan is done, parked Plan 033 (`agent-factory`) is updated with what was learned.

## Ground (checked 2026-10-04, evening)

- `gh pr list --state all`: #122 to #127 are merged on `dev`; no pull request was open when this plan started.
- Plan limits read free with `get_usage` before any work: Pro plan, 5-hour window 67% used, weekly window 73% used (resets 2026-10-08). The session ran with no model spending of its own (no `claude -p`, no real host session).
- Verified skill facts (the maintainer's recon, re-measured by script: the audit is `docs/skill-quality/digital-agency-audit.md`, S1):
  - 15 skills of the 53 are one template with the title swapped (the maintainer listed 14; `design-handoff-spec` is the 15th, 100% shared lines). They hold 150 lines each, "provides a deterministic framework for executing ... in modern software products", with the same phases, the same `npm run typecheck && npm test` commands (meaningless for a campaign), and a placeholder `runAbTestSetup` TypeScript function as the "exemplar".
  - Six more are partly generated: `technical-documentation`, `test-driven-development`, `subagent-driven-development`, `security-audit`, `performance-optimization`, `frontend-component-design` come from `scripts/generate-skills.cjs` (about 45% shared lines), the same generator that wrote the engineering skills.
  - `technical-seo-audit` and `ad-creative-design` are 27-line stubs.
  - The five `workflow-agency-*` skills share 37% of their lines; **no native role body loads them** (the lead's body names `grill-me`, `grill-with-docs`, `mcp-setup` and `handoff` only), and their gates (`npx agents-united doctor`, `npm run build --if-present`) belong to a code repository, not an agency job.
  - Skills no native role loads: the five workflows, `ui-component-spec`, `banner-design`, `brand-identity`, `ux-writing`, `subagent-driven-development`.
  - Provenance records of `not-found`: `banner-design`, `brand-identity`, `ux-writing`, `stitch-design-taste`, `generative-ui`, `modern-web-guidance` (the upstream is a web registry or a repository path that no longer holds the skill).
- The seven items not established after the live runs are in "Live-test kit" below.

## Slices and milestones

GitHub milestones (created with `gh api`, every pull request attached with `gh pr edit --milestone`): **M1 Skills fit for purpose**, **M2 Hardening kit**, **M3 Live hardening**, **M4 Close-out**.

| Slice | Milestone | Branch suffix | Base | What | State |
|---|---|---|---|---|---|
| Plan | (none) | (this branch) | `dev` | Plan 035, the README row, the milestones | see the log |
| S1 | M1 | `-s1-audit` | `dev` | Audit of the 53 skills, ADR 0040 (rewrite policy), the ratchet test with a shrinking per-skill allowlist | see the log |
| S2 | M1 | `-s2-growth` | S1 | growth-experiment-design, ab-test-setup, conversion-funnel-optimization, signup-flow-cro, onboarding-cro, viral-referral-loops | see the log |
| S3 | M1 | `-s3-content` | S1 | copywriting-frameworks, content-calendar-strategy, email-marketing-automation, email-drip-sequences, social-media-campaign, product-launch-playbook, ad-creative-design | see the log |
| S4 | M1 | `-s4-design-qa` | S1 | design-system-tokens, ui-component-spec, responsive-design-audit, accessibility-audit, design-handoff-spec, marketing-creative-design, the no-provenance design skills | see the log |
| S5 | M1 | `-s5-seo` | S1 | seo-audit, technical-seo-audit, programmatic-seo, schema-markup-strategy | see the log |
| S6 | M1 | `-s6-orchestration` | S1 | the five workflow-agency-* skills, mcp-setup, a brief-and-premises planning skill wired into the lead | see the log |
| S7 | M2 | `-s7-live-protocol` | `dev` | `docs/live-test-protocol.md`: scenarios H1 to H7 | see the log |
| S8 | M2 | `-s8-session-report` | `dev` | a tested session-report helper and fixtures | see the log |
| M3 | M3 | n/a | n/a | live sittings with the maintainer (prepared, not started) | gated |
| S9 | M4 | `-s9-remove-experimental` | `dev` | remove `experimental` (draft, waits for M3) | draft, gated |
| S10 | M4 | `-s10-plan-033` | `dev` | update parked Plan 033 | see the log |

**Stacking.** S2 to S6 each delete the allowlist marker of the skills they rewrite, which exists only after S1. They are therefore stacked one deep on S1's branch (`base` = the S1 branch). When S1 is merged and its branch deleted, GitHub retargets them to `dev`; if the branch is kept, retarget with `gh pr edit --base dev`. Nothing is stacked deeper. S2 to S6 touch different skill folders, and each deletes only its own marker files, so they merge in any order without a conflict. S7, S8, S9 and S10 are independent from `dev`.

## Decisions taken while the maintainer was away

Each is the conservative default and is reversible; the recommended default is the one taken unless the line says otherwise.

| # | Question | Taken | Why | Reverse by |
|---|---|---|---|---|
| D1 | How does the ratchet stay free of merge conflicts between parallel rewrite pull requests? | A frozen boilerplate corpus (`tests/fixtures/skill-boilerplate-corpus.txt`, lines that appeared in three or more skills at audit time) plus **one empty marker file per allowlisted skill** in `tests/fixtures/templated-skills/`. A rewrite deletes its own marker; two rewrites never touch the same line. The corpus is frozen so one skill's rewrite cannot change another's score. | A single allowlist file conflicts on adjacent lines; a live catalog frequency makes the score of an untouched skill move. | Replace the directory with one file. |
| D2 | Which skills are rewritten first? | Those a native role loads, then by share of generated lines, then by how directly the skill shapes a deliverable (growth, copy and SEO before design). All 29 skills the maintainer listed are in S2 to S6; the order inside a slice is in the audit. | A skill nobody loads is dead weight; rewrite effort belongs where a teammate reads it. | Reorder the audit table. |
| D3 | Drop or merge skills? | **The audit records verdicts; no skill is dropped from a bundle and none is merged in this plan.** Candidates go to the maintainer under "What I must decide". | Removing a skill changes counts in README, PROJECT.md and four bundles, and is a catalog decision. | n/a |
| D4 | The skills no role loads: wire or leave? | Wire where a role plainly owns the topic (`ui-component-spec` to Deniz, `brand-identity`, `banner-design` and `ux-writing` to Jamileh; `ux-writing` also to Kaan), each with a test. The five workflow skills are rewritten as playbooks the lead loads (S6). | The intake procedure (step 7): a skill nobody's prompt points to is dead weight. | Remove the table row and its test. |
| D5 | Third-party skills with `not-found` provenance: rewrite, replace, or keep? | Run the read-only `hostlib:candidates` scan on the named upstream repositories, record the result, and **keep** the skill with its declared licence unless the scan shows it is a copy of something with a different licence. Do not rewrite a third-party skill in this plan. | The intake rules: no fabricated source, no silent relicensing. | Re-scan. |
| D6 | New skill from the reference repositories? | One new skill, `agency-brief-and-premises` (S6), written in our own words from the ideas in superpowers' `brainstorming` and gstack's `office-hours` (classify the path, a hard gate before work, premises stated and confirmed, two or three alternatives with a recommendation). No text is copied, so no vendored file arrives; the credits in README name both upstreams as inspiration. | Own words need no licence file; both are MIT, so credit is still due. | Delete the skill and its table row. |
| D7 | Metadata of a rewritten skill | `author: agents-united` kept; `version` goes to `3.0.0`; `icon` kept; `disable-slash-command: true` kept except for the new lead skill; no `metadata.source` (original work). | Version marks the rewrite; nothing pins `2.0.0` except the boilerplate's own checklist. | Edit the front matter. |
| D8 | Is the live-test kit allowed to run anything? | No. S7 and S8 write documents, a helper and fixtures. No `claude` process, no MCP install. | The maintainer's rule: no spending, no real host session while away. | n/a |

## Open questions (recommended default in each, none blocks the work)

1. **Threshold of the ratchet** (share of a skill's body lines found in the frozen corpus). Recommended and taken: 0.30 (skills under it: the third-party skills and any hand-written one; over it: 21 generated skills at audit time, listed in the audit). Say if a stricter value is wanted after reading the table.
2. **Should the ratchet cover the other bundles?** Taken: it covers the whole catalog (a template is a template anywhere), the allowlist holds the templated skills of other bundles too, and those are not rewritten here.
3. **`agency-brief-and-premises` name and home.** Taken: lives in the `digital-agency` bundle only, loaded by the lead; promote to the `agent-factory` bundle later if Plan 033 wants it.
4. **Peer-exchange probe design (H3)**. Recommended: two teammates must agree a JSON field list between a copywriter's tracking script and a QA role's test, with the lead briefs deliberately silent on it. Alternatives are in the protocol.

## Live-test kit (M3, prepared by S7 and S8, not run)

`docs/live-test-protocol.md` (S7) gives scenarios H1 to H7 with the exact prompt, the scratch install, what a pass and a fail look like in the host records, a cost estimate with a ceiling proposal, and the order (cheapest first). `scripts/session-report.ts` (S8) reads a Claude session's records and prints the morning reading in one command. The seven items:

| # | Not established | Scenario |
|---|---|---|
| H1 | The three ADR 0039 decision 7 fixes in a live team (owner set on a running teammate lifts a read-only consultation; a structured `shutdown_request`; shell-less roles re-read their files) | one team session |
| H2 | `agents start` live, with the lead on its pinned Opus | launcher run |
| H3 | A peer exchange in the nine-role team with no contract fixed in the briefs | forced exchange |
| H4 | The host refusing a blocked task started early | early-start probe |
| H5 | The settings-level guard in a team with a command it names (`echo git push --force`, a write of `.env.test`; `docs/guard-testing.md`) | guard probe |
| H6 | The MCP-backed modes (Operational, with real servers) | QA run with Playwright against a local static page; servers confirmed by the maintainer before any install |
| H7 | The lead on Opus | combined with H2 |

## M3: live hardening (prepared, not started)

When the maintainer is back, they approve a spending ceiling per sitting. The executor then reads the records with the S8 helper, fixes every defect **test first, one pull request per defect cluster**, records the observations in `host-library/claude/observations/`, and appends a dated entry to this plan. The starting prompt for M3 is the last section of the morning report of the session that wrote this plan.

## M4: close-out (prepared as drafts, gated)

- **S9** removes `experimental` from `digital-agency` (bundle `status`, `category` text, README and docs) as a **draft** pull request that says it waits for M3.
- **S10** updates parked Plan 033 with the findings; the plan stays parked.

## Verification

Each slice runs `npm run typecheck && npm test` alone before it is pushed (never two suites at once). The slice pull request says what was verified and what was not. Unverified until M3: everything that needs a live host session.

## Ledger

Spending of this session: **0 USD, 0 model prompts** (no real host session, no headless run). Plan-limit reads: see the morning report.

## Log

- 2026-10-04: plan written; milestones M1 to M4 created.
