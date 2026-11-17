# Read and prepare Claude record evidence

The contributor package includes `agents-session-report`, a standalone Node >=24 executable built from the current Claude reader. It reads an explicitly selected local record set. It starts no Host, model, provider, network operation or maintenance refresh command.

After installing the reviewed package, run:

```powershell
agents-session-report "C:\records\project\session-id.jsonl" --host claude
agents-session-report "C:\records\project\session-id.jsonl" --host claude --json
agents-session-report trim "C:\records\project\session-id.jsonl" --host claude --out "C:\review-evidence\new-copy"
```

The output parent must already exist; `new-copy` must be absent and outside the input project. Neither route installs native files, publishes evidence or authorizes a new live run. The actual installed entry is `node_modules/agents-united/dist/session-report.js`, registered by the package's `agents-session-report` executable alias. It needs the packaged build and Node, not a maintainer source checkout.

## Select exact inputs

Supply one absolute lead `.jsonl` file with a safe nonempty filename stem. The reader includes only that lead and its sibling `<stem>/subagents/*.jsonl` and `.meta.json` files. Unmatched metadata is inventoried and disclosed without inventing another worker. Missing siblings mean lead-only evidence, not proof that no worker existed.

There is no session-id/prefix resolver, project/home search, watch mode, process control or caller-supplied command. `--host claude` is required; other Hosts and formats are unavailable until their own readers are reviewed. The caller's Host declaration is not proof of the producer's authenticity.

Linked/junction paths, traversal aliases, wrong file types, unsafe derived stems and case-colliding selected names are refused. Fixed limits are 16 MiB per file, 64 MiB total and 128 files. Exceeding them produces an unavailable result, not silent truncation. Invalid UTF-8, malformed interior JSONL, non-object records/metadata and non-finite converted cost evidence are refused before a result is emitted.

A malformed object-shaped final JSONL line can be omitted with an explicit partial diagnostic. Parse failure alone cannot distinguish an incomplete write from corruption. Ignored future record types, missing workers and unmatched metadata are disclosed. The selected record set's `complete` label concerns this bounded syntactic scope; it does not establish a complete Host session, a finished worker or physical process exit.

## Read the result

Exit 0 means the selected records were read; observed violations remain findings. Exit 1 means invalid, unavailable or changed inputs, an unsafe output, or unsuccessful preparation. Read the diagnostic rather than treating every nonzero result as the same problem.

Readable output retains the existing protocol report with scope and limitations. JSON output is a versioned envelope containing the selected input inventory, lengths/SHA-256 hashes, completeness/diagnostics, current analysis and limits. Reopen the actual files and check those pins when using the result as evidence. Identity/hashes are checked again after reading, but this is not an atomic snapshot or proof that a live writer has stopped.

Human prompt counts use the current Host-provenance and cross-session rules. Report attempts retain their individual accepted/rejected/pending/unknown states; an earlier accepted attempt cannot hide a later unresolved one. Request acceptance, report delivery to a lead, turn completion, team membership and physical process exit remain separate facts.

Historical role manifests are unavailable in this packaged route. It does not follow the transcript's `cwd` into native files or use the consumer directory's current registry as historical proof. The shell-less reread finding therefore reports unavailable manifest evidence. Other protocol findings retain their existing historical scope; they are not a factory evaluator's quality judgment or a universal Host conformance score. The report's older teammate terminology does not determine the actual worker mechanism.

Recorded cost-state values are estimates from the selected records. They establish neither an invoice, current quota or available allowance nor renewed spending authorization. Keep R3, R4, later diagnostics and provider/media ledgers separate.

## Prepare a shorter copy

Trim preflights all inputs and the absent destination, stages the existing reader's trimming support in an owned sibling directory, checks the complete prepared tree and rechecks the original pins before delivery. It refuses source/output overlap, managed Host output roots, linked parents, existing destinations and missing output parents. It never offers force/overwrite behavior.

The result includes the original input inventory/diagnostics and the derived lead's actual paths, lengths and hashes. Ordinary assistant reports and `SubagentHandback` reports retain required late headings; complete peer wrappers retain their provenance even after a long unrelated prefix. Before delivery, the same reader checks its supported source/derived classifications, model/cost facts and finding verdicts. A bounded transformation that would change those facts is unavailable; its owned stage is removed and the original/destination remain preserved.

The caller should independently run the packaged report on the returned derived lead, compare its complete output inventory, hashes and classifications with the original job, and read the actual exits. A repeated receipt is not independent execution evidence. Preserve the original partial-record diagnostics even when the shortened file itself parses cleanly.

Trimming omits known account/system attachments and thinking, removes cross-session transport attributes, masks certain email/path patterns and bounds text. It is **not comprehensive privacy or credential scrubbing**. Reports can expose supplied transcript text, and derived copies still require human inspection before sharing. Nothing is automatically published or packaged as a real record fixture.

## Maintainer compatibility and evidence

The existing checkout route remains available:

```text
npm run hostlib:session -- <lead.jsonl | session-id> --project <record-project>
```

That maintainer resolver has its existing search and manifest behavior. The dedicated contributor entry supplies stricter selection and unavailable-manifest context while reusing the same parser, report logic and trimming implementation. Do not substitute one route's context for the other's historical evidence.

The public delivery checks are `tests/session-report-cli.test.ts`, `tests/session-report-package.test.ts` and the existing `tests/hostlib-session-report.test.ts` regressions. [The P4 design](../plans/033-slice-4-p4-session-reader-design.md) records the confirmed seams and boundaries. Complete local verification and remaining unverified behavior belong in the dated Plan 033 evidence, not in a claim of live Host support from synthetic tests.
