import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';
import { AgentHostAdapter } from './adapter.js';
import { HostProjector } from './projector.js';
import { ClineCapabilityProbe } from './cline-capabilities.js';
import type { ClineCapabilityReport, LockfileManifest } from './types.js';

export interface HealthReport {
  valid: boolean;
  issues: string[];
  warnings: string[];
  agentsCount: number;
  skillsCount: number;
  workflowsCount: number;
  clineCapability?: ClineCapabilityReport;
}

export class DoctorEngine {
  private static async isManagedProjection(absPath: string, isAgentsMd: boolean): Promise<boolean> {
    const content = await fs.readFile(absPath, 'utf8');
    if (isAgentsMd) {
      return content.includes('managed-by: agents-united');
    }
    return HostProjector.hasManagedMarker(content);
  }

  public static async runDoctor(targetDir?: string, host?: string): Promise<HealthReport> {
    const root = AgentHostAdapter.resolveHostDir('project', 'agents', targetDir);
    const subPaths = AgentHostAdapter.getSubPaths(root);

    const issues: string[] = [];
    const warnings: string[] = [];

    let agentsCount = 0;
    let skillsCount = 0;
    let workflowsCount = 0;
    let manifest: LockfileManifest | undefined;
    let clineCapability: ClineCapabilityReport | undefined;

    // Check Lockfile
    if (!await fs.pathExists(subPaths.lockfile)) {
      warnings.push(`No lockfile found at ${subPaths.lockfile}. Workspace might not be initialized.`);
    } else {
      try {
        const parsed: LockfileManifest = await fs.readJson(subPaths.lockfile);
        manifest = parsed;
        agentsCount = parsed.installed.agents.length;
        skillsCount = parsed.installed.skills.length;
        workflowsCount = parsed.installed.workflows.length;
      } catch (err: any) {
        issues.push(`Corrupt lockfile at ${subPaths.lockfile}: ${err.message}`);
      }
    }

    // Validate Agents YAML Frontmatter
    if (await fs.pathExists(subPaths.agentsDir)) {
      const agentFiles = await fs.readdir(subPaths.agentsDir);
      for (const file of agentFiles) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(subPaths.agentsDir, file), 'utf8');
          const frontmatterMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
          if (!frontmatterMatch) {
            warnings.push(`Agent ${file} is missing YAML frontmatter.`);
          } else {
            try {
              const meta = YAML.parse(frontmatterMatch[1]);
              if (!meta.name) issues.push(`Agent ${file} missing 'name' in frontmatter.`);
              if (!meta.description) warnings.push(`Agent ${file} missing 'description'.`);
              if (!meta.model) warnings.push(`Agent ${file} missing 'model' definition.`);
            } catch (err: any) {
              issues.push(`Invalid YAML in agent ${file}: ${err.message}`);
            }
          }
        }
      }
    }

    // Projection checks: verify each recorded `projectedTo` and `projections` path
    if (manifest) {
      const workspaceRoot = path.resolve(path.dirname(root));

      // 1. Check legacy/compatible projectedTo
      for (const [relPath, assetMeta] of Object.entries(manifest.files)) {
        const projectedTo = assetMeta.projectedTo;
        if (!projectedTo || projectedTo.length === 0) continue;
        for (const projPath of projectedTo) {
          const absProjection = path.join(workspaceRoot, projPath);
          if (!await fs.pathExists(absProjection)) {
            warnings.push(
              `Missing projection ${projPath} for canonical ${relPath}. Re-run: agents add ... --fanout`
            );
            continue;
          }
          const managed = await this.isManagedProjection(absProjection, projPath === 'AGENTS.md');
          if (!managed) {
            warnings.push(`user-modified projection ${projPath}`);
          }
        }
      }

      // 2. Check compound projections
      if (manifest.projections) {
        for (const [projRelPath, proj] of Object.entries(manifest.projections)) {
          const absPath = path.join(workspaceRoot, projRelPath);
          if (!await fs.pathExists(absPath)) {
            warnings.push(`Missing compound projection ${projRelPath} (owners: ${proj.owners.join(', ')}).`);
            continue;
          }
          if (proj.managedMarker) {
            const managed = await this.isManagedProjection(absPath, projRelPath === 'AGENTS.md');
            if (!managed) {
              warnings.push(`user-modified projection ${projRelPath}`);
            }
          }
        }
      }
    }

    // Host-specific checks (e.g. --host cline)
    if (host === 'cline') {
      const probe = new ClineCapabilityProbe();
      clineCapability = await probe.probe();
      if (!clineCapability.installed) {
        warnings.push('Cline executable was not detected on PATH or via CLINE_BIN_PATH.');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      agentsCount,
      skillsCount,
      workflowsCount,
      clineCapability,
    };
  }
}
