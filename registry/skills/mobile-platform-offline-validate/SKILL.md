---
name: mobile-platform-offline-validate
description: Offline-first architecture patterns, background sync, local
  database persistence, and conflict resolution strategies for mobile
  applications.
metadata:
  author: Salesforce (forcedotcom/sf-skills)
  version: 1.0.0
  source: https://skills.sh/forcedotcom/sf-skills/mobile-platform-offline-validate
  icon: 📶
disable-slash-command: true
---

# Mobile Offline-First & Sync Playbook

## Overview & Purpose
`mobile-platform-offline-validate` guides the architecture of offline-first mobile applications, ensuring seamless local caching, optimistic UI updates, background synchronization, and conflict resolution.

## Rules & Constraints
1. **Optimistic UI Updates** — Mutate local state immediately and display pending sync indicators to the user.
2. **Deterministic Conflict Resolution** — Implement Last-Write-Wins (LWW) or custom CRDT / vector clock merge strategies for simultaneous updates.
3. **Network Resilience** — Queue failed outbound mutations in a persistent local queue with exponential backoff.
4. **Data Encryption at Rest** — Protect local SQLite / Room databases with SQLCipher or platform keychains.

## Step-by-Step Execution Runbook

### Phase 1 — Persistence Layer Architecture
- Establish local SQLite / Room / WatermelonDB schema mirroring critical cloud entities.
- Add sync metadata columns (`dirty`, `version`, `last_modified_at`, `deleted_at`).

### Phase 2 — Mutation Queue & Sync Worker
- Implement background sync worker (Android WorkManager / iOS BGTaskScheduler) triggered on network reconnect.
- Batch outbound mutations to optimize battery and bandwidth.

### Phase 3 — Verification
- Simulate airplane mode and intermittent packet loss to verify local CRUD operations and eventual consistency.

## Verification Checklist
- [ ] Application remains fully operational without active internet connection.
- [ ] Optimistic mutations successfully reconcile upon reconnect.
- [ ] Conflicts resolve deterministically without data loss.
