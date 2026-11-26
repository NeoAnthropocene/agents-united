# One run of the repo doctor

The maintainer asks, on a branch that adds a new Skill: "Run the repo doctor before I open the PR."

1. The checkout is `C:\github\scratch-pilot\p033-wt\new-skill`, branch `feat/new-skill`, HEAD `1a2b3c4d`, no uncommitted changes.
2. `node "${CLAUDE_SKILL_DIR}/scripts/doctor.mjs" --root C:\github\scratch-pilot\p033-wt\new-skill --out C:\github\scratch-pilot\p033-wt\new-skill\.repo-doctor-report.md` exits 1 with three findings:
   - `readme-counts`: `README.md says 217 skills; registry/skills has 218.` and `README.md says 146 domain skills; registry/skills has 147.`
   - `relative-links`: `docs/adr/0081-new-skill.md:5 links ../plans/053-new-skill.md, which does not exist.` (the ADR sits one folder deeper than it assumed).
3. `npm run hostlib:verify`, `npx tsc --noEmit` and `npx tsc --noEmit -p tsconfig.test.json` each exit 0.
4. `gh run list --branch feat/new-skill --limit 1 --json conclusion,headSha,createdAt` shows `success` for `9f8e7d6c`, three hours old. That is not HEAD, so the report says: "The latest CI run on the branch passed for 9f8e7d6c, three hours ago; it says nothing about HEAD 1a2b3c4d."
5. Judgement: the new SKILL.md calls a Bundle a "pack"; `CONTEXT.md` defines Bundle and has no "pack". One finding, with the line.

The report lists four findings (two README counts, the link, the term) with three proposed fixes:

- Set the README counts to 218 and 147.
- Change the ADR link to `../../plans/053-new-skill.md`.
- Use "Bundle" in SKILL.md line 12.

The chat summary says the same and adds that the full suite was not run. The doctor changes no file except `.repo-doctor-report.md`. The maintainer asks the factory to make the three fixes on the branch, tests first.

## What the run did not do

It did not edit README.md, the ADR or the Skill. It did not rerun CI or run the full suite. It did not commit or push the report.
