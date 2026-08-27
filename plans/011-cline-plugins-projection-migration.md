# Plan 011: Migrate Cline Projection to Native Plugins (v4.0.0+)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8a5f8fb..HEAD -- src/core/cline-projector.ts src/core/cline-launcher.ts src/core/installer.ts src/core/updater.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 008
- **Category**: migration
- **Planned at**: commit `8a5f8fb`, 2026-08-27

## Why this matters

Cline 4.0.0 introduced a native Plugin architecture and a Customize marketplace, moving away from the implicit loading of custom agents and skills dropped directly into the `.cline/` workspace directory. To remain compatible with modern Cline versions and provide atomic enable/disable controls, Agents United bundles must be projected as fully packaged local Cline Plugins (complete with a `package.json` manifest) rather than scattering files. This allows the user to manage the bundle seamlessly through Cline's native UI.

## Current state

**LockfileProjection Tracking** (`src/core/types.ts:91-99`):
```ts
export interface LockfileProjection {
  host: string;
  kind: ProjectionKind;
  canonical?: string;
  owners: string[];
  hash: string;
  installedAt: string;
  managedMarker: boolean;
}
```

**ClineProjector Output** (`src/core/cline-projector.ts:181-184`):
```ts
    const artifacts: PlannedClineArtifact[] = [];
    const baseDir = scope === 'global' ? '.cline' : '.cline';

    // 1. Role definitions (.cline/agents/*.md)
```

**Installer Projection Application** (`src/core/installer.ts` - `applyFanout` method):
Currently iterates over `fanout` hosts and calls `ClineProjector.planCompoundProjection`, tracking each artifact individually.

**ClineLauncher Activation** (`src/core/cline-launcher.ts:221-226`):
```ts
    const child = spawn(plan.executable, plan.argv, {
      cwd: plan.workspace,
      stdio: 'inherit',
      shell: false,
    });
```
*Note: Launcher does not currently run a plugin install step.*

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npm run typecheck`      | exit 0, no errors   |
| Build     | `npm run build`          | exit 0, no errors   |
| Tests     | `npm test -- cline`      | all pass            |

## Scope

**In scope**:
- `src/core/types.ts`
- `src/core/cline-projector.ts`
- `src/core/cline-launcher.ts`
- `src/core/installer.ts`
- `src/core/updater.ts`
- `tests/cline-projector.test.ts`
- `tests/cline-launcher.test.ts`
- `tests/projection-lifecycle.test.ts`

**Out of scope**:
- Modifications to non-Cline projectors (e.g., Claude Code, Cursor, OpenCode).
- Changes to the canonical `.agents/` store schema.

## Git workflow

- Branch: `feature/011-cline-plugins-migration`
- Commit message style: conventional commits (e.g., `feat(cline): project bundles as native plugins`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Define Plugin Manifest Types
In `src/core/types.ts`, add the `ClinePluginManifest` type for the `package.json` shape. Append this to the file:

```ts
export interface ClinePluginManifest {
  name: string;
  version: string;
  description: string;
  cline: {
    plugins: Array<{
      paths?: string[];
      capabilities: string[];
      skills?: string[];
    }>;
  };
}
```
Add `'plugin-manifest'` to `ProjectionKind` union type as well.

**Verify**: `npm run typecheck` → exit 0

### Step 2: Refactor ClineProjector for Plugin Output
Modify `ClineProjector.planCompoundProjection` (`src/core/cline-projector.ts`) so that instead of targeting `.cline/agents/` and `.cline/skills/`, it targets a self-contained plugin directory: `.agents/plugins/<bundle-name>/`.
1. Update `baseDir` inside the function to `.agents/plugins/${bundle.name}`.
2. Continue projecting roles, skills, and rules into this new `baseDir` (e.g., `.agents/plugins/<bundle-name>/skills/<skill>/**`).
3. Add a new artifact to `artifacts` array that writes `package.json` at the root of `baseDir`. The content must be JSON-stringified `ClinePluginManifest`:
```json
{
  "name": "agents-united-<bundle-name>",
  "version": "1.0.0",
  "description": "<bundle-description>",
  "cline": {
    "plugins": [
      {
        "capabilities": ["skills", "tools", "workflows"],
        "skills": ["./skills"]
      }
    ]
  }
}
```

**Verify**: `npm test -- cline-projector.test.ts` → all pass (You will need to update test assertions to expect `.agents/plugins/` instead of `.cline/`).

### Step 3: Implement Lifecycle Migration
Update `updater.ts` (`performUpdate`) and `installer.ts` (`applyFanout`) to handle the new directory structure:
- No structural changes are strictly required here if `ClineProjector` outputs standard `PlannedClineArtifact`s with updated `relPath`s, but you must ensure that legacy `.cline/` artifacts are properly removed during `updater.ts`'s diffing process.

**Verify**: `npm test -- projection-lifecycle.test.ts` → all pass (Update the expected paths in the tests).

### Step 4: Update ClineLauncher Activation
In `src/core/cline-launcher.ts`'s `planActivation` method:
- The `argv` must be updated to instruct the user to install the plugin before starting the team. Since we cannot safely run multiple commands in one `spawn`, we will append a CLI instruction to the user's `bootstrapPrompt`:
  - Append to `bootstrapPrompt`: `"Before proceeding, ensure you have installed this bundle's plugin by running: cline plugin install .agents/plugins/<bundle-name>"`

**Verify**: `npm test -- cline-launcher.test.ts` → all pass

## Test plan

- **Unit Tests**: Run `npm test -- cline-projector` to assert the generation of a valid `package.json` and the correct directory structure (`.agents/plugins/<bundle-name>/`).
- **Integration Tests**: Run `npm test -- projection-lifecycle` to test migrating a lockfile that has old `.cline/` projections to the new plugin structure.
- **Verification**: `npm run typecheck && npm test` → all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] `grep -rn ".cline/agents/" src/core/cline-projector.ts` returns no matches
- [ ] `grep -rn "ClinePluginManifest" src/core/types.ts` returns matches
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- The code at the locations in "Current state" doesn't match the excerpts.
- You discover `installer.ts` or `updater.ts` assumes all projections live exactly in `.cline/` and breaking that assumption causes tests to fail in a way that touches out-of-scope files.

## Maintenance notes

- Since the Cline Plugin architecture is relatively new (v4.0.0+), the schema might evolve. The generated `package.json` should be validated against future Cline releases.
