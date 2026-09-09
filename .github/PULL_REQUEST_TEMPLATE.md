## 📋 Summary

<!-- Provide a brief, high-level summary of your changes, rationale, and problem addressed. -->

## 🔗 Related Issues

<!-- Link to any relevant issues using Fixes #123, Closes #123, or Relates to #123 -->
- Closes #

## 🎯 Type of Change

- [ ] `feat:` A new feature or capability (bumps minor version on release)
- [ ] `fix:` A bug fix (bumps patch version on release)
- [ ] `docs:` Documentation updates or corrections (no release bump)
- [ ] `test:` Adding or updating unit/E2E tests (no release bump)
- [ ] `refactor:` Code change that neither fixes a bug nor adds a feature (no release bump)
- [ ] `ci:` Changes to CI/CD workflows, build tools, or release configuration (no release bump)
- [ ] `chore:` Routine tasks, dependency bumps, or maintenance (no release bump)

## 🌿 Branching & PR Target Verification

<!-- Per docs/workflow-guide.md and PROJECT.md §11: All PRs must target 'dev' -->
- [ ] **Base branch is `dev`** (Do NOT target `main` directly — `main` is reserved for automated releases from `dev`)
- [ ] Branch was cut from a fresh `origin/dev`
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)

## 🧪 Testing & Verification

- [ ] **TDD Followed**: Failing tests written first (Red), minimal code implemented (Green), followed by refactoring
- [ ] `npm run typecheck` passes with zero TypeScript errors
- [ ] `npm test` passes 100% across all test suites
- [ ] `npm run build` succeeds cleanly
- [ ] `git diff --cached` checked to prevent committing secrets, `.env`, or scratch files

## 📜 Interface Contracts & Attribution Checklist (if adding agents/skills/workflows)

- [ ] **Agents**: Complies with Antigravity 2.0 schema, lifecycle hooks, and scoped AI safety
- [ ] **Skills**: Includes all 7 mandatory sections and `metadata` in YAML frontmatter (author, version, source, license)
- [ ] **Attribution**: External creator credited in `README.md` under `## Credits & Acknowledgments`
- [ ] **Workflows**: Includes Mermaid flowchart, deterministic phase gates, and rollback protocol
- [ ] **Domain Dictionary**: New terms and primitives added to `CONTEXT.md`
