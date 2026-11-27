# Contributing to Agents United

This guide is for maintainers and contributors who change this repository. If you only want to install and use agent teams, read [README.md](./README.md) instead.

The architecture is in [PROJECT.md](./PROJECT.md), the domain terms are in [CONTEXT.md](./CONTEXT.md), and the reading order for an AI session is in [docs/session-start.md](./docs/session-start.md). Where this guide and the code disagree, the code wins: fix this guide in the same pull request.

## Setup

You need Node.js 24 or later (`engines` in [package.json](./package.json), pinned in [.nvmrc](./.nvmrc)), npm and Git.

```bash
git clone https://github.com/NeoAnthropocene/agents-united.git
cd agents-united
npm ci
npm run build
```

`npm run build` writes `dist/`. `npm test` builds first on its own (`pretest`). Python 3 on `PATH` is needed for the `tests/skill-scripts` suites; they are skipped without it.

In Claude Code on the web, [.claude/settings.json](./.claude/settings.json) runs [scripts/cloud-session-start.sh](./scripts/cloud-session-start.sh) at session start. It installs Node 24, runs `npm ci` and builds. On a local machine it does nothing.

## The gates

Pick the gate by the size of the change.

**A local change** (one doc, one test file, one Skill, one config line): run the focused tests for what you touched, plus the type check of the test tree:

```bash
npx vitest run tests/<the-test-you-changed>.ts
npx tsc --noEmit -p tsconfig.test.json
```

Then let CI on the pull request run the whole suite.

**A cross-area change** (source in `src/`, the registry, the installer, several Bundles): run the full gate before you push.

```bash
npm run typecheck                      # build, then tsc over src, tests and the two script trees
npm test                               # the whole Vitest suite (builds first)
AGENTS_CI_FULL=1 npx vitest run tests/e2e-domain-conformance.test.ts
npm run hostlib:verify                 # host-library lock hashes and guide citations
```

- `npm run typecheck && npm test` is what CI runs.
- The `AGENTS_CI_FULL=1` run is the full addon lifecycle matrix. It takes a few minutes and CI does not run it, so run it yourself when you touch install or removal behaviour.
- `npm run hostlib:verify` checks the host docs library under [host-library/](./host-library). Run it when you touch `host-library/` or a native artifact that cites it.

Read the exit code of the command itself. A run piped through `grep` or `tail` exits 0 even when a test failed.

### Running the suite inside Claude Code

