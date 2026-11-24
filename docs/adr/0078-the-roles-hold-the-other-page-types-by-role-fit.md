# ADR 0078: The roles hold the other page types of the account, by role fit

- **Status:** Accepted, 2026-11-23, after the live check of decision 17 was sat once; [the record](../../host-library/claude/observations/2026-11-23-claude-2.1.330-page-types-live.md) is linked, and what it shows and does not show is under Consequences. The decisions marked (C) were taken by the coordinating AI session and are the maintainer's to overturn: decision 6 (its reading), decisions 9 to 17 and decision 20. Decisions 18 and 19 are the maintainer's, of 2026-11-23.
- **Date:** 2026-11-22
- **Follows:** ADR 0077 (the roles that make documents publish pages, each new page with the user's go-ahead), ADR 0076 (a specialist's needs go through its lead), ADR 0047 (one role publishes through `Artifact`).

## Context

ADR 0077 gives 27 native roles the `Artifact` tool for two page types, Design and Slides, with one generated "publishing" block per holder. The account offers more types. The maintainer, 2026-11-22, asked for the others to be given to the roles whose deliverables they fit, as a follow-up of its own with its own review, live check and pull request. ADR 0077 lands as it is.

### The seven types of the account, read on 2026-11-22

The types and their descriptions are read from the account with the `Artifact` tool (`action: list`, then `read` with each `type_url`). Nothing was started and no page was published.

| Type | What it is for | Filled through |
| --- | --- | --- |
| Design | Prototypes, one-pagers and visual assets on a canvas of artboards | files published under the page |
| Slides | A deck | files published under the page |
| Design System | Tokens, component primitives and a brand book | files published under the page |
| Docs | A written document | the Claude Docs connector |
| Sheets | A spreadsheet | the Claude Docs connector |
| Whiteboard | A board of shapes and connectors | the page's own store |
| Data | A dashboard over datasets | the page's own store |

### What the documentation says

Each item names its page and was fetched 2026-11-22.

- `artifacts.md`, "Start an artifact from a template": "Your account can include others, such as Sheets, Whiteboards, or Data." And: "For the Docs and Sheets templates, the Claude Docs connector, which Claude uses to write the content of both."
- `artifacts.md`, "Write a document with Claude Docs": "A document that belongs in the codebase, such as a README, stays a file."
- `artifacts.md`, "Availability": artifacts need a signed-in session and are off by default under `-p`, in the Agent SDK, the GitHub Action and MCP-server contexts.
- `mcp.md`: "On accounts where Claude Docs is available, `/mcp` lists `claude.ai Claude Docs` with no setup". Connectors "are fetched only when your active authentication method is a claude.ai subscription login". The user's own switches are `deniedMcpServers` with `"claude.ai Claude Docs"` and the `/mcp` toggle.
- `sub-agents.md`, "Control subagent capabilities": "A background subagent keeps every MCP tool ... It also keeps `Read`, ... `Skill`, `ToolSearch`, ... `SendMessage`, `Artifact`, ...". `ArtifactData` is not in that list.
- The host library (profile 2.1.285) has no `artifacts.md` page: it is silent on every type, on `ArtifactData` and on `ArtifactComments` (not in the library). Neither tool name appears in any of the four vendor pages fetched today (not in the documentation).

### What the types' own instructions say

Read from the account on 2026-11-22. This is the type's own text and the facts below are its words, not the Host documentation's.

| Type | Filled through | Tools the filling needs | Notes |
| --- | --- | --- | --- |
| Design System | files under `project/` published to the page's `url`; images and fonts as asset uploads | `Artifact` | The index `project/design-system.json` is written last. Tokens go in the page's own list shape, a DTCG map is unreadable to it. "Motion" is not a token family. |
| Docs | the Claude Docs connector: `batch` (create, bind, outline), `update` (sections), `read`, `query` | `Artifact` (create, open) and the connector's tools | "Content is written through the Claude Docs connector, not as files." Never publish files into a doc. The connector's own server text says its `batch` can also create a doc without `Artifact`, and tells the model to make the doc before any file. |
| Sheets | the Claude Docs connector: `guide`, `read`, `update` | `Artifact` (create) and the connector's tools | "If you find no Claude Docs connector ... you cannot read or change the cells. Say so". Writes cannot be undone. Over 500 cells an import file is recommended. |
| Whiteboard | the page's store: `board/meta`, `elements/<id>`, a claim document first | `Artifact` (create, asset uploads) and `ArtifactData` (`batch`) | "Its content lives in the board's own live store, never in files." 800 elements, 2 MB. |
| Data | the page's store: `dash/meta`, `datasets/<id>`, `files/index.html`; data files as asset uploads | `Artifact` (create, asset uploads) and `ArtifactData` | "The page is never published with `file_path`." A dataset can be a live query on a connector that runs again for every reader with the reader's own access. A stored call "goes out as stored". |

