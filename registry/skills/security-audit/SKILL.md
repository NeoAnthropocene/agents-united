---
name: security-audit
description: Production-grade Security Audit playbook for vulnerability
  assessment, SAST scanning, and zero-trust verification.
metadata:
  author: agents-united
  version: 2.0.0
  icon: 🔒
disable-slash-command: true
---

# Application Security Audit, Threat Modeling & OWASP Top 10

## Overview & Purpose
The Application Security Audit, Threat Modeling & OWASP Top 10 skill provides a deterministic, battle-tested framework for executing security-audit processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking security-audit.
- Auditing, implementing, or standardizing security-audit procedures.
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
| Specification Document | `docs/security-audit/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/security-audit/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/security-audit/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Threat Modeling & Attack Surface Enumeration
1. Map complete application attack surface: public endpoints, input parameters, headers, file uploads.
2. Apply STRIDE threat modeling (Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege).
3. Identify high-risk assets: PII data, authentication credentials, payment flows, internal admin tools.
4. Review trust boundaries between client, gateway, microservices, and third-party APIs.
5. Establish security audit scope and rules of engagement.

### Phase 2: OWASP Top 10 Vulnerability Assessment
1. A01 Broken Access Control: Audit authorization checks on all ID-based resource queries (prevent IDOR).
2. A02 Cryptographic Failures: Verify TLS 1.3 enforcement, strong hashing (Argon2id / bcrypt), and secret management.
3. A03 Injection: Verify parameterized SQL queries (no string concatenation) and command execution sanitization.
4. A04 Insecure Design: Audit business logic workflows for race conditions and rate-limiting enforcement.
5. A05 Security Misconfiguration: Check CORS policies, security headers (CSP, HSTS, X-Frame-Options), and default credentials.

### Phase 3: Automated SAST & Secret Scanning
1. Run static application security testing (SAST) using Semgrep / SonarQube.
2. Scan repository history for leaked secrets and API keys using Gitleaks / Trufflehog.
3. Audit third-party dependencies for known vulnerabilities using npm audit and Snyk.
4. Verify that no hardcoded credentials exist in source code or docker images.
5. Document findings in unified vulnerability register.

### Phase 4: Vulnerability Remediation & Hardening
1. Remediate all Critical and High severity findings immediately.
2. Implement Content Security Policy (CSP) headers restricting script execution sources.
3. Enforce strict input validation using schema libraries (Zod / Joi) with rejection of unknown properties.
4. Implement rate limiting and brute-force protection on authentication routes.
5. Re-test patched code to verify complete vulnerability closure.

### Phase 5: Security Report Publication & CI Gate Enforcement
1. Generate comprehensive security audit report with executive summary and technical details.
2. Configure automated security scans in GitHub Actions CI pipeline.
3. Set CI build failure thresholds on any newly introduced High or Critical vulnerabilities.
4. Establish schedule for recurring automated security reviews.
5. Sign off on security compliance release gate.

## Code & Configuration Exemplars

### Exemplar 1: Application Security Audit, Threat Modeling & OWASP Top 10 Configuration & Specification
```yaml
// Path traversal prevention exemplar
import path from 'node:path';

export function resolveSafePath(baseDir: string, userInput: string): string {
  const safePath = path.normalize(path.join(baseDir, userInput));
  if (!safePath.startsWith(path.resolve(baseDir))) {
    throw new Error('SecurityException: Path traversal attempt detected');
  }
  return safePath;
}
```

### Exemplar 2: Application Security Audit, Threat Modeling & OWASP Top 10 TypeScript Type Contract
```typescript
export interface SecurityAuditReport {
  timestamp: string;
  scope: string;
  owaspCompliance: Record<string, 'PASS' | 'FAIL' | 'NOT_APPLICABLE'>;
  vulnerabilities: Array<{
    cwe: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    location: string;
    description: string;
    remediation: string;
  }>;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Application Security Audit, Threat Modeling & OWASP Top 10
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
