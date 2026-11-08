# Plan 048: Tracked Host refresh and Claude session tracking

**Latest status, 2026-11-08:** The integrated local gate passed with skips and separate matrix proof; see the [final verification receipt](../docs/skill-quality/2026-11-08-final-verification.md). All three source holds remain, and revised Host adherence is **unverified live**. The dated gate and branch checkpoints below are historical.

Status, 2026-11-07: accepted-source refresh and Claude-first local adaptation
are implemented. The earlier post-eval1 full gate passed; the later hardening
has 518 affected tests passing, but its complete regression encountered three
lifecycle timeouts. Isolated reproductions and a subsequent serial confirmation
passed on the pre-integration tree; current integrated gate status is in the
[completion audit](../docs/skill-quality/2026-11-07-host-and-media-completion-audit.md).
Eval1 demonstrates foreground task/Skill use on Claude 2.1.319;
eval2b demonstrates ordinary-worker production and handoff. Amended live
adherence, broader team surfaces and the full Host refresh remain **unverified**.
Three upstream sources are still held. Plan 045's pilot families are executed.
The review checkout is `codex/host-media-integration-2026-11-07` at base
`e0dd6a7`; earlier branch and base references below are historical checkpoints.

## Scope and evidence

The user requested current Claude and Antigravity libraries, changes for all
actively tracked Hosts, a Claude-first adaptation plan including efficient
session tracking, and then completion of Plans 044/045. Exactly three libraries
have `sources.json`: Claude, Cline and Antigravity. Codex, Cursor and OpenCode
have under-development registry entries without equivalent snapshot baselines;
`agents` and `gemini` are projection targets, not additional reviewed libraries.
Do not invent release deltas for those surfaces.

Use `host-update-sync` for audited snapshots and `realize-for-host` for native
artifacts. No agent starts a real Host session, including headless sessions.
The maintainer's later exception permits Cline Pass orchestration workers for
this task only; it does not authorize agent-started Claude pilot sessions.
The safe installed `claude --version` probe returned 2.1.318. That is executable
metadata, not a workflow observation. Three Terra/medium workers split the
tracked libraries; the lead owns integration and the activation change.

Detailed evidence:

- [Claude delta](../docs/skill-quality/2026-11-06-claude-host-library-delta.md)
- [Antigravity delta](../docs/skill-quality/2026-11-06-antigravity-host-library-delta.md)
- [Active Hosts and Cline delta](../docs/skill-quality/2026-11-06-active-hosts-delta.md)
- [Plan 044/045 gap audit](../docs/skill-quality/2026-11-06-plan044-045-gap-audit.md)

## Changes and disposition

