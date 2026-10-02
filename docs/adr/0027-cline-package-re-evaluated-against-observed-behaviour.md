# ADR 0027: The Cline Native Package, Re-evaluated Against Observed CLI Behaviour

- **Status**: Accepted — 2026-10-02 (product owner: "go with the suggested one", after the observations below).
  Amends ADR 0026 decisions 3 and 5; ADR 0026 decisions 1, 2, 4, 6 and 7 stand.
- **Context**: ADR 0026 was written from the vendor docs snapshots alone, and the first version of it overstated what
  Cline lacks (corrected in #91). Real headless sessions of the installed CLI (3.0.68, provider `cline`, about 0.09 USD
  of credits) and the build's own tables then showed the docs and the build disagree in places that shape the package.
  The full record is `host-library/cline/observations/2026-10-02-cli-3.0.68.md`; in short:
  - **Tool names**: the CLI's canonical tools are `read_files`, `search_codebase`, `run_commands`, `fetch_web_content`,
    `apply_patch`, `editor`, `skills`, `ask_question`, `submit_and_exit` and `spawn_agent`, with legacy names aliased onto
    them. The docs' two vocabularies are legacy against canonical; `use_subagents` and `fetch_web` are not in the build.
  - **Skills**: `.cline/skills/` and `.agents/skills/` load; `.claude/skills/` does not (the docs say it does); for a
    same-named skill `.agents/skills` **wins over** `.cline/skills`.
  - **Guards**: a single-file plugin in `.cline/plugins/` is auto-discovered, and a throwing `beforeTool` hook blocks the
    call, but the throw ends the whole run with an error.
  - **Listed, effect unverified**: `.cline/agents/*.yaml` and markdown workflows in `.clinerules/workflows/` and
    `.cline/workflows/` appear in `cline config`; a leading `/` is rejected as a CLI argument, so a workflow could not be
    invoked headless, and nothing observed reads an agent file for a run.
- **Decision**:
  1. **Observations are a record, not documentation.** What a build does is kept as dated, versioned observations in
     `host-library/<host>/observations/`, never cited from a guide's `## Rules` (those cite vendor docs only). A guide's
     authoring notes point to them where they disagree with the docs. An artifact whose design depends on an observed
     but undocumented behaviour is marked "observed on `<version>`" in the delta table.
  2. **The Cline package writes skills to `.cline/skills/<name>/` only.** It never writes `.claude/skills/` (not read by
     the CLI) and never `.agents/skills/` (the Antigravity and canonical lane owns it, and it wins a name clash, so
     writing there would override the other lane). The doctor warns when a skill name the Cline package installs also
     exists in project `.agents/skills/` or `~/.agents/skills/` with different content, because that copy shadows the
     Cline-native one.
  3. **Workflows and named roles are neither a gap nor native until verified** (amends ADR 0026 decision 3). The delta table
     says "listed on 3.0.68, effect unverified" for `.cline/agents/*.yaml` and for markdown workflows, and the package
     ships no artifact for them. They are promoted to native only after a verification: an invocation route that works
     headless (or a run in the IDE), recorded as a new observation. Until then `workflow-*` runbooks stay skills, which
     are already slash commands, and role knowledge stays skills and rules.
  4. **The guard is a single-file plugin, and a block ends the run** (amends ADR 0026 decision 5). The destructive-command
     guard ships as one `.js` file copied to `.cline/plugins/`, throwing from `beforeTool` on a destructive pattern. Ending
     the run is accepted for a destructive command (it fails closed) and the doctor says so. A guard that returns a refusal
     the model can recover from, and a read-only guard that knows which agent made the call, are future work and stay
     unverified. The guard remains CLI-only.
  5. **The tool policy keys the canonical names** and records the alias table; the capability class `delegate` maps to
     `spawn_agent` on the CLI. The IDE extension's names are unverified and are not assumed to match.
  6. **Real-session verification of a Cline package** runs on the owner's Cline Credits with `-P cline` and a cheap model,
     under a ceiling the owner states, with a ledger of the cost each run reports. Headless runs close stdin
     (`< /dev/null`) and use `--json -t <seconds>`.
- **Consequences**:
  - Positive: the Cline tool policy and the guard plugin are no longer blocked on guesses; the package cannot silently
    shadow or be shadowed by the `.agents/` lane; nothing is shipped for behaviour that was only listed.
  - Negative: observations describe one build and go stale, so they must be re-run when the CLI version changes; the
    guard plugin ends a run rather than letting the model retry; workflows and named roles wait on a verification route
    that may not exist headless.
  - Open: what `.cline/agents/*.yaml` does at run time; how to invoke a workflow headless; whether the IDE extensions
    honour the same skill locations, rules and tool names as the CLI; how the doctor detects the `.agents` shadowing
    cheaply (the no-model `cline config skills --json` listing is a candidate probe).

## Addendum (2026-10-02, later the same day)

Checking the CLI's own release notes from the terminal (`gh release list -R cline/cline`; there is no `cline changelog`
command) showed that **the docs library does not track the CLI's release stream**: `sources.json` follows the repository's
root `CHANGELOG.md` (4.1.22), while the CLI (`cli-v3.0.x`, latest 3.0.68, the build tested), the SDK and the Desktop app each
release separately. Consequences recorded here, no decision above changes:
- The changelog-first host update would miss every CLI release until the library follows `cli-v*` releases too. That needs
  a changelog source that reads GitHub releases (the parser handles only markdown headings today); it is a separate,
  test-first tooling slice.
- The release notes name things the observations had not covered (configured subagents, Agent Plugins under
  `~/.agents/plugins/*`, `.cline/cron/*.md` and `*.task.md` specs). A probe found the agent YAML files are not registered as
  teammates in a plain session and could not reproduce Agent Plugin discovery, so decision 3 (listed, effect unverified)
  stands and nothing new is shipped for either.
