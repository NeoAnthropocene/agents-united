import yaml from 'yaml';
import path from 'node:path';
import fs from 'fs-extra';
import type {
  AgentPluginManifest,
  BundleDefinition,
  ClineTeamManifest,
  InstallScope,
  ProjectionKind,
  ResolvedAssets,
} from './types.js';

export interface PlannedClineArtifact {
  kind: ProjectionKind;
  canonical?: string;
  relPath: string; // posix root-relative path
  content?: string;
  sourceFilePath?: string; // for byte-for-byte binary/resource copy
  managedMarker: boolean;
}

export class ClineProjector {
  /**
   * Managed marker inserted after YAML frontmatter in every rendered artifact.
   */
  private static marker(canonicalRelPath: string): string {
    const normCanonical = canonicalRelPath.replace(/\\/g, '/');
    return `<!-- managed-by: agents-united | profile: cline | canonical: ${normCanonical} | do not edit -->`;
  }

  private static runtimeNote = `## Cline runtime note\n\nUse the equivalent capabilities available in this Cline session. Canonical tool names describe\nintent and may differ from Cline's runtime tool names. For delegation, prefer the configured\nsubagent_* agent tools (projected under .cline/agents/), then session subagents; otherwise\ncomplete the role in the main session.`;

  /**
   * Strip the canonical `subagent-` prefix. Cline prefixes configured-agent tool
   * names with `subagent_` itself, so keeping the prefix would produce names like
   * `subagent_subagent_marketing_growth_strategist`.
   */
  static stripSubagentPrefix(name: string): string {
    return name.trim().replace(/^subagent-/, '');
  }

  /**
   * Slugify a workflow display name into a usable slash-command name
   * (e.g. "Digital Agency Full-Funnel Campaign Orchestration" -> "digital-agency-full-funnel-campaign-orchestration").
   */
  static slugifyWorkflowName(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  /**
   * Render a Cline Configured Agent definition (.cline/agents/<role>.yml) from
   * canonical agent markdown content. Cline 3.x consumes YAML files with
   * frontmatter (name, description) and treats the body as the agent system prompt.
   */
  static renderConfiguredAgent(canonicalContent: string, canonicalRelPath: string, defaultMaxIterations?: number): string {
    const match = canonicalContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
      throw new Error(`Canonical agent ${canonicalRelPath} is missing YAML frontmatter.`);
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = (yaml.parse(match[1]) as Record<string, unknown>) || {};
    } catch {
      parsed = {};
    }

    const baseName = canonicalRelPath.replace(/\\/g, '/').split('/').pop() ?? '';
    const rawName = typeof parsed.name === 'string' && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : baseName.replace(/\.md$/i, '');
    const cleanFrontmatter: Record<string, unknown> = {
      name: this.stripSubagentPrefix(rawName),
    };
    if (typeof parsed.description === 'string' && parsed.description.trim().length > 0) {
      cleanFrontmatter.description = parsed.description.trim();
    }
    // ADR 0014 — canonical frontmatter is the single source of truth; the bundle
    // Consultation Budget `maxIterations` is only a default when frontmatter omits it.
    if (typeof parsed.maxIterations === 'number') {
      cleanFrontmatter.maxIterations = parsed.maxIterations;
    } else if (typeof defaultMaxIterations === 'number') {
      cleanFrontmatter.maxIterations = defaultMaxIterations;
    }

    const frontmatterStr = yaml.stringify(cleanFrontmatter).trim();
    const bodyStr = match[2].trim();

    return `---\n${frontmatterStr}\n---\n${this.marker(canonicalRelPath)}\n\n${this.runtimeNote}\n\n${bodyStr}\n`;
  }

