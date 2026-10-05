# Plan 035: Claude Digital-Agency Hardening

> **Executor instructions**: the maintainer set this plan in chat on 2026-10-04 and went away until the morning. Everything marked "Decisions taken while the maintainer was away" was decided by the executing session on the conservative default and is reversible. Test first, one reviewed pull request per slice, each from a fresh `origin/dev`, no merge by the executor. The single writer of this file is the plan pull request: slice pull requests do not edit it, so they do not conflict on it.

## Status

- **State**: **M1 and M2 delivered as pull requests (2026-10-04 night)**, all gates green; M3 (live hardening) prepared and **gated on the maintainer**; M4 prepared (S9 as a draft, S10 open) and **gated on M3**. The executor merged nothing: the maintainer merged #128 and #129 during the night; #130 to #134 were then retargeted to `dev`.
- **Priority**: P1 · **Effort**: L · **Risk**: Medium (rewrites 29 skills and adds 1 that the native roles load; no code path changes except the ratchet test and the report helper).
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
| Plan | (none) | (this branch) | `dev` | Plan 035, the README row, the milestones | **#128 merged**; this status update is its own pull request |
| S1 | M1 | `-s1-audit` | `dev` | Audit of the 53 skills, ADR 0040 (rewrite policy), the ratchet test with a shrinking per-skill allowlist | **#129 merged** (122 files, 2957 passed at the last push) |
| S2 | M1 | `-s2-growth` | S1 | growth-experiment-design, ab-test-setup, conversion-funnel-optimization, signup-flow-cro, onboarding-cro, viral-referral-loops | #130, base retargeted to `dev` (124 files, 2970 passed) |
| S3 | M1 | `-s3-content` | S1 | copywriting-frameworks, content-calendar-strategy, email-marketing-automation, email-drip-sequences, social-media-campaign, product-launch-playbook, ad-creative-design | #131, base retargeted to `dev` (124 files, 2972 passed) |
| S4 | M1 | `-s4-design-qa` | S1 | design-system-tokens, ui-component-spec, responsive-design-audit, accessibility-audit, design-handoff-spec, marketing-creative-design, the no-provenance design skills | #132, base retargeted to `dev` (124 files, 2976 passed) |
| S5 | M1 | `-s5-seo` | S1 | seo-audit, technical-seo-audit, programmatic-seo, schema-markup-strategy | #133, base retargeted to `dev` (124 files, 2966 passed) |
| S6 | M1 | `-s6-orchestration` | S1 | the five workflow-agency-* skills, mcp-setup, a brief-and-premises planning skill wired into the lead | #134, base retargeted to `dev` (124 files, 2969 passed) |
| S7 | M2 | `-s7-live-protocol` | `dev` | `docs/live-test-protocol.md`: scenarios H1 to H7 | #136, **stacked on #135** because the protocol cites the helper (123 files, 2983 passed) |
| S8 | M2 | `-s8-session-report` | `dev` | a tested session-report helper and fixtures | #135 (122 files, 2962 passed) |
| M3 | M3 | n/a | n/a | live sittings with the maintainer (prepared, not started) | gated |
| S9 | M4 | `-s9-remove-experimental` | `dev` | remove `experimental` (draft, waits for M3) | **#137 draft**, gated (124 files, 2961 passed) |
| S10 | M4 | `-s10-plan-033` | `dev` | update parked Plan 033 | #138 (124 files, 2964 passed) |

