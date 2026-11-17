# Prepared evaluation binding — no runs performed

The cases in `fixtures.json` are **prepared and unbound**. They are not runnable or verified until a maintainer supplies the machine-specific inputs below. This file is a manual preparation recipe, not an installer, distributed helper, new CLI or authorization to run a model or Host. The unrelated control in `evals.json` is self-contained and needs no Bundle intake.

The primary `evals.json` holds four representative matched pairs and the unrelated control, within the existing two-to-five-record per-plan limit. The maintainer-only `extended-2026-11-11.json` holds the other four pairs. Together they preserve all nine records; neither plan filters, replaces or claims execution of the other:

| Record | Prepared scenario | Plan and fixture |
| --- | --- | --- |
| 1 | Data-rich Domain, no integrations | Primary; `fixtures.json#case-1` |
| 2 | Organization, empty prerequisites | Primary; `fixtures.json#case-2` |
| 3 | Required integration unavailable | Primary; `fixtures.json#case-3` |
| 4 | Optional integration unavailable | Primary; `fixtures.json#case-4` |
| 5 | Existing same-scope authorization | Extended; `fixtures.json#case-5` |
| 6 | Missing reload evidence | Extended; `fixtures.json#case-6` |
| 7 | Scoped update and protected note | Extended; `fixtures.json#case-7` |
| 8 | Incomplete native leader | Extended; `fixtures.json#case-8` |
| 9 | Unrelated summary control | Primary; self-contained, no fixture or Bundle intake |

For each future case, after separate authorization for the evaluation:

1. Choose the actual validation checkout and Node executable. Record their absolute paths, checkout HEAD and runtime version. Inspect the listed source files and their actual licences/notices; if a required source, permission or safe root is unavailable, stop that dependent case and record the precondition as unavailable. Do not invent a pin or assume the checkout remains unchanged.
2. Create separate empty case-specific absolute roots for draft, preserved baseline, evidence and pinned inputs. Confirm they are disjoint from each other, the source checkout, managed installs, credentials and protected paths, and inspect for links that cross those boundaries. The case's baseline is empty except where `baselineFiles` specifies it. For case 7, prepare the four existing proposal files as a compatible complete proposal with the stated identity and empty prerequisites; its baseline report may record binding-time paths and hashes. Create the exact protected note bytes shown. Save every baseline byte and hash outside the draft before the run. A preserved note is not an authored output.
3. Write `inputs/requirements.md` from the case's literal `taskRequirements`, `authorization` and `acceptanceExtra`; retain the common constraints and acceptance IDs. Merge the common fixture and that one case into a complete fixed job: include all identity, operation, intent, leader/roster/skills, exact `BundlePrerequisites`, provider/dependency and authorization facts, source disposition, selected target surface, source paths and actual inspected availability, full baseline, allowed change list, four output paths, protected roots, constraints, acceptance, actual checkout/runtime, selected offline checks and the common budgets. Explicitly record empty arrays, absent leader, missing required inputs or unobserved availability. Do not treat the fixture's hypothetical setup authorization as authorization to perform setup in this preparation.
4. Pin the complete input file list and calculate SHA-256 for each actual input and preserved baseline file. Serialize `job.json`, save its exact bytes outside the draft, and compute a caller-held SHA-256 digest of those bytes. Record the output inventory and root paths before execution. Do not put the job inside the four-output draft. Resolve the target Host's reviewed guide/profile/observations and applicable source holds only from the actually pinned permitted material; missing required evidence stays an open precondition.
5. For the matched pair, provide the **same exact completed job bytes, digest, supporting inputs, task prompt, baseline and budgets** to both conditions. Only Skill availability differs. Use the same bound draft path sequentially: after saving the first condition’s complete outputs, restore its byte-identical baseline before the second condition. Retain each condition’s complete actual outputs, commands, raw logs and exits outside the draft. Never copy a worker's report into the other condition. Compare each result to the original caller-held inputs and independently inspect final bytes and the full diff.

Case 8 intentionally includes an unrealized leader: its missing core, contract and native delivery are expected findings, not permission to create them. Case 7's protected note and existing output baseline are separate from the four authored paths. Source paths list existing examples, not blanket authorization to reuse held or unreviewed sources. Across the two plans each of the eight case prompts is identical within its pair; bind its referenced complete job using this recipe. Both conditions receive identical completed job and prompt bytes. The control has its own prompt and does not use these jobs.

No evaluation has been run. Merely preparing fixtures, parsing JSON or inspecting links does not establish Skill invocation, quality, provisioning behavior or live Host adherence.
