# Host Primitive Matrix

Plan 026. The reference this repo did not have: how **skills, subagents, rules, hooks, and
workflows** behave on each of the three active hosts (**Claude Code**, **Antigravity**, **Cline**
— Cline split into its **CLI Configured Agents** and **extension `use_subagents`** surfaces
where they differ), and what this repo declares when a canonical feature does not survive the
trip 1:1. The machine-readable form of the "canonical feature → host realization" columns below
is `registry/translation-ledger.json` (the Declared-Delta Registry, ADR 0021 decision 9); this
document is its prose companion. `agents doctor --host <h>` prints the same entries for an
installed workspace.

Every divergence above the Contract Floor (ADR 0021 decision 6) carries exactly one disposition
(`mapped | approximated | degraded | unsupported`):

| Disposition | Meaning |
| :--- | :--- |
| `mapped` | The canonical feature has a 1:1 (or functionally equivalent) native realization on this host. |
| `approximated` | A realization exists but its semantics differ in a way worth knowing (different scope, different trigger, different reach). |
| `degraded` | The host has the mechanism, but this repo does not (yet) drive it fully — usually to avoid a cost (context, risk) that isn't worth paying by default. |
| `unsupported` | The host has no realization; the feature is dropped, and its absence is declared rather than silent. |

**Verified against** (docs pull 2026-09-27 unless noted): Claude Code (`code.claude.com/docs`,
`platform.claude.com/docs`) — version floor `claude@2.1.271`+ (the pinned profile file was retired, ADR 0037;
`registry/hosts/claude/profile.json` carries it as `minVersion`); Antigravity (`antigravity.google/docs`) — 2026-08
capability profile; Cline (`docs.cline.bot`, `cline/cline` source) — CLI **3.0.61** (ADR 0013
verification baseline; the `skills` field on Configured Agents was verified separately against
`cline/cline` PR #9502, merged 2026-02-24, shipped by the currently published **3.0.65**). A
host ships monthly; re-verify the relevant row whenever a plan touches that host's projector
(Risk R1).

---

## 1. Skills

The one primitive genuinely portable across all three hosts: a directory with a `SKILL.md`
(YAML frontmatter + markdown body), discovered progressively — metadata (`name`+`description`)
loaded always, the full body loaded only when triggered, and any bundled scripts run with only
their *output* entering context.

| | Claude Code | Antigravity | Cline |
| :--- | :--- | :--- | :--- |
| **Location** | `.claude/skills/<name>/SKILL.md` (project), `~/.claude/skills/` (personal) | `.agents/skills/<name>/SKILL.md` (this repo's canonical store) | `.cline/skills/` (recommended), `.clinerules/skills/`, `.agents/skills/`, `~/.cline/skills/` (global) |
| **Required fields** | `name` (≤64 chars, lowercase letters/digits/hyphens, no "claude"/"anthropic"), `description` | `name` optional | `name` (must **exactly match the directory name**), `description` (≤1024 chars) |
| **Discovery** | Project + personal skill directories scanned at session start; metadata always loaded (~small per-skill cost) | Native `.agents/skills/` scan | `resolveSkillsConfigSearchPaths` (workspace scope first); a **global** skill of the same name **wins over** a project skill |
| **Limits** | Body under ~500 lines is the platform's own best-practice guidance; no hard enforcement | No published hard limit | Body recommended **under ~5k tokens**; oversize content belongs in `docs/`/`templates/`/`scripts/`, referenced from `SKILL.md` |
| **Precedence** | Project overrides nothing (no separate global lane merge documented beyond directory scan order) | N/A (single canonical store) | **Global beats project** on a name collision — the opposite of the usual override direction; author project-specific skills under distinct names to avoid an unwanted global shadow |
| **Per-agent scoping** | Not supported — Claude subagents see the same project skill set as the main thread | Native: the canonical `skills:` list on a role is read directly | **Supported**: a Configured Agent's `skills:` field (`AgentBaseConfigSchema`/`AgentConfigFrontmatterSchema`, `cline/cline` PR #9502) is parsed and used by `SubagentRunner.run()` to **filter** `getAvailableSkills()` down to the named subset before it enters the system prompt — it scopes which skills are *discoverable*, it does **not** preload full skill bodies (same metadata-only objects the unfiltered path already builds) |
| **Canonical → realization** | `degraded` — Claude subagents discover project skills and can invoke them, but the canonical per-agent preload list is not injected (avoids paying its token cost on every spawn) | `mapped` — only Antigravity reads the canonical per-agent list directly | `mapped` (Plan 026 Step 4) — the canonical per-agent list projects into the Configured Agent's `skills:` field |

## 2. Subagents

**Cline has two unrelated surfaces under one name** — keeping them apart matters:

- **Cline CLI Configured Agents** (`.cline/agents/*.yml`): what this repo projects to. Each file
  becomes a spawnable `subagent_<name>` tool. Schema: `name`, `description`, optional `tools`,
  `skills`, `providerId`, `modelId`, `maxIterations` (verified against Cline CLI 3.0.61 source,
  ADR 0013).
- **Cline extension `use_subagents`**: a separate, built-in, **read-only research** helper (no
  user-authored schema at all). It launches parallel agents that can read files, search code,
  list directories, run read-only commands, and use skills — never write files, use the browser,
  reach MCP servers, or spawn nested subagents. Enabled by default; toggled in
  Settings → Features → Agent. Not something this repo projects into or configures.

| | Claude Code | Antigravity | Cline CLI Configured Agents | Cline extension `use_subagents` |
| :--- | :--- | :--- | :--- | :--- |
| **Location** | `.claude/agents/<role>.md` | `.agents/agents/<role>.md` (canonical) | `.cline/agents/<role>.yml`, `~/.cline/agents/` | N/A (built-in, no files) |
| **Required fields** | `name`, `description`; body = system prompt | `name`, `description`, `type`, canonical tool vocabulary | `name`, `description`; optional `tools`, `skills`, `providerId`, `modelId`, `maxIterations` | N/A |
| **Discovery** | Roster is static per install; launched via `--agent <name>` or the `Agent` tool | Native roster read directly | Every `.cline/agents/*.yml` becomes a `subagent_<name>` tool automatically | Always available (if enabled); Cline decides when to use it |
| **Limits** | Pre-defined roster only — no runtime subagent definition | Runtime subagent definition supported (`define_subagent`) | Pre-defined roster only, same as Claude; `maxIterations` hard-caps a run (this repo emits 8) | Cannot write files, browse, reach MCP, or nest — read-only research only |
| **Delegation mechanism** | `Agent` tool (allowlisted on coordinators) | `invoke_subagent(name, prompt)` | Generated `subagent_<name>` tool | The `use_subagents` tool call itself; not a per-role invocation |
| **Hand-off** | `SubagentHandback` (v2.1.271+, auto mode) delivers the report to the spawning conversation | Native reporting | Spawn-and-return; named peer messaging only under the SDK's opt-in Agent Teams (`enableAgentTeams`/`--team-name`) | Returns a synthesized result to the main agent |
| **Canonical → realization** | `mapped` (`invoke_subagent`); `approximated` (`define_subagent`, `manage_subagents` — pre-defined roster) | `mapped` (native origin of the vocabulary) | `mapped` (`invoke_subagent` → `subagent_<name>`); `approximated` (`define_subagent`, `manage_subagents`, `send_message` — pre-defined roster, Agent Teams is opt-in) | Not a projection target (no user schema to project into) |

**Antigravity delegation — reachability finding and registration rule (Plan 029 C8/C9):**

- **`invoke_subagent(name, prompt)` is the documented delegation mechanism**, and the canonical
  vocabulary maps to it natively (`mapped` in the row above).
- **Whether an Antigravity orchestrator can `invoke_subagent` a *workspace* agent living in
  `.agents/agents/` by name is PENDING LIVE VERIFICATION.** Step 0(d) is unanswered, so this matrix
  records the claim as unverified instead of asserting it: a field test observed the orchestrator
  registering new subagents at runtime rather than reaching the installed roster, but the cause
  (name resolution, discovery path, or orchestrator wording) was never isolated and no live re-test
  has been run. Nothing here should be read as confirming by-name reachability.
- **When runtime registration IS required (`define_subagent`), the canonical role body must be
  passed VERBATIM — never a summary.** The registration's system prompt gets the role's full
  canonical body (Role, Skill Consultation Map, Protocol, Safety, Report format) byte-for-byte, and
  tool permissions are set from the role's own `tools:` list. Rationale (owner field test): the
  runtime-created copy dropped the role's managed hook equivalent and compressed the body, which
  lost the **Safety** and **Skill Consultation Map** sections — exactly the guardrails the role was
  installed to carry, silently removed by summarization. Every orchestrator's delegation prose
  states this rule, so it holds whether or not the by-name path turns out to work.

## 3. Rules

Always-active instructions, scoped by glob or by being always-on, distinct from skills'
on-demand loading.

| | Claude Code | Antigravity | Cline |
| :--- | :--- | :--- | :--- |
| **Location** | `.claude/rules/<name>.md`, referenced from an agent's `rules:` frontmatter; `CLAUDE.md`/`CLAUDE.local.md` at the project root | `.agents/rules/` (canonical), agent-referenced via `rules:` | `AGENTS.md`, `.clinerules/`, `.cline/rules/` (this repo's projection target), `~/.agents/AGENTS.md`, `~/.cline/rules/`, `~/Documents/Cline/Rules/` |
| **Required fields** | Markdown body; no required frontmatter | Markdown body, optional glob-scoping frontmatter | Markdown body |
| **Discovery** | Loaded via the referencing agent's `rules:` list | Loaded via the referencing agent's `rules:` list; glob-scoped rules activate only for matching files | **Always active** — empirically confirmed (ADR 0013, 2026-09-18 canary probe): two canary files in `.cline/rules/` both appeared in a live session's `inputTokens` delta with zero tool calls |
| **Limits** | No published hard limit | **24 KB per rule file**; **~20k-token aggregate** for all active rules; an oversize rule is demoted to a pointer file rather than inlined in full | No published hard limit |
| **Precedence** | Project rules only (no documented global/project merge conflict for rules specifically) | Glob-scoped rules only apply where their glob matches; budget enforcement can silently truncate an over-budget rule set | Project (`.cline/rules/`) and global (`~/.cline/rules/`) both load; no documented single-name override rule (unlike skills) |
| **Canonical → realization** | `mapped` — agent-referenced rules project into the lean `.claude/rules/` lane | `mapped` — native, subject to the 24 KB/~20k-token budget (a native constraint, not a translation loss) | `mapped` — projects into `.cline/rules/agents-united-<bundle>.md`, empirically verified to reach a live session |

## 4. Hooks

The primitive with the widest real gap: two file-based hook systems that share no schema, and
one host with no end-user hook file at all.

| | Claude Code | Antigravity | Cline |
| :--- | :--- | :--- | :--- |
| **Location** | `.claude/settings.json` (managed entries), or an agent's frontmatter `hooks:` (advisory prose only) | `.agents/hooks.json` | **None** — no end-user hook file exists |
| **Events** | `PreToolUse`, `PostToolUse`, `Stop`, and others (Claude Code's own event set) | `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop` | N/A |
| **Discovery** | `.claude/settings.json` entries are read by the Claude Code runtime directly | `.agents/hooks.json` read directly | N/A |
| **Limits** | Only a JSON-schema-conformant matcher/command hook actually fires; canonical prose hooks are advisory text, not wired | No published hard limit | N/A |
| **This repo's realization** | The **one enforced hook every role carries** is the managed `PreToolUse` guard (Plan 022 H5 / Plan 023 A0) that blocks `git push --force`, `.env` writes, and `vercel --prod`. All other canonical prose hooks are advisory only — the prompt says so explicitly ("this host does not fire them") | Canonical prose hooks pass straight through — Antigravity's schema is this feature's origin | Hooks exist only as an **SDK/CLI plugin capability** (code plugins under `.cline/plugins/` — `.js`/`.ts` modules, not a YAML/markdown surface); the repo strips `hooks:` from every Cline projection (Plan 015 note) |
| **Canonical → realization** | `unsupported` — Antigravity's hook schema does not translate; the one exception (the managed guard) is enforced independently of the canonical field | `mapped` — native origin schema | `unsupported` — no end-user hook file exists on this host at all |

## 5. Workflows

Two unrelated meanings share the word "workflow" across these hosts, and this repo has already
resolved the ambiguity for its own catalog.

| | Claude Code | Antigravity | Cline |
| :--- | :--- | :--- | :--- |
| **What it means here** | **JavaScript orchestration scripts** — a completely different mechanism (see the Workflow tool script API), unrelated to markdown macros | Markdown slash-command macros under `ide/workflows` | Markdown slash-command macros, projected to `.cline/workflows/<slug>.md` |
| **Status** | Not a projection target for this repo's catalog at all | **Deprecated in favour of skills from 2026-11-01** (docs pull 2026-09-27) | Active; a workflow surfaces as a `/<slug>` slash command |
| **This repo's canonical form** | N/A | `workflow-*` skills (ADR 0016 — this repo already converted its own workflows to skills, ahead of Antigravity's own deprecation) | `workflow-*` skills project into `.cline/workflows/<slug>.md`, with a slugified frontmatter `name` and the human title preserved in `description` |
| **Canonical → realization** | `unsupported` — Claude Code's own "workflows" are an unrelated JS orchestration mechanism, not a projection target | `degraded` — the native macro mechanism still runs today but is being sunset; `workflow-*` skills are the durable form this repo authors against | `mapped` — canonical `workflow-*` skills project 1:1 into a slash command |

---

## Notes on fields not covered above

- **`permissionMode`** (Claude's own `default`/`acceptEdits`/`bypassPermissions`/`plan` concept,
  borrowed into the canonical vocabulary) and **`commandExecutionPolicy`** (Antigravity's native
  shell-execution policy) are handled by this repo's **declarative overlay** mechanism
  (`src/core/overlays.ts`, Plan 017 decision 3) rather than the Declared-Delta Registry — they
  are per-host authored fields, not translated ones. `commandExecutionPolicy` itself has no
  Cline frontmatter equivalent (Cline governs command execution workspace-wide via
  `CLINE_COMMAND_PERMISSIONS`, not a per-role field) and is declared `unsupported` for Cline in
  the ledger for that reason.
- **`mcpServers`**: `mapped` on Claude since Plan 029 A2 — a canonical `- name: <server>` entry now
  projects into the subagent's `mcpServers:` field as a name reference (never an inline descriptor),
  and the matching grant lands in `tools:` (`mcp__<server>` for a writable role, pinned exact
  read-only tool names like `mcp__github__search_code` for a `plan` role; a server with no pinned
  read-only tool gets no grant at all — fail closed). The wiring itself stays host-configured via
  the MCP location registry, and `agents doctor --host claude` prints the host's own add command for
  each declared-but-unconfigured server. `unsupported` on Cline (`.cline/mcp.json` is documented but
  was absent from the verified 3.0.61 binary — ADR 0013 decision 7, a scope exclusion pending Cline
  shipping it); `mapped` on Antigravity (native origin schema).

## Related documents

- `registry/translation-ledger.json` — the machine-readable Declared-Delta Registry this
  document summarizes; `agents doctor --host <claude|antigravity|cline>` reads it directly.
- `docs/skill-intake.md` — the procedure for bringing a new (including third-party) skill into
  the catalog compliant with every limit in the table above.
- `docs/adr/0021-semantic-core-and-per-host-native-realization.md` — the Contract Floor /
  Declared Delta framework this matrix documents concretely.
- `docs/adr/0023-host-primitive-matrix-and-skill-intake.md` — records skills as the primary
  portable unit and every non-portable feature as a required declaration (Plan 026).
- ADR 0008 (universal host projection), 0009 (host conformance targets), 0013 (Cline native
  discovery projection), 0018 (Claude Code projection architecture) — the per-host verification
  this matrix builds on.
