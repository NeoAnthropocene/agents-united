# Worked example (invented numbers, for checking your own work)

A course-signup funnel over 28 days: landing 18,400; pricing page 7,360 (40.0 percent of landing); checkout started 1,470 (20.0 percent of pricing); paid 590 (40.1 percent of checkout). Cumulative landing to paid: 3.2 percent.

## The leak and who carries it

Checkout start is the leak: 20.0 percent of pricing-page visitors against an expected 30 to 40 percent for a one-plan page (the report must name the benchmark source and date). By device: desktop 28 percent, mobile 11 percent. By source: paid social 9 percent, organic 27 percent.

## The findings

- **F1, S2, pricing page, mobile.** The plan card's button sits below a 900 px comparison table; on a 375 px screen it needs four scrolls. Evidence: a recording at 375 px, screenshot `audit/pricing-375.png`. Fix: move the primary button above the table. Principle: clarity. Moves: pricing-to-checkout on mobile.
- **F2, S2, paid social.** The ad promises "free first lesson"; the pricing page shows only the paid plan. Evidence: the ad text from the brief against the page copy. Fix: add a free-lesson link above the plan. Principle: relevance. Moves: pricing-to-checkout for paid social.
- **F3, S3, checkout.** The form asks for a phone number and gives no reason. Fix: remove it, or add "for lesson reminders only" under the field. Principle: anxiety. Moves: checkout completion.

## The backlog and the hand-offs

F1 and F2 are S2 findings, so they are fixes to ship this week, not experiments: Kaan hands F1 to Jamileh and Deniz and writes the F2 line himself as typed copy. F3 is S3 and becomes the test (ICE 6.3, invented), handed to `ab-test-setup` with checkout visitors as the audience. Emre verifies F1 on a 375 px viewport after the build.
