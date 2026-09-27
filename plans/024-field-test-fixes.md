# Plan 024: Field-Test Fixes from the Plan 022/023 Claude CLI Checks

> **Executor instructions**: self-contained; TDD (Red → Green → Refactor); one commit per step
> group, each owner-reviewed before commit; every commit green; update this plan's row in
> `plans/README.md` when done. Canonical agents stay HOST-NEUTRAL (Plan 018); host nouns only in
> overlays, bindings and the Claude runtime note.

## Status

- **State**: DRAFT — 2026-09-27, awaiting owner decisions E1–E4
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

| # | Decision | Recommendation |
|---|---|---|
| E1 | Consult cap | 1000 words per consult (owner's suggestion); Tier-2 `summaryWordCap` 300 → 1000; Scope-of-Work "≤150" → "≤300" |
| E2 | Permission preset | Opt-in `--permissions-preset`, `.claude/settings.local.json` only, never commit/push |
| E3 | Scope of S2 | Wording + contract-first rule now; keep `SendMessage` on specialists (needed for Agent Teams and for messaging the coordinator) |
| E4 | Ship order | S1+S2 first (P1 correctness), then S3–S5 |
