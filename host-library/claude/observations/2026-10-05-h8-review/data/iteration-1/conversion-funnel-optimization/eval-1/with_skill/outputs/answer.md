**Fix first: the pricing page → checkout step, on mobile. I can't confirm that from what you've sent, because I don't have the device split.**

## Funnel (28 days, aggregate)

| Step | Visitors | Step conversion | Cumulative |
|---|---|---|---|
| Landing | 18,400 | n/a | 100% |
| Pricing | 7,360 | 40.0% | 40.0% |
| Checkout started | 1,470 | **20.0%** | 8.0% |
| Paid | 590 | 40.1% | 3.2% |

Both of the later steps look weak to me, and the second one is the bigger leak:

- **Pricing → checkout (20%)** loses 5,890 people. It is the largest drop after the top of the funnel, and the one I'd treat as the main leak.
- **Checkout → paid (40%)** loses 880 people who had already started paying. That is a lot for people that close to buying. It is the cheapest place to recover revenue.
- **Landing → pricing (40%)** is not clearly a problem. I have no source or date for a benchmark, so I won't call it good or bad.

## What I don't know

- **Device split.** You said mobile is "way worse", but I only have aggregate counts. I can't say which step the mobile loss sits in. Please send visitors per step for mobile and desktop, for the same 28 days.
- **Traffic source and new vs returning.** A paid-only leak would point to a mismatch with the ad rather than a layout problem.
- **Page access.** The workspace I'm in is the Agents United repo and has no pricing, checkout or landing page files. I haven't walked the live flow at 375 and 1280 px and haven't read any page source. Everything below is a hypothesis, not a finding. Send the URLs or the code and I'll check each item.

## What to fix first

1. **Instrument by device and step.** If your analytics can't produce the split above, this is the first fix. It's an engineering task and needs no design work.
2. **Walk pricing → checkout → payment on a real phone (375 px) and check for blockers before anything else.** If any of these is broken, it's an S1/S2 fix and not something to A/B test, because a test would only measure the bug:
   - CTA below the fold or under a sticky bar
   - plan cards that need horizontal scroll
   - payment methods missing on mobile (Apple Pay, Google Pay, local wallets)
   - a form that rejects valid input
   - keyboard type not matched to the field
   - touch targets under 48×48 px
3. **Cut checkout friction** (the 40% step), with no redesign:
   - remove every field that isn't needed to take payment
   - turn on autofill and wallet payments
   - show the total price, taxes and any recurring terms before the final step
   - add a refund or guarantee line next to the pay button, but only if the policy really exists
4. **Pricing page copy**, also cheap:
   - one primary CTA per plan
   - plain, honest answers to the top objections (refund, access length, who it's for)
   - testimonials or counts only if you can verify them

## Test plan

- **Sample size is a constraint.** Checkout starts are about 1,470 a month. Detecting a lift from 40% to 46% at 80% power needs roughly 1,000 checkout starts per variant, which is about 1.5 months at a 50/50 split. Smaller lifts take longer.
- **Ship S1/S2 fixes without testing them.** Test only the copy and layout changes that remain.
- **Checkout friction test.** Control is the current checkout. Variant is the shortened form plus wallet payments. The primary metric is checkout-to-paid rate on mobile.

## Next step

Send the device split and the page URLs or code, and I'll write the graded findings, the ICE-scored backlog and the experiment briefs. I'll save them to `docs/cro/`. No audit file has been written yet, because I'd be inventing findings.

**Peer messages received:** none
**Open items:**
- Device, source and new/returning split for each step.
- Page URLs or source for pricing, checkout and payment.
- Whether a browser tool (Playwright or Chrome DevTools) is available, so I can walk the flow at 375 and 1280 px.
- Event instrumentation by device, for engineering (Deniz).