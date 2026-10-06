**Fix the pricing page for mobile first.** Only 20% of pricing-page visitors start checkout (1,470 of 7,360). That step loses 5,890 people, more than checkout does. I only read the HTML. I didn't render the pages or measure anything, and I haven't confirmed your mobile claim, because I don't have a desktop-versus-mobile split.

**Funnel from your counts**
- Landing to pricing: 40.0%
- Pricing to checkout started: 20.0%
- Checkout started to paid: 40.1%
- End to end: 3.2%, which is about 87,910 USD at 149 USD.

**Fix order**
1. **Pricing page, today (`pricing.html`).** These are bugs, so ship them without a test. This matches your mobile symptom, though I haven't confirmed it on a device.
   - There is no `<meta name="viewport">` tag, so phones shrink the page.
   - The body and table are fixed at `960px`, with a six-column table for a single plan.
   - The "Buy" link is 12px text with 4px padding, about 22px tall by my estimate. Make it at least 48px tall and label it "Get the full course, 149 USD".
2. **Checkout, this week (`checkout.html`).**
   - Remove Company, Phone and Address line 2. A digital course doesn't need them. Check with your payment processor whether it requires a billing address.
   - The card field's `pattern="[0-9]{16}"` rejects the spaced format its own placeholder shows. It also rejects 15-digit Amex numbers.
   - Add `autocomplete` and `inputmode="numeric"` attributes, and use 16px, 48px-tall inputs.
   - Show the product and price, and change "Submit" to "Pay 149 USD".
3. **Refund line beside the Buy button.** The pricing page says "See our terms" with no link and no stated guarantee. If you really have a refund policy, state it next to the button. Please confirm the policy first.
4. **Landing page, last.** "Your first lesson is free" isn't a button, and "See pricing" is a plain text link. Making the free lesson the main button is the lowest-confidence change, so test it.

I found no testimonials, student work or customer counts on any page, and I invented none. If you have verified ones, put them on the pricing page above the button.

**Tests (sample sizes are my hand estimates)**
- **Shorter checkout form:** about 384 checkouts per arm to detect 40% rising to 50%. That is roughly 3 weeks at about 368 checkout starts a week. A 5-point lift would take about 8 weeks, so I'd skip that size of test.
- **Free-lesson button on the landing page:** about 2 weeks to detect a 3-point lift in pricing visits. The result is directional only, because it moves some sales away from the pricing page.

**Open items**
- Please send the funnel split by device. If mobile and desktop rates are close, I need to revisit the order above.
- `checkout.html` posts raw card numbers to your own `/pay` endpoint. That's outside CRO, but please ask engineering whether a hosted payment form is planned.
- The `conversion-funnel-optimization` skill isn't installed here. I used the A/B test and responsive audit skills plus my own method.
- I have no shell. A rendered check at 375px and 320px for overflow and tap-target size is still to do.
- Gmail and Google Calendar need authorizing in your claude.ai connector settings. I didn't need them here.

Files are in `docs/cro`:
- `2026-10-06-course-funnel-audit.md`