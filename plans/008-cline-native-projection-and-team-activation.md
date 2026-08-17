# Plan 008 — Cline-Native Compound Projection and Smart Team Activation

> **Status:** READY | **Priority:** P1 | **Category:** Core / Runtime Integration | **Depends on:** 007 | **Effort:** XL | **Risk:** High
>
> **Written against:** commit `8a5f8fb` (branch `dev`) with substantial uncommitted working-tree
> changes already present. This plan was written on 2026-08-17 after reviewing the current working
> tree, Cline CLI `3.0.55`, Cline's public documentation, and Cline's `main` branch source.
>
> **Executor drift check — mandatory before editing:** run `git rev-parse --short HEAD` and
> `git status --short`. If HEAD differs from `8a5f8fb`, or if any cited file has changed, re-locate
> every excerpt by symbol/name and re-validate the assumptions in §§4–6. Never reset, discard, or
> overwrite the pre-existing working-tree changes. Stop and report any semantic conflict that cannot
> be reconciled without changing this plan's product decisions.

---

## 1. Purpose and user-visible contract

### Problem

Plan 007 currently treats Cline like Claude Code: `--fanout cline` writes translated Markdown files
to `.cline/agents/*.md` and reports a successful projection. The files exist, but a user running
Cline CLI cannot see or select them. The implementation also emits Claude-style `tools: [Read,
Edit, Bash, ...]` frontmatter even though the only verified consumer of that exact directory/schema
is Cline's private **Agent Squad SDK example plugin**, not a proven stock-Cline agent picker.

Cline's documented, released runtime exposes several different mechanisms:

1. **Rules** and **Skills** are stock configuration surfaces.
2. **Subagents** are dynamic, session-scoped, read-only research workers; they do not constitute a
   user-defined agent registry.
3. **Agent Teams** are persistent coordinator/teammate sessions with task board, mailbox, and mission
   log state. Cline CLI accepts `--team-name` even though version `3.0.55` does not advertise that flag
   in `--help`.
4. `.cline/agents/*.md` definitions are read by the Agent Squad example plugin using a small preset
   schema, but a stable stock-loader and agent-picker contract has not been demonstrated.

The current installation therefore prepares files but does not provide the low-interaction activation
path the user reasonably expects.

### Goal

Implement two Cline integration layers:

1. **Cline Compound Projection** — install a small, deterministic set of Cline-native artifacts:
   role definitions, stock Cline skills, a coordinator rule, and a bundle team manifest. Keep
   `.agents/` as the Canonical Store.
2. **Runtime Activation** — add `agents start <bundle> --host cline [prompt]`, which finds the
   installation, probes Cline safely, chooses Agent Teams when supported, and launches Cline with a
   short coordinator bootstrap. Setup should require no Cline-specific knowledge from the user.

The final user contract is deliberately short:

```powershell
# Install or update the Cline projection
agents add software-engineering -t cline
# or
agents update software-engineering --fanout cline

# Start the installed team
agents start software-engineering

# Start with a task
agents start software-engineering "Review this repository and fix the highest-risk problems"
```

### Non-goals

- Do not build or vendor Cline's Agent Squad example plugin.
- Do not promise that projected roles appear in a stock Cline agent-picker UI unless an automated,
  released-runtime test proves that behavior.
- Do not add `@cline/sdk` as a runtime dependency in this plan. Activation wraps the installed Cline
  CLI. A future SDK adapter may be considered separately.
- Do not emulate Antigravity lifecycle hooks or permissions inside Cline.
- Do not silently start a paid model session from `-y` alone.
- Do not silently install addon bundles without explicit user consent.
- Do not rewrite canonical agent prompts to use Cline-specific tool names throughout their bodies.
  Add a compatibility preamble and let Cline expose its actual runtime tools.
- Do not generate both `.clinerules/` and `.cline/rules/`; duplicated always-on instructions waste
  context and can conflict. Use the current structured `.cline/rules/` surface.

---

## 2. Verification gates and repository conventions

Run all commands from the repository root with Node >= 24. The project is strict TypeScript, ESM,
and uses `.js` import specifiers in TypeScript imports.

```bash
npm run typecheck
npm run build
npm test
```

All three gates must pass with zero errors after every milestone. `npm test` runs `pretest`, so it
also rebuilds `dist/` before Vitest.

Repository conventions to preserve:

- Tests use Vitest and isolated `scratch/test-*` directories with `beforeEach`/`afterEach` cleanup.
- Paths use `node:path`; lockfile paths are workspace-root-relative and normalized to `/`.
- Filesystem operations use `fs-extra`.
- YAML parsing/serialization uses the existing `yaml` dependency.
- Interactive copy uses `@clack/prompts`; CLI registration uses `cac`.
- Never add explicit or implicit `any`. Define interfaces for process runners, manifests, and reports.
- TDD is mandatory: add the focused failing test, confirm the expected failure, implement only that
  behavior, then run focused and full gates.
- Do not manually bump `package.json` version; semantic-release owns versions.
- PRs target `dev`; never commit directly to protected branches.
- Windows is a first-class environment. Never concatenate a user prompt into a command string.

Existing test exemplar (`tests/cli-e2e.test.ts`):

```ts
const cliPath = path.resolve(process.cwd(), 'dist/cli.js');
const e2eDir = path.resolve(process.cwd(), 'scratch/test-cli-e2e-workspace');

beforeEach(async () => {
  await fs.remove(e2eDir);
  await fs.ensureDir(e2eDir);
});
```

