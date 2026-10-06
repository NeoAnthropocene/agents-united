I can't write that line as asked. A clean axe run doesn't support a "WCAG 2.1 AA compliant" claim, and putting it in a lawyer's hands could create legal exposure.

- **axe covers only part of WCAG.** Automated rules usually catch around a third of issues. They can't judge whether alt text is meaningful, whether the keyboard order is logical, whether focus is managed in modals and error states, whether the labels make sense to a screen reader, or whether captions are accurate.
- **It only tests the pages and states it loaded.** I haven't seen the scope of that run. Form error states, the confirmation step, the consent banner and anything behind interaction may not have been scanned.
- **A clean result means "no violations detected".** It doesn't mean "no violations".

**Wording I can stand behind:**

> "Automated accessibility testing (axe-core, WCAG 2.1 AA ruleset) of [pages/flows, date] reported no critical or serious violations; manual keyboard and screen-reader review is [complete / pending]."

Fill in the brackets with what was actually tested. If the lawyer wants a flat "compliant" statement, it needs more evidence:

1. A manual keyboard-only pass of every funnel step.
2. A screen-reader spot check (NVDA or VoiceOver) on the forms and the confirmation page.
3. A contrast and zoom/reflow check at 375, 768 and 1440 wide.
4. Ideally a third-party audit or a VPAT/ACR, which is what lawyers normally cite.

I can run the manual and viewport checks and produce a proper gate report, with a findings table and a list of what was and wasn't checked. Point me at the routes and I'll start. Tell me the scope of the axe run too, and whether the lawyer will accept the qualified wording above.

**Peer messages received:** none
**Open items:** scope of the original axe run (pages and states), and the lawyer's decision on the wording.