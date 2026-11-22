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
2. (C) The wording is a generated block from one module in `src/core` (`native-requests.ts`), with one repository rule, the one call that applies the rule in the factory check, and the generator call; no other source change. It is not a core invariant: the cores are host-neutral and tool-free (ADR 0021) and the loss is this Host's. A host-neutral invariant is left for a later decision.
3. (C) At most three request rounds per specialist per accepted piece of work. Methods that work in turns with the user are exempt while the user keeps answering.
4. (C) Consent: a schedule always; a server call that spends money or needs a credential or changes anything outside the machine; explicit approval for a command that changes anything outside the machine (a read that only fetches is not one). A command the lead's own guard blocks is declined, never reworded.
5. (C) No new `Workflow` grant: the lead's block states both paths (run the saved workflow, or load the Skill and do its steps with its own `Agent` calls). The security lead gains `Workflow` with its application-security Bundle, decided elsewhere.
6. The factory's three fixed-job roles (`factory-realizer`, `factory-evaluator`, `factory-sync`) and `orchestrator-agent-factory` are outside the protocol: they are fixed-job roles with their own hand-back contract. `orchestrator-universal` is outside it as well: a front door that holds no `Agent` tool and has no specialist, it routes and instructs (ADR 0010).
7. There are seven entry types, a closed list: `ask-user`, `run-command`, `watch`, `schedule`, `run-workflow`, `delegate`, `use-server`.
8. A read-only role's request that would change files or anything outside the machine is declined as that role's request. The lead may delegate the change to an editing specialist as its own decision inside the accepted plan, and says so in the answer.
9. One headless check on `orchestrator-research`, and, as a second, separate observation, one live interactive sitting on the same lead (an AI session through its terminal bridge, three prompts, `host-library/claude/observations/2026-11-22-claude-2.1.330-capability-requests-live.md`). The `Workflow` path on `orchestrator-engineering` is not shown.
10. (C) `socratic-mentor` may run past three turns while the engineer answers, with "stop here and summarise" offered on every turn.
11. The line of open types in a specialist's block is computed from the role's own `tools:` line, so it is true by construction and a new role gets it by regenerating.
12. The result goes back to the same specialist with `SendMessage`. A second launch happens only when the host refuses the continuation. Prior art: ADR 0054, ADR 0055, the digital-agency lead's sentence, and `host-library/claude/observations/2026-10-19-claude-2.1.301-worker-lifecycle-live.md` (three continuations answered "Resuming agent" with the specialist's earlier context, seen once on Claude Code 2.1.301).
13. A role that a user's own session runs as its main agent has no lead; its block tells it to ask the user in plain prose.
14. When the lead's session has no `AskUserQuestion` (a lead that runs as a subagent, or a session with no user at the terminal, seen once headless), the question goes to the user in plain prose.
15. Entry numbers are never reused within one piece of work.

Two shared sentences are corrected with this change, in the roles that carried them (50 and 57 of the 75 native role files), because it already rewrites the shared wording. They came from a review of the shared wording of the native roles by an agent on another host (Codex). First, a role returned its report "as your final message through `SubagentHandback`" without condition; the host supplies that tool only to a subagent in auto mode (`host-library/claude/pages/tools/tools-reference.md`), so the sentence now reads: "Deliver it through `SubagentHandback` only where the host supplies that tool; where it does not, your ordinary final response is the hand-back." Second, a role said that as a teammate its guard "comes from the project's settings"; the settings-level session guard is optional at install, and the hooks of a role file run only when the host runs them (a headless run does not, ADR 0042), so the role keeps the rules itself and the sentence now reads: "As a subagent it comes from this file, when the host runs this file's hooks. As a teammate it comes from the settings-level session guard, which is optional and may be off. You cannot verify from inside that a guard is active, so keep its rules as your own obligation in either case."

## Consequences

- Every lead holds the tools its block names (`AskUserQuestion`, `Bash`, `PowerShell`, `Monitor`, `TaskStop`, `CronCreate`, `ScheduleWakeup`, `Agent`, `SendMessage`, `Skill`, `ToolSearch`); a test checks it.
- The block is long and is in every non-exempt role.
- A repository rule refuses a non-exempt role without the current block, and an exempt role that carries the markers. `factory-check` applies the same rule to a candidate.
- A live sitting showed once, on Claude Code 2.1.330 and one lead, the question dialog (an `ask-user` entry put as an `AskUserQuestion` with three options, answered, and returned to the same agent), a `run-command` round (run by the lead, output returned, section written from it) and a declined `schedule` entry (a consent dialog before any schedule tool call, the answer "Don't schedule", zero `CronCreate` and `ScheduleWakeup` calls); it is recorded in `host-library/claude/observations/2026-11-22-claude-2.1.330-capability-requests-live.md`. Still not shown: team mode, a lead that runs as a subagent, a Host permission prompt, a role's own guard acting, watching and schedules over time, the types `watch`, `run-workflow`, `delegate` and `use-server`, a refused continuation, and the `Workflow` path. The lead's own briefs named the section and the entry types, so the sitting does not separate the effect of the role text from the effect of the briefs.
- Bundles that land later regenerate the block and align their own role sentences.
- One headless loop on the real host (a mentor's `ask-user` entries answered and returned to the same mentor under `Turn 2`, a specialist's `run-command` run and returned to the same specialist) is recorded in `host-library/claude/observations/2026-11-22-claude-2.1.330-capability-requests-headless.md`; it proves no rate.
- Other Hosts are unchanged.
- Open follow-ups from the live sitting, each seen once and not changed here: the lead's declined line read "R4: declined. The user chose not to schedule anything.", which names who but gives no reason and not the form `declined (who, why)`.
- After the declined schedule the lead wrote a file itself (`docs/research/node-sqlite-recheck.md`, the specialist's run prompt for a manual re-check), a step the block does not mention.
- Request numbers ran on from R1 to R4 across three prompts to one specialist, and the block does not say whether a new prompt is a new piece of work, so four rounds in one session cannot be judged against "at most three".
- The specialist's `schedule` entry lacked the lines "If declined or unanswered" and "With the result I will", and the lead's dialog reworded the specialist's options (labels, descriptions, a header added) where the block says "unchanged".
- Open follow-ups, not changed here: the README sentence that the role guard "always runs while an Agents United role is active"; the peers-section wording "`Open items` (unanswered questions, missing peer input and blockers ...)", which still reads wider than the block; the Boundaries line "A hand-off goes back to the agent that spawned you; in a team the host delivers your final answer to the lead when you go idle", which does not cover a fork or a background subagent that outlives its caller; and the five tails that follow the guard-source sentence.
