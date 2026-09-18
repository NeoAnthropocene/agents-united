---
name: workflow-app-store-release
description: Workflow for auditing mobile application compliance, privacy policy
  disclosures, StoreKit/In-App Purchases, and app store submission assets. Use
  when executing app store & google play release preparation workflows, phase
  transitions, and verification gates.
metadata:
  author: Agents United
  version: 1.0.0
  source: https://github.com/NeoAnthropocene/agents-united
  license: MIT
  icon: 🔄
---

# Workflow: App Store & Google Play Release Preparation

## Overview & Scope
The App Store Release workflow audits mobile applications against Apple App Review Guidelines and Google Play Developer Policies prior to store submission, eliminating common rejection causes.

## Execution Flowchart
```mermaid
graph TD
    Start([Start Workflow]) --> P1[Phase 1: Privacy & Entitlements Audit]
    P1 --> InputCheck{"Info.plist & Manifest Complete?"}
    InputCheck -->|No| Abort1[Remediate Missing Descriptions]
    InputCheck -->|Yes| P2[Phase 2: StoreKit & Permissions Verification]
    P2 --> Gate1{"Verification Gate: Guidelines Compliant?"}
    Gate1 -->|Fail| P2Fix[Apply Compliance Fixes]
    P2Fix --> P2
    Gate1 -->|Pass| P3[Phase 3: Metadata & Release Artifact Packaging]
    P3 --> Done([App Store Submission Ready])
```

## Required Tool Inputs & Context
- `Info.plist` (iOS) / `AndroidManifest.xml` (Android)
- Privacy Policy URL and Terms of Service links
- Screenshot assets for target screen sizes

## Phase 1: Privacy & Entitlements Audit
- Verify that every requested permission (Camera, Location, Notifications) includes a clear, user-facing purpose string.
- Audit third-party SDK privacy manifests and data collection disclosures.

## Phase 2: StoreKit & Permissions Verification
- Verify In-App Purchase restore purchase functionality and clear pricing disclosures.
- Verify account deletion capabilities for apps with user authentication.

## Phase 3: Metadata & Release Artifact Packaging
- Compile App Store Connect / Google Play metadata, release notes, and version increment commits.

## Phase Transition Criteria & Deterministic Verification Gates
| Transition | Prerequisites | Verification Command / Gate | Success Criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Permission strings verified | Manifest & Info.plist audit | 100% of requested permissions have explanations |
| Phase 2 -> Phase 3 | Store compliance verified | Guidelines checklist audit | Account deletion & purchase restore verified |
| Phase 3 -> Completion | Metadata bundle signed off | Release notes & version audit | Clean submission package prepared |
