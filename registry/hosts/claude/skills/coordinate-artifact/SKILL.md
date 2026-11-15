---
name: coordinate-artifact
description: "Use when coordinating one supplied shared pair into a checked Claude agent draft through realization and independent review. Trigger phrases: coordinate this artifact, review this agent draft, repair the checked candidate, plan a host-update sync. Skip pair authoring, Bundle realization, installation, publication, library refresh, clearing a hold and other adapters."
user-invocable: false
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Coordinate Artifact

## Overview & Purpose
Coordinate the current one-Claude-agent journey using existing realizer, evaluator, host-update sync and caller checks. This is an intermediate consumer, not a complete factory, automated quality judgment or live proof.

## Execution Triggers
Accept a complete fixed create/update brief and already supplied shared pair. Return separate author-contract work for a missing pair. Preserve current supported target/subject kinds and original fixed semantics; no extra adapter is implied. One Skill draft follows [skill authoring](references/skill-authoring.md) and a shared definition-and-contract draft follows [contract authoring](references/contract-authoring.md), with the maintainer typing `/author-skill <task path>` or `/author-contract <task path>`. A host-update sync plan is a separate read-only route (step 8).

## Input/Output Requirements
Read [the fixed brief](references/job.md) and keep its digest outside worker reports. Require actual installed main/worker closure, selected validation checkout/HEAD/registry and Node pins, source/target evidence, immutable baseline, allowed changes, provenance, acceptance and aggregate budget. Use [the report guide](assets/report.json) as audit guidance, not an executable schema.
Return candidate/evidence or rework with original/revision digests, complete paths/bytes/hashes/diffs, actual check commands/raw output/exits, invocation observations, independent findings, repair linkage and open items.

## Step-by-Step Runbook
1. Consult [dispatch](references/dispatch.md) before any worker call. Read [attribution](references/rules/skill-attribution.md) before sources; consult [git](references/rules/git-guardrails.md), [tests](references/rules/test-driven-development.md), [architecture](references/rules/clean-code-and-architecture.md), [domain](references/rules/domain-modeling-and-adr.md), [coordination](references/rules/multi-agent-coordination.md) and [quality](references/rules/quality-aesthetics-accessibility.md) when applicable. Inspect the [installed receipt](assets/claude-binding.json).
2. Follow [verification](references/verification.md): independently check the supplied pair, installed P2 job and current physical source/baseline before dispatch.
3. Delegate realization through the reviewed ordinary foreground mechanism with the complete job and caller-held digest, then inspect the actual return. Read and independently inventory/hash all candidate and preserved bytes, check the realizer handback and run trusted final-byte validators.
4. Build and validate the existing P5 claude-agent review job against those final bytes. Invoke a fresh independent evaluator with complete job/candidate digests; save its returned data, run the installed review checker and inspect actual citations, coverage and findings.
5. Follow [repair](references/repair.md): default zero repairs, at most one explicitly preauthorized scoped repair. Preserve immutable r0/r1 evidence, invalidate acceptance, issue a new update job/digest against the current candidate baseline and require fresh independent review.
6. Follow [handback](references/handback.md); upstream intent also follows [contribution](references/contribution.md). Keep required gaps visible, account for every process/byte/time limit, and stop on exhaustion or unsupported mechanism.
7. For a Skill draft, check the task with `assets/skill-task.schema.json`, run `node "${CLAUDE_SKILL_DIR}/scripts/check-skill-return.mjs"` pre/postflight, and check `assets/skill-return.schema.json`. For a shared definition/contract draft, use `assets/contract-task.schema.json`, `node "${CLAUDE_SKILL_DIR}/scripts/check-contract-return.mjs"` and `assets/contract-return.schema.json`. Never rerun `draft.mjs` or `draft-pair.mjs`.
8. For host-update sync, follow [host-update sync](references/host-sync.md): assemble the sync job, run the sync checker before and after the read-only `factory-sync` worker, and report affected artifacts. Nothing is implemented; no hold is cleared.

## Code & Config Exemplars
Read [the worked example](examples/claude-agent-journey.md) for an initial candidate and a separately authorized scoped repair. It illustrates record plumbing, not a model invocation or useful independent judgment.

## Edge Cases & Error Recovery
Missing dependencies, stale source/job/candidate/review bytes, overlapping roots, held provenance, unexpected fork/background/teammate returns, failed checks or omitted evidence block the dependent action.
Anti-patterns: editing the candidate instead of delegating; accepting a producer opinion as independent review; treating a checker pass as acceptance; silently increasing repair scope, count or budget; adding coordination fields to existing strict worker jobs.

## Verification Checklist
- Original fixed values, supplied pair and immutable revision evidence remain independently pinned.
- Caller execution, producer output, evaluator opinion, human acceptance and live proof stay distinct.
- Prepared comparisons remain unrun; no Host/model/provider/private-record access or publication is authorized by this Skill.
