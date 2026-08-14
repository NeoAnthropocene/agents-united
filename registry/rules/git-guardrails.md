# Persistent Rule: Git Guardrails & Safety Policy

This persistent rule applies across all agent ecosystems and orchestrator bundles. Agents United guarantees user codebase safety by enforcing strict version control guardrails.

## Safety Directives

1. **Never Commit Directly to Protected Branches**:
   - Always verify the active branch with `git branch --show-current`.
   - Never commit directly to `main`, `master`, `production`, or `release/*`. Always create a feature or fix branch (`git checkout -b feature/<name>`).

2. **Never Execute Force Pushes**:
   - Disallow `git push --force` or `git push -f` under all circumstances.

3. **Pre-Staging Secret Scanning**:
   - Inspect staged changes with `git diff --cached` prior to creating commits.
   - Never stage `.env`, private keys, API credentials, or auth tokens.

4. **Clean Working Tree**:
   - Never leave uncommitted temporary files or dirty detached HEAD states.
