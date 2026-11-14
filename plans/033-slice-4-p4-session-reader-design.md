# Plan 033 P4: distribute the current Claude session reader

Design prepared 2026-10-28 at planned-at `72e2cf4ddc92a6120313c5039f1bc39bc4b4f021`, branch `codex/plan-033-claude-delivery-oct28`, Node 24.19.0. P3b's frozen candidate is undergoing its complete gate. This is a separate delivery review for [ADR 0048's accepted helper-distribution requirement](../docs/adr/0048-agent-factory-quality-and-contributor-tooling.md); no P4 capability implementation or new ADR reservation exists. Whole-plan implementation authorization persists. Confirm the new public test seam before its first test, as required by the TDD skill.

**Maintainer confirmation, 2026-10-28:** “Use this reader CLI seam” confirms both commands below and public tests through the built executable and actual npm package. Implement after P3b's frozen gates, as a separate review packet. This dedicated contributor utility has its own terminal entry, like the existing maintainer `scripts/hostlib/cli.ts`; the parser/input modules have no terminal I/O. The main product CLI's `src/cli.ts` boundary remains unchanged. No new live or publication authorization follows from interface confirmation.

**Trim-parity review amendment, 2026-10-29:** public CLI counterexamples show that the existing trimmer loses late headings in ordinary assistant reports and valid peer wrappers following a long prefix. Preserve the single current parser: use its same wrapper matcher for trimming, keep bounded complete peer wrappers rather than unrelated prefix text, and apply its existing heading-preserving report trimming to ordinary assistant text too. Add a source/derived fingerprint of existing reader classifications before committing a prepared copy; reuse the reader's own report-completeness predicate and analysis with unavailable manifests, rather than a second evaluator or protocol parser. If bounded trimming cannot preserve prompt counts, call/peer/report classifications, model/cost facts and finding verdicts, return an unavailable result and preserve the source/destination. This corrects supported trimming without changing the historical parser's prompt/handback/analysis defaults. Existing maintainer and new packaged-route tests remain authoritative.

## Smallest review unit and exact paths

Ship the existing `scripts/hostlib/session-report.ts` parser and trimming implementation through a dedicated bundled executable. Preserve this file as the single implementation, its current exports, all #202/#208 cross-session/human-provenance/latest accepted-handback behavior and the existing maintainer `hostlib:session` route. Do not copy a second parser into a Skill or bundle the maintenance CLI's refresh/network commands.

| Edge | Exact source and installed path |
| --- | --- |
| Current parser/sanitization | `scripts/hostlib/session-report.ts`; bundled into `node_modules/agents-united/dist/session-report.js` |
| New public wrapper | `scripts/hostlib/session-entry.ts` |
| Scoped input/output preflight | `scripts/hostlib/session-input.ts` |
| Shared types | `src/core/types.ts`: move the existing session data models unchanged under explicit Claude session names; the original parser reexports its existing public type names as aliases, then add input/diagnostic/report/analysis-option models here |
| Build registration | `tsup.config.ts`: one build with named entries `cli: src/cli.ts` and `session-report: scripts/hostlib/session-entry.ts`; existing Node24/ESM/banner/source maps; declarations limited to `src/cli.ts` |
| Executable registration | `package.json` adds `agents-session-report: ./dist/session-report.js`; existing aliases/payload stay, no new dependency |
| Contributor instructions | `docs/session-report.md`; link from README's contributor section and current verification/handoff |
| New public tests | `tests/session-report-cli.test.ts`, executing the built executable; `tests/session-report-package.test.ts`, actual offline npm pack/install outside the checkout |
| Existing regression seam | `tests/hostlib-session-report.test.ts`, unchanged expectations for the maintainer route and current fixtures |

