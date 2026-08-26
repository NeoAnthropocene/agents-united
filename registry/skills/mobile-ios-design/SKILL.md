---
name: mobile-ios-design
description: iOS design system conventions, SwiftUI component patterns, Apple
  Human Interface Guidelines, and navigation ergonomics.
metadata:
  author: wshobson (wshobson/agents)
  version: 1.0.0
  source: https://skills.sh/wshobson/agents/mobile-ios-design
  icon: 🍏
disable-slash-command: true
---

# iOS Design & SwiftUI Engineering Playbook

## Overview & Purpose
`mobile-ios-design` provides systemic guidance for designing native iOS applications adhering to Apple's Human Interface Guidelines (HIG) and SwiftUI architectural standards.

## Rules & Constraints
1. **Follow Apple HIG Standards** — Respect safe area insets, navigation bar titles, dynamic type, and native gestures.
2. **Declarative State Flow** — Maintain single source of truth using `@State`, `@Binding`, and the `@Observable` macro.
3. **Touch Targets & Ergonomics** — Ensure interactive elements have a minimum tappable area of 44x44 points.
4. **Dark Mode & Dynamic Type** — Always utilize semantic system colors (`Color(.systemBackground)`, `Color.primary`) and semantic text styles (`.font(.title)`, `.font(.body)`).

## Step-by-Step Execution Runbook

### Phase 1 — Screen & Navigation Layout
- Establish standard NavigationStack architecture with typed navigation destinations.
- Wrap content in SafeAreaInsets and configure TabView for primary sections.

### Phase 2 — Component Design
- Design reusable SwiftUI view components with parameterizable `@Binding` properties.
- Add `#Preview` with both Light and Dark mode variations.

### Phase 3 — Verification
- Audit view hierarchy on iPad, iPhone SE, and Dynamic Island devices.

## Verification Checklist
- [ ] View adheres to 44x44pt touch target minimum.
- [ ] Dynamic type scales without text truncation.
- [ ] Dark mode semantic colors applied.
