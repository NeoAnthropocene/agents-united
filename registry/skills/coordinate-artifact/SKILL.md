---
name: coordinate-artifact
description: "Use when coordinating one supplied shared pair into a checked Claude agent draft through realization and independent review. Trigger phrases: coordinate this artifact, review this agent draft, repair the checked candidate, plan a host-update sync. Skip pair authoring, Bundle realization, installation, publication, library refresh, clearing a hold and other adapters."
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Coordinate Artifact

## Overview & Purpose
Coordinate the current one-Claude-agent journey using existing realizer, evaluator, host-update sync and caller checks.

## Execution Triggers
Accept a complete fixed create/update brief and already supplied shared pair. Return separate author-contract work for a missing pair. Preserve current supported target/subject kinds and original fixed semantics; no extra adapter is implied. One Skill draft follows [skill authoring](references/skill-authoring.md), a shared definition-and-contract draft [contract authoring](references/contract-authoring.md) and a Bundle proposal [bundle authoring](references/bundle-authoring.md); the maintainer types `/author-skill`, `/author-contract` or `/author-bundle <task path>`. A host-update sync plan is a separate read-only route (step 8).

## Input/Output Requirements
Read [the fixed brief](references/job.md) and keep its digest outside worker reports. Require actual installed main/worker closure, selected validation checkout/HEAD/registry and Node pins, source/target evidence, immutable baseline, allowed changes, provenance, acceptance and per-job budgets. Use [the report guide](assets/report.json) as audit guidance, not an executable schema.
Return candidate/evidence or rework with original/revision digests, complete paths/bytes/hashes/diffs, actual check commands/raw output/exits, invocation observations, independent findings, repair linkage and open items.

## Step-by-Step Runbook
1. Consult [dispatch](references/dispatch.md) before any worker call. The native binding supplies seven on-demand policies and an installed receipt; consult attribution before sources and other rules when applicable.
2. Follow [verification](references/verification.md): independently check the supplied pair, installed P2 job and current physical source/baseline before dispatch.
3. Give the realizer the complete job and caller-held digest. Start every worker as an ordinary subagent and, when it runs in the background, wait for its hand-back as the waiting rule in [dispatch](references/dispatch.md) says. Then inspect the actual return. Read and independently inventory/hash all candidate and preserved bytes, check the realizer handback and run trusted final-byte validators.
4. Build and validate the existing P5 claude-agent review job against those final bytes. Start a fresh independent evaluator the same way, with complete job/candidate digests; save its returned data, run the installed review checker and inspect actual citations, coverage and findings.
5. Follow [repair](references/repair.md): default zero repairs, at most one explicitly preauthorized scoped repair. Preserve immutable r0/r1 evidence, invalidate acceptance, issue a new update job/digest against the current candidate baseline and require fresh independent review.
6. Follow [handback](references/handback.md); upstream intent also follows [contribution](references/contribution.md). Keep required gaps visible, account for each job's caps and the turn/repair limits, and stop on exhaustion or unsupported mechanism.
7. Check a draft's task and return with its schemas, running its checker pre/postflight as `node "${CLAUDE_SKILL_DIR}/<checker>"`: Skill `assets/skill-task.schema.json`, `scripts/check-skill-return.mjs`, `assets/skill-return.schema.json`; shared pair `assets/contract-task.schema.json`, `scripts/check-contract-return.mjs`, `assets/contract-return.schema.json`; Bundle `assets/bundle-task.schema.json`, `scripts/check-bundle-return.mjs`, `assets/bundle-return.schema.json`. Claude paths: `${CLAUDE_SKILL_DIR}/scripts/check-skill-return.mjs`, `${CLAUDE_SKILL_DIR}/scripts/check-contract-return.mjs` and `${CLAUDE_SKILL_DIR}/scripts/check-bundle-return.mjs`. Never rerun `draft.mjs` or `draft-pair.mjs`.
8. For host-update sync, follow [host-update sync](references/host-sync.md): assemble the sync job, run the sync checker before and after the read-only `factory-sync` worker, and report affected artifacts. Nothing is implemented; no hold is cleared.

## Code & Config Exemplars
Read [the worked example](examples/claude-agent-journey.md) for an initial candidate and a separately authorized scoped repair.

## Edge Cases & Error Recovery
Missing dependencies, stale source/job/candidate/review bytes, overlapping roots, held provenance, unexpected fork/teammate returns, failed checks or omitted evidence block the dependent action.
Anti-patterns: editing the candidate instead of delegating; accepting a producer opinion as independent review; treating a checker pass as acceptance; silently increasing repair scope, count or budget; adding coordination fields to existing strict worker jobs.

## Verification Checklist
- Original fixed values, supplied pair and immutable revision evidence remain independently pinned.
- Caller execution, producer output, evaluator opinion, human acceptance and live proof stay distinct.
- Prepared comparisons remain unrun; no Host/model/provider/private-record access or publication is authorized by this Skill.
