# Persistent Rule: Multi-Agent Delegation & Coordination Protocol

## Purpose & Scope
This rule governs interactions, task distribution, lifecycle hooks, and reporting standards between Lead Orchestrators and specialized sub-agents.

---

## 1. Separation of Responsibilities
- **Lead Orchestrators**:
  - Analyze user requirements and formulate step-by-step implementation plans.
  - Route tasks to specialized sub-agents via structured prompts.
  - Synthesize sub-agent outputs and enforce verification phase gates.
- **Specialized Sub-Agents**:
  - Execute focused domain tasks (e.g. `subagent-ios-architect`, `subagent-data-engineer`, `subagent-qa-automation-lead`).
  - Report findings, code modifications, and test results back to the caller without executing unauthorized out-of-scope work.

---

## 2. Lifecycle Hook Governance
All agent markdown manifests must support declarative lifecycle hooks:
- **`PreInvocation`**: Executed before task execution begins to verify preconditions, workspace paths, and active branch safety.
- **`PostInvocation`**: Executed upon task completion to verify test pass rates, lint status, and artifact generation.
- **`PreToolUse`**: Guards sensitive commands against destructive or unconfirmed executions.
- **`PostToolUse`**: Validates tool output integrity and logs audit trails.

---

## 3. Structured Deliverable Standard
Sub-agents must provide structured outputs containing:
1. **Executive Summary**: 1-2 sentence overview of actions taken.
2. **File Modifications**: Clickable file links and concise change summaries.
3. **Verification Results**: Command output and test pass indicators.
4. **Next Actions / Risks**: Open decisions requiring human or orchestrator review.
