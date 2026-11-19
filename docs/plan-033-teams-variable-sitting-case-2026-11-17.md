# Plan 033, a sitting case for the agent-teams variable (prepared 2026-11-17)

This is one short interactive case the maintainer can sit himself. It was prepared on 2026-11-17 and sat by him on 2026-11-19: arm A printed `TEAMS=[0] FORK=[]`, arm B `TEAMS=[1] FORK=[]`, as expected; the result is recorded in [the observation of that day](../host-library/claude/observations/2026-11-19-claude-2.1.328-guards-interactive-by-the-maintainer.md). It was written by the lead of the session that started on 2026-11-17 after the merge of pull request 219 (an AI session), because that lead had told the maintainer to clear `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` before starting the factory coordinator and could not justify the advice.

## Why the case exists

- [The handoff of 2026-11-17](plan-033-handoff-2026-11-17.md) says: "The launcher refuses while `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set; clear it for that process." That sentence is out of date. Since [P17](plan-033-p17-verification-2026-11-16.md) the launcher does not refuse: it turns agent teams off for the factory's own session (`src/core/claude-launcher.ts`, the comment "An inherited CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS no longer refuses the plan").
- Checked by the lead on 2026-11-17 at `a8e535b`, once: the entry dry run with the variable set to `1` in the calling shell exited 0 and printed `Agent teams (--teams): no (turned off for this session by the launcher ...)`. A dry run starts no session, so it does not show what a session sees.
- Already shown once on the Host, in sessions sat by an earlier lead through a terminal bridge: Step 0 printed `TEAMS=[0]` on this machine, whose user settings export the variable as `1` ([the interactive stage proof](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-stage-proof-interactive.md), [the fork-mode re-sitting](../host-library/claude/observations/2026-11-16-claude-2.1.325-factory-fork-mode-resit.md)).
- Not shown so far: the same with a human typing; the same with the variable set to `1` in the shell that starts the launcher; and the comparison arm, a session started without the launcher. Without the comparison arm a `TEAMS=[0]` line does not show that the launcher is the cause.

## What the case decides

| Arm | How the session is started | Expected Step 0 line | What it means |
| --- | --- | --- | --- |
| A | through the launcher, with the variable set to `1` in the shell | `TEAMS=[0]` | Clearing the variable before the start is not needed. |
| B | directly with `claude --agent`, same shell | `TEAMS=[1]` | The `0` of arm A is the launcher's doing; a direct start does not get the switch. |

- Arm A prints `TEAMS=[1]` or `TEAMS=[]`: the launcher's switch did not reach the session. That is a defect; stop and report it.
- Arm B prints `TEAMS=[0]`: something else on the machine turns agent teams off, so arm A proves nothing about the launcher. Report it.
- The `FORK=[...]` part of the line is written down and is not a pass or a failure.

## How to sit it (PowerShell)

Each arm is one prompt in one new interactive session on the maintainer's subscription. An interactive session has no budget cap.

Correction, 2026-11-19: as first written, the preparation pointed at the checkout the factory had been installed into on 2026-11-17, and arm A started it with that checkout's own `dist\cli.js`. By 2026-11-19 that checkout had been rebuilt from a later `dev`, and the maintainer's first attempt at arm A was refused by the launcher: "Claude factory startup: critical guard bytes differ .claude/hooks/agents-united-guard.js. Run 'agents update agent-factory --fanout claude --native' in this workspace." The refusal is the launcher's check doing its work: the installed guard script was older than the build that started it. The case now uses a workspace installed from the same build that starts it. `<workspace>` is a new git folder with `node <built dev checkout>\dist\cli.js add agent-factory -t claude --native --allow-under-construction --copy -y`.

Preparation, once:

```powershell
cd <workspace>
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"
```

Arm A:

```powershell
node <built dev checkout>\dist\cli.js start agent-factory --host claude
```

Arm B (after arm A is closed):

```powershell
claude --agent orchestrator-agent-factory
```

In each session:

1. If Claude asks whether you trust the folder, answer yes.
2. The coordinator may greet you or ask for a task. Do not answer it. Paste this as your first and only message:

   ```text
   Run exactly one command with your shell tool and report the tool result word for word. If your shell tool is Bash, run: echo "TEAMS=[$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS] FORK=[$CLAUDE_CODE_FORK_SUBAGENT]" If it is PowerShell, run: Write-Output "TEAMS=[$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS] FORK=[$env:CLAUDE_CODE_FORK_SUBAGENT]"
   ```

3. If Claude asks for permission to run the command, allow it once.
4. If it asks anything else, answer "No, only that one command." and do not paste the message again.
5. Copy the printed line exactly, then type `/exit`.

Afterwards the variable goes away with the PowerShell window, or with:

```powershell
Remove-Item Env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
```

## What to send back

- The Step 0 line of arm A and of arm B, copied exactly.
- For each arm, yes or no: did Claude call a tool before it answered?
- The Claude Code version (`claude --version`).

The record of the sitting then says that the maintainer sat it, that each arm was shown once on one machine and one Host version, and that managed settings were not tested.
