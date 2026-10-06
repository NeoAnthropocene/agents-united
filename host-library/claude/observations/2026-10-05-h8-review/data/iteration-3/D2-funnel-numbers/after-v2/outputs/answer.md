**Missing: the funnel split by device.** You have only the combined numbers, so I can't yet confirm that mobile is worse or say where it loses people.

**What the combined numbers show**

| Step | Reached | Step rate | Lost |
|---|---|---|---|
| Landing | 18,400 | n/a | n/a |
| Pricing | 7,360 | 40% | 11,040 |
| Checkout started | 1,470 | 20% | 5,890 |
| Paid | 590 | 40% | 880 |

Overall visit-to-paid is 3.2%. The sharpest leak is **pricing to checkout**: 80% of the people who see prices never start checkout. Landing-to-pricing loses more people in absolute terms, but that step is mostly about traffic quality and the page's pull. Checkout-to-paid loses 60% of those who started, and that is where mobile payment friction usually shows up.

**What I need, with why**
1. **Visitors, pricing views, checkout starts and paid, split by mobile and desktop (28 days).** This shows whether the mobile gap is at pricing, at checkout or at both. Each needs a different fix.
2. **Traffic source by device, if you have it.** Mobile visitors may be mostly social or ads, which would lower their intent and make mobile look worse than the funnel really is.
3. **The pricing and checkout page URLs, or the repo path if the site code is in this workspace.** The current directory doesn't appear to hold your site. I need the pages to audit the mobile layout, tap targets, form fields and payment options.
4. **Whether you have payment failure or error counts, and which payment methods checkout offers.** That separates "people chose not to pay" from "payment didn't work".

**Provisional plan (low confidence until I see the split)**
No-redesign fixes, in this order:
1. **Pricing page:** put one clear primary button above the fold on mobile, with a one-line statement of what is included and your refund terms, if you have a real one.
2. **Checkout:** add Apple Pay and Google Pay if you don't offer them, and cut form fields to the minimum.
3. **Testing:** at about 370 checkout starts a week, only large effects can be detected in a reasonable time. I'd ship these fixes and compare before and after by device, rather than run small A/B tests.

Send the device split and the page access and I'll deliver the full audit. It will include findings with fixes, an ICE-scored backlog, test briefs where a test is worth running, and copy as typed section props.

**Open items:** device-split funnel data, traffic source by device, page URLs or repo path, payment failure data.