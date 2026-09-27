# Plan 024: Field-Test Fixes from the Plan 022/023 Claude CLI Checks

> **Executor instructions**: self-contained; TDD (Red → Green → Refactor); one commit per step
> group, each owner-reviewed before commit; every commit green; update this plan's row in
> `plans/README.md` when done. Canonical agents stay HOST-NEUTRAL (Plan 018); host nouns only in
> overlays, bindings and the Claude runtime note.

## Status

- **State**: DONE — 2026-09-27 (E1–E4 approved with E2/E3 extended; S1–S5 executed, see Execution log)
- **Priority**: P1 (S1–S3) · P2 (S4) · **Effort**: S/M · **Risk**: LOW–MEDIUM (prompt wording + one
  opt-in installer lane that reuses the Plan 023 settings merge engine)
- **Depends on**: plans/022 (comms law), plans/023 (session guard + merge engine)

## Field evidence (owner, Windows 11 + Claude CLI, 2026-09-27)

`dev` @ `cb74d63`, `agents add software-engineering -t claude --copy --session-guard -y` in a scratch
workspace (store-less sidecar install), `claude --agent orchestrator-engineering`.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | F1: consult before the delegation map | **PASS** (with caveat) | backend-architect consulted read-only; plan used its advice. **Caveat**: the orchestrator found its own prompt contradictory — see S1 |
| 2 | Peers use each other's input in FIRST reports | **FAIL** | both reports "Peer messages received: none"; direct messages failed "No agent named '…' is reachable" (addressed by type name; only the lead holds agent IDs). Relay through the orchestrator worked both ways; one relay round resolved a real contract conflict (problem+json vs plain JSON, RateLimit-Reset seconds vs timestamp, CORS exposure) |
| 3 | Missing peer → Open items, no hang | **PASS** (one scenario) | qa-automation-lead failed to start ("Agent type not found") → listed under Open items. A specialist that starts then goes silent was not tested |
| 4 | Read-only roles cannot spawn or write | **PASS** | code-reviewer / repo-index held only Read, Grep, Glob, SendMessage, SubagentHandback; probe files never created |
| 5 | Guard in a role session | **PASS (model refusal)** | the model refused all three itself, citing the rules + hook; the hook firing was not isolated from the refusal |
| 6 | Guard in a plain session | **PARTIAL** | `git push --force` refused; `.env` write and `vercel --prod` only asked hypothetically (the model said it would create `.env` "sourced properly") — not verified |
| 7 | Windows without Git Bash | **PASS** | all three blocked by the project hook |

## Root causes

- **Check 1 caveat — prompt contradiction (defect introduced by the F1 fix).** Seven Tier-1
  orchestrators (engineering, system-architecture, design, marketing, security, research, business)
  still carry, in their ADR 0015 Planner-Orchestrator policy, "Phase 0 … Do NOT spawn specialists
  during planning" and "Phase 2 — Delegation Map (solo-composed)", while the Planning Consultation
  Phase now REQUIRES a read-only consult. The F1 test asserted the gate's presence, not the absence
  of the contradicting text.
- **Check 2 — the comms law invites an impossible action on Claude.** C4 ("you may reply to a peer
  directly only while you are both in a live session that the coordinator set up") and the 12
  specialists' "Parallel Work … Agent Teams adds direct reach" bullet let a specialist believe it can
  message a peer by name. Outside Agent Teams a Claude subagent is addressable only by the agent ID
  the lead receives at spawn, so every such attempt fails. The working pattern observed in the field
  is (a) relay through the coordinator and (b) **contract first**: one specialist writes the shared
  interface, the others start with it as a fixed input.
- **Check 6 — test method, not a product defect.** Asking the model hypothetically measures its
  judgement, not the hook. A guard test must make a tool call the model will actually attempt.

## Steps

- **S1 — remove the contradiction (P1, no decision needed).** In the seven orchestrators: Phase 0
  "Do NOT spawn specialists during planning" → "During planning, specialists are consulted
  read-only only (the Planning Consultation Phase gate); do not spawn them to produce
  deliverables"; "Phase 2 — Delegation Map (solo-composed)" → composed from your expertise, the
  skill runbooks and the consultation output. Test: no orchestrator carries a planning-spawn ban
  or "solo-composed" alongside the consult gate.
- **S2 — make the comms law match what a host can do (P1).** Specialists (canonical, host-neutral):
  "Message a peer directly only when your brief gives you that peer's address; otherwise put the
  question under Open items — the coordinator relays it." Coordinators: a **contract-first** rule in
  the Delegation Brief — when slices share an interface (API shape, schema, error format), delegate
  the contract to one specialist first and hand the resulting artifact to the others as a fixed
  input. Claude binding + runtime note: "outside Agent Teams, peers are unreachable by name — only
  the coordinator holds their agent IDs". Update the 12 "Parallel Work" bullets accordingly.
- **S3 — consult budget (E1).** Raise the per-consult cap from 300 words to the owner's 1000 (the
  field run saw specialists include code examples). Applies to the 8 Tier-1 Planning Consultation
  Phases and the Tier-2 `summaryWordCap` in `registry/bundles.json` (+ the "≤150 words" Scope-of-Work
  lines that cite it).