  /**
   * Derive the slash-command slug for a workflow from its frontmatter name,
   * falling back to the canonical filename. Kept separate from the renderer so the
   * projection filename and the frontmatter `name` are guaranteed to match.
   */
  static workflowSlug(canonicalContent: string, canonicalRelPath: string): string {
    const match = canonicalContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    let humanName: string | undefined;
    if (match) {
      try {
        const parsed = (yaml.parse(match[1]) as Record<string, unknown>) || {};
        if (typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
          humanName = parsed.name.trim();
        }
      } catch {
        // fall through to filename fallback
      }
    }
    const baseName = canonicalRelPath.replace(/\\/g, '/').split('/').pop() ?? '';
    return this.slugifyWorkflowName(humanName ?? baseName.replace(/\.md$/i, ''));
  }

  /**
   * Render a Cline workflow projection (.cline/workflows/<slug>.md). The frontmatter
   * `name` is slugified so the workflow surfaces as a usable /<slug> command; the
   * human-readable title stays in `description` and the untouched body.
   */
  static renderWorkflowProjection(canonicalContent: string, canonicalRelPath: string): string {
    const slug = this.workflowSlug(canonicalContent, canonicalRelPath);
    const match = canonicalContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    let description: string | undefined;
    if (match) {
      try {
        const parsed = (yaml.parse(match[1]) as Record<string, unknown>) || {};
        if (typeof parsed.description === 'string' && parsed.description.trim().length > 0) {
          description = parsed.description.trim();
        }
      } catch {
        // description stays undefined
      }
    }

    const cleanFrontmatter: Record<string, unknown> = { name: slug };
    if (description) cleanFrontmatter.description = description;

    const frontmatterStr = yaml.stringify(cleanFrontmatter).trim();
    const bodyStr = match ? match[2].trim() : canonicalContent.trim();

    return `---\n${frontmatterStr}\n---\n${this.marker(canonicalRelPath)}\n\n${bodyStr}\n`;
  }

  /**
   * Render a Cline SKILL.md preserving frontmatter and placing managed marker after delimiter.
   */
  static renderSkillMd(canonicalContent: string, canonicalRelPath: string): string {
    const normCanonical = canonicalRelPath.replace(/\\/g, '/');
    const marker = `<!-- managed-by: agents-united | profile: cline | canonical: ${normCanonical} | do not edit -->`;

    const match = canonicalContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
      return `${marker}\n\n${canonicalContent.trim()}`;
    }

    const rawYaml = match[1];
    const rawBody = match[2];

    let parsed: Record<string, unknown> = {};
    try {
      parsed = (yaml.parse(rawYaml) as Record<string, unknown>) || {};
    } catch {
      parsed = {};
    }

    const frontmatterStr = yaml.stringify(parsed).trim();
    const bodyStr = rawBody.trim();

