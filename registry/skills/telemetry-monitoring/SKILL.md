---
name: telemetry-monitoring
description: Configures Prometheus metrics, Grafana dashboards, OpenTelemetry distributed tracing, log aggregation, and SLO/SLA alert thresholds.
metadata:
  author: "Agents United Core Team"
  version: "1.0.0"
  source: "https://github.com/NeoAnthropocene/agents-united"
---

# Telemetry & Observability Playbook

## Overview & Purpose
`telemetry-monitoring` provides systemic guidance for instrumenting application services with observability metrics, structured logging, distributed tracing, and alert monitoring.

## Rules & Constraints
1. **Focus alerts on SLO symptoms** (high error rate, tail latency) rather than noisy transient metrics.
2. **Enforce structured JSON logging** with standard fields (`timestamp`, `level`, `trace_id`, `service`, `message`).
3. **Inject OpenTelemetry context propagation** headers (`traceparent`) across RPC / HTTP calls.
4. **Define explicit metric buckets** for histograms (HTTP response latency in ms).

## Step-by-Step Execution Runbook

### Phase 1 — Instrumentation Setup
- Add Prometheus client metrics (`counter`, `gauge`, `histogram`) to core API endpoints.
- Configure OpenTelemetry SDK exporter for distributed tracing.

### Phase 2 — Dashboard & Alert Rules
- Author Grafana dashboard JSON configuration files covering RED metrics (Rate, Errors, Duration).
- Define Prometheus Alertmanager rules for p99 latency spikes and 5xx error rate thresholds.

### Phase 3 — Verification
- Validate log JSON schema parsing and trace propagation across microservice boundaries.

## Verification Checklist
- [ ] Prometheus metrics endpoint (`/metrics`) returns valid exposition format.
- [ ] Distributed tracing headers properly injected.
- [ ] Alerting thresholds aligned with SLO targets.
