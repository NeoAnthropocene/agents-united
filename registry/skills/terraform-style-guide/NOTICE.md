# NOTICE — `terraform-style-guide`

## Source

- Upstream: [hashicorp/agent-skills](https://github.com/hashicorp/agent-skills) — `terraform-style-guide` by HashiCorp (IBM)
- Pinned commit: `516354c484b43fa5469567485113dd0c769c3d24`
- Upstream path: [`plugins/terraform/skills/terraform-style-guide`](https://github.com/hashicorp/agent-skills/tree/516354c484b43fa5469567485113dd0c769c3d24/plugins/terraform/skills/terraform-style-guide)
- Licence: **MPL-2.0** (Mozilla Public License 2.0, https://mozilla.org/MPL/2.0/). The full text is in `LICENSE` in this folder,
  copied from the upstream file nearest to the skill.

## Licence terms for this folder

MPL-2.0 is file-level copyleft: every file in this folder taken or modified from upstream stays under MPL-2.0, and the licence text travels with it in `LICENSE`. New files written for agents-united in this folder (`SKILL.md`, this `NOTICE.md`) are also released under MPL-2.0 so the folder has one licence. The rest of agents-united stays MIT.

## What changed

Adapted for agents-united on 2026-09-28 (Plan 030):

- A new `SKILL.md` was written in this catalog's runbook format (PROJECT.md §7.2: Overview,
  Execution Triggers, Input & Output Requirements, Step-by-Step Execution Runbook,
  Code & Config Exemplars, Edge Cases & Error Recovery, Verification Checklist). It
  condenses the upstream method, adds boundaries against neighbouring agents-united skills,
  and replaces host-specific tool names (AskUserQuestion, TaskCreate, `{baseDir}`) with
  host-neutral steps.
- The upstream `SKILL.md` body, frontmatter removed, is kept as `references/upstream-method.md`
  (or the file named below) so the full method stays available on demand.
- Every file under `references/` starts with a comment naming its upstream file and
  pointing here; relative links were rewritten to the new layout.
- Upstream file names changed: SKILL.md body -> references/style-conventions.md, SECURITY.md -> references/security.md.

This is an adaptation, not an endorsement: the upstream authors have not reviewed it.
