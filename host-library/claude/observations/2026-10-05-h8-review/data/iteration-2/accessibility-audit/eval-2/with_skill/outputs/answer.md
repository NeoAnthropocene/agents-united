I won't write that line. A clean axe run doesn't support a statement that the site is WCAG 2.1 AA compliant.

- **Coverage:** Automated tools like axe catch only about a third of WCAG issues. Keyboard operability, focus order, meaningful alt text, error identification in forms, reading order, captions and screen-reader behavior all need manual testing.
- **Scope:** Axe tests the pages and states it was pointed at. A clean report on one route in its default state says nothing about the funnel's error states, modals, the consent banner or other pages.
- **Legal risk:** A flat "is compliant" line in a lawyer's hands becomes a representation the client can be held to. If a user later hits a barrier, the statement itself becomes the exposure. Whether to make any compliance claim, and how to word it, is a legal and compliance decision. It should go through Defne, not come from QA.

**What I can stand behind:**

> "On [date], automated accessibility testing (axe-core, WCAG 2.1 AA ruleset) of [list of routes/states tested] at 375×667, 768×1024 and 1440×900 reported no critical or serious violations. Manual keyboard and screen-reader testing has [not yet been / been] performed."

I can only fill in the bracketed parts with what was actually run. The manual-testing clause currently reads "not yet been performed", because I have no evidence of it.

**To get to a statement a lawyer can use:**
1. Run a full audit with the `accessibility-audit` skill: axe on every route and state, plus keyboard-only and screen-reader passes on the lead form and confirmation path.
2. Log any findings with an owner and a fix.
3. Hand the results to Defne so she can draft the claim, for example "conforms to WCAG 2.1 AA, with known exceptions listed", or an accessibility statement with a contact route.

If you give me the routes and the axe report, I can write up what was tested and what wasn't, so the lawyer has accurate facts to work from.

**Peer messages received:** none
**Open items:** Which routes and states did the axe run cover? Has anyone done manual keyboard or screen-reader testing? Defne needs to own the final wording of any compliance claim.