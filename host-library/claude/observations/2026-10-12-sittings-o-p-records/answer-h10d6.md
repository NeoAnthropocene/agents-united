I made no image. The call failed because the image server has no Seedream key set: it returned `CONFIG_ERROR: provider "seedream" is not configured`. That failed call counts as attempt 1 of this asset. I didn't switch providers, because a different provider needs your go-ahead. I also didn't ask for or touch a key.

**What I need from you or the lead**
- Set `ARK_API_KEY` on the image server, in the BytePlus ModelArk AP region. The lead's `mcp-setup` prints the command. Then restart the MCP server and tell me to retry.
- Or give a go for another provider. Gemini `fast` at 2K is about $0.0504 and takes 4:5. OpenAI has no published per-image price, so its first image is a probe.

**The call, ready to send once the key is set**
- Go: 1 image, Seedream, 2K, 4:5, `fileName` `petpal-hero-sofa-a1`. Estimated cost is $0.09 (Seedream at 2K), against $0.80 of budget.
- Prompt, sent as written: "A photograph of a person and a golden retriever sitting together on a cream linen sofa in a bright living room, seen at eye level from slightly in front. The person wears an oatmeal knit sweater and rests one hand on the dog's back; the person is framed from the shoulders down, so the face is out of the frame. The dog looks up calmly with a soft, relaxed expression, its head near the person's lap. Warm window light from the left, gentle long shadows across the cushions, a shallow depth of field with the dog in sharp focus. The sofa and the pair fill the lower two thirds of the frame; the upper third is an even, plain cream wall with nothing on it. Palette: cream, warm sand, soft golden fur and one muted sage green cushion. Natural, unposed and cosy, shot on a 50mm lens."
- Faceless sitter: I kept the sitter's face out of frame on purpose. A generated face would read as a real sitter, or as a customer or endorser, and we mustn't invent one. If you want a visible face, say so, but it can't carry a name or a quote.
- Copy zone: the plain cream wall in the upper third is where the headline overlay goes. Overlay text is not generated into the picture.
- Prompt rewriting: Seedream rewrites prompts on its own side. I'd judge the result against the brief and note that in the record.

**After the call**
- I'll open the file with `Read` and check the hands and dog anatomy, stray lettering, the copy zone and the palette.
- I'll write `petpal-hero-sofa-a1.provenance.json` beside it.
- If I regenerate, the new file gets a new name, with at most two regenerations.

**Open items**
- Seedream key missing: the lead and user must set `ARK_API_KEY` and restart the server, or give a go for another provider.
- Label rule not checked. A generated image used in Meta or Google ads may need a label, so the lead or user should confirm the platform's current rule. Never present this as a real photo of the client's sitters, product or customers.
- After the file exists, the lead should run `image-check.mjs --stamp` for size and hash. I have no shell.
- Peer messages received: none.
