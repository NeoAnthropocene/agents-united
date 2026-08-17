# Plan 007 — Universal Multi-Agent Host Projection (`.agents/` → all runtimes)

> **Status:** READY | **Depends on:** 003, 005 | **Effort:** L | **Risk:** Medium
>
> **Written against:** commit `8a5f8fb` (branch `dev`) **with uncommitted working-tree changes
> present** (registry expansion, new `src/core/updater.ts` + `src/core/inventory.ts`, edits to
> `src/cli.ts`, `src/core/installer.ts`, `src/core/types.ts`, `src/core/uninstaller.ts`).
> All line numbers below were verified against that working tree on 2026-08-14.
>
> **Drift check (executor must run first):** `git rev-parse --short HEAD` and `git status --short`.
> If HEAD ≠ `8a5f8fb` or the cited files have changed since, re-verify every excerpt in §3 before
> proceeding. Re-locate code by the quoted snippets, not by line numbers alone.

---

## 1. Verification Gates (run before declaring ANY milestone done)

From `package.json` scripts (verified):

```bash
npm run build      # tsup build → dist/
npm test           # runs pretest (build) then `vitest run`
npm run typecheck  # tsc --noEmit (strict; NO `any`, implicit or explicit)
```

All three must pass with zero errors before a milestone is complete. Node >= 24, ESM
(`"type": "module"`), TypeScript with `.js` import specifiers (`import ... from './types.js'`).

**Environment:** Windows (maintainer develops on win32). Use `path.join` / `path.relative`
everywhere; never hardcode `/` in paths. Tests must pass on Windows (note `path.sep` handling
already present in `uninstaller.ts:40-41`).

**Repo rules (from plans 001–006):** PRs target `dev` (`main` is protected); TDD — write failing
tests first, watch them fail, implement, watch them pass; strict TypeScript, no `any`;
semantic-release handles versioning (never bump version manually).

---

## 2. Problem & Goal

### Problem

The wizard's "Universal Multi-Agent (.agents/)" option (`src/cli.ts:142-146`) and the CLI default
(`-t agents`, `src/cli.ts:114`) write plain asset files into `./.agents/{agents,skills,workflows,rules}/`.
**Only Antigravity's runtime actually loads that directory.** Every other runtime reads its *own*
directory with its *own* frontmatter dialect:

| Runtime | Loader dir (project) | Frontmatter dialect |
| :--- | :--- | :--- |
| Antigravity | `.agents/` | Antigravity (canonical here) |
| Claude Code | `.claude/agents/` | `name`/`description`/`tools`/`model` |
| Cursor | `.cursor/agents/` (also `.cursor/rules/*.mdc`) | similar, own tool names |
| Cline | `.cline/` (agents/skills/rules) | own subset, not Antigravity keys |
| OpenCode | `.opencode/agent/` | own subset |
| Codex & AGENTS.md readers | root `AGENTS.md` | markdown index, no subagent loader |

Users who choose "Universal" get files no runtime other than Antigravity can use. Second gap:
the host set is a closed union of 4 hosts (`src/core/types.ts:3`), so Cline/OpenCode/Codex cannot
even be targeted today.

### Goal

Make `.agents/` the **canonical store** and add a **projection layer** that fans **translated
copies** out into every selected runtime's native loader directory, plus an **AGENTS.md bridge**
(root index file) for CLIs with no subagent loader. All projections are recorded in the lockfile
so `uninstall` / `update` / `doctor` remain deterministic.

### Non-goals / accepted limitations (must be stated in generated file headers)

- Antigravity-only frontmatter keys (`hooks:`, `permissionMode:`, `commandExecutionPolicy:`,
  `mainAgent:`, `subagent:`, `type:`) do **not** execute in other runtimes. Projected orchestrator
  agents degrade gracefully to "system prompt + tool list" subagents. We do not fake behavior.
- `invoke_subagent` cross-agent orchestration only works in Antigravity. Projection drops the
  tool and reports a warning in the projection result.
- Projections are **always copies, never symlinks** (translated content ≠ source content).

---

## 3. Current-State Evidence (all verified against the working tree)

**`src/core/types.ts:1-3` — closed host union:**
```ts
export type InstallScope = 'project' | 'global';
export type InstallMethod = 'symlink' | 'copy';
export type AgentHost = 'agents' | 'gemini' | 'claude' | 'cursor';
```

