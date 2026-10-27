---
name: video-generation
description: 'Use when an approved film needs optional generated footage or a model-created shot. Trigger phrases: "generate video", "AI footage", "image to video", "background plate". Skip static imagery, editable motion production alone, or a job without generated-footage opt-in.'
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

## Overview & Purpose
Produce inspected local source clips for Motion's editable composition. Generation is an independently optional footage route for native HTML/SVG/canvas or Remotion; it does not replace storyboard, approved copy, brand assets, timeline or final rendering. This is original [MIT work](LICENSE).

## Execution Triggers
Use after Chris explicitly includes external footage and selects provider/model/route and spending limits. Start from an approved shot need; an available account or a renderer choice is not generation permission. Licensed stock through commercial-stock-sourcer or existing footage may satisfy the shot without generation.

## Input/Output Requirements
Require the shot brief, visual references with rights/likeness permissions, exact protected copy/brand treatment, destination/timebase, generatedFootage choice and acknowledged job ceiling. Return original local clips/hashes, model/task/parameter provenance, [shot sheet](assets/shot-sheet.md), measured format/duration and frame/playback review findings. Mark unperformed checks **unverified**. Final timing follows the sibling [media contract](../audiovisual-review/references/media-contract.md).

## Step-by-Step Runbook
1. Read `media/project.json` and [route/review guidance](references/shot-production.md). Resolve missing consent, provider/model, output needs or budget through Chris. Preserve the chosen renderer and approved narrative; do not add media to a static request.
2. Define one shot's subject, action/camera, composition, duration/handles, aspect ratio, reference use and exclusions. Keep exact UI, logos and claims in editable overlays when generation cannot preserve them. Record reference licences, actor/voice consent and upload permissions before submission.
3. Open sibling [mcp-setup provider cards](../mcp-setup/references/media-providers.md) and [media setup](../mcp-setup/references/media-setup.md). Confirm actual installed tools/helper, private human auth, model schema and billing. Registration, authentication and real tool access are separate. Restricted agents use granted tools/ToolSearch or the Lead's relay, never guessed aliases.
4. After per-job acknowledgment, use the selected actual MCP tool or the bounded API helper as in [the API worked example](examples/approved-api-shot.md). Save a stable identity before observation; no blind retry, provider switch, implicit batch or polling loop after a timeout. Local ceiling reservations are not vendor-enforced caps or actual charges.
5. Obtain actual local files under `media/assets/`; a task ID, completed status or transient URL alone is insufficient. Preserve originals and hashes. Inspect codec, dimensions, frame rate/count, duration, sample frames at start/middle/end, seams and subject/brand/rights defects with [the inspection checklist](references/shot-production.md). Do not claim playback from metadata or thumbnails.
6. Give Motion the selected source/trim range, source fps, approved scene/cue mapping, review evidence and rights record. Motion integrates it in the chosen editable route and verifies seeking/rendering locally. Keep generated audio separate for Sound's consent/listening/finishing decision. Timing or copy changes return to Chris and Sound before a new freeze.
7. Hand off the local clip, shot sheet and decision status; Sound receives actual approved timing dependencies. Final Sound master, mux and audiovisual review use their own gates. A source clip does not establish a finished film.

## Code & Config Exemplars
For the API route on Claude, `node "${CLAUDE_SKILL_DIR}/../mcp-setup/scripts/media-api.mjs" --project <absolute-project> --mode status --job media/shot-status.json` resumes a saved task without creating. Resolve installed sibling roots explicitly on other Hosts; Node >=24 and `audiovisual-review` are required. Read [the API example](examples/approved-api-shot.md) for full preferences/create/status, or [the stock/native example](examples/stock-or-native.md) for an unavailable service.

## Edge Cases & Error Recovery
If auth/tool/model/rights are unavailable, present supplied footage, licensed stock or native/Remotion motion through Chris; never silently route to another provider. Reconcile charged/ambiguous jobs before resubmitting. Reject identity drift, malformed text, unwanted marks, unusable duration or undocumented rights, retaining the source and findings. Anti-patterns: a URL-only handoff, presenting source fps as timeline fps, embedding generated claims as approved copy, or reporting an unseen clip as reviewed.

## Verification Checklist
- Explicit footage opt-in, selected route/model, reference permissions and per-job acknowledgment are recorded.
- Task identity and local original path/MIME/bytes/SHA are present; secret/signed-URL data is absent from public records.
- Actual codec/duration/frame/playback/rights findings are distinguished from requested settings and metadata.
- Editable integration preserves brand, copy and timeline; Sound receives any timing changes before freeze.
- Live generation, installed Host loading and creative/playback quality remain **unverified** until evidenced.
