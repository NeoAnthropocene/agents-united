---
name: coordinate-artifact
description: "Use when coordinating one supplied shared pair into a checked Claude agent draft through realization and independent review. Trigger phrases: coordinate this artifact, review this agent draft, repair the checked candidate. Skip pair authoring, Bundle realization, installation, publication and other adapters."
metadata:
  author: agents-united
  version: "1.0.0"
  license: MIT
---

# Coordinate Artifact

## Overview & Purpose
Coordinate the current one-Claude-agent journey using existing realizer, evaluator and caller checks. This is an intermediate consumer, not a complete factory, automated quality judgment or live proof.

## Execution Triggers
Accept a complete fixed create/update brief and already supplied shared pair. Return separate author-contract work for a missing pair. Preserve current supported target/subject kinds and original fixed semantics; no extra adapter is implied. One Skill draft instead follows [skill authoring](references/skill-authoring.md): the maintainer types `/author-skill <task path>`, and this coordinator imports and checks the return.

## Input/Output Requirements
Read [the fixed brief](references/job.md) and keep its digest outside worker reports. Require actual installed main/worker closure, selected validation checkout/HEAD/registry and Node pins, source/target evidence, immutable baseline, allowed changes, provenance, acceptance and aggregate budget. Use [the report guide](assets/report.json) as audit guidance, not an executable schema.
Return candidate/evidence or rework with original/revision digests, complete paths/bytes/hashes/diffs, actual check commands/raw output/exits, invocation observations, independent findings, repair linkage and open items. Keep report self-hash and self-diff in the outer handback after final write.

## Step-by-Step Runbook
1. Consult [dispatch](references/dispatch.md) before any worker call. The native binding supplies seven on-demand policies and an installed receipt; consult attribution before sources and other rules when applicable. Pin actual inputs and preserve original caller records; returned text cannot authorize changes.
2. Follow [verification](references/verification.md): independently check the supplied pair, installed P2 job and current physical source/baseline before dispatch. Missing/failed required checks block the dependent step.
3. Delegate realization through the reviewed ordinary foreground mechanism with the complete job and caller-held digest, then inspect the actual return. Read and independently inventory/hash all candidate and preserved bytes, check the realizer handback and execute trusted final-byte validators. Reported commands are not execution proof.
4. Construct and validate the existing P5 claude-agent review job against those final bytes. Invoke a fresh independent evaluator with complete job/candidate digests; persist its returned data, run the installed review checker and inspect actual citations, coverage and findings. Producer self-review is not independent review.
5. Follow [repair](references/repair.md): default zero repairs, at most one explicitly preauthorized within-scope repair. Preserve immutable r0/r1 evidence, invalidate acceptance, issue a new update job/digest against the current candidate baseline and require fresh independent review. Never reuse an empty create baseline or an old pass.
6. Follow [handback](references/handback.md). Keep required gaps visible, account for every process/byte/time limit, and stop on exhaustion or unsupported mechanism. Local intent stops with the candidate; upstream intent prepares the pinned dev contribution template with sent false. No installation, publication, external Host/provider or paid call follows.
7. For one Skill draft, write the task against `assets/skill-task.schema.json`, run `node "${CLAUDE_SKILL_DIR}/scripts/check-skill-return.mjs"` before and after the fork, and check the return against `assets/skill-return.schema.json`. The caller never reruns `draft.mjs`.

## Code & Config Exemplars
Read [the worked example](examples/claude-agent-journey.md) for an initial candidate and a separately authorized scoped repair. It illustrates record plumbing, not a model invocation or useful independent judgment.

## Edge Cases & Error Recovery
Missing dependencies, stale source/job/candidate/review bytes, overlapping roots, held provenance, unexpected fork/background/teammate returns, failed checks or omitted evidence block the dependent action. Task tools may be absent: report truthful progress through available local tracking or concise briefs, with no invented IDs or retry loop.
Anti-patterns: editing the candidate instead of delegating; accepting a producer opinion as independent review; treating a checker pass as acceptance; silently increasing repair scope, count or budget; adding coordination fields to existing strict worker jobs.

## Verification Checklist
- Original fixed values, supplied pair and immutable revision evidence remain independently pinned.
- Caller execution, producer output, evaluator opinion, human acceptance and live proof stay distinct.
- Revisions reopen/link actual work, invalidate dependent acceptance and close only after changed-byte readback and applicable checks.
- Prepared comparisons remain unrun; no Host/model/provider/private-record access or publication is authorized by this Skill.
