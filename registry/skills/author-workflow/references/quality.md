# Final-draft quality and evidence

Measure the final script, then record exact commands, raw output and actual exit codes. A check on an earlier draft does not validate later edits.

## The deterministic checker

`workflow-check` is read-only and takes one absolute path. It never runs the script: `meta` is read as data and the body is only compiled. It belongs to the declared source checkout, not to the installed Skill, so run it there on the written file, with the checkout's built CLI, the `cli.js` file in its `dist` folder, run with Node:

`workflow-check --artifact <absolute workflow path>`

The checkout needs a built `dist` folder. If it has none, or the command cannot run, report the checker as blocked with the consequence; do not substitute a reading of your own. It prints JSON and exits 0 when passed, 1 when failed and 2 when unavailable or misused. Keep the raw JSON. It keeps `quality: pending` and `live: unverified`, and passing means only these checks passed:

| Check | What fails |
| --- | --- |
| `name`, `placement` | The file name is not lower-case kebab-case `.js`, is a Windows device name, or the file is not at `registry/hosts/claude/workflows/<name>.js` in a folder named exactly `registry`. |
| `size`, `encoding` | The file is over 128 KiB, is not UTF-8, has a byte order mark or a NUL byte. |
| `lint` | `export const meta` is not the first statement or a pure literal with a string `name` and `description`; phase titles in `meta.phases` and in the body differ; the script loads a module or calls something that breaks resume. |
| `meta-name` | `meta.name` is not the file name without `.js`; the host runs a saved workflow as `/<name>`. |
| `skill-pair` | `registry/skills/<name>/SKILL.md` is not there as a regular file, or the Claude host profile lists that Skill as unsupported, so the projector would skip the script. A link or junction on that path makes the result unavailable (exit 2). |
| `agent-types` | An `agentType` written as one string literal names no native Claude role file in `registry/hosts/claude/agents/`. |
| `render` | The installed form (line endings normalised, one managed marker as the last line) would differ from the script, or the script already carries the marker. |

## What the checker does not settle

- **Unresolved agent types.** A request whose value is a variable, a call, a template with `${`, a concatenation or a shorthand cannot be resolved by reading the script. It is not a finding; it is listed in `unresolvedAgentTypes` with its line and an excerpt, and the check passes on it. Report each entry to the user as not verified. A type passed through a spread is not seen at all.
- **Installability.** A pass does not say that a Bundle lists the paired Skill and the agent roles, or that the destination in a workspace is free of an unmanaged file. It assumes the native lane is on.
- **The tree during the run.** A folder swapped for a link by another process after the checker walked the path is not detected.

## Writing the script

- Start with `export const meta = { name, description, phases }` as a pure literal: no getters, calls, spreads or computed keys. Put `name` equal to the file name; add `whenToUse` when the host should offer the workflow.
- Use only the runtime's own names (`agent`, `pipeline`, `parallel`, `phase`, `log`, `args`, `budget`, `workflow`). No `import`, `require` or dynamic import; the script reads its input from `args` and never the clock.
- Request an `agentType` only for a role the registry has as a native file, or choose it at run time and expect it to be listed as not verified.
- Read the three committed scripts in `registry/hosts/claude/workflows/` for the shape; do not copy their wording.

## What this route does not cover

Cline `.md` workflows wait for the Cline factory stage, and Antigravity has no native workflow here. State this in every report, together with the unperformed live check: native format, runtime loading, run behaviour and the usefulness of the result are different evidence claims.

## The paired Skill and the Bundle

The helper reads the paired Skill and never changes it. Whether the Skill is listed in a Bundle, and in which one, is decided by the Skill's own route; a workflow for a Skill no Bundle lists is never installed. Say so in the hand-off when it applies. A workflow has no `evals/evals.json`; the evals file belongs to a Skill.
