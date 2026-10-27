# Media provider and authentication cards

Official documentation retrieved **2026-10-24**; authored 2026-10-25. These are service capabilities and setup leads, not proof of account entitlement, prices, tool availability or generation. Live connections and outputs are **unverified**. Recheck the selected service's current model, terms, credit balance and costs before a paid job. Provider, underlying model, transport and billing account are separate fields. A model named ElevenLabs behind Kie is billed through Kie, not an ElevenLabs connection. No promotional credit/free-tier promise is part of this workflow.

## Higgsfield — hosted MCP

- Official endpoint: `https://mcp.higgsfield.ai`; stable manual server name `higgsfield`.
- Auth/setup: custom remote connector, human sign-in and access approval. The official article demonstrates Claude's connector flow; the exact Claude Code authorization handshake is **unverified** here. Never invent an API-key header for this endpoint.
- Capability: the service describes image/video generation and editing, references/characters and audio operations. Choose the exact model and inspect the connected tool schema before submitting; marketing coverage does not prove every tool is exposed to a restricted agent.
- Account/billing: Higgsfield account/workspace and its current credits/terms; other vendors' model subscriptions do not establish this entitlement. Reconcile job identity and download actual media from the workspace before handoff.
- Source: [official Higgsfield MCP article](https://higgsfield.ai/blog/Generate-AI-Videos-From-Claude-with-Higgsfield-MCP). Text/video claims are documentation only; no account connected or output played.

## Kling — hosted MCP

- Official endpoint: `https://kling.ai/mcp`; stable manual server name `klingai` (as the vendor's guide).
- Auth/setup: add remote HTTP server/connector, then human Connect/sign-in with the Kling account. The guide describes browser authorization; exact host-specific OAuth handling remains **unverified** here.
- Capability: official guide lists video/image generation, task queries/downloads and membership/credit queries. Use actual discovered tools and model/schema, then follow the returned task through completion. A successful submission or credit query is not a video.
- Account/billing: the retrieved guide limits MCP to **Personal paid credits**; Team workspace benefits, bonus credits and off-peak credits are unavailable on this route. Recheck that dated constraint and rights before uploading references. CLI login is a separate route and is not installed or run here.
- Sources: [official MCP landing page](https://kling.ai/app/mcp), [official MCP guide](https://kling.ai/app/mcp/guide).

## ElevenLabs — hosted OAuth MCP

- Official endpoint: `https://api.elevenlabs.io/v1/mcp`; stable manual server name `elevenlabs`.
- Auth/setup: remote HTTP plus human OAuth workspace sign-in through `/mcp` or the host's connector UI. This is the new hosted service, separate from the older local ElevenLabs API-key server; do not mix their configuration or tool names.
- Capability: documented speech, transcription, dubbing, music, sound effects, images and video, with results in ElevenCreative. Check the specific model, workspace tools and allowed use rather than inferring access from the endpoint.
- Account/billing: selected ElevenLabs/ElevenCreative workspace and current plan/credits. Kie usage of an ElevenLabs model is a different provider route. Save original local audio/video plus rights/take records, then listen/inspect before finishing.
- Sources: [official MCP setup](https://elevenlabs.io/mcp), [official generation announcement](https://elevenlabs.io/blog/introducing-voice-music-image-and-video-generation-in-the-elevenlabs-mcp). OAuth and tool execution remain **unverified** here.

## Fish Audio — hosted OAuth MCP; separate direct API

- Official MCP endpoint: `https://api.fish.audio/mcp`; stable manual server name `fish-audio`; streamable HTTP.
- Auth/setup: human OAuth sign-in selects the Fish team. Documented MCP abilities include narration, voice casting, transcription and image generation; discover the actual schema and choose approved voice permissions first.
- **MCP billing follows the web app, not the developer API.** A developer API key does not authorize the hosted MCP route. Source: [official MCP overview](https://docs.fish.audio/overview/mcp).
- Direct API is separately documented: `POST https://api.fish.audio/v1/tts`, bearer API token, explicit `model` header and JSON/MessagePack body; supported returned audio formats vary. A selected-project `FISH_API_KEY` placeholder can be prepared privately, but **this helper has no Fish create/status adapter**. Use authenticated MCP or a separately reviewed implementation of the official direct API; do not pass Fish to `runJob`.
- Source: [official direct TTS API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech). Developer quota, selected model/voice, billing, installation and actual inference are **unverified**. An unknown model can fall back server-side per the API docs: verify the accepted model, never rely on a typo.

## Kie — direct API, not a verified official generation MCP

- Endpoint/auth: `https://api.kie.ai`, bearer `KIE_API_KEY`, privately entered into the explicitly selected project's `.env`. The bundled helper implements `POST /api/v1/jobs/createTask` and `GET /api/v1/jobs/recordInfo?taskId=...`.
- Capability: model-specific `model` + `input`; this slice's audio example uses `elevenlabs/text-to-speech-multilingual-v2`. Kie also documents generation models for other modalities; select the exact model contract and returned format before a video job. No community Kie MCP is labelled official or installed.
- Account/billing: Kie's API credit balance and logs. Check both HTTP status and JSON `code`; HTTP 200 alone can contain a failure. Completion is `state: success` plus usable `resultJson.resultUrls`, followed by a validated local download. Queued/running, failure, timeout and no-output are distinct outcomes.
- Sources: [official API getting started](https://docs.kie.ai/), [official task status](https://docs.kie.ai/market/common/get-task-detail), [official multilingual TTS model](https://docs.kie.ai/market/elevenlabs/text-to-speech-multilingual-v2). [Runnable audio example](../../audio-generation/examples/kie-api-narration.md). Live model/voice entitlement, cost, output encoding and listening quality are **unverified**.

## BytePlus ModelArk — regional direct video API

- Exact documented data plane: `https://ark.ap-southeast.bytepluses.com/api/v3`; bearer `ARK_API_KEY`. Do not substitute a similar region/domain or send this key to a model aggregator.
- Helper contract: `POST /contents/generations/tasks` with selected `model` + `content`; `GET /contents/generations/tasks/{id}`; `succeeded` requires `content.video_url`. Other documented states include queued/running/failed/cancelled/expired. The helper resumes one observation per call and saves local media, not only a URL.
- Account/billing: BytePlus ModelArk account, enabled regional model/endpoint, its quota and current billing. ByteDance/Seedance model branding alone does not identify the provider or account. This research verified no suitable official generation MCP for this path; a whole Volcengine marketplace is not an official generation server.
- Sources: [official create task](https://docs.byteplus.com/docs/modelark/create-video-generation-task-api), [official get task](https://docs.byteplus.com/en/docs/modelark/get-video-generation-task-api), [official base URL/auth](https://docs.byteplus.com/en/docs/modelark/base-url-and-authentication). [Offline-shaped video job](../examples/byteplus-video-job.json) uses the model ID in the retrieved create example; account entitlement, parameter acceptance and actual output remain **unverified**.

## Shared exit and fallback

Registration, authentication, tool discovery, execution and local review are five separate results. If a selected service/tool/model is unavailable, Chris offers supplied/recorded audio, deterministic simple synthesis, native motion, editable Remotion or licensed stock via `commercial-stock-sourcer` as appropriate. Obtain a route decision before changing providers, uploading or installing. No silent fallback, automatic batching or blind retry after a possibly charged request.
