# Final-draft quality and evidence

Measure the final folder, then record exact commands, raw outputs and actual exit codes. A check on an earlier draft does not validate later edits.

For Agents United source, reuse the selected reviewed checkout's validators:

| Validator | What it checks |
| --- | --- |
| `tests/helpers/skill-contract.ts`: `validateRewrittenSkill` | Seven entry sections, truthful in-house author/source policy, useful description, worked example, anti-patterns, evidence and hand-off. |
| `tests/helpers/skill-layout.ts`: `checkSkillLayout` | Compact entry, frontmatter, discoverable support files, links and maintainer-only eval fixtures. Pass the actual candidate parent directory and name. |
| `src/core/skill-portability-lint.ts`: `lintSkillPortability` | Actual candidate name/content/script syntax against the reviewed portable format constraints. |
| `src/core/skill-licence-lint.ts`: `lintSkillLicence` | Candidate metadata/licence and notice obligations; it does not recover missing upstream evidence. |
| `scripts/skill-quality/measure.ts`: `measureSkill`, `verdictOf` | Frozen-corpus templated share below 0.30 and no stub verdict. Use the existing frozen corpus, not a regenerated corpus. |

These functions belong to the declared source checkout, not the installed skill package. Invoke them on the actual candidate folder with the checkout's existing runtime/dependencies. If the environment cannot invoke a required validator on that folder, report the missing tool as blocked; do not substitute a report of the checkout's unchanged registry. Do not invent an installed command or weaken a validator. For a private skill with different declared authorship/format, identify the applicable owner/host requirements separately; do not falsely attribute it to this project to satisfy a contribution-only check.

The factory's source entry uses the seven required sections, <=90 lines, <=6000 characters and a trigger-first description <=1024 characters. Long material goes in linked support files. Do not add command injection, a template marker or a frozen-ratchet exception. Each script must have a real job benefit, supported runtime and checked input/output examples.

Validate installation bindings against the actual installed set in a fresh private workspace. Missing loading role, attribution rule or required support file blocks runnable delivery; metadata discovery alone cannot pass. Native format, runtime loading, enforcement and live behavior are different evidence claims. State the target/surface/version and unperformed checks plainly.

Prepare paired with-skill/without-skill prompts and an unrelated control under `evals/`; do not install that directory. No paid execution is implied by preparation. Report fixture preparation separately from measured behavior, and do not invent a success threshold before evaluation.
