import path from 'node:path';
import fs from 'fs-extra';
import { fileURLToPath } from 'node:url';
import type { BundlesManifest, BundleDefinition, ResolvedAssets } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RegistryResolver {
  private registryDir: string;
  private bundlesManifest: BundlesManifest | null = null;

  constructor(customRegistryDir?: string) {
    if (customRegistryDir) {
      this.registryDir = path.resolve(customRegistryDir);
    } else {
      // Check candidate paths for registry folder
      const candidatePaths = [
        path.resolve(__dirname, '../registry'),
        path.resolve(__dirname, '../../registry'),
        path.resolve(process.cwd(), 'registry'),
      ];

      const found = candidatePaths.find(p => fs.existsSync(path.join(p, 'bundles.json')));
      this.registryDir = found || candidatePaths[0];
    }
  }

  public getRegistryDir(): string {
    return this.registryDir;
  }

  public async loadBundles(): Promise<BundlesManifest> {
    if (this.bundlesManifest) {
      return this.bundlesManifest;
    }

    const manifestPath = path.join(this.registryDir, 'bundles.json');
    if (!await fs.pathExists(manifestPath)) {
      throw new Error(`Registry bundles.json not found at ${manifestPath}`);
    }

    this.bundlesManifest = await fs.readJson(manifestPath);
    return this.bundlesManifest!;
  }

  public async getBundle(bundleName: string): Promise<BundleDefinition | null> {
    const manifest = await this.loadBundles();
    if (manifest.bundles[bundleName]) {
      return manifest.bundles[bundleName];
    }
    const found = Object.values(manifest.bundles).find(
      b => b.aliases?.includes(bundleName)
    );
    return found || null;
  }

  public async listBundles(): Promise<BundleDefinition[]> {
    const manifest = await this.loadBundles();
    return Object.values(manifest.bundles);
  }

  public async resolve(identifier: string): Promise<ResolvedAssets> {
    const bundle = await this.getBundle(identifier);

    if (bundle) {
      const agents = new Set<string>();
      const skills = new Set<string>(bundle.skills || []);
      const workflows = new Set<string>(bundle.workflows || []);
      const rules = ['GEMINI.md'];

      if (bundle.parentBundle) {
        const parent = await this.getBundle(bundle.parentBundle);
        if (parent) {
          if (parent.orchestrator) agents.add(parent.orchestrator);
          if (parent.agents) parent.agents.forEach(a => agents.add(a));
          if (parent.skills) parent.skills.forEach(s => skills.add(s));
          if (parent.workflows) parent.workflows.forEach(w => workflows.add(w));
        }
      }

      if (bundle.orchestrator) agents.add(bundle.orchestrator);
      if (bundle.agents) bundle.agents.forEach(a => agents.add(a));

      return {
        targetBundle: bundle.name,
        agents: Array.from(agents),
        skills: Array.from(skills),
        workflows: Array.from(workflows),
        rules,
      };
    }

    // Check if identifier refers to a specific single item (agent, skill, or workflow)
    const agentPath = path.join(this.registryDir, 'agents', identifier.endsWith('.md') ? identifier : `${identifier}.md`);
    if (await fs.pathExists(agentPath)) {
      return {
        agents: [path.basename(agentPath)],
        skills: [],
        workflows: [],
        rules: [],
      };
    }

    const skillPath = path.join(this.registryDir, 'skills', identifier);
    if (await fs.pathExists(skillPath)) {
      return {
        agents: [],
        skills: [identifier],
        workflows: [],
        rules: [],
      };
    }

    const workflowFileName = identifier.startsWith('workflow-') ? `${identifier}.md` : `workflow-${identifier}.md`;
    const workflowPath = path.join(this.registryDir, 'workflows', workflowFileName);
    if (await fs.pathExists(workflowPath)) {
      return {
        agents: [],
        skills: [],
        workflows: [path.basename(workflowPath)],
        rules: [],
      };
    }

    throw new Error(`Item or bundle "${identifier}" not found in registry.`);
  }

  public async find(query: string = '', options?: SearchOptions): Promise<SearchResults> {
    const manifest = await this.loadBundles();
    const q = query.trim().toLowerCase();

    let matchedBundles: BundleDefinition[] = [];
    if (!options?.type || options.type === 'bundle') {
      matchedBundles = Object.values(manifest.bundles).filter(b => {
        if (options?.domain && b.domain?.toLowerCase() !== options.domain.toLowerCase()) {
          return false;
        }
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q) ||
          b.domain?.toLowerCase().includes(q) ||
          b.aliases?.some(a => a.toLowerCase().includes(q))
        );
      });
    }

    const agentsDir = path.join(this.registryDir, 'agents');
    let matchedAgents: string[] = [];
    if (!options?.type || options.type === 'agent') {
      if (await fs.pathExists(agentsDir)) {
        const files = await fs.readdir(agentsDir);
        matchedAgents = files.filter(f => {
          if (!q) return true;
          return f.toLowerCase().includes(q);
        });
      }
    }

    const skillsDir = path.join(this.registryDir, 'skills');
    let matchedSkills: string[] = [];
    if (!options?.type || options.type === 'skill') {
      if (await fs.pathExists(skillsDir)) {
        const dirs = await fs.readdir(skillsDir);
        matchedSkills = dirs.filter(d => {
          if (!q) return true;
          return d.toLowerCase().includes(q);
        });
      }
    }

    const workflowsDir = path.join(this.registryDir, 'workflows');
    let matchedWorkflows: string[] = [];
    if (!options?.type || options.type === 'workflow') {
      if (await fs.pathExists(workflowsDir)) {
        const files = await fs.readdir(workflowsDir);
        matchedWorkflows = files.filter(f => f.endsWith('.md')).filter(f => {
          if (!q) return true;
          return f.toLowerCase().includes(q);
        });
      }
    }

    return {
      bundles: matchedBundles,
      agents: matchedAgents,
      skills: matchedSkills,
      workflows: matchedWorkflows,
    };
  }
}