| Surface | Reviewed change | Action and limit |
| --- | --- | --- |
| Claude task tracking | Current model-dependent defaults; TaskCreate/Get/List/Update or legacy TodoWrite, with explicit opt-in | Adopt in the Claude pilot; do not assume tools merely from frontmatter or confuse background notifications with todo updates. |
| Claude worker surfaces | Ordinary background subagents filter out Task tools; team teammates have an exception; split panes have separate inheritance rules | Discover actual tools per session/surface and retain a concise handoff fallback. |
| Claude context and lifecycle | Forks differ from fresh subagents; TaskOutput was removed in 2.1.277; Monitor availability changed in 2.1.310 | Correct guide facts and audit role references; do not grant removed tools. |
| Claude hook failures | Documented onFailure fail-closed opt-in from 2.1.295 | Plan a version-gated guard adoption; existing callback tests do not prove Host handling of missing scripts or runtime errors. |
| Claude frontmatter | autoCompactWindow is documented from 2.1.296 | Record an exact delta against the pinned 2.1.285 profile; do not advertise it as supported by that older profile. Evaluate it for long-running workers after versioned profile support. |
| Claude file controls | New file-tool outside-write control from 2.1.314 | Record for a later version-gated adoption; it is not subprocess or Blender isolation. |
| Claude MCP | Current release notes conflict with the older custom-base-URL search default | Keep stale guidance explicitly version-bound; retain the two held pages and do not claim full MCP review. |
| Cline | Updated subagent, plugin callback/error policy, scheduling, Skill and discovery documentation | Correct guides and verification metadata. Distinguish the historical configured-agent policy from current built-in Act subagents; do not infer current read-only or fail-closed guarantees. |
| Antigravity | /teamwork, direct subagent messages, per-turn Skill discovery, SessionStart, revised permissions | Correct guides and record implementation notes. /tasks tracks background processes, not Claude-style durable todos. The initial missing `agy` observation is superseded by the [command baseline amendment](#2026-11-07--command-baseline-advanced-after-complete-review); runtime behavior remains unverified. |

## Claude-first pilot

1. Give the original 17 Claude roles their complete class-derived coordination
   grant. Nine lacked the task-tracking class despite instructions referring to
   shared tasks. Keep read-only file restrictions and all existing guard tests.
2. For multistep work, main agents prefer available structured Task tools, reuse
   returned IDs and accepted slice ownership, and maintain truthful blockers and
   completion evidence. Single-step work needs no unnecessary task list.
3. Workers use only their assigned task when available. Ordinary background
   workers may instead have TodoWrite or neither family. A local todo list must
   not masquerade as the lead's shared list; missing tracking goes into handoff.
4. A consultation assignment is not production authorization. Check blockers
   before starting, re-read changed deliverables before completion, and never
   mark unfinished work complete merely because a turn ended.
5. Offer task tools for standalone launcher sessions as well as teams using only
   the subprocess environment. Preserve an inherited explicit opt-out and the
   existing Task-vs-TodoWrite selector. Do not persist settings or add these
   variables to argv. An API opt-out skips the launcher's additional opt-in; it
   does not promise removal of tools already provided by the Host.

[ADR 0064](../docs/adr/0064-claude-session-task-tracking.md) records this scope.
Native behavior above the compatible existing floors changes; task capability
metadata is added only to the missing cores. Other Hosts gain no invented task
tool mappings. Current tests explicitly compare their grants and preserve
read-only ceilings.

## Other Host implementation notes

- **Cline:** keep configured-agent versus built-in subagent APIs separate. Before
  adopting current SDK hooks, test the exact callback API and error policy;
  historical runtime hook stages and current plugin callback names are different
  catalogs. Revalidate guards on the target surface. Do not translate Task tools
  or TodoWrite by name into Cline.
- **Antigravity:** use its named delegation and messaging protocol; verify the
  actual CLI/App task facility. Test SessionStart registration before using it;
  preserve native no-agent-frontmatter-hook constraints until actually changed.
  A permission preset is not proof of Blender Python isolation.
- **Codex, Cursor, OpenCode:** first establish official sources and reviewed
  native package coverage before claiming adoption of newly released features.
  Follow the repository's Claude-first sequence; retain under-development status
  and existing projection behavior. No unsupported task adapter is shipped here.
- **Generic agents/Gemini projections:** retain documented projection semantics;
  do not count them as independently reviewed Host libraries.

## Security holds and baselines

Claude MCP mcp.md and vs-code.md failed the existing documentation audit;
Antigravity's full web changelog failed a historical role-marker check. The
quarantined content can be analyzed as data, but it is not silently ingested or
used to claim a clean full refresh. The unchanged snapshots and baseline values
remain honest. No token, credential, audit override or global configuration is
needed for the accepted-source refresh.

Current guides cite approved locked snapshots and explicitly identify older
claims. `hostlib:verify` checks integrity/citations, not semantic completeness or
current runtime behavior. Retaining a baseline is not evidence of no releases.
The reports enumerate newer releases, held sources and reviewed dispositions.

## Verification and continuation

- Observe RED before launcher/native changes; preserve all existing class,
  guard, floor, lifecycle and projection assertions.
- Verify all three libraries, current source citations, task grants for all
  roles, foreground/background distinctions and read-only ceilings.
- Test launcher env/argv/no-write discipline, standalone and team cases,
  inherited opt-out and fallback instructions without launching Claude.
- Repair refreshed-heading parsers while still asserting complete documented
  vocabularies and explicit version deltas. Do not add newer keys to old pinned
  profiles merely to make a test pass.
- Run fresh typecheck and the full suite before any requested publication.
  Separate static/fake-runner proof from live sessions.

After the Host pilot is locally verified, reconcile Plan 044's delivered local
work and remaining observation boundaries. Continue Plan 045 B–D with the actual
self-contained Arda package, GLB/viewer/PNG proof and installed Motion lifecycle;
Phase E remains maintainer-run. Do not substitute the Phase A synthetic role
fixture for useful 3D production or start a paid Host sitting.

## Progress

Snapshots and guides were refreshed through the audited pipeline, with the
explicit holds above retained. Native task policy and launcher changes have
focused RED/GREEN evidence. The launcher/session run passed 32 tests (actual
exit 0). Native roles passed 102 checks; tier-two passed 350; refreshed-profile
parser checks retain exact old-versus-new distinctions. Integration and the full
gate remain pending until their actual exits are inspected.


### Local integrated Host gate

All three libraries pass hostlib:verify. Fresh typecheck exited 0, then the
combined ten-file Host/profile/native/launcher run passed 581 tests (exit 0).
The launcher RED had three intended failures; default standalone opt-in,
explicit/inherited opt-out, argv and team independence now pass. Parser changes
retain exact documented current vocabularies plus named version deltas; they
do not grant new frontmatter/events to older pinned profiles. Read-only file
restrictions and all existing guard assertions remain.

The full gate is source-frozen and records actual exits plus source hashes,
including all changed Host-library snapshots, under
scratch/host-refresh-2026-11-06/verified-*. Do not claim full-suite completion
from the focused results. No Arda production source has been added yet.


## Included-allowance checkpoint

Machine-local account readings and reset times are retained privately. The
prior explicit no-workspace-credit continuation instruction remains in force.
Stop model work with a reserve; do not mark the full goal complete at this
historical checkpoint.

Current full gate: unified session 45416, runner PID 34748, started
2026-11-06T09:13:28.5408660Z. Fresh typecheck exit 0; inspect
scratch/host-refresh-2026-11-06/verified-gate-status.json and the actual handle
before deciding whether another run is needed. A previous running field alone
is not liveness. The local CPU run may finish after model work pauses. Source
was frozen, including Host-library paths; no full pass is yet claimed here.

Completed local work: all three audited libraries/guides and delta reports,
retained three security holds and version baselines, Claude tracking guidance
and grants across all 17 roles, standalone launcher opt-in and truthful worker
fallbacks, profile/source-format compatibility assertions, library verification,
typecheck and 581 affected tests (all actual exits 0). No commit, push, real Host
session, provider job or global configuration change.

Next: inspect this exact full gate and any failure details before source edits.
Then review/apply scratch/3d-phase-b-draft-2026-11-06/README.md and its package
files, with required TDD and real dependency packaging. The saved draft passed
JSON/YAML, Semantic Core and four-field contract checks in isolation, but is
not installed or runnable and contains explicit helper placeholders. Complete
Plan 045 B–D before the maintainer-run E. Do not count Phase A fixtures or the
draft as GLB/viewer/PNG output. All three workers are finished.

Additional reader follow-up before the next live pilot: the new SDK guide
describes raw TaskUpdate id/task_id aliases; the current session reporter reads
taskId. Scope and regression-test native-record normalization before relying
on repaired-alias calls in a future session audit; do not claim a new SDK app.

### Resumed allowance checkpoint

The resumed allowance check required another pause. Model work paused again
under the maintainer's no-credit-continuation instruction; exact account
telemetry is retained privately.
Polling existing unified session 45416 returned that same live handle with no
new output; the saved runner status still records typecheck exit 0 and no
terminal test result. Preserve this run and inspect its actual completion on
resume. No full-suite pass, Plan 045 B–E completion, commit or push is claimed.

### 2026-11-06 — resumed implementation and gate correction

The original frozen gate finished at 09:46:28Z with typecheck exit 0,
source-unchanged true and test exit 1: 241 files passed, three failed; 4,907
tests passed, three failed, 209 skipped. The three failures were retained
expectations for an empty non-team environment, Antigravity's retired
teamwork-preview command and the lead's TaskCreate/TaskGet discovery list.
Assertions now cover the intended new default, exact command replacement and
TaskGet inclusion while preserving the other opening-message requirements.
The affected three-suite rerun passed **252/252**, actual exit 0.

The session reporter now reads TaskUpdate taskId/id/task_id with documented
precedence and derives TaskCreate IDs only from successful observed results.
Missing creates, unobserved tasks and unknown blockers remain unresolved;
they do not become invented sequential tasks or assumed completed blockers.
Its 72-test suite and hostlib TypeScript check passed. Alias fixtures are
synthetic and source-derived; live native alias behavior is **unverified**.

Plan 045 B and bounded C/D implementation followed this gate. A new frozen
typecheck/full regression run covers the combined tree, including all new
Host, reporter and 3D paths: unified session 23200, runner PID 23148, durable
status `scratch/3d-final-gate-2026-11-06/verified-gate-status.json`. It started
2026-11-06T10:08:31.3718884Z and is not yet a completed pass. The separately
explicit 3D runtime matrix passed 47/47 with no skips. Retain the three source
audit holds and existing version baselines; no held snapshot was overridden.

### Final combined-gate continuation

Session 23200 was intentionally terminated (actual exit -1) to include Plan
045's required renderer-code identity guard. Its partial output is retained;
no full pass was inferred. The guard and its 51-case explicit runtime suite
are now verified. The replacement frozen gate is session 8414 / PID 8628,
started 2026-11-06T10:21:03.8484243Z, with fresh typecheck exit 0 and full tests
pending. Its status/logs and source snapshots are in
`scratch/3d-final-gate-r2-2026-11-06/`. Preserve this source snapshot until its
actual terminal result is inspected. Plan 045 contains the two live process
handles and remaining maintainer-run boundary.

### 2026-11-06 — final local verification and ready handoff

The r4 gate completed at 2026-11-06T18:19:39Z: typecheck exit 0, test exit 0, **254 suites passed; 4,971 tests passed and 210 skipped**, with watched source unchanged. The later resume check independently matched all **418** watched path/hash records; 137 intentionally absent entries are recorded deletions, not new drift. No full rerun is needed for these documentation-only amendments. Skipped checks remain unverified.

The explicit current 3D runtime/privacy matrix passed **56/56 with zero skips**. The installed reference is `scratch/3d-hands-on-2026-11-06/reference-proof-r4`; the three prepared projects are in `evaluation-kit-r4` beside it. Kit preparation exited 0. Eval2's installed Shot Handoff validator exited 0 with `ok:true`, retaining three personal-private rights warnings. These warnings do not become public or commercial clearance.

The local handoff is ready; **Phase E remains unverified** until the maintainer supplies actual Claude session records and separately scoped visual/playback feedback. Actual Skill use and Motion-worker integration are not established by installed files or these local tests. Three Host-library source audit holds and the retained baseline pins remain unchanged. No commit or push was made.

### 2026-11-07 — foreground tracking observed in the maintainer pilot

[The 2.1.319 observation](../host-library/claude/observations/2026-11-07-claude-2.1.319-3d-standalone.md)
records four successful Skill calls, one TaskList, four returned task IDs and
seven TaskUpdates in Arda's main session. The scoped browser/negative-control
and human feedback are in the linked eval1 audit. This verifies that particular
main-role surface, not shared-worker ownership, background fallback, blockers
or all-role parity. No source hold or profile baseline is advanced. The fixture
material correction has fresh targeted checks; the r4 full gate is historical.

### 2026-11-07 — post-eval1 regression and current PR ground

The fresh frozen run passed typecheck and all 254 suites (4,971 passed tests,
210 skipped), with all 419 watched source records unchanged. It covers the
current native task policy, observation/guide and corrected original fixture;
skipped/runtime surfaces still need their separately scoped evidence. The
actual Cline/Antigravity runtime and held sources are not cleared by this pass.
Read-only GitHub CLI checks found no open PR and no PR for this local branch;
the latest motion PRs #213/#214 are merged. No publication occurred. Continue
with the maintainer-run eval2/3 records and accountable source-review decisions.

### 2026-11-07 — ordinary worker fallback observed; loading still unmet

The completed eval2 record shows Chris consulting/resuming an ordinary Motion
worker, accepted handbacks and lead-owned updates to the returned task ID.
Worker tool-catalog absence is not independently proved by its self-report.
Neither actor made a Skill call; both installed grants declare Skill, so no
permission expansion is justified by this trace. Preserve that readiness gap
and inspect the new actual production exercise before attributing a cause.
The user reauthorized Terra/Sol medium subagents; two bounded read-only
preparation reviews completed without a Host CLI or paid-provider launch.

### 2026-11-07 — actual worker Skill use and handoff observed in eval2b

[The completed 2.1.319 audit](../docs/skill-quality/2026-11-07-3d-eval2b-session-audit.md)
records nine successful Skill calls across Chris, Arda, Motion and QA, plus
lead-owned dependency tracking and ordinary-worker handbacks. This proves the
used native loading path on those actors in this scenario; permission widening
is not justified by the earlier zero-call trace. It does not prove every tool
catalog, all 18 roles, Agent Team sharing or revision-state tracking. The
mandatory Motion direction-Skill omission remains explicit. Record the final
QA-script rerun as producer-run, not a second independent reviewer pass. The
three held upstream sources and their baseline pins remain unchanged.

### Remaining bounded hardening after the completed pilot cases

1. Make the coordinator's production acceptance check explicit about the
   role's required stage-Skill evidence; preserve Motion's existing mandatory
   direction-Skill requirement instead of weakening it to excuse eval2b.
2. Keep revision/fix tracking truthful and distinguish an independent review
   from a producer rerunning the reviewer's unchanged script. Keep trivial
   checks proportional; do not mandate extra paid review for every small fix.
3. Report observed guard enforcement separately from project settings and
   native-role hooks. Missing settings alone is not evidence of no guards.
4. Keep source-specific rights and vendor terms unverified when no source
   evidence was read; do not turn a comparison label into blanket clearance.

These are implementation follow-ups, not completed changes or reasons to
repeat full scene generation. Preserve the existing full code-gate evidence
until actual watched-source edits require a fresh gate. Resolve the three
upstream holds through the recorded process without an audit bypass.

### 2026-11-07 — pilot-driven instruction hardening implemented

The four follow-ups above now have authored changes. Chris checks each
specialist's mandatory direction, production-route and review stage Skills
against successful actor-specific invocation evidence before accepting a
production handoff; Motion's required `motion-design-direction` remains intact.
Helper reuse does not imply recursive Skill invocation. All 18 native Claude
roles reopen an authorized revision or link an owned fix task, invalidate
affected dependent acceptance and relay status changes when task tools are
unavailable. Chris and QA distinguish producer-run regression from an actual
independent review of the changed revision, with proportional trivial checks.

Corrected Chris's Step 0 settings warning to apply to an actually established
coordinated team. Declared native-role hooks and observed enforcement are
reported separately; absent settings no longer imply every worker is unguarded.
Chris, Arda and GRC tie rights conclusions to actual source-specific evidence,
preserving the existing proportional private-prototype path. Canonical role
counterparts carry the matching host-neutral acceptance/reporting refinements.
These are operational refinements above existing Contract Floors; no scope,
capability class, grant, source hold or profile baseline changed.

RED: six intended policy failures, with 19 existing checks passing. GREEN:
six affected suites and **518 tests passed**, actual exit 0, including floor,
grant and real guard callback checks. The first sandbox build failure was an
esbuild ancestor-read restriction; approved local execution established the
actual RED/GREEN results. Whitespace checks passed. Static authored-policy
coverage is not proof of live adherence: the amended behavior is **unverified
live**, and the previous full gate is historical after these source edits.
A fresh full gate is required before publication; no commit or push occurred.

Sol/medium's bounded independent review found no blocking contradiction and
confirmed that no additional Contract Floor edits were needed. Its standalone
fallback improvement was implemented: when no delegated task ID is available,
record the revision/status in the existing fallback instead of assuming a
calling lead. One intended RED failure preceded that refinement; the final
six-suite run again passed all 518 tests, exit 0. Host-library verification for
Claude, Antigravity and Cline passed. The three held sources remain held.

### 2026-11-07 — complete gate timeout diagnosis and current sources

The first hardening full gate completed with typecheck 0 and tests 1:
251 suites passed, three failed on their 30-second deadlines; 4,973 tests
passed and 210 skipped, with unchanged watched source. All three exact cases
then passed serially under the original deadlines in 8.756, 6.118 and 6.508
seconds. No functional assertion failure reproduced. Cause remains unverified;
no installer change or timeout increase is justified by these results.
The complete serial confirmation is running in
`scratch/3d-hardening-gate-2026-11-07/serial-confirmation`, unified session
27371; inspect its actual terminal exit before claiming a full pass.

A new read-only check reached all three configured web Hosts without errors
and found no index delta. The Antigravity CLI command remains skipped because
its executable is unavailable. Claude 2.1.319 is newer than the accepted
changelog snapshot's 2.1.318 entry; all retained comparison baselines remain
unchanged. The complete new entry has a [scoped disposition review](../docs/skill-quality/2026-11-07-claude-2.1.319-delta.md)
and its raw candidate passed the existing audit with zero findings. Its
ordinary changelog ingest is deferred until the frozen code gate finishes.
No new profile keys or permissions are introduced from release prose.

The [completion audit](../docs/skill-quality/2026-11-07-host-and-media-completion-audit.md)
accounts for the original Plan 044 deliverables and Plan 045 A–E pilot scope;
Phase F remains deferred. The [three source-hold findings](../docs/skill-quality/2026-11-07-host-source-holds.md)
remain explicit. The Skill requires documenting blocked documentation under
Security holds, not overriding it; its human-clear wording applies to upstream
Skills and does not establish a documentation clearance process. A maintainer
scope decision is pending; no bypass, lock edit or baseline advance occurred.

The maintainer then selected a separate tested audit-policy proposal while
retaining all three sources held, and asked the executor to proceed with local
decisions while away. [Plan 051](051-docs-audit-policy-precision-proposal.md)
now records the baseline-tested proposal, including a durable synthetic
fixture and the separate full-candidate replay. No production audit-policy
change, admission workflow, allowlist or source clearance follows from it.
The prior pending-decision entry above describes its earlier checkpoint.

## 2026-11-07 — Antigravity command availability amendment

The November 6 missing/skipped CLI result remains valid for that run's environment and PATH; it is not a current claim that the machine has no executable. The parent later found Windows `agy.exe` in `AppData/Local/agy/bin` and captured free native version/changelog output without starting a model. Version stdout reports **1.5.2**, while its newest changelog entry is **1.5.1**. The raw changelog SHA-256 is `da58ce7bb4d7ba6de44cbd69bc81b30fb8cd629a030d30fdb8e68348740f500f`; the ordinary ingested normalized `changelog-agy.md` matches its lock hash `sha256:7ae5a825725f938f0d61907c2400e155b687817e6a666cbca9f16c8d4f5f6e0e`, via `command`.

The [scoped CLI refresh review](../docs/skill-quality/2026-11-07-antigravity-cli-refresh.md) classifies all 23 sections from 1.2.17 through 1.5.1 against command-stream baseline 1.2.16. The parent reports ordinary audit-gated ingestion and all three host-library verification checks passing. The web changelog hold and both Claude page holds remain; command refresh clears none of them. Baseline fields and the native Antigravity profile remain unchanged. New runtime behavior, local/remote Skill loading and updated hook/permission/orchestration semantics remain **unverified**; no model session or native artifact adaptation follows from version metadata alone. This amendment records current availability without silently replacing the earlier missing-command evidence.

### 2026-11-07 — Command baseline advanced after complete review

The following supersedes only the unchanged command-baseline portion of the preceding checkpoint. A later gate correctly found that the reviewed native changelog head was 1.5.1 while its command-stream `lastSeen` remained 1.2.16. The parent stopped that runner tree (interrupted, no final aggregate), then ordinarily re-ingested the identical raw stdout with `--advance-changelog`. **Antigravity CLI (agy changelog)** is now **1.5.1**, justified by the complete 23-section review. Documentation CLI **1.2.11**, App/web/SDK/IDE baselines and native profile pins remain unchanged. The parent reports all three host-library verification checks passing. Three source holds and runtime-unverified boundaries remain. The command-source test is preserved; no source or test relaxation was used.

Focused verification after that ordinary baseline advance: all `tests/hostlib*.test.ts` plus `host-profile.test.ts`, `host-profile-antigravity.test.ts` and `host-profile-cline.test.ts`, serial with existing 30-second test/hook deadlines, **exit 0, 466 passed / 16 files**, **23.84 seconds**. Log: ignored `scratch/plan050-verification/hostlib-reviewed-cli-green.log`. No real host/model session or additional source edit occurred. Ready for a fresh parent full gate; this focused result does not supply the interrupted run's missing aggregate.
