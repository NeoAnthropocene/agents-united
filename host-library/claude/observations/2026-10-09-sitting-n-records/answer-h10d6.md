I made no image. The image server has no Seedream key configured, so the one call failed with `CONFIG_ERROR` ("provider seedream is not configured on this server"). Nothing was generated or saved, and the call cost nothing. I didn't switch to Gemini or OpenAI: your go named Seedream, and another provider needs its own go.

**To unblock it:** whoever runs the image server needs to set the Seedream key (`ARK_API_KEY`) in the server's own environment and restart it. Don't paste the key into this chat. Alternatively, say go for another provider, with its size and price.

**The call, ready to run once Seedream is configured:**
- **Provider:** Seedream, 2K, 4:5, one image, saved as `feed-hero-sitter-dog-sofa-4x5-v1`.
- **Prompt:** a candid, warm lifestyle photo of an adult pet sitter in an oatmeal knit sweater on a terracotta sofa. A golden retriever rests its head on their lap, with soft window light from the left. The subjects sit in the lower two-thirds of the frame. The top third is a clean, softly blurred area left clear for the headline. Palette: cream, terracotta, sage and honey. It asks for no text, logo or real person.
- **Rung:** generated, because you have no photography and no licensed stock has been chosen.

**What happens after the image arrives:**
- I'll open the saved file to check the dog and hands, any stray lettering, the empty headline area and the palette. I'll regenerate at most twice, each time changing one instruction.
- I'll write a provenance file beside the image: provider, model, exact prompt, parameters, your go, and the estimated cost.
- Seedream rewrites prompts, so the recorded prompt will be the one I sent.

**Rules for using it:**
- **Not a real photo:** It must not be presented as a real photograph of your sitters, of a customer, or of the client's real dogs or home. It's a generated stand-in, so the sitter and dog aren't real people or pets.
- **Label:** I haven't checked whether the ad platform or your market requires an AI-image label. Treat that as unchecked until someone confirms it.
- **Headline:** The headline stays a live text overlay on a scrim. I'll check its contrast pair against the photo (AA 4.5:1) once I can see the image.

**Peer messages received:** none.

**Open items:**
1. The lead or whoever runs the server must configure the Seedream key and restart it. Or give a go for another provider.
2. Once the image exists, someone with a shell should run `image-check.mjs <folder> --stamp`. I have no shell, so I can't record file size or hash.
3. Please confirm the AI-image label requirement for the placement.
