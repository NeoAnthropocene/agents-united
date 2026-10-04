---
name: accessibility-audit
description: "Audit a UI surface for accessibility with an automated axe pass, a manual keyboard and focus pass and a zoom check; map findings to severity, apply the gate rule, say what automation cannot see, and route each finding to its owner."
metadata:
  author: agents-united
  version: 3.0.0
  icon: ♿
disable-slash-command: true
---

# Accessibility Audit

## Overview & Purpose
Accessibility defects stop real people from using the page. Automated tools find a useful share of them quickly and reliably; they cannot find the rest. This skill is the QA lead's audit: an automated pass for what machines can catch, a manual pass for what only a person at a keyboard can, a gate rule the team agrees on, and an honest statement of what was not checked.

It verifies and reports. It does not patch the code (Deniz owns markup), the colours (Jamileh) or the words (Kaan); it routes each finding to them through the lead.

## Execution Triggers
Load it for any UI surface entering QA, after a design or component change, before a launch, and when a user reports a barrier. Do not use it to claim that a site "is accessible" or "is compliant": an audit finds problems; it never proves their absence. For the root cause of one violation, use `a11y-debugging`.

## Input/Output Requirements
Inputs: the route or flow and how to run it, the conformance target (the agency's gate is WCAG 2.1 level AA, with the WCAG 2.2 additions reported as advisory unless the client requires them), the key journeys, and whether authenticated states are needed (credentials come from the lead; never invent or request real secrets).

Outputs: the gate status; a findings table (id, WCAG criterion, severity, location, evidence, owner, fix); the list of what was checked and what was not; the automated report file. **Evidence to attach**: the axe results as JSON, a screenshot or DOM snippet per finding, and the keyboard path you followed.

## Step-by-Step Runbook
1. **Run the automated pass** on every distinct page state with axe (through `@axe-core/playwright`), limited to the WCAG A and AA tags for 2.0 and 2.1. Save the full results. Note each violation's impact: critical, serious, moderate, minor.
2. **Apply the gate rule**: any **critical or serious** violation means the gate is **red**; moderate and minor are logged and scheduled, not blocking. A "needs review" result from axe is not a pass: check it by hand.
3. **Do the keyboard pass without a mouse.** Tab through the whole journey: every control reachable, order follows the visual and reading order, focus always visible, no trap, Escape closes dialogs and returns focus to the trigger, no content that opens on hover only.
4. **Check names and structure.** Each control has an accessible name that says what it does (not "click here"); form fields have labels; errors are tied to their fields and announced; headings form an outline without skipped meaningful levels; landmarks exist; images carry useful alt text or are marked decorative.
5. **Check colour and motion.** Text contrast of at least 4.5 to 1 (3 to 1 for large text and interface boundaries), information not conveyed by colour alone, animation respects the reduced-motion setting, nothing flashes more than three times a second.
6. **Check zoom and reflow.** At 200 percent text size and at 320 CSS pixels wide, content stays readable and operable (see `responsive-design-audit`).
7. **Say what you could not check.** Automated tools catch a minority to a little over a third of WCAG issues (a commonly quoted range; not measured here), and axe does not judge whether alt text is meaningful, whether the reading order makes sense, or how a screen reader announces a custom widget. If no screen reader was run, say so; do not report one as passed.
8. **Route and report.** Markup, roles and focus defects to Deniz; contrast and non-colour cues to Jamileh; link text, error wording and alt text to Kaan; anything that implies a legal obligation to Defne. Reproduce one violation's root cause with `a11y-debugging` when the fix is not obvious.

## Code & Config Exemplars
### Worked example
Signup page, three states (empty, validation error, success). Invented results.

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('signup has no critical or serious axe violations', async ({ page }) => {
  await page.goto('/signup');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
});
```

| Id | WCAG | Severity | Location | Evidence | Owner | Fix |
|---|---|---|---|---|---|---|
| A1 | 1.3.1 / 4.1.2 | serious (axe `label`) | `input#company` | axe results, 1 node | Deniz | add a `label`; placeholder is not a label |
| A2 | 1.4.3 | serious (axe `color-contrast`) | `.helper` text, 3.9 to 1 | axe results, screenshot | Jamileh | use the darker muted token |
| A3 | 2.1.2 | manual: keyboard trap | cookie dialog, Tab cycles inside, Escape does nothing | keyboard path notes | Deniz | Escape closes and returns focus |
| A4 | 3.3.1 | manual: error not announced | email error appears but no live region | recording | Deniz | `role="alert"` on the error container |

Gate: **red** (A1 and A2 serious). Not checked: screen reader announcement of the error, the authenticated dashboard, Safari. Defne is told only that a legal-risk question exists if the client sells in a regulated sector.

### Anti-patterns
- Reporting "WCAG compliant" because axe returned no violations.
- Running axe on the first page state only.
- Treating "incomplete" results as passes.
- Fixing the markup yourself and re-running until green.
- Alt text findings with no look at what the image says.
- Skipping the keyboard pass because the automated pass was clean.

## Edge Cases & Error Recovery
- **A violation inside a third-party widget**: report it with the widget and version, the owner is whoever integrates it (Deniz), and name a mitigation or a replacement.
- **A false positive**: document why (the element, the rule, the reasoning) and exclude only that node, never a whole rule globally.
- **Dynamic content and single-page routes**: run the pass after each route change and each state that renders new markup.
- **No test account**: test only what is public and state that the authenticated parts were not tested.
- **The client asks for a compliance statement**: decline to give one; give the audit with its limits and hand the question to Defne.

## Verification Checklist
- [ ] The automated pass ran on every distinct state with the WCAG A and AA tags; the JSON is saved.
- [ ] The gate rule (critical or serious means red) was applied and incomplete results were checked by hand.
- [ ] The keyboard, naming, colour and zoom passes were done and their results are in the findings table.
- [ ] Each finding has a criterion, a severity, evidence, an owner and a fix.
- [ ] The report lists what was not checked, including screen readers if none was used.
- [ ] No claim of compliance appears; hand-offs name Deniz, Jamileh, Kaan and, where relevant, Defne.
