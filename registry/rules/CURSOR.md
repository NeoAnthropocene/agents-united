# Operational Directives for Cursor & Codex Runtimes

This rule file is automatically provisioned by Agents United to guide Cursor and Codex runtime execution.

## Core Behavioral Directives

1. **Test-Driven First**: Write tests that fail before writing implementation code.
2. **Deterministic Verification**: Verify code changes with automated test execution before finalizing edits.
3. **Safety & Zero-Trust Secret Policy**: Never log or commit secret tokens or credentials.
4. **Git Protection**: Never commit directly to `main` or `master`; zero force-pushes allowed.
5. **Attribution Standard**: Declare author metadata in skill frontmatter and credit authors in `README.md`.
6. **Clean Architecture**: Maintain modular boundaries, explicit TypeScript interfaces, and single responsibility.
