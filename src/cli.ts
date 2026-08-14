import { cac } from 'cac';
import pc from 'picocolors';
import { intro, outro, spinner, note, select, multiselect, confirm, text } from '@clack/prompts';
import fs from 'fs-extra';
import path from 'node:path';
import { RegistryResolver } from './core/registry.js';
import { InstallEngine } from './core/installer.js';
import { UninstallEngine } from './core/uninstaller.js';
import { DoctorEngine } from './core/doctor.js';
import type { InstallScope, InstallMethod, AgentHost, BundleDefinition } from './core/types.js';

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
  'mobile-development': {
    title: 'Mobile Development Team',
    summary: 'iOS (SwiftUI), Android (Compose) & Cross-Platform (React Native/Flutter)',
  },
  'frontend-engineering': {
    title: 'Frontend Architecture Team',
    summary: 'Next.js/React App Router, Server Components & Web Vitals',
  },
  'backend-distributed-systems': {
    title: 'Backend & Distributed Systems Team',
    summary: 'Microservices, Kafka/RabbitMQ event streams & DB migrations',
  },
  'qa-automation': {
    title: 'QA & Test Automation Team',
    summary: 'Playwright E2E automation, test matrix planning & chaos engineering',
  },
  'devops-engineering': {
    title: 'DevOps & Delivery Pipeline Team',
    summary: 'CI/CD automation, Docker/K8s, Infrastructure as Code & release engineering',
  },
  'sysops-sre': {
    title: 'SysOps & Site Reliability Team',
    summary: '99.999% uptime, Prometheus telemetry, incident triage & disaster recovery',
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
    summary: 'Complete suite with all 13 team leads, 38 agents, and 65 skills',
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

    // Step 4: Two-Stage Hierarchical Department & Bundle Selection
    if (!identifier) {
      const bundles = await registry.listBundles();

      const domainMeta: Record<string, { label: string; icon: string }> = {
        engineering: { label: 'Software Engineering & Delivery', icon: '🛠️ ' },
        architecture: { label: 'System Architecture & SRE', icon: '🏛️ ' },
        design: { label: 'Product Design & UI/UX', icon: '🎨 ' },
        marketing: { label: 'Growth & Marketing Operations', icon: '📈 ' },
        security: { label: 'Security Operations', icon: '🔒 ' },
        research: { label: 'Deep Technical Research', icon: '🔬 ' },
        business: { label: 'Business Strategy & Economics', icon: '💼 ' },
        universal: { label: 'Universal Autonomous Department', icon: '🌐 ' },
      };

      let selectedBundle: string | undefined;

      while (!selectedBundle) {
        // Stage 4a: Department Domain Selection
        const domainOptions = Object.entries(domainMeta).map(([domainKey, meta]) => {
          const count = bundles.filter(b => b.domain === domainKey).length;
          return {
            value: domainKey,
            label: `${meta.icon} ${meta.label}`,
            hint: domainKey === 'universal' ? 'full suite (38 agents, 65 skills)' : `${count} specialized team${count > 1 ? 's' : ''}`,
          };
        });

        domainOptions.push({
          value: '__search__',
          label: '🔍 Search by name / keyword...',
          hint: 'custom keyword search',
        });

        const selectedDomain = await select({
          message: '4. Select Department Domain:',
          options: domainOptions,
        });

        if (typeof selectedDomain !== 'string') {
          outro(pc.yellow('Installation cancelled.'));
          return;
        }

        if (selectedDomain === '__search__') {
          const searchQuery = await text({
            message: 'Enter keyword to search:',
            placeholder: 'e.g. mobile, playwright, react, backend',
          });

          if (typeof searchQuery !== 'string' || !searchQuery.trim()) {
            continue;
          }

          const searchResults = await registry.find(searchQuery.trim());
          const matchOptions: Array<{ value: string; label: string; hint?: string }> = [
            ...searchResults.bundles.map((b: BundleDefinition) => ({
              value: b.name,
              label: `[Bundle] ${BUNDLE_DISPLAY_NAMES[b.name]?.title || b.name} (${b.name})`,
              hint: b.description,
            })),
            ...searchResults.agents.map((a: string) => ({
              value: a.replace(/\.md$/, ''),
              label: `[Agent] ${a}`,
              hint: 'autonomous agent',
            })),
            ...searchResults.skills.map((s: string) => ({
              value: s,
              label: `[Skill] ${s}`,
              hint: 'specialized skill',
            })),
            ...searchResults.workflows.map((w: string) => ({
              value: w.replace(/\.md$/, ''),
              label: `[Workflow] ${w}`,
              hint: 'guided workflow',
            })),
            {
              value: '__back__',
              label: '🔙 Back to Department Selection',
              hint: '',
            },
          ];

          if (matchOptions.length === 1) {
            note(`No items found matching "${searchQuery}".`, 'Search Results');
            continue;
          }

          const chosenMatch = await select({
            message: `Search Results for "${searchQuery}":`,
            options: matchOptions,
          });

          if (typeof chosenMatch === 'string' && chosenMatch !== '__back__') {
            selectedBundle = chosenMatch;
            break;
          }
          continue;
        }

        const domainBundles = bundles.filter(b => b.domain === selectedDomain);

        // Stage 4b: Sub-Team Selection inside Selected Domain
        const subTeamOptions: Array<{ value: string; label: string; hint?: string }> = [];

        // Option to install entire department if multiple bundles exist
        if (domainBundles.length > 1) {
          subTeamOptions.push({
            value: `__all_domain__:${selectedDomain}`,
            label: `🌟 Install Entire ${domainMeta[selectedDomain]?.label || selectedDomain} (${domainBundles.length} Bundles)`,
            hint: 'installs all sub-teams under this department',
          });
        }

        // Sort so Essentials is always at the top
        const sortedBundles = [...domainBundles].sort((a, b) => {
          if (!a.parentBundle && b.parentBundle) return -1;
          if (a.parentBundle && !b.parentBundle) return 1;
          return a.name.localeCompare(b.name);
        });

        sortedBundles.forEach((b, idx) => {
          const isLast = idx === sortedBundles.length - 1;
          const branch = sortedBundles.length > 1 ? (isLast ? '└── ' : '├── ') : '';
          const meta = BUNDLE_DISPLAY_NAMES[b.name];
          const isEssentials = !b.parentBundle && (b.name === 'software-engineering' || b.name === 'system-architecture');
          const title = meta ? meta.title : b.name;
          const labelText = isEssentials ? `Essentials: ${title}` : title;
          const summary = meta ? meta.summary : b.description;
          subTeamOptions.push({
            value: b.name,
            label: `${branch}📦 ${labelText} (${b.name})`,
            hint: summary,
          });
        });

        subTeamOptions.push({
          value: '__back__',
          label: '🔙 Back to Department Selection',
          hint: '',
        });

        const chosenSubTeam = await select({
          message: `Select Package / Team Bundle to install in ${domainMeta[selectedDomain]?.label || selectedDomain}:`,
          options: subTeamOptions,
        });

        if (typeof chosenSubTeam !== 'string') {
          outro(pc.yellow('Installation cancelled.'));
          return;
        }

        if (chosenSubTeam === '__back__') {
          continue;
        }

        if (chosenSubTeam.startsWith('__all_domain__:')) {
          const dName = chosenSubTeam.replace('__all_domain__:', '');
          const dTitle = domainMeta[dName]?.label || dName;
          const proceed = await confirm({
            message: `⚠️  You are about to install ALL ${domainBundles.length} sub-teams under "${dTitle}". Proceed?`,
            initialValue: true,
          });

          if (!proceed || typeof proceed !== 'boolean') {
            continue;
          }

          selectedBundle = `domain:${dName}`;
          break;
        }

        selectedBundle = chosenSubTeam;
        break;
      }

      identifier = selectedBundle;
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
  .command('list', 'List available bundles grouped by department domain')
  .alias('ls')
  .option('--json', 'Output bundles in JSON format')
  .action(async (options: any = {}) => {
    const bundles = await registry.listBundles();

    if (options.json) {
      console.log(JSON.stringify(bundles, null, 2));
      return;
    }

    intro(pc.cyan('Agents United — Registry Catalog Tree'));

    const domainTitles: Record<string, string> = {
      engineering: '🛠️  Software Engineering & Delivery',
      architecture: '🏛️  System Architecture & SRE',
      design: '🎨  Product Design & UI/UX',
      marketing: '📈  Growth & Marketing Operations',
      security: '🔒  Security Operations',
      research: '🔬  Deep Technical Research',
      business: '💼  Business Strategy & Economics',
      universal: '🌐  Universal Autonomous Department',
    };

    const domainOrder = [
      'engineering',
      'architecture',
      'design',
      'marketing',
      'security',
      'research',
      'business',
      'universal',
    ];

    const grouped: Record<string, typeof bundles> = {};
    for (const b of bundles) {
      const d = b.domain || 'other';
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(b);
    }

    for (const domainKey of domainOrder) {
      const items = grouped[domainKey];
      if (!items || items.length === 0) continue;

      const header = domainTitles[domainKey] || `📁  ${domainKey.toUpperCase()}`;
      console.log(`\n${pc.bold(pc.magenta(header))} ${pc.dim(`(${items.length} bundle${items.length > 1 ? 's' : ''})`)}`);

      items.forEach((b: BundleDefinition, bIdx: number) => {
        const isLastBundle = bIdx === items.length - 1;
        const bBranch = isLastBundle ? '└──' : '├──';
        const subIndent = isLastBundle ? '    ' : '│   ';

        const meta = BUNDLE_DISPLAY_NAMES[b.name];
        const isEssentials = !b.parentBundle && (b.name === 'software-engineering' || b.name === 'system-architecture');
        const titleSuffix = isEssentials ? pc.cyan(' (Essentials)') : '';
        const parentTag = b.parentBundle ? pc.gray(` [inherits: ${b.parentBundle}]`) : '';
        const aliasesTag = b.aliases && b.aliases.length > 0 ? pc.gray(` [alias: ${b.aliases.join(', ')}]`) : '';

        console.log(`${bBranch} 📦 ${pc.bold(pc.green(b.name))}${titleSuffix}${parentTag}${aliasesTag}`);
        console.log(`${subIndent}│   ${pc.white(b.description)}`);

        // Lead / Orchestrator
        if (b.orchestrator) {
          const orchName = b.orchestrator.replace(/\.md$/, '');
          console.log(`${subIndent}├── 🤖 Lead: ${pc.blue(orchName)}`);
        }

        // Subagents
        if (b.agents && b.agents.length > 0) {
          const subNames = b.agents.map(a => a.replace(/^subagent-/, '').replace(/\.md$/, ''));
          const displaySubs =
            subNames.length > 3 ? `${subNames.slice(0, 3).join(', ')} (+${subNames.length - 3} more)` : subNames.join(', ');
          console.log(`${subIndent}├── 🤖 Sub-agents: ${pc.blue(displaySubs)}`);
        }

        // Skills
        if (b.skills && b.skills.length > 0) {
          const displaySkills =
            b.skills.length > 3 ? `${b.skills.slice(0, 3).join(', ')} (+${b.skills.length - 3} more)` : b.skills.join(', ');
          console.log(`${subIndent}├── ⚡ Skills: ${pc.yellow(displaySkills)}`);
        }

        // Workflows
        if (b.workflows && b.workflows.length > 0) {
          const wfNames = b.workflows.map(w => w.replace(/^workflow-/, '').replace(/\.md$/, ''));
          const displayWfs =
            wfNames.length > 3 ? `${wfNames.slice(0, 3).join(', ')} (+${wfNames.length - 3} more)` : wfNames.join(', ');
          console.log(`${subIndent}└── 🔄 Workflows: ${pc.magenta(displayWfs)}`);
        } else {
          console.log(`${subIndent}└── 🔄 Workflows: ${pc.dim('Inherited from parent')}`);
        }

        if (!isLastBundle) {
          console.log(`${subIndent}`);
        }
      });
    }

    outro(pc.cyan('\nRun "agents add <bundle>" or select interactively to install.'));
  });

cli
  .command('find [query]', 'Search for agents, skills, workflows, or bundles in the registry')
  .alias('search')
  .option('-c, --category <domain>', 'Filter search by domain (e.g. engineering, architecture, design)')
  .option('-t, --type <type>', 'Filter by item type (bundle, agent, skill, workflow)')
  .option('--json', 'Output results in JSON format')
  .option('-i, --interactive', 'Interactive selection to install matching item')
  .action(async (query?: string, options: any = {}) => {
    const q = query || '';
    const results = await registry.find(q, {
      domain: options.category || options.domain,
      type: options.type,
    });

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    const totalCount =
      results.bundles.length + results.agents.length + results.skills.length + results.workflows.length;

    intro(pc.cyan(`Agents United - Search Results: "${q || '*'}" (${totalCount} found)`));

    if (results.bundles.length > 0) {
      console.log(pc.bold(`\n📦 Bundles (${results.bundles.length}):`));
      results.bundles.forEach((b: BundleDefinition) => {
        const meta = BUNDLE_DISPLAY_NAMES[b.name];
        console.log(`  - ${pc.green(pc.bold(b.name))}: ${pc.white(meta?.title || b.name)} — ${pc.dim(b.description)}`);
      });
    }

    if (results.agents.length > 0) {
      console.log(pc.bold(`\n🤖 Agents (${results.agents.length}):`));
      results.agents.forEach((a: string) => {
        const stem = a.replace(/\.md$/, '');
        console.log(`  - ${pc.blue(stem)} ${pc.gray(`(${a})`)}`);
      });
    }

    if (results.skills.length > 0) {
      console.log(pc.bold(`\n⚡ Skills (${results.skills.length}):`));
      results.skills.forEach((s: string) => console.log(`  - ${pc.yellow(s)}`));
    }

    if (results.workflows.length > 0) {
      console.log(pc.bold(`\n🔄 Workflows (${results.workflows.length}):`));
      results.workflows.forEach((w: string) => {
        const stem = w.replace(/\.md$/, '');
        console.log(`  - ${pc.magenta(stem)} ${pc.gray(`(${w})`)}`);
      });
    }

    if (totalCount === 0) {
      console.log(pc.yellow(`\nNo matching items found for "${q}". Try searching without filters or using "agents list".`));
    }

    if (options.interactive && totalCount > 0) {
      const items: Array<{ value: string; label: string }> = [
        ...results.bundles.map((b: BundleDefinition) => ({ value: b.name, label: `[Bundle] ${b.name} — ${b.description}` })),
        ...results.agents.map((a: string) => ({ value: a.replace(/\.md$/, ''), label: `[Agent] ${a}` })),
        ...results.skills.map((s: string) => ({ value: s, label: `[Skill] ${s}` })),
        ...results.workflows.map((w: string) => ({ value: w.replace(/\.md$/, ''), label: `[Workflow] ${w}` })),
      ];

      const selected = await select({
        message: 'Select an item to install:',
        options: items,
      });

      if (typeof selected === 'string') {
        const s = spinner();
        s.start(`Installing "${selected}"...`);
        try {
          const res = await installer.install(selected, { scope: 'project' });
          s.stop(`Installed ${selected}`);
          outro(pc.green(`✔ Successfully installed "${selected}"!`));
        } catch (err: any) {
          s.stop(pc.red('Installation failed'));
          outro(pc.red(`Error: ${err.message}`));
        }
        return;
      }
    }

    outro(pc.cyan('\nUse "agents add <name>" to install any match.'));
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
