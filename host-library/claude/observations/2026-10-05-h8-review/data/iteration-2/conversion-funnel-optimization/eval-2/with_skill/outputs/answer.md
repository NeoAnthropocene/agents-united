**Diagnosis:** your pricing page doesn't keep the promise the ad makes. This is from your numbers only. I did not walk your live page or see the ad.

The `site/pricing.html` in this repo is a HookRelay webhook page, not a lesson page. It doesn't match your page, so I didn't use it as evidence.

**Who is leaking**
- Paid social converts at 9% against 27% for organic, so it's 3x worse. Paid social is the leak, and the 20% average hides it.
- If paid and organic were your only sources, paid would be about 39% of pricing-page traffic. That is arithmetic from your three figures, so check it against real traffic.
- The page works for people who arrived intending to buy. It fails for people who were promised something free.

**Why**
- This is a relevance problem. The ad says "free first lesson" and the visitor lands on a page that shows only a price. They came to try something, not to buy.
- It is also an anxiety problem. Asking for a card or a commitment, with no free option in sight, reads as a bait-and-switch. This is a hypothesis until you've seen the page.
- The paid-only drop points to the mismatch rather than the page. Organic visitors, who expect to pay, convert fine.

**What to change**

1. **S2: send paid-social clicks to a landing page for the free lesson.**
   - Don't send them to the pricing page. Make the primary call to action "Start your free first lesson", with the price shown below it.
   - The goal event for this flow becomes "free lesson started", not "checkout started". Measure the two separately.

2. **S2: add the free lesson to the pricing page.**
   - Put a free-lesson card or a button above or next to the paid plan, so the ad's promise is visible. Every visitor, organic included, can then pick it.
   - Add one line of microcopy under the button, such as "No card needed" or "Card required, not charged today". Say whichever is true.

3. **Check the rest of the free-lesson path.**
   - Make sure the lesson is truly free, with no card wall. Do not use a fake countdown or invented urgency.
   - If it does need a card, say so on the ad and on the page.

4. **S3: carry the ad's wording onto the page.**
   - Repeat the ad's headline or offer wording in the page's first view, so people can see they landed in the right place.

**Tests**
- Fixes 1 and 2 are the fix, not experiments, so ship them. Then test whether the dedicated landing page or the pricing page with a free option gets more paid-social visitors to start a lesson and later pay.
- The primary metric is free-lesson start rate for paid social, with paid conversion as the guardrail. Use the `ab-test-setup` skill for sample size once you give me weekly paid-social visitors.
- Without data on how many paid-social visitors you get, I can't size the test or say how long it would take.

**Gaps I need to close**
- Visitor counts per step, split by device, over the same 28 days. If the paid drop is mobile-only, the cause is layout rather than the offer.
- A link or screenshot of the real pricing page and the ad, so I can walk the page at 375 and 1280 pixels.
- Whether the free lesson needs a card or an account.
- Whether anyone at the pricing page can start the free lesson at all today.

**Peer messages received:** none.
**Open items:** the live page URL and the data above; for the lead, Jamileh for the layout of the free-lesson card, and Deniz for the "free lesson started" event and per-source tracking.