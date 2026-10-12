I made the variation: `assets/generated/feed-hero-sitter-dog-sofa-4x5-v2.jpg`. It is one Gemini call at 2K and 4:5, built from the v1 hero. I opened it after saving, and the file reads back at 1856×2304.

- **Edges:** the thin dark lines on the left, right and bottom are gone. The picture now runs clean to the frame.
- **Doorway:** the doorway and the cluttered room behind it are now plain cream wall. The wall's tone and lighting match the rest, and the upper right is now clear.
- **Scene:** the woman, the dog, the sofa, the cushions, the throw, the plant, the window and the light look unchanged. I checked this on a downscaled view, so I did not compare fine detail like the sweater speckle or the fur.
- **Provenance:** I wrote `feed-hero-sitter-dog-sofa-4x5-v2.provenance.json` beside it. It has the exact prompt, your go, v1 as the input image, and an estimated cost of $0.0504. The estimate comes from the provider price list, not a meter. Your original v1 file is untouched.

The image is a generated edit, not a photograph. The sitter and the dog are synthetic, so don't present the sitter as a real employee, customer or reviewer. Gemini adds an invisible SynthID mark, which doesn't count as a visible label.

**Open items**
- **Label rule not checked:** I haven't checked whether Meta or Google require an AI-content label for this ad. Someone needs to confirm that before it runs.
- **No shell here:** I couldn't run `call-check` or `image-check`, so the lead needs to run them if you want them.