**Stacking.** S2 to S6 each delete the allowlist marker of the skills they rewrite, which exists only after S1, so they were opened one deep on S1's branch. The maintainer merged S1 (#129) during the night with its branch kept, so the executor retargeted #130 to #134 to `dev` (`gh pr edit --base dev`); each is mergeable. S7 (#136) is stacked one deep on S8 (#135): merge #135 first. Nothing is stacked deeper. S2 to S6 touch different skill folders, and each deletes only its own marker files, so they merge in any order without a conflict. S7, S8, S9 and S10 are independent from `dev`.

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
| D7 (amended at the S2 gate) | Metadata of a rewritten skill | `author: agents-united` kept; `version` goes to `3.0.0`; `icon` kept; `disable-slash-command: true` kept except for the new lead skill; no `metadata.source` (original work). | Version marks the rewrite. **The first text of this row said nothing pins `2.0.0`: wrong.** `tests/m1-challenger-stress.test.ts` pinned `2.0.0` and 150 lines, and `tests/skills-cli-command.test.ts` pinned exactly 91 doctor runbooks; both were amended in S1 (D9). | Edit the front matter. |
| D8 | Is the live-test kit allowed to run anything? | No. S7 and S8 write documents, a helper and fixtures. No `claude` process, no MCP install. | The maintainer's rule: no spending, no real host session while away. | n/a |
| D9 | Ratchet specifics | Thresholds 0.30 (templated) and 30 content lines (stub); `workflow-*` skills are exempt from the stub rule (phase scripts, ADR 0016); the two legacy suites above are amended so a 3.0.0 skill passes (the 2.0.0 and 150-line rules stay for skills not yet rewritten). | Found by running the gate, not by reading. | Restore the lines of the two suites (every rewrite then fails them). |
| D10 | Which skills are not rewritten | The six generated skills shared with engineering (`frontend-component-design`, `performance-optimization`, `security-audit`, `subagent-driven-development`, `technical-documentation`, `test-driven-development`) and the 39 other failing skills of the catalog stay on the allowlist. `mcp-setup` is kept unchanged (a substantive runbook; H6 says whether it needs work). | Out of the maintainer's list, shared with other bundles, and the ratchet carries them; budget. | Rewrite them in a follow-up plan. |
| D11 | Provenance of the six `not-found` skills (S4) | The read-only scan was run and committed; **no `metadata.source`, licence or name was changed.** Three are independent writings (2 to 11 percent overlap), three stay unresolved. | A licence declaration needs the maintainer (ADR 0024). | Apply option (b) of `docs/skill-quality/design-provenance.md`. |
| D12 | Status after `experimental` (S9) | **No status** (like the 30 bundles that are usable and still being hardened); the CLI heading reads "Organization Bundles (Cross-Functional)". Draft until M3. | Claims no more than "usable"; `stable` is a separate decision. | One line in `bundles.json` and two test expectations. |
| D13 | Where the session-report helper lives (S8) | `scripts/hostlib/session-report.ts`, a `session` subcommand of the hostlib CLI, `npm run hostlib:session`. | Already typechecked and run under Node type stripping; avoids a second edit of the `typecheck` line that S1 also edits. | Move to its own folder. |
| D14 | H3 and H6 designs (S7) | H3 uses a plain `claude` session as the lead (the digital-agency lead's own rule is contract first, so it would fix the interface itself). H6 states honestly that four no-secret servers give **Limited Operational**, not Fully Operational. | A forced peer exchange needs a lead that does not fix the contract; Operational needs credentials the executor must not handle. | Edit `docs/live-test-protocol.md`. |
| D15 | The brief-and-premises skill's slash command | `disable-slash-command` is **not** set on `agency-brief-and-premises` (D7), and the lead loads it by name before `/grill-me`; a test pins the order. | The skill must load either by the `Skill` tool or by a slash command until H1 shows which the lead uses. | Add the key. |
| D16 | Skill layout (after the maintainer's question of 2026-10-05) | Skills follow the Claude Code skills guidance: a short `SKILL.md` (at most 90 lines and 6,000 characters), `examples/` and `references/` loaded on demand, `scripts/` only for roles that have a shell, `evals/evals.json`; pilot on `ab-test-setup` (#140). | The live page: a loaded skill stays in context every turn and only its first 5,000 tokens survive compaction; detail in supporting files is free until read. I had not read the page, nor our own guide, before writing the first version: that was a process miss. | Revert the converted skills to the #130 to #134 text. |
| D17 | `when_to_use` | Not used: trigger phrases and the skip clause go in the `description` (1,024 characters). | The Claude projector needs a ledger disposition per key, and the Antigravity suite records only name, description, metadata, license and disable-slash-command as harmless; an unrecorded key on a host is unverified. | Record it for every host in the guides, then allow it in `tests/helpers/skill-layout.ts`. |
| D18 | `evals/` in installs | Recommended default: exclude `evals/` from the installs of all three hosts (test first); asked of the maintainer in the restructure prompt. | They are maintainer files; the installer copies every subfolder today. | Leave them in. |
| D19 | H8 | A new live scenario compares each converted skill with and without it from its evals; it decides what is revised or dropped. | Nothing else can say a skill is good. | Remove H8 from the protocol. |

## Open questions (recommended default in each, none blocks the work)

1. **Threshold of the ratchet** (share of a skill's body lines found in the frozen corpus). Recommended and taken: 0.30 (skills under it: the third-party skills and any hand-written one; over it: 21 generated skills and 2 stubs of the bundle at audit time, 62 skills in the whole catalog, listed in the audit). Say if a stricter value is wanted after reading the table.
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

### Starting prompt for M3 (first version, superseded by Prompt B below)

```text
Follow @docs/session-start.md. Plan 035 M3, live hardening of the Claude digital-agency pilot. Read plans/035-claude-digital-agency-hardening.md, docs/live-test-protocol.md, `gh pr list --state all` (what merged overnight) and the morning report. I approve sitting <A | B | C | D> with a ceiling of <USD and prompts>; state the account, the cost and the plan headroom (get_usage) first. Prepare the scratch install named by the scenario with the CLI built from `dev`, give me the exact start command and prompt, and wait: I type, you read the records with `npm run hostlib:session` (never my model's answer). After each scenario: write the observation under host-library/claude/observations/, fix every defect test first in its own pull request (one per defect cluster) to `dev`, never `main`, no merge, run the full suite alone before every push, keep a ledger. Stop at the ceiling. For H6 I confirm the four MCP servers and the browser download before any install.
```

## Prompts for the maintainer (2026-10-05)

### Prompt A: restructure the open skill pull requests before merge

```text
Follow @docs/session-start.md. Plan 035, the skill restructure (maintainer decisions of 2026-10-05: restructure the open skill pull requests before merge; pilot first; ceilings doubled). I merged nothing yet. No spending, no real host session, no `claude -p`, no merge, never `main`, never force-push, never rebase (merge origin/dev when it moves), no AskUserQuestion except for the items marked ASK.

GROUND (say what you read): the live skills page https://code.claude.com/docs/en/skills.md (read it in full), host-library/claude/guide/skill.md, https://agentskills.io/skill-creation/evaluating-skills, plans/035-claude-digital-agency-hardening.md, docs/adr/0040, pull request #140 (the pilot: registry/skills/ab-test-setup/, tests/helpers/skill-layout.ts, tests/helpers/skill-contract.ts, tests/skill-layout.test.ts) and `gh pr list --state all`.

GOAL: convert the 29 rewritten skills and `agency-brief-and-premises` (pull requests #130 S2, #131 S3, #132 S4, #133 S5, #134 S6; `ab-test-setup` is the pilot) to the layout of the pilot, on each pull request's own branch, so I review each skill once. First merge the pilot branch (feat/claude-digital-agency-hardening-skill-layout-pilot) into the S2 branch (a merge, not a rebase) and close #140 with a note.

THE LAYOUT, per skill:
- `SKILL.md` at most 90 lines and 6,000 characters: the description leads with "Use when ..." and lists trigger phrases and when to skip (at most 1,024 characters; no `when_to_use`, it is not recorded for Antigravity); the seven mandatory section headings stay but short; decision rules each with its reason; anti-patterns with reasons; the most important text first (after compaction only the first 5,000 tokens of a skill survive); pointers to supporting files saying what each holds and when to load it; no `!` command injection.
- `examples/`: worked examples and templates (the invented numbers stay labelled as invented). `references/`: long checklists, tables, formulas, platform specs. `scripts/`: only where a script replaces hand arithmetic AND the role that loads the skill has a shell (Selin, Emre, Deniz, Defne have one; Ava, Kaan, Yavuz, Jale, Jamileh do not): Node `.mjs`, run with `${CLAUDE_SKILL_DIR}/scripts/...`, tested against the worked examples; for shell-less roles a precomputed table in `references/` instead. `evals/evals.json`: 2 to 3 realistic, differently worded prompts with `expected_output` (assertions come after a first run).
- Keep the substance: shrink SKILL.md by moving, not by deleting. Nothing is rewritten for its own sake.

TEST FIRST, per skill: add it to `LAID_OUT` in tests/skill-layout.test.ts (red), convert, green. Update the per-slice tests (tests/skill-rewrite-s2..s6-*.test.ts) to read SKILL.md together with `supportingText()` for the substance they assert. Hazards already found: tests/m1-challenger-stress.test.ts demands at least 60 lines and a language-tagged code fence in SKILL.md for onboarding-cro, viral-referral-loops, marketing-creative-design, programmatic-seo, schema-markup-strategy and email-drip-sequences (amend it for laid-out skills with a stated reason, or keep a small tagged fence); the six `workflow-agency-*` playbooks keep their Mermaid flowchart, `| Phase` gate rows and rollback paragraph in SKILL.md (tests/e2e-workflows-gates, gate-command-portability: the catalog needs more than 190 gate rows); `disable-slash-command: true` stays; the Claude projector requires a ledger disposition for every frontmatter key; the doctor and install suites copy every subfolder.

ASK me (one question each, with your recommendation): (1) exclude `evals/` from the installs of all three hosts? Default recommended: yes, test first, a small change in each lane; if a lane cannot be changed safely, record that and leave it. (2) which scripts, if any, beyond the pilot's; default: only a health-score and redirect-chain helper for seo-audit and technical-seo-audit (Selin) and a contrast-ratio helper for design-system-tokens and accessibility-audit (run by Emre, Deniz), each tested, nothing else.

PER PULL REQUEST: run `npm run typecheck && npm test` alone before every push; update the PR description with a table of lines and characters before and after per skill, the verified list and the not-verified list (no live effect; the evals have not been run); keep stacking as it is now (all five target `dev`); record each decision as a row D16 and up in plan 035 (via the plan-status pull request #139, the plan's single writer). Say what was verified and what was not.

END with: the table of before and after per skill, what you decided and why, and the starting prompt for the next step (the skill baseline sitting H8 and the live sittings, the follow-up prompt in plans/035-claude-digital-agency-hardening.md).
```

### Prompt B: after the skills are converted, H8 and the live sittings

```text
Follow @docs/session-start.md. Plan 035 M3, live hardening of the Claude digital-agency pilot, including H8 (the skills against no skill). Read plans/035-claude-digital-agency-hardening.md, docs/live-test-protocol.md, `gh pr list --state all` (what merged) and the last report. I type in the interactive TUI; you prepare, give me the exact commands and prompts, and read the host's records with `npm run hostlib:session` (never the model's own answer). The ceilings and prompt limits are the doubled ones in the protocol: Sitting A (H5, H4, H3) 12.0 USD and 12 prompts, B (H6) 8.0 USD and 4, C (H1) 9.0 USD and 4, D (H8) 12.0 USD and 24, E (H2 and H7, the Opus lead) 14.0 USD and 4; 55.0 USD in all. Never use --dangerously-skip-permissions; no secrets in any file or message; do not change my settings except the scratch project's `skillOverrides` in H8, which I edit myself.

ORDER I approve now: Sitting A, then D, then C, then B, then E; one sitting at a time, and I say "go" for each. Before each: state the account (Claude Pro, extra usage off), the rough cost, the plan headroom from get_usage and the ceiling; build the CLI from `dev` (`npm run build`); make the fresh scratch install in D:\AI\scratch-pilot\<scenario-dir>; run `agents doctor --host claude` and the free checks (`agents start ... --dry-run` for E). For H6 I confirm the four MCP servers and the Playwright browser download before any install. Keep a ledger (prompts and notional USD from each session's own cost-state); stop at the ceiling or at a scenario failing its gate twice.

H8 (the skills): for each laid-out skill, take its `evals/evals.json`, start a fresh session per prompt as the role that loads the skill, once with the skill and once with `"off"` in the scratch project's skillOverrides, prompts typed verbatim. Grade each answer against the expected output as assertions with quoted evidence (a PASS needs concrete evidence), write grading.json and benchmark.json per iteration, compare pass rate, tokens and time, remove assertions that pass in both runs, and show me the outputs for my feedback. A skill that does not beat no skill is revised (leaner, the reason for each rule, a missing script or table) or dropped, test first, one pull request per skill cluster; a skill that is never loaded in the with-skill run gets its description's trigger phrases tuned and is re-run. Do not add rules until the pass rate rises.

AFTER EACH SCENARIO: write the observation under host-library/claude/observations/ (what was seen, what was not, the ledger line), fix every defect test first in its own pull request to `dev` (one per defect cluster), never `main`, no merge, run the full suite alone before every push, and append a dated entry to plans/035-claude-digital-agency-hardening.md through the plan's status pull request.

WHEN M3 IS DONE: report which of H1 to H8 passed, what each defect cluster changed, and the ledger; then tell me whether the draft #137 (remove `experimental`) can leave draft, with the evidence, and keep Plan 033 parked. End with the starting prompt for the next step.
```

## M4: close-out (prepared as drafts, gated)

- **S9** removes `experimental` from `digital-agency` (bundle `status`, `category` text, README and docs) as a **draft** pull request that says it waits for M3.
- **S10** updates parked Plan 033 with the findings; the plan stays parked.

## What the maintainer must decide

1. **Merge order.** #135 before #136; #130 to #134, #138 and this status update in any order (different files); #137 stays draft until M3. Everything is mergeable and CI runs on each.
2. **Live sittings.** Approve a ceiling per sitting. **Doubled by the maintainer on 2026-10-05 (ceilings and prompt limits): A 12.0 USD and 12 prompts, B 8.0 and 4, C 9.0 and 4, D 12.0 and 24 (the new H8, skills against no skill), E 14.0 and 4; 55.0 USD in all.** The maintainer tests interactively. Estimates; the Opus cost is not measured. Order and for H6 confirm the four MCP servers and the Playwright browser download.
3. **S9.** No status (taken) or `stable` after `experimental`.
4. **Provenance metadata** of the six `not-found` design skills: leave, or option (b) of `docs/skill-quality/design-provenance.md` (recommended: drop `metadata.source` from the three independent writings; needs your licence decision).
5. **Role fit and drops.** Drop `subagent-driven-development` from the agency bundle? Keep `domain-modeling` (Yavuz, Defne) and `property-based-testing` and `mutation-testing` (Emre) in the agency roles' tables?
6. **The generated skills shared with engineering and the 39 other failing skills**: a follow-up plan, or the first job of the `agent-factory` bundle (Plan 033 records it).
7. The `mcp.md` hold of #126 was left alone, as asked.

## Verification

Each slice runs `npm run typecheck && npm test` alone before it is pushed (never two suites at once). The slice pull request says what was verified and what was not. Unverified until M3: everything that needs a live host session.

## Ledger

Spending of this session: **0 USD, 0 model prompts of the project's own** (no real host session, no headless run, no `claude -p`). The authoring session itself ran on the maintainer's plan and used quota: plan limits read free with `get_usage` were **5-hour window 67% and weekly 73% before any work (2026-10-04, evening), weekly 79% at the last read** (the 5-hour window had reset once in between). Ledger of real-session prompts for the program stays at 15 prompts and 7.04 USD recorded (Plan 032 follow-ups).

## Log

- 2026-10-04: plan written; milestones M1 to M4 created.
- 2026-10-04 night: S1 to S10 opened as pull requests (#129 to #138) with the gates green; the maintainer merged #128 and #129 meanwhile; #130 to #134 retargeted to `dev`. Findings worth reading first: 15 skills were one template (the maintainer listed 14), the five workflow playbooks (six with `full-campaign`) were loaded by no native role, 62 of 188 catalog skills fail the ratchet, and the session-report helper shows that on Claude Code 2.1.289 the host **accepted** a blocked task started early (S8, the last full-roster run).
- Corrections to this plan's own first text: D7 (above); the statement that 29 skills are rewritten is right (6 + 7 + 6 + 4 + 6) and one new skill was added; the "21 generated skills" are in the bundle, 62 failures are catalog-wide.
- 2026-10-05: the maintainer asked whether the skills would be rewritten after the tests and to follow the Claude Code skills guidance. Read in full: code.claude.com/docs/en/skills.md (except one long script example) and agentskills.io evaluating-skills. Pilot on `ab-test-setup` as draft #140 (stacked on #130); the live protocol (#136) now has doubled ceilings and H8; prompts A and B above.
