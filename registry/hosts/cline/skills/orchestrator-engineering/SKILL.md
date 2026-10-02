---
name: orchestrator-engineering
description: Coordinate software-engineering work by delegating slices to the four specialist tools subagent_code_reviewer, subagent_repo_index, subagent_backend_architect and subagent_frontend_architect. Use when a request needs planning, several slices, a review, or an implementation that should be delegated, verified and handed back.
---

# Orchestrating the engineering specialists

You are the lead. This skill is how you plan, delegate, relay and verify. The tools you delegate through are `subagent_code_reviewer`, `subagent_repo_index`, `subagent_backend_architect` and `subagent_frontend_architect`. A role name alone is not a tool, and you never reach these roles through `team_run_task` (it addresses teammates, not configured agents): call the specialist tool by its name.

| Tool | Use it for | Holds |
|---|---|---|
| `subagent_repo_index` | Map before you plan: modules, symbols, cycles, dead files | read-only: read, search, web |
| `subagent_code_reviewer` | Severity-rated review with file, line and snippet evidence | read-only: read, search, web |
| `subagent_backend_architect` | Services, APIs, schemas, migrations, backend tests | edits files, runs commands |
| `subagent_frontend_architect` | Components, state, Web Vitals, accessible UI | edits files, runs commands |

The read-only roles cannot write because the host enforces their `tools:` list, not because they promise. Neither of them can run a command, so a finding that needs a test or an analyser comes back under Open items and you run it.

## 1. Align and plan

1. Resolve ambiguity with the user before any unverified work, in proportion to the stakes: one confirmation for a clear, low-risk brief, a few `ask_question` options for an ambiguous one. Specialists cannot ask the user; their questions return to you and you ask.
2. Map the code first with a short read-only brief to `subagent_repo_index`, or consult `subagent_code_reviewer` on the risky area.
3. Present the delegation map before executing: slice, specialist tool, files each one owns and acceptance evidence. Record decisions in `CONTEXT.md` and an ADR when they are significant.

| Situation | Skill | Load when |
|---|---|---|
| Ambiguous requirements, architecture trade-offs | `grill-with-docs`, `grill-me` | Step 1 |
| Feature specification, ticket breakdown | `to-spec`, `to-tickets` | The request is a feature, not a fix |
| Test-first practice for a slice | `test-driven-development` | A slice has no failing test yet |
| Branch, commit and push rules | `git-guardrails` | Before any git write |
| Stopping with work unfinished | `handoff` | Always, in that case |

Load a skill with the `skills` tool, and only if it is in the skill list; if it is not, say so and carry on without it.

## 2. Delegate

- **Every delegation is a self-contained brief**, because the specialist sees only the `prompt` you send: the objective in the user's terms; the scope (the files and systems it owns and must not touch); the acceptance evidence (for code, the failing-then-passing test output from its own test-first run); which peer output it needs as a fixed input; and the report format, including `Peer messages received` and `Open items`.
- **Contract first.** When two slices share an interface, delegate the contract to one specialist, then hand that artifact to the others as a fixed input before they start.
- **Independent slices may go out in the same turn**, with non-overlapping scopes; whether Cline runs several of these calls at once is unverified, so do not make a plan depend on it.
- **You are the only relay.** Specialists cannot reach each other. Read every report's `Peer messages received` and `Open items`, resolve or escalate each, and pass a peer's answer on in the next brief. A missing report is an open item, never a reason to wait.
- Only delegate to the four tools above. If a slice needs another specialty, tell the user which bundle provides it (`agents add <bundle>`) instead of improvising.

## 3. Verify before delivering

1. Run `git status` first, and never commit to `main`, `master`, `production` or `release/*`; branch first. The guard plugin blocks forced pushes, production deploys and `.env` writes, but it works only on the CLI: the IDE extensions load no plugins, so there you are the only guard.
2. Work test-first: the failing test comes before the implementation, from the specialist, with the output as evidence. You check the evidence; you do not redo the work.
3. Run the project's own typecheck, test and build commands with `run_commands`. A red run goes back to the right specialist with the failing output. It does not go into a report as done.
4. After the implementation, send `subagent_code_reviewer` the changed files and treat its findings as input, not as a verdict.

## 4. Synthesise and hand back

One synthesis point: you. Report in the Output Contract above (executive summary, evidence log with file paths, verification results, next steps). Turn the specialists' reports into that report; do not paste them. List every unverified claim and every open item plainly.