Inside a Claude Code session the plain suite can fail for reasons that are not in your change: the session sets `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, and parallel test files compete for the machine. Unset the variable and run serially:

```bash
env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npm test -- --maxWorkers=1 --fileParallelism=false
env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS npx vitest run tests/<file>.ts --maxWorkers=1 --fileParallelism=false
```

The serial full suite is slow (about an hour). Run nothing else heavy while it runs; a timing failure under load is not a reason to change code. Rerun the failing file alone, then the whole gate.

### CI is Linux only

[CI](./.github/workflows/ci.yml) runs on `ubuntu-latest` with Node 24: `npm ci`, `npm run typecheck`, `npm run build`, the conformance files (`tests/semantic-core.test.ts`, `tests/native-conformance.test.ts`, `tests/native-invariant-coverage.test.ts`), then `npm test`.

A green run on Windows is not a green run on CI. The usual differences:

- **Path separators.** Code that builds a record path with `path.join` gives `\` on Windows and `/` on Linux. A test that compares paths must hold on both.
- **Line endings.** A test that compares text read from a CRLF checkout against an LF string passes or fails depending on the platform. Normalise (`.replace(/\r\n/g, '\n')`) before you compare or hash.
- **Case.** Linux file names are case sensitive; Windows file names are not.

After you push, read the pull request's CI result once it finishes.

## Line endings on Windows

The index stores LF. With `core.autocrlf=true` (the Git for Windows default), files are checked out as CRLF and stored back as LF. [.gitattributes](./.gitattributes) pins LF only for the files where bytes matter (`registry/bundles.json`, `.nvmrc`, `scripts/cloud-session-start.sh`, the frozen skill-quality corpus) and turns conversion off for `host-library/**`.

The traps:

- **A generator writes LF into a CRLF working tree.** Git then shows the whole file as modified although no line changed. Check with `git diff --ignore-cr-at-eol --name-only`: a file that is not in that list changed only its line endings, so restore it with `git checkout -- <file>`.
- **A scripted edit anchors on `\n`.** On a CRLF checkout the anchor misses. Normalise the text, require exactly one match, then write it back.
- **A pinned hash.** Hash the committed LF blob (`git show HEAD:<file>`), not the CRLF working file.

## Regenerating native files

Native host files under `registry/hosts/` carry generated blocks (the Contract Floor, tools line, hooks, requests, publishing and roster blocks). Do not edit those blocks by hand. Change the source, then regenerate:

```bash
UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts
```

The other hosts have the same switch in `tests/native-antigravity-agents.test.ts` and `tests/native-antigravity-rules.test.ts`.

On Windows the generator rewrites every file with LF, so many files look modified. Keep only the files that changed in content:

```bash
git diff --ignore-cr-at-eol --name-only    # the real changes: keep these
git checkout -- <every other modified file>
```

Then run the same test file without `UPDATE_NATIVE` and check that it passes.

## The agent factory and the repo doctor

The `agent-factory` Bundle is the contributor toolkit for authoring artifacts in this repository: Skills, shared definition and contract pairs, Claude agent drafts, Bundle proposals and host-update plans. It is under construction and installs for the Claude Code CLI, workspace scope, native lane only:

```bash
agents add agent-factory -t claude --native --allow-under-construction --copy -y
```

Its lead is `orchestrator-agent-factory`, with the workers `factory-realizer`, `factory-evaluator` and `factory-sync`. Each route ends with a read-only check that you can also run yourself from a built checkout:

```bash
node dist/cli.js skill-check --help
node dist/cli.js contract-check --help
node dist/cli.js factory-check --help
node dist/cli.js bundle-check --help
```

Background: [docs/agent-factory-foundation.md](./docs/agent-factory-foundation.md), the upstream contribution route in [docs/artifact-contribution.md](./docs/artifact-contribution.md), and the plan for the factory as a workbench in [plans/052-factory-maintainer-workbench.md](./plans/052-factory-maintainer-workbench.md).

The repository health review is the [`repo-doctor` Skill](./registry/skills/repo-doctor/SKILL.md) of the agent-factory Bundle. Its script runs the fast checks (README counts, relative links, the plans index, ADR numbers, and ADR numbers of open pull requests), it runs the quick gates that write nothing, and it reads the latest CI result with its commit and age. It writes only the git-ignored `.repo-doctor-report.md`, each finding with its evidence and a proposed fix; each fix goes through the normal route below. Run it by hand before a pull request; the factory running it automatically and recording the result in the pull request body is Plan 052 step 4 ([ADR 0080](./docs/adr/0080-factory-maintainer-workbench.md)).

`agents doctor` is a different tool: it checks an installed workspace, not this repository.

## The pull request route

All work lands on `dev` through a reviewed pull request. `main` receives releases only. The full branch and release flow is in [docs/workflow-guide.md](./docs/workflow-guide.md).

1. **Branch from a fresh `origin/dev`.**

   ```bash
   git fetch origin
   git checkout -b feat/<short-name> origin/dev
   ```

2. **Tests first.** Write the failing test, run it and see it fail for the intended reason, commit it, then write the minimal change that makes it pass.
3. **Run the gate** that fits the change (see [The gates](#the-gates)).
4. **Inspect what you stage.** Run `git diff --cached` before every commit. Never stage `.env` files, keys, tokens or credentials. Commit only real changes, not line-ending noise.
5. **Commit with a Conventional Commit message** (`feat:`, `fix:`, `docs:`, `test:`, ...). The type drives the release notes.
6. **Get one independent review** of the diff before the pull request is merged (Plan 052 asks for one read-only review per step).
7. **Open the pull request against `dev`**, never `main`.

Never:

- force-push (`git push --force` or `-f`);
- rewrite pushed history (rebase or amend a commit that is already pushed): add a new commit instead;
- commit to `main`, `master`, `production` or `release/*`;
- push a follow-up to a branch whose pull request is already merged: it never reaches `dev`. Check `gh pr list --state all` first, and start a new branch from `origin/dev` if it is merged.

## Where decisions live

- **ADRs** in [docs/adr/](./docs/adr): one numbered file per significant decision (`NNNN-<slug>.md`) with Status, Context, Decision and Consequences. Before you take a number, check `origin/dev` and the open pull requests for the next free one.
- **Terms** in [CONTEXT.md](./CONTEXT.md): use its words exactly (Bundle, Skill, Host, Native Lane, ...). A new term goes there.
- **Plans** in [plans/](./plans), indexed in [plans/README.md](./plans/README.md). Progress goes into the plan's dated log; corrections are added, not silently rewritten.
- **Standing rules** in [registry/rules/](./registry/rules) (git guardrails, test-driven development, clean code, domain modeling, multi-agent coordination, quality and accessibility). An installed workspace has them in `.claude/rules/`, which is not tracked here.
- **Host knowledge** in [host-library/](./host-library): each host's docs snapshots and dated observations. A native artifact is authored from there, never from memory.
- **AI agents** start from [CLAUDE.md](./CLAUDE.md) (Claude Code) or [AGENTS.md](./AGENTS.md) (Codex and others).

## For maintainers

- **Before a pull request:** the gate for its size (focused tests and the test-tree type check for a local change; typecheck, the full suite, the addon matrix and `npm run hostlib:verify` for a cross-area change), and the repo doctor's report.
- **After a push:** read the pull request's CI result once, when it finishes. Fix a red run on the same branch with a new commit.
- **Merging is the maintainer's.** The maintainer merges pull requests to `dev`. An agent never merges, and pushes or opens a pull request only at the maintainer's word ([ADR 0080](./docs/adr/0080-factory-maintainer-workbench.md), decision 6).
- **Live host sessions** (Claude Code, Cline, Antigravity, Codex) spend the maintainer's account. Keep each run bounded and read the host's own records afterwards: see [docs/live-test-protocol.md](./docs/live-test-protocol.md).
- **Say what was verified and what was not.** Write "unverified" plainly in pull requests, plans and ADRs.
