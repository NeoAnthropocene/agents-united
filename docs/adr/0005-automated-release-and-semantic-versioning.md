# 5. Automated Release and Semantic Versioning with semantic-release

We adopt `semantic-release` triggered on push to the `main` branch via GitHub Actions to automatically manage semantic versioning, changelog generation, git tagging, and npm package publishing to `@neoanthropocene/agents-united` / `agents-united`.

Development takes place on the `dev` branch with Pull Requests into `main`.

Required Secrets:
- `NPM_TOKEN`: npm automation access token with publish permissions
- `GITHUB_TOKEN`: GitHub workflow permissions (`contents: write`, `issues: write`, `pull-requests: write`)
