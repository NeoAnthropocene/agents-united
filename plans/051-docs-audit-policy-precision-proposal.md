# Plan 051 — Docs audit-policy precision proposal

Status: **Proposal only; baseline and feasibility tested, NOT READY.** The maintainer selected a separate tested proposal while keeping sources held. No new policy, admission workflow or clearance is implemented or authorized. The initial local draft used 049 before the remote fetch; upstream now reserves 049 and 050, so this proposal is numbered 051.

## Problem and retained decisions

The deterministic scanner reports three high findings in protective/descriptive vendor prose. Official origin is provenance, not proof of harmlessness. The retained retrievals were reviewed as data:

| Source and retained location | Current finding | Narrow decision |
|---|---|---|
| [Claude MCP](https://code.claude.com/docs/en/mcp.md), `scratch/host-refresh-2026-11-06/claude-held/mcp.md:350` | `injection/exfiltration`: the reference label describes refusing credential transport to a non-HTTPS token endpoint. The matched verb is singular `send` in that label, not initial `Sends`. | Plausible span-level refusal precision candidate; **held** until an independently justified scanner change passes adversarial checks and ordinary ingestion gates. |
| [Claude VS Code](https://code.claude.com/docs/en/vs-code.md), `claude-held/vs-code.md:183` under the same scratch root | `injection/exfiltration`: UNC links are disabled because opening them could expose Windows credentials. The explanatory Markdown link supplies an HTTPS URL to the matcher. | **Held**. Do not exempt hypothetical `could send` wording or delete link destinations: those can carry real instructions/destinations. |
| [Antigravity changelog](https://antigravity.google/docs/changelog.md), `antigravity/changelog.md:5026` under the same scratch root | `injection/role-impersonation`: an inline `<System>` literal describes custom XML section titles. | **Held**. Backticks and descriptive surrounding prose are not security boundaries; current policy intentionally catches embedded role markers. |

`scripts/hostlib/audit.ts` scans each line with `pattern.test`; it does not parse instruction intent. `auditDocument` blocks high findings only, while directory/skill verdicts also stop at medium (`needs-review`). Downgrading a docs finding to medium would permit refresh, not create a review gate. Neither diagnostic wording nor successful characterization clears any source.

The binding workflow, `.claude/skills/host-update-sync/SKILL.md` step 2, says blocked docs must not be overridden and must be recorded under Security holds. Its human-clearance language in step 4 concerns upstream skills. `sources.auditAllow` exists in code and suppresses a rule throughout a file; it is not an authorized docs-clearance process and is outside this proposal's permitted changes.

## Options and recommendation

**A. Minimal span-level explicit-refusal recognition.** Experiment only with directly negated transmission actions in docs mode. Classify individual action matches; continue scanning the rest of the sentence, line and document, including links and code. Preserve every other rule and skill/script behavior. A prefix check for `Refusing to` is insufficient: a sentence can prohibit refusal, negate it or append an actual transfer instruction. The currently retained MCP line is a candidate, not a specification to special-case. This option does not safely resolve UNC warning discourse or the role-marker policy by itself.

**B. Reviewed exact-content/finding-bound docs admission.** This workflow is **currently absent**. A future policy could distinguish a deterministic finding from a reviewed admission decision bound to the complete raw-content digest and exact finding identity, source URL/snapshot destination, scanner revision and explicit review disposition. Every finding and the complete candidate would need review; no unreviewed remainder is admitted. The scan and finding remain visible; admission would be a separate recorded decision, not a scanner pass or per-file/rule allow entry. New content or scanner semantics invalidate the decision and require a fresh scan/review. The no-override workflow and ADR 0025 implications must be explicitly resolved before implementing this policy; approval of this proposal grants none of that authority. Reviewer identity, ownership and decision recording need definition, not an assumed human-approval mechanism.

**Recommend a bounded A feasibility slice first**, retaining all three holds. Use failing tests to establish whether an explicit-refusal rule can be narrow and general. If it needs broad prose interpretation or fails the adversarial matrix, stop; retain MCP too. Keep B as the explicit alternative for a later policy decision if conservative scanning repeatedly blocks useful descriptive docs. Do not build an admission subsystem merely to clear these three pages. No option warrants claiming a semantic security guarantee: these are heuristic scans supplemented by review, with deliberate false-positive tradeoffs.

## Test matrix and implementation gates

Baseline artifacts are ignored `scratch/audit-policy-proposal-2026-11-07/baseline.test.mjs` and `baseline.log`. Tests import the actual current `scripts/hostlib/audit.ts` through Node 24 type stripping; they do not reimplement its regexes or launch a host.

| Case | Baseline verified | Future requirement |
|---|---|---|
| Three complete retained candidates, exact finding lines/rules | All fail high | Remain held during proposal/experimentation; no ambient waiver |
| Standalone explicit refusal | Fails high | Candidate red requirement: harmless refusal becomes non-exfiltration only if negation scope is defensible |
| Direct credential transfer; transfer in Markdown link label/backticks | Fail high in docs and skill scans | Must remain blocked, arbitrary filenames/domains |
| Refusal plus transfer on same line or next line | Fail high in both modes | Match-level exclusion must not hide later instructions |
| Negated refusal; prohibition of refusal; hypothetical transfer | Fail high in both modes | Must remain blocked; no prefix/modal exemption |
| Role payload in code/link; standalone inline marker followed by payload | Fail high in both modes | No blanket quotation/Markdown exemption |
| Backticked instruction override; invisible Unicode in warning | Fail high in both modes | Independent rules remain effective |
| Medium concealment instruction | Docs verdict passes; skill scan reports medium | No downgrade masquerading as a review hold |
| Any future B receipt with changed byte, URL/destination, finding set or scanner revision | Not implemented/tested | Invalidate admission; rescan and obtain a new policy-defined decision |

Before implementation: add true red tests for desired A behavior, including generic variants beyond the retained sentence, adversarial negation scope and all-match scanning. Review the policy delta before declaring it a bug fix. Keep malformed/ambiguous prose blocking. Before acceptance: unchanged attack cases and skill/script behavior, focused Vitest audit/library integration coverage, then the ordinary full gate with existing deadlines. Do not alter the active frozen gate or use characterization as a substitute. Run the ordinary audit/refresh only after any justified implementation and applicable policy decision; refresh failure keeps prior snapshots and locks intact.

## Verification and dated log

2026-11-07: prepared proposal and standalone characterization only. Verified Node `v24.22.1` using `C:/Users/altay/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.

```powershell
& 'C:/Users/altay/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test scratch/audit-policy-proposal-2026-11-07/baseline.test.mjs
```

Exit **0**; **18 tests passed, 0 failed, 0 skipped**. All three retained source candidates remain high/fail, and the adversarial invariants remain blocked. This is green characterization of the **old policy**, not tested effectiveness of a new policy. Desired precision requirements are documented, not implemented; B admission/invalidation is unverified. No production scanner/config/allowlist, snapshot, lock, baseline or native artifact was changed; no ingestion, audit CLI, network, host session, Vitest or full suite was run for this proposal. The parent's frozen serial gate remains independent.

### Independent review amendment — 2026-11-07

The old scanner's high finding for refusal plus transfer on one line does not
prove that the appended transfer was independently matched: the refusal alone
can trigger it. Future A acceptance must demonstrate that the refusal alone
passes while the combined line fails, or supply equivalent span-level proof.
The current assertions characterize high findings under the old policy only;
they do not test a new policy or executable-script invariance.

The private scratch test above includes all three complete quarantined
candidates, but depends on those ignored files and the recorded machine-local
Node path. The durable [synthetic counterpart](../docs/skill-quality/fixtures/docs-audit-baseline.mjs)
contains no candidate files and runs with Node 24 or later:

```sh
node --test docs/skill-quality/fixtures/docs-audit-baseline.mjs
```

On Node 24.22.1 the synthetic run exited **0**, with **18 passed, 0 failed,
0 skipped**. It covers analogous contexts, not the complete vendor candidates.
Their exact source URLs, lines, rules and SHA-256 hashes are recorded in the
[source holds report](../docs/skill-quality/2026-11-07-host-source-holds.md);
full-candidate replay requires the retained quarantined files. All holds remain.

### Feasibility counterexample — 2026-11-07

An independent Node 24.22.1 replay of the scratch Option A prototype exited
**1**: **24 passed and 2 failed** out of 26. The candidate still blocked the
exact MCP line it sought to distinguish and incorrectly passed a governing
prefix that prohibits the refusal: `Avoid [Refusing to send credentials to the
endpoint](https://docs.example).` The latter is a false negative in the
prototype, not a production scanner failure. The scratch replay log is
`scratch/audit-policy-proposal-2026-11-07/independent-prototype-replay.log`.
The prototype is **NOT READY**; no production adoption follows.

The durable synthetic old-policy baseline now includes that counterexample:
its Node 24.22.1 rerun exited **0**, **19 passed, 0 failed, 0 skipped**. The
earlier 18-case private full-candidate characterization is unchanged. All
three source holds remain in force.

### 2026-11-07 — Bounded Option A feasibility experiment: NOT READY

The maintainer subsequently authorized autonomous bounded investigation while retaining the sources. Added only ignored scratch `refusal-prototype.mjs`, `refusal-prototype.test.mjs` and `refusal-prototype.log` beneath `scratch/audit-policy-proposal-2026-11-07/`. The independent review supplied `independent-cases.json` there. This experiment does not modify or replace the production scanner or authorize admission.

The candidate starts from the actual `auditDocument` findings and considers suppressing only docs `injection/exfiltration` hits. It recognizes short syntactic refusal fragments, including link-label fragments, and enumerates every transmission-action token on a line: an action outside the recognized spans prevents suppression. It does not exempt entire lines, links, code, files or domains. Every other original finding is retained verbatim. Skill/script scan calls delegate unchanged to the actual scanner; that is preservation by construction, not evidence about a future production rewrite.

```powershell
& 'C:/Users/altay/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test scratch/audit-policy-proposal-2026-11-07/refusal-prototype.test.mjs
```

Corrected final run: Node 24.22.1, exit **1**, **26 tests: 24 passed, 2 failed, 0 skipped**. An initial run also exited 1 (19 passed, 7 failed); five were fixture filename mismatches in whole-finding comparisons, corrected in the harness before the final run. No scanner grammar was tuned after these failures.

- Passed the independent 14-case matrix, including generic standalone refusal and `We will not upload` variants, negated/prohibited refusal, same-line/overlapping actions, quoted/linked payloads and independent high rules.
- Established actual candidate discrimination: a standalone refusal passes while a same-line appended upload remains high. Four variants appending send/upload/link-label/backtick transfer instructions to the exact MCP line also stay high, with no suppressed exfiltration finding. This is stronger than observing the old scanner fail on a combined line because of its first refusal alone.
- Complete retained UNC and Antigravity candidates retain exactly the baseline findings. Explicit real invisible-Unicode, role-marker and override additions retain their non-exfiltration findings verbatim. Production still reports all three source candidates as held.
- **Failure 1, conservative incompleteness:** the exact MCP line still fails. The linked reference URL contains another action token (`send` in its path), outside the recognized refusal span. The experiment refuses to discard that token as inert URL syntax. Do not turn this into a blanket link-destination exemption to meet a desired result.
- **Failure 2, unsafe scope inference:** `Avoid [Refusing to send credentials to the endpoint](https://docs.example).` fails under the actual scanner but passes the candidate. A syntactically negative link-label fragment is being governed by an external instruction that reverses its meaning. The fragment grammar cannot determine that discourse scope; adding an `Avoid` word exception would merely begin an unbounded phrase blacklist.

Conclusion: **NOT READY for production or source clearance.** The tests demonstrate overlap handling is feasible but not that locally recognized negation is a safe admission boundary. Retain both failing assertions, all three holds and the original policy. No further grammar widening or source-specific exemption is recommended from this experiment. Independent review should assess this negative result before proposing another slice; Option B remains an unimplemented policy alternative, not an approved fallback. No network, host CLI, audit/refresh CLI, ingestion, Vitest, full suite, config/allowlist, baseline, lock, snapshot or native-artifact changes occurred. The existing native 30-second gate was untouched.


### Upstream numbering correction — 2026-11-07

A fresh fetch found merged PR #215 at `e0dd6a7`, which reserves Plan 049 for the Host Agent Router and Plan 050 for its every-Bundle rollout. Renumbered this uncommitted proposal from 049 to 051 and updated live links. Earlier private logs mentioning Plan 049 refer to this proposal at that earlier checkpoint; the upstream plans are preserved.
