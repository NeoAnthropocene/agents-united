---
name: performance-optimization
description: Production-grade Performance Optimization playbook for Core Web
  Vitals, Node.js event-loop tuning, and caching layers.
metadata:
  author: agents-united
  version: 2.0.0
  icon: ⚡
disable-slash-command: true
---

# Full-Stack Performance Profiling & Latency Optimization

## Overview & Purpose
The Full-Stack Performance Profiling & Latency Optimization skill provides a deterministic, battle-tested framework for executing performance-optimization processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking performance-optimization.
- Auditing, implementing, or standardizing performance-optimization procedures.
- Addressing technical debt, architectural reviews, or production readiness gates.
- Preparing pull requests or automated release validations.

### Prerequisites
- Active project repository workspace with version control configured.
- Operational testing, typechecking, and build toolchains.
- Domain requirements, architectural constraints, or user stories defined.
- Clean git working tree before beginning execution.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `target_scope` | String | Yes | Target module, service, component, or file path |
| `config` | Object | Optional | Specific domain configurations, thresholds, and options |
| `output_dir` | Directory Path | Optional | Destination directory for generated artifacts and reports |
| `strict_mode` | Boolean | Optional | Enforce strict zero-warning validation and high test coverage |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Specification Document | `docs/performance-optimization/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/performance-optimization/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/performance-optimization/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Baseline Measurement & Bottleneck Profiling
1. Establish rigorous baseline metrics before applying any optimizations (never guess).
2. Profile frontend Core Web Vitals using Chrome DevTools, Lighthouse, and Web Vitals SDK.
3. Profile backend Node.js workloads using Clinic.js (clinic doctor, clinic flame).
4. Profile database query execution times and identify N+1 queries and full table scans.
5. Document top 5 performance bottlenecks ranked by latency impact.

### Phase 2: Frontend Asset & Rendering Optimization
1. Optimize Largest Contentful Paint (LCP): inline critical CSS, preload hero image with fetchpriority="high".
2. Eliminate Cumulative Layout Shift (CLS): reserve explicit dimensions on images and dynamic embeds.
3. Optimize Interaction to Next Paint (INP): break long tasks (>50ms) using scheduler.yield().
4. Implement route-based dynamic code splitting (React.lazy, dynamic import()).
5. Compress images using modern AVIF / WebP formats and responsive srcset.

### Phase 3: Backend Concurrency & Event Loop Optimization
1. Eliminate synchronous blocking CPU operations in the Node.js main thread (offload to Worker Threads).
2. Implement DataLoader batching for database queries to collapse N+1 queries into single IN (...) queries.
3. Enable HTTP/2 and gzip/brotli compression on web server responses.
4. Tune Node.js garbage collection parameters (--max-old-space-size, --v8-pool-size).
5. Optimize memory allocations and eliminate object creation inside tight loops.

### Phase 4: Multi-Tier Caching Architecture
1. Configure HTTP Cache-Control headers: public, max-age=31536000, immutable for hashed assets.
2. Implement Redis caching layer for expensive database queries with TTL and cache invalidation hooks.
3. Deploy Edge CDN caching (Cloudflare / Fastly) with stale-while-revalidate policies.
4. Implement browser local storage / IndexedDB caching for static client state.
5. Verify cache hit ratio exceeds 90% under production-like traffic.

### Phase 5: Benchmark Verification & Budget Enforcement
1. Re-run automated Lighthouse and Clinic.js profiling against optimized code.
2. Verify Core Web Vitals meet target thresholds: LCP < 2.5s, INP < 200ms, CLS < 0.1.
3. Verify backend p99 latency meets target SLA.
4. Configure bundle size limits in CI using bundlesize / size-limit.
5. Publish performance benchmark comparison report.

## Code & Configuration Exemplars

### Exemplar 1: Full-Stack Performance Profiling & Latency Optimization Configuration & Specification
```yaml
// Redis tiered caching with stale-while-revalidate pattern
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;
  const fresh = await fetcher();
  await redis.setex(key, ttlSeconds, JSON.stringify(fresh));
  return fresh;
}
```

### Exemplar 2: Full-Stack Performance Profiling & Latency Optimization TypeScript Type Contract
```typescript
export interface PerformanceBudgets {
  coreWebVitals: {
    lcpMs: number; // < 2500ms
    inpMs: number; // < 200ms
    cls: number;   // < 0.1
  };
  backendSLO: {
    p95LatencyMs: number; // < 100ms
    p99LatencyMs: number; // < 250ms
  };
  bundleSizeKb: number;   // < 200kb gzipped
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Full-Stack Performance Profiling & Latency Optimization
1. **Diagnosis**: Static analysis, typechecking, or unit tests fail validation rules during execution.
2. **Recovery Protocol**:
   - Step 1: Inspect detailed error log output in test/build terminal.
   - Step 2: Formulate targeted hypothesis and isolate failing line or assertion.
   - Step 3: Implement surgical code fix and re-run verification suite.

### Scenario B: Missing or Incompatible Dependency
1. **Diagnosis**: Required toolchain binary or library dependency is missing from the environment.
2. **Recovery Protocol**:
   - Step 1: Verify `package.json` engine requirements and local environment versions.
   - Step 2: Install required peer dependencies cleanly with lockfile sync.
   - Step 3: Resume runbook from Phase 1.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
