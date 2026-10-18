---
name: commercial-stock-sourcer
description: "Use when sourcing commercial-safe stock photos, vectors, illustrations or B-roll videos; trigger phrases: stock photo, stock video, B-roll, Unsplash, Pexels, Pixabay, Openverse. Skip it when generating AI images or drawing SVG."
metadata:
  author: agents-united
  version: "1.0.0"
  icon: "🎞️"
---

# Commercial Stock & B-Roll Sourcer

## Overview & Purpose
Sourcing commercial-safe photos, vectors, and B-roll video is Rung 2 of `image-creation`. This skill downloads candidates to disk, inspects them with `Read`, promotes the best match, deletes unused files, and writes a provenance sidecar. See [references/providers-and-licensing.md](references/providers-and-licensing.md) for Unsplash guidelines, provider routing, and licensing rules.

## Execution Triggers
- **Load when:** A brief needs a real photograph, vector, illustration, or B-roll `.mp4` clip from Unsplash, Pexels, Pixabay, or Openverse (CC0 / Public Domain fallback).
- **Skip when:** A brand mark or diagram is needed (Rung 1: inline SVG), an AI scene is approved (Rung 3: `image-generation`), or the client supplies their own photo (Rung 4: placeholder).

## Input/Output Requirements
- **Inputs:** Search query, media type (`photo`, `vector`, `illustration`, `video`), orientation (`landscape`, `portrait`, `square`), and placement context (copy zone, palette tokens, aspect ratio).
- **Evidence to produce:**
  1. Promoted asset at `assets/stock/<descriptive-name>.<ext>`.
  2. Provenance sidecar at `assets/stock/<descriptive-name>.<ext>.provenance.json` (provider, creator, license, source URL, vision notes, `hotlinkUrl` for Unsplash).
  3. Updated `attribution.md` listing creator credit and license terms for Deniz (`agency-frontend-architect`) or Defne (`agency-compliance-grc-specialist`).

## Step-by-Step Runbook
1. **Step 1 — Fetch Candidates:** Run `${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs` (or ask the lead if without a shell) to download candidates and `manifest.json` into `./assets/stock-candidates`.
2. **Step 2 — Vision-in-the-Loop Inspection & Hard Pass/Fail Gate:** Read `./assets/stock-candidates/manifest.json`. For `photo`, `vector`, and `illustration`, inspect each candidate with `Read` on 5 mandatory criteria (never ship a stock asset unseen):
   - **5 Criteria:** Subject Recognizability & Focus (sharp, on-brief), Composition (matches `--orientation`), Lighting & Palette Harmony, Clean Copy Zone, and Zero Third-Party Trademarks.
   - **Mandatory Batch Rejection Gate:** Never promote the "least bad" candidate. If all fail, reject the batch and re-query (up to 2 retries) without dropping core demographic constraints. For `video` (`.mp4`), inspect `manifest.json` metadata.
   - **Non-Vision Model Fallback:** If `Read` fails on images (text-only model), never fake `inspectedByVision: true`. Evaluate `manifest.json` (`score`, `description`, `color`, `tags`, `license`), set `"inspectedByVision": false`, and write `"visionNotes": "unverified visually (non-vision model); selected via manifest metadata: <reason>"`.
3. **Step 3 — Select, Promote & Clean Up:** Run `node ${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs --promote <cand_file> --to assets/stock/<descriptive-name>.<ext> --output ./assets/stock-candidates` to copy the winner, ping Unsplash download location if applicable, and delete `./assets/stock-candidates`.
4. **Step 4 — Provenance Sidecar & Attribution:** Write `assets/stock/<descriptive-name>.<ext>.provenance.json` and append creator and license credit to `attribution.md` (create file if absent; include UTM links for Unsplash).

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
See [examples/worked-example.md](examples/worked-example.md) for a worked example inspecting Openverse candidates, promoting the winner, and generating provenance.

### Anti-patterns
- **Blind selection without vision inspection:** Picking `cand_1.jpg` without `Read` risks watermarks, bad crops, or busy copy zones.
- **Promoting the "least-bad" candidate:** Rationalizing a blurry or off-brief photo violates Step 2; reject the batch and re-query.
- **Hotlinking remote CDN URLs without local provenance:** Unsplash API photos require `hotlinkUrl` in markup per API terms while keeping local copies for build provenance; other providers self-host.
- **Leaving `./assets/stock-candidates/` in workspace:** Always clean up with `--promote` so unused files never pollute the repo.
- **Presenting stock people as real customers or staff:** Never use a stock portrait on a testimonial or bio card (`image-creation` Rung 2).

## Edge Cases & Error Recovery
- **No API keys set:** `fetch-stock.mjs` blends Openverse (`cc0,pdm`) and Wikimedia Commons (CC0 / Public Domain ranked first, zero keys needed).
- **Web-search fallback (`--url`):** If API queries return 0 results, search `site:commons.wikimedia.org "CC0" <query>` or `site:unsplash.com/photos` and pass `--url "<url>"` to `fetch-stock.mjs`.
- **Video requested with no API keys:** Openverse has no video; `fetch-stock.mjs` exits `1`. Ask lead for `PEXELS_API_KEY` or `PIXABAY_API_KEY`, or use an SVG/photo fallback.
- **All candidates fail visual inspection:** Re-run with refined terms (up to 2 retries). If none pass, use an SVG placeholder (`image-creation` Rung 4).

## Verification Checklist
- [ ] Every image candidate was inspected with `Read` (or metadata-checked for non-vision / `.mp4`) before selection.
- [ ] Winner passed Subject, Palette, Copy Zone, and Trademark checks (no "least-bad" compromise).
- [ ] Winning asset is promoted to `assets/stock/<descriptive-name>.<ext>` and `./assets/stock-candidates/` is removed.
- [ ] `assets/stock/<descriptive-name>.<ext>.provenance.json` and `attribution.md` list provider, creator, license, and URL.
