# Worked example: a BytePlus background plate

Chris approved a generated unbranded studio plate for scene `product-plate` in an existing editable Remotion film. Exact logo/copy stay editable overlays. Audio remains local and independently approved; generation is not required by Remotion. The example records a USD5 project limit and USD2 acknowledged shot ceiling; these are planning limits, not a price quote or vendor-enforced cap. Live provider entitlement, costs, returned codec/duration and playback quality are **unverified**.

Review [full selected preferences](../../mcp-setup/examples/byteplus-video-project.json), [job](../../mcp-setup/examples/byteplus-video-job.json) and [status identity](../../mcp-setup/examples/byteplus-video-status.json). Model `dreamina-seedance-2-5-260628` is from the official create-task example retrieved 2026-10-24; verify current regional entitlement and model-specific duration/ratio/defaults before acknowledging a job. Replace decisions with the actual project settings rather than overwriting existing preferences. This sample's `approved: true` describes an already acknowledged fixture; it is not authorization to spend.

Resolve installed sibling `mcp-setup/scripts/media-api.mjs` and its `audiovisual-review/scripts/review.mjs` dependency. Copy reviewed full preferences to `media/project.json`, job to `media/shot-job.json` and minimal status JSON to `media/shot-status.json`. The selected project already exists and paths are relative to it; retain sources/assets and prior revisions. The human enters only `ARK_API_KEY` privately in that project's `.env` after setup. Never read it or substitute a similar regional hostname.

```text
node "${CLAUDE_SKILL_DIR}/../mcp-setup/scripts/media-api.mjs" --project "<absolute-project>" --mode setup --provider byteplus
node "${CLAUDE_SKILL_DIR}/../mcp-setup/scripts/media-api.mjs" --project "<absolute-project>" --mode create --job media/shot-job.json
node "${CLAUDE_SKILL_DIR}/../mcp-setup/scripts/media-api.mjs" --project "<absolute-project>" --mode status --job media/shot-status.json
```

Other Hosts resolve the absolute installed sibling explicitly. Create once after acknowledgment; it reserves, submits once and observes once. Deliberate status calls resume the saved task without creating or implicitly polling. On ambiguous submission, reconcile privately before any new paid request. On download failure, retain the task and resolve format/export; do not generate a replacement blindly. Do not infer success from exit 0 or the provider task ID.

Accept generation only when a completed summary identifies local `media/assets/studio-shot-r1.mp4` with MIME/bytes/SHA. Fill [the shot sheet](../assets/shot-sheet.md), inspect actual codec/fps/duration/frames, then play/review the clip. This example includes no downloaded or reviewed footage. A provider result URL is deliberately absent from the handoff. After the human/authorized reviewer accepts a source trim, Motion maps it to the existing approved scene bounds, verifies frame-driven local seeking/exports and keeps the Remotion source editable. A native project may make the same independent generation choice and integrate through its own deterministic scene contract; changing renderer needs a separate decision.

Sound receives actual approved timing changes and any permitted generated audio separately. Final master/mux/captions and audiovisual acceptance remain finishing/review work. Anti-patterns: treating the two-dollar estimate as an API cap, replacing approved words with generated text, claiming codec/playback from `.mp4`, or handing Motion a task ID instead of a local inspected source.