CI parity is defined by `.github/workflows/ci.yml`: Node 24, `npm ci`, typecheck, build, test.

---

## 3. Domain model and resolved grilling decisions

The executor must use these terms consistently in code, tests, TUI copy, ADRs, and `CONTEXT.md`.

### Existing terms retained

- **Canonical Store**: `.agents/`, the single source of truth and lockfile owner.
- **Bundle**: orchestrator, sub-agents, skills, workflows, and rules installed as a named team.
- **Orchestrator Agent**: the role Cline uses as the team coordinator.
- **Sub-Agent**: a canonical specialist role. In Cline it may become a persistent teammate, a
  session subagent, or instructions followed by the main session depending on capabilities.
- **Managed Projection Marker**: ownership stamp that protects user-authored files.
- **Cross-Bundle Dynamic Recommendation Protocol**: orchestrator identifies a missing addon.
- **On-Demand Addon Auto-Install**: install after explicit confirmation, then continue.

### New terms to add to `CONTEXT.md` in Milestone 7

**Cline Compound Projection**:
A host projection made of several artifact kinds—roles, skills, a coordinator rule, and a Team
Manifest—rather than only translated agent Markdown files.
_Avoid_: Cline copy, agent dump

**Coordinator Role Projection**:
A minimal Cline-compatible role document derived from a canonical Orchestrator Agent or Sub-Agent.
It retains `name`, `description`, and the role body, omits invented tool/permission semantics, and
adds a Cline compatibility preamble.
_Avoid_: Claude-format Cline agent

**Team Manifest**:
A machine-managed, host-neutral description of an installed Bundle's coordinator, specialists,
skills, workflows, recommended addons, scope, and preferred activation strategy. It is consumed by
Agents United's launcher and coordinator bootstrap; it is not claimed to be a native Cline schema.
_Avoid_: Cline config, task board

**Runtime Activation**:
Starting a prepared Bundle in a selected host runtime after installation, including capability
probing, safe process launch, coordinator bootstrap, and fallback selection.
_Avoid_: Install, projection

**Host Capability Probe**:
A read-only local check that discovers whether a host executable and optional runtime features are
available without starting a model session or mutating host state.
_Avoid_: Version guess, feature assumption

**Activation Strategy**:
The runtime mode chosen after probing: `named-team`, `adaptive-session`, or `single-orchestrator`.
_Avoid_: Silent degradation

**Addon Consent**:
Explicit permission for the active orchestrator to install a recommended addon. Interactive starts
require a yes/no confirmation in conversation; headless starts require `--allow-addons`.
_Avoid_: Automatic package mutation

### Grilling decisions (final unless an escape hatch fires)

1. `add/update --fanout cline` prepares Cline but does not launch it.
2. Interactive add/update offers one `Start in Cline now?` prompt after success.
3. `-y` never starts Cline unless `--start` is also supplied.
4. `--start` is explicit consent to open a Cline session and may incur provider cost.
5. `agents start` prefers a project installation; `--global` explicitly selects global scope.
6. Persistent Agent Teams are preferred when `--team-name` is accepted by the installed CLI.
7. If named teams are unavailable, launch an adaptive session whose bootstrap asks Cline to use
   available team/subagent tools; do not claim persistence.
8. If the launcher cannot find Cline, fail with an actionable install/auth command and do not change
   the bundle installation.
9. Addon installs need confirmation unless the start command included `--allow-addons`.
10. User-modified or foreign projected files are never overwritten/removed without `--force`.

---

## 4. Verified current state and external evidence

### Repository state

`src/core/hosts.ts` currently treats Cline as a simple agent-directory host:

```ts // src/core/hosts.ts:64-73
cline: {
  id: 'cline',
  label: 'Cline (.cline/)',
  projectDir: '.cline',
  globalDirSegments: ['.cline'],
  agentsSubdir: 'agents',
  detectionMarkers: ['.cline', '.clinerules'],
  profile: 'cline',
  projectionCapable: true,
},
```

`src/core/installer.ts` currently projects only canonical agent files for non-Codex fan-out hosts:

```ts // src/core/installer.ts:170-176 (applyFanout, non-codex branch)
const base = resolveHostProjectDir(host, root);
const subdir = HOST_REGISTRY[host].agentsSubdir ?? 'agents';
for (const agentFile of resolved.agents) {
  const content = await fs.readFile(path.join(registryDir, 'agents', agentFile), 'utf8');
  const res = HostProjector.projectAgent(
    content,
    HOST_REGISTRY[host].profile,
    this.canonicalRelAgent(agentFile)
  );
  const dest = path.join(base, subdir, agentFile);
  // deploy and record projectedTo
}
```

`src/core/projector.ts` currently maps Antigravity tools to Claude-style names and applies the same
key policy to Cursor, Cline, and OpenCode. Existing tests explicitly expect Cline `tools` to equal
`['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']`; those expectations are part of the bug and must
be replaced, not preserved.

`src/core/types.ts` currently records only string paths per canonical asset:

```ts // src/core/types.ts:29-38
export interface LockfileAsset {
  hash: string;
  bundle?: string;
  method?: InstallMethod;
  installedAt: string;
  projectedTo?: string[];
}
```

`registry/bundles.json` already provides the data required to generate a Team Manifest:

```json
{
  "name": "software-engineering",
  "recommendedAddons": [
    "mobile-development",
    "frontend-engineering",
    "backend-distributed-systems",
    "qa-automation",
    "devops-engineering",
    "ai-ml-engineering"
  ],
  "orchestrator": "orchestrator-engineering.md",
  "agents": [
    "subagent-backend-architect.md",
    "subagent-frontend-architect.md",
    "subagent-code-reviewer.md",
    "subagent-repo-index.md"
  ]
}
```

`registry/agents/orchestrator-engineering.md` already contains the Cross-Bundle Dynamic
Recommendation Protocol and maps specialist roles to work. Do not duplicate the full prompt into an
always-on Cline rule; reference the role path and load it only during activation.

### Cline evidence (verified 2026-08-17)

Primary sources:

- `https://docs.cline.bot/features/subagents`
- `https://docs.cline.bot/cli/agent-teams`
- `https://docs.cline.bot/sdk/guides/multi-agent-teams`
- `https://docs.cline.bot/getting-started/config`
- `https://docs.cline.bot/customization/skills`
- `https://docs.cline.bot/customization/cline-rules`
- `https://github.com/cline/cline/blob/main/.agents/skills/cline-sdk/references/multi-agent/REFERENCE.md`
- `https://github.com/cline/cline/tree/main/sdk/examples/plugins/agents-squad`

Verified facts:

1. Stock subagents are dynamic, session-scoped research workers and are not loaded from custom
   Markdown files.
2. Agent Teams add `team_spawn_teammate`, `team_delegate_task`, `team_check_status`, and
   `team_get_result`; team state persists under `~/.cline/data/teams/<team-name>/`.
3. Cline CLI `3.0.55` accepts the side-effect-free parser probe:
   `cline --team-name agents-united-capability-probe version` (exit 0), even though `--help` omits the
   flag. `cline --no-teams version` fails and must not be used.
4. Cline's config documentation lists project `rules/`, `skills/`, and `agents/` under `.cline/`.
5. Cline Skills use `.cline/skills/<skill>/SKILL.md` for project scope and `~/.cline/skills/` for
   global scope.
6. The Agent Squad example plugin—not proven stock core—reads Markdown presets in this order:
   bundled, global, project. Project definitions override earlier definitions by `name`.
7. Its compatible preset fields are `name`, optional `description`, optional `providerId`, optional
   `modelId`, optional `cwd`, optional `maxIterations`, with the Markdown body used as `systemPrompt`.
8. The example plugin's global path differs from current public config documentation. Therefore the
   plugin must not be made a dependency or the basis for a stock-support claim.

---

## 5. Target architecture

```text
Canonical Store (.agents/)                         Cline Compound Projection
┌──────────────────────────┐                       ┌──────────────────────────────┐
│ agents/*.md              │ ─ role projection ─▶ │ .cline/agents/*.md          │
│ skills/<name>/**         │ ─ full skill copy ─▶ │ .cline/skills/<name>/**     │
│ workflows/*.md           │ ─ manifest refs ───▶ │ .cline/agents-united/       │
│ agents-united.json       │ ◀ ownership state ── │   teams/<bundle>.yaml       │
└──────────────────────────┘                       │ .cline/rules/               │
                                                   │   agents-united-<bundle>.md │
                                                   └──────────────────────────────┘
                                                                │
                          agents start <bundle>                  ▼
                   ┌───────────────────────────────┐     ClineCapabilityProbe
                   │ ClineTeamLauncher             │       │
                   │ - resolve installed bundle   │       ├─ named-team
                   │ - stable project team name   │       ├─ adaptive-session
                   │ - short bootstrap prompt     │       └─ single-orchestrator
                   │ - argument-array process run │
                   └───────────────────────────────┘
```

### 5.1 New modules

Create focused modules; do not put all behavior into `src/cli.ts` or `installer.ts`:

```text
src/core/cline-projector.ts     # compound artifact planning/rendering
src/core/cline-capabilities.ts  # executable resolution + read-only probes
src/core/cline-launcher.ts      # installation selection + process activation
```

Keep generic agent translation in `projector.ts`. `InstallEngine.applyFanout()` should delegate the
`cline` branch to `ClineProjector`; other profiles remain unchanged.

### 5.2 Team Manifest schema

Use YAML because the repository already depends on `yaml`. The file is an Agents United schema, not
a native Cline configuration file:

```yaml
schemaVersion: 1
bundle: software-engineering
scope: project
coordinator:
  name: orchestrator-engineering
  canonicalPath: .agents/agents/orchestrator-engineering.md
roles:
  - name: subagent-backend-architect
    canonicalPath: .agents/agents/subagent-backend-architect.md
skills:
  - architecture-design
workflows:
  - workflow-implement.md
recommendedAddons:
  - mobile-development
activation:
  preferred: named-team
  fallbacks:
    - adaptive-session
    - single-orchestrator
```

Required TypeScript shape:

```ts
export interface ClineTeamManifest {
  schemaVersion: 1;
  bundle: string;
  scope: InstallScope;
  coordinator: { name: string; canonicalPath: string };
  roles: Array<{ name: string; canonicalPath: string }>;
  skills: string[];
  workflows: string[];
  recommendedAddons: string[];
  activation: {
    preferred: 'named-team';
    fallbacks: Array<'adaptive-session' | 'single-orchestrator'>;
  };
}
```

Paths in a project manifest are repository-relative with `/`. Global manifests use paths relative to
the global Canonical Store and are resolved by the launcher; do not persist machine-specific absolute
paths in shareable project files.