**`src/core/types.ts:29-50` — lockfile types (needs a `projectedTo` field on `LockfileAsset`):**
```ts
export interface LockfileAsset {
  hash: string;
  bundle?: string;
  method?: InstallMethod;
  installedAt: string;
}
// LockfileManifest { ..., files: Record<string, LockfileAsset> }
```

**`src/core/adapter.ts:6-50` — host→dir resolution + canonical sub-paths:**
```ts
public static resolveHostDir(scope: InstallScope = 'project', host: AgentHost = 'agents', overrideDir?: string): string
// global:  ~/.gemini/config | ~/.claude | ~/.cursor | ~/.agents (default)
// project: ./.gemini | ./.claude | ./.cursor | ./.agents (default)

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
(`TargetAdapter` facade at `adapter.ts:54-62` delegates to `AgentHostAdapter` — keep for back-compat.)

**Host-validation list `['agents','gemini','claude','cursor']` is duplicated in FOUR places —
all must be replaced by one registry:**

1. `src/core/installer.ts:52` — inside `parseHosts()` (`installer.ts:42-60`)
2. `src/core/uninstaller.ts:25` — inside `parseHosts()` (`uninstaller.ts:20-29`, default `['agents']`)
3. `src/core/inventory.ts:44` — inside `parseHosts()` (`inventory.ts:39-48`, default = all four)
4. `src/cli.ts:124` — `options.target.split(',')` cast straight to `AgentHost[]`, **no validation**

**`src/cli.ts:21-28` — workspace host detection (extend with new markers):**
```ts
export function detectWorkspaceHosts(cwd: string = process.cwd()): AgentHost[] {
  const detected: AgentHost[] = [];
  if (fs.pathExistsSync(path.join(cwd, '.gemini'))) detected.push('gemini');
  if (fs.pathExistsSync(path.join(cwd, '.claude'))) detected.push('claude');
  if (fs.pathExistsSync(path.join(cwd, '.cursor'))) detected.push('cursor');
  if (fs.pathExistsSync(path.join(cwd, '.agents'))) detected.push('agents');
  return detected;
}
```

**`src/cli.ts:109-169` — the `add` command registration and wizard Step 1:**
- `-t, --target <hosts>` declared at `cli.ts:114` (help text lists only 4 hosts);
- hosts parsed at `cli.ts:124` (no validation);
- wizard Step 1 multiselect at `cli.ts:139-165` (options array ends at `cursor`, line 161);
- `hosts` assigned from selection at `cli.ts:167-169`;
- wizard Step 2 (scope) at `cli.ts:172-190`, Step 3 (method) at `cli.ts:193-211`.

**`src/core/installer.ts:99-231` — `install()` loop:** deploys agents (141-154), skills (157-177),
workflows (180-197), rules (200-215), updates bundle records (218-225), writes lockfile (227).
`deployFile()` (`installer.ts:73-97`) has symlink→copy fallback with Windows junction handling.

**`src/core/doctor.ts:48-53` — existing frontmatter regex + YAML parse to reuse:**
```ts
const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
const meta = YAML.parse(frontmatterMatch[1]);
```

**Sample canonical frontmatter** (`.agents/agents/subagent-backend-architect.md:1-35`):
`name`, `version`, `type`, `description` (folded scalar), `model: inherit`, `permissionMode`,
`commandExecutionPolicy`, `mainAgent: false`, `subagent: true`, `tools:` list with Antigravity
tool names (`view_file`, `replace_file_content`, `write_to_file`, `run_command`, `grep_search`,
`list_dir`), `hooks:` (PreInvocation/PostInvocation/PreToolUse/PostToolUse).

**Dependencies available — add NO new packages** (`package.json:54-62`):
`yaml`, `fs-extra`, `zod`, `fast-glob`, `cac`, `@clack/prompts`, `picocolors`.

**Test conventions** (`tests/installer.test.ts:1-60`): Vitest; scratch workspace under
`scratch/test-<name>`; `beforeEach`/`afterEach` create+remove it; import from `'../src/core/x.js'`.

---

## 4. Target Architecture

```
agents add <bundle> -t agents --fanout
        │
        ▼ install (unchanged) ──▶ .agents/              canonical store + lockfile
        │
        ▼ HostProjector.project()          (new: src/core/projector.ts)
        ├──▶ .claude/agents/*.md           translated frontmatter (profile: claude-code)
        ├──▶ .cursor/agents/*.md           translated frontmatter (profile: cursor)
        ├──▶ .cline/agents/*.md            translated frontmatter (profile: cline)
        ├──▶ .opencode/agent/*.md          translated frontmatter (profile: opencode)
        └──▶ AGENTS.md (repo root)         index with links into .agents/ (agentsmd bridge)
```

Every projected file is a **copy** stamped with a managed marker (first line of the file body,
after frontmatter):

```html
<!-- managed-by: agents-united | profile: claude-code | canonical: .agents/agents/<file> | do not edit -->
```

The lockfile records projections per canonical asset: `files["agents\\x.md"].projectedTo` is a
list of paths **relative to the workspace root** (e.g. `.claude/agents/x.md`).

### 4.1 New vocabulary (add to `CONTEXT.md` dictionary when implementing Milestone 0)

- **Canonical Store** — `.agents/`; the single source of truth the lockfile tracks.
- **Host Registry** — single table (`src/core/hosts.ts`) describing every known host runtime
  (dirs, subdirs, detection markers, projection profile).
- **Host Projection** — a translated copy of a canonical asset in a host runtime's native format.
- **Projection Profile** — the frontmatter dialect a projection is serialized into
  (`antigravity`, `claude-code`, `cursor`, `cline`, `opencode`, `agentsmd`).
- **AGENTS.md Bridge** — generated root `AGENTS.md` indexing canonical assets for runtimes with
  no subagent loader.
- **Managed Projection Marker** — HTML comment stamp identifying a file as machine-managed.

---

## 5. Milestones

> **Execution discipline:** one PR per milestone into `dev`. TDD: failing test first → implement
> → pass. Run all three gates (§1) before declaring a milestone done. Do not skip ahead:
> the dependency order below is strict.

### Milestone 0 — ADR & Vocabulary (docs only, no code)

1. Write `docs/adr/0008-universal-host-projection-architecture.md` in the exact structure of
   `docs/adr/0006-scope-and-installation-methods-architecture.md` (Status / Context / Decision /
   Consequences). Decision to record: `.agents/` remains the canonical store; projections are
   copy-only, stamp-managed, and tracked in the lockfile via `projectedTo`; Antigravity-only
   frontmatter keys degrade (not fake) in other runtimes.
2. Add the six dictionary terms from §4.1 to `CONTEXT.md`.

**Acceptance:** both files exist; ADR mirrors 0006's section structure. **Gates:** docs only —
run `npm test` once to confirm nothing broke (it should be untouched).

### Milestone 1 — Host Registry (consolidate the 4 duplicated lists)

**Files:** new `src/core/hosts.ts`, `tests/hosts.test.ts`; modify `src/core/types.ts`,
`src/core/adapter.ts`, `src/core/installer.ts`, `src/core/uninstaller.ts`,
`src/core/inventory.ts`, `src/cli.ts`.

1. **Write failing tests first** (`tests/hosts.test.ts`), mirroring existing test conventions:
   - `HOST_REGISTRY` contains `agents`, `gemini`, `claude`, `cursor` with identical dir resolution
     to today (behavior-compat proof);
   - `isKnownHost('cline') === true`, `isKnownHost('nope') === false`;
   - `resolveHostDir('project', 'cline')` → `<cwd>/.cline`; `resolveHostDir('global', 'opencode')`
     → `<home>/.config/opencode`.
2. Create `src/core/hosts.ts`:

```ts
import path from 'node:path';
import os from 'node:os';

export type ProjectionProfile =
  | 'antigravity' | 'claude-code' | 'cursor' | 'cline' | 'opencode' | 'agentsmd';

export interface HostDefinition {
  id: string;
  label: string;
  projectDir: string;             // '.claude' | '.cline' | '.opencode' | '.agents' | ...
  globalDirSegments: string[];    // joined under homedir, e.g. ['.claude'] or ['.config','opencode']
  agentsSubdir?: string;          // 'agents' | 'agent' | undefined (agentsmd-only hosts)
  detectionMarkers: string[];     // ['.cline', '.clinerules'], ['.claude'], ...
  profile: ProjectionProfile;
  projectionCapable: boolean;     // false for 'agents' (it IS the canonical) & 'gemini'
}

export const HOST_REGISTRY: Record<string, HostDefinition> = {
  agents:   { id: 'agents',   label: 'Universal Multi-Agent (.agents/)', projectDir: '.agents',   globalDirSegments: ['.agents'],           agentsSubdir: 'agents', detectionMarkers: ['.agents'],   profile: 'antigravity', projectionCapable: false },
  gemini:   { id: 'gemini',   label: 'Antigravity 2.0 / Gemini (.gemini/)', projectDir: '.gemini', globalDirSegments: ['.gemini', 'config'], agentsSubdir: 'agents', detectionMarkers: ['.gemini'],   profile: 'antigravity', projectionCapable: false },
  claude:   { id: 'claude',   label: 'Claude Code (.claude/)', projectDir: '.claude', globalDirSegments: ['.claude'], agentsSubdir: 'agents', detectionMarkers: ['.claude'], profile: 'claude-code', projectionCapable: true },
  cursor:   { id: 'cursor',   label: 'Cursor / Codex (.cursor/)', projectDir: '.cursor', globalDirSegments: ['.cursor'], agentsSubdir: 'agents', detectionMarkers: ['.cursor'], profile: 'cursor', projectionCapable: true },
  cline:    { id: 'cline',    label: 'Cline (.cline/)', projectDir: '.cline', globalDirSegments: ['.cline'], agentsSubdir: 'agents', detectionMarkers: ['.cline', '.clinerules'], profile: 'cline', projectionCapable: true },
  opencode: { id: 'opencode', label: 'OpenCode (.opencode/)', projectDir: '.opencode', globalDirSegments: ['.config', 'opencode'], agentsSubdir: 'agent', detectionMarkers: ['.opencode', 'opencode.json'], profile: 'opencode', projectionCapable: true },
  codex:    { id: 'codex',    label: 'Codex (AGENTS.md bridge)', projectDir: '.', globalDirSegments: ['.codex'], agentsSubdir: undefined, detectionMarkers: ['AGENTS.md', '.codex'], profile: 'agentsmd', projectionCapable: true },
};

export const KNOWN_HOST_IDS = Object.keys(HOST_REGISTRY);
export function isKnownHost(id: string): id is keyof typeof HOST_REGISTRY {
  return Object.prototype.hasOwnProperty.call(HOST_REGISTRY, id);
}
export function resolveHostProjectDir(host: string, cwd: string): string { /* path.resolve(cwd, HOST_REGISTRY[host].projectDir) */ }
export function resolveHostGlobalDir(host: string, home: string): string { /* path.join(home, ...HOST_REGISTRY[host].globalDirSegments) */ }
```

   (Keep formatting consistent with the repo's style; the one-line entries above are compressed
   for this plan — the executor should format them multi-line.)

3. In `types.ts:3`, widen the union — replace with:
   `export type AgentHost = 'agents' | 'gemini' | 'claude' | 'cursor' | 'cline' | 'opencode' | 'codex';`
   (kept as a literal union, NOT `string`, so the compiler still guards call sites).
4. `adapter.ts` `resolveHostDir` switches to registry lookups, preserving exact current behavior
   for the original four (including the `gemini` global special-case `~/.gemini/config`).
5. Replace each duplicated list with `KNOWN_HOST_IDS.includes(h)` / `isKnownHost(h)`:
   `installer.ts:52`, `uninstaller.ts:25`, `inventory.ts:44` (its default stays "all hosts"),
   and add validation at `cli.ts:124` (warn + drop unknown host ids instead of silently casting).
6. Update the `-t, --target` help text (`cli.ts:114`) to list all hosts.

**Acceptance:** all existing tests pass unchanged; new `tests/hosts.test.ts` passes;
`npm run typecheck` clean. **Gates:** build + test + typecheck.

### Milestone 2 — Frontmatter Projector (`src/core/projector.ts`)

**Files:** new `src/core/projector.ts`, `tests/projector.test.ts`. No changes to existing modules.

1. **Failing tests first** (`tests/projector.test.ts`), using the real canonical fixture content
   quoted in §3 (embed it as a template literal in the test):
   - `parseFrontmatter()` extracts `name`, `tools` array, and body from the sample;
   - `projectAgent(sample, 'claude-code')` output frontmatter: keeps `name`, `description`,
     `model` (but `model: inherit` is **omitted**), contains NO `hooks`/`permissionMode`/
     `commandExecutionPolicy`/`mainAgent`/`subagent`/`type`/`version` keys;
   - tool translation: `view_file→Read`, `replace_file_content→Edit`, `write_to_file→Write`,
     `run_command→Bash`, `grep_search→Grep`, `list_dir→Glob`;
   - unknown tool name (e.g. `invoke_subagent`) → dropped from output AND returned in
     `warnings: string[]` (never silently kept, never invented mappings);
   - body is preserved verbatim after the closing `---`, with the managed marker line inserted
     as the first line of the body;
   - no frontmatter at all → throws a typed `ProjectionError` with the file name in the message;
   - invalid YAML → throws `ProjectionError` (do not crash with a raw YAML error);
   - `projectAgent(sample, 'cursor' | 'cline' | 'opencode')` produce their profile-specific
     key sets (see step 3 field policy);
   - snapshot-style assertion: `projectAgent` output for the sample is deterministic
     (two calls produce byte-identical output).
2. `HostProjector` public surface:

```ts
import YAML from 'yaml';

