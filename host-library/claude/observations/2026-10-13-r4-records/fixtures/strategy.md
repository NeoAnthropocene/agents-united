# PetPal Growth Brief (scratch exercise, no real client)

Status: assumptions only. No funnel data exists; every number below is a labelled assumption to be replaced by measured data.

## 1. Bottleneck (assumed): Activation
- Definition: a visitor reaches a completed first booking request.
- Why: with no traffic or retention data, the leak we can act on is the path from landing to first request. Do not scale acquisition (paid or outreach) until this path is measured.

## 2. Target unit economics (assumptions, not data)
- Target LTV:CAC >= 3:1; CAC payback <= 12 months.
- Marketplace take rate, repeat-booking rate and sitter-side supply are unknown. Paid spend stays off until these are measured and the ratio holds.

## 3. Hypothesis H1 (ICE-scored)
- Hero CTA "Find a sitter near you" (outcome-led) beats generic "Get started" on visitor-to-search-start, target +15% relative.
- Impact 7, Confidence 6, Ease 9 = ICE 7.3 (mean of the three). Testable in under 2 weeks, copy-only change.
- Sample size and run length are set in the ab-test-setup brief once weekly traffic is known. Under ~500 visitors per week, use qualitative checks instead and say so.

## 4. Measurement plan
- Primary metric: click-through of the hero primary CTA (testId `hero-primary-cta`).
- Guardrails: search-start to completed request rate, bounce rate, page load time.
- Split 50/50 by visitor, one primary metric, no peeking before the planned sample.

## 5. Handoff (fixed contract for all downstream briefs)
- CTA colour token: `color.cta.primary` (Jamileh). CTA testId: `hero-primary-cta` (Kaan, Jamileh).
- Single primary CTA, outcome-led, no urgency tricks or fake scarcity (Kaan).
- Trust content first: sitter vetting, then reviews, above secondary content (Kaan, Yavuz).
- Yavuz: content supports the trust and search-start path; no claims we cannot evidence.

## Open items
- Real traffic, conversion and retention data; a data owner to supply it.
- Confirm the activation event is "completed first booking request" and that search start is instrumented.