    return `---\n${frontmatterStr}\n---\n${marker}\n\n${bodyStr}\n`;
  }

  /**
   * Render Team Manifest YAML matching ClineTeamManifest schema.
   * @param excludeAddons optional addon names to omit from `recommendedAddons`
   *   (used to stop advertising bundles already present in the workspace).
   */
  static renderTeamManifest(bundle: BundleDefinition, scope: InstallScope, excludeAddons: string[] = []): string {
    const coordinatorFile = bundle.orchestrator || `${bundle.name}.md`;
    const coordinatorName = coordinatorFile.replace(/\.md$/, '');
    const coordinatorCanonical = `agents/${coordinatorFile}`;

    const roles = (bundle.agents || []).map((agentFile) => ({
      name: agentFile.replace(/\.md$/, ''),
      canonicalPath: `agents/${agentFile}`,
    }));

    const sortedSkills = [...(bundle.skills || [])].sort();
    const sortedWorkflows = [...(bundle.workflows || [])].sort();
    const recommendedAddons = (bundle.recommendedAddons || []).filter(a => !excludeAddons.includes(a));

    const manifest: ClineTeamManifest = {
      schemaVersion: 1,
      bundle: bundle.name,
      scope,
      coordinator: {
        name: coordinatorName,
        canonicalPath: coordinatorCanonical,
      },
      roles,
      skills: sortedSkills,
      workflows: sortedWorkflows,
      recommendedAddons,
      activation: {
        preferred: 'named-team',
        fallbacks: ['adaptive-session', 'single-orchestrator'],
      },
    };

    // ADR 0014 — planning-loop bundles declare the loop config and persona map.
    if (bundle.planningLoop?.enabled) {
      manifest.planningLoop = bundle.planningLoop;
      if (bundle.personaAliases && Object.keys(bundle.personaAliases).length > 0) {
        manifest.personas = Object.entries(bundle.personaAliases).map(([persona, role]) => ({ persona, role }));
      }
    }

    return yaml.stringify(manifest);
  }

  /**
   * Render the coordinator rule file (.agents/plugins/<bundle>/rules/agents-united-<bundle>.md).
   * @param excludeAddons optional addon names to omit from the "Recommended Addon
   *   Policy" list (used to stop advertising bundles already installed).
   */
  static renderCoordinatorRule(bundle: BundleDefinition, scope: InstallScope, excludeAddons: string[] = []): string {
    const marker = `<!-- managed-by: agents-united | profile: cline | bundle: ${bundle.name} | do not edit -->`;
    const manifestRelPath = scope === 'global'
      ? `~/.agents/plugins/${bundle.name}/agents-united/teams/${bundle.name}.yaml`
      : `.agents/plugins/${bundle.name}/agents-united/teams/${bundle.name}.yaml`;

    const coordinatorFile = bundle.orchestrator || `${bundle.name}.md`;
    const coordinatorName = coordinatorFile.replace(/\.md$/, '');
    const coordinatorCanonical = `agents/${coordinatorFile}`;

    const specialistLines = (bundle.agents || []).map((agentFile) => {
      const name = agentFile.replace(/\.md$/, '');
      return `- **${name}**: \`.agents/agents/${agentFile}\``;
    });

    const addons = (bundle.recommendedAddons || []).filter(a => !excludeAddons.includes(a));
    const addonSection = addons.length > 0
      ? `\n### Recommended Addon Policy\nWhen user tasks require capabilities from: ${addons.join(', ')}, explain the capability and request user confirmation to install via \`agents add <addon> -t cline -y\` before running the installation.`
      : '';

    // ADR 0014 — planning-loop bundles replace the soft delegation hint with a
    // mandatory Subagent-First policy and the bounded Planning Dialogue Loop.
    // Bundles without the flag render byte-identical output to the legacy rule.
    const planning = bundle.planningLoop?.enabled === true ? bundle.planningLoop : undefined;
    const budget = planning?.budget;
    const delegationStep = planning
      ? '2. **Subagent-First Delegation Policy (ADR 0014)**: execute specialist work through the configured `subagent_*` agent tools (projected under `.cline/agents/`), assigning non-overlapping scopes. Complete specialist work in the main session ONLY if the subagent tools are genuinely absent from this runtime or the task is trivial (single-file read, one-line answer, formatting) — never as a convenience or speed choice.'
      : '2. Delegate specialist tasks using the configured `subagent_*` agent tools (projected under `.cline/agents/`) when available, assigning non-overlapping scopes; fall back to Agent Teams (`team_spawn_teammate`) or session subagents as needed.';

    const planningSection = planning
      ? `

## Subagent-First Planning Dialogue Loop (ADR 0014)
Run this loop BEFORE any substantive execution on a non-trivial task. Delegation-first is mandatory, not advisory.

### Phase 0 — User Alignment
If the user's brief is ambiguous, grill it Socratically with the user first: \`/grill-me\` (strategy / non-code) or \`/grill-with-docs\` (code & docs; writes ADRs and updates CONTEXT.md).

### Phase 0.5 — Sidekick Clarification
Spawn at most ${planning.sidekicks?.max ?? 2} relevant specialists (spawnable \`subagent_*\` tools) INTO this planning conversation to resolve remaining ambiguity. Sidekicks advise you; you relay their questions to the user.

### Phase 1 — Specialist Council
Have every relevant specialist return a Scope-of-Work Statement (max ${budget?.summaryWordCap ?? 150} words): (1) my scope, (2) inputs I need from peers, (3) my deliverable per my own workflows, (4) at most 2 open questions.

### Phase 2 — Delegation Map
Synthesize the council output into a task → specialist map and present it to the user BEFORE execution. Then delegate per the map.

### Consultation Budget (hard caps)
- Planning rounds (orchestrator ↔ council): max ${budget?.maxPlanningRounds ?? 2}
- Peer exchanges per specialist pair: max ${budget?.maxPeerExchangesPerPair ?? 2} directed questions
- Scope-of-Work statement length: max ${budget?.summaryWordCap ?? 150} words
- Specialist per-invocation iteration cap: maxIterations: ${budget?.maxIterations ?? 8} (rendered into .cline/agents/*.yml)`
      : '';

    const personaSection = planning && bundle.personaAliases && Object.keys(bundle.personaAliases).length > 0
      ? `

### Persona → Spawnable Tool Map
| Persona | Role / Spawnable tool |
|---|---|
${Object.entries(bundle.personaAliases).map(([persona, role]) => {
  const target = role.startsWith('subagent-')
    ? `${role} → \`subagent_${this.stripSubagentPrefix(role).replace(/-/g, '_')}\``
    : `${role} (you, the coordinator)`;
  return `| ${persona} | ${target} |`;
}).join('\n')}`
      : '';

    return `# Agents United — ${bundle.name} Coordinator Rule
${marker}

> Installed bundle: **${bundle.name}** (${scope} scope)
> Team Manifest: \`${manifestRelPath}\`
> Coordinator role: \`${coordinatorName}\` (\`.agents/${coordinatorCanonical}\`)

## Activation Protocol
1. At session start, read the Team Manifest (\`${manifestRelPath}\`) and coordinator role prompt (\`.agents/${coordinatorCanonical}\`).
${delegationStep}
3. For lightweight read-only research, use session subagents.
4. Only specialist roles declared in the Team Manifest are active in this workspace.
${planningSection}${personaSection}
${specialistLines.length > 0 ? `\n### Installed Specialist Roles\n${specialistLines.join('\n')}` : ''}
${addonSection}
`;
  }

  /**
   * Plan all compound artifacts for a bundle installation into Cline.
   * @param excludeAddons optional addon names forwarded to the coordinator rule and
   *   team manifest renderers so already-installed bundles are not advertised.
   */
  static async planCompoundProjection(
    bundle: BundleDefinition,
    scope: InstallScope,
    resolved: ResolvedAssets,
    registryDir: string,
    excludeAddons: string[] = []
  ): Promise<PlannedClineArtifact[]> {
    const artifacts: PlannedClineArtifact[] = [];
    const baseDir = `.agents/plugins/${bundle.name}`;

    // 0. Agent Plugin manifest (.agents/plugins/<bundle-name>/plugin.json)
    //    agent-plugins.org v1.0.0. Its presence hard-stops Cline's code-plugin
    //    scanner for this directory (isAgentPluginDirectory) and makes the package
    //    portable to other Agent Plugins-conforming clients.
    const agentPluginManifest: AgentPluginManifest = {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: bundle.name,
      version: bundle.version || '1.0.0',
      description: bundle.description || '',
    };
    artifacts.push({
      kind: 'plugin-manifest',
      relPath: `${baseDir}/plugin.json`.replace(/\\/g, '/'),
      content: JSON.stringify(agentPluginManifest, null, 2),
      managedMarker: false,
    });

    // 1. Configured agent roles (.cline/agents/<role>.yml) - Cline 3.x natively
    //    discovers these and exposes each as a spawnable subagent_<name> tool.
    for (const agentFile of resolved.agents) {
      const canonicalRel = `agents/${agentFile}`;
      const srcPath = path.join(registryDir, 'agents', agentFile);
      if (await fs.pathExists(srcPath)) {
        const content = await fs.readFile(srcPath, 'utf8');
        const rendered = this.renderConfiguredAgent(
          content,
          canonicalRel,
          bundle.planningLoop?.enabled === true ? bundle.planningLoop.budget?.maxIterations : undefined
        );
        const roleName = this.stripSubagentPrefix(agentFile.replace(/\.md$/i, ''));
        artifacts.push({
          kind: 'role',
          canonical: canonicalRel,
          relPath: `.cline/agents/${roleName}.yml`.replace(/\\/g, '/'),
          content: rendered,
          managedMarker: true,
        });
      }
    }

    // 2. Skills (.agents/plugins/<bundle-name>/skills/<skill>/**) - kept inside the
    //    Agent Plugin package for cross-client portability (ADR 0013, decision 1).
    //    Cline discovers the canonical .agents/skills/ copies natively, so no
    //    additional Cline-side skill projection is emitted.
    for (const skillName of resolved.skills) {
      const skillSrcDir = path.join(registryDir, 'skills', skillName);
      if (await fs.pathExists(skillSrcDir)) {
        const entries = await fs.readdir(skillSrcDir, { recursive: true, withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const entryRel = path.relative(skillSrcDir, path.join(entry.parentPath || skillSrcDir, entry.name)).replace(/\\/g, '/');
            const canonicalRel = `skills/${skillName}/${entryRel}`;
            const targetRel = `${baseDir}/skills/${skillName}/${entryRel}`.replace(/\\/g, '/');
            const fullSrcPath = path.join(skillSrcDir, entryRel);

            if (entry.name === 'SKILL.md') {
              const content = await fs.readFile(fullSrcPath, 'utf8');
              const rendered = this.renderSkillMd(content, canonicalRel);
              artifacts.push({
                kind: 'skill',
                canonical: canonicalRel,
                relPath: targetRel,
                content: rendered,
                managedMarker: true,
              });
            } else {
              // Auxiliary resource: byte-for-byte copy
              artifacts.push({
                kind: 'skill',
                canonical: canonicalRel,
                relPath: targetRel,
                sourceFilePath: fullSrcPath,
                managedMarker: false,
              });
            }
          }
        }
      }
    }

    // 3. Workflows (.cline/workflows/<slug>.md) - natively surfaced as /<slug>
    //    slash commands by Cline 3.x (no .agents lane exists for workflows).
    for (const workflowFile of resolved.workflows) {
      const canonicalRel = `workflows/${workflowFile}`;
      const srcPath = path.join(registryDir, 'workflows', workflowFile);
      if (await fs.pathExists(srcPath)) {
        const content = await fs.readFile(srcPath, 'utf8');
        const slug = this.workflowSlug(content, canonicalRel);
        const rendered = this.renderWorkflowProjection(content, canonicalRel);
        artifacts.push({
          kind: 'workflow',
          canonical: canonicalRel,
          relPath: `.cline/workflows/${slug}.md`.replace(/\\/g, '/'),
          content: rendered,
          managedMarker: true,
        });
      }
    }

    // 4. Coordinator Rule (.cline/rules/agents-united-<bundle>.md) - natively
    //    loaded as an always-active rule by Cline 3.x.
    const ruleContent = this.renderCoordinatorRule(bundle, scope, excludeAddons);
    artifacts.push({
      kind: 'rule',
      relPath: `.cline/rules/agents-united-${bundle.name}.md`.replace(/\\/g, '/'),
      content: ruleContent,
      managedMarker: true,
    });

    // 5. Team Manifest (.agents/plugins/<bundle-name>/agents-united/teams/<bundle>.yaml)
    const manifestContent = this.renderTeamManifest(bundle, scope, excludeAddons);
    artifacts.push({
      kind: 'team-manifest',
      relPath: `${baseDir}/agents-united/teams/${bundle.name}.yaml`.replace(/\\/g, '/'),
      content: manifestContent,
      managedMarker: false,
    });

    return artifacts;
  }
}
