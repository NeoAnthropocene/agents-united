---
name: commercial-stock-sourcer
description: "Use when sourcing commercial-safe stock photos, vectors, illustrations or B-roll videos; trigger phrases: stock photo, stock video, B-roll, Pexels, Pixabay, Openverse. Skip it when generating AI images or drawing SVG."
metadata:
  author: agents-united
  version: "1.0.0"
  icon: "🎞️"
---

# Commercial Stock & B-Roll Sourcer

## Overview & Purpose
Sourcing commercial-safe photos, vectors, and B-roll video is Rung 2 of the visual ladder in `image-creation`. Rather than embedding unseen hotlinks, this skill downloads 3–5 candidates to disk, inspects them visually with `Read`, promotes the best match, deletes unused files, and writes a provenance sidecar. See [references/providers-and-licensing.md](references/providers-and-licensing.md) for provider routing and licensing rules.

## Execution Triggers
- **Load when:** A brief needs a real photograph, vector, illustration, or B-roll `.mp4` clip from Pexels, Pixabay, or Openverse (CC0 / Public Domain fallback).
- **Skip when:** A brand mark or diagram is needed (Rung 1: inline SVG), an AI scene is approved (Rung 3: `image-generation`), or the client supplies their own photo (Rung 4: placeholder).

## Input/Output Requirements
- **Inputs:** Search query, media type (`photo`, `vector`, `illustration`, `video`), orientation (`landscape`, `portrait`, `square`), and placement context (copy zone, palette tokens, aspect ratio).
- **Evidence to produce:**
  1. Promoted asset at `assets/stock/<descriptive-name>.<ext>`.
  2. Provenance sidecar at `assets/stock/<descriptive-name>.<ext>.provenance.json` (provider, creator, license, source URL, vision notes).
  3. Updated `attribution.md` listing creator credit and license terms for Deniz (`agency-frontend-architect`) or Defne (`agency-compliance-grc-specialist`).

## Step-by-Step Runbook
1. **Step 1 — Fetch Candidates:** Run `${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs` (or ask the lead if without a shell) to download 3–5 candidates and `manifest.json` into `./assets/stock-candidates`.
2. **Step 2 — Vision-in-the-Loop Inspection & Hard Pass/Fail Gate:** Read `./assets/stock-candidates/manifest.json`. For `photo`, `vector`, and `illustration`, inspect each candidate with `Read` on 5 mandatory criteria (never ship a stock asset unseen):
   - **Subject Recognizability & Focus:** Primary subject clearly recognizable and sharp (reject macro blobs, camera tests, blur, or fragments).
   - **Composition & Aspect Framing:** Framing matches `--orientation` without letterbox bars or cutoffs.
   - **Lighting & Palette Harmony:** Lighting warmth and surface colors harmonize with the brief's tokens.
   - **Clean Copy Zone:** Uncluttered space where headline text achieves readable contrast (with or without the brief's dark/light overlay).
   - **Zero Third-Party Trademarks / Unreleased Faces:** No readable commercial logos, wordmarks, or close-up portraits used as customer/team endorsements.
   - **Mandatory Batch Rejection Gate:** Never promote the "least bad" candidate just to reach Step 3. If all candidates fail any criterion—or come from one unusable shoot—reject the batch and re-run Step 1 with refined terms (up to 2 retries). For `video` (`.mp4`), check `manifest.json` (`duration`, `width`, `height`, tags).
3. **Step 3 — Select, Promote & Clean Up:** Run `node ${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs --promote <cand_file> --to assets/stock/<descriptive-name>.<ext> --output ./assets/stock-candidates` to copy the winner and delete `./assets/stock-candidates`.
4. **Step 4 — Provenance Sidecar & Attribution:** Write `assets/stock/<descriptive-name>.<ext>.provenance.json` and append creator and license credit to `attribution.md` for Deniz or the lead.

## Code & Config Exemplars
```bash
node ${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs \
  --query "minimalist workspace natural light" \
  --type photo \
  --orientation landscape \
  --limit 3 \
  --output ./assets/stock-candidates
```

### Worked example
See [examples/worked-example.md](examples/worked-example.md) for a worked example sourcing a hero photo via Openverse CC0, inspecting 3 candidates, promoting the winner, and writing the provenance sidecar.

### Anti-patterns
- **Blind selection without vision inspection:** Picking `cand_1.jpg` without `Read` risks watermarks, awkward crops, or busy copy zones.
- **Promoting the "least-bad" candidate:** Rationalizing a blurry or off-brief photo because its colors loosely match violates Step 2; reject the batch and re-query.
- **Hotlinking remote CDN URLs:** Linking to provider CDNs breaks offline builds and omits local provenance.
- **Leaving `./assets/stock-candidates/` in the workspace:** Always clean up with `--promote` so unused files never pollute the repo.
- **Presenting stock people as real customers or staff:** Never use a stock portrait on a testimonial or bio card (`image-creation` Rung 2).

## Edge Cases & Error Recovery
- **No API keys set (`PEXELS_API_KEY` / `PIXABAY_API_KEY`):** For `photo`, `vector`, and `illustration`, `fetch-stock.mjs` blends Openverse (`cc0,pdm`) and Wikimedia Commons (CC0 / Public Domain ranked first, zero keys needed).
- **Video requested with no API keys:** Openverse has no video; `fetch-stock.mjs` exits `1`. Ask the lead for `PEXELS_API_KEY` or `PIXABAY_API_KEY`, or use an SVG/photo fallback.
- **All candidates fail visual inspection:** Re-run with refined terms (up to 2 retries). If none pass, use an SVG placeholder (`image-creation` Rung 4).

## Verification Checklist
- [ ] Every image candidate was inspected with `Read` (or metadata-checked for `.mp4`) before selection.
- [ ] Winner passed Subject, Palette, Copy Zone, and Trademark checks (no "least-bad" compromise).
- [ ] Winning asset is promoted to `assets/stock/<descriptive-name>.<ext>` and `./assets/stock-candidates/` is removed.
- [ ] `assets/stock/<descriptive-name>.<ext>.provenance.json` and `attribution.md` list provider, creator, license, and URL.
