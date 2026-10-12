**No image was made.** The one Seedream call failed with `CONFIG_ERROR`: "The selected image provider "seedream" is not configured on this server." The server has no Seedream key (`ARK_API_KEY`). Nothing was generated and nothing was charged. The failed call counts as attempt 1 of 3 for this asset, and I wrote no provenance file because there's no image.

I did not ask for a key and did not switch to Gemini or OpenAI, since your go named Seedream only. Switching would be a new go from you.

**Go-ahead I used:** one image, Seedream (`dola-seedream-5-0-pro-260628`), 2K, 4:5. The estimate was $0.09. The prompt goes to BytePlus ModelArk, which rewrites it on its side.

**What unblocks it** (Open items for the lead):
- The lead runs the key setup that `mcp-setup` prints for Seedream. The user supplies the key (BytePlus ModelArk, AP region) and then restarts the MCP server.
- Or you say go for Gemini instead: `fast`, 2K, 4:5, about $0.0504.
- Then say "retry". I'll call again with the same prompt and a new file name.

**Image brief for the placeholder** (a PHOTO frame goes in the 4:5 feed ad until the image exists):
- **Rung:** generated (rung 3). No photography exists and none is licensed.
- **Subject:** a pet sitter and a golden retriever on a cream linen sofa. The sitter is seen from the shoulders down, in an oatmeal knit sweater, with a hand on the dog's back.
- **Light and camera:** warm window light from the left, shallow depth of field, 50mm.
- **Copy zone:** the upper third is a plain warm cream wall for the headline overlay. The measured contrast of the real text over it is still to do.
- **Palette:** cream, warm sand, oatmeal and one muted terracotta cushion.
- **Face:** kept out of frame on purpose. The image must not read as a real sitter or a customer.
- **Prompt for the retry:** the one I sent, kept exactly.
- **Label:** the platform's label rule for generated images is not checked (Open items). Seedream's pages state no invisible mark.
- **Use:** it is a mood image, not a photograph of a real sitter, a customer or the client's service. The ad shouldn't imply it is.

**Peer messages received:** none.

**Open items:**
1. Seedream key missing on the server. The lead should run the `mcp-setup` command, with a restart, or you can approve Gemini.
2. Platform label rule for generated images is not checked. The lead or user should confirm it for Meta.
3. After the image exists, the lead should run `image-check --stamp` on the output folder, because I have no shell.
