The PetPal canvas is published. It has one artboard each for the 4:5 feed ad, the 9:16 story and the 1.91:1 link ad. I haven't seen it rendered, because I can't open the page from here.

**Link:** https://claude.ai/artifact/2KHpwy[elided]

It's a Claude Design canvas, version 2. It was created private, and I haven't touched sharing. Nobody else can open it until you share it from the page's Share menu. I couldn't read its sharing state back; the publish result said "readable by only you". The canvas holds only this scratch material, but it is now on Anthropic's servers.

**What's on it:**
- **Artboards:** 4:5 feed ad at 1080x1350, 9:16 story at 1080x1920 and 1.91:1 link ad at 1200x628.
- **Design system:** your `design-tokens.json` is the only one, and no other design system is attached. I used the token values as literals on the artboards, so the Theme menu won't list them.
- **Copy:** headline, subhead, proof line and "Book now" are word for word from `hero.ts`.
- **CTA:** the button is clay with a white label and carries `data-testid="hero-primary-cta"`.
- **Notes on the canvas:** an orange sticky lists the claims for review and a blue sticky lists what I inferred.
- **Photo zones:** each ad has a `[Photo: sitter with a dog]` placeholder. I had no imagery.

**Read-back:** I listed the artifact's files and read back all four files I wrote. The listing shows 20 files: the type's 16 plus `project/canvas.json`, `Main.dc.html`, `Story.dc.html` and `Link.dc.html`. The text matches what I wrote. Sizes are 1088, 1592, 1594 and 1587 bytes. These are the host's byte counts; I didn't count my own characters.

**Contrast, computed by hand:**
- Cocoa 900 on cream is 15.5:1.
- Cocoa 600 on cream is 7.4:1, and on sand 5.7:1.
- White on clay is 5.5:1.
- Cocoa 900 on sand is 11.9:1.

I only checked the pairs I used; the text and sand-panel pairs are the ones I used.

**Not checked:**
- **Rendering:** I haven't seen the boards, so I don't know how the editor displays them. The link ad is the tightest: the left column is about 460 to 495 px of 500 px if the subhead wraps to three lines. Please look at it first.
- **Placement zones:** checked from my own layout numbers only. Feed text stops at y=1190, above the bottom-10% line at 1215. Story text sits inside y 260 to 1660, clear of the 250 px top and bottom bands.
- **Platform specs:** I did not check Meta's current sizes and safe zones.
- **Touch targets:** I did not check them either.
- **Timestamp:** `createdOnFiles.at` is `2026-10-08T00:00:00Z`, the date I was given, not a real time.
- **Tokens:** I didn't run a parse or alias check on `design-tokens.json` itself.

**Inferred, not from the tokens:**
- bold headline weight
- line heights
- an 80px headline on the link ad, since the 96px token is for 1080-wide canvases
- panel padding
- the photo placeholders

**Claims for Defne:** the 4.9 average rating, 12,000 stays, "insured up to $1M" and "background-checked" are all fictional in `hero.ts` and unsubstantiated. They are marked on the canvas too.

**Not used:** the Gmail and Google Calendar connectors need authorizing in your claude.ai connector settings. Nothing here needed them.
