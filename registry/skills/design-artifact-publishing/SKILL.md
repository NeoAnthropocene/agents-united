---
name: design-artifact-publishing
description: "Use when the user asks to publish work to Claude Design (a canvas of artboards, a design system with a brand book, or a deck) or as a Docs, Sheets, Whiteboard or Data page through the Artifact tool, or to update one already published; trigger phrases: put this in Claude Design, make a canvas I can review in the browser, publish the design system, put the memo in a doc, make a sheet of the model, update the canvas. Produces a private page of a type the account offers (Design, Design System, Slides, Docs, Sheets, Whiteboard or Data), a read-back of it, and a report of what was not checked. Claude Code only, and only while the Artifact tool is held; skip it for SVG or HTML files that stay in the project, for sharing an artifact (the user's act, never yours) and for a design system the client already keeps in Claude Design (read it, do not replace it)."
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
For any role that holds the `Artifact` tool (the creative designer is one). It does not choose the brand or the copy (the roles that own them) and it does not decide who may see the artifact (the user).

## Execution Triggers
Load it when the user, directly or through the lead, asks for a Claude Design canvas, design system, brand book, deck or one-pager, a doc, sheet, whiteboard or data page, or an update of one. Not for SVG or HTML files that stay in the project (a working HTML page the user approved as a page goes out as an HTML page equal to the project files), for sharing (the page's Share control), or for a client design system already there (read, do not replace). Without `Artifact`, say so and write files.

## Input/Output Requirements
Inputs: the type (Design, Design System, Slides, Docs, Sheets, Whiteboard or Data); tokens and copy files; placements and sizes; brand guidelines; update url.

Output: one private artifact, a read-back and a report. **Evidence to attach**: link, type, files with sizes, checks run and not run.

## Step-by-Step Runbook
0. **Pick the type.** `list` the account's types with `Artifact` (scope `types`) and choose by title, never a stored link. Before the first write call, read how that kind is filled: [design systems](references/design-systems.md) (also for a look); [docs and sheets](references/docs-and-sheets.md); [whiteboards and data](references/whiteboards-and-dashboards.md); [pages and decks](references/pages-decks-and-the-design-skill.md) for Design and Slides; and the reference of step 5.
1. **Check the ask.** Starting any type creates a new page, an empty one too, so a new page needs the user's go-ahead for that page first (in your brief, or the lead's answer); updating an approved page needs no new go-ahead. No go-ahead: write the files and ask as your role's publishing section says; if declined or unanswered, the files stand. Keep it private and never change sharing.
2. **Load the skills that hold the rules before you build**, when the page is a design: `ad-creative-design` (sizes, safe zones), `design-system-tokens` (list form for tokens), `brand-identity` (brand rules).
3. **Follow the type's own instructions** for the page's content only, not from memory: the format changes with the host. The go-ahead, tool and sharing rules stay in force over them. Attach no other design system than the one supplied.
4. **Build everything locally, then publish once.** Write and check all files against the rules. Design and Slides publish once, in one call; the other types follow their reference.
5. **Keep to the source and read back.** Copy, count, read back by type and report as [references/publish-and-read-back.md](references/publish-and-read-back.md) says.
6. **Report.** The link, type, files; new page: "private, sharing untouched"; update: "sharing as it was"; who can see it only when a tool result shows it; what was not checked (not rendered, platform specs, how the editor shows it); claims to review. You cannot look at it: put the render ask to the lead.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a read-back and report; [references/claude-design.md](references/claude-design.md) has the 2026-10-08 observations. The anti-patterns are in the same file as the read-back checks (step 5).

## Edge Cases & Error Recovery
- **Bundled `design` or `slides` skill is not in your list**: that is not an error; go on with the `Artifact` tool.
- **The tool is missing or denied**: a denied or refused call stops; write the files and the reason, and ask the lead only for the go-ahead.
- **The connector or the store tool is missing, refused or failing**: keep the files and say why; if the page exists, report it and what landed; never ask the user to sign in.
- **Publish fails halfway**: an approved publish that partly landed may be completed to the same URL, through the same tool, only when the result can be checked: `list` what landed, publish the rest, read it back.
- **User edited the canvas in the browser**: read it back before you change it; keep their edits.
- **User asks to delete or share**: not yours. The lead tells the user that sharing is their own act; an update leaves sharing as it was.

## Verification Checklist
- [ ] User's go-ahead for this page (in the brief or the lead's answer), or an update of an approved page.
- [ ] For a design: placement and token skills loaded first; only supplied tokens and copy; claims listed; inferences marked.
- [ ] Private, sharing untouched (a new page) or as it was (an update).
- [ ] Read back by type, or the failure stated; counts counted; contrast recomputed.
- [ ] The report says what was not checked.