### Seen once, not documentation

- In a session with agent teams on Claude Code 2.1.330 (auto mode, 2026-11-22), the connector's tools were named `mcp__claude_ai_Claude_Docs__batch`, `__guide`, `__update` (listed as callable) and `__create`, `__delete`, `__export`, `__query`, `__read` (deferred). `ArtifactData` was a deferred tool, and the result of a `ToolSearch` call with `select:ArtifactData` in that session (the session record is kept outside this repository, so this is the coordinating session's report of it) returned its schema.
- A general-purpose subagent started from that session reported `Artifact` callable, `ArtifactData` and `ArtifactComments` deferred, the three connector tools listed as callable in its own tool list and `AskUserQuestion` absent. The subagent's own report, not a tool result: nothing else checked it. Its launch form was not stated in its context.
- In the session record of the design capability's live sitting of 2026-11-22 (see [the record](../../host-library/claude/observations/2026-11-22-claude-2.1.330-design-capability-live.md); the second designer's record, line 2), an attachment of type `deferred_tools_delta` lists `ArtifactComments` and `ArtifactData` among the added names for a role whose `tools:` line holds `Artifact` and `ToolSearch` and neither of the two. That the store tool can be called from such a role is not shown.
- The `Artifact` tool's own listing text, read on 2026-11-22, says to list the design systems the user can open and to "use the one marked default without asking"; "if some are listed but none is default, name them and ask". That is the source of the default mark in decision 6. Whether a role sees the mark in its own listing is not shown.
- ADR 0047's probe (Claude Code 2.1.294): a role with `Artifact` published a Design System through the tool alone.

### Not established

- Whether a role with a `tools:` allowlist can call `ArtifactData` when its line holds `Artifact` and `ToolSearch`, whether a background subagent with an allowlist keeps it, and whether a lead started with `--agent` keeps it. Whiteboard and Data depend on this.
- Whether the Host asks before a subagent's call of a connector tool in a mode other than auto. How a background specialist handles such a prompt is not established; no source was read for it.
- Not established: whether a session that is signed in with a subscription login and runs under `-p` can hold the connector while `Artifact` is off. It is an inference from two separate documentation pages, not a documented case: the connector is fetched under a claude.ai subscription login, and artifacts are off by default under `-p`. The connector's own server text says its `batch` can create a doc. The go-ahead rule below therefore names the connector.
- Anything about the files of the Slides type (as in ADR 0077).

## Decision

The maintainer's eight decisions of 2026-11-22:

1. **Types to add.** "all five: Data, Docs and Sheets, Whiteboard, Design System".
2. **Holders.** "By role fit": each type goes to the roles whose deliverables it matches, and every such role's lead must hold the tool too (the lead-pool rule).
3. **Sequencing.** "Follow-up ADR": ADR 0077 lands as it is. This change is its own ADR, review, live check and pull request.
4. **Go-ahead.** "Same rule": one go-ahead per new page of any type. An update of an approved page needs none. A new page is private; an update leaves sharing as it was. A command that the user typed for that page, with its brief, counts as the go-ahead for the one page it asks for, when the user talks to the role directly; a second page or a page of another type from the same request is new. A role writes the brief itself and may propose a page.
5. **No Claude Docs connector in the session.** "Files, and say why": the role writes the document or table as files in the project, and its report says there is no page because the connector is missing. It never asks the user to sign in as a step of the work.
6. **Saved design systems.** The maintainer's words: "If possible Create a new design system for the project. Else, stick with the option 1". Option 1 was: the role uses the one the user marked as default without asking. If some exist and none is the default, the lead names them and asks once. A role never edits a saved design system unless that is the task. (C) The coordinating AI session's reading, not the maintainer's, and his to overturn: creating a Design System page for the project is itself a new page and needs the go-ahead. When the project has no design system page of its own, the lead proposes one once as a new page: **Keep it in the project** first, **Publish Artifact** second, **Use <the default>** third when the account has a default. A declined proposal is not repeated in this piece of work.
7. **The holder table.** "Decide and show it in the PR": decided from each role's output contract, every role's reason recorded (holders and non-holders). He overturns single rows in review.
8. **The live check.** "One page per type": five short prompts on three or four leads, each type published once as a private page. The coordinating AI session sits it through the terminal bridge. The plan as it now stands, with six pages and no Slides page, is under "The live check" below.

