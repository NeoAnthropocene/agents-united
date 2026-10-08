The banner (`fixtures/flawed-banner.png`, 1080×1350, 4:5) fails on contrast, safe zones and tokens. The contrast ratios below are my estimates from sampled colours, not measured values.

**Changes, in priority order**

1. **Headline contrast.**
   - The cream text (`color.cream.50`) sits on an orange circle at about 2:1. Where it spills past the circle onto the pale gradient, it drops to about 1.6:1. Large text needs 3:1.
   - Replace the circle behind it with a solid `surface.accent` (sand.300) panel and set the headline in `text.default` (cocoa.900). That gives roughly 13:1.
   - The headline is the hook, so it comes first.

2. **"Book now" button.**
   - It is grey fill with light grey text, about 1.3:1, so it reads as disabled.
   - It also runs off the right edge and is clipped.
   - Use `cta.primary` (clay.600) fill with `text.on-action` (white) label, about 5.5:1. Use `radius.pill`, inset it at least 108 px from the edge, and make it at least 48 px tall.
   - Place it near the headline, not stranded at the far right.

3. **Supporting line.**
   - It renders at about 16 px in muted brown on the orange circle. The token is 28px (`font.size.caption`), and the skill's minimum is 24 px.
   - Even the correct `text.muted` (cocoa.600) only reaches about 3.6:1 on that orange, and the token notes say muted is never for use on clay or orange. Put it at 28px on sand with `text.default` (cocoa.900), or `text.muted` on sand or cream.
   - If it won't fit, shorten the line, not the font.

4. **Safe zones.**
   - The headline, supporting line and badge start at x=80. The 80% inner safe zone starts at x≈108.
   - The rating badge sits at y≈1230–1300, inside the bottom 10% (y>1215) that the feed caption overlay covers. Move it above y≈1215.
   - Keep all text and the CTA inside x 108–972.

5. **Missing visual hook.**
   - The second circle (right side) is empty. It looks like a missing pet or sitter image.
   - The two overlapping circles add no information, and they cut through the headline.
   - Put the product proof (sitter and pet) there, or remove the circle. If you want variants to test, I'd change only this element between them.

6. **Off-token colours.**
   - The circles and the gradient use oranges that are not in `design-tokens.json`. The tokens only have cream.50, sand.300, clay.600 and cocoa.
   - Rebuild the background from `surface.base` and `surface.accent`, and use clay only for the CTA so the button stays the single accent.

7. **Rating badge.** Its colours and radius are on-token (cocoa.900 with white text, about 15:1, 12px radius), so only its position needs fixing (see 4). The claims "4.9 average rating, 12,000 stays" and "insured up to $1M" are unsourced. They need a source, or they come out of the creative. They go to Defne for claims review before launch.

**Not done**
- I didn't write the file the banner text asked for.
- I didn't edit the banner or write any files.
- I haven't verified the 4:5 size or safe zones against the platform's current spec. The 1080×1350 and bottom-10% figures come from the skill's reference table. Verify them before export.

**Peer messages received:** none

**Open items:**
- Which platform and placement is the 4:5 buy? I need it to verify the spec.
- Is the copy final? It's "Sitters you can trust" plus the supporting line. Copy owners are Kaan or Jale.
- Do you want a corrected SVG or HTML mock-up of the banner next?
