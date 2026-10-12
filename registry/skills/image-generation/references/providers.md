# The providers: models, keys, limits, prices, where the words go

Read on 2026-10-09 from each provider's own pages and from the source of `mcp-image@0.18.0` (the version `mcp-setup` pins). Image models have no free tier at any of the three: every provider bills the user's own account, and a key whose account has no billing fails with a quota or billing error. Prices change. The dated figures are what a go-ahead quotes, and `scripts/call-check.mjs` holds the same numbers.

## At a glance

| | Gemini (the default) | OpenAI | Seedream (BytePlus) |
|---|---|---|---|
| `provider` | `gemini` | `openai` | `seedream` |
| Key variable on the server | `GEMINI_API_KEY` | `OPENAI_API_KEY` | `ARK_API_KEY` |
| Where the user gets the key | aistudio.google.com/apikey, in a Google project with billing | platform.openai.com/api-keys; the GPT Image models may need organization verification | console.byteplus.com, ModelArk, an API key in the AP region (ap-southeast-1) |
| Model for `fast` and `balanced` | `gemini-nano-banana-2.1` | `gpt-image-2.5-flare` | `dola-seedream-5-0-pro-260628` |
| Model for `quality` | `gemini-3-pro-image` | `gpt-image-2.5-sunburst` | the same model |
| What the quality changes | `fast` thinks a little, `balanced` more, `quality` is the Pro model | the OpenAI settings `low`, `high` and `max` | the provider's prompt optimisation: `fast` quick, the others standard |
| Sizes | 1K, 2K, 4K | 1K, 2K, 4K (above 2560 x 1440 OpenAI calls it experimental) | 1K, 2K; no 4K |
| Ratios | all 14; the Pro model has no 1:4, 1:8, 4:1, 8:1 | ten: nothing beyond 3:1, so no 1:4, 1:8, 4:1, 8:1 | all 14 |
| Reference images per call | up to 14: PNG, JPEG, WebP | up to 16: PNG, JPEG, WebP | up to 10 input images: PNG and JPEG only |
| Output | the model's choice | PNG; JPEG when `fileName` ends in `.jpg` or `.jpeg` | PNG; JPEG likewise |
| Google Search grounding | yes, `useGoogleSearch` | no | no |
| Mark on the image | an invisible SynthID mark on every image (Google's documentation) | not stated on the pages read | the server asks for no visible mark (`watermark: false`); an invisible one is not stated on the pages read |

All three keys can sit on one server. `IMAGE_PROVIDER` names the provider used when a call names none (Gemini unless the install says otherwise), and a call's `provider` overrides it. A call that names a provider whose key is not set fails with a message that tells the user to configure the variable and restart; that is for the lead and the user, never for you to fix.

## Prices

Prices read on 2026-10-09, in US dollars per output image, paid tier, standard processing.

| Provider and model | 1K | 2K | 4K | Source |
|---|---|---|---|---|
| Gemini `gemini-nano-banana-2.1` (`fast`, `balanced`) | $0.0336 | $0.0504 | $0.113 | Gemini API pricing page |
| Gemini `gemini-3-pro-image` (`quality`) | $0.134 | $0.134 | $0.24 | Gemini API pricing page |
| Seedream `dola-seedream-5-0-pro-260628` | $0.045 | $0.09 | not offered | BytePlus ModelArk pricing page |
| OpenAI `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` | no published price per image | | | OpenAI model page and image guide |

- **Gemini.** An input image adds a small token charge on the default model ($0.0011 on the Pro model). Google Search grounding is free for the first 5,000 search requests a month, shared across the Gemini 3 models, then $14 per 1,000.
- **Seedream.** BytePlus prices by output pixels: up to 2.61 megapixels is $0.045 and above it $0.09, so 1K falls in the first tier and 2K in the second. The first reference image is free and each further one costs $0.003.
- **OpenAI.** OpenAI bills tokens: $30 per million image output tokens, $8 per million image input tokens (the references of an edit) and $5 per million text input tokens, the same for both models. The page has a calculator by size and quality, and says it does not yet estimate 2.5; no figure per image is published, and the figures third parties list are theirs. So the **first OpenAI image is a probe**: make one, ask the user to read its charge on the OpenAI usage page, and set the ceiling for the rest from that. Until then the go-ahead says "no published price", not a guess.

The estimate for a go-ahead is the number of images times the price at the size. The worst case is three calls per asset (the first and two regenerations): `node ${CLAUDE_SKILL_DIR}/scripts/call-check.mjs <call.json> --images <n>` prints both.

## Where the words go

The prompt, and every input image, goes to the provider the call names, under the user's key. None of them is a place for a client secret, personal data or an unreleased product detail.

- **Gemini.** Google's Gemini API. On the paid tier Google's pricing page says the content is not used to improve its products. The user's own account terms are what apply.
- **OpenAI.** The OpenAI API. OpenAI's enterprise-privacy page says API inputs and outputs may be retained for up to 30 days to provide the services and to identify abuse; its data-controls page sets the rest per endpoint. The user reads them.
- **Seedream.** BytePlus ModelArk, at `ark.ap-southeast.bytepluses.com`. BytePlus says it processes customer data on the customer's instructions and does not use it to train its own models without the customer's authorisation; it keeps the input and output that its content filter flags for 180 days in Malaysia. A separate BytePlus campaign lets an account opt in to having its data used to improve models: never opt in with client work.

Whose terms apply, and whether a client allows a provider at all, is the user's call, not yours. When a brief names a client who has restricted where its material goes, ask before the first call.

## Choosing

| You need | Use | Because |
|---|---|---|
| An everyday scene, drafts, exploring | Gemini `fast`, 1K to explore, 2K to ship | The lowest published price ($0.0336 at 1K) and all 14 ratios |
| A final with fine detail or a complex scene | Gemini `quality` at 2K | The Pro model, $0.134; no extreme ratios |
| A very wide or very tall picture (1:4, 1:8, 4:1, 8:1) | Gemini `fast` or `balanced`, or Seedream | OpenAI stops at 3:1 and the Pro model has none of the four |
| An edit that combines many references (up to 16) | OpenAI, as a probe first | It takes the most references; its price is not published |
| Current or time-sensitive facts in the picture | Gemini with `useGoogleSearch` | Only Gemini grounds |
| 4K | Gemini or OpenAI | Seedream stops at 2K |
| A price you can quote before the call | Gemini or Seedream | OpenAI publishes none per image |
| The prompt reaching the model as you wrote it | Gemini or OpenAI | Seedream optimises the prompt on its side, so the model may see more than you sent |
| Words that must not go to one of the three | The one the user names | Their account, their terms: ask |

## What the install already settled

- `SKIP_PROMPT_ENHANCEMENT=true` is set, so the server does not rewrite your prompt with a second model (Gemini or OpenAI) and an image costs one call. `purpose`, `blendImages`, `maintainCharacterConsistency` and `useWorldKnowledge` only steer that rewriting, so they change nothing here: whatever they would add (a character kept recognisable, elements blended in one light, the intended use) goes into the prompt itself ([recipes](prompt-recipes.md)). Seedream still optimises the prompt on its own side whatever the setting.
- The server writes into the folder the user set (`IMAGE_OUTPUT_DIR`, inside the project) and nowhere else. It reads a file only when a call names input images ([input images](input-images-and-paths.md)).
- The pixel sizes of the Gemini default model are in the placement table of `image-creation` (`references/prompting.md`). OpenAI's are computed by the server from the ratio and the size in steps of 16 (4:5 at 2K is 1632 x 2048, 16:9 at 2K is 2048 x 1152, 1:1 at 2K is 2048 x 2048). Seedream decides its own. A size that matters is measured, not assumed: the lead's `image-check` finds a ratio that came back wrong.
