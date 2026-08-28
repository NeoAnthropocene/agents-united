---
name: mobile-android-design
description: Android Material 3 design conventions, Jetpack Compose layouts,
  edge-to-edge support, and responsive window size classes.
metadata:
  author: wshobson (wshobson/agents)
  version: 1.0.0
  source: https://skills.sh/wshobson/agents/mobile-android-design
  icon: 🤖
disable-slash-command: true
---

# Android Material 3 & Jetpack Compose Playbook

## Overview & Purpose
`mobile-android-design` defines design patterns and implementation rules for native Android applications utilizing Google's Material Design 3 system and Jetpack Compose.

## Rules & Constraints
1. **Material 3 Theming** — Utilize `MaterialTheme.colorScheme` and dynamic tonal palettes.
2. **Edge-to-Edge Design** — Enable edge-to-edge rendering with `enableEdgeToEdge()` and handle window insets with `Modifier.safeDrawingPadding()`.
3. **Touch Targets** — Maintain minimum touch targets of 48x48dp for all interactive elements.
4. **Adaptive Layouts** — Support Compact, Medium, and Expanded window size classes for foldable devices and tablets.

## Step-by-Step Execution Runbook

### Phase 1 — Compose Scaffold Setup
- Structure screens using `Scaffold` with `TopAppBar`, `FloatingActionButton`, and `NavigationBar`.
- Apply appropriate content padding to prevent clipping behind status or navigation bars.

### Phase 2 — State Hoisting & Recomposition
- Hoist state parameters out of child composables into ViewModels.
- Mark immutable domain classes with `@Immutable` / `@Stable`.

### Phase 3 — Verification
- Test composables in Compose Preview across Phone and Tablet device configurations.

## Verification Checklist
- [ ] 48x48dp minimum touch target met.
- [ ] Safe drawing insets properly respected.
- [ ] Material 3 color tokens used throughout.
