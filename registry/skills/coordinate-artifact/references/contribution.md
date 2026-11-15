# From a reviewed draft to a prepared pull request
Upstream intent only prepares the pinned `.github/PULL_REQUEST_TEMPLATE/artifact-contribution.md`, base `dev`, `sent: false`, following the checkout's `docs/artifact-contribution.md`; no commit, push, pull request or publication follows. A human takes the git steps in the checkout; the coordinator prepares the evidence and the filled template body only. Each step ends with a mark: a script mark names the existing script or command that checks it, `[prose]` is an instruction, not a barrier. Commands are written for a POSIX shell (Git Bash on Windows).

## When it applies
Only for upstream intent. A local draft stops at the candidate and needs none of this. Without the checkout's guide and template, report the missing prerequisite; invent no equivalent.

## Common steps
1. The draft, evidence and producer roots stay outside the checkout and every managed Host folder until a human moves the reviewed files. `[script: check-skill-return.mjs, check-contract-return.mjs, check-job.mjs; the move and the Bundle proposal are prose]`
2. Search prior art: `registry/` artifacts and cores, `registry/hosts/` profiles, `host-library/` guides and observations, `tests/`, `docs/adr/`, and open and closed pull requests with `gh pr list --state all --repo github.com/NeoAnthropocene/agents-united`. Record the reuse or the reason for a new artifact. `[prose]`
3. The human cuts a branch from a fresh `origin/dev`; the pull request base is `dev`, never `main`; Conventional Commits. `[prose]`
4. Provenance and licence: carry the draft's recorded disposition. An original or inspired Skill omits `metadata.source`; an inspired one credits the reviewed inspiration truthfully and does not claim its text was copied. An adapted Skill pins `metadata.source` (https and a 40-character commit SHA), ships `LICENSE` and `NOTICE.md` where `docs/skill-intake.md` asks, and adds a `README.md` section 5 credit with the author or project, an upstream link and, if substantially changed, "adapted from X by Y". `[script: agents skill-check; legal truth and the credit are prose]`
5. Design records: a significant decision gets a new ADR in `docs/adr/`, new terms go to `CONTEXT.md`; link both in the template. `[prose]`
6. Template: the prepared body keeps the entire template; mark each inapplicable item N/A with the reason and fill Review and remaining work (reviewer questions, proposed decisions, unverified checks, the exact next action). A live test also gives tested commit, host/account/model/session, quota, prompt and cost ledger including teammates; unknown cost is unresolved, and the record is read with `npm run hostlib:session` from the host's own files. `[prose]`

## Skill
1. Collect: `skill-task.json`, `skill-return.json`, the saved `draft.mjs` job, stdout, stderr and exit, the preflight and postflight output with its exit, the final inventory, hashes and diff. `[script: check-skill-return.mjs; collecting the output is prose]`
2. Collect the `agents skill-check` output and exit, run with absolute `--artifact` and `--corpus` paths and `--policy` set to `agents-united-original` for work of this project, `private-owner` for another owner's Skill or `adapted-source` for a pinned adaptation. `[script: agents skill-check]`
3. Collect the P5 `skill` review result and its checker output; the judgment itself is prose. `[script: check-review.mjs]`
4. Place the folder in `registry/skills/<name>/`, or `registry/hosts/claude/skills/<name>/` for a Claude-only variant. A new Skill's `evals/` folder stays inside its checkout folder; no install copies it. `[prose]`
5. In `registry/bundles.json`, follow `docs/skill-intake.md` section 6: a contributor-only Skill goes in its named contributor bundle and stays out of `full`; an end-user Skill goes in its bundle (a vendor or niche one in an addon bundle, never an Essentials bundle) and in the explicit `full` inventory (section 8). Add the specialist wiring of section 7 and update the "N skills" counts in `README.md` and `PROJECT.md` (section 8). `[prose]`
6. Run `npm run build`, then in the checkout `node <checkout>/dist/cli.js skill-check --artifact <absolute folder> --corpus <checkout>/registry/quality/skill-boilerplate-corpus.txt --policy <policy>` on the placed folder, with the same policy. `[script: agents skill-check]`
7. Template: name, need and scope in Artifact and purpose; the loading role or an explicit reference-only statement; provenance and credit; subagent and guard boxes marked N/A with the reason (a Skill only); one host row with offline checks and the live column `unverified`. `[prose]`

## Shared pair
1. Collect: `contract-task.json`, `contract-return.json`, the saved `draft-pair.mjs` job, stdout, stderr and exit, checker output, hashes and diff. `[script: check-contract-return.mjs; collecting the output is prose]`
2. Collect the `contract-check` output and exit (0 when `valid`). `[script: agents contract-check]`
3. Collect the P5 `shared-pair` review result and its checker output. `[script: check-review.mjs]`
4. Place `<definition>.core.md` and `<definition>.contract.json` in `registry/core/` (reuse or add the pair) and run `npm run build` before using the checkout's `dist/cli.js`. `[prose]`
5. In the checkout, run `node <checkout>/dist/cli.js contract-check --registry <checkout>/registry --definition <definition>`. `[script: agents contract-check]`
6. The guide expects a new subagent's pair alongside its native host addition; a pair-only pull request is agreed with the maintainer first. Template: the four contract fields, the pair paths and the operation (create, reuse, update); the host rows `N/A (shared pair only)` with the reason, or a link to the paired realization; skill-loading and guard boxes N/A with the reason. `[prose]`

