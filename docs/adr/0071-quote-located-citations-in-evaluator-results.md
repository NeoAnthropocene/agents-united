# ADR 0071: A citation in an evaluator result names its quote, and the record check finds its lines

- **Status:** Accepted by the maintainer, 2026-11-19 ("Yes, build it"), through a question dialog, on the proposal of the factory-improvement worker of that day's session (an AI session), relayed by the lead of the session. He confirmed that this is not the alternative [ADR 0070](0070-hand-back-hook-of-the-factory-evaluator.md) rejected (a checker that corrects line numbers). Built and gated offline only; nothing of it is observed on the Host (see Consequences).
- **Written by:** the factory-improvement worker (an AI session). The tests and this record are its own. The checker, schema and text changes were built by a Sonnet sub-worker from the tests. A second Sonnet sub-worker, which wrote none of it, reviewed the branch read-only.
- **Planned at:** `574fdde` (`origin/dev`), branch `feat/quote-located-citations`. ADR numbers through 0070 were seen on `origin/dev`.

## Context

The read-only `factory-evaluator` hands back a review result, and the coordinator checks it with `check-review.mjs`. Across the four sessions with a review, seven evaluator results came back. Two were accepted at the first attempt (host-library observation `2026-11-18-claude-2.1.325-factory-pilot-devops-engineering.md`). Three of the refused ones were refused for their citations only, as far as the refusals show. The rule then was: a citation gives `startLine` and `endLine` (at most five lines), and its quote must stand inside those lines.

The three results held seven bad citations, measured offline on the saved files:

- five gave a range wider than the quote (8 to 12 lines for a quote of one to three lines);
- two gave the line next to the one the quote stands on.

All seven quotes stand verbatim, exactly once, in the file they cite. Of the 54 citations in the five evaluator results that parse, two have a quote that occurs twice (22 characters each). In both, the evaluator's start line was the first occurrence.

The line numbers were never evidence. The grounding is the quote, which must stand verbatim in the pinned bytes. The lines only locate it, and the model was asked to write that locator exactly, by hand, in a record of about ten thousand characters it cannot check. ADR 0070 added a hook that shows the checker's reason to the evaluator before the hand-back leaves it. That hook has fired on a probe; it has never been seen correcting a real faulty result.

## Decision

1. **A citation is `{ sourceId, path, sha256, quote }`, with an optional `line`.**
   - `startLine` and `endLine` are no longer fields. The schema refuses them (`additionalProperties: false`).
   - `line` is the line on which the quote begins, as the Read tool numbers it. It is needed only when the quote occurs more than once in the file.
   - The limits on the quote are unchanged: at most five lines and 1,024 bytes (`CITATION_LIMITS = { maxQuoteLines: 5, maxQuoteBytes: 1024 }`).
2. **The checker finds the lines itself.** After the existing path, source and hash checks, it finds every occurrence of the quote in the pinned file. Line endings are normalised to LF, overlapping occurrences count, and one trailing newline of the quote does not count as a further line. Then:
   - **Accepted:** one occurrence, or `line` naming one of the occurrences. The citation is resolved to `startLine` (the occurrence, or `line`) and `endLine` (`startLine` plus the quote's lines, minus one).
   - **Refused:** no occurrence, the budget broken, more than one occurrence and no `line`, or a `line` that names no occurrence. A `line` on a unique quote that is not its line is refused too: a stated location that is wrong is a fault, and the hook (ADR 0070) shows where the quote begins.
   - **The reasons name what to do.** "the quote occurs K times, beginning on lines a, b; give `line` with one of them, or quote more so that it occurs once", and "`line` L is not a line where the quote begins; it begins on line X". At most ten line numbers are listed.
   - **The rest is unchanged:** every refused citation is still listed (at most ten), with its place, source and the file's line count, and with every problem it has. Text the result controls is still echoed through the existing echo rule.
3. **The result file is never changed.** The resolved locations appear only in the checker's own output: on acceptance, both entry points print `citations: [{ where, sourceId, path, startLine, endLine }]` beside the record. The evaluator writes no line numbers, so the checker corrects nothing it wrote. This is what separates this decision from the alternative ADR 0070 rejected, and the maintainer confirmed that reading.
4. **One format is accepted.**
   - The result schema is version 2.
   - A result with `version: 1` is refused before the schema, with a plain reason: "Result version 1 is no longer accepted: its citations give a line range. This checker accepts version 2, where a citation gives its source and an exact quote and the checker finds the lines itself (ADR 0071)."
   - In pre-check mode this is exit 1, the result's own fault, so the hook shows it to the evaluator.
   - No old result is kept in the repository. A workspace that still holds one gets that reason, and a fresh evaluator turn under the existing coordinator rule produces a version 2 result.
   - An alternative was not chosen: accepting both versions. The checker would then keep both rules, the texts would need to describe both, and a model shown both forms could mix them. Nothing stored depends on version 1, so nothing is lost by refusing it.
5. **One wording, everywhere.** Every text an evaluator loads and every evaluator prompt carries this sentence in place of the old one (generated in `tests/helpers/evaluator-wording.ts` from the checker's limits):

   > A citation gives its source and a quote copied exactly from that file, at most five lines and 1024 bytes, and no line range: the checker finds the lines itself; give `line` (the line the quote begins on, as the Read tool numbers it) only when the quote occurs more than once in the file; one bad citation gets the whole result refused.

   The places are:
   - both `evaluate-artifact` entries, `references/evidence.md`, `assets/report.json` and the `factory-evaluator` body;
   - the coordinator's prompt block in `references/dispatch.md`, `verification.md`, `skill-authoring.md` and `contract-authoring.md`, and the `orchestrator-agent-factory` body.

   The phrases that asked for a line range ("line range and quote", "start/end lines") are gone. A test keeps them out of every one of those files, the shipped example and the schema. The shipped example result is version 2.
6. **Unchanged:**
   - the hand-back hook (ADR 0070): it relays the checker's reason as before;
   - the job format and `review-job.mjs`: the job pins the installed schema and example by hash when it is built;
   - the coordinator's rules for a refused result: never edit it, at most one fresh evaluator turn.

## Consequences

- **The fault class most often seen is removed.** Line numbers that are off or too wide were the cause of the refusals of all three of the citation-refused pilot results. Their citations, with the exact files they cite, are fixtures (`tests/fixtures/pilot-citations`). Written as the new rule asks, every one is accepted. Whether those three results had other faults, which their refusals did not reach, is not known; the old workspaces' checkers predate the pre-check mode, and their checkout is gone in one case.
- **A new, smaller fault class appears:** a short quote that occurs more than once now needs `line`. Of 54 pilot citations, two were of that kind. A wrong `line` is refused, with the lines where the quote begins.
- **The syntax and prose faults remain** (two of the seven results: one character of JSON syntax, one answer in prose). The hook (ADR 0070) blocks those without needing a job.
- **The judgment-only result was not chosen** (dropping the fields the job already knows, about a quarter less text in the pilot results). That stays the maintainer's open choice.
- **Shown offline:**
  - the checker's behaviour in both entry points;
  - the pilot fixtures;
  - the one wording in every place;
  - the version 1 refusal.
  These were run as focused test files and the typecheck on Windows. The full suite and the addon matrix were not run on this branch by its author; the orchestrator runs the full gate. Linux CI is not read yet.
- **Not observed on the Host:** an evaluator writing quote-located citations, the first-attempt acceptance rate under this rule, the hook blocking a real faulty result and the evaluator correcting it. A sitting would have to show these. A useful measure is the first-attempt acceptance over the next five or more real journeys, against the baseline of two of seven.
