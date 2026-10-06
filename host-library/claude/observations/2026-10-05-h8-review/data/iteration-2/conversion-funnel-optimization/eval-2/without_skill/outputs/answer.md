**Diagnosis: the ad promises something the page doesn't offer.** The ad says "free first lesson", but the pricing page shows only the paid plan. Paid social visitors arrive expecting a free thing and see a price, so 9% of them start checkout. Organic visitors came for the product, not the offer, so 27% start checkout.

I couldn't find a pricing page in this repo, and the `conversion-funnel-optimization` skill isn't installed. This is an inference from your numbers, not an audit of the page.

**Confidence**
- **Likely:** the mismatch explains most of the gap. A scent break between ad and page is a classic cause of this pattern.
- **Not certain:** paid social traffic is colder than organic, so some gap would exist anyway. Don't expect 9% to reach 27%. The goal is to close the part caused by the mismatch.
- **Missing data:** I need the traffic share of each channel. The 20% overall implies paid social is a real part of the mix. Also check whether the 9% group bounces, or scrolls and then leaves, because the fix differs.

**What to change, in order**
1. **Make the free lesson the primary call to action for ad traffic.** Send ads to a free-lesson landing page, or show a free-lesson block above the plans when the UTM source is paid social. Don't send them to the plain pricing page.
2. **Keep the paid plan visible as the secondary option.** Be explicit about the terms. If the free lesson needs an account or a card, say so next to the button. Don't hide a later charge or make the free offer look like the paid one, because that is a dark pattern and will also hurt trust.
3. **Repeat the ad's words on the page.** Use the same phrase in the headline or first line, for example "Your first lesson is free", so people know they landed in the right place.
4. **Change what you measure.** "Checkout start" is the wrong success metric for ad traffic, because a free-lesson offer shouldn't go through checkout. Track free-lesson starts, then lesson-to-paid conversion.

| # | Hypothesis | Impact | Confidence | Ease | ICE |
|---|---|---|---|---|---|
| 1 | Free-lesson CTA for paid social traffic | 9 | 8 | 7 | 504 |
| 2 | Ad-matching headline and terms microcopy | 6 | 7 | 9 | 378 |
| 3 | Trust and risk-reversal block near the plan | 5 | 5 | 8 | 200 |

**A/B brief for #1**
- **Audience:** paid social traffic only.
- **Control:** the current pricing page.
- **Variant:** the free-lesson CTA first, with the paid plan second.
- **Primary metric:** paid conversion per visitor. Don't use checkout start alone, because the variant is designed to lower it.
- **Secondary metrics:** free-lesson start rate and lesson-to-paid rate.
- **Minimum detectable effect:** I used a rise from 9% to 12% on the primary metric as a placeholder. That is an assumption, so replace it with your real baseline for that metric.
- **Sample size:** about 1,650 visitors per variant at 95% confidence and 80% power. This is my own calculation, not tool output.
- **Run length:** at least two full weeks to cover weekday and weekend patterns.

**Open items**
- Send me the pricing page source or a URL, plus the traffic share per channel. I'll then audit the page properly and write the copy as typed section props for the frontend architect.
- Tell me whether the free lesson needs sign-up or a card. That decides the wording of the call to action.
- The Gmail and Google Calendar connectors need authorizing in your claude.ai connector settings. I couldn't use them in this session, and nothing here needed them.
- I wrote no files, so nothing was saved to `docs/cro/`. I can write this up as a full report if you want.
- Peer messages received: none.