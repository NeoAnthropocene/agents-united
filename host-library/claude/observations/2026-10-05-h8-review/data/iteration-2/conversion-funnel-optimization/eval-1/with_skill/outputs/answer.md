**Fix first:** get this funnel split by device. Then walk checkout and pricing on a real phone at 375 px. I can't say which step is broken on mobile yet, because your numbers are blended and I haven't seen the pages. I read the first 30 lines of the audit file after writing it; I did not re-read the rest, and the A/B sample sizes are my own estimates.

| Step | Visitors | Step conversion |
|---|---|---|
| Landing | 18,400 | |
| Pricing | 7,360 | 40.0% |
| Checkout started | 1,470 | 20.0% |
| Paid | 590 | 40.1% |

Visit-to-paid is 3.21%. I haven't cited a benchmark, because I don't have one with a source and date.

**Where the leaks are**
- **Pricing to checkout:** 80% leave here (5,890 people), the biggest relative leak.
- **Checkout to paid:** 880 people (59.9%) started paying and didn't finish. They are your most motivated visitors.
- **Size of the prize:** a 10% relative lift at any one step gives about 59 more purchases per 28 days.

**Why the device split comes first**
- A leak that only happens on mobile is usually a layout or form bug, not a persuasion problem. Bugs should be fixed, not A/B tested.
- Pull visitors per step by device and by traffic source for the same 28 days. That is about half a day of work.
- If mobile fails at pricing to checkout, look at the pricing page: cards or a table that don't fit 375 px, or a button below the fold.
- If mobile fails at checkout to paid, look at the checkout form: too many fields, wrong keyboard types, no autofill, no Apple Pay or Google Pay.

**Fixes that need no redesign** (all hypotheses until someone walks the pages)
1. **Mobile pricing page:** make sure the plan button is visible on the first screen, with no horizontal scroll and tap targets of at least 48 px.
2. **Checkout form:** cut it to the fields you actually need, and set input types and autofill so typing on a phone is fast.
3. **Pay button:** show the total price, billing terms and refund terms next to it.
4. **Wallet payments:** add Apple Pay or Google Pay if your processor supports them.
5. **Pricing page copy:** restate what the student gets, with proof, above the plans.

Only use a guarantee, student count or testimonial that you can verify. I'd also skip fake timers or scarcity.

**Testing is slow for checkout.** Checkout-to-paid needs about 3,000 checkout starts to detect a 5-point lift, which is roughly 8 weeks at your volume. Ship those fixes and watch the rate before and after. A pricing-page test needs about 5,600 visitors, roughly 3 weeks.

**What I didn't do:** I walked no page. The only page in this repo is `site/pricing.html`, a stub for a different product (HookRelay, a webhook service) with no plans or button, so I didn't audit it. If the course pages are in another repo or live, send the URLs.

Full audit with the ICE-scored backlog, test briefs and gaps: `docs/cro/2026-10-05-course-funnel-audit.md`

**Peer messages received:** none.

**Open items:**
- Funnel by device, source, and new versus returning visitors, same 28 days (Deniz or analytics access).
- URLs and access to the landing, pricing and checkout pages, plus the payment processor and enabled methods.
- Verified guarantee, student count and testimonial sources from you.
- Mobile layout changes, if confirmed, go to Jamileh.
- Sample sizes should be confirmed with `ab-test-setup` before any test starts.
- I have no shell and ran no commands. I did not load the shared task tools or claim a task.