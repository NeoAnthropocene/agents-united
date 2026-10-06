**Diagnosis:** the ad's promise doesn't match what the page shows. Paid-social visitors clicked "free first lesson" and landed on a page that only shows a price. They reasonably read that as bait-and-switch and leave. Organic visitors never saw the promise and arrived expecting a paid plan, so they convert at 27%.

I couldn't audit your live page. The pricing page isn't in this repo, and the `conversion-funnel-optimization` skill is disabled for model invocation. I read its worked example, which describes this same pattern. That example uses invented numbers, so it's a pattern match and not evidence about your page. This diagnosis comes from your three numbers and the ad text, and I haven't seen your page or session data.

## What to change

1. **Show the free lesson on the pricing page, above the paid plan.** This is a fix to ship now, not a test. Give the free lesson a clear primary CTA, with the paid plan as a secondary route. Check first that the free lesson really is free: no card and no hidden trial conversion. If it isn't, change the ad instead. A fake "free" is a dark pattern, and I won't write copy for it.
2. **Send paid social to a free-lesson landing page, not the pricing page.** Keep the pricing page for intent-driven traffic like organic. Matching the ad's offer is usually the bigger win.
3. **Change how you judge success for paid social.** Once the free lesson is visible, fewer of these visitors will start checkout straight from pricing. That's expected. Measure free-lesson start, then lesson to paid, then revenue per paid-social click. Judging only on checkout starts would make a good fix look like a failure.
4. **Check the confound.** Cold social traffic converts below organic even with perfect message match. Don't expect 9% to reach 27%. Segment by device too, because a mobile layout problem could be hiding inside the same numbers.

## Draft copy for engineering

```typescript
export interface PricingFreeLessonProps {
  freeLesson: {
    headline: string;
    body: string;
    cta: { label: string; href: string; testId: string };
    microcopy: string;
  };
  paidPlanIntro: string;
}

export const pricingFreeLesson: PricingFreeLessonProps = {
  freeLesson: {
    headline: "Start with the free first lesson",
    body: "Try lesson one before you pay for anything.",
    cta: {
      label: "Start free lesson",
      href: "/lessons/first", // placeholder: confirm the real route
      testId: "pricing-free-lesson-cta",
    },
    microcopy: "No card required.", // keep only if verified true
  },
  paidPlanIntro: "Ready for the full course? Choose your plan.",
};
```

The `href` and the "No card required" line are placeholders. Confirm both against the real flow. The CTA needs a contrast ratio of at least 4.5:1 and a target of at least 48×48 px.

## Experiment brief for the landing-page routing

| Item | Value |
|---|---|
| Control | Paid social → current pricing page |
| Variant | Paid social → free-lesson landing page (or the pricing page with the free-lesson block from item 1) |
| Primary metric | Visitors who start the free lesson or checkout, then paid conversion per click |
| Guardrail | Lesson-to-paid rate, refund rate |
| Minimum detectable effect | 9% → 12% (about 33% relative lift) |
| Sample size | About 1,640 paid-social visitors per variant (95% confidence, 80% power; my calculation, not run through a tool) |

I haven't run anything or written any files. If you want, I can save this as `docs/cro/pricing-free-lesson.md`. For a deeper audit, send me the pricing page source or a URL, plus the mobile/desktop split of the 9%.

**Peer messages received:** none.
**Open items:**
- Does the free lesson need a card or signup?
- The pricing page source or URL.
- Device split for paid social.
- The `conversion-funnel-optimization` skill is disabled in `skillOverrides`. Enable it if you want a full teardown.