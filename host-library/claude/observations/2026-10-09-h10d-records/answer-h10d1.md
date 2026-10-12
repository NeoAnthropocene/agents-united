I haven't generated anything yet. The image tool is connected, but generating costs money and sends the prompt to a provider, so I need your go first. I wrote no files and made no calls.

**Where each source stands**
1. **Supplied or owned photo:** none, and I found none in the project.
2. **Licensed stock:** your choice. If you pick a licence, I'll design around that file.
3. **Generated:** available, and the one I'd use. It needs your go.
4. **Placeholder:** I'll build the feed ad with a clearly marked PHOTO frame in the hero slot, so the layout can be signed off and the real image dropped in. I won't draw a fake photo in SVG.

**Go-ahead card**
- **Image:** one 4:5 feed hero (1080×1350). A sitter and a dog on a sofa in warm, natural window light. The sitter is a generic, unidentifiable person. There's no text or logo, and a calm area is left clear for the headline and call to action.
- **Provider and model:** Gemini `gemini-nano-banana-2.1`, `fast` quality. This is the default, and the quality tier is `fast` unless you name another.
- **Size:** 2K, which is enough to ship. You can start at 1K to explore.
- **Estimated cost:** $0.05 for one image. Worst case is three calls (the first plus two regenerations) at $0.15. That is well inside the $0.80 budget.
- **Where the words go:** the prompt goes to Google under your own key. There's no input photo and no client data in it.
- **Billing:** image models have no free tier, so the Google account needs billing enabled. If it doesn't, the call will fail with a quota error and I'll stop.

**Limits on what it can show**
- It will be an AI-generated scene. It must not be presented as a photo of a real sitter, a customer or your actual service, and it can't carry a testimonial or a named person.
- Check whether the Meta placement needs an "AI-generated" label. I haven't verified that, so it goes under Open items. I'll record the prompt, model, cost and your go beside the file.

**To go ahead, tell me:**
1. Do I generate with the card above (1 image, Gemini `fast`, 2K, 4:5)? Or do you want a different provider, size or count?
2. What is the brand name, palette and logo? What does the ad sell, for example dog sitting or walking, and where? Without these I'll use a neutral warm palette and generic copy slots.

**Open items**
- Your go and the answers above.
- The label requirement for AI imagery on Meta.
- Once the image exists, someone with a shell should run the hash and size check: `node C:/github/scratch-pilot/h10d-local-test/h10d1-no-go/.claude/skills/image-creation/scripts/image-check.mjs <folder> --stamp`. I have no shell.
- Peer messages received: none.
