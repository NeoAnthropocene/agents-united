---
name: sentry-incident-triage
description: Sets up Sentry error/performance alerting and triages incoming
  issues using Sentry's real CLI/API surface — sentry-cli releases and source
  maps, Seer root-cause analysis, issue ownership rules, and the alert
  workflow engine. Use when configuring Sentry alerts, triaging a spike in
  errors, or deciding whether to resolve, ignore, or escalate a Sentry issue.
metadata:
  author: Sentry / agents-united
  version: 1.0.0
  source: https://github.com/getsentry/sentry-for-ai
  commit: f2792883d466b74ee65323312314e8b1bc138677
  license: MIT
  icon: 🐛
disable-slash-command: true
---

# Sentry Incident Triage & Alerting

## Overview & Purpose
`sentry-incident-triage` teaches the real Sentry workflow for turning a raw
error/performance signal into either a fixed bug or a correctly-suppressed
non-issue: instrumenting alerts, using Seer for root-cause analysis on an
issue, and applying issue-owner routing so the right person sees it. It is
distinct from the catalog's `telemetry-monitoring` skill (generic
Prometheus/Grafana/OpenTelemetry metrics/dashboards) and
`workflow-incident-triage` (a host-agnostic phase workflow): this skill is
grounded in Sentry's specific product surface — issues, releases, source
maps, and its alert rule engine.

## Execution Triggers & Prerequisites
### Execution Triggers
- Setting up Sentry alert rules for a new service or environment.
- A Sentry issue needs triage: is it actionable, a duplicate, noise, or a
  regression from the last release?
- Source-mapped stack traces are showing minified code instead of original
  source.
- Deciding whether to resolve, ignore (`untilEscalating`), or escalate an
  issue to an on-call engineer.

### Prerequisites
- `sentry-cli` authenticated (`sentry-cli login`, or `SENTRY_AUTH_TOKEN` set)
  against the correct org/project.
- Sentry project DSN already wired into the service's SDK.
- Read access to the Sentry issue stream/API for the affected project.
- Destructive/bulk actions (bulk-resolving or bulk-ignoring issues) require
  explicit user confirmation before running — never auto-archive a queue
  without it being asked for.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `project_slug` | String | Yes | Sentry project (e.g. `org/javascript-frontend`) |
| `issue_id` or `issue_query` | String | Yes | A specific issue, or a search query (`is:unresolved`) |
| `release_version` | String | Optional | For release-health / regression comparisons |
| `severity_threshold` | String | Optional | Minimum level to alert on (`error`, `fatal`) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Alert rule | Sentry dashboard config / API payload | Condition + action (Slack, email, PagerDuty) |
| Triage decision | Issue status change | `resolved`, `ignored` (with `untilEscalating`), or escalated |
| Release + source maps | `sentry-cli releases` | Symbolicated stack traces for the release |

## Step-by-Step Execution Runbook

