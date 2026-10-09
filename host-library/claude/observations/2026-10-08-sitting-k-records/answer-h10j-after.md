I wrote the prototype to `docs/pilot/prototype/index.html`. It's a single file, so you can open it directly in a browser. I haven't opened it in a browser, so none of it has been run. I re-read the file after the last edit: 157 lines, and the markup and script look right on reading.

**How it clicks through**
- The screen shows three sitters, each with a **Book now** button: Maya Okafor ($38 per night), Tom Brennan ($45) and Ines Duarte ($32).
- Book now opens a confirmation dialog that shows the sitter, the pet, the dates and the price. It has **Cancel** and **Confirm booking**.
- Cancel, Esc or a click outside the dialog closes it and leaves the card unchanged.
- Confirm booking turns that card's button into a disabled **Booked** and shows "Booked with …" on the card. You can book more than one sitter, because there was no rule against it.

**Design choices**
- **Colours, spacing, radii and font family** come from `design-tokens.json`. The CSS copies the resolved values and names each token in a comment.
- **Contrast** (my calculation, not run through a checker):
  - Body text on cream is far above 4.5:1.
  - Muted text on cream is about 7.5:1, and on sand about 5.7:1.
  - The white label on the clay button is about 5.5:1.
- **Accessibility:** it uses the native `<dialog>`, so focus is trapped inside it. Focus returns to the button after Cancel and moves to the booking status after Confirm. Focus rings are visible, buttons are at least 48px tall, and no animation is added beyond a short hover fade.
- **No photography:** each sitter gets a monogram on sand, with a different shape per sitter (circle, rounded square, arch). They are placeholders until real photos exist.

**Open items**
- The token file has no type sizes for a phone screen. Its 96, 36 and 28px sizes are for 1080px-wide canvases, so the prototype uses its own 32, 16 and 14px, marked as prototype-local in the CSS. Someone should add real screen-size tokens before the frontend architect builds this.
- Sitter names, bios, prices, the pet name "Biscuit" and the dates are invented sample data. The page says "sample sitters and dates", and none of it should be treated as a real claim.
- Nothing needed a shell command.

Peer messages received: none.