## Claude agent
1. Collect the supplied shared pair, the realizer's `check-job.mjs` and `check-handback.mjs` outputs with exits, and the final inventory, hashes and diff. `[script: check-job.mjs, check-handback.mjs]`
2. Collect the `factory-check` output and exit, and the P5 `claude-agent` review result with its checker output. `[script: agents factory-check, check-review.mjs]`
3. Collect the cited `host-library/claude/` guides, the declared deltas (`mapped`, `approximated`, `degraded`, `unsupported`) and the enforcement kind (`tool-restriction`, `script-guard` or `prose`) with its fail-open limits. `[prose]`
4. Place the agent in `registry/hosts/claude/agents/<name>.md` beside its pair in `registry/core/`. Regenerate generated blocks only with `UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts`; never edit one by hand. Wire a bundle or binding only when the contribution asks for it. Run `npm run build`. `[prose]`
5. In the checkout, run `node <checkout>/dist/cli.js factory-check --registry <checkout>/registry --definition <stem> --host claude --artifact <checkout>/registry/hosts/claude/agents/<name>.md`, adding `--loading main` or `--required-skills '<JSON array>'` when they apply. `[script: agents factory-check]`
6. Template: one Claude host row (surface, observed version, native path, bindings and deltas, offline checks, live `unverified` or a sanitized record); the shared pair box; each preloaded Skill's loading role; the guard box naming mechanism versus prose, input visibility and limits. `[prose]`

## Bundle proposal
The contributor checks the proposal in the checkout (step 3). The coordinator has no route that runs `bundle-check` yet, so it has run nothing here; its own reads and hashes are other evidence.
1. Collect the four proposal files, their hashes and diff, the template kind (Domain or Organization), the three shared Skills declared once and the leader's prerequisite status. `[prose]`
2. Agree with the maintainer whether the pull request is a proposal for review or an implemented Bundle that changes `registry/bundles.json`; the shared pairs and native realizations of its roles are separate tasks, and the counts in `README.md` and `PROJECT.md` change. `[prose]`
3. After `npm run build`, run `node <checkout>/dist/cli.js bundle-check --artifact <absolute proposal folder> --registry <checkout>/registry`, with `--operation update` for an update folder and `--allow-unresolved` only when the proposal names members that are still to be realized (the template lists them as open). Exit 0 passed, 1 failed, 2 unavailable. `[script: agents bundle-check]`
4. A pass does not show the leader file's content, the report's content and hashes, licence truth or quality: these stay prose and `unverified`. `[prose]`
5. Template: unimplemented hosts are `unverified`; the Verification section reports the command's exit and result, its `unresolved` list and its `unverified` fields. `[prose]`

## Gate before a pull request
Read each command's own exit code, never the exit code of a pipe.
1. Inspect `git diff` and `git diff --cached` before every commit: no secrets, raw private sessions or managed install outputs. Behaviour changes get a red and then a green commit. `[prose]`
2. `npm run hostlib:verify` exits 0. `[script: npm run hostlib:verify]`
3. `npm run typecheck && npm test` exits 0; `npm test` builds first. `[script: npm run typecheck, npm test]`
4. When a bundle, shared resolution or ownership changed: `AGENTS_CI_FULL=1 npx vitest run tests/e2e-domain-conformance.test.ts` exits 0 (about 3.5 minutes). `[script: npx vitest run]`
5. Immediately before every push run `gh pr list --state all --repo github.com/NeoAnthropocene/agents-united`; never push to a branch whose pull request has merged. The human opens one scoped pull request to `dev` with the template, inspects CI, and never force-pushes. Merge is the maintainer's decision. `[prose]`

## What this runbook refuses
- No commit, push, force-push, pull request or merge by the factory.
- No install into a managed Host folder (for example `.claude`, `.agents`, `.cline`, `.cursor`, `.codex`, `.opencode`, `.gemini`); no rerun of `draft.mjs` or `draft-pair.mjs`.
- No paid Host, model or provider session and no `host-agent-router` run without the maintainer's explicit authorization, scope and ledger.
- No cleared hold, no invented source, no check reported that did not run: mark it N/A with the reason.
- No credentials or raw private sessions in the body or the evidence.

## What stays unverified
Label every claim in the template `offline` (a script ran, its exit was read), `live` (a sanitized record of a Host session the maintainer authorized) or `unverified`. Plainly `unverified`: live behaviour of the factory and of this runbook, evaluator usefulness, Codex, Antigravity and Cline, Linux and CI until CI ran, and the legal truth of any licence or authorship. A passing checker (`acceptedDraft: false`), a prepared body (`sent: false`) or an evaluator opinion is not acceptance, live proof, legal clearance or permission to commit, push or publish.
