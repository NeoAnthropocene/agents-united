# Templates

Copy a block, fill every line, leave none blank. A line you cannot fill is a finding: say what is missing and who can supply it.

## Bottleneck statement

```text
BOTTLENECK   <stage>: <conversion> over <date range>, <count in> to <count out>
BENCHMARK    <range> from <source and date>   (or: none found; say so)
NOT THE LEAK <the stages that are within range, so nobody spends there>
```

## Backlog row

```text
| <rank> | <experiment> | Because <evidence>, we believe <change> will move <metric> by <amount>, known within <days> when <metric> passes <threshold> | I | C | E | ICE |
```

Write the reason for each of I, C and E in the playbook beside the table, from the bands in [../references/ice-rubric.md](../references/ice-rubric.md).

## Experiment brief (the top three only)

```text
EXPERIMENT   <id> <name>
PRIMARY      <numerator> / <denominator> within <window>
GUARDRAIL    <metric> must not worsen by more than <x>
CONTROL      <what a visitor sees today>
VARIANT      <what a visitor sees in the test>
TRAFFIC      <visitors a week to the step>; <n> per arm in <days> days (checked with ab-test-setup)
RUN LENGTH   <days>, 14 at most
DECIDE       ship if <metric> reaches <x> and the guardrail holds; kill if the lower bound is below zero at the planned sample; otherwise iterate once
OWNERS       copy <Kaan>   build and event names <Deniz>   verify events <Emre>
```

## Experiment log entry (growth/experiment-log.md when the workspace has one, otherwise inside the playbook)

```text
EXP-<n> | <date> | <name>
Hypothesis: ... | Primary: ... | Guardrail: ...
Result: <from> to <to> percent, n = <per arm> | Decision: <ship | kill | iterate>, with the reason
Learning: <one sentence a later reader can act on>
```
