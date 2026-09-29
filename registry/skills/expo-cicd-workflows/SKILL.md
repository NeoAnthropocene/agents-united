---
name: expo-cicd-workflows
description: EAS Build/Submit CI pipelines for Expo/React Native apps —
  eas.json build profiles, EAS Workflows YAML automation, credentials
  management, and OTA updates via eas update. Use when setting up CI/CD for
  an Expo app, configuring development/preview/production build profiles, or
  automating app store submission.
metadata:
  author: Expo / agents-united
  version: 1.0.0
  source: https://github.com/expo/skills
  commit: efa52f0a9d2176db75992736281c77da1b714fa3
  license: MIT
  icon: 📱
disable-slash-command: true
---

# Expo EAS CI/CD Workflows

## Overview & Purpose
`expo-cicd-workflows` covers the real EAS (Expo Application Services) CI/CD
surface — `eas.json` build profiles, `eas build`/`eas submit`, EAS Workflows
YAML automation (`.eas/workflows/*.yml`), and OTA updates via `eas update` —
adapted from Expo's own `eas-workflows` and `eas-app-stores` skills
(`expo/skills`, MIT). It is scoped to CI/CD; app UI/navigation/native-module
concerns stay with the catalog's `mobile-ios-design`/`mobile-android-design`
and `react-best-practices` skills.

## Execution Triggers & Prerequisites
### Execution Triggers
- Setting up CI/CD for a new Expo/React Native app (from scratch or migrating
  off a custom native CI pipeline).
- Configuring `eas.json` build profiles (development/preview/production).
- Automating build → submit → OTA-update as a pipeline triggered by a git
  push or tag.
- Debugging a failed EAS build or a rejected app store submission.

### Prerequisites
- `eas-cli` installed and authenticated (`eas login`), project linked
  (`eas init`).
- App identifiers and credentials already provisioned, or willingness to let
  `eas credentials` manage them.
- Store-side prerequisites for submission: an App Store Connect API key (iOS)
  and a Google Play service account JSON (Android), stored as EAS secrets,
  never committed to the repo.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `build_profile` | String | Yes | `development` / `preview` / `production`, as defined in `eas.json` |
| `platform` | String | Yes | `ios`, `android`, or `all` |
| `trigger` | String | Optional | `push`, `tag`, or manual (`eas workflow:run`) |
| `ota_channel` | String | Optional | Update channel for `eas update`, mapped to a build profile |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| `eas.json` | JSON | Build profiles, submit config, per-platform overrides |
| `.eas/workflows/*.yml` | YAML | CI/CD pipeline definition (build → test → submit → update) |
| Build artifact | `.ipa`/`.aab` | Produced by `eas build`, downloadable or auto-submitted |
| OTA update | Published via `eas update` | JS/asset update pushed to a channel without a store review |

## Step-by-Step Execution Runbook

### Phase 1 — Build Profile Design
1. Define at minimum three profiles in `eas.json`: `development` (dev-client,
   internal distribution), `preview` (internal distribution, release-like
   build for QA), and `production` (store-distribution, release build).
2. Set `"distribution": "internal"` for `development`/`preview` so builds
   install directly without going through a store, and `"store"` for
   `production`.
3. Pin the Node/CLI toolchain per profile if the project needs a specific
   version (`"node"`, `"cli.version"` fields), so CI reproduces the exact
   local build environment.
4. Keep environment-specific config (API base URLs, feature flags) in EAS
   environment variables scoped per profile, not hardcoded per branch.

### Phase 2 — Credentials
1. Let `eas credentials` manage signing credentials (iOS provisioning
   profiles/certificates, Android keystores) by default — it stores them
   encrypted server-side and handles renewal.
2. For CI-only automation without interactive prompts, use
   `EXPO_TOKEN` (a personal/robot access token) so `eas build`/`eas submit`
   run non-interactively; never embed the token in the repo, only in the CI
   platform's secret store.
3. Store app-store credentials (App Store Connect API key, Google Play
   service account JSON) as EAS secrets (`eas secret:create`) referenced from
   `eas.json`'s `submit` section, not as plaintext files in the repo.

### Phase 3 — Pipeline Automation (EAS Workflows)
1. Define the pipeline as a `.eas/workflows/*.yml` file with jobs for build,
   and conditionally submit/update, rather than scripting it externally —
   Workflows run on Expo's infrastructure with the project's credentials
   already wired in.
