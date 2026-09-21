import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { ClaudeProjector } from '../src/core/claude-projector.js';
import type { BundleDefinition, ResolvedAssets } from '../src/core/types.js';

/**
 * Plan 016 / ADR 0018 — the Claude Code compound lane.
 *
 * RED-PHASE SUITE: `src/core/claude-projector.ts` does not exist yet, so every test
 * that touches the module fails with a module-resolution error. That is the intended
 * Red state for Step 2; Step 3 implements the renderer until this suite is green.
 */

const SAMPLE = `---
name: subagent-backend-architect
version: 2.0.0
type: subagent
description: >
  TypeScript/Node.js backend API architect for REST, GraphQL and Supabase services.
model: inherit
permissionMode: acceptEdits
commandExecutionPolicy: auto
effort: medium
mainAgent: false
subagent: true
rules:
  - git-guardrails.md
tools:
  - view_file
  - replace_file_content
  - multi_replace_file_content
  - write_to_file
  - run_command
  - grep_search
  - find_by_name
  - list_dir
  - search_web
  - read_url_content
  - ask_question
  - invoke_subagent
  - define_subagent
  - manage_subagents
  - send_message
  - manage_task
  - schedule
  - generate_image
hooks:
  PreInvocation:
    - log: start
---

# subagent-backend-architect — System Prompt

## Role Definition

Use view_file to inspect the tree, then run_command to execute the suite.
Persist findings with write_to_file, patch code with replace_file_content, and batch edits with multi_replace_file_content.
Locate symbols with grep_search, find_by_name, or list_dir before changing them.
Delegate with invoke_subagent, or define_subagent when a new specialist is needed, and manage_subagents to keep the roster tidy.
Track work with manage_task. Schedule recurring checks with schedule later.
Search the web with search_web and fetch pages with read_url_content.
Ask the user with ask_question only when genuinely blocked.
Publish a diagram with generate_image when the report needs one.

\`\`\`bash
run_command --dry-run
view_file README.md
\`\`\`
`;

const ORCHESTRATOR_SAMPLE = `---
name: orchestrator-engineering
version: 2.0.0
type: orchestrator
description: Autonomous engineering lead coordinating vertical slices.
model: inherit
permissionMode: acceptEdits
effort: high
mainAgent: true
subagent: true
tools:
  - invoke_subagent
  - manage_subagents
  - view_file
  - run_command
---

# orchestrator-engineering — System Prompt
`;

const READ_ONLY_SAMPLE = `---
name: subagent-code-reviewer
description: Read-only review specialist.
model: inherit
permissionMode: readOnly
effort: low
tools:
  - view_file
  - grep_search
---

# subagent-code-reviewer — System Prompt
`;

const SKILL_SAMPLE = `---
name: generative_ui
description: How to render rich interactive HTML widgets inline in chat.
disable-slash-command: true
metadata:
  author: agents-united
  version: 2.0.0
  icon: "🎨"
  customField: should-be-stripped
---

# Generative UI

Load the generative_ui skill when the user asks for an inline widget.
`;

const CANONICAL_AGENT_PATH = 'agents/subagent-backend-architect.md';

function yamlOf(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  expect(match, 'projection must start with YAML frontmatter').not.toBeNull();
  return (yaml.parse(match![1]) as Record<string, unknown>) || {};
}

function bodyOf(content: string): string {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  expect(match, 'projection must have a body').not.toBeNull();
  return match![2];
}

function fencedBlocks(content: string): string[] {
  return content.match(/```[\s\S]*?```/g) ?? [];
}

describe('ClaudeProjector.renderRole — frontmatter translation', () => {
  it('strips the subagent- prefix and keeps name/description', () => {
    const { content } = ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH);
    const meta = yamlOf(content);
    expect(meta.name).toBe('backend-architect');
    expect(String(meta.description)).toContain('TypeScript/Node.js backend API architect');
  });

  it('drops every Antigravity-only key', () => {
    const { content } = ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH);
    const meta = yamlOf(content);
    for (const key of ['version', 'type', 'hooks', 'commandExecutionPolicy', 'mainAgent', 'subagent', 'rules', 'inheritCustomizations']) {
      expect(`${key} in meta: ${key in meta}`).toBe(`${key} in meta: false`);
    }
  });

  it('passes effort through and maps permissionMode', () => {
    expect(yamlOf(ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH).content).effort).toBe('medium');
    expect(yamlOf(ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH).content).permissionMode).toBe('acceptEdits');

    const readOnly = yamlOf(ClaudeProjector.renderRole(READ_ONLY_SAMPLE, 'agents/subagent-code-reviewer.md').content);
    expect(readOnly.permissionMode).toBe('plan');
    expect(readOnly.tools).not.toContain('Write');
    expect(readOnly.tools).not.toContain('Edit');
  });

  it('omits model: inherit and maps pro/flash tiers', () => {
    expect('model' in yamlOf(ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH).content)).toBe(false);

    const pro = ClaudeProjector.renderRole(SAMPLE.replace('model: inherit', 'model: pro'), CANONICAL_AGENT_PATH);
    expect(yamlOf(pro.content).model).toBe('sonnet');

    const flash = ClaudeProjector.renderRole(SAMPLE.replace('model: inherit', 'model: flash'), CANONICAL_AGENT_PATH);
    expect(yamlOf(flash.content).model).toBe('haiku');
  });

  it('renders the Consultation Budget maxIterations as maxTurns', () => {
    const { content } = ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH, { maxTurns: 8 });
    expect(yamlOf(content).maxTurns).toBe(8);
  });

  it('places the managed marker as the first body line', () => {
    const { content } = ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH);
    const firstBodyLine = bodyOf(content).split('\n')[0];
    expect(firstBodyLine).toBe(
      '<!-- managed-by: agents-united | profile: claude | canonical: agents/subagent-backend-architect.md | do not edit -->'
    );
  });
});

describe('ClaudeProjector.renderRole — delegation restoration', () => {
  it('renders an Agent(...) allowlist for a coordinator', () => {
    const { content } = ClaudeProjector.renderRole(ORCHESTRATOR_SAMPLE, 'agents/orchestrator-engineering.md', {
      allowlist: ['backend-architect', 'code-reviewer'],
    });
    const tools = yamlOf(content).tools as string[];
    expect(tools[0]).toBe('Agent(backend-architect, code-reviewer)');
    for (const expected of ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']) {
      expect(tools).toContain(expected);
    }
  });

  it('renders a bare Agent for a specialist', () => {
    const tools = yamlOf(ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH).content).tools as string[];
    expect(tools).toContain('Agent');
    expect(tools.some(t => t.startsWith('Agent('))).toBe(false);
  });

  it('never leaks an unmapped canonical tool name into the projection', () => {
    const { content } = ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH);
    for (const token of ['invoke_subagent', 'define_subagent', 'manage_subagents', 'manage_task', 'search_web', 'read_url_content']) {
      expect(`leak ${token}: ${content.includes(token)}`).toBe(`leak ${token}: false`);
    }
  });
});

describe('ClaudeProjector.CLAUDE_DIALECT — vocabulary shape', () => {
  it('exposes the Claude name rule and budgets', () => {
    expect(ClaudeProjector.CLAUDE_DIALECT.id).toBe('claude');
    expect(ClaudeProjector.CLAUDE_DIALECT.nameRegex.test('backend-architect')).toBe(true);
    expect(ClaudeProjector.CLAUDE_DIALECT.nameRegex.test('generative_ui')).toBe(false);
    expect(ClaudeProjector.CLAUDE_DIALECT.budgets.skillDescriptionChars).toBe(1536);
    expect(ClaudeProjector.CLAUDE_DIALECT.budgets.agentDescriptionTokens).toBe(15000);
    expect(ClaudeProjector.CLAUDE_DIALECT.maxRuleLines).toBe(200);
  });

  it('maps every frontmatter tool token used by the catalog', () => {
    const v = ClaudeProjector.CLAUDE_DIALECT.toolVocabulary;
    expect(v.view_file).toBe('Read');
    expect(v.write_to_file).toBe('Write');
    expect(v.replace_file_content).toBe('Edit');
    expect(v.multi_replace_file_content).toBe('Edit');
    expect(v.run_command).toBe('Bash');
    expect(v.grep_search).toBe('Grep');
    expect(v.find_by_name).toBe('Glob');
    expect(v.list_dir).toBe('Glob');
    expect(v.read_file).toBe('Read');
    expect(v.search_web).toBe('WebSearch');
    expect(v.read_url_content).toBe('WebFetch');
    expect(v.invoke_subagent).toBe('Agent');
    expect(v.schedule).toBe('CronCreate');
    expect(v.generate_image).toBeUndefined();
  });

  it('maps permissionMode and model vocabularies', () => {
    expect(ClaudeProjector.CLAUDE_DIALECT.permissionModeMap.acceptEdits).toBe('acceptEdits');
    expect(ClaudeProjector.CLAUDE_DIALECT.permissionModeMap.readOnly).toBe('plan');
    expect(ClaudeProjector.CLAUDE_DIALECT.permissionModeMap.requestReview).toBe('default');
    expect(ClaudeProjector.CLAUDE_DIALECT.permissionModeMap.strict).toBe('default');
    expect(ClaudeProjector.CLAUDE_DIALECT.modelMap.pro).toBe('sonnet');
    expect(ClaudeProjector.CLAUDE_DIALECT.modelMap.flash).toBe('haiku');
  });
});

describe('ClaudeProjector.rewriteBody — prose is part of the interface', () => {
  const rewritten = ClaudeProjector.rewriteBody(bodyOf(SAMPLE));

  it('rewrites whole-word canonical tool names in prose', () => {
    expect(rewritten.body).toContain('Use Read to inspect the tree, then Bash to execute the suite.');
    expect(rewritten.body).toContain('Track work with TaskCreate.');
    expect(rewritten.body).toContain('Search the web with WebSearch and fetch pages with WebFetch.');
    expect(rewritten.body).toContain('the Agent tool');
  });

  it('leaves English-word collisions alone (schedule) and records the disposition at frontmatter level', () => {
    expect(rewritten.body).toContain('Schedule recurring checks with schedule later.');
    expect(rewritten.body).not.toContain('CronCreate');
    expect(rewritten.ledger.some(e => e.feature === 'schedule')).toBe(false);
    const roleLedger = ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH).ledger;
    expect(roleLedger.some(e => e.feature === 'schedule' && e.disposition === 'approximated')).toBe(true);
  });

  it('records a disposition for unsupported and approximated tool intents', () => {
    const byFeature = new Map(rewritten.ledger.map(e => [e.feature, e.disposition]));
    expect(byFeature.get('generate_image')).toBe('unsupported');
    expect(byFeature.get('define_subagent')).toBe('approximated');
    expect(byFeature.get('manage_subagents')).toBe('approximated');
    expect(byFeature.get('ask_question')).toBe('approximated');
  });

  it('never touches fenced code blocks', () => {
    const blocks = fencedBlocks(rewritten.body);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('run_command --dry-run');
    expect(blocks[0]).toContain('view_file README.md');
  });

  it('does not rewrite prose that merely resembles a tool name', () => {
    const plain = ClaudeProjector.rewriteBody('We will run a command and check the schedule later.');
    expect(plain.body).toBe('We will run a command and check the schedule later.');
    expect(plain.ledger).toEqual([]);
  });
});

describe('ClaudeProjector.renderSkill — skills lane', () => {
  const CANON = 'skills/generative_ui/SKILL.md';

  it('normalizes an invalid skill name in the artifact name and frontmatter', () => {
    expect(ClaudeProjector.normalizeSkillName('generative_ui')).toBe('generative-ui');
    expect(ClaudeProjector.normalizeSkillName('test-driven-development')).toBe('test-driven-development');
    expect(yamlOf(ClaudeProjector.renderSkill(SKILL_SAMPLE, CANON).content).name).toBe('generative-ui');
  });

  it('maps disable-slash-command to user-invocable:false and never to disable-model-invocation', () => {
    const { content } = ClaudeProjector.renderSkill(SKILL_SAMPLE, CANON);
    expect(yamlOf(content)['user-invocable']).toBe(false);
    expect(content).not.toContain('disable-model-invocation');
    expect(content).not.toContain('disable-slash-command');
  });

  it('strips non-standard fields and rewrites skill references inside the body', () => {
    const { content } = ClaudeProjector.renderSkill(SKILL_SAMPLE, CANON);
    expect(content).not.toContain('customField');
    // The managed marker legitimately records the canonical path (which carries the original name);
    // only the projected prose must be free of it.
    const prose = bodyOf(content).split('\n').slice(1).join('\n');
    expect(prose).not.toContain('generative_ui');
    expect(prose).toContain('generative-ui skill');
  });

  it('places the managed marker as the first body line', () => {
    const { content } = ClaudeProjector.renderSkill(SKILL_SAMPLE, CANON);
    expect(bodyOf(content).split('\n')[0]).toBe(
      '<!-- managed-by: agents-united | profile: claude | canonical: skills/generative_ui/SKILL.md | do not edit -->'
    );
  });
});

describe('ClaudeProjector.renderRule — lean rules lane', () => {
  const RULE = '# Persistent Rule: Git Guardrails\n\n## Safety Directives\n\n1. Never force-push.\n';

  it('emits optional path scoping plus a managed marker as the first body line', () => {
    const { content } = ClaudeProjector.renderRule(RULE, 'rules/git-guardrails.md', { paths: ['**/*.ts'] });
    expect(yamlOf(content).paths).toEqual(['**/*.ts']);
    expect(bodyOf(content).split('\n')[0]).toContain('canonical: rules/git-guardrails.md');
    expect(content).toContain('Never force-push.');
  });

  it('renders an unconditional rule when no paths are supplied', () => {
    expect('paths' in yamlOf(ClaudeProjector.renderRule(RULE, 'rules/git-guardrails.md').content)).toBe(false);
  });

  it('refuses a rule that exceeds the adherence budget', () => {
    const tooLong = Array.from({ length: ClaudeProjector.CLAUDE_DIALECT.maxRuleLines + 5 }, (_, i) => `line ${i}`).join('\n');
    expect(() => ClaudeProjector.renderRule(tooLong, 'rules/too-long.md')).toThrowError();
  });
});

describe('ClaudeProjector.planCompoundProjection — compound lane', () => {
  const bundle: BundleDefinition = {
    name: 'software-engineering',
    description: 'Software engineering bundle',
    orchestrator: 'orchestrator-engineering.md',
    agents: ['subagent-backend-architect.md', 'subagent-code-reviewer.md'],
    skills: ['test-driven-development'],
  };
  const resolved: ResolvedAssets = {
    targetBundle: 'software-engineering',
    agents: ['orchestrator-engineering.md', 'subagent-backend-architect.md', 'subagent-code-reviewer.md'],
    skills: ['test-driven-development'],
    workflows: [],
    rules: ['GEMINI.md', 'git-guardrails.md'],
  };
  const registryDir = path.resolve(process.cwd(), 'registry');

  it('projects roles, skills and rules into .claude/ and skips host entrypoint rules', async () => {
    const paths = (await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registryDir)).map(a => a.relPath);
    expect(paths).toContain('.claude/agents/backend-architect.md');
    expect(paths).toContain('.claude/agents/orchestrator-engineering.md');
    expect(paths).toContain('.claude/skills/test-driven-development/SKILL.md');
    expect(paths).toContain('.claude/rules/git-guardrails.md');
    expect(paths).not.toContain('.claude/rules/GEMINI.md');
  });

  it('never emits an .claude/agents-united/ duplicate or a workflows artifact', async () => {
    const artifacts = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registryDir);
    expect(artifacts.some(a => a.relPath.startsWith('.claude/agents-united/'))).toBe(false);
    expect(artifacts.some(a => a.relPath.startsWith('.claude/workflows/'))).toBe(false);
    expect(artifacts.every(a => a.relPath.startsWith('.claude/'))).toBe(true);
  });

  it('gives the coordinator an Agent(...) allowlist of its own specialists', async () => {
    const artifacts = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registryDir);
    const coordinator = artifacts.find(a => a.relPath === '.claude/agents/orchestrator-engineering.md');
    expect(String(coordinator?.content)).toContain('Agent(');
  });

  it('is deterministic across repeated planning runs', async () => {
    const first = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registryDir);
    const second = await ClaudeProjector.planCompoundProjection(bundle, 'project', resolved, registryDir);
    const fingerprint = (list: typeof first) => list.map(a => `${a.relPath}:${a.content ?? a.sourceFilePath ?? ''}`);
    expect(fingerprint(second)).toEqual(fingerprint(first));
  });
});

describe('ClaudeProjector — errors and determinism', () => {
  it('throws on missing frontmatter', () => {
    expect(() => ClaudeProjector.renderRole('no frontmatter here', 'agents/x.md')).toThrowError();
  });

  it('throws on invalid YAML frontmatter', () => {
    expect(() => ClaudeProjector.renderRole('---\nname: [oops\n---\nbody', 'agents/x.md')).toThrowError();
  });

  it('throws when a dropped feature carries no translation-ledger disposition', () => {
    const unknown = SAMPLE.replace('effort: medium', 'effort: medium\nunmappedFutureKey: value');
    expect(() => ClaudeProjector.renderRole(unknown, CANONICAL_AGENT_PATH)).toThrowError(/disposition|ledger/i);
  });

  it('is byte-identical across repeated renders', () => {
    expect(ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH).content).toBe(
      ClaudeProjector.renderRole(SAMPLE, CANONICAL_AGENT_PATH).content
    );
  });
});



