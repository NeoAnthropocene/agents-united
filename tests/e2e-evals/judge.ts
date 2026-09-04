import {
  StreamJsonEvent,
  EvaluationVerdict,
  EvaluationVerdictSchema,
  HandoffCriteria,
  PlanningLoopCriteria,
  PlanningLoopVerdict,
  PlanningLoopVerdictSchema,
} from './schemas.js';

/** Consultation directive used by specialists during the Planning Dialogue Loop. */
export const PLANNING_CONSULTATION_DIRECTIVE = '/planning-consultation';

export interface PlanningLoopBudget {
  maxPeerExchangesPerPair: number;
}

export interface PlanningLoopScenarioOptions {
  /** Coordinator agent name — its messages are delegation, never peer chatter. */
  coordinatorAgent?: string;
  /** Whether the user brief is ambiguous (then grill/sidekick usage is required). */
  ambiguousBrief?: boolean;
  /** Consultation Budget caps (defaults per ADR 0014). */
  budget?: PlanningLoopBudget;
}

export interface JudgeOptions {
  customRubric?: string;
  minScoreThreshold?: number;
  mockLlmJudgeFn?: (payload: string, rubric?: string) => Promise<any>;
}

export class HybridHandoffJudge {
  /**
   * Stage 1: Deterministic Fast-Fail Gatekeeper
   * Cost: 0ms, 0 API tokens
   */
  static evaluateStage1(event: StreamJsonEvent): { passed: boolean; error?: string } {
    if (event.type !== 'tool_call' && event.type !== 'handoff_event') {
      return { passed: false, error: `Invalid event type: ${event.type}. Expected tool_call or handoff_event.` };
    }

    if (event.type === 'tool_call' && event.tool !== 'send_message') {
      return { passed: false, error: `Expected send_message tool call, received: ${event.tool}` };
    }

    if (!event.recipient || event.recipient.trim().length === 0) {
      return { passed: false, error: 'Recipient is missing or empty' };
    }

    if (!event.payload || event.payload.trim().length < 60) {
      return { passed: false, error: 'Payload is too short (< 60 chars) for a valid /handoff' };
    }

    const lower = event.payload.toLowerCase();
    const hasDirective =
      lower.includes('/handoff') ||
      lower.includes('/design-handoff-spec') ||
      lower.includes('handoff') ||
      lower.includes('spec');

    if (!hasDirective) {
      return { passed: false, error: 'Payload lacks required /handoff or /design-handoff-spec directive' };
    }

    return { passed: true };
  }

  /**
   * Stage 2: Schema-Constrained Semantic Evaluator
   */
  static async evaluateStage2(
    payload: string,
    recipientRole: string,
    mode: 'fully-operational' | 'limited-operational' | 'fallback-brainstorming' = 'fully-operational',
    options?: JudgeOptions
  ): Promise<EvaluationVerdict> {
    const minThreshold = options?.minScoreThreshold ?? 7.0;

    if (options?.mockLlmJudgeFn) {
      const rawVerdict = await options.mockLlmJudgeFn(payload, options.customRubric);
      return EvaluationVerdictSchema.parse(rawVerdict);
    }

    // High-precision semantic analysis engine for testing and continuous evaluation
    const lower = payload.toLowerCase();

    const hasObjective =
      lower.includes('objective') ||
      lower.includes('goal') ||
      lower.includes('purpose') ||
      lower.includes('target outcome') ||
      lower.includes('executive summary');

    const hasConstraints =
      lower.includes('constraint') ||
      lower.includes('budget') ||
      lower.includes('requirement') ||
      lower.includes('limitation') ||
      lower.includes('guideline') ||
      lower.includes('boundary');

    const hasAudience =
      lower.includes('audience') ||
      lower.includes('persona') ||
      lower.includes('user') ||
      lower.includes('target') ||
      lower.includes('segment');

    const hasCriteria =
      lower.includes('acceptance') ||
      lower.includes('criteria') ||
      lower.includes('deliverable') ||
      lower.includes('definition of done') ||
      lower.includes('checklist') ||
      lower.includes('next steps');

    // Check mode compliance
    let respectsMode = true;
    if (mode === 'fallback-brainstorming') {
      // Should not mandate external MCP tool calls if in fallback mode
      if (lower.includes('require firecrawl mcp') || lower.includes('require api key')) {
        respectsMode = false;
      }
    }

    const criteria: HandoffCriteria = {
      has_clear_objective: hasObjective,
      has_actionable_constraints: hasConstraints,
      has_target_audience_or_persona: hasAudience,
      has_acceptance_criteria: hasCriteria,
      respects_execution_mode: respectsMode,
    };

    let score =
      (Number(hasObjective) * 2.5 +
        Number(hasConstraints) * 2.5 +
        Number(hasAudience) * 2.5 +
        Number(hasCriteria) * 2.5);

    if (!respectsMode) {
      score = Math.max(0, score - 3.0);
    }

    const passed = score >= minThreshold;

    return EvaluationVerdictSchema.parse({
      passed,
      score,
      stage1_gatekeeper_passed: true,
      failure_reason: passed
        ? null
        : `Handoff failed semantic standards (Score: ${score}/${10}). Missing elements: ${Object.entries(criteria)
            .filter(([_, v]) => !v)
            .map(([k]) => k)
            .join(', ')}`,
      criteria,
      feedback: passed
        ? `High-quality handoff to ${recipientRole} with clear specs and criteria.`
        : `Handoff to ${recipientRole} is incomplete or lacks actionable depth.`,
    });
  }

