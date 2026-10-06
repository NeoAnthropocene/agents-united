**Fix the pricing page on phones first.** `pricing.html` has no viewport meta tag and a fixed 960px layout, so phones show it as a shrunken desktop page. That is the likely reason mobile looks worse. I only read the source. I didn't render any page or walk it at 375 or 1280px, and you didn't give me a device split, so the mobile link is a strong inference, not a measurement.

The full audit is in `docs/cro/2026-10-06-paintdaily-funnel-audit.md`.

## The funnel

| Step | Visitors | Step rate | Cumulative |
|---|---|---|---|
| Landing | 18,400 | | 100% |
| Pricing | 7,360 | 40.0% | 40.0% |
| Checkout started | 1,470 | 20.0% | 8.0% |
| Paid | 590 | 40.1% | 3.2% |

The biggest leak is pricing to checkout, where 80% leave. Checkout then loses another 60% of the people who start it. I have no sourced benchmark, so I'm not quoting one.

## What to fix first

None of these need a redesign. In order:

1. **Pricing page on mobile.**
   - Add `<meta name="viewport" content="width=device-width, initial-scale=1">`.
   - Replace the fixed 960px widths with `max-width:960px; width:100%`, and stack the one-plan table as a card on narrow screens.
   - The Buy button is 12px text with 4px padding, roughly 40×22px. Make it at least 48×48px, 16px or larger, labelled "Buy the course, 149 USD", with a visible focus outline.
2. **Card field on checkout.** It requires exactly 16 digits (`pattern="[0-9]{16}"`) but the placeholder shows spaces. Anyone who types the spaces is blocked, and so are 15-digit Amex cards. Remove the pattern and add `inputmode="numeric"` and `autocomplete` attributes. The form also has no CVC field and takes raw card numbers on your own page. Ask your developer whether the live site uses the payment provider's hosted fields.
3. **Checkout fields.**
   - Remove phone, company and address line 2. All three are required today, for a download course.
   - Keep name, email and card.
   - Keep the address fields only if your payment provider or tax rules need them.
   - Put each field on its own line.
4. **Price and button on checkout.** Show "Full course, 149 USD, 12 months access" above the form and change "Submit" to "Pay 149 USD".
5. **Refund line.** Pricing says "Questions about money back? See our terms." It isn't a link and states no policy. If you have a refund policy, state it in one line next to Buy. If you don't, I won't write one for you.
6. **Free lesson.** The landing page promises a free first lesson, but its only link is "See pricing". Link it if the free lesson exists.

Fixes 1 to 4 are defects, not test candidates, so ship them directly. Testing a broken step only measures the bug.

## Testing

One test is worth running: the refund line on pricing. It needs about 2,800 visitors per variant, roughly 22 days, to detect a 3-point lift on the 20% baseline. Run it after fixes 1 to 3 ship. Checkout is too thin to test, at about 52 starts a day. If you shipped everything and pricing to checkout went from 20% to 30%, paid would go from 590 to about 883. That is arithmetic, not a forecast.

## What I need from you

- Counts for each step split by device, and by traffic source if you have it. This confirms the mobile diagnosis.
- Whether a refund policy and a free first lesson exist.
- Whether card entry is hosted by your payment provider, and whether you need the address for tax.
- Walk the three pages at 375 and 1280px after the fixes. I put this on the report's open items for Emre or Deniz, whichever of you has a browser.

I didn't edit any site files. I can write the pricing and checkout copy as typed section props for your developer if you want.

Peer messages received: none.

Open items: the data and policy questions above. The shared task list wasn't used, so I made no status updates.