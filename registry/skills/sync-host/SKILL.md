---
name: sync-host
description: "Use when deriving a read-only host-update adaptation plan from a preflighted sync job record and target realizer job records after host-library changes; trigger phrases: sync-host, host-update sync, adaptation plan, changed host-library inputs, held sources. Skip when realizing or editing an artifact, refreshing the documentation library, or clearing a hold."
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Sync Host

## Overview & Purpose

`sync-host` is the read-only runbook for the `factory-sync` subagent. Given the absolute path of a caller-prepared sync job record ([assets/sync-job.schema.json](assets/sync-job.schema.json)) and the 64-hex `jobDigest` printed in the one-line JSON output by the caller's preflight run of `node <installed skill folder>/scripts/check-sync.mjs --job <absolute sync job>` ([scripts/check-sync.mjs](scripts/check-sync.mjs)), the worker reads the sync job and every target realizer job record in `targets`, joins pinned inputs and held sources by library-relative path under each record's `<source.checkout>/host-library/<host>`, and returns one `host-update-sync-plan` JSON record ([assets/sync-plan.schema.json](assets/sync-plan.schema.json)). It never edits files, never executes commands, never computes hashes, and never clears or advances held sources.

## Execution Triggers

Run this skill only inside the `factory-sync` subagent when handed a fixed sync job path and caller-held `jobDigest`. The caller runs `${CLAUDE_SKILL_DIR}/scripts/check-sync.mjs` (`node <installed skill folder>/scripts/check-sync.mjs --job <absolute sync job>` for preflight and `--job <absolute sync job> --result <absolute plan>` for postflight); never try to run it from inside the worker (the read-only guard blocks shell execution) or to modify target artifacts.

## Input/Output Requirements

- **Input**: Absolute path to a `host-update-sync-job` JSON file ([references/job.md](references/job.md)) validated against [assets/sync-job.schema.json](assets/sync-job.schema.json), plus the 64-hex `jobDigest` from the one-line JSON printed by the caller's preflight run (`node <installed skill folder>/scripts/check-sync.mjs --job <absolute sync job>`).
- **Output**: One `host-update-sync-plan` JSON object ([references/plan.md](references/plan.md) and [references/handback.md](references/handback.md)) conforming to [assets/sync-plan.schema.json](assets/sync-plan.schema.json), echoing `jobId`, `host`, and `jobDigest` and setting `proposalOnly: true`, `implemented: false`, `heldSourcesAdvanced: false`, `quality: "pending"`, and `live: "unverified"`. The caller saves the plan and runs `node <installed skill folder>/scripts/check-sync.mjs --job <absolute sync job> --result <absolute plan>` for postflight verification.

## Step-by-Step Runbook

1. **Read the sync job record**: Read the caller-supplied sync job JSON file and confirm `version: 1`, `kind: "host-update-sync-job"`, `id`, `host`, `source`, `roots`, `library`, `changedInputs`, `heldSources`, and `targets` ([references/job.md](references/job.md)).
2. **Read each target realizer job record**: In the exact `targets` array order, read each `targetPin.path` and inspect its `id`, `source.checkout`, `artifact` (`type`, `definition`, `paths`), and `inputs` (`kind`, `path`, `sha256`); other fields of the record are ignored.
3. **Join changed inputs and held sources by library-relative path**: Apply the exact `computePlan` join rules and field ordering documented in [references/plan.md](references/plan.md), matching [scripts/check-sync.mjs](scripts/check-sync.mjs).
4. **Compose per-artifact reasons and held dispositions**: Give every target artifact a concise factual `reason`, record `unpinnedChanges`, and mark every entry in `heldSources` with `disposition: "not advanced, no action"`.
5. **Hand-off the plan record**: Return the `host-update-sync-plan` JSON object via `SubagentHandback` ([references/handback.md](references/handback.md)), following the worked example in [examples/one-sync.md](examples/one-sync.md).

## Code & Config Exemplars

This fragment shows the constant plan fields and one held-source disposition; the complete record, with its digests, is in [examples/one-sync.md](examples/one-sync.md).

```json
{
  "proposalOnly": true,
  "implemented": false,
  "heldSourcesAdvanced": false,
  "quality": "pending",
  "live": "unverified",
  "heldSources": [
    {
      "disposition": "not advanced, no action"
    }
  ]
}
```

## Edge Cases & Error Recovery

- **Anti-pattern — advancing or editing a held source**: Never clear a hold, advance a held source hash, or propose editing a held source; every held source must carry `disposition: "not advanced, no action"`.
- **Target pinned only to a held source**: If a target has `heldPins.length > 0` and `changedPins.length === 0`, set `affected: false` and explain in `reason` that only held sources match and no action is taken.
- **Deleted library page (`newSha256: null`)**: Any target pinning that path has a stale pin (`changed.newSha256 === null`) and is marked `affected: true`.

## Verification Checklist

- [ ] `jobDigest` matches the caller-supplied 64-hex preflight digest verbatim, and the returned plan conforms to [assets/sync-plan.schema.json](assets/sync-plan.schema.json).
- [ ] `artifacts`, `changedPins`, `heldPins`, `unpinnedChanges`, and `heldSources` preserve the exact ordering and join rules in [references/plan.md](references/plan.md).
- [ ] Honest limits are stated in hand-off: target list completeness is caller-supplied, untracked `oldSha256` values are caller claims that the checker cannot verify, nothing is implemented by a plan, and live Host behaviour is `unverified`.
