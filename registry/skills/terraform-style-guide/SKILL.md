---
name: terraform-style-guide
description: Writing and reviewing Terraform HCL to HashiCorp's style
  conventions - file layout, formatting, naming, variables and outputs,
  for_each over count, version pinning and secure defaults. Use when
  generating new Terraform, reviewing a Terraform change, or tidying an
  existing configuration before it grows.
metadata:
  author: HashiCorp / agents-united
  version: 1.0.0
  source: https://github.com/hashicorp/agent-skills/tree/516354c484b43fa5469567485113dd0c769c3d24/plugins/terraform/skills/terraform-style-guide
  commit: 516354c484b43fa5469567485113dd0c769c3d24
  license: MPL-2.0
  icon: 📐
disable-slash-command: true
---

# Terraform Style Guide

## Overview & Purpose
Keeps Terraform code consistent with HashiCorp's published style: a predictable file
layout, `terraform fmt` formatting, descriptive singular names, typed and validated
variables, described outputs, pinned versions and secure defaults. The detailed rules
and examples are in [references/style-conventions.md](references/style-conventions.md);
security defaults are in [references/security.md](references/security.md).

Adapted from HashiCorp's MPL-2.0 `terraform-style-guide` skill; this folder stays
under MPL-2.0 (see `LICENSE` and `NOTICE.md`). Boundaries: `terraform-test-patterns`
tests the code this skill shapes; `architecture-design` decides *what* infrastructure
to build; `azure-infrastructure-bicep` is the Bicep path.

## Execution Triggers & Prerequisites
### Execution Triggers
- Generating a new Terraform module or root configuration.
- Reviewing a Terraform diff, or a cloud architecture task whose deliverable is HCL.

### Prerequisites
- Terraform CLI for `fmt` and `validate`; `tflint` or `checkov`/`trivy` if the
  project already uses them.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| Configuration | path | Yes | Module or root directory |
| Provider(s) | list | Yes | Drives version constraints and provider blocks |
| Project conventions | file | No | An existing style or lint config wins over this guide |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Formatted HCL | `terraform.tf`, `providers.tf`, `main.tf`, `variables.tf`, `outputs.tf`, `locals.tf` | Standard layout |
| Review notes | Handoff report | Deviations found, grouped by the checklist below |

## Step-by-Step Execution Runbook

### Phase 1 — Structure
1. Put version constraints in `terraform.tf`, provider config in `providers.tf`,
   resources and data sources in `main.tf`, and keep variables and outputs in their
   own files, sorted alphabetically.
2. Generate in dependency order: providers, data sources, resources, outputs.

### Phase 2 — Write to the conventions
1. Two-space indentation, aligned `=` for consecutive arguments; meta-arguments first,
   then arguments, then nested blocks, `lifecycle` last.
2. Lowercase snake_case, singular, descriptive names without the resource type; `main`
   when there is only one of something.
3. Every variable has `type` and `description`, plus `validation` where input is
   constrained; mark secrets `sensitive = true`. Every output has a `description`.
4. Prefer `for_each` for multiple named instances; use `count` only for on/off.
5. Pin `required_version` and provider versions with `~>`.

### Phase 3 — Secure defaults
1. Apply [references/security.md](references/security.md): encryption at rest,
   no public access by default, no secrets in state (use ephemeral resources or
   write-only arguments where the provider supports them).

### Phase 4 — Validate
1. `terraform fmt -recursive` and `terraform validate`; run the project's linters.

## Code & Config Exemplars

### Exemplar 1: A validated variable and a described output
```hcl
variable "environment" {
  description = "Target deployment environment"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.main.id
}
```

### Exemplar 2: for_each over count
```hcl
resource "aws_subnet" "private" {
  for_each          = var.private_subnets # map of name => cidr
  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value
  tags              = merge(local.common_tags, { Name = each.key })
}
```

## Edge Cases & Error Recovery

### Scenario A: The project already has its own conventions
1. **Recovery Protocol**: Follow the project's lint config and existing layout; list
   deviations from this guide as suggestions, not changes.

### Scenario B: Switching count to for_each on live resources
1. **Diagnosis**: Changing the index type re-creates resources.
2. **Recovery Protocol**: Add `moved` blocks for each address and confirm a no-op plan.

## Verification Checklist
- [ ] `terraform fmt -check -recursive` and `terraform validate` pass.
- [ ] Every variable has type and description; every output has a description.
- [ ] Versions are pinned; no hard-coded credentials; sensitive values marked.
- [ ] `for_each` used for named multiples; any index change carries `moved` blocks.
- [ ] Security defaults from `references/security.md` applied.
