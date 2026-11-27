---
host: claude
artifact: rule
reviewedAgainst: "2.1.285"
---

# Claude Code — authoring guide: rules

Distilled from the snapshots in `host-library/claude/pages/`. Primary source: [memory](../pages/rule/memory.md). Supporting source: [claude-directory](../pages/rule/claude-directory.md).

A rule is a Markdown file under `.claude/rules/` that Claude Code loads as instructions. There is no native `registry/hosts/claude/rules/` folder: the canonical rule lives in `registry/rules/<name>.md` and the Claude projector renders it to `.claude/rules/<name>.md` (see the authoring notes below). Rules are the lightest artifact kind: text only, no script and no registration.

## Rules

### Anatomy and locations

- **A rule is a Markdown file in `.claude/rules/`, one topic per file, with a descriptive name such as `testing.md` or `api-design.md`.** All `.md` files there are found recursively, so subfolders such as `frontend/` or `backend/` organize them. [Set up rules](../pages/rule/memory.md#set-up-rules)
- **Rules live in the project (`.claude/rules/`) and in the user's home (`~/.claude/rules/`).** User-level rules load before project rules, so a project rule appears later in Claude's context; neither set overrides the other, and if they conflict Claude may follow either, so keep the two consistent. [User-level rules](../pages/rule/memory.md#user-level-rules), [File reference](../pages/rule/claude-directory.md#file-reference)
- **The `.claude/rules/` folder accepts symlinks.** A link whose target is outside the working directory is treated like an external import and does not load until the user approves external imports for the project; a link to a network path (a UNC share, `/net`, `/Network`) never loads. [Share rules across projects with symlinks](../pages/rule/memory.md#share-rules-across-projects-with-symlinks)
- **Excluding `project` from `--setting-sources` skips project rules.** [Set up rules](../pages/rule/memory.md#set-up-rules)

### Loading

- **A rule without `paths` frontmatter loads at launch, with the same priority as `.claude/CLAUDE.md`.** It costs context in every session. [Set up rules](../pages/rule/memory.md#set-up-rules), [Organize rules with `.claude/rules/`](../pages/rule/memory.md#organize-rules-with-clauderules)
- **A rule with `paths` loads only when Claude reads, writes or edits a matching file**, or views one with a Bash command that counts as a read (such as `cat` or `head` on a single file). Patterns are relative to the base directory: for a project rule, the directory that contains the `.claude` folder. [Path-specific rules](../pages/rule/memory.md#path-specific-rules)
- **Rules are context, not enforced configuration.** To block an action regardless of what Claude decides, use a `PreToolUse` hook; for task-specific instructions that do not need to be in context all the time, use a skill, which loads when invoked or judged relevant. [CLAUDE.md vs auto memory](../pages/rule/memory.md#claudemd-vs-auto-memory), [Organize rules with `.claude/rules/`](../pages/rule/memory.md#organize-rules-with-clauderules)

### Frontmatter

- **`paths` is the only frontmatter field Claude Code reads from a rule; any other field is ignored without an error.** Claude Code removes the frontmatter before loading the rule into context. [Rule frontmatter reference](../pages/rule/memory.md#rule-frontmatter-reference), [Frontmatter fields by file](../pages/rule/claude-directory.md#frontmatter-fields-by-file)
- **Unparseable frontmatter YAML is ignored and the rule loads as if it had no `paths`.** Run `claude --debug` to see the parse error. [Rule frontmatter reference](../pages/rule/memory.md#rule-frontmatter-reference)
- **`paths` takes a YAML list or a comma-separated string of globs, with brace expansion.** All patterns of a rule share a budget of 1,000 expanded patterns and 4 MiB; a pattern over the budget is used unexpanded and its literal braces match nothing. A pattern with an unreadable `[` is invalid and matches nothing, while the rule's other patterns keep working. [Path-specific rules](../pages/rule/memory.md#path-specific-rules), [Rule frontmatter reference](../pages/rule/memory.md#rule-frontmatter-reference)

### Writing and size

- **Write instructions concrete enough to verify**: "Use 2-space indentation" rather than "Format code properly". Group related instructions under headers and bullets; if two instructions contradict each other, Claude may pick one arbitrarily, so review the rules periodically for outdated or conflicting content. [Write effective instructions](../pages/rule/memory.md#write-effective-instructions), [Audit your instruction files](../pages/rule/memory.md#audit-your-instruction-files)
- **Keep each instruction file under about 200 lines.** The target is stated for CLAUDE.md files; longer files consume more context and reduce adherence, and Claude Code warns at startup and in `/status` when an instruction file is over the recommended length. Each CLAUDE.md, rules file and `@path` import counts as a separate file, and files that are each within the length can still add up past a combined limit. [Write effective instructions](../pages/rule/memory.md#write-effective-instructions), [My CLAUDE.md is too large](../pages/rule/memory.md#my-claudemd-is-too-large)
- **A rule that loads on demand (path-scoped, or in a subdirectory's `.claude/rules/`) has a per-file size limit of its own.** Over it, Claude receives only the start of the file with a note to read the rest, and the later instructions are not in context until it does; the limit is 40,000 characters in a 200K context window. A rule that matters only for part of the codebase belongs in a path-scoped rule. [Claude ignores the end of my subdirectory CLAUDE.md](../pages/rule/memory.md#claude-ignores-the-end-of-my-subdirectory-claudemd), [Path-specific rules](../pages/rule/memory.md#path-specific-rules)
- **Choose the file by its job.** Project context and conventions go in `CLAUDE.md` or a rule; allowing or blocking tool calls and running scripts around tool calls go in `settings.json` permissions and hooks. [Choose the right file](../pages/rule/claude-directory.md#choose-the-right-file), [Organize rules with `.claude/rules/`](../pages/rule/memory.md#organize-rules-with-clauderules)

## Authoring notes (agents-united, not host behaviour)

- A canonical rule is `registry/rules/<name>.md` and carries no front matter (ADR 0082 decision 10): `ClaudeProjector.renderRule` writes `.claude/rules/<name>.md` behind its own managed marker, so an author's front matter would land after it and be read as text. Path scoping through `paths` is outside the first rule route.
- The projector skips a rule over the 200-line `maxRuleLines` budget (ADR 0018 decision 5) without a message when no bound Skill claims it; `agents rule-check` fails such a rule at authoring time. The host's own limits above are separate: the 200 lines is the host's recommendation, the budget is the projector's ceiling.
- The projector drops a section whose heading names another host's routing and rewrites a few phrases; `rule-check` reports each so the author can rename the heading.
- Host entry-point names (`CLAUDE.md`, `CLAUDE.local.md`, `GEMINI.md`, `AGENTS.md`, `CURSOR.md`) are never rules; the projectors skip them.
- Cline gets a copy of the canonical rule with the managed marker in `.cline/rules/`. Antigravity does not read a canonical rule without front matter and a valid `trigger` (see `host-library/antigravity/guide/rule.md`); that conflict is left to the Antigravity factory stage.
- Nothing in this guide was observed in a live Claude Code session by this repository; the page snapshots are the only evidence.
