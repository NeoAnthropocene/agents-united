import yaml from 'yaml';
import path from 'node:path';
import fs from 'fs-extra';
import type {
  BundleDefinition,
  ClaudePluginManifest,

  InstallScope,
  LedgerDisposition,
  ProjectionKind,
  ResolvedAssets,
  TranslationLedgerEntry,
} from './types.js';
import type { ClaudeDialect } from './types.js';

/** Result of rendering one canonical asset into the Claude dialect. */
export interface ClaudeRenderResult {
  content: string;
  ledger: TranslationLedgerEntry[];
}

/** A planned Claude projection artifact (workspace-root-relative POSIX path). */
export interface PlannedClaudeArtifact {
  kind: ProjectionKind;
  canonical?: string;
  relPath: string;
  content?: string;
  sourceFilePath?: string;
  /** ADR 0018 decision 12 — distribution-only artifact: tracked, but never a `projectedTo` target. */
  distributionOnly?: boolean;

  managedMarker: boolean;
}

/** Canonical frontmatter keys that map 1:1 into a Claude field (no loss, no ledger row). */
const INLINE_KEYS = new Set([
  'name',
  'description',
  'model',
  'permissionMode',
  'effort',
  'tools',
  'maxIterations',
  'projections',
]);

/**
 * ADR 0018 decision 9 — every canonical feature that cannot survive verbatim carries exactly one
 * disposition. A drop with no entry here is a hard error, never a silent warning.
 */
const FEATURE_LEDGER: Record<string, { disposition: LedgerDisposition; rationale: string }> = {
  version: { disposition: 'mapped', rationale: 'Authoring metadata for the canonical store; no Claude field needed.' },
  type: { disposition: 'mapped', rationale: 'Canonical role discriminator; Claude distinguishes roles by file location.' },
  mainAgent: { disposition: 'mapped', rationale: 'Canonical masthead flag; Claude decides main-thread status at launch (--agent).' },
  subagent: { disposition: 'mapped', rationale: 'Canonical masthead flag; every file under .claude/agents/ is a subagent.' },
  inheritCustomizations: { disposition: 'mapped', rationale: 'Claude loads CLAUDE.md and project memory unless omitClaudeMd is set (flag-gated).' },
  commandExecutionPolicy: { disposition: 'unsupported', rationale: 'Antigravity shell policy has no Claude frontmatter equivalent; Bash permissions cover it.' },
  hooks: { disposition: 'unsupported', rationale: 'Antigravity hook schema (PreInvocation/PostInvocation matchers) differs from Claude hook events; not translated in v1.' },
  rules: { disposition: 'mapped', rationale: 'Agent-referenced rules project into the lean .claude/rules/ lane.' },
  effort: { disposition: 'mapped', rationale: 'Reasoning effort passes through to the Claude effort field.' },
  invoke_subagent: { disposition: 'mapped', rationale: 'Delegation maps to the Claude Agent tool (allowlist on coordinators).' },
  send_message: { disposition: 'approximated', rationale: 'Maps to the Claude SendMessage tool; cross-session reach differs from Antigravity messaging.' },
  manage_task: { disposition: 'approximated', rationale: 'Maps to the Claude task tools (TaskCreate/TaskUpdate), but the live tools reference says they are "provided by default only on the models listed under Task tool availability, and on other models when you opt in" — so the grant can resolve to nothing depending on the model.' },
  schedule: { disposition: 'approximated', rationale: 'Maps to Cron tools, but Antigravity reactive liveness timers are event-driven rather than cron-scheduled.' },
  define_subagent: { disposition: 'approximated', rationale: 'Claude agents are pre-defined: runtime subagent definition is unavailable, so the prompt delegates via the Agent tool.' },
  manage_subagents: { disposition: 'approximated', rationale: 'Claude manages subagent lifecycle itself; the roster is static and the prompt delegates via the Agent tool.' },
  ask_question: { disposition: 'approximated', rationale: 'Claude exposes AskUserQuestion only in the main conversation (excluded from subagents by default).' },
  generate_image: { disposition: 'unsupported', rationale: 'Claude Code exposes no image-generation tool; asset creation must happen outside the agent run.' },
  skills: { disposition: 'degraded', rationale: 'Claude subagents discover project skills and can invoke them; the canonical preload list is not injected to avoid paying its token cost on every spawn.' },
  mcpServers: { disposition: 'degraded', rationale: 'Claude supports per-subagent mcpServers, but the canonical descriptor dialect differs; MCP wiring stays host-configured via the MCP location registry (translation deferred).' },
};

const MARKER_PROFILE = 'claude';
/**
 * The marker string `HostProjector.hasManagedMarker()` greps for. Kept as one constant because
 * the JSON plugin manifest (which cannot carry the HTML-comment form) must contain exactly this
 * substring to be recognised as ours by both `applyCompoundLane` and `agents doctor`.
 */
const MARKER_PREFIX = 'managed-by: agents-united';