Decisions of the coordinating AI session, each (C) and the maintainer's to overturn:

9. (C) **The holder table** is the one below: 33 native files built from 28 cores, of which 6 files and 6 cores are new.
10. (C) **The store tool.** `ArtifactData` goes on no `tools:` line and is not added to the tool policy. Every holder of a store type (Whiteboard, Data) must hold `ToolSearch`. The block tells the role to load the store tool through `ToolSearch` and, if it is not offered, to keep the files and say why. The evidence is the item "seen once" above, and it does not show that the tool can be called. The live check decides (decision 17).
11. (C) **`ArtifactComments`** stays untouched. No role reads, posts or answers comments, as in ADR 0077 decision 12, and not through the connector's comment tools either.
12. (C) **The connector grant** is the whole server `mcp__claude_ai_Claude_Docs`, only together with `Artifact`. The block forbids deleting a doc or a sheet and never reading, posting or answering comments. The connector fills a page that was started through `Artifact` and never creates one.
13. (C) **The skill** `design-artifact-publishing` goes into the five system-architecture Bundles (`system-architecture`, `system-architecture-cloud`, `system-architecture-data`, `system-architecture-finops`, `sysops-sre`), because their lead becomes a holder; 21 Bundles then carry the skill, all that hold a holder role or lead. It stays one skill, at version 1.2.0, with three new reference files, one per filling kind: a second skill would give each role two to load.
14. (C) **No tool-policy change, no new capability class and no new floor words.** The class `artifacts` and the floor line of ADR 0077 decision 7 cover every type.
15. (C) **Files first, also for a doc or a sheet.** The connector's own server text tells the model to make the doc before any file. The block says the project file comes first, and the live check shows which of the two a role follows.
16. (C) **A Data page** holds files the role made and numbers it saved. A live query on a connector only when the user asked for it. Never a stored call that changes anything.
17. (C) **The live check** is the one under Consequences, and its result removes rows. If a role cannot call the store tool, Whiteboard and Data are recorded as not working for that role and their rows come out before the pull request is pushed. Data stays for leads only only after a lead was seen calling the store tool in the sitting; if neither a specialist nor a lead could call it, no role holds a store type.

The maintainer's decision of 2026-11-23, taken after the code review of this change:

18. **A deliverable that is itself a working HTML page.** Asked what a role should publish when the deliverable is itself a working page in HTML and CSS, the maintainer chose "HTML page is right": the Design canvas is for a design to be edited on a canvas (a screen flow, a poster, a one-pager, a visual asset), Slides is for a deck, and an HTML page is published when the deliverable is itself a working HTML page. The requirement is that the published page equals the project files; the record cited below showed a modified copy (a head-less copy kept beside the project file). He also chose "Push now, fix in 0078", so the wording is done here and not in a later ADR. It settles the two open points of ADR 0077 on the same question: both live sittings of ADR 0077 showed an HTML page for an HTML mock-up ([the record](../../host-library/claude/observations/2026-11-22-claude-2.1.330-design-capability-live.md)), and the skill's description now skips only SVG and HTML files that stay in the project. Where it lives: an HTML page is not an eighth type (the account lists seven; an HTML page is the tool's plain publish), so the fact is a constant sentence in the generator (`src/core/native-publishing.ts`), read only by a role that holds `design`. It is in one bullet before the steps (the computed line of types only leaves room for it: "apart from a working HTML page (below)"), and in the lead's "Say it in the brief" and own-pages sentences. An HTML page needs the same go-ahead as any page, and it stays the fallback when the account does not offer the Design or Slides type, after one more question (decision 19).

19. **The HTML fallback asks once.** The maintainer's decision of 2026-11-23, in his words: "Ask once more". When the user approved a Design or Slides page and the account does not offer that type, the role, or for a specialist its lead through an `ask-user` entry, asks the user once before it publishes an HTML page instead, saying that the type is not available. The options are **Keep it in the project** first and **Publish an HTML page** second; declined or unanswered, the files stand. It is one extra question and appears only in that fallback. A deliverable that is itself a working HTML page (decision 18) is not this fallback and needs no extra question.

