I wrote the hero section copy and saved it to `docs/cro/hero-section.md`. I re-read the file after writing, but I haven't type-checked it.

## Hero copy

- **Headline:** Send the invoice in 45 seconds. Let reminders do the chasing.
- **Subheadline:** Create an invoice in about 45 seconds. Reminders go out automatically, so you stop writing the awkward "just checking in" emails.
- **Primary CTA:** "Start free, no card needed" (links to `/signup`, test id `hero-primary-cta`).
- **Secondary CTA:** "See how reminders work" (links to `#reminders`, test id `hero-secondary-cta`).
- **Microcopy:** Free plan. No credit card required.
- **Proof line:** With reminders, 3.1% of invoices were paid late. Without them, 11%.
- **Footnote:** Based on our analysis of 2,300 invoices.

The file also has the full `HeroSectionProps` interface and a filled-in props object for the frontend architect.

## Why it's written this way

- **No problem setup.** Your visitors already know late payment hurts. The headline leads with the speed and the fix instead.
- **The stat is a plain comparison.** I wrote "3.1% vs 11%" as it is, with no "reminders cut late payments by 72%" line. Your numbers compare users with reminders against users without. They don't show that reminders caused the gap, so the plain comparison is the claim I can support.
- **No badge pill above the headline.** Your project rules ban it, so I dropped `badgeText` from the interface.

## Before you publish

1. **45 seconds:** is that the median or the mean, and for which users? I wrote "about 45 seconds" so it holds either way.
2. **"Late":** how many days past due counts as late? That belongs in the footnote. I left a bracketed placeholder there. Remove it before this goes live.
3. **How the two groups were formed:** if people who turned reminders on differ from those who didn't, the footnote should say so.
4. **`#reminders` anchor:** it must exist on the page, or the secondary CTA needs a different target.
5. **Accessibility:** both CTAs need 48×48 px minimum targets, 4.5:1 label contrast and a visible focus ring.

## Experiment and skill gap

- **Suggested test:** the current headline against an outcome-first variant, "Get paid on time without chasing anyone." The metric is visit-to-signup-start rate. I haven't computed sample size because I need your baseline conversion rate and weekly traffic. Under about 300 visitors a week, a before/after comparison is more honest than a split test.
- **Skill gap:** the `copywriting-frameworks` skill is disabled in your settings, so I wrote this without it.

Peer messages received: none.
Open items: the five publish checks above, plus the baseline conversion rate and weekly traffic for the sample-size calculation. I couldn't set the task status because I have no Task tools. The lead should handle that.