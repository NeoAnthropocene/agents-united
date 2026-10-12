I made the hero image and wrote its provenance record. I opened the image to check it, but the 4:5 hero isn't placed in any ad file yet.

**Go-ahead card:** 1 image, Gemini (`gemini-nano-banana-2.1`), 2K, 4:5. You gave the go in your message. The prompt went to Gemini and no input photos were used.

**Files**
- Image: `assets/generated/feed-hero-sitter-dog-sofa-4x5-v1.jpg`. It is 1856×2304, which is 4:5.
- Provenance: `assets/generated/feed-hero-sitter-dog-sofa-4x5-v1.provenance.json`. It holds the exact prompt, the parameters, your go-ahead and the disclosure line. I re-read only its first 8 lines after writing it. `usedIn` is empty.

**What I saw when I opened it**
- **Scene:** A smiling woman in an oatmeal sweater strokes a golden retriever resting its head on her lap, on a cream sofa. It has warm window light and terracotta and sage cushions. The hands, paws and faces look right.
- **Copy zone:** The top 40% or so is calm cream wall, so a headline fits there with a scrim behind it. Keep copy left of the doorway on the right edge, which has clutter in it.
- **Edges:** There are thin dark lines on the left, right and bottom edges. Crop 1–2% off each side in the design.
- **Texture:** The sweater and sofa show a slight speckle. It is fine at feed size.
- I used 1 call of the 2 regenerations allowed, so there is no need for a second.

**Labelling and use**
- **Not a real photo:** The sitter and dog are synthetic. Don't present the sitter as a real sitter, customer or reviewer, and don't pair the face with a name or quote.
- **Label rule:** I did not check whether Meta or Google requires an AI-content label for this placement. Check before the ad runs. Gemini adds an invisible SynthID mark.
- **Alt text:** "A smiling woman on a sofa strokes a golden retriever resting its head on her lap."
- **Cost:** The estimate is about $0.05. That is the figure from the skill template, not a charge I measured.

**Open items for the lead**
- I have no shell. Please run `node .claude/skills/image-creation/scripts/image-check.mjs assets/generated --stamp` to get the file size and hash.
- The image saved as `.jpg` even though I asked for `.png`. The provenance file uses the real name.
- Copy over the image belongs to Kaan. I will check contrast on the scrim once the headline and tokens exist.

**Peer messages received:** none.
