# Worked example: one new rule, then a repair after a failed check

Invented scenario: a contributor on branch `feature/release-notes-rule` wants the `agent-factory` bundle to carry a rule that makes release notes name the user-visible change first. The brief supplies the purpose, the name `release-notes`, the bundle key, local intent, the absolute checkout and original authorship.

## Create

1. Read the bound attribution rule. The text is original; there is no source field to carry, because a rule has no front matter.
2. Check the job: the branch is not protected, `registry/rules/release-notes.md` is absent and `agent-factory` exists. Read the bundle's existing rule, `skill-attribution.md`, so the new one does not contradict it.
3. Write the rule: a title, two verifiable instructions, one topic.
   ```
   # Release notes

   - Name the user-visible change before the internal cause.
   - Link the issue or the pull request for every item.
   ```
4. Put the text in the job's `content` and run `scripts/draft.mjs`. The report shows `registry/rules/release-notes.md` and `rules: ["skill-attribution.md", "release-notes.md"]` with their hashes.
5. Run the checkout's built CLI (the `cli.js` file in its `dist` folder) with `rule-check --artifact <checkout>/registry/rules/release-notes.md`. Exit 0 with no findings: keep the raw JSON.
6. Return the report: both hashes, the two-file diff, the raw check, and the open items: quality pending, live unverified, Antigravity not covered.

## Repair after a failed check

A later draft added a heading `## Host Routing` with a note about another host. `rule-check` exits 1 with a `RENDER_CHANGE` finding: the Claude rendering would drop that section and everything under it, because its heading names another host's routing. Save the baseline hash, edit the rule in place so the heading reads `## Where each host reads this`, run the checker again and keep both raw outputs. The helper is not run again, because the file exists and the bundle already lists it. The other lines of the rule keep their hash-checked bytes.

Had the rule started with a `---` block copied from another host, the `FRONT_MATTER` finding would be fixed by removing the block, not by adding a marker.

## Hand-off

The report names the draft, the final hashes, the baseline diff, the check and its exit, and what stays unverified. Upstream intent additionally prepares the project's contribution template with `sent: false`; it still does not commit, push or publish. If `dist/` is missing in the checkout, the report says the checker was blocked and the draft is not called checked.
