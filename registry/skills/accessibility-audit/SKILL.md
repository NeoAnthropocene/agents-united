---
name: accessibility-audit
description: "Use when a UI surface enters QA, after a design or component change, before a launch, or when a user reports a barrier; trigger phrases: run an accessibility audit, is this page accessible, axe results, keyboard test, WCAG check, a user cannot use the form with a keyboard. Produces the gate status, a findings table (criterion, severity, location, evidence, owner, fix), what was and was not checked, and the axe report file. Skip it to claim a site is accessible or compliant (an audit finds problems, it never proves their absence) and for the root cause of one violation (use a11y-debugging)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: ♿
disable-slash-command: true
---

# Accessibility Audit

Accessibility defects stop real people from using the page. Automated tools find a useful share quickly and cannot find the rest, so the audit has three parts: an automated pass for what machines catch, a manual pass for what only a person at a keyboard catches, and an honest statement of what was not checked.

## Overview & Purpose
The QA lead's audit. It verifies and reports: Deniz owns markup, Jamileh colours and Kaan words, and each finding is routed to them through the lead.

## Execution Triggers
Load it for any UI surface entering QA, after a design or component change, before a launch, and when a user reports a barrier. Do not use it to claim a site "is accessible" or "is compliant": an audit finds problems, it never proves their absence. For one violation's root cause use `a11y-debugging`.

## Input/Output Requirements
Inputs: the route or flow and how to run it; the conformance target (the agency's gate is WCAG 2.1 level AA, the 2.2 additions advisory unless the client requires them); the key journeys; whether authenticated states are needed (credentials come from the lead; never invent or request real secrets).

Output: the gate status; a findings table (id, WCAG criterion, severity, location, evidence, owner, fix); what was checked and what was not; the automated report file. **Evidence to attach**: the axe results as JSON, a screenshot or DOM snippet per finding, the keyboard path you followed.

## Step-by-Step Runbook
1. **Run axe on every distinct page state** (`@axe-core/playwright`, the WCAG A and AA tags for 2.0 and 2.1) and save the full results; note each violation's impact: critical, serious, moderate, minor.
2. **Apply the gate rule**: any critical or serious violation makes the gate **red**; moderate and minor are logged and scheduled, not blocking. An axe "needs review" result is not a pass: check it by hand.
3. **Do the keyboard pass without a mouse**: every control reachable, focus always visible, no trap, Escape closes dialogs and returns focus, nothing opens on hover only. The full checklist, with names, structure, colour, motion and zoom, is [references/manual-pass.md](references/manual-pass.md).
4. **Measure every colour pair** that meets: text needs 4.5 to 1, large text and interface boundaries 3 to 1. With a shell run `node ${CLAUDE_SKILL_DIR}/scripts/contrast.mjs '#6B7280' '#F3F4F6'` (exit code 1 on a fail); without one use the formula and tables of `design-system-tokens`.
5. **Say what you could not check.** Automated tools catch a minority to a little over a third of WCAG issues (a commonly quoted range, not measured here). Axe cannot judge whether alt text is meaningful, whether the reading order makes sense, or how a screen reader announces a custom widget. If none was run, say so; never report one as passed.
6. **Route and report.** Markup, roles and focus to Deniz; contrast and non-colour cues to Jamileh; link text, error wording and alt text to Kaan; anything implying a legal obligation to Defne. Use `a11y-debugging` when a fix is not obvious.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for an axe test in Playwright and a findings table for a signup page in three states.

Anti-patterns, each with its reason:
- "WCAG compliant" because axe returned nothing: axe sees only a share of the issues.
- Axe on the first page state only: errors and dialogs live in the others.
- "Incomplete" results treated as passes: nobody has checked them.
- Fixing the markup yourself and re-running until green: the report stops being independent.
- Alt text findings with no look at the image: a present alt is not a meaningful one.
- Skipping the keyboard pass after a clean axe run: it finds what axe cannot.

## Edge Cases & Error Recovery
- **A violation inside a third-party widget**: report the widget and version; the owner is whoever integrates it (Deniz); name a mitigation or a replacement.
- **A false positive**: document the element, the rule and the reasoning, and exclude only that node, never a whole rule.
- **Dynamic content and single-page routes**: run the pass after each route change and each state that renders new markup.
- **No test account**: test only what is public and say the authenticated parts were not tested.
- **The client asks for a compliance statement**: decline; give the audit with its limits and hand the question to Defne.

## Verification Checklist
- [ ] Axe ran on every distinct state with the WCAG A and AA tags; the JSON is saved.
- [ ] The gate rule was applied and incomplete results were checked by hand.
- [ ] The keyboard, naming, colour and zoom passes were done and are in the findings table.
- [ ] Each finding has a criterion, a severity, evidence, an owner and a fix.
- [ ] The report lists what was not checked, including screen readers if none was used.
- [ ] No claim of compliance appears; hand-offs name Deniz, Jamileh, Kaan and, where relevant, Defne.
