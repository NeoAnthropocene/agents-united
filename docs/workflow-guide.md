# Developer Workflow Guide

> Feature development, small changes & release automation for `agents-united`.
> Applies from **v0.6.0** (ADR 0013 era, auto-sync enabled).

## Branch model

| Branch | Purpose |
|---|---|
| `main` | **The release line.** Only merges from `dev` via PR. semantic-release publishes versions from here. |
| `dev` | **The integration line.** Only changes via PR (protected). The "Sync main to dev" bot keeps it in lockstep with `main` after every release. |
| `feat/…` `fix/…` `docs/…` `ci/…` | Short-lived work branches. Always branched from a **fresh `origin/dev`**. |

## One-time setup

**A. Protect `dev`** (Settings → Branches → Add branch ruleset):

- Branch name pattern: `dev`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → select **`test`**
- ✅ Allow admins to bypass (emergency escape hatch)

**B. Enable auto-merge** (Settings → General → Pull Requests):

- ✅ Allow auto-merge

**C. Authentication** — completed once via Git Credential Manager; pushes now run silently.

## Walkthrough 1 — Adding a new feature

**Step 1 — Fresh integration point + feature branch**

```bash
git switch dev
git pull origin dev
git switch -c feat/my-feature
```

**Step 2 — Develop and test locally**

Build the feature. Run the test suite:

```bash
npm run typecheck && npm test
```

(Optional: repeat inside WSL Ubuntu for Linux-path checks.)

**Step 3 — Push early (backup + CI fires on the PR)**

```bash
git push -u origin feat/my-feature
```

**Step 4 — Open Pull Request #1**

On GitHub: **base = `dev`**, compare = `feat/my-feature`. CI runs automatically (typecheck, build, full test suite on `ubuntu-latest`). Merge once green.

**Step 5 — Release it**

Open Pull Request #2: **base = `main`**, compare = `dev`. Merge → automation takes over.

### What happens automatically after PR #2 merges

1. **semantic-release** (Release workflow on `main`):
   - `feat: …` → minor version (`v0.6.0` → `v0.7.0`)
   - `fix: …` → patch version (`v0.6.0` → `v0.6.1`)
   - Publishes the npm package, Git tag, and `CHANGELOG.md`.
2. **Sync workflow** (`Sync main to dev`):
   - Opens the `main → dev` sync PR **and auto-merges it** once its CI passes.
   - `dev` returns to lockstep with `main`. No manual step.

## Walkthrough 2 — Small changes (typos, docs, CI tweaks)

Same skeleton, smaller:

```bash
git switch dev && git pull origin dev
git switch -c docs/fix-readme-typo
# edit files…
git commit -am "docs: fix typo in quickstart"
git push -u origin docs/fix-readme-typo
```

Then: PR → base `dev` → CI runs (~2 min) → merge.

### Commit type cheatsheet (drives releases)

| Prefix | Meaning | Release |
|---|---|---|
| `feat:` | new feature | **minor** |
| `fix:` | bug fix | **patch** |
| `docs:` | documentation | none |
| `ci:` | CI / workflows | none |
| `chore:` | housekeeping | none |
| `refactor:` `test:` `perf:` | internal | none |

Small changes accumulate on `dev` and ride into the next release whenever the next `feat`/`fix` goes out.

**Emergency hotfix** (production is broken now):

```bash
git switch main && git pull origin main
git switch -c fix/critical-bug
# fix + test…
git push -u origin fix/critical-bug
```

PR → base `main` → merge → release + auto-sync to `dev`.

## Quick reference

| I want to… | Branch | PR base | Automation |
|---|---|---|---|
| Add a feature | `feat/…` | `dev`, then `main` | minor release + sync |
| Fix a bug | `fix/…` | `dev`, then `main` | patch release + sync |
| Tweak docs / CI | `docs/…` `ci/…` | `dev` | none (rides along) |
| Emergency prod fix | `fix/…` | `main` | patch + sync |

*Two-step for releases: PR into `dev` first (CI gate), then `dev` → `main` (release). Both are quick merges.*

## Branch hygiene rules

1. **Never commit directly to local `dev`** — branch off it instead. (With protection enabled, GitHub blocks direct pushes anyway.)
2. **Always start branches from a fresh `origin/dev`**: `git switch dev && git pull origin dev` *before* `git switch -c`.
3. **Push feature branches early** — they are your backup and the CI trigger.
4. **Write conventional commit messages** — they drive the release.
5. **Delete merged branches** (local: `git branch -d <name>`; remote: delete on GitHub after merge).
6. **If a push is rejected (non-fast-forward)**: the remote moved (usually the auto-sync). Fix with `git pull --rebase origin dev`, then push again.

## Troubleshooting

| Symptom | Cause & fix |
|---|---|
| Push rejected "non-fast-forward" | Remote moved → `git pull --rebase origin <branch>`, resolve, push again. |
| CI fails on the PR but passes locally | Usually a Linux-only issue. Reproduce in WSL: `wsl -d Ubuntu`, `cd /mnt/c/github/agents-united`, run `npm test`. |
| Sync PR left open with a warning in Actions | Auto-merge failed after retries (rare). Merge it manually. |
| Version did not bump after merging to `main` | Only `feat:`/`fix:` commits release. Check your commit types. |
