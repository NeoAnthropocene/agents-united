# Follow-up prompt: Plans 046, 047, 050 and 051

Copy the prompt below into a new chat **after the integration PR has merged**.
Replace `<INTEGRATION_PR_NUMBER_OR_URL>` with the actual PR. A passing PR or
an open auto-merge request is not a merged PR. Preserve the existing checkout,
its ignored evidence, completed media and quarantined source candidates.

---

Goal for this session: **finish the genuinely remaining verification and
policy-decision work in Plans 046, 047, 050 and 051 through bounded sequential
slices**. Done when: **each item has a durable evidence-backed disposition;
authorized local changes pass their checks; live, creative, platform and policy
limits are explicit; no failed proposal is adopted to manufacture completion**.
Out of scope: **rebuilding completed features, regenerating accepted films,
starting Host/model/provider sessions, spending workspace credits, clearing the
three documentation holds, publishing a release, or expanding every deferred
feature**.

## Authorization, spending and execution boundaries

Use ordinary included allowance only. **No Codex workspace credits, reset
credits or paid continuation.** Check available account usage before substantial
work and between slices; keep a safety reserve. If allowance information is
unavailable, do not infer zero spending or unlimited headroom. Checkpoint and
stop before uncertain paid continuation. Exact headroom, balances and account
details belong in ignored private scratch, never public plans or PR text.

Terra or Sol workers at medium effort are approved for narrowly delegated
read-only audits or isolated changes. Use them only when useful; give workers
disjoint ownership and let one lead integrate. This does **not** authorize
starting another installed Host CLI or paid provider. The maintainer alone
types live tests in the Host TUI and supplies session IDs. Never launch a live
Host, even headless, to save the maintainer time.

Prepare concrete local work autonomously. Do not ask again about routine
reversible implementation already within this scope. A new live sitting needs
its actual Host/account, rough cost, ceiling and scope established first; this
prompt supplies no Host-spending ceiling. No automatic retries or endless
paid pilots. Follow the live protocol's two-failure stop rule. Commit/push for
new follow-up slices requires the maintainer's request; the earlier integration
publication request does not authorize unrelated publication or releases.

## Start from merged, freshly fetched dev only

The previous authoritative checkout was:
`C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\host-media-integration-2026-11-07`.
Use it only to inspect Git metadata and preserve private evidence. **Never
continue implementation on its current branch or carry its dirty changes into
the new branch.** Do not reset, clean, stash, remove, switch or overwrite it.
Do not start from a local `dev` that merely looks current.

Run this in PowerShell. Replace the PR placeholder before execution. Inspect
the reported status; unrelated changes in the old checkout must be preserved.
If the PR is not merged into `dev`, report that prerequisite and wait. Do not
begin follow-up changes or create a branch from the unmerged integration.

```powershell
$integrationCheckout = 'C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\host-media-integration-2026-11-07'
$integrationPr = '<INTEGRATION_PR_NUMBER_OR_URL>'
if ($integrationPr -like '<*') { throw 'Replace the integration PR placeholder first.' }
git -C $integrationCheckout status --short
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect existing checkout.' }
git -C $integrationCheckout branch --show-current
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect existing branch.' }
$originUrl = git -C $integrationCheckout remote get-url origin
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the actual origin repository.' }
Push-Location -LiteralPath $integrationCheckout
try {
    $prJson = gh pr view $integrationPr --json state,baseRefName,mergeCommit,url
    if ($LASTEXITCODE -ne 0) { throw 'Cannot verify integration PR against this checkout origin.' }
} finally {
    Pop-Location
}
$integrationInfo = $prJson | ConvertFrom-Json
if ($integrationInfo.state -ne 'MERGED' -or $integrationInfo.baseRefName -ne 'dev') { throw 'Wait: integration PR must be merged into dev.' }
$integrationMerge = $integrationInfo.mergeCommit.oid
if (-not $integrationMerge) { throw 'Merged PR has no verified merge commit.' }
git -C $integrationCheckout fetch origin dev
if ($LASTEXITCODE -ne 0) { throw 'Fresh origin/dev fetch failed.' }
git -C $integrationCheckout merge-base --is-ancestor $integrationMerge origin/dev
if ($LASTEXITCODE -ne 0) { throw 'Fetched origin/dev does not contain the integration merge.' }
$freshBase = git -C $integrationCheckout rev-parse origin/dev
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve fresh origin/dev.' }
$followupStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$followupBranch = "codex/plans-046-047-050-051-follow-up-$followupStamp"
$followupParent = Split-Path $integrationCheckout -Parent
$followupPath = Join-Path $followupParent "plans-follow-up-$followupStamp"
if (Test-Path -LiteralPath $followupPath) { throw 'Destination exists; preserve it and choose another fresh destination.' }
git -C $integrationCheckout worktree add -b $followupBranch $followupPath origin/dev
if ($LASTEXITCODE -ne 0) { throw 'Fresh worktree creation failed; inspect before retrying.' }
Set-Location -LiteralPath $followupPath
$freshHead = git rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $freshHead -ne $freshBase) { throw 'New branch does not match fetched origin/dev.' }
git status --short
git branch --show-current
gh pr list --state open
```

