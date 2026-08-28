import YAML from 'yaml';
import type { ProjectionProfile } from './hosts.js';
import { ClineProjector } from './cline-projector.js';

/**
 * Error raised by {@link HostProjector} when a canonical file cannot be projected:
 * missing frontmatter, invalid YAML, or a serialization failure. Always carries the
 * canonical file name (relative path) and, when known, the underlying cause.
 */
export class ProjectionError extends Error {
  public readonly fileName: string;
  public readonly cause?: unknown;

  constructor(message: string, fileName: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'ProjectionError';
    this.fileName = fileName;
    this.cause = cause;
  }
}

/** Result of projecting one canonical asset into a host runtime's dialect. */
export interface ProjectionResult {
  /** Full output file: frontmatter + managed marker + verbatim body. */
  content: string;
  /** Dropped tools, degraded orchestrator notices, etc. */
  warnings: string[];
}

/** A canonical asset destined for the root AGENTS.md bridge index. */
export interface IndexableAsset {
  name: string;
  type: 'agent' | 'skill' | 'workflow';
  relPath: string;
}

/**
 * Antigravity tool name -> host-native tool name. Anything not present here is
 * **unknown**: it is dropped from the output and reported in `warnings` — never kept
 * in its original form and never assigned an invented mapping. The set covers every
 * documented tool in plan 007 §5; unknown tools (e.g. invoke_subagent) are dropped.
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  view_file: 'Read',
  replace_file_content: 'Edit',
  write_to_file: 'Write',
  run_command: 'Bash',
  grep_search: 'Grep',
  list_dir: 'Glob',
  read_file: 'Read',
  search_file_content: 'Grep',
  apply_diff: 'Edit',
  web_search: 'WebSearch',
};

/** Antigravity-only keys that must never be projected into other runtimes. */
const ANTIGRAVITY_ONLY_KEYS = [
  'version',
  'type',
  'permissionMode',
  'commandExecutionPolicy',
  'mainAgent',
  'subagent',
  'hooks',
  'inheritCustomizations',
  'rules',
  'effort',
] as const;

/** Reused from src/core/doctor.ts:48. */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]+?)\r?\n---/;

