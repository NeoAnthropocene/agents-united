# NOTICE — `security-best-practices`

## Source

- Upstream: [trailofbits/skills-curated](https://github.com/trailofbits/skills-curated) — `openai-security-best-practices` by OpenAI, curated by Trail of Bits
- Pinned commit: `6d05be4889017b06fb15069f371afd220daffb62`
- Upstream path: [`plugins/openai-security-best-practices`](https://github.com/trailofbits/skills-curated/tree/6d05be4889017b06fb15069f371afd220daffb62/plugins/openai-security-best-practices)
- Licence: **Apache-2.0** (Apache License 2.0, https://www.apache.org/licenses/LICENSE-2.0). The full text is in `LICENSE` in this folder,
  copied from the upstream file nearest to the skill.

## Licence terms for this folder

The modified files carry a prominent notice (this file and the header comment in each file under `references/`), as Apache-2.0 §4(b) requires. The rest of agents-united stays MIT.

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

This is an adaptation, not an endorsement: the upstream authors have not reviewed it.
