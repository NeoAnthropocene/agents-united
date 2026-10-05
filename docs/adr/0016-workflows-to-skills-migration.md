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

## Amendment (2026-10-05, Plan 035): a workflow projection names the supporting files of its skill

- **Context**: Decision 6 keeps `.cline/workflows/workflow-<slug>.md`, written from the body of `SKILL.md` alone. A workflow file has no folder of its own, so a relative link in that body to the skill's `examples/` pointed at nothing there. Today that is the six `workflow-agency-*` playbooks (Plan 035, decision D26), each with one `examples/worked-example.md` and the sentence that the playbook works without it; the other 63 workflow skills have `SKILL.md` alone. The skill form was never affected: `.agents/skills/<name>/` and the plugin copy carry every file, and every skill is a `/<name>` command on Cline.
- **Decision** (the maintainer's choice among four options, 2026-10-05; the executor had recommended appending the files instead): when the projector writes a workflow skill, each relative markdown link in the body whose target is a file the install carries next to `SKILL.md` (`examples/`, `references/`, `scripts/`; never the maintainer-only `evals/`) is replaced by the backticked path of that file in the **canonical store**: `.agents/skills/<name>/<file>` from the project root in the project scope, and the absolute `<root>/.agents/skills/<name>/<file>`, with forward slashes, in the global scope. A link to anything else (a URL, an anchor, a file the install does not carry) is left as written. A workflow skill with only `SKILL.md` projects byte-identically to before. `agents doctor` re-renders with the scope and the root the lockfile recorded.
- **Why the canonical copy and not the plugin copy** (`.agents/plugins/<bundle>/skills/<name>/`): two bundles ship the same playbooks (`digital-agency` and `full`) and share one `.cline/workflows/<slug>.md`, so a path that names the bundle would make that file differ with whichever bundle installed it last, and removing one bundle would leave the shared file naming a copy that is gone. The canonical copy lives as long as any owner of the skill, which is how the projection itself lives.
- **Why absolute in the global scope**: Cline's file-read tool resolves a relative path against the working directory of its process and does not expand `~`, and a global workflow is read in every project, so only an absolute path reaches `~/.agents/skills/`. Read from the source of CLI 3.0.68, not run: `host-library/cline/observations/2026-10-05-cli-3.0.68-workflow-paths.md`.
- **Not chosen**: appending the files to the workflow body (self-contained and the same in both scopes, at the cost of loading 1.2 to 1.8 KB every time the projection answers the command); leaving the link (the playbooks do work without it); no longer projecting workflow skills (ADR 0034 and observation S1: on 3.0.68 a same-named skill answered `/workflow-test` before the workflow did, so the projection is the form that runs only where the skill does not; that is one observation of one build, and decision 6 stands).
- **Consequences**: an install made before this change reports `Outdated projection` for the six playbooks until `agents update` (ADR 0017). The projection of a global install names a path under the user's own home directory. Doctor used to render every install as `project`, which made a global Cline install report its coordinator rule as outdated; it now renders with the recorded scope. The skill folder's files are listed once (`ClineProjector.listSkillFiles`) for the plugin copy and for the paths a workflow may name.
- **Not verified**: any live Cline session (a model reading the path a projection names); a session started from a subdirectory of the project, where a root-relative path does not resolve (the coordinator rule's `.agents/skills/<name>/SKILL.md` has the same limit); the IDE surface; builds other than 3.0.68.
