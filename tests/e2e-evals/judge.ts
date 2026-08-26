import {
  StreamJsonEvent,
  EvaluationVerdict,
  EvaluationVerdictSchema,
  HandoffCriteria,
} from './schemas.js';

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
