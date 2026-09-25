import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { ClaudeProjector } from '../src/core/claude-projector.js';

/**
 * Plan 022 Step 1 — least-privilege suite (H2/H3), acceptance gates 5 and 6.
 *
 * Verified against the Claude Code sub-agents reference (2026-09-25): inside a subagent
 * definition `Agent(type, …)` IGNORES the type list, so any `Agent` entry lets a specialist
 * spawn anything within the nesting depth — the only bound is to omit it. `permissionMode:
 * plan` is a documented subagent mode (read-only exploration).
 *
 *   H2  specialists hold NO Agent tool (hub-and-spoke: the coordinator relays);
 *   H3  reviewers/indexers (code-reviewer, repo-index) run `plan` with no Bash/Write/Edit;
 *   H3  frontend-architect holds no TaskCreate/CronCreate;
 *   H4  every production-deploy exemplar carries a human-approval caveat.
 */
const AGENTS_DIR = path.resolve(process.cwd(), 'registry', 'agents');
const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md')).sort();
const specialists = files.filter(f => f.startsWith('subagent-'));
const read = (f: string): string => fs.readFileSync(path.join(AGENTS_DIR, f), 'utf8');

function rendered(file: string): { meta: Record<string, unknown>; tools: string[]; content: string } {
  const { content } = ClaudeProjector.renderRole(read(file), `agents/${file.replace(/^subagent-/, '')}`);
  const meta = yaml.parse(content.match(/^---\n([\s\S]*?)\n---/)![1]) as Record<string, unknown>;
  return { meta, tools: (meta.tools as string[]) ?? [], content };
}

const READ_ONLY_ROLES = ['subagent-code-reviewer.md', 'subagent-repo-index.md'];
const MUTATING = ['Bash', 'Write', 'Edit', 'NotebookEdit'];

describe('Plan 022 H2 — no nested spawning on specialists (gate 5)', () => {
  it('no projected specialist carries an Agent tool in any form', () => {
    const offenders = specialists.filter(file => rendered(file).tools.some(t => t === 'Agent' || t.startsWith('Agent(')));
    expect(offenders).toEqual([]);
  });

  it('the runtime note no longer tells specialists they may spawn peers', () => {
    const { content } = rendered('subagent-backend-architect.md');
    expect(content).not.toMatch(/specialists may spawn peers/);
    expect(content).toMatch(/specialists hold no Agent tool/);
  });
});

describe('Plan 022 H3 — read-only reviewers/indexers (gate 6)', () => {
  for (const file of READ_ONLY_ROLES) {
    it(`${file} projects read-only: permissionMode plan, no mutating tool`, () => {
      const { meta, tools } = rendered(file);
      expect(meta.permissionMode).toBe('plan');
      expect(tools.filter(t => MUTATING.includes(t))).toEqual([]);
      expect(tools).toEqual(expect.arrayContaining(['Read', 'Grep', 'Glob']));
    });
  }

  it('the canonical reviewer no longer instructs command execution', () => {
    const body = read('subagent-code-reviewer.md');
    expect(body).not.toMatch(/run_command/);
  });

  it('frontend-architect holds no TaskCreate/CronCreate', () => {
    const { tools, content } = rendered('subagent-frontend-architect.md');
    expect(tools.filter(t => t === 'TaskCreate' || t === 'CronCreate')).toEqual([]);
    const body = content.split(/\n---\n/).slice(1).join('\n');
    expect(body).not.toMatch(/`TaskCreate`|`CronCreate`/);
  });
});

describe('Plan 022 H4 — production-deploy exemplars need human approval', () => {
  it('every agent code block with a production deploy is followed by the approval caveat', () => {
    const violations: string[] = [];
    for (const file of files) {
      const body = read(file).replace(/\r\n/g, '\n');
      const fence = /```[\s\S]*?```/g;
      let match: RegExpExecArray | null;
      while ((match = fence.exec(body))) {
        if (!/deploy[^\n]*--prod\b|--prod\b[^\n]*deploy/.test(match[0])) continue;
        const after = body.slice(match.index + match[0].length, match.index + match[0].length + 400);
        if (!/Production deploy = human approval required/.test(after)) violations.push(`${file}: prod-deploy exemplar without approval caveat`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});

describe('Plan 022 H2/H3 — created lane (Realization Layers)', () => {
  it('created specialists carry their own least-privilege allowlist, never the whole profile surface', async () => {
    const { PILOT_STEMS, runPipeline } = await import('./helpers/created-golden.js');
    const violations: string[] = [];
    for (const stem of PILOT_STEMS) {
      const { created } = await runPipeline(stem);
      const front = yaml.parse(created.match(/^---\n([\s\S]*?)\n---/)![1]) as Record<string, unknown>;
      const tools = (front.tools as string[]) ?? [];
      if (stem.startsWith('orchestrator-')) continue;
      if (tools.some(t => t === 'Agent' || t.startsWith('Agent('))) violations.push(`${stem}: created specialist holds Agent`);
      if (stem === 'subagent-frontend-architect' && tools.some(t => /^(Task|Cron)/.test(t))) violations.push(`${stem}: task/cron tools`);
      if (stem === 'subagent-code-reviewer' || stem === 'subagent-repo-index') {
        if (front.permissionMode !== 'plan') violations.push(`${stem}: permissionMode ${String(front.permissionMode)}`);
        const mutating = tools.filter(t => MUTATING.includes(t));
        if (mutating.length > 0) violations.push(`${stem}: mutating tools ${mutating.join(',')}`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
