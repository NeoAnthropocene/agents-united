The PetPal design system is published, private, and I haven't touched its sharing: https://claude.ai/artifact/9CrVbP[elided]

Only you can open the link until you share it from the page's Share menu. This is project material leaving the repo, which is fine for a scratch exercise.

**What I did**
- **Tokens:** I built `project/tokens.json` from `docs/pilot/design-tokens.json`, in the list form Claude Design reads (from the design-system-tokens skill's reference). The nested `$value` form would show up empty on the page. Counts: 12 colours (6 palette, 6 role aliases that all point at palette colours), 1 font family, 3 type styles, 4 spacing steps and 2 radii.
- **Brand book:** `project/README.md` has what the source states, its two rules, and a contrast table. It also lists what the source doesn't cover.
- **Cover:** The system type requires a cover (`components/Cover/preview.html`). I made one from palette colours, with a pattern of discs and pills.
- **Index:** `project/design-system.json` is the required index file.
- **Read-back:** I read all four files back after the first publish. Token content and README are as written. I then corrected two overclaiming sentences (one in the README, one in the cover's derivation comment) and republished. I did not read the corrected README or cover back, and neither the new README nor the new cover was checked. The artifact is now at version 4.

**What I did not check**
- **Rendering:** I didn't render or look at the page. The cover layout (the name and tagline fitting the left zone, nothing crossing it) is checked only against my own numbers, not by eye.
- **Contrast figures:** The README's contrast ratios are hand-computed from the hex values, not run through a tool, and the README says so.
- **Parsing:** I had no shell, so `tokens.json` was not parsed by a tool. I checked by eye that names are unique and aliases resolve.
- **File sizes:** The sizes the listing reports were not compared with byte counts of what I wrote.
- **Dropped values:** I can't see which values the page itself drops. For example, whether `font.size` entries without weights or line heights display fully.

**Placeholders and gaps**
- **Placeholder time:** Both timestamps in `design-system.json` are `2026-10-08T00:00:00Z`, because I have no clock.
- **Invented tagline:** The cover tagline, "Everyday care for pets and the people who feed them.", is mine. The source has no tagline, and the README says so.
- **Empty usage notes:** 15 of 18 colour, spacing and radius tokens have an empty usage note, because the source gives only two. The headline style's note comes from the source. Nothing was invented to fill them.
- **Missing from the source:** No dark theme, font weights, line heights or font files.

**Not done**
- I did not write a `claude-design-tokens.json` next to the source in `docs/pilot/`. The published `tokens.json` is that conversion. I can add the copy if you want the repo to hold it.
- The design-system type is on contract 0.2.47 and the newest is 0.2.74. I left it as the type set it.
