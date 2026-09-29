---
name: ux-writing
description: Reviews, rewrites, generates, harmonizes, and implements
  user-centered interface copy across design files, screenshots, product
  specs, source code, localization catalogs, prototypes, and rendered
  applications — buttons, navigation, forms, errors, empty states,
  onboarding, confirmations, settings, consent, and system feedback —
  while preserving product behavior, terminology, voice, accessibility,
  localization, and legal meaning. Renamed from the upstream
  "balise-ux-writing" for a shorter, dialect-portable skill name.
metadata:
  author: mrstev3n (github.com/mrstev3n)
  version: 1.0.0
  source: https://www.ui-skills.com/skills/mrstev3n/balise-ux-writing
  license: Apache-2.0
  icon: ✍️
disable-slash-command: true
---

# UX Writing — Interface Copy Review, Rewrite & Implementation

## Overview & Purpose
`ux-writing` (upstream name `balise-ux-writing`, renamed 2026-09-27 to drop the vendor-specific
prefix) treats interface copy as part of a user task, product system, and implementation — never as
isolated prose. It improves comprehension, action, recovery, trust, consistency, and fit without
inventing product behavior or changing facts, across five modes: **Review**, **Rewrite**,
**Generate**, **Harmonize**, and **Implement**.

**Boundary vs. `copywriting-frameworks`** (Plan 028 Step 0 overlap check): `copywriting-frameworks`
owns *marketing and campaign* copy — headlines, ad copy, email sequences, landing-page persuasion
structures (AIDA/PAS/etc.), where the goal is attention and conversion. `ux-writing` owns *interface*
copy — the words a person reads while operating the product itself (buttons, forms, errors, empty
states, consent, notifications), where the goal is comprehension, correct action, and safe recovery,
and where preserving exact product behavior/terminology matters more than persuasion. When a single
piece of work spans both (e.g. an onboarding flow with marketing framing over real UI controls), use
`copywriting-frameworks` for the framing and `ux-writing` for every control, state, and error inside
it — and do not let persuasion framing override this skill's "never invent behavior/data" rule for
the parts that are actual interface copy.

## Execution Triggers & Prerequisites
### Execution Triggers
- "Review/rewrite/audit/critique the copy in these screens/this flow/this component."
- "Write copy for [buttons / errors / empty states / onboarding / consent / settings]."
- "Harmonize terminology for [create/add/invite/save, or similar near-synonym actions]."
- "Implement the approved copy in [Figma / the repo / the localization catalog]."
- Any request touching consent, permissions, pricing, subscription, cancellation, deletion, or
  data-sharing copy (high-stakes content — see Edge Cases).

### Prerequisites
- A defined working boundary: the specific files, frames, components, routes, strings, screens, or
  flow in scope. Never edit outside the authorized scope, even when adjacent copy looks wrong —
  report it instead.
- Access to the strongest available evidence for the task (see the Evidence Surface table below).
- For Rewrite/Generate/Harmonize/Implement: explicit approval to make product-facing changes. When
  edit intent is ambiguous, default to Review — a recommendation is not approval to implement it.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `scope` | String/Selection | Yes | The exact files/frames/components/routes/strings in scope |
| `mode` | Enum | Yes (infer if unstated, default Review) | `review` \| `rewrite` \| `generate` \| `harmonize` \| `implement` |
| `evidence` | Files/Screens/Code | Yes | Screenshots, editable design, docs, source, catalogs, or a rendered app |
| `locale_scope` | String | Optional | Which locale(s) are in play; preserve each unless translation is explicitly requested |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Review table | Inline markdown table | Priority / Location / Current / Proposed / Why (Review mode) |
| Updated copy | In the authorized files/design/catalog | Rewrite, Generate, Harmonize, Implement modes only |
| Completion report | Inline: Updated / Decisions / Verified / Needs confirmation | Every non-Review mode |
| Optional handoff doc | Per the review template, only if persistence was requested | Not created for a conversational answer |

## Step-by-Step Execution Runbook

### Step 1 — Frame the experience
Establish, from actual evidence (never invented): **Person** (audience/expertise/language/access
needs), **Purpose** (the task right now), **Moment** (discovery/decision/input/waiting/error/risk/
success/return), **Action** (what the interface genuinely allows next), **System** (terminology/
components/voice/content model/policies already in use), **Proof** (what's verifiable now vs. what
needs later testing). Ask at most one concise question, only when missing context would materially
change the result — never fabricate a persona or user need and present it as research.

### Step 2 — Inspect the complete context
Read complete screens/flows/components/code paths, not isolated strings. Inspect adjacent steps,
related states, responsive variants, and existing terminology. In a repository, find the source of
truth before editing generated output or duplicated strings. Distinguish product copy from data,
placeholders, annotations, comments, translation keys, developer labels, and test fixtures.

### Step 3 — Inventory the copy by role
Classify every string in scope: orientation (titles/headings/nav), action (buttons/links/menus),
input (labels/hints/placeholders), feedback (loading/progress/success/warning), recovery
(validation/errors/retry/support), assistance (onboarding/tooltips/help), state (empty/no-results/
unavailable), decision (confirmation/consent/destructive action), data (dynamic tokens/values). Flag
contradictions, terminology drift, vague actions, hidden requirements, and copy that doesn't match
visible behavior.

