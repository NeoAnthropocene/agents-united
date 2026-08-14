---
name: "Mobile Multi-Platform Build & Verification"
description: "Workflow for executing cross-platform mobile builds (iOS/Android/Expo), verifying asset bundle sizes, and checking native compilation status."
bundle: "mobile-development"
estimatedDuration: "15-30m"
---

# Workflow: Mobile Multi-Platform Build & Verification

## Overview & Scope
The Mobile Build workflow compiles native and cross-platform mobile application packages (IPA / APK / AAB / Expo EAS), validating binary size, asset optimization, and compiler flags.

## Execution Flowchart
```mermaid
graph TD
    Start([Start Workflow]) --> P1[Phase 1: Environment & Dependency Check]
    P1 --> InputCheck{"Podfile & Gradle Ready?"}
    InputCheck -->|No| Abort1[Abort & Resolve Dependencies]
    InputCheck -->|Yes| P2[Phase 2: Compilation & Asset Bundling]
    P2 --> Gate1{"Verification Gate: Compilation Exit Code 0?"}
    Gate1 -->|Fail| Rollback[Inspect Build Logs & Fix Compilation Errors]
    Rollback --> P2
    Gate1 -->|Pass| P3[Phase 3: Binary Inspection & Artifact Sign-off]
    P3 --> Done([Mobile Build Package Ready])
```

## Required Tool Inputs & Context
- Target mobile platform (`ios`, `android`, `all`)
- Build type (`debug`, `release`)
- Xcode / Android SDK environment setup

## Phase 1: Environment & Dependency Check
- Inspect native configuration files (`Podfile`, `build.gradle`, `app.json`).
- Verify signing identities and bundle identifiers.

## Phase 2: Compilation & Asset Bundling
- Execute compilation (`xcodebuild` / `./gradlew assembleRelease` / `eas build --local`).
- Check output for deprecated API usages or symbol collision warnings.

## Phase 3: Binary Inspection & Artifact Sign-off
- Audit final binary file size against mobile app budget (< 50MB target).
- Verify entry point manifest and permission declarations.

## Phase Transition Criteria & Deterministic Verification Gates
| Transition | Prerequisites | Verification Command / Gate | Success Criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Dependencies resolved | `npm run lint` / `pod install` | Dependency graph clean with 0 lockfile errors |
| Phase 2 -> Phase 3 | Compilation completed | `npm run build:mobile` | Binary generated with exit code 0 |
| Phase 3 -> Completion | Binary signed and verified | Binary size & signature audit | Target package bundle verified |
