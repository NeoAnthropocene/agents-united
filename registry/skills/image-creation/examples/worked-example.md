# Worked example: a feed hero for PetPal

The brief: a PetPal feed ad, 4:5 (1080 x 1350), hero "a dog on a sofa, a sitter's hands, a warm morning". The tokens are the sand and clay ones; the headline sits in the upper third. `Glob` finds no photography in the project and the user has named no stock source. The user wrote: "go, two images, 2K" for the hero and for a 16:9 banner of a park.

## 1. The ladder

Rungs 1 and 2 have nothing to offer. Rung 3: `ToolSearch` lists `mcp__image-gen__generate_image` and the user said go. Before the first call she tells them: "Two images at 2K on Gemini 3.1 Flash Image, $0.101 each: $0.20 if I keep the first of each, $0.61 at most with two regenerations each. The prompts go to Google." The report will say: rung 3, because no photography was supplied, the tool is connected and the user said go.

## 2. The prompt and the call

The hero prompt, which the record keeps character for character:

```text
A photograph of a sleepy golden retriever curled on a cream linen sofa in a sunlit living room, a person's hand resting on its back, the person's face out of frame. Soft window light from the left on an early morning, gentle shadows. Shot on a 50mm lens at eye level, shallow depth of field, focus on the dog's face. The dog sits in the lower two thirds of the frame; the upper third is an even, plain cream wall with nothing on it. Palette: cream, warm sand, one muted terracotta cushion. Natural and unposed.
```

The call: `aspectRatio: "4:5"`, `imageSize: "2K"`, `fileName: "petpal-hero-sofa-a1"`, nothing else. The reply names `petpal-hero-sofa-a1.png` (the shape is the server's; the values here are illustrative).

## 3. Looking

She `Read`s the saved path. The room, the light and the palette are right and the upper third is clear, but the dog's front paws fuse into one shape. One regeneration, one changed instruction, the rest kept: "Each front paw separate and clearly visible, resting on the cushion." The second picture, `petpal-hero-sofa-a2.png`, is right. She keeps it, leaves the first file where it is, and says that a downscaled copy cannot show fur at full size.

## 4. The record

`petpal-hero-sofa-a2.provenance.json`:

```json
{
  "file": "petpal-hero-sofa-a2.png",
  "asset": "petpal-hero-sofa",
  "attempt": 2,
  "createdAt": "2026-10-09T09:15:02Z",
  "server": "image-gen (mcp-image 0.14.0)",
  "model": "gemini-3.1-flash-image",
  "prompt": "A photograph of a sleepy golden retriever curled on a cream linen sofa in a sunlit living room, a person's hand resting on its back, the person's face out of frame. Soft window light from the left on an early morning, gentle shadows. Shot on a 50mm lens at eye level, shallow depth of field, focus on the dog's face. The dog sits in the lower two thirds of the frame; the upper third is an even, plain cream wall with nothing on it. Palette: cream, warm sand, one muted terracotta cushion. Natural and unposed. Each front paw separate and clearly visible, resting on the cushion.",
  "parameters": { "aspectRatio": "4:5", "imageSize": "2K", "quality": "fast" },
  "approvedBy": "the user: go, two images, 2K",
  "estimatedCostUsd": 0.101,
  "disclosure": "Generated with Gemini; carries an invisible SynthID mark. Platform label: label rule not checked.",
  "inputImage": null,
  "usedIn": ["feed-4x5.svg"],
  "notes": "Attempt 1 fused the front paws; this attempt changed only that. Palette and copy zone as briefed. Fur detail not judged: the copy I read was downscaled."
}
```

## 5. The lead's check

She cannot measure files, so under Open items she asks the lead to run `node ${CLAUDE_SKILL_DIR}/scripts/image-check.mjs assets/generated`, and again with `--stamp` once it is clean. The lead's first run, after the hero's two calls and the banner's first (the byte counts and hashes differ on every run; here they are placeholders):

```text
petpal-banner-park-a1.png  png  2048 x 2048  1:1  <bytes> B  sha256:<sha>  provenance ok
petpal-hero-sofa-a1.png    png  1856 x 2304  4:5  <bytes> B  sha256:<sha>  provenance ok
petpal-hero-sofa-a2.png    png  1856 x 2304  4:5  <bytes> B  sha256:<sha>  provenance ok
petpal-banner-park-a1.png  ratio  asked 16:9, got 2048 x 2048 (1:1)
checked 3 images; 1 finding (ratio 1); 3 calls recorded, estimated cost 0.30 USD
```

The banner came back square: she asked for 16:9 and the file is 2048 x 2048 (the hero's 1856 x 2304 is the model's own rounding of 4:5, which the check accepts). That is the banner's first call, so she may regenerate once with one changed instruction ("a wide horizontal landscape composition") and keep the cap of three calls per asset.

## 6. The report

- `petpal-hero-sofa-a2.png`: rung 3 (no photography supplied, tool connected, go from the user), 2 calls, $0.20, paws fixed on the second call, the first file kept as the rejected attempt. Label rule not checked.
- `petpal-banner-park`: the first call came back square; one regeneration pending.
- Open items: the lead's `image-check` run, then `--stamp` for the sizes and hashes; the platform's label rule for generated images.