**Canonical path format (clarification):** For both project and global manifests, `canonicalPath` is
relative to the canonical store root using forward slashes — e.g. `agents/orchestrator-engineering.md`,
`skills/architecture-design/SKILL.md`, `workflows/workflow-implement.md`. The launcher prepends the
resolved store base (`.agents/` for project scope, `~/.agents/` for global scope) at activation time.
Never persist machine-specific absolute paths in any manifest.

### 5.3 Role projection policy

For Cline only:

- Keep `name` and `description`.
- Omit `tools`, `version`, `type`, `model: inherit`, hooks, permission fields, `mainAgent`, and
  `subagent`.
- Do not inject a provider/model; inherit the active Cline configuration.
- Preserve the canonical Markdown body.
- Insert the Managed Projection Marker as the first body line.
- Add this short preamble after the marker:

```markdown
## Cline runtime note

Use the equivalent capabilities available in this Cline session. Canonical tool names describe
intent and may differ from Cline's runtime tool names. For delegation, prefer Agent Teams when
available, then session subagents; otherwise complete the role in the main session.
```

The output is compatible with the verified Agent Squad preset subset but must be described in user
copy as a **role definition**, not as a guaranteed picker entry.

### 5.4 Skill projection policy

- Copy every resolved bundle skill directory recursively to `.cline/skills/<name>/`.
- Render `SKILL.md` through a dedicated method that preserves its valid frontmatter and inserts the
  Managed Projection Marker after the closing frontmatter delimiter.
- Copy auxiliary resources/scripts byte-for-byte.
- Never symlink compound projections, even when the Canonical Store uses symlink mode.
- Track every copied file, including resources, in the new projection ownership map described below.
- **Stale resource removal on update:** when a skill is updated and an upstream resource file is
  removed from the registry, the `update` engine must compute the diff between the previous owned
  file set for that bundle and the new desired set. Any file in `lockfile.projections` owned solely
  by this bundle that is no longer in the updated skill asset set must have its ownership removed;
  if `owners` becomes empty and marker/hash verification passes, the file is deleted and empty
  parent directories are pruned. Never glob-delete `.cline/skills/<name>/`.

### 5.5 Coordinator rule policy

Generate `.cline/rules/agents-united-<bundle>.md`. Keep it concise; it is always-on context. It must:

- identify the installed bundle and Team Manifest path;
- tell Cline to read the coordinator role at activation, not inline it permanently;
- list specialist names and canonical paths;
- instruct Agent Teams to give each teammate one clear task and non-overlapping file scope;
- use session subagents for small research-only work;
- implement the addon-consent rule;
- never claim a role/skill exists unless listed in the Team Manifest.

Do not generate a root `AGENTS.md` solely for Cline. The existing Codex fan-out continues to own that
bridge and its collision policy.

### 5.6 Projection ownership model

`projectedTo?: string[]` cannot safely represent compound projections because skill directories may
contain resources with no marker and multiple bundles may share a skill. Extend the lockfile without
breaking old readers:

```ts
export interface LockfileProjection {
  host: string;
  kind: 'role' | 'skill' | 'rule' | 'team-manifest' | 'bridge';
  canonical?: string;
  owners: string[];
  hash: string;
  installedAt: string;
  managedMarker: boolean;
}

export interface LockfileManifest {
  // existing fields unchanged
  projections?: Record<string, LockfileProjection>; // key = root-relative POSIX path
}
```

Rules:

- Continue populating existing `projectedTo` arrays for backward compatibility.
- `projections` becomes authoritative for new compound artifacts.
- Shared artifact paths merge `owners`; uninstalling one bundle removes only that owner.
- Delete the file only when `owners` becomes empty and marker/hash verification passes.
- Generated text files use marker verification. Byte-copied resources use the recorded hash.
- Never record directories; record files and remove only empty parent directories afterward.
- Old lockfiles without `projections` continue through the existing `projectedTo` path.

### 5.7 Capability report and activation strategies

```ts
export interface ClineCapabilityReport {
  installed: boolean;
  version?: string;
  command?: ResolvedClineCommand;
  namedTeams: boolean;
  rolePresetConsumer: 'detected' | 'not-detected' | 'unknown';
  diagnostics: string[];
}

export type ClineActivationStrategy =
  | 'named-team'
  | 'adaptive-session'
  | 'single-orchestrator';
```

Probe rules:

1. Resolve the executable without evaluating a shell command.
2. Run `version` with a short timeout.
3. Probe named teams with `--team-name agents-united-capability-probe version`. This does not start a
   model session or create team state in the verified CLI.
4. Do not infer features only from semver or help text.
5. Plugin/preset discovery may inspect managed Cline plugin manifests, but absence is informational.
6. Never authenticate, start a session, write config, or access the network during probing.

### 5.8 Safe process resolution and launch

Do not use `exec`, `execSync`, or `spawn(..., { shell: true })` with user-controlled arguments.
On Windows, direct `spawn('cline.cmd', args)` returns `EINVAL`, while `shell: true` is injection-prone.

Implement a `ResolvedClineCommand` abstraction that can represent:

```ts
type ResolvedClineCommand =
  | { executable: string; prefixArgs: string[]; source: 'env-binary' }
  | { executable: string; prefixArgs: string[]; source: 'node-wrapper' }
  | { executable: string; prefixArgs: string[]; source: 'path-executable' };
```

