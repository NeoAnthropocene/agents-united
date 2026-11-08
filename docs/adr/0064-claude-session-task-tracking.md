# ADR 0064: Offer efficient session tracking independently of Agent Teams

Status: accepted for the Claude pilot; live behavior unverified

## Context

The refreshed, audited [tools reference](../../host-library/claude/pages/tools/tools-reference.md)
and [SDK todo guide](../../host-library/claude/pages/orchestration/agent-sdk-todo-tracking.md)
document model-dependent tool availability. Our launcher opted in only with
Agent Teams, the engineering lead requested TodoWrite unconditionally, and nine
native roles lacked tracking grants despite mentioning task updates. The
[subagent reference](../../host-library/claude/pages/agent/sub-agents.md)
also distinguishes ordinary background workers from team teammates.

## Decision

Task tracking is a coordination capability, separate from editing user files
and from enabling experimental teams. Add it to the missing native-role cores,
derive Claude grants from the existing non-file-mutating tool class and retain
read-only guards. No task APIs are invented for other Hosts.

The launcher opts a session in ephemerally by default, including standalone
sessions. An inherited explicit opt-out is preserved unless the caller
explicitly requests opt-in; an explicit API false skips the extra environment
value. This does not remove tools already provided by a Host. Do not modify the
Task-vs-TodoWrite selector, user settings, process-wide environment or argv.

Main agents use the available structured Task family for accepted multistep
slices. Workers discover actual availability, keep local TodoWrite distinct from
shared tasks, and fall back to brief/handoff progress when neither family is
available. Preserve scoped ownership, manual dependency checks, consultation
limits and completion evidence. Tool absence is not a retry loop or permission
to fabricate status. A Host task notification is not itself a todo update.

## Consequences

The opt-in supports the user's requested progress visibility without requiring
Agent Teams or charging a live test. It does not guarantee every worker surface
receives the tools. Background filters, split-pane inheritance and model/Host
version still matter. Internal coordination state does not authorize writes to
project files. Static grant and fake-runner tests prove our authored behavior;
actual live adherence remains a separate maintainer observation.

[Plan 048](../../plans/048-host-refresh-and-claude-session-tracking.md) records
the refresh evidence, compatibility deltas, holds and continuation order.

## 2026-11-07 — revision evidence refinement

The completed pilots exposed a task left complete during a requested fix.
The native runbooks now reopen the assigned task or link an owned fix task
before authorized revision, invalidate affected dependent acceptance and close
only after changed-output readback and applicable rechecks. Workers unable to
update tasks relay the actual ID and requested status to the lead. This uses
the existing Task family and message fallback without new grants. Reports name
who executed QA and its reviewed revision; a producer's rerun does not create
an independent reviewer event. The bounded static/native conformance checks
pass; adherence to the amended instructions remains unverified live.
