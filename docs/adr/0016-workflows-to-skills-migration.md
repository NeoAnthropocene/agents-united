# ADR 0016: Workflows to Skills Complete Cutover & Ecosystem Migration

## Status

**Accepted** (2026-09-15). Implementation per [Plan 014](../plans/014-workflows-to-skills-migration.md) — 69 canonical workflows converted into standard skill directory bundles (`registry/skills/workflow-<name>/SKILL.md`); all 26 bundles in `registry/bundles.json` migrated from `workflows` to `skills`; `src/core/types.ts` marks `workflows` `@deprecated`; silent auto-migration implemented in `UpdateEngine` and `InstallEngine`; dual-benefit `.cline/workflows/` projection preserved for chat slash commands; 4-tier test suite synchronized.

> Records the decision that Agents United conducts a complete canonical cutover from legacy Markdown workflows to the open-standard **Agent Skills** format (`.agents/skills/<name>/SKILL.md`), responding to Google Antigravity's official deprecation and scheduled retirement on November 1, 2026.

## Context

Google Antigravity officially deprecated standalone Markdown workflows (`.agents/workflows/*.md` and `~/.gemini/config/workflows/*.md`) in favor of [Agent Skills](https://antigravity.google/docs/skills), with a hard retirement cutover scheduled for **November 1, 2026** (see [Antigravity Migration Guide](https://antigravity.google/docs/migration/workflows-to-skills.md)).

Workflows were originally single monolithic `.md` files loaded in their entirety into prompt context. In May 2026, Antigravity adopted the open industry standard for Agent Skills ([agentskills.io](https://agentskills.io)). Skills provide fundamental architectural advantages:
1. **Progressive Context Loading**: Metadata (`name` and `description`) is indexed upfront in agent system prompts; the complete runbook body and auxiliary files are loaded on-demand only when triggered, preventing prompt bloat.
2. **Directory Bundling**: Skills are self-contained directory bundles (`<skill-name>/SKILL.md` + optional `scripts/`, `references/`, `examples/`), enabling modular resources.
3. **First-Class Slash Commands**: Typing `/<skill-name>` in the chat prompt invokes the skill directly.
4. **Autonomous Semantic Discovery**: Models autonomously discover and activate skills based on frontmatter trigger descriptions.
5. **Universal Ecosystem Standard**: Conforms to cross-client specifications supported by Antigravity, Cline, Claude Code, and other conforming agent platforms.

In Agents United, 69 legacy workflows were maintained in `registry/workflows/` across 26 bundles. Maintaining legacy workflows in parallel with skills introduces dual-path friction, risks workspace breakage after November 2026, and misses the token efficiency of progressive loading.

## Decision

1. **Full Canonical Cutover**: All 69 legacy workflows in `registry/workflows/*.md` are converted into standard skill directory bundles (`registry/skills/workflow-<name>/SKILL.md`). The legacy `registry/workflows/` directory in the canonical catalog is retired.
2. **Preserve `workflow-` Prefix**: Converted skill directories retain the `workflow-` prefix (e.g. `skills/workflow-implement/SKILL.md`, slash command `/workflow-implement`) to explicitly distinguish procedural execution workflows from domain reference skills. Any filenames containing double hyphens are sanitized to single hyphens (e.g. `workflow-ui-design--color-palette.md` → `workflow-ui-design-color-palette`).
3. **Conformant Frontmatter & Provenance**: Every converted `SKILL.md` is formatted with standard frontmatter:
   ```yaml
   ---
   name: workflow-<slug>
   description: <Rich actionable description explaining execution trigger, prerequisites, and outcome>
   metadata:
     author: "Agents United"
     version: "1.0.0"
     source: "https://github.com/NeoAnthropocene/agents-united"
     license: "MIT"
     icon: "🔄"
   ---
   ```
   The body preserves Mermaid execution flowcharts, tool input prerequisites, phased execution sections, deterministic verification gates, and automated rollback protocols.
4. **Manifest Migration**: In `registry/bundles.json`, all entries previously listed under `workflows: [...]` are moved into `skills: [...]` (with `.md` stripped and double hyphens normalized). The `workflows` array is omitted from bundle definitions.
5. **Silent Auto-Migration in CLI**: When `agents update` is run in an existing workspace, `UpdateEngine` automatically discovers legacy `.agents/workflows/` files and `lockfile.installed.workflows`. It converts/copies them to `.agents/skills/workflow-<slug>/SKILL.md`, deletes legacy `.agents/workflows/` files, prunes the empty directory, moves lockfile entries to `lockfile.installed.skills`, sets `lockfile.installed.workflows = []`, and regenerates projections.
6. **Dual-Benefit Projection for Cline**: Cline continues to receive `.cline/workflows/workflow-<slug>.md` projections so that Cline CLI chat input retains `/<slug>` slash-command autocompletion, while also inheriting the canonical skills natively from `.agents/skills/` and `.agents/plugins/<bundle>/skills/`.
7. **Backward-Compatible Interfaces**: In `src/core/types.ts`, `workflows?: string[]` on `BundleDefinition` and `LockfileManifest` is marked `@deprecated` but preserved so that legacy lockfiles and third-party manifests continue to parse without errors.

## Consequences

- The canonical catalog unifies from 91 skills + 69 workflows into **160 Agent Skills** (91 Domain Skills + 69 Workflow Skills).
- Antigravity 2.0 and CLI interactive sessions benefit from progressive loading: 69 procedural runbooks no longer consume prompt tokens until invoked or semantically triggered.
- Existing user workspaces seamlessly migrate to the modern directory structure on their next `agents update` without requiring manual file conversions or destructive commands.
- Cline users retain `/workflow-<name>` slash commands via `.cline/workflows/` while gaining full native access to all 160 skills from `.agents/skills/`.
- `AGENTS.md` standard index reflects all capabilities under a unified, well-structured inventory.
- Tests, doctor health checks, and documentation (`PROJECT.md`, `README.md`, `CONTEXT.md`) are synchronized to reflect a skills-first architecture.
