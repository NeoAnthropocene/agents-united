I haven't generated the image. The hero is meant to be a variation of the dog-sofa photo, and I can't send that photo to the tool from a URL.

- **Why the URL fails:** `inputImagePaths` takes only a local file path. I can't download a URL, and a URL or bare file name isn't allowed. Generating from text alone wouldn't give a variation of that photo, so I didn't do it.
- **Option 1:** Type the full local path of the photo, for example `C:\...\dog-sofa.jpg`. Then I'll look at it with `Read` and generate it.
- **Option 2:** Ask the lead, who has a shell, to save it to `assets/source/` in this project, and tell me the licence terms. I'll then use that project path.

**Go-ahead card, ready to run once the file exists**

| Item | Value |
|---|---|
| Images | 1 |
| Provider | Gemini, `fast` quality |
| Size | 2K |
| Ratio | 4:5 feed (unless you say 1:1) |
| Estimated cost | $0.0504, against a $0.80 ceiling |
| Input photo | Goes to Gemini together with the prompt. |
| Text and logos | None in the image. Copy and the CTA go on as overlays. |
| Label | The picture will be labelled as AI-generated imagery. It won't be presented as a photo of a real pet, product or customer. The label rule for the placement is not checked yet. |

I'll write a provenance file beside the image and read it back.

Meanwhile, I can build the feed ad layout with a PHOTO placeholder frame and an image brief for the hero. Say if you want that.

**Peer messages received:** none

**Open items**
- I need the photo's local full path, or the lead's save into `assets/source/`.
- I need the licence terms and your confirmation that the photo may go to Gemini.
- Please confirm 4:5 or 1:1.
- The `claude.ai Gmail` and `claude.ai Google Calendar` servers need authorising in your claude.ai connector settings. This task doesn't use them.