const HOST = 'claude';
const ENTRYPOINT_RULES = new Set(['CLAUDE.md', 'CLAUDE.local.md', 'GEMINI.md', 'AGENTS.md', 'CURSOR.md']);

/**
 * ADR 0018 decision 3 — a coordinator is the delegation hub, so its projected tool set is the
 * translated canonical list unioned with this baseline. Specialists keep exactly their declared
 * (translated) tools plus `Agent`, so a read-mostly specialist is never silently granted write tools.
 */
const COORDINATOR_BASELINE_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

const RUNTIME_NOTE = `## Claude runtime note

Delegation runs through the Agent tool: the coordinator spawns the specialists named in its own tools
allowlist, and specialists may spawn peers. Canonical tool names in this prompt were rewritten to their
Claude equivalents; a fenced code block may still show the original spelling because code is preserved
byte-for-byte. A subagent does not hand results to a peer: its final report is returned to the
conversation that spawned it, and on Claude Code v2.1.271+ in auto mode the runtime delivers it through the
SubagentHandback tool.`;

export class ClaudeProjector {
  /** Pure data (Plan 017 lifts this object into a shared HostDialectSpec). */
  public static readonly CLAUDE_DIALECT: ClaudeDialect = {
    id: 'claude',
    nameRegex: /^[a-z0-9]+(-[a-z0-9]+)*$/,
    toolVocabulary: {
      view_file: 'Read',
      read_file: 'Read',
      replace_file_content: 'Edit',
      apply_diff: 'Edit',
      multi_replace_file_content: 'Edit',
      write_to_file: 'Write',
      run_command: 'Bash',
      grep_search: 'Grep',
      search_file_content: 'Grep',
      list_dir: 'Glob',
      find_by_name: 'Glob',
      web_search: 'WebSearch',
      search_web: 'WebSearch',
      read_url_content: 'WebFetch',
      invoke_subagent: 'Agent',
      define_subagent: 'Agent',
      manage_subagents: 'Agent',
      send_message: 'SendMessage',
      manage_task: 'TaskCreate',
      schedule: 'CronCreate',
      ask_question: 'AskUserQuestion',
      // The runtime's own hand-off channel for subagents (Claude Code v2.1.271+, auto mode): it delivers
      // a subagent's final report to whichever conversation receives that subagent's result. It has no
      // Antigravity-dialect equivalent, so the lane grants it to specialists directly (see renderRole);
      // the token exists so a canonical agent could also name it explicitly.
      subagent_handback: 'SubagentHandback',
    },
    bodyToolVocabulary: {
      view_file: 'Read',
      read_file: 'Read',
      write_to_file: 'Write',
      replace_file_content: 'Edit',
      apply_diff: 'Edit',
      multi_replace_file_content: 'Edit',
      run_command: 'Bash',
      grep_search: 'Grep',
      find_by_name: 'Glob',
      list_dir: 'Glob',
      search_web: 'WebSearch',
      read_url_content: 'WebFetch',
      invoke_subagent: 'Agent',
      define_subagent: 'the Agent tool',
      manage_subagents: 'the Agent tool',
      // ADR 0018 decision 8 requires canonical tool names in prose to be rewritten, not just the
      // frontmatter vocabulary: a specialist reading "reach a peer with `send_message`" would otherwise
      // look for a tool that does not exist on this host. Whole-word and code-fence-aware like the rest.
      send_message: 'SendMessage',
      manage_task: 'TaskCreate',
      ask_question: 'AskUserQuestion',
      generate_image: 'image generation (unsupported on this host)',
      // `schedule` is deliberately absent: it is an ordinary English word, so rewriting it in prose
      // would corrupt sentences. Its loss is recorded once at frontmatter level instead.
    },
    permissionModeMap: {
      acceptEdits: 'acceptEdits',
      readOnly: 'plan',
      requestReview: 'default',
      strict: 'default',
    },
    modelMap: { pro: 'sonnet', flash: 'haiku' },
    // ADR 0018 decision 7, amended 2026-09-22 by the product owner. The canonical catalog declares
    // `model: inherit` on all 59 agents, which made `inherit` the de-facto value and left every
    // projection inheriting the *session* model instead of a chosen posture. The intended posture is
    // explicit — coordinators reason on Opus at high effort, specialists run on Sonnet at medium
    // effort — so `inherit` now resolves to a role default rather than being omitted. Both fields are
    // documented subagent frontmatter: `model` accepts sonnet|opus|haiku|fable|<full id>|inherit, and
    // `effort` (low|medium|high|xhigh|max) overrides the session effort level. Caveats recorded rather
    // than coded around: Opus is unavailable on some plans, so a workspace may need a different anchor;
    // and `xhigh`/`max` exist only on newer models. Both are one-constant changes here.
    roleModelDefaults: { coordinator: 'opus', specialist: 'sonnet' },
    roleEffortDefaults: { coordinator: 'high', specialist: 'medium' },
    bodySectionOverrides: [
      {
        // Plan 019 escape hatch (2026-09-25): the old anchor — "Subagent Delegation & Host
        // Routing" — was residue (it described OTHER runtimes: Antigravity's language_server.exe
        // limitation and Cline's subagent_* tools) and the G1 purge deleted it. Its Claude-side
        // rendering survives as this per-host overlay, keyed on the neutral "Delegation
        // Mechanics" stub in canonical; hosts without an overlay render the stub itself.
        heading: /^#{2,3}\s*.*Delegation Mechanics/m,
        replacement: [
          '### ⚡ Subagent Delegation & Agent Routing (Claude Code)',
          '',
          '- **Delegation tool**: spawn specialists with the `Agent` tool. Your `tools` allowlist names exactly the specialist types you may call (the projected definitions in `.claude/agents/`, with the `subagent-` prefix stripped); calling any other type fails, so send work only to those names. There are no `TypeName`/`Role`/`Prompt` fields — `Agent` takes the specialist type and one self-contained prompt, so put the role, the scope boundaries and the acceptance criteria inside that prompt.',
          '- **Parallel work**: spawn independent specialists in one turn — each runs in its own context window and returns its result to you (delivered by `SubagentHandback` on Claude Code v2.1.271+ in auto mode). You are the single synthesis and relay point: name who reported what, and never let one specialist wait on another.',
          '- **Your allowlist is the whole domain team, not only what is installed.** A listed type whose definition is not in this workspace yet will fail to spawn: say so, recommend installing it (`agents add <addon>`), and handle that slice yourself if the user declines. Never delegate to a type outside your allowlist.',
          '- **Agent Teams (opt-in, `--teams`)**: the lead can spawn *teammates* instead of subagents and message them directly with `SendMessage`. The scaffold is experimental — one team per session, a fixed lead, no nested teams — so never make it load-bearing.',
        ].join('\n'),
      },
    ],
    budgets: { skillDescriptionChars: 1536, agentDescriptionTokens: 15000 },
    maxRuleLines: 200,
  };

