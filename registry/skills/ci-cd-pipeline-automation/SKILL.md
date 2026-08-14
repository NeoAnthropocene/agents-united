---
name: ci-cd-pipeline-automation
description: Automates CI/CD delivery pipelines, GitHub Actions workflows, container builds, and staging preview deployments.
metadata:
  author: "Agents United Core Team"
  version: "1.0.0"
  source: "https://github.com/NeoAnthropocene/agents-united"
---

# CI/CD Pipeline Automation Playbook

## Overview & Purpose
`ci-cd-pipeline-automation` guides AI agents in crafting, optimizing, and maintaining Continuous Integration and Continuous Delivery (CI/CD) pipelines across GitHub Actions, GitLab CI, and Docker container workflows.

## Rules & Constraints
1. **Never hardcode secrets** in workflow files; always use secrets management (`${{ secrets.GITHUB_TOKEN }}`).
2. **Always pin container base images** to specific tags or SHA hashes rather than `latest`.
3. **Use dependency caching** (`actions/setup-node` cache, Docker layer caching) to optimize build times.
4. **Implement automated status checks** as pull request merge gates.

## Step-by-Step Execution Runbook

### Phase 1 — Workflow Scaffolding
- Create `.github/workflows/ci.yml` for pull request linting, testing, and building.
- Set up multi-runner job matrices for parallel execution.

### Phase 2 — Container Build Optimization
- Create multi-stage `Dockerfile` to separate build dependencies from minimal runtime images.
- Validate build cache arguments.

### Phase 3 — Staging & Release Verification
- Configure deployment steps with rollback handling on non-zero exit codes.

## Verification Checklist
- [ ] Workflow YAML validated for correct syntax.
- [ ] Secrets appropriately referenced.
- [ ] Build & test status gates configured.