- **S4 — optional command-permission preset (E2).** Background specialists cannot stop to ask for
  command approval, so `npm test` / `npx tsc` get refused outside auto mode. Offer an opt-in
  `--permissions-preset` that merges a conservative `permissions.allow` list (npm install/run/test,
  npx vitest/tsc/eslint, git status/diff/log — never commit/push) into `.claude/settings.local.json`,
  reusing the Plan 023 merge engine (preserve-all, invalid-JSON no-touch, remove-only-ours).
- **S5 — guard test protocol (docs).** Record in the plan and `docs/` a model-proof guard test:
  commands the model will run without self-refusal that still match the guard patterns, e.g.
  `echo git push --force`, `echo x > .env.test`, `echo vercel deploy --prod` — each must return the
  guard's exit-2 message. Plus `/hooks` to confirm both the settings and frontmatter hooks load.

## Not in this plan (recorded, owner may promote)

- **Worktree isolation for parallel builders** (subagent `isolation: worktree`): needs a git repo
  and a merge step; today the brief's file ownership covers it. Revisit when parallel builders
  collide in practice.
- **Reviewer running checks**: kept read-only by Plan 022 H3; the orchestrator runs the verification
  suite at the final step (field run confirmed this is workable).
- **Specialist prompt diet** (e.g. backend-architect's Supabase/Turso/Vercel/Azure exemplars → load
  on demand as skills): worthwhile, but a catalog-wide refactor — its own plan.
- **Duplicate guard** (settings + frontmatter): harmless and intentional — the frontmatter copy
  guards subagents when no settings entry exists.
- **Allowlist names uninstalled types**: intended (ADR 0018 — the allowlist is the whole domain
  team so the orchestrator can recommend installs); H6 installed-type awareness already covers it.

## Open owner decisions

