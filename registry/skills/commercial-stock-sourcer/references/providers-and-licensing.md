# Stock Providers, Routing & Commercial Licensing Reference

## 1. Provider Capabilities, Concurrent Blending & Routing Matrix

`scripts/fetch-stock.mjs` inspects all configured environment variables and queries **every usable provider** concurrently (`--provider auto`), blending and ranking top candidates across all responding sources:

| Media Type (`--type`) | Keyed Providers (queried concurrently when keys are set) | Zero-Key Fallback (always queried) | Web-Search Fallback (`--url`) |
|---|---|---|---|
| `photo` | **Unsplash** (`UNSPLASH_ACCESS_KEY`), **Pexels** (`PEXELS_API_KEY`), **Pixabay** (`PIXABAY_API_KEY`) | **Openverse + Wikimedia Commons** (`license=cc0,pdm`, commercial safe) | Pass `--url "<url>"` with URLs found via host web search |
| `vector` | **Pixabay Vectors** (`PIXABAY_API_KEY`, `image_type=vector`) | **Openverse + Wikimedia Commons** (`extension=svg`) | Pass `--url "<url>"` with URLs found via host web search |
| `illustration` | **Pixabay Illustrations** (`PIXABAY_API_KEY`, `image_type=illustration`) | **Openverse + Wikimedia Commons** (`category=illustration`) | Pass `--url "<url>"` with URLs found via host web search |
| `video` | **Pexels Videos** (`PEXELS_API_KEY`), **Pixabay Videos** (`PIXABAY_API_KEY`) | *None* — Openverse has no video API; requires `PEXELS_API_KEY` or `PIXABAY_API_KEY` | Pass `--url "<url>"` with direct video link |

When multiple providers respond, `fetch-stock.mjs` blends candidates across providers in chain order, giving diverse options from all available sources in `manifest.json`.

## 2. Commercial Licensing & Safe-Use Rules

| Provider | License Name | Commercial Use | Attribution Required by License? | Our Provenance Rule |
|---|---|---|---|---|
| **Unsplash** | Unsplash License | Permitted | Recommended / Required by API Terms | Record creator, `hotlinkUrl`, and UTM-tagged link (`?utm_source=agents_united&utm_medium=referral`) |
| **Pexels** | Pexels License | Permitted (photos & videos) | Appreciated, not legally required | Record creator, source URL, and license in `<asset>.provenance.json` and `attribution.md` |
| **Pixabay** | Pixabay Content License | Permitted (photos, vectors, illustrations, videos) | Not required for safe commercial use | Record creator, source URL, and license in `<asset>.provenance.json` and `attribution.md` |
| **Openverse / Commons** | Creative Commons Zero (`CC0 1.0`) & Public Domain Mark (`PDM`) | Permitted worldwide without restriction | Not legally required (`cc0,pdm` filter excludes `CC-BY` / `CC-BY-SA`) | Record creator, source URL, and license in `<asset>.provenance.json` and `attribution.md` |

