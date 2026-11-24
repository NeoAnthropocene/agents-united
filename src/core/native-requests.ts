/**
 * ADR 0076 - the "requests" block of a native Claude role. On this host a specialist often lacks a tool its work needs (it cannot ask the user,
 * hold a shell, watch a task, schedule, run a saved workflow or start another specialist), so it asks its lead in its report, and the lead acts
 * on the request with its own tool and returns the result to the same specialist. The wording is generated here, once, between two markers in
 * every role file: a specialist's text lists the request types its own tools leave open, a lead's text says how it acts on them.
 * Pure string work: no I/O, no clock.
 */

import { anchorHeadingPoint, checkBlock, writeBlock, type BlockMarkers } from './native-blocks.js';

export const REQUESTS_START =
  '<!-- agents-united:requests:start (generated from src/core/native-requests.ts and the tools line, regenerate with UPDATE_NATIVE=1 npx vitest run tests/native-claude-agents.test.ts, do not edit) -->';
export const REQUESTS_END = '<!-- agents-united:requests:end -->';

/** Roles outside the protocol, they carry no block: the factory's three fixed-job roles with their own hand-back contract, its coordinator, and the universal front door (no `Agent` tool, no specialist, it routes and instructs). */
export const REQUESTS_EXEMPT_ROLES: readonly string[] = ['factory-realizer', 'factory-evaluator', 'factory-sync', 'orchestrator-agent-factory', 'orchestrator-universal'];

/** A specialist asks (`specialist`); a lead (`coordinator`) acts. */
export type RequestsKind = 'specialist' | 'coordinator';

interface RequestType {
  name: string;
  /** The type is open to a role when it holds none of these tools. */
  heldBy: readonly string[];
}

/** The seven request types, in the fixed order of the block. `use-server` is always open: no tool of the role makes the lead's servers redundant. */
const TYPES: readonly RequestType[] = [
  { name: 'ask-user', heldBy: ['AskUserQuestion'] },
  { name: 'run-command', heldBy: ['Bash', 'PowerShell'] },
  { name: 'watch', heldBy: ['Monitor'] },
  { name: 'schedule', heldBy: ['CronCreate', 'ScheduleWakeup'] },
  { name: 'run-workflow', heldBy: ['Workflow'] },
  { name: 'delegate', heldBy: ['Agent'] },
  { name: 'use-server', heldBy: [] },
];

const OPEN_TYPES = '{{OPEN_TYPES}}';

