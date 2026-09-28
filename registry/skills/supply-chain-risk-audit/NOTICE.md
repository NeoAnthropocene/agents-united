# NOTICE — `supply-chain-risk-audit`

## Source

- Upstream: [trailofbits/skills](https://github.com/trailofbits/skills) — `supply-chain-risk-auditor` by Trail of Bits
- Pinned commit: `0cc1c73a5e96749ab32d7ea5e14892fafa6972ae`
- Upstream path: [`plugins/supply-chain-risk-auditor`](https://github.com/trailofbits/skills/tree/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/supply-chain-risk-auditor)
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
- Renamed from supply-chain-risk-auditor. Shipped unchanged: scripts/collect.py, render.py, model.py, sources.py, pyproject.toml, uv.lock. Not shipped: the scripts' test files, evals/, agents/openai.yaml, assets/.

This is an adaptation, not an endorsement: the upstream authors have not reviewed it.
