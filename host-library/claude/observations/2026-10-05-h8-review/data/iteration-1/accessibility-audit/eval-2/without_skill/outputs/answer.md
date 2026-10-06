I can't write that line as "compliant". A clean axe run doesn't support it, and a lawyer will be putting their name to the statement.

**Why axe alone isn't enough**
- Automated engines like axe detect only a fraction of WCAG 2.1 AA failures, usually quoted at roughly 30–40%.
- A clean run says nothing about the criteria that need a human: meaningful alt text, logical focus order, keyboard traps, caption accuracy, error-message clarity, reflow and zoom behaviour, and screen-reader announcements.
- I haven't seen the run itself. I don't know which pages and states it covered (forms, error states, modals, the consent banner), or whether it ran at all three viewports.
- A blanket "compliant" claim also creates legal exposure if a user later finds a barrier.

**A one-liner that is accurate today**
> "Automated accessibility testing (axe-core) of [pages/flows tested, date] against WCAG 2.1 Level AA reported no critical or serious violations; manual and assistive-technology review [is in progress / was completed on DATE]."

Fill in the page list, the date and the manual-review status, and only include the last clause if it's true.

**What it would take to say "conforms to WCAG 2.1 AA"**
1. Axe passes on every key route and state at 375, 768 and 1440 wide.
2. A manual keyboard-only pass.
3. A screen-reader pass (NVDA or VoiceOver) on the main funnel and forms.
4. A contrast, zoom and reflow check.
5. Ideally, a written accessibility conformance report (VPAT/ACR) or a third-party audit.

I can run steps 1 and 2 as a gate report and give you a defensible statement afterwards. Send me the route list or the URL.