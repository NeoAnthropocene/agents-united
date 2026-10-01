---
name: edge-security-audit
description: Multi-phase security audit methodology for edge/Workers
  applications — Cloudflare Workers, KV/D1/R2 bindings, WAF and Zero Trust
  configuration — adapted from Cloudflare's coverage-led hunt-and-verify audit
  workflow. Use when auditing a Cloudflare Workers app, reviewing wrangler
  configuration for exposed secrets, or verifying edge-layer access controls
  before shipping.
metadata:
  author: Cloudflare / agents-united
  version: 1.0.0
  source: https://github.com/cloudflare/security-audit-skill
  commit: c1c8a8c1471069fb0e188eeaff69b8e8db6564a8
  license: MIT
  icon: 🛡️
disable-slash-command: true
---

# Edge Security Audit (Cloudflare Workers)

## Overview & Purpose
`edge-security-audit` adapts Cloudflare's own `security-audit-skill`
methodology — a coverage-led, hunt-then-independently-verify workflow that
produces machine-readable findings instead of a prose report — and scopes it
to edge/Workers applications: Workers scripts, KV/D1/R2/Queues bindings,
Cloudflare Access (Zero Trust), WAF custom rules, and Turnstile. It is
distinct from the catalog's generic `security-audit` skill (OWASP Top 10 /
SAST checklist): this skill is a *process* for avoiding both false positives
and missed findings, applied to the edge-specific attack surface.


### Reference files

Restored upstream files sit at the skill root, one topic each. Workflow: `RECONNAISSANCE.md`, `HUNTING.md`, `VALIDATION-AND-REPORTING.md`. `ATTACK-CLASSES.md` helps choose which class files apply (`WEB-PROTOCOL-AND-AUTH.md`, `CLOUD-AND-DEPLOYMENT.md`, `CLIENT-SIDE.md`, `DATA-ISOLATION-AND-LIFECYCLE.md`, `AI-AND-LLM.md`, and others); `report-schema.json` is the findings schema. List the folder and read only what the target needs.

## Execution Triggers & Prerequisites
### Execution Triggers
- A Cloudflare Worker, Pages Function, or Durable Object is going to
  production and needs a security pass before launch.
- Reviewing `wrangler.toml`/`wrangler.jsonc` for accidentally-committed
  secrets or over-broad bindings.
- Investigating a reported vulnerability in an edge-deployed service.
- Auditing Cloudflare Access (Zero Trust) policies or WAF custom rules for
  gaps.

### Prerequisites
- Read access to the Worker's source and its `wrangler.toml`/`wrangler.jsonc`.
- `wrangler` CLI available for inspecting deployed bindings and secrets
  (`wrangler secret list`, `wrangler deployments list`).
- A writable output directory **outside** the audited repository (or a
  git-ignored subdirectory of it) for findings artifacts — never write scratch
  audit files into the audited codebase itself.
- This skill is guidance, not blanket authorization: loading it does not by
  itself authorize destructive actions (rotating secrets, editing WAF rules)
  — those require explicit confirmation from the user.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `target_repo` | Path | Yes | The Worker/Pages project under audit |
| `wrangler_config` | File | Yes | `wrangler.toml` or `wrangler.jsonc` |
| `deployed_env` | String | Optional | `production` / `staging`, for `wrangler` live-binding checks |
| `output_dir` | Directory Path | Optional | Defaults to `~/security-audit/<repo-name>/run-<N>`, outside the target |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| `architecture.md` | Markdown | Recon: bindings, routes, external calls, trust boundaries |
| `coverage-ledger.json` | JSON | Which attack classes were checked, and how thoroughly |
| `findings.json` | JSON, schema-validated | One entry per finding: `confirmed` / `needs_validation` / `rejected` |
| `REPORT.md` | Markdown | Target-neutral summary for the team, generated last |

## Step-by-Step Execution Runbook

### Phase 1 — Reconnaissance
1. Enumerate every binding in `wrangler.toml`/`wrangler.jsonc`: KV
   namespaces, D1 databases, R2 buckets, Queues, Durable Object classes,
   Service Bindings, and secrets (`[[vars]]` vs `wrangler secret put`).
2. Flag any secret-shaped value (API key, token, connection string) present
   as a plaintext `var` instead of a `wrangler secret` — plaintext vars are
   readable from the dashboard and in `wrangler.toml` if committed.
3. Map every route/route pattern to the Worker(s) handling it, and note which
   routes are public vs behind Cloudflare Access.
4. Record trust boundaries in `architecture.md`: what the Worker trusts from
   the request (headers, `cf.*` properties) versus what it must itself
   validate (JWTs, HMAC signatures, origin checks).
5. Write `coverage-ledger.json` listing the attack classes this audit will
   check (see Phase 2) before hunting begins — this is the anti-hallucination
   guardrail: a class not in the ledger cannot later be claimed as covered.

### Phase 2 — Coverage-Led Hunting
1. **Binding exposure**: does any HTTP handler return a KV/D1/R2 object or
   error message verbatim to the client, leaking internal keys or schema?
2. **Secrets handling**: are secrets read only via `env.SECRET_NAME` (bound
   through `wrangler secret put`), never hardcoded or logged with
   `console.log`?
3. **CORS on Worker routes**: does `Access-Control-Allow-Origin` reflect the
   request `Origin` header unconditionally (`*` combined with
   `Allow-Credentials: true` is a real vulnerability, not just a warning)?
