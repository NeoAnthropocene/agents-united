# Final-draft quality and evidence

Measure the final rule, then record exact commands, raw output and actual exit codes. A check on an earlier draft does not validate later edits.

## The deterministic checker

`rule-check` is read-only and takes one absolute path. It belongs to the declared source checkout, not to the installed Skill, so run it there on the written file:

the checkout's built CLI, the `cli.js` file in its `dist` folder, run with Node: `rule-check --artifact <absolute path of registry/rules/<name>.md>`

The checkout needs a built `dist/`. If it has none, or the command cannot run, report the checker as blocked with the consequence; do not substitute a reading of your own. It prints JSON and exits 0 when passed, 1 when failed and 2 when unavailable or misused. Keep the raw JSON. It keeps `quality: pending` and `live: unverified`, and passing means only these checks passed:

| Check | What fails |
| --- | --- |
| `name` | The file name is not lower-case kebab-case `.md`, is a Windows device name, or is a host entry-point name (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `CURSOR.md`, `CLAUDE.local.md`, in any case). |
| `size`, `encoding` | The file is over 64 KiB, is not UTF-8, has a byte order mark or a NUL byte. |
| `budget` | The rule has more lines than the Claude budget, 200, counted as the projector counts (a final newline adds one). The installer silently skips such a rule, so the check is the only warning. |
| `front-matter` | The rule starts with a `---` block. A canonical rule carries none; the projector writes its own marker first. |
| `structure` | There is no level-1 title or no body under it. |
| `managed-marker` | The text contains the Agents United managed marker, which the projector writes itself. |
| `claude-render` | The Claude rendering would drop or change text. |

## Rendering residue

The Claude projector drops any section whose heading names another host's routing (for example a heading containing "Host Routing") with everything under it, rewrites a few phrases, and replaces some headed sections with its own text. The finding names the heading or phrase: rename the heading or reword the phrase in the authored text. Do not work around it by adding a marker or front matter.

## Writing the rule

- Write instructions concrete enough to verify ("run `npm test` before committing", not "test your changes"), grouped under headings, one topic per file. Contradicting rules make Claude pick one arbitrarily, so read the existing rules of the bundle first.
- A rule is context, not enforcement. Anything that must always hold needs a hook; anything that is a procedure for some tasks needs a skill.
- Keep it short: the 200-line budget is a ceiling, and every line costs context in every session.
- No front matter. Path scoping (`paths`) is outside this route, so a canonical rule is always unscoped.

## What this route does not cover

Antigravity. The installer copies a canonical rule there as it is, and Antigravity drops a modular rule without front matter and a valid `trigger`, so a rule written here does not reach it unless a native rule exists under `registry/hosts/antigravity/rules/`. That check belongs to the Antigravity factory stage. State this in every report, together with the unperformed live check: native format, runtime loading, enforcement and live behaviour are different evidence claims.

## Bundle entry

The helper appends the file name to the one bundle's `rules[]`. Confirm that the diff of `registry/bundles.json` is that one line and that nothing else moved. A rule file that no bundle lists is never installed; a bundle that lists a missing file fails registry validation.

A rule has no `evals/evals.json`; the evals file belongs to a Skill.