  /** `subagent-backend-architect` -> `backend-architect` (Step 0 proved zero collisions). */
  public static stripSubagentPrefix(name: string): string {
    return name.trim().replace(/^subagent-/, '');
  }

  /** Uniform managed-projection marker; always the first line of the projected body. */
  private static marker(canonicalRelPath: string): string {
    const norm = canonicalRelPath.replace(/\\/g, '/');
    return `<!-- managed-by: agents-united | profile: ${MARKER_PROFILE} | canonical: ${norm} | do not edit -->`;
  }

  /** `generative_ui` -> `generative-ui`: every dialect requires lowercase-hyphen names. */
  public static normalizeSkillName(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  private static parse(
    canonicalContent: string,
    canonicalRelPath: string
  ): { meta: Record<string, unknown>; body: string } {
    const match = canonicalContent.match(FRONTMATTER_REGEX);
    if (!match) {
      throw new Error(`Cannot project ${canonicalRelPath}: no YAML frontmatter found.`);
    }
    let parsed: unknown;
    try {
      parsed = yaml.parse(match[1]);
    } catch (cause) {
      const err = cause instanceof Error ? cause : new Error(String(cause));
      throw new Error(`Cannot project ${canonicalRelPath}: invalid YAML frontmatter (${err.message}).`);
    }
    const meta =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    return { meta, body: match[2].replace(/^\r?\n/, '') };
  }

  private static ledgerEntry(feature: string): TranslationLedgerEntry | undefined {
    const known = FEATURE_LEDGER[feature];
    if (!known) return undefined;
    return { feature, host: HOST, disposition: known.disposition, rationale: known.rationale };
  }

  /** Guard: an unmapped feature must never be dropped without a recorded disposition. */
  private static requireDisposition(feature: string, canonicalRelPath: string): TranslationLedgerEntry {
    const entry = ClaudeProjector.ledgerEntry(feature);
    if (!entry) {
      throw new Error(
        `No translation-ledger disposition recorded for feature "${feature}" in ${canonicalRelPath}. ` +
          'Add it to FEATURE_LEDGER so translation loss is never silent (ADR 0018 decision 9).'
      );
    }
    return entry;
  }

  /**
   * Replace one canonical body section, matched by its heading, with a host-native rendering.
   *
   * Deterministic: the section runs from the matched heading to the next heading of the same or a higher
   * level (an `h3` stops at the next `h1`/`h2`), and trailing blank lines and the `---` separator are left
   * with the following section so the document structure is unchanged. A heading that is absent is a no-op.
   */
  private static replaceSection(body: string, heading: RegExp, replacement: string): string {
    const lines = body.split('\n');
    const start = lines.findIndex(line => heading.test(line));
    if (start < 0) return body;

    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
      if (/^#{1,2}\s/.test(lines[i])) {
        end = i;
        break;
      }
    }
    while (end > start + 1 && (lines[end - 1].trim() === '' || lines[end - 1].trim() === '---')) end -= 1;

    return [...lines.slice(0, start), ...replacement.split('\n'), ...lines.slice(end)].join('\n');
  }

