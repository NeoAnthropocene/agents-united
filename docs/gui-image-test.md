# Interactive Desktop image setup test

Use `scripts/image-client-test/prepare-desktop.mjs` after building a clean, committed candidate. This local harness starts no Claude session or image server. It installs authentic project-native Chris/Jamileh definitions and skills in a new disposable Temp project, records the exact Git revision and protected SHA-256 hashes, and writes a project README with copyable prompts and commands. Installer/doctor discovery uses an empty isolated home and a minimal environment, so preparation does not inspect real MCP credential files or inherit provider keys. It is not an audit of the user's actual server configuration. Existing comparison projects/manifests are never overwritten. PRs target dev; the maintainer's candidate 9544341 records now establish credential-free setup and fresh designer visibility; successful Local-editor credential delivery/generation remains **unverified** after a Gemini HTTP 400 credential rejection.

```powershell
npm run build
node scripts/image-client-test/prepare-desktop.mjs scratch/desktop-setup-2026-10-15/cases.json gemini gemini
```

Select any nonempty subset of `gemini,openai,seedream` and a default from that subset. The optional single-image exercise is deliberately restricted to Gemini fast 2K 4:5, without inputs/grounding/retries; omit it if Gemini was not selected. All seven provider subsets are covered offline. Seedream uses ARK_API_KEY; it is not Seedance.

Follow the generated README in **Claude Desktop Code**, **Local** mode, in that exact folder. Native Chris handles `/mcp-setup`; the human enters keys in the Local environment editor; native Jamileh uses a fresh conversation for visibility. No coordinated-team support is assumed. No terminal MCP registration is required. The offline helper changes only the native main-agent setting between conversations and verifies the Chris record first. Project approval/server-selection and actual output-directory confirmation must precede an optional image unlock. Stop on same-name precedence collisions; do not inspect credentialed files or change Chat/user-scope servers.

| Provider | Human-entered Local holder | Server mapping |
| --- | --- | --- |
| Gemini | AGENTS_UNITED_GEMINI_API_KEY | GEMINI_API_KEY |
| OpenAI | AGENTS_UNITED_OPENAI_API_KEY | OPENAI_API_KEY |
| Seedream | AGENTS_UNITED_ARK_API_KEY | ARK_API_KEY |

Shared Local scope is already accepted. Keep only selected references in `.mcp.json`; set `IMAGE_PROVIDER` to the chosen default, `SKIP_PROMPT_ENHANCEMENT=true`, and the real absolute `assets/generated` path. The guard accepts one exact credential-free definition Write when the file is absent. If any project MCP file exists, its safety is unknown to this harness: do not read/overwrite it; write only `deliverables/image-gen.private-merge.json` for a human private merge. The broader product route can preserve known credential-free entries, but this synthetic case never classifies an unknown file by inspecting it.

Setup and visibility cause **zero image-provider calls**. The maintainer's signed-in Claude account/plan pays for the interactive model use (the prior VS Code status identified Claude Pro; the current Desktop login must be confirmed). Estimate 0.5-1.5 USD of notional model use, proposed ceiling 2 USD/four human prompts across both conversations. Quota headroom is **unverified**: check it privately before starting. The optional image uses the maintainer's Google billing project: dated 2026-10-09 estimate 0.0504 USD output plus input/thinking, proposed ceiling 0.25 USD/one attempt. These are estimates and ceilings, not current bills. A separate human authorization and explicit unlock flags are required. Preparation and collection spend no model/provider funds.

Collect automatically using the generated manifest path:

```powershell
node scripts/image-client-test/collect.mjs <cases.json> desktop
```

Without SessionStart bindings, supply actual existing UUIDs. Never start a session just to collect:

```powershell
node scripts/image-client-test/collect.mjs <cases.json> desktop <setup-UUID> <designer-UUID>
```

The role switch also accepts `--session <setup-UUID>`; the optional unlock accepts `--session <designer-UUID>`. Missing UUIDs fail explicitly. The collector writes only beside the manifest under `results/desktop`, checks images without stamping/renaming, discloses missing/uncollected sessions and partial JSONL lines, and leaves costs unverified when records are incomplete. Tool calls and denials are distinct; native settings and successful tool references come from host records. Original records, `.probe`, generated files, manifests and private configuration stay out of Git. Share sanitized evidence/summary plus non-secret GUI observations.

Offline checks run in `npm test` through `tests/image-client-harness.test.ts`. They cover Windows folder/binding behavior, POSIX case sensitivity on POSIX, real-path containment, exact MCP definitions, all provider subsets, literal/duplicate-key refusal, unknown-file private merge, image approval/settings integrity, one-attempt authorization and collector fallback/completeness. See the [VS Code recovery observation](../host-library/claude/observations/2026-10-15-vscode-image-harness-recovery.md).


The [2026-10-15 Desktop result](../host-library/claude/observations/2026-10-15-desktop-local-image-setup.md) contains one unarmed image-tool denial and one allowed request that returned "API key not valid". Collection completeness means the captured records are readable; it is not a successful image test. The collector now separates tool invocations by their controlling hook decisions. Preserve the spent case and supplied results. Do not clear its attempt flag or infer a free request from an error; another generation test needs a fresh case and separate human authorization after private credential/server checks.
