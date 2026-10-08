# What Claude Design looked like in the sessions of 2026-10-08

**These are observations of Claude Code 2.1.294 on a Pro plan, not documentation.** The vendor's own instructions arrive with the `Artifact` calls and win where they differ from this page. Source: `host-library/claude/observations/2026-10-08-claude-2.1.294-designer-p3-artifact-probe.md` (two runs, one prompt each, fictional content).

## The tool and its availability
- It needs a Pro or higher plan, a signed-in CLI and the Anthropic API, and it is documented as off by default in the Agent SDK and GitHub Action contexts. In a headless run `CLAUDE_CODE_ARTIFACT_AUTO_OPEN=0` keeps a browser tab from opening.
- `Artifact` `quickstart` (`intent: design`, or `other` for a design system; `design_systems: false` when the user says to use no other design system) lists the types. `publish` with a type's `type_url` and a title creates the artifact; a later `publish` with its `url` updates it; `list` (scope `files`) and `read` (a `path`, or several `paths`) read it back.
- A new artifact is private. The output of `list` and `read` shows no sharing state, so you cannot say who can see it beyond "created private, sharing untouched".
- The host's auto mode refused a publish that nobody had asked for (seen in the session that launched these runs, until the user said yes). Do not look for a way round it.
- One publish run cost 0.42 to 0.49 USD (Sonnet, medium effort).

## The Design type (a canvas)
- 20 files: the type's 16 and yours, `project/canvas.json` and one `project/<Name>.dc.html` per board.
- `canvas.json` holds `v`, `title`, `launch`, `pages`, `boards` (per board file: `x`, `y`, `w`, `h`, `title`), `order`, `notes` and `designSystems`. `designSystems: []` means no design system is attached.
- A board is an HTML file with an `<x-dc>` root, one inline-styled `div` of the board's size and a `DCLogic` script. It loads `./support.js`, which is not among the published files; the page serves it (not established from where).
- Notes on the canvas (a title, a sticky) are in `canvas.json`: a fictional product's claims belong in one.

## The Design System type
- 16 files: the type's 12 and yours, `project/README.md` (the brand book), `project/tokens.json` (the list form: `design-system-tokens/references/claude-design-format.md`), `project/design-system.json` and `project/components/Cover/preview.html`.
- The cover is required. Its rules are in the type's own `artifact-type/reference/cover.md`, which you read from the new artifact: the name and a tagline in a zone at most 440 px wide, every block and pattern unit right of x = 480, pills and discs with `rx` equal to half the short side (an SVG `rx` of 9999px draws an ellipse), a derivation as a comment atop the SVG.
- `design-system.json` carries `createdOnFiles` and `lastChange` with an `at` time. The format wants an ISO-8601 time and you have no clock.

## What the host did that you did not
- The listing of the design system showed a version one second after the publish: a second save that you did not make.
- The canvas was saved again 31 minutes later, when someone opened it in the browser: `canvas.json` came back re-serialised (keys sorted, `"attachments": {}` added), the boards unchanged. Read before you edit.
