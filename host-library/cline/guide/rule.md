---
host: cline
artifact: rule
reviewedAgainst: "4.1.22"
---

# Cline — authoring guide: rules (including conditional rules)

Distilled from the snapshot in `host-library/cline/pages/`. Primary source: [cline-rules](../pages/rule/cline-rules.md). Supporting sources: [config](../pages/settings/config.md), [commands](../pages/command/using-commands.md).

Native output lands in `registry/hosts/cline/rules/` (Plan 032, Phase 8) and installs to `.clinerules/`. The Contract Floor and the persistent rules in `registry/core/` are the source.

## Rules

### Locations and discovery

- **Workspace rules go in `.clinerules/` or `.cline/rules/` at the project root; both are searched when both exist.** They are markdown files, supported by VS Code, Desktop and the CLI, and the Rules panel creates new ones in `.clinerules/`. [Where rules live](../pages/rule/cline-rules.md#where-rules-live)
- **Global rules live in the system Cline Rules directory (`Documents\Cline\Rules` on Windows, `~/Documents/Cline/Rules` on macOS and Linux); Cline also searches `~/.cline/rules` and `~/Cline/Rules`.** [Global rules directory](../pages/rule/cline-rules.md#global-rules-directory)
- **Workspace and global rules are combined, and workspace rules win on a conflict.** Numeric filename prefixes such as `01-coding.md` are optional ordering aids. [Where rules live](../pages/rule/cline-rules.md#where-rules-live)
- **Cline also detects `.cursorrules`, `.windsurfrules`, and `AGENTS.md` (project root and `~/.agents/AGENTS.md`).** All detected rule types appear in the Rules panel, where each can be toggled. [Supported rule types](../pages/rule/cline-rules.md#supported-rule-types)
- **Every rule has a toggle.** A rule can be disabled for a task without deleting the file. [Toggling rules](../pages/rule/cline-rules.md#toggling-rules)

### Writing rules

- **One concern per file, with headers and bullets.** Cline reads rules as context, so structure matters: split by topic (`coding.md`, `testing.md`, `architecture.md`) so each can be toggled on its own. [Writing effective rules](../pages/rule/cline-rules.md#writing-effective-rules), [Best practices](../pages/rule/cline-rules.md#best-practices)
- **Be specific, give the reason when it is not obvious, and point at an example in the codebase.** "Use camelCase for variables" is better than "use descriptive names", and a reference to an existing file beats a description. [Best practices](../pages/rule/cline-rules.md#best-practices)
- **Rules consume context tokens: keep them short and current.** Outdated rules confuse Cline and waste context; link to external documentation instead of pasting a style guide. [Best practices](../pages/rule/cline-rules.md#best-practices)

### Conditional rules

- **Scope a rule to files with YAML frontmatter `paths:`, an array of glob patterns; `paths` is the only supported conditional.** A rule activates when any pattern matches any file in the current context. [Writing conditional rules](../pages/rule/cline-rules.md#writing-conditional-rules), [The paths conditional](../pages/rule/cline-rules.md#the-paths-conditional)
- **A rule with no frontmatter is always active, and `paths: []` means the rule never activates.** Invalid YAML fails open: the rule activates and its raw frontmatter shows, so check the delimiters and quoting. [Behavior details](../pages/rule/cline-rules.md#behavior-details), [Troubleshooting conditional rules](../pages/rule/cline-rules.md#troubleshooting-conditional-rules)
- **Glob syntax: `*` (not `/`), `**` (recursive), `?`, `[abc]` and `{a,b}`.** For example `**/*.test.ts` matches test files anywhere and `packages/{web,api}/**` matches two packages. [The paths conditional](../pages/rule/cline-rules.md#the-paths-conditional)
- **Context for matching is the message, open tabs, visible files, files Cline edited, and pending operations.** Path-based rules fire reliably when the prompt names the file path. [What counts as current context](../pages/rule/cline-rules.md#what-counts-as-current-context)
- **Keep always-on rules in files without frontmatter, and reserve conditional rules for context-specific guidance.** Conditional rules still honour the toggle: a toggled-off rule never activates. [Tips for effective conditional rules](../pages/rule/cline-rules.md#tips-for-effective-conditional-rules), [Combining with rule toggles](../pages/rule/cline-rules.md#combining-with-rule-toggles)

### Creating and trusting rules

- **`/newrule` has Cline create a rule file interactively and saves it to `.clinerules`.** [/newrule](../pages/command/using-commands.md#newrule)
- **Only use rules from sources you trust.** Rules, hooks, skills and plugins steer the agent, and hooks and plugins can execute code. [Security notes](../pages/settings/config.md#security-notes)

## Authoring notes (agents-united, not host behaviour)

- The standing rules (git guardrails, TDD, clean code, multi-agent coordination, quality and accessibility) map to one `.clinerules/<topic>.md` each. Give the testing rule a `paths:` conditional for test files so it costs context only when relevant, and keep the git guardrails unconditional.
- Because rules are advisory context, a rule can never be the only guard for a destructive action. The guard delivery decision is in ADR 0026 (a CLI-only plugin) and the permissions guide.
- The docs say `AGENTS.md` is read natively. The `.agents/` library our Antigravity install writes is not named by the docs, so do not assume Cline reads it.
