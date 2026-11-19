---
name: system-specs
description: "Use when a plan depends on the machine it will run on: which OS and shell, how much memory, CPU or GPU, free disk, or whether a tool (node, python, git, docker, a cloud CLI) is installed and at what version. Trigger phrases: system specs, what machine is this, what is installed, can this machine run it, check my tools, hardware limits. Skip it when the question is about the project's own code or settings, when a sheet younger than a day already exists and nothing changed, and inside a task that never needs the machine."
metadata:
  author: agents-united
  version: 1.0.0
  license: MIT
---

# System Specs

Read the machine once, in a small sheet, instead of guessing or probing tool by tool.

## Overview & Purpose
A script collects machine facts into a Markdown sheet and a JSON twin: OS, CPU, memory, GPU, free disk, shells and a fixed list of developer tools with their versions. The sheet is meant to be read by many agents, so it stays short. It describes the machine, never the project: a project's language, dependencies and settings are read from the project itself.

## Execution Triggers
Load it on the asks in the description; skip it on the skips there. Use it before a plan that picks a tool, a runtime, a model size, a build parallelism or a download size.

## Input/Output Requirements
Input: the working folder. Output: `.agents-united/system-specs.md` and `.json` beside it, relative to the working folder. Read `references/sheet-format.md` for every field, the privacy rule and the freshness rule. **Evidence to attach**: the collected-at time of the sheet you used, and which tools the plan relies on.

## Step-by-Step Runbook
1. **Look for a sheet** at `.agents-united/system-specs.md`. If it is younger than a day, read it and skip to step 3.
2. **Collect**: `node "${CLAUDE_SKILL_DIR}/scripts/specs.mjs" collect` (Node 20+). Add `--refresh` to force a new read, `--max-age <hours>` to change the reuse window, `--out <path>` to write elsewhere. `--json` prints the JSON and writes nothing. Exit 0: the sheet is written or reused. Exit 1: it could not be written; use `--json`. Exit 2: wrong arguments, read the message.
3. **Read the sheet**: a tool under "Absent" was not found on the path; a tool under "Not determined" timed out or could not be read. Treat both as not available for the plan, and never assume a version that the sheet does not show.
4. **Use the facts, state their limits.** Say which line a decision rests on. A missing tool is a finding to report or an install step to propose, never something to invent or silently work around.
5. **Hand over by reference.** Give other agents the path of the sheet and its collected-at time; do not paste it into every brief.

## Code & Config Exemplars
A plan that needs a container runtime reads the "Tools" list: docker and docker compose present with versions means the plan may use them; podman under "Absent" means a podman step is replaced or reported. A plan that downloads a 20 GiB model compares it with "Free disk" first.

`examples/worked-example.md` is a worked example: a plan checked against a sheet before it picks a container runtime and a download.

Anti-patterns, with reasons:
- Treating the sheet as project facts: it knows the machine, not the repository.
- Guessing a version for an absent tool: a wrong guess breaks a later step.
- Editing the sheet by hand: the next collect overwrites it.
- Pasting private values into a brief: the sheet holds none by design; keep it that way.
- Collecting again at every step: the sheet is good for a day; reuse it.

The sheet is local to the working folder. Commit it only if the project asks for that; it describes one machine.

## Edge Cases & Error Recovery
- **Exit 1**: the folder could not be written (read-only, or a file where a folder is needed). Run with `--json` and keep the output in the conversation instead.
- **Exit 2**: a wrong argument; the message names it. Nothing was collected.
- **A slow tool**: it is reported "not determined", not absent. Run again with `--refresh` before you treat it as missing.
- **A stale sheet after an install**: reuse hides the change. Run with `--refresh`.
- **A GPU line says "not determined"**: the model or VRAM could not be read without elevated rights; ask the user instead of guessing.

## Verification Checklist
- [ ] The sheet's collected-at time is stated with every decision that rests on it.
- [ ] Every tool the plan relies on is "present" with a version in the sheet; none is assumed.
- [ ] No private value (user name, machine name, home folder, absolute path) was added to a brief or a report.
- [ ] Absent and "not determined" tools are named as findings, with a next step.
