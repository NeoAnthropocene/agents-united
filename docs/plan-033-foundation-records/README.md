# Plan 033 foundation verification records — 2026-10-07

Raw output and actual exit codes; no Claude session was invoked. Node v24.19.0, Linux cloud checkout. Commands were redirected directly to files, never piped through filters. The final gate used the tool network capability so child Node stdio and local test servers worked; this did not change the configured outbound network policy.

| Record | Command / tested code | Exit / result |
| --- | --- | --- |
| red | `npx vitest run tests/subagent-contract.test.ts tests/plan-033-findings.test.ts`; before implementation, committed as `4c47bc3` | 1; 29 intended failures, 8 passes |
| green | Same plus `tests/semantic-core.test.ts`; green implementation `232f518` | 0; 50 passes (initial two-file green was 37) |
| narrow | Contract, semantic core, floor and all three host profile suites; `232f518` | 0; 121 passes |
| hostlib-verify | `npm run hostlib:verify`; unchanged library | 0 |
| review-red | `npx vitest run tests/subagent-contract.test.ts`; regression assertions before the fix | 1; inherited list and sparse lists produce 4 intended failures |
| review-green | Contract, semantic core and plan findings after fix `89a8597` | 0; 51 passes |
| typecheck / test / gate | `npm run typecheck && npm test` semantics with individual exits captured; `89a859767e4dc7cb68d1b78c3be2023ed52d4d93`, subsequent handoff-only docs present | 0 / 0 / 0; 165 suites, 3625 passed, 210 skipped |
| scratch-doctor | `node /workspace/agents-united/dist/cli.js doctor --host claude` in `/workspace/plan-033-r3-cloud-scratch`; static native assets from `232f518`, identical on `89a8597` | 0; ten agents, local session guard, no artifact defect; Claude absent and MCP warnings |

Additional raw attempts remain in `/workspace/plan-033-evidence/`: the restricted-sandbox gate (typecheck 0, test/gate 143 after it was deliberately stopped following child-process EPERM failures), the child-process probe, first complete green gate (3624 passed), and scratch installation (exit 0). They are not substituted for the final gate. The final gate's 210 skips include 208 existing domain-conformance skips and two platform-specific skips (shown in output).

These checks establish an offline contract and static packaging, not live host behavior. R3 is prepared in `docs/plan-033-r3-handoff.md`; all eight expectations remain unverified. No headless or interactive prompt was spent; the fresh aggregate allowance and ledger are in Plan 033. CI results and PR are recorded in that plan's final checkpoint after publication.
