# Plan 033, Codex stage, slice 5a: audit of the Codex inputs against what the factory needs (2026-11-17)

Slice 5a of [the handoff of 2026-11-17](plan-033-handoff-2026-11-17.md): a read-only audit of the Codex library, profile and tool policy against what the factory needs. It was done at the maintainer's word ("start the Codex audit (slice 5a, read-only) in this session") by the lead of that session, an AI session, at `a8e535b` (`origin/dev` after pull requests 219 and 220). Nothing was built, no Codex session was started and no web page was fetched. The Claude stage is not formally closed (the "Factory hooks" row waits for the maintainer's decisions); the maintainer started this slice with that row open.

No independent review by a second Host has been made of this record yet.

## Result in short

The repository holds no reviewed Codex input of any kind. The three things the slice was to audit do not exist: there is no `host-library/codex/`, no `registry/hosts/codex/profile.json` and no `registry/hosts/codex/tool-policy.json`. Codex is known to the product only as a legacy `AGENTS.md` target marked under development. Slice 5b (design of the native bindings and loaders) therefore has nothing reviewed to design from; a Codex library has to come first.

A second finding corrects the handoff: the checkers and job schemas are not host-neutral as they stand. They pin the host `claude` in at least fourteen places.

## What exists for Codex today

| Area | State | Where |
| --- | --- | --- |
| Host docs library | Missing. Libraries exist for `claude`, `antigravity` and `cline` only. | `host-library/` |
| Profile and tool policy | Missing. The folder `registry/hosts/codex/` does not exist. | `registry/hosts/` |
| Native agents, skills, hooks, bindings | Missing. | `registry/hosts/` |
| Install target | Present as a legacy projection: profile `agentsmd`, a generated root `AGENTS.md`, global folder `.codex`, status `under-development`, refused for `--fanout`. | `src/core/hosts.ts`, `src/core/installer.ts`, `src/cli.ts` |
| Launcher | Missing. `agents start` names `claude`, `antigravity` and `cline` as the launcher-capable lanes. | `src/cli.ts` |
| Doctor checks | Codex is not in the declared-delta hosts or the MCP-audit hosts. | `src/core/doctor.ts` |
| Headless delegation to Codex | Present in the router skill: `codex exec` with `-s read-only` or `workspace-write`, rate limits from `codex app-server`, edits routed to WSL. These are operating notes of one machine, not a reviewed library. | `registry/skills/host-agent-router/references/hosts.md` |

A name trap: [ADR 0020](adr/0020-host-dialect-codex-and-translation-ledger.md), Plan 017 and `tests/host-dialect-codex.test.ts` use "codex" for the dialect vocabulary of every Host. They say nothing about OpenAI Codex.

Plan 033 already says that the legacy output does not count: "Existing legacy `AGENTS.md` output or another host's proof does not complete this stage" (the Codex row of the host order in [the plan](../plans/033-agent-factory-bundle.md)).

## What the factory needs from a Host, taken from the Claude stage

Each row is something the Claude stage reads or checks, and so something a Codex stage needs an answer for.

| Need | Claude's form | Codex |
| --- | --- | --- |
| A docs library with a lock | `host-library/claude/` (`sources.json`, `library.lock.json`, 22 pages, changelog, observations). The review job refuses a lock of another Host. | Missing |
| A profile | `registry/hosts/claude/profile.json` (version, minimum version, reviewed-against, artifact kinds agent, skill, hook, plugin, mcp, permissions; features) | Missing |
| A class-based tool policy | `registry/hosts/claude/tool-policy.json`; each entry cites a library page or observation | Missing |
| Bindings | seven `agent-factory*.binding.json` files with the surface `claude`, `Claude Code CLI`, `workspace`, `native`, the loading role, invocation, required support and reviewed inputs | Missing |
| Native roles | coordinator main and three workers as native agent files | Missing; whether Codex has a project-level role file is not in any library |
| Skill loading | the Host's skill folders, a typed command for each authoring route, a fallback read by the coordinator | Not known from a library |
| Delegation and hand-back | the `Agent` tool, foreground waiting, a checked hand-back | Not known from a library |
| Guards | `PreToolUse` hooks with `onFailure: "block"`, a destructive guard and a read-only guard | Not known from a library; the router notes say that the sandbox mode is Codex's own control |
| A launcher | `agents start agent-factory --host claude`, which turns agent teams off | Missing |
| A native check adapter | `factory-check` | It throws for every host but `claude` (`src/core/factory-check.ts`) |
| A review kind | `claude-agent` beside `skill` and `shared-pair` | No Codex kind |

## The host pins in the "host-neutral" parts

The handoff says the checkers and the shared pairs are host-neutral and are reused. The shared pairs under `registry/core/` are. The checkers and schemas are neutral in what they do, but they name `claude` as a fixed value:

- `registry/skills/realize-artifact/assets/job.schema.json` (two places).
- `registry/skills/evaluate-artifact/assets/job.schema.json` and `result.schema.json` (the host, and the subject kind `claude-agent`).
- `registry/skills/evaluate-artifact/scripts/check-review.mjs` and `review-job.mjs` (the folder `hosts/claude`, the library lock's host, the surface, the list of subject kinds).
- `registry/skills/coordinate-artifact/assets/skill-task.schema.json`, `contract-task.schema.json` (two places) and `bundle-task.schema.json`.
- `registry/skills/coordinate-artifact/scripts/check-contract-return.mjs` and `check-bundle-return.mjs` (the surface).
- `registry/skills/author-contract/assets/job.schema.json`.
- `src/core/factory-check.ts`, and the three source files named for Claude (`claude-factory-binding.ts`, `claude-factory-declaration.ts`, `claude-factory-start.ts`).

So reuse for Codex means one of two things, and it is a design choice of slice 5b that the maintainer decides: make the host a parameter of these files (one set, more hosts, and the Claude tests are run again), or copy them per Host.

## What this machine shows, as an observation and not as a library

- `codex --version` printed `codex-cli 0.169.0` (Windows side, read once).
- `codex --help` lists, among others, `exec`, `review`, `mcp`, `plugin`, `sandbox`, `features`, `agents` (described as a command center for sessions) and `app-server`.
- The user folder `.codex` holds, among others, `config.toml`, `skills`, `plugins` and `memories_1.sqlite`.

These names suggest that Codex has skills, plugins, MCP wiring, a sandbox and feature flags. What each one does, which files a project may carry, whether a project-level role or hook exists and from which version is not in any reviewed source in this repository. No statement about a Codex capability is made here beyond the names that were printed.

## Not done, not shown

- No page of Codex documentation was fetched or read; no changelog was read.
- No Codex session was started, headless or interactive.
- The WSL side was not looked at.
- The count of fourteen host pins comes from one search for the literal `claude` in the factory's schemas and scripts; prose files were left out, and a pin in another spelling would have been missed.

## What slice 5b needs first

1. A Codex docs library: `host-library/codex/sources.json` with its indexes, changelog and page list, then a refresh, a lock and a guide. The library tooling finds a Host by its `sources.json`, so no code change is needed to add one. This is new content and a pull request of its own; it is not part of a read-only slice.
2. The surface the stage is for: the Codex CLI, the Desktop app, or both; Windows, WSL, or both. The router notes record that Codex edits were routed to WSL because its Windows sandbox started in the wrong folder.
3. A minimum version, taken from the changelog once the library exists.
4. Only then `profile.json` and `tool-policy.json`, each entry citing a library page, and after them the design of slice 5b.

Whether to start the library, and for which surface, is the maintainer's to say.
