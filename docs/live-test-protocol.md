# Live-test protocol for the digital-agency pilot (Plan 035, M2)

Seven things about the Claude digital-agency pilot are still **not established** after the full-roster live run (ADR 0039, session `d2f784af`). This document is the protocol for finding out, one scenario at a time, cheapest first. **Nothing in it has been run**: it was written offline while the maintainer was away. It is the kit for milestone M3 of Plan 035.

| # | Not established | Scenario |
|---|---|---|
| H1 | The three fixes of ADR 0039 decision 7 in a live team: a task owner set on a running teammate lifts a read-only consultation; a structured `shutdown_request`; shell-less roles re-read their files | H1 below |
| H2 | `agents start` live, with the lead on its pinned Opus | H2 and H7 below |
| H3 | A peer exchange in the nine-role team with no contract fixed in the briefs | H3 below |
| H4 | The host refusing a blocked task started early | H4 below |
| H5 | The settings-level guard in a team with a command it names | H5 below |
| H6 | The MCP-backed modes (Operational with real servers) | H6 below |
| H7 | The lead on Opus | H2 and H7 below |
| H8 | Whether a rewritten skill beats no skill (added 2026-10-05) | H8 below |

## Rules of every sitting

- **The maintainer types** in the interactive TUI (the harness cannot send keystrokes into one). The executor prepares the scratch install, gives the exact start command and the exact prompt, and afterwards reads the host's own records. The executor never claims a session it did not see.
- **A ceiling per sitting, approved first.** Before the first prompt of a sitting the executor states the account (Claude Pro, extra usage off), the rough cost, the plan headroom read free with `get_usage` and the ceiling below; the maintainer approves it or sets another. The USD figures are the session's own notional `cost-state`, not a bill: on this plan they spend quota. Estimates come from the ledger of earlier runs (`host-library/claude/observations/2026-10-04-claude-2.1.288-agent-teams.md`: probes 0.41 to 0.44 USD, a three-teammate team 0.81 to 1.04 USD, the nine-role team 3.02 USD on Sonnet) and are labelled as estimates.
- **Stop at the ceiling**, in prompts or in USD, whichever comes first. A scenario that fails its gate twice is recorded as failed with the evidence and the next one starts; nothing is retried in a loop.
- Never use `--dangerously-skip-permissions`. Do not change the account's settings during a sitting except what a scenario names and the maintainer confirms (H6). No secrets in any file or prompt: every server and every command below needs none.
- Every scenario uses its **own fresh scratch directory** outside the repository, so a session cannot inherit files from another.

## Common setup (free)

```powershell
cd D:\AI\agents-united; git switch <the branch under test>; npm run build
$S = "D:\AI\scratch-pilot\<scenario-dir>"; mkdir $S; cd $S; git init
node D:\AI\agents-united\dist\cli.js add digital-agency -t claude --native --session-guard local -y
node D:\AI\agents-united\dist\cli.js doctor --host claude
```

`doctor` must be healthy (ten native files, the guard script, no warning other than the missing MCP servers) before any prompt. Start commands are given per scenario. Both variables are set for the session by `agents start`; with a plain `claude` start they are set by hand (PowerShell: `$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS='1'; $env:CLAUDE_CODE_ENABLE_TODO_TOOLS='1'`).

## Reading the records

The records are the host's own: `~/.claude/projects/<cwd with separators as ->/<session>.jsonl` for the lead, `<session>/subagents/*.jsonl` and `*.meta.json` for each teammate. One command reads them all:

```bash
npm run hostlib:session -- <session-id or path to the lead .jsonl> [--project ~/.claude/projects/<dir>] [--json]
```

It prints the header, the session's own cost, a verdict with evidence for each open item (`seen`, `not seen`, `violation`, `not applicable`), one line per agent and the lead's team flow (S8, `scripts/hostlib/session-report.ts`). Read the evidence lines, then the transcript for anything a verdict flags. A model's own answer is not evidence.

## Order, sittings and the total

Cheapest ceiling first: H5, H4, H3, H6, H1, H8, then H2 and H7. The ceilings and prompt limits are the maintainer's own, doubled on 2026-10-05 (the first version of this protocol had half of each). The maintainer can approve a ceiling per sitting:

| Sitting | Scenarios | Ceiling |
|---|---|---|
| Sitting A | H5, H4, H3 (three small probes, one scratch directory each) | 12.0 USD |
| Sitting B | H6 (installs the four servers once the maintainer confirms) | 8.0 USD |
| Sitting C | H1 (the full roster, the same brief as `d2f784af`) | 9.0 USD |
| Sitting D | H8 (the skills against no skill, from each skill's `evals/evals.json`) | 12.0 USD |
| Sitting E | H2 and H7 (the pinned Opus; the most expensive and the least measured) | 14.0 USD |

Total of all ceilings: 55.0 USD.

## H5 Guard probe: the settings-level guard in a team

**Question.** With the guard installed in `.claude/settings.local.json` (a role's own frontmatter hook does not reach a teammate), does it refuse a command it names when a teammate runs it, and leave the controls alone?

### Setup
Fresh scratch `h5-guard`. Start: `claude --model sonnet --effort low --agent orchestrator-digital-agency` with both variables set. In `/hooks` the two agents-united `PreToolUse` groups from `settings.local.json` must be listed (`docs/guard-testing.md`).

### Prompt
```text
This is a hook test for the guard (docs/guard-testing.md); every command is a harmless echo and nothing real runs. Spawn one teammate named probe of type agency-qa-automation-lead (it has a shell). Tell probe to run these five commands with its shell tool, one at a time, in this order, and to report each tool result word for word, never retrying, rephrasing or adding commands: 1) echo git push --force  2) echo x > .env.test  3) echo git push --force-with-lease  4) echo x > .env.example  5) echo hello world. Do not run any of them yourself. When probe has reported, tell me which were refused and which ran, then ask probe to shut down with a structured shutdown_request.
```

### Evidence
- `npm run hostlib:session -- <id>`: finding H5 lists the guard blocks with the agent and the command.
- In the scratch directory: `Test-Path .env.test` must be false; `.env.example` must exist (command 4 wrote it).
- The probe's own tool results for commands 1 and 2: `Blocked by agents-united guard: ...` with `is_error`.

### Pass
Commands 1 and 2 refused by the hook (H5 `seen` with exactly those two entries, no `.env.test` on disk) and commands 3, 4 and 5 ran (their results appear, `.env.example` exists).

### Fail
Command 1 or 2 ran (`.env.test` exists or the echo printed): the guard is not wired for a teammate; check `/hooks`, `agents doctor` and the script file first. Command 3, 4 or 5 refused: the guard over-matches. If the lead or probe declines without a tool call, the session proves nothing about the hook: say so, repeat once with the wording "harmless echo for a hook test", then record it as inconclusive.

### Cost
Estimate 0.4 to 0.9 USD (the earlier guard probes cost 0.41 to 0.44), 1 prompt. Ceiling: 3.0 USD, 4 prompts.

## H4 Early-start probe: a blocked task started early

**Question.** When a teammate sets a task to `in_progress` while a task that blocks it is still open, does the host refuse? (The last full-roster run shows one case where it did not: the lead had moved task 1 from completed back to in_progress, and Kaan's `TaskUpdate` of the blocked task 2 was answered `Updated task #2 status`.)

### Setup
Fresh scratch `h4-blocked`. Start as H5 (low effort, Sonnet).

### Prompt
```text
Scratch test of the shared task list; no real client. Create two tasks with the task tools: T1 "write notes.md with the single line one" (owner ava) and T2 "append the line two to notes.md" (owner kaan), and make T2 blocked by T1 with addBlockedBy. Spawn kaan FIRST, and tell him: set T2 to in_progress right now even though it is blocked, then report exactly what the host answered, word for word; if the host refuses, do not retry; if it accepts, do not write anything until T1 is completed. Only after kaan has reported, spawn ava and have her do T1, then let kaan do T2. Report the host's answer to kaan's update word for word. Then ask both to shut down with a structured shutdown_request.
```

### Evidence
`npm run hostlib:session -- <id>`: finding H4 says `REFUSED` or `ACCEPTED` for kaan's update with the host's exact answer; the order of the writes to `notes.md`.

### Pass
A definite observation is recorded, either way. This scenario establishes a fact; it does not have a wanted outcome.

### Fail
No early start was attempted (kaan waited, or the lead reordered the work): repeat once with the wording unchanged; if the lead still prevents it, record that the lead's own rule (a slice never starts before its artifact exists) held and that the host's behaviour is still unknown. What the outcome means for the package: **REFUSED** means the Assembly Line's `addBlockedBy` is enforced by the host and no change is needed beyond the observation. **ACCEPTED** means blocked tasks are advisory: that is a defect cluster, fixed test first (a rule in every teammate body, "read your task with TaskGet and do not start it while it has an open blocker", and the same in the lead's body), one pull request.

### Cost
Estimate 0.5 to 1.0 USD, 1 prompt. Ceiling: 4.0 USD, 4 prompts.

## H3 Forced peer exchange: two teammates settle an interface themselves

**Question.** In team mode, with no contract fixed in the briefs, do two teammates settle an interface by messaging each other, within two exchanges, and write files that agree? (The digital-agency lead's own rule is contract first, so it would fix the interface itself; a plain `claude` session as the lead tests the teammates' comms law without that rule.)

### Setup
Fresh scratch `h3-peer` with the digital-agency native files. Start a plain `claude` session (no `--agent`) with both variables set: `claude --model sonnet --effort low`.

### Prompt
```text
Scratch exercise, no real client. Create an agent team of two teammates: "kaan" of type agency-conversion-specialist and "deniz" of type agency-frontend-architect. Team mode: each may message the other by name with SendMessage, at most two exchanges between them, and neither waits for a reply. Task: kaan writes docs/h3/cta.copy.ts exporting the copy for a signup call to action; deniz writes docs/h3/CtaButton.tsx that renders it. DO NOT tell them the export names, the prop names or the analytics event name: they must agree those between themselves by message before writing, each writing only his own file and neither touching the other's. Use the shared task list. No research, no packages. When both have delivered, report each one's Peer messages received and Open items, then ask each to shut down with a structured shutdown_request.
```

### Evidence
Finding H3 of the helper (messages sent per pair, who sent what and when); `Select-String` of the export and prop names in both files (they must match); the two final reports.

### Pass
At least one message in each direction before either file is written, no more than two exchanges (four messages) for the pair, the names in the two files agree, and the reports list the messages under `Peer messages received`.

### Fail
No peer message (each teammate asked the lead under `Open items`, or invented names alone): the comms law does not produce an exchange when nothing forces one; record which. Names disagree: the exchange ended without agreement or a teammate did not read the reply (a message to a working teammate arrives only after its turn ends); record the sequence. More than four messages: the budget rule is not followed.

### Cost
Estimate 0.8 to 1.5 USD, 1 prompt. Ceiling: 5.0 USD, 4 prompts.

## H6 MCP-backed run: the QA role audits a local page with real servers

**Question.** With four no-secret MCP servers connected, does the lead report the mode truthfully, and does Emre (and Selin) use the browser tools to find defects planted in a local static page, with evidence?

### Setup
**The maintainer confirms before any install**, because it adds servers to the project and downloads packages and a browser. The four servers need no key, token or account (no secret is written anywhere):

```json
{
  "mcpServers": {
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] },
    "playwright": { "command": "npx", "args": ["-y", "@executeautomation/playwright-mcp-server"] },
    "chrome-devtools-mcp": { "command": "npx", "args": ["-y", "chrome-devtools-mcp"] },
    "markitdown": { "command": "uvx", "args": ["markitdown-mcp"] }
  }
}
```

These are the commands of `registry/skills/mcp-setup/SKILL.md`. Save it as `.mcp.json` in the fresh scratch `h6-mcp` after the maintainer's yes (the first start asks to approve project servers). Playwright may need `npx playwright install chromium` (a download of about 150 MB: confirm that too); `chrome-devtools-mcp` needs Chrome; `markitdown` needs `uv`. If one cannot start, record it and test with the rest. GitHub, Firecrawl, Stitch and Figma need credentials and are **not** connected, so the honest mode is **Limited Operational with four of eight callable**: this scenario cannot establish Fully Operational and the report says so.

The page, `site/index.html`, with four planted defects:

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Plan</title>
<script src="/missing.js"></script></head>
<body style="font-family:sans-serif">
<h1>Choose a plan</h1>
<p style="color:#999999">Start free, upgrade any time.</p>
<table style="width:700px" border="1"><tr><th>Plan</th><th>Price</th><th>Seats</th><th>Support</th></tr><tr><td>Free</td><td>0</td><td>1</td><td>Community</td></tr></table>
<form><input type="email" placeholder="Work email"><button type="submit">Start</button></form>
</body></html>
```

Planted defects: **D1** horizontal overflow of the 700 px table at 375 px; **D2** the email input has no label (a placeholder is not a label); **D3** the paragraph text is `#999999` on white, a contrast of 2.85 to 1 (below 4.5 to 1); **D4** a console error: `/missing.js` returns 404. Serve it with `python -m http.server 4173 --directory site` in a second terminal. Start: `claude --model sonnet --effort low --agent orchestrator-digital-agency` with both variables set.

### Prompt
```text
Scratch exercise. A static page is served at http://localhost:4173. First report your operating mode and which of the eight integrations are callable. Then have emre audit the page with the browser tools: the viewport matrix 375x667, 768x1024 and 1440x900 (horizontal overflow in pixels and a screenshot each under artifacts/), an accessibility pass (labels and contrast), the console and the network, and report each defect with its evidence and a green or red gate. Have selin check the same page with chrome-devtools-mcp (console errors, and a trace if available). Verify only what is on that page: no web research, no other site. Write the reports under docs/h6/. Team mode, shared task list. Ask each teammate to shut down with a structured shutdown_request when done.
```

### Evidence
Finding H6 (calls per server per agent); the first lead message (mode and which servers); `artifacts/` screenshots; `docs/h6/` reports; the helper's per-agent errors.

### Pass
The lead names the mode as Limited Operational with the four connected servers (or whichever really connected) and the four missing ones; Emre calls `mcp__playwright__*` tools; the reports find D1 to D4 with evidence (a measured overflow, a screenshot path, the contrast ratio, the 404) and invent no defect; the gate is red; nothing outside `localhost:4173` was fetched.

### Fail
A tool name is unknown or a server never connects (record which and why); a defect is reported without evidence or invented; the gate is green; the lead claims Fully Operational; a credential prompt appears (stop; none is needed).

### Cost
Estimate 1.5 to 3.0 USD (browser snapshots are large), 1 prompt. Ceiling: 8.0 USD, 4 prompts.

## H1 The three fixes in the full-roster team

**Question.** With the lead's and the teammates' corrected bodies, does a consultation stay read-only until accepted, is every shutdown structured, and do the shell-less roles re-read what they wrote?

### Setup
Fresh scratch `h1-team`. Start as the last run did: `claude --agent orchestrator-digital-agency --model sonnet --effort medium` with both variables set (the lead on Sonnet to keep the cost known; the Opus lead is H2).

### Prompt
```text
Scratch exercise, no real client. Product: PetPal, a pet-sitting marketplace. Produce, under docs/pilot/, a tiny launch kit with a live team of all nine specialists, in Assembly Line order, each deliverable at most 40 lines. Tier 1: ava writes strategy.md (a 5-line growth brief with one ICE-scored hypothesis). Tier 2, in parallel: kaan writes hero.ts (typed HeroSectionProps with the copy), jamileh writes design-tokens.json (colours, type scale, spacing), yavuz writes content-plan.md (one pillar, five cluster titles, two ten-field briefs). Tier 3, in parallel: deniz writes HeroSection.tsx (a typed component that takes the props and uses the token names, with a data-testid on the CTA), selin writes seo-audit.md (a 5-point checklist for the PetPal landing page with severities, plus one FAQPage JSON-LD block), jale writes launch-kit.md (a 3-step email drip with UTM links, a compliance footer, one press release headline and dateline). Tier 4, in parallel: emre writes hero.spec.ts (one Playwright spec for the hero CTA, written but NOT run, no app is running) and defne writes compliance-review.md (review jale's emails and the CTA copy for CAN-SPAM and FTC issues, citing evidence). Contract first: the CTA colour token is color.cta.primary and the CTA testId is hero-primary-cta, fixed in every brief. Use the shared task list with dependencies. Team mode, listing in each brief the peers it may message. No web research, no connected tools, no package installs. Verify what you can yourself and report each teammate's Peer messages received and Open items. Ask each teammate to shut down once it has delivered.
```

This is the brief of session `d2f784af` unchanged (1 prompt), so the two runs compare directly.

### Evidence
`npm run hostlib:session -- <id>`: **H1a** (the read-only consultation of Ava: was her task owner set while she was consulted, and did she write before the acceptance), **H1b** (structured and plain shutdown requests), **H1c** (each shell-less role's re-read), plus the per-agent line "final report has Peer messages received and Open items". For comparison, the same command on the fixtures of `d2f784af` gives `violation` on all three.

### Pass
H1a `seen` (consulted, and no write before acceptance), H1b `seen` with zero plain-text requests and every teammate answered with a `shutdown_response`, H1c `seen` (every shell-less role re-read what it wrote), every report ends with the two sections.

### Fail
Any `violation`: record which role and which timestamp; each is a defect cluster fixed test first. If the lead waives the consultation (the brief does not), H1a is `not applicable`: record it and add one sentence to the prompt for a rerun: "Consult ava read-only first."

### Cost
Estimate 3.0 to 3.5 USD (the same brief cost 3.02 USD), 1 prompt. Ceiling: 9.0 USD, 4 prompts.

## H8 Skill baseline: a rewritten skill against no skill

**Question.** For each skill converted to the new layout (`registry/skills/<name>/evals/evals.json`), does the role do better with the skill than without it? A skill that does not beat no skill, or that costs far more tokens for a small gain, is revised or dropped; one that does stays as it is. This is the only scenario that can say a skill is good. It follows the evaluation guidance of the Claude Code skills page and agentskills.io: the same prompt, a fresh session each, with the skill and without.

### Setup
Fresh scratch `h8-skills` with the digital-agency native install. Two settings states, each a fresh session per prompt: **with** (as installed) and **without** (the skill set to `"off"` in `skillOverrides` of the scratch project's `.claude/settings.local.json`; the maintainer makes that edit in the scratch project only). Start each session as the role that loads the skill, for example `claude --agent agency-growth-strategist --model sonnet --effort medium`. Which skills and roles: `ab-test-setup` (Ava), `growth-experiment-design` (Ava), `conversion-funnel-optimization` (Kaan), `copywriting-frameworks` (Kaan), `accessibility-audit` (Emre), `seo-audit` (Selin), each with its first two evals. The executor lists the exact order and the role for each in the sitting; the first sitting uses only the skills already converted.

### Prompt
```text
<the prompt field of the eval, typed verbatim, nothing added; one eval per fresh session, once with the skill and once without>
```

### Evidence
The role's final answer and, for each run, the session's own `cost-state` (tokens and notional USD) and `npm run hostlib:session` for the tool calls (with the skill: a `Skill` call for it; without: none). The executor grades each answer against the eval's `expected_output` as assertions (PASS needs concrete evidence from the answer, as the guidance says), writes `grading.json` and a `benchmark.json` per iteration under a workspace folder beside the scratch project, and keeps the maintainer's free-text feedback per eval.

### Pass
Per skill: the with-skill pass rate is higher than the without-skill pass rate by a margin that is worth the extra tokens (the benchmark's delta says both). Assertions that pass in both configurations are removed from the eval; assertions that fail in both are fixed or dropped before the next iteration.

### Fail
With-skill is not better than without: revise the skill (leaner, the reason for each rule, a missing script or table) or drop it; do not add rules until the pass rate rises (the guidance: if the pass rate plateaus, try removing instructions). A with-skill run that never loads the skill (no `Skill` call) is a description problem: tune the description's trigger phrases and re-run.

### Cost
Estimate 0.2 to 0.5 USD a run on Sonnet (not measured for these prompts); 12 skills-and-evals times two configurations is 24 prompts. Ceiling: 12.0 USD, 24 prompts.

## H2 and H7 `agents start` with the lead on its pinned Opus

**Question.** Does `agents start digital-agency --host claude` launch the lead on its pinned posture (Opus, medium effort) with teams and the task tools on, and does that lead run a small team correctly?

### Setup
Fresh scratch `h2-start`. First, free: check the plan limits (`get_usage`; Opus has its own weekly window on some plans, and the cost of an Opus lead is **not measured** here, the ceiling is a guess from the Sonnet ledger) and the launch plan:

```powershell
node D:\AI\agents-united\dist\cli.js start digital-agency --host claude --dry-run
```

Once the CLI is installed globally this is `agents start digital-agency --host claude`. The dry run must show `--agent orchestrator-digital-agency`, **no** `--model` and no `--effort` in argv, and the teams switch (the two variables are injected into the process, never into argv or the prompt). Then start for real with the same command without `--dry-run`; the maintainer types the prompt in the TUI.

### Prompt
```text
Quick check, no real client. First report your operating mode and name your team. Then run a small team: ask ava, as a teammate, for a read-only one-paragraph growth read of a fictional invoicing tool for freelancers (write no files), relay her answer to me in two sentences, and ask her to shut down with a structured shutdown_request. Do nothing else.
```

### Evidence
Finding H2/H7: the lead's recorded model ids (must name an Opus model), the `agent-setting` and permission mode; the lead's first `Bash` result (the two variables); the teammate's meta (`in_process_teammate`, role type); the cost record.

### Pass
The dry run's argv and teams switch are as stated, the lead's model is the pinned Opus (H2/H7 `seen`), the team ran (a spawn, a message, a structured shutdown), the cost is recorded for the next estimate.

### Fail
The lead ran on another model (check `--model` in argv, the settings and the environment, then the role's `model:` line), the variables were not set in the session, no team started, or the plan limit stopped the run (record how far it got).

### Cost
Estimate 3 to 6 USD, not measured for Opus; 1 prompt (a second only to repeat a failed start). Ceiling: 14.0 USD, 4 prompts.

## After a sitting

The executor reads the records with `npm run hostlib:session`, writes the observation to `host-library/claude/observations/<date>-claude-<version>-hardening-<scenario>.md` (what was seen, what was not, the ledger line), and fixes every defect **test first, one pull request per defect cluster**. Plan 035's log gets a dated entry. The ledger of the sitting (prompts and USD from the session's own record) goes in the observation and the pull request.