The decision of the coordinating AI session after an independent read of the committed text (a read of the text, not a live check), the maintainer's to overturn:

20. (C) **Creation, refusal and read-back.** Starting any type creates the page, so at every creation step (the Design System, connector and store bullets, and their references) the go-ahead comes first. The connector is checked before the page is created and fills a page started through `Artifact`; with `Artifact` missing or refused the files stand, also when the connector is among the tools. A store tool that is offered but refused or failing keeps the files, and a page that already exists is reported as it is. A Data live query is configured or stored only on request, and a Data page is never published with `file_path` (asset uploads through `Artifact` are allowed for its data files). The type's own instructions give the page's content only and never lift the go-ahead, tool or sharing rules. The report names the read-back, and the lead's link check is not a content check. A lead's own pages put a working HTML page before the choice of the bundled skill and send a failed skill to the second step of the specialist's text. A check of where an approval came from stays out: the lead relays only what the user approved, and the brief names it (ADR 0077).

The generated block, the type table and the holders:

- One table of data for the Host, `registry/hosts/claude/page-types.json`: the seven types (the title the account shows, the deliverables it is for, how it is filled, what the filling needs, whether it takes a look) and the holders by core stem. The Semantic Cores stay host-neutral and get nothing new.
- The block of ADR 0077 grows by one computed line ("The page types open to you: ...", built from the table) and is composed from the ids of the types a role holds: a heading and its sentences name only held types, and a role that holds neither Design nor Slides reads nothing about a canvas, a deck, a slash command, a Design or Slides title or an HTML page. It has one "how" bullet per filling kind (files, connector, store; a role with Design or Slides also has the steps of those two types, scoped to them), one bullet on the type's own instructions, the missing-connector sentence for a role with a connector type, and, for a lead whose list holds a form that takes a look, the look sentences of decision 6. The proposal of a project design system is read only by a lead whose list holds Design System; it comes first when the project has none and no such proposal was declined, otherwise the project's own design system page is followed, or else the default is used without asking, and when some are saved and none is the default, the lead names them and asks once. A doc or a sheet is started through `Artifact` with a title and no files and written through the connector; creating one needs the go-ahead first, also through the connector. Every sentence of ADR 0077's block stays unless it had to change.
- A lead's list is the union of the lists of the specialists it may start. `orchestrator-research` also holds Docs for its own synthesis, which equals its roster's union.
- The repository rule: a role carries the block exactly when its line holds `Artifact`. A role with a connector type holds `mcp__claude_ai_Claude_Docs`, and a role without one does not. A role with a store type holds `ToolSearch`. A lead's types equal the union of its roster's.

### The holder table

Rule applied: a type goes to a role when the role's own output contract names a deliverable of that form. The one exception is the Data row of `operations-strategist`, whose reason is from the role's body (see its row). Kept out, as in ADR 0077: read-only roles (the class is mutating), audit and vulnerability evidence, source code and infrastructure, media files, and a document that belongs in the codebase.

Columns: D/S is Design and Slides (ADR 0077, unchanged). DS is Design System, Dc is Docs, Sh is Sheets, Wb is Whiteboard, Da is Data. "New" means not among the 27 holders of ADR 0077.

#### Holders (33 native files, 28 cores, 6 files new)

