---
name: git-guardrails
description: Operational safety policies and git guardrails to prevent
  destructive force-pushes, unintended commits to main branches, and secret
  leaks.
metadata:
  author: Matt Pocock (mattpocock/skills)
  version: 1.0.0
  source: https://github.com/mattpocock/skills
  icon: 🛡️
---

# Git Safety & Guardrails Playbook

## Overview & Purpose
`git-guardrails` enforces strict version control safety rules for AI agents and orchestrators, ensuring working tree stability, branch hygiene, and protection of main branches and credentials.

## Rules & Constraints
1. **Never commit directly to protected branches** (`main`, `master`, `production`, `release/*`). Always verify current branch with `git branch --show-current`.
2. **Never execute force pushes** (`git push --force` or `-f`).
3. **Never expose secrets or API keys**. Check staged diffs with `git diff --cached` before committing.
4. **Never leave detached HEAD state unaddressed**.
5. **Always write clear, imperative commit messages**.

## Step-by-Step Execution Runbook

### Phase 1 — Pre-Operation Inspection
1. Run `git status` to verify working tree status.
2. Verify active branch name. If on `main`, create a feature branch (`git checkout -b feature/<name>`).

### Phase 2 — Staging & Secret Check
1. Inspect staged changes with `git diff --cached`.
2. Ensure no `.env`, token, credential, or secret strings are staged.

### Phase 3 — Verification Gate & Commit
1. Run linting and test verification suite before finalizing commit.
2. Commit with standard Conventional Commits format (`feat:`, `fix:`, `docs:`, `refactor:`).

## Verification & Validation Checklist
- [ ] Frontmatter contains author attribution to Matt Pocock.
- [ ] Safe git execution rules clearly stated.
