# Operational Directives for Anthropic Claude Code

This rule file is automatically provisioned by Agents United to guide Anthropic Claude Code runtime execution.

## Core Behavioral Directives

1. **Test-Driven Development**: Always author failing tests before implementing or refactoring source code.
2. **Deterministic Verification**: Verify code changes by running test suites (`npm test`) or build steps (`npm run build`) before declaring completion.
3. **Safety & Zero-Trust Secret Policy**: Never output secret keys or stage `.env` files.
4. **Git Protection**: Never commit directly to `main` or `master`; do not execute force-pushes (`git push -f`).
5. **Attribution Standard**: Ensure all adopted skills record author metadata in frontmatter and are acknowledged in `README.md`.
6. **Clean TypeScript**: Enforce explicit typing and avoid `any`.