Resolution order (Windows-aware — must handle npm, pnpm, volta, fnm, and nvm layouts):

1. A valid absolute `CLINE_BIN_PATH` executable (environment variable; skip if unset or non-executable).
2. On Windows: locate `cline.cmd` on `PATH`. Derive the adjacent Node wrapper by checking, in order:
   - `<shim-dir>/node_modules/cline/bin/cline`
   - `<shim-dir>/node_modules/@cline/cline/bin/cline`
   If a wrapper JS file is found and readable, execute it as `process.execPath <wrapper> ...args`.
3. On POSIX, or when step 2 yields no wrapper on Windows: attempt to resolve a plain `cline`
   executable from `PATH` and use it as `path-executable`.
4. If all three steps fail, return a diagnostic object (do not throw); the caller emits an actionable
   install message and exits non-zero without mutating bundle state.

Always pass an argument array. Do not log environment values, API keys, or full child environments.
Inject a process-runner interface in tests so unit tests never launch real Cline.

### 5.9 `agents start` behavior

Register:

```text
agents start <bundle> [prompt]
  --host <host>        default: auto-detect from lockfile fanout (see below)
  --global             select global installation
  --team <name>        override generated team name
  --allow-addons       explicit addon-install consent for this session
  --headless           one-shot instead of interactive TUI
  --dry-run            print resolution/strategy/argv summary; launch nothing
```

Installation selection:

- Prefer the project Canonical Store when the bundle is installed both project and global.
- `--global` selects global explicitly.
- Require that the selected lockfile records `fanout: ['cline']` and that the Cline Team Manifest
  exists; otherwise print the exact repair command.
- For multiple ambiguous project records, interactive mode asks once; non-interactive mode fails with
  choices instead of guessing.

**Default host resolution (when `--host` is omitted):** inspect the lockfile `fanout` array.
- If exactly one projection-capable host is present, use that host.
- If `cline` is present in `fanout`, prefer `cline`.
- If `cline` is absent from `fanout`, emit a clear, actionable error:
  `Bundle '<bundle>' is not projected to Cline. Run 'agents update <bundle> --fanout cline' first.`
  Exit non-zero; do not guess or fall back silently to a different host.

Stable team name:

```text
au-<sanitized-bundle>-<first-8-sha256-of-resolved-workspace>
```

Allow only `[A-Za-z0-9_-]`, enforce Cline's safe identifier expectations, and cap the final name at
64 characters. `--team` must be validated with the same rule.

Bootstrap prompt requirements:

- identify the Team Manifest and coordinator role path;
- require reading both before acting;
- tell the coordinator to use installed specialist roles only when useful;
- state the selected addon-consent policy;
- append the user's task as data, without interpolating it into shell syntax;
- remain short enough to avoid duplicating all agent prompts in the initial context.

Launch arguments:

- Named team: `--team-name <stable-name> --cwd <workspace> -i [bootstrap]`.
- Adaptive fallback: `--cwd <workspace> -i [bootstrap]` and explicitly state that persistence is not
  guaranteed.
- `--headless` omits `-i` and runs one-shot.
- If no prompt is supplied, bootstrap asks the user for the task inside the opened TUI.

### 5.10 Post-install/update interaction

- Interactive add/update with a successful Cline compound projection asks:
  `Start the <bundle> team in Cline now?` with `Start`, `Copy command`, `Later`.
- `-y` prints `Start: agents start <bundle>` and does not launch.
- Add `--start` to add/update. It is invalid unless the resulting installation includes Cline fan-out.
- `-y --start` is valid because `--start` is explicit launch consent.
- `--dry-run --start` prints the setup and activation plans but launches nothing.
- **Non-TTY / non-interactive fallback:** if `process.stdin.isTTY` is `false` and neither `-y` nor
  `--start` is supplied, skip the interactive start prompt and print the short start instruction
  (identical to `-y` behavior). This prevents CI pipelines that pipe stdin from hanging on an
  unanswerable prompt.

---

## 6. Milestone execution plan

Each milestone is intended to be a separate reviewable PR into `dev`. Do not begin a later milestone
until the current milestone's focused tests and all three repository gates pass.

### Milestone 0 — Compatibility spike and ADR correction

**Files:** new `tests/cline-compatibility.test.ts` or a test fixture under `tests/fixtures/`; update
`docs/adr/0008-universal-host-projection-architecture.md` only after the spike proves assumptions.

1. Encode fixtures for the verified Agent Squad preset subset (`name`, `description`, body; optional
   provider/model/cwd/maxIterations).
2. Add a parser-probe test using an injected fake runner: help text may omit `--team-name`, but exit 0
   from `--team-name <probe> version` means named teams are accepted.
3. Record in ADR 0008 that its original assertion “Cline projected orchestrators degrade to system
   prompt + tool list subagents” was incomplete and that `.cline/agents` visibility is not a proven
   stock-loader guarantee.
4. Add the two-layer decision: compound setup plus explicit Runtime Activation.

**Stop condition:** if current released Cline source proves a different stable agent schema or a
native list/invoke API, stop and report the evidence before changing this plan's role format. Do not
silently redesign around undocumented behavior.

**Acceptance:** compatibility tests green; ADR distinguishes proven stock behavior from optional
preset compatibility; build/test/typecheck green.

### Milestone 1 — Types, Team Manifest, and projection ownership

