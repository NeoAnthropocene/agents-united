# Plan 023: Store-less Claude Installs (ADR 0022) & Plain-Session Guard

> **Executor instructions**: self-contained; TDD (Red → Green → Refactor, 4-tier); STOP on the
> listed conditions; one commit per step group, each owner-reviewed before commit; update this
> plan's row in `plans/README.md` when done. Deterministic artifacts only — never LLM-rendered.
> Validate installer changes against a **real scratch workspace** (built CLI, temp dir) before
> proposing the merge — unit tests alone are not acceptance for installer shapes.

## Status

- **State**: AUTHORIZED — product owner 2026-09-26 ("D1–D4 approved as recommended, start with A0")
  request after PR #48; the two topics Plan 022 left open)
- **Priority**: P1 (Workstream A) · P2 (Workstream B) · **Effort**: A = S/M, B = L
- **Risk**: A = MEDIUM (first write into a user-owned settings file) · B = HIGH (installer state
  machine: install / doctor / update / uninstall / inventory / launchers)
- **Depends on**: plans/022 (the managed guard + least-privilege lane), ADR 0022 (Proposed),
  ADR 0017 (lockfile & staleness), ADR 0018 (Claude lane)
- **Branch**: fresh branch from `dev` per workstream (A first; B independently)

## Why this exists

Plan 022 shipped two deliberate gaps:

1. **Plain `claude` sessions are unguarded.** The managed PreToolUse guard lives in each projected
   role's frontmatter, so it fires only while an agents-united role runs (spawned subagent, or
   `agents start --host claude --agent <role>`). A developer who opens a plain `claude` session in
   the same repo can still `git push --force`, write `.env`, or `vercel --prod` with no guard.
2. **ADR 0022 was deferred.** A Claude-only `agents add` still writes `.agents/` (the canonical
   store) that the operator never selected.

Plus one defect found while researching (2026-09-26, Claude Code hooks reference): shell-form
command hooks run under **Git Bash on Windows, or PowerShell when Git Bash is absent**. The Plan
022 guard is shell-form (`node -e '<js>'`); PowerShell's native-argument quoting can mangle the
embedded double quotes, so on a Git-Bash-less Windows machine the guard may **fail open**. The
reference documents an **exec form** (`command` + `args`, spawned directly with no shell) that
removes the shell from the path on every OS.

## Verified host facts (Claude Code hooks reference, fetched 2026-09-26)

- Hook locations: `~/.claude/settings.json` (user), `.claude/settings.json` (project, committable),
  `.claude/settings.local.json` (project, personal/gitignored), managed policy, plugin
  `hooks/hooks.json`, skill frontmatter, subagent frontmatter.
- Hook entries **merge** across settings levels (they never replace each other).
- "If you define the same handler in more than one settings file, it runs once" — the dedup key
  is **not documented**; do not rely on it for correctness (the guard is idempotent anyway).
- Edits to settings files are picked up by the file watcher (no restart required).
- Command hook `args`: when present, `command` is resolved as an executable and spawned directly
  with `args` as argv — no shell. `shell: "bash" | "powershell"` selects shell form explicitly.

---

## Workstream A — Plain-session guard (+ exec-form fix)

### Recommendation (owner decision D1–D2)

- **D1 — where the session guard lives. Recommended: a consent-gated, single managed entry in
  project `.claude/settings.json`.** It is the only location that covers plain sessions for the
  whole team (the file is committable, like the `.claude/agents/` we already project). Rejected
  alternatives: `settings.local.json` as the default (per-developer only — teammates stay
  unguarded; kept as an opt-in variant); the plugin lane's `hooks/hooks.json` (fires only when the
  plugin is enabled with `--plugin-dir` — does not cover plain sessions); user-global
  `~/.claude/settings.json` (outside the workspace; never written by default).
