---
name: design-artifact-publishing
description: "Use when the user asks to publish a design to Claude Design (a canvas of artboards, or a design system with a brand book) through the Artifact tool, or to update one already published; trigger phrases: put this in Claude Design, make a canvas I can review in the browser, publish the design system, publish the brand book, update the canvas. Produces a private Design or Design System artifact built from the supplied tokens and copy, a read-back of every file published, and a report of what was not checked. Claude Code only, and only while the Artifact tool is held; skip it for plain SVG or HTML files, for sharing an artifact (the user's act, never yours) and for a design system the client already keeps in Claude Design (read it, do not replace it)."
metadata:
  author: agents-united
  version: 1.0.0
  icon: 🧩
disable-slash-command: true
---

# Publishing to Claude Design

Claude Design shows a canvas or a brand book in the browser, where the user reviews and edits it. It is a page on Anthropic's servers: what you publish leaves the project. So you publish only what was asked for, privately, and you say exactly what you did and did not check.

## Overview & Purpose
For the creative designer, while she holds the `Artifact` tool (Claude Code only; the tool needs a Pro or higher plan and a signed-in CLI). It does not choose the brand or the copy (the lead, Kaan, Defne) and it does not decide who may see the artifact (the user).

## Execution Triggers
Load it when the user, directly or through the lead, asks for a Claude Design canvas, design system or brand book, or an update of one. Do not use it for plain SVG or HTML files (write them under `docs/`), for sharing (the user shares from the page's Share menu), or for a design system the client already keeps there (read it first, do not replace it). Without the `Artifact` tool, say so and write the files instead.

## Input/Output Requirements
Inputs: the type (a Design canvas or a Design System); the tokens file and the copy file; the placements and sizes; the brand guidelines; the url of an artifact to update.

Output: one private artifact, its link, a read-back of every file you published and a report. **Evidence to attach**: the link and type, the files published with their sizes, the checks that ran and the ones that did not.

## Step-by-Step Runbook
1. **Check the ask.** The user must have asked for a Claude Design artifact (the lead passes the go-ahead). Nobody asked: write files and offer it. Keep it private and never change sharing.
2. **Load the skills that hold the rules before you build**: `ad-creative-design` for sizes and safe zones, `design-system-tokens` for tokens (its Claude Design reference gives the list form the page reads), `brand-identity` for brand rules. A canvas built without them broke the caption zone.
3. **Follow the type's own instructions** (the `Artifact` quickstart and the type's reference files), not from memory: the format changes with the host. Attach no other design system than the one supplied.
4. **Build everything locally, then publish once.** Write every board or file, check them against the rules (zones, colours, copy), then publish in one call.
5. **Keep to the source.** Copy word for word; only token colours; figures and claims go to Defne as claims to review; what you infer (a use for a token, a rule) is written as inferred, never as the brand's. A timestamp the format requires is the date you were given at `T00:00:00Z`, called a placeholder in the report.
6. **Read back what you published.** `list` the files, `read` each one you wrote, compare its size with what you wrote; count files, tokens and empty fields instead of estimating; recompute any contrast figure you state.
7. **Report.** The link, the type, the files; "private, sharing untouched"; what was not checked (not rendered, the platform specs, how the editor shows it); the claims for Defne; open items. You cannot look at it: put the render ask to the lead.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a read-back and a report. What the sessions of 2026-10-08 observed (types, file lists, version stamps, availability) is in [references/claude-design.md](references/claude-design.md); the read-back checks and the report skeleton are in [references/publish-and-read-back.md](references/publish-and-read-back.md).

Anti-patterns, each with its reason:
- Publishing after every board: the half-built canvas is visible.
- A time written from memory (`12:00:00Z`): it was not the time.
- "I invented nothing" over README rules the source does not state: the reader trusts the sentence.
- A count from memory ("11 of 12"): count it; it was 10.
- Saying it looks right when nobody rendered it.
- Changing sharing, or telling the user it is shared.

## Edge Cases & Error Recovery
- **The tool is missing or denied**: say so, write the files and the brief, ask the lead; do not retry in a loop.
- **A publish fails halfway**: `list` the artifact to see what landed, publish what is missing, never call it complete.
- **The user edited the canvas in the browser**: the page re-saves it; read it back before you change it and keep their edits.
- **An update or a new artifact**: an update keeps the link (pass its url); another client gets a new one.
- **Nested tokens** (`$value`): the Design System page shows them empty; convert to the list form first.
- **The user asks to delete or share**: not yours; hand off to the lead.

## Verification Checklist
- [ ] The ask named Claude Design, or the lead passed the user's go-ahead.
- [ ] The placement and token skills were loaded before building.
- [ ] Only supplied tokens and copy; colours scanned; claims listed for Defne; inferences marked.
- [ ] Published once, private, sharing untouched.
- [ ] Every file read back; counts counted; contrast recomputed.
- [ ] The report says what was not checked.
