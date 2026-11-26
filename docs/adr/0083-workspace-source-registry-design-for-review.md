# ADR 0083: Workspace Source Registry: design for review

- **Status**: Proposed, 2026-11-26. This is a draft for the design review that [Plan 052](../../plans/052-factory-maintainer-workbench.md) step 6 requires before any building. Nothing here is decided until the maintainer approves it, and nothing is built.
- **Builds on**:
  - [ADR 0046](0046-local-contributor-installation.md): Option A, a workspace source registry, accepted 2026-10-08.
  - [ADR 0045](0045-agent-factory-foundation-contract.md), [ADR 0048](0048-agent-factory-quality-and-contributor-tooling.md), [ADR 0033](0033-antigravity-skills-installed-as-copies.md), [ADR 0080](0080-factory-maintainer-workbench.md).
  - The proposed scenario table in `plans/033-agent-factory-bundle.md` (the local-lane section).

## Context

ADR 0046 chose Option A:

- Authored sources live in a user-selected workspace registry, separate from managed install outputs.
- An explicit selector installs copies into normal host paths and records source identity and hashes.

It left the selector, lockfile source identity, collision handling, update/removal and doctor treatment to "separately authorized and reviewed work" (ADR 0046, Consequences).

What exists today (read from `dev` at `f482025d`):

- **One seam.** `RegistryResolver(customRegistryDir?)` takes an internal directory; otherwise it finds the packaged `registry/` (`src/core/registry.ts`).
  - ADR 0045 calls this seam "not a user-facing local-registry flag".
  - No env var, `--source` flag or source descriptor exists.
- **One resolver for every command.** The CLI builds one module-level resolver.
  - The engines fall back to a new default resolver: `InstallEngine`, `InventoryScanner`, `UninstallEngine`, `UpdateEngine`.
  - `DoctorEngine` builds its own default resolver in six places, to read the bundles, translation ledger, MCP catalog and guard hook entry.
- **The lockfile cannot say where an asset came from.**
  - `LockfileAsset` records `hash`, `bundle`, `owners`, `method`, `installedAt` and `projectedTo`, with no source field.
  - Ownership is by bundle name only.
  - No code reads the lockfile's `version`.
  - `InstallEngine.readLockfile` turns a lockfile that does not parse into an empty one, silently.
- **Uninstall is already cautious.**
  - It removes tracked files only, and refuses a hash-changed copy without `--force`.
  - It never follows links.
  - It treats a bundle the registry no longer has as retired.
- **Copy vs link.** The default install method is a link: a junction on Windows for directories, falling back to a copy. A copy never writes through a link.
- **The name is already taken.** `--registry` already means the repository checkout on `contract-check`, `factory-check` and `bundle-check`. The words "source registry" carry the same meaning in ADR 0072 and several factory files.

## Proposed decisions (for review)

Each item gives the options, the proposal and the reason.

### P1. Install target

- **Options:**
  - (a) the state dir plus host projections, exactly as packaged bundles install today;
  - (b) host directories directly.
- **Proposal: (a).** Every lifecycle engine (install, update, uninstall, doctor, list) assumes the state dir and lockfile. A local bundle should be a normal managed bundle that differs only in its recorded origin.

### P2. Install method

- **Options:**
  - (a) copy only;
  - (b) link allowed on request.
- **Proposal: (a).** `--symlink` together with `--source` is refused.
- **Reason:** a link lets edits to an installed file write into the authored source (ADR 0033). The source must be changed by authoring, not by editing a managed projection (ADR 0046).

### P3. Selector

- **Options:**
  - (a) `--source <path>`;
  - (b) `--registry <path>`;
  - (c) a remembered workspace setting.
- **Proposal: (a), given per command for v1.**
  - `add` accepts it. `update`, `doctor`, `list` and `remove` find the source from the lockfile record (P5) and accept `--source` to point at a moved source.
  - The CLI builds the resolver per command, not once per process.
  - `--registry` keeps its current checkout meaning.

### P4. Source layout and self-containment

- **Options:**
  - (a) a source mirrors the `registry/` layout (`bundles.json`, `agents/`, `skills/`, `rules/`, `core/`, as ADR 0048 already assumes for private drafts) and is self-contained;
  - (b) a source may name packaged Skills or agents as pinned imports.
- **Proposal: (a) for v1.**
  - A source bundle resolves only inside its source. `parentBundle` may not cross sources.
  - Shared registry data that a bundle does not own (the MCP catalog, the translation ledger, the guard hook entry) is read from the packaged registry.
  - The review decides whether the bundle manifest check (`collectBundleManifestIssues`) applies unchanged or with private-bundle relaxations.

### P5. Identity and privacy

- **Options:**
  - (a) the lockfile records a source id the user chooses plus content hashes, and no absolute path; the path is given on the command line or kept in an uncommitted local file in the state dir;
  - (b) the lockfile records the path.
- **Proposal: (a).**
  - A project-scope lockfile may be committed, and an absolute path would leak a user's folder layout and break on any other machine.
  - "Source unavailable" becomes a normal, reportable state.

### P6. Collisions

- **Options:**
  - (a) refuse any name the packaged registry has;
  - (b) refuse, with a user-chosen rename recorded (ADR 0046).
- **Proposal: (b) for the bundle name only.**
  - Skill, agent and rule names are refused outright on collision, because host paths and native files key on them.
  - A rename is recorded in the lockfile with the original name.

### P7. Lockfile shape and migration

