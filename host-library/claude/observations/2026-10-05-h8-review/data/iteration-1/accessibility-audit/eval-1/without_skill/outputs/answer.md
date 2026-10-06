**Gate status: not verified. I couldn't audit the signup page because it isn't in this workspace.**

`C:\github\scratch-pilot\h8-skills` has no application code. It holds only `.claude/` (rules and skills) and an empty git history. A search for signup, register, `aria-invalid` and `role="alert"` across html, tsx, jsx, vue, svelte, ts, js and astro files found nothing. There is no Playwright config, no `package.json`, and no axe or Playwright in `node_modules`. I didn't run anything or invent results.

**"We're good" isn't supported yet.** One clean axe run on the empty state tells you little about the other two states:

- **Validation-error state:** this is where signup pages usually fail. Axe can't judge things it can't see in the DOM, so on this state you need to check:
  - Error messages are tied to their fields with `aria-describedby`, and the field has `aria-invalid="true"`.
  - Errors are announced to screen readers, through an `aria-live` region or `role="alert"`, or by moving focus to the first invalid field or an error summary.
  - Errors aren't conveyed by colour alone, and the error text and border meet contrast minimums.
- **Success state:** the confirmation needs to be announced, and focus shouldn't be lost when the form is removed from the DOM.
- **Axe itself:** it catches only a minority of WCAG issues. Keyboard order, focus visibility, target size (44 to 48px) and reflow at 375px need manual or scripted checks.

**What I'd run once I can reach the page** (WCAG 2.1 AA, at 375×667, 768×1024 and 1440×900):

1. Axe with the `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` tags on each of the three states, reached by driving the form (submit it empty, then submit valid data against a stubbed endpoint). Any critical or serious violation fails the gate.
2. Keyboard-only walkthrough of every state, checking where focus lands after a failed submit and after success.
3. Accessibility-tree snapshot for names, roles, heading order and live regions.
4. Contrast and tap-target measurements on the fields, error text and submit button.
5. Console errors and 4xx/5xx requests across the flow, which count as failures.

**What I need from you** (any one of these works):
- The path to the signup page or repo, if it lives somewhere other than this folder.
- A running URL, such as staging or localhost, and how to trigger each state. I can then drive it through the browser tooling.
- The route and the endpoint it posts to, so I can stub the success and failure responses.

Peer messages received: none.
Open items: the page location above. Any defects I find will go to Deniz, the frontend owner, through the lead; I won't patch the code myself.