export class ProjectionError extends Error { /* carries fileName + cause */ }

export interface ProjectionResult {
  content: string;        // full file: frontmatter + marker + body
  warnings: string[];     // dropped tools, degraded orchestrator notice, etc.
}

export class HostProjector {
  public static parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string }
    // reuse the doctor.ts:48 regex: /^---\r?\n([\s\S]+?)\r?\n---/
  public static projectAgent(md: string, profile: ProjectionProfile, canonicalRelPath: string): ProjectionResult
  public static buildAgentsMdIndex(assets: Array<{ name: string; type: 'agent' | 'skill' | 'workflow'; relPath: string }>): string
}
```

3. **Field policy per profile** (keep → translate → drop):

| Field | claude-code / cursor / cline / opencode | agentsmd |
| :--- | :--- | :--- |
| `name` | keep | used as link text |
| `description` | keep | table cell |
| `model` | keep unless `inherit` → omit | n/a |
| `tools` | translate via `TOOL_NAME_MAP` | n/a |
| `version`, `type`, `permissionMode`, `commandExecutionPolicy`, `mainAgent`, `subagent`, `hooks` | **drop** | n/a |
| body (system prompt) | keep verbatim + marker | link to canonical path |

   `TOOL_NAME_MAP` (exhaustive for tools present in `registry/agents/*.md` — the executor must
   `grep` the registry for `- ` entries under `tools:` and cover every distinct name; known set:
   `view_file→Read`, `replace_file_content→Edit`, `write_to_file→Write`, `run_command→Bash`,
   `grep_search→Grep`, `list_dir→Glob`, `invoke_subagent→ (dropped + warning)`,
   `read_file→Read`, `search_file_content→Grep`, `apply_diff→Edit`, `web_search→WebSearch`).
4. Serialization: `YAML.stringify` from the already-installed `yaml` package; frontmatter
   delimited `---\n ... \n---\n`; line endings `\n` (normalize CRLF).

**Acceptance:** `tests/projector.test.ts` green; `npm run typecheck` clean; NO other module
imported `projector.ts` yet (wiring is Milestone 3). **Gates:** build + test + typecheck.

### Milestone 3 — Fan-out in `InstallEngine` + lockfile `projectedTo`

**Files:** `src/core/types.ts`, `src/core/installer.ts`, `tests/installer.test.ts` (add cases),
new `tests/fanout.test.ts` (integration-style, scratch workspace).

1. **Failing tests first:**
   - `install('software-engineering', { targetDir: <ws>/.agents, method: 'copy', fanout: ['claude','cline'] })`
     creates `<ws>/.claude/agents/orchestrator-engineering.md` etc. with translated frontmatter
     (assert: no `hooks:` key, marker line present, `Read` in tools);
   - lockfile `files['agents\\orchestrator-engineering.md'].projectedTo` contains
     `.claude/agents/orchestrator-engineering.md` and `.cline/agents/...` (workspace-root-relative,
     forward slashes);
   - WITHOUT `fanout`, behavior is byte-identical to today (no `.claude` created, no
     `projectedTo` key) — backward-compat guard test;
   - `dryRun: true` with `fanout` writes nothing anywhere;
   - collision: pre-existing user file at the projection destination without `--force` →
     throw, mirroring the installer's existing user-modification protection
     (`installer.ts:134-139` pattern);
   - `codex` fan-out target generates root `AGENTS.md` index linking into `.agents/` (bridge),
     and `AGENTS.md` itself is recorded in the lockfile `projectedTo` of each indexed asset.
2. `types.ts`: add `projectedTo?: string[]` to `LockfileAsset`; add `fanout?: string[]` to
   `InstallOptions` (host ids, validated against `HOST_REGISTRY`, `projectionCapable === true`).
3. `installer.ts` `install()`: after each canonical agent file is deployed (post line ~154),
   if `fanout` includes hosts, call `HostProjector.projectAgent`, write copies via a new private
   `deployProjection(dest: string, content: string)` (always `fs.writeFile`, never symlink),
   and append the workspace-root-relative path to `lockfile.files[relPath].projectedTo`.
   Projections happen **inside the per-targetDir loop only when the canonical host `agents` is
   among the install hosts** (projection from canonical only — never from `.claude` to `.cline`).
4. Fan-out reporting: extend the install return type with
   `projections: Array<{ host: string; path: string; warnings: string[] }>` so the CLI can render
   warnings (dropped `invoke_subagent`, degraded orchestrators) to the user.

**Acceptance:** new tests green; backward-compat guard green; gates all pass.

### Milestone 4 — CLI surface: `--fanout` flag + wizard integration

**Files:** `src/cli.ts`, `tests/cli-e2e.test.ts` (add non-interactive cases).

1. **Failing tests first** (follow the existing e2e style — spawn `node dist/cli.js` with flags):
   - `agents add software-engineering -t agents --fanout claude,cline -y --copy --dry-run`
     prints the projection plan;
   - without `--fanout`, output unchanged;
   - invalid host in `--fanout` (e.g. `--fanout nope`) → warning listing valid ids, exit code
     unchanged from cac conventions.
2. Register the option on the `add` command (near `cli.ts:114`):
   `.option('--fanout <hosts>', 'Project canonical .agents/ assets into additional runtimes (claude, cursor, cline, opencode, codex)')`
   Parse like `cli.ts:124` but validated against the registry; never a silent cast.
3. Wizard (`cli.ts:139+`): extend `detectWorkspaceHosts` (line 21-28) to consult
   `HOST_REGISTRY[*].detectionMarkers` (Cline via `.cline`/`.clinerules`, OpenCode via
   `.opencode`/`opencode.json`, Codex via `AGENTS.md`/`.codex`). After Step 1, if the selection
   includes `agents` AND other runtimes are detected in the workspace, show a new multiselect:
   *"Project these agents into the detected runtimes?"* with pre-checked detected hosts. Feed the
   result into the same `fanout` option. Add the new hosts as selectable options in Step 1 as
   well (labels from the registry).
4. Render `result.projections` with `pc.yellow` warnings and a summary line per host.

**Acceptance:** e2e tests green; wizard remains fully functional when TTY-interactive behavior
is bypassed (`-y`). **Gates:** build + test + typecheck.

### Milestone 5 — Projection-aware uninstall / update / doctor

**Files:** `src/core/uninstaller.ts`, `src/core/updater.ts`, `src/core/doctor.ts`,
`tests/uninstaller.test.ts` (or new `tests/projection-lifecycle.test.ts`), `tests/doctor.test.ts`.

1. **Failing tests first:**
   - **Uninstall:** after Milestone 3's install with fan-out, `uninstall('software-engineering')`
     removes BOTH canonical files AND every path in `projectedTo` (converted back to absolute
     via `path.join(workspaceRoot, p)`); the managed marker is verified before deletion — a
     file whose first body line is NOT our marker is treated as user-modified and skipped
     unless `--force` (reuse the hash-conflict error pattern from `uninstaller.ts:97-101`).
     Empty projection dirs (e.g. `.claude/agents/` left empty) are removed.
   - **Update:** `updater.update` re-runs install which regenerates projections (Milestone 3
     already covers regeneration via `force: true` reinstall at `updater.ts:140-146`); add a
     test that a stale projection (manually edited marker-removed file) is NOT clobbered
     without `--force` — it lands in `skipped` with a clear reason.
   - **Doctor:** `runDoctor` gains checks — (a) every `projectedTo` path exists; missing →
     `warning: "Missing projection <path> for canonical <relPath>. Re-run: agents add ... --fanout"`;
     (b) projected file lacks the managed marker → `warning: user-modified projection`; (c) the
     canonical→projection hash relationship is *not* checked (content intentionally differs).
2. Implementation: loop `projectedTo` inside `uninstaller.uninstall`'s bundle-removal branch
   (`uninstaller.ts:93-110`), before `delete lockfile.files[relPath]`. Doctor: iterate
   `lockfile.files[*].projectedTo` in `DoctorEngine.runDoctor` after the existing frontmatter
   validation block (`doctor.ts:42-63`).

**Acceptance:** lifecycle tests green (install→fanout→uninstall leaves zero stray files);
doctor reports constructed scenarios correctly. **Gates:** build + test + typecheck.

### Milestone 6 — Documentation & registry surface

1. `README.md`: new "Universal Multi-Agent Projection" section — what "Universal" now means
   (canonical + fan-out), the `--fanout` flag, per-runtime caveats (hooks/permissionMode are
   Antigravity-only), and the AGENTS.md bridge.
2. `CONTEXT.md`: confirm §4.1 vocabulary landed in Milestone 0; add usage examples.
3. `plans/README.md`: set plan 007 status to **DONE** when merged.
4. `docs/adr/0008` gets a "Status: Accepted" update if anything changed during implementation.

**Acceptance:** docs accurate vs. shipped behavior; final full `npm test` + typecheck green.

---

## 6. Test Matrix Summary

| Test file | Milestone | Tier | Covers |
| :--- | :--- | :--- | :--- |
| `tests/hosts.test.ts` | 1 | unit | registry lookups, dir resolution, unknown ids, back-compat |
| `tests/projector.test.ts` | 2 | unit | parse, per-profile field policy, tool map, errors, determinism |
| `tests/fanout.test.ts` | 3 | integration | install+fanout end state, lockfile `projectedTo`, dry-run, collisions, AGENTS.md bridge |
| `tests/installer.test.ts` (extend) | 3 | regression | no-fanout byte-compat guard |
| `tests/cli-e2e.test.ts` (extend) | 4 | e2e | `--fanout` flag parsing, dry-run plan, invalid-host warning |
| `tests/projection-lifecycle.test.ts` | 5 | integration | uninstall/update/doctor projection lifecycle |

All tests must use the `scratch/test-*` workspace pattern with `beforeEach`/`afterEach` cleanup
(see `tests/installer.test.ts:7-16`) and must pass on Windows.

---

## 7. Risks & Mitigations

| Risk | Likelihood | Mitigation |
| :--- | :--- | :--- |
| Registry frontmatter drift (new tools/keys appear in `registry/agents/*.md`) | High over time | Unknown keys are dropped by default; unknown tools warn loudly; Milestone 2 test greps registry for the full tool inventory |
| Deleting user files during uninstall (path confusion) | Medium (severity High) | Delete ONLY paths recorded in `projectedTo`, only after managed-marker verification, never by globbing |
| Path handling bugs on Windows (`\\` vs `/`) | Medium | All stored `projectedTo` values normalized to forward slashes; convert with `path.join` at use sites (precedent: `uninstaller.ts:40-41`) |
| Host runtime format changes upstream (Claude/Cursor change their loader spec) | Medium | Profiles isolated in `projector.ts`; one file to update per dialect |
| Backward-compat break for existing lockfiles | Low | `projectedTo` is optional; all pre-existing lockfile shapes remain valid (guard test in Milestone 3) |
| Scope creep into "make hooks work everywhere" | Certain if unguarded | Non-goals in §2 are final; degradation is documented, not engineered around |

## 8. Rollback

Each milestone is an independent PR into `dev`. Rolling back any milestone = revert that PR.
Milestone 1 must revert cleanly before Milestones 2-5 merge (they depend on the registry).
`projectedTo` fields in user lockfiles are harmless orphans if later reverted — the uninstaller
of the reverted code ignores unknown keys.

## 9. Definition of Done

1. All milestones merged to `dev`; `main` untouched directly (semantic-release promotes).
2. `npm run build && npm test && npm run typecheck` green on Windows.
3. `agents add software-engineering -t agents --fanout claude,cursor,cline,opencode,codex -y --copy`
   produces: canonical `.agents/` tree (unchanged format) + translated `.claude/agents/`,
   `.cursor/agents/`, `.cline/agents/`, `.opencode/agent/` + root `AGENTS.md`, all tracked in
   the lockfile, all removable with one `agents remove software-engineering`.
4. Every projected file carries the managed marker and correct degradation notes.
5. ADR 0008 + CONTEXT.md vocabulary + README section merged.






