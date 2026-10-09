# Writing the prompt

The model reads a description of a scene better than a list of keywords. Write sentences, as a photographer would brief an assistant. The tool takes 1 to 4,000 characters; write in English whatever language the brief is in, because the provider lists English among the languages it performs best in.

## The parts

| Part | What to say | Example |
|---|---|---|
| Subject | Who or what, doing what, in one sentence | a sleepy golden retriever curled on a sofa |
| Setting | Where, and what surrounds it | a sunlit living room, a cream linen sofa, a plain wall |
| Light | Direction, quality, time of day | soft window light from the left, early morning, gentle shadows |
| Camera | Lens, height, distance, focus | 50mm lens at eye level, shallow depth of field, focus on the face |
| Composition | Where the subject sits and what is empty | the dog in the lower two thirds; the upper third even and uncluttered |
| Copy zone | The region the headline will cover, kept plain | the upper third is an even cream wall with no objects |
| Palette in words | The tokens as colour words | cream, warm sand and one muted terracotta cushion |
| Wanted, not unwanted | The positive form of every "no" | an empty, plain wall, not "no clutter" |

The provider's own guidance says the same: be hyper-specific, give the purpose, use photographic language for the camera, and describe the scene you want instead of listing what to leave out (a semantic negative: "an empty, deserted street" instead of "no cars").

## What to leave out of every prompt

- Text, letters, numbers or a slogan: raster text drifts. The copy is an SVG or HTML overlay on a clean region (the copy zone).
- A logo, a brand name or a trademark, yours or anyone's.
- A real person's name, a lookalike, or a named customer.
- Hex codes as an instruction: the model reads colour words, not exact values. Match the exact tokens in the design (a scrim, a tint), not in the picture.
- Client secrets, personal data and unreleased product details: the prompt goes to Google.

## One placement, one ratio, one size

Pick the ratio from the placement. Pick the smallest `imageSize` whose pixel width is at least the placement's width; use 1K to explore and 2K to ship. The pixel sizes are the provider's, read on 2026-10-08, and are the same for the three models.

| Placement | aspectRatio | imageSize | Pixels at that size |
|---|---|---|---|
| Feed 4:5 (1080 x 1350) | 4:5 | 2K | 1856 x 2304 (1K is 928 x 1152: too small, it would be upscaled) |
| Story 9:16 (1080 x 1920) | 9:16 | 2K | 1536 x 2752 (1K is 768 x 1376) |
| Banner 16:9 (1920 x 1080) | 16:9 | 1K or 2K | 1376 x 768, or 2752 x 1536 |
| Link card 1.91:1 (1200 x 628) | 16:9, then crop | 1K | 1376 x 768 (1.91:1 is not offered) |
| Square 1:1 (1080 x 1080) | 1:1 | 2K | 2048 x 2048 (1K is 1024 x 1024) |

Generate each ratio of a set separately when the subject must sit differently in each (a story needs the subject low and the top third empty); do not crop one picture into all of them.

## Weak and better

Weak: `a dog on a sofa, nice, high quality, 4k, trending, no text`

Better:

```text
A photograph of a sleepy golden retriever curled on a cream linen sofa in a sunlit living room, a person's hand resting on its back, the person's face out of frame. Soft window light from the left on an early morning, gentle shadows. Shot on a 50mm lens at eye level, shallow depth of field, focus on the dog's face. The dog sits in the lower two thirds of the frame; the upper third is an even, plain cream wall with nothing on it. Palette: cream, warm sand, one muted terracotta cushion. Natural and unposed.
```

Why it is better: it gives a subject, a setting, light and a lens; it keeps a face out of frame; it makes the copy zone a plain wall instead of saying "no clutter"; and it asks for no text, logo or brand at all, so the model has nothing to draw there.

## Changing one thing

A regeneration changes one instruction: the paws, the light, the crop. Name what to keep ("the same room and light") and what to change ("each front paw separate and clearly visible"). Changing several things at once teaches you nothing about which one worked, and the cap is two regenerations.
