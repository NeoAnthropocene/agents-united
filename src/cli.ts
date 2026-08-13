import { cac } from 'cac';
import pc from 'picocolors';
import { intro, outro, spinner, note } from '@clack/prompts';
import { RegistryResolver } from './core/registry.js';
import { InstallEngine } from './core/installer.js';
import { UninstallEngine } from './core/uninstaller.js';
import { DoctorEngine } from './core/doctor.js';
import { TargetAdapter } from './core/adapter.js';

const cli = cac('agents-united');
const registry = new RegistryResolver();
const installer = new InstallEngine(registry);
const uninstaller = new UninstallEngine(registry);

cli
  .command('add <identifier>', 'Add a bundle, agent, skill, or workflow to workspace or global configuration')
  .option('-g, --global', 'Install globally to ~/.gemini/config/')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-f, --force', 'Force overwrite user modified files')
  .option('--dry-run', 'Simulate installation without writing files')
  .action(async (identifier: string, options: any) => {
    intro(pc.cyan('Agents United - Add Package'));
    const s = spinner();
    s.start(`Resolving "${identifier}"...`);

    try {
      const result = await installer.install(identifier, {
        global: options.global,
        yes: options.yes,
        force: options.force,
        dryRun: options.dryRun,
      });

      s.stop(`Resolved assets for "${identifier}"`);

      if (options.dryRun) {
        outro(pc.yellow(`[DRY RUN] Would install ${result.installed.agents.length} agents, ${result.installed.skills.length} skills to ${result.targetDir}`));
        return;
      }

      note(
        `Bundle: ${result.installed.targetBundle || 'Single Item'}\n` +
        `Agents: ${result.installed.agents.join(', ') || 'None'}\n` +
        `Skills: ${result.installed.skills.join(', ') || 'None'}\n` +
        `Target Directory: ${result.targetDir}`,
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
  .option('-g, --global', 'Uninstall from global ~/.gemini/config/')
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
        yes: options.yes,
        force: options.force,
        dryRun: options.dryRun,
      });

      s.stop(`Uninstall processed`);

      if (options.dryRun) {
        outro(pc.yellow(`[DRY RUN] Would remove ${result.removed.length} assets from ${result.targetDir}`));
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
  .command('init', 'Initialize workspace .agents folder and install recommended bundle')
  .option('-b, --bundle <bundle>', 'Default bundle to install', { default: 'software-engineering' })
  .action(async (options: any) => {
    intro(pc.cyan('Agents United - Initialize Workspace'));
    const s = spinner();
    s.start(`Initializing .agents directory with bundle "${options.bundle}"...`);

    try {
      const result = await installer.install(options.bundle, { scope: 'workspace' });
      s.stop(`Initialized ${result.targetDir}`);
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
