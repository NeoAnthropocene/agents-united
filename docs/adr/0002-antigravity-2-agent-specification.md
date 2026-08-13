# 2. Antigravity 2.0 Custom Agent Schema Adoption

We adopt the official Antigravity 2.0 Custom Agent specification (Markdown with YAML frontmatter) as our primary agent definition standard.

Every agent definition will strictly support:
- Execution symmetry flags: `mainAgent: true/false`, `subagent: true/false`
- Scoped safety policies: `permissionMode` (`acceptEdits` | `bypassPermissions` | `ask`), `commandExecutionPolicy` (`auto` | `request-review` | `strict`)
- Tool definitions and model selection (`flash`, `pro`, `inherit`)
- Lifecycle hooks (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse` with matchers)

This replaces the legacy SuperAntigravity prompt format with full first-class Antigravity 2.0 agent definitions, while preserving conversion compatibility for cross-platform targets (Claude, Cursor, Codex).
