# The image server: the tool, what it returns, what it costs

The server is named `image-gen`. It is the `mcp-image` package (MIT) started with the user's Google AI Studio key; the lead installs it with the command in `mcp-setup` (`references/claude-code.md`) after the user's yes. You never run, change or configure it. It has one tool, `mcp__image-gen__generate_image`. If `ToolSearch` does not list it, it is not connected.

## The parameters

Set these:

| Parameter | Value |
|---|---|
| `prompt` | Required. 1 to 4,000 characters, English ([prompting.md](prompting.md)) |
| `aspectRatio` | One of 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9. Omitted, the default (1:1) |
| `imageSize` | `1K`, `2K` or `4K`. Omitted, the default of the quality preset |
| `fileName` | A new descriptive name without an extension, such as `petpal-hero-sofa-a1`. The server strips path characters and puts the real extension on the saved file |

Leave these alone unless the user asks:

| Parameter | Why leave it |
|---|---|
| `quality` | Unset means `fast`, the cheaper model. `quality` selects the Pro model at twice the price; `balanced` is the cheaper model with extra thinking before the image |
| `inputImagePath` | Edits a photo and sends it to Google: only a photo the user supplied and agreed to send |
| `useGoogleSearch` | Adds search grounding, which can add a charge per search query |
| `purpose`, `blendImages`, `maintainCharacterConsistency`, `useWorldKnowledge` | They steer the server's own prompt rewriting, which the install turns off, so they change nothing |
| `provider` | Only Gemini has a key; any other value fails |

## What comes back

The reply is one text block holding JSON, not the picture:

```json
{"type":"resource","resource":{"uri":"file:///.../assets/generated/petpal-hero-sofa-a1.png","name":"petpal-hero-sofa-a1.png","mimeType":"image/png"},"metadata":{"model":"gemini-3.1-flash-image","timestamp":"2026-10-09T09:12:41.000Z"}}
```

`Read` the path in `resource.uri` (the `file://` form) to see the image. Record `resource.name` as the file and `metadata.model` as the model. An error is `{"error":{"code","message","suggestion","details"}}` with the reply marked as an error: read `suggestion`, and see Edge Cases in `SKILL.md`.

The file lands in the folder the user set when installing (`IMAGE_OUTPUT_DIR`, inside the project, normally `assets/generated`). The server overwrites any file of the same name; this is why a name is never reused. It creates the folder if it is missing.

## The models and the price

Prices read on 2026-10-08 from the Gemini API pricing page (paid tier, standard, per image). Image models have no free tier (the pricing page lists none), so expect an error about quota or billing from a key whose project has no billing set up.

| `quality` | Model | 1K | 2K | 4K |
|---|---|---|---|---|
| unset or `fast`, `balanced` | `gemini-3.1-flash-image` | $0.067 | $0.101 | $0.151 |
| `quality` | `gemini-3-pro-image` | $0.134 | $0.134 | $0.24 |

A newer model, `gemini-nano-banana-2.1`, is listed at $0.0336 (1K), $0.0504 (2K) and $0.113 (4K). The pinned server version calls the models in the table; a later server version may call the newer one and cost less. The lead keeps the version in `mcp-setup`; the table above is what the pinned version costs.

The estimate for a go-ahead is the number of images times the price at the size, and its worst case is three calls per asset: two assets at 2K on the first model are $0.20 if every first picture is kept and $0.61 at most.

A call takes seconds to tens of seconds. Make them one at a time.

## Where the words go

The prompt, and any input photo, goes to Google's Gemini API under the user's key. Google's pricing page says that on the paid tier the content is not used to improve its products (read 2026-10-08); the user's own account terms are what apply, and the user reads them. Put no client secret, personal data or unreleased product detail in a prompt.

Every image the Gemini models make carries an invisible SynthID watermark (Google's documentation). It is not a visible label and does not replace one ([provenance-and-disclosure.md](provenance-and-disclosure.md)).
