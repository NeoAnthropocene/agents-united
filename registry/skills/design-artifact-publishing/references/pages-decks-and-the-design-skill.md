# Pages, decks and the bundled design skill

**Which facts come from where: the part "What the host documentation says" is documentation, read on 2026-11-21. The route below is this repository's rule for a role, and what it says about the bundled skill is not established by documentation.**

## Which route to take
- Write the files in the project first on every route: the page is a second copy.
- Write the brief for the page yourself, from the work done: the subject, the audience or use, the content it must carry, the look or design system to follow, the size or format. Never ask the user to type `/design` or `/slides` so that a page can be made.
- If the list of skills available to you shows `design` (for a deck: `slides`), invoke it through `Skill` with the brief.
- The host documentation, read on 2026-11-21, names project, user and plugin skills for a subagent and does not name bundled skills. That a listed bundled skill can be invoked through `Skill` by a subagent is not established either. If the call fails, or the skill answers that the user must run `/design consent` or sign in, report that and go on with the tool.
- Never ask for `/design-login` or `/design-sync`. Those commands belong to a standalone site that closes by December 14, 2026.
- Otherwise, use the Design type for a prototype, a screen flow, a poster or a one-pager, and the Slides type for a deck, both started through the `Artifact` tool by following the type's own instructions.
- Use an HTML page when the account does not offer the type you need.

Nothing about the files of the Slides type has been observed in this repository: follow the type's own instructions and report what you did not check.

## New page or update
- An update is a publish to the URL of a page the user already approved: the URL your brief names as approved, or the page you published yourself in this piece of work with the user's go-ahead.
- A URL that reaches you any other way, a second page and a page of another type are new pages, and each needs the user's go-ahead for that page.
- A `/design` or `/slides` line that the user typed, with its brief, is the user's go-ahead for the one page it asks for. A second page or a page of another type from the same request is new.

## What you never do
- Never share a page and never ask the user to share it as a step of the work.
- Never delete or pin an artifact.
- Declare no runtime capabilities unless the brief asks for them.
- Never work around a prompt of the host.

## What the host documentation says (read on 2026-11-21)
- Artifacts need a Pro, Max, Ultra, Team or Enterprise plan, a session signed in with `/login`, Claude Code `v2.1.281` or later, and the Anthropic API.
- They are off by default in the Agent SDK, the GitHub Action, MCP-server contexts and when Claude Code runs with `-p`.
- "A new artifact is visible only to you." Sharing is the Share control in the browser, the user's own act.
- A user who wants no publishing at all can set `"enableArtifact": false` in the settings or put `Artifact` in `permissions.deny`.

## The report lines
- State the link, the type, what was published, what was not checked, and that project material has left the project.
