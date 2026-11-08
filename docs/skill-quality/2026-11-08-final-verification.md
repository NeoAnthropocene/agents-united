# Final local verification — 2026-11-08

| Requirement | Evidence and boundary |
| --- | --- |
| Three tracked Host libraries | Accepted-source Claude, Cline and Antigravity refreshes and Host-specific notes are recorded in [Plan 048](../../plans/048-host-refresh-and-claude-session-tracking.md). The two Claude pages and Antigravity web changelog remain held under the existing audit; runtime behavior is not established by documentation refresh. |
| Claude task tracking | Class-derived task grants and coordination guidance cover all 18 native roles; static checks and scoped maintainer observations are recorded in Plan 048. Adherence to the amended instructions remains **unverified live**. |
| Plan 044 | The technique library, discovery, onset diagnostic, isolated previews and scoped hands-on handoff are delivered; see the [completion audit](2026-11-07-host-and-media-completion-audit.md). |
| Plan 045 A–E | Placement, native package, bounded production and lifecycle proofs, and all three maintainer pilot families are recorded in the completion audit with scoped acceptance and observed limitations. Phase F is deferred. |
| Plans 046, 047 and 050 | The bounded follow-up slices and dormant Bundle router are locally implemented; see their dated plans. Plan 050's actual unprompted model non-invocation remains **unverified**. |
| Plan 051 | The tested proposal remains **NOT READY**: its prototype passed 24 of 26 cases and has an unsafe governing-prefix counterexample. No production policy was adopted and all three source holds remain. |

Gate 6 finished 2026-11-08T10:30:10.8485729Z. The root process's native exit was
0; recorded typecheck, package, archive-proof and test exits were each 0, with
`watchedSourceUnchanged: true`. The full test run passed **257 suites, 5,167
tests**, with **210 skipped** of 5,377 total, in 2,512.93 seconds. The skipped
checks are not claimed passed: 208 belong to the standard-run domain matrix;
the remaining two are the POSIX symlink assertion skipped on Windows
(`tests/image-generation-scripts.test.ts:319`) and the optional real 3D kit CLI
test (`tests/3d-hands-on-kit.test.ts:48`) requiring `AGENTS_3D_BUILT_CLI`.

After Gate 6, that optional real 3D kit CLI case passed separately with native
exit 0: one selected test passed and two other cases were filtered out, in
44.93 seconds (44.554 seconds for the selected test). The run used the current
absolute `dist/cli.js` via `AGENTS_3D_BUILT_CLI` and verified fresh kit installs
for all three lanes, resources without evals, and agency-only Motion. No Host
was launched. The other two cases had already passed in the full gate. The
original 210-skip aggregate is unchanged; the POSIX symlink assertion remains
**unverified on Windows**. The separate log is
`scratch/final-integrated-gate-6-2026-11-08/optional-real-kit.log`.

All **317** domain-matrix cases passed separately in Gate 4 against unchanged
matrix inputs; the only changed matrix-related file was the reviewed engineering
golden. Gate 4 itself failed overall with three failures, and Gate 5 was
interrupted without a final native exit or after-hash; neither is a full pass.
The gate receipts and source snapshots are retained under ignored
`scratch/final-integrated-gate-6-2026-11-08/`; the durable history is in
[Plan 050](../../plans/050-host-agent-router-in-every-bundle.md) and the
[completion audit](2026-11-07-host-and-media-completion-audit.md).

No Host model CLI or production provider was started for this verification. No
commit or push was made. Existing maintainer-run pilot evidence remains scoped
to its recorded sessions and feedback.
