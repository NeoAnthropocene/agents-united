---
name: mutation-testing
description: Configures and runs mutation-testing campaigns with mewt or
  muton, analyses surviving mutants (testing gap or equivalent mutant), and
  turns survivors into new tests or real bug reports. Use when setting up,
  scoping or speeding up a mutation campaign, reviewing its results, or
  hunting bugs in code the tests never really checked; not for plain line
  coverage questions.
metadata:
  author: Trail of Bits / agents-united
  version: 1.0.0
  source: https://github.com/trailofbits/skills/tree/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/mutation-testing
  commit: 0cc1c73a5e96749ab32d7ea5e14892fafa6972ae
  license: CC-BY-SA-4.0
  icon: 🧟
disable-slash-command: true
---

# Mutation Testing

## Overview & Purpose
Line coverage says code ran; mutation testing says the tests would notice if it were
wrong. This skill routes a mutation task to the right workflow (configure, hunt bugs,
or write a formal analysis) with Trail of Bits' `mewt` (or its twin `muton`), and
explains what each surviving mutant means.

Adapted from Trail of Bits' `mutation-testing` skill. This folder is released under
**CC-BY-SA-4.0**, not the repository's MIT licence (see `LICENSE`, `NOTICE.md`).
Boundaries: `property-based-testing` strengthens the tests that kill survivors;
`test-driven-development` is the loop new tests follow; results from other tools
(slither-mutate, mull, dextool) are covered in
[references/input-formats.md](references/input-formats.md).

## Execution Triggers & Prerequisites
### Execution Triggers
- "Set up mutation testing", "why is this campaign so slow", "analyse these
  survivors", "find bugs from mutation results", or any mention of mewt/muton.

### Prerequisites
- `mewt --version` (or `muton`). `mewt --help` and `mewt <cmd> --help` are the source
  of truth for flags; examples here follow the 4.x interface.
- A test command that passes on the unmutated code.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Target paths | globs | Yes | Code to mutate |
| Test command | shell | Yes | Must pass before the campaign |
| Existing results | `mewt.sqlite` / JSON | No | For analysis only |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Config | `mewt.toml` | Targets, test command, timeouts |
| Analysis | Markdown ([references/report-template.md](references/report-template.md)) | Kill rate, survivors by severity, equivalent mutants |
| New tests / bug reports | Test files, issues | One per real gap |

## Step-by-Step Execution Runbook

### Phase 1 — Pick the workflow
1. Setting up, scoping or speeding up: [references/workflow-configuration.md](references/workflow-configuration.md),
   plus [references/optimization-strategies.md](references/optimization-strategies.md)
   when the estimate is long.
2. Hunting bugs after a campaign: [references/workflow-bug-hunter.md](references/workflow-bug-hunter.md).
3. Formal analysis: [references/workflow-analyzing-results.md](references/workflow-analyzing-results.md)
   with [references/equivalent-mutants.md](references/equivalent-mutants.md) and
   [references/severity-classification.md](references/severity-classification.md);
   add [references/blockchain-patterns.md](references/blockchain-patterns.md) only for
   Solidity, Move, FunC/Tolk, Cairo or Solana Rust.

### Phase 2 — Run
1. `mewt init`, edit `mewt.toml`, `mewt print targets` to confirm scope, `mewt run`.

### Phase 3 — Read the results
1. `mewt status`, then `mewt results --severity high,medium`.
2. For each uncaught mutant: `mewt print mutant --id <id>`; decide testing gap versus
   equivalent mutant; weigh what the code does, not only the mutant's severity.
3. Write the missing test (or the bug report), then `mewt test --ids <id>` to confirm
   it is now caught.

## Code & Config Exemplars

### Exemplar 1: Everyday commands
```bash
mewt init
mewt run 'src/auth/**'
mewt status
mewt results --severity high,medium --format table
mewt print mutant --id 412
mewt test --ids 412
```

### Exemplar 2: What a survivor means
| Severity | Example slugs | Meaning |
|---|---|---|
| High | `ER` | Tests tolerate an injected error |
| Medium | `CR`, `IF`/`IT`, `NR` | Removing a statement or flipping a condition goes unnoticed |
| Low | operator shuffles, `BL`, `AS` | Check boundaries and arithmetic assertions |

## Edge Cases & Error Recovery

### Scenario A: Campaign estimate is hours long
1. **Recovery Protocol**: Narrow targets, use faster test subsets per file, and apply
   the strategies in `optimization-strategies.md` before running.

### Scenario B: Many timeouts
1. **Diagnosis**: Timeouts are inconclusive, not kills.
2. **Recovery Protocol**: Raise the timeout or split slow tests; never count them as coverage.

### Scenario C: Survivor looks equivalent
1. **Recovery Protocol**: Prove equivalence with the procedure in
   `equivalent-mutants.md`; if unsure, treat it as a gap.

## Verification Checklist
- [ ] The unmutated test command passed before the campaign.
- [ ] `mewt print targets` matched the intended scope.
- [ ] Every high/medium survivor is classified (gap, equivalent, or bug).
- [ ] New tests were confirmed to kill their mutants with `mewt test --ids`.
- [ ] Timeouts are reported separately from kills.

Full upstream method text: [references/upstream-method.md](references/upstream-method.md).
