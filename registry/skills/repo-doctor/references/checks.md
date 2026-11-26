# What the repo doctor checks

The maintainer decided on 2026-11-26 (Plan 052 step 1): the doctor runs the fast checks itself and only reads the results of the slow ones; its report is an untracked file in the worktree.

## Fast checks (`scripts/doctor.mjs`)

| Check | What it compares | A finding looks like |
| --- | --- | --- |
| `readme-counts` | The `**In numbers:**` line of `README.md` against the registry: end-user Bundles in `registry/bundles.json` (status other than `under-construction`), canonical agents and orchestrators in `registry/agents`, Skills and workflow playbooks in `registry/skills` | `README.md says 217 skills; registry/skills has 218.` |
| `relative-links` | Every relative inline link the scanner reads (see its limits below) in the root documents, `docs/` and `plans/`, outside code: the target exists inside the checkout with the exact case, and is not in the ignored `scratch/` folder | `docs/adr/0015-….md links ../plans/013-….md, which does not exist.` |
| `plans-index` | Every `plans/NNN-*.md` is linked from `plans/README.md`, or from a numbered plan it links | `plans/038-sound-model-catalogue.md is not reached from plans/README.md.` |
| `adr-numbers` | No two files in `docs/adr/` share a number | `ADR 0060 is used by … and ….` |
| `open-pr-adr-numbers` | ADR files that open pull requests to `dev` add (paths not on the base ref; an edit of a base ADR is not an addition), against the ADRs on the base ref (`--base`, default `origin/dev`, read with `git ls-tree`) and each other. Needs `gh`; skipped with `--offline`, and skipped, never passed, when the base ref cannot be read. Only the first 100 open pull requests are read, and the run says so when it reaches that | `ADR 0081 is added by #300 (docs/adr/0081-a.md) and #301 (docs/adr/0081-b.md).` |

Link findings carry the file and line (`docs/adr/0015-….md:5`). A count field missing from the `**In numbers:**` line is a finding, not a pass, and the catalogue sentence ("The N skills are …") is checked too. `plans/README.md` missing while numbered plans exist is a finding; a plan link counts only when its target exists with the exact case.

`--out` accepts only `<checkout>/.repo-doctor-report.md`, only when git ignores it and does not track it (git must answer), and only when it is absent or a plain file with no other hard link; anything else exits 2 and writes nothing. The open-PR check reads paths only: a pull request that renames a base ADR and keeps its number shows as a collision, with both file names in the evidence.

The test suite already pins the total Skill count that README.md and PROJECT.md state (`tests/skill-rewrite-s6-orchestration.test.ts`); the script's count check is the fast read of the README line, including the agent and Bundle counts, without the hour-long suite. The same link and plans rules are pinned for the repository itself by `tests/docs-links-and-plans-index.test.ts` (added by #291); the script carries its own copy so an installed Skill does not depend on the test suite. Its scanner reads inline links with regular expressions, not a full CommonMark parser: fences inside blockquotes, reference-style links and angle-bracket destinations with spaces are not read.

## Quick gates (run by the runbook)

`npm run hostlib:verify` (reads the lock hashes and guide citations), `node node_modules/typescript/bin/tsc --noEmit` and the same with `-p tsconfig.test.json`. They write nothing; without the installed compiler they are reported as unavailable, never run through `npx`, which may download a package. The package's `typecheck` and `build` scripts rebuild `dist/`, so the doctor never runs them; their result comes from CI. Record each actual exit; a failure is a finding with its first failing lines.

## Slow results

The full serial suite takes about an hour and the addon matrix about four minutes; the doctor does not run them. It reads:

- the latest CI run for the branch (`gh run list --workflow CI --branch <branch> --limit 1 --json conclusion,headSha,createdAt`); CI runs typecheck, the conformance suite and the test suite on Linux, not the addon matrix or `hostlib:verify`;
- a full-gate log the maintainer names, with its commit and time.

A result for another commit than HEAD is reported with that commit and its age, never as the state of HEAD.

## Judgement reads

- Terms in changed files that `CONTEXT.md` defines differently, or new domain terms it lacks.
- ADR status lines (`Proposed`, `Accepted`) against what the merged history shows.
- Mentions of files, commands or flags that no longer exist, in the files the branch changes.
- Regenerated native files: if the branch changes `registry/core` or `registry/agents`, whether the Claude native files were regenerated (`tests/native-claude-agents.test.ts` fails when they are stale).

Each judgement finding names the file and line it rests on.
