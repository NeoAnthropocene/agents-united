# Stock Providers, Routing & Commercial Licensing Reference

## 1. Provider Capabilities & Routing Matrix

`scripts/fetch-stock.mjs` selects providers automatically (`--provider auto`) based on the requested `--type` and which optional environment variables are set:

| Media Type (`--type`) | Primary Provider (with API key) | Secondary Provider (with API key) | Zero-Key Fallback (always available) |
|---|---|---|---|
| `photo` | **Pexels Photos** (`PEXELS_API_KEY`) | **Pixabay Images** (`PIXABAY_API_KEY`, `image_type=photo`) | **Openverse Images** (`license_type=commercial`, `license=cc0,pdm`, `category=photograph`) |
| `vector` | **Pixabay Vectors** (`PIXABAY_API_KEY`, `image_type=vector`) | — | **Openverse Images** (`license_type=commercial`, `license=cc0,pdm`, `extension=svg`) |
| `illustration` | **Pixabay Illustrations** (`PIXABAY_API_KEY`, `image_type=illustration`) | — | **Openverse Images** (`license_type=commercial`, `license=cc0,pdm`, `category=illustration`) |
| `video` | **Pexels Videos** (`PEXELS_API_KEY`) | **Pixabay Videos** (`PIXABAY_API_KEY`) | *None* — Openverse does not host video; script exits `1` and asks for `PEXELS_API_KEY` or `PIXABAY_API_KEY` |

When a primary provider returns HTTP `429` (rate limit) or `5xx`, `fetch-stock.mjs` automatically falls back to the next provider in the chain and redacts any API keys from diagnostic output.

## 2. Commercial Licensing & Safe-Use Rules

| Provider | License Name | Commercial Use | Attribution Required by License? | Our Provenance Rule |
|---|---|---|---|---|
| **Pexels** | Pexels License | Permitted (photos & videos) | Appreciated, not legally required | Always record creator, source URL, and license in `<asset>.provenance.json` and `attribution.md` |
| **Pixabay** | Pixabay Content License | Permitted (photos, vectors, illustrations, videos) | Not required for safe commercial use | Always record creator, source URL, and license in `<asset>.provenance.json` and `attribution.md` |
| **Openverse** | Creative Commons Zero (`CC0 1.0`) & Public Domain Mark (`PDM`) | Permitted worldwide without restriction | Not legally required (`cc0,pdm` filter excludes `CC-BY` / `CC-BY-SA`) | Always record creator, source URL, and license in `<asset>.provenance.json` and `attribution.md` |

### Hard Guardrails on Stock Assets
1. **No stock portraits as testimonials or team members:** Never place a stock photograph of a person next to a customer quote, review, or company bio (`image-creation` Rung 2).
2. **Trademark & recognizable-brand check during vision inspection:** Commercial stock licenses do not grant third-party trademark or publicity rights. During Step 2 (`Read` inspection), reject any candidate showing recognizable third-party logos, Apple/brand hardware wordmarks, or identifiable private property plates.
3. **Never ask the user to paste an API key into chat:** If `PEXELS_API_KEY` or `PIXABAY_API_KEY` is needed for video sourcing, instruct the user or lead to export it in their shell environment (`export PEXELS_API_KEY=...`) rather than pasting secrets into the conversation.

## 3. Provenance Sidecar Schema (`<asset>.provenance.json`)

Write a JSON sidecar beside every promoted stock asset (`assets/stock/<name>.<ext>.provenance.json`):

```json
{
  "file": "assets/stock/hero-coffee.jpg",
  "asset": "hero-coffee",
  "sourceType": "licensed-stock",
  "provider": "openverse",
  "sourceId": "ov-505",
  "sourceUrl": "https://openverse.org/image/ov-505",
  "creator": "Katherine Johnson",
  "license": "CC0 1.0 / Public Domain (Commercial Safe)",
  "query": "pour over coffee ceramic dripper",
  "inspectedByVision": true,
  "visionNotes": "Warm ceramic dripper on oak counter; upper-left quadrant has clean low-contrast negative space for headline text.",
  "retrievedAt": "2026-10-16T18:00:00Z"
}
```

## 4. Host Execution Notes

- **Hosts with a shell (or when the lead runs the script):** Execute `node ${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs` to populate `./assets/stock-candidates/`, then inspect the downloaded candidates with `Read`.
- **Teammate mode without a shell:** Ask the team lead to run `fetch-stock.mjs` and place the candidates in `./assets/stock-candidates/`, then inspect each candidate yourself with `Read`, choose the winner, and write the provenance sidecar and `attribution.md`.
