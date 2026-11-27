# Workflow draft report

- Purpose, paired Skill and create/repair scope:
- Host executing authoring; delivery covered (Claude native workflow); reviewed versions and inputs:
- Local or upstream intent:
- Absolute source checkout, branch and its head commit:
- Baseline and the one allowed workflow path:

| Final file | Hash | Why the job needs it |
| --- | --- | --- |
| `registry/hosts/claude/workflows/<name>.js` | | the script |
| `registry/skills/<name>/SKILL.md` | | read only; the paired Skill |

Attach the before/after diff of the script and state whether unrelated edits are preserved. State that `registry/bundles.json` was not touched and whether a Bundle lists the paired Skill.

| Source disposition | Upstream, pin, licence and notice evidence | Credit changes | Unresolved owner and task |
| --- | --- | --- | --- |

| Check | Exact command | Raw output location | Actual exit | Finding and consequence |
| --- | --- | --- | --- | --- |

Paste the raw `workflow-check` JSON. List every `unresolvedAgentTypes` entry (line and excerpt) as not verified. State what was not checked: quality (`pending`), live loading and behaviour (`unverified`), installability, and Antigravity and Cline delivery (not covered).

Hand-off: remaining review or prerequisite, named owner and exact next action. State whether any external action occurred; the authoring job does not install, commit, push or publish.