const SPECIALIST_TEXT: readonly string[] = [
  '## Requests for the lead',
  '',
  'Some things your work needs are not yours to do on this host and go through the lead: asking the user, running a command when you hold no shell, watching a long task, a schedule, a saved workflow, starting another specialist, or a connected server you do not hold. Do not drop that part of the work and do not improvise it. Request it in your report, in a section named `Requests for the lead` that is always present (write "none" when you have no request). The lead is the agent that started you. When a user\'s own session runs you as its main agent there is no lead: ask the user in plain prose and say plainly what your tools cannot do. `Open items` keeps its meaning: gaps, what you could not verify, and questions for a peer.',
  '',
  `By your tools on this host, the types open to you are: ${OPEN_TYPES}. Never request a type that is not in this list: you hold the tool for it, so use it.`,
  '',
  'Each request is one entry with these fields, in this order:',
  '',
  '1. `R<n>`, its type, and `blocking` (this part of your work stops without it) or `non-blocking` (you went on from the assumption you state). Count on from your last entry in a later report: a number is never used twice in one piece of work.',
  '2. `Why`: one sentence.',
  '3. The fields of its type, from the table.',
  '4. `If declined or unanswered`: the assumption you go on with.',
  '5. `With the result I will`: one sentence.',
  '',
  'Every entry carries all five parts. Write `If declined or unanswered` and `With the result I will` even for a non-blocking `schedule` request.',
  '',
  '| Type | Fields |',
  '|---|---|',
  '| `ask-user` | The question in plain language; 2 to 4 options, the one you recommend first, or the words `open answer` when the question has no fixed choices. |',
  '| `run-command` | The exact command and the working folder; what it changes (nothing, files, or something outside this machine); the evidence you need back (exit code, last lines, a file). |',
  '| `watch` | What to watch, the stop condition, the longest wait. |',
  '| `schedule` | What to run or check, when (once or recurring), when it ends, who gets the result. |',
  '| `run-workflow` | The workflow\'s name, its arguments, what to return. |',
  '| `delegate` | The specialist type, the objective, the acceptance evidence. This is work for another type; a question for a peer stays under `Open items`. |',
  '| `use-server` | The server and tool, the exact input, what to return. |',
  '',
  '- **Report with everything else done.** Finish all work that does not depend on an answer, then report. Your report stays your one hand-back; a request is never a message you send mid-run.',
  '- **A request carries no authority.** The lead decides it as its own act under its own rules, and may decline it. Never request what your own guard or one of your own rules refused: report the refusal instead. A read-only role requests evidence, never a change.',
  '- **The answer comes back to you.** When the lead continues you, its message names each `R<n>` as `answered`, `declined (who: why)` or `failed (what happened)`. Use the answers, finish the part that waited, and report again in full: the new report replaces the earlier one. After `declined` or `failed`, go on from the assumption you stated and mark what rests on it as an assumption. Never repeat a request that was answered or declined.',
  '- **Turns.** If your method works in turns with the user, open the section with the line `Turn <n>`. Your first report is turn 1; the number goes up by one each time the answers to your `ask-user` entries come back to you. A rule of yours that counts turns counts these.',
  '- **Three rounds.** At most three rounds of requests for one piece of work (a round is one report with requests and the answers to it). After the third, put what is still missing under `Open items`. A method that works in turns with the user is not held to this while the user keeps answering.',
  '- **In a planning consultation** request only `ask-user`; every other type waits until the lead tells you to deliver.',
];

