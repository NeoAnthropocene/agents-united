# Worked example: one new workflow, then a repair after a failed check

Invented scenario: a contributor on branch `feature/release-flow-workflow` already has the portable Skill `release-flow` in `registry/skills/release-flow/` and wants a native Claude workflow that lists the merged pull requests and drafts release notes from them. The brief supplies the purpose, the name `release-flow`, local intent, the absolute checkout, the roles the script may request (`code-reviewer`) and original authorship.

## Create

1. Read the bound attribution rule. The text is original; a script has no front matter, so the credit lives in the report.
2. Check the job: the branch is not protected, `registry/hosts/claude/workflows/release-flow.js` is absent and `registry/skills/release-flow/SKILL.md` exists. Had the Skill been missing, the route would stop here and send the contributor to `author-skill` first.
3. Write the script: `export const meta` with the name `release-flow`, two phases, and a body that opens each phase with `phase(...)` and requests only `code-reviewer` as an `agentType`.
4. Put the text in the job's `content` and run `scripts/draft.mjs`. The report shows `registry/hosts/claude/workflows/release-flow.js` and the hash of the paired Skill it read. `registry/bundles.json` is not touched.
5. Run the checkout's built CLI (the `cli.js` file in its `dist` folder) with `workflow-check --artifact <absolute workflow path>`. Exit 0 with no findings and an empty `unresolvedAgentTypes`: keep the raw JSON.
6. Return the report: the hash, the one-file diff, the raw check, and the open items: quality pending, live unverified, Cline and Antigravity not covered, and whether any Bundle lists the `release-flow` Skill.

## Repair after a failed check

Repair mode: the script exists, so the name is not free and does not need to be. A later edit renamed the second phase in the body to `phase('Draft')` while `meta.phases` still says `Review`. `workflow-check` exits 1 with a `lint` finding: the phase titles differ. Save the baseline hash, edit the script in place so both spell `Review`, run the checker again and keep both raw outputs. The helper is not run again, because the file exists.

A request whose `agentType` is a variable, for example `{ agentType: role }`, is not a finding: the check passes and lists it in `unresolvedAgentTypes` with its line. The report names it as not verified; it is never turned into a literal just to empty the list.

## Hand-off

The report names the draft, the final hash, the baseline diff, the check and its exit, every unresolved agent type, and what stays unverified. Upstream intent additionally prepares the project's contribution template with `sent: false`; it still does not commit, push or publish. If `dist` is missing in the checkout, the report says the checker was blocked and the draft is not called checked.
