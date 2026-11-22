# ADR 0077: The roles that make documents publish pages, each new page with the user's go-ahead

- **Status:** Accepted, 2026-11-21, on the maintainer's request and his answers of that day; the live check has not been run yet. The decisions marked (C) (decisions 7, 9, 12 and 14, and one sentence of decision 6) were taken by the coordinating AI session and are the maintainer's to overturn.
- **Date:** 2026-11-21
- **Replaces:** decisions 1 and 2 of ADR 0047. It keeps decisions 3, 6 and 7 of ADR 0047, decision 4 except one clause, and decision 5 with new words (see Decision 4 below).

## Context

The maintainer, 2026-11-21: "give the `/design` slash command using ability to subagents who can use Claude's AI design workspace for creating prototypes, presentations, one-pagers, and visual assets through chat and direct on-canvas editing. If this is not possible on the Claude Code sessions; you can give them to use Claude Artifacts Design System (Design artifact). It should be an essential tool to use for the Claude Lane."

His three decisions of the same day:

1. One pull request, after the open Bundle pull requests.
2. Which roles: "Every role that makes documents". That is all eight design roles, the two creative designers, the roles that produce presentations and one-pagers in the business, research and marketing departments, and their leads, plus the design, marketing and digital-agency leads.
3. "Go-ahead per publish": the lead asks the user before each new publish, an update to an artifact the user already approved needs no new question, and never public sharing.

Prior art:

- ADR 0047: one role holds the tool, publishing is opt-in. Its probe and its floor line are the base of this change.
- ADR 0076: a specialist's needs it cannot meet on this Host go through the lead, as requests in its report. The go-ahead of this change uses that path.
- ADR 0021: the Semantic Cores are host-neutral and tool-free, and the Contract Floor is locked.
- The tool policy entry for `Artifact` (`registry/hosts/claude/tool-policy.json`): class `artifacts`, available to subagents, kept by a background subagent, mutating.
- `resolveGrant` in `src/core/host-profile.ts` and the exact class ceiling pinned in `tests/native-claude-agents.test.ts`: a built-in tool reaches a role only through a capability class in its core, and the committed `tools:` line must equal the class ceiling.

### The maintainer's answers, 2026-11-21

- The list of holders: "As proposed". It is the list in decision 1.
- Whether a lead offers publishing on every deliverable that has a page form or only when the brief calls for a page: "Every page-form deliverable". Whenever the work produces a prototype, a deck, a one-pager or a visual asset, the lead asks once, with "Keep it in the project" as the first option, and the files are always written first.
- Who sits the live check: "I sit it through the bridge". The coordinating AI session sits it through a terminal on his signed-in account, and its record will say that an AI session sat it and no human typed.

### What the Host documentation says

Each item names its page and was fetched 2026-11-21.

- `commands.md`, "All commands": `/design [brief]` is a **Skill**, a bundled skill: "Requires Claude Code v2.1.265 or later, a session where artifacts are available, and an account where the Design template is available". `/slides [brief]` is the sibling, with the same requirement for the Slides template.
- `artifacts.md`, "Start an artifact from a template": "To start from a template, name it or describe what you want ... Claude picks the matching template, fills it from your request and from what the session already has, and gives you the link."
- `artifacts.md`, "Availability": "Artifacts are available on Pro, Max, Ultra, Team, and Enterprise plans and require a session signed in with `/login`." The session needs Claude Code v2.1.281 or later and the Anthropic API. The tool is "Off by default in the Agent SDK, the GitHub Action, and MCP-server contexts, when you run Claude Code with `-p` from your own terminal or scripts".
- `sub-agents.md`, "Control subagent capabilities": "A background subagent keeps every MCP tool, and `SubagentHandback` if it reports through that tool. It also keeps `Read`, ... `Skill`, ... `SendMessage`, `Artifact`, ..." The first filter removes `AskUserQuestion` from every subagent, even when it is listed in `tools`.
- `artifacts.md`, "Share an artifact": "A new artifact is visible only to you. To share it, open the artifact in your browser and use the **Share** control in the page header."
- `artifacts.md`, "When Claude Code asks before publishing": "A new artifact that Claude publishes in response to a prompt you type goes through without a permission prompt or classifier review." The page lists the cases that ask (plan mode, declared runtime capabilities, a publicly shared artifact, a turn started by a scheduled task, a file Claude cannot read without approval). It says nothing about a publish made by a subagent.
- `artifacts.md`, "Disable artifacts": the user's own switches are `"enableArtifact": false` in the settings and `Artifact` in `permissions.deny`.
- `commands.md`, `/design-login` and `/design-sync`: "This sign-in is for the standalone Claude Design site at claude.ai/design, which closes by December 14, 2026".

