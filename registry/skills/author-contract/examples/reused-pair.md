# Worked example: exact reuse, then a scoped update

An existing `subagent-review-notes` pair already matches the caller's job. Its core has CRLF line endings and an author note, and the companion uses a different JSON key order. The caller validates the selected original registry, pins both files and supplies reuse mode with a separate absent output root. The writer copies both byte-for-byte. Reformatting them would be an unnecessary semantic-review diff.

Suppose the permitted Skill list contains `review-checklist`, but this shared-only task does not need its source. An empty job binding list produces an unavailable optional finding; it does not force a preload or prevent a valid shared pair. If the caller explicitly requires that source for this task, its missing/changed pin blocks preparation. A present source still leaves execution unverified.

Later the caller authorizes a mission wording update. The draft now contains both core files, `notes.md` and any previously retained notices. Snapshot every file into the separate evidence root, recording each path/length/hash and immutable snapshot pin. Restrict `allowedPaths` to the core file and supply its complete revised `coreText`; preserve the author note as a protected fragment. Do not silently rewrite the companion or delete the unrelated note.

The writer checks the full live/snapshot baseline, stages the complete result, rechecks before replacement and returns only the actual changed-file diff plus unchanged inventory. A stale user note, altered snapshot, link, lost protected fragment or out-of-scope contract proposal blocks the update while preserving current bytes. The caller reconstructs that comparison and runs `contract-check` on final output.

For adapted source, inspect repository/path/full commit, actual licence/source/comparison and required notices first. Retain declared notice bytes in the pair body or an unchanged baseline file, with attribution review pending. If a new required third file is missing, this helper cannot add it; return the exact scope/prerequisite issue rather than dropping the notice.

The final hand-off states which shared semantics changed and which native consumers still need separate realization. It claims no loading, behavioral improvement, evaluator execution, publication or live spending.
