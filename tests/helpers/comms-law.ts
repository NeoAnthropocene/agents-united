/**
 * The Plan 022 comms law (two-mode peer messaging) as it must appear in a native Claude body. Each Semantic Core of a role that can be a
 * teammate carries the same six invariants (Plan 022 C1 to C7, Plan 024 S2); the evidence below is what binds each one to Claude Agent
 * Teams mechanics in the authored body. Slice 3 (retire `creation/claude.ts`) ports the created lane's comms-invariant checks onto this.
 */

/** The shared peer-messaging invariants every teammate-capable core states, verbatim. */
export const TEAMMATE_COMMS_INVARIANTS: readonly string[] = [
  'Hand your result back, not across.',
  'Bounded peer exchange only when genuinely required.',
  'At most two peer exchanges per specialist pair and one directed question per peer per planning round.',
  'Check for delivered peer messages before the final report.',
  'The handoff report lists peer messages received and open items.',
  'Message a peer directly only in team mode, when the brief lists that peer.',
];

/** What a teammate's authored body must say to bind each invariant to the host (checked against the text after the floor). */
export const TEAMMATE_COMMS_EVIDENCE: ReadonlyArray<{ invariant: string; evidence: RegExp }> = [
  { invariant: TEAMMATE_COMMS_INVARIANTS[0], evidence: /one hand-?back/i },
  { invariant: TEAMMATE_COMMS_INVARIANTS[1], evidence: /only when a peer'?s answer is genuinely required/i },
  { invariant: TEAMMATE_COMMS_INVARIANTS[2], evidence: /at most two exchanges per pair/i },
  { invariant: TEAMMATE_COMMS_INVARIANTS[3], evidence: /check your inbox before/i },
  { invariant: TEAMMATE_COMMS_INVARIANTS[4], evidence: /`Peer messages received`[\s\S]*`Open items`/ },
  { invariant: TEAMMATE_COMMS_INVARIANTS[5], evidence: /team mode[^.]*brief lists each peer[^.]*`SendMessage`/i },
  // The default is the relay, and a missing peer never blocks.
  { invariant: 'Relay mode is the default.', evidence: /If your brief does not name a mode, you are in relay mode/ },
  { invariant: 'Never hang on a missing peer.', evidence: /stated assumption/i },
];

/** What the lead's authored body must say to run a live team under the same law. */
export const LEAD_COMMS_EVIDENCE: ReadonlyArray<{ what: string; evidence: RegExp }> = [
  { what: 'Agent Teams are an opt-in, interactive-only host feature switched on by an environment variable', evidence: /CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS/ },
  { what: 'a teammate is spawned by an Agent call that names it and its type', evidence: /`Agent`[^.]*`name`[^.]*`subagent_type`/ },
  { what: 'the brief carries objective, scope, acceptance evidence, peers and report format', evidence: /Objective[\s\S]*Scope[\s\S]*Acceptance evidence[\s\S]*Peers[\s\S]*Report format/ },
  { what: 'contract first', evidence: /Contract first/ },
  { what: 'the lead reads every report\'s peer messages and open items', evidence: /`Peer messages received`[\s\S]*`Open items`/ },
  { what: 'the exchange budget', evidence: /at most two exchanges per pair/i },
  { what: 'both modes, with relay as the fallback', evidence: /team mode[\s\S]*relay mode/i },
  { what: 'the lead is the relay and wakes a finished teammate', evidence: /wake/i },
  { what: 'one team per session, and teammates cannot spawn teammates', evidence: /one team per session[\s\S]*cannot spawn/i },
  { what: 'a resumed session does not restore teammates', evidence: /\/resume[^.]*(not|never)[^.]*restore/i },
  { what: 'a teammate is not guarded by a role\'s own frontmatter hook (observed), only by the settings-level guard', evidence: /frontmatter hook[^.]*teammate[\s\S]*--session-guard/i },
  { what: 'a teammate does not preload skills: it loads them with the Skill tool', evidence: /teammate[^.]*skills[^.]*`Skill`/i },
];