The installed npm executable is available to contributors independently of Bundle installation. This utility adds no Agent/core/contract, Skill, Workflow, rule, hook, native loader or managed projection. The four-field Subagent Contract is inapplicable to this utility. No new capability-class grant or tool preapproval is supplied; a caller needs its already-authorized shell/file access to run the fixed Node/executable path. A shell-less worker returns the named unavailable check to its caller. The future factory orchestrator may call it only for an explicitly selected record, under its separately reviewed job and authorization.

Keep TypeScript signatures explicit. Centralized type factoring changes no parser data shape, public alias or historical default behavior; use type-only imports so direct Node type stripping and the bundled utility have no new runtime dependency on a source checkout. Existing parser regression tests remain authoritative.

Local `tsup` declarations support a distinct `dts.entry`; inspect the installed type declaration rather than assuming that adding a second clean build is safe. One build cleans once. The parser imports only Node built-ins. Existing direct Node type-stripping imports remain valid; do not move the parser across the main `rootDir` or export it through the main CLI merely to solve packaging.

## Public interface and fixed scope

```text
agents-session-report <absolute-lead.jsonl> --host claude [--json]
agents-session-report trim <absolute-lead.jsonl> --host claude --out <absolute-new-directory>
```

The new interface requires one absolute lead file and explicit supported Host. It accepts no session-id/prefix search, `--project`, home-directory enumeration, extra positional/unknown flag, watch/poll mode, process control or caller-supplied command. Other Hosts/formats are unavailable, pending their own format reviews. The existing maintainer resolver remains unchanged for historical compatibility.

The caller fixes the lead, scope and operation before invocation. Resolve that lead's sibling `<lead-stem>/subagents/*.jsonl` and `.meta.json` files only, using the existing loader's association. Include every metadata file in that directory in the input inventory because the current trim implementation copies unmatched metadata too; diagnose an unmatched file without inventing a worker. Preflight the complete closure before parsing/writing: ordinary contained file/directory types, no linked/junction ancestors or children, safe derived names, no case-colliding names, valid metadata objects. Do not read unrelated sessions or a recorded `cwd`'s files. Missing sibling records mean lead-only evidence, never proof that no worker existed.

Bound each JSONL/metadata file at 16 MiB, the complete selected closure at 64 MiB and 128 files. Exceeding a limit blocks before output creation; do not silently truncate. No external schema, fetch or shell command is involved. Parse diagnostics identify each selected path and line: reject malformed interior lines and non-object records; tolerate one malformed object-shaped nonblank last JSONL line, report its omission and mark the record set partial. It may be incomplete or corrupt; do not claim which from parse failure alone. Unknown future record types are counted as ignored rather than invented evidence. Reject an input with no recognized Claude record shape. Host selection is the caller's declaration, not producer-authenticity proof.

Record the selected files' actual paths, byte lengths and SHA-256 values, and recheck identity/hashes after reading. A changed record set blocks a stable-result claim. These checks are not an atomic filesystem snapshot or proof that a live writer has stopped. No session is launched or reopened to complete a partial record.

## Preserve analysis, make missing context explicit

Reuse `loadSession`, `analyse`, `renderReport`, `trimRecord` and `trimSession`. Add one narrow optional analysis context to the current parser: the new wrapper selects unavailable role-manifest evidence, while calls without the option retain the current maintainer behavior. In that context the H1c finding reports `not seen` with an explicit unavailable-manifest explanation; it must not infer a shell grant from missing calls, read a transcript-controlled `cwd`, or fall back to the consumer working directory's registry. Do not package current native manifests as historical evidence. Supplying verified historical manifests can be a separate future increment.

Keep all other existing findings and handback matching unchanged. Report acceptance, lead receipt, turn completion, team membership and physical process exit remain separate. This retrospective reader does not decide whether an ordinary subagent requires shutdown, prove transport isolation, release a mode-line gate, create a mailbox reader, force termination or change a timeout. Existing protocol findings have their historical scope; they are not a factory quality verdict or universal Host conformance score.

