I wrote the clickable PetPal booking prototype to `docs/pilot/prototype/index.html`. I haven't opened it in a browser or run any check, because I have no shell here. I re-read the file with a grep for the one name I changed. It is not a full read-back.

**What it does**
- It shows three sample sitters: Mara Quill, Teo Ardent and Ines Harrow. Each has an initials avatar, services, distance, a price and a **Book now** button.
- **Book now** opens a confirmation dialog with **Confirm booking** and **Not now**. Esc also closes it.
- After you confirm, that sitter's button changes to a disabled "Booked", and a status line under the list announces it. If you cancel, focus goes back to the button you clicked.
- A visible note at the top says it is a prototype with sample data and that nothing is booked or sent.

**Tokens and choices**
- All colours, spacing, radius and the font family come from `design-tokens.json`, mapped to CSS variables.
- No photography was supplied, so the avatars are SVG initials on the sand surface rather than photos or stock images.
- The "on clay" rule is respected: the white label sits on the clay button, and the muted text only sits on cream and white.
- By my arithmetic the contrast is above 4.5:1 for every pair. White on clay is about 5.5:1, and muted cocoa is about 7.5:1 on cream and about 5.7:1 on sand. I did not measure these with a tool.
- Buttons are 48px tall and have a visible focus ring. The dialog is a native `<dialog>`, so focus is trapped inside it.

**Open items**
- The font-size tokens are set for 1080px-wide canvases. I rescaled them for a 390px phone screen, to 32px headline, 16px body and 14px caption (the 28px caption token would scale to about 12px, which I raised for legibility). Please confirm this, or add phone-size tokens.
- Please open the file and click through it once. I couldn't run a browser or a contrast checker.
- The sitter names, prices and distances are invented. I left out ratings and reviews so the prototype doesn't show fake social proof.
- The copy ("Book Mara Quill?", "Confirm booking", "Not now") is placeholder text, not final copy from Kaan.

Peer messages received: none.
