# Opt-in media setup and bounded API jobs

Read [provider/auth cards](media-providers.md) first. Sources retrieved 2026-10-24; live auth, tools, billing and outputs are **unverified**. Chris records the explicit provider/model/modality/route, reference and voice permissions, project USD ceiling and per-job approval in complete `media/project.json` preferences. Generated footage is independently optional for either native or Remotion rendering; local audio may accompany external video. Preferences do not authorize a paid call.

## Hosted HTTP MCP

The [credential-free template](../assets/media-http.mcp.template.json) lists four **alternatives** with explicit `type: http`. Merge only the selected entry into the host's project config; do not overwrite existing servers, register all four or insert keys. These stable manual names are not plugin or connector aliases. For Claude Code, the explicit commands are:

```text
claude mcp add --scope project --transport http higgsfield https://mcp.higgsfield.ai
claude mcp add --scope project --transport http klingai https://kling.ai/mcp
claude mcp add --scope project --transport http elevenlabs https://api.elevenlabs.io/v1/mcp
claude mcp add --scope project --transport http fish-audio https://api.fish.audio/mcp
```

These are instructions for an approved setup, not commands run by this document. The human completes private sign-in/OAuth in `/mcp` or the host connector UI; never paste tokens into chat, argv or tracked config. Do not read credential files, environment dumps, `mcp get` or `mcp list` for a credentialed setup. Ask for the human's status report and discover actual granted tools with `ToolSearch` instead. `Added` proves registration only. Check auth, granted capabilities, accepted model and actual tools separately, without spending on a test generation.

Claude Code facts follow the repository's pinned `host-library/claude/guide/mcp.md` and `agent.md`: URL entries require `type: http`; deferred tools need `ToolSearch`; restricted subagents need that tool plus real MCP grants and access through the coordinator's pool. A string in a Skill does not grant anything. If Sound/Motion cannot discover the selected tool, relay through the Lead with its real connection or resolve grants before execution. Never guess connector/plugin names; manual `mcp__<server>__<tool>` differs from plugin/connector naming. The existing [Claude route runbook](claude-code.md) records a restart after manual registration, plugin-specific `/reload-plugins --force`, and a fresh Desktop/VS Code conversation when needed. Newer pinned host docs describe later tool availability; follow the actual host surface, then rediscover in a fresh conversation if absent. Registration changes are not proof of loading.

Other Hosts: use their documented remote HTTP setup and private authentication UI, then inspect actual tools. This template is Claude-style JSON, not a claim that every Host shares its config schema. No host or account was connected in this slice.

## Selected-project API setup

Node >=24 is required. Help and plugin discovery work in standalone `mcp-setup` installs; media operations require `audiovisual-review/scripts/review.mjs` as a sibling in the same installed Skills layout and stop before project-file or provider activity when it is absent. The agency/full Bundles already supply it. Resolve the **installed mcp-setup root**, never a repository-only path. From audio-generation or video-generation on Claude, the sibling is `${CLAUDE_SKILL_DIR}/../mcp-setup`; other Hosts resolve the installed Skill root explicitly. If the sibling/helper is absent, ask the calling lead to arrange approved setup before execution.

```text
node "<absolute-installed-mcp-setup>/scripts/media-api.mjs" --help
node "<absolute-installed-mcp-setup>/scripts/media-api.mjs" --project "<absolute-project>" --mode setup --provider kie
```

Setup accepts `kie`, `byteplus`, or `fish-audio` and makes **no network request**. It preserves existing `.env`, appends only safe `.env.example` placeholders and a final ignore block protecting `.env`/`.env.*` except `.env.example`. The [example key names](../assets/media.env.example) contain no values. The human opens the explicitly selected project `.env` privately and enters only the selected provider key. The model must not read that file. The helper internally loads only that key, rejects missing/link paths and ignores inherited environment keys. Never put credentials in job JSON, prompts, shell arguments or logs. Existing `.env` is never overwritten or populated by setup.

## Create, resume and obtain a local file

Prepare full selected preferences, a stable job ID, a new `media/assets/...` output, positive `ceilingUsd` and `approved: true` **only after the per-job human acknowledgment**. The examples are offline fixtures illustrating an already acknowledged job; copying them is not spending permission. Match provider, model, modality and API route exactly. Kie payload needs `model` + `input`; BytePlus needs `model` + `content`. No callback/webhook or credential field. Model-specific cost/options/rights still need review. See [concrete Kie audio](../../audio-generation/examples/kie-api-narration.md) and [BytePlus video](../../video-generation/examples/approved-api-shot.md).

```text
node "<absolute-installed-mcp-setup>/scripts/media-api.mjs" --project "<absolute-project>" --mode create --job media/approved-job.json
node "<absolute-installed-mcp-setup>/scripts/media-api.mjs" --project "<absolute-project>" --mode status --job media/status.json
```

Status JSON is just `{"id":"the-saved-job-id"}`; the ledger supplies its saved provider, model and region. Create reserves the acknowledged ceiling, submits **once**, saves the task ID, then observes status **once**. Status never creates; it queries and downloads when ready. There is no implicit polling or retry loop. Keep pending jobs and use a deliberate status invocation later; a timeout retains the reservation. A submission without a reliable ID requires manual provider reconciliation, never a new paid create. Conservatively reserved ceilings estimate local spend; they are **not vendor-enforced caps or measured charges**. Compare actual billing privately and keep reservations until reconciliation; no automatic release.

Completion requires `status: completed` and local `artifacts` containing `path`, `mime`, `bytes`, `sha256`. An exit 0, task ID, CDN URL or successful HTTP code is insufficient. The helper checks response body, bounded status, HTTPS URL/host form, absence of selected credentials in URLs, redirects, size, MIME/signature, extension and exclusive local output. It omits prompts, full responses and transient signed URLs from the ledger/summary. MIME/signature is not codec/duration/rights or listening/playback review. Inspect the actual file before finishing.

`submission-unknown`: manually reconcile with the selected provider. `queued`/`running`/`status-unavailable`: retain identity and resume. `download-failed`: do not submit again; resolve format/auth/CDN issues and resume the saved task, or use an approved private manual export retaining task provenance. `rejected`/`failed`/`cancelled`/`expired`: report the outcome and reconcile costs; any new job needs fresh acknowledgment and output identity. Never print provider response bodies as diagnostics. A stale lock after a stopped process requires careful manual reconciliation before removing it.

Fish's setup placeholder supports a future/separately reviewed direct API client only; **no Fish runJob route is implemented**. Hosted MCP and official manual API handling remain distinct. Do not describe adapter setup as live authentication or tested generation.
