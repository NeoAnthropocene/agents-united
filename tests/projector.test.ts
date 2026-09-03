import { describe, it, expect } from 'vitest';
import { HostProjector, ProjectionError } from '../src/core/projector.js';
import type { ProjectionProfile } from '../src/core/hosts.js';

/**
 * Real canonical fixture frontmatter (`.agents/agents/subagent-backend-architect.md`)
 * from plan 007 §3, embedded verbatim, with a representative body.
 */
const SAMPLE = `---
name: subagent-backend-architect
version: 2.0.0
type: subagent
description: >
  TypeScript/Node.js backend API architect. Designs, implements, and validates
  REST, GraphQL, gRPC, Supabase PostgreSQL (RLS & Edge Functions), Turso
  distributed LibSQL/SQLite, Vercel Edge Functions, and Azure Container Apps
  (Azure OpenAI) services with high scalability, low latency, and zero-trust security.
model: inherit
permissionMode: acceptEdits
commandExecutionPolicy: ask
mainAgent: false
subagent: true

tools:
  - view_file
  - replace_file_content
  - write_to_file
  - run_command
  - grep_search
  - list_dir

hooks:
  PreInvocation:
    - log: "subagent-backend-architect invoked"
  PostInvocation:
    - log: "subagent-backend-architect finished"
---

# subagent-backend-architect — System Prompt

## Role Definition

You are a senior TypeScript/Node.js backend architect.
`;

const CANONICAL_PATH = '.agents/agents/subagent-backend-architect.md';

function parsedProjection(res: ReturnType<typeof HostProjector.projectAgent>): { meta: Record<string, unknown>; body: string } {
  return HostProjector.parseFrontmatter(res.content);
}

describe('HostProjector.parseFrontmatter', () => {
  it('extracts name, tools array, and body from the canonical sample', () => {
    const { meta, body } = HostProjector.parseFrontmatter(SAMPLE);
    expect(meta.name).toBe('subagent-backend-architect');
    expect(Array.isArray(meta.tools)).toBe(true);
    expect(meta.tools).toEqual(['view_file','replace_file_content','write_to_file','run_command','grep_search','list_dir']);
    expect(body).toContain('# subagent-backend-architect — System Prompt');
    expect(body).toContain('## Role Definition');
  });

  it('throws ProjectionError when there is no frontmatter', () => {
    expect(() => HostProjector.parseFrontmatter('just a plain markdown file')).toThrowError(ProjectionError);
  });

  it('throws ProjectionError on invalid YAML frontmatter', () => {
    const bad = '---\nname: [unterminated\n---\nbody';
    expect(() => HostProjector.parseFrontmatter(bad)).toThrowError(ProjectionError);
  });
});
describe('HostProjector.projectAgent (claude-code)', () => {
  it('keeps name/description, omits inherit model, drops Antigravity-only keys', () => {
    const res = HostProjector.projectAgent(SAMPLE, 'claude-code', CANONICAL_PATH);
    const { meta } = parsedProjection(res);

    expect(meta.name).toBe('subagent-backend-architect');
    expect(meta.description).toContain('TypeScript/Node.js backend API architect');
    expect('model' in meta).toBe(false);
    expect('hooks' in meta).toBe(false);
    expect('permissionMode' in meta).toBe(false);
    expect('commandExecutionPolicy' in meta).toBe(false);
    expect('mainAgent' in meta).toBe(false);
    expect('subagent' in meta).toBe(false);
    expect('type' in meta).toBe(false);
    expect('version' in meta).toBe(false);
  });

  it('translates tools via TOOL_NAME_MAP', () => {
    const res = HostProjector.projectAgent(SAMPLE, 'claude-code', CANONICAL_PATH);
    const { meta } = parsedProjection(res);
    expect(meta.tools).toEqual(['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']);
  });

  it('keeps model when it is not inherit', () => {
    const withModel = SAMPLE.replace('model: inherit', 'model: claude-sonnet-4-5');
    const res = HostProjector.projectAgent(withModel, 'claude-code', CANONICAL_PATH);
    const { meta } = parsedProjection(res);
    expect(meta.model).toBe('claude-sonnet-4-5');
  });

  it('drops unknown tools and reports them in warnings (never keeps, never invents)', () => {
    const withUnknown = SAMPLE.replace(
      '  - list_dir\n',
      '  - list_dir\n  - invoke_subagent\n  - web_search\n'
    );
    const res = HostProjector.projectAgent(withUnknown, 'claude-code', CANONICAL_PATH);
    const { meta } = parsedProjection(res);
    expect(meta.tools).toEqual(['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob', 'WebSearch']);
    expect(meta.tools).not.toContain('invoke_subagent');
    expect(res.warnings.some((w) => w.includes('invoke_subagent'))).toBe(true);
  });

  it('preserves body verbatim and inserts the managed marker as the first body line', () => {
    const originalBody = HostProjector.parseFrontmatter(SAMPLE).body;
    const res = HostProjector.projectAgent(SAMPLE, 'claude-code', CANONICAL_PATH);
    const { body } = parsedProjection(res);

    const marker = `<!-- managed-by: agents-united | profile: claude-code | canonical: ${CANONICAL_PATH} | do not edit -->`;
    expect(body).toBe(`${marker}\n${originalBody}`);
    expect(res.content).toContain(marker);
  });
});
describe('HostProjector.projectAgent (profile-specific key sets)', () => {
  const profiles: ProjectionProfile[] = ['cursor', 'opencode'];
  for (const profile of profiles) {
    it(`produces the correct key set + marker for ${profile}`, () => {
      const res = HostProjector.projectAgent(SAMPLE, profile, CANONICAL_PATH);
      const { meta } = parsedProjection(res);

      expect(meta.name).toBe('subagent-backend-architect');
      expect(meta.tools).toEqual(['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob']);
      expect('model' in meta).toBe(false);
      expect('hooks' in meta).toBe(false);
      expect('permissionMode' in meta).toBe(false);
      expect('commandExecutionPolicy' in meta).toBe(false);
      expect('mainAgent' in meta).toBe(false);
      expect('subagent' in meta).toBe(false);
      expect('type' in meta).toBe(false);
      expect('version' in meta).toBe(false);

      expect(res.content).toContain(`profile: ${profile}`);
      expect(
        res.content.includes(
          `<!-- managed-by: agents-united | profile: ${profile} | canonical: ${CANONICAL_PATH} | do not edit -->`
        )
      ).toBe(true);
    });
  }

  it('produces the configured-agent YAML projection + preamble for cline (ADR 0013)', () => {
    const res = HostProjector.projectAgent(SAMPLE, 'cline', CANONICAL_PATH);
    const { meta, body } = parsedProjection(res);

    // The canonical subagent- prefix is stripped; Cline adds its own subagent_ tool prefix
    expect(meta.name).toBe('backend-architect');
    expect(meta.tools).toBeUndefined();
    expect('model' in meta).toBe(false);
    expect('hooks' in meta).toBe(false);
    expect('permissionMode' in meta).toBe(false);
    expect('commandExecutionPolicy' in meta).toBe(false);
    expect('mainAgent' in meta).toBe(false);
    expect('subagent' in meta).toBe(false);
    expect('type' in meta).toBe(false);
    expect('version' in meta).toBe(false);

    expect(res.content).toContain('profile: cline');
    expect(body).toContain('<!-- managed-by: agents-united | profile: cline');
    expect(body).toContain('## Cline runtime note');
    expect(body).toContain('You are a senior TypeScript/Node.js backend architect.');
  });
});