### Phase 1 — Alert Setup
1. Define the alert condition first in product terms ("error rate on
   checkout > 1% over 5 minutes"), then translate it into a Sentry alert rule
   condition — don't start from the UI's default templates.
2. Prefer issue-level alerts scoped by tag (`environment:production`,
   `level:fatal`) over "alert on every new issue," which drowns the channel.
3. Wire the alert action to the channel the on-call team actually watches
   (Slack/PagerDuty), and confirm it fires with a test event before relying
   on it.
4. For release regressions, enable release-health tracking so a new release
   with a rising crash-free-session rate drop pages the owning team
   automatically rather than waiting for user reports.

### Phase 2 — Release & Source Map Hygiene
1. Create a release tied to the deploy: `sentry-cli releases new <version>`.
2. Associate commits for suspect-commit / ownership suggestions:
   `sentry-cli releases set-commits <version> --auto`.
3. Upload source maps for the release so stack traces symbolicate to
   original source, not minified bundles:
   `sentry-cli sourcemaps upload --release=<version> ./dist`.
4. Finalize the release: `sentry-cli releases finalize <version>`. An
   unfinalized release will not show accurate release-adoption/health data.

### Phase 3 — Issue Triage
1. Start from severity and blast radius, not chronological order: sort by
   event count / affected users, not by "newest first."
2. For an issue with an unclear root cause, use Sentry's Seer AI root-cause
   analysis on the issue before manually reading the full stack trace —
   confirm its suggested root cause against the actual code, don't apply it
   blindly.
3. Check issue ownership rules (path-based or tag-based routing) before
   reassigning by hand; if a rule should have caught this but didn't, fix the
   rule, not just this one issue.
4. Classify each issue into exactly one bucket:
   - **Actionable bug** → assign an owner, link the PR that will fix it.
   - **Known/expected noise** (third-party library warning, browser quirk,
     transient 5xx from a dependency, test traffic) → `ignore` with
     `untilEscalating` so it stays quiet unless volume spikes again, rather
     than being resolved-and-forgotten (which would let a real regression on
     the same signature go unnoticed).
   - **Duplicate** → merge into the canonical issue.
   - **Regression from the last release** → treat as release-blocking; do not
     let it sit in the general queue.
5. Only bulk-archive/ignore a queue of non-actionable noise after the user
   has approved the specific criteria (which issues, which action) — never as
   an unattended default.

### Phase 4 — Verification
1. After resolving, confirm the issue does not immediately regress on the
   next deploy (Sentry will auto-reopen a resolved issue if it recurs).
2. Confirm the alert that should have caught this class of issue actually
   exists and fired, or create/fix it so the next occurrence pages someone
   instead of relying on manual triage again.

## Code & Configuration Exemplars

### Exemplar 1: Release + Source Map Pipeline (CI step)
```bash
export SENTRY_ORG=my-org
export SENTRY_PROJECT=javascript-frontend
VERSION=$(sentry-cli releases propose-version)

sentry-cli releases new "$VERSION"
sentry-cli releases set-commits "$VERSION" --auto
sentry-cli sourcemaps upload --release="$VERSION" ./dist
sentry-cli releases finalize "$VERSION"
```

### Exemplar 2: Issue-Owner Rule (path-based routing)
```
# .sentry/ownership rules (or configured via project settings)
path:src/checkout/*        #team-payments
path:src/auth/*            #team-identity
tags.environment:staging   #team-qa
```

### Exemplar 3: Triage Decision Table
```text
Signature seen before? -> yes -> merge into canonical issue
Third-party / browser quirk / test traffic? -> yes -> ignore(untilEscalating)
New in this release, user-impacting? -> yes -> release-blocking, assign now
Otherwise -> assign by ownership rule, link tracking ticket
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Source Maps Uploaded but Stack Traces Still Show Minified Code
1. **Diagnosis**: The uploaded map's `release` tag or `dist` value does not
   match what the SDK reports at runtime.
2. **Recovery Protocol**:
   - Step 1: Compare the SDK's configured `release`/`dist` against the values
     used in `sentry-cli sourcemaps upload --release=...`; they must match
     exactly.
   - Step 2: Re-upload with the corrected release identifier; existing events
     will re-symbolicate once the correct map is attached to that release.

### Scenario B: An `ignore(untilEscalating)` Issue Fires Again Anyway
1. **Diagnosis**: Volume crossed the escalation threshold, meaning the "known
   noise" classification from Phase 3 was wrong or the underlying rate changed.
2. **Recovery Protocol**:
   - Step 1: Treat the re-open as a signal, not spam — re-triage from Phase 3
     assuming it may now be a real regression.
   - Step 2: If it is confirmed noise at a new, higher baseline volume, adjust
     the escalation threshold rather than re-ignoring blindly.

### Scenario C: Seer's Suggested Root Cause Doesn't Match the Code
1. **Diagnosis**: The AI analysis pattern-matched on the stack trace but
   missed project-specific context (a wrapper, a proxy, a feature flag).
2. **Recovery Protocol**:
   - Step 1: Use it as a starting hypothesis only; trace the actual code path
     yourself before assigning or closing the issue based on it.
   - Step 2: If it was clearly wrong, don't let it anchor the final triage
     decision — restart from the raw stack trace.

## Verification & Validation Checklist
- [ ] Every production service has an alert rule scoped to a specific,
      actionable condition — not just "any new issue."
- [ ] Releases are created, commit-associated, source-mapped, and finalized
      as part of the deploy pipeline, not after the fact.
- [ ] Every triaged issue lands in exactly one bucket (actionable / known
      noise / duplicate / regression) with a recorded reason.
- [ ] `ignore(untilEscalating)` is used for known noise instead of
      `resolve`, so a real recurrence is not silently swallowed.
- [ ] Bulk triage actions were explicitly approved by the user before running.
- [ ] Issue ownership rules route new issues to the right team without
      manual reassignment.
