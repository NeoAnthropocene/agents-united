---
name: property-based-testing
description: Writes, reviews and debugs property-based tests - Hypothesis,
  fast-check, proptest, jqwik, rapid, and Echidna or Medusa for Solidity
  invariants. Use when tests should cover a whole input domain rather than
  hand-picked examples (round-trips, parsers, normalisers, validators,
  comparators, data structures, contract invariants), when judging whether
  existing property tests assert anything, or when a shrunk counterexample
  needs interpreting.
metadata:
  author: Trail of Bits / agents-united
  version: 1.0.0
  source: https://github.com/trailofbits/skills/tree/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/property-based-testing
  commit: 0cc1c73a5e96749ab32d7ea5e14892fafa6972ae
  license: CC-BY-SA-4.0
  icon: 🎲
disable-slash-command: true
---

# Property-Based Testing

## Overview & Purpose
An example test asserts one point; a property asserts a rule over the whole input
domain and lets a generator hunt for the counterexample. Worth it when the code has an
algebraic shape (an inverse, an invariant, an oracle) and not otherwise; "this is a
poor PBT candidate" is a valid outcome.

Adapted from Trail of Bits' `property-based-testing` skill. This folder is released
under **CC-BY-SA-4.0**, not the repository's MIT licence (see `LICENSE`, `NOTICE.md`).
Boundaries: `test-driven-development` is the red-green loop this plugs into;
`mutation-testing` measures whether a suite catches changes; coverage-guided fuzzing
(libFuzzer, AFL) and end-to-end UI tests (`playwright-best-practices`) are out of scope.

## Execution Triggers & Prerequisites
### Execution Triggers
- Serialisation pairs, parsers, canonicalisers, numeric types, sort/comparators, data
  structures, or smart-contract state that need domain-wide coverage.
- Reviewing existing `@given` / fast-check / proptest suites, or a shrunk failure.

### Prerequisites
- The project's test runner. A PBT library already present, or the user's agreement
  to add one (adding a dependency is their call; offer once with the property in hand).

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Code under test | path/symbol | Yes | Function or module |
| Existing tests | paths | No | For review or extension |
| Failing seed/output | text | No | When interpreting a failure |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Property tests | Test files in the project's layout | Strongest property the code supports |
| Review notes | Handoff report | Tautologies, vacuous `assume()`s, weak generators |

## Step-by-Step Execution Runbook

### Phase 1 — Find the property
1. Match the code to the catalogue below and pick the strongest property it supports:
   no crash < type preservation < invariant < idempotence < round-trip / oracle.
2. If none fits, check whether the shape is buried behind I/O or mutation
   ([references/refactoring.md](references/refactoring.md)) before concluding.

### Phase 2 — Generate inputs
1. Build strategies that produce valid inputs directly; push constraints into the
   generator instead of `assume()` ([references/generating.md](references/generating.md)).
2. Choose the library from [references/libraries.md](references/libraries.md).

### Phase 3 — Guard against empty assertions
1. Tautology: the assertion must not restate the implementation.
2. Vacuity: an `assume()` that rejects nearly everything runs nothing.

### Phase 4 — Review or interpret
1. Reviewing: [references/reviewing.md](references/reviewing.md).
2. A failure: decide wrong property versus real bug from the shrunk counterexample
   ([references/interpreting-failures.md](references/interpreting-failures.md)); pin
   the counterexample as a regular example test once fixed.

## Code & Config Exemplars

### Exemplar 1: Property catalogue
| Property | Formula | Where |
|---|---|---|
| Round-trip | `decode(encode(x)) == x` | Serialisation |
| Oracle | `new(x) == reference(x)` | Optimisations, rewrites |
| Idempotence | `f(f(x)) == f(x)` | Normalisers, formatters |
| Invariant | holds before and after | Transformations, contract state |
| Easy to verify | `is_sorted(sort(x))` | Algorithms with cheap checkers |

### Exemplar 2: Hypothesis round-trip
```python
from hypothesis import given, strategies as st

@given(st.dictionaries(st.text(), st.integers()))
def test_roundtrip(d):
    assert decode(encode(d)) == d
```

## Edge Cases & Error Recovery

### Scenario A: Only "does not crash" is available
1. **Recovery Protocol**: Try a small refactor to expose a stronger property; if none,
   say the code is a poor PBT candidate and write example tests.

### Scenario B: Flaky property test
1. **Diagnosis**: Non-determinism (clock, dict order, randomness) in the code or the test.
2. **Recovery Protocol**: Fix the seed or the source of non-determinism; a genuine
   determinism property `f(x) == f(x)` is fine for impure-looking code.

## Verification Checklist
- [ ] The asserted property is the strongest the code supports.
- [ ] No tautological assertion; no vacuous `assume()`.
- [ ] Generators produce valid inputs directly.
- [ ] Any new PBT dependency was agreed with the user.
- [ ] Shrunk counterexamples from fixed bugs are pinned as example tests.

Full upstream method text: [references/upstream-method.md](references/upstream-method.md).
