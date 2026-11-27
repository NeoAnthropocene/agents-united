# ADR 0080: The agent factory as the maintainer's and contributors' workbench

- **Status**: Proposed, 2026-11-26. The decisions below were made by the maintainer through question dialogs in a `/grill-with-docs` session; the work is planned in [Plan 052](../../plans/052-factory-maintainer-workbench.md) and in progress (step 1, the `repo-doctor` Skill, is built).
- **Context**: The `agent-factory` bundle (native Claude lane, workspace scope, `under-construction`) authors Skills, shared pairs, Claude agent drafts and Bundle proposals, reviews them and plans host-update syncs; the Plan 033 Claude stage closed on 2026-11-18 with most rows closed with limit. It prepares a pull-request body and stops; it has no routes for rules, workflows or hooks; the Workspace Source Registry of ADR 0046 is not implemented; the repository has no single health review (`agents doctor` checks an installed workspace) and no maintainer or contributor guide.
- **Decision**:
  1. **Repo doctor is a factory Skill** (`repo-doctor`), not a CLI command. It reviews the repository's consistency, using the existing checks and reads where they exist.
  2. **It reports, then proposes fixes.** It writes nothing but its report. Each finding carries its evidence and a proposed fix; a fix goes through the normal factory route (tests first, independent review, the maintainer's word).
  3. **A new root `CONTRIBUTING.md`** is the maintainer and contributor guide, with a maintainer section. `README.md` stays user-facing and links to it.
  4. **Order:** the repo doctor and `CONTRIBUTING.md` first; then a real factory journey on the merged version, pull-request creation, routes for rules, workflows and hooks, the Workspace Source Registry, and the contributor runbook.
  5. **The factory runs the repo doctor before it prepares a pull request**, and the pull-request body records the result.
  6. **Pull-request creation:** the factory may push its branch and open the pull request to `dev` after it shows the maintainer the gated diff and he says yes. It never merges, force-pushes, rebases or commits to a protected branch. This changes the contribution route's current stop at a prepared body (`sent: false`).
- **Consequences**:
  - Positive: one place to ask "is the repository healthy", one guide for maintainers and contributors, and a factory that can take a change from draft to an open pull request under the maintainer's word.
  - The repo doctor depends on checks that take long (the full suite takes about an hour); which it runs and which it only reads is decided in Plan 052 step 1.
  - Opening pull requests widens what the factory does on the maintainer's account; the refusal paths (no word, protected branch, merged pull request, force) need tests.
  - Not decided here: the design of the Workspace Source Registry's installer, lockfile and doctor behaviour (ADR 0046), and the other hosts' factory stages.
