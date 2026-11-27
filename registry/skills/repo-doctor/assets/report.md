# Repo doctor report

Checkout: `<absolute path>` on `<branch>` at `<short HEAD>` (uncommitted changes: yes or no)
Checks run: readme-counts, relative-links, plans-index, adr-numbers, open-pr-adr-numbers
Skipped: each skipped check with its reason

## Findings (n)

- **<check>**: <evidence: file and line, or command and actual exit>
  - Proposed fix: <one fix, routed through the factory if the maintainer wants it>

## Quick gates

| Command | Exit |
| --- | --- |
| `npm run hostlib:verify` | <exit> |
| `node node_modules/typescript/bin/tsc --noEmit` | <exit or unavailable> |
| the same with `-p tsconfig.test.json` | <exit or unavailable> |

## Slow results read

| Result | Commit | Age | Conclusion |
| --- | --- | --- | --- |
| Latest CI run for the branch | <sha> (HEAD or not) | <age> | <conclusion> |

## Not checked

What this run did not check, and why.
