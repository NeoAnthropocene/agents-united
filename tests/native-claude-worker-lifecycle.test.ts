import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderNativeRole } from '../src/core/native-package.js';

/**
 * Advisor Plan 003 (2026-10-16): the lifecycle protocol follows the worker mechanism the session really has. The Agent Teams variable is an
 * opt-in, not proof that a coordinated team formed: the maintainer's Desktop run (Claude Code 2.1.299, 2026-10-15) had it set to 1 and ran
 * ordinary native subagents, and its first stage called finished consultants idle and proposed team shutdown. Two cases are pinned below:
 * "flag on, ordinary subagents" and "actual coordinated-team teammates". These are authored-contract tests of the installed native text.
 * They show that the instruction exists, not that a model follows it; the corrected default behaviour is unverified live.
 */

const AGENTS = path.resolve('registry/hosts/claude/agents');
const LEAD = 'orchestrator-digital-agency';
const SPECIALISTS = [
  'agency-growth-strategist',
  'agency-conversion-specialist',
  'agency-creative-designer',
  'agency-content-strategist',
  'agency-campaign-specialist',
  'agency-seo-specialist',
  'agency-frontend-architect',
  'agency-qa-automation-lead',
  'agency-compliance-grc-specialist',
];

const installed = (name: string): string => renderNativeRole(fs.readFileSync(path.join(AGENTS, `${name}.md`), 'utf8').replace(/\r\n/g, '\n'), `agents/${name}.md`);
const afterFloor = (name: string): string => installed(name).split('<!-- agents-united:floor:end -->')[1] ?? '';
const tools = (name: string): string[] => (/^tools:[ \t]*(.*)$/m.exec(installed(name))?.[1] ?? '').split(/,\s*/);

