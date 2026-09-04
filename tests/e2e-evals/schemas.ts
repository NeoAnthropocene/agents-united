import { z } from 'zod';

/**
 * Standard Stream-JSON Event Schema for Antigravity & Assistant Runtime Streams
 */
export const StreamJsonEventTypeSchema = z.enum([
  'system_prompt',
  'thought',
  'message',
  'tool_call',
  'tool_result',
  'mode_switch',
  'subagent_spawn',
  'handoff_event',
]);

export const StreamJsonEventSchema = z.object({
  id: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
  type: StreamJsonEventTypeSchema,
  agent: z.string().optional(),
  recipient: z.string().optional(),
  tool: z.string().optional(),
  tool_args: z.record(z.any()).optional(),
  payload: z.string().optional(),
  execution_mode: z.enum(['fully-operational', 'limited-operational', 'fallback-brainstorming']).optional(),
  metadata: z.record(z.any()).optional(),
});

export type StreamJsonEvent = z.infer<typeof StreamJsonEventSchema>;

/**
 * Handoff Rubric Evaluation Criteria
 */
export const HandoffCriteriaSchema = z.object({
  has_clear_objective: z.boolean(),
  has_actionable_constraints: z.boolean(),
  has_target_audience_or_persona: z.boolean(),
  has_acceptance_criteria: z.boolean(),
  respects_execution_mode: z.boolean(),
});

export type HandoffCriteria = z.infer<typeof HandoffCriteriaSchema>;

/**
 * Planning Dialogue Loop rubric (Plan 012 / ADR 0014)
 * Enforced by the deterministic Stage-1 Planning Loop Gatekeeper.
 */
export const PlanningLoopCriteriaSchema = z.object({
  delegation_first: z.boolean(),
  sidekick_used_when_ambiguous: z.boolean(),
  council_scope_statements_present: z.boolean(),
  budget_respected: z.boolean(),
  delegation_map_before_execution: z.boolean(),
});

export type PlanningLoopCriteria = z.infer<typeof PlanningLoopCriteriaSchema>;

export const PlanningLoopVerdictSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(10),
  stage1_gatekeeper_passed: z.boolean(),
  failure_reason: z.string().nullable(),
  criteria: PlanningLoopCriteriaSchema,
  feedback: z.string(),
});

export type PlanningLoopVerdict = z.infer<typeof PlanningLoopVerdictSchema>;

/**
 * Overall Evaluation Output Contract
 */
export const EvaluationVerdictSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(10),
  stage1_gatekeeper_passed: z.boolean(),
  failure_reason: z.string().nullable(),
  criteria: HandoffCriteriaSchema,
  feedback: z.string(),
  dag_trace_id: z.string().optional(),
});

export type EvaluationVerdict = z.infer<typeof EvaluationVerdictSchema>;

/**
 * DAG Trace State Record
 */
export interface DagNodeTrace {
  sender: string;
  recipient: string;
  skill_used: 'handoff' | 'design-handoff-spec' | 'grill-me' | 'to-spec' | 'planning-consultation' | 'general';
  raw_payload: string;
  verdict: EvaluationVerdict;
}