### Hard Guardrails on Stock Assets
1. **No stock portraits as testimonials or team members:** Never place a stock photograph of a person next to a customer quote, review, or company bio (`image-creation` Rung 2).
2. **Trademark & recognizable-brand check during vision inspection:** Commercial stock licenses do not grant third-party trademark or publicity rights. During Step 2 (`Read` inspection), reject any candidate showing recognizable third-party logos, Apple/brand hardware wordmarks, or supermarket packaging.
3. **Never ask the user to paste an API key into chat:** If `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, or `PIXABAY_API_KEY` is needed, instruct the user or lead to export it in their shell environment (`export UNSPLASH_ACCESS_KEY=...`) rather than pasting secrets into conversation.

## 3. Unsplash API Guidelines Compliance

When using the Unsplash API (`UNSPLASH_ACCESS_KEY`), `commercial-stock-sourcer` strictly adheres to all 6 official Unsplash API guidelines:

1. **Hotlinking Images (Guideline 2511271):**
   - For Step 2 vision inspection, `fetch-stock.mjs` downloads `photo.urls.regular` to `cand_N.jpg`.
   - In production markup, Deniz (`agency-frontend-architect`) must hotlink the image using `hotlinkUrl` (or `photo.urls.*`) from `manifest.json` / `<asset>.provenance.json` so photographer views are tracked, while retaining the local file in `assets/stock/` for offline builds and provenance.
2. **Triggering a Download on Selection (Guideline 2511258):**
   - Candidate discovery does NOT ping download endpoints.
   - When `--promote` runs in Step 3, `fetch-stock.mjs` automatically fires an authenticated `GET` to the candidate's `download_location` URL (`photo.links.download_location`), incrementing the photographer's download count.
3. **Attribution with UTM Parameters (Guideline 2511315):**
   - When displaying an Unsplash photo, attribute the photographer and Unsplash using `?utm_source=agents_united&utm_medium=referral`.
   - Markdown: `Photo by [Annie Spratt](https://unsplash.com/@anniespratt?utm_source=agents_united&utm_medium=referral) on [Unsplash](https://unsplash.com/?utm_source=agents_united&utm_medium=referral)`
   - HTML: `Photo by <a href="https://unsplash.com/@anniespratt?utm_source=agents_united&utm_medium=referral">Annie Spratt</a> on <a href="https://unsplash.com/?utm_source=agents_united&utm_medium=referral">Unsplash</a>`
4. **Key Confidentiality (Guideline 2511245):**
   - `UNSPLASH_ACCESS_KEY` is sent via `Authorization: Client-ID ...` and redacted by `redactSecrets()`.
5. **Replication & Authentic Experience (Guidelines 2511257 & 2511256):**
   - Assets are used to build client web pages and creative work, never to clone Unsplash, sell raw unaltered photos, or train AI models.

## 4. Non-Vision Model Fallback Protocol

If the host model lacks multimodal vision support (e.g. `Read` returns an error stating image input is unsupported):
- **Never fabricate `inspectedByVision: true`:** Fabricating vision inspection violates the skill contract and repository rules.
- **Evaluate via `manifest.json` metadata:** Compare candidates using `score`, `description`, `color` (hex value), `tags`, `width`, `height`, and `license`.
- **Honest Provenance Recording:** Set `"inspectedByVision": false` and record `"visionNotes": "unverified visually (non-vision model); selected via manifest metadata: <reason>"`.
- **Handoff:** Note in the final summary that human or vision-capable model verification is required before shipping.

## 5. Web-Search Assisted Fallback (`--url`)

When API searches return 0 results or outbound API traffic is blocked:
1. Use your native web search tool with targeted queries:
   - `site:commons.wikimedia.org "CC0" <query>`
   - `site:unsplash.com/photos <query>`
2. Copy the discovered file or image URLs.
3. Run `node ${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs --url "<url1>,<url2>" --output ./assets/stock-candidates`.
4. `fetch-stock.mjs` will resolve the Wikimedia `File:` metadata or direct binary URL, download `cand_N.<ext>`, and create a structured `manifest.json` for Step 2 inspection.

## 6. Provenance Sidecar Schema (`<asset>.provenance.json`)

Write a JSON sidecar beside every promoted stock asset (`assets/stock/<name>.<ext>.provenance.json`):

```json
{
  "file": "assets/stock/hero-coffee.jpg",
  "asset": "hero-coffee",
  "sourceType": "licensed-stock",
  "provider": "unsplash",
  "sourceId": "u-707",
  "sourceUrl": "https://unsplash.com/photos/u-707?utm_source=agents_united&utm_medium=referral",
  "hotlinkUrl": "https://images.unsplash.com/photo-123?utm_source=agents_united&utm_medium=referral",
  "creator": "Annie Spratt",
  "creatorUrl": "https://unsplash.com/@anniespratt?utm_source=agents_united&utm_medium=referral",
  "license": "Unsplash License (Commercial Safe)",
  "query": "pour over coffee",
  "inspectedByVision": true,
  "visionNotes": "Warm ceramic dripper on oak counter; top-left negative space clear for headline.",
  "retrievedAt": "2026-10-18T18:00:00Z"
}
```
