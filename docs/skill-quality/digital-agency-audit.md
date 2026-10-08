# Skill audit: the 53 skills of the `digital-agency` bundle

Plan 035, slice S1. Written 2026-10-04. The measure is `scripts/skill-quality/measure.ts` (`npm run skills:quality -- --bundle digital-agency` prints the same numbers); the policy is ADR 0040; the gate is `tests/skill-quality-ratchet.test.ts`.

## How the measure works

A skill's body is reduced to its content lines (no headings, fences, code blocks, table rules, or lines under three words). Each line is lower-cased and stripped of punctuation, and the skill's own name is replaced by `@` in its kebab, spaced and joined forms, so "The Ab Test Setup skill provides..." and "The Signup Flow Cro skill provides..." become the same line. The **templated share** is the fraction of those lines found in a **frozen corpus**: the 93 normalised lines that three or more skills of the catalog carried when the audit ran (`tests/fixtures/skill-boilerplate-corpus.txt`). A skill at **0.30 or more** is templated. A hand-written in-house skill under 30 content lines with no `references/` or `scripts/` is a **stub**. Short `workflow-*` skills are phase scripts by design (ADR 0016) and are exempt from the stub rule, not from the templated one.

The numbers below are body content lines, not file lines: the 150-line boilerplate skills have 58 content lines because the other 92 are headings, code fences, table rules and the placeholder code block.

## What the audit found