  /**
   * Deterministically rewrite canonical tool names in prompt prose (whole-word, case-sensitive,
   * fenced code blocks byte-preserved) and report a disposition for every rewrite that loses fidelity.
   */
  public static rewriteBody(body: string): { body: string; ledger: TranslationLedgerEntry[] } {
    const ledger = new Map<string, TranslationLedgerEntry>();
    // ADR 0018 decision 8: sections that describe another host's routing are re-rendered first, so the
    // vocabulary pass below only ever rewrites host-neutral prose.
    for (const override of ClaudeProjector.CLAUDE_DIALECT.bodySectionOverrides) {
      body = ClaudeProjector.replaceSection(body, override.heading, override.replacement);
    }
    const vocab = ClaudeProjector.CLAUDE_DIALECT.bodyToolVocabulary;
    const tokens = Object.keys(vocab).sort((a, b) => b.length - a.length);
    const parts = body.split(/(```[\s\S]*?```)/g);

    const rewritten = parts.map((part, index) => {
      if (index % 2 === 1) return part; // fenced code block, preserved byte-for-byte
      let text = part;
      for (const token of tokens) {
        const re = new RegExp(`(^|[^A-Za-z0-9_])${token}(?=[^A-Za-z0-9_]|$)`, 'g');
        if (!text.match(re)) continue;
        const entry = ClaudeProjector.ledgerEntry(token);
        if (entry) ledger.set(token, entry);
        text = text.replace(re, `$1${vocab[token]}`);
      }
      return text;
    });

    return { body: rewritten.join(''), ledger: [...ledger.values()] };
  }

  /** Render `.claude/agents/<role>.md` from a canonical agent definition. */
  public static renderRole(
    canonicalContent: string,
    canonicalRelPath: string,
    opts: { allowlist?: string[]; maxTurns?: number } = {}
  ): ClaudeRenderResult {
    const { meta, body } = ClaudeProjector.parse(canonicalContent, canonicalRelPath);
    const ledger = new Map<string, TranslationLedgerEntry>();

    // 1. Every canonical key either maps inline or carries a recorded disposition.
    for (const key of Object.keys(meta)) {
      if (INLINE_KEYS.has(key)) continue;
      const entry = ClaudeProjector.requireDisposition(key, canonicalRelPath);
      ledger.set(entry.feature, entry);
    }

    const rawName =
      typeof meta.name === 'string' && meta.name.trim().length > 0
        ? meta.name.trim()
        : path.basename(canonicalRelPath).replace(/\.md$/i, '');
    const out: Record<string, unknown> = { name: ClaudeProjector.stripSubagentPrefix(rawName) };

    if (typeof meta.description === 'string' && meta.description.trim().length > 0) {
      out.description = meta.description.trim();
    }

    // 2. Delegation first (ADR 0018 decision 3), then the translated vocabulary.
    const tools: string[] = [];
    tools.push(opts.allowlist && opts.allowlist.length > 0 ? `Agent(${opts.allowlist.join(', ')})` : 'Agent');
    for (const raw of Array.isArray(meta.tools) ? meta.tools : []) {
      if (typeof raw !== 'string') continue;
      const entry = ClaudeProjector.ledgerEntry(raw);
      if (entry) ledger.set(entry.feature, entry);
      const mapped = ClaudeProjector.CLAUDE_DIALECT.toolVocabulary[raw];
      if (!mapped) {
        ClaudeProjector.requireDisposition(raw, canonicalRelPath);
        continue;
      }
      if (!tools.includes(mapped)) tools.push(mapped);
    }

    // ADR 0018 decision 3: when the coordinator has an allowlist, `Agent(<specialists>)` IS the
    // delegation grant. Adding a bare `Agent` next to it is contradictory — the docs treat `Agent`
    // without parentheses as "allow spawning any subagent without restrictions" — so the allowlist
    // would be silently widened. Keep the allowlist as the single source of the bound.
    if (opts.allowlist && opts.allowlist.length > 0) {
      const withoutBareAgent = tools.filter(t => t !== 'Agent');
      tools.length = 0;
      tools.push(...withoutBareAgent);
    }

    // 3. Posture: permissionMode, model tier, effort, and the consultation budget.
    // Coordinator-ness comes from the canonical role, not only from a caller-supplied allowlist: a
    // bundle-less fanout (`domain:*`, addons) has no bundle definition to derive specialists from, and
    // without this a projected orchestrator silently took the specialist posture (sonnet, bare `Agent`,
    // hand-back tool) — the operator saw `orchestrator-engineering.md` on Sonnet while
    // `orchestrator-digital-agency.md` was on Opus. `type: orchestrator` / `mainAgent: true` is the
    // catalog's own discriminator (9 orchestrators, 50 subagents).
    const isCoordinator = !!(opts.allowlist && opts.allowlist.length > 0)
      || meta.type === 'orchestrator'
      || meta.mainAgent === true;
    if (isCoordinator) {
      for (const base of COORDINATOR_BASELINE_TOOLS) {
        if (!tools.includes(base)) tools.push(base);
      }
    } else if (!tools.includes('SubagentHandback')) {
      // `SubagentHandback` is the runtime's own hand-off channel for subagents — it "delivers a
      // subagent's final report to whichever conversation receives that subagent's result" (Claude Code
      // v2.1.271+, auto mode). Granting it makes the documented Tier-1 hand-off explicit instead of
      // implicit; where the runtime does not provide it the entry simply does not resolve, and Claude
      // Code only refuses to launch an agent when NOTHING in its tools list resolves.
      tools.push('SubagentHandback');
    }
    const permission =
      typeof meta.permissionMode === 'string'
        ? ClaudeProjector.CLAUDE_DIALECT.permissionModeMap[meta.permissionMode] ?? 'default'
        : undefined;
    if (permission === 'plan') {
      const restricted = tools.filter(t => t !== 'Write' && t !== 'Edit');
      tools.length = 0;
      tools.push(...restricted);
    }
    out.tools = tools;
    if (permission) out.permissionMode = permission;

    // `inherit` is the catalog's marker for "no opinion" — all 59 agents declare `model: inherit` — so it
    // resolves to the role posture instead of being dropped: coordinators opus, specialists sonnet
    // (ADR 0018 d7 as amended 2026-09-22). An explicitly declared tier or effort always wins, so per-agent
    // authoring survives (eight specialists declare `effort: high` today and keep it).
    const declaredModel = typeof meta.model === 'string' ? meta.model : undefined;
    const mappedModel = declaredModel && declaredModel !== 'inherit'
      ? ClaudeProjector.CLAUDE_DIALECT.modelMap[declaredModel] ?? declaredModel
      : undefined;
    out.model = mappedModel ?? (isCoordinator
      ? ClaudeProjector.CLAUDE_DIALECT.roleModelDefaults.coordinator
      : ClaudeProjector.CLAUDE_DIALECT.roleModelDefaults.specialist);
    const declaredEffort = typeof meta.effort === 'string' ? meta.effort : undefined;
    out.effort = declaredEffort ?? (isCoordinator
      ? ClaudeProjector.CLAUDE_DIALECT.roleEffortDefaults.coordinator
      : ClaudeProjector.CLAUDE_DIALECT.roleEffortDefaults.specialist);
    if (typeof opts.maxTurns === 'number') out.maxTurns = opts.maxTurns;

    // 4. Prose is part of the interface.
    const rewritten = ClaudeProjector.rewriteBody(body);
    for (const entry of rewritten.ledger) ledger.set(entry.feature, entry);

    const yamlStr = yaml.stringify(out).replace(/\r\n/g, '\n').trimEnd();
    const content = `---\n${yamlStr}\n---\n${ClaudeProjector.marker(canonicalRelPath)}\n\n${RUNTIME_NOTE}\n\n${rewritten.body.trim()}\n`;
    return { content, ledger: [...ledger.values()] };
  }

