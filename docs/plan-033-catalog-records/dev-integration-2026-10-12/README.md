# PR #195 dev integration — 2026-10-12

The maintainer requested conflict repair after #194 and #196 merged. Integrated fresh `origin/dev` **`39da247283ad6aecbee5b673d85d3d68706bcdf0`** into the existing open `codex/plan-033-contributor-catalog` branch, preserving its published history. The only Git conflict was README's inventory paragraph. Resolution keeps the developer-shell wording and upstream **194 skills / 125 domain skills / 69 workflow playbooks**. PROJECT's catalog inventory now includes the shell: **36 entries**, **34 end-user bundles**, **10 domain values**.

Every upstream bundle's orchestrator/agents/skills/workflows/rules declaration is unchanged; `full` and `digital-agency` retain `color-theory`, `image-creation`, `brand-consistency-audit` and the new `image-generation`. The contributor shell and exclusion behavior remain. The 109 upstream paths outside the four reconciled catalog/glossary files match `origin/dev` exactly, including Plan 036/native/image evidence. This task runs no image tool or host session and leaves Plan 036's ledger separate.

| Check | Actual exit | Result | Complete output |
| --- | --- | --- | --- |
| Upstream bundle inventory comparison | 0 | Every declaration preserved; `full` has 194 skills | [inventory.raw.txt](inventory.raw.txt) |
| `git diff --cached --exit-code origin/dev -- <109 preserved upstream paths>` | 0 | Empty diff | [preserved-upstream.raw.txt](preserved-upstream.raw.txt) |
| `npm run hostlib:verify` | 0 | Hashes and guide citations verified | [hostlib-verify.raw.txt](hostlib-verify.raw.txt) |
| `npm run typecheck` | 0 | Build and all configured TypeScript checks passed | [typecheck.raw.txt](typecheck.raw.txt) |
| `npm test` after typecheck exit 0 | 0 | 196 suites, 4200 passed, 209 skipped | [full-test.raw.txt](full-test.raw.txt) |
| `AGENTS_CI_FULL=1 npx vitest run tests/e2e-domain-conformance.test.ts --testTimeout=30000 --hookTimeout=30000` | 0 | All 317 passed, none skipped | [addon-lifecycle.raw.txt](addon-lifecycle.raw.txt) |
| Final plan/encoding suites | 0 | 10 passed | [final-docs.raw.txt](final-docs.raw.txt) |
| UTF-8 and relative file-link review | 0 | 81 links across 6 documents | [doc-links.raw.txt](doc-links.raw.txt) |

Complete raw outputs and actual exits are saved and read. The Windows run reports two Vite dynamic-import URL warnings in the new upstream image-generation suite; that suite passes. No new production resolver/ownership code was added for conflict repair. The full addon matrix nevertheless ran on the integrated candidate before publication and passed all 317 checks.

The original planned-at SHA and October 9 verification are historical and retained unchanged. Slice-3 decisions are prepared separately from this catalog PR. No PR merge, force-push, paid host run, R3 rerun/resume, security-hold or host-baseline change is performed.
