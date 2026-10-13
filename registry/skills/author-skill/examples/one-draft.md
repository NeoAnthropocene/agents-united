# Worked example: one original draft, then a scoped repair

Invented scenario: the user repeatedly turns incident notes into owner/action records and asks for a private `incident-actions` skill. The task supplies a reviewed source checkout, a separate absolute draft root, original authorship, the target host/format, loading binding and a budget for deterministic checks only.

## Create

1. Confirm the useful output: a table of action, named owner, due date or unknown, source evidence and unresolved decision. The skill must not invent missing owners or deadlines.
2. Read the bound attribution rule. The user supplied original task material; record original work, with the actual author/licence and no upstream source field.
3. Plan `SKILL.md`, a linked worked example and an output template. Add a reference only if the edge-case handling needs it. No script is needed for this text-only job.
4. Author a short entry and example whose incomplete notes produce explicit unknowns. Remove generic repository commands that do not help turn incident notes into actions.
5. Validate the final candidate folder with the applicable source-checkout/host checks. Record actual commands/exits, final paths/hashes and any loading or host behavior still unverified.
6. Return the draft and diff. The private task creates no installed files or sent PR.

Expected artifact behavior: a note reading “retry the import; ask Lina who owns it” yields an unresolved ownership decision, not “Lina owns the retry.” This concrete example changes the skill's decision-making.

## Repair

The user later asks only to fix the trigger description. Baseline includes their edited `examples/customer-notes.md`. Copy/hash the existing folder, edit the description and its directly related wording, and compare the final inventory to the baseline. The user's example hash must remain unchanged. An opportunity to restructure the examples is outside this repair scope.

If an adapted reference appears without a licence or pin, stop that reuse and name the evidence needed. If a required validator is unavailable, preserve the draft and return a blocked check rather than a clean verdict. If the output is inside the validation checkout or a managed install, resolve the location before editing.

## Hand-off

The report identifies the local draft, final hashes, baseline diff, original/adapted disposition, checks and unverified loading/behavior. Upstream intent additionally prepares the selected project's contribution template and required credit changes; it still does not send a PR or publish the skill.