**Files:** `src/core/types.ts`, new `src/core/cline-projector.ts`, new
`tests/cline-projector.test.ts`, extend lockfile schema/docs if present.

1. Write failing unit tests for deterministic Team Manifest generation:
   - correct coordinator from `BundleDefinition.orchestrator`;
   - inherited roles included once;
   - skills/workflows sorted deterministically;
   - `recommendedAddons` present for Essentials bundles and empty otherwise;
   - POSIX relative paths in project/global manifests.
2. Add the typed manifest and `LockfileProjection` shapes from §5.
3. Implement pure render/planning functions in `ClineProjector`; no filesystem writes in renderer
   tests.
4. Add backward-compat tests proving old lockfiles without `projections` parse and operate.

**Acceptance:** byte-identical repeated renders; no `any`; old lockfile fixture passes; gates green.

### Milestone 2 — Cline Compound Projection

**Files:** `src/core/cline-projector.ts`, `src/core/projector.ts`, `src/core/installer.ts`,
`tests/cline-projector.test.ts`, `tests/fanout.test.ts`, `tests/projector.test.ts`.

Write failing tests first for:

1. `--fanout cline` plans/writes:
   - `.cline/agents/<role>.md` with no `tools`, hooks, or Antigravity-only keys;
   - `.cline/skills/<skill>/SKILL.md` plus every auxiliary resource;
   - `.cline/rules/agents-united-<bundle>.md`;
   - `.cline/agents-united/teams/<bundle>.yaml`.
2. Role files contain the managed marker and Cline runtime preamble.
3. Skill `SKILL.md` remains valid YAML/frontmatter and Cline-discoverable.
4. Dry-run reports every artifact kind and writes nothing.
5. Existing non-Cline fan-out snapshots stay unchanged.
6. A foreign destination file fails without `--force` and remains byte-identical.
7. Re-running over managed files succeeds without `--force`.

Implementation constraints:

- Branch on host id/profile in `InstallEngine`; do not make generic hosts understand Cline's compound
  layout.
- Use the existing copy-only deployment rule.
- Do not add a new dependency.
- Update `ProjectionInfo` so CLI output can show `role`, `skill`, `rule`, and `team-manifest` kinds.

**Acceptance:** old Cline test assertions expecting Claude-style tools are replaced; full Cline
artifact tree and dry-run plan are deterministic; gates green.

### Milestone 3 — Compound lifecycle and migration

**Files:** `src/core/installer.ts`, `src/core/updater.ts`, `src/core/uninstaller.ts`,
`src/core/doctor.ts`, `tests/projection-lifecycle.test.ts`, `tests/uninstaller.test.ts`,
`tests/doctor.test.ts`.

Write failing integration tests for:

1. Updating an old Plan-007 lockfile with `.cline/agents/*.md`:
   - rewrites managed role files to the new schema;
   - adds skills/rule/manifest;
   - preserves `fanout: ['cline']`;
   - populates `projections` and compatible `projectedTo` entries.
2. User-modified old role files are skipped without `--force` and preserved exactly.
3. Shared skills/roles have two owners when two bundles use them.
4. Removing one bundle keeps a shared artifact and removes only its owner.
5. Removing the final owner deletes the artifact and empty managed directories.
6. Modified copied skill resources are hash-protected.
7. A second update is idempotent and needs no `--force` for managed files.
8. Removing a bundle leaves no obsolete `.cline/agents-united/teams/<bundle>.yaml` or rule file.

Migration must compare the previous owned artifact set with the newly desired set. Delete only stale
artifacts recorded as owned and verified by marker/hash; never glob-delete `.cline/`.

**Escape hatch:** if existing uninstall semantics cannot support shared canonical assets safely,
limit the new owner-refcount behavior to `lockfile.projections`; do not broaden the refactor to the
entire canonical lockfile in this plan.

**Acceptance:** install → update → remove leaves no owned Cline artifacts and preserves foreign/user
files; old lockfile fixtures remain supported; gates green.

### Milestone 4 — Capability probe and safe launcher core

**Files:** new `src/core/cline-capabilities.ts`, new `src/core/cline-launcher.ts`, new
`tests/cline-capabilities.test.ts`, new `tests/cline-launcher.test.ts`.

1. Define injectable `ProcessRunner` and filesystem/PATH resolution seams.
2. Test executable resolution for:
   - absolute `CLINE_BIN_PATH` executable;
   - Windows npm shim with adjacent Node wrapper;
   - POSIX executable;
   - not installed;
   - paths containing spaces.
3. Test named-team probing where:
   - help omits the flag but parser probe exits 0 → supported;
   - parser probe reports unknown option → unsupported;
   - timeout/nonzero version → diagnostic, no throw from probe.
4. Test project-over-global installation selection and explicit `--global`.
5. Test stable team-name generation, sanitization, length, and different workspace hashes.
6. Test argument arrays with prompts containing quotes, `&`, `|`, `%`, `$()`, and newlines. Assert
   these remain one argument and are never passed through a shell.
7. Test strategy selection and bootstrap content without launching a real model session.

**Security requirement:** process tests must fail if production code uses `shell: true` or builds a
single concatenated command string.

**Acceptance:** launcher core is pure/testable around injected side effects; Windows npm Cline is
resolved through the Node wrapper; no real Cline process in automated tests; gates green.

### Milestone 5 — `agents start`, `--start`, and minimal-interaction TUI

**Files:** `src/cli.ts`, `tests/cli-e2e.test.ts`, possibly a small CLI presenter helper if needed.

