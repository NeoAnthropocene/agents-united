**Missing: the mobile vs desktop split.** You gave me blended numbers only, so I can't yet confirm mobile is the problem or say where it leaks.

**What the blended numbers show**

| Step | Reached | Step conversion | Lost |
|---|---|---|---|
| Landing | 18,400 | n/a | n/a |
| Pricing | 7,360 | 40.0% | 11,040 |
| Checkout started | 1,470 | 20.0% | 5,890 |
| Paid | 590 | 40.1% | 880 |

Overall, 3.2% of landing visitors pay. About 60% of people who start checkout don't finish.

Each stage is a similar-sized lever. A 25% relative lift at any one step gives about 148 more paid, which is +25% (590 to ~738). The first fix therefore depends on where mobile loses people, and the blended data can't show that.

**What I need, with why**
1. **Visitors at each of the four stages, split by mobile and desktop (tablet if you track it).** This shows whether mobile is worse overall or only at one step, and it sets the first fix.
2. **Traffic source split by device (for example social vs search vs email).** Mobile traffic often comes from colder sources, which would explain low conversion without any page fault.
3. **Course price and the checkout steps.** Forced account creation, payment methods offered (Apple Pay, Google Pay, cards only) and the number of form fields drive mobile checkout drop-off.
4. **Where the pricing and checkout pages live.** Give me a live URL or the source path. This repo looks like the Agents United tooling, not your site. With access I can check touch targets (48 by 48 px), field labels and button contrast, and I can make copy-only edits.

**Provisional plan (no redesign, nothing here is confirmed)**
1. Pull the device split for the four stages from your analytics. It's free and takes about 10 minutes.
2. Use that split to find the one step where mobile falls furthest behind desktop.
3. Make config and copy fixes at that step first. Examples are wallet payments, fewer fields, price and guarantee wording near the buy button, and a larger tap target.
4. At 1,470 checkout starts per 28 days, a test at that step is slow. It would need roughly a month or more for a large effect, and longer for a small one. I'd ship the obvious fixes and compare before and after. I'd A/B test only the higher-traffic steps.

Once I have the split, I'll write the full audit with the ICE-scored backlog and experiment briefs to `docs/cro/`. If you want to proceed without the split, say so and I'll audit the pages directly. The ranking would then be a heuristic review and labelled that way.

**Peer messages received:** none
**Open items:** the four inputs above. The Gmail and Google Calendar connectors need authorizing in your claude.ai connector settings if you want them used later. Neither is needed for this task.