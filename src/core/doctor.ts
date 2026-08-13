import path from 'node:path';
import fs from 'fs-extra';
import parseYaml from 'yaml';
import { TargetAdapter } from './adapter.js';
import type { LockfileManifest } from './types.js';

export interface HealthReport {
  valid: boolean;
  issues: string[];
  warnings: string[];
  agentsCount: number;
  skillsCount: number;
  workflowsCount: number;
}

export class DoctorEngine {
  public static async runDoctor(targetDir?: string): Promise<HealthReport> {
    const root = TargetAdapter.resolveTargetDir('workspace', targetDir);
    const subPaths = TargetAdapter.getSubPaths(root);

    const issues: string[] = [];
    const warnings: string[] = [];

    let agentsCount = 0;
    let skillsCount = 0;
    let workflowsCount = 0;

    // Check Lockfile
    if (!await fs.pathExists(subPaths.lockfile)) {
      warnings.push(`No lockfile found at ${subPaths.lockfile}. Workspace might not be initialized.`);
    } else {
      try {
        const manifest: LockfileManifest = await fs.readJson(subPaths.lockfile);
        agentsCount = manifest.installed.agents.length;
        skillsCount = manifest.installed.skills.length;
        workflowsCount = manifest.installed.workflows.length;
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
              const meta = parseYaml.parse(frontmatterMatch[1]);
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

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      agentsCount,
      skillsCount,
      workflowsCount,
    };
  }
}
