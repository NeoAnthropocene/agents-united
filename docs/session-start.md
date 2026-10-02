# Before you start (read this first, every session)

This is the gate for any AI session on this repo, whatever harness runs it. Do these in order, before you plan or write anything. Where this file and the code disagree, the code wins: fix this file in the same PR.

## 1. Read, in this order

1. `CLAUDE.md` and the rules in `.claude/rules/` (some harnesses load them for you; if yours does not, read them): environment, the pre-push gate, and the standing safety rules.
2. `PROJECT.md`: the architecture, the interface contracts (§7), the codebase layout (§9), the verification matrix (§10), the branching model (§11).
3. `CONTEXT.md`: the domain dictionary. Use its terms exactly (Bundle, Skill, Host, Native Lane, Configured Agent, ...); do not invent synonyms.
4. `docs/workflow-guide.md`: branch, pull request and release flow.
5. The plan and ADRs of the area you will touch: the index in `plans/README.md`, the dated log at the end of the relevant plan (for native host packages, `plans/032-native-host-packages.md`; the newest entries are the current state), and `docs/adr/` newest first.
6. `README.md` only when the task changes user-facing behaviour or a count it states. It describes the product; it is not the specification.

## 2. Prior art before any claim

Before you write that something does not exist, that a host lacks a feature, or that a behaviour is unknown, search for it and say what you searched. The places: `src/`, `docs/adr/`, `plans/`, `registry/translation-ledger.json`, the tests, `host-library/<host>/guide/` and `host-library/<host>/observations/`, and open **and closed** pull requests (`gh pr list --state all --search "<term>"`). If an earlier attempt stalled, understand why before starting yours. ADR 0028 records what skipping this cost.

## 3. Non-negotiable rules

- Work on a branch cut from a fresh `origin/dev`. Pull requests target `dev`, never `main`. Never force-push, never commit to a protected branch, never stage a secret (`git diff --cached` before every commit).
- Commit or push only when the maintainer asks. One reviewed pull request per slice, with Conventional Commit messages.
- Test first: write the failing test, watch it fail for the intended reason, then the minimal code, then refactor. Run `npm run typecheck && npm test` before pushing.
- Strict TypeScript, no `any`. Shared types live in `src/core/types.ts`; terminal I/O only in `src/cli.ts`.
- A significant decision gets a numbered ADR in `docs/adr/`; a new term goes into `CONTEXT.md`; progress goes into the plan's dated log. Record corrections the same way: amend, never silently rewrite.
- A native host artifact is authored from that host's guide and observations (the `realize-for-host` skill), never from memory. An observation is a dated record of one build, not vendor documentation.
- Say what was verified and what was not. A probe or a real session beats an inference; write "unverified" plainly instead of smoothing it over.

## 4. Spending

A real-session run spends the maintainer's own account. Before the first run of a session, say which account it uses, the rough cost and, where the harness shows it, the quota headroom; keep to the ceiling the maintainer states, keep a running ledger, and report the total afterwards.

## 5. State the goal, then check the ground

Open your first message with this, filled in:

> Goal for this session: **[the slice]**. Done when: **[what can be checked]**. Out of scope: **[what you will not touch]**.

Then, before changing anything: `git status`, `git branch --show-current`, `gh pr list --state open`, and read the newest entries of the plan log. If a pull request of the previous session is still open, say so and wait for it or build on it explicitly.
