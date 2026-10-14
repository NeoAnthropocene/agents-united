# Draft upstream report: shutdown approvals change membership without lead lifecycle notices

**Draft only; not submitted.** The behavior was observed in the reviewed session below. Whether a model/TUI notice is part of the intended shutdown contract is the question for the host maintainers.

## Environment and scenario

- Claude Code 2.1.299, Windows, interactive TUI, in-process teammates, Sonnet/low.
- Agent teams and task tools enabled; no MCP servers, external services or paid image calls.
- Fresh session with the host's default UUID: no `--session-id`, `--resume` or `--continue`.
- Session `b054f69a-cbc6-4f36-a242-e4052aff3088`; team `session-b054f69a`; config lead session ID matches.
- Native digital-agency definitions from [agents-united dev 46cb8d2](https://github.com/NeoAnthropocene/agents-united/tree/46cb8d2928d0ad4cc4887fd82679f449724b9806), with observation-only diagnostic hooks and scoped filesystem event capture. Neither hooks nor observer modify host mailboxes, config or lifecycle handling.

## Reproduction sequence

1. Start a fresh interactive session in a disposable project with the native digital-agency lead and two configured specialists, Ava and Kaan. Use the normal host-generated session identity.
2. Have each specialist write a small synthetic deliverable. Require a named peer question/reply and a revision by those same specialists, with their final reports sent to the lead.
3. Read and verify both revised deliverables, then send a structured shutdown request to each named teammate.
4. Each teammate responds with `message: {type: "shutdown_response", request_id: <received request id>, approve: true}` using SendMessage. The captured tool description identifies this as a legacy protocol response.
5. Return the verified work after accepted dispatch. On a later human turn, check what lifecycle evidence has reached the lead without polling or messaging finished peers.

This is the observed sequence, not a claim that a stripped-down built-in default-launch reproduction has been run. A previous built-in control had the same missing-notice symptom but supplied a UUID and missed one final work handoff; its mailbox observer targeted the wrong directory. It is supporting evidence with that limitation.

## Actual result

Both revised final reports reached the lead. Both shutdown requests were accepted, and both `approve: true` replies had successful PostToolUse callbacks correlated by tool-use ID.

- Ava approval appears in the **correct lead inbox** at 09:55:04.146 UTC. By 09:55:05.141, Ava has left the config's members array and the inbox is empty.
- Kaan approval appears at 09:55:05.651 UTC. Only the lead remains in membership at 09:55:06.137; the inbox is empty at 09:55:06.141.
- No `shutdown_approved`, shutdown response or `teammate_terminated` notice appears as a delivered lifecycle event in the lead record, including the later human turn.
- The maintainer reports both peers disappearing from the TUI rows and no displayed termination notice. Physical process exit was not independently measured.
- No lead errors, containment denials or observer errors occurred. Installed definition and helper hashes matched preparation.

The lead reports verified work 6.135 seconds after the final accepted request and preserves completion on the later turn. This avoids the application workflow hanging but leaves shutdown visibility unresolved.

## Requested clarification

Are `shutdown_approved` frames intentionally consumed as internal host protocol without a model or TUI notification in 2.1.299? If so, what supported signal should a lead use when reporting graceful-shutdown evidence? If a lifecycle notice is expected, the trace narrows the missing handoff to after the successful mailbox write and membership update.

The [agent-team documentation](https://code.claude.com/docs/en/agent-teams#shut-down-teammates) explains graceful approval, but does not explicitly promise a named termination notice. We therefore report an observed visibility gap and ask about the intended contract rather than claim a confirmed implementation cause.

## Evidence and privacy

[Sanitized evidence](2026-10-14-shutdown-diagnostic-evidence.json) includes matching identities, correlated approvals, state transitions, timings and record-type audit counts. No raw prompt snapshot, private host configuration, provider key or unrelated session data is included. File observations can miss transient states; positive captured frames and membership updates support the findings. No further paid reproduction was run, and no host data was edited.
