---
name: maestro-mobile-testing
description: Declarative mobile UI testing with Maestro, automated mobile regression flows, deep linking, and cross-platform verification.
metadata:
  author: "tovimx (tovimx/maestro-mobile-testing-skill)"
  version: "1.0.0"
  source: "https://skills.sh/tovimx/maestro-mobile-testing-skill/maestro-mobile-testing"
---

# Maestro Mobile E2E Testing Playbook

## Overview & Purpose
`maestro-mobile-testing` provides instructions and patterns for authoring declarative, readable mobile UI test flows for iOS and Android using Maestro.

## Rules & Constraints
1. **Use Text and Accessibility Identifiers** — Prefer `tapOn: "Button Text"` or `tapOn: { id: "button_id" }` over brittle coordinates.
2. **Avoid Hardcoded Sleeps** — Rely on Maestro's built-in auto-waiting for elements to render.
3. **Isolate Test Flows** — Use `launchApp: { clearState: true }` to guarantee independent test preconditions.
4. **Assert Visible Text and State** — Verify expected screen content with `assertVisible: "Welcome Screen"`.

## Step-by-Step Execution Runbook

### Phase 1 — Test Flow Definition
- Create `.maestro/` directory containing YAML test flow files (e.g. `auth_flow.yaml`, `checkout_flow.yaml`).
- Define appId and target environment configurations.

### Phase 2 — Flow Execution & Actions
- Author steps: `tapOn`, `inputText`, `scroll`, `back`, `assertVisible`.
- Add conditional checks (`runFlow: { when: { visible: "Modal" } }`).

### Phase 3 — Verification
- Run tests on iOS Simulator and Android Emulator via `maestro test .maestro/`.

## Verification Checklist
- [ ] Test flows execute deterministically on both iOS and Android.
- [ ] No brittle coordinate-based taps.
- [ ] Clear error logs and screenshots captured on assertion failure.
