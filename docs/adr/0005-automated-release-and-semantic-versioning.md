# 5. Automated Release and Semantic Versioning with semantic-release

We adopt `semantic-release` triggered on push to the `main` branch via GitHub Actions to automatically manage semantic versioning, changelog generation, git tagging, and npm package publishing to `agents-united`.

Development takes place on the `dev` branch with Pull Requests into `main`.

Authentication & Publishing Architecture:
- `NPM_TOKEN`: npm granular access token with "Bypass two-factor authentication" and Read/Write package permissions, or Trusted Publishing with GitHub Actions OIDC (`id-token: write`).
- `GITHUB_TOKEN`: GitHub workflow permissions (`contents: write`, `issues: write`, `pull-requests: write`).
