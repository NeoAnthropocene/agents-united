# Final-draft quality and evidence

Measure the final folder, then record exact commands, raw outputs and actual exit codes. A check on an earlier draft does not validate later edits.

For Agents United source, reuse the selected reviewed checkout's validators:

| Validator | What it checks |
| --- | --- |
| `tests/helpers/skill-contract.ts`: `validateRewrittenSkill` | Seven entry sections, truthful in-house author/source policy, useful description, worked example, anti-patterns, evidence and hand-off. |
| `tests/helpers/skill-layout.ts`: `checkSkillLayout` | Compact entry, frontmatter, discoverable support files, links and the `evals/evals.json` file (see Evals file below). Pass the actual candidate parent directory and name. |
| `src/core/skill-portability-lint.ts`: `lintSkillPortability` | Actual candidate name/content/script syntax against the reviewed portable format constraints. |
| `src/core/skill-licence-lint.ts`: `lintSkillLicence` | Candidate metadata/licence and notice obligations; it does not recover missing upstream evidence. |
| `scripts/skill-quality/measure.ts`: `measureSkill`, `verdictOf` | Frozen-corpus templated share below 0.30 and no stub verdict. Use the existing frozen corpus, not a regenerated corpus. |

These functions belong to the declared source checkout, not the installed skill package. Invoke them on the actual candidate folder with the checkout's existing runtime/dependencies. If the environment cannot invoke a required validator on that folder, report the missing tool as blocked; do not substitute a report of the checkout's unchanged registry. Do not invent an installed command or weaken a validator. For a private skill with different declared authorship/format, identify the applicable owner/host requirements separately; do not falsely attribute it to this project to satisfy a contribution-only check.

The factory's source entry uses the seven required sections, <=90 lines, <=6000 characters and a trigger-first description <=1024 characters. Long material goes in linked support files. Do not add command injection, a template marker or a frozen-ratchet exception. Each script must have a real job benefit, supported runtime and checked input/output examples.

Validate installation bindings against the actual installed set in a fresh private workspace. Missing loading role, attribution rule or required support file blocks runnable delivery; metadata discovery alone cannot pass. Native format, runtime loading, enforcement and live behavior are different evidence claims. State the target/surface/version and unperformed checks plainly.

## Evals file

The draft carries `evals/evals.json`; `skill-check` fails every draft without it, so put `evals/evals.json` in the allowed paths and write it with the other files. Format:

```json
{
  "skill_name": "<the Skill's name>",
  "evals": [
    { "id": 1, "prompt": "A realistic request a user would type to get this job done.", "expected_output": "The observable result that shows the Skill did its job." },
    { "id": 2, "prompt": "A second, different realistic request for the same Skill.", "expected_output": "The observable result that shows it did that job too." }
  ]
}
```

The layout gate checks: valid JSON object; `skill_name` equal to the `name` in `SKILL.md`; `evals` an array of 2 to 5 objects; each with a numeric `id`, a string `prompt` and a string `expected_output`, both at least 40 characters; no two prompts the same. A useful eval is a request a user would really type, with the visible result that proves the Skill did its job, not a restatement of the Skill's rules. A later evaluation runs the same prompt with and without the Skill and adds an unrelated control on which the Skill should not act, so write prompts that make that comparison possible; the layout gate checks none of this.

Writing these prompts is preparation, not a run: no paid execution is implied, and do not invent a success threshold before evaluation. Report fixture preparation separately from measured behavior. `evals/` is not installed with a Skill; it stays in the source draft.
