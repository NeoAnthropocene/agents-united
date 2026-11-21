# ADR 0076: A specialist's needs it cannot meet on this Host go through the lead, as requests in its report

- **Status:** Accepted. The decisions marked (C) were decided by the coordinating AI session on 2026-11-21 and are the maintainer's to overturn.
- **Date:** 2026-11-21

## Context

The maintainer, 2026-11-21: "When you removed the capabilities from subagents, you broke their working principles; you should found other ways to complete those capabilities, like hand-off the information to the orchestration agent which have capabilities (running workflows, AskUserQuestion, Monitor, TaskStop, etc)." He chose one cross-department pull request with identical wording everywhere.

What the files showed on 2026-11-21:

- Of the specialists then written, three lost the canonical `ask_question` (`socratic-mentor`, `business-panel-experts`, `design-researcher`), twelve lost `schedule`, and the two creative designers lost the shell.
- Watcher tools go only to roles with a shell. Only one lead holds `Workflow`.
- Each role said so in one sentence, in one of five wordings. Each lead said so in one or two. No lead said to return an answer or an output to the specialist that asked. Only the digital-agency lead said to continue a reported specialist with `SendMessage`, and only for a peer's question.
- `socratic-mentor` works in turns with the user and had no way to get the engineer's answers back.

## Decision

1. (C) The report section is named `Requests for the lead`. "Hand-off" is not used: it collides with the `handoff` Skill, the hand-back tool and the Motion event handoff.
2. (C) The wording is a generated block from one module in `src/core` (`native-requests.ts`), with one repository rule and the generator call; no other source change. It is not a core invariant: the cores are host-neutral and tool-free (ADR 0021) and the loss is this Host's. A host-neutral invariant is left for a later decision.
3. (C) At most three request rounds per specialist per accepted piece of work. Methods that work in turns with the user are exempt while the user keeps answering.
4. (C) Consent: a schedule always; a server call that spends money or needs a credential or changes anything outside the machine; explicit approval for a command that reaches outside the machine. A command the lead's own guard blocks is declined, never reworded.
5. (C) No new `Workflow` grant: the lead's block states both paths (run the saved workflow, or load the Skill and do its steps with its own `Agent` calls). The security lead gains `Workflow` with its application-security Bundle, decided elsewhere.
6. The factory's three fixed-job roles (`factory-realizer`, `factory-evaluator`, `factory-sync`) and `orchestrator-agent-factory` are outside the protocol: they are fixed-job roles with their own hand-back contract.
7. There are seven entry types, a closed list: `ask-user`, `run-command`, `watch`, `schedule`, `run-workflow`, `delegate`, `use-server`.
8. A read-only role's request that would change files or anything outside the machine is declined as that role's request. The lead may delegate the change to an editing specialist as its own decision inside the accepted plan, and says so in the answer.
9. One headless check on `orchestrator-research`. The `Workflow` path on `orchestrator-engineering` is not shown.
10. (C) `socratic-mentor` may run past three turns while the engineer answers, with "stop here and summarise" offered on every turn.
11. The line of open types in a specialist's block is computed from the role's own `tools:` line, so it is true by construction and a new role gets it by regenerating.
12. The result goes back to the same specialist with `SendMessage`. A second launch happens only when the host refuses the continuation. Prior art: ADR 0054, ADR 0055, the digital-agency lead's sentence, and `host-library/claude/observations/2026-10-19-claude-2.1.301-worker-lifecycle-live.md` (three continuations answered "Resuming agent" with the specialist's earlier context, seen once on Claude Code 2.1.301).
13. A role that a user's own session runs as its main agent has no lead; its block tells it to ask the user in plain prose.

## Consequences

- Every lead holds the tools its block names (`AskUserQuestion`, `Bash`, `PowerShell`, `Monitor`, `TaskStop`, `CronCreate`, `ScheduleWakeup`, `Agent`, `SendMessage`, `Skill`, `ToolSearch`); a test checks it.
- The block is long and is in every non-exempt role.
- A repository rule refuses a non-exempt role without the current block, and an exempt role that carries the markers. `factory-check` applies the same rule to a candidate.
- Not shown until a live sitting: the dialog, team mode, approval prompts, watching and schedules over time, and the `Workflow` path.
- Bundles that land later regenerate the block and align their own role sentences.
- Other Hosts are unchanged.
