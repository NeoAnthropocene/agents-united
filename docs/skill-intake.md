# Skill Intake Procedure

Plan 026. The checklist for bringing **any** new skill into the catalog — hand-authored or
third-party — so it lands compliant with every active host's rules on day one, instead of
failing quietly the first time someone installs it on the host you didn't test. Plans 027/028
(third-party skill batches) carry this checklist inline so they don't have to wait on this
document; every future skill addition should follow it too.

Run these steps **in order**. A skill that fails an early step (licence, host check) should not
be adapted or wired before the failure is resolved.

## 1. Licence check

Read the licence **nearest to the skill** first (the skill or plugin folder), then the
repository root; record which file decided it. Then place it in a tier (ADR 0024):

| Tier | Licences | May vendor? | Requirements |
|---|---|---|---|
| Permissive | MIT, Apache-2.0, BSD, ISC, CC-BY, CC0 / public domain | Yes | README credit; upstream `LICENSE`/`NOTICE` copied into the skill folder when the licence asks for it (Apache `NOTICE`, MIT/BSD notice) |
| Weak copyleft | MPL-2.0 | Yes | `LICENSE` in the skill folder; `metadata.license: MPL-2.0`; modified files stay MPL-2.0; `NOTICE.md`; README credit |
| Share-alike | CC-BY-SA-4.0 | Yes | `LICENSE` in the skill folder; `metadata.license: CC-BY-SA-4.0`; the adapted skill is released under CC-BY-SA-4.0; `NOTICE.md`; README credit |
| Blocked | Any NonCommercial or NoDerivatives term, GPL/AGPL/LGPL, no licence | No | Link-only pointer at most; do not copy its instructions or scripts |

- Each skill folder is a separate work: share-alike and copyleft terms reach that folder, not
  the MIT-licensed rest of the repository.
- `NOTICE.md` (the changes note) states the upstream URL and pinned SHA, the licence, and a
  short summary of what was changed (new runbook, files moved to `references/`, scripts not
  shipped, and so on). Write one for every adapted skill that is not purely MIT.
- Record the SPDX identifier in `metadata.license`. `src/core/skill-licence-lint.ts`
  (`lintSkillLicence`) fails a blocked or unclassified identifier, and a weak-copyleft or
  share-alike skill that lacks `LICENSE`, `NOTICE.md` or a SHA-pinned `metadata.source`.
- **A skill with no declared licence** is resolved, not assumed: `npm run hostlib:licences` reads the licence at the
  pinned commit (licence file nearest the skill first, then frontmatter, then README) and records it as
  `resolvedLicence`; `--apply` writes `LICENSE`, `NOTICE.md` and `metadata.license` for licence-file evidence. A
  frontmatter- or README-only statement is recorded but does not unlock restoring or vendoring more content: there is
  no licence text to carry. Ask the upstream to add a licence file, or get the owner's decision.
- Licence readings here are not legal advice; a new tier or licence needs the owner's approval.

## 2. Upstream pin

- Every vendored (non-original) skill's `SKILL.md` frontmatter carries `metadata.source`: the
  upstream repository URL **and** the exact commit SHA (or release tag) it was adapted from.
  This is what lets a future maintainer tell whether upstream has moved and by how much.
- An originally-authored skill (no upstream) omits `metadata.source` entirely — never fabricate
  a source for original work.

## 3. Attribution

- Add the skill's author/project to **README.md §5 (Credits & Acknowledgments)**, with a link
  to the upstream project.
- If the skill was adapted substantially (not a byte-for-byte vendor), say so in the credit line
  ("adapted from X by Y") rather than implying a straight copy.

## 4. Adaptation

- Rewrite the skill's content into this repo's own section conventions
  (**PROJECT.md §7.2** — the shared SKILL.md structure every canonical skill follows), not a
  raw drop-in of the upstream file's structure.
