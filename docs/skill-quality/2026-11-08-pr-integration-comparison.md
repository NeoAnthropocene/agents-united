# Integration comparison and publication scope — 2026-11-08

## Fresh upstream comparison

Fetched `origin/dev` before preparing publication. It resolves to
`e0dd6a7c947c27047c94e1ca28f43b5da8b725f7`, the merge of PR #215. The integration
checkout's HEAD is the same commit: `git rev-list --left-right --count
HEAD...origin/dev` returned `0 0`. The implementation is in the working tree,
so that commit comparison alone does not mean there is no work to publish.

The preserved original checkout is on `codex/motion-follow-up-slices` at
`0b9a382`, two commits behind this fresh upstream. The publication checkout is
`codex/host-media-integration-2026-11-07`, cut from the newer upstream. It already
contains PR #215's Host router and Plans 049/050. The audit-policy proposal is
therefore Plan 051; the upstream numbering and router implementation are kept.
No new upstream changes or merge conflicts were found in this publication
comparison. Neither `dev` nor the original dirty checkout was reset or changed.

## Included changes

| Area | Result relative to fresh dev |
| --- | --- |
| Motion production | Canonical audio binding, measured event handoffs, treatment/approval guidance, proportionate source-rights evidence, compact readiness and offline diagnostics, contained ESM dependencies and selected-frame/range previews. |
| Upstream-only Remotion Skills | Retires twelve copied official Skill trees and their wrapper Bundle; keeps original production helpers and provides the compatible direct-upstream route. Safe uninstall retains edits and co-owned assets. The package contains zero retired paths. |
| Optional 3D production | Arda's Claude-native role, shared Core/contract, four Skills, original GLB/viewer/PNG production and fingerprint-bound Motion handoff, project/lifecycle helpers and maintainer exercise preparation. Phase F expansion stays deferred. |
| Host libraries and session tracking | Accepted-source updates for Claude, Antigravity and Cline; reviewed deltas and other-Host implementation notes; class-derived Claude task grants and truthful session/revision tracking across all 18 native roles; subprocess-only launcher opt-in respects explicit opt-out. |
| Dormant router distribution | All 37 Bundles explicitly carry `host-agent-router`, `handoff` and `git-guardrails`; lead clauses preserve user opt-in without department preload. Includes the narrowly required factory direct-entry compatibility repair and exact-router Vitest loader fix. |
| Evidence and follow-up | Maintainer session audits, scoped human acceptance, Plans 046–048/050–051, ADRs and the fresh-branch [follow-up prompt](2026-11-08-follow-up-prompt.md). |

The pre-staging inventory contained 229 modified and 137 deleted tracked files,
plus 121 untracked files. Documentation prepared for publication adds to that
inventory; the final PR diff is authoritative for final counts. The 137
deletions are the recorded retirement, not accidental lost files. A comparison
found no original changed/untracked existing file missing from the integration
checkout. Differences between the checkouts are the upstream router integration,
reviewed Host updates, factory expectations, final evidence and privacy edits;
the old checkout is not a source to overwrite the newer tree wholesale.

## Verification and boundaries

The [final verification receipt](2026-11-08-final-verification.md) records native
typecheck, package/archive and full test exits 0: 257 suites, 5,167 tests passed,
210 skipped, with watched source unchanged. All 317 extended lifecycle cases
passed separately against unchanged matrix inputs. The optional real-CLI 3D
kit installation case also passed separately. The current code, test and
audit-ratchet inputs were compared to the frozen passing tree before publication;
only documentation preparation and privacy redactions followed the full gate.
Linux PR CI is a separate verification boundary until its actual result exists.

Three vendor documents remain held by explicit maintainer choice: Claude MCP,
Claude VS Code and Antigravity's full web changelog. Production audit policy,
their locked snapshots and allow entries remain unchanged. Plan 051's prototype
passed 24/26 and is **NOT READY**, including an unsafe false negative; it is not
adopted or used to clear a source. Revised live instructions, unprompted router
non-invocation, untested platforms and broader creative/rights claims remain
**unverified** in their documented scopes.

Publication review removed remaining historical account headroom, reset times
and balance readings from Plans 045/046/048. Pre-redaction records remain in
ignored private scratch; session costs and technical evidence are preserved.
Raw Host transcripts, completed media projects, quarantined source candidates,
dependency folders, archives and private spending checkpoints are excluded from
the PR. The credential-shape scan is a heuristic supplement to staged review,
not a guarantee. No Host/model CLI, production provider or release is started
by this publication work.

## Next work after merge

Use a fresh worktree cut from freshly fetched `origin/dev` only after verifying
that it contains this PR's merge. Follow the linked prompt to reconcile remaining
046/047 observations without repeating accepted production, dispose of Plan
050's live/platform limits, and independently assess Plan 051's negative result
before proposing any new policy. Local completion and scoped acceptance must
not be rewritten as universal live conformance or source clearance.
