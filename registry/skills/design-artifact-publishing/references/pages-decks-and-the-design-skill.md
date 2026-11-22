# Pages, decks and the bundled design skill

**The host rules below are from the host documentation, read on 2026-11-21, not observations of this repository.**

## Which route to take
- If the list of skills available to you shows `design` (for a deck: `slides`), invoke it through `Skill` with the brief.
- Whether a session offers that skill to a subagent is not established. The host documentation, read on 2026-11-21, says a subagent can use project, user and plugin skills through the Skill tool and does not name bundled skills.
- If the skill answers that the user must run `/design consent` or sign in, report that and go on with the tool.
- You must never ask for `/design-login` or `/design-sync`. Those commands belong to a standalone site that closes by December 14, 2026.
- Otherwise, use the Design type for a prototype, a screen flow, a poster or a one-pager, and the Slides type for a deck, both started through the `Artifact` tool by following the type's own instructions.
- Use an HTML page when the account offers neither type.

Nothing about the files of the Slides type has been observed in this repository: follow the type's own instructions and report what you did not check.

## New page or update
- An update is a publish to the URL that your brief names or that you published yourself in this piece of work.
- Anything else is a new page and needs the user's go-ahead for that page.

## What you never do
- Never share a page and never ask the user to share it as a step of the work.
- You must never delete or pin an artifact.
- Declare no runtime capabilities unless the brief asks for them.
- Never work around a prompt of the host.

## What the host documentation says (read on 2026-11-21)
- Artifacts need a Pro, Max, Ultra, Team or Enterprise plan, a session signed in with `/login`, Claude Code `v2.1.281` or later, and the Anthropic API.
- They are off by default in the Agent SDK, the GitHub Action and when Claude Code runs with `-p`.
- "A new artifact is visible only to you." Sharing is the Share control in the browser, the user's own act.
- A user who wants no publishing at all can set `"enableArtifact": false` in the settings or put `Artifact` in `permissions.deny`.

## The report lines
- State the link, the type, what was published, what was not checked, and that project material has left the project.
