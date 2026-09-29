# NOTICE — `semgrep-scanning`

## Source

- Upstream: [trailofbits/skills](https://github.com/trailofbits/skills) — `static-analysis/semgrep` by Trail of Bits
- Pinned commit: `0cc1c73a5e96749ab32d7ea5e14892fafa6972ae`
- Upstream path: [`plugins/static-analysis/skills/semgrep`](https://github.com/trailofbits/skills/tree/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/static-analysis/skills/semgrep)
- Licence: **CC-BY-SA-4.0** (Creative Commons Attribution-ShareAlike 4.0 International, https://creativecommons.org/licenses/by-sa/4.0/). The full text is in `LICENSE` in this folder,
  copied from the upstream file nearest to the skill.

## Licence terms for this folder

This folder is an adaptation and, as ShareAlike requires, the whole folder (including the new `SKILL.md` and this `NOTICE.md`) is released under CC-BY-SA-4.0. It is a separate work from the rest of agents-united, which stays MIT.

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
- Ported: scripts/run-scans.sh is now scripts/run_scans.py (Python 3 standard library, same plan file, same scans.json, same command construction), so it runs on Windows. Tests for the port are in tests/skill-scripts/. Not shipped: upstream's own test files, agents/openai.yaml, assets/. Shipped unchanged: scripts/merge_sarif.py. workflows/scan-workflow.md moved to references/workflow-scan-workflow.md.

This is an adaptation, not an endorsement: the upstream authors have not reviewed it.
