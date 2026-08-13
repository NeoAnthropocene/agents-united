# Plan 001: Project Scaffolding & Semantic Release CI

## Overview
Configure TypeScript Node.js ESM package structure for `agents-united`, install build tools (TSup / Vite / TypeScript), test runners (Vitest), and GitHub Actions semantic release pipeline.

## Deliverables
1. `package.json` with:
   - `name`: `agents-united` (or `@neoanthropocene/agents-united`)
   - `bin`: `{ "agents-united": "./dist/cli.js" }`
   - `type`: `module`
   - `files`: `["dist", "registry"]`
   - Semantic-release plugins (`@semantic-release/commit-analyzer`, `@semantic-release/release-notes-generator`, `@semantic-release/npm`, `@semantic-release/github`, `@semantic-release/git`)
2. `tsconfig.json` configuring ES2022 / NodeNext.
3. `.releaserc.json` configured for `main` branch semantic release with conventional commits.
4. `.github/workflows/release.yml` executing tests and triggering semantic-release on push to `main`.
5. `.github/workflows/ci.yml` running lint, typecheck, and vitest on pull requests to `main` and `dev`.

## Verification Commands
```bash
npm run build
npm test
npx semantic-release --dry-run
```