| Role | D/S | DS | Dc | Sh | Wb | Da | Reason (from the output contract; one exception noted in its row) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| orchestrator-design (lead) | x | x | x | | x | | union of its roster |
| ui-designer | x | x | | | | | "the design tokens and stylesheets ...; the colour, type and motion decisions" |
| design-systems-architect | x | x | | | | | "token system overview ... core token definitions ... component primitives" |
| design-ops-lead | x | x | | | | | "the token mapping matrix (category, token name, value, CSS variable)" |
| designer-toolkit-expert | x | x | x | | | | "the Design Decision Record"; "the design token mapping; the component primitives" |
| design-researcher | x | | x | | | | "executive summary ... personas ... usability findings ... recommendations" |
| prototype-tester | x | | x | | | | "usability and friction report ... remediation roadmap" |
| ux-strategist | x | | | | x | | "journey stages ...; the task flows ...; the funnel stages". No Docs: the contract names "strategy artifacts", not a report (independent review, finding 1) |
| interaction-designer | x | | | | | | motion tokens and code; the Design System type has no motion family |
| orchestrator-marketing (lead) | x | x | x | x | x | x | union of its roster |
| marketing- and agency-creative-designer | x | x | | | | | "color palette tokens, typography scales, safe zone guidelines" |
| marketing- and agency-growth-strategist | x | | x | x | | x | "Growth Strategy Playbook"; "ICE Experiment Backlog"; "Visual Cohort / Funnel Projection (Chart.js / Plotly Specification)" |
| marketing- and agency-content-strategist | x | | x | x | | | "content strategy document"; "90-Day Editorial Calendar: a table" |
| marketing- and agency-campaign-specialist | x | | x | x | | | "campaign kit ... Press Release"; "Launch Checklist: dated items ... each with an owner" |
| marketing- and agency-conversion-specialist | x | | x | x | | | "CRO audit report ... A/B Experiment Briefs"; "ICE-Scored Hypothesis Backlog: ranked table" |
| **paid-acquisition-specialist** (new) | | | | x | | | "keyword matrices, ad copy variants" |
| **plg-strategist** (new) | | | | | x | | "user journey flowcharts" is its first deliverable |
| orchestrator-digital-agency (lead) | x | x | x | x | | x | union of its roster |
| orchestrator-business (lead) | x | | x | x | | x | union of its roster |
| business-panel-experts | x | | x | | | | "a Business Strategy Panel report" |
| market-intelligence-analyst | x | | x | x | | | "competitive battlecard"; "TAM, SAM, 3-year SOM with bottom-up formulas" |
| operations-strategist | x | | x | x | | x | "quarterly OKR framework"; "weighted vendor evaluation scorecard". Data rests on the role's body, not its output contract: "templates for OKRs, meeting agendas, and operational dashboards" |
| **financial-analyst** (new) | | | | x | | | "SaaS Financial Model ... three-scenario sensitivities; ... pro-forma projection table". ADR 0077 had this role as a non-holder (working material); a financial model is the plainest fit for Sheets in the registry, so it holds Sheets only |
| orchestrator-research (lead) | x | | x | | | | its own synthesis report; union of its roster |
| deep-research | x | | x | | | | "a structured Markdown research report" |
| **orchestrator-system-architecture** (lead, new) | | | | x | x | x | union of its roster; the lead-pool rule |
| **system-architect** (new) | | | | | x | | "the bounded contexts and the context map; the C4 diagrams" |
| **finops-cost-engineer** (new) | | | | x | | x | "monthly spend and opportunity overview"; "cost reduction opportunity breakdown table" |

Counts by type (native files, leads included): Design System 9, Docs 20, Sheets 17, Whiteboard 6, Data 8.

#### Not holders (42 native files)

| Role or group | Reason |
| --- | --- |
| orchestrator-engineering and its 15 specialists (accessibility-lead, ai-model-architect, android-architect, backend-architect, code-reviewer, cross-platform-specialist, data-engineer, devops-engineer, distributed-systems-architect, e2e-tester, frontend-architect, ios-architect, ml-platform-engineer, qa-automation-lead, repo-index) | source code, schemas, pipelines, tests and review evidence. code-reviewer and repo-index are read-only. The lead's plans and hand-over reports belong in the codebase. |
| orchestrator-security, appsec-penetration-tester, cloud-security-architect, compliance-grc-specialist, security-engineer | vulnerability and audit evidence must not leave the project for a hosted page (ADR 0077 decision 1) |
| cloud-infrastructure-architect | infrastructure code and a topology matrix. Borderline for Whiteboard, decided no because the system architect owns the diagrams. |
| database-administrator | migrations, configuration, runbooks |
| sysops-sre-lead | runbooks and alert rules belong in the codebase. Its dashboards are Grafana definitions for another system. |
| legal-contract-analyst | contract text and redlines, kept out as in ADR 0077 (sensitive material) |
| statistical-analyst, literature-patent-analyst | working material for the lead's synthesis (ADR 0077 decision 1). The independent review found that both deliver reports; they are the rows nearest to a holder. |
| socratic-mentor | read-only, delivers questions |
| lifecycle-email-specialist | email copy templates |
| seo-specialist, agency-seo-specialist | audit evidence and code snippets |
| agency-frontend-architect, agency-qa-automation-lead, agency-compliance-grc-specialist | code, test evidence, audit evidence |
| agency-3d-designer, agency-motion-designer, agency-sound-designer | 3D, video and audio files |
| orchestrator-universal | routes a request, makes no deliverable |
| orchestrator-agent-factory, factory-evaluator, factory-realizer, factory-sync | contributor tooling, records and digests |