1. **15 of the 53 skills are one template.** `ab-test-setup`, `accessibility-audit`, `content-calendar-strategy`, `conversion-funnel-optimization`, `copywriting-frameworks`, `design-handoff-spec` (not on the maintainer's list of 14), `design-system-tokens`, `email-marketing-automation`, `growth-experiment-design`, `product-launch-playbook`, `responsive-design-audit`, `seo-audit`, `signup-flow-cro`, `social-media-campaign`, `ui-component-spec`. Share 1.00 (0.98 for `design-system-tokens`). The same five phases ("Inspect workspace repository to locate relevant UI components", `npm run typecheck && npm test`, `git commit -m "feat(<skill>): implement ... playbook artifacts"`), the same four-row input table (`target_scope`, `config`, `output_dir`, `strict_mode`) and a placeholder `run<Name>` function as the "exemplar". A growth strategist told to run `npm run typecheck` for an A/B test gets nothing it can use.
2. **Six more are partly generated** by `scripts/generate-skills.cjs` (share 0.53 to 0.57): `frontend-component-design`, `performance-optimization`, `security-audit`, `subagent-driven-development`, `technical-documentation`, `test-driven-development`. They are shared with the engineering bundles, so they are not in this plan's slices (see "After S6").
3. **Two 27-line stubs**: `technical-seo-audit` and `ad-creative-design` (8 content lines each, no references).
4. **The catalog has the same debt elsewhere.** The ratchet found 62 failing skills in all: 48 templated (28 at share 1.00: the product-design family, the CRO and growth skills, the design-ops skills) and 14 stubs (`chaos-engineering`, `ci-cd-pipeline-automation`, `google-ads-optimization`, `meta-ad-creative-testing`, the GPU, vector-database and telemetry skills, and the two above). They are on the allowlist as known debt and are not rewritten by this plan.
5. **The five `workflow-agency-*` skills are not loaded by any native role.** Their gates (`npx agents-united doctor`, `npm run test --if-present`, `npm run build --if-present`) are those of a code repository, they refer to "spawnable `subagent_*` tools declared in the Team Manifest" (the legacy lane), and the native lead's body names `grill-me`, `grill-with-docs`, `mcp-setup` and `handoff` only. Under Agent Teams nobody reads them. (The sixth, `workflow-agency-full-campaign`, is the same.)
6. **Five skills no native role loads**: `ui-component-spec`, `banner-design`, `brand-identity`, `ux-writing`, `subagent-driven-development`. The intake rule (step 7) calls a skill nobody points to dead weight.
7. **Skills whose provenance record is `not-found`**: `banner-design`, `brand-identity`, `ux-writing`, `stitch-design-taste`, `generative-ui`, `modern-web-guidance`. Their `metadata.source` is a web registry (`ui-skills.com`, `labs.google/stitch`, `antigravity.google`) or a repository path that no longer holds a folder of that name. Their declared licences (MIT, Apache-2.0) are recorded; none was verified against a licence file at a pinned commit. S4 runs the read-only `hostlib:candidates` scan on the upstream repositories named in plan 028 and records the result.
8. **The six "original" skills with real content are in the wrong frame**: `onboarding-cro`, `viral-referral-loops`, `email-drip-sequences`, `programmatic-seo`, `schema-markup-strategy`, `marketing-creative-design` (shares 0.15 to 0.18). Their domain content (activation checklists, K-factor maths, sitemap chunking, JSON-LD types) is usable, but they open with "Clean git working directory", write TypeScript components, and report to `reports/<skill>/summary.json`. The verdict is **revise, not rewrite**: keep what is true, rebuild the frame for the role that loads them.
9. **Third-party skills are sound and stay.** The 11 pinned upstream skills (mattpocock/skills, ChromeDevTools, anthropics/skills, currents-dev, vercel-labs, trailofbits) and the 6 with a declared but unresolved source are not templated (share 0.00 to 0.25). Two role-fit questions go to the maintainer below.

## The table

Sorted by priority, then slice. **Priority**: P0 a skill a role loads for its main deliverable, entirely generated; P1 generated or stub, a role loads it or the lead needs it; P2 content is real but the frame is wrong; P3 keep, with a bookkeeping task; `-` keep as is. "Loaded by" is read from the `| Situation | Skill | Load when |` tables of the native role bodies in `registry/hosts/claude/agents/`.

| Skill | Loaded by | Provenance | Body lines / extra files | Templated share | Verdict | Priority | Inspiration | Slice |
|---|---|---|---|---|---|---|---|---|
| `ab-test-setup` | Ava, Kaan | in-house | 58 / 0 | 1.00 | rewrite | P0 | own statistics substance (power, sample-ratio mismatch, peeking); gstack qa for the evidence habit | S2 |
| `conversion-funnel-optimization` | Kaan | in-house | 58 / 0 | 1.00 | rewrite | P0 | ECC click-path-audit (trace every step), gstack plan-design-review (rate each dimension) | S2 |
| `growth-experiment-design` | Ava | in-house | 58 / 0 | 1.00 | rewrite | P0 | ECC growth-log (experiment record), gstack office-hours (premise challenge), ECC product-lens | S2 |
| `copywriting-frameworks` | Yavuz, Kaan | in-house | 58 / 0 | 1.00 | rewrite | P0 | ECC brand-voice, article-writing, content-engine (source first, hard bans, voice profile) | S3 |
| `product-launch-playbook` | Jale, Ava | in-house | 58 / 0 | 1.00 | rewrite | P0 | ECC marketing-campaign (positioning before copy, quality gate), gstack plan-ceo-review (scope modes) | S3 |
| `social-media-campaign` | Jale | in-house | 58 / 0 | 1.00 | rewrite | P0 | ECC social-publisher, content-engine (platform-native, one claim per post) | S3 |
| `accessibility-audit` | Emre | in-house | 58 / 0 | 1.00 | rewrite | P0 | ECC accessibility, frontend-a11y, a11y-architect agent | S4 |
| `design-handoff-spec` | Deniz | in-house | 58 / 0 | 1.00 | rewrite | P0 | gstack design-consultation and plan-design-review (what a handoff must pin down) | S4 |
| `seo-audit` | Selin, Yavuz | in-house | 58 / 0 | 1.00 | rewrite | P0 | ECC seo skill and seo-specialist agent (technical first, intent per page, implementable fixes) | S5 |
| `technical-seo-audit` | Selin | in-house | 8 / 0 | 0.00 | rewrite (27-line stub) | P0 | ECC seo (technical checklist), chrome-devtools-mcp field data | S5 |
| `signup-flow-cro` | Kaan | in-house | 58 / 0 | 1.00 | rewrite | P1 | ECC click-path-audit; own field-by-field friction audit | S2 |
| `ad-creative-design` | Jamileh | in-house | 8 / 0 | 0.00 | rewrite (27-line stub) | P1 | ECC marketing-campaign (ad variants); own platform specs | S3 |
| `content-calendar-strategy` | Yavuz | in-house | 58 / 0 | 1.00 | rewrite | P1 | ECC content-engine, marketing-campaign (arc and dependencies) | S3 |
| `email-marketing-automation` | Jale | in-house | 58 / 0 | 1.00 | rewrite | P1 | ECC marketing-campaign (email arc); own deliverability substance | S3 |
| `design-system-tokens` | Jamileh | in-house | 58 / 0 | 0.98 | rewrite | P1 | ECC design-system, gstack design-consultation (system before screens) | S4 |
| `responsive-design-audit` | Emre | in-house | 58 / 0 | 1.00 | rewrite | P1 | gstack design-review (live viewport pass), ECC browser-qa | S4 |
| `ui-component-spec` | none today | in-house | 58 / 0 | 1.00 | rewrite and wire to Deniz | P1 | gstack design-review, ECC frontend-design-direction | S4 |
| `workflow-agency-ad-creative-sprint` | none today (the lead names no workflow skill) | in-house | 20 / 0 | 0.25 | rewrite as a lead playbook | P1 | as above | S6 |
| `workflow-agency-brand-design-system` | none today (the lead names no workflow skill) | in-house | 20 / 0 | 0.25 | rewrite as a lead playbook | P1 | as above | S6 |
| `workflow-agency-client-pitch-proposal` | none today (the lead names no workflow skill) | in-house | 20 / 0 | 0.25 | rewrite as a lead playbook | P1 | as above | S6 |
| `workflow-agency-cro-funnel-teardown` | none today (the lead names no workflow skill) | in-house | 20 / 0 | 0.25 | rewrite as a lead playbook | P1 | as above | S6 |
| `workflow-agency-full-campaign` | none today (the lead names no workflow skill) | in-house | 24 / 0 | 0.21 | rewrite as a lead playbook | P1 | superpowers dispatching-parallel-agents and writing-plans; ECC marketing-campaign | S6 |
| `workflow-agency-seo-content-engine` | none today (the lead names no workflow skill) | in-house | 20 / 0 | 0.25 | rewrite as a lead playbook | P1 | as above | S6 |
| `frontend-component-design` | Deniz | in-house | 60 / 0 | 0.57 | rewrite later (generated, shared with engineering) | P1 | n/a | after S6, if budget |
| `performance-optimization` | Deniz | in-house | 60 / 0 | 0.57 | rewrite later (generated, shared with engineering) | P1 | n/a | after S6, if budget |
| `security-audit` | Defne | in-house | 60 / 0 | 0.57 | rewrite later (generated, shared with engineering) | P1 | n/a | after S6, if budget |
| `test-driven-development` | Emre | in-house | 60 / 0 | 0.57 | rewrite later (generated, shared with engineering) | P1 | superpowers test-driven-development | after S6, if budget |
| `onboarding-cro` | Kaan | in-house | 61 / 0 | 0.18 | revise (keep the domain content, rebuild the frame) | P2 | gstack plan-design-review | S2 |
| `viral-referral-loops` | Ava | in-house | 67 / 0 | 0.16 | revise (keep the loop maths, rebuild the frame) | P2 | ECC growth-log | S2 |
| `email-drip-sequences` | Jale | in-house | 61 / 0 | 0.18 | revise | P2 | ECC marketing-campaign (email arc) | S3 |
| `marketing-creative-design` | Jamileh | in-house | 69 / 0 | 0.16 | revise | P2 | ECC frontend-design-direction | S4 |
| `programmatic-seo` | Selin | in-house | 66 / 0 | 0.15 | revise | P2 | ECC seo (keyword mapping, cannibalisation) | S5 |
| `schema-markup-strategy` | Selin | in-house | 63 / 0 | 0.17 | revise | P2 | ECC seo (structured data rules) | S5 |
| `technical-documentation` | Defne | in-house | 64 / 0 | 0.53 | rewrite later (generated, shared with engineering) | P2 | n/a | after S6, if budget |
| `banner-design` | none today | **not-found** (declared MIT) | 97 / 1 | 0.02 | keep; wire to Jamileh; settle provenance (S4 scan) | P3 | n/a (third-party) | S4 |
| `brand-identity` | none today | **not-found** (declared MIT) | 104 / 15 | 0.02 | keep; wire to Jamileh; settle provenance (S4 scan) | P3 | ECC brand-voice and brand-discovery for the voice half | S4 |
| `generative-ui` | Jamileh | **not-found** (declared Apache-2.0) | 61 / 0 | 0.00 | keep; provenance unresolved (record) | P3 | n/a | S4 |
| `modern-web-guidance` | Deniz | **not-found** (declared Apache-2.0, ChromeDevTools/chrome-devtools-mcp@e4168d0) | 31 / 0 | 0.00 | keep; provenance unresolved (record) | P3 | n/a | S4 |
| `stitch-design-taste` | Jamileh | **not-found** (declared MIT) | 93 / 1 | 0.00 | keep; settle provenance (S4 scan) | P3 | n/a (third-party) | S4 |
| `ux-writing` | none today | **not-found** (declared Apache-2.0) | 115 / 5 | 0.02 | keep; wire to Jamileh and Kaan; settle provenance (S4 scan) | P3 | n/a (third-party) | S4 |
| `mcp-setup` | Chris | in-house | 72 / 0 | 0.00 | keep; review for the MCP-backed modes (H6) | P3 | n/a | S6 |
| `subagent-driven-development` | none today | in-house | 60 / 0 | 0.57 | candidate to drop from this bundle (generated, no role loads it); the maintainer decides | P3 | superpowers subagent-driven-development | none |
| `a11y-debugging` | Emre | pinned ChromeDevTools/chrome-devtools-mcp@e4168d0, Apache-2.0 | 38 / 1 | 0.00 | keep | - | n/a | none |
| `debug-optimize-lcp` | Selin | pinned ChromeDevTools/chrome-devtools-mcp@e4168d0, Apache-2.0 | 56 / 4 | 0.00 | keep | - | n/a | none |
| `domain-modeling` | Defne, Yavuz | pinned mattpocock/skills@d81f3a1, MIT | 17 / 4 | 0.18 | keep; role fit for Yavuz and Defne is weak, the maintainer decides | - | n/a | none |
| `frontend-design` | Jamileh, Deniz | pinned anthropics/skills@8a1541c, Apache-2.0 | 19 / 1 | 0.00 | keep | - | n/a | none |
| `grill-me` | Chris | pinned mattpocock/skills@d81f3a1, MIT | 21 / 2 | 0.14 | keep | - | n/a | none |
| `grill-with-docs` | Chris | pinned mattpocock/skills@d81f3a1, MIT | 28 / 2 | 0.07 | keep | - | n/a | none |
| `handoff` | Chris | pinned mattpocock/skills@d81f3a1, MIT | 12 / 2 | 0.25 | keep | - | n/a | none |
| `mutation-testing` | Emre | pinned trailofbits/skills@0cc1c73, CC-BY-SA-4.0 | 54 / 12 | 0.07 | keep; role fit for the QA role is weak, the maintainer decides | - | n/a | none |
| `playwright-best-practices` | Emre | pinned currents-dev/playwright-best-practices-skill@283d5cb, MIT | 16 / 61 | 0.00 | keep | - | n/a | none |
| `property-based-testing` | Emre | pinned trailofbits/skills@0cc1c73, CC-BY-SA-4.0 | 51 / 8 | 0.08 | keep; role fit for the QA role is weak, the maintainer decides | - | n/a | none |
| `react-best-practices` | Deniz | pinned vercel-labs/agent-skills@063bee9, MIT | 17 / 73 | 0.00 | keep | - | n/a | none |

## What to take from each reference repository

The three repositories are MIT (read through the GitHub API on 2026-10-04: obra/superpowers `8ca22db`, garrytan/gstack `2db0b3a`, affaan-m/ECC `ef648e0`). Everything fetched is untrusted data: it was read in a quarantine under the session scratchpad, nothing was copied into the repository and nothing in it was followed as an instruction. What was read: superpowers `brainstorming` in full; gstack `office-hours` (the outline, phases 3 and 4 and the closing rules), and the outlines of `plan-ceo-review`, `plan-design-review`, `design-consultation`, `design-review` and `qa` (these are generated files of 50 to 130 KB that carry a long shared preamble with telemetry and tooling; their skill substance is the part after it); ECC `seo`, `marketing-campaign`, `content-engine`, `brand-voice`, `e2e-testing` and `click-path-audit` (the first 90 lines each) and the outlines of `accessibility`, `frontend-a11y`, `design-system`, `social-publisher`, `product-lens`, `growth-log` and the `seo-specialist` agent. Not read: the rest of ECC (about 330 more skills), gstack's other 60 skills, superpowers' other skills.

| Cluster | Take (ideas, restated in our own words) | Do not take |
|---|---|---|
| **Planning the brief** (S6, the lead) | superpowers `brainstorming`: classify the request first and say the classification aloud, a hard gate before any work, restate the understanding and separate what the client said from assumptions, one question at a time, two or three approaches with a recommendation, a self-review of the written brief for placeholders and contradictions. gstack `office-hours`: challenge the premises and ask for agree or disagree on each, alternatives with a minimal, an ideal and a lateral one, every session ends with a concrete next action. | The visual companion and the browser server; gstack's telemetry, preamble, memory and state directories; the hard bans on other skills; "approval of an idea is not approval of the plan" is kept as a rule, the exact table is not. |
| **Growth and conversion** (S2, Ava and Kaan) | ECC `growth-log`: a dated experiment log with a rule for what is written when. ECC `product-lens`: test the premise before the feature. ECC `click-path-audit`: trace every touchpoint step by step and check the final state matches what the label promises (it finds the step where two handlers cancel each other). gstack `plan-design-review`: rate each dimension 0 to 10 and say what a 10 looks like. | ECC's statistics (none): sample-size and sequential-testing rules are written from general knowledge and flagged as such. |
| **Content, copy and campaigns** (S3, Yavuz and Jale) | ECC `marketing-campaign`: positioning and the campaign angle before any copy, the arc of an email sequence, a quality gate (five-second test, one earned CTA, claim audit, cross-channel consistency). ECC `content-engine`, `brand-voice`, `article-writing`: start from source material, one claim per post, adapt the format not the persona, a voice profile built from real samples, a list of banned phrases. ECC `social-publisher`: per-platform shape. | ECC's `x-api` posting and credentials, anything that posts. Our roles never publish. |
| **Design, front end and QA** (S4, Jamileh, Deniz, Emre) | gstack `design-review`: a first-impression pass, extracting the design system actually in use, a page-by-page checklist, the "trunk test", cross-page consistency, modes (full, quick, diff-aware, regression). gstack `design-consultation`: a complete system (type, colour, spacing, motion) decided before screens. ECC `accessibility`, `frontend-a11y`, `a11y-architect`: WCAG 2.2 AA checks grouped by what a keyboard or screen-reader user meets. ECC `design-system`: tokens first. gstack `qa`: baseline, triage by severity, a regression test before the repair. | gstack's browser binary, `$B`, the auth detection, the fix-and-commit loop (our QA role reports, it does not push). |
| **SEO** (S5, Selin) | ECC `seo` and the `seo-specialist` agent: technical blockers before content, one primary intent per URL, a severity-sorted findings list (critical, high, medium) where every finding is page-specific and implementable, keyword mapping with cannibalisation detection. | Gimmicks; ECC's thresholds are restated only where the Core Web Vitals values are Google's published ones (LCP 2.5 s, INP 200 ms, CLS 0.1). |
| **Orchestration playbooks** (S6, Chris) | superpowers `dispatching-parallel-agents`, `writing-plans`: independent tasks in parallel, a plan with exact deliverables per task, verification before declaring done. | Anything that assumes a code repository. |

## What goes to the maintainer (not decided by this plan)

1. **Drop or keep** `subagent-driven-development` in the `digital-agency` bundle: generated, no role loads it, it is about software development.
2. **Role fit**: `domain-modeling` (loaded by Yavuz and Defne) and `property-based-testing`, `mutation-testing` (loaded by Emre) are good third-party skills for software work; an agency QA role that tests marketing pages rarely needs them. Keep, move to the `software-engineering`-side roles, or drop from the agency roles' tables.
3. **The generated skills shared with engineering** (item 2 of the findings): rewrite them in a separate plan for the engineering bundles, or rewrite only the ones Deniz, Emre and Defne use (`frontend-component-design`, `performance-optimization`, `test-driven-development`, `security-audit`, `technical-documentation`).
4. **The other 39 failing skills in the catalog** outside this bundle (product-design family, GPU and vector-database stubs): a follow-up plan, or the `agent-factory` bundle of Plan 033 as its first job.

## Added after the audit

Skills added to the bundle by Plan 035 itself. They are written to the contract of ADR 0040 from the start (no marker, version 3.0.0).

| Skill | Loaded by | Provenance | Body lines / extra files | Templated share | Verdict | Priority | Inspiration | Slice |
|---|---|---|---|---|---|---|---|---|
| `agency-brief-and-premises` | Chris | in-house, original (ideas credited in README) | new | n/a | new skill, own words | P0 | superpowers `brainstorming`, gstack `office-hours` | S6 |
| `design-artifact-publishing` | Jamileh | in-house, original | new | n/a | new skill, own words | P1 | the P3 observation of Plan 036 and the Design System type's own references | 036 S11 |
| `color-theory` | Jamileh, Deniz | in-house, original (idea credited in README) | new | n/a | new skill, own words | P1 | Owl-Listener `color-system` (layers, roles before hues, every pair tested); the catalog's own contrast references and `accessibility-audit` script are reused, not copied | 036 S15 |
| `image-creation` | Jamileh | in-house, original | new | n/a | new skill, own words | P1 | Google's Gemini image generation guide (prompt practice, sizes, SynthID), the `mcp-image` 0.14.0 source read for the pin (parameters, return shape, file handling), and the Sitting K and H10c lessons (an honest placeholder; no photograph faked in SVG) | 036 S18 |
