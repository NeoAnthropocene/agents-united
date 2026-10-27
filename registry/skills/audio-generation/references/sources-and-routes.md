# Source selection without hidden route changes

Start with the approved sound brief and saved project choices. `audioRoute: local` means local assets/processing; `api` means approved external generation; `hybrid` names a deliberate split. None is implied by the selected visual renderer. Chris owns scope, human questions and budget. A source unavailable locally does not authorize an upload or a cloud fallback.

## Source order and evidence

1. Inventory supplied assets first: original filename, project-relative path, SHA-256, actual format/duration, content and take identity. Ask whether the file is a reference, scratch, licensed source or approved final. Do not assume a client upload carries all intended rights.
2. Prefer an authorized new recording when exact words, pronunciation and a specific performance matter. Specify microphone/room constraints, delivery format and time for pickups. A simple phone recording can be a scratch timing source; suitability for final release requires listening.
3. Use an owned/licensed music or SFX library when it meets the brief. Keep source/receipt/licence evidence, permitted edit/loop/synchronization/distribution use and attribution. The visual stock sourcing Skill does not establish audio rights.
4. Use deterministic simple synthesis for a tick, pulse, tone or noise sweep when that is the desired sound. It does not become a speech or soundtrack solution by labeling a file `vo` or `music`.
5. Consider a local model or opted-in provider only for a capability the brief needs. Select by actual language, voice/style, duration/control, rights and processing constraints. Preserve the provider/model identity separately from the billing route.

Keep originals immutable and make edits in new project-relative revision paths. Record a hash before and after copying; a match establishes bytes, not ownership. Reject missing, zero-byte, wrong-type or corrupt results before choosing a take. Retain source files even when a final edit is resampled or trimmed.

## External route boundary

Through Chris, confirm which source audio/text may leave the project, the chosen provider/model, account route, retention/usage review and a per-job ceiling. Use the project's approved setup mechanism; do not read credentials or paste them into prompts/argv/config dumps. Authentication success, tool availability, provider body success and media correctness are separate checks.

For asynchronous generation, persist nonsecret request identity and durable returned job ID/state before polling. A timeout may mean the job is still running or completed. Reconcile that identity before resubmitting so a connection failure does not duplicate paid generation. A downloaded file must still be decoded, measured, listened to and traced to the request. Do not call an HTTP 200 or a playable URL final approval.

If declined or unavailable, offer a concrete local alternative: supplied voice, new authorized recording, licensed bed or no music. State the tradeoff and exact missing input. Do not expand scope to account setup, model download or a new platform without Chris's approved decision.
