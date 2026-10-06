**Fix first: the pricing page to checkout step.** Of 7,360 pricing visitors, only 1,470 (20%) start checkout, so 5,890 leave there. Checkout to paid loses 880 (40% convert). I couldn't see the pages, so I can't say why people leave, only where.

| Step | Visitors | Step conversion | Cumulative |
|---|---|---|---|
| Landing | 18,400 | – | 100% |
| Pricing | 7,360 | 40.0% | 40.0% |
| Checkout started | 1,470 | 20.0% | 8.0% |
| Paid | 590 | 40.1% | 3.2% |

I have no sourced benchmark for course sales, so I'm ranking the steps by how many people are lost and how much a fix would gain, not against a market average. On your counts:
- **Pricing to checkout:** +5 points (20% to 25%) is about +148 paid, roughly +25%.
- **Checkout to paid:** the same +5 points is about +74 paid, roughly +12%.

**Mobile is unverified.** You gave me combined numbers, so I can't confirm it or say how much worse it is. It's plausible, because a mobile-only leak usually means a layout bug, and that is the cheapest kind to fix. Some mobile visitors may also browse on a phone and pay later on desktop, which would make mobile look worse than it is.

**What to do, in order, with no redesign:**
1. **Get the split.** Export the same four steps for the same 28 days by device, and by source and new vs returning if you can. This is the prerequisite for everything else.
2. **Walk pricing and checkout at 375 px and 1280 px.** Look for a buy button below the fold, plan cards that need sideways scrolling, a payment form that misbehaves on a phone, or a missing wallet option. Fix anything that blocks a purchase directly. Don't A/B test it, because a test on a broken step only measures the bug.
3. **Test one pricing-page change.** Put the outcome, what's included and your real refund terms directly above each plan's buy button. Only state a guarantee you actually offer. At about 3,680 visitors per arm, I estimate you could detect roughly a 2.5-point change in about 4 weeks. That is my estimate, so size it properly before launch.
4. **Then look at the checkout form.** Cut any field that has no reason to be there, and offer guest checkout or a wallet if your processor supports it.

**What I didn't do:**
- **Pages not walked.** The repo has no page source and I don't have your URLs, so every cause is a hypothesis.
- **No benchmark used.** I didn't use one because I don't have a sourced, dated one.
- **Scores are estimates.** The priority scores in the file are my own estimates, not measured.
- **File re-read.** I re-read only the first 30 lines of the file after writing it.

**What I need from you:**
- the device and source split
- your live landing, pricing and checkout URLs
- whether checkout is hosted by the payment processor or embedded in your site

The full audit is in `docs/cro/2026-10-06-course-signup-funnel-audit.md`. I didn't load the Task tools, so I haven't touched any task status, and I sent no messages to other agents.