1. Register `agents start <bundle> [prompt]` and options from §5.9.
2. Add `--start` to add/update.
3. After successful interactive Cline setup, show the three-choice start prompt.
4. In `-y` mode print only the short start instruction unless `--start` is present.
5. Make `--dry-run` report selected installation, Cline command source, capability strategy, team
   name, and sanitized argv shape without showing secrets or launching.
6. Add e2e tests using `--dry-run` so CI does not require Cline:
   - `start` repairs instruction when fan-out is missing;
   - project install wins over global;
   - invalid host/team name exits nonzero with concise help;
   - add/update `-y` does not launch;
   - `--dry-run --start` writes/launches nothing;
   - output uses layman terms: “Cline team ready”, “Start”, “Cline not found”.

Do not import `node:child_process` directly into `src/cli.ts`; use `ClineLauncher`.

**Acceptance:** a user needs only `agents start software-engineering`; existing add/update behavior
without `--start` remains non-launching; gates green.

### Milestone 6 — Addon consent and team-aware recommendation

**Files:** `src/core/cline-projector.ts`, `src/core/cline-launcher.ts`, relevant registry/orchestrator
prompts only if required, `tests/cline-projector.test.ts`, `tests/cline-launcher.test.ts`, prompt
schema validation tests.

1. Include `recommendedAddons` in Team Manifest and coordinator rule.
2. Bootstrap with default policy:
   - explain the capability gap;
   - show the exact same-scope Cline install command;
   - ask for explicit confirmation before running it;
   - after install, re-read the Team Manifest before spawning the new role.
3. With `--allow-addons`, state that addon install is pre-authorized for this session only.
4. Project scope command: `agents add <addon> -t cline -y`.
5. Global scope command: `agents add <addon> -t cline -g -y`.
6. Do not persist `--allow-addons` in lockfiles or Team Manifests.
7. Add prompt assertions covering allowed and denied policies.

**Boundary:** this milestone defines and tests coordinator policy; it does not bypass Cline's own tool
approval system or modify Cline configuration.

**Acceptance:** no unconfirmed default addon mutation; same-scope commands are correct; gates green.

### Milestone 7 — Doctor, docs, domain language, and final real-world verification

**Files:** `src/core/doctor.ts`, `src/cli.ts`, `tests/doctor.test.ts`, `README.md`, `CONTEXT.md`,
`docs/adr/0008-universal-host-projection-architecture.md`, `plans/README.md`.

1. Add `agents doctor --host cline` while preserving plain `agents doctor`.
2. Report separately:
   - Cline compound artifacts installed/valid;
   - Cline executable/version found;
   - named-team parser support;
   - optional preset consumer status (`detected`, `not detected`, `unknown`);
   - chosen launcher fallback.
3. Never print “agents visible in Cline” unless a real listing API is verified. Preferred wording:
   `5 role definitions prepared; activation uses agents start`.
4. Add the domain terms in §3 to `CONTEXT.md` and correct the old claim that Cline projection is only
   `.cline/agents/*.md`.
5. Update README with the two-command contract and explain that Agent Teams are CLI/SDK/Kanban, not
   currently IDE extension behavior.
6. Final manual smoke test on a machine with Cline installed/authenticated (not CI):

```powershell
agents update software-engineering --fanout cline -y
agents doctor --host cline
agents start software-engineering --dry-run
agents start software-engineering "Map this repository and propose the first implementation task"
```

The paid/session-starting fourth command requires maintainer consent. Record version, chosen strategy,
and whether team state appears under the stable generated name; never record credentials.

7. Mark this plan DONE in `plans/README.md` only after all automated gates and the consented smoke test
pass.

**Acceptance:** docs match actual behavior; doctor makes no unsupported visibility claim; all gates
green; manual smoke evidence recorded without secrets.

---

## 7. Test matrix

| Test file | Tier | Required coverage |
| :--- | :--- | :--- |
| `tests/cline-compatibility.test.ts` | Unit/spike | upstream preset subset and parser-probe semantics |
| `tests/cline-projector.test.ts` | Unit | role, skill, rule, manifest rendering; determinism; field policy |
| `tests/fanout.test.ts` | Integration | complete Cline artifact tree, dry-run, collision safety |
| `tests/projection-lifecycle.test.ts` | Integration | old-lockfile migration, update idempotence, uninstall |
| `tests/cline-capabilities.test.ts` | Unit | command discovery, team probe, diagnostics, timeout |
| `tests/cline-launcher.test.ts` | Unit | installation choice, team names, strategies, safe argv, bootstrap |
| `tests/cli-e2e.test.ts` | E2E | `start`, `--start`, `--dry-run`, layman copy, no implicit launch |
| `tests/doctor.test.ts` | Integration | compound health, missing/modified artifacts, capability reporting |
| existing full suite | Regression | Claude/Cursor/OpenCode/Codex and canonical behavior unchanged |

At minimum, cover project and global scope, copy and symlink canonical methods, Windows path forms,
shared assets, old Plan-007 lockfiles, foreign files, missing Cline, team flag accepted-but-hidden,
and malicious-looking prompt strings.

---

## 8. Risks and mitigations

