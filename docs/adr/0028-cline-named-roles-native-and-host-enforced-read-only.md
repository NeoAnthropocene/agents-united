# ADR 0028: Cline Named Roles Are Native, and Read-Only Is Enforced by the Host

- **Status**: Accepted — 2026-10-02 (product owner: "correct it on our files"). Supersedes ADR 0026 decision 3 and ADR 0027
  decision 3, and the premise of ADR 0027 decision 4. ADR 0026 decisions 1, 2, 4, 5 (the CLI-only guard), 6 and 7 and ADR 0027
  decisions 1, 2, 5 and 6 stand. Builds on ADR 0013, which this ADR should have started from.
- **Context**: ADR 0026 and ADR 0027 were written from the vendor docs snapshots and from observed behaviour, without reading the
  repository's own Cline work. **Prior art searched now:** ADR 0013 (verified against CLI 3.0.61 and the `cline/cline` source),
  ADR 0014, `src/core/cline-projector.ts` (`renderConfiguredAgent`), `src/core/cline-capabilities.ts` and
  `registry/translation-ledger.json`. ADR 0013 already records the native discovery registry: skills, rules, workflows
  (`/<slug>` commands), plugins and **configured agents** (`.cline/agents/<role>.yml`, frontmatter `name`, `description`,
  optional `tools`, `skills`, `providerId`, `modelId`, `maxIterations`, body = system prompt, each exposed as a `subagent_*`
  tool), and the legacy lane already writes them. The first Cline probe of this phase used a malformed file (plain YAML with no
  body) and concluded the files had no effect; ADR 0026 had called them absent and ADR 0027 "listed, effect unverified".
  Probes in the right format on CLI 3.0.68 (`host-library/cline/observations/2026-10-02-cli-3.0.68.md`, section "Configured
  agents") showed: a configured agent becomes the tool `subagent_<name>` and runs the file's prompt; with no `tools:` it can
  write; with `tools: [read_files]` it cannot, and the host refuses.
- **Decision**:
  1. **ADR 0013's discovery registry is the baseline** for the Cline package. The observations file confirms it on 3.0.68 and
     extends it; where an earlier ADR of this phase conflicts with it, this ADR replaces the earlier text.
  2. **Named roles are native.** Each engineering role ships as `.cline/agents/<role>.yml`: frontmatter `name` (without the
     `subagent-` prefix, as the legacy lane does), `description`, `maxIterations`, `skills` and **`tools`**, with the Contract
     Floor and the role's native instructions as the body. The orchestrator delegates to the `subagent_<name>` tools
     (ADR 0013, ADR 0014). The legacy renderer omits `tools`; the native package adds it.
  3. **Read-only is host-enforced, not hook-enforced.** `tools:` is derived from the role's capability classes through
     `tool-policy.json`, using the canonical tool names. A read-only role (the code reviewer, the repository indexer) gets only
     read and search names, and needs no hook. The docs' built-in subagents remain for generic read-only research.
  4. **The guard plugin is narrowed** (amends ADR 0027 decision 4). It remains a single-file plugin, CLI-only, whose block ends
     the run, but it guards only what `tools:` cannot express: the destructive shell command of any agent that holds
     `run_commands`, the main agent included. Whether a plugin hook also sees a subagent's tool calls is unverified and is
     checked in the profile and tool-policy slice before the plugin is written.
  5. **Workflows follow ADR 0013.** Multi-agent `workflow-*` runbooks keep shipping as `.cline/workflows/<slug>.md` slash
     commands alongside their skill form, as the legacy lane does. The doctor marks them "listed, invocation unverified",
     because a leading `/` is rejected by the CLI's argument parser and they could not be invoked headless on 3.0.68.
  6. **The orchestrator is a rule and a skill, not a file-defined agent.** Whether the lead agent can itself be defined by a
     file is unverified; until it is, the coordinator instructions ship as `.cline/rules/` plus a skill, as in ADR 0013.
  7. **Skills location stands** (ADR 0027 decision 2): the native package writes `.cline/skills/`, and the doctor warns when
     `.agents/skills` shadows a name it installs. Note that the legacy lane relies on `.agents/skills`, so the warning matters
     while both lanes can be installed.
  8. **Prior art before any "the host lacks X" claim is now a rule of the process.** The `realize-for-host` maintainer skill
     gains a hard prerequisite: search `src/`, `docs/adr/`, `registry/translation-ledger.json` and the tests for the host,
     probe the installed host with credit-free commands where they exist, and name what was searched in the ADR's context. A
     gap is a statement about everything searched, not about one docs page.
- **Consequences**:
  - Positive: Cline gets named, scoped roles with enforced read-only tools instead of a gap list; the package builds on a
    verified registry instead of re-deriving it; the guard plugin shrinks to the part that genuinely needs code.
  - Negative: two earlier ADRs of this phase carried a wrong claim for hours and a decision was taken partly on it (the first
    version of the grill answers); this ADR and the status lines on 0026 and 0027 are the correction, not a rewrite.
  - Open: parallel delegation to several `subagent_*` tools; the effect of `modelId`, `providerId` and `skills:`; the IDE
    extensions' behaviour for all of the above; whether the lead agent can be file-defined; whether a plugin hook sees a
    subagent's calls; which file the CLI reads for MCP servers (ADR 0013 decision 7 found `.cline/mcp.json` documented but
    absent from the 3.0.61 binary); whether `.agents/plugins/` Agent Plugins load skills on 3.0.68 (the 3.0.62 notes say
    they do; a probe could not reproduce it).