#### What each grant costs

- **Any type, new holder (6 files):** the class `artifacts` in the core, the floor line in the core's safety (the floor is locked, so the maintainer approves by merging), `Artifact` on the `tools:` line, the publishing block, the roster note, the role's own test file and exact tool list, and the list of holders in the tests.
- **Lead-pool consequence:** `orchestrator-system-architecture` becomes a holder because `system-architect` and `finops-cost-engineer` do. The other five leads hold the tool already.
- **Docs and Sheets (24 files: 18 specialists, 6 leads):** one more entry, `mcp__claude_ai_Claude_Docs`, on the `tools:` line. It is an account connector: it exists only while the session is signed in with a subscription login, and the user can switch it off.
- **Whiteboard and Data (12 files: 7 specialists, 5 leads):** `ToolSearch` on the `tools:` line (most roles hold it already) and the store tool, loaded through tool search. The store tool is not in the tool policy, not in the host library and not in the documentation.
- **Bundles:** the skill goes into the five system-architecture Bundles of decision 13. The other new holders sit in Bundles that carry the skill already.
- **The engineering lead** is unchanged. `backend-architect` is started by two leads and is not a holder.

#### The independent review

An independent read-only review (it ran no command and changed no file) checked the table against the inventory of all 75 roles. It found nothing in the coverage of the 75 roles, the leads' unions, the same-core pairs and the counts. Its seven findings:

- Finding 1 (`ux-strategist`, Docs: the contract names "strategy artifacts", not a report) is accepted. Docs is out of that row.
- Finding 7 (the table quoted "operational dashboards" as if from the output contract) is accepted. The row now says the phrase is from the role's body.
- Findings 2 to 4 say Data is unsupported for the growth strategist (a chart specification), `operations-strategist` (templates) and `finops-cost-engineer` (a one-off estimate), and so for four leads. Not changed, because by strict role fit Data has no holder at all, which contradicts decision 1. See "The weakest column".
- Findings 5 and 6 say `literature-patent-analyst` and `statistical-analyst` deliver reports. Not changed: ADR 0077 decision 1 keeps them out as working material for the lead's synthesis, a rule the reviewer's brief did not carry. The maintainer may overturn both rows for Docs.

## Consequences

- Positive: a financial model, a report, a flow diagram or a design system can be reviewed in a browser, in the editor of its type, where files in the project do not offer that.
- Limits:
  - Project material leaves the project for Anthropic-hosted pages, for five more types and six more roles.
  - 33 native files hold the tool and 24 of them hold an account connector that is not a tool of the canonical agents. Nothing deterministic of ours stops a role from publishing without the go-ahead. The tests pin the wording, not the behaviour.
  - The connector can create a doc without `Artifact` (its own server text says so) and can, by an inference from two separate documentation pages (not shown), be present while artifacts are off. So the go-ahead sentence names documents written through the connector, the block says that the connector fills a page started through `Artifact` and never creates one, and the connector entry is granted only together with `Artifact`.
  - A Data page can store a live call that runs for every reader with that reader's access. The block allows files and saved numbers, a live query only when the user asked for it, and never a call that changes anything.
  - A session whose account does not offer the Design or Slides type gets one question to the user and, on the answer "Publish an HTML page", an HTML page for a Design or Slides deliverable; an account that does not offer another type, or a session without the connector, gets the files, with the reason.
  - `factory-check --artifact` expects the connector tool on the tools line of a connector holder, so it checks the 24 connector holders; for a candidate it still asks for a coverage file.
  - The permission behaviour of connector calls outside auto mode is not established.
- The weakest column is Data. No output contract names a dashboard or a recurring report in plain words. The three nearest fits are the growth strategist (a chart specification), `operations-strategist` (a role body that mentions "operational dashboards" as templates) and `finops-cost-engineer` (a monthly spend overview), with their four leads. The independent reviewer found no role that fits by strict role fit. The alternatives are: leads only (the store work is then on the main thread only), or no holder until a role's contract names a dashboard. This ADR keeps the three rows because the maintainer named Data, and it states the weakness. If the live check shows that only a lead can call the store tool, leads only is the only version that can work.
- The rows nearest to a holder that are kept out are `literature-patent-analyst` and `statistical-analyst` (decision 1 of ADR 0077). `financial-analyst` holds Sheets only, although ADR 0077 had it as a non-holder.
- Other Hosts: as in ADR 0077, neither the Cline nor the Antigravity tool policy catalogues a tool of the class `artifacts`, so the class grants nothing there. The floor line is host-neutral text. The skill `design-artifact-publishing` states that it is for Claude Code only. Whether a later Cline or Antigravity file for a holder would carry the line depends on how that file is generated and is not established.

### The live check (decision 17)

Interactive and signed in, because artifacts are off by default under `-p`. The coordinating AI session sits it through the terminal bridge on the maintainer's signed-in account, and the record says that an AI session sat it and no human typed. Six prompts on four leads, none of them naming publishing, a page or a type, so that the lead's question is unprompted. Six pages are attempted, one per prompt: Design System, Docs, Sheets, Whiteboard, Data and the unprompted Design poster (the Design type). No Slides page is attempted. Each is attempted once, and a page that succeeds is private; no page is shared, deleted or pinned. A failed store call leads to the removal below.

1. Design lead: a design system for a fictional project (Design System; it also shows decision 6).
2. Business lead: a financial model (Sheets).
3. Business lead, the next prompt: a strategy memo (Docs).
4. System-architecture lead: a C4 context diagram (Whiteboard; a new lead and a new holder).
5. Marketing lead: a funnel overview from a CSV that the session writes (Data).
6. Design lead, after the first prompt: a poster for a fictional event, unprompted (the Design type: a poster is a design to edit on a canvas, and an HTML page would not be the form it asks for). The earlier records show a Design poster only after a prompt that asked for it, and no deck.

It records: the question asked first with its two options in order; who created each page and with which call; which tool filled it (files, the connector's tools, or the store tool after a tool search); whether the store tool could be called at all from a specialist and from a lead; the report's link, type and the sentence that project material has left the project; and any Host permission dialog.

A separate optional check, which is not a prompt of the list, publishes no page: the Claude Docs connector is switched off for the project with the `/mcp` toggle, then a memo is asked for. Expected: files, the reason in the report, and no request to sign in.

What comes out if the store tool cannot be called from a role: If only a specialist cannot call it and a lead was seen calling it, Data is leads only and Whiteboard waits. If neither a specialist nor a lead could call it, Whiteboard and Data have no holder: their rows come out of the table, the store tool bullet and the `ToolSearch` requirement go with them, and the counts in this ADR change (Whiteboard 0, Data 0, store types 0 files). This is done before the pull request is pushed, and the ADR is then set to Accepted with the record linked.

Not shown by the check, whatever its result: that the wording is followed in general (one run), the Host's prompts in modes other than auto, and the behaviour of a role that is started in the background.

### The sitting of 2026-11-23

Sat once by the coordinating AI session through the terminal bridge on commit `9f229ea9`, Claude Code 2.1.330, auto mode; no human typed. The record is [the observation](../../host-library/claude/observations/2026-11-23-claude-2.1.330-page-types-live.md). It repeats the design session once more (a second run).

Shown, once each, in one account in auto mode:

- Sheets (`financial-analyst`, through the connector) and Docs (the business lead, through the connector).
- Whiteboard (`system-architect`): `ToolSearch`, then `ArtifactData`, 21 writes and 20 documents read back. The store tool is callable from a specialist.
- The lead asked first, unprompted, with **Keep it in the project** first, in every session.
- No Host dialog. Nothing was shared, deleted or pinned.
- With the connector off, no question was asked and the file stayed.

Not shown:

- Design System and Design: the Host's auto-mode classifier refused the specialists' create of the type twice as "Unsanctioned Communication", with no dialog. The roles did not retry and reported it.
- Data: the lead chose Docs for the funnel overview. The Data column stays the weakest, as above.
- The lead's store route; the HTML fallback question (the account offers Design); per-page privacy; Slides; other modes.

A lesson for a sitting script. A plan answer of "local work only" was read as narrowing a go-ahead already given. The third option of the design-system proposal, **Use <the default>**, was not seen as the text says.

Decision 17 after the sitting: Whiteboard was shown from a specialist, so no store row comes out. The lead route and Data are not shown, so nothing else is removed on this sitting either.