| Risk | Likelihood / impact | Mitigation |
| :--- | :--- | :--- |
| Cline docs/source/release drift | High / High | Capability probe; optional preset claim; stop condition; isolated adapter modules |
| Shell injection through prompt/team name | Medium / Critical | argument arrays only; Node-wrapper resolution on Windows; strict team-name validation |
| Deleting shared/user Cline skills | Medium / High | projection owner arrays, marker/hash verification, file-level tracking, no glob deletion |
| Always-on rule bloats context | Medium / Medium | concise index/activation rule; full prompts loaded on demand |
| Hidden `--team-name` behavior changes | Medium / Medium | parser probe each activation; adaptive fallback; do not rely on help text or semver |
| Starting paid sessions unexpectedly | Medium / High | `-y` never launches; explicit `--start`; interactive confirmation |
| Addon install mutates project unexpectedly | Medium / High | conversation confirmation or explicit `--allow-addons`; never persist consent |
| Global/project bundle ambiguity | Medium / Medium | project precedence, `--global`, fail rather than guess when still ambiguous |
| Lockfile growth from skill resources | Medium / Low | record only files, deterministic path map; correctness over compactness |
| Existing dirty working tree | High / High | mandatory drift check; never reset; milestone PRs isolate review |

---

## 9. Considered and rejected

1. **Make Agent Squad mandatory:** rejected. It is a private SDK example, not a published stock Cline
   contract, and would make Agents United own upstream plugin lifecycle/security.
2. **Only generate rules and omit roles:** rejected. Rules activate the bundle but lose reusable role
   boundaries and future/plugin compatibility. Roles remain prepared but are not advertised as picker
   entries.
3. **Continue Claude-style `tools` for Cline:** rejected. No verified Cline schema supports that list,
   and Cline runtime permissions/tools must remain authoritative.
4. **Auto-start after every `-y` install/update:** rejected. It can incur cost and is surprising in CI.
5. **Use `@cline/sdk` immediately:** rejected for this plan. It adds dependency/config/provider surface
   and duplicates installed CLI auth. Revisit only if the CLI stops exposing team activation.
6. **Use `shell: true` for `cline.cmd`:** rejected as command-injection prone. Resolve and execute the
   Node wrapper or platform binary with argument arrays.
7. **Write both `.clinerules/` and `.cline/rules/`:** rejected due duplicate context. Use current
   structured config and document the minimum supported Cline version after compatibility testing.
8. **Treat root `AGENTS.md` as the whole Cline integration:** rejected. It cannot model role ownership,
   installed skills, launch strategy, or persistent teams; Codex fan-out already owns that bridge.

This invocation used the focused `improve plan` variant; it did not perform a whole-repository audit.
Areas not audited include unrelated registry content quality, performance, dependency CVEs, release
security, and non-Cline projection correctness beyond regression boundaries.

---

## 10. Escape hatches

The executor must stop and report rather than improvise when any of these occurs:

1. A released Cline version exposes a documented native role registry/list/invoke schema that conflicts
   with §5.3.
2. The safe `--team-name <probe> version` command creates team state or starts/authenticates a model
   session in the tested release.
3. Windows Cline cannot be resolved without a shell and no safe platform binary/Node wrapper can be
   located.
4. Cline requires secrets/provider settings to be copied into project files. Never copy them.
5. Existing user `.cline/rules`, `.cline/skills`, or `.cline/agents` files collide without a managed
   marker and `--force` was not explicitly supplied.
6. Shared artifact ownership cannot be made deterministic without changing canonical uninstall
   semantics outside this plan.
7. The current working-tree implementation differs enough that Plan 007's lifecycle assumptions no
   longer hold.

In a stop report, include evidence paths and command outcomes, but never secret values.

---

## 11. Definition of done

All of the following are machine-checkable or explicitly observable:

1. `npm run typecheck`, `npm run build`, and `npm test` pass on Node 24 and Windows/Linux CI.
2. `agents add software-engineering -t cline -y --copy` creates the Canonical Store plus:
   - `.cline/agents/*.md` role definitions with no Claude-style tools;
   - all resolved `.cline/skills/**` files;
   - `.cline/rules/agents-united-software-engineering.md`;
   - `.cline/agents-united/teams/software-engineering.yaml`.
3. Every compound artifact is represented in lockfile projection ownership; shared owners work.
4. A repeat update needs no `--force`; uninstall removes all and only owned artifacts.
5. Old managed Plan-007 Cline projections migrate; user-modified/foreign files remain protected.
6. `agents start software-engineering --dry-run` selects the project install, reports a stable team
   name and activation strategy, and launches nothing.
7. `agents start software-engineering` opens Cline through a shell-free argument-array runner.
8. Prompts containing shell metacharacters remain one child-process argument in tests.
9. `-y` alone never opens Cline; `--start` or interactive confirmation is required.
10. `agents doctor --host cline` reports artifacts, executable/version, named-team support, and fallback
    without claiming unverified UI visibility.
11. Addon policy requires confirmation by default and honors ephemeral `--allow-addons`.
12. README, CONTEXT.md, ADR 0008, CLI help, and TUI copy use the domain language in §3 and accurately
    describe Cline CLI/SDK/Kanban scope.

## 12. Maintenance note

Cline is evolving quickly and its docs currently expose more capability than `--help` advertises.
Future maintainers must update the Cline adapter through capability tests first, not by changing the
Canonical Store or generic tool map. Review upstream changes to team flags, config paths, preset
schemas, and skill discovery together. Any new Cline artifact kind must participate in lockfile
ownership, dry-run planning, update migration, doctor checks, and uninstall in the same PR.
