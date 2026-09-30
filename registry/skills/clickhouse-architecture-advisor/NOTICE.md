# NOTICE — `clickhouse-architecture-advisor`

## Source

- Upstream: [ClickHouse/agent-skills](https://github.com/ClickHouse/agent-skills) — `clickhouse-architecture-advisor`
- Pinned commit: `2f6ec4b17a81a435dd116f9ac19d7b45d44dbd61`
- Upstream path: [`skills/clickhouse-architecture-advisor`](https://github.com/ClickHouse/agent-skills/tree/2f6ec4b17a81a435dd116f9ac19d7b45d44dbd61/skills/clickhouse-architecture-advisor)
- Licence: **Apache-2.0**. The full text is in `LICENSE` in this folder, copied from the upstream repository root at the pinned commit.

## Licence terms for this folder

Apache-2.0 permits use, reproduction and distribution of the work and of derivative works, provided the licence text and the upstream NOTICE travel with them, changed files carry a statement of change, and copyright, patent, trademark and attribution notices are kept. `LICENSE` is the licence text. Every restored file states where it came from and that it is unmodified. This `NOTICE.md` records the changes to the folder as a whole. The rest of agents-united stays MIT.

## What changed

- `SKILL.md` was written for agents-united in this catalog's runbook format (PROJECT.md §7.2) and condenses the
  upstream method; it is not a copy of the upstream `SKILL.md`.
- Restored on 2026-09-30 (Plan 032 PR D, docs only): 11 upstream files (decision rules under `rules/`, worked examples under `examples/`, `mappings/doc_links.yaml` and `schemas/recommendation_schema.yaml`), copied verbatim from the
  pinned snapshot in `host-library/_upstream/clickhouse-architecture-advisor/`. Each has a one-line comment pointing here
  (markdown with frontmatter carries it right after the frontmatter). Nothing in them was edited.
- Not restored, on purpose: upstream repository packaging (README, AGENTS.md, metadata.json, CHANGELOG, contribution
  scaffolding). Scripts and attribution marks, if any, are handled in later PRs.

## Upstream NOTICE (verbatim)

The upstream repository ships the following `NOTICE` file. It is reproduced here as Apache-2.0 §4(d) requires.

```text
Agent Skills for ClickHouse

This repository includes software developed at Vercel, Inc.
(https://github.com/vercel/agent-skills)

Some files in packages/clickhouse-best-practices-build/src/ are
adapted from the Vercel Agent Skills project:
- types.ts
- parser.ts
- build.ts
- validate.ts

Copyright (c) Vercel, Inc.
Licensed under the MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
