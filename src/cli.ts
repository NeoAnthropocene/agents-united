import { cac } from 'cac';
import pc from 'picocolors';
import { intro, outro, spinner, note, select, multiselect } from '@clack/prompts';
import fs from 'fs-extra';
import path from 'node:path';
import { RegistryResolver } from './core/registry.js';
import { InstallEngine } from './core/installer.js';
import { UninstallEngine } from './core/uninstaller.js';
import { DoctorEngine } from './core/doctor.js';
import type { InstallScope, InstallMethod, AgentHost } from './core/types.js';

const cli = cac('agents-united');
const registry = new RegistryResolver();
const installer = new InstallEngine(registry);
const uninstaller = new UninstallEngine(registry);

export function detectWorkspaceHosts(cwd: string = process.cwd()): AgentHost[] {
  const detected: AgentHost[] = [];
  if (fs.pathExistsSync(path.join(cwd, '.gemini'))) detected.push('gemini');
  if (fs.pathExistsSync(path.join(cwd, '.claude'))) detected.push('claude');
  if (fs.pathExistsSync(path.join(cwd, '.cursor'))) detected.push('cursor');
  if (fs.pathExistsSync(path.join(cwd, '.agents'))) detected.push('agents');
  return detected;
}

const BUNDLE_DISPLAY_NAMES: Record<string, { title: string; summary: string }> = {
  'software-engineering': {
    title: 'Software Engineering Team',
    summary: 'Autonomous dev lead, backend/frontend architects, TDD & git guardrails',
  },
  'system-architecture': {
    title: 'System Architecture Team',
    summary: 'High-level distributed systems, API schemas, and ADR planning',
  },
  'product-design': {
    title: 'Product Design Team',
    summary: 'UI/UX designers, design systems architect, and prototyping',
  },
  'growth-marketing': {
    title: 'Growth & Marketing Team',
    summary: 'Growth strategists, content pipeline, and conversion optimization',
  },
  'security-operations': {
    title: 'Security Operations Team',
    summary: 'AppSec engineer, threat modeling, and vulnerability audits',
  },
  'deep-research': {
    title: 'Deep Research Team',
    summary: 'Technical research lead, literature review, and Socratic mentor',
  },
  'business-strategy': {
    title: 'Business Strategy Team',
    summary: 'Market analysts, monetization experts, and executive spec panels',
  },
  'full': {
    title: 'All-in-One Autonomous Department',
    summary: 'Complete suite with all 7 team leads, 28 agents, and 56 skills',
  },
};