### Step 4 — Diagnose before rewriting
Evaluate against: Clarity, Action, Context, Consistency, Recovery, Trust, Inclusion, Accessibility,
Localization, Fit. Fix the interaction/information problem conceptually first — don't just shorten
copy to make the interface look cleaner.

### Step 5 — Act according to mode
- **Review**: make no edits. Group systemic issues; name the exact location; quote only the complete
  current string needed; give a complete proposed replacement and its user impact.
- **Rewrite**: apply the smallest wording change that resolves the diagnosed issue. Preserve facts,
  dynamic tokens, markup, variables, and terminology. Re-read the full flow/component state after
  editing.
- **Generate**: base new copy on confirmed product behavior and the stated scenario. Cover
  orientation, action, feedback, and recovery required by the state. Mark uncertain timing/policy/
  capability/data for confirmation. When alternatives help, offer a small set of meaningfully
  different directions plus a recommendation.
- **Harmonize**: determine the preferred term from evidence before replacing variants. One term per
  object, one verb per recurring action, unless a real functional distinction exists. Identify the
  source of truth and affected surfaces before bulk replacement.
- **Implement**: apply only approved wording. Update the canonical source, not compiled/generated/
  duplicated output. Preserve interpolation tokens, ICU syntax, rich-text tags, escaping, keys, and
  schemas. Never mix substantive UX changes with unrelated refactoring.

### Step 6 — Verify
Compare related screens/states/keys/variants; search for terminology drift and obsolete copy in
scope; verify tokens/placeholders/plural branches/markup/catalog syntax; check wrapping/truncation/
overlap in supported layouts; render the affected state when possible; confirm no unrelated file
changed; list runtime/screen-reader/research/localization/legal checks still outstanding.

## Code & Config Exemplars

### Evidence surface (use the strongest available; state what remains unverified)
| Surface | Inspect | What it can prove |
|---|---|---|
| Screenshot / static design | Visible copy, hierarchy, states, layout | Design-level issue or recommendation |
| Editable design | Neighboring screens, variants, properties, variables | Static flow consistency |
| Product documentation | Requirements, terminology, policy, user stories | Documented intent and constraints |
| Source and catalogs | Strings, tokens, conditionals, formatter use | Implemented wording and technical relationships |
| Rendered interface | Actual states, viewport fit, focus, announcements | Observed behavior under tested conditions |
| Research / analytics | Participant evidence, task results, metrics | Only what the method and sample actually support |

### Severity triage (Review mode)
| Priority | Location | Current | Proposed | Why |
|---|---|---|---|---|
| Critical | `checkout/confirm-step.tsx:42` | "This can't be undone" (on a reversible action) | "You can restore this from Trash for 30 days" | Misrepresents reversibility — a trust and risk issue |
| Important | `settings/notifications` (3 screens) | "Turn on" / "Enable" / "Activate" for the same toggle action | Pick one verb, apply everywhere | Terminology drift causes hesitation |
| Improvement | `empty-state/no-results.tsx` | "No results" | "No results for '{query}' — try a broader search" | Adds actionable next step |

- **Critical**: obscures a material consequence, misleads the person, creates risk, or blocks task
  completion/recovery.
- **Important**: causes substantial ambiguity, inconsistency, unnecessary effort, mistrust, or likely
  implementation failure.
- **Improvement**: strengthens clarity, scanning, tone, or consistency without blocking the task.
Never inflate severity to sound authoritative.

## Edge Cases & Error Recovery
- **High-stakes content** (consent, permissions, pricing, subscription, cancellation, deletion,
  medical/legal/financial meaning): make choice, consequence, scope, and reversibility understandable
  without weakening legal/operational meaning. Distinguish delete/remove/archive/discard/cancel/
  leave/revoke/sign-out precisely. Never turn an obligation into a benefit, uncertainty into
  certainty, or a pending action into success. Escalate substantive changes to the relevant product/
  legal/privacy/security/policy/medical/financial/localization/accessibility owner rather than
  deciding alone.
- **Missing product context**: inspect available evidence first; ask one concise question only if it
  would materially change the result. Never fabricate a persona, metric, feature, price, limit,
  timeline, guarantee, or legal requirement.
- **Real personal/confidential/authentication/research/client data present**: use synthetic examples
  instead — never process real personal or confidential data through this workflow.
- **Ambiguous edit intent**: default to Review; a recommendation is not implicit approval to
  implement it.
- **Multiple locales present**: preserve each locale and its own conventions unless translation is
  explicitly requested; never silently collapse locales into one.
- **Localization/source-code edits**: preserve interpolation tokens, ICU plural/select syntax,
  rich-text tags, escaping, and existing keys/schemas; update the canonical source, not a generated
  or duplicated copy of it.

## Verification Checklist
- [ ] Mode was correctly inferred (or defaulted to Review when ambiguous) before any edit was made.
- [ ] No product behavior, price, limit, timeline, guarantee, or legal requirement was invented.
- [ ] Dynamic tokens, placeholders, markup, ICU syntax, and terminology were preserved through any
      rewrite/implement pass.
- [ ] High-stakes content (consent/permissions/pricing/deletion/legal) kept its true consequence and
      reversibility — nothing was softened into a false benefit or false certainty.
- [ ] Terminology harmonization identified a single source of truth before bulk replacement.
- [ ] The completion report lists Updated / Decisions / Verified / Needs confirmation (non-Review
      modes) or a full severity-tagged table (Review mode).
- [ ] The boundary against `copywriting-frameworks` was stated when a request plausibly spans both.
