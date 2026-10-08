The banner fails on the CTA, the text contrast, and the placement of text and CTA inside the safe zone. I changed nothing. The contrast ratios below are estimates from colours I eyeballed in the PNG, because I can't sample pixels here. Re-measure them before sign-off.

I reviewed the banner as 1080 x 1350 against `docs/pilot/design-tokens.json` and the safe-zone rules in the `ad-creative-design` skill. The 4:5 size and its safe zone are the skill's typical values. They still need checking against the platform's current spec before export.

**Priority order**

1. **Rebuild the "Book now" CTA.**
   - It is a grey pill (about #CCCCCC) with a pale grey label, roughly 1.3:1 contrast, so it looks disabled. It also reads as a fake disabled control, which the "no deceptive UI" rule rules out.
   - Use `cta.primary` (clay.600 #B5451B) with a `text.on-action` (white) label. That pair is about 5.5:1 and passes.
   - The pill is clipped at the right canvas edge (x=1080). Move it fully inside the safe zone, and make it larger and closer to the proof. Keep the height at 48 px or more.

2. **Fix the headline contrast.**
   - The cream headline sits on a tan circle (about #E0A86A) at roughly 2:1, below the 3:1 minimum for large text.
   - Use `text.default` (cocoa.900) on the `surface.accent` / `surface.base` tokens. That pair is about 7 to 8:1 or better.
   - Don't use cream text on a tan fill.

3. **Fix the subline.**
   - It is about 17 px, under the 24 px floor and the 28 px `caption` token (`body` is 36 px).
   - It is a muted brown on tan, about 3.7:1 against the 4.5:1 required.
   - The token note says `text.muted` is "never on clay", and the tan circle is a clay-like fill. Put it on cream or sand, or use `text.default`.
   - It also spills past the circle edge at about x=550.

4. **Bring text and CTA inside the safe zone.**
   - Text starts at x=80 and the CTA runs to the canvas edge. The skill says to keep text inside the central 80 percent, which means margins of about 108 px horizontally and about 135 px vertically.
   - The stats badge at y≈1230–1300 sits in the bottom 10 percent (y>1215), where the caption overlay covers it. Move it up.
   - Check that your platform's safe zone matches this one.

5. **Remove the circle clutter and restore the hierarchy.**
   - The two circles carry no meaning. The right one is empty, and the left one cuts through the headline.
   - The reading order should be hook, value proposition, proof, CTA. Right now the proof is stranded at the bottom, and the CTA is weak and off to the side.
   - Either put the pet or sitter photo in the empty circle or delete both circles. If you delete them, a solid token surface gives the headline a clean field.
   - Stack headline, subline, CTA and proof in one left-aligned column with space steps 4 and 8 (32 and 64 px).

6. **Put the background and colours back on tokens.**
   - The tan gradient and circle fills are not in the token set. The set only has cream.50, sand.300, cocoa and clay.
   - Use `surface.base` or `surface.accent`, with at most a subtle in-palette gradient.

7. **Leave the proof badge mostly as is.**
   - Its white-on-cocoa contrast is high (about 15:1), and it uses `radius.md`.
   - Only reposition it as in point 4. At about 30 px the text clears the minimum but is smaller than `body`, so consider 36 px.

**For other owners**
- **Defne (claims review):** "insured up to $1M", "4.9 average rating, 12,000 stays" and "Background-checked" need sources before launch.
- **Kaan (copy owner):** I haven't changed or invented any copy, including the headline.

**Peer messages received:** none.
**Open items:**
- I need the platform and placement spec, with the date read, to confirm the 4:5 safe zone.
- I can write the corrected SVG or HTML mockup and variant hooks if you want them, but I wasn't asked to edit anything.
- I can't task-track here, so I left no task status.
