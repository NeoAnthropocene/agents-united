# Plan 033 slice-3 publication verification

Publication requested by the maintainer after explicit implementation approval in Codex chat “Implement Plan 033 slice 3” (`01a12fbf-d105-74a2-903d-2c2ec3538bba`). Checked locally on 2026-10-12, Node 24.19.0, `codex/plan-033-author-skill`, planned-at `dev` `06f54cfd8ea18115e374a10be3fbb063eee3ad15`.

| Command | Actual exit | Result |
| --- | --- | --- |
| `npm run hostlib:verify` | 0 | Host snapshots and guide citations |
| `npm run typecheck` | 0 | Build and all TypeScript projects |
| `npm test` | 0 | 202 suites; 4362 passed, 209 skipped |
| `AGENTS_CI_FULL=1 npx vitest run tests/e2e-domain-conformance.test.ts --testTimeout=30000 --hookTimeout=30000` | 0 | 317 passed, none skipped |
| `npm pack --dry-run --json` | 0 | 881 entries; native loader, binding, rule and helper present |

The 209 default skips comprise 208 addon cases exercised by the full matrix and one existing Windows-disabled image-generation link case. Full raw typecheck/test/matrix/hostlib outputs were saved and read completely in ignored `logs/plan-033-slice-3-publication/`. Package JSON was inspected for the required runtime files; no package was published.

29 implementation/source/test/provenance files matched the approved handoff inventory byte for byte before the final staged review. That review removed trailing blank lines from four files; no executable behavior changed. Publication changes also amend documentation, renumber the decision as ADR 0052 to avoid #198’s ADR 0051 reservation, and add the new-session handoff. Existing native guard scripts, root AGENTS.md and Plan 034/036 boundaries remain unchanged. Original local drafts/evidence remain retained.

Fatal UTF-8 and relative-link checks passed across the changed files, including the native entry’s six support edges resolved through its tested binding. The underlying installed-workspace, missing-edge, unsupported-target, update/remove/doctor and bounded draft-helper cases passed in the full suite.

Live Claude invocation, with/without-skill behavioral evaluation and control execution remain **unverified**. Eval fixtures are prepared, not run. The factory remains under construction and only its declared Claude workspace/native stage is available. Published CI must be checked on the actual PR head; it was not available at this pre-publication checkpoint.

See [the accepted loading design](../plans/033-slice-3-claude-loading-design.md), [ADR 0052](adr/0052-slice-3-attribution-first-skill-and-delivery-gates.md), and [the next-session prompt](plan-033-slice-3-handoff.md).
