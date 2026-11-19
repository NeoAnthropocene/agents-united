# ADR 0073: A System Specs Sheet gives orchestrators and specialists the machine facts, collected once

- **Status:** Accepted by the maintainer, 2026-11-19, in the points listed as his below; the other design points were decided by the orchestrating AI session and are his to overturn in review.
- **Planned at:** `574fdde` (the base of the branch `feat/system-specs-sheet`). ADR numbers through 0070 were seen on `origin/dev`. 0071 and 0072 are claimed by other local branches (the factory worker) and must be checked on `origin/dev` at merge.
- **Written and reviewed by:** AI sessions (a worker and its orchestrating session), on the maintainer's decisions. The Skill went through three independent static review rounds; the wiring into the lead had a fourth read. No live session has run it.

## Context

No orchestrator of this repository knew the machine it ran on. A plan that picked a runtime, a container tool, a build parallelism or a download size guessed, or probed one tool at a time, differently in every session, and a specialist could not tell a missing tool from a tool nobody had looked for. Facts about the machine are not facts about the project, and they carry private values (the user name, the machine name, the home folder, environment values) that must never reach a brief, a report or a repository.

The findings that shaped the Skill, from the review rounds: a timed-out probe must end its whole process tree; a system tool must be started by an absolute path and never by a bare name that the working folder could shadow; a sheet found in a folder is untrusted input (a repository can ship one); a version call can download (Corepack shims), so the probes run with the network switched off for them; a tool that is found but fails is not the same as one that is not found; and a short account name inside an ordinary word cannot be removed without damaging real OS names.

## Decision

**The maintainer's decisions**, with his words:

1. **The goal and the pilot.** A system specs sheet for subagents and orchestration agents "to see the whole picture about the user machine that runs the host", starting "from the pilot Claude host; digital-agency bundle", and then the rest of the Bundles "for the pilot and host native core contracts".
2. **Collection is automatic at the lead's Step 0, with the fixed probe list.** His answer was "Automatic at Step 0"; the option he chose named the fixed list, and he was asked about depth only through that option.
3. **Collect once; a specialist checks; a specialist asks the lead for an update.** In his words: "It may only require for the planning phase, so collect it once, and check if environment changed when a subagent need it. Also subagentd should be able to request an update from the orchestrator if they understand the development environment has been changed."
4. **"Yes, as described"**, confirming this reading of point 3: the lead collects once at planning; a specialist runs a check that starts no tool and, on a change, asks the lead for an update instead of refreshing the sheet itself.

**Decided by the orchestrating AI session** (each is the session's design, open to his review):

5. **A shared Skill with one script, not a hook and not a CLI command.** `system-specs` (ADR 0069: written once, host-neutral) holds `scripts/specs.mjs` (Node 20+, built-ins only), a format reference, a worked example and evals, with two commands: `collect` and `check`.
6. **An allowlist and a privacy rule.** The sheet holds OS, CPU, memory, GPU, free disk, shells and a fixed table of developer tools, each probed by one version call. It never holds the user name, the machine name, the home folder or an absolute path, environment values, git remotes, or any account or credential state. The reference lists what the scrub covers and what it does not.
7. **A fingerprint, exact-match reuse and a PATH rule.** `collect` reuses the sheet whatever its age when a fingerprint stored as hashes only is identical, or differs only in the PATH entries (the fingerprint holds, per probed tool and shell, found or not and file size and modification time, and also the PATH entries, OS release, architecture and memory). Any other difference, an invalid or foreign sheet, collects again and names the parts that differed. A sheet with a higher schema number than the script's is never overwritten: exit 2. There is no age limit.
8. **`check`.** A read-only test that starts no process and compares the current fingerprint with the stored one: `unchanged` (0), `changed: <names>` (3), no usable sheet or another format (1). It states its blind spots: an in-place update with the same size and time; a shim manager (pyenv, volta, asdf, rustup, corepack); WSL, the GPU, the macOS developer-tools state; the CPU, GPU and OS text.
9. **Who refreshes.** Only the coordinating agent, or an agent working alone, runs `collect --refresh`, then tells the specialists that depend on the sheet. A specialist reports a change and asks, once, and never refreshes the sheet itself.
10. **Delivery by the brief.** The lead's Step 0 gains one point (load the Skill, run `collect` once from the project folder with the shell it holds, say in one line what was collected and where the sheet is, plan with it, refresh only on request); the brief template gains a `Specs:` line with the path, the load-the-Skill-then-`check` instruction and the rule. The sheet is not a deliverable, so it is also collected in plan-only mode. A collector failure (exit 1 or 2, no Node) never blocks the work: the lead says so once and plans without the sheet. The point runs after the install-record read and so after the mode line; the mode-line hook holds every other call until the line is saved, and fails open (ADR 0044).
11. **No core change in the pilot.** The pilot lives in the Claude-native lead only. The lead's core is unchanged, so its Cline and Antigravity lanes keep their text unchanged. A host-neutral core clause for every orchestrator comes with the roll-out to the other Bundles and Hosts, as its own decision.

## Consequences

- Every brief of the pilot lead names the sheet. Some specialists hold no shell and so cannot run `check`: they rely on the sheet as given and report differences they observe.
- The Skill is installed with the Bundle on every Host, but only the Claude-native lead uses it. That `${CLAUDE_SKILL_DIR}` resolves on the Cline and Antigravity Hosts is not verified.
- Limits, stated plainly: the blind spots of `check` above; not verified on macOS or Linux (fake-runner tests only; the POSIX dangling-link test runs for the first time on Linux CI); Corepack's network switch rests on its documentation and was not run live; a short or stoplisted account name inside plain text is not removed; the evals were not run through a model.
- Hooks (a start-up collection, or a check before a specialist's first shell call) are a possible later layer; this decision adds none.
- No live session has run the pilot text. Until one does, "the lead collects at Step 0 and the specialists check" is a described behaviour, not an observed one.
