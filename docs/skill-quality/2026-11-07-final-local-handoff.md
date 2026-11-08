# Local handoff — 2026-11-07

The integration review checkout is `C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\host-media-integration-2026-11-07`. Its current local gate passed as recorded in the [final verification receipt](2026-11-08-final-verification.md). The previews below serve preserved artifacts from the **original** checkout's scratch projects; they are historical accepted work, not installations of the current review checkout.

## Local previews

These loopback URLs are session-local and work only while their server processes remain alive:

- [Motion preview](http://127.0.0.1:58898/) — historical Native interactive scene and the encoded Native and Remotion demos, from `C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\motion-hands-on-2026-11-04`. Server PID 42116, session 12383.
- [Accepted Arda-to-Motion bottle preview](http://127.0.0.1:58899/preview/index.html) — immutable snapshot of the 30-frame r5 handoff in `C:\Users\altay\.codex\worktrees\11f3\agents-united\scratch\3d-hands-on-2026-11-07\evaluation-kit-r5\eval2-motion\media`. Server PID 43508, session 97336.

The local `scratch/final-local-preview-2026-11-07/http-check.json` records nine successful HTTP checks: pages and endpoint frames returned 200, both encoded-video range requests returned 206, an unknown bottle route returned 404 and POST returned 405. The bottle snapshot records 30 distinct frame hashes. Sources were preserved. These are delivery checks, not a new render, browser playback observation or new human acceptance. The prior prototype acceptance remains scoped as recorded in [the eval2b audit](2026-11-07-3d-eval2b-session-audit.md).

A subsequent automated check used existing Chrome 156.0.8078.80 and the approved
project-local Playwright runtime, with non-loopback requests blocked. All seven
checks passed: bottle frames 0 and 29 produced distinct canvas hashes, a repeat
seek reproduced frame 0, reduced motion started paused, and play/pause worked;
the Native slider, play/pause and reset also worked. No page errors or external
requests were observed. The separate receipt is
`scratch/final-local-preview-2026-11-07/browser-check.json`. This is automated
interaction evidence, not new human playback or creative acceptance.

On 2026-11-08 the resumed previews passed nine HTTP and seven automated
browser checks using existing Chrome 156. Private JSON receipts record the
resumed checks; original receipts were preserved. No new human acceptance is
implied.

If a server has stopped, from the review checkout in PowerShell restart the Motion preview with:

```powershell
node scripts/serve-motion-hands-on.mjs '..\motion-hands-on-2026-11-04'
```

The private bottle server writes its status with exclusive creation. Preserve the old receipt under a fresh name before restarting it, then use the newly printed URL:

```powershell
Move-Item -LiteralPath 'scratch/final-local-preview-2026-11-07/bottle-status.json' -Destination 'scratch/final-local-preview-2026-11-07/bottle-status-previous.json'
node scratch/final-local-preview-2026-11-07/serve-bottle.mjs
```

Choose another unused receipt name if that destination already exists. Both commands run local preview servers, not Host sessions or generation; stop them with Ctrl+C. The existing projects must not be overwritten when preparing a new exercise. See [the Motion hands-on guide](2026-11-03-motion-hands-on.md) for preparation and its historical boundaries.

## Verification and remaining boundary

The factory direct-entry fix retains its Claude-native workspace restrictions and resolves normalized `author-skill` identifiers to the complete owned package. The focused factory, binding and related checks passed 112 tests, and the selected normalization/ownership/guard checks passed 10. An earlier integrated gate (session 77135) ended with one focused failure and 119 passes; it remains a failed historical run.

Integrated gate 2 (session 3453) was interrupted after three stale factory
expectations; the corrected affected suites passed 201/201. Gate 3 was
interrupted at a Host-library command-source expectation. The reviewed
Antigravity CLI stream was subsequently ingested through the normal process,
advancing only that stream to 1.5.1; the three holds and other baselines and
profile pins remain unchanged. Gate 4 completed with typecheck and package
proof exit 0, test exit 1: 5,372 passed, three failed and two skipped; all 317
domain-matrix cases passed. The audit-row and reviewed engineering golden
corrections passed 129 focused checks, as recorded in [Plan 050](../../plans/050-host-agent-router-in-every-bundle.md).
Gate 5 PID 28312 was confirmed absent, with no final native exit or after-hash
record: it is interrupted and **unverified**, not a pass or failure. Gate 6
subsequently passed; see the [final verification receipt](2026-11-08-final-verification.md)
for native exits, source freeze and skipped checks.
Earlier typecheck, package
and archive proof exits were 0. The package proof records 1,082 entries, zero
retired files and five matching resource hashes; archive SHA-256 is
`c0d27cad8f6c7dbd7f14e8f0e68b913ec3a814ea13d54d6150403b531d44a468`.

Plan 044's original deliverables and Plan 045's bounded A–E pilots are documented in the [completion audit](2026-11-07-host-and-media-completion-audit.md); Phase F is deferred. Revised live instructions and Plan 050's unprompted model behavior remain **unverified**. The user selected a tested proposal while retaining the three source holds. [Plan 051](../../plans/051-docs-audit-policy-precision-proposal.md) is **NOT READY**; the production audit policy remains unchanged, and no held source has been cleared. No paid job, commit or push was made for this handoff.
