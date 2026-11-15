# Sync Job Record (`host-update-sync-job`)

## Purpose

A sync job record ([../assets/sync-job.schema.json](../assets/sync-job.schema.json)) defines one bounded host-library update check for a single host (any kebab-case host name, 1..32 characters, e.g. `claude`). Before starting `factory-sync`, the caller runs `node <installed skill folder>/scripts/check-sync.mjs --job <absolute sync job>` in preflight mode, which validates the job against disk, git `HEAD`, and lockfile state and prints one JSON line on stdout carrying the 64-hex SHA-256 `jobDigest`. The caller passes both the absolute path of the sync job record and that `jobDigest` to `factory-sync`.

## Top-Level Fields

| Field | Type | Requirement |
| --- | --- | --- |
| `version` | `1` | Fixed integer schema version. |
| `kind` | `"host-update-sync-job"` | Fixed discriminator. |
| `id` | Kebab-case string | Job identifier echoed as `jobId` in the resulting plan. |
| `host` | Kebab-case string (`1..32` chars) | Host whose library updated. |
| `source` | `{ checkout, head }` | Repository checkout path and 40-hex git `HEAD` commit. |
| `roots` | `{ workspace, evidence }` | Contained workspace and evidence roots (`evidence` inside `workspace`, disjoint from `checkout`). |
| `library` | `{ lock, previousLock }` | Each carries `{ path, sha256, bytes }` for the current (`<checkout>/host-library/<host>/library.lock.json`) and previous (inside `roots.evidence`) lock files. |
| `changedInputs` | Array | Unique library entries (`{ path, oldSha256, newSha256 }`) inside `<source.checkout>/host-library/<host>`; `oldSha256` and `newSha256` cannot both be `null` or equal. |
| `heldSources` | Array | Held library entries (`{ path, lockedSha256, candidateSha256, rule, reason }`) inside `<source.checkout>/host-library/<host>`. |
| `targets` | Array | Caller-supplied realizer job pins (`{ path, sha256, bytes }`), each pointing to a target realizer job JSON file. |

## What `factory-sync` Reads

1. Read the sync job JSON file at the caller-supplied absolute path.
2. For each `targetPin` in `targets` (preserving array order), read the target realizer job JSON file at `targetPin.path`.
3. From each target realizer job record, inspect `id` (`1..128` chars), `source.checkout`, `artifact` (`{ type, definition, paths }`), and `inputs` (`[{ kind, path, sha256 }]`, non-empty); other fields of the record are ignored.
4. Never compute SHA-256 digests or run shell commands inside `factory-sync`; trust the preflight-verified digests recorded in the job and target records, and state the honest limits on caller-supplied inputs in the hand-off.
