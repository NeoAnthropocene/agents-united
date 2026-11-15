# Adaptation Plan Derivation (`computePlan` Rules and Field Order)

## Library-Relative Path Join

In `scripts/check-sync.mjs` (`computePlan`), the join proceeds in this order:

1. **Job library root and path rules**: The sync job's library root is `<job.source.checkout>/host-library/<job.host>`. The job's own relative paths follow the path rules of the machine the checker runs on: every path in `job.changedInputs` and `job.heldSources` is expressed as a relative path with forward slashes from that library root (together with its lower-cased form). Each target's paths follow the form of that target's own checkout (item 2), and case is ignored when the checker runs on Windows or the target is Windows form. As a hint for the worker only, not a rule of the checker: the form of the job's checkout path (a drive-letter prefix such as `C:\...` or `C:/...`, or a `\\...` prefix, or a single leading `/`) usually shows which machine that is.
2. **Target path form**: For each target realizer job record in `job.targets`, `computePlan` chooses the path form from that target's own `source.checkout`:
   - **Windows form**: `target.source.checkout` starts with `<drive-letter>:/`, `<drive-letter>:\`, or `\\`.
   - **POSIX form**: `target.source.checkout` starts with `/` and not `//`.
3. **Containment inside the target's library**: Using that target's chosen path form, `computePlan` forms `<target.source.checkout>/host-library/<job.host>` and counts an entry in `target.inputs` only when it lies inside `<target.source.checkout>/host-library/<job.host>` in that form. Inputs outside that directory are skipped.
4. **Relative key with forward slashes**: For each counted target input, `computePlan` takes its relative path from `<target.source.checkout>/host-library/<job.host>` with forward slashes (`/`), ignoring case when the checker runs on Windows or the target is Windows form, and preserving exact case otherwise.
5. **Comparison with job inputs**: `computePlan` compares each counted target input's forward-slash relative path against each `job.changedInputs` and `job.heldSources` entry's forward-slash relative path — ignoring case when the checker runs on Windows or the target is Windows form, and matching exact case otherwise.

## Per-Artifact Derivation (`artifacts` Array)

Iterate `job.targets` (`targetPin` at index `index`, with parsed realizer job `target` at that same index) in exact array order:

1. **`changedPins`**: Iterate `job.changedInputs` in exact array order. Let `match` be the counted entry in `target.inputs` inside `<target.source.checkout>/host-library/<job.host>` whose relative key matches `changed.path`:
   - If a counted input matches (`match` exists) and `(changed.newSha256 === null || match.sha256 !== changed.newSha256)`, mark `changed.path` as pinned-stale and append one entry. Two entries as they appear in `changedPins` (the first pin was current before the change, the second belongs to a page that was deleted):
     ```json
     [
       {
         "kind": "snapshot",
         "path": "/workspace/repo/host-library/claude/pages/agent/sub-agents.md",
         "pinnedSha256": "1111111111111111111111111111111111111111111111111111111111111111",
         "oldSha256": "1111111111111111111111111111111111111111111111111111111111111111",
         "newSha256": "2222222222222222222222222222222222222222222222222222222222222222",
         "pinnedAtPrevious": true
       },
       {
         "kind": "guide",
         "path": "/workspace/repo/host-library/claude/guide/agent.md",
         "pinnedSha256": "3333333333333333333333333333333333333333333333333333333333333333",
         "oldSha256": "4444444444444444444444444444444444444444444444444444444444444444",
         "newSha256": null,
         "pinnedAtPrevious": false
       }
     ]
     ```
     `kind` is `match.kind`, `path` is `changed.path`, `pinnedSha256` is `match.sha256`, and `oldSha256` and `newSha256` are copied from the job: each is a 64-hex string or `null` (a JSON `null`, never a quoted string). `pinnedAtPrevious` is `match.sha256 === changed.oldSha256`, so it is `false` when the pin predates the old hash or `oldSha256` is `null`.
   - If a counted input matches (`match` exists) and `changed.newSha256 !== null && match.sha256 === changed.newSha256`, omit it from `changedPins` (and do not mark `changed.path` as pinned-stale from this target). If no counted input matches, nothing is appended and `match` is never read.
2. **`heldPins`**: Iterate `job.heldSources` in exact array order. If `match` is found in `target.inputs` inside `<target.source.checkout>/host-library/<job.host>` with the matching relative key for `held.path`, append `{ "path": held.path, "pinnedSha256": match.sha256 }`.
3. **`affected`**: Set `affected: changedPins.length > 0`. Held pins alone (`changedPins.length === 0`) always produce `affected: false`.
4. **`reason`**: Non-empty string (`1..512` chars) explaining the stale changed pins or why the artifact is unaffected.

Each element of `artifacts` preserves this exact field order:
- `job`: `{ "path": targetPin.path, "sha256": targetPin.sha256 }`
- `jobId`: `target.id`
- `artifact`: `{ "type": target.artifact.type, "definition": target.artifact.definition, "paths": target.artifact.paths }`
- `affected`: boolean
- `changedPins`: array
- `heldPins`: array
- `reason`: string

## `unpinnedChanges` and `heldSources`

- **`unpinnedChanges`**: Every `changed.path` in `job.changedInputs` (preserving `job.changedInputs` array order) that was not marked as pinned-stale by any target.
- **`heldSources`**: In `job.heldSources` order, emit `{ "path": held.path, "lockedSha256": held.lockedSha256, "candidateSha256": held.candidateSha256, "disposition": "not advanced, no action" }`.

## Top-Level Plan Field Order ([../assets/sync-plan.schema.json](../assets/sync-plan.schema.json))

1. `version`: `1`
2. `kind`: `"host-update-sync-plan"`
3. `jobId`: `<job.id>`
4. `host`: `<job.host>`
5. `jobDigest`: `<caller-supplied 64-hex preflight digest>`
6. `proposalOnly`: `true`
7. `implemented`: `false`
8. `heldSourcesAdvanced`: `false`
9. `quality`: `"pending"`
10. `live`: `"unverified"`
11. `artifacts`: `[...]`
12. `unpinnedChanges`: `[...]`
13. `heldSources`: `[...]`
