# The parameters, the reply and the errors

`mcp__image-gen__generate_image` (server `image-gen`, `mcp-image@0.18.0`). One call makes one image. If `ToolSearch` does not list it, the server is not connected: write the image brief.

## The parameters

| Parameter | Set it | Value |
|---|---|---|
| `prompt` | always | Required. 1 to 4,000 characters, English. A scene in sentences ([recipes](prompt-recipes.md)) |
| `aspectRatio` | always | One of 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9. Left out, it is 1:1. Not every provider has every one ([providers](providers.md)) |
| `imageSize` | always | `1K`, `2K` or `4K` (Seedream: `1K` or `2K`). Left out, the provider's own default |
| `fileName` | always | A new descriptive name with no folder in it and no extension, such as `petpal-hero-sofa-a1`. The server strips path characters and puts the real extension on the saved file: Gemini saved a JPEG for a name that ended `.png`. `.png`, `.jpg` or `.jpeg` only asks OpenAI and Seedream for that format. **A name already used in the folder is overwritten**, with no warning |
| `provider` | only when the go names one | `gemini`, `openai` or `seedream`. Left out, the server's `IMAGE_PROVIDER` (Gemini unless the install says otherwise). The provider's key must be set on the server |
| `quality` | only when the go names one | `fast` (the server default), `balanced` or `quality`. What each means differs by provider ([providers](providers.md)) |
| `inputImagePaths` | only under rule 5 | An array of 1 to 14 (Gemini), 16 (OpenAI) or 10 (Seedream) absolute paths, in prompt order, even for one image. PNG, JPEG or WebP, at most 10 MiB each (Seedream: PNG and JPEG). Each file goes to the provider. [The rule](input-images-and-paths.md) decides which files |
| `useGoogleSearch` | only on Gemini, only when facts matter | Search grounding. Free for the first 5,000 searches a month, then $14 per 1,000 |
| `purpose`, `blendImages`, `maintainCharacterConsistency`, `useWorldKnowledge` | leave them out | They steer the server's own prompt rewriting, which the install turns off, so they change nothing. Put what they would add into the prompt |

**Retired, and rejected by the server:** `inputImagePath` (one string), `inputImage` and `inputImageMimeType` (base64). They were the fields of earlier versions; a call that carries one fails with "is not supported; use inputImagePaths". Older notes, briefs and recipes may still use them: translate, do not copy.

## The reply

One text block holding JSON, not the picture:

```json
{"type":"resource","resource":{"uri":"file:///.../assets/generated/petpal-hero-sofa-a1.jpg","name":"petpal-hero-sofa-a1.jpg","mimeType":"image/jpeg"},"metadata":{"model":"gemini-nano-banana-2.1","processingTime":0,"contextMethod":"structured_prompt","timestamp":"2026-10-09T10:13:02.313Z"}}
```

`Read` the path in `resource.uri` (the `file://` form) to see the image. Record `resource.name` as the file, `metadata.model` as the model and `metadata.provider` as the provider when the reply has it (OpenAI and Seedream set it; the Gemini reply captured on 2026-10-09, shown above, has none, so the provider is the one the call named, or the server default). The file lands in the folder the user set when installing (`IMAGE_OUTPUT_DIR`, inside the project, normally `assets/generated`); the server creates the folder if it is missing and overwrites a file of the same name. A call takes seconds to a few minutes: make them one at a time.

An error is `{"error":{"code","message","suggestion","details"}}` with the reply marked as an error. Read `message` and `suggestion`, then the table.

## The errors, and what you do

| Message | What it means | What you do |
|---|---|---|
| The selected image provider "X" is not configured on this server | The call named a provider whose key is not set | Stop. Tell the lead which provider; it prints the key pair from `mcp-setup`, the user runs it and the team restarts. Never ask for a key |
| inputImagePath is not supported; use inputImagePaths | A retired field | Send `inputImagePaths`, an array |
| Input image path must be absolute | A relative path | Build the absolute path from the project root; and see rule 5 first |
| Path traversal attempt detected / Null byte detected in file path | The path has ".." or a null byte | Never write one. Use the real absolute path |
| Input image file not found | The file does not exist | Check the name against the folder with `Glob`; ask the user |
| File path cannot be resolved | The server could not resolve the path | Same: the file is not where you think |
| Unsupported file extension | Not PNG, JPEG or WebP | Ask the user for a supported copy |
| Input image must be a regular file | A folder or a device | Name the file |
| Image size exceeds 10.0MB limit | An input file is too large | Ask the user for a smaller copy; do not try to shrink it |
| gemini accepts at most 14 input images (openai 16, seedream 10) | Too many references | Send fewer, in prompt order |
| Input image N: unsupported seedream MIME type | WebP to Seedream | Use PNG or JPEG, or another provider |
| useGoogleSearch is not supported by the OpenAI image provider (Seedream: Google Search is not supported) | Grounding is Gemini only | Leave it out |
| Unsupported OpenAI image aspect ratio | OpenAI stops at 3:1 | Another ratio, or another provider |
| Unsupported Seedream model and resolution combination | `imageSize` 4K | Use 1K or 2K, or another provider |
| Gemini inline request must be smaller than 20 MB | The references are too big together | Fewer or smaller references |
| Verify your OpenAI organization has access to GPT Image 2.5 and has completed verification | The account is not verified for these models | Stop and tell the user; they verify at platform.openai.com. No retry |
| You have exceeded your OpenAI API quota or rate limit; quota or billing from Google or BytePlus | The account has no paid access or is out of quota | Stop and tell the user. Image models have no free tier |
| `moderation_blocked`, or a refusal | The provider declined the prompt or the image | Drop the element that is not needed and ask once more. Never rephrase around a refusal |
| Network error | A transient failure | One retry. It counts toward the three calls of the asset |
| No image data returned / did not match the requested output format | The provider answered badly | One retry, counted |

Every attempt, successful or not, counts toward the cap of three calls per asset.
