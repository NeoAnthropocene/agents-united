import { describe, it, expect } from 'vitest';
import { StreamJsonEvalRunner } from './runner.js';
import { StreamJsonEvent } from './schemas.js';

describe('Milestone 6: Stream-JSON Continuous Evaluation & DAG Verification', () => {
  it('1. Handles fragmented NDJSON stream buffers and reconstructs events seamlessly', async () => {
    const runner = new StreamJsonEvalRunner('fully-operational');

    const rawEvent: StreamJsonEvent = {
      type: 'tool_call',
      agent: 'chris-director',
      tool: 'send_message',
      recipient: 'ava-manager',
      payload: `
## /handoff to Account Manager (Ava)
### 🎯 Executive Objective & Goal
Deliver multi-channel enterprise acquisition campaign for Q4 SaaS product launch.
### 👥 Target Audience & Persona
B2B Engineering Leaders and DevOps Managers at growth-stage startups.
### 📐 Actionable Constraints & Budget
Budget capped at $50k across paid channels; 3-week sprint timeline.
### ✅ Acceptance Criteria & Deliverables
Approved creative assets, copy variants, and landing page prototype.
      `,
    };

    const fullJson = JSON.stringify(rawEvent);
    // Fragment JSON across 3 separate network chunks
    const chunk1 = fullJson.slice(0, 50);
    const chunk2 = fullJson.slice(50, 150);
    const chunk3 = fullJson.slice(150) + '\n';

    await runner.feedChunk(chunk1);
    await runner.feedChunk(chunk2);
    const traces = await runner.feedChunk(chunk3);

    expect(traces.length).toBe(1);
    expect(traces[0].sender).toBe('chris-director');
    expect(traces[0].recipient).toBe('ava-manager');
    expect(traces[0].skill_used).toBe('handoff');
    expect(traces[0].verdict.passed).toBe(true);
    expect(traces[0].verdict.score).toBe(10);
  });

  it('2. Evaluates Multi-Hop Dynamic DAG Pipeline in Digital Agency (Director -> Manager -> Designer -> Dev)', async () => {
    const runner = new StreamJsonEvalRunner('fully-operational');

    const dagEvents: StreamJsonEvent[] = [
      // Hop 1: Director to Manager
      {
        type: 'tool_call',
        agent: 'chris-director',
        tool: 'send_message',
        recipient: 'ava-manager',
        payload: `
## /handoff: Campaign Kickoff
- **Objective & Goal**: Drive 500 qualified enterprise trials in Q4.
- **Target Persona**: VP Engineering & CTOs.
- **Constraints & Budget**: Maximum CAC $250.
- **Acceptance Criteria & Next Steps**: Build landing page and ad copy assets.
        `,
      },
      // Hop 2: Manager to UI Designer
      {
        type: 'tool_call',
        agent: 'ava-manager',
        tool: 'send_message',
        recipient: 'jamileh-design',
        payload: `
## /design-handoff-spec: Landing Page Prototyping
- **Executive Purpose**: High-converting enterprise signup hero section.
- **Target Users**: Dark-mode loving developers and tech leads.
- **Design Constraints**: Use Tailwind design tokens, ensure WCAG 2.2 AA contrast.
- **Deliverables & Checklist**: Mobile and desktop Figma layouts and Storybook preview cards.
        `,
      },
      // Hop 3: Manager to Copywriter
      {
        type: 'tool_call',
        agent: 'ava-manager',
        tool: 'send_message',
        recipient: 'kaan-copy',
        payload: `
## /handoff: Copywriting Requirements
- **Goal**: Write punchy headlines and benefit bullets.
- **Audience**: Technical buyers wanting zero marketing jargon.
- **Requirements & Limitations**: Max 45 characters per headline, 3 value props.
- **Acceptance Criteria**: Provide 3 variants for A/B split testing.
        `,
      },
      // Hop 4: UI Designer to Frontend Dev
      {
        type: 'tool_call',
        agent: 'jamileh-design',
        tool: 'send_message',
        recipient: 'yavuz-content',
        payload: `
## /design-handoff-spec: Component Implementation
- **Goal & Purpose**: Implement interactive hero component in React.
- **Target Audience**: Web visitors on desktop & mobile.
- **Technical Constraints**: 100% TypeScript, zero layout shift (CLS < 0.1).
- **Checklist & Criteria**: Pass responsive visual regression and unit tests.
        `,
      },
    ];

    const ndjson = StreamJsonEvalRunner.toNdjson(dagEvents);
    await runner.feedChunk(ndjson);
    const summary = await runner.finalize();

    expect(summary.totalHandoffsEvaluated).toBe(4);
    expect(summary.passedHandoffs).toBe(4);
    expect(summary.failedHandoffs).toBe(0);
    expect(summary.averageScore).toBe(10);
    expect(summary.allPassed).toBe(true);
    expect(summary.traces.map((t) => t.skill_used)).toEqual([
      'handoff',
      'design-handoff-spec',
      'handoff',
      'design-handoff-spec',
    ]);
  });

  it('3. Evaluates Tri-Tier Graceful Degradation (Fallback Brainstorming Mode)', async () => {
    const runner = new StreamJsonEvalRunner('fallback-brainstorming');

    const fallbackEvents: StreamJsonEvent[] = [
      {
        type: 'mode_switch',
        execution_mode: 'fallback-brainstorming',
      },
      {
        type: 'tool_call',
        agent: 'chris-director',
        tool: 'send_message',
        recipient: 'ava-manager',
        payload: `
## /handoff: Native Brainstorming Strategy
- **Goal & Purpose**: Outline market positioning using local knowledge and brainstorm notes.
- **Audience**: Product stakeholders.
- **Constraints**: No external MCP APIs available; rely strictly on local git repo and markdown templates.
- **Deliverables & Next Steps**: Draft strategy brief in docs/strategy.md.
        `,
      },
    ];

    const ndjson = StreamJsonEvalRunner.toNdjson(fallbackEvents);
    await runner.feedChunk(ndjson);
    const summary = await runner.finalize();

    expect(summary.executionMode).toBe('fallback-brainstorming');
    expect(summary.passedHandoffs).toBe(1);
    expect(summary.traces[0].verdict.criteria.respects_execution_mode).toBe(true);
  });

  it('4. Fast-fails low quality / incomplete handoffs and produces structured diagnostics', async () => {
    const runner = new StreamJsonEvalRunner('fully-operational');

    const vagueEvent: StreamJsonEvent = {
      type: 'tool_call',
      agent: 'chris-director',
      tool: 'send_message',
      recipient: 'ava-manager',
      payload: `
/handoff Hey Ava, let's make a new website for our client. Please do whatever you think is best.
      `,
    };

    const ndjson = StreamJsonEvalRunner.toNdjson([vagueEvent]);
    await runner.feedChunk(ndjson);
    const summary = await runner.finalize();

    expect(summary.totalHandoffsEvaluated).toBe(1);
    expect(summary.passedHandoffs).toBe(0);
    expect(summary.failedHandoffs).toBe(1);
    expect(summary.allPassed).toBe(false);
    expect(summary.traces[0].verdict.stage1_gatekeeper_passed).toBe(true);
    expect(summary.traces[0].verdict.passed).toBe(false);
    expect(summary.traces[0].verdict.failure_reason).toContain('Handoff failed semantic standards');
  });

  it('5. Ignores non-handoff tool calls and noise events gracefully without crashing', async () => {
    const runner = new StreamJsonEvalRunner('fully-operational');

    const mixedEvents: StreamJsonEvent[] = [
      { type: 'thought', payload: 'Thinking about the campaign structure...' },
      { type: 'tool_call', tool: 'run_command', payload: 'git status' },
      { type: 'tool_result', tool: 'run_command', payload: 'clean working tree' },
    ];

    const ndjson = StreamJsonEvalRunner.toNdjson(mixedEvents);
    await runner.feedChunk(ndjson);
    const summary = await runner.finalize();

    expect(summary.totalEventsProcessed).toBe(3);
    expect(summary.totalHandoffsEvaluated).toBe(0);
    expect(summary.allPassed).toBe(true);
  });
});
