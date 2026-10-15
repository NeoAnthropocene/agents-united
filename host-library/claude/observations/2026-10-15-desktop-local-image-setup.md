# Desktop Local image setup, 2026-10-15

The maintainer supplied the completed Desktop records for candidate `9544341693ae57a12f16ab8c3523c264f1b5825b`, project `agents-united-image-desktop-setup-70804325`. These are observations of Desktop **2.37337.1**, embedded Code **2.1.295**, Windows **10.0.26200 x64**, Sonnet 5.5/Low and a **Pro** login, not vendor documentation. Review started no host session or provider call and did not read credentialed MCP files or environment values. [Compact reviewed evidence](2026-10-15-desktop-local-setup-evidence.json) records source hashes; original supplied summaries, JSONL records, configuration and flags remain private and unchanged.

## Observed setup and visibility

| Stage | Session | Native setting | Observed result |
| --- | --- | --- | --- |
| Setup | `399389f6-2768-4778-844a-ddac15262c32` | `orchestrator-digital-agency` (Chris) | Loaded mcp-setup and its Desktop reference/template; wrote the exact credential-free project definition; no terminal registration or image-tool invocation. |
| Fresh designer | `84de5b96-8bbc-4054-8e70-c7159db22035` | `agency-creative-designer` (Jamileh) | Image tool returned by ToolSearch twice; image-generation and image-creation loaded; later image invocation failed as detailed below. |

Native activation comes from host `agent-setting` records. The setup's successful Write at **06:59:27.580Z** matches the prepared selected-provider definition: alias `image-gen`, declared `npx -y mcp-image@0.18.0`, only `GEMINI_API_KEY=${AGENTS_UNITED_GEMINI_API_KEY}`, default Gemini, `SKIP_PROMPT_ENHANCEMENT=true` and this project's actual absolute `assets/generated` directory. Forward-slash Windows path spelling was accepted by the guard. There was no need for the private-merge route. The model gave the Local-editor key-entry steps and honored the accepted shared scope; it did not ask for a key in chat. Its blocked shell command only tried to list project files/read a bundled reference, not register a server; it recovered with explicit Reads.

The supplied status moves from six connected servers in setup to seven including image-gen in the fresh designer. ToolSearch returns the actual image-tool reference. This establishes setup-file creation and tool visibility without terminal registration. It does **not** establish correct human key entry, environment expansion, the actual loaded package version or which same-name stored definition won. The recorded human selected-server confirmation is not an independent configuration inspection.

## Two invocations, one provider failure

Initial setup and the designer visibility check invoked no image tool. After later human go-aheads:

1. At **07:29:57.022Z**, Jamileh invoked the tool with `fileName=gui-dog-scene-a1`. PreToolUse denied it because the case was not armed. No provider receipt is observed for this blocked invocation. The filename also differs from the fixed case stem; the gate stopped before parameter validation.
2. The human arm flag is dated **07:32:20.003Z**. After the exact optional-image prompt, at **07:32:38.290Z** she invoked Gemini fast, 2K, 4:5, `fileName=gui-desktop-70804325`, without inputs or grounding. The harness allowed it and consumed the one-attempt flag. Its tool-use ID matches that flag. The tool returned **GEMINI_API_ERROR / HTTP 400**, with Google's message **"API key not valid. Please pass a valid API key."** PostToolUseFailure was recorded at **07:32:43.663Z**. She did not retry after this failure.

The generated directory is empty: no image or provenance file. Zero image-check findings on an empty directory is not a generation pass. The supplied collector's phrase "Image attempts recorded: 2" conflated a denied invocation with the allowed attempt. The corrected collector reports **two tool invocations: one harness-denied, one harness-allowed**. Allowed alone does not prove provider receipt; the explicit upstream error is the evidence in this case. Missing/conflicting hook decisions remain unclassified.

The credentialed generation test failed. A wrong/missing/revoked key, an unset holder passed literally, stale process environment, or a same-name override are possible explanations; **the root cause remains unverified**. The response does not distinguish them. No credential file, key value or environment dump was inspected to resolve it. The designer's final blanket claim of no external-service contact is contradicted by its provider call; its suggestion that rejection should be uncharged is not billing evidence.

## Harness, cost and limits

Both sessions bound automatically, with no missing/unparsed records or event-only sessions. All **753 protected hashes** and allowed settings integrity checks pass. Expected containment refusals were three setup probes (Bash/Grep/Glob), one designer Grep and the unarmed image invocation. Separately, Desktop returned **"No such tool available"** for `mcp__ccd_turn__update_plan`; no synthetic hook decision is captured for that unavailable tool. This is distinct from image-server visibility and the Gemini credential error. No guard was disabled and no controls or attempt flags were reset.

The host reader counts **one setup plus five designer human prompts**, exceeding the proposed four-prompt limit. Neither transcript has a cost-state record: model cost, provider bill, quota headroom and compliance with the proposed USD ceiling remain **unverified**. A failed request is not proof of zero spending. A heuristic Google/OpenAI key-shape scan found no matches in the two transcripts; the setup Write was independently checked to contain only the expected holder reference, not a literal credential. This is not proof of absence of every secret format.

The accepted route is now **observed through credential-free setup and fresh native designer tool visibility**. Successful credential delivery and image generation through the Local editor remain **unverified**, and this run failed at credential validation. Real OpenAI/Seedream generation, unknown-configuration private merge and configuration precedence remain unverified. The earlier terminal-route Desktop success is separate evidence. No coordinated team, shutdown or ListAgents result is inferred.

Preserve this spent case. Before any separately authorized new generation test, the maintainer can privately check the exact Local holder name/value, selected server and fresh-conversation environment; do not paste keys, dump configuration, modify other scopes, or clear the attempt flag to retry this case. The [runbook](../../../docs/gui-image-test.md) remains the preparation/collection route for a fresh case.

Validation: the collector count regression failed before correction. All 30 offline harness cases now run through the repository wrapper (28 pass on Windows, two POSIX-only skips); typecheck and host-library verification exit 0. The full serial suite exits 0: 219 files, 4,574 passed, 209 skipped. Supplied result hashes are unchanged; reviewed output is separate and no new host/provider session was started.

## Later separate-case success, 2026-10-15

The [credential-correction retry](2026-10-15-desktop-local-image-success.md), candidate 69b4869 and project ending e8d2fd77, later produced one Gemini image, Read/critique and a valid sidecar with all 753 protected hashes intact. That designer-only case was prepared offline and followed human environment/configuration repair; it does not replace this earlier failure or establish a fresh uninterrupted Chris setup-to-image run. The maintainer also clarified that the holder in this earlier test was entered after the designer/server started, and later reported variable-reference syntax in the Local editor. Those reports support possible explanations, not an independently isolated root cause or key-value inspection. Costs, precedence and the actual loaded package remain unverified. See the later observation for the distinct sessions and limits.
