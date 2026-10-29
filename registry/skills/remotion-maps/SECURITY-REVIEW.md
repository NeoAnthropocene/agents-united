# Security review — remotion-maps

Reviewed 2026-10-29 against upstream commit `30d4553ecd46fbc5212fd0ff006ae43af522158b`.

`npm run hostlib:audit -- registry/skills/remotion-maps --json` returns `needs-review`, not `pass`. All findings were inspected:

- Five `hygiene/unknown-file-type` findings cover example `.tsx` files and GeoJSON sample data under `techniques/*/assets/`. They are instructional source/data, not executable at skill load.
- One `script/credential-access` finding points to a commented example in `techniques/maptiler/assets/MapTilerVectorElement.ts`: `process.env.REMOTION_MAPTILER_KEY!`. It is a comment, contains no credential value and is not executed by the skill. Real MapTiler use requires the user's own key and provider setup; the add-on grants none.
- No prompt-injection, obfuscation, secret literal or unsafe shell finding was reported.

Decision: retain the official maps skill in the optional add-on, retain this review beside it, and require project review before copying example code that reads a MapTiler key. The add-on remains source-available and opt-in. This is a static audit plus manual inspection, not a guarantee that generated maps or example dependencies are safe or licensed for a particular project.
