---
name: terraform-test-patterns
description: Writing and running Terraform's native tests (`terraform test`,
  `.tftest.hcl` run blocks, assertions, `expect_failures`, mock providers)
  for modules and root configurations. Use when creating or reviewing test
  files, choosing plan-mode unit tests versus apply-mode integration tests,
  mocking providers, or wiring Terraform tests into CI.
metadata:
  author: HashiCorp / agents-united
  version: 2.0.0
  source: https://github.com/hashicorp/agent-skills/tree/516354c484b43fa5469567485113dd0c769c3d24/plugins/terraform/skills/terraform-test
  commit: 516354c484b43fa5469567485113dd0c769c3d24
  license: MPL-2.0
  icon: 🧪
disable-slash-command: true
---

# Terraform Test Patterns

## Overview & Purpose
Terraform's built-in test framework runs `run` blocks against a module and checks
`assert` conditions, either at plan time (fast, no resources) or at apply time (real
resources, destroyed afterwards in reverse order). This skill is the runbook for
laying out, writing and running those tests; the full syntax reference lives in
[references/test-syntax.md](references/test-syntax.md).

Adapted from HashiCorp's MPL-2.0 `terraform-test` skill; this folder stays under
MPL-2.0 (see `LICENSE` and `NOTICE.md`). Boundaries: `test-driven-development` is the
general red-green discipline this applies; `terraform-style-guide` covers how the code
under test is written; `azure-infrastructure-bicep` is the Bicep path.

## Execution Triggers & Prerequisites
### Execution Triggers
- Creating or reviewing `*.tftest.hcl` / `*.tftest.json` files.
- A module change that needs unit (plan) or integration (apply) coverage.
- Adding Terraform tests to a CI pipeline, or debugging a failing `terraform test`.

### Prerequisites
- Terraform 1.6+ for `terraform test`; 1.7+ for mock providers; 1.9+ for
  `parallel` and `state_key`. Check `terraform version` first.
- Credentials only for apply-mode tests; plan-mode tests with mocks need none.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Module path | path | Yes | Module or root config under test |
| Behaviour to pin | text | Yes | Defaults, validation rules, outputs, conditional resources |
| Terraform version | semver | Yes | Gates mocks, `parallel`, `state_key` |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Unit tests | `tests/*_unit_test.tftest.hcl` | `command = plan`, mocks where providers need credentials |
| Integration tests | `tests/*_integration_test.tftest.hcl` | `command = apply`, real resources |
| CI job | Workflow file | Unit on every PR, integration on merge ([references/ci-cd.md](references/ci-cd.md)) |

## Step-by-Step Execution Runbook

### Phase 1 — Lay out the suite
1. Put tests in `tests/` beside the module. Name plan-mode files
   `*_unit_test.tftest.hcl` and apply-mode files `*_integration_test.tftest.hcl` so CI
   can filter them.
2. Default to `command = plan`. Use apply only when the behaviour depends on values
   known after apply.

### Phase 2 — Write the red test first
1. One `run` block per scenario, named for the behaviour ("rejects_unknown_env").
2. Assert on outputs, counts, tags and conditional resources; use `expect_failures`
   to prove validation rules reject bad input.
3. Run it and see it fail for the expected reason before changing the module.

### Phase 3 — Mock what needs credentials
1. For unit tests on Terraform 1.7+, use `mock_provider` and `override_*` blocks
   ([references/mock-providers.md](references/mock-providers.md)).
2. Below 1.7, keep those scenarios in integration tests instead.

### Phase 4 — Run and wire into CI
1. `terraform init` then `terraform test` (use `-filter`, `-verbose`, `-no-cleanup`
   while debugging).
2. Add the CI job: unit tests on each PR, integration tests on merge to the main
   branch, with cloud credentials scoped to a sandbox account.

## Code & Config Exemplars

### Exemplar 1: Plan-mode unit test with a negative case
```hcl
run "defaults_to_small_instance" {
  command = plan
  assert {
    condition     = aws_instance.app.instance_type == "t3.micro"
    error_message = "Default instance type should be t3.micro"
  }
}

run "rejects_unknown_environment" {
  command = plan
  variables { environment = "qa-west" }
  expect_failures = [var.environment]
}
```

### Exemplar 2: Commands
```bash
terraform test                                  # everything
terraform test -filter=tests/network_unit_test.tftest.hcl
terraform test -verbose -no-cleanup             # debugging an apply-mode failure
```

A complete unit/integration/mock suite for a VPC module is in
[references/examples.md](references/examples.md).

## Edge Cases & Error Recovery

### Scenario A: Module source is git or HTTP
1. **Diagnosis**: `module { source = ... }` in a test only accepts local or registry sources.
2. **Recovery Protocol**: Test a local copy or the registry version instead.

### Scenario B: Integration test left resources behind
1. **Diagnosis**: A run failed mid-apply or `-no-cleanup` was used.
2. **Recovery Protocol**: Re-run with cleanup, or destroy from the test's state; order
   run blocks so dependants are created last (they are destroyed first).

### Scenario C: Tests interfere with each other
1. **Recovery Protocol**: Give independent runs separate `state_key`s before enabling
   `parallel = true`.

## Verification Checklist
- [ ] Every new variable validation has an `expect_failures` test.
- [ ] Unit tests use `command = plan` and run without cloud credentials.
- [ ] Error messages say what was expected, so a failure is diagnosable from CI logs.
- [ ] Integration tests clean up (no `-no-cleanup` in CI).
- [ ] CI runs unit tests on PRs and integration tests on merge.