  /** Render `.claude/skills/<name>/SKILL.md` from a canonical skill. */
  public static renderSkill(canonicalContent: string, canonicalRelPath: string): ClaudeRenderResult {
    const { meta, body } = ClaudeProjector.parse(canonicalContent, canonicalRelPath);
    const ledger = new Map<string, TranslationLedgerEntry>();

    const rawName =
      typeof meta.name === 'string' && meta.name.trim().length > 0
        ? meta.name.trim()
        : path.basename(path.dirname(canonicalRelPath));
    const normalized = ClaudeProjector.normalizeSkillName(rawName);
    if (normalized !== rawName) {
      ledger.set(`skill-name:${rawName}`, {
        feature: `skill-name:${rawName}`,
        host: HOST,
        disposition: 'mapped',
        rationale: `Skill name normalized to the dialect rule (${rawName} -> ${normalized}); body references follow the artifact name.`,
      });
    }

    const out: Record<string, unknown> = { name: normalized };
    if (typeof meta.description === 'string' && meta.description.trim().length > 0) {
      out.description = meta.description.trim();
    }
    if (meta['disable-slash-command'] === true || meta.disableSlashCommand === true) {
      out['user-invocable'] = false;
      ledger.set('disable-slash-command', {
        feature: 'disable-slash-command',
        host: HOST,
        disposition: 'mapped',
        rationale:
          'Hidden from the / palette while staying model-invocable (Claude polarity: user-invocable, never disable-model-invocation).',
      });
    }
    const metadata = meta.metadata;
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const allowed = ['author', 'version', 'icon', 'source', 'license'];
      const kept: Record<string, unknown> = {};
      for (const key of allowed) {
        const value = (metadata as Record<string, unknown>)[key];
        if (value !== undefined) kept[key] = value;
      }
      for (const key of Object.keys(metadata as Record<string, unknown>)) {
        if (allowed.includes(key)) continue;
        ledger.set(`metadata:${key}`, {
          feature: `metadata:${key}`,
          host: HOST,
          disposition: 'mapped',
          rationale: 'Non-standard skill metadata; stripped because the projection carries only the Agent Skills contract.',
        });
      }
      if (Object.keys(kept).length > 0) out.metadata = kept;
    }
    if (typeof meta.license === 'string') out.license = meta.license;

