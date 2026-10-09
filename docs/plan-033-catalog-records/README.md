# Plan 033 slice-2 verification records

Planned at fresh `origin/dev` **`02279368143f7124beecd5c8fd16280847eba9a2`**, after explicit-repository checks established #190 merged and #194 open. Worktree: `C:\Users\ozy\.codex\worktrees\ecb0\agents-united`; Node **24.19.0**. Scope and product decisions: [ADR 0050](../adr/0050-contributor-catalog-boundary.md).

## Red evidence

Red commit **`c1942f59358c7b8fa6cd6caad9a88d800bea0690`** contains the shell tracer and actual add-command wizard tracer. Only terminal prompts are mocked; the CAC action, registry and filesystem are real.

| Command | Actual exit | Intended failure | Complete output |
| --- | --- | --- | --- |
| `npm test -- tests/registry.test.ts -t 'declares the empty contributor Domain Bundle shell as under construction'` | 1 | `getBundle('agent-factory')` returned null | [catalog-red.raw.txt](catalog-red.raw.txt) |
| `npm test -- tests/cli-contributor-wizards.test.ts -t 'add wizard labels the contributor section and explains its purpose before cancellation'` | 1 | Contributor picker option was undefined | [cli-red.raw.txt](cli-red.raw.txt) |

The restricted first attempts could not collect Vitest because dependency realpath access returned `EPERM`; the same commands with local execution permission reached the intended assertions above. Those environment failures are not counted as red behavioral evidence. Full raw outputs and command exit files are saved for every completed verification run.

Further vertical red/green checks covered empty-shell resolution, populated contributor department refusal, exclusive assets in `full`, rejected-manifest cache retries, contributor parent/recommendation aliases, normalized `domain:contributor` recommendations, ordinary catalog/lifecycle derivation, list/detail/static/search presentation and department-install suppression. Each intended behavior failed with actual exit **1** before its minimal implementation. Complete intermediate records remain in the worktree's ignored `logs/plan-033-slice-2/` directory.

The intermediate `cli-inventory-guidance-green` run actually exited **1** (one failed, three passed): its remaining assertion expected a guidance phrase to stay contiguous across terminal wrapping. Only that assertion was corrected to normalize continuation lines; the subsequent wizard suite passed **12/12** and the final combined CLI suite passed **51/51**, exits **0**. The misleading intermediate filename is retained with its original output and actual exit.

## Final local checks

| Command | Actual exit | Result | Complete output |
| --- | --- | --- | --- |
| `npx vitest run tests/registry.test.ts tests/recommendation-contract.test.ts tests/domain-atlas-contract.test.ts tests/e2e-skills-depth.test.ts tests/color-theory-skill.test.ts tests/image-creation-skill.test.ts tests/brand-consistency-audit-skill.test.ts` | 0 | 7 suites, 124 passed | [catalog-focused-green.raw.txt](catalog-focused-green.raw.txt) |
| `npx vitest run tests/e2e-domain-conformance.test.ts -t 'derives the expected\|derives exactly\|outside ordinary department lifecycles'` | 0 | 3 passed, 314 intentionally skipped | [catalog-domain-derivation-green.raw.txt](catalog-domain-derivation-green.raw.txt) |
| `npm run build`, then `npx vitest run tests/cli-contributor-wizards.test.ts tests/cli-e2e.test.ts` | 0 / 0 | 2 suites, 51 passed | [cli-focused-green.raw.txt](cli-focused-green.raw.txt) |
| `npm run hostlib:verify` | 0 | Snapshot hashes and guide citations verified | [hostlib-verify.raw.txt](hostlib-verify.raw.txt) |
| `npm run typecheck` | 0 | Build and all configured TypeScript checks passed | [typecheck.raw.txt](typecheck.raw.txt) |
| `npm test`, run only after typecheck exit 0 | 0 | 188 suites, 4032 passed, 208 skipped | [full-test.raw.txt](full-test.raw.txt) |
| `AGENTS_CI_FULL=1 npx vitest run tests/e2e-domain-conformance.test.ts --testTimeout=30000 --hookTimeout=30000` (PowerShell environment assignment) | 0 | 317 passed, none skipped; all 23 addons | [addon-lifecycle.raw.txt](addon-lifecycle.raw.txt) |
| `npx vitest run tests/plan-033-findings.test.ts tests/source-encoding.test.ts` | 0 | 10 passed after final dated evidence updates | [final-docs.raw.txt](final-docs.raw.txt) |

The typecheck/test commands preserve the short-circuit behavior of `npm run typecheck && npm test`, with separate complete raw outputs and actual exit files. The full addon lifecycle matrix ran sequentially after the full suite because shared resolution changed; every required output was saved and read completely with its actual exit. The separate CLI build output is [cli-e2e-build.raw.txt](cli-e2e-build.raw.txt). Local checks use Node **24.19.0**. The Python helper suite ran and passed. The ordinary catalog stays at seven lifecycle departments and 23 addons; `full` and `digital-agency` keep their declared assets unchanged, including the three shared image/brand skills. Existing `assets/` template support and maintainer-only `evals/` exclusion passed their existing suites.

Independent read-only review of the frozen source, tests, manifest and documentation against the planned-at SHA found no actionable defect or scope violation. Raw test output retains diagnostic whitespace verbatim; source/document diffs pass whitespace checks.

## Limits

These are deterministic local checks and CLI simulations, not live native factory evidence. The shell contains no authoring role, skill, workflow or rule; per-host factory support and managed local-source installation remain unavailable. No host session was started, resumed or rerun and no new spend was incurred.

R3 is carried unchanged: seven expectations seen, Defne completion unverified, five fixed-value brief violations. Claude Pro, extra usage off; aggregate **3.7228101 USD**, remaining **46.2771899 USD**; headless **0/16**, interactive **2/16 conservatively**. Plan 036 evidence and allowance are separate.
