# CRO audit: course signup funnel (28 days)

I haven't seen your pages, so everything below comes from your four numbers. Anything about *why* people drop is a hypothesis to check, not a finding. I couldn't split the numbers by device, so the mobile problem is unconfirmed.

## Executive summary
Your biggest drop is **pricing page to checkout started**: only 20% of pricing visitors click through, and 5,890 people leave there. Fix that first, starting with the mobile pricing page. A 5-point gain at that step is worth about 148 extra sales a month. The same gain at either other step is worth about 74.

## The funnel

| Step | Visitors | Step rate | Lost |
|---|---|---|---|
| Landing | 18,400 | n/a | n/a |
| Pricing | 7,360 | 40.0% | 11,040 |
| Checkout started | 1,470 | 20.0% | 5,890 |
| Paid | 590 | 40.1% | 880 |

Overall, 3.2% of visitors pay. From the pricing page, 8.0% pay.

**What a 5-point gain at each step would add:**

| Step improved | Extra paid per 28 days | Lift in sales |
|---|---|---|
| Pricing to checkout (20% to 25%) | about +148 | about +25% |
| Checkout to paid (40% to 45%) | about +74 | about +12% |
| Landing to pricing (40% to 45%) | about +74 | about +12% |

I have no verified benchmarks for course funnels, so I'm ranking by your own numbers and not comparing you to an industry average.

**A check on the data:** 40.0% and 20.0% are suspiciously round. Confirm the "pricing page" and "checkout started" events fire as you think they do, and that the pricing count isn't a rounded or sampled figure.

## Friction findings (hypotheses to verify on mobile)
Each of these needs a look at the live page. None needs a redesign.

1. **Pricing page CTA.**
   - Is the price and the "Enroll" button visible without scrolling on a 390px-wide screen?
   - A sticky bottom CTA on mobile is a layout tweak, not a redesign.
   - The button needs a touch target of at least 48×48px and text contrast of at least 4.5:1.
2. **Pricing page doubts.**
   - The common unanswered questions are what's included, how long access lasts, and whether there's a refund.
   - Put one line of risk reversal under the CTA, such as "30-day refund". Use it only if the policy is real.
   - Add 2–3 genuine testimonials or student outcomes. Every claim and count must be verified against your sources.
3. **Mobile checkout.**
   - Look for too many form fields, no Apple Pay or Google Pay if your payment provider supports it, and numeric keyboards that don't appear for card fields.
   - Look for surprise fees such as tax or currency conversion that only show up at checkout.
   - Also check for errors that appear only after submit.
4. **Landing to pricing (40%).** This is the largest raw loss. It's also the step most likely to need new copy, so I'd leave it until after the first two.

## ICE backlog

| # | Hypothesis | Impact | Confidence | Ease | ICE |
|---|---|---|---|---|---|
| 1 | Sticky mobile CTA and price above the fold on the pricing page | 8 | 6 | 8 | 6.7 |
| 2 | Refund or guarantee line and real social proof next to the pricing CTA | 7 | 6 | 9 | 6.7 |
| 3 | Mobile checkout: wallet payments, fewer fields, inline errors | 7 | 5 | 6 | 6.0 |
| 4 | Pricing page copy rewritten around outcomes and "what's included" | 7 | 5 | 7 | 6.3 |
| 5 | Landing page CTA and headline clarity within 5 seconds | 6 | 4 | 6 | 5.3 |

ICE is the mean of the three scores. These are my judgement calls until the device split is in.

## Experiment brief #1 (bundles hypotheses 1 and 2)
- **Control:** the current pricing page.
- **Variant:** a sticky CTA, plus a guarantee line and verified proof under the button.
- **Primary metric:** pricing page to checkout started, split by device.
- **Guardrail:** checkout to paid must not fall. Check this so you don't just push more low-intent people into checkout.
- **Minimum detectable effect:** 20% to 23% (a 15% relative lift).
- **Sample size:** about 2,850 pricing visitors per variant, from a rule-of-thumb estimate at 95% confidence and 80% power. I haven't run a calculator on it.
- **Duration:** about 3 weeks at your current pricing traffic of about 263 a day. A mobile-only test would take longer.

## Do first, before any test
1. Pull the funnel by device (mobile vs desktop) for each step. This confirms where mobile loses the most and which brief to run first.
2. Open the pricing and checkout pages on a real phone and walk them through, or send me the URL or repo path and I'll do it with the browser tools.
3. Check what the checkout asks for and whether any extra costs appear late.

## Handoff notes
- **Typed section props:** I haven't written any yet. The pricing-page props (`PricingProps`) depend on your actual plans, price, refund policy and proof, which I don't have.
- **Skills not installed:** `conversion-funnel-optimization`, `copywriting-frameworks` and `ab-test-setup` aren't in this environment, so I worked from first principles. Please confirm the sample-size figure with your testing tool.
- **Files:** I wrote nothing to `docs/cro/`. This working directory is the Agents United repo, not your course site. Tell me where the site lives, or say so and I'll save this report there.
- **Task status:** no task was assigned to me, so none was updated.

**Peer messages received:** none.

**Open items:**
1. The device split for each funnel step.
2. The site URL or repo path.
3. Your actual refund policy and any verified student results I can use in the copy.
4. Your payment provider, to see whether wallet payments are available.