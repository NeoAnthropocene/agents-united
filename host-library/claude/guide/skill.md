---
host: claude
artifact: skill
reviewedAgainst: "2.1.285"
---

# Claude Code — authoring guide: skills (including folder anatomy)

Distilled from the snapshots in `host-library/claude/pages/`. Primary source: [skills](../pages/skill/skills.md). Supporting sources: [sub-agents](../pages/agent/sub-agents.md), [plugins-components](../pages/plugin/plugins-components.md), [hooks](../pages/hook/hooks.md).

Native output lands in `registry/hosts/claude/skills/<skill>/`. Adoption is upstream first (Plan 032, "Skill adoption rule"): read `host-library/_upstream/<skill>/` in full, then map its folders onto the Claude anatomy below. Skills that already fit the rules below can pass through byte for byte via `skills.portable.json`.

## Rules

### Anatomy and locations

- **A skill is a directory whose entry point is `SKILL.md`; other files are supporting files.** The documented layout is `SKILL.md` (required overview and navigation), reference or example markdown loaded on demand, and `scripts/` for utilities that are executed rather than loaded. Claude Code has no fixed `examples/` or `resources/` folder; reference every supporting file from `SKILL.md` so Claude knows what it holds and when to load it. [Add supporting files](../pages/skill/skills.md#add-supporting-files)
- **Keep `SKILL.md` under 500 lines and state what to do, not why.** Once loaded, the rendered content stays in context on every later turn, so each line is a recurring token cost; move detail to supporting files. [Add supporting files](../pages/skill/skills.md#add-supporting-files), [Types of skill content](../pages/skill/skills.md#types-of-skill-content)
- **Locations: enterprise (managed settings directory), personal `~/.claude/skills/`, project `.claude/skills/`, nested `<subdir>/.claude/skills/`, `--add-dir` directories, plugin `skills/`, and skills synced from claude.ai.** Project skills load from the launch directory and every parent up to the repository root; nested ones load the first time Claude touches a file below them. [Choose where skills load](../pages/skill/skills.md#where-skills-live), [Load skills in monorepos and subdirectories](../pages/skill/skills.md#discovery-from-parent-and-nested-directories)
- **A skill folder can be a symlink; do not name one `synced` or `anthropic-skills`.** Those names are reserved for skills synced from claude.ai and are skipped. A folder with `.claude-plugin/plugin.json` inside a skill folder loads as a plugin named `<name>@skills-dir` and can bundle agents, hooks and MCP servers. [Choose where skills load](../pages/skill/skills.md#where-skills-live), [Names reserved for synced skills](../pages/skill/skills.md#names-reserved-for-synced-skills)
- **`.claude/commands/*.md` still works but skills supersede it.** A command file takes the same frontmatter except `name` and `paths`; a skill can also carry supporting files. Write new work as skills. [Choose where skills load](../pages/skill/skills.md#where-skills-live), [Commands](../pages/plugin/plugins-components.md#commands)
- **A plugin skill is invoked as `/<plugin>:<dir>`; frontmatter `name` replaces only the last segment.** Instructions that belong to a plugin must be written as a skill, because a `CLAUDE.md` at the plugin root is not loaded. [How a skill gets its command name](../pages/skill/skills.md#how-a-skill-gets-its-command-name), [Skills (plugin)](../pages/plugin/plugins-components.md#skills)

### Frontmatter

- **All frontmatter is optional; `description` is recommended.** Field names are lowercase with hyphens (`disable-model-invocation`, `allowed-tools`) except `when_to_use`, and must match exactly because an unknown field is ignored without an error. Frontmatter is read only when the opening `---` is the first line, and malformed YAML loads the body with no fields set. [Frontmatter reference](../pages/skill/skills.md#frontmatter-reference)
- **Put the key use case first in `description`.** The combined `description` and `when_to_use` text is truncated at 1,536 characters in the listing, and when the listing overflows Claude Code drops descriptions starting with the least-invoked skills. [Frontmatter reference](../pages/skill/skills.md#frontmatter-reference), [Skill descriptions are cut short](../pages/skill/skills.md#skill-descriptions-are-cut-short)
- **Fields Claude Code acts on**: `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`. `metadata` is free-form and ignored by Claude Code; `license` and `compatibility` are accepted from the Agent Skills spec but not acted on. [Frontmatter reference](../pages/skill/skills.md#frontmatter-reference)
- **A skill that must also upload to claude.ai or the Skills API may use only `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools`.** Any other key fails packaging with a hard error, so a portable skill keeps to those six keys (`adaptedFrom` provenance belongs under `metadata`). [Using skill frontmatter outside Claude Code](../pages/skill/skills.md#using-skill-frontmatter-outside-claude-code)
- **Booleans accept `true`/`false`, `yes`/`no`, `on`/`off`, `1`/`0` (v2.1.218+); prefer `true`/`false` for older versions.** [Frontmatter reference](../pages/skill/skills.md#frontmatter-reference)

### Invocation and permissions

- **Control who invokes with two fields.** `disable-model-invocation: true` makes the skill user-only (its description leaves context, it cannot be preloaded into a subagent and it does not run from a scheduled task); `user-invocable: false` makes it Claude-only background knowledge. Use the first for anything with side effects such as deploy or commit. [Control who invokes a skill](../pages/skill/skills.md#control-who-invokes-a-skill)
- **`allowed-tools` pre-approves, it does not restrict.** The grant covers only the turn that invokes the skill, every tool stays callable, and workspace trust does not gate it, so a project skill can grant itself broad access. Use `disallowed-tools` to remove tools from Claude's pool for that turn. [Pre-approve tools for a skill](../pages/skill/skills.md#pre-approve-tools-for-a-skill)
- **Scope Bash pre-approvals to the bundled script.** `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)` plus the same variable in the body lets the skill run its script without a prompt. `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` (v2.1.196+) are substituted in the body and in `allowed-tools` Bash rules. [Available string substitutions](../pages/skill/skills.md#available-string-substitutions)
- **Restrict skill access with permission rules**: `Skill` (all), `Skill(name)` (exact), `Skill(name *)` (prefix); `skillOverrides` in settings sets `on`, `name-only`, `user-invocable-only` or `off` per skill, but does not affect plugin skills. [Restrict Claude's skill access](../pages/skill/skills.md#restrict-claudes-skill-access), [Override skill visibility from settings](../pages/skill/skills.md#override-skill-visibility-from-settings)
- **Skill `hooks` register when the skill is invoked and stay active for the rest of the session.** `once: true` removes a hook after its first successful run and is honoured only in skill frontmatter. [Hooks in skills and agents](../pages/hook/hooks.md#hooks-in-skills-and-agents), [Frontmatter reference](../pages/skill/skills.md#frontmatter-reference)

### Content features

- **Arguments**: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, and named `$name` from the `arguments` list; `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`, and (plugin skills only) `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`. When no placeholder receives an argument, Claude Code appends `ARGUMENTS: <value>`. Escape a literal `$1` as `\$1`. [Available string substitutions](../pages/skill/skills.md#available-string-substitutions), [Pass arguments to skills](../pages/skill/skills.md#pass-arguments-to-skills)
- **Dynamic context injection**: `` !`command` `` (only at line start or after whitespace) and a ` ```! ` fence run before Claude sees the content. Any non-zero exit aborts the whole invocation (exit 1 from search and compare commands is tolerated), commands never prompt, a deny rule aborts, and `disableSkillShellExecution` turns the feature off. Append `|| true` for commands that may exit non-zero. [Inject dynamic context](../pages/skill/skills.md#inject-dynamic-context), [When an injected command fails](../pages/skill/skills.md#when-an-injected-command-fails), [Permission checks on injected commands](../pages/skill/skills.md#permission-checks-on-injected-commands)
- **`context: fork` runs the skill as the prompt of a fresh subagent** (`agent` picks the type). The subagent sees no conversation history, runs in the background unless `background: false`, and a backgrounded fork has only the narrower background tool set. Use it only for skills that carry an explicit task, not for guidelines. [Run skills in a subagent](../pages/skill/skills.md#run-skills-in-a-subagent)
- **A skill preloaded into a subagent is the inverse case**: the subagent's own prompt governs and the skill is reference material. Pick `context: fork` for "skill picks an agent" and the agent's `skills` field for "agent uses skills". [Run skills in a subagent](../pages/skill/skills.md#run-skills-in-a-subagent), [Preload skills into subagents](../pages/agent/sub-agents.md#preload-skills-into-subagents)
- **Skill content persists after invocation and survives compaction only within a budget.** Auto-compaction re-attaches the most recent invocation of each skill, keeping the first 5,000 tokens of each within a shared 25,000-token budget, most recent first. Put standing guidance in the body, and use a hook to enforce anything that must hold deterministically. [Skill content lifecycle](../pages/skill/skills.md#skill-content-lifecycle)
- **`paths` limits automatic activation to matching files** (comma-separated or YAML list, same format as path-specific rules); `shell: powershell` runs injected commands through PowerShell when that tool is enabled. [Frontmatter reference](../pages/skill/skills.md#frontmatter-reference)

### Verification

- **Check a skills directory before shipping.** `claude plugin validate .claude/skills` (v2.1.233+) finds `SKILL.md` files whose frontmatter does not parse; run `claude --debug` to see the parse error. `/skill-doctor` (v2.1.252+) reports context cost and unused skills. [Skill not triggering](../pages/skill/skills.md#skill-not-triggering), [Find unused skills](../pages/skill/skills.md#find-unused-skills)
- **Edits to `SKILL.md` text are picked up mid-session; plugin `hooks/`, `.mcp.json`, `agents/` and `output-styles/` next to a skill need `/reload-plugins`.** [Edit a skill during a session](../pages/skill/skills.md#live-change-detection)

## Authoring notes (agents-united, not host behaviour)

- Map an upstream `examples/` or `resources/` folder to plain supporting markdown or files referenced from `SKILL.md`, and keep `scripts/` as black boxes (Plan 032, step 2 of the skill adoption rule).
- Record `adaptedFrom: {repo, path, sha}` under `metadata`, so a claude.ai-uploadable skill still passes the six-key rule above.
- Skill-bundled scripts run with the user's permissions; the audit gate in `scripts/hostlib/audit.ts` must have passed before a script is restored from `_upstream/`.