Report success means the selected record set was read and analyzed, not that its findings passed. Default output retains the existing readable report with a scope/completeness/limitation preface. `--json` returns a versioned envelope: supported Host, selected input inventory, completeness/diagnostics, current analysis and explicit limits. Exit 0 means completed reading; exit 1 means invalid/unavailable/changed input or failed preparation. Observed violations remain findings, not hidden process failures. Cost-state values are recorded estimates, never today's quota, actual invoice, allowance or renewed spending authorization.

The reader may expose supplied transcript text in its output. The existing trimming support omits known account/system attachments, thinking and transport attributes and masks certain email/path patterns; it is not a comprehensive credential or privacy scrubber. Preserve that implementation and explain its limits plainly. Human inspection is required before sharing a derived fixture. Nothing is automatically published.

## Trim output and checked hand-back

Trim requires a new absent absolute output directory whose ordinary parent already exists, outside the selected input project directory, disjoint from its ancestors and managed Host roots (`.agents`, `.claude`, `.cline`, `.cursor`, `.codex`, `.opencode`, `.gemini` path segments). Reject traversal aliases, linked output ancestors, existing output and source/output overlap. Preflight all selected inputs and intended output paths before writing. Stage the existing `trimSession` result in a fresh sibling directory, verify the complete output inventory and recheck inputs and destination, then rename into the absent destination. On failure preserve source/existing destination and remove only the verified owned staging directory. Do not add force/overwrite behavior to the public wrapper.

Return the actual trimmed lead path, complete output inventory/hashes/lengths, input pins and diagnostics, original completeness and sanitization limitations. The caller reopens these exact paths, compares the complete inventory and selected input pins, runs the same packaged report on the derived copy and checks its actual exit. Report summaries and human-prompt/handback classifications must survive supported trimming; bounded text masking need not preserve arbitrary prose byte-for-byte. No worker receipt establishes an independent caller check.

Both local and upstream intent stop with reports/derived evidence. Upstream use follows the existing contribution template and explicit human sharing/publication approval; the utility neither creates a PR nor packages private records. No new live evaluation pair is needed for a deterministic retrospective utility. Existing parser regressions and synthetic behavioral fixtures are authoritative for this delivery, distinct from later maintainer-led Host proof.

## Expected reds and completion evidence

After seam confirmation, announce the exact paths above and begin with one synthetic record whose human/peer prompts and accepted handback have known expected values. The first public CLI test fails because `dist/session-report.js` does not exist. Add the minimal bundle/wrapper, then incrementally test strict selection, supported/unsupported Host, peer-versus-human provenance, latest/pending/rejected handback, partial EOF/interior corruption, input bounds, links/traversal/collisions, missing siblings and unavailable manifests. No real private record is opened.

The first trim refusal test uses an existing destination with a sentinel and expects exit 1 with its complete inventory unchanged. Verify successful derived copies, source immutability, current masking limits and parser parity. The installed-package test must invoke the actual packed executable outside the checkout with no source overlay, private fixtures or registry fallback. Verify all runtime files/dependencies are in the tarball and no maintenance fetch/refresh entry is exposed through this executable.

Completion requires complete build/typecheck, current helper and new CLI/package regression outputs, full serial tests, host-library verification and applicable documentation checks, with raw stdout/stderr and actual exits read. The offline budget is these bounded commands, synthetic/committed sanitized fixtures, zero Host/model/provider runs, zero prompts/USD and no publication. Installer/resolution/ownership is unchanged in this design, so P3b's matrix is not replaced by a historical count or rerun merely for prose. Any later ownership change triggers the full matrix again.

Freeze a separate review packet and delta from P3b. Record final hashes, actual gate results, exceptions, unavailable contexts and live unverified. This independently reviewable utility does not complete evaluator, templates, orchestration, sync, managed Option A installation or the Claude stage. Preserve the Claude → Codex → Antigravity → Cline sequence, separate stage reviews, historical R3/R4/H12/media ledgers and Plan 034's hold/baseline.
