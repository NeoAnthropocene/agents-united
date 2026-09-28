# ADR 0024: Licence-Tiered Skill Intake

- **Status**: Accepted — 2026-09-28 (Plan 030, owner-approved via project thread). Amends
  ADR 0023 decision 5 (the intake procedure's licence check); does not change any other part
  of ADR 0023.
- **Context**: ADR 0023's intake procedure allowed only permissive licences (MIT,
  Apache-2.0, BSD, CC-BY, public domain) and told contributors to link, not vendor, anything
  else. Plan 027 therefore shipped `threat-modeling` and `terraform-test-patterns` as
  link-only stubs. Two findings changed the picture. First, `threat-modeling` was never
  blocked: the stub cited the CC-BY-SA-4.0 licence at the root of
  `trailofbits/skills-curated`, but the plugin it describes carries its own Apache-2.0
  `LICENSE`. Second, the owner wanted the Trail of Bits (CC-BY-SA-4.0) and HashiCorp
  (MPL-2.0) skills in the security, DevOps and QA bundles, credited in the README. A README
  credit meets the attribution term of those licences but not their other terms, so a rule
  was needed for what vendoring them requires. This is a reading of the licences, not legal
  advice; the owner confirmed it on 2026-09-28.
- **Decision**:
  1. **Four licence tiers** replace the permissive-only rule:

     | Tier | Licences | May vendor? | Requirements |
     |---|---|---|---|
     | Permissive | MIT, Apache-2.0, BSD, ISC, CC-BY, CC0 | Yes | README credit; upstream `LICENSE`/`NOTICE` copied into the skill folder when the licence asks for it |
     | Weak copyleft | MPL-2.0 | Yes | `LICENSE` in the skill folder; `metadata.license: MPL-2.0`; modified files stay MPL-2.0; `NOTICE.md`; README credit |
     | Share-alike | CC-BY-SA-4.0 | Yes | `LICENSE` in the skill folder; `metadata.license: CC-BY-SA-4.0`; the adapted skill is released under CC-BY-SA-4.0; `NOTICE.md`; README credit |
     | Blocked | Any NonCommercial or NoDerivatives term, GPL/AGPL/LGPL, no licence | No | Link-only pointer at most |

  2. **Each skill folder is its own work.** Share-alike and copyleft reach the adapted skill
     folder, not the rest of the repository. The repository stays MIT; the README licence
     section says that some skill folders carry their own licence.
  3. **The nearest licence file decides.** Read the licence in the skill or plugin folder
     before the repository root, and record which file decided it (the NOTICE names it).
  4. **`NOTICE.md` is the changes note.** Every adapted copyleft or share-alike skill (and,
     by convention, every adapted Apache-2.0 skill) carries one: upstream URL and pinned SHA,
     licence, and what changed.
  5. **`metadata.source` pins a 40-character SHA** for non-permissive skills (a
     `.../tree/<sha>/<path>` URL), alongside `metadata.commit`.
  6. **A licence lint enforces it** (`src/core/skill-licence-lint.ts`, run over the whole
     catalog by `tests/plan-030-licence-aware-skills.test.ts`): a blocked or unclassified
     `metadata.license` fails, and a weak-copyleft or share-alike skill without `LICENSE`,
     `NOTICE.md` or a SHA-pinned source fails.
- **Consequences**:
  - Positive: high-quality security and testing skills (12 in Plan 030) ship in the
    catalog instead of as pointers; licence obligations are explicit per folder and checked
    by a test rather than by memory.
  - Negative: the catalog now carries non-MIT files, so a downstream redistributor of the
    whole repository must keep those folders' `LICENSE` and `NOTICE.md` intact; installers
    already copy whole skill folders, so the files travel into every projection.
  - Risks: a licence reading proves wrong (mitigated by per-folder licence files, which keep
    each work's terms explicit and easy to remove); an upstream relicenses at a later SHA
    (mitigated by pinning and re-reading the licence on every re-sync).
