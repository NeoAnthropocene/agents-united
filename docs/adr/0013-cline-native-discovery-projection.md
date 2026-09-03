# ADR 0013: Cline 3.x Native Discovery Projection & Agent Plugin Packaging

## Status

Accepted (2026-09-02). Supersedes [ADR 0012](./0012-cline-native-plugins-projection.md).

> Records the corrected Cline integration architecture, verified against the installed Cline CLI 3.0.61, the `cline/cline` source (commit `c853844`), and docs.cline.bot. Implementation follows this decision.

## Context

ADR 0012 assumed a "Cline 4.0.0+ native Plugin architecture with modular capabilities (`skills`, `tools`, `workflows`)" and packaged bundles as Cline plugins under `.agents/plugins/<bundle>/` with a `package.json` manifest. Runtime verification disproved the premise:

1. **Cline 4.0.0 does not exist.** The latest published npm version is 3.0.61 (verified via `npm view cline versions`).
2. **`cline plugin install` is a code-plugin installer.** It installs `.ts`/`.js` modules (npm packages, git repos, file URLs, or local paths) that export an `AgentPlugin`. The manifest contract is `package.json` -> `cline.plugins[].paths` (verified in `@cline/shared/storage/paths.ts`: `readPluginPackageManifest` / `getManifestPluginEntries`). The manifest generated under ADR 0012 (`capabilities: ["skills","tools","workflows"], skills: ["./skills"]`) has no `paths` key, contains no code entry files, and uses unrecognized capability names - the install is a no-op at best.
3. **The bootstrap instruction fails on Windows.** `cline plugin install .agents/plugins/<bundle>` (injected by `ClineLauncher`) cannot execute under PowerShell's default execution policy (`cline.ps1` is blocked with `UnauthorizedAccess`), and even when executed via `cmd /c` it omits `--cwd` (installing globally instead of project-scoped) and registers nothing usable.

### Verified discovery registry (Cline 3.0.61)

Cross-confirmed against (a) `sdk/packages/shared/src/storage/paths.ts` at commit `c853844`, (b) constant/string analysis of the installed `cline.exe` 3.0.61, and (c) docs.cline.bot:

| Surface | Native locations (workspace scope first) | Notes |
|---|---|---|
| Skills | `.clinerules/skills/`, `.cline/skills/`, **`.agents/skills/`**, `~/.cline/skills/`, `~/.agents/skills/` | `resolveSkillsConfigSearchPaths` - the canonical Agents United store is already natively discovered |
| Rules | `AGENTS.md`, `.clinerules/`, **`.cline/rules/`**, `~/.agents/AGENTS.md`, `~/.cline/rules/`, `~/Documents/Cline/Rules/` | Always-active instructions |
| Workflows | `.clinerules/workflows/`, **`.cline/workflows/`**, `~/.cline/workflows/` | Surfaced as `/<name>` slash commands; no `.agents` lane |
| Configured agents | **`.cline/agents/*.yml`** + `~/.cline/agents/` | YAML frontmatter (`name`, `description`, optional `tools`, `skills`, `providerId`, `modelId`, `maxIterations`) + body = system prompt; each becomes a spawnable `subagent_<name>` tool via `createConfiguredAgentTools` |
| Cline code plugins | `.cline/plugins/`, `~/.cline/plugins/`, `~/Documents/Cline/Plugins/` | `package.json` -> `cline.plugins[].paths` (.js/.ts only) |
| Agent Plugins | **`.agents/plugins/`** + `~/.agents/plugins/` | agent-plugins.org v1.0.0; discriminator `plugin.json` at package root; hard-stop against Cline code-plugin scanning; skill loading not yet consumed by Cline 3.0.61 |

### Hazards identified

- Without `plugin.json`, Cline's code-plugin discovery recursively scans `.agents/plugins/<bundle>/` and imports any `.js`/`.ts` file it finds (e.g., skill helper scripts) as an executable Cline plugin. The `plugin.json` manifest triggers a deliberate hard-stop (`isAgentPluginDirectory`) that prevents this.
- `installer.ts` currently prunes `.cline/` projections as "legacy" (the ADR 0012 migration), deleting what are in fact the correct native discovery locations.

## Decision