- Long reference material (anything beyond what the trigger case needs at a glance) moves into
  `references/` (or `docs/`, matching the skill's own existing convention), never left inline
  in `SKILL.md` — see the Host Primitive Matrix §1 size limits below.

- **Restoring files a port dropped** (Plan 032 PR D): `host-library/_upstream/skills.json` lists, per third-party
  skill, upstream files missing from the catalog copy: `droppedExtras` (documents and data to restore),
  `skippedExtras` (upstream packaging, skipped on purpose) and `deferredExtras` (scripts, assets and test fixtures,
  restored in their own PRs). Run `npm run hostlib:restore -- --reconcile` first: it drops from the lists anything the
  port only renamed, moved or lightly adapted (same path or file name, a name that only gained a prefix, identical
  content, or 85% of a longer document's lines in one local file), so a restore never adds a conflicting
  near-duplicate. Underscore-prefixed files in `rules/` or `references/` are upstream scaffolding and are skipped.
  `npm run hostlib:restore -- --skill <name>` then copies the documents verbatim behind a one-line attribution header
  (JSON cannot carry a header: it is copied verbatim and listed in `NOTICE.md`). It refuses unless the skill is
  third-party pinned with a classified, non-blocked licence, the audit passed, a snapshot exists, and the skill
  folder already carries `LICENSE` and `NOTICE.md`. A frontmatter- or README-only MIT declaration can be accepted by
  the owner (`hostlib:licences --apply --accept "<reason>"`): the record keeps the decision and `LICENSE` states that
  no copyright notice is published upstream. After restoring, add a short "Reference files" pointer to `SKILL.md` and
  run the audit gate over the folder. Name the folders and the file-naming pattern, never one link per file:
  `SKILL.md` is loaded on every invocation, while the restored files are read one at a time, on demand.

## 5. Host check (docs/host-primitive-matrix.md)

Before the skill is wired to any specialist, verify it against **every** active host's limits
(`docs/host-primitive-matrix.md` §1 Skills):

- **Name**: ≤64 chars, lowercase ASCII letters/digits/hyphens only, no "claude"/"anthropic"
  substring (Claude Code rule) — **and** the frontmatter `name` must equal the skill's own
  directory name exactly (Cline rule). `src/core/skill-portability-lint.ts`
  (`lintSkillPortability`) checks both mechanically; run it against the new skill before
  wiring it in.
- **Size**: SKILL.md body under ~500 lines (Claude Code guidance) **and** under an estimated
  ~5k tokens (Cline guidance, ~4 chars/token here). Either limit being exceeded means splitting
  content into `references/` is overdue, not optional.
- **Scripts runnable on Windows and POSIX**: a bundled script must not assume a bash-like shell
  is present. A `.sh` script with a bash-only shebang (`#!/bin/bash`) or bash-only syntax
  (`[[ ... ]]`, process substitution, `local -a` arrays) needs either a cross-platform rewrite
  (Python/Node, which run identically on both) or a same-named `.ps1` counterpart for Windows.
  `lintSkillPortability` flags a `.sh` script with no cross-platform counterpart.
- One pre-existing, deliberately grandfathered exception: `registry/skills/generative_ui`
  predates this lint and keeps an underscore in its canonical name; `ClaudeProjector.
  normalizeSkillName()` rewrites it to `generative-ui` at projection time so Claude Code never
  sees the raw form. **New skills do not get this exception** — name them compliant from the
  start.

## 6. Bundle placement

- A **vendor or niche** skill (useful to a minority of users, or specific to one third-party
  tool/service) goes into an **addon bundle**, never into an Essentials bundle
  (`software-engineering`, `digital-agency`, …) — see README.md "Essentials-First Philosophy —
  Small Footprint, On-Demand Growth". Essentials stays small; addons are opt-in growth.
- A skill genuinely useful to most users of a given department (e.g. a widely-applicable
  engineering practice) can join an Essentials bundle, but this is the exception, not the
  default assumption for new intake.

## 7. Specialist wiring

- Add a row to the **Skill Consultation Map** (Plan 025) for every specialist that should
  consult this skill during planning or execution. A skill nobody's prompt points to is dead
  weight in the catalog — wire it to at least one specialist before merging.

## 8. Catalog bookkeeping

- Add the skill to the **`full`** bundle listing (the catalog-wide index) and to any bundle it
  was placed in per Step 6.
- Update the pinned skill count(s) in **README.md** and **PROJECT.md** wherever this repo
  states "N skills" for the bundle(s) touched — a stale count is a common review-miss, not a
  formality.

---

## Related documents

- `docs/host-primitive-matrix.md` — the limits referenced in Step 5, and the full per-primitive
  per-host reference this intake procedure exists to keep every new skill compliant with.
- `registry/translation-ledger.json` — the Declared-Delta Registry a skill's *specialist* (not
  the skill itself) may need a new entry in, if wiring the skill exposes a canonical feature no
  host realizes yet.
- `docs/adr/0023-host-primitive-matrix-and-skill-intake.md` — records this procedure as the
  only door third-party skills enter through.
- `docs/adr/0024-licence-tiered-skill-intake.md` — the licence tiers in Step 1 (Plan 030).
- Plan 025 (Skill Consultation Map), Plans 027/028 (third-party skill batches that use this
  checklist inline).
