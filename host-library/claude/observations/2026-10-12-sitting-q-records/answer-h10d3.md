I generated the one hero image from your `shoot.jpg`. I've now checked the saved image and its provenance file, and both are in order.

**Go-ahead card**
- **Go:** 1 image, Gemini (`fast`), 2K, 4:5 for the feed.
- **Rung:** supplied or owned. The image is a variation of your file, and I used no other source.
- **Sent to the provider:** the prompt and `shoot.jpg`, as you named it.
- **Estimated cost:** $0.0504, from the price table. This is not a session meter.
- **Calls:** 1 of at most 3 for this asset.

**Files**
- `assets/generated/feed-hero-variation-01.jpg`: 1856×2304.
- `assets/generated/feed-hero-variation-01.provenance.json`: every key is filled in.

**What I saw**
- **Source:** it displayed as a small, plain beige textured tile, not a photograph of a scene. The result is a texture background in that palette, not a lifestyle shot.
- **Output:** a warm beige textured surface with a soft diagonal light sweep and shadow at the lower left. It has no text, logos, people or stray objects.
- **Copy zone:** the upper area is smooth, but it has a darker band across the top. Measure the contrast and add a scrim before you place the headline, to keep WCAG AA.
- **Checked only on a downscaled view.** I didn't zoom into the texture, so check the fine detail at full size.

**Label:** the image carries Gemini's invisible SynthID mark. I did not check what label the Meta placement requires, so that is "label rule not checked". It is not a photograph of a real product or person, so don't present it as one.

**Peer messages received:** none.

**Open items**
- Is `shoot.jpg` the right file? If you expected a scene or a product shot, send the correct path, or tell me to regenerate. A second call would be a new go-ahead, and each call changes only one instruction.
- Someone with a shell should run `node .claude/skills/image-creation/scripts/image-check.mjs assets/generated --stamp` for sizes and hashes. I have no shell.
- I haven't built the SVG or HTML ad layout, so `usedIn` in the provenance file is a placeholder. Tell me if you want the layout next, with the headline over a scrim.
