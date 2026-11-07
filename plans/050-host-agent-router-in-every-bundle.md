# Plan 050: `host-agent-router` in every bundle, opt-in

Status: planned, not started. Depends on [Plan 049](049-host-agent-router.md) being merged: the skill must exist on `dev` first. Decision record to write: the next free ADR number at the time (0066 if still free), extending [ADR 0065](../docs/adr/0065-host-agent-router-cross-host-dispatch.md).

Goal: every bundle ships `host-agent-router` and the two skills its workers follow (`handoff`, `git-guardrails`), as a standing part of the bundle, and no orchestrator is pushed to use it. It stays dormant until the user explicitly asks to run work on another host CLI. Done when: a test fails if any bundle lacks the three skills, every lead orchestrator carries the same short opt-in clause, no orchestrator preloads the skill except `orchestrator-universal`, the gates and the full lifecycle matrix pass, and an install of one root bundle, one addon and one organization bundle shows the skills present and unused. Out of scope: changing the skill itself, new CLI flags, a resolver change in `src/` (see decision 3), any live host run.

## Ground — read on 2026-11-07

- 37 bundles: 13 roots (11 `domain` including `universal-skills`, `universal-orchestration` and `full`, plus 2 `organization`) and 24 addons that name a `parentBundle`. The router is in 3 today (`full`, `universal-orchestration`, the mock bundle); `handoff` in 8; `git-guardrails` in 15 (counts from `registry/bundles.json`).
- Nine lead orchestrators serve them; addons share their parent's orchestrator. Three bundles have none: `agent-factory` (under construction), `remotion-agent-skills`, `universal-skills`.
- Orchestrators list `skills:` in their frontmatter. `tests/bundle-skill-refs.test.ts` requires every skill an agent declares to ship in every bundle that includes that agent. So **declaring the router in a department orchestrator's frontmatter would itself force it into every bundle that orchestrator serves, addons included**, and would also preload it: the skill's text in context in every session of that orchestrator. That is the opposite of opt-in.
- Addons can be installed alone and survive removal of their root (lifecycle cases B1 to B4, C2), and shared skills are co-owned (A2 to A6). Adding three skills to 34 more bundles adds shared records to those cases.
- Two orchestrators are authored from `registry/core/*.core.md` (engineering, digital-agency) and projected per host (`registry/hosts/claude`, `cline`, `antigravity`); the others are single files. Every file that renders an orchestrator needs the same clause.
- No new skill enters the registry, so the registry total stays 218; the places that state which skills a bundle ships (README, PROJECT, CONTEXT, the Domain Atlas table) need a pass.
- The skill was tested only on Windows with WSL. On macOS and Linux there is one `local` side and the bridge is not used; that path is untested (see risks).

## Decisions to settle before building (recommendation first)

1. **Scope.** (a) Every bundle that has an orchestrator, plus `universal-skills`, and add `agent-factory` and `remotion-agent-skills` for uniformity: all 37. (b) Roots only (13), addons inherit by installing with their root. *Recommend (a):* addons are installable alone, the existing router test already enforces "all bundles that ship it ship its companions", and a rule with no exceptions is the easiest to keep true. The one thing to confirm: `agent-factory` is under construction with one skill and no agents; include it or list it as an exception with a reason.
2. **What "opt-in" means in the files.** *Recommend:* (i) keep the explicit-request description of the skill; (ii) give every lead orchestrator the same clause, written once and copied verbatim (it is a few lines: only when the user asks; name the hosts; get a yes; it spends the user's other accounts; use the skill only if installed); (iii) **do not** add the skill to the frontmatter `skills:` of the department orchestrators, so it is neither preloaded nor forced by `bundle-skill-refs`; `orchestrator-universal` keeps its declaration because it already has Phase 5; (iv) never set `disable-model-invocation` (ADR 0065 decision 8). Alternative: declare it everywhere and accept the preload; rejected because it adds context to every session for a feature most sessions never use.
3. **Mechanism.** (a) Data only: add the three names to each bundle's `skills` list, with a drift test. (b) A registry-level base list that the resolver appends to every bundle (a `src/` change, schema, and tests that read `bundles.json` directly). *Recommend (a):* no `src/` change, the test makes forgetting a new bundle impossible, and (b) can follow if bundles keep multiplying.

## Steps (test first, per `docs/session-start.md`)

0. After Plan 049 merges, a clean worktree and a new branch from fresh `origin/dev`. Goal statement first.
1. **Red.** Extend `tests/host-agent-router-skill.test.ts` (or a sibling file): every bundle ships the three skills (the exceptions list, if any, with a reason each); every lead orchestrator file, in the registry and in each host projection, contains the opt-in clause with its three gates and says "if installed"; no department orchestrator lists the router in `skills:`; `orchestrator-universal` still does. Watch each fail for the intended reason.
2. **Data.** Add the three names to the 34 bundles with a script that preserves the file's format and order, not by hand. Re-run `bundle-skill-refs` and `domain-atlas-contract`.
3. **Clause.** Write it once (draft in the plan's PR), then place it in the nine orchestrators: edit the two `.core.md` files and regenerate their projections; edit the other seven directly; check the native Cline, Claude and Antigravity packages that mirror orchestrators.
4. **Docs.** ADR, README, PROJECT, CONTEXT (bundle contents, the Domain Atlas table), this plan's log, `plans/README.md`.
5. **Gates.** `npm run typecheck`; `npm test`; once, `AGENTS_CI_FULL=1 npx vitest run tests/e2e-domain-conformance.test.ts` on an idle machine (about 27 minutes; it failed 179 of 317 once under memory pressure and passed 317 of 317 on rerun, cause of the first failure not captured).
6. **Install proof** in a scratch workspace, never the home directory: `agents add` for a root (`software-engineering`), an addon (`frontend-engineering`) and an organization bundle (`digital-agency`) for the Claude, Cline and Antigravity lanes; confirm the three skills land (without `evals/`), `router.mjs` is byte-identical to the registry, size delta noted, and an orchestrator session does not mention the skill unprompted.
7. **Hand over** uncommitted until asked.

## Risks, said plainly

- **A larger blast radius.** The skill starts other accounts' CLIs. Opt-in here is prose: the description, the clause, and the consent step. There is no hard gate, and an instruction hidden in a repository could still ask an orchestrator to "run this on another host". The mitigations are the explicit-request wording, the yes before the first run, read-only by default, the worker guard and the router's own record of changes; none of them stops a user from saying yes to something unwise.
- **Untested outside Windows and WSL.** Shipping to every bundle exposes macOS and Linux users to the single-`local`-side path, which has unit tests but no live run. Either run it live on one such machine before this lands, or say so in the skill's own text.
- **Dormant but present.** On a machine with none of the four host CLIs the skill does nothing; on one without Node 20 its script fails with a clear error. Neither affects the bundle's other skills.
- **Weight.** Three skills in 34 more installs, `router.mjs` included. Measure it in step 6 and report the number.
- **Test time.** The lifecycle matrix grows by shared records; its 27 minutes will not shrink.

## Not known yet

Whether any host projection copies an orchestrator's text rather than generating it (step 3 finds out); what CI's own matrix run reports; whether the `agent-factory` exception is wanted.
