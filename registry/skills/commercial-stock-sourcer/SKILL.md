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
Sourcing real, commercial-safe photography, vector illustrations, and B-roll video is Rung 2 of the visual ladder in `image-creation`. Rather than embedding unseen hotlinks or guessing URLs, this skill downloads 3–5 candidates to disk, inspects them visually with multimodal vision (`Read`), promotes the single best match, deletes unused candidates, and writes a provenance sidecar. See [references/providers-and-licensing.md](references/providers-and-licensing.md) for provider routing, keys, and licensing rules.

## Execution Triggers
- **Load when:** A brief needs a real photograph, vector graphic, editorial illustration, or B-roll `.mp4` clip from Pexels, Pixabay, or Openverse (CC0 / Public Domain fallback).
- **Skip when:** A bespoke brand mark or diagram is needed (Rung 1: inline SVG), an AI-generated scene is approved (Rung 3: `image-generation`), or the client must supply their own real product/team photo (Rung 4: placeholder).

## Input/Output Requirements
- **Inputs:** Search query, media type (`photo`, `vector`, `illustration`, `video`), orientation (`landscape`, `portrait`, `square`), and placement context (copy-zone coordinates, palette tokens, aspect ratio).
- **Evidence to produce:**
  1. The promoted asset at `assets/stock/<descriptive-name>.<ext>`.
  2. A provenance sidecar at `assets/stock/<descriptive-name>.<ext>.provenance.json` recording provider, creator, license, source URL, and vision inspection notes.
  3. An updated `attribution.md` listing creator credit and license terms, ready to hand off to Deniz (`agency-frontend-architect`) or Defne (`agency-compliance-grc-specialist`).

## Step-by-Step Runbook
1. **Step 1 — Fetch Candidates:** Run `${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs` (or ask the lead when running without a shell) to download 3–5 candidates and `manifest.json` into `./assets/stock-candidates`.
2. **Step 2 — Vision-in-the-Loop Inspection:** Read `./assets/stock-candidates/manifest.json`. For `photo`, `vector`, and `illustration`, inspect each downloaded candidate file with `Read` to verify composition, lighting warmth, palette harmony, and negative-space copy zones (never ship a stock asset unseen). For `video` (`.mp4`), inspect `manifest.json` metadata (`duration`, `width`, `height`, tags) and verify aspect ratio and duration fit the placement.
3. **Step 3 — Select, Promote & Clean Up:** Move the winning candidate to `assets/stock/<descriptive-name>.<ext>` and delete `./assets/stock-candidates` so unused candidates never bloat the repository.
4. **Step 4 — Provenance Sidecar & Attribution:** Write `assets/stock/<descriptive-name>.<ext>.provenance.json` and append the creator and license credit to `attribution.md`, then hand off the verified asset path and provenance record to Deniz or the lead.

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
See [examples/worked-example.md](examples/worked-example.md) for a complete worked example sourcing a hero photograph with zero API keys via Openverse CC0, inspecting 3 candidates, promoting the winner, and writing the provenance sidecar.

### Anti-patterns
- **Blind selection without vision inspection:** Picking `cand_1.jpg` without looking at it with `Read` risks watermarks, awkward crops, or busy backgrounds behind headline copy.
- **Hotlinking remote CDN URLs:** Linking directly to provider CDNs breaks offline builds and omits local provenance tracking.
- **Leaving `./assets/stock-candidates/` in the workspace:** Unused candidates pollute the asset directory.
- **Presenting stock people as real customers or staff:** Never use a stock portrait on a customer testimonial or team bio card (`image-creation` Rung 2 rule).

## Edge Cases & Error Recovery
- **No API keys set (`PEXELS_API_KEY` / `PIXABAY_API_KEY`):** For `photo`, `vector`, and `illustration`, `fetch-stock.mjs` automatically falls back to Openverse (`cc0,pdm`, zero keys required).
- **Video requested with no API keys:** Openverse does not host video; `fetch-stock.mjs` exits `1` with guidance. Ask the lead or user to set `PEXELS_API_KEY` or `PIXABAY_API_KEY`, or offer an animated SVG / static photo fallback.
- **All candidates fail visual inspection:** Re-run with refined search terms (up to 2 retries). If none pass, fall back to an honest SVG placeholder (`image-creation` Rung 4).

## Verification Checklist
- [ ] Every image candidate was inspected visually with `Read` (or metadata-checked for `.mp4` video) before selection.
- [ ] Winning asset is promoted to `assets/stock/<descriptive-name>.<ext>` and `./assets/stock-candidates/` is removed.
- [ ] `assets/stock/<descriptive-name>.<ext>.provenance.json` and `attribution.md` are written with provider, creator, license, and source URL.