cli
  .command('add [identifier]', 'Add a bundle, agent, skill, or workflow to project or global configuration')
  .option('-g, --global', 'Install globally into home directory (~/.agents/)')
  .option('-s, --symlink', 'Create symbolic links to central registry cache (default / recommended)')
  .option('--copy', 'Create independent standalone copies of asset files')
  .option('-t, --target <hosts>', 'Target agent host runtimes (agents, gemini, claude, cursor)', { default: 'agents' })
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-f, --force', 'Force overwrite user modified files')
  .option('--dry-run', 'Simulate installation without writing files')
  .action(async (targetIdentifier?: string, options: any = {}) => {
    intro(pc.cyan('Agents United — AI Agent Ecosystem'));

    let identifier = targetIdentifier;
    let scope: InstallScope = options.global ? 'global' : 'project';
    let method: InstallMethod = options.copy ? 'copy' : 'symlink';
    let hosts: AgentHost[] = options.target ? (Array.isArray(options.target) ? options.target : options.target.split(',')) : ['agents'];

    // Interactive Wizard when running interactively without flags
    const isInteractive = process.stdout.isTTY && !options.yes;

    if (isInteractive && !options.global && !options.copy && !options.symlink && options.target === 'agents') {
      const detectedHosts = detectWorkspaceHosts();
      if (detectedHosts.length > 0) {
        note(
          detectedHosts.map(h => `  ✔ Detected ./${h === 'gemini' ? '.gemini/' : h === 'claude' ? '.claude/' : h === 'cursor' ? '.cursor/' : '.agents/'}`).join('\n'),
          'Workspace Environment Discovery'
        );
      }

      // Step 1: AI Assistant Host Selection
      const hostSelection = await multiselect({
        message: '1. Which AI Assistant / IDE do you want to equip?',
        options: [
          {
            value: 'agents',
            label: 'Universal Multi-Agent (.agents/)',
            hint: detectedHosts.includes('agents') ? 'detected in workspace' : 'recommended standard',
          },
          {
            value: 'gemini',
            label: 'Antigravity 2.0 / Gemini (.gemini/)',
            hint: detectedHosts.includes('gemini') ? 'detected in workspace' : 'Google Antigravity',
          },
          {
            value: 'claude',
            label: 'Claude Code (.claude/)',
            hint: detectedHosts.includes('claude') ? 'detected in workspace' : 'Anthropic Claude Code',
          },
          {
            value: 'cursor',
            label: 'Cursor / Codex (.cursor/)',
            hint: detectedHosts.includes('cursor') ? 'detected in workspace' : 'Cursor IDE / Codex',
          },
        ],
        initialValues: detectedHosts.length > 0 ? detectedHosts : ['agents'],
        required: true,
      });

      if (Array.isArray(hostSelection) && hostSelection.length > 0) {
        hosts = hostSelection as AgentHost[];
      }

      // Step 2: Scope Selection with Clear Guidance
      const scopeSelection = await select({
        message: '2. Select Installation Scope:',
        options: [
          {
            value: 'project',
            label: 'Project Scope (Recommended)',
            hint: 'Workspace directory; tracked in Git & shared with team via lockfile',
          },
          {
            value: 'global',
            label: 'Global Scope (-g / --global)',
            hint: 'User home directory (~/.agents/); available across all workspaces on machine',
          },
        ],
      });

      if (typeof scopeSelection === 'string') {
        scope = scopeSelection as InstallScope;
      }

      // Step 3: Installation Method
      const methodSelection = await select({
        message: '3. Select Installation Method:',
        options: [
          {
            value: 'symlink',
            label: 'Symlink Mode (Recommended)',
            hint: 'Single source of truth; package updates reflect instantly',
          },
          {
            value: 'copy',
            label: 'Copy Mode',
            hint: 'Independent standalone files; supports offline isolated modifications',
          },
        ],
      });

      if (typeof methodSelection === 'string') {
        method = methodSelection as InstallMethod;
      }
    }

    // Step 4: Bundle Selection (if identifier was not passed as argument)
    if (!identifier) {
      const bundles = await registry.listBundles();
      const bundleOptions = bundles.map(b => {
        const meta = BUNDLE_DISPLAY_NAMES[b.name];
        const label = meta ? `${meta.title} (${b.name}) — ${meta.summary}` : `${b.name} — ${b.description}`;
        return {
          value: b.name,
          label,
          hint: b.name === 'software-engineering' ? 'recommended' : b.name === 'full' ? 'all-in-one' : undefined,
        };
      });

      const selected = await select({
        message: '4. Select a Bundle to install:',
        options: bundleOptions,
      });

      if (typeof selected === 'string') {
        identifier = selected;
      } else {
        outro(pc.yellow('Installation cancelled.'));
        return;
      }
    }

    const s = spinner();
    s.start(`Resolving "${identifier}"...`);

    try {
      const result = await installer.install(identifier, {
        scope,
        method,
        hosts,
        yes: options.yes,
        force: options.force,
        dryRun: options.dryRun,
      });

      s.stop(`Resolved assets for "${identifier}"`);

      if (options.dryRun) {
        outro(pc.yellow(`[DRY RUN] Would install ${result.installed.agents.length} agents, ${result.installed.skills.length} skills to ${result.targetDirs.join(', ')}`));
        return;
      }

      note(
        `Bundle: ${result.installed.targetBundle || 'Single Item'}\n` +
        `Scope: ${scope}\n` +
        `Method: ${result.method}\n` +
        `Targets: ${hosts.join(', ')}\n` +
        `Agents: ${result.installed.agents.join(', ') || 'None'}\n` +
        `Skills: ${result.installed.skills.join(', ') || 'None'}\n` +
        `Target Directories: ${result.targetDirs.join('\n  ')}`,
        'Installation Success'
      );

      outro(pc.green(`✔ Installed "${identifier}" successfully!`));
    } catch (err: any) {
      s.stop(pc.red('Failed resolution'));
      outro(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

cli
  .command('remove [identifier]', 'Remove a bundle, agent, skill, or workflow')
  .alias('uninstall')
  .option('-g, --global', 'Uninstall from global home directory')
  .option('-t, --target <hosts>', 'Target agent host runtimes', { default: 'agents' })
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-f, --force', 'Force removal of modified files')
  .option('--dry-run', 'Simulate removal without unlinking files')
  .action(async (targetIdentifier?: string, options: any = {}) => {
    intro(pc.cyan('Agents United - Remove Package'));

    let identifier = targetIdentifier;
    if (!identifier) {
      const bundles = await registry.listBundles();
      const bundleOptions = bundles.map(b => {
        const meta = BUNDLE_DISPLAY_NAMES[b.name];
        const label = meta ? `${meta.title} (${b.name}) — ${meta.summary}` : `${b.name} — ${b.description}`;
        return {
          value: b.name,
          label,
        };
      });

      const selected = await select({
        message: 'Select a Bundle to remove:',
        options: bundleOptions,
      });

      if (typeof selected === 'string') {
        identifier = selected;
      } else {
        outro(pc.yellow('Removal cancelled.'));
        return;
      }
    }

    const s = spinner();
    s.start(`Removing "${identifier}"...`);

    try {
      const result = await uninstaller.uninstall(identifier, {
        global: options.global,
        target: options.target,
        yes: options.yes,
        force: options.force,
        dryRun: options.dryRun,
      });

      s.stop(`Uninstall processed`);

      if (options.dryRun) {
        outro(pc.yellow(`[DRY RUN] Would remove ${result.removed.length} assets from ${result.targetDirs.join(', ')}`));
        return;
      }

      outro(pc.green(`✔ Successfully removed ${result.removed.length} files matching "${identifier}"`));
    } catch (err: any) {
      s.stop(pc.red('Uninstall failed'));
      outro(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

cli
  .command('list', 'List available and installed bundles')
  .alias('ls')
  .action(async () => {
    intro(pc.cyan('Agents United - Available Bundles'));
    const bundles = await registry.listBundles();

    for (const b of bundles) {
      console.log(`  ${pc.bold(pc.green(b.name))}`);
      console.log(`    ${pc.dim(b.description)}`);
      console.log(`    ${pc.gray(`Orchestrator: ${b.orchestrator} | Skills: ${b.skills?.length || 0} | Workflows: ${b.workflows?.length || 0}`)}\n`);
    }

    outro(pc.cyan('Run "npx agents-united add <bundle>" to install a bundle.'));
  });

cli
  .command('find [query]', 'Search for agents, skills, or bundles in the registry')
  .alias('search')
  .action(async (query?: string) => {
    if (!query) {
      intro(pc.cyan('Agents United - Available Bundles'));
      const bundles = await registry.listBundles();
      for (const b of bundles) {
        console.log(`  - ${pc.green(b.name)}: ${pc.dim(b.description)}`);
      }
      outro(pc.cyan('Use "npx agents-united add <name>" to install any bundle.'));
      return;
    }

    intro(pc.cyan(`Agents United - Search: "${query}"`));
    const results = await registry.find(query);

    console.log(pc.bold('\nMatching Bundles:'));
    results.bundles.forEach(b => console.log(`  - ${pc.green(b.name)}: ${pc.dim(b.description)}`));

    console.log(pc.bold('\nMatching Agents:'));
    results.agents.forEach(a => console.log(`  - ${pc.blue(a)}`));

    console.log(pc.bold('\nMatching Skills:'));
    results.skills.forEach(s => console.log(`  - ${pc.yellow(s)}`));

    outro(pc.cyan('\nUse "npx agents-united add <name>" to install any match.'));
  });

cli
  .command('init', 'Initialize project workspace directory and install recommended bundle')
  .option('-b, --bundle <bundle>', 'Default bundle to install', { default: 'software-engineering' })
  .option('-s, --symlink', 'Use symlinks (default / recommended)')
  .option('--copy', 'Use standalone copies')
  .option('-t, --target <hosts>', 'Target agent hosts', { default: 'agents' })
  .action(async (options: any) => {
    intro(pc.cyan('Agents United - Initialize Workspace'));
    const s = spinner();
    s.start(`Initializing workspace with bundle "${options.bundle}"...`);

    try {
      const result = await installer.install(options.bundle, {
        scope: 'project',
        symlink: options.symlink,
        copy: options.copy,
        target: options.target,
      });
      s.stop(`Initialized ${result.targetDirs.join(', ')}`);
      outro(pc.green(`✔ Initialized workspace with "${options.bundle}" bundle!`));
    } catch (err: any) {
      s.stop(pc.red('Initialization failed'));
      outro(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

cli
  .command('doctor', 'Verify health of installed agents, frontmatter schemas, and hooks')
  .action(async () => {
    intro(pc.cyan('Agents United - Health Doctor'));
    const report = await DoctorEngine.runDoctor();

    console.log(`  Installed Agents: ${report.agentsCount}`);
    console.log(`  Installed Skills: ${report.skillsCount}`);
    console.log(`  Installed Workflows: ${report.workflowsCount}\n`);

    if (report.issues.length > 0) {
      console.log(pc.red(pc.bold('Issues Found:')));
      report.issues.forEach(i => console.log(`  ✖ ${i}`));
    }

    if (report.warnings.length > 0) {
      console.log(pc.yellow(pc.bold('Warnings:')));
      report.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    }

    if (report.valid && report.issues.length === 0) {
      outro(pc.green('✔ All installed agents and frontmatter schemas are healthy!'));
    } else {
      outro(pc.red('✖ Doctor found issues in workspace configuration.'));
      process.exit(1);
    }
  });

cli.help();
cli.version('1.0.0');

cli.parse();