2. Trigger `production` builds on a git tag or main-branch merge, and
   `preview` builds on every PR, so reviewers can install a real build before
   merge.
3. Chain `submit` after a successful `production` build only when the team
   wants automatic store submission; otherwise leave submission manual
   (`eas submit --profile production`) as a deliberate release step.
4. For JS-only changes that don't touch native code, prefer `eas update`
   (OTA) over a full store build/submit cycle — it publishes instantly to a
   channel without app-store review, but only for changes compatible with the
   already-shipped native runtime version.

### Phase 4 — Verification
1. Confirm the build profile actually used matches the intended one
   (`eas build:list` shows profile per build) — a misconfigured trigger
   silently building `development` instead of `production` is a common
   pipeline bug.
2. Verify OTA update compatibility: an update published to a channel whose
   native runtime has since changed will not apply to old app binaries —
   check `runtimeVersion` policy before relying on `eas update` for a change
   that touches native dependencies.
3. Confirm submission credentials are still valid (App Store Connect API
   keys and Play service accounts expire/rotate) before assuming
   `eas submit` will succeed unattended in CI.

## Code & Configuration Exemplars

### Exemplar 1: `eas.json` Build Profiles
```json
{
  "cli": { "version": ">= 13.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Exemplar 2: EAS Workflow — Build on PR, Submit on Tag
```yaml
# .eas/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  build_ios:
    type: build
    params:
      platform: ios
      profile: production
  build_android:
    type: build
    params:
      platform: android
      profile: production
  submit_ios:
    type: submit
    needs: [build_ios]
    params:
      platform: ios
  submit_android:
    type: submit
    needs: [build_android]
    params:
      platform: android
```

### Exemplar 3: Non-Interactive CI Build + OTA Update
```bash
# In CI, with EXPO_TOKEN set as a secret env var:
eas build --platform all --profile production --non-interactive --no-wait
eas update --branch production --message "Hotfix: checkout crash"
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Build Fails on Native Dependency Resolution
1. **Diagnosis**: A native module's autolinking or Podfile/Gradle
   configuration is out of sync with the installed JS dependency version.
2. **Recovery Protocol**:
   - Step 1: Reproduce locally with `eas build --local` if possible, or read
     the full EAS build logs for the exact native build error (not just the
     summary).
   - Step 2: Confirm the native dependency's Expo SDK compatibility; run
     `expo install --check` to catch version mismatches before rebuilding.

### Scenario B: OTA Update Doesn't Reach Users
1. **Diagnosis**: The update was published to the wrong channel, or the
   installed app binary's `runtimeVersion` no longer matches the update's
   runtime version policy.
2. **Recovery Protocol**:
   - Step 1: Confirm the channel published to (`eas update --branch <x>`)
     matches the channel the build's `eas.json` profile maps to.
   - Step 2: If the runtime version changed (a native dependency was added),
     ship a new store build instead — OTA cannot patch a runtime mismatch.

### Scenario C: Automated Store Submission Fails on Expired Credentials
1. **Diagnosis**: `eas submit` fails auth against App Store Connect or Google
   Play mid-pipeline.
2. **Recovery Protocol**:
   - Step 1: Check credential expiry (App Store Connect API keys and Google
     Play service accounts can be revoked/rotated outside EAS's knowledge).
   - Step 2: Re-generate and re-store the credential as an EAS secret, then
     re-run submission manually before re-enabling automatic submission.

## Verification & Validation Checklist
- [ ] `eas.json` defines distinct `development`/`preview`/`production`
      profiles with correct `distribution` values.
- [ ] Signing credentials are managed via `eas credentials` or stored as EAS
      secrets — none are committed to the repository.
- [ ] CI uses `EXPO_TOKEN` (or equivalent) for non-interactive
      `eas build`/`eas submit`, scoped to CI's own secret store.
- [ ] The pipeline builds the intended profile per trigger (verified via
      `eas build:list`, not assumed from the workflow file alone).
- [ ] OTA updates via `eas update` are only relied on for changes compatible
      with the currently-shipped `runtimeVersion`.
- [ ] Store submission credentials are periodically re-verified, not assumed
      permanently valid.