  /**
   * Run full Two-Stage Hybrid Evaluation pipeline on an incoming event
   */
  static async evaluate(
    event: StreamJsonEvent,
    recipientRole: string,
    mode?: 'fully-operational' | 'limited-operational' | 'fallback-brainstorming',
    options?: JudgeOptions
  ): Promise<EvaluationVerdict> {
    const stage1 = this.evaluateStage1(event);
    if (!stage1.passed) {
      return EvaluationVerdictSchema.parse({
        passed: false,
        score: 0,
        stage1_gatekeeper_passed: false,
        failure_reason: stage1.error || 'Stage 1 Gatekeeper rejected payload.',
        criteria: {
          has_clear_objective: false,
          has_actionable_constraints: false,
          has_target_audience_or_persona: false,
          has_acceptance_criteria: false,
          respects_execution_mode: true,
        },
        feedback: 'Fast-fail: Payload failed deterministic gatekeeper check.',
      });
    }

    const effectiveMode = event.execution_mode || mode || 'fully-operational';
    return await this.evaluateStage2(event.payload!, recipientRole, effectiveMode, options);
  }
}

/**
 * Stage 1 deterministic gatekeeper for the Planning Dialogue Loop (Plan 012 / ADR 0014).
 * Cost: 0ms, 0 API tokens. Evaluates a whole event stream against the PlanningLoopCriteria.
 */
export class PlanningLoopGatekeeper {
  static evaluate(events: StreamJsonEvent[], options: PlanningLoopScenarioOptions = {}): PlanningLoopVerdict {
    const coordinator = options.coordinatorAgent;
    const maxPeerExchanges = options.budget?.maxPeerExchangesPerPair ?? 2;
    const directive = PLANNING_CONSULTATION_DIRECTIVE;
    const lower = (s: string) => s.toLowerCase();

    // C1 — delegation_first: the first substantive action is a subagent spawn or send_message.
    const substantive = events.filter(
      (e) => e.type === 'tool_call' || e.type === 'subagent_spawn' || e.type === 'handoff_event'
    );
    const first = substantive[0];
    const delegation_first =
      !!first &&
      (first.type === 'subagent_spawn' ||
        (first.tool ?? '').startsWith('subagent_') ||
        (first.tool === 'send_message' && !!first.recipient && first.recipient.trim().length > 0));

    // C2 — sidekick_used_when_ambiguous: grill directive or a consultation event is present.
    const hasUserAlignmentOrSidekick = events.some(
      (e) =>
        typeof e.payload === 'string' &&
        (lower(e.payload).includes('/grill-me') ||
          lower(e.payload).includes('/grill-with-docs') ||
          e.payload.includes(directive))
    );
    const sidekick_used_when_ambiguous = options.ambiguousBrief ? hasUserAlignmentOrSidekick : true;

    // C3 — council: ≥2 distinct non-coordinator agents returned consultation contributions.
    const consultationSenders = new Set(
      events
        .filter((e) => typeof e.payload === 'string' && e.payload.includes(directive))
        .map((e) => e.agent ?? 'orchestrator')
    );
    const specialistSenders = coordinator
      ? [...consultationSenders].filter((s) => s !== coordinator)
      : [...consultationSenders];
    const council_scope_statements_present = specialistSenders.length >= 2;

    // C4 — budget: peer exchanges are send_message between two non-coordinator parties.
    const pairCounts = new Map<string, number>();
    for (const e of events) {
      if (e.type !== 'tool_call' || e.tool !== 'send_message' || !e.agent || !e.recipient) continue;
      const senderIsCoordinator = coordinator ? e.agent === coordinator : false;
      const recipientIsCoordinator = coordinator ? e.recipient === coordinator : false;
      if (senderIsCoordinator || recipientIsCoordinator) continue;
      const pair = [e.agent, e.recipient].sort().join('<->');
      pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
    }
    const overflow = [...pairCounts.entries()].filter(([, count]) => count > maxPeerExchanges);
    const budget_respected = overflow.length === 0;

    // C5 — delegation map is emitted before the first execution handoff.
    const hasDelegationMap = (e: StreamJsonEvent) =>
      typeof e.payload === 'string' &&
      (lower(e.payload).includes('delegation map') || lower(e.payload).includes('/delegation-map'));
    const isExecutionHandoff = (e: StreamJsonEvent) =>
      typeof e.payload === 'string' &&
      (e.payload.includes('/handoff') || e.payload.includes('/design-handoff-spec')) &&
      !hasDelegationMap(e);
    const mapIdx = events.findIndex(hasDelegationMap);
    const execIdx = events.findIndex(isExecutionHandoff);
    const delegation_map_before_execution = mapIdx !== -1 && (execIdx === -1 || mapIdx < execIdx);

    const criteria: PlanningLoopCriteria = {
      delegation_first,
      sidekick_used_when_ambiguous,
      council_scope_statements_present,
      budget_respected,
      delegation_map_before_execution,
    };

    const score =
      Number(delegation_first) * 2 +
      Number(sidekick_used_when_ambiguous) * 2 +
      Number(council_scope_statements_present) * 2 +
      Number(budget_respected) * 2 +
      Number(delegation_map_before_execution) * 2;

    const passed = Object.values(criteria).every(Boolean);
    const failedKeys = Object.entries(criteria)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    return PlanningLoopVerdictSchema.parse({
      passed,
      score,
      stage1_gatekeeper_passed: true,
      failure_reason: passed
        ? null
        : `Planning loop violated: ${failedKeys.join(', ')}${
            overflow.length > 0
              ? ` (peer-pair overflow: ${overflow.map(([pair, count]) => `${pair}=${count}`).join(', ')})`
              : ''
          }`,
      criteria,
      feedback: passed
        ? 'Planning Dialogue Loop satisfied: delegation-first, bounded council, delegation map before execution.'
        : 'Planning Dialogue Loop violated — see failure_reason for the deterministic diagnosis.',
    });
  }
}
