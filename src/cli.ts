import { cac } from 'cac';
import pc from 'picocolors';
import { intro, outro, spinner, note, select, multiselect } from '@clack/prompts';
import { RegistryResolver } from './core/registry.js';
import { InstallEngine } from './core/installer.js';
import { UninstallEngine } from './core/uninstaller.js';
import { DoctorEngine } from './core/doctor.js';
import type { InstallScope, InstallMethod, AgentHost } from './core/types.js';

const cli = cac('agents-united');
const registry = new RegistryResolver();
const installer = new InstallEngine(registry);
const uninstaller = new UninstallEngine(registry);

cli
  .command('add <identifier>', 'Add a bundle, agent, skill, or workflow to project or global configuration')
  .option('-g, --global', 'Install globally into home directory (~/.agents/)')
  .option('-s, --symlink', 'Create symbolic links to central registry cache (default / recommended)')
  .option('--copy', 'Create independent standalone copies of asset files')
  .option('-t, --target <hosts>', 'Target agent host runtimes (agents, gemini, claude, cursor)', { default: 'agents' })
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-f, --force', 'Force overwrite user modified files')
  .option('--dry-run', 'Simulate installation without writing files')
  .action(async (identifier: string, options: any) => {
    intro(pc.cyan('Agents United - Add Package'));

    let scope: InstallScope = options.global ? 'global' : 'project';
    let method: InstallMethod = options.copy ? 'copy' : 'symlink';
    let hosts: AgentHost[] = options.target ? (Array.isArray(options.target) ? options.target : options.target.split(',')) : ['agents'];

    // Interactive Wizard when running interactively without flags
    if (process.stdout.isTTY && !options.yes && !options.global && !options.copy && !options.symlink && options.target === 'agents') {
      const scopeSelection = await select({
        message: 'Select Installation Scope:',
        options: [
          { value: 'project', label: 'Project Scope (Default - ./.agents/ in workspace, team-shared)', hint: 'recommended' },
          { value: 'global', label: 'Global Scope (-g - ~/.agents/ in home directory, system-wide)' },
        ],
      });

      if (typeof scopeSelection === 'string') {
        scope = scopeSelection as InstallScope;
      }

      const methodSelection = await select({
        message: 'Select Installation Method:',
        options: [
          { value: 'symlink', label: 'Symlink Mode (Default - Single source of truth, updates auto-sync)', hint: 'recommended' },
          { value: 'copy', label: 'Copy Mode (Independent physical copies, supports offline edits)' },
        ],
      });

      if (typeof methodSelection === 'string') {
        method = methodSelection as InstallMethod;
      }

      const hostSelection = await multiselect({
        message: 'Select Target Agent Host Runtimes:',
        options: [
          { value: 'agents', label: 'Universal .agents/ (Default)', hint: 'recommended' },
          { value: 'gemini', label: 'Antigravity 2.0 / Gemini (.gemini/)' },
          { value: 'claude', label: 'Claude Code (.claude/)' },
          { value: 'cursor', label: 'Cursor / Codex (.cursor/)' },
        ],
        required: false,
      });

      if (Array.isArray(hostSelection) && hostSelection.length > 0) {
        hosts = hostSelection as AgentHost[];
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
  .command('remove <identifier>', 'Remove a bundle, agent, skill, or workflow')
  .alias('uninstall')
  .option('-g, --global', 'Uninstall from global home directory')
  .option('-t, --target <hosts>', 'Target agent host runtimes', { default: 'agents' })
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-f, --force', 'Force removal of modified files')
  .option('--dry-run', 'Simulate removal without unlinking files')
  .action(async (identifier: string, options: any) => {
    intro(pc.cyan('Agents United - Remove Package'));
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
  .command('find <query>', 'Search for agents, skills, or bundles in the registry')
  .alias('search')
  .action(async (query: string) => {
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