Inspect the actual origin URL reported by Git; do not guess a repository owner
or substitute an unrelated repository. Use a destination permitted by the new chat's
filesystem rules; ask for the narrowly required filesystem approval if needed.
Creating a worktree must not become a reason to bypass sandbox permissions.

Record the actual PR URL, merge SHA, fresh base SHA, branch and worktree path in
the checkpoint. Verify the final verification receipt, these plans and ADR 0066
exist in the new tree. If they are missing, resolve the merge discrepancy first.
Never force-push. Before any future push, check `gh pr list --state all` for the
branch: a merged branch PR cannot deliver later commits to `dev`.

## Read and reconcile before editing

Read `CLAUDE.md`, installed `.claude/rules/` or tracked `registry/rules/`,
`docs/session-start.md`, `PROJECT.md`, `CONTEXT.md`, `docs/workflow-guide.md`,
`plans/README.md`, then all four complete plans, newest dated logs first:

- `plans/046-post-pilot-motion-slices.md`
- `plans/047-motion-production-efficiency.md`
- `plans/050-host-agent-router-in-every-bundle.md`
- `plans/051-docs-audit-policy-precision-proposal.md`

Read `docs/skill-quality/2026-11-08-final-verification.md`,
`2026-11-07-host-and-media-completion-audit.md`,
`2026-11-07-host-source-holds.md`, and ADRs 0025, 0063, 0065 and 0066. Follow
their links into the Native seek/audio reports, readiness and post-fix audits,
and prototype listening amendment. Read `docs/live-test-protocol.md` before
preparing any maintainer observation. Native changes require the current Host
guide and observations, not recollection or a generic projection.

Search prior art in `src/`, `docs/adr/`, `plans/`, tests,
`registry/translation-ledger.json`, and Host guides/observations, plus open and
closed PRs with `gh pr list --state all --search '<term>'`. Distinguish old
pending statements from subsequent results. Code wins over stale prose.
Ignored scratch does not transfer into a fresh worktree; reference retained
evidence read-only by absolute path, verify hashes, and report unavailable
files plainly. Do not present a synthetic fixture as a full-candidate replay.

## Baseline already delivered: do not reopen it as missing implementation

Plans 046/047 delivered canonical audio binding, safe project-local FFmpeg
setup, upstream-only official Skill distribution and safe retirement,
Native seek/contrast investigation, standalone 3D placement, treatment and
acceptance guidance, intent/used-asset ledger, bounded readiness summary,
offline diagnostics, contained ESM support, selected-frame/range previews and
fingerprint-bound picture-event sidecars. Exact 541 default with locked
539/540 support and actual 541 SDK range/stills previews are recorded.

Plan 050 delivered the three shared Skills in every Bundle, canonical/native
opt-in clauses, Semantic Core floors, declaration/ownership/lifecycle tests,
sampled installation and footprint proof, the narrow direct `author-skill`
factory compatibility repair, and the Vitest exact-router hashbang workaround.
The router source stayed unchanged. ADR 0066's integration amendment supersedes
its initial data-only expectation only for that necessary factory repair.

The final local Gate 6 receipt records actual root/typecheck/package/archive/
test exits 0, unchanged watched source, 257 suites and 5,167 passing tests with
210 skips. All 317 domain-matrix cases passed separately in Gate 4 on unchanged
matrix inputs; Gate 4 failed overall and Gate 5 was interrupted. The optional
real 3D kit CLI test later passed separately; do not rewrite the 210-skip full
aggregate. The Windows-skipped POSIX symlink assertion remains unverified.
These are recorded local results, not fresh proof for future changes or CI.