- **D2 — consent. Recommended: ask, default yes, remember the answer.** This is the first time
  agents-united would write a user-owned settings file (today `claude-launcher.ts` documents
  `.claude/settings.json` as never written). TUI question on the Claude lane ("Also guard plain
  Claude sessions in this repo? (blocks force-push, .env writes, vercel --prod)"), flags
  `--session-guard[=project|local]` / `--no-session-guard`; the choice is sticky in the lockfile
  (`sessionGuard: { file, handlerHash }`) like `pluginLane`. Global-scope installs: off unless
  `--session-guard=user` is passed explicitly.

### Design

- **One guard, one source.** Extract the guard to `src/core/guard.ts`: `GUARD_SCRIPT` + a
  `guardHandler()` returning the **exec-form** handler
  `{ type: "command", command: "node", args: ["-e", GUARD_SCRIPT] }`. Both the role-frontmatter
  hooks (Plan 022) and the settings entry use it, so they can never drift.
- **Minimal JSON surgery, never a rewrite.** `SettingsGuardLane.merge(file)`: if the file is
  absent, create `{ "hooks": { "PreToolUse": [<Bash group>, <Write|Edit|NotebookEdit group>] } }`;
  if present and valid JSON, append our two groups only when an identical handler is not already
  there, preserving every other key and entry (re-serialized with the file's detected indent and
  EOL); if present and **invalid JSON / JSONC**, do not touch it — warn and print the snippet to
  paste. Ownership is identified by exact handler equality (`command` + `args`), recorded in the
  lockfile as `sessionGuard.handlerHash`.
- **Uninstall** removes only entries whose handler hash matches ours (after the last bundle is
  removed or `--no-session-guard`); if agents-united created the file and nothing else remains,
  delete it; otherwise leave the user's content untouched.
- **Doctor**: `Session guard: wired | missing | modified (handler differs) | skipped (invalid
  JSON) | off`; `modified` never auto-repairs without `--force`.
- **Update**: re-merges (idempotent); a changed `GUARD_SCRIPT` replaces our old entry by its
  recorded hash.

### Steps (TDD)

- **A0 — exec-form fix (independent, ship first).** RED: `tests/claude-hooks.test.ts` asserts
  every role's guard handler has `command: "node"` and an `args` array (no shell form), and the
  executor runs it via `spawnSync(command, args)` (no `sh -c`). GREEN: render the exec form.
  Regenerate the 5 legacy goldens (reviewed; CRLF-preserving line patch). **Owner Windows check**:
  a role session on Windows without Git Bash blocks `git push --force`.
- **A1 — RED** `tests/session-guard.test.ts`: create / merge-preserving-other-keys / idempotent
  re-merge / invalid-JSON untouched + warning / uninstall removes only ours / created-file cleanup
  / doctor states / sticky consent / global scope off by default.
- **A2 — GREEN** `src/core/guard.ts`, `SettingsGuardLane`, installer + uninstaller + doctor +
  updater wiring, CLI flags + TUI question + plain-language copy.
- **A3 — scratch-workspace validation**: built CLI in a temp dir with a pre-existing
  `.claude/settings.json` (custom permissions + a user hook) → add → doctor clean → remove →
  user content byte-identical to the original.

### Acceptance (A)

1. A plain `claude` session in the repo is blocked on `git push --force`, a `.env` write and
   `vercel --prod` (owner CLI check), with the same message as the role guard.
2. Pre-existing settings content and user hooks survive add/update/remove byte-for-byte
   (except our two groups), and invalid JSON is never rewritten.
3. Exec form on every OS; no shell in the guard path.
4. Declining consent writes nothing; the decision is remembered.

---

## Workstream B — ADR 0022 store-less Claude installs

### Recommendation (owner decision D3–D4)

- **D3 — lockfile home (ADR 0022 sub-decision 3). Recommended: a hidden machine-owned sidecar
  `.claude/.agents-united/`** holding the lockfile `agents-united.json` **and an immutable
  snapshot** of the canonical assets that install projected (`agents/`, `skills/`, `rules/`).
  Rationale: the entire state machine (installer, doctor, updater, uninstaller, inventory,
  launchers) is keyed on one *state dir* holding both the canonical copies and the lockfile, with
  lockfile `files` keys **relative to that dir** and `projections` keys **relative to the
  workspace root**. Relocating the state dir therefore reuses every existing code path unchanged;
  only state-dir *discovery* and *workspace-root derivation* change. The snapshot keeps update
  diffs, drift detection (ADR 0017) and ownership (Plan 015 refcounts) working exactly as today.
  It lives inside the host dir the operator chose, is not a path Claude Code loads from (roles
  load from `.claude/agents/`, skills from `.claude/skills/`, rules from `.claude/rules/`), and
  is hidden. Rejected: **lockfile-only** (`.claude/agents-united.json`, no snapshot) — forks the
  state machine into a second projection-only mode across five modules (ADR 0022 risk R4) for a
  few hundred KB of saved disk; **root-level `agents-united.json`** — a visible file in the
  workspace root is the same "noise" the ADR is removing.
- **D4 — which installs go store-less. Recommended: exactly "Claude is the only selected host".**
  `planInstallTargets` yields store-less when the selection contains no `agents`/`gemini` host,
  the fan-out is `['claude']`, no `--canonical-store`, and no `--plugin` (the plugin lane writes
  `.agents/plugins/<bundle>/`). Cline, Cursor, OpenCode, Codex stay store-backed (ADR 0022
  decision 4 — strangler-safe; Cline's compound lane writes under `.agents/plugins/`).

### Design

- **State-dir abstraction** (`src/core/state-dir.ts`): `resolveStateDir(scope, overrideDir?)`
  with discovery order: explicit override → existing `.agents/agents-united.json` → existing
  `.claude/.agents-united/agents-united.json` → the default for the requested install shape; and
  `workspaceRootOf(stateDir)` (`<root>/.claude/.agents-united` → `<root>`; `<root>/.agents` →
  `<root>`). Replace every `resolveHostDir(scope, 'agents', …)` state lookup and every
  `path.dirname(<stateDir>)` root derivation (installer ×3, doctor ×2, updater ×2, uninstaller ×2,
  inventory ×2, claude-launcher ×2, cline-launcher ×2 — ~15 sites, inventoried in Step B0).
- **Lockfile marker**: `storeShape: 'store' | 'sidecar'` (absent ⇒ `store`; ADR 0017 shapes
  otherwise unchanged). The sidecar is always `method: copy` (a snapshot, never a symlink).
- **Upgrade path (store-less → store-backed)**: a later `add` that needs the store (`--target
  agents`, Cline fan-out, `--plugin`, `--canonical-store`) **moves** `.claude/.agents-united/*`
  to `.agents/` (lockfile `files` keys are state-dir-relative and `projections` keys are
  root-relative, so the move needs no key rewrite), flips `storeShape`, then proceeds. The
  reverse (store-backed → store-less) is out of scope.
- **Doctor**: validates the sidecar like the store; warns on sidecar drift ("machine-owned
  snapshot modified — run `agents update --force`"); never reports a missing `.agents/` on a
  sidecar install.
- **TUI/CLI copy**: store-less shows no "Added .agents/ — the main library…" line; store-backed
  keeps ADR 0022 decision 4's wording ("main library (source of the translated copies)").
  `--canonical-store` documented in `agents add --help`.
- **Docs**: ADR 0022 status → Accepted with sub-decision 3 recorded; CONTEXT.md term "State
  Dir / Sidecar Snapshot"; README install section notes the Claude-only shape.

### Steps (TDD)

- **B0 — inventory (read-only)**: list every state-dir lookup and root derivation; STOP if any
  site derives the workspace root in a way the helper cannot express.
- **B1 — RED** `tests/store-less-install.test.ts` (built on `tests/helpers/bundle-lifecycle.ts`):
  Claude-only add leaves no `.agents/`, writes `.claude/.agents-united/agents-united.json` +
  snapshot; doctor zero warnings; update is a no-op on an unchanged registry and re-projects on a
  changed one; remove last bundle deletes the sidecar and every projection; inventory/`agents
  list` shows the install; `agents start --host claude` resolves it; `--canonical-store` forces
  `.agents/`; a later `--target agents` / `--fanout cline` migrates and reconciles (doctor clean,
  owners intact); `--plugin` forces store-backed; global scope uses `~/.claude/.agents-united/`.
- **B2 — GREEN** state-dir module + call-site migration (mechanical, no behavior change for
  store-backed installs — the full existing suite must stay green before any store-less code).
- **B3 — GREEN** store-less shape in `planInstallTargets` + installer, migration, doctor copy,
  CLI flag + TUI copy.
- **B4 — scratch-workspace validation** (built CLI, temp dirs): Claude-only add → doctor →
  update → remove; Claude-only add → `--fanout cline` add → doctor → remove all; store-backed
  workspace regression (byte-identical lockfile shape vs `dev`).
- **B5 — adversarial audit**: path traversal via state-dir discovery, orphaned sidecars,
  half-migrated states (crash between move and lockfile write → next run must detect and finish).

### Acceptance (B) — ADR 0022's own set

1. A Claude-only install leaves no `.agents/` in the workspace.
2. `doctor` / `update` / uninstall stay warning-free on that shape.
3. A later `--target agents` add materializes the store and reconciles the lockfile.
4. Store-backed installs are byte-for-byte unchanged (lockfile shape and every projection).

---

## Open owner decisions

| # | Decision | Recommendation (all APPROVED by the owner 2026-09-26) |
|---|---|---|
| D1 | Session-guard location | Managed entry in project `.claude/settings.json` (`local` variant opt-in; user-global never by default) |
| D2 | Consent model | Ask, default yes, sticky in the lockfile; `--session-guard` / `--no-session-guard` |
| D3 | Store-less lockfile home | Hidden sidecar `.claude/.agents-united/` with lockfile + immutable canonical snapshot |
| D4 | Which installs go store-less | Only "Claude is the only selected host" (no Cline, no `--plugin`, no `--canonical-store`) |

## STOP conditions

- The settings file a user already has is JSONC or otherwise not strict JSON → never rewrite it
  (warn + paste snippet), and STOP if a test shows any byte of user content changed.
- B0 finds a root derivation the state-dir helper cannot express.
- Any store-backed golden, lockfile shape or existing suite changes during B2.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Writing user-owned `settings.json` damages user config | High | exact-handler ownership, preserve-all merge, invalid-JSON no-touch, byte-identical round-trip test |
| R2 | Guard fails open on Windows | High | A0 exec form; owner Windows check |
| R3 | State-dir migration regresses store-backed installs | High | B2 is behavior-neutral and must be green before B3 |
| R4 | Half-migrated sidecar → store | Med | idempotent migration + crash-recovery test (B5) |
| R5 | Team members surprised by a committed guard | Low | consent prompt names what is blocked; `local` variant |

## References

- `docs/adr/0022-canonical-store-optional-installs.md` (sub-decision 3 proposal appended)
- `plans/022-subagent-comms-and-hardening.md` (V1 note: known gaps)
- Claude Code hooks reference (hook locations, merge, exec form, Windows shell) — 2026-09-26

## Execution log

- **A0 — DONE 2026-09-26** (`13f8988`, merged to `dev`/`main`, released 0.13.0): the guard renders in
  exec form (`command: node`, `args: ["-e", <script>]`); `src/core/guard.ts` is the single source.
  **Owner check open**: on Windows *without* Git Bash, a role session blocks `git push --force`.
- **A1–A3 — DONE 2026-09-26** (landed as one commit per owner decision: every commit stays green):
  `tests/session-guard.test.ts` (16: 7 merge-engine unit + 9 install/doctor/uninstall integration)
  written RED first (14 failing on `MISSING API`, 2 regression guards); `src/core/session-guard.ts`
  (strict-JSON parse, preserve-all merge reusing the file's indent/EOL/trailing newline, marker +
  exact-handler ownership, remove-only-ours, created-file cleanup, inspect); installer
  `applySessionGuard` (Claude lane only, sticky decision, `project`/`local` ignored for global
  installs, `user` explicit only); uninstaller removes the guard with the last bundle; doctor
  `sessionGuard` state + warnings (paste-in snippet for invalid JSON) + CLI status line; CLI
  `--session-guard[=project|local|user]` / `--no-session-guard` and an interactive consent prompt
  (default yes) shown only when no decision is recorded — non-interactive runs never write the
  settings file without the explicit flag.
  **A3 scratch-workspace evidence** (built CLI, fresh git repos): (1) pre-existing CRLF 4-space
  `settings.json` with a user permission + user hook → add merged our 2 exec-form groups after the
  user's hook, CRLF kept on 46/46 lines; the Bash guard fired from the file blocks `git push
  --force` (exit 2) and allows `git push`; `update` kept exactly 2 guard groups; `remove` left the
  file **byte-identical** to the original. (2) no prior file → created (`createdFile: true`),
  doctor "Wired", remove deleted it. (3) JSONC file → untouched byte-for-byte, install + doctor warn
  with the paste-in snippet. (4) `-y` without the flag writes nothing; `--no-session-guard` records
  `{ off: true }`. Gates: typecheck 0; `npm test` 57 files, 820 passed / 0 failed / 209 skipped.
  **Owner check open**: a plain `claude` session in a guarded repo blocks the three commands.

## B0 — State-dir inventory (read-only, 2026-09-26, on `e4555a5`)

**Verdict: no STOP.** Every workspace-root derivation is exactly `path.dirname(<state dir>)`, which
`workspaceRootOf(stateDir)` expresses (`<root>/.agents` → `<root>`; `<root>/.claude/.agents-united`
→ `<root>`). The Claude compound lane records canonicals **state-dir-relative** (`agents/<f>`,
`skills/<s>/SKILL.md`, `rules/<r>`) and projections **root-relative** (`.claude/...`), so a
sidecar move needs no lockfile key rewrite — confirming D3's premise. All `.agents/`-prefixed
literals belong to lanes D4 keeps store-backed (Cline, the plugin lane, the non-compound fallback
hosts, the AGENTS.md bridge).

### A. State-dir lookups (must learn the sidecar) — 13 sites

| # | Site | Today | B2 change |
|---|---|---|---|
| A1 | `installer.ts:121` `projectionRoot` | `resolveHostDir(scope,'agents',targetDir)` + `dirname` | `resolveStateDir` + `workspaceRootOf` |
| A2 | `installer.ts:888` `targetDirs` | `hosts.map(resolveHostDir(...))` | the `agents` host maps to the resolved state dir |
| A3 | `installer.ts:898–899` dry-run lockfile | `resolveHostDir(...,'agents')/agents-united.json` | `resolveStateDir` |
| A4 | `installer.ts:922` `agentsTarget` | `resolveHostDir(...,'agents')` | `resolveStateDir` |
| A5 | `uninstaller.ts:206` `targetDirs` | `hosts.map(resolveHostDir(...))`, default hosts `['agents']` | `agents` → discovered state dir |
| A6 | `doctor.ts:168` `root` | `resolveHostDir('project','agents',targetDir)` | `resolveStateDir('project', targetDir)` |
| A7 | `inventory.ts:77` candidate dirs | `resolveHostDir(scope,host)` per KNOWN host; lockfile at `<dir>/agents-united.json` | add the sidecar candidate (`.claude/.agents-united`, reported as host `agents` so `update` re-installs into it); dedupe |
| A8 | `inventory.ts:91` `canonicalDir` (location summary) | `resolveHostDir(scope,'agents',...)` | `resolveStateDir` (display "./.claude/.agents-united") |
| A9 | `claude-launcher.ts:114–128` `resolveInstallation` | `cwd/.agents` + global `~/.agents` fallback | `resolveStateDir` for both scopes (the Claude gate already accepts `fanout: ['claude']` alone — no Team Manifest needed) |
| A10 | `cline-launcher.ts:88–102` | `cwd/.agents` + global fallback | **no change** (Cline is store-backed, D4); a sidecar-only workspace gets the existing "not projected to Cline" remedy |
| A11 | `cli.ts:495` session-guard consent lookup | `resolveHostDir(scope,'agents')/agents-united.json` | `resolveStateDir` |
| A12 | `cli.ts:1288` post-update tip | `rec.targetDir/agents-united.json` | none (record carries the state dir) |
| A13 | `updater.ts:245, 275` lockfile path | `record.targetDir/agents-united.json` | none (record carries the state dir) |

### B. Workspace-root derivations (`dirname(stateDir)`) — 6 sites, all → `workspaceRootOf`

`installer.ts:122`, `installer.ts:1146` (session guard), `uninstaller.ts:311`, `updater.ts:77`
(`staleProjection`), `updater.ts:331` (generative-UI migration), `doctor.ts:243` + `doctor.ts:438`.
The three `removeEmptyProjectionDirs` walks (`installer.ts:493`, `uninstaller.ts:63`,
`updater.ts:109`) take `workspaceRoot` as a parameter and stop at it — correct once callers pass
`workspaceRootOf(...)`.

### C. `.agents/` literals — no change (store-backed lanes only)

Cline lane + Team Manifest (`cline-projector.ts:241,255,265–266,337–340,363`,
`cline-launcher.ts:120,173,177`, `installer.ts:183`, `uninstaller.ts:235,332`); plugin lane
(`claude-projector.ts:835`, `cli.ts:2519` `agents start --plugin`, `installer.ts:341`); non-compound
fallback hosts + AGENTS.md bridge (`installer.ts:129,677–679,816–861`, `projector.ts:236`,
`uninstaller.ts:383`); host registry (`hosts.ts:31–34`); Claude launcher manifest probe
(`claude-launcher.ts:152`, optional signal). Test helper `tests/helpers/bundle-lifecycle.ts`
assumes `.agents/` (store-backed) — B1 adds a sidecar variant rather than changing it.

### D. Behavior gaps B3 must add (not just re-pointing)

1. **Shape decision** — `planInstallTargets` (`hosts.ts`) + `InstallOptions.canonicalStore`:
   store-less iff the selection is exactly Claude (no `agents`/`gemini`, fan-out `['claude']`,
   no `--plugin`, no `--canonical-store`); the host id stays `agents`, only its directory moves.
2. **Last-bundle teardown** — today uninstall keeps `.agents/agents-united.json` after the last
   bundle; for the sidecar, remove `.claude/.agents-united/` entirely, then prune `.claude/` if
   empty (the existing walk would otherwise stop at the non-empty `.claude/`).
3. **Upgrade move** — sidecar → `.agents/` when a store-requiring add arrives (crash-safe: move,
   then flip `storeShape`; a leftover half-move is detected and finished on the next run).
4. **CLI/TUI copy** — `cli.ts:346` and `:429` ("Added .agents/ — the main library…") and the
   `:929–936` tip must not print on a store-less install; `-t` help text gains `--canonical-store`.
5. **Doctor** — never warn "No lockfile found at .agents/…" on a sidecar workspace; add a sidecar
   drift warning (machine-owned snapshot modified).

## Execution log — Workstream B (2026-09-26)

- **B0 — DONE** (`4f58f36`): inventory above; no STOP.
- **B1–B3 — DONE** (one commit, every commit green): `tests/store-less-install.test.ts` (16) written
  RED first (12 failing on `MISSING API` / missing behavior, 2 regression guards). `src/core/state-dir.ts`
  (`SIDECAR_DIR`, `resolveStateDir`, `workspaceRootOf`, `isSidecarDir`, `stateDirFor`); all 13
  lookups and 6 root derivations re-pointed; `planInstallTargets` returns `storeShape`; installer
  resolves the state dir (a non-Claude fan-out or the plugin lane forces the store), downgrades
  the sidecar to copy mode, records `storeShape: 'sidecar'` only on sidecars, and moves an
  existing sidecar into `.agents/` on a store-requiring add (crash-safe); uninstaller tears the
  sidecar (and an emptied `.claude/`) down with the last bundle; inventory lists the sidecar under
  host `agents`; the Claude launcher resolves it; doctor flags a hand-edited sidecar snapshot;
  CLI `--canonical-store`, shape decided once the final fan-out is known, a "Claude-only install"
  note instead of "Added .agents/". `tests/hosts.test.ts` `toEqual` pins gained `storeShape: 'store'`.
- **B4 — scratch-workspace evidence** (built CLI, no `targetDir`, fresh git repos): `add -t claude`
  → only `.claude/` (agents/rules/skills + hidden `.agents-united/`), no `.agents/`, lockfile
  `storeShape: sidecar`; `doctor` healthy; `update` stays store-less (no nested `.claude/.claude`);
  `start --host claude --dry-run` resolves the workspace; `add -t claude,cline` moved the sidecar
  into `.agents/`, dropped `storeShape`, doctor healthy; a sidecar `remove` leaves only `.git/`;
  `--canonical-store` keeps `.agents/` and writes no sidecar.
- **Gates**: typecheck 0; `npm test` 58 files, 835 passed / **1 failed** / 209 skipped — the one
  failure is the pre-existing, timing-sensitive `cli-e2e` "Installation Success … line overflow"
  check (clack spinner frames accumulate on one non-TTY line under load); it fails identically on
  `dev` (`e4555a5`) in this environment and is not touched by this change.