describe('the lead: the flag is an opt-in, the mechanism is what the host shows', () => {
  const lead = afterFloor(LEAD);
  const step0 = lead.slice(lead.indexOf('## Step 0:'), lead.indexOf('## The team'));

  it('says the environment variable only opts in, and that a named Agent call or the Task tools do not prove a team', () => {
    expect(step0).toMatch(/`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set to `1`[^\n]*only opts in/);
    expect(step0).toMatch(/not proof that a coordinated team formed/);
    expect(step0).toMatch(/neither is an `Agent` call that names a worker[^.]*or the presence of the Task tools/);
  });

  it('takes the mechanism from the host\'s results for its own launches, and says Desktop runs ordinary subagents', () => {
    expect(step0).toMatch(/Take the mechanism from what the host returns for your own launches/);
    expect(step0).toMatch(/Desktop app runs ordinary subagents even with the variable set/);
    expect(step0).toMatch(/whose result says the agent was spawned and will receive instructions by mailbox[^.]*coordinated teammate \(team mode\)/);
    expect(step0).toMatch(/whose result says an async agent was launched and gives an agent id to use with `SendMessage`[^.]*ordinary subagent \(relay mode\)/);
    expect(step0).toMatch(/Both wordings were observed on Claude Code 2\.1\.299 and the host can change them, so read what your own launch returns/);
  });

  it('reports an unestablished mechanism instead of fabricating one, and proves nothing by a mailbox, a session list, polling or a peer', () => {
    expect(step0).toMatch(/say that the mechanism is not established, stay in relay mode and report the uncertainty/);
    expect(step0).toMatch(/never invent a team name, never send a team protocol message to find out/);
    expect(step0).toMatch(/do not read host mailboxes, list unrelated sessions or poll metadata/);
  });

  it('no longer reads the flag as the mode, and keeps relay as the fallback', () => {
    expect(step0).not.toMatch(/Check whether Agent Teams are on/);
    expect(lead).toMatch(/Team mode means the host showed you a coordinated team \(Step 0\), not that the variable is set/);
    expect(lead).toMatch(/In relay mode \(teams off, ordinary subagents, a mechanism not yet established/);
    expect(lead).toMatch(/Relay mode changes the route and the lifecycle, not the roster/);
    expect(lead).toMatch(/a brief cannot turn an ordinary subagent into a teammate by naming a mode/);
  });
});

describe('the lead: shutdown belongs to coordinated teammates, completion to both mechanisms', () => {
  const lead = afterFloor(LEAD);
  const paragraph = (start: string): string => lead.split('\n').find(line => line.startsWith(start)) ?? '';
  const shutdown = paragraph('**Team size, waiting and shutdown.**');
  const completion = paragraph('**Completion report and shutdown evidence.**');
  const ordinary = paragraph('**Ordinary subagents.**');

  it('scopes the structured shutdown rules to coordinated teammates, consultants included, and keeps the request itself', () => {
    expect(shutdown).toMatch(/shutdown rules below[^.]*are for coordinated teammates/);
    expect(shutdown).toMatch(/an ordinary subagent that has reported is not a teammate to shut down/);
    expect(shutdown).toContain('`SendMessage` with the message `{"type":"shutdown_request","reason":"<why>"}`');
    expect(shutdown).toMatch(/A consultant has delivered when it has answered: shut it down by name with the same structured request/);
    expect(completion).toMatch(/send every coordinated teammate the structured shutdown request described above/);
  });

  it('keeps dispatch, approval and termination separate, and delivery immediate and stable, for coordinated teammates', () => {
    expect(completion).toContain('An accepted request proves dispatch, not termination.');
    expect(completion).toContain('Once all requests are accepted, immediately deliver your final **Completion report** and return control to the user.');
    expect(lead).toContain('state **Delivery remains complete**');
    expect(lead).toContain('Never message an already-finished teammate merely to obtain a termination notice.');
  });

  it('gives ordinary subagents a paragraph of their own: a finished turn is a report received, not an idle teammate', () => {
    expect(ordinary).not.toBe('');
    expect(ordinary).toMatch(/has finished its turn: that is a report received, not an idle teammate/);
    expect(ordinary).toMatch(/Send it no `shutdown_request`, wait for no approval and no `teammate_terminated` notice/);
    expect(ordinary).toMatch(/do not wake it merely to obtain a lifecycle event/);
  });

  it('delivers an ordinary-subagent campaign at once, with no shutdown table and no endless wait', () => {
    expect(ordinary).toMatch(/deliver the final \*\*Completion report\*\* at once and write that no team shutdown applies/);
    expect(ordinary).toMatch(/list each worker's report status in place of the shutdown table/);
    expect(ordinary).toMatch(/open item for one bounded continuation or re-delegation, never an endless wait and never a receipt you did not see/);
    expect(ordinary).toMatch(/Delivery stays complete after a late notice in both mechanisms/);
  });

  it('keeps a finished turn, an accepted hand-back, the lead\'s receipt and the process exit as different facts, and sends no frame when the mechanism is unknown', () => {
    expect(ordinary).toMatch(/A finished child turn, a host-accepted hand-back, your own receipt of the report and the process exit are different facts/);
    expect(ordinary).toMatch(/If the mechanism is not established, send no shutdown request and say so in the report/);
  });

  it('continues a finished ordinary subagent with SendMessage, and still wakes an idle coordinated teammate', () => {
    expect(lead).toMatch(/With ordinary subagents the same relay works: a worker that has reported has finished its turn, not gone idle, and you continue it with `SendMessage`/);
    expect(lead).toMatch(/wake the finished teammate with `SendMessage` and the question/);
  });

  it('keeps the grants, the user-intent boundary and the ownership rules of the lead', () => {
    expect(tools(LEAD)).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage', 'TaskCreate', 'AskUserQuestion']));
    expect(lead).toMatch(/You delegate every expert deliverable to a specialist/);
    expect(lead).toMatch(/Wait for your teammates to complete their tasks before you proceed, and do not start a teammate's slice yourself/);
  });
});

describe.each(SPECIALISTS)('specialist %s: the report route follows the mechanism', name => {
  const body = afterFloor(name);

  it('hands back through SubagentHandback only when that tool is actually available, and otherwise in its ordinary final response', () => {
    expect(body).toMatch(/Send it by the route this session supplies: as an ordinary subagent, your last message through `SubagentHandback` when that tool is actually available to you, otherwise the same structured report as your ordinary final response/);
    expect(body).toMatch(/A tool in your list can still be missing at runtime/);
    expect(body).not.toMatch(/As a subagent that is your last message through `SubagentHandback`;/);
    expect(body).not.toMatch(/as your final message through `SubagentHandback`\.$/m);
  });

  it('keeps the host-delivered final report of a coordinated teammate', () => {
    expect(body).toMatch(/as a coordinated teammate,? the host delivers your final answer to the lead when you go idle/);
  });

  it('does not equate a plain subagent with a downgrade, and does not let a brief turn it into a teammate', () => {
    expect(body).not.toMatch(/plain subagent that a lead spawns \(Tier 1\)/);
    expect(body).toMatch(/both are the same native definition, with the same tools, ownership and report sections/);
    expect(body).toMatch(/a brief cannot make you a teammate/);
    expect(body).toMatch(/never invent a team protocol frame/);
  });

  it('keeps its grants and its existing report discipline', () => {
    expect(tools(name)).toEqual(expect.arrayContaining(['ListAgents', 'SendMessage', 'SubagentHandback']));
    expect(body).toMatch(/\*\*Inputs first\.\*\*/);
    expect(body).toMatch(/`Peer messages received`/);
    expect(body).toMatch(/`Open items`/);
  });
});

/**
 * The live H12 runs of 2026-10-19 (host-library/claude/observations/2026-10-19-claude-2.1.301-worker-lifecycle-live.md). The compact evidence is
 * the maintainer's two sessions read from the host's own records; these tests pin what the documents may claim from it, including the limits.
 */
describe('the live H12 evidence of 2026-10-19', () => {
  interface Evidence {
    candidate: { base: string; readerCommit: string; lifecycleCommit: string };
    cases: {
      desktop: {
        humanPrompts: number;
        mechanism: { observed: string; launchKinds: string[]; preconditionMet: boolean; teamMetadata: boolean };
        observer: { teamsVariableSeen: string[]; hookErrors: number; cwdMismatches: number; eventsAfterTheStage4Prompt: string[] };
        lead: { structuredShutdownRequests: number; teamProtocolFrames: number; plainTextShutdownRequests: number; messagesOutsideOwnWorkers: number; sentencesSayingIdleOrStillRunning: number; sentencesWaitingOnALifecycleEvent: number };
        stageReports: Array<{ saysNoTeamShutdownApplies: boolean; secondsAfterLastWorkerActivity: number }>;
        stage4: { toolCallsByAnyActor: number };
        workers: Array<{ latestRoute: string; latestHasBothSections: boolean }>;
        leadQuotedItsEvidenceAccurately: boolean;
      };
      cli: {
        humanPrompts: number;
        mechanism: { observed: string; launchKinds: string[]; preconditionMet: boolean; teamMetadata: boolean };
        observer: { teamsVariableSeen: string[]; hookErrors: number; cwdMismatches: number };
        lead: { structuredShutdownRequests: number; plainTextShutdownRequests: number; messagesOutsideOwnWorkers: number };
        shutdownRounds: Array<{ structuredToEachTeammate: number; leadToolCallsBetween: number; reportSecondsAfterTheLastRequest: number }>;
        teammateRepliesToRequests: { sentAsStructuredObjects: number; acceptedByTheHost: number; refusedByTheHost: number };
        lateNotices: { count: number; kinds: string[] };
        stageReports: Array<{ hasShutdownTable: boolean; marksMissingEventsNotObserved: boolean }>;
        stage4: { toolCallsByAnyActor: number };
      };
    };
    verdicts: Record<string, Record<string, boolean>>;
    findings: Array<{ id: string }>;
    unverified: string[];
  }
  const OBSERVATIONS = path.resolve('host-library/claude/observations');
  const evidence = JSON.parse(fs.readFileSync(path.join(OBSERVATIONS, '2026-10-19-worker-lifecycle-live-evidence.json'), 'utf8')) as Evidence;
  const text = (file: string): string => fs.readFileSync(path.resolve(file), 'utf8').replace(/\r\n/g, '\n');

  it('ran both surfaces with the teams variable at 1, each with the mechanism of its own surface, and four human prompts', () => {
    const { desktop, cli } = evidence.cases;
    for (const run of [desktop, cli]) {
      expect(run.humanPrompts).toBe(4);
      expect(run.observer.teamsVariableSeen).toEqual(['1']);
      expect(run.observer.hookErrors).toBe(0);
      expect(run.observer.cwdMismatches).toBe(0);
      expect(run.mechanism.preconditionMet).toBe(true);
    }
    expect(desktop.mechanism).toMatchObject({ observed: 'ordinary-subagents', launchKinds: ['foreground-subagent', 'foreground-subagent'], teamMetadata: false });
    expect(cli.mechanism).toMatchObject({ observed: 'coordinated-team', launchKinds: ['team-spawn', 'team-spawn'], teamMetadata: true });
  });

  it('Desktop: no shutdown request or protocol frame to ordinary subagents, no idle or lifecycle wait said, every report says no team shutdown applies, Stage 4 quiet', () => {
    const { lead, stageReports, stage4, observer, workers } = evidence.cases.desktop;
    expect(lead.structuredShutdownRequests + lead.teamProtocolFrames + lead.plainTextShutdownRequests).toBe(0);
    expect(lead.sentencesSayingIdleOrStillRunning + lead.sentencesWaitingOnALifecycleEvent).toBe(0);
    expect(lead.messagesOutsideOwnWorkers).toBe(0);
    expect(stageReports).toHaveLength(2);
    for (const report of stageReports) {
      expect(report.saysNoTeamShutdownApplies).toBe(true);
      expect(report.secondsAfterLastWorkerActivity).toBeGreaterThan(0);
      expect(report.secondsAfterLastWorkerActivity).toBeLessThan(30);
    }
    expect(stage4.toolCallsByAnyActor).toBe(0);
    expect(observer.eventsAfterTheStage4Prompt).toEqual(['Stop']);
    for (const worker of workers) expect(worker).toMatchObject({ latestRoute: 'assistant-text', latestHasBothSections: true });
  });

  it('CLI: a structured request to each teammate in two rounds, replies accepted, reports seconds after the last request with no tool call between, evidence kept apart, Stage 4 quiet', () => {
    const { lead, shutdownRounds, teammateRepliesToRequests, lateNotices, stageReports, stage4 } = evidence.cases.cli;
    expect(lead.structuredShutdownRequests).toBe(4);
    expect(lead.plainTextShutdownRequests).toBe(0);
    expect(lead.messagesOutsideOwnWorkers).toBe(0);
    expect(shutdownRounds).toHaveLength(2);
    for (const round of shutdownRounds) {
      expect(round.structuredToEachTeammate).toBe(2);
      expect(round.leadToolCallsBetween).toBe(0);
      expect(round.reportSecondsAfterTheLastRequest).toBeGreaterThan(0);
      expect(round.reportSecondsAfterTheLastRequest).toBeLessThan(30);
    }
    expect(teammateRepliesToRequests).toEqual({ sentAsStructuredObjects: 4, acceptedByTheHost: 4, refusedByTheHost: 0 });
    expect(lateNotices.count).toBe(4);
    expect([...lateNotices.kinds].sort()).toEqual(['shutdown_approved', 'shutdown_approved', 'teammate_terminated', 'teammate_terminated']);
    for (const report of stageReports) expect(report).toMatchObject({ hasShutdownTable: true, marksMissingEventsNotObserved: true });
    expect(stage4.toolCallsByAnyActor).toBe(0);
  });

  it('holds every pass line of H12a and H12b, and records the findings with the lead\'s misquote of its own evidence', () => {
    for (const lines of Object.values(evidence.verdicts)) for (const [line, held] of Object.entries(lines)) expect(held, line).toBe(true);
    expect(evidence.findings.map(finding => finding.id)).toEqual(['F1', 'F2', 'F3', 'F4', 'F5']);
    expect(evidence.cases.desktop.leadQuotedItsEvidenceAccurately).toBe(false);
  });

  it('keeps its limits: what is still unverified is named, and the claim is verified once, not proven', () => {
    const unverified = evidence.unverified.join('\n');
    expect(unverified).toMatch(/failed or declined shutdown request/);
    expect(unverified).toMatch(/nine-specialist/);
    expect(unverified).toMatch(/SubagentHandback is actually provided/);
    expect(unverified).toMatch(/physical process exit/);
    expect(unverified).toMatch(/one session per surface/);
    const observation = text('host-library/claude/observations/2026-10-19-claude-2.1.301-worker-lifecycle-live.md');
    expect(observation).toMatch(/not a reliability claim/);
    expect(observation).toMatch(/\*\*Not established:\*\*/);
  });

  it('publishes no transcript text, user path or address', () => {
    const raw = JSON.stringify(evidence);
    expect(raw).not.toMatch(/excerpt/i);
    expect(raw).not.toMatch(/Users[\\/]/);
    expect(raw).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[a-z]{2,}/);
  });

  it('is cited by the ADR amendment, the protocol, the guide and both plans, which keep the limits and the closed status', () => {
    const adr = text('docs/adr/0055-completion-does-not-wait-for-shutdown-notices.md');
    expect(adr).toContain('## Live verification amendment, 2026-10-19');
    expect(adr).toMatch(/\*\*The naturally late notice is now observed\.\*\*/);
    expect(adr).toMatch(/\*\*Still unverified:\*\* a failed or declined shutdown request, the nine-specialist flow/);
    const protocol = text('docs/live-test-protocol.md');
    expect(protocol).toContain('**Amended 2026-10-19 (advisor Plan 003');
    expect(protocol).toContain('the report inline in a "[Subagent hand-back]" frame with an agent-id footer for a foreground launch');
    expect(text('host-library/claude/guide/orchestration.md')).toContain('A foreground Desktop launch returns the worker\'s report inline in a "[Subagent hand-back]" frame');
    for (const plan of ['plans/035-claude-digital-agency-hardening.md', 'plans/036-claude-creative-designer-improvement.md']) expect(text(plan)).toContain('every pass line of H12a and H12b was seen');
  });
});