1. **Dual-lane packaging under `.agents/plugins/<bundle>/` (Agent Plugin lane):**
   - Emit **`plugin.json`** (agent-plugins.org 1.0.0 schema: `$schema`, `name`, `version`, `description`) at the package root. Remove the invalid `package.json` projection.
   - Keep `skills/<skill>/` inside the package for cross-client portability (decision: keep). Cline 3.0.61 does not consume plugin skills, but the package conforms to the emerging interop standard (Technical Steering Committee: Cursor, OpenAI, Microsoft, Amazon, Vercel).
   - Keep `agents-united/teams/<bundle>.yaml` (vendor-namespace convention consumed by the bootstrap prompt and coordinator rule).
   - Prune obsolete package artifacts: `package.json`, `agents/*.md` role copies, and the `rules/` coordinator rule.
2. **Native discovery projections (Cline activation lane):**
   - Specialist roles -> **`.cline/agents/<role>.yml`**. The frontmatter `name` strips the `subagent-` prefix (decision: strip) so Cline's tool naming (`subagent_` + sanitized name) stays clean (e.g., `subagent_marketing_growth_strategist`); `description` comes from the canonical frontmatter; the body is the rendered role prompt (existing `renderRole` output). Subagents remain invisible on Antigravity (orchestrators invoke them internally), so this rename affects only the Cline projection.
   - Coordinator rule -> **`.cline/rules/agents-united-<bundle>.md`**.
   - Workflows -> **`.cline/workflows/<slug>.md`** with slugified frontmatter `name` (decision: slugify, e.g., `agency-full-campaign`) so slash commands are usable; the human title is preserved in `description` and the body.
   - Skills -> **no additional projection**: the canonical `.agents/skills/` store is already a native Cline skills root.
3. **Bootstrap prompt:** remove the `cline plugin install` instruction entirely (no install step exists anymore); instruct delegation via the configured `subagent_*` tools and the Team Manifest.
4. **Migration:** transition via the existing lockfile-driven obsolete-projection pruning in `InstallEngine`/`UpdateEngine`. Stop pruning `.cline/` paths as "legacy"; prune the superseded `.agents/plugins/<bundle>/{package.json,agents/,rules/}` projections instead.
5. **Windows hardening:** prefer node-wrapper executable resolution; when only `cline.cmd`/`cline.bat` is available, spawn via `cmd /c` (modern Node rejects `.cmd`/`.bat` with `shell: false`).
6. **Host isolation (verified: no cross-host impact):** the canonical `.agents/` store is untouched; `.cline/` projections are additive and Cline-scoped; Antigravity, Claude Code, Cursor, OpenCode, and Codex fanout paths are unchanged. The `subagent-` prefix strip and workflow slugification apply only to the Cline projection renderers.
7. **Scope exclusions:** `.cline/mcp.json` (documented on docs.cline.bot but absent from the 3.0.61 binary) and Agent Plugin skill loading (discovery roots wired, loader not yet consumed) are deferred until Cline ships them.

## Consequences

- Bundles activate in Cline with zero manual steps: skills are auto-discovered from `.agents/skills/`, specialists are spawnable as `subagent_*` tools, the coordinator rule is always active, and workflows are available as slash commands.
- The `.agents/plugins/<bundle>/` package is safe against accidental code-import by Cline's plugin scanner (the `plugin.json` hard-stop) and portable to agent-plugins.org-conforming clients.
- Two copies of skills exist (canonical store + plugin package) - an accepted cost for portability; both are deterministic, refcounted projections tracked in the lockfile and pruned by `agents remove`.
- Role definitions now exist in two formats (canonical `.md` for Antigravity-family hosts, projected `.yml` for Cline configured agents); the Cline renderer must stay aligned with the configured-agent schema (`name`, `description`, optional `tools`, `skills`, `providerId`, `modelId`, `maxIterations`).
- `agents doctor --host cline` gains checks for the new projection set (`.cline/agents/*.yml` schema, `.cline/rules/`, `.cline/workflows/`, `plugin.json` presence).
- Test suites (`cline-projector`, `cline-launcher`, `projection-lifecycle`, `cli-e2e`, `cline-compatibility`) are updated to the new artifact set and bootstrap prompt.
- End-to-end verification runs in a scratch workspace against the installed Cline 3.0.61: skills, `subagent_*` tools, active rules, and workflow commands are enumerated from a live session before the change ships.