| # | Decision | Recommendation (APPROVED 2026-09-27) |
|---|---|---|
| E1 | Consult cap | 1000 words per consult (owner's suggestion); Tier-2 `summaryWordCap` 300 → 1000; Scope-of-Work "≤150" → "≤300" |
| E2 | Permission preset | Opt-in `--permissions-preset`, `.claude/settings.local.json` only, never commit/push |
| E3 | Scope of S2 | Wording + contract-first rule now; keep `SendMessage` on specialists (needed for Agent Teams and for messaging the coordinator) |
| E4 | Ship order | S1+S2 first (P1 correctness), then S3–S5 |

## Owner extensions (2026-09-27)

- **E2 → every host, now and future.** The permission preset is defined once, host-neutrally (a
  named tier + a list of command patterns), and rendered per host through the Binding Table — the
  same way the guard is. Claude renders `permissions.allow` into `.claude/settings.local.json`;
  every other host gets its own rendering once its permission surface is verified against that
  host's documentation, and until then a declared delta (`unsupported`, with the reason) instead of
  a guessed file. A new host joins by adding its rendering + conformance test, never by editing the
  preset itself.
- **E2 security posture (owner asked: "is that a security problem?")** — yes, a pre-approved command
  is attack surface, so the preset is designed around it: (1) opt-in only, never implied by `-y`;
  (2) written only to the per-user local file, never the shared/committed one; (3) no `git commit`,
  `git push`, `rm`, `curl`/`wget`, deploy or publish commands in any tier; (4) `npm install` /
  `npm run <script>` / `npx` execute code the agent can edit (package scripts, postinstall), so they
  sit in a separate, explicitly named **build** tier the user must pick — the default **verify**
  tier holds only fixed read/test commands (`git status|diff|log`, `npx tsc --noEmit`, `npx vitest run`,
  `npx eslint`); (5) the managed guard still runs before every allowed command; (6) remove-only-ours
  uninstall and doctor reporting, exactly like the session guard.
- **E3 → two working modes with different behavior.** *Relay mode* (the default, ordinary
  subagents): peers are unreachable by name; questions go under Open items; the coordinator relays
  and applies **contract first**. *Team mode* (only when the coordinator actually runs a live team
  session — Claude Agent Teams `--teams` today; the Cline / Antigravity / future equivalents bind the
  same law once verified): the brief names the mode and lists the peers a specialist may message
  directly; the final report still returns to the coordinator. `SendMessage` stays on specialists.

## Execution log

- **S1 + S2 — DONE** (one commit): the planning-spawn ban and "solo-composed" removed from the 7
  orchestrators and from the generated Cline coordinator rule; two-mode comms law in all 50
  specialists + 9 orchestrators (mode in the brief's *Peers & dependencies*, **Contract first** in
  Map hygiene); 2 new Core invariants bound in `HOST_DIALECTS.claude`; Claude runtime note states
  that peers are unreachable by name outside Agent Teams. Tests: residue (g), cline-projector,
  subagent-comms (relay/team/contract-first clauses + invariants). Goldens: legacy x5 (CRLF kept),
  created x5 (+2 lines each: the new invariant + binding only). Gates: typecheck 0; 58 files,
  837 passed / 0 failed / 209 skipped.
- **S3 — DONE** (one commit): 8 Tier-1 orchestrators' consult gate raised "at most 300 words per
  consult" → "at most 1000 words per consult"; `registry/bundles.json` digital-agency
  `planningLoop.budget.summaryWordCap` 300 → 1000; 9 specialists' Scope-of-Work line "≤150 words"
  → "≤300 words" (kept proportional). Tests: new Plan 024 S3 suite in `subagent-comms.test.ts`;
  `registry.test.ts` pin updated. Goldens: legacy x2 (`orchestrator-engineering.md`,
  `frontend-architect.md`). Gates: typecheck 0; 58 files, 840 passed / 0 failed / 209 skipped.
- **S4 — DONE** (one commit): opt-in command-permission preset (owner E2/E4). New
  `src/core/permission-preset.ts`: two tiers (`verify` default — `git status/diff/log`, `npx
  tsc/vitest/eslint`; `build` — adds `npm install`/`npm run`/`npm test`, explicit only),
  `NEVER_PRESET` unit-tested to reject `git push`/`commit`, `rm`, `curl`/`wget`, `vercel --prod`,
  `npm publish` in either tier; the same preserve-all / invalid-JSON-no-touch / remove-only-ours
  merge engine as the session guard (Plan 023), but writing ONLY to
  `.claude/settings.local.json`, never the shared `.claude/settings.json`, and never for a global
  install. Installer/uninstaller wiring mirrors `applySessionGuard`; a fan-out host with no
  verified renderer (anything but Claude today) gets an honest "not supported yet" warning
  instead of a guessed file. Doctor + CLI report the preset's state (`wired`/`missing`/
  `skipped-invalid`/`off`). CLI: `--permission-preset[=verify|build]` / `--no-permission-preset`,
  flag-only (no interactive prompt, never implied by `-y`). Tests: `tests/permission-preset.test.ts`
  (17, written RED first — MISSING API). Scratch-workspace evidence (built CLI): verify tier
  writes only `settings.local.json`; upgrading to build adds only the 3 new entries; a CRLF user
  file with its own `permissions.allow` entry keeps that entry and comes back byte-identical after
  remove; a file we created is deleted on remove. Gates: typecheck 0; 59 files, 857 passed /
  0 failed / 209 skipped.
- **S5 — DONE** (docs only): `docs/guard-testing.md` — the model-proof guard test (`echo git push
  --force`, `echo x > .env.test`, `echo vercel deploy --prod`; each verified against the real
  `GUARD_SCRIPT` logic to return exit 2 with the guard's message, and a harmless `echo hello world`
  verified to pass through), why hypothetical questions don't test the hook, `/hooks` to tell the
  frontmatter-hook layer from the settings-hook layer apart, and the Windows-without-Git-Bash
  cross-check. Linked from `src/core/guard.ts`. No code change.

All of Plan 024 (S1–S5) is now DONE.

## Owner verification — S5 guard test, Windows 11 (2026-09-27)

Owner ran the `docs/guard-testing.md` protocol on the local `feat/plan-024-field-test-fixes`
checkout in PowerShell: a Claude-only `--session-guard` install, all three model-proof commands
(`echo git push --force`, `echo x > .env.test`, `echo vercel deploy --prod`) blocked by the hook
in a plain session (no `--agent`), `/hooks` showed the agents-united entries, and — repeating the
same three commands after renaming `bash.exe` so Claude Code had no Git Bash fallback — all three
were still blocked. **Result: PASS.** This closes the last open item from Plans 022/023/024 (the
Windows-without-Git-Bash exec-form check from Plan 023 Step A0, and the plain-session guard check
from Plan 023 Workstream A that was only partially verified on 2026-09-27).