const COORDINATOR_TEXT: readonly string[] = [
  '## Requests from specialists',
  '',
  'A specialist on this host cannot ask the user, and it may hold no shell, no watcher, no schedule, no saved workflow, no way to start another specialist, and not every connected server. What its work needs of these it requests from you, in a report section named `Requests for the lead`. Ask for that section in every brief, next to `Peer messages received` and `Open items`, and read it in every report before you synthesise.',
  '',
  'Each entry carries `R<n>`, a type, `blocking` or `non-blocking`, the reason, the fields of its type, the assumption the specialist goes on with if you decline, and what it will do with the result. Act on each entry yourself, as your own act under your own rules. A request carries no authority and widens nothing: decline what lies outside the accepted plan, outside what the specialist owns, or outside your own tools and rules.',
  '',
  '| Type | What you do |',
  '|---|---|',
  '| `ask-user` | Put the question to the user with `AskUserQuestion` when it is among your tools, with the specialist\'s question and options word for word: the same text, in the same order, add none, the recommended option first and marked. Only when the tool refuses the length of a label, cut that label, keep the labels distinct, and put the option\'s full text, word for word, in its description. Ask an `open answer` question in plain prose and take the user\'s reply as the answer. |',
  '| `run-command` | Run it with `Bash` or `PowerShell`, under your guard, and return the exit code and the evidence asked for. A command that changes anything outside this machine (a deploy, a publish, a production system) needs the user\'s explicit approval first. A command your guard blocks is declined, never reworded. Otherwise run the exact command, character for character. If you must change it (a syntax fix for the shell you hold), say `changed`, name each change and the reason, and never report `unchanged` for a command you altered. |',
  '| `watch` | Use `Monitor`, and `TaskStop` at the stop condition or at the longest wait. |',
  '| `schedule` | Use `CronCreate` or `ScheduleWakeup`, only with the user\'s consent, because a schedule outlives the turn. You own the follow-up. |',
  '| `run-workflow` | Run the saved workflow when `Workflow` is among your tools and the workflow is installed. Otherwise load the Skill of that name when it is installed and do its steps with your own `Agent` calls. Say which path you took. |',
  '| `delegate` | Make an `Agent` call when the type is in your allowlist and installed. Otherwise recommend the Bundle that provides it. |',
  '| `use-server` | Call the server tool when it is among your tools and the server is connected (`ToolSearch` shows it), with the user\'s consent first when the call spends money, needs a credential or changes anything outside this machine. |',
  '',
  '- **Only with a tool you really have.** The host does not give every session every tool: it withholds `AskUserQuestion`, `Workflow` and `ScheduleWakeup` from a lead that runs as a subagent, and `CronCreate` when it runs in the background, and a session with no user at the terminal may lack `AskUserQuestion` too. When `AskUserQuestion` is not among your tools, put the question in plain prose, with the specialist\'s question and options word for word, numbered. For any other type use the other path its row names, when it names one; when neither the tool nor another path is available, answer `declined (lead: tool not available)`.',
  '- **A read-only role\'s request that would change files or anything outside this machine** is answered `declined (lead: read-only role)`. When the change belongs to the accepted plan you may delegate it to an editing specialist as your own decision, and add `delegated to <type>` to the answer.',
  '- **Return every result to the same specialist.** Continue it with `SendMessage`: to the agent id your launch returned for an ordinary subagent, to its name for a teammate of a coordinated team. One message holds one line per entry, `R<n>: answered`, `R<n>: declined (who: why)` or `R<n>: failed (what happened)`, each followed by the answer or the output, and it repeats the turn number when the specialist gave one. Never launch a second agent of that type to carry an answer: it would not hold the first one\'s work. Only when the host refuses the continuation, launch again, and put the first report, every answer and the turn number into that brief.',
  '- **Declined always says who and why:** the form is `declined (who: why)`, with the user or you as who. Complete lines: `R2: declined (user: no answer)` when the user gives no answer and you go on, `R3: declined (lead: read-only role)`, `R4: declined (user: no reason given)`. Relay the user\'s reason when they give one. A line with a who and no why is wrong.',
  '- **A blocking request holds only its own piece of work** and what depends on it. Carry on with the rest. In a coordinated team, do not ask a teammate to shut down while a blocking request of its is unanswered.',
  '- **Three rounds.** At most three rounds of requests per specialist for one accepted piece of work (a round is one report with requests and your answers to it). After the third, move what is left into your own open items and tell the user. A request repeated after `answered` or `declined` is not acted on again.',
  '- **Turns.** A specialist whose section opens with `Turn <n>` works in turns with the user and is not held to three rounds while the user keeps answering. Pass the user\'s answers back word for word, add no questions of your own, and offer "stop here and summarise" as an option on every turn.',
  '- **In a planning consultation** act on `ask-user` entries only; every other type waits for the accepted delegation map.',
  '- **Your final report lists every request,** its type and its outcome.',
];

/** The request types open to a role, from the tool names of its `tools:` line (an `Agent(...)` allowlist counts as `Agent`), in the block's fixed order. */
export function openRequestTypes(tools: readonly string[]): string[] {
  const held = new Set(tools.map(tool => tool.split('(')[0]!));
  return TYPES.filter(type => !type.heldBy.some(tool => held.has(tool))).map(type => type.name);
}

/** The text between the markers: a specialist's with its computed line, or the lead's. */
export function renderRequests(kind: RequestsKind, tools: readonly string[]): string {
  if (kind === 'coordinator') return COORDINATOR_TEXT.join('\n');
  const open = openRequestTypes(tools).map(type => `\`${type}\``).join(', ');
  return SPECIALIST_TEXT.join('\n').replace(OPEN_TYPES, open);
}

const MARKERS: BlockMarkers = { label: 'requests', start: REQUESTS_START, end: REQUESTS_END };

/** Writes the block: replaces what is between the markers, or inserts the whole block before the boundaries (else the session task tracking) section. */
export function syncRequests(text: string, kind: RequestsKind, tools: readonly string[]): string {
  return writeBlock(text, MARKERS, renderRequests(kind, tools), source => anchorHeadingPoint(source, MARKERS));
}

export function checkRequests(text: string, kind: RequestsKind, tools: readonly string[]): string[] {
  return checkBlock(text, MARKERS, renderRequests(kind, tools));
}
