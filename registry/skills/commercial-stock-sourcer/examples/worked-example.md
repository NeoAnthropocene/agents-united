# Worked Example: Sourcing a Hero Photograph with Vision-in-the-Loop Inspection

## Scenario
The brief for **Hearth Roasters** calls for a warm, editorial hero photograph (`16:9` landscape) showing a pour-over coffee ritual with clean negative space on the left for a headline in `#FAF6F0` (`--surface-paper`). Neither `PEXELS_API_KEY` nor `PIXABAY_API_KEY` is set in the environment.

## Step 1 — Fetch Candidates (Openverse Zero-Key Fallback)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/fetch-stock.mjs \
  --query "pour over coffee ceramic dripper" \
  --type photo \
  --orientation landscape \
  --limit 3 \
  --output ./assets/stock-candidates
```

Output:
```text
Downloaded 3 photo candidate(s) from openverse to ./assets/stock-candidates
Manifest: ./assets/stock-candidates/manifest.json
```

## Step 2 — Vision-in-the-Loop Inspection

After reading `./assets/stock-candidates/manifest.json`, we inspect `cand_1.jpg`, `cand_2.jpg`, and `cand_3.jpg` visually with `Read`:

| Candidate | Visual Inspection Notes | Verdict |
|---|---|---|
| `cand_1.jpg` | Overhead fluorescent lighting; visible café POS brand logo on the right; high-frequency clutter across the left third where the headline sits. | **Reject** (trademark visible + no copy zone) |
| `cand_2.jpg` | Warm morning window light on a matte ceramic dripper over an oak counter; left 45% is a dark, out-of-focus slate wall (`~#231F1D`) that gives `> 10:1` contrast under `#FAF6F0` headline text. | **Select** (matches palette + clean copy zone) |
| `cand_3.jpg` | Portrait crop padded with white bars; subject is cut off at the rim. | **Reject** (bad aspect framing) |

## Step 3 — Promote Winner & Clean Up

We move `./assets/stock-candidates/cand_2.jpg` to `assets/stock/hero-pour-over.jpg` and remove `./assets/stock-candidates/` so rejected files do not remain in the workspace.

## Step 4 — Evidence Produced & Hand-off

1. **Promoted asset:** `assets/stock/hero-pour-over.jpg`
2. **Provenance sidecar (`assets/stock/hero-pour-over.jpg.provenance.json`):**
```json
{
  "file": "assets/stock/hero-pour-over.jpg",
  "asset": "hero-pour-over",
  "sourceType": "licensed-stock",
  "provider": "openverse",
  "sourceId": "ov-204",
  "sourceUrl": "https://openverse.org/image/ov-204",
  "creator": "Elena Rostova",
  "license": "CC0 1.0 / Public Domain (Commercial Safe)",
  "query": "pour over coffee ceramic dripper",
  "inspectedByVision": true,
  "visionNotes": "Warm morning window light on matte ceramic dripper; left 45% is dark slate (#231F1D) providing >10:1 contrast for #FAF6F0 headline copy.",
  "retrievedAt": "2026-10-16T18:00:00Z"
}
```
3. **Attribution log (`attribution.md`):**
```markdown
# Media Attribution
- **hero-pour-over.jpg**: Photo by Elena Rostova via Openverse (`https://openverse.org/image/ov-204`), licensed under CC0 1.0 Public Domain.
```
4. **Hand-off:** Hand off `assets/stock/hero-pour-over.jpg`, its `.provenance.json` sidecar, and `attribution.md` to Deniz (`agency-frontend-architect`) for hero section integration and Defne (`agency-compliance-grc-specialist`) for final licence sign-off.