- **Options:**
  - (a) stay at `version: 1` with additive optional fields: a `sources` map from id to the identity/hash record, and an optional `source` on each bundle record and asset;
  - (b) bump to `version: 2` with a migration.
- **Proposal: (a).**
  - An absent `source` means packaged, so every existing lockfile keeps its meaning.
  - Ownership compares `(source, bundle)` pairs, so a local bundle and a packaged namesake never cover each other's files.
  - The doctor warns about records whose source this CLI does not know.
- **Open:** how an older CLI treats such a lockfile. It would see an unknown bundle as retired. The review decides whether that is acceptable or needs a guard.

### P8. Corrupt lockfile

- **Options:**
  - (a) keep the silent empty fallback;
  - (b) refuse to install over a lockfile that does not parse, and name the file.
- **Proposal: (b), as its own small slice before the installer slice.** Source records make a silent reset more damaging, and the doctor already reports "Corrupt lockfile".

### P9. Doctor, update and uninstall states

Proposed findings and behaviour:

| State | Doctor | Update | Uninstall |
|---|---|---|---|
| Source available, unchanged | ok | no-op | normal |
| Source available, changed (hash differs) | warning: source changed | reinstall from source after preview | normal |
| Source unavailable | warning: source unavailable (distinct from damaged files) | refused, names the source id | allowed: tracked, hash-checked files only, as for a retired bundle |
| Source overlaps a managed destination | issue | refused | normal |
| Installed file edited | issue (as today) | refused without `--force` (as today) | refused without `--force` (as today) |

- Update never silently switches a bundle's origin between source and packaged.
- A changed source is detected by hash, not by a version label.
- The doctor's six default resolvers go through one source-aware lookup.

### P10. Native lane

- **Options:**
  - (a) out of v1;
  - (b) Claude native files from `<source>/hosts/claude`.
- **Proposal: (a).** Claude is the first follow-up, after the generic lane is proven.

## Risks

- **Uninstall safety:**
  - A link-method install writes into the source (P2 removes this).
  - Name-only ownership can cross-delete a namesake's files (P7 removes this).
  - The retired-bundle path has never been exercised for a vanished source, so it needs tests.
  - The installer has no rollback, and the lockfile is written once at the end. An interrupted apply needs a defined result: either the lockfile written last, describing only what landed, or a preview/apply hash recheck.
- **Lockfile migration:** the silent reset of a corrupt lockfile (P8); older CLIs reading new fields (P7); absolute paths in committed lockfiles (P5).
- **Windows:**
  - Overlap and traversal checks need realpath and case-insensitive comparison.
  - CRLF checkouts change content hashes against Linux CI, so tests use fixed LF bytes or normalize.
  - File links may need privilege (P2 avoids links).
- **Scope:** the work spans the CLI, installer, updater, uninstaller, inventory and doctor. Every slice from the installer on needs the full serial gate.
- **Naming:** "source registry" already means the checkout in factory text. Code uses "workspace source", and `CONTEXT.md` gains the terms Workspace Source and Source Id.

## Out of v1

- Option B, a user-level source shared across workspaces.
- Pinned imports of packaged assets (P4 b).
- Native lanes for sources (P10).
- Link installs (P2).
- Other hosts' factory stages.
- A remembered workspace selector (P3 c).

## Slice plan after approval, tests first

Each slice: its own branch from fresh `dev`; red tests, then code; one independent review; push at the maintainer's word.

0. **Docs.** This ADR's status becomes Accepted, with the review's answers. `CONTEXT.md` terms; `docs/artifact-contribution.md` amendment.
1. **Pure model.** `src/core/workspace-source.ts`: load, validate, self-containment, identity and hashes, realpath overlap and traversal refusal. Tests: `tests/workspace-source.test.ts`, with Windows-path and CRLF cases.
2. **Corrupt lockfile refusal (P8).** `src/core/installer.ts`, with its tests.
3. **Selector.**
   - `src/cli.ts` builds a resolver per command and adds `--source` on `add`.
   - Tests: `add --source --dry-run` leaves files and the lockfile untouched; the default-path tests stay unchanged.
4. **Installer and lockfile.**
   - Copy method, collision refusal and rename, source records, optional fields in `src/core/types.ts`.
   - Tests: `tests/workspace-source-install.test.ts`, plus an extended ownership-refcount test.
5. **Doctor (P9).** One source-aware lookup, plus the findings for a changed, unavailable or overlapping source.
6. **Update, uninstall and inventory (P9).** Includes the vanished-source and namesake cases.
7. **Factory and docs.** The contributor reference, the built-versus-design split in `docs/artifact-contribution.md`, and a hand-over to the contributor runbook (Plan 052 step 7).

## Review agenda

1. P1 and the meaning of "normal host paths".
2. P4: source layout and shared registry data.
3. P5: identity and privacy.
4. P3: selector surface.
5. P2 and P6: installer behaviour, collisions, interrupted apply.
6. P7 and P8: lockfile shape, migration, older CLIs.
7. P9: lifecycle states.
8. The Windows and CRLF test matrix.
9. The out-of-v1 list and the slice order.
10. Authorization: ADR 0046 requires each slice to be authorized separately.

## Consequences

- If accepted: local bundles become ordinary managed bundles with a recorded origin, and existing lockfiles keep their meaning.
- Cost: every lifecycle engine gains source awareness, which is the largest change in Plan 052.
- Until it is accepted and built, contributors keep using user-chosen draft output (ADR 0045) and the upstream PR route.
