# Hand-off and Honest Limits

## Return Format (`SubagentHandback`)

When `factory-sync` finishes deriving the adaptation plan:

1. Return the complete `host-update-sync-plan` JSON record conforming to [../assets/sync-plan.schema.json](../assets/sync-plan.schema.json), with a concise summary of the honest limits below. Use `SubagentHandback` when the Host supplies it; otherwise put the identical record in the ordinary final response.
2. `ReportFindings` is optional and never replaces the record: use it only to present per-artifact stale-pin observations beside the complete plan.

The caller writes the returned plan JSON to disk inside `roots.evidence` and runs `node <installed skill folder>/scripts/check-sync.mjs --job <absolute sync job> --result <absolute plan>` in postflight mode, which recomputes the plan from the sync job and target records, prints one JSON line on stdout, and rejects any mismatch in `jobId`, `host`, `jobDigest`, `artifacts` (other than each artifact's `reason` text), `changedPins`, `heldPins`, `unpinnedChanges`, `heldSources`, or required status constants. The postflight also refuses a plan file that is not directly in `roots.evidence` or is the job file, one over the 262144-byte cap, one without `version: 1` or `kind: "host-update-sync-plan"`, and one outside the schema's bounds (more than 256 `artifacts`, `changedPins` or `unpinnedChanges`, more than 64 `heldPins` or `heldSources`, or a `reason` outside 1..512 characters).

## Required Constants

Every returned plan must set:
- `proposalOnly: true`
- `implemented: false`
- `heldSourcesAdvanced: false`
- `quality: "pending"`
- `live: "unverified"`
- `heldSources[].disposition: "not advanced, no action"`

## Honest Limits (Must Be Stated Plainly)

Every hand-off must state these four boundaries without overclaiming:

1. **Target list completeness is caller-supplied and cannot be proved**: Neither `factory-sync` nor `check-sync.mjs` scans the repository for unlisted artifacts; `artifacts` and `unpinnedChanges` are relative only to `job.targets`.
2. **Untracked `oldSha256` values are caller claims**: The old hash (`oldSha256`) of a changed input that `library.lock.json` does not track (a guide, an observation) is the caller's claim, and the checker cannot verify it; `pinnedAtPrevious` compares each target's pin against that caller-declared `oldSha256`.
3. **Nothing is implemented by a plan**: `host-update-sync-plan` is a read-only adaptation proposal (`proposalOnly: true`, `implemented: false`, `heldSourcesAdvanced: false`, `quality: "pending"`). Realizing any affected artifact requires separate realizer and evaluator runs.
4. **Live Host behaviour is `unverified`**: Static pin comparison never proves runtime Host execution (`live: "unverified"`).
