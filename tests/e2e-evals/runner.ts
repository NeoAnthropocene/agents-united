import {
  StreamJsonEvent,
  StreamJsonEventSchema,
  EvaluationVerdict,
  DagNodeTrace,
} from './schemas.js';
import { HybridHandoffJudge, JudgeOptions } from './judge.js';

export interface EvaluationRunSummary {
  totalEventsProcessed: number;
  totalHandoffsEvaluated: number;
  passedHandoffs: number;
  failedHandoffs: number;
  averageScore: number;
  traces: DagNodeTrace[];
  executionMode: 'fully-operational' | 'limited-operational' | 'fallback-brainstorming';
  allPassed: boolean;
}

export class StreamJsonEvalRunner {
  private buffer: string = '';
  private events: StreamJsonEvent[] = [];
  private traces: DagNodeTrace[] = [];
  private currentMode: 'fully-operational' | 'limited-operational' | 'fallback-brainstorming' = 'fully-operational';

  constructor(initialMode: 'fully-operational' | 'limited-operational' | 'fallback-brainstorming' = 'fully-operational') {
    this.currentMode = initialMode;
  }

  /**
   * Process a chunk of stream-json (NDJSON stream)
   */
  public async feedChunk(chunk: string, options?: JudgeOptions): Promise<DagNodeTrace[]> {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    // Keep incomplete line in the buffer
    this.buffer = lines.pop() ?? '';

    const newTraces: DagNodeTrace[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const rawObj = JSON.parse(trimmed);
        const event = StreamJsonEventSchema.parse(rawObj);
        this.events.push(event);

        if (event.type === 'mode_switch' && event.execution_mode) {
          this.currentMode = event.execution_mode;
        }

        // Detect inter-agent handoff communication
        const isHandoff =
          event.type === 'handoff_event' ||
          (event.type === 'tool_call' && event.tool === 'send_message');

        if (isHandoff && event.recipient) {
          const verdict = await HybridHandoffJudge.evaluate(
            event,
            event.recipient,
            this.currentMode,
            options
          );

          let skillUsed: DagNodeTrace['skill_used'] = 'general';
          if (event.payload?.includes('/design-handoff-spec')) {
            skillUsed = 'design-handoff-spec';
          } else if (event.payload?.includes('/handoff')) {
            skillUsed = 'handoff';
          } else if (event.payload?.includes('/grill-me')) {
            skillUsed = 'grill-me';
          } else if (event.payload?.includes('/to-spec')) {
            skillUsed = 'to-spec';
          }

          const trace: DagNodeTrace = {
            sender: event.agent || 'orchestrator',
            recipient: event.recipient,
            skill_used: skillUsed,
            raw_payload: event.payload || '',
            verdict,
          };

          this.traces.push(trace);
          newTraces.push(trace);
        }
      } catch (err) {
        // Line wasn't valid json event or schema mismatch
        console.warn('Malformed stream-json line ignored:', trimmed);
      }
    }

    return newTraces;
  }

  /**
   * Finalize evaluation and compute summary
   */
  public async finalize(options?: JudgeOptions): Promise<EvaluationRunSummary> {
    if (this.buffer.trim().length > 0) {
      await this.feedChunk('\n', options);
    }

    const totalHandoffs = this.traces.length;
    const passedHandoffs = this.traces.filter((t) => t.verdict.passed).length;
    const failedHandoffs = totalHandoffs - passedHandoffs;
    const totalScore = this.traces.reduce((acc, t) => acc + t.verdict.score, 0);
    const averageScore = totalHandoffs > 0 ? totalScore / totalHandoffs : 0;

    return {
      totalEventsProcessed: this.events.length,
      totalHandoffsEvaluated: totalHandoffs,
      passedHandoffs,
      failedHandoffs,
      averageScore: Number(averageScore.toFixed(2)),
      traces: this.traces,
      executionMode: this.currentMode,
      allPassed: totalHandoffs > 0 ? passedHandoffs === totalHandoffs : true,
    };
  }

  /**
   * Helper to serialize events as NDJSON stream
   */
  public static toNdjson(events: StreamJsonEvent[]): string {
    return events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  }
}
