---
name: design-artifact-publishing
description: "Use when the user asks to publish work to Claude Design (a canvas of artboards, a design system with a brand book, or a deck) or as a Docs, Sheets, Whiteboard or Data page through the Artifact tool, or to update one already published; trigger phrases: put this in Claude Design, make a canvas I can review in the browser, publish the design system, publish the brand book, put the memo in a doc, make a sheet of the model, update the canvas. Produces a private page of a type the account offers (Design, Design System, Slides, Docs, Sheets, Whiteboard or Data), a read-back of what was published, and a report of what was not checked. Claude Code only, and only while the Artifact tool is held; skip it for plain SVG or HTML files, for sharing an artifact (the user's act, never yours) and for a design system the client already keeps in Claude Design (read it, do not replace it)."
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
For any role that holds the `Artifact` tool (the creative designer is one; Claude Code only). It does not choose the brand or the copy (the lead and the roles that own them; in the agency Kaan and Defne) and it does not decide who may see the artifact (the user).

## Execution Triggers
Load it when the user, directly or through the lead, asks for a Claude Design canvas, design system, brand book, deck or one-pager, a doc, sheet, whiteboard or data page, or an update of one. Do not use it for plain SVG or HTML files, for sharing (the user uses the page's Share control), or for a client design system already there (read first, do not replace). Without `Artifact`, say so and write files.

## Input/Output Requirements
Inputs: the type (Design, Design System, Slides, Docs, Sheets, Whiteboard or Data); tokens and copy files; placements and sizes; brand guidelines; update url.

Output: one private artifact, its link, a read-back and a report. **Evidence to attach**: link, type, files with sizes, checks run and not run.

## Step-by-Step Runbook
0. **Pick the type.** `list` the account's types with `Artifact` (scope `types`) and choose by title, never a stored link. Then read how that kind is filled: [design systems](references/design-systems.md); [docs and sheets](references/docs-and-sheets.md); [whiteboards and data](references/whiteboards-and-dashboards.md). Design and Slides: [the pages reference](references/pages-decks-and-the-design-skill.md).
1. **Check the ask.** A new page needs the user's go-ahead for that page (in your brief, or the lead's answer to your request); updating an approved page needs no new go-ahead. No go-ahead: write the files and ask as your role's publishing section says; declined or unanswered, the files stand and you publish nothing. Keep it private and never change sharing.
2. **Load the skills that hold the rules before you build**, when the page is a design: `ad-creative-design` (sizes, safe zones), `design-system-tokens` (list form for tokens), `brand-identity` (brand rules). A canvas built without them broke the caption zone.
3. **Follow the type's own instructions**, not from memory: the format changes with the host. Attach no other design system than the one supplied.
4. **Build everything locally, then publish once.** Write and check all files against the rules (zones, colours, copy), then publish in one call.
5. **Keep to the source and read back.** Copy, count and report as [references/publish-and-read-back.md](references/publish-and-read-back.md) says.
6. **Report.** The link, type, files; "private, sharing untouched"; what was not checked (not rendered, platform specs, how the editor shows it); claims to review; open items. You cannot look at it: put the render ask to the lead.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a read-back and report. See [references/claude-design.md](references/claude-design.md) for 2026-10-08 observations and [references/publish-and-read-back.md](references/publish-and-read-back.md) for the read-back checks and report. The anti-patterns are in the same file.

## Edge Cases & Error Recovery
- **Bundled `design` or `slides` skill is not in your list**: that is not an error; go on with the `Artifact` tool.
- **The tool is missing or denied**: say so, write the files and brief, ask the lead; do not retry in a loop.
- **The connector or the store tool is missing**: keep the files and say why in the report; never ask the user to sign in.
- **Publish fails halfway**: `list` the artifact to see what landed, publish the rest, never call it complete.
- **User edited the canvas in the browser**: the page re-saves it; read it back before you change it and keep their edits.
- **Update or new artifact**: an update keeps the link; another client gets a new one.
- **Nested tokens** (`$value`): the Design System page shows them empty; convert to the list form first.
- **User asks to delete or share**: not yours; hand off to the lead.

## Verification Checklist
- [ ] User's go-ahead for this page (in the brief or the lead's answer), or an update of an approved page.
- [ ] For a design: placement and token skills loaded before building.
- [ ] Only supplied tokens and copy; colours scanned; claims listed; inferences marked.
- [ ] Published once, private, sharing untouched.
- [ ] Every file read back; counts counted; contrast recomputed.
- [ ] The report says what was not checked.
