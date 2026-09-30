# ADR 0025: Native Host Packages, Host Docs Library & Doc-Guided Authoring

- **Status**: Accepted — 2026-09-30 (product owner). Amends ADR 0021 decisions 1–3 and 5 (builds on ADR 0023/0024); keeps
  decisions 4 (strangler), 6 (Contract Floor), 7 (managed artifacts) and 8 (one-host blast radius).
  Implemented by `plans/032-native-host-packages.md`.
- **Context**: `agents doctor --host <host>` and the Declared-Delta Registry
  (`registry/translation-ledger.json`) flag most hooks, plugins, workflows, skills and MCP wiring as
  `unsupported`/`degraded` on every host except Antigravity. The canonical tree is Antigravity
  dialect, so every other host is scored on whether it has Antigravity's keys:
  - flagged hooks enforce nothing today (`echo "[Safety Gate] …"` in orchestrators; prose guards
    such as `guard: Deny run_command if …` in subagents);
  - some flags are unfinished translation, not host limits (`mcpServers … translation deferred`,
    `hooks … not translated in v1` in `src/core/claude-projector.ts`);
  - the ADR 0021 Creation Engine (`src/core/creation/claude.ts`) emits only
    `name/description/tools` plus prose — growing binding tables until they express every native
    feature of every host is the translation tax again;
  - tool grants are translated from 15 Antigravity tokens instead of each host's full catalog, and
    orchestrators never use host-native orchestration (e.g. Claude dynamic workflows).
- **Decision**:
  1. **Native host packages.** Each host (Claude Code, Cline, Antigravity first) gets committed,
     fully native artifacts under `registry/hosts/<host>/` — agents, skills (in the host's own skill
     folder anatomy), hooks (real scripts), rules, commands, orchestration artifacts
     (`workflows/`), a `profile.json` and a `tool-policy.json`. The realization layer is full native
     files, not invariant → binding strings.
  2. **Shared Contract Floor only.** Identity, mission, scope boundaries, output contract and
     safety stay single-sourced in `registry/core/`; a deterministic sync writes them into every host
     agent. Everything above the floor is native per host. Declared deltas are measured against the
     **core contract**, never against Antigravity keys.
  3. **LLM-assisted authoring, deterministic install.** An LLM drafts host-native artifacts at
     *authoring time* in this repo (the `realize-for-host` maintainer skill); every output lands
     through a reviewed PR. **No LLM ever runs on a user's machine**: install/update/doctor copy
     committed files, stamp the managed marker and hash (ADR 0017 freshness becomes a hash compare).
  4. **Host docs library is the only authoring reference.** `host-library/<host>/` (not shipped
     in the npm package) holds the machine-readable link index (`llms.txt`), the changelog URL, a
     curated page map per artifact type, snapshots of those pages, and distilled guides that cite
     them. Snapshots are refreshed by a plain HTTP script (`npm run hostlib:*`) so they are
     diffable, reproducible, and independent of MCP availability; context7 is optional during
     authoring, and any page relied on must first be added to the library.
  5. **Changelog-first host updates.** The `host-update-sync` workflow reads each host's changelog,
     compares it with the last-seen entry in `library.lock.json`, refreshes only affected pages,
     writes an adaptation plan under `plans/` and opens a PR to `dev` (label `host-update`). It never
     implements artifact changes itself; a daily routine handles the PR.
  6. **Skills are native per host, upstream first.** Before a skill is adopted into a host its
     original upstream source is consulted (creators in README "Credits & Acknowledgments").
     Provenance lives in `host-library/_upstream/skills.json`: *third-party pinned* (repo, path,
     commit, full folder snapshot), *in-house* (origin `registry/skills/<skill>/`), or *not-found*
     (date + URLs tried; used as is — never blocked). Host-neutral skills pass through byte-for-byte
     where the host's skill rules allow.
  7. **Security audit gate.** Nothing enters `host-library/_upstream/` and no pinned commit moves
     until the candidate passes a quarantined audit: a deterministic scan (prompt injection,
     obfuscation, risky script behavior, hygiene) plus a read-only LLM review of the diff. `fail`
     or `needs-review` → `security-hold` label, current version stays, never auto-merged. The same
     deterministic injection/obfuscation scan guards refreshed docs snapshots.
  8. **Full native tool sets.** Roles declare capability classes (read, search, code-intel, edit,
     shell, background-monitor, web, delegate, workflow, schedule, ask-user, notify, worktree,
     report, artifacts); `tool-policy.json` maps classes to the host's complete tool catalog with
     availability conditions. Hooks enforce what an allowlist cannot (e.g. read-only shell). A CI
     efficiency lint reports catalog tools no role uses.
  9. **Host-native orchestration.** Orchestrators bind the core invariants ("parallel slices fan
     out; one synthesis point", "never busy-poll") to each host's native mechanisms — on Claude,
     `Agent` for a handful of specialists and **dynamic workflows** (`Workflow` tool, saved
     `.claude/workflows/*.js` with `agent()`/`parallel()`/`pipeline()`) for many-slice fan-out,
     audits, migrations and cross-checked review. Multi-agent `workflow-*` skills become
     orchestration artifacts plus a thin trigger; single-agent runbooks stay skills.
  10. **Builds on ADR 0023 and ADR 0024, replaces neither.** `docs/host-primitive-matrix.md` stays the
     written, dated cross-host reference and the host docs library becomes its machine-diffable feed
     (host-update PRs state whether the matrix needs re-dating). `docs/skill-intake.md` and the
     licence tiers stay the intake procedure: the security audit gate runs *before* the licence lint,
     and provenance recovery extends intake step 2 (upstream pin). Declared deltas keep their
     `mapped | approximated | degraded | unsupported` vocabulary (ADR 0021, extended to all three
     hosts by ADR 0023) but are re-based on the core contract.
- **Consequences**:
  - Positive: "unsupported" stops meaning "not Antigravity"; hooks and guards become real; agents
    use each host's full tool surface; host churn is a one-host docs-diff PR with evidence.
  - Negative: the authored surface grows per host; floor sync, conformance and the audit gate are
    load-bearing CI; the docs library needs network access from the authoring/routine environment.
  - Migration: strangler per ADR 0021 decision 4 — the legacy projection lane keeps running until
    each host proves parity; `claude-projector.ts`, `cline-projector.ts`, `FEATURE_LEDGER` and
    `creation/claude.ts` retire per host at parity.