export class HostProjector {
  /**
   * Splits a canonical file into its YAML frontmatter metadata and markdown body.
   * The returned body starts right after the closing `---` delimiter so callers can
   * insert a managed marker as the very first body line.
   */
  public static parseFrontmatter(
    content: string,
    fileName = '<memory>'
  ): { meta: Record<string, unknown>; body: string } {
    const match = content.match(FRONTMATTER_REGEX);
    if (!match) {
      throw new ProjectionError(
        `No YAML frontmatter found in ${fileName}. Expected a leading "---" block.`,
        fileName
      );
    }
    let parsed: unknown;
    try {
      parsed = YAML.parse(match[1]);
    } catch (cause) {
      const err =
        cause instanceof Error ? cause : new Error(typeof cause === 'string' ? cause : '');
      throw new ProjectionError(
        `Invalid YAML frontmatter in ${fileName}: ${err.message}`,
        fileName,
        err
      );
    }
    const meta =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    // Strip the single line terminator that ends the closing `---` delimiter so a
    // projected managed marker becomes the true first line of the returned body.
    const body = content.slice(match[0].length).replace(/^\r?\n/, '');
    return { meta, body };
  }
/**
   * Projects a canonical `.agents/` file into the given {@link ProjectionProfile}'s
   * native dialect, stamping it with the managed marker and preserving the body
   * verbatim (line endings normalized to `\n`).
   */
  public static projectAgent(
    md: string,
    profile: ProjectionProfile,
    canonicalRelPath: string
  ): ProjectionResult {
    const { meta, body } = HostProjector.parseFrontmatter(md, canonicalRelPath);
    const warnings: string[] = [];
    const normalizedBody = body.replace(/\r\n/g, '\n');
    const marker = `<!-- managed-by: agents-united | profile: ${profile} | canonical: ${canonicalRelPath} | do not edit -->`;

    // agentsmd: AGENTS.md bridge entry (name -> link text, description -> table cell,
    // body -> link to the canonical path).
    if (profile === 'agentsmd') {
      const name = typeof meta.name === 'string' ? meta.name : '(unnamed)';
      const description =
        typeof meta.description === 'string'
          ? meta.description.replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|')
          : '';
      const link = canonicalRelPath.replace(/\\/g, '/');
      const content = [
        `## ${name}`,
        '',
        `| ${name} | ${description} |`,
        '| --- | --- |',
        '',
        `[View source](${link})`,
        '',
        marker,
        '',
      ].join('\n');
      return { content, warnings };
    }

    if (profile === 'cline') {
      const content = ClineProjector.renderRole(md, canonicalRelPath);
      return { content, warnings };
    }

    // Frontmatter profiles: claude-code, cursor, opencode. Keep name/description;
    // keep model unless `inherit`; translate tools; drop all Antigravity-only keys
    // (see field policy, plan 007 §5 step 3).
    const out: Record<string, unknown> = {};
    out.name = meta.name;
    if (typeof meta.description === 'string') {
      out.description = meta.description;
    }
    if (meta.model !== undefined && meta.model !== 'inherit') {
      out.model = meta.model;
    }
    // Explicitness guard: never let an Antigravity-only key leak into a native profile,
    // even if a future refactor stops building `out` from a clean object map.
    for (const key of ANTIGRAVITY_ONLY_KEYS) {
      delete out[key];
    }
    if (Array.isArray(meta.tools)) {
      const translated: string[] = [];
      for (const raw of meta.tools) {
        if (typeof raw !== 'string') {
          continue;
        }
        const mapped = TOOL_NAME_MAP[raw];
        if (mapped !== undefined) {
          translated.push(mapped);
        } else {
          warnings.push(
            `Dropping unknown tool "${raw}" for profile ${profile}: no known name mapping (never kept, never invented).`
          );
        }
      }
      out.tools = translated;
    }

    let yamlStr: string;
    try {
      yamlStr = YAML.stringify(out).replace(/\r\n/g, '\n').trimEnd();
    } catch (cause) {
      const err = cause instanceof Error ? cause : new Error(String(cause));
      throw new ProjectionError(
        `Failed to serialize frontmatter for ${canonicalRelPath}: ${err.message}`,
        canonicalRelPath,
        err
      );
    }
    const content = `---\n${yamlStr}\n---\n${marker}\n${normalizedBody}`;
    return { content, warnings };
  }

  /**
   * Returns true when `content` is one of our managed projections. Agent projections
   * carry the marker as the first body line after the frontmatter; the AGENTS.md
   * bridge has no frontmatter, so the whole document is checked. Used to distinguish
   * "our own deterministic projection" (safe to regenerate) from foreign user files
   * (never overwritten without --force).
   */
  public static hasManagedMarker(content: string): boolean {
    const match = content.match(FRONTMATTER_REGEX);
    if (match) {
      const rest = content.slice(match[0].length).replace(/^\r?\n/, '');
      const firstLine = rest.split(/\r?\n/)[0] || '';
      return firstLine.includes('managed-by: agents-united');
    }
    return content.includes('managed-by: agents-united');
  }

  /**
   * Builds the root AGENTS.md bridge index, grouping canonical assets by type and
   * linking each to its canonical `.agents/` path. Deterministic for identical input.
   */
  public static buildAgentsMdIndex(
    assets: IndexableAsset[]
  ): string {
    const sections: Array<'agent' | 'skill' | 'workflow'> = ['agent', 'skill', 'workflow'];
    const lines: string[] = [];
    lines.push('# agents-united — Managed Agents Index');
    lines.push('');
    lines.push('<!-- managed-by: agents-united | profile: agentsmd | do not edit -->');
    lines.push('');
    lines.push(
      'This index links the canonical `.agents/` store for runtimes without a subagent loader. Files under `.claude/`, `.cursor/`, `.cline/`, and `.opencode/` are machine-managed projections (see marker lines).'
    );
    lines.push('');
    for (const type of sections) {
      const heading =
        type === 'agent' ? '## Agents' : type === 'skill' ? '## Skills' : '## Workflows';
      lines.push(heading);
      lines.push('');
      const items = assets
        .filter((a) => a.type === type)
        .map((a) => ({ ...a, relPath: a.relPath.replace(/\\/g, '/') }));
      if (items.length === 0) {
        lines.push('_none_');
        lines.push('');
        continue;
      }
      for (const item of items) {
        lines.push(`- [${item.name}](${item.relPath})`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }
}