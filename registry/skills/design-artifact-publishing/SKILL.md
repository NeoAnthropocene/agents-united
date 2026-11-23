---
name: design-artifact-publishing
description: "Use when the user asks to publish work to Claude Design (a canvas of artboards, a design system with a brand book, or a deck) or as a Docs, Sheets, Whiteboard or Data page through the Artifact tool, or to update one already published; trigger phrases: put this in Claude Design, publish the design system, make a sheet of the model. Produces a private page of a type the account offers (Design, Design System, Slides, Docs, Sheets, Whiteboard or Data) and a report of what was not checked. Claude Code only, and only while the Artifact tool is held; skip it for SVG or HTML files that stay in the project, for sharing an artifact (the user's act, never yours) and for a design system the client already keeps in Claude Design (read it, do not replace it)."
metadata:
  author: agents-united
  version: 1.2.0
  license: MIT
  icon: 🧩
disable-slash-command: true
---

# Publishing to Claude Design

Claude Design shows a canvas, deck or brand book in the browser. What you publish sits on Anthropic's servers and leaves the project, so publish only with approval, privately, and say what you did not check.

## Overview & Purpose
For any role that holds the `Artifact` tool. It does not choose the brand or copy (their owners) or who may see the artifact (the user).

## Execution Triggers
Load it when the user, directly or through the lead, asks for a Claude Design canvas, design system, brand book, deck or one-pager, a doc, sheet, whiteboard or data page, or an update of one. Not for SVG or HTML files that stay in the project (a working HTML page the user approved goes out as an HTML page), for sharing (the page's Share control), or for a client design system already there (read, do not replace). Without `Artifact`, write files and say why.

## Input/Output Requirements
Inputs: the type (Design, Design System, Slides, Docs, Sheets, Whiteboard or Data); tokens and copy files; placements and sizes; brand guidelines; update url.

Output: one private artifact, a read-back and a report. **Evidence to attach**: link, type, files with sizes, checks run and not run.

## Step-by-Step Runbook
0. **Pick the type.** `list` the account's types with `Artifact` (scope `types`) and choose by title, never a stored link. Before the first write call, read how that kind is filled: [design systems](references/design-systems.md) (also for a look); [docs and sheets](references/docs-and-sheets.md); [whiteboards and data](references/whiteboards-and-dashboards.md); [pages and decks](references/pages-decks-and-the-design-skill.md) for Design and Slides; and the reference of step 5.
1. **Check the ask.** Starting any type creates a new page, an empty one too, so a new page needs the user's go-ahead for that page first; updating an approved page needs no new go-ahead. No go-ahead: write the files and ask as your role's publishing section says; if declined or unanswered, the files stand. Keep it private and never change sharing.
2. **Load the skills that hold the rules before you build**, when the page is a design: `ad-creative-design`, `design-system-tokens`, `brand-identity`.
3. **Follow the type's own instructions** for the page's content only, not from memory. The go-ahead, tool and sharing rules stay in force over them. Attach no other design system than the one supplied.
4. **Build everything locally, then publish once.** Write and check all files against the rules. Design and Slides publish once, in one call (not yet observed for Slides); the other types follow their reference.
5. **Keep to the source and read back.** Copy, count, read back by type and report as [references/publish-and-read-back.md](references/publish-and-read-back.md) says.
6. **Report.** The link, type, files; new page: "private, sharing untouched"; update: "sharing as it was"; who can see it only when a tool result shows it; after a failed write, the link, what you read back, "unknown" for the rest; what was not checked (not rendered, platform specs, how the editor shows it). You cannot look at it: put the render ask to the lead.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a read-back and report; [references/claude-design.md](references/claude-design.md) has the 2026-10-08 observations. The anti-patterns are in the same file as the read-back checks (step 5).

## Edge Cases & Error Recovery
- **Bundled `design` or `slides` skill is not in your list**: not an error; go on with `Artifact`.
- **The tool is missing or denied**: a denied or refused call stops; write the files and the reason, and ask the lead only for the go-ahead.
- **The connector or the store tool is missing, refused or failing**: keep the files and say why; leave any page as it is, try no other route, report as step 6 says; never ask the user to sign in.
- **Publish fails halfway** (Design and Slides only; never after a refusal, which stops): an approved publish that partly landed may be completed to the same URL, through the same tool, only when the result can be checked: `list` what landed, publish the rest, read it back. After a connector or store write fails, the type's own rule holds: leave the page as it is and try no other route.
- **Design or Slides type not offered**: when the user approved the page, ask once before an HTML page replaces it; declined or unanswered, the files stand.
- **User edited the canvas in the browser**: read it back before you change it.
- **User asks to delete or share**: not yours. The lead tells the user that sharing is their own act; an update leaves sharing as it was.

## Verification Checklist
- [ ] User's go-ahead for this page (in the brief or the lead's answer), or an update of an approved page.
- [ ] For a design: placement and token skills loaded first; only supplied tokens and copy; claims listed; inferences marked.
- [ ] Read back by type, or the failure stated; counts counted; contrast recomputed.
- [ ] The report says what was not checked.