## Addendum (2026-10-02, profile and tool-policy slice)

Decision 4's open check is settled by a probe (`host-library/cline/observations/2026-10-02-cli-3.0.68.md`, "Guard hook and
subagents"): a plugin `beforeTool` hook **does see a subagent's tool calls**, and a block ends only that subagent's run, with
the lead continuing and receiving the error, whereas for the main agent it ends the whole run. So the single guard plugin covers
every agent that holds `run_commands`. Still open: whether a hook can tell which agent made a call, and whether a refusal the
model can recover from is possible.

## Addendum (2026-10-02, native agents and guard plugin slice)

The four specialists now exist as `registry/hosts/cline/agents/*.yml` and the guard as `registry/hosts/cline/plugins/agents-united-guard.js`,
and were exercised in real sessions (see the observations, "Hook context, and the shipped agents and guard in real sessions"): the
reviewer cannot write, a writer works, and the guard blocks a forced push and a `.env` write for the lead and for a subagent while the
lead continues. Two more open items are settled. **A hook can tell the lead from a subagent** (`snapshot.agentId` differs), though the id
carries no role name. **The tool name is `toolCall.toolName`**, not the docs' `toolCall.name`. One operational constraint follows for the
orchestrator: it must name the `subagent_<name>` tool when it delegates, because told only a role name the lead model may reach for
`team_run_task`. Still open: parallel delegation, the `modelId`, `providerId` and `skills:` keys, the IDE, a file-defined lead, the MCP file,
`apply_patch` input shape.


## Addendum (2026-10-02, orchestrator rule and skill slice)

Decision 6 is realised as a rule and a skill (`registry/hosts/cline/rules/`, `registry/hosts/cline/skills/orchestrator-engineering/`), and a real session confirmed that naming the `subagent_<name>` tools makes the lead delegate to them instead of reaching for `team_run_task`. **Parallel delegation is settled for 3.0.68:** two `subagent_*` calls in one turn ran concurrently. Still open: how reliably a lead discloses a missing specialist (it did not in the last run), the results on other models than the free default used here, the `modelId`, `providerId` and `skills:` keys, the IDE, a file-defined lead, the MCP file, `apply_patch` input shape.
