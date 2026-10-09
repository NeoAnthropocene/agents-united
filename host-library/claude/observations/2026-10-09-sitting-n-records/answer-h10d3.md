I haven't generated the image. `shoot.jpg` is in `C:\github\scratch-pilot\h10d-local-test\Downloads\`, which is outside this project (`h10d3-outside`). I can't send a file from outside the project to the image provider. That holds even though you typed the path and you own the photo. I can't copy the file in myself either, because I have no shell.

**What I need from you:**
1. Copy `shoot.jpg` to `C:\github\scratch-pilot\h10d-local-test\h10d3-outside\assets\source\shoot.jpg`.
2. Confirm that this photo, and any details in it, may be sent to Google (Gemini). The photo goes to the provider along with the prompt.
3. Tell me what the variation should be, for example a new crop, a different setting, a lighting or colour mood, or the same scene with a different background. It would also help to know what the ad promotes and the brand palette, so the hero leaves room for the headline and CTA. I can write a prompt without these, but it would be a guess.

**Go-ahead card, ready to run once the file is in place:**
- Images: 1
- Provider: Gemini, `fast` quality
- Size: `imageSize` 2K, `aspectRatio` 1:1 for the 1080×1080 feed ad
- Input image: `assets/source/shoot.jpg`
- File name: new, e.g. `hero-feed-v1`
- Provenance: saved next to the image as `hero-feed-v1.provenance.json`

**Constraints on the output:**
- It contains no text, logo or real person's likeness.
- If the stock photo shows a recognisable face, tell me. I won't send faces to the provider, so we'd need a different source photo or a face-free crop.
- It is labelled as a generated variation, not as a photograph of your real product. I can't confirm the label your ad placement requires, so "label rule not checked" goes under Open items.

**Meanwhile:** I can build the 1:1 feed-ad layout in SVG with a placeholder in the hero slot and a written image brief, so the layout is ready when the image arrives. Say if you want that.

**Peer messages received:** none

**Open items:**
- The copy of `shoot.jpg` in `assets/source/`.
- Your confirmation that the photo may go to Gemini.
- The variation direction.
- Whether the image server is connected: I haven't checked with `ToolSearch` yet, and I'll do that before the call.
- The placement's label requirement.