    // Any other canonical skill key needs a recorded disposition (never a silent drop).
    const HANDLED_SKILL_KEYS = new Set([
      'name',
      'description',
      'metadata',
      'license',
      'disable-slash-command',
      'disableSlashCommand',
    ]);
    for (const key of Object.keys(meta)) {
      if (HANDLED_SKILL_KEYS.has(key)) continue;
      const entry = ClaudeProjector.requireDisposition(key, canonicalRelPath);
      ledger.set(entry.feature, entry);
    }

    let rewrittenBody = body;
    if (normalized !== rawName) {
      const re = new RegExp(`(^|[^A-Za-z0-9_-])${rawName}(?![A-Za-z0-9_-])`, 'gi');
      rewrittenBody = rewrittenBody.replace(re, `$1${normalized}`);
    }
    const rewritten = ClaudeProjector.rewriteBody(rewrittenBody);
    for (const entry of rewritten.ledger) ledger.set(entry.feature, entry);

    const yamlStr = yaml.stringify(out).replace(/\r\n/g, '\n').trimEnd();
    const content = `---\n${yamlStr}\n---\n${ClaudeProjector.marker(canonicalRelPath)}\n\n${rewritten.body.trim()}\n`;
    return { content, ledger: [...ledger.values()] };
  }

  /**
   * Render `.claude/rules/<rule>.md`. Rules load unconditionally in every Claude session, so this
   * lane is deliberately lean: optional `paths:` scoping plus a hard adherence budget (ADR 0018).
   *
   * The `paths:` block is the ONLY frontmatter field this lane emits, so it is emitted only when a
   * rule is actually scoped. The live doc is explicit — "Rules without a `paths` field are loaded
   * unconditionally and apply to all files" — which makes frontmatter optional; an unscoped rule is
   * therefore rendered marker-first with no frontmatter block at all, matching the Cline lane's shape
   * instead of emitting a stray empty `--- {} ---`.
   */
  public static renderRule(
    canonicalContent: string,
    canonicalRelPath: string,
    opts: { paths?: string[] } = {}
  ): ClaudeRenderResult {
    const lineCount = canonicalContent.split(/\r?\n/).length;
    if (lineCount > ClaudeProjector.CLAUDE_DIALECT.maxRuleLines) {
      throw new Error(
        `Rule ${canonicalRelPath} has ${lineCount} lines, exceeding the ${ClaudeProjector.CLAUDE_DIALECT.maxRuleLines}-line adherence budget (ADR 0018 decision 5).`
      );
    }
    const frontmatter: Record<string, unknown> = {};
    if (opts.paths && opts.paths.length > 0) frontmatter.paths = opts.paths;
    const head = Object.keys(frontmatter).length > 0
      ? `---\n${yaml.stringify(frontmatter).replace(/\r\n/g, '\n').trimEnd()}\n---\n`
      : '';
    const rewritten = ClaudeProjector.rewriteBody(canonicalContent.trim());
    const content = `${head}${ClaudeProjector.marker(canonicalRelPath)}\n\n${rewritten.body}\n`;
    return { content, ledger: rewritten.ledger };
  }

  /**
   * The specialist roster a coordinator may delegate to: the whole **domain** team, not only the slice
   * this bundle declares or what happens to be installed.
   *
   * `software-engineering` declares 4 specialists, but the `engineering` domain has 15 — so an essentials
   * install used to leave the domain lead able to call 4 of its 15 people, with the list growing only when
   * the operator happened to install more *and* re-project. `bundles.json` already groups every bundle under
   * a `domain`, so the roster is the union of that domain's declared agents minus the coordinator itself.
   * The allowlist is then stable (independent of install state) and complete (it never silently hides a
   * teammate). The cost is that a listed type may not be installed yet — the delegation section turns that
   * into an install recommendation rather than a dead end.
   *
   * Sorted for determinism: repeated projections must be byte-identical, because `agents doctor` diffs them.
   */
  private static resolveDomainRoster(
    bundle: BundleDefinition,
    coordinatorFile: string,
    registryDir: string
  ): string[] {
    const names = new Set<string>();
    try {
      const raw = fs.readFileSync(path.join(registryDir, 'bundles.json'), 'utf8');
      const bundles = (JSON.parse(raw).bundles ?? {}) as Record<string, BundleDefinition>;
      for (const candidate of Object.values(bundles)) {
        if (!bundle.domain || candidate.domain !== bundle.domain) continue;
        for (const agentFile of candidate.agents || []) {
          if (agentFile === coordinatorFile) continue;
          names.add(ClaudeProjector.stripSubagentPrefix(agentFile.replace(/\.md$/i, '')));
        }
      }
    } catch {
      // No registry to read: fall back to the bundle's own declared roster (the caller's).
    }
    return [...names].sort();
  }

  /**
   * Plan the full Claude compound projection for one bundle: roles (with a coordinator allowlist of
   * its whole domain team), skills (normalized names plus auxiliary files copied byte-for-byte), and
   * the lean deduplicated rule set. It emits **no** team-manifest duplicate and **no** workflows lane,
   * because Claude workflows are JavaScript orchestration scripts rather than markdown (ADR 0018 d14).
   */
  public static async planCompoundProjection(
    bundle: BundleDefinition,
    scope: InstallScope,
    resolved: ResolvedAssets,
    registryDir: string,
    _excludeAddons?: string[]
  ): Promise<PlannedClaudeArtifact[]> {
    void scope;
    const artifacts: PlannedClaudeArtifact[] = [];
    const coordinatorFile = bundle.orchestrator || `${bundle.name}.md`;
    // A coordinator delegates to its domain team, not just this bundle's declared slice of it.
    const domainRoster = ClaudeProjector.resolveDomainRoster(bundle, coordinatorFile, registryDir);
    const specialistNames = domainRoster.length > 0
      ? domainRoster
      : (bundle.agents || []).map(f => ClaudeProjector.stripSubagentPrefix(f.replace(/\.md$/i, '')));
    const maxTurns = bundle.planningLoop?.budget?.maxIterations;

    // 1. Roles.
    for (const agentFile of resolved.agents || []) {
      const canonicalRel = `agents/${agentFile}`;
      const src = path.join(registryDir, 'agents', agentFile);
      if (!(await fs.pathExists(src))) continue;
      const content = await fs.readFile(src, 'utf8');
      const isCoordinator = coordinatorFile === agentFile;
      const roleName = ClaudeProjector.stripSubagentPrefix(agentFile.replace(/\.md$/i, ''));
      const rendered = ClaudeProjector.renderRole(content, canonicalRel, {
        allowlist: isCoordinator ? specialistNames : undefined,
        maxTurns: isCoordinator ? maxTurns : undefined,
      });
      artifacts.push({
        kind: 'role',
        canonical: canonicalRel,
        relPath: `.claude/agents/${roleName}.md`,
        content: rendered.content,
        managedMarker: true,
      });
    }

    // 2. Skills, plus every auxiliary resource copied byte-for-byte.
    for (const skillName of resolved.skills || []) {
      const skillDir = path.join(registryDir, 'skills', skillName);
      const skillFile = path.join(skillDir, 'SKILL.md');
      if (!(await fs.pathExists(skillFile))) continue;
      const canonicalRel = `skills/${skillName}/SKILL.md`;
      const normalized = ClaudeProjector.normalizeSkillName(skillName);
      artifacts.push({
        kind: 'skill',
        canonical: canonicalRel,
        relPath: `.claude/skills/${normalized}/SKILL.md`,
        content: ClaudeProjector.renderSkill(await fs.readFile(skillFile, 'utf8'), canonicalRel).content,
        managedMarker: true,
      });
      const entries = (await fs.readdir(skillDir, { withFileTypes: true }))
        .filter(entry => entry.name !== 'SKILL.md')
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (!entry.isFile()) continue; // nested resource dirs are out of v1 scope (none exist today)
        artifacts.push({
          kind: 'skill',
          canonical: `skills/${skillName}/${entry.name}`,
          relPath: `.claude/skills/${normalized}/${entry.name}`,
          sourceFilePath: path.join(skillDir, entry.name),
          managedMarker: false,
        });
      }
    }

    // 3. Rules: deduplicated, agent-referenced only, host entrypoints skipped, budget-guarded.
    for (const ruleFile of [...new Set(resolved.rules || [])].sort()) {
      if (ENTRYPOINT_RULES.has(ruleFile)) continue;
      const src = path.join(registryDir, 'rules', ruleFile);
      if (!(await fs.pathExists(src))) continue;
      const canonicalRel = `rules/${ruleFile}`;
      const content = await fs.readFile(src, 'utf8');
      if (content.split(/\r?\n/).length > ClaudeProjector.CLAUDE_DIALECT.maxRuleLines) continue;
      artifacts.push({
        kind: 'rule',
        canonical: canonicalRel,
        relPath: `.claude/rules/${ruleFile}`,
        content: ClaudeProjector.renderRule(content, canonicalRel).content,
        managedMarker: true,
      });
    }

    return artifacts;
  }

  /** Claude plugin package name rule; every bundle in `registry/bundles.json` satisfies it today. */
  private static readonly PLUGIN_NAME_REGEX = /^[a-z0-9][a-z0-9-]*$/;

  /**
   * Render the Claude plugin manifest (`.claude-plugin/plugin.json`).
   *
   * Deterministic: fixed field order, two-space indent, trailing newline, and no data read
   * from the environment (a `package.json` lookup would make the bytes differ between a
   * project and a global install and would trip doctor's recorded-hash drift check).
   */
  private static renderPluginManifest(bundle: BundleDefinition, canonicalRelPath: string): string {
    if (!ClaudeProjector.PLUGIN_NAME_REGEX.test(bundle.name)) {
      throw new Error(
        `Cannot project ${canonicalRelPath}: bundle name "${bundle.name}" is not a valid Claude plugin ` +
        `name (must match ^[a-z0-9][a-z0-9-]*$).`
      );
    }

    // JSON cannot carry the `<!-- managed-by: agents-united ... -->` comment the markdown
    // renderers use, yet BOTH `InstallEngine.applyCompoundLane` (regeneration of our own
    // artifact) and `agents doctor` (drift/marker integrity) classify an artifact by that
    // marker *string* (`HostProjector.hasManagedMarker`). The manifest is declared
    // `managedMarker: true` — a machine-generated file we own and must be able to
    // regenerate and drift-check — so the marker travels inside `description`, the only
    // free-text field of the seven. Without it the second flagged install would refuse
    // with "not managed by agents-united" and doctor would report a false
    // "user-modified projection" on every run.
    const markerText = `${MARKER_PREFIX} | profile: ${MARKER_PROFILE} | do not edit`;
    const description = bundle.description
      ? `${bundle.description} [${markerText}]`
      : markerText;

    const manifest: ClaudePluginManifest = {
      author: '',
      description,
      homepage: '',
      license: '',
      name: bundle.name,
      repository: '',
      version: bundle.version || '1.0.0',
    };

    return JSON.stringify(manifest, null, 2) + '\n';
  }

  /**
   * ADR 0018 decision 12 / Plan 016 decision 13 — the opt-in Claude **plugin lane**.
   *
   * Plans the `claude --plugin-dir` consumable package *inside* the organization package:
   * `.agents/plugins/<bundle>/.claude-plugin/plugin.json` plus an `agents/` subdirectory that
   * mirrors the `.claude/agents/` projection name-for-name and byte-for-byte (same `renderRole`
   * call, same coordinator allowlist, same `maxTurns`).
   *
   * **Distribution-only, never the behavioural source.** Claude has no project-local plugin
   * auto-discovery, plugin agents are namespaced (`plugin:agent`) and a plugin
   * `permissionMode` is ignored — so the `.claude/agents/` projection produced by
   * `planCompoundProjection` stays the single behavioural source. This package exists purely
   * so the same folder can be zipped and consumed elsewhere via `--plugin-dir`.
   *
   * Additive and caller-gated (`InstallOptions.pluginLane`): when the flag is off this method
   * is never called and the install plan is byte-identical to before.
   */
  public static async planPluginLane(
    bundle: BundleDefinition,
    resolved: ResolvedAssets,
    registryDir: string
  ): Promise<PlannedClaudeArtifact[]> {
    const artifacts: PlannedClaudeArtifact[] = [];
    const baseDir = `.agents/plugins/${bundle.name}`;

    // 1. Manifest — the discriminator `claude --plugin-dir` reads.
    artifacts.push({
      kind: 'plugin-manifest',
      relPath: `${baseDir}/.claude-plugin/plugin.json`,
      content: ClaudeProjector.renderPluginManifest(bundle, `${baseDir}/.claude-plugin/plugin.json`),
      managedMarker: true,
      distributionOnly: true,
    });

    // 2. Roles — mirror of the project projection. Same allowlist/maxTurns treatment as
    //    `planCompoundProjection` so the package's `agents/` subdir cannot diverge from
    //    `.claude/agents/` (the byte-identity is asserted in tests/claude-plugin-lane.test.ts).
    const coordinatorFile = bundle.orchestrator || `${bundle.name}.md`;
    const domainRoster = ClaudeProjector.resolveDomainRoster(bundle, coordinatorFile, registryDir);
    const specialistNames = domainRoster.length > 0
      ? domainRoster
      : (bundle.agents || []).map(f => ClaudeProjector.stripSubagentPrefix(f.replace(/\.md$/i, '')));
    const maxTurns = bundle.planningLoop?.budget?.maxIterations;

    for (const agentFile of resolved.agents || []) {
      const canonicalRel = `agents/${agentFile}`;
      const src = path.join(registryDir, 'agents', agentFile);
      if (!(await fs.pathExists(src))) continue;
      const isCoordinator = coordinatorFile === agentFile;
      const roleName = ClaudeProjector.stripSubagentPrefix(agentFile.replace(/\.md$/i, ''));
      const rendered = ClaudeProjector.renderRole(await fs.readFile(src, 'utf8'), canonicalRel, {
        allowlist: isCoordinator ? specialistNames : undefined,
        maxTurns: isCoordinator ? maxTurns : undefined,
      });
      artifacts.push({
        kind: 'role',
        canonical: canonicalRel,
        relPath: `${baseDir}/agents/${roleName}.md`,
        content: rendered.content,
        managedMarker: true,
        distributionOnly: true,
      });
    }

    return artifacts;
  }

}



