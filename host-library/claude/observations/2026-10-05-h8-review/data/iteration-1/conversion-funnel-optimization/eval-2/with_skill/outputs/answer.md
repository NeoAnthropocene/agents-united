**What's wrong:** the ad makes a promise the page doesn't keep. This is a mismatch between ad and page. It isn't a general checkout problem.

I couldn't find the pricing page in this repo, so I haven't walked the flow. I'm working from your numbers and the page as you describe it.

**Why I think so**
- **The leak is in one segment.** Organic converts at 27%, so the page and checkout work for people who arrive ready to buy. Paid social converts at 9%, so the loss is specific to people the ad sent.
- **Relevance:** the ad says "free first lesson", and the visitor lands on a page showing only a price. They came for the free thing and can't find it.
- **Anxiety:** a cold visitor who was promised "free" and sees only a price doesn't know whether they have to commit before trying. Most will leave.
- **Cold traffic is also expected to convert lower.** Some of the 9% vs 27% gap is normal. A gap of 3x is bigger than temperature alone explains. I can't cite a benchmark for this, so treat that as my judgment.

**What to change**
1. **Fix, not a test (S2: a segment loses out):** show the free first lesson on the pricing page, above the plan cards. For example, "Your first lesson is free. No card needed" (use that only if it's true), with the CTA "Start free lesson". Keep the paid plan CTA as the secondary action.
2. **Change the ad destination.** A "free first lesson" ad should land on a page whose one job is to start that lesson, not on pricing. Pricing comes after the lesson. This is probably the bigger lever.
3. **State the terms truthfully:** whether a card is required, and whether the lesson expires. No fake urgency. Hidden terms would turn this into a dark pattern.
4. **Change what you measure for paid.** "Checkout start from pricing" is the wrong success metric for this segment. Track free-lesson start and lesson-to-purchase. Checkout starts from pricing could even dip while paid revenue rises.

**One risk to test:** adding a free option for organic visitors could pull away some of the 27% who were going to buy. I'd run it as an A/B test for organic and ship it as the default for paid-source traffic.

| | Control | Variant | Primary metric | Sample per variant (rough estimate) |
|---|---|---|---|---|
| Organic guardrail | Current page | Free-lesson CTA as secondary | Paid checkout start | ~3,400 to detect a 3-point change from 27% (80% power, 5% alpha) |
| Paid | Pricing page | Dedicated free-lesson landing page | Lesson start and lesson-to-purchase | ~1,600 to detect 9% to 12% |

**What I need to firm this up**
- A split of the paid segment by device and by new vs returning visitors. Paid social is usually mostly mobile, which could be a second problem on top of this one.
- The ad's destination URL, and whether the free lesson is actually available to anyone who clicks.
- If you share the pricing page source or a URL, I'll walk it at 375 and 1280 pixels. I can then write the hero and plan-card copy as typed section props for the frontend architect.

**Peer messages received:** none
**Open items:** the data gaps above. I have not written any files or run any tests.