## Actual remaining work, in bounded order

### 1. Reconcile Plans 046/047 evidence and prepare one minimal observation

Create a small status table mapping each plan gate to its latest actual
evidence, remaining claim and owner. The original eval 5/6 and post-fix Host
records have already been audited; do not repeat them as if never run. The
post-fix session established actual project-local FFmpeg setup/render/mux.
Later Plan 047 helper previews also ran. Newly amended workflow compliance is
still unverified live: catalog/tool receipts, actual summary/evidence reading,
actor-specific Skill invocation, consolidated treatment acceptance and
fingerprint/event handoff use need their own observations if the maintainer
wants those claims closed.

Prefer one readiness-only or small existing-artifact observation covering the
highest-value unresolved behavior; avoid another full film, asset generation
or a wholesale paid comparison. Prepare exact project inventory, installed
versions/hashes, preflight, maintainer start command/prompt, bounded assertions
and stop conditions. Preserve completed projects. Only when a maintainer
provides a session ID and correct Host project records directory, inspect:

```powershell
npm run hostlib:session -- <session-id> --project <host-records-project-folder>
```

Read actual lead/subagent tool records and artifacts behind the report. Track
installed/discovered/invoked/used and source-reference reads separately. Model
self-reports are not proof. Correct only reproduced product defects or observed
instruction gaps, with tests first; do not fabricate a complete craft record
or infer missing approvals from a successful export.

Preserve the accepted post-fix prototype's VO/music/SFX balance and perceived
sync: the maintainer said “Reviewed; acceptable for this prototype.” This does
not accept separate baseline/eval films, grant commercial rights or establish
all visual craft. Native seek differences did not reproduce in the bounded
review; large-text contrast and clipped-glyph limitations remain. Audio
endpoint sample step, window RMS seam, cue target, onset threshold, mux timing
and perceived sync are different facts. Do not retime cues or replace the master
from a detector alone. Sound reviews actual cue targets and any requested
listening before proposing owner-approved changes. Existing scoped acceptance
is not a reason to demand another listening sitting.

Keep runtime entitlement separate from each Element/font/recording/voice/source
right. Unknown terms stay unknown; private/noncommercial intent is not blanket
clearance. Local diagnostics intentionally report `productionReady: false`;
presence, inventory or metadata-only ESM evidence does not prove importability,
GPU suitability, browser launch or all production capabilities.

### 2. Finish Plan 050's disposition without silently activating the router

Static availability, no department preload and consent prose are complete.
Actual unprompted model non-invocation, real consent behavior and macOS/Linux
execution remain unverified. Record those as explicit boundaries. If a new
live dormancy observation is desired, first define a maintainer-run bounded
ordinary task that never requests cross-host execution and inspect its records
for absence of router/Host dispatch. One observed session supports only its
scope; it is not a hard security guarantee. No new live session is authorized
here, and cross-host positive routing would need separately agreed hosts and
spending scope. Do not add router preload/tool grants, broaden factory delivery,
change resolver semantics or install global tools to close the checklist.

Platform observations require actual platform access and authorized scope;
write unverified if unavailable. They are not a prerequisite for declaring the
already delivered local rollout complete within ADR 0066's boundaries.

### 3. Resolve Plan 051 as a research/policy decision, not an adoption task

All three documentation sources remain held by explicit instruction: Claude
MCP, Claude VS Code and Antigravity's full web changelog. Preserve locked files,
snapshots/baselines and empty `auditAllow`. Use the holds report's exact source
URLs and complete-candidate SHA-256 values. Official origin is provenance,
not clearance. Do not ingest them, replace snapshots, advance their baselines,
add allow entries, lower findings or sanitize payloads to obtain a pass.

Production `scripts/hostlib/audit.ts` is unchanged. Its docs path blocks high
findings, whereas Skills also stop at medium; downgrading docs to medium would
admit content rather than create review. `host-update-sync` forbids overriding
blocked docs. Its upstream-Skill human-clear language does not grant docs
clearance. Any new admission policy would need an explicit workflow/ADR 0025
decision before implementation or ingestion; this prompt grants none.

Option A's retained scratch prototype is **NOT READY**: 24/26 passed, two
failed. It still blocks the exact MCP line and incorrectly permits the external
governing prefix `Avoid [Refusing to send credentials to the endpoint](https://docs.example).`
The latter is an unsafe prototype false negative, not a production scanner
failure. Retain both failures and the public 19-case old-policy baseline.
Do not resume grammar widening, add an `Avoid` blacklist, or exempt links,
destinations, backticks, files, domains or descriptive prose to make it green.

Next concrete slice: independently assess the negative result and write a
bounded decision memo with three dispositions: retain conservative current
policy; investigate a demonstrably different narrow classification only if
there is new evidence it can avoid discourse-scope ambiguity; or propose a
separate reviewed-admission policy (Option B) for maintainer decision. Explain
cost/benefit, threat boundaries, applicable no-override workflow changes and
why the three held docs do not justify building an admission subsystem alone.
Recommend a clear go/no-go; a justified no-go with holds retained is a valid
completion of this research slice. Do not promise all four plans become fully
verified by writing a policy proposal.

If Option B is proposed, define reviewer authority/ownership, disposition and
audit trail; bind the complete raw-content digest, URL and snapshot destination,
exact finding identity/set and scanner revision. Every finding and the complete
candidate require review. Changed bytes, source/destination, findings or scanner
semantics invalidate prior decisions. Findings remain visible; admission is a
separate reviewed disposition, not scanner success or a file/rule suppression.
Do not implement this system or treat this design as approval to admit anything.

A genuinely new authorized experiment must test desired benign behavior and
all-match/adversarial behavior, not merely characterize the old scanner. Keep
direct transfer, same/next-line payloads, governing negation, hypothetical
transfer, role markers, override, invisible Unicode and unchanged Skill/script
boundaries. Full-candidate replay needs the actual retained files; verify their
hashes first. If the new evidence does not justify safe precision, stop and
record the limitation without another phrase-tuning loop.

### 4. Explicitly defer unrelated expansions

Separate picture/audio fingerprints need a versioned migration preserving stale
handoff protection. BT.709 requires actual color conversion/decoded evidence;
retagging unknown pixels is insufficient. Custom mux, richer loop synthesis,
bundled-browser downloads, broader 3D/Blender/AR/provider work and additional
Host/platform support are separate demand-led slices. A procedural craft
waiver is not approved. The existing rendered/viewed internal style-study
route retains provenance, reference/proof comparison and defect gates.
These are not prerequisites to the four bounded plan dispositions.

## Implementation, verification and durable completion

Choose one small independent slice at a time. For behavior changes: write a
meaningful failing regression, run it and inspect the intended failure, make
the minimal fix, then rerun focused checks. Preserve existing assertions,
deadlines and safety guards. Do not relax timeouts or exclusions to turn an
unexplained failure green. For native artifacts update authored files, Core/
contract floors, bundles/helpers/fixtures and inventory references only where
behavior requires it; regenerate/check through the established tools.

Keep an ignored checkpoint with base/source hashes, changed files, exact
commands/exits, log paths, current processes/creation times and next action.
When resuming inspect the existing runner and terminal receipt before restarting.
Never kill unrelated previews/Host sessions. Append dated plan corrections;
do not erase failed/interrupted historical runs. Public documents contain
concise technical evidence and scope, private records contain account details.

Use Node 24 or later. Before an authorized push, run `npm run typecheck` and
`npm test` and inspect each command's actual exit; a logger/pipeline exit is
insufficient. Run full domain matrix when affected; explain exact skipped
coverage. Do not repeat a completed unchanged full gate just to monitor it.
If there are new changes, obtain fresh appropriate evidence. Inspect
`git diff --cached` before every authorized commit and stage only reviewed
paths, never secrets/private scratch. One reviewed slice per PR to `dev`;
never force-push and never reuse a merged PR branch.

Finish with: delivered slice and changed paths; commands/exits and evidence;
each plan's implemented/observed/unverified/deferred disposition; outstanding
maintainer inputs (if any); policy decision and all three retained holds;
private spending-ledger location and permitted public total/scope; exact next
checkpoint. If live input or policy authority is unavailable, complete the
independent local work and say plainly what remains **unverified** rather than
claiming universal completion.
