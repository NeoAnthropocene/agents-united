# ADR 0008: Universal Host Projection Architecture

## Status
Accepted

> Accepted 2026-08-14 alongside the final implementation of this decision — the projection layer,
> `--fanout` flag, `projectedTo` lockfile tracking, managed projection markers, and the AGENTS.md
> bridge shipped per plan 007 (Milestones 1–5).

## Context
The wizard's "Universal Multi-Agent (.agents/)" option and the CLI default (`-t agents`) write plain asset
files into `./.agents/{agents,skills,workflows,rules}/`, but only Antigravity's runtime actually loads that
directory. Every other runtime reads its *own* directory with its *own* frontmatter dialect:
1. **Antigravity**: `.agents/`, Antigravity frontmatter (canonical here).
2. **Claude Code**: `.claude/agents/`, `name`/`description`/`tools`/`model`.
3. **Cursor**: `.cursor/agents/` (also `.cursor/rules/*.mdc`), similar with its own tool names.
4. **Cline**: `.cline/` (agents/skills/rules), an own subset not using Antigravity keys.
5. **OpenCode**: `.opencode/agent/`, an own subset.
6. **Codex & AGENTS.md readers**: root `AGENTS.md`, a markdown index with no subagent loader.

Users who choose "Universal" get files no runtime other than Antigravity can use. Additionally, the host set
is a closed union of 4 hosts, so Cline/OpenCode/Codex cannot even be targeted today.

Accepted limitations that must be stated in generated file headers:
- Antigravity-only frontmatter keys (`hooks:`, `permissionMode:`, `commandExecutionPolicy:` `mainAgent:`,
  `subagent:`, `type:`) do **not** execute in other runtimes. Projected orchestrator agents degrade
  gracefully to "system prompt + tool list" subagents; behavior is not faked.
- `invoke_subagent` cross-agent orchestration only works in Antigravity; projection drops the tool and
  reports a warning in the projection result.
- Projections are **always copies, never symlinks** (translated content ≠ source content).

## Decision
1. **Canonical store remains `.agents/`**: `.agents/` stays the single source of truth the lockfile tracks;
   the install path and canonical format are unchanged.
2. **Copy-only, stamp-managed projections**: A projection layer fans **translated copies** into each selected
   runtime's native loader directory. Every projected file is a copy stamped with a managed marker (first
   line of the file body, after frontmatter):
   ```html
   <!-- managed-by: agents-united | profile: claude-code | canonical: .agents/agents/<file> | do not edit -->
   ```
   Projections are always copies, never symlinks.
3. **Lockfile tracking via `projectedTo`**: Projections are recorded per canonical asset in the lockfile as
   `files["agents\\x.md"].projectedTo` — a list of paths relative to the workspace root (e.g.
   `.claude/agents/x.md`). This keeps `uninstall` / `update` / `doctor` deterministic. `projectedTo` is
   optional, so pre-existing lockfile shapes remain valid.
4. **Antigravity-only keys degrade, not fake**: Antigravity-only frontmatter keys do not execute in other
   runtimes; projections degrade gracefully to "system prompt + tool list" subagents instead of pretending
   the behavior exists.

## Consequences
- Users choosing "Universal" get files usable by Claude, Cursor, Cline, OpenCode, and AGENTS.md readers,
  not just Antigravity.
- `.agents/` remains the canonical, human-authored store; projections are derived artifacts that can be
  regenerated and removed deterministically via the lockfile.
- Deterministic lifecycle: every projection is tracked in `projectedTo`, so uninstall/update/doctor remove
  or rewrite exactly the managed files and never touch unmanaged/user-modified ones (verified via the
  managed marker).
- Antigravity-only behavior (hooks, permissionMode, invoke_subagent orchestration) is not emulated outside
  Antigravity — documented degradation replaces scope creep into "make hooks work everywhere".
- Projection format changes require touching only the relevant profile in the projection layer, not the
  canonical store.
---

## Addendum 2026-08-14 — Naming: One library, every assistant

The label "Universal Multi-Agent (.agents/)" caused real user confusion: a user picked it, ran
`agents update --all`, and was surprised that no `.cline/` folder appeared. The word "universal"
overpromised — it suggested the bundle would work in every assistant immediately, when in fact
`.agents/` runs natively **only on Antigravity**. Universality only materializes once the projection
layer produces translated copies for the other assistants.

Ecosystem evidence made this clear:
- `.agents/` is **Antigravity's** workspace convention (rules/, workflows/, skills/ subdirectories).
- The genuinely cross-vendor standard is **AGENTS.md** (agentics.md / Agentic AI Foundation, a Linux
  Foundation project; adopted by Codex, Cursor, Jules, Aider, OpenCode, Zed, Windsurf, RooCode, Gemini
  CLI, GitHub Copilot coding agent, and more). Our `codex` fan-out writes exactly this root index.
- Cline's project agents load from `.cline/agents/`; Claude Code from `.claude/agents/`; Cursor from
  `.cursor/agents/`; OpenCode from `.opencode/agent/` — each a projection target, none a canonical store.

Adopted wording to correct the mental model (used in CLI, wizard, and docs):
- **Main library** = the canonical store (`.agents/`) — the one folder you edit.
- **Translated copies** = projections — machine-managed files an assistant reads in its own folder.
- **Kept in sync** = `agents update` regenerates the copies; `--fanout` is persisted in the lockfile so the
  choice is remembered.
- The TUI now asks "Which AI assistants will you work with?", automatically adds the main library when
  another assistant is chosen, and generates translated copies for each — so the misunderstanding cannot
  recur. An install/update tip tells the user how to add an assistant later (e.g.
  `agents update <bundle> --fanout cline`).

---

## Addendum 2026-08-17 — Cline Compound Projection and Runtime Activation

Evidence gathered from Cline CLI 3.0.55 and public documentation clarified that stock Cline does not
load arbitrary custom agent definitions from `.cline/agents/*.md` into an interactive agent picker
without private SDK extensions (e.g. Agent Squad).

### Decisions:
1. **Cline Compound Projection**: Instead of generating Claude-style `tools: [...]` frontmatter into
   `.cline/agents/*.md`, Cline projections generate a compound artifact set:
   - **Role definitions** (`.cline/agents/*.md`) with clean metadata, no synthetic tool arrays, and a
     runtime compatibility preamble.
   - **Skills** (`.cline/skills/<name>/**`) with valid frontmatter and byte-identical resources.
   - **Coordinator Rule** (`.cline/rules/agents-united-<bundle>.md`) providing concise, always-on activation context.
   - **Team Manifest** (`.cline/agents-united/teams/<bundle>.yaml`) describing roles, skills, and activation strategies.
2. **Explicit Runtime Activation (`agents start`)**: Add direct runtime launching via `agents start <bundle>`,
   executing safe capability probing (detecting persistent Agent Teams support via `--team-name`), selecting
   the optimal execution strategy (`named-team`, `adaptive-session`, or `single-orchestrator`), and bootstrapping
   Cline via argument arrays without shell interpolation.