describe('HostProjector.projectAgent (errors)', () => {
  it('throws ProjectionError carrying the canonical file name when no frontmatter exists', () => {
    try {
      HostProjector.projectAgent('no frontmatter here at all', 'claude-code', CANONICAL_PATH);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProjectionError);
      const pe = err as ProjectionError;
      expect(pe.message).toContain('subagent-backend-architect.md');
      expect(pe.fileName).toBe(CANONICAL_PATH);
    }
  });

  it('throws ProjectionError on invalid YAML (does not surface a raw YAML error)', () => {
    const bad = '---\nname: [oops\n---\nbody';
    expect(() => HostProjector.projectAgent(bad, 'claude-code', CANONICAL_PATH)).toThrowError(
      ProjectionError
    );
  });
});

describe('HostProjector.projectAgent (determinism)', () => {
  it('produces byte-identical output for repeated calls', () => {
    const a = HostProjector.projectAgent(SAMPLE, 'claude-code', CANONICAL_PATH);
    const b = HostProjector.projectAgent(SAMPLE, 'claude-code', CANONICAL_PATH);
    expect(a.content).toBe(b.content);
    expect(a.warnings).toEqual(b.warnings);
  });
});

describe('HostProjector.buildAgentsMdIndex', () => {
  const assets = [
    { name: 'backend-architect', type: 'agent' as const, relPath: CANONICAL_PATH },
    { name: 'some-skill', type: 'skill' as const, relPath: '.agents/skills/some-skill/' },
    { name: 'workflow-build', type: 'workflow' as const, relPath: '.agents/workflows/workflow-build.md' },
  ];

  it('indexes every asset by name and canonical path, deterministically', () => {
    const index = HostProjector.buildAgentsMdIndex(assets);
    expect(index).toContain('backend-architect');
    expect(index).toContain(CANONICAL_PATH);
    expect(index).toContain('some-skill');
    expect(index).toContain('.agents/skills/some-skill/');
    expect(index).toContain('workflow-build');
    expect(index).toContain('.agents/workflows/workflow-build.md');

    const again = HostProjector.buildAgentsMdIndex(assets);
    expect(index).toBe(again);
  });

  it('renders a plain markdown index (no YAML frontmatter delimiters)', () => {
    const index = HostProjector.buildAgentsMdIndex(assets);
    expect(index.startsWith('---')).toBe(false);
  });
});