4. **Authn/authz at the edge**: is every request that reaches a
   privileged route verifying a signed token (JWT verified with the correct
   audience/issuer, or an HMAC) before the Worker does anything with it, and
   is verification failure a hard `401`, not a soft-fail?
5. **Durable Object isolation**: does a Durable Object ID derive from
   attacker-controlled input in a way that lets one tenant address another
   tenant's object?
6. **Rate limiting / abuse**: are unauthenticated write/expensive routes
   covered by a Cloudflare Rate Limiting rule or Turnstile challenge, or can
   they be hit unbounded?
7. Use isolated "hunters" per attack class — do not let an assumption from
   class 1 bias the check for class 4; each finding must be traceable to an
   exact file/line, not a general impression.

### Phase 3 — Candidate Validation
1. For every candidate finding, attempt to disprove it before writing it up:
   trace the exact data flow from the untrusted input to the sink.
2. Downgrade to `needs_validation` (not `confirmed`) any finding whose
   disproof depends on a fact you could not verify from the source — record
   the exact unresolved fact rather than guessing.
3. Re-check bindings and secrets against the **live** deployment
   (`wrangler secret list`, `wrangler deployments list`) since `wrangler.toml`
   in the repo can drift from what is actually deployed.

### Phase 4 — Structured Output & Reporting
1. Write every finding to `findings.json` against the audit's schema: file,
   line, attack class, verdict (`confirmed`/`needs_validation`/`rejected`),
   and the concrete reproduction/trace.
2. Have a second pass independently re-verify each `confirmed` finding's
   source trace before it is included in `REPORT.md`.
3. Generate `REPORT.md` as target-neutral prose from `findings.json` — never
   author the report by hand from memory, so its content always matches the
   machine-readable ledger.
4. Present `REPORT.md` plus the count of `needs_validation` items requiring
   human follow-up; do not silently drop unresolved items.

## Code & Configuration Exemplars

### Exemplar 1: Secret vs Plaintext Var (wrangler.jsonc)
```jsonc
{
  "vars": {
    // OK: not secret-shaped.
    "PUBLIC_API_BASE_URL": "https://api.example.com"
    // NOT OK if a token/key lands here — use `wrangler secret put` instead.
  }
}
```
```bash
# Correct: secret bound at deploy time, never committed.
wrangler secret put STRIPE_SECRET_KEY
wrangler secret list --env production
```

### Exemplar 2: JWT Verification Before Any Privileged Handler Runs
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 });

    const token = auth.slice('Bearer '.length);
    const verified = await verifyJwt(token, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }).catch(() => null);

    if (!verified) return new Response('Unauthorized', { status: 401 });
    // Only now touch KV/D1/R2 bindings.
    return handleRequest(request, env, verified);
  },
};
```

### Exemplar 3: `coverage-ledger.json` Shape
```json
{
  "attack_classes": [
    { "class": "binding-exposure", "status": "covered" },
    { "class": "secrets-handling", "status": "covered" },
    { "class": "cors-misconfig", "status": "covered" },
    { "class": "authn-authz-edge", "status": "covered" },
    { "class": "do-isolation", "status": "needs_validation" },
    { "class": "rate-limiting", "status": "covered" }
  ]
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: `wrangler.toml` and the Live Deployment Disagree
1. **Diagnosis**: A binding or secret in the repo's config no longer matches
   what `wrangler deployments list` / `wrangler secret list` shows deployed.
2. **Recovery Protocol**:
   - Step 1: Treat the live deployment as ground truth for what is actually
     exposed; note the drift in `findings.json` as its own finding.
   - Step 2: Confirm with the user before proposing a redeploy to reconcile.

### Scenario B: A Finding Cannot Be Fully Disproven or Confirmed
1. **Diagnosis**: The data flow crosses a boundary you cannot trace from
   source alone (e.g., a downstream service's behavior on a malformed input).
2. **Recovery Protocol**:
   - Step 1: Record it as `needs_validation` with the exact unresolved fact
     (never silently upgrade to `confirmed` or drop it).
   - Step 2: Name the specific test or live check that would resolve it.

### Scenario C: Durable Object ID Derives from Client Input
1. **Diagnosis**: `idFromName()` or `idFromString()` uses a value taken
   directly from the request without a tenant/session check.
2. **Recovery Protocol**:
   - Step 1: Confirm whether the ID space is meant to be public (some designs
     intentionally shard by a public key) — this is only a finding if
     cross-tenant access was not intended.
   - Step 2: If unintended, recommend deriving the ID from an
     already-authenticated identity, not raw request input.

## Verification & Validation Checklist
- [ ] `coverage-ledger.json` was written before hunting began and lists every
      attack class in Phase 2.
- [ ] No plaintext secret-shaped value exists in `wrangler.toml`/`wrangler.jsonc`
      or in application code/logs.
- [ ] Every privileged route verifies a signed token before touching any
      binding.
- [ ] CORS configuration never combines `Allow-Origin: *`-style reflection
      with `Allow-Credentials: true`.
- [ ] Unauthenticated write/expensive routes are rate-limited or challenged.
- [ ] Every `confirmed` finding in `findings.json` was independently
      re-verified in Phase 4 before `REPORT.md` was generated.
- [ ] Live deployment state (`wrangler secret list`/`deployments list`) was
      checked, not just the repo's config file.
