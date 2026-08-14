---
name: chaos-engineering
description: Chaos engineering methodology, fault injection, network latency simulation, service degradation tests, and disaster recovery validation.
metadata:
  author: "Agents United Core Team"
  version: "1.0.0"
  source: "https://github.com/NeoAnthropocene/agents-united"
---

# Chaos Engineering & Fault Injection Playbook

## Overview & Purpose
`chaos-engineering` provides a structured methodology for injecting controlled failures into distributed services and frontend applications to prove resilience before production incidents occur.

## Rules & Constraints
1. **Define Steady State** — Measure baseline normal behavior (error rate < 0.05%, p99 latency < 200ms) before injecting chaos.
2. **Formulate Falsifiable Hypothesis** — Hypothesize that the system will continue functioning despite specific service or network outages.
3. **Minimize Blast Radius** — Run chaos experiments in staging or with scoped tenant canary headers before cluster-wide testing.
4. **Automated Abort Conditions** — Configure automated triggers that immediately halt the experiment if key business SLOs degrade beyond safety margins.

## Step-by-Step Execution Runbook

### Phase 1 — Experiment Design & Hypothesis
- Select chaos vector: Network latency (Toxiproxy), Database connection drop, Redis cache outage, or Pod termination.
- Establish baseline monitoring dashboards.

### Phase 2 — Fault Injection Execution
- Trigger the fault in a controlled staging environment.
- Observe circuit breaker tripping, fallback cache utilization, and error message rendering.

### Phase 3 — Analysis & Remediation
- Document whether the system gracefully degraded or suffered cascading failures.
- Implement necessary resilience patches (timeouts, retries with jitter, fallback defaults).

## Verification Checklist
- [ ] System gracefully handles injected faults without crashing.
- [ ] Fallback user experience displays helpful degraded state UI.
- [ ] Post-experiment system recovers to steady state automatically.
