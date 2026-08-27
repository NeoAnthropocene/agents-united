import yaml from 'yaml';
import path from 'node:path';
import fs from 'fs-extra';
import type {
  BundleDefinition,
  ClinePluginManifest,
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
   * Render a Cline role definition from canonical agent markdown content.
   */
  static renderRole(canonicalContent: string, canonicalRelPath: string): string {
    const normCanonical = canonicalRelPath.replace(/\\/g, '/');
    const marker = `<!-- managed-by: agents-united | profile: cline | canonical: ${normCanonical} | do not edit -->`;
    const preamble = `## Cline runtime note\n\nUse the equivalent capabilities available in this Cline session. Canonical tool names describe\nintent and may differ from Cline's runtime tool names. For delegation, prefer Agent Teams when\navailable, then session subagents; otherwise complete the role in the main session.`;

    const match = canonicalContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
      return `${marker}\n\n${preamble}\n\n${canonicalContent.trim()}`;
    }

    const rawYaml = match[1];
    const rawBody = match[2];

    let parsed: Record<string, unknown> = {};
    try {
      parsed = (yaml.parse(rawYaml) as Record<string, unknown>) || {};
    } catch {
      parsed = {};
    }

    // Keep only name and description (and optional providerId, modelId, cwd, maxIterations if present)
    const cleanFrontmatter: Record<string, unknown> = {};
    if (parsed.name) cleanFrontmatter.name = parsed.name;
    if (parsed.description) cleanFrontmatter.description = parsed.description;
    if (parsed.providerId) cleanFrontmatter.providerId = parsed.providerId;
    if (parsed.modelId) cleanFrontmatter.modelId = parsed.modelId;
    if (parsed.cwd) cleanFrontmatter.cwd = parsed.cwd;
    if (parsed.maxIterations) cleanFrontmatter.maxIterations = parsed.maxIterations;

    const frontmatterStr = yaml.stringify(cleanFrontmatter).trim();
    const bodyStr = rawBody.trim();

    return `---\n${frontmatterStr}\n---\n${marker}\n\n${preamble}\n\n${bodyStr}\n`;
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

    return `# Agents United — ${bundle.name} Coordinator Rule
${marker}

> Installed bundle: **${bundle.name}** (${scope} scope)
> Team Manifest: \`${manifestRelPath}\`
> Coordinator role: \`${coordinatorName}\` (\`.agents/${coordinatorCanonical}\`)

## Activation Protocol
1. At session start, read the Team Manifest (\`${manifestRelPath}\`) and coordinator role prompt (\`.agents/${coordinatorCanonical}\`).
2. Delegate specialist tasks using **Agent Teams** (\`team_spawn_teammate\`, \`team_delegate_task\`) when available, assigning non-overlapping scopes.
3. For lightweight read-only research, use session subagents.
4. Only specialist roles declared in the Team Manifest are active in this workspace.
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

    // 0. Plugin manifest (.agents/plugins/<bundle-name>/package.json)
    const pluginManifest: ClinePluginManifest = {
      name: `agents-united-${bundle.name}`,
      version: '1.0.0',
      description: bundle.description || '',
      cline: {
        plugins: [
          {
            capabilities: ['skills', 'tools', 'workflows'],
            skills: ['./skills'],
          },
        ],
      },
    };
    artifacts.push({
      kind: 'plugin-manifest',
      relPath: `${baseDir}/package.json`.replace(/\\/g, '/'),
      content: JSON.stringify(pluginManifest, null, 2),
      managedMarker: false,
    });

    // 1. Role definitions (.agents/plugins/<bundle-name>/agents/*.md)
    for (const agentFile of resolved.agents) {
      const canonicalRel = `agents/${agentFile}`;
      const srcPath = path.join(registryDir, 'agents', agentFile);
      if (await fs.pathExists(srcPath)) {
        const content = await fs.readFile(srcPath, 'utf8');
        const rendered = this.renderRole(content, canonicalRel);
        artifacts.push({
          kind: 'role',
          canonical: canonicalRel,
          relPath: `${baseDir}/agents/${agentFile}`.replace(/\\/g, '/'),
          content: rendered,
          managedMarker: true,
        });
      }
    }

    // 2. Skills (.agents/plugins/<bundle-name>/skills/<skill>/**)
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

    // 3. Coordinator Rule (.agents/plugins/<bundle-name>/rules/agents-united-<bundle>.md)
    const ruleContent = this.renderCoordinatorRule(bundle, scope, excludeAddons);
    artifacts.push({
      kind: 'rule',
      relPath: `${baseDir}/rules/agents-united-${bundle.name}.md`.replace(/\\/g, '/'),
      content: ruleContent,
      managedMarker: true,
    });

    // 4. Team Manifest (.agents/plugins/<bundle-name>/agents-united/teams/<bundle>.yaml)
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
