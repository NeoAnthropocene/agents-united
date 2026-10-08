# Creative designer (Jamileh) on Claude: evaluation

Plan 036, evidence document. Written 2026-10-07 on `dev` at `aa7dbe3`. It is to `plans/036-claude-creative-designer-improvement.md` what `digital-agency-audit.md` is to Plan 035: the plan decides, this file shows what the decisions rest on.

**How far the evidence goes.** Nothing here was run on a Claude subagent: no Claude subagent session was started, no image MCP server was installed or called, no image service was used and no provider account was created. The external pages were read through a web-scraping tool. What was done: the three layers of the role and the previous evaluations were read, the recorded live sessions that include Jamileh were read, every external claim was checked against its primary source where one exists, and two small checks were run in the session sandbox ("Checks run for this document"). Each claim below carries a status: **verified** (read or run, source named), **sourced** (a vendor or third party says so, not confirmed by a primary source), or **unverified**.

## What was read

| Layer | File | Size | Note |
|---|---|---|---|
| Claude native role | `registry/hosts/claude/agents/agency-creative-designer.md` | 116 lines; `description` 272 of the 300-character cap | The body is authored; the floor, the hooks and the `tools:` line are generated (`UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts`) |
| Semantic core | `registry/core/subagent-marketing-creative-designer.core.md` | 63 lines; 10 invariants; 8 capability classes | Tool-free by contract (ADR 0021 decision 1); the floor is locked (decision 6) |
| Canonical agent | `registry/agents/subagent-marketing-creative-designer.md` | 219 lines | Antigravity dialect: `generate_image`, `view_file`, a `/generative-ui` fallback mode; this is what the other hosts' legacy lanes still project |

Her `tools:` line: `Edit, Glob, Grep, ListAgents, ListMcpResourcesTool, NotebookEdit, Read, ReadMcpResourceTool, SendMessage, Skill, SubagentHandback, ToolSearch, WebFetch, WebSearch, Write`, plus `mcp__figma`, `mcp__plugin_figma_figma` and `mcp__stitch`. No shell, no browser tool, no image tool. The shell is withheld on purpose (ADR 0039 decision 2); `tests/native-claude-agents.test.ts:85` is where her server grants are set.

