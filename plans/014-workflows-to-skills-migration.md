# Plan 014: Workflows to Skills Complete Cutover & Ecosystem Migration

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8215668..HEAD -- registry/ src/ tests/ docs/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **State**: DONE (Verified across 32 test files, 160 skills)
- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/013-planner-orchestrator-mode-for-domain-bundles.md
- **Category**: migration
- **Planned at**: commit `8215668`, 2026-09-15

## Why this matters

Google Antigravity officially deprecated standalone Markdown workflows (`.agents/workflows/*.md` and `~/.gemini/config/workflows/*.md`), setting an ecosystem-wide retirement cutover date of **November 1, 2026** (see [Antigravity Migration Guide](https://antigravity.google/docs/migration/workflows-to-skills.md)). The modern standard across Google Antigravity and the open agent ecosystem ([agentskills.io](https://agentskills.io)) is **Agent Skills** (`.agents/skills/<name>/SKILL.md`). 

Agent Skills provide critical architectural upgrades:
1. **Progressive Context Loading**: Metadata (`name`, `description`) is loaded into context upfront, while the complete runbook body loads on demand, eliminating prompt bloat.
2. **Directory Bundling**: Skills bundle auxiliary assets (`scripts/`, `references/`, `examples/`) co-located with `SKILL.md`.
3. **First-Class Slash Commands**: Typing `/<skill-name>` in Antigravity or Cline triggers the skill directly.
4. **Autonomous Semantic Discovery**: Antigravity agents autonomously discover and invoke relevant skills based on frontmatter trigger descriptions.

Agents United currently maintains 69 legacy workflow files in `registry/workflows/` across 26 bundles. Migrating all 69 workflows into standard skill directory bundles (`registry/skills/workflow-<name>/SKILL.md`), updating `registry/bundles.json`, updating the CLI engine with silent auto-migration on `agents update`, and projecting into Cline and `AGENTS.md` guarantees seamless long-term stability and compatibility for all users ahead of the November 2026 retirement.

## Current state

- **Registry Workflows Directory**: `registry/workflows/` contains 69 standalone `.md` files (e.g. `workflow-implement.md`, `workflow-test.md`, `workflow-deploy-staging.md`).
- **Registry Bundles Manifest** (`registry/bundles.json`): Each of the 26 bundles declares a `workflows: [...]` array:
  ```json
  "software-engineering": {
    "name": "software-engineering",
    "orchestrator": "orchestrator-engineering.md",
    "agents": ["subagent-backend-architect.md", "subagent-frontend-architect.md", "subagent-code-reviewer.md", "subagent-repo-index.md"],
    "workflows": [
      "workflow-implement.md",
      "workflow-test.md",
      "workflow-review.md",
      "workflow-build.md",
      "workflow-cleanup.md",
      "workflow-git.md"
    ],
    "skills": ["test-driven-development", "systematic-debugging", ...]
  }
  ```
- **Type Interfaces** (`src/core/types.ts:69-90`):
  ```typescript
  export interface BundleDefinition {
    name: string;
    ...
    workflows?: string[];
    skills?: string[];
    ...
  }
  ```
- **Host Adapter** (`src/core/adapter.ts:32-40`):
  ```typescript
  public static getSubPaths(targetDir: string) {
    return {
      agentsDir: path.join(targetDir, 'agents'),
      skillsDir: path.join(targetDir, 'skills'),
      workflowsDir: path.join(targetDir, 'workflows'),
      rulesDir: path.join(targetDir, 'rules'),
      lockfile: path.join(targetDir, 'agents-united.json'),
    };
  }
  ```
- **Cline Projector** (`src/core/cline-projector.ts:424-440`):
  Renders `.cline/workflows/<slug>.md` from `registry/workflows/` files.
- **Doctor Engine** (`src/core/doctor.ts:39, 176`):
  Reports `workflowsCount` from `lockfile.installed.workflows`.

## Design Decisions (from Socratic Grilling)

1. **Full Canonical Cutover**: All 69 workflows are migrated into `registry/skills/workflow-<name>/SKILL.md`. The directory `registry/workflows/` is retired from canonical bundle declarations in `registry/bundles.json`.
2. **Preserve `workflow-` Prefix**: To clearly distinguish procedural execution runbooks from domain reference skills in catalog listings and slash commands, the directory name retains the `workflow-` prefix (e.g. `skills/workflow-implement/SKILL.md`, invoked as `/workflow-implement`). Filenames with `--` are sanitized to single `-` (e.g. `workflow-ui-design--color-palette.md` → `workflow-ui-design-color-palette`).
3. **Conformant Agent Skills Frontmatter**: Every converted `SKILL.md` has:
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
   The body preserves Mermaid execution flowcharts, tool input prerequisites, phased execution sections, and deterministic verification gates.
4. **Silent Auto-Migration on `agents update`**: When `agents update` is run in an existing workspace, it detects legacy `.agents/workflows/` files and `lockfile.installed.workflows`. It automatically converts them to `.agents/skills/workflow-<slug>/SKILL.md`, cleans up old `.agents/workflows/` files, updates `lockfile.installed.skills`, sets `lockfile.installed.workflows = []`, and regenerates projections.
5. **Dual-Benefit Projection for Cline**: Cline continues to receive `.cline/workflows/workflow-<slug>.md` slash-command projections so that Cline CLI chat input retains `/<name>` autocompletion, while also inheriting the canonical skills in `.agents/skills/` and `.agents/plugins/<bundle>/skills/`.
6. **Backward-Compatible Interfaces**: In `src/core/types.ts`, `workflows?: string[]` on `BundleDefinition` and `LockfileManifest` is marked `@deprecated` but preserved so that legacy lockfiles and third-party manifests continue to parse without breaking runtime errors.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `npm run build` | exit 0, outputs `dist/` |
| Typecheck | `npm run typecheck` | exit 0, 0 errors |
| Test suite | `npm test` | exit 0, all tests pass |
| Targeted tests | `npx vitest run tests/<file>.test.ts` | exit 0, all pass |

## Scope

**In scope**:
- `docs/adr/0016-workflows-to-skills-migration.md` (new ADR)
- `registry/skills/workflow-*/SKILL.md` (69 new skill directory bundles)
- `registry/workflows/` (safely remove after migration into `registry/skills/`)
- `registry/bundles.json` (move all `workflows: [...]` to `skills: [...]`)
- `src/core/types.ts` (deprecate `workflows` in `BundleDefinition`, `LockfileManifest`)
- `src/core/registry.ts` (resolve `workflow-*` skills, search index update)
- `src/core/installer.ts` (install converted skills, handle legacy cleanup)
- `src/core/updater.ts` (silent auto-migration of existing workspace workflows to skills)
- `src/core/uninstaller.ts` (safe removal of migrated skills)
- `src/core/doctor.ts` (audit skills and warn on leftover legacy workflow files)
- `src/core/cline-projector.ts` (dual-benefit projection with `workflow-` prefix)
- `src/core/projector.ts` (`AGENTS.md` bridge indexing)
- `src/cli.ts` (terminal tree display, search, doctor output)
- `tests/` (update Tier 1-4 tests to reflect skills-first structure)
- `PROJECT.md`, `README.md`, `CONTEXT.md` (documentation updates)

**Out of scope**:
- Changing the content, logic, or Mermaid flowcharts of the 69 workflows (they are converted verbatim into `SKILL.md` bodies).
- Touching existing 91 domain skills or 59 agent definitions outside of bundle membership.
- Changing git-guardrails or protected branch policies.

## Git workflow

- Branch: `feat/workflows-to-skills-migration`
- Commit style: Conventional Commits (`feat: migrate workflows to standard agent skills (ADR 0016)`)
- Work tested against `origin/dev`.

---

## Steps

### Phase 1: ADR 0016 & Canonical Catalog Conversion

#### Step 1.1: Author ADR 0016
Create `docs/adr/0016-workflows-to-skills-migration.md` documenting Context (Antigravity Nov 1, 2026 deprecation, open Agent Skills standard), Decision (Full cutover, `workflow-` naming, silent auto-migration, dual-benefit Cline projection), and Consequences.

**Verify**: File exists and matches ADR template format in `docs/adr/`.

#### Step 1.2: Convert 69 Workflows into `registry/skills/workflow-*/SKILL.md`
For each of the 69 files in `registry/workflows/*.md`:
1. Derive directory name: replace `.md` with empty string, sanitize `--` to `-` (e.g. `workflow-deploy-staging.md` → `workflow-deploy-staging`, `workflow-ui-design--color-palette.md` → `workflow-ui-design-color-palette`).
2. Create directory `registry/skills/<dir_name>/`.
3. Construct `SKILL.md` with:
   - YAML frontmatter:
     ```yaml
     ---
     name: <dir_name>
     description: <Description extracted from source workflow, ensuring it explains when to use the skill>
     metadata:
       author: "Agents United"
       version: "1.0.0"
       source: "https://github.com/NeoAnthropocene/agents-united"
       license: "MIT"
       icon: "🔄"
     ---
     ```
   - Body: The markdown body from the source workflow (title, Overview & Scope, Mermaid flowchart, tool inputs, phases, verification gates).
4. Remove the source file from `registry/workflows/`. Once all 69 files are migrated, remove the `registry/workflows/` directory.

**Verify**:
`node -e "const fs = require('fs'); const skills = fs.readdirSync('registry/skills').filter(s => s.startsWith('workflow-')); console.log('Converted workflow skills count:', skills.length);"`
→ Expected: `Converted workflow skills count: 69`
Total skills count in `registry/skills`: 91 + 69 = 160 skills.

#### Step 1.3: Update `registry/bundles.json`
For every bundle in `registry/bundles.json`:
1. Take every item in `bundle.workflows` (e.g. `"workflow-implement.md"`), sanitize name (strip `.md`, replace `--` with `-`).
2. Append these sanitized names to `bundle.skills` (deduplicated).
3. Remove the `workflows` key from the bundle definition.

**Verify**:
`node -e "const b = require('./registry/bundles.json'); const wCount = Object.values(b.bundles).reduce((acc, x) => acc + (x.workflows?.length || 0), 0); console.log('Remaining bundle workflows:', wCount);"`
→ Expected: `Remaining bundle workflows: 0`

---

### Phase 2: Core Engine & Type System Update (TDD Tier 1 & Tier 2)

#### Step 2.1: Update TypeScript Types (`src/core/types.ts`)
1. In `BundleDefinition`:
   ```typescript
   /** @deprecated Workflows have been unified into `skills` (ADR 0016). Preserved for backward compatibility. */
   workflows?: string[];
   skills?: string[];
   ```
2. In `LockfileManifest`:
   ```typescript
   installed: {
     bundles: string[];
     agents: string[];
     skills: string[];
     /** @deprecated Legacy workflow tracking. Workflows are now tracked under `skills`. */
     workflows?: string[];
   };
   ```
3. In `ResolvedAssets` and `SearchResults`: Keep `workflows: string[]` defaulting to `[]` for interface stability.

**Verify**: `npm run typecheck` exits 0.

#### Step 2.2: Update `RegistryResolver` (`src/core/registry.ts`)
1. In `resolve(identifier)`:
   - When resolving by bundle name, bundle assets are collected from `bundle.skills`. `resolved.skills` includes all skills and workflow-skills. `resolved.workflows` is empty.
   - If an identifier starts with `workflow-` (e.g. `workflow-implement` or `workflow-implement.md`), resolve to `skills/workflow-implement`.
2. In `find(query, options)`:
   - Searching for type `workflow` or query matching `workflow-*` searches `registry/skills` matching `workflow-*`.

**Verify**:
Write a test in `tests/registry.test.ts` asserting that `resolve('workflow-implement')` and `resolve('software-engineering')` return the skill in `resolved.skills`.
Run: `npx vitest run tests/registry.test.ts` → passes.

#### Step 2.3: Silent Auto-Migration in `UpdateEngine` and `InstallEngine` (`src/core/updater.ts`, `src/core/installer.ts`)
1. In `InstallEngine` and `UpdateEngine`:
   - Before applying updates or installing, inspect the target workspace `subPaths.workflowsDir` (`.agents/workflows/`) and `lockfile.installed.workflows`.
   - If legacy workflow files exist:
     - For each `.agents/workflows/<file>.md`:
       - Sanitize name to `workflow-<name>`.
       - If `.agents/skills/workflow-<name>/SKILL.md` does not already exist, copy/create it.
       - Remove `.agents/workflows/<file>.md`.
     - Prune empty `.agents/workflows/` directory.
     - Move all entries from `lockfile.installed.workflows` into `lockfile.installed.skills` (deduplicated).
     - Set `lockfile.installed.workflows = []` (or delete legacy file records).
2. Ensure `deployFile` handles `skills` directories cleanly.

**Verify**:
Write integration test in `tests/updater.test.ts` verifying that updating a workspace with mock legacy workflows seamlessly migrates them to `.agents/skills/workflow-*`, clears `lockfile.installed.workflows`, and removes `.agents/workflows/`.
Run: `npx vitest run tests/updater.test.ts` → passes.

#### Step 2.4: Update Host Projections (`src/core/cline-projector.ts`, `src/core/projector.ts`)
1. In `ClineProjector.planCompoundProjection`:
   - All workflow skills (skills whose names start with `workflow-`) are projected into:
     - `.agents/plugins/<bundle>/skills/<skill>/` (portable agent plugin standard)
     - `.cline/workflows/<name>.md` with `name` retaining `workflow-<slug>` (so Cline users retain `/workflow-<slug>` slash commands in chat input).
2. In `HostProjector.buildAgentsMdIndex`:
   - Group skills and workflows cleanly or list workflow-skills under an execution section in `AGENTS.md`.

**Verify**:
Run: `npx vitest run tests/cline-projector.test.ts` and `npx vitest run tests/projector.test.ts` → passes.

#### Step 2.5: Update Doctor Diagnostics (`src/core/doctor.ts`)
1. `DoctorEngine.runDoctor`:
   - Count skills in `lockfile.installed.skills`.
   - If any remaining `.agents/workflows/*.md` files are found on disk, emit a warning:
     `"Detected legacy workflows in .agents/workflows/. Run 'agents update' to automatically migrate them to modern skills."`
   - Total skills validated now includes workflow-skills.

**Verify**:
Run: `npx vitest run tests/doctor.test.ts` → passes.

---

### Phase 3: CLI Presentation, 4-Tier Test Suite & Documentation

#### Step 3.1: Update CLI Commands (`src/cli.ts`)
1. `agents list`:
   - In the Unicode tree view, display skills categorized or with their icon (e.g. 🔄 for workflow skills).
   - Update summary counts: 59 Agents, 160 Skills (91 Domain Skills + 69 Workflow Skills).
2. `agents find`:
   - Searching for `workflow` or `skill` properly highlights workflow-skills.

**Verify**:
`npm run build && node dist/cli.js list` → displays updated tree cleanly with 160 skills.

#### Step 3.2: Update 4-Tier Test Suite
Update test counts across the test suite:
- `tests/tier1-schema.test.ts`: Validate frontmatter of all 160 skills (author, version, license, description, icon).
- `tests/tier2-registry.test.ts`: Validate bundle resolutions across all 26 bundles.
- `tests/tier3-pairwise.test.ts`: Verify projection fanout and multi-host installations.
- `tests/tier4-stress.test.ts` / `tests/e2e-domain-conformance.test.ts`: Assert 0 unmigrated workflows and 100% clean test execution.

**Verify**: `npm test` → all test files pass (100% green).

#### Step 3.3: Synchronize Ecosystem Documentation
Update documentation to reflect the full migration:
1. `PROJECT.md`: Update feature inventory, catalog counts (59 agents, 160 skills), ADR table (add ADR 0016), and architecture descriptions.
2. `README.md`: Update counts, quickstart descriptions, and Antigravity skills references.
3. `CONTEXT.md`: Update domain terminology for Workflows and Skills (noting Workflows migrated to Workflow Skills).

**Verify**: `git diff --stat` confirms all docs synchronized with zero broken links.

---

## Test plan

- **Tier 1**: Frontmatter schema test verifying all 160 skills in `registry/skills/` have valid YAML frontmatter (`name`, `description`, `metadata.author`, `metadata.version`, `metadata.license`).
- **Tier 2**: Registry resolver test confirming all 26 bundles resolve their full skill suites without missing files.
- **Tier 3**: Cline and Codex projection tests asserting `.cline/workflows/workflow-*.md` and `AGENTS.md` are accurately generated.
- **Tier 4**: Migration verification test setting up a temporary workspace with legacy `.agents/workflows/` files and verifying that `agents update` migrates them silently, updates `agents-united.json`, and prunes `.agents/workflows/`.

## Done criteria

- [ ] `docs/adr/0016-workflows-to-skills-migration.md` written and committed.
- [ ] All 69 legacy workflows converted to `registry/skills/workflow-*/SKILL.md` with complete frontmatter and metadata.
- [ ] `registry/bundles.json` updated with all 69 workflow-skills under `skills` across all 26 bundles.
- [ ] `registry/workflows/` safely removed.
- [ ] `src/core/types.ts`, `registry.ts`, `installer.ts`, `updater.ts`, `cline-projector.ts`, `doctor.ts`, and `cli.ts` updated.
- [ ] `npm run typecheck` exits 0 with 0 errors.
- [ ] `npm test` exits 0 with 100% passing tests across all test suites.
- [ ] `PROJECT.md`, `README.md`, `CONTEXT.md`, and `plans/README.md` updated and synchronized.

## STOP conditions

Stop and report back if:
- Any of the 69 converted skills has a naming collision with existing 91 skills (pre-screened to 0 collisions).
- A legacy workflow file has invalid or unparseable Markdown/Mermaid content.
- Vitest fails on an unhandled exception in core projection or resolver logic.

## Maintenance notes

- After November 1, 2026 (Antigravity retirement of workflows), any remaining deprecated references to `workflows` in `types.ts` can be safely removed in a major version bump.
- The dual-benefit projection for Cline ensures that Cline users retain slash commands via `.cline/workflows/` while standardizing on `.agents/skills/` for core discovery.
