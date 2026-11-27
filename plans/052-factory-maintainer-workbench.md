# Plan 052: The agent factory as the maintainer's and contributors' workbench

Status: **In progress.** Written 2026-11-26 from a `/grill-with-docs` session with the maintainer. Step 1 is built: the `repo-doctor` Skill (`registry/skills/repo-doctor/`). The maintainer chose on 2026-11-26: fast checks run by the Skill, slow results only read, and an untracked, git-ignored `.repo-doctor-report.md` at the checkout root.
Decisions: [ADR 0080](../docs/adr/0080-factory-maintainer-workbench.md) (Proposed).
Base: origin/dev `24dcc77c` (#287).

## Why

The maintainer wants the `agent-factory` bundle (native Claude lane) to help him:

1. develop new Skills;
2. change and create bundles, Skills, agents, rules and workflows inside this repository;
3. create pull requests to `dev`;
4. guide contributors to keep their own local bundle versions and to open pull requests to `dev`;

and, added in this session, to keep the repository healthy (a repo doctor) and documented for maintainers and contributors.

## Where the factory stands (2026-11-26, read from dev)

- **Install:** `agents add agent-factory -t claude --native --allow-under-construction --copy -y`. Bundle status `under-construction`; Claude Code CLI, workspace scope only (`registry/bundles.json`, `hostAvailability`).
- **Roles:** `orchestrator-agent-factory` (lead) with `factory-realizer`, `factory-evaluator` and `factory-sync` (`registry/hosts/claude/agents/`).
- **Skills:** `author-skill`, `realize-artifact`, `author-contract`, `evaluate-artifact`, `author-bundle`, `coordinate-artifact`, `sync-host`, plus `host-agent-router`, `handoff`, `git-guardrails`. One rule: `skill-attribution.md`.
- **Read-only CLI checks it uses:** `skill-check`, `contract-check`, `factory-check`, `bundle-check`; and `npm run hostlib:verify`.
- **Plan 033 Claude stage:** merged in #219 (2026-11-17) and closed by the maintainer on 2026-11-18; 12 of 13 rows "closed with limit" (each route shown once or a few times), see `docs/plan-033-completion-matrix.md`. The Codex, Antigravity and Cline stages have not started.

| Need | Today | Gap |
|---|---|---|
| New Skills | `author-skill` drafts or repairs one Skill with quality and attribution evidence; `skill-check`; `evaluate-artifact` reviews. Shown live. | Shown once per route; no repeat on the merged version. |
| Change/create in the repo | Shared pair (`author-contract`), Claude agent draft (`realize-artifact` / `coordinate-artifact`), Bundle **proposal** for manual import (`author-bundle`), host-update plan (`sync-host`, read-only). | No route for rules, workflows or hooks; no agent realization for other hosts; Bundle route does not edit `bundles.json`. |
| Pull requests | Prepares a PR body against `dev` and stops (`sent: false`). | Does not push or open the PR. |
| Contributors' local versions and PRs | `references/contribution.md` installed for the lead; `docs/artifact-contribution.md` is a design. | ADR 0046 Workspace Source Registry accepted 2026-10-08 but not implemented; `prepare-artifact-contribution` runbook not built. |
| Repo health | Separate checks and the test suite; `agents doctor` checks an **installed workspace**, not the repository. | No single repo health review. |
| Maintainer/developer docs | User-facing `README.md`; `PROJECT.md`, `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`, `TEST_INFRA.md`, `ROADMAP.md`. | No maintainer/contributor guide. |

## Decisions of 2026-11-26 (the maintainer, through question dialogs)

- **D1. Repo doctor is a factory Skill**, not a CLI command.
- **D2. It reports, then proposes fixes.** It changes nothing; each fix goes through the normal factory route (tests first, independent review, the maintainer's word).
- **D3. The maintainer/contributor guide is a new root `CONTRIBUTING.md`.** It serves maintainers and outside contributors, with a maintainer section; `README.md` stays user-facing and links to it.
- **D4. Order:** the repo doctor and `CONTRIBUTING.md` come first, then the rest (below).
- **D5. The factory runs the repo doctor as a gate before preparing a PR**, and the PR body records its result.
- **D6. PR creation:** the factory may push its branch and open the PR to `dev` after it shows the maintainer the gated diff and he says yes. It never merges, force-pushes, rebases or commits to a protected branch.

## Steps

Each step: its own branch from fresh `origin/dev` and worktree; tests first; focused tests for a local change, the full gate (serial suite, addon matrix, `hostlib:verify`, typecheck) for a cross-area change; one independent read-only review; push and PR only at the maintainer's word; Linux CI read once.

1. **Repo doctor Skill (`repo-doctor`).**
   - Prep, read-only: list every consistency the repository already checks (tests, `hostlib:verify`, the four `*-check` commands, regeneration with `UPDATE_NATIVE=1` showing no diff, README/PROJECT counts, ADR numbering against open PRs, `CONTEXT.md` terms, stale references to removed files) and which have no check yet. Read `registry/skills/author-skill` and the factory bindings to follow the existing Skill shape.
   - Build: the Skill (SKILL.md, references, a deterministic script for the mechanical reads where possible), its place in the `agent-factory` bundle, tests. Built as a plain shared Skill: the standard native Claude projection installs it with its support files, as for `handoff`, so it needed no binding, overlay or installer change. Output: a report with findings, each with evidence and a proposed fix; no write outside its report.
   - Prep questions, answered by the maintainer on 2026-11-26: the Skill runs the fast checks and the no-write quick gates itself and only reads the full suite and CI results; its report is the untracked, git-ignored `.repo-doctor-report.md` at the checkout root.
2. **`CONTRIBUTING.md`.** Setup (Node 24, `npm ci`, build); the gates (focused vs full, the serial flags inside Claude Code); regenerating native files; the line-ending traps on Windows; the factory workflow and the repo doctor; the PR route to `dev` (branch, tests first, review, no force push); where decisions live (ADRs, `CONTEXT.md`, plans); a maintainer section. `README.md` links to it. A test pins the links and the commands it names, so it cannot go stale silently.
3. **Reinstall the factory workspace from dev and run one real journey** ("author a Skill", end to end) on the merged version. Record who sat it, what was shown and not shown, in a host-library observation.
4. **PR creation (D6)** in the contribution route: show the gated diff and the repo doctor result, ask, then push the branch and open the PR to `dev`; read CI once. Tests for the refusal paths (no word, protected branch, merged PR, force).
5. **Routes for rules, workflows and hooks:** authoring Skills in the shape of `author-skill`, each with its checker and evaluator rubric. Prep decides whether one Skill covers all three or one each.
6. **Local bundle versions for contributors (ADR 0046 Workspace Source Registry):** the selector and the installer, lockfile and doctor behaviour. The largest step; needs its own design review before building.
7. **Contributor runbook (`prepare-artifact-contribution`)** as an installed Skill, from `docs/artifact-contribution.md`, using the repo doctor (D5) and PR creation (D6).

## Not in scope

The Codex, Antigravity and Cline factory stages (Plan 033 order); any merge; changes to how `agents doctor` checks an installed workspace.

## Start here (next session)

1. `git fetch`; confirm no open PR touches the factory; read ADR 0080, this plan, `docs/plan-033-completion-matrix.md`, ADRs 0045, 0046, 0048, 0067, 0070, 0072.
2. Start step 1 with the read-only prep; bring its findings and the open questions to the maintainer before building.