The nine skills her table loads (headroom is against the 6,000-character ceiling of ADR 0040's amendment, which binds rewritten in-house skills only):

| Skill | Lines / characters | Origin | Headroom |
|---|---|---|---|
| `ad-creative-design` | 59 / 5,591 | in-house, 3.0.0, `references/sizes-and-safe-zones.md` | 409 |
| `marketing-creative-design` | 60 / 5,973 | in-house, 3.0.0, `references/export-budgets.md` | **27** |
| `design-system-tokens` | 61 / 5,921 | in-house, 3.0.0, `references/contrast-table.md`, `scales.md` | **79** |
| `frontend-design` | 64 / 8,449 | `anthropics/skills@8a1541c`, Apache-2.0 | exempt |
| `stitch-design-taste` | 194 / 12,022 | provenance unresolved (MIT declared) | exempt |
| `generative-ui` | 131 / 5,840 | provenance unresolved (Apache-2.0 declared) | exempt |
| `brand-identity` | 212 / 12,725 (15 extra files, 5 scripts) | independent writing, 2 percent overlap | exempt |
| `banner-design` | 170 / 9,923 | independent writing, 11 percent overlap | exempt |
| `ux-writing` | 183 / 12,402 | independent writing, 3 percent overlap | exempt |

Previous evaluations used: `docs/skill-quality/digital-agency-audit.md` (S1: her skills' verdicts), `docs/skill-quality/design-provenance.md` (S4: the three unresolved provenance records), Plan 035's decision log (D4, D11, D16 to D28, D31, D32, D42), `docs/live-test-protocol.md` (H1, H8), ADR 0021, 0036, 0039, 0040, 0043 and 0044, and the session records under `host-library/claude/observations/` and `tests/fixtures/session-report/`. D-numbers in this file are Plan 035's decisions.

## What the live records show

Five sessions include her. In every one her task was the same: write `docs/pilot/design-tokens.json`, at most 40 lines, with a token named `color.cta.primary`.

| Session | Date, build | What she did | Deviation seen |
|---|---|---|---|
| `d2f784af` (fixture) | 2026-10-04, 2.1.288 | ToolSearch, Read of `strategy.md`, Write (38 lines), `TaskUpdate completed` in the same response | No re-read (fixed by D32); contrast "calculated by hand ... unchecked by any tool"; "no chance to mark it in_progress first" (D31) |
| `123266e9` (fixture) | 2026-10-04 | Read, Write, a `SendMessage` to Kaan, then a `Read` of lines 1 to 12 only | Partial re-read (`limit: 12`); no parse check; no `Skill` call; contrast again by hand |
| H1, first run (Sitting C) | 2026-10-06, 2.1.291 | One file, read back | Her `Read` and her completion were issued 107 ms apart in one response (the H1 observation: the order held, the dependence did not) |
| `3a0dca4d` (H1 rerun) | 2026-10-06, 2.1.291 | Read 2, ToolSearch 2, TaskGet 2, Skill 1, Write 1, TaskUpdate 1, SendMessage 1 | Re-read before reporting |
| `75b89b2c` (N3, R2) | 2026-10-07, 2.1.292 | ToolSearch, Read, `Skill design-system-tokens`, Write (32 lines), Read, report | Write, Read and report in separate responses (D42 holds). **`references/contrast-table.md` and `scales.md` were never opened** (`trace-r2-jamileh.txt`) |

Read together: the comms discipline she was hardened for (re-read, structured shutdown, report sections, blocked tasks) now holds. What those sessions say nothing about is her own job. Verified.

## Findings

Ranked by how much a wrong outcome costs. "Predicted" means the failure follows from the files but no run has shown it.

**F1. `generative-ui` is Antigravity-only and she loads it.** Verified. Her table row (host file line 82) sends "a prototype is asked for" to a skill whose body (`registry/skills/generative-ui/SKILL.md`) says: save the page with `write_to_file` and `ArtifactMetadata: UserFacing` (lines 25 to 27); embed it with an `<agent-embed>` tag in the chat (28 to 34); style it with a Tailwind build served from an Antigravity-only `gstatic.com` path because "all external CDNs are blocked by CSP" (38 to 45); use `--background`, `--card` and the other variables "the iframe injects" (47 to 59); and "never define local color fallbacks on `:root`" (61 to 63). On Claude Code none of that exists. There is no `write_to_file` (the tool is `Write`), the terminal does not render `<agent-embed>`, and a page opened in a browser has none of the injected variables, so `var(--card)` resolves to nothing and the no-fallback rule makes the page unreadable. The suspicion that it fails because Claude has no image model is right in outcome and different in cause: the skill never asks for an image model, it writes HTML for Antigravity's chat surface.

The damage is wider than her table. The Claude lane maps `disable-slash-command: true` to `user-invocable: false`, which the projector's own ledger entry describes as "hidden from the / palette while staying model-invocable" (`src/core/claude-projector.ts:710`). The skill is therefore installed and loadable from its broad description ("show the user diagrams, data visualizations, interactive controls ...") by any role with the `Skill` tool, in all five bundles that list it (`product-design`, `growth-marketing`, `performance-paid-acquisition`, `full`, `digital-agency`). Its provenance is "Unresolved, keep" (`design-provenance.md`). No test pins it in her table (checked: the tests that name it cover the rename).

**F2. Photo-like imagery has no path.** Predicted. The Claude body says "Claude Code has no image-generation tool: you ... do not render raster images" (host file line 87) and stops. `marketing-creative-design` steps 3 and 7 assume photography is supplied and its licence recorded; `ad-creative-design` lists "a stock photo where the product would prove the point" as an anti-pattern and names no sourcing route. A brief that needs a hero photo and supplies none therefore has two likely outcomes: SVG shapes dressed up as a photograph, or an unlabelled gap. The canonical agent had `generate_image` (Antigravity); the port dropped it without replacing the decision it served.

**F3. Visual critique was dropped in the port.** Verified. The canonical agent's Phase 1 is "Image Inlining & Visual Critique": ingest client mockups, screenshots and competitor creatives and audit "layout balance, focal points, white space, and text legibility over busy image backgrounds" (lines 73 to 77). The core's mission has no such line and the Claude body has none: the only image wording in it is the negative statement of F2. Yet `Read` is in her tools and returns PNG, JPG and other images "as visual content that Claude can see" (`host-library/claude/pages/tools/tools-reference.md`, Read tool behavior), and her competitor step uses `WebFetch`, which returns text. Two limits from the same page matter to her: large images are downscaled and, above 500 KB after that, re-encoded as JPEG at reduced quality, and the documented remedy for lost detail is to crop "for example with ImageMagick via Bash", which she does not have.

**F4. She cannot see or measure what she makes.** Verified, with one prediction. (a) Contrast: the first fixture run reports ratios it "calculated by hand ... so these figures are unchecked by any tool" and the second "computed contrast by hand ... the ratios are approximate"; in R2, the only post-hardening run, she loaded the skill and never opened the table that D24 built for her ("You have no shell, so this holds the arithmetic"). That table covers only the neutral ramp of the worked example; for any brand pair the skill says "Emre measures any other pair" and defines no hand-off. (b) `marketing-creative-design` step 5 and its checklist demand "measured" export sizes and `export-budgets.md` says "Measure every export; do not estimate": a role with no shell cannot, and the file offers no no-shell path. (c) `banner-design` needs "a browser or screenshot capability" to export a PNG at the exact size (its lines 47 to 48, 98 to 101, 149 to 151) and falls back to "deliver the HTML/CSS source and mark PNG export as pending", so with her tools its main deliverable is always pending. (d) Predicted: the SVG blocks she writes are never looked at by anyone before they reach the lead.

**F5. Her own job has no live evidence.** Verified. Five sessions, one task type (the tokens file). H8 compared six skills with no skill (iteration 1: `ab-test-setup`, `accessibility-audit`, `conversion-funnel-optimization`, `copywriting-frameworks`, `growth-experiment-design`, `seo-audit`; iteration 2: three of them); none is hers. Her three in-house skills each carry three evals (`id`, `prompt`, `expected_output`, no fixtures, no assertions) that have never been run. The Output Contract's SVG suite, the variant matrix, `banner-design`, `brand-identity` and Figma and Stitch use are untested live.

**F6. The floor and her skills disagree on sizes, and one reference dangles.** Verified. The floor's Output Contract shows 1:1, 9:16 and 16:9 only (host file lines 43 to 59). `sizes-and-safe-zones.md` leads with 1080 x 1350 (4:5) for portrait feeds and 1200 x 628 for the professional network, `ad-creative-design`'s worked example is `1080x1350`, and the canonical delegation matrix lists 4:5 and 1.91:1 (line 106). Step 5 of the body says "as the Output Contract describes" (line 89) but the three-to-five variations live in Scope Boundaries item 5 (line 36).

**F7. Skills tell a shell-less role to run things.** Verified. `brand-identity` lists "Node.js available to run the audited scripts" as a prerequisite (line 51) and its runbook shows `node scripts/*.mjs` calls (lines 95 to 133); `marketing-creative-design` asks for measurement (F4b). D22 and D24 solved this for `design-system-tokens` only.

**F8. The safety floor says nothing about generated or composited imagery.** Verified. The floor's safety has three bullets: no deceptive ad designs, WCAG AA contrast, the 80 percent safe zone. Scope Boundaries item 5 lists "customer testimonial badge" as a hook. There is no rule on invented customers or faces, a real person's likeness, third-party marks, or disclosure where a platform requires it. It matters today for SVG "testimonial" art and becomes material once any photo-like route exists.

**F9. Nothing says that text she reads is data.** Verified. She is told to use `WebSearch` and `WebFetch` on competitors, and F3's fix has her read images from outside. No agency role body carries a rule that text inside fetched pages, Figma files or images is data and not instructions (searched `registry/hosts/claude/agents`, `registry/core`, `registry/agents`: the hits are application input validation and the AI roles). So this is a catalog-wide gap; it is sharper for her because an image can carry an instruction.

**F10. The portability lint cannot see host-specific primitives.** Verified. `src/core/skill-portability-lint.ts` checks names, sizes and POSIX-only scripts. It has no check for tool names or rendering primitives of one host inside a skill, which is the class of defect behind F1. The tokens can be derived, not listed by hand: the canonical agents' `tools:` lines name 18 tools that Claude's tool catalog (`registry/hosts/claude/tool-policy.json`) lacks; 17 contain an underscore (`write_to_file`, `view_file`, `run_command`, `generate_image`, `invoke_subagent` and so on) and the 18th, `schedule`, is an ordinary word and is left out. Add `ArtifactMetadata`, `agent-embed` and `MediaResolution` and the set is 20 tokens. Scanned as whole tokens over the bodies and supporting files of the 54 skills of `digital-agency` (`evals/` excluded), three skills hit: `generative-ui` (the defect); `mcp-setup` (on purpose: it has a row per host and names each host's tools); `subagent-driven-development` (`invoke_subagent`; generated, loaded by no role, already on the maintainer's drop list). Scoped to the **46 skills that the `| Situation | Skill | Load when |` tables of the Claude native roles load**, exactly one hits: `generative-ui`, through her row. `mcp-setup` is loaded by the lead from prose, not from a table row, so a table-scoped guard needs no exemption today; it should carry one for `mcp-setup` so that tabling it later does not turn the suite red for the wrong reason.

Noted, not proposed: `NotebookEdit` is in her tools through the `edit` class ("narrowing a role is done by narrowing its classes in the Semantic Core, not per tool", `tests/native-claude-agents.test.ts`); her description has 28 characters of headroom; four of her third-party skills are 9 to 13 KB each, and a loaded skill stays in context with only its first 5,000 tokens surviving compaction (ADR 0040 amendment), so loading `stitch-design-taste`, `brand-identity` and `ux-writing` together is a real context cost. Her `model: sonnet` and `effort: medium` pins were not examined: no recorded run exercised the work they would affect, so there is nothing to compare.

## Image creation: what holds for Claude

| Fact | Status | Source | What it means for the role |
|---|---|---|---|
| Claude "cannot generate, produce, edit, manipulate, or create images"; it reads JPEG, PNG, GIF and WebP up to 8000 x 8000 px | verified | Anthropic vision docs (`platform.claude.com/docs/en/build-with-claude/vision`, read 2026-10-07) | The premise of this evaluation holds. Images come from code or from an external model |
| Claude Code's `Read` returns images as visual content, downscaled and recompressed when large; crop with a shell | verified | `tools-reference.md`, Read tool behavior | She can critique supplied images; she cannot crop |
| An MCP tool's PNG, JPEG, GIF or WebP result is shown inline; the original bytes are saved under `~/.claude/projects/.../tool-results` and Claude is given the path (v2.1.283 or later; no file if session persistence is off); image results count against `MAX_MCP_OUTPUT_TOKENS` | verified | `host-library/claude/pages/mcp/mcp.md`, "Images in tool results" | **A shell-less role receives the path and cannot move the file into the project**: `Write` and `Edit` are text-only. A usable image server must write to a path the caller names, or a role with a shell copies the file |
| For a teammate, the definition's `skills` never apply and `mcpServers` apply only to split-pane teammates | verified | `host-library/claude/guide/orchestration.md:69`, `pages/orchestration/agent-teams.md:279` | An image server cannot be scoped to her in an in-process team; it comes from the project's MCP config (the lead's Preflight route, Plan 035 D44 to D57) and her `tools:` line grants its tools |
| `claude mcp add --transport http <name> <url>` adds a remote server; `${VAR}` expansion works in `.mcp.json` | verified | `mcp.md` | Remote servers need no local code; keys stay out of the committed file |
| Playwright MCP blocks `file://` navigation by default; `--allow-unrestricted-file-access` lifts it and also lifts the workspace-root limit on file access | verified | `microsoft/playwright-mcp` README (read 2026-10-07) | "Open her SVG in the browser" does not work out of the box; a served `http://localhost` page or an explicit opt-in is needed |
| Two honest routes exist: code that Claude writes and a tool renders (SVG to PNG), or an external image model reached by a script or an MCP server | sourced, consistent with the primary sources above | `blog.laozhang.ai/en/posts/claude-code-image-generation`, 2026-10-02 | Her home route is code. A model is an add-on |
| Diagrams, charts and anything with exact text belong on the code route; text drawn inside a raster is unreliable ("image models draw text as pixels") | sourced | same blog; a third-party Cloudflare tutorial shows a generated sign whose text is "illegible gibberish" | Any text in a photo-like asset is an SVG or HTML overlay, never part of the raster |
| The code route's loop is free and exact: edit coordinates, render again; a model route's every fix is a paid call, so cap attempts | sourced | same blog | Cap regenerations (the plan says two) |
| The blog's skill script and MCP commands "haven't been executed here" by its author; the site sells a paid relay (`laozhang.ai`, stated in the article) | verified (the article says both) | same blog | A lead, not a source of truth: in the provider table each figure carries its status, and a primary source was read wherever one exists |

## Free-tier providers for photo-like images

"Free" means a standing allowance with no card, as published on the date shown. Retrieved 2026-10-07.

| Route | What is free | Photo-like | How Claude reaches it | File lands in the project? | Terms and risks | Verdict |
|---|---|---|---|---|---|---|
| **Hugging Face MCP + a Gradio Space** (for example `mcp-tools/FLUX.1-Krea-dev`) | ZeroGPU GPU time per day: 2 min unauthenticated, 5 min free account, 40 min PRO or Team, 60 min Enterprise; resets 24 h after first use (verified, HF docs) | Yes: HF's own article presents FLUX.1 Krea [dev] as built to avoid "plastic skin, oversaturated colors" (verified, HF blog) | Official remote server `https://huggingface.co/mcp?login`, OAuth in `/mcp`; Spaces are added at `huggingface.co/settings/mcp`; "Dynamic Spaces" optional. The `claude mcp add` line is the blog's, unverified: `claude mcp add hf-mcp-server -t http "https://huggingface.co/mcp?login"` | No: inline image plus the `tool-results` copy; a role with a shell must copy it | FLUX [dev] weights are non-commercial but "You may use Output for any purpose (including for commercial purposes)" (BFL licence v2.0, verified); each Space and the HF terms add their own; quota is time, not images, and varies by Space (sourced); queue priority is low on a free account | **First probe (P2)**: official, no key stored, nothing to install |
| **Cloudflare Workers AI** (`flux-1-schnell`; `flux-2-klein-4b` is also listed) | 10,000 Neurons per day on the Workers Free plan (verified, Cloudflare pricing); about 170 images per day at 1024 x 1024 and 4 steps, by the blog's arithmetic of 4.80 Neurons per 512 x 512 tile and 9.60 per step (the allowance verified, the rates not) | Decent; a comparison site notes "a visible AI-generated gloss" (sourced) | REST only: account id plus an API token, base64 JPEG out, 4 steps default and 8 at most (verified). **No official image MCP was found**: it needs a lead-run script or a small pinned server of our own | Yes, if the script writes the path | The hosted model's terms link to Black Forest Labs' terms of service (verified); the token is a secret and never goes in chat or a committed file | **Most predictable quota, needs glue**: plan B |
| **Pollinations** | Official docs: "All generation requests require an API key" from `enter.pollinations.ai`; credits are "Pollen" (about 1 USD each); a third-party listing claims an anonymous tier and a free weekly allowance, which the official page does not state (conflict, unverified) | FLUX and others | Official remote MCP `https://gen.pollinations.ai/mcp/pollinations` (README, verified) | Unknown | Community servers that assume keyless access (including the aggregator below) are suspect | **Plan C**: verify the free allowance live before relying on it |
| **Gemini image models** (Nano Banana family) | **Nothing**: the Free Tier column reads "Not available" for image output on every Gemini image model (verified, Google pricing page); paid, for example 0.134 USD per 1K or 2K image on Gemini 3 Pro Image | Best in class | Many MCPs and skills | Depends | Billing required | Not free; the paid upgrade if the maintainer's team has billing |
| **fal.ai, Replicate** | No standing allowance (sourced: pay per run) | Yes | Official MCPs | Depends | The fal command writes the key into the config in clear text (sourced); Replicate uses SSE, marked deprecated in Claude Code's docs (sourced) | Not free |
| **Community aggregator** `marc-shade/image-gen-mcp` | Passes through the providers above | | `pip install -e .` from a local clone | Via `save_to_file` into `IMAGE_GEN_OUTPUT_DIR` (default `/mnt/agentic-system/generated-images`, the author's own path) | MIT, 0 stars, last commit 2026-02-22, installed from a local clone with no published package named, nothing pinned, a keyless Pollinations default that conflicts with Pollinations' current docs (from its README; the stars and commit date as the page showed them) | **Rejected as a default**: fails the pinned-package rule of Plan 035 D51 |
| **Stitch** (already in her tools) | Reported 350 Standard and 200 Experimental generations a month, no way to buy more; Figma export in Standard mode only (sourced: four third-party reviews, no Google page read) | UI screens, not photos | Wired | n/a | Shared by the whole team | Not an image route; budget it |
| **Code (SVG, HTML, CSS)** | Free, exact, deterministic, text-safe | No photographs | Her tools today | Yes (`Write`) | None | The default |

## Checks run for this document

Both ran in the session sandbox on 2026-10-07 with the Chromium build preinstalled for Playwright (build 1194). Neither used a Claude subagent. The fixture is a 1080 x 1350 feed banner with deliberate defects: cream headline on a light orange gradient, 16 px body copy, a grey-on-grey button label with the button touching the right edge, a proof badge inside the bottom 10 percent caption zone, and decorative circles behind the text with no scrim.

1. **Render, and a silent failure.** Rendering the SVG with full Chromium (`--headless=new --window-size=1080,1350 --screenshot`) took 2.3 s and wrote a 1080 x 1350 PNG whose **last 87 rows are blank**: the content stops 87 px short, as if the viewport were shorter than the window, the badge is cut off and the file size looks right (the cause is inferred; the blank rows are measured). The classic `headless_shell` with the same flags wrote 1080 x 1350 with 0 blank rows. Measured by decoding the PNG and finding the last non-white row (1262 against 1349). Any render step must check pixel size and blank tail rows, not trust the output size. This is the kind of defect `banner-design`'s "verify exported pixel dimensions" exists for.
2. **Read-back.** `Read` on the PNG returned it as an image. The planted headline contrast, the 16 px body text, the grey button touching the edge and the badge in the caption zone were all visible in the pixels, and so was the clipping, which was not planted. This shows the pipeline and the fixture work offline; it is **not** a blind test of a subagent's judgement, because the defects were authored in the same session. That test is H10b in the plan.

### To repeat the render check

The fixture, saved as `flawed-banner.svg` (the same file, a deliberately bad design; the numbers in it are invented):

```xml
<svg viewBox="0 0 1080 1350" width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#F3D9B1"/><stop offset="0.5" stop-color="#E8B87A"/><stop offset="1" stop-color="#F7E6C8"/>
  </linearGradient></defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <circle cx="300" cy="420" r="260" fill="#D98E4A" opacity="0.55"/>
  <circle cx="780" cy="560" r="220" fill="#B96A2B" opacity="0.5"/>
  <text x="80" y="330" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="#FFF4E0">Sitters you</text>
  <text x="80" y="440" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="#FFF4E0">can trust</text>
  <text x="80" y="540" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#8A6A45">Background-checked, reviewed by neighbours, insured up to $1M.</text>
  <rect x="80" y="1230" width="520" height="70" rx="12" fill="#2B1D14"/>
  <text x="104" y="1275" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#FFFFFF">4.9 average rating, 12,000 stays</text>
  <rect x="860" y="900" width="220" height="86" rx="43" fill="#C9C9C9"/>
  <text x="900" y="954" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#E6E6E6">Book now</text>
</svg>
```

```bash
PW=/opt/pw-browsers   # PLAYWRIGHT_BROWSERS_PATH in the session sandbox
# the silent failure: 1080 x 1350 file, blank rows at the bottom
$PW/chromium-1194/chrome-linux/chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1080,1350 --screenshot=new-headless.png "file://$PWD/flawed-banner.svg"
# the exact render
$PW/chromium_headless_shell-1194/chrome-linux/headless_shell --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1080,1350 --screenshot=headless-shell.png "file://$PWD/flawed-banner.svg"
identify new-headless.png headless-shell.png   # both read 1080x1350: the size alone proves nothing
```

The blank tail was counted by decoding each PNG and finding the last row that is not pure white (1262 and 1349 respectively); a size check alone passes both files.

## Not verified

- Any subagent behaviour of the proposed changes; any MCP server's tool names, return shape or real quota (Hugging Face's Gradio tool names are dynamic and cannot be known before a connection).
- The `claude mcp add` line for Hugging Face (the blog's, not read in HF's docs: the docs page lists client snippets that the extraction did not return) and Pollinations' current free allowance.
- Cloudflare's per-tile and per-step Neuron rates, the blog's `gemini-2.5-flash-image` shutdown date, and Stitch's limits at a Google source.
- Platform AI-disclosure rules for ads (Meta, Google, LinkedIn): not read; the plan treats them like ad sizes, "verify before export".
- Anything on Antigravity or Cline: out of scope for this session.

## Sources

Primary, read 2026-10-07: Anthropic vision docs; Google Gemini API pricing (`ai.google.dev/gemini-api/docs/pricing.md.txt`); Hugging Face ZeroGPU docs (`huggingface.co/docs/hub/spaces-zerogpu`), MCP docs (`huggingface.co/docs/hub/agents-mcp`) and the article "Generate Images with Claude and Hugging Face" (2025-08-19, updated 2025-10); Cloudflare Workers AI pricing and the `flux-1-schnell` model page; Pollinations (`gen.pollinations.ai/docs` and its GitHub README); Black Forest Labs "FLUX [dev] Non-Commercial License v2.0" and the FLUX.1 Krea [dev] model card; `microsoft/playwright-mcp` README; `marc-shade/image-gen-mcp` README; this repository's mirrored Claude Code docs under `host-library/claude/`.
Vendor or third party: `blog.laozhang.ai/en/posts/claude-code-image-generation` (2026-10-02); a Cloudflare tutorial on `learnwithhasan.com`; a free-APIs comparison on `edenai.co`; four Stitch reviews (`banani.co`, `o-mega.ai`, `nxcode.io`, `flowstep.ai`); a Pollinations listing on `aicredits.dev`.