### Seen once, not documentation

- The probe of ADR 0047 (Claude Code 2.1.294): a role with `Artifact` published a Design canvas and a Design System through the tool alone.
- On 2026-11-21, on Claude Code 2.1.330, one agent-team session had a list of available skills that showed neither `design` nor `slides`, while its `Artifact` tool offered a quickstart for both types. The cause is not established.
- A read of this account's session records of 2026-11-14 to 2026-11-22 (Claude Code 2.1.286 to 2.1.330): 289 records carry a list of available skills, of main sessions and of subagents. None names `design` or `slides`; the bundled `code-review` is in the lists of subagents. Why the two are absent is not established (the records do not say whether artifacts were available in each session, and a skill that only the user may start would not be listed).

### Not established

- That Claude or a subagent can invoke the bundled design skill through `Skill`. The sub-agents page names project, user and plugin skills only.
- That a subagent keeps `Artifact` when the lead that started it runs as the main agent without it.
- Whether the Host asks before a subagent's publish.
- Anything about the files of the Slides type.

## Decision

1. The class `artifacts` goes into the Semantic Core of every role that makes documents. One list:
   - By the maintainer's word: `ui-designer`, `ux-strategist`, `interaction-designer`, `design-systems-architect`, `design-ops-lead`, `design-researcher`, `designer-toolkit-expert`, `prototype-tester`, and the creative designer's core (two native files: the agency's creative designer holds the tool since ADR 0047, and the marketing creative designer since it was built on the same core).
   - By his answer "As proposed": the marketing cores of the growth strategist, content strategist, campaign specialist and conversion specialist (each feeds a `marketing-` and an `agency-` native file, so both forms hold it), `business-panel-experts`, `market-intelligence-analyst`, `operations-strategist` and `deep-research`.
   - Not holders: read-only roles (the class is mutating), roles whose output is evidence or working material for the lead's synthesis, and the roles that make video, audio or 3D media. By group: the financial, statistical and literature analysts, the legal contract analyst, the SEO, paid-acquisition, product-led-growth and lifecycle-email specialists, the agency's motion, sound and 3D roles, its frontend architect, its compliance and QA roles, the repository indexer and the Socratic mentor.
   - The class is the only way to grant a built-in tool: `resolveGrant` derives the `tools:` line from the classes of the core, and `tests/native-claude-agents.test.ts` pins the committed line to that ceiling, in both directions.
2. The five leads of those departments hold the class too (design, marketing, digital agency, business, research). It is the maintainer's word; a lead reads back a page before it passes on a link and may publish its own synthesis; and whether a subagent keeps the tool under a lead without it was not established before the grant, and the live check cannot show it, because every lead of a holder now holds the tool.
3. `market-intelligence-analyst` and `operations-strategist` are holders too (the list in decision 1). Their role files reached `dev` before this change was cut, so both get the class, the floor line and the publishing block in this change. A role whose Bundle is not on `dev` when a change like this is cut gets the class with its own Bundle's pull request.
4. This replaces ADR 0047 decision 1 (one role holds the tool) and decision 2 (publishing only when the user asks for it). It keeps decision 3 (private and reported), decision 4 (the how lives in the skill `design-artifact-publishing`, now extended and placed in every Bundle that has a holder) except its clause that the creative designer's role body gets a table row and nothing more: every holder now carries the generated block (decision 11), decision 6 (no guard script for `Artifact`) and decision 7 (availability is stated). Decision 5 (one floor line) is kept with new words.
5. The go-ahead. A new page needs the user's go-ahead for that page; an update needs none. An update is a publish to the URL of a page the user already approved: the URL the brief names as approved, or the page the role published itself in the same piece of work with the user's go-ahead. A URL that reaches the role any other way, a second page and a page of another type are new.
6. A specialist cannot ask the user. The go-ahead reaches it in its brief, or it asks with one `ask-user` entry under `Requests for the lead` (ADR 0076) after the files are finished, blocking for the publish only. The files in the project are always delivered first, so a page is never a side effect and a declined publish loses nothing. (C) A user whose own request already says to publish a deliverable as a page has given the go-ahead for it, and the lead does not ask again.
7. (C) The floor line, the same words in every holder's core: "- **Publish Artifact**: Publish a page to a hosted site only with the user's go-ahead for that page; an update to a page the user already approved needs no new go-ahead. Keep it private, leave who can see it to the user, and say in your report that project material has left the project." The maintainer approves it by merging, because the floor is locked.
8. Three steps in the role's text, each a condition the role can see, never a claim about the Host. First, the bundled skill `design` (for a deck: `slides`) through `Skill`, only if the role's list of available skills shows it. Otherwise the Design or Slides type through `Artifact`, and an HTML page when the account does not offer the type the role needs. Otherwise the files in the project, with the reason. If the call fails, or when the bundled skill answers that the user must run `/design consent` or sign in, the role reports that and takes the next step, and never asks for `/design-login` or `/design-sync`. No text says the bundled skill is available to a subagent.
9. (C) Both the Design and the Slides type are covered.
10. Never public, in tool terms. A new page is private. The role never shares, never asks the user to share as a step of the work, never deletes or pins an artifact, declares no runtime capabilities unless the brief asks, and does not work around a Host prompt.
11. The wording is one generated block from `src/core/native-publishing.ts`, built the way the requests block of ADR 0076 is. A role carries it exactly when its `tools:` line holds `Artifact`, so the text is one wording and true by construction.
12. (C) No reading or answering of comments on a published page in this change.
13. Nothing is built on `/design-login` or `/design-sync`.
14. (C) No guard. The guard script of this repository sees a tool call, not the user's answer. The user's own switches are `"enableArtifact": false` and `Artifact` in `permissions.deny`, and the lead names them.

## Consequences

- Positive: the user reviews and edits prototypes, decks and one-pagers in a browser, on a canvas, which files in the project do not offer.
- Limits:
  - Project material leaves the project for Anthropic-hosted pages.
  - There are 27 holders (native files, built from 22 cores) and no deterministic stop of ours, so the safety rests on the floor line, the lead's question, the request entry and the live check.
  - A plan or session without the tool gets the files.
  - The go-ahead rule is text in 27 roles and nothing deterministic enforces it; the tests pin the wording, not the behaviour, and the live check shows the behaviour once, not always.
  - The documentation says a new artifact published in response to a prompt the user typed "goes through without a permission prompt or classifier review", and says nothing about a subagent's publish, so the Host's prompt cannot be counted on.
- Not established: the list above. Each text states its steps as conditions the role can see.
- The live check is run in an interactive, signed-in session, because artifacts are off by default under `-p`:
  1. A lead is asked for a mock-up and a publish. Expect the question. Read in the specialist's transcript whether it called `Skill` with `design` or `Artifact`.
  2. Then an update. Expect no question.
  3. Then a deck, with the answer "Keep it in the project". Expect files only.
  4. Then `/design` typed in the main session.
- Other Hosts: neither `registry/hosts/cline/tool-policy.json` nor `registry/hosts/antigravity/tool-policy.json` catalogues a tool of the class `artifacts`, so the class grants nothing there. The floor line is host-neutral text, but the Cline and Antigravity files committed today (`backend-architect`, `code-reviewer`, `frontend-architect`, `repo-index` and, for Antigravity, `orchestrator-engineering`) stand on engineering cores, none of them a holder, so the floor line reaches none of them. The skill `design-artifact-publishing` states that it is for Claude Code only. Whether a later Cline or Antigravity file for a holder would carry the line depends on how that file is generated and is not established.
