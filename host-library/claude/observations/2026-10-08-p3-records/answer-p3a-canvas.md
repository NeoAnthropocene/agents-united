The PetPal canvas is published with all three artboards: the 4:5 feed ad (1080×1350), the 9:16 story (1080×1920) and the 1.91:1 link ad (1200×628). It's private, readable only by you. Anyone else needs it shared from the page's Share menu, which I can't do.

Link: https://claude.ai/artifact/QiKSxb[elided]

**What I did**
- **Design system:** I used only `docs/pilot/design-tokens.json`. Colours, Helvetica/Arial, the 96/36/28 px type sizes, the spacing steps and the 12px and pill radii are in the artboards as literal values. I attached no other design system.
- **Copy:** `hero.ts` is verbatim: headline, subhead, "Book now" and the three figures. The book button is clay with a white label and carries `data-testid="hero-primary-cta"`.
- **Layouts:** The feed ad and the story stack wordmark, headline, subhead, a sand panel of the three figures, then the button. The link ad is two columns: copy and button on the left, a sand paw-mark panel on the right. It uses the proof line "4.9 average rating, 12,000 stays" instead of the figures panel.
- **Story safe zone:** I left 250px clear at the top and 340px at the bottom. Those two numbers are my assumptions about where story UI overlays sit.
- **Contrast:** I worked out the pairs by hand from the token hex values. White on clay is about 5.5:1. Muted text on sand is about 5.7:1. Default text on cream is very high.
- **Notes on the canvas:** There's a title note, plus a sticky saying PetPal is fictional and the figures must not run.

**What I did not check**
- **Rendering:** I didn't open or screenshot the canvas, so I haven't seen the layouts. I didn't confirm that the 96px headline and the stacked copy fit the link ad's 628px height, or that no text overflows on any artboard.
- **Contrast:** The ratios above are hand-calculated, not measured with a tool.
- **Platform specs:** The story safe-zone numbers and the three formats' current specs are unchecked against Meta.
- **Files:** I didn't re-read my files after writing them. The canvas accepted each publish.
- **Editing:** I didn't try editing in the browser.
- **Claims:** The rating, the 12,000 stays and the $1M insurance are invented and unsubstantiated, as `hero.ts` says. They're on the ads as written, so they need claims review before any real use.
- **Imagery:** There are no photos or illustrations, only type, colour blocks and a simple paw mark. That's my choice, not something the tokens asked for.

**Open items**
- None blocking.
- Gmail and Google Calendar need authorizing in your claude.ai connector settings. I didn't need them here.
