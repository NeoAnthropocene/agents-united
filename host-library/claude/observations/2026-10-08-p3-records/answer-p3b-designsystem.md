The PetPal design system is published and private (only you can open it): https://claude.ai/artifact/SuSxY8[elided]

**What I did**
- **tokens.json:** I converted `docs/pilot/design-tokens.json` into the list form Claude Design reads, following the design-system-tokens reference. The nested `$value` form shows empty on the page.
  - Colour has one `light` theme: six colours and six roles. The role tokens are aliases, for example `text-default` → `{cocoa-900}`.
  - Type has one family and three styles: headline 96px, body 36px, caption 28px.
  - Spacing has four steps and radius has two.
- **README.md:** It has role-to-colour and contrast tables, type, space and shape, and three rules.
- **Cover:** The type requires one, so I added `components/Cover/preview.html`. It uses cocoa, clay, sand and cocoa-600 blocks with a disc pattern, chosen because the system's only extra shape is the pill radius.

**What I did not check**
- **No render and no re-read:** I didn't open the published page or re-read the files after writing them. The cover's layout and the page's parsing of `tokens.json` are unchecked. I also didn't verify the `--clay-600`-style variable names I used in the cover. Open the page and look at the cover and the Colors tab.
- **Contrast figures:** I calculated them by hand with the WCAG formula, and no tool checked them. The two weak pairs are `text-muted` on clay at about 1.4:1 and `text-default` on clay at about 3.0:1. Both are noted in the README.
- **Dropped or empty fields:** The `headline` note ("for 1080 px wide canvases") has nowhere to live in the format, so it appears only in the README. Eleven of the twelve colour tokens, plus all spacing and radius tokens, have an empty `usage` because the source had no description for them. I didn't invent any. Say if you want me to write those notes.
- **Not supplied:** The source has no dark theme, weights, line heights, logo, icons or voice. The README says so and doesn't make any up.
- **Sharing:** I can't change sharing. Others can't open the link until you share it from the page's Share menu.
