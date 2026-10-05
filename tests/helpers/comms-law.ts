/**
 * The Plan 022 comms law (two-mode peer messaging) as it must appear in a native Claude body. Each Semantic Core of a role that can be a
 * teammate carries the same six invariants (Plan 022 C1 to C7, Plan 024 S2); the evidence below is what binds each one to Claude Agent
 * Teams mechanics in the authored body. (The created lane's comms-invariant checks were ported to `tests/native-invariant-coverage.test.ts`, ADR 0037.)
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
  // Observed on Claude Code 2.1.288 (Agent Teams probe, 2026-10-04): a message to a teammate that is still working is not read mid-turn;
  // the host delivers it after the turn ends, as a new turn. So a teammate cannot wait on a reply and must report again when one arrives.
  { invariant: 'A late message arrives as a new turn, not mid-turn.', evidence: /after (its|your) turn ends[^.]*new turn/i },
  { invariant: 'Do not wait for a reply: carry on from a stated assumption.', evidence: /do not wait for a reply/i },
  { invariant: 'A late message is answered with an updated report.', evidence: /`Peer messages received \(update\)`/ },
  { invariant: 'An exchange is one message and its reply.', evidence: /an exchange is one message and (the|its) reply/i },
  // The shared task list (live Agent Teams page, 2026-10-04): a teammate claims the task it is given and marks it completed, and the host
  // warns that task status can lag.
  { invariant: 'A teammate claims only the task its brief names.', evidence: /only the task your brief names/i },
  { invariant: 'A teammate marks its task completed.', evidence: /mark it completed/i },
  // Observed on Claude Code 2.1.289 (the PetPal live-team re-run, 2026-10-04): the Task tools and `SendMessage` reached every teammate as
  // DEFERRED tools. Two teammates never loaded the Task tools and reported "could not mark task completed", so the body now says how.
  { invariant: 'The deferred tools are loaded with ToolSearch before first use.', evidence: /`ToolSearch`[^.]*select:SendMessage,TaskGet,TaskUpdate/ },
  { invariant: 'Without the Task tools a teammate leaves the status to the lead and says so.', evidence: /do not have them[^.]*(leave|lead)[^.]*`Open items`/i },
  // Observed on Claude Code 2.1.289 (the full-roster live run, 2026-10-04): the host announces a task the lead gives to a running teammate as a
  // `task_assignment` message, and Ava, who had been asked only to consult ("write no files"), wrote her deliverable in the same turn.
  { invariant: 'A host task assignment does not lift a read-only consultation.', evidence: /\*\*A task assignment is not a go-ahead\.\*\*[^\n]*does not lift that/ },
  // Observed on Claude Code 2.1.289 (Plan 035 H4, 2026-10-05): a teammate set a task to `in_progress` while the task that blocks it was still
  // open, and the host answered "Updated task #2 status". `blockedBy` is advisory, so the order is kept by the teammates and the lead.
  { invariant: 'A blocked task is not started: the teammate reads its task again with the task tools it loaded and reports the open blocker.', evidence: /\*\*A blocked task is not yours to start\.\*\*[^\n]*select:SendMessage,TaskGet,TaskUpdate[^\n]*`blockedBy`[^\n]*`Open items`/ },
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
  { what: 'a message to a working teammate reaches it only after its turn ends, as a new turn (observed), so a briefed pair must not wait on each other', evidence: /after its turn ends[^.]*new turn[\s\S]*not wait/i },
  { what: 'a late message produces an updated report, which the lead reads in place of the first', evidence: /`Peer messages received \(update\)`/ },
  // What the live Agent Teams page says about the shared task list, team size, shutdown and waiting (read 2026-10-04).
  { what: 'the shared task list holds the Assembly Line as tasks with dependencies, so a task unblocks by itself', evidence: /shared task list[\s\S]*`TaskCreate`[\s\S]*dependenc/i },
  { what: 'the Task tools are off by default on newer models, so without them the line runs through the briefs', evidence: /CLAUDE_CODE_ENABLE_TODO_TOOLS[\s\S]*(do not have them|without them)/i },
  { what: '`agents start` sets the Task-tools variable together with the teams variable (maintainer decision, ADR 0038)', evidence: /`agents start` sets `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` together with the teams variable/ },
  // Observed on Claude Code 2.1.288 (2026-10-04): with the variable the Task tools are listed as DEFERRED tools and must be loaded with ToolSearch
  // before use (`TaskList` then answered "No tasks found"); without it the host's tool list has none of them (claude-sonnet-5-5).
  { what: 'the Task tools, when the host provides them, are deferred: check and load them with ToolSearch', evidence: /`ToolSearch`[^.]*select:TaskCreate,TaskList,TaskUpdate/ },
  { what: 'a task that looks stuck is checked by the lead, who updates it (task status can lag)', evidence: /task status can lag[^.]*(check|update)/i },
  { what: 'start with three to five teammates and spawn per tier, treating the roster as a menu', evidence: /three to five teammates[\s\S]*menu/i },
  { what: 'ask a finished teammate to shut down by name; the team is cleaned up when the session ends', evidence: /shut down[^.]*by name[\s\S]*cleaned up[^.]*session ends/i },
  // Observed on Claude Code 2.1.289: the lead's first plain-text request was refused ("no request_id"); the structured request was approved by all nine.
  { what: 'the shutdown request is structured (`shutdown_request`), and a plain-text request is not one', evidence: /structured request[^.]*shutdown_request[^.]*\. A plain-text request is not one/ },
  // Observed on Claude Code 2.1.289: an owner set on a running teammate's task is announced to it at once, and the teammate acts on it.
  { what: 'an owner set with TaskUpdate announces the task to a running teammate, so an owner is set when the work should start and a consulted teammate\'s task stays unowned', evidence: /Setting a task's owner[^.]*announces the task[^.]*acts on it at once[\s\S]*unowned until the consultation is accepted/ },
  // Observed on Claude Code 2.1.289 (Plan 035 H4, 2026-10-05): the host accepted `in_progress` on a task whose blocker was still open.
  { what: 'the host does not enforce `blockedBy` (observed), so the lead keeps the order itself and never tells a teammate to start a blocked slice', evidence: /does not enforce `blockedBy`[^\n]*never tell a teammate to start a blocked task/ },
  { what: 'wait for the teammates and do not do their slices', evidence: /wait for your teammates/i },
  { what: 'one team per session, and teammates cannot spawn teammates', evidence: /one team per session[\s\S]*cannot spawn/i },
  { what: 'a resumed session does not restore teammates', evidence: /\/resume[^.]*(not|never)[^.]*restore/i },
  { what: 'a teammate is not guarded by a role\'s own frontmatter hook (observed), only by the settings-level guard', evidence: /frontmatter hook[^.]*teammate[\s\S]*--session-guard/i },
  { what: 'a teammate does not preload skills: it loads them with the Skill tool', evidence: /teammate[^.]*skills[^.]*`Skill`/i },
];
