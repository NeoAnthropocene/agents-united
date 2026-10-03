---
host: antigravity
artifact: rule
reviewedAgainst: "2.0 2.18.1, CLI 1.2.11, IDE 2.5.5, SDK 0.1.18"
---

# Antigravity — authoring guide: rules (including activation modes)

Distilled from the snapshots in `host-library/antigravity/pages/`. Primary source: [rules](../pages/rule/rules.md). Supporting source: [slash commands](../pages/command/slash-commands.md).

Native output lands in `registry/hosts/antigravity/rules/` (Plan 032, Phase 8) and installs to `.agents/rules/`. The Contract Floor and the persistent rules in `registry/core/` are the source.

## Rules

### Locations and precedence

- **Rules are cumulative, not replacing: Antigravity combines global, workspace and directory rules, and the more specific directory rule wins a conflict.** [Where rules are stored](../pages/rule/rules.md#where-rules-are-stored)
- **In any directory, `AGENTS.md`, `GEMINI.md`, `.agents/AGENTS.md`, `.agents/GEMINI.md` and `.agents/rules/*.md` (and the legacy `.agent/rules/*.md`) are loaded; Antigravity walks up from the file it reads or edits to the workspace root.** [Directory-scoped rules](../pages/rule/rules.md#directory-scoped-rules)
- **Global rules are `~/.gemini/AGENTS.md`, `~/.gemini/GEMINI.md` and their `config/` counterparts (always active, no frontmatter), and modular rules in `~/.gemini/config/rules/*.md` (frontmatter required).** The CLI also reads `~/.gemini/antigravity-cli/rules/*.md` and plugin rules under `~/.gemini/antigravity-cli/plugins/<plugin_name>/rules/`. [Global rules](../pages/rule/rules.md#global-rules), [Managing rules in Antigravity CLI](../pages/rule/rules.md#managing-rules-in-antigravity-cli)
- **Only immediate `.md` children of `.agents/rules/` are scanned; a nested file is ignored unless it is registered in `.agents/rules.json`.** [Where rules are stored](../pages/rule/rules.md#where-rules-are-stored), [Sharing rules across projects](../pages/rule/rules.md#sharing-rules-across-projects)

### Frontmatter and activation

- **`AGENTS.md` and `GEMINI.md` take no frontmatter and are always on; every `.md` file in `rules/` must start with frontmatter declaring a valid `trigger`.** A missing frontmatter, or a trigger such as camelCase `alwaysOn`, makes Antigravity silently discard the rule. [YAML frontmatter and activation modes](../pages/rule/rules.md#yaml-frontmatter-and-activation-modes)
- **The keys are `trigger` (`always_on`, `model_decision`, `glob` or `manual`), `description` (required for `model_decision`) and `globs` (required for `glob`, comma-separated, quoted when it starts with `*`).** [Supported frontmatter keys](../pages/rule/rules.md#supported-frontmatter-keys)
- **`model_decision` injects only the path and description and lets the agent read the rule on demand; `always_on` injects the whole text every turn; `glob` activates on matching files; `manual` loads only when the user `@`-mentions the rule.** [Activation modes](../pages/rule/rules.md#activation-modes)
- **Write a rule for constraints and invariants and a skill for multi-step workflows.** [Rules](../pages/rule/rules.md#rules)

### Limits

- **A rule file over 24,000 bytes (after includes are expanded) is truncated, and all active global and `always_on` rules share a 20,000-token budget; past it the largest are demoted to one-line pointers.** [Size limits and token budgets](../pages/rule/rules.md#size-limits-and-token-budgets)
- **`@[label](path)` inlines a file into the rule (frontmatter stripped); a bare `@filename` only becomes a canonical path reference.** [File includes](../pages/rule/rules.md#file-includes)

## Authoring notes (agents-united, not host behaviour)

- **Choose the trigger per rule on purpose.** Git guardrails and the Contract Floor reminders are `always_on`; detailed domain guides are `model_decision` with a precise `description`, so they cost a pointer instead of their full text; the testing rule can be `glob` on test files. Put pure always-on text in `AGENTS.md` when no frontmatter is wanted.
- **Count the budget.** The 20,000-token aggregate is shared with whatever the user already has, so the native rule set stays small and says nothing twice; a test should fail if an installed rule exceeds 24 KB.
- **The `/learn` command writes to `.antigravity/rules.md`** per the slash-command page, a location the rules page does not list; do not rely on it and do not write there.
- **`@[label](path)` is Antigravity-only syntax.** The same rule text shipped to another host would show it literally, so the portable rule modules in `registry/rules/` must not use it.
- `AGENTS.md` is also read by Cline and other hosts; a root `AGENTS.md` written here is shared, so it carries only host-neutral text.
- **Observed, not documented: `GEMINI.md` is read without frontmatter, in `.agents/` and in `.agents/rules/`, beside the rules** (agy 1.2.16, `observations/2026-10-03-agy-1.2.16-probes.md`). The registry's legacy `GEMINI.md` repeats the six rules, so with the native rules installed the same policy reaches the agent twice; whether the lane should omit it is undecided, and the symlinked copy the default install creates was not tried.
