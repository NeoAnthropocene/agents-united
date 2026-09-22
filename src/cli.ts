import { cac } from 'cac';
import pc from 'picocolors';
import { intro, outro, spinner, note, select, multiselect, confirm, text } from '@clack/prompts';
import fs from 'fs-extra';
import path from 'node:path';
import { RegistryResolver } from './core/registry.js';
import { InstallEngine } from './core/installer.js';
import { UninstallEngine } from './core/uninstaller.js';
import { InventoryScanner } from './core/inventory.js';
import { UpdateEngine } from './core/updater.js';
import { DoctorEngine } from './core/doctor.js';
import { ClineLauncher } from './core/cline-launcher.js';
import { ClineCapabilityProbe } from './core/cline-capabilities.js';
import { ClaudeLauncher } from './core/claude-launcher.js';
import type { ClaudeActivationPlan } from './core/claude-launcher.js';
import { ClaudeCapabilityProbe } from './core/claude-capabilities.js';
import { PrerequisiteChecker } from './core/prerequisites.js';
import { McpLocationRegistry } from './core/mcp-locations.js';
import { isKnownHost, HOST_REGISTRY, KNOWN_HOST_IDS, planInstallTargets } from './core/hosts.js';
import type { InstallScope, InstallMethod, AgentHost, BundleDefinition, BundleTier, InstalledPackageRecord, ProjectionInfo, ExecutionMode, ClaudeCapabilityReport } from './core/types.js';

const cli = cac('agents-united');
const registry = new RegistryResolver();
const installer = new InstallEngine(registry);
const uninstaller = new UninstallEngine(registry);
const scanner = new InventoryScanner(registry);
const updater = new UpdateEngine(registry, scanner, installer);

export function detectWorkspaceHosts(cwd: string = process.cwd()): AgentHost[] {
  const detected: AgentHost[] = [];
  for (const host of Object.values(HOST_REGISTRY)) {
    const found = host.detectionMarkers.some(marker => fs.pathExistsSync(path.join(cwd, marker)));
    if (found) detected.push(host.id as AgentHost);
  }
  return detected;
}

export function getTerminalContentWidth(): number {
  const cols = typeof process !== 'undefined' && process.stdout?.columns ? process.stdout.columns : 80;
  return Math.max(40, Math.min(cols - 8, 68));
}

export function wrapText(text: string, maxLen?: number, indent: string = ''): string[] {
  if (!text) return [];
  const limit = maxLen ?? getTerminalContentWidth();
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = indent;

  for (const word of words) {
    if (!word) continue;
    if (current.length > indent.length && (current.length + 1 + word.length > limit)) {
      lines.push(current);
      current = indent + word;
    } else {
      current = current.length === indent.length ? current + word : current + ' ' + word;
    }
  }

  if (current.trim().length > 0) {
    lines.push(current);
  }

  return lines;
}

export function formatWrappedList(
  items: string[],
  indent: string = '  ',
  maxLineLen?: number
): string[] {
  if (!items || items.length === 0) return [];

  const limit = maxLineLen ?? getTerminalContentWidth();
  const lines: string[] = [];
  let currentLine = indent;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;
    const token = isLast ? item : `${item}, `;

    if (currentLine.length > indent.length && (currentLine.length + token.length > limit)) {
      lines.push(currentLine.trimEnd());
      currentLine = indent + token;
    } else {
      currentLine += token;
    }
  }

  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trimEnd());
  }

  return lines;
}

export interface InstallationSummaryOptions {
  bundleName: string;
  scope: string;
  method: string;
  hosts: string[];
  agents: string[];
  skills: string[];
  targetDirs: string[];
  projections?: ProjectionInfo[];
}

export function formatInstallationSummary(options: InstallationSummaryOptions): string {
  const { bundleName, scope, method, hosts, agents, skills, targetDirs, projections } = options;
  const limit = getTerminalContentWidth();

  const lines: string[] = [
    `Bundle: ${bundleName}`,
    `Scope: ${scope}`,
    `Method: ${method}`,
    `Targets: ${hosts.join(', ')}`,
  ];

  // Agents
  if (agents.length === 0) {
    lines.push(`Agents: None`);
  } else {
    const inlineAgents = `Agents (${agents.length}): ${agents.join(', ')}`;
    if (inlineAgents.length <= limit) {
      lines.push(inlineAgents);
    } else {
      lines.push(`Agents (${agents.length}):`);
      lines.push(...formatWrappedList(agents, '  ', limit));
    }
  }

  // Skills
  if (skills.length === 0) {
    lines.push(`Skills: None`);
  } else {
    const inlineSkills = `Skills (${skills.length}): ${skills.join(', ')}`;
    if (inlineSkills.length <= limit) {
      lines.push(inlineSkills);
    } else {
      lines.push(`Skills (${skills.length}):`);
      lines.push(...formatWrappedList(skills, '  ', limit));
    }
  }

  // Target Directories
  if (targetDirs.length === 0) {
    lines.push('Target Directories: None');
  } else if (targetDirs.length === 1) {
    const singleDirLine = `Target Directories: ${targetDirs[0]}`;
    if (singleDirLine.length <= limit) {
      lines.push(singleDirLine);
    } else {
      lines.push('Target Directories:');
      lines.push(`  ${targetDirs[0]}`);
    }
  } else {
    lines.push(`Target Directories (${targetDirs.length}):`);
    for (const dir of targetDirs) {
      lines.push(`  ${dir}`);
    }
  }

  // Projections summary
  if (projections && projections.length > 0) {
    const byHost = new Map<string, number>();
    for (const p of projections) {
      byHost.set(p.host, (byHost.get(p.host) ?? 0) + 1);
    }
    const hostSummaries: string[] = [];
    for (const [host, count] of byHost) {
      const label = HOST_REGISTRY[host]?.label ?? host;
      hostSummaries.push(`${label} (${count} file${count > 1 ? 's' : ''})`);
    }
    lines.push(`Projections: ${hostSummaries.join(', ')}`);
  }

  return lines.join('\n');
}

export function renderProjections(projections: ProjectionInfo[]): string {
  const byHost = new Map<string, ProjectionInfo[]>();
  for (const p of projections) {
    const list = byHost.get(p.host) ?? [];
    list.push(p);
    byHost.set(p.host, list);
  }
  const lines: string[] = [];
  for (const [host, items] of byHost) {
    lines.push(`${HOST_REGISTRY[host]?.label ?? host} — ${items.length} file${items.length > 1 ? 's' : ''}`);
    for (const p of items) {
      lines.push(`  → ${p.path}`);
      for (const w of p.warnings) {
        const wrapped = wrapText(`⚠ ${w}`, 68, '  ');
        for (const wl of wrapped) {
          lines.push(pc.yellow(wl));
        }
      }
    }
  }
  return lines.join('\n');
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
  'ai-ml-engineering': {
    title: 'AI & Machine Learning Engineering Team',
    summary: 'Serverless GPU deployment, LLM fine-tuning, RAG vector pipelines & AI safety guardrails',
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
    summary: 'Growth strategists, creative visual designer, content pipeline & conversion optimization',
  },
  'seo-content-marketing': {
    title: 'SEO & Content Marketing Team',
    summary: 'Programmatic SEO, technical SEO audits, content pipeline automation & schema markup',
  },
  'performance-paid-acquisition': {
    title: 'Performance & Paid Acquisition Team',
    summary: 'Multi-channel PPC (Google/Meta/LinkedIn), ROAS/CAC attribution & ad copy testing',
  },
  'product-led-growth': {
    title: 'Product-Led Growth Team',
    summary: 'Onboarding CRO, signup funnel optimization, viral referral loops & paywalls',
  },
  'lifecycle-email-marketing': {
    title: 'Lifecycle & Email Marketing Team',
    summary: 'Automated email drip sequences, churn prevention playbooks & newsletter workflows',
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
  'digital-agency': {
    title: 'Digital Agency',
    summary: 'Full-service digital product agency with web dev, mobile, design, SEO, and growth marketing',
  },
  'universal-orchestration': {
    title: 'Universal Orchestration',
    summary: 'Prime Orchestrator front door: routes to the correct department Essentials bundle and hands off',
  },
  'universal-skills': {
    title: 'Universal Meta-Skills',
    summary: 'Domain-agnostic Socratic grilling, spec generation, handoff, and domain modeling',
  },
  'design-systems-ops': {
    title: 'Design Systems & Ops Team',
    summary: 'Token governance, component libraries, design handoff & version control workflows',
  },
  'design-research-testing': {
    title: 'Design Research & Testing Team',
    summary: 'Usability testing, user journey mapping, interactive prototypes & AI prototype refactoring',
  },
  'full': {
    title: 'All-in-One Autonomous Department',
    summary: 'Complete suite with all 7 team leads, 38 agents, and all 160 modular skills & workflows',
  },
};

cli
  .command('add [identifier]', 'Add a bundle, agent, skill, or workflow to project or global configuration')
  .option('-g, --global', 'Install globally into home directory (~/.agents/)')
  .option('-s, --symlink', 'Create symbolic links to central registry cache (default / recommended)')
  .option('--copy', 'Create independent standalone copies of asset files')
  .option('-t, --target <hosts>', 'Which assistants to set up (agents = main library; claude, cursor, cline, opencode, codex get translated copies)', { default: 'agents' })
  .option('--fanout <hosts>', 'Also make translated copies for these assistants: claude, cursor, cline, opencode, codex')
  .option('--plugin', 'Claude lane only: also emit the distribution-only plugin package (.agents/plugins/<bundle>/.claude-plugin/plugin.json + agents/) for `claude --plugin-dir`. Adds nothing when --fanout claude is absent; never the behavioural source. Sticky: the opt-in is recorded in the lockfile, so `agents update` keeps it. Use --no-plugin to turn it back off.')
  .option('--mode <mode>', 'Execution mode for organization bundles (operational | brainstorming)', { default: 'operational' })
  .option('--allow-missing-prereqs', 'Proceed with installation even if some prerequisites are missing')
  .option('--allow-under-construction', 'Allow installation of bundles marked as under construction')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-f, --force', 'Force overwrite user modified files')
  .option('--start', 'Start the installed team in Cline immediately after setup')
  .option('--dry-run', 'Simulate installation without writing files')
  .action(async (targetIdentifier?: string, options: any = {}) => {
    intro(pc.cyan('Agents United — AI Agent Ecosystem'));

    let identifier = targetIdentifier;
    let scope: InstallScope = options.global ? 'global' : 'project';
    let method: InstallMethod = options.copy ? 'copy' : 'symlink';
    let hosts: AgentHost[] = options.target
      ? (Array.isArray(options.target) ? options.target : options.target.split(',')).map(
          (h: string) => h.trim().toLowerCase()
        )
      : ['agents'];
    // Warn + drop unknown host ids instead of silently casting them to a type.
    const unknownHosts = hosts.filter(h => !isKnownHost(h));
    if (unknownHosts.length > 0) {
      note(`Ignoring unknown host id(s): ${unknownHosts.join(', ')}`, 'Invalid target');
      hosts = hosts.filter(isKnownHost);
      if (hosts.length === 0) hosts = ['agents'];
    }

    // Turn the target list into a plan: the main library (.agents/) plus translated
    // copies for each assistant that can't read it directly. Never installs
    // untranslated Antigravity frontmatter into another assistant's folder.
    const flagPlan = planInstallTargets(hosts);
    hosts = flagPlan.hosts;
    if (flagPlan.addedCanonicalStore) {
      note(
        'Added .agents/ — the main library your assistants share.\n' +
          'Each assistant you picked gets its own translated copy. Edit only .agents/.',
        'Main library'
      );
    }

    // Parse --fanout like hosts above but validated against HOST_REGISTRY; only
    // projection-capable host ids are honored. Warn + drop invalid ids, never a silent cast.
    let fanout: string[] = flagPlan.fanout;
    if (options.fanout) {
      const rawFanout: string[] = Array.isArray(options.fanout) ? options.fanout : String(options.fanout).split(',');
      const parsedFanout: string[] = rawFanout.map((h: string) => h.trim().toLowerCase());
      const invalidFanout: string[] = parsedFanout.filter(h => !isKnownHost(h) || !HOST_REGISTRY[h].projectionCapable);
      if (invalidFanout.length > 0) {
        note(
          `Ignoring invalid fanout host id(s): ${invalidFanout.join(', ')}. Valid ids: ${KNOWN_HOST_IDS.filter(h => HOST_REGISTRY[h].projectionCapable).join(', ')}`,
          'Invalid fanout'
        );
      }
      fanout = Array.from(new Set([...fanout, ...parsedFanout.filter(h => isKnownHost(h) && HOST_REGISTRY[h].projectionCapable)]));
    }

    // Interactive Wizard when running interactively without flags
    const isInteractive = process.stdout.isTTY && !options.yes;

    if (isInteractive && !options.global && !options.copy && !options.symlink && options.target === 'agents') {
      const detectedHosts = detectWorkspaceHosts();
      if (detectedHosts.length > 0) {
        note(
          detectedHosts.map(h => `  ✔ Detected .${HOST_REGISTRY[h].projectDir === '.' ? '' : '/'}${HOST_REGISTRY[h].projectDir === '.' ? 'AGENTS.md' : HOST_REGISTRY[h].projectDir}`).join('\n'),
          'Workspace Environment Discovery'
        );
      }

      // Step 1: Which AI tools should we configure agent teams & personas for?
      // The master library (.agents/) is always included when another tool is
      // chosen — it is the single source every translated copy is generated from.
      const hostSelection = await multiselect({
        message: '1. Which AI tools should we configure agent teams & personas for?',
        options: [
          {
            value: 'agents',
            label: HOST_REGISTRY.agents.label,
            hint: detectedHosts.includes('agents') ? 'found in this project' : 'the master library where all skills & agents live — always included',
          },
          {
            value: 'claude',
            label: HOST_REGISTRY.claude.label,
            hint: detectedHosts.includes('claude') ? 'found in this project' : 'orchestrator & subagent personas for Claude Code',
          },
          {
            value: 'cursor',
            label: HOST_REGISTRY.cursor.label,
            hint: detectedHosts.includes('cursor') ? 'found in this project' : 'orchestrator & subagent personas for Cursor IDE',
          },
          {
            value: 'cline',
            label: HOST_REGISTRY.cline.label,
            hint: detectedHosts.includes('cline') ? 'found in this project' : 'configured agents, skills, rules, workflows & team manifests for Cline',
          },
          {
            value: 'opencode',
            label: HOST_REGISTRY.opencode.label,
            hint: detectedHosts.includes('opencode') ? 'found in this project' : 'orchestrator & subagent personas for OpenCode',
          },
          {
            value: 'codex',
            label: HOST_REGISTRY.codex.label,
            hint: detectedHosts.includes('codex') ? 'found in this project' : 'root index linking orchestrators, subagents & skills for Codex, Copilot, Aider & Zed',
          },
          {
            value: 'gemini',
            label: HOST_REGISTRY.gemini.label,
            hint: detectedHosts.includes('gemini') ? 'found in this project' : 'older Antigravity 1.0 / Gemini folder',
          },
        ],
        initialValues: detectedHosts.length > 0 ? detectedHosts : ['agents'],
        required: true,
      });

      if (Array.isArray(hostSelection) && hostSelection.length > 0) {
        const wizardPlan = planInstallTargets(hostSelection as string[]);
        hosts = wizardPlan.hosts;
        // Merge with any explicitly-passed --fanout rather than discarding it.
        fanout = Array.from(new Set([...fanout, ...wizardPlan.fanout]));
        if (wizardPlan.addedCanonicalStore) {
          note(
            'Added .agents/ — the master repository library your tools share.\n' +
              'Each tool you selected gets its own orchestrators and subagents. Edit only .agents/.',
            'Master library'
          );
        }
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
        universal: { label: 'Universal Autonomous Department', icon: '🌐 ' },
        engineering: { label: 'Software Engineering & Delivery', icon: '🛠️ ' },
        architecture: { label: 'System Architecture & SRE', icon: '🏛️ ' },
        design: { label: 'Product Design & UI/UX', icon: '🎨 ' },
        marketing: { label: 'Growth & Marketing Operations', icon: '📈 ' },
        security: { label: 'Security Operations', icon: '🔒 ' },
        research: { label: 'Deep Technical Research', icon: '🔬 ' },
        business: { label: 'Business Strategy & Economics', icon: '💼 ' },
        organization: { label: 'Organization Bundles (Experimental / Cross-Functional)', icon: '🏢 ' },
      };

      let selectedBundle: string | undefined;

      while (!selectedBundle) {
        // Stage 4a: Department Domain Selection
        const domainOptions = Object.entries(domainMeta).map(([domainKey, meta]) => {
          const count = bundles.filter(b => (b.domain === domainKey || (domainKey === 'organization' && b.tier === 'organization'))).length;
          return {
            value: domainKey,
            label: `${meta.icon} ${meta.label}`,
            hint: domainKey === 'universal' ? 'meta-skills baseline + full suite' : domainKey === 'organization' ? 'cross-functional teams with prerequisites' : `${count} specialized team${count > 1 ? 's' : ''}`,
          };
        });

        domainOptions.push({
          value: '__search__',
          label: '🔍 Search by name / keyword...',
          hint: 'custom keyword search',
        });

        const selectedDomain = await select({
          message: '4. Select Department Domain / Category:',
          options: domainOptions,
        });

        if (typeof selectedDomain !== 'string') {
          outro(pc.yellow('Installation cancelled.'));
          return;
        }

        if (selectedDomain === '__search__') {
          const searchQuery = await text({
            message: 'Enter keyword to search:',
            placeholder: 'e.g. mobile, playwright, react, backend, agency',
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

        const domainBundles = bundles.filter(b => b.domain === selectedDomain || (selectedDomain === 'organization' && b.tier === 'organization'));

        // Stage 4b: Sub-Team Selection inside Selected Domain
        const subTeamOptions: Array<{ value: string; label: string; hint?: string }> = [];

        // Option to install entire department if multiple bundles exist (exclude organization and universal)
        if (domainBundles.length > 1 && selectedDomain !== 'organization' && selectedDomain !== 'universal') {
          subTeamOptions.push({
            value: `__all_domain__:${selectedDomain}`,
            label: `🌟 Install Entire ${domainMeta[selectedDomain]?.label || selectedDomain} (${domainBundles.length} Bundles)`,
            hint: 'installs all sub-teams under this department',
          });
        }

        // Sort so Essentials/universal-skills are always at the top
        const sortedBundles = [...domainBundles].sort((a, b) => {
          if (a.name === 'universal-orchestration') return -1;
          if (b.name === 'universal-orchestration') return 1;
          if (a.name === 'universal-skills') return -1;
          if (b.name === 'universal-skills') return 1;
          if (!a.parentBundle && b.parentBundle) return -1;
          if (a.parentBundle && !b.parentBundle) return 1;
          return a.name.localeCompare(b.name);
        });

        sortedBundles.forEach((b, idx) => {
          const isLast = idx === sortedBundles.length - 1;
          const branch = sortedBundles.length > 1 ? (isLast ? '└── ' : '├── ') : '';
          const meta = BUNDLE_DISPLAY_NAMES[b.name];
          const isEssentials = !b.parentBundle && b.name !== 'full' && b.tier !== 'organization' && b.name !== 'universal-skills' && b.name !== 'universal-orchestration';
          const title = meta ? meta.title : b.name;

          let statusBadge = '';
          if (b.name === 'universal-skills') statusBadge = pc.green(' ⭐ [Recommended Baseline]');
          else if (b.status === 'under-construction') statusBadge = pc.yellow(' 🚧 [Under Construction]');
          else if (b.status === 'needs-audit') statusBadge = pc.magenta(' ⚠️ [Needs Audit]');
          else if (b.status === 'experimental') statusBadge = pc.cyan(' [Experimental]');
          else if (b.status === 'deprecated') statusBadge = pc.red(' [Deprecated]');

          const labelText = isEssentials ? `Essentials: ${title}${statusBadge}` : `${title}${statusBadge}`;
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

    if (!identifier) {
      outro(pc.yellow('No package specified.'));
      return;
    }

    const targetBundleDef = await registry.getBundle(identifier);

    // 1. Under Construction Gate Evaluation
    if (targetBundleDef && targetBundleDef.status === 'under-construction') {
      if (isInteractive) {
        note(
          `The bundle "${targetBundleDef.name}" is currently under active construction (status: under-construction).\n` +
          `Its orchestrators, workflows, and specialized skills are being authored and are not ready for production use.\n\n` +
          `Planned Capabilities:\n` +
          `• Lead Orchestrator with Firecrawl & GitHub MCP tool calling\n` +
          `• Full-stack web, design & SEO delivery workflows\n` +
          `• Dual Execution Modes (Operational / Brainstorming)`,
          '🚧 Under Construction Gate'
        );

        const underConstructionChoice = await select({
          message: pc.yellow(`"${targetBundleDef.name}" is currently under construction. How would you like to proceed?`),
          options: [
            {
              value: 'abort',
              label: '🛑 Abort installation (Recommended)',
              hint: 'return without modifying workspace files',
            },
            {
              value: 'allow',
              label: '⚠️  Install in-development draft anyway (--allow-under-construction)',
              hint: 'proceed with in-progress placeholder assets',
            },
          ],
        });

        if (underConstructionChoice === 'abort' || typeof underConstructionChoice !== 'string') {
          outro(pc.yellow(`Installation cancelled. "${targetBundleDef.name}" is under construction.`));
          return;
        }
      } else {
        // Headless / Non-interactive
        if (!options.allowUnderConstruction && !options.force) {
          outro(
            pc.red(
              `Error: Cannot install "${targetBundleDef.name}" — this bundle is currently under construction.\n` +
              `To bypass this gate and install draft assets anyway, pass: --allow-under-construction or --force`
            )
          );
          process.exit(1);
        }
      }
    }

    // 2. Prerequisite Gate Evaluation & Informative Visibility
    let executionMode: ExecutionMode = (options.mode as ExecutionMode) || 'operational';

    if (targetBundleDef && (targetBundleDef.prerequisites || targetBundleDef.tier === 'organization')) {
      const checker = new PrerequisiteChecker();
      const prereqEval = await checker.evaluate(targetBundleDef, { cwd: process.cwd(), targetHosts: hosts });

      if (prereqEval.hasPrerequisites) {
        const checkLines: string[] = [];
        for (const item of prereqEval.items) {
          const typeLabel = item.type === 'mcp' ? 'MCP' : item.type === 'env' ? 'Env' : 'Pkg';
          let icon = pc.green('✓');
          let statusText = pc.green('Detected');
          if (!item.satisfied) {
            if (item.status === 'partial') {
              icon = pc.yellow('~');
              statusText = pc.yellow('Partial');
            } else {
              icon = pc.red('✗');
              statusText = pc.red('Missing');
            }
          }
          const details = pc.dim(`(${item.details || ''})`);
          checkLines.push(`  ${icon} [${typeLabel}] ${pc.bold(item.name)}: ${statusText} ${details}`);
        }

        note(
          checkLines.join('\n'),
          `Prerequisite Evaluation: ${targetBundleDef.name} (${targetBundleDef.tier === 'organization' ? 'Organization Bundle' : 'Prerequisites Required'})`
        );

        if (prereqEval.allSatisfied) {
          executionMode = (options.mode as ExecutionMode) || 'operational';
          note(pc.green('All prerequisites are satisfied! Running in Fully Operational Mode.'), 'Prerequisites Ready');
        } else {
          executionMode = (options.mode as ExecutionMode) || 'limited-operational';
          note(
            pc.cyan(
              '⚡ Adaptive Tooling: Limited Operational / Brainstorming Mode ready.\n' +
              'Your Lead Orchestrator will automatically detect active tools and guide in-session configuration seamlessly.'
            ),
            'Operational Envelope'
          );
        }
      }
    }

    const s = spinner();
    s.start(`Resolving "${identifier}"...`);

    try {
      const result = await installer.install(identifier, {
        scope,
        method,
        hosts,
        fanout,
        // Plan 016 decision 13 — opt-in Claude plugin lane (distribution-only; ignored unless the
        // claude lane runs). `--plugin` opts in, `--no-plugin` opts out explicitly, and an omitted
        // flag inherits the recorded choice so `agents update` cannot prune the package.
        pluginLane: typeof options.plugin === 'boolean' ? options.plugin : undefined,
        mode: executionMode,
        allowMissingPrereqs: options.allowMissingPrereqs,
        yes: options.yes,
        force: options.force,
        dryRun: options.dryRun,
      });

      s.stop(`Resolved assets for "${identifier}"`);

      if (options.dryRun) {
        outro(pc.yellow(`[DRY RUN] Would install ${result.installed.agents.length} agents, ${result.installed.skills.length} skills to ${result.targetDirs.join(', ')}`));
        if (result.projections.length > 0) {
          note(renderProjections(result.projections), 'Projection Plan (dry run)');
        }
        if (options.start && result.projections.some(p => p.host === 'cline')) {
          const bundleName = result.installed.targetBundle || identifier;
          note(`Would start Cline team for bundle "${bundleName}".`, 'Start in Cline (dry run)');
        }
        return;
      }

      note(
        formatInstallationSummary({
          bundleName: result.installed.targetBundle || 'Single Item',
          scope,
          method: result.method,
          hosts,
          agents: result.installed.agents,
          skills: result.installed.skills,
          targetDirs: result.targetDirs,
          projections: result.projections,
        }),
        'Installation Success'
      );

      if (result.projections.length > 0) {
        note(renderProjections(result.projections), 'Installed Projections');
      }

      const hasClineProjection = result.projections.some(p => p.host === 'cline');

      if (hasClineProjection && !options.dryRun) {
        note(
          pc.green(
            `Already active: any Cline session in this workspace now sees this bundle's\n` +
            `skills, subagent_* agent tools, rules & workflow commands (ADR 0013 native discovery).`
          ),
          'Native Activation'
        );
      }

      if (options.start && !hasClineProjection) {
        throw new Error('--start requires Cline projection. Add -t cline or --fanout cline.');
      }

      if (hasClineProjection) {
        const bundleName = result.installed.targetBundle || identifier;
        if (options.start) {
          if (options.dryRun) {
            note(`Would start Cline team for bundle "${bundleName}".`, 'Start in Cline (dry run)');
          } else {
            note(`Launching Cline team for "${bundleName}"...`, 'Starting Cline');
            const launcher = new ClineLauncher();
            const probe = new ClineCapabilityProbe();
            const probeReport = await probe.probe();
            if (probeReport.installed) {
              const targetBundleDef = await registry.getBundle(bundleName!);
              const plan = launcher.planActivation({
                bundleName: bundleName!,
                workspace: process.cwd(),
                scope,
                report: probeReport,
                orchestrator: targetBundleDef?.orchestrator,
              });
              await launcher.launch(plan);
            } else {
              note(pc.yellow('Cline executable not detected. Install Cline CLI to run: agents start ' + bundleName), 'Cline Not Found');
            }
          }
        } else if (isInteractive && !options.dryRun) {
          const startChoice = await select({
            message: `Start the ${bundleName} team in Cline now?`,
            options: [
              { value: 'start', label: '🚀 Start in Cline' },
              { value: 'copy', label: `📋 Copy command (agents start ${bundleName})` },
              { value: 'later', label: '⏳ Later' },
            ],
          });

          if (startChoice === 'start') {
            const launcher = new ClineLauncher();
            const probe = new ClineCapabilityProbe();
            const probeReport = await probe.probe();
            if (probeReport.installed) {
              const targetBundleDef = await registry.getBundle(bundleName!);
              const plan = launcher.planActivation({
                bundleName: bundleName!,
                workspace: process.cwd(),
                scope,
                report: probeReport,
                orchestrator: targetBundleDef?.orchestrator,
              });
              await launcher.launch(plan);
            } else {
              note(pc.yellow('Cline executable not detected. Install Cline CLI to run: agents start ' + bundleName), 'Cline Not Found');
            }
          } else if (startChoice === 'copy') {
            note(`Run 'agents start ${bundleName}' to launch the team in Cline anytime.`, 'Start Command');
          }
        } else if (!options.dryRun) {
          note(pc.cyan(`Tip: Run 'agents start ${bundleName}' to launch the team in Cline.`), 'Start in Cline');
        }
      }

      // Plain-language tip when the main library is the only thing installed and no
      // translated copies were requested — sets the right expectation up front.
      // ADR 0013: Cline natively discovers skills from .agents/skills/, so the old
      // "only Antigravity reads the main library" claim is no longer accurate.
      if (!options.dryRun && hosts.includes('agents') && result.projections.length === 0) {
        note(
          pc.yellow(
            `Tip: Antigravity reads the main library (.agents/) directly, and Cline natively\n` +
              `discovers skills from .agents/skills/ (ADR 0013). For Cline configured agents,\n` +
              `rules & workflows run: agents update ${identifier} --fanout cline\n` +
              `(add claude, cursor, opencode, codex for other assistants)`
          ),
          'One library, every assistant'
        );
      }

      if (!options.dryRun && targetBundleDef?.tier === 'organization') {
        note(
          pc.cyan(
            '💡 In-Session MCP Setup: Your Lead Orchestrator will automatically check\n' +
            'your runtime tools and guide configuration of live browser automation,\n' +
            'design tokens, or cloud APIs on demand.'
          ),
          'Adaptive Tooling'
        );
      }

      outro(pc.green(`✔ Installed "${identifier}" successfully!`));
    } catch (err: any) {
      s.stop(pc.red('Failed resolution'));
      outro(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

cli
  .command('remove [identifier]', 'Remove an installed bundle, agent, skill, or workflow')
  .alias('uninstall')
  .option('-g, --global', 'Uninstall from global home directory')
  .option('-t, --target <hosts>', 'Target agent host runtimes', { default: 'agents' })
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-f, --force', 'Force removal of modified files')
  .option('--dry-run', 'Simulate removal without unlinking files')
  .action(async (targetIdentifier?: string, options: any = {}) => {
    intro(pc.cyan('Agents United — Remove Package'));

    let identifier = targetIdentifier;
    let selectedRecord: InstalledPackageRecord | undefined;
    const isInteractive = process.stdout.isTTY && !options.yes;

    if (!identifier) {
      const inventory = await scanner.scan({
        global: options.global,
        target: options.target,
      });

      if (inventory.records.length === 0) {
        outro(pc.yellow('No installed packages found in project or global configuration.'));
        return;
      }

      if (!isInteractive) {
        outro(pc.red('Package identifier required in non-interactive mode. Usage: agents remove <identifier>'));
        return;
      }

      const itemOptions = inventory.records.map(record => {
        const meta = BUNDLE_DISPLAY_NAMES[record.name];
        const title = meta?.title || record.title || record.name;
        const icon = record.type === 'bundle' ? '📦' : record.type === 'skill' ? '⚡' : '🤖';
        const typeLabel = record.type !== 'bundle' ? `[${record.type}] ` : '';
        const badge = pc.cyan(record.displayLocation);
        const versionTag = pc.dim(`(v${record.installedVersion})`);

        return {
          value: record.id,
          label: `${icon} ${typeLabel}${title} ${badge} ${versionTag}`,
          hint: `${record.fileCount} file${record.fileCount > 1 ? 's' : ''} — ${record.description || record.name}`,
        };
      });

      const selectedId = await select({
        message: 'Select an installed package to remove:',
        options: itemOptions,
      });

      if (typeof selectedId !== 'string') {
        outro(pc.yellow('Removal cancelled.'));
        return;
      }

      selectedRecord = inventory.records.find(r => r.id === selectedId);
      if (selectedRecord) {
        identifier = selectedRecord.name;
      } else {
        identifier = selectedId;
      }
    }

    const s = spinner();
    s.start(`Removing "${identifier}"...`);

    try {
      const result = await uninstaller.uninstall(identifier, {
        scope: selectedRecord?.scope || (options.global ? 'global' : 'project'),
        global: options.global,
        target: selectedRecord ? [selectedRecord.host] : options.target,
        targetDir: selectedRecord?.targetDir,
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
  .command('update [identifier]', 'Update installed packages to upstream registry versions')
  .alias('upgrade')
  .option('-g, --global', 'Update global packages in home directory')
  .option('-t, --target <hosts>', 'Target agent host runtimes')
  .option('--fanout <hosts>', 'Also project the canonical .agents/ store into these runtimes during update (claude, cursor, cline, opencode, codex)')
  .option('-a, --all', 'Update all installed packages without prompting')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-f, --force', 'Force overwrite user modified files')
  .option('--start', 'Start the updated team in Cline immediately after update')
  .option('--dry-run', 'Simulate update without writing files')
  .action(async (targetIdentifier?: string, options: any = {}) => {
    intro(pc.cyan('Agents United — Package Update Engine'));

    // Parse --fanout like the add command: validated against the registry,
    // unknown/non-projection-capable ids are dropped with a warning.
    let updateFanout: string[] | undefined;
    if (options.fanout !== undefined) {
      const rawFanout: string[] = Array.isArray(options.fanout) ? options.fanout : String(options.fanout).split(',');
      const parsedFanout: string[] = rawFanout.map((h: string) => h.trim().toLowerCase()).filter(Boolean);
      const invalidFanout: string[] = parsedFanout.filter(h => !isKnownHost(h) || !HOST_REGISTRY[h].projectionCapable);
      if (invalidFanout.length > 0) {
        note(
          pc.yellow(
            `Ignoring invalid fanout host id(s): ${invalidFanout.join(', ')}. Valid ids: ${KNOWN_HOST_IDS.filter(h => HOST_REGISTRY[h].projectionCapable).join(', ')}`
          ),
          'Invalid fanout'
        );
      }
      updateFanout = parsedFanout.filter(h => isKnownHost(h) && HOST_REGISTRY[h].projectionCapable);
    }

    const s = spinner();
    s.start('Checking installed package inventory & upstream drift...');

    const report = await updater.checkUpdates({
      global: options.global,
      target: options.target,
    });

    s.stop('Inventory discovery complete');

    if (report.totalCount === 0) {
      outro(pc.yellow('No installed packages found in project or global configuration.'));
      return;
    }

    const isInteractive = process.stdout.isTTY && !options.yes && !options.all;
    let targetsToUpdate: string[] | '__all__' = [];

    if (targetIdentifier) {
      targetsToUpdate = [targetIdentifier];
    } else if (options.all || options.yes || !isInteractive) {
      targetsToUpdate = '__all__';
    } else {
      // Interactive Mode
      const locationLines: string[] = [];
      if (report.scannedLocations && report.scannedLocations.length > 0) {
        for (const loc of report.scannedLocations) {
          const scopeLabel = loc.scope === 'project' ? 'Project' : 'Global';
          const fanoutStr = loc.fanout.length > 0 ? ` ${pc.magenta(`(projections: ${loc.fanout.join(', ')})`)}` : '';
          locationLines.push(`  • ${scopeLabel} (${loc.displayLocation}): ${pc.bold(loc.packageCount)} package${loc.packageCount !== 1 ? 's' : ''}${fanoutStr}`);
        }
      } else {
        const projectCount = report.items.filter(i => i.record.scope === 'project').length;
        const globalCount = report.items.filter(i => i.record.scope === 'global').length;
        if (!options.global) {
          locationLines.push(`  • Project (./.agents): ${pc.bold(projectCount)} package${projectCount !== 1 ? 's' : ''}`);
        }
        locationLines.push(`  • Global (~/.agents): ${pc.bold(globalCount)} package${globalCount !== 1 ? 's' : ''}`);
      }

      const allDetectedFanouts = Array.from(new Set(report.items.flatMap(i => i.record.fanout || [])));
      const fanoutSummary = allDetectedFanouts.length > 0
        ? `\nActive Projections: ${allDetectedFanouts.map(h => `${pc.cyan(h)} (./.${h}/)`).join(', ')}`
        : '';

      const statusMessage =
        `Locations Checked:\n${locationLines.join('\n')}${fanoutSummary}\n\n` +
        `Total Installed Packages: ${report.totalCount}\n` +
        `Updates Available: ${report.outdatedCount > 0 ? pc.yellow(pc.bold(`${report.outdatedCount} package${report.outdatedCount > 1 ? 's' : ''} can be updated`)) : pc.green('0 (All up to date)')}`;

      note(statusMessage, 'Inventory Status');

      const menuOptions: Array<{ value: string; label: string; hint?: string }> = [];

      if (report.outdatedCount > 0) {
        menuOptions.push({
          value: '__all_outdated__',
          label: `⚡ Update All Outdated Packages (${report.outdatedCount} available)`,
          hint: 'batch upgrade all packages with newer upstream versions',
        });
      }

      menuOptions.push({
        value: '__selective__',
        label: '📦 Selectively Pick Packages to Update',
        hint: 'choose specific bundles or items from an interactive list',
      });

      menuOptions.push({
        value: '__resync_all__',
        label: `🔄 Re-sync / Repair All Packages (${report.totalCount})`,
        hint: 're-link or re-copy all packages to guarantee full integrity',
      });

      const action = await select({
        message: 'Select update action:',
        options: menuOptions,
      });

      if (typeof action !== 'string') {
        outro(pc.yellow('Update cancelled.'));
        return;
      }

      if (action === '__all_outdated__') {
        targetsToUpdate = report.items.filter(i => i.hasUpdate).map(i => i.record.name);
      } else if (action === '__resync_all__') {
        targetsToUpdate = '__all__';
      } else if (action === '__selective__') {
        const itemOptions = report.items.map(item => {
          const meta = BUNDLE_DISPLAY_NAMES[item.record.name];
          const title = meta?.title || item.record.title || item.record.name;
          const badge = pc.cyan(item.record.displayLocation);
          const versionDiff = item.hasUpdate
            ? pc.yellow(`(v${item.installedVersion} → v${item.upstreamVersion}) [UPDATE]`)
            : pc.dim(`(v${item.installedVersion}) [UP TO DATE]`);

          return {
            value: item.record.name,
            label: `📦 ${title} ${badge} ${versionDiff}`,
            hint: item.record.description || item.record.name,
          };
        });

        const initialValues = report.items.filter(i => i.hasUpdate).map(i => i.record.name);

        const selection = await multiselect({
          message: 'Select packages to update:',
          options: itemOptions,
          initialValues: initialValues.length > 0 ? initialValues : undefined,
          required: true,
        });

        if (!Array.isArray(selection) || selection.length === 0) {
          outro(pc.yellow('No packages selected for update.'));
          return;
        }

        targetsToUpdate = selection as string[];
      }
    }

    const updateSpinner = spinner();
    updateSpinner.start('Updating packages...');

    try {
      const result = await updater.update(targetsToUpdate, {
        global: options.global,
        target: options.target,
        force: options.force,
        dryRun: options.dryRun,
        fanout: updateFanout,
      });

      updateSpinner.stop('Update completed');

      if (options.dryRun) {
        outro(pc.yellow(`[DRY RUN] Would update ${result.updated.length} packages in ${result.targetDirs.join(', ')}`));
        if (result.projections && result.projections.length > 0) {
          note(renderProjections(result.projections), 'Projection Plan (dry run)');
        }
        return;
      }

      if (result.updated.length > 0) {
        // Plain-language sync tip for any updated bundle still living only in .agents/.
        const unprojected: string[] = [];
        for (const rec of result.updated) {
          try {
            const lf = await fs.readJson(path.join(rec.targetDir, 'agents-united.json'));
            if (!lf.fanout || lf.fanout.length === 0) unprojected.push(rec.name);
          } catch { /* ignore */ }
        }
        if (unprojected.length > 0) {
          note(
            pc.yellow(
              `Tip: not fully synced to other assistants yet (Antigravity reads .agents/ directly; Cline natively discovers .agents/skills/).\n` +
                `For Cline configured agents, rules & workflows: agents update ${unprojected[0]} --fanout cline`
            ),
            'One library, every assistant'
          );
        }
        const updatedList = result.updated
          .map(u => `  ✔ ${pc.bold(u.name)} ${pc.cyan(u.displayLocation)} ${pc.green(`(v${u.installedVersion})`)}`)
          .join('\n');
        note(updatedList, 'Updated Packages');

        if (result.projections && result.projections.length > 0) {
          note(renderProjections(result.projections), 'Updated Projections');
        }
      }


      if (result.skipped.length > 0) {
        const skippedList = result.skipped
          .map(s => `  ⚠ ${pc.yellow(s.record.name)}: ${s.reason}`)
          .join('\n');
        note(skippedList, 'Skipped Packages (User Modifications)');
      }

      if (result.updated.length === 0 && result.skipped.length === 0) {
        outro(pc.yellow('All packages are already up to date.'));
      } else {
        outro(pc.green(`✔ Successfully processed update for ${result.updated.length} package${result.updated.length > 1 ? 's' : ''}!`));
      }
    } catch (err: any) {
      updateSpinner.stop(pc.red('Update failed'));
      outro(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

function renderBundleDetailTree(bundle: BundleDefinition): string {
  // Special-case full universal suite for clean, structured high-level breakdown
  if (bundle.name === 'full') {
    const lines: string[] = [];
    lines.push(`📦 ${pc.bold(pc.green('full'))} ${pc.cyan('(Universal Autonomous Department)')} ${pc.green('⭐ [Recommended]')}`);
    lines.push(`│   ${pc.white('Complete suite with all 7 lead orchestrators, 38 subagents, and 160 modular skills (91 domain skills + 69 workflow playbooks).')}`);
    lines.push(`│`);
    lines.push(`├── 🤖 Lead Orchestrators (7 department domains):`);
    lines.push(`│   ├── 🛠️  ${pc.blue('orchestrator-engineering')} ${pc.dim('(Software Engineering & Delivery)')}`);
    lines.push(`│   ├── 🏛️  ${pc.blue('orchestrator-system-architecture')} ${pc.dim('(System Architecture & SRE)')}`);
    lines.push(`│   ├── 🎨  ${pc.blue('orchestrator-design')} ${pc.dim('(Product Design & UI/UX)')}`);
    lines.push(`│   ├── 📈  ${pc.blue('orchestrator-marketing')} ${pc.dim('(Growth & Marketing Operations)')}`);
    lines.push(`│   ├── 🔒  ${pc.blue('orchestrator-security')} ${pc.dim('(Security Operations)')}`);
    lines.push(`│   ├── 🔬  ${pc.blue('orchestrator-research')} ${pc.dim('(Deep Technical Research)')}`);
    lines.push(`│   └── 💼  ${pc.blue('orchestrator-business')} ${pc.dim('(Business Strategy & Economics)')}`);
    lines.push(`├── 🤖 Specialized Sub-Agents: ${pc.blue('38 worker agents across all 8 departments')}`);
    lines.push(`├── ⚡ Skills: ${pc.yellow('91 modular domain skills & runbooks')}`);
    lines.push(`├── 🔄 Workflows: ${pc.magenta('69 guided multi-step workflow playbooks')}`);
    lines.push(`├── 🔌 Prerequisites: ${pc.dim('None (Self-contained universal suite)')}`);
    lines.push(`└── 💡 Execution Modes: ${pc.green('Operational')}`);
    return lines.join('\n');
  }

  const meta = BUNDLE_DISPLAY_NAMES[bundle.name];
  const isEssentials = !bundle.parentBundle && bundle.name !== 'full' && bundle.name !== 'universal-skills' && bundle.name !== 'universal-orchestration' && bundle.tier !== 'organization';
  const titleSuffix = isEssentials ? pc.cyan(' (Essentials Base)') : '';
  const parentTag = bundle.parentBundle ? pc.gray(` [inherits: ${bundle.parentBundle}]`) : '';
  const aliasesTag = bundle.aliases && bundle.aliases.length > 0 ? pc.gray(` [alias: ${bundle.aliases.join(', ')}]`) : '';

  let statusBadge = '';
  if (bundle.name === 'universal-skills') statusBadge = pc.green(' ⭐ [Recommended]');
  else if (bundle.status === 'under-construction') statusBadge = pc.yellow(' 🚧 [Under Construction]');
  else if (bundle.status === 'needs-audit') statusBadge = pc.magenta(' ⚠️ [Needs Audit]');
  else if (bundle.status === 'experimental') statusBadge = pc.cyan(' [Experimental]');
  else if (bundle.status === 'deprecated') statusBadge = pc.red(' [Deprecated]');
  else statusBadge = pc.green(' [Stable]');

  const lines: string[] = [];
  lines.push(`📦 ${pc.bold(pc.green(bundle.name))}${titleSuffix}${statusBadge}${parentTag}${aliasesTag}`);
  lines.push(`│   ${pc.white(bundle.description || meta?.summary || '')}`);
  lines.push(`│`);

  // Lead / Orchestrator
  if (bundle.orchestrator) {
    const orchName = bundle.orchestrator.replace(/\.md$/, '');
    lines.push(`├── 🤖 Lead: ${pc.blue(pc.bold(orchName))}`);
  } else {
    lines.push(`├── 🤖 Lead: ${pc.dim('None (Self-directed meta-skills)')}`);
  }

  // Subagents
  if (bundle.agents && bundle.agents.length > 0) {
    const subNames = bundle.agents.map(a => a.replace(/^subagent-/, '').replace(/\.md$/, ''));
    lines.push(`├── 🤖 Sub-agents (${bundle.agents.length}):`);
    if (subNames.length <= 5) {
      subNames.forEach((name, sIdx) => {
        const isLastSub = sIdx === subNames.length - 1;
        const subBranch = isLastSub ? '└──' : '├──';
        lines.push(`│   ${subBranch} 🤖 ${pc.blue(name)}`);
      });
    } else {
      subNames.slice(0, 4).forEach(name => {
        lines.push(`│   ├── 🤖 ${pc.blue(name)}`);
      });
      lines.push(`│   └── 🤖 ${pc.dim(`(+${subNames.length - 4} more: ${subNames.slice(4).join(', ')})`)}`);
    }
  } else {
    lines.push(`├── 🤖 Sub-agents: ${pc.dim('None')}`);
  }

  // Partition skills into domain skills and workflow playbooks (ADR 0016)
  const domainSkills = (bundle.skills || []).filter(s => !s.startsWith('workflow-'));
  const workflowSkills = [
    ...(bundle.skills || []).filter(s => s.startsWith('workflow-')),
    ...(bundle.workflows || []),
  ];

  // Skills
  if (domainSkills.length > 0) {
    lines.push(`├── ⚡ Skills (${domainSkills.length}):`);
    if (domainSkills.length <= 5) {
      lines.push(`│   └── ${pc.yellow(domainSkills.join(', '))}`);
    } else {
      lines.push(`│   ├── ${pc.yellow(domainSkills.slice(0, 5).join(', '))}`);
      lines.push(`│   └── ${pc.dim(`(+${domainSkills.length - 5} more: ${domainSkills.slice(5).join(', ')})`)}`);
    }
  } else if (!bundle.parentBundle && workflowSkills.length === 0) {
    lines.push(`├── ⚡ Skills: ${pc.dim('None')}`);
  } else if (bundle.parentBundle && domainSkills.length === 0) {
    lines.push(`├── ⚡ Skills: ${pc.dim('Inherited from base bundle')}`);
  }

  // Workflows
  if (workflowSkills.length > 0) {
    const wfNames = workflowSkills.map(w => w.replace(/^workflow-/, '').replace(/\.md$/, ''));
    lines.push(`├── 🔄 Workflows (${workflowSkills.length}):`);
    if (wfNames.length <= 4) {
      lines.push(`│   └── ${pc.magenta(wfNames.join(', '))}`);
    } else {
      lines.push(`│   ├── ${pc.magenta(wfNames.slice(0, 4).join(', '))}`);
      lines.push(`│   └── ${pc.dim(`(+${wfNames.length - 4} more: ${wfNames.slice(4).join(', ')})`)}`);
    }
  } else if (bundle.parentBundle) {
    lines.push(`├── 🔄 Workflows: ${pc.dim('Inherited from base bundle')}`);
  }

  // Prerequisites
  if (bundle.prerequisites) {
    const prereqParts: string[] = [];
    if (bundle.prerequisites.requiredMcps && bundle.prerequisites.requiredMcps.length > 0) {
      prereqParts.push(`MCPs: ${bundle.prerequisites.requiredMcps.map(m => m.name).join(', ')}`);
    }
    if (bundle.prerequisites.requiredPackages && bundle.prerequisites.requiredPackages.length > 0) {
      prereqParts.push(`Packages: ${bundle.prerequisites.requiredPackages.join(', ')}`);
    }
    if (bundle.prerequisites.requiredEnvVars && bundle.prerequisites.requiredEnvVars.length > 0) {
      prereqParts.push(`Env: ${bundle.prerequisites.requiredEnvVars.join(', ')}`);
    }
    if (prereqParts.length > 0) {
      lines.push(`├── 🔌 Prerequisites: ${pc.yellow(prereqParts.join(' | '))}`);
    }
  } else {
    lines.push(`├── 🔌 Prerequisites: ${pc.dim('None (Self-contained domain bundle)')}`);
  }

  // Execution Modes
  if (bundle.modes) {
    lines.push(`└── 💡 Execution Modes: ${pc.green('Operational')} (live MCPs) / ${pc.cyan('Brainstorming')} (advisory fallback)`);
  } else {
    lines.push(`└── 💡 Execution Modes: ${pc.green('Operational')}`);
  }

  return lines.join('\n');
}

function renderFullCatalogTree(bundles: BundleDefinition[]): void {
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
    'universal',
    'engineering',
    'architecture',
    'design',
    'marketing',
    'security',
    'research',
    'business',
  ];

  const grouped: Record<string, typeof bundles> = {};
  const orgBundles: typeof bundles = [];

  for (const b of bundles) {
    if (b.tier === 'organization' || b.domain === 'organization') {
      orgBundles.push(b);
      continue;
    }
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
      const isEssentials = !b.parentBundle && b.name !== 'full' && b.name !== 'universal-skills' && b.name !== 'universal-orchestration';
      const titleSuffix = isEssentials ? pc.cyan(' (Essentials)') : '';
      const parentTag = b.parentBundle ? pc.gray(` [inherits: ${b.parentBundle}]`) : '';
      const aliasesTag = b.aliases && b.aliases.length > 0 ? pc.gray(` [alias: ${b.aliases.join(', ')}]`) : '';

      let statusBadge = '';
      if (b.name === 'universal-skills') statusBadge = pc.green(' ⭐ [Recommended]');
      else if (b.status === 'under-construction') statusBadge = pc.yellow(' 🚧 [Under Construction]');
      else if (b.status === 'needs-audit') statusBadge = pc.magenta(' ⚠️ [Needs Audit]');
      else if (b.status === 'experimental') statusBadge = pc.cyan(' [Experimental]');
      else if (b.status === 'deprecated') statusBadge = pc.red(' [Deprecated]');

      console.log(`${bBranch} 📦 ${pc.bold(pc.green(b.name))}${titleSuffix}${statusBadge}${parentTag}${aliasesTag}`);
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

      // Skills & Workflows (ADR 0016)
      const domainSkills = (b.skills || []).filter(s => !s.startsWith('workflow-'));
      const workflowSkills = [
        ...(b.skills || []).filter(s => s.startsWith('workflow-')),
        ...(b.workflows || []),
      ];

      // Skills
      if (domainSkills.length > 0) {
        const displaySkills =
          domainSkills.length > 3 ? `${domainSkills.slice(0, 3).join(', ')} (+${domainSkills.length - 3} more)` : domainSkills.join(', ');
        console.log(`${subIndent}├── ⚡ Skills: ${pc.yellow(displaySkills)}`);
      }

      // Workflows
      if (workflowSkills.length > 0) {
        const wfNames = workflowSkills.map(w => w.replace(/^workflow-/, '').replace(/\.md$/, ''));
        const displayWfs =
          wfNames.length > 3 ? `${wfNames.slice(0, 3).join(', ')} (+${wfNames.length - 3} more)` : wfNames.join(', ');
        console.log(`${subIndent}└── 🔄 Workflows: ${pc.magenta(displayWfs)}`);
      } else if (b.parentBundle) {
        console.log(`${subIndent}└── 🔄 Workflows: ${pc.dim('Inherited from parent')}`);
      }

      if (!isLastBundle) {
        console.log(`${subIndent}`);
      }
    });
  }

  // Dedicated Organization Bundles Section
  if (orgBundles.length > 0) {
    console.log(`\n${pc.bold(pc.cyan('🏢  Organization Bundles (Experimental / Cross-Functional)'))} ${pc.dim(`(${orgBundles.length} bundle${orgBundles.length > 1 ? 's' : ''})`)}`);
    console.log(pc.dim('   Cross-domain teams modeled after real organizations. Require runtime prerequisites (MCPs/packages).'));

    orgBundles.forEach((b: BundleDefinition, bIdx: number) => {
      const isLastBundle = bIdx === orgBundles.length - 1;
      const bBranch = isLastBundle ? '└──' : '├──';
      const subIndent = isLastBundle ? '    ' : '│   ';

      let statusBadge = '';
      if (b.status === 'under-construction') statusBadge = pc.yellow(' 🚧 [Under Construction (TBA)]');
      else if (b.status === 'needs-audit') statusBadge = pc.magenta(' ⚠️ [Needs Audit]');
      else if (b.status === 'experimental') statusBadge = pc.cyan(' [Experimental]');
      else if (b.status === 'deprecated') statusBadge = pc.red(' [Deprecated]');
      else statusBadge = pc.green(' [Stable]');

      const prereqBadge = pc.dim(' [Prerequisites Required]');

      console.log(`${bBranch} 🏢 ${pc.bold(pc.cyan(b.name))}${statusBadge}${prereqBadge}`);
      console.log(`${subIndent}│   ${pc.white(b.description)}`);

      if (b.orchestrator) {
        const orchName = b.orchestrator.replace(/\.md$/, '');
        console.log(`${subIndent}├── 🤖 Lead: ${pc.blue(orchName)}`);
      }

      if (b.agents && b.agents.length > 0) {
        const subNames = b.agents.map(a => a.replace(/^subagent-/, '').replace(/\.md$/, ''));
        const displaySubs =
          subNames.length > 3 ? `${subNames.slice(0, 3).join(', ')} (+${subNames.length - 3} more)` : subNames.join(', ');
        console.log(`${subIndent}├── 🤖 Sub-agents: ${pc.blue(displaySubs)}`);
      }

      // Skills & Workflows (ADR 0016)
      const orgDomainSkills = (b.skills || []).filter(s => !s.startsWith('workflow-'));
      const orgWorkflowSkills = [
        ...(b.skills || []).filter(s => s.startsWith('workflow-')),
        ...(b.workflows || []),
      ];

      if (orgDomainSkills.length > 0) {
        const displaySkills =
          orgDomainSkills.length > 3 ? `${orgDomainSkills.slice(0, 3).join(', ')} (+${orgDomainSkills.length - 3} more)` : orgDomainSkills.join(', ');
        console.log(`${subIndent}├── ⚡ Skills: ${pc.yellow(displaySkills)}`);
      }

      if (orgWorkflowSkills.length > 0) {
        const wfNames = orgWorkflowSkills.map(w => w.replace(/^workflow-/, '').replace(/\.md$/, ''));
        const displayWfs =
          wfNames.length > 3 ? `${wfNames.slice(0, 3).join(', ')} (+${wfNames.length - 3} more)` : wfNames.join(', ');
        console.log(`${subIndent}├── 🔄 Workflows: ${pc.magenta(displayWfs)}`);
      }

      // Prerequisites Summary
      if (b.prerequisites) {
        const prereqParts: string[] = [];
        if (b.prerequisites.requiredMcps && b.prerequisites.requiredMcps.length > 0) {
          prereqParts.push(`MCPs: ${b.prerequisites.requiredMcps.map(m => m.name).join(', ')}`);
        }
        if (b.prerequisites.requiredPackages && b.prerequisites.requiredPackages.length > 0) {
          prereqParts.push(`Packages: ${b.prerequisites.requiredPackages.join(', ')}`);
        }
        if (b.prerequisites.requiredEnvVars && b.prerequisites.requiredEnvVars.length > 0) {
          prereqParts.push(`Env: ${b.prerequisites.requiredEnvVars.join(', ')}`);
        }
        if (prereqParts.length > 0) {
          console.log(`${subIndent}├── 🔌 Prerequisites: ${pc.yellow(prereqParts.join(' | '))}`);
        }
      }

      // Modes Summary
      if (b.modes) {
        console.log(`${subIndent}└── 💡 Execution Modes: ${pc.green('Operational')} (live MCPs) / ${pc.cyan('Brainstorming')} (advisory fallback)`);
      } else {
        console.log(`${subIndent}└── 💡 Execution Modes: ${pc.green('Operational')}`);
      }

      if (!isLastBundle) {
        console.log(`${subIndent}`);
      }
    });
  }

  outro(pc.cyan('\nRun "agents add <bundle>" or select interactively to install.'));
}

async function handleBundleDetailView(bundle: BundleDefinition): Promise<'__back_bundle__' | '__back_dept__' | '__exit__'> {
  const treeOutput = renderBundleDetailTree(bundle);
  console.log(`\n${pc.bold(pc.cyan('┌── 📋 Bundle Detail: ' + pc.green(bundle.name) + ' ' + '─'.repeat(Math.max(2, 40 - bundle.name.length))))}`);
  console.log(treeOutput);
  console.log(`${pc.bold(pc.cyan('└' + '─'.repeat(60)))}\n`);

  const actionOptions = [
    {
      value: 'install',
      label: `🚀 Install "${bundle.name}" bundle`,
      hint: `run installer for ${bundle.name}`,
    },
    {
      value: 'back_bundle',
      label: `🔙 Back to ${bundle.domain || 'Department'} bundle list`,
      hint: 'explore other bundles in this category',
    },
    {
      value: 'back_dept',
      label: `🏛️ Back to Department selection`,
      hint: 'explore other departments',
    },
    {
      value: 'exit',
      label: `🚪 Exit explorer`,
      hint: 'return to shell',
    },
  ];

  const action = await select({
    message: `Action for ${pc.bold(pc.green(bundle.name))}:`,
    options: actionOptions,
  });

  if (action === 'install') {
    // 1. Under Construction Gate Evaluation
    if (bundle.status === 'under-construction') {
      note(
        `The bundle "${bundle.name}" is currently under active construction (status: under-construction).\n` +
        `Its orchestrators, workflows, and specialized skills are being authored and are not ready for production use.\n\n` +
        `Planned Capabilities:\n` +
        `• Lead Orchestrator with Firecrawl & GitHub MCP tool calling\n` +
        `• Full-stack web, design & SEO delivery workflows\n` +
        `• Dual Execution Modes (Operational / Brainstorming)`,
        '🚧 Under Construction Gate'
      );

      const underConstructionChoice = await select({
        message: pc.yellow(`"${bundle.name}" is currently under construction. How would you like to proceed?`),
        options: [
          {
            value: 'abort',
            label: '🛑 Abort installation (Recommended)',
            hint: 'return without modifying workspace files',
          },
          {
            value: 'allow',
            label: '⚠️  Install in-development draft anyway (--allow-under-construction)',
            hint: 'proceed with in-progress placeholder assets',
          },
        ],
      });

      if (underConstructionChoice === 'abort' || typeof underConstructionChoice !== 'string') {
        outro(pc.yellow(`Installation cancelled. "${bundle.name}" is under construction.`));
        return '__back_bundle__';
      }
    }

    // 2. Prerequisite Gate Evaluation
    let executionMode: ExecutionMode = 'operational';

    if (bundle.prerequisites || bundle.tier === 'organization') {
      const checker = new PrerequisiteChecker();
      const prereqEval = await checker.evaluate(bundle);

      if (prereqEval.hasPrerequisites) {
        const checkLines: string[] = [];
        for (const item of prereqEval.items) {
          const typeLabel = item.type === 'mcp' ? 'MCP' : item.type === 'env' ? 'Env' : 'Pkg';
          const icon = item.satisfied ? pc.green('✓') : pc.red('✗');
          const details = pc.dim(`(${item.details || ''})`);
          checkLines.push(`  ${icon} [${typeLabel}] ${pc.bold(item.name)}: ${item.satisfied ? pc.green('Detected') : pc.red('Missing')} ${details}`);
        }

        note(
          checkLines.join('\n'),
          `Prerequisite Evaluation: ${bundle.name} (${bundle.tier === 'organization' ? 'Organization Bundle' : 'Prerequisites Required'})`
        );

        if (!prereqEval.allSatisfied) {
          const gateChoice = await select({
            message: pc.yellow(`Prerequisites not fully satisfied for "${bundle.name}". How would you like to proceed?`),
            options: [
              {
                value: 'abort',
                label: '🛑 Abort and configure missing prerequisites (Recommended)',
                hint: 'exit and configure MCP servers, packages, or environment variables',
              },
              {
                value: 'brainstorming',
                label: '💡 Install in Brainstorming Mode (Advisory & Spec generation only)',
                hint: 'runs in idea/planning mode without requiring live MCP tool connections',
              },
              {
                value: 'force',
                label: '⚠️  Force install in Operational Mode anyway',
                hint: 'proceed despite missing prerequisites (may fail during runtime calls)',
              },
            ],
          });

          if (gateChoice === 'abort' || typeof gateChoice !== 'string') {
            outro(pc.yellow('Installation aborted. Please configure required MCPs and environment variables, then retry.'));
            return '__back_bundle__';
          }

          if (gateChoice === 'brainstorming') {
            executionMode = 'brainstorming';
            note(pc.cyan('Switched execution mode to "brainstorming" (idea/spec fallback mode).'), 'Mode Selected');
          } else if (gateChoice === 'force') {
            executionMode = 'operational';
            note(pc.yellow('Proceeding in "operational" mode with missing prerequisites.'), 'Warning');
          }
        }
      }
    }

    // 3. Workspace Host & Fan-out Configuration
    const detectedHosts = detectWorkspaceHosts();
    let installHosts: AgentHost[] = ['agents'];
    let installFanout: string[] = [];

    if (detectedHosts.length > 0) {
      const projectionHosts = detectedHosts.filter(h => HOST_REGISTRY[h].projectionCapable);
      installFanout = projectionHosts;
      installHosts = detectedHosts.filter(h => !HOST_REGISTRY[h].projectionCapable) as AgentHost[];
      if (!installHosts.includes('agents')) installHosts.unshift('agents');
    }

    const installSpinner = spinner();
    installSpinner.start(`Installing "${bundle.name}"...`);

    try {
      const result = await installer.install(bundle.name, {
        scope: 'project',
        hosts: installHosts,
        fanout: installFanout,
        mode: executionMode,
        method: 'symlink',
      });

      installSpinner.stop(pc.green(`✔ Successfully installed ${bundle.name}!`));
      note(
        formatInstallationSummary({
          bundleName: result.installed.targetBundle || bundle.name,
          scope: 'project',
          method: result.method,
          hosts: installHosts,
          agents: result.installed.agents,
          skills: result.installed.skills,
          targetDirs: result.targetDirs,
          projections: result.projections,
        }),
        'Installation Success'
      );
      if (result.projections.length > 0) {
        note(renderProjections(result.projections), 'Installed Projections');
      }
      if (result.projections.some(p => p.host === 'cline')) {
        note(
          pc.green(
            `Already active: any Cline session in this workspace now sees this bundle's\n` +
            `skills, subagent_* agent tools, rules & workflow commands (ADR 0013 native discovery).\n` +
            `Use "agents start ${bundle.name}" for a pre-seeded team session.`
          ),
          'Native Activation'
        );
      }
      outro(pc.green(`✨ Installation of "${bundle.name}" complete!`));
    } catch (err: any) {
      installSpinner.stop(pc.red('Installation failed'));
      outro(pc.red(`Error: ${err.message}`));
    }
    return '__exit__';
  } else if (action === 'back_dept') {
    return '__back_dept__';
  } else if (action === 'exit' || typeof action !== 'string') {
    return '__exit__';
  }

  return '__back_bundle__';
}

cli
  .command('list', 'List available bundles grouped by department domain')
  .alias('ls')
  .option('--json', 'Output bundles in JSON format')
  .option('--tree', 'Output full static catalog tree')
  .option('--all', 'Output full static catalog tree')
  .action(async (options: any = {}) => {
    const bundles = await registry.listBundles();

    if (options.json) {
      console.log(JSON.stringify(bundles, null, 2));
      return;
    }

    const isInteractive = process.stdout.isTTY && !options.tree && !options.all;

    if (!isInteractive) {
      renderFullCatalogTree(bundles);
      return;
    }

    // Interactive 2-Stage Catalog Explorer
    intro(pc.cyan('🌐 Agents United — Interactive Catalog Explorer'));

    const domainMeta: Record<string, { label: string; icon: string }> = {
      universal: { label: 'Universal Autonomous Department', icon: '🌐 ' },
      engineering: { label: 'Software Engineering & Delivery', icon: '🛠️ ' },
      architecture: { label: 'System Architecture & SRE', icon: '🏛️ ' },
      design: { label: 'Product Design & UI/UX', icon: '🎨 ' },
      marketing: { label: 'Growth & Marketing Operations', icon: '📈 ' },
      security: { label: 'Security Operations', icon: '🔒 ' },
      research: { label: 'Deep Technical Research', icon: '🔬 ' },
      business: { label: 'Business Strategy & Economics', icon: '💼 ' },
      organization: { label: 'Organization Bundles (Experimental / Cross-Functional)', icon: '🏢 ' },
    };

    let activeDomain: string | undefined;

    while (true) {
      // Stage 1: Department Domain Selection (if none selected)
      if (!activeDomain) {
        const domainOptions = Object.entries(domainMeta).map(([domainKey, meta]) => {
          const count = bundles.filter(b => (b.domain === domainKey || (domainKey === 'organization' && b.tier === 'organization'))).length;
          return {
            value: domainKey,
            label: `${meta.icon} ${meta.label}`,
            hint: domainKey === 'universal' ? 'meta-skills baseline + full suite' : domainKey === 'organization' ? 'cross-functional teams with prerequisites' : `${count} specialized bundle${count > 1 ? 's' : ''}`,
          };
        });

        domainOptions.push({
          value: '__search__',
          label: '🔍 Search by name / keyword...',
          hint: 'find bundles, agents, skills or workflows',
        });

        domainOptions.push({
          value: '__full_tree__',
          label: '🌳 View Full Static Catalog Tree',
          hint: `expand all ${bundles.length} bundles and ${new Set(bundles.map(b => b.domain).filter(Boolean)).size} departments at once`,
        });

        const selectedDomain = await select({
          message: 'Select Department Domain to explore:',
          options: domainOptions,
        });

        if (typeof selectedDomain !== 'string') {
          outro(pc.cyan('Catalog explorer closed.'));
          return;
        }

        if (selectedDomain === '__full_tree__') {
          renderFullCatalogTree(bundles);
          continue;
        }

        if (selectedDomain === '__search__') {
          const query = await text({
            message: 'Enter keyword to search:',
            placeholder: 'e.g. mobile, playwright, react, backend, seo',
          });

          if (typeof query !== 'string' || !query.trim()) {
            continue;
          }

          const results = await registry.find(query.trim());
          if (results.bundles.length === 0 && results.agents.length === 0 && results.skills.length === 0 && results.workflows.length === 0) {
            note(`No items found matching "${query.trim()}".`, 'Search Results');
            continue;
          }

          const searchOptions: Array<{ value: string; label: string; hint?: string }> = [
            ...results.bundles.map((b: BundleDefinition) => ({
              value: `bundle:${b.name}`,
              label: `📦 [Bundle] ${BUNDLE_DISPLAY_NAMES[b.name]?.title || b.name} (${b.name})`,
              hint: b.description,
            })),
            {
              value: '__back__',
              label: '🔙 Back to Department Selection',
              hint: '',
            },
          ];

          if (searchOptions.length === 1) {
            note(`Found related agents/skills for "${query}", but no top-level bundles. Try browsing by department.`, 'Search Results');
            continue;
          }

          const chosen = await select({
            message: `Search Results for "${query.trim()}":`,
            options: searchOptions,
          });

          if (typeof chosen === 'string' && chosen.startsWith('bundle:')) {
            const bundleName = chosen.replace(/^bundle:/, '');
            const b = await registry.getBundle(bundleName);
            if (b) {
              const action = await handleBundleDetailView(b);
              if (action === '__exit__') {
                outro(pc.cyan('Catalog explorer closed.'));
                return;
              }
            }
          }
          continue;
        }

        activeDomain = selectedDomain;
      }

      // Stage 2: Collapsed Bundle Selection within Active Domain
      const domainBundles = bundles.filter(b => b.domain === activeDomain || (activeDomain === 'organization' && b.tier === 'organization'));

      // Sort so Essentials/universal-skills are first
      const sortedBundles = [...domainBundles].sort((a, b) => {
        if (a.name === 'universal-orchestration') return -1;
        if (b.name === 'universal-orchestration') return 1;
        if (a.name === 'universal-skills') return -1;
        if (b.name === 'universal-skills') return 1;
        if (!a.parentBundle && b.parentBundle) return -1;
        if (a.parentBundle && !b.parentBundle) return 1;
        return a.name.localeCompare(b.name);
      });

      const bundleOptions: Array<{ value: string; label: string; hint?: string }> = sortedBundles.map((b, idx) => {
        const isLast = idx === sortedBundles.length - 1;
        const branch = sortedBundles.length > 1 ? (isLast ? '└── ' : '├── ') : '';
        const meta = BUNDLE_DISPLAY_NAMES[b.name];
        const isEssentials = !b.parentBundle && b.name !== 'full' && b.name !== 'universal-skills' && b.name !== 'universal-orchestration' && b.tier !== 'organization';
        const titleSuffix = isEssentials ? pc.cyan(' (Essentials Base)') : '';
        const parentTag = b.parentBundle ? pc.gray(` [inherits: ${b.parentBundle}]`) : '';

        let badge = '';
        if (b.name === 'universal-skills') badge = pc.green(' ⭐ [Recommended]');
        else if (b.status === 'under-construction') badge = pc.yellow(' 🚧 [Under Construction]');
        else if (b.status === 'needs-audit') badge = pc.magenta(' ⚠️ [Needs Audit]');
        else if (b.status === 'experimental') badge = pc.cyan(' [Experimental]');
        else if (b.status === 'deprecated') badge = pc.red(' [Deprecated]');

        return {
          value: b.name,
          label: `${branch}📦 ${meta?.title || b.name}${titleSuffix}${badge}${parentTag}`,
          hint: b.description || meta?.summary || b.name,
        };
      });

      bundleOptions.push({
        value: '__back_domain__',
        label: '🔙 Back to Department Selection',
        hint: 'choose another department domain',
      });

      const selectedBundleName = await select({
        message: `${domainMeta[activeDomain]?.label || activeDomain} — Select bundle to open:`,
        options: bundleOptions,
      });

      if (typeof selectedBundleName !== 'string') {
        outro(pc.cyan('Catalog explorer closed.'));
        return;
      }

      if (selectedBundleName === '__back_domain__') {
        activeDomain = undefined;
        continue;
      }

      const bundle = await registry.getBundle(selectedBundleName);
      if (!bundle) continue;

      // Stage 3: Render Open Tree View & Handle Action
      const action = await handleBundleDetailView(bundle);
      if (action === '__exit__') {
        outro(pc.cyan('Catalog explorer closed.'));
        return;
      }
      if (action === '__back_dept__') {
        activeDomain = undefined;
      }
      // If action === '__back_bundle__', stays in activeDomain loop
    }
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
      const initTargets = (Array.isArray(options.target) ? options.target : String(options.target || 'agents').split(','))
        .map((h: string) => h.trim().toLowerCase());
      const initPlan = planInstallTargets(initTargets);
      const result = await installer.install(options.bundle, {
        scope: 'project',
        symlink: options.symlink,
        copy: options.copy,
        hosts: initPlan.hosts,
        fanout: initPlan.fanout,
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
  .command('start <bundle> [prompt]', 'Start an installed bundle team in its host runtime (e.g. Cline, Claude Code)')
  .option('--host <host>', 'Host runtime (default: auto-detect from lockfile fanout)')
  .option('-g, --global', 'Select global installation')
  .option('--team <name>', 'Override generated team name')
  .option('--allow-addons', 'Pre-authorize recommended addon installations for this session')
  .option('--headless', 'Run non-interactively without interactive TUI')
  .option('--bg', 'Run the Claude Code session in the background (claude host only)')
  .option('--teams', 'Force the experimental agent-teams scaffold on (claude host only). Default: ON for organization-tier (Tier 2) bundles, OFF for domain-tier (Tier 1) bundles — pass --no-teams to opt out. Ephemeral env only, nothing persisted')
  .option('--plugin', 'Pass --plugin-dir with the bundle plugin root (claude host only)')
  .option('--dry-run', 'Print activation resolution and argv summary without launching')
  .action(async (bundle: string, prompt?: string, options: any = {}) => {
    intro(pc.cyan('Agents United — Runtime Activation'));

    const launcher = new ClineLauncher();
    const probe = new ClineCapabilityProbe();

    try {
      // ADR 0018 / Plan 016 (Step 6): an explicit --host wins; otherwise inherit the fanout recorded in
      // the lockfile for the resolved scope/workspace. Falling back to Cline when no claude signal exists
      // keeps the existing Cline UX byte-identical.
      const effectiveHost = await resolveStartHost(bundle, options);
      if (effectiveHost === 'claude') {
        await runClaudeStart(bundle, prompt, options);
        return;
      }
      if (effectiveHost === 'unsupported') {
        note(pc.yellow(`Host '${options.host}' has no activation launcher yet; falling back to the Cline lane.`), 'Host Runtime');
      }
      const resolution = await launcher.resolveInstallation(bundle, {
        global: options.global,
        cwd: process.cwd(),
      });

      const probeReport = await probe.probe();
      if (!probeReport.installed && !options.dryRun) {
        outro(pc.red(`Cline executable was not found on PATH or via CLINE_BIN_PATH. Please install Cline CLI or ensure it is accessible.`));
        process.exit(1);
      }

      const bundleDef = await registry.getBundle(bundle);
      // Plan 016 post-gate: Tier 2 (organization) is a *Claude-runtime* posture. Agent Teams is a Claude
      // Code feature behind CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, so this lane reports the tier instead of
      // half-applying it — nothing here changes argv, and the session keeps Cline's own strategy with the
      // projected specialist tools under `.cline/agents/`. `--teams` on this host is a no-op by design.
      const organizationTier = bundleDef?.tier === 'organization';
      const plan = launcher.planActivation({
        bundleName: bundle,
        workspace: resolution.workspace,
        scope: resolution.scope,
        report: probeReport,
        prompt,
        teamName: options.team,
        allowAddons: options.allowAddons,
        headless: options.headless,
        orchestrator: bundleDef?.orchestrator,
      });

      if (options.dryRun) {
        note(
          `Bundle: ${plan.bundleName}\n` +
          `Tier: ${bundleDef?.tier ?? 'not declared (Tier-1 domain default)'}\n` +
          `Agent teams: ${organizationTier ? 'not available on this host (claude-only runtime feature)' : 'no'}\n` +
          `Scope: ${plan.scope}\n` +
          `Workspace: ${plan.workspace}\n` +
          `Team Name: ${plan.teamName}\n` +
          `Strategy: ${plan.strategy}\n` +
          `Executable: ${plan.executable}\n` +
          `Argv: ${plan.argv.map(a => (a.includes(' ') || a.includes('\n') ? `"${a.replace(/\n/g, '\\n')}"` : a)).join(' ')}`,
          'Activation Plan (dry run)'
        );
        outro(pc.yellow('Dry run complete. No processes launched.'));
        return;
      }

      if (organizationTier) {
        note(
          pc.yellow(
            `"${bundle}" is an organization-tier (Tier 2) bundle. Agent Teams is a Claude Code runtime\n` +
            `feature and is not available on this host, so '--teams' is claude-only. This session runs\n` +
            `Cline's ${plan.strategy} strategy with the projected specialist tools under .cline/agents/.`
          ),
          'Tier 2 (organization)'
        );
      }

      note(
        `Team: ${pc.bold(plan.teamName)}\n` +
        `Strategy: ${pc.cyan(plan.strategy)}\n` +
        `Workspace: ${plan.workspace}`,
        'Starting Cline Team'
      );

      await launcher.launch(plan);
      outro(pc.green(`✔ Cline session finished.`));
    } catch (err: any) {
      outro(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

cli
  .command('doctor', 'Verify health of installed agents, frontmatter schemas, and hooks')
  .option('--host <host>', 'Audit specific host runtime (e.g. cline, claude)')
  .action(async (options: any = {}) => {
    intro(pc.cyan('🩺 Agents United — Health Doctor'));
    const report = await DoctorEngine.runDoctor(undefined, options.host);

    if (!report.isInitialized || (report.agentsCount === 0 && report.skillsCount === 0 && report.workflowsCount === 0 && report.issues.length === 0)) {
      console.log(`  ${pc.bold('📦 Status:')}   ${pc.yellow('No agents or bundles installed in this workspace.')}`);
      console.log(`  ${pc.bold('📍 Location:')} ${pc.dim(report.targetDir)}\n`);

      console.log(pc.bold(pc.cyan('💡 Get Started:')));
      console.log(`  👉 ${pc.bold('agents add')}                      Launch the interactive installation wizard`);
      console.log(`  👉 ${pc.bold('agents add software-engineering')} Install the engineering essentials team`);
      const bundleCount = (await registry.listBundles()).length;
      console.log(`  👉 ${pc.bold('agents list')}                     Browse all ${bundleCount} bundles by department\n`);

      if (report.clineCapability) {
        console.log(pc.bold(pc.cyan('Cline Runtime & Native Discovery Audit:')));
        console.log(`  Installed: ${report.clineCapability.installed ? pc.green('✔ Detected') : pc.yellow('✖ Not Found')}`);
        if (report.clineCapability.version) {
          console.log(`  Version: ${report.clineCapability.version}`);
        }
        console.log(`  Named Teams: ${report.clineCapability.namedTeams ? pc.green('✔ Supported') : pc.yellow('✖ Unsupported (Adaptive fallback)')}\n`);
      }

      if (report.claudeCapability) {
        console.log(pc.bold(pc.cyan('Claude Code Runtime & Native Discovery Audit:')));
        console.log(`  Installed: ${report.claudeCapability.installed ? pc.green('✔ Detected') : pc.yellow('✖ Not Found')}`);
        if (report.claudeCapability.version) {
          console.log(`  Version: ${report.claudeCapability.version}`);
        }
        console.log(`  Plugin Support (--plugin-dir): ${report.claudeCapability.pluginSupport ? pc.green('✔ Supported') : pc.yellow('✖ Unsupported')}`);
        console.log(`  Agent Teams (experimental): ${report.claudeCapability.agentTeamsExperimental ? pc.green('✔ Supported') : pc.yellow('✖ Unsupported')}`);
        console.log(`  Subagent hand-off (SubagentHandback): ${report.claudeCapability.subagentHandback ? pc.green('✔ Supported') : pc.yellow('✖ Needs v2.1.271+ (auto mode)')}`);
        for (const diagnostic of report.claudeCapability.diagnostics) {
          console.log(`  ${pc.dim(diagnostic)}`);
        }
        console.log();
      }

      if (report.warnings.length > 0) {
        console.log(pc.yellow(pc.bold('⚠️  Warnings:')));
        report.warnings.forEach(w => console.log(`  ⚠ ${w}`));
        console.log();
      }

      outro(pc.blue('✨ Workspace is ready for initialization.'));
      return;
    }

    console.log(`  🤖 Installed Agents:    ${pc.bold(report.agentsCount.toString())}`);
    console.log(`  ⚡ Installed Skills:    ${pc.bold(report.skillsCount.toString())}`);
    console.log(`  🔄 Installed Workflow Skills: ${pc.bold(report.workflowsCount.toString())}\n`);

    if (report.clineCapability) {
      console.log(pc.bold(pc.cyan('Cline Runtime & Native Discovery Audit:')));
      console.log(`  Installed: ${report.clineCapability.installed ? pc.green('✔ Detected') : pc.yellow('✖ Not Found')}`);
      if (report.clineCapability.version) {
        console.log(`  Version: ${report.clineCapability.version}`);
      }
      console.log(`  Named Teams: ${report.clineCapability.namedTeams ? pc.green('✔ Supported') : pc.yellow('✖ Unsupported (Adaptive fallback)')}`);
      console.log(`  Configured Agents: ${report.agentsCount} active natively in any Cline session ("agents start" = optional team-session launcher)\n`);
    }

    if (report.claudeCapability) {
      console.log(pc.bold(pc.cyan('Claude Code Runtime & Native Discovery Audit:')));
      console.log(`  Installed: ${report.claudeCapability.installed ? pc.green('✔ Detected') : pc.yellow('✖ Not Found')}`);
      if (report.claudeCapability.version) {
        console.log(`  Version: ${report.claudeCapability.version}`);
      }
      console.log(`  Plugin Support (--plugin-dir): ${report.claudeCapability.pluginSupport ? pc.green('✔ Supported') : pc.yellow('✖ Unsupported')}`);
      console.log(`  Agent Teams (experimental): ${report.claudeCapability.agentTeamsExperimental ? pc.green('✔ Supported') : pc.yellow('✖ Unsupported')}`);
      console.log(`  Subagent hand-off (SubagentHandback): ${report.claudeCapability.subagentHandback ? pc.green('✔ Supported') : pc.yellow('✖ Needs v2.1.271+ (auto mode)')}`);
      console.log(`  Configured Agents: ${report.agentsCount} projected into .claude/agents/ ("agents start --host claude" = optional launcher)\n`);
    }

    if (report.issues.length > 0) {
      console.log(pc.red(pc.bold('❌ Issues Found:')));
      report.issues.forEach(i => console.log(`  ✖ ${i}`));
      console.log();
    }

    if (report.warnings.length > 0) {
      console.log(pc.yellow(pc.bold('⚠️  Warnings:')));
      report.warnings.forEach(w => console.log(`  ⚠ ${w}`));
      console.log();
    }

    if (report.valid && report.issues.length === 0) {
      outro(pc.green('✔ All installed agents and frontmatter schemas are healthy!'));
    } else {
      outro(pc.red('✖ Doctor found issues in workspace configuration.'));
      process.exit(1);
    }
  });

/**
 * Plan 016 (Step 6) — resolve the activation host for `agents start`.
 *
 * - an explicit `--host` wins (`claude` selects the Claude lane, anything else falls back to Cline, which
 *   is the pre-Step-6 behaviour where `--host` was ignored entirely);
 * - otherwise the fanout recorded in the lockfile for the resolved scope/workspace is inherited, so an
 *   install projected to Claude activates the Claude lane and an install with no claude signal keeps the
 *   existing Cline UX unchanged.
 *
 * Detection is deliberately best-effort: any resolution error (bundle not installed, not projected) yields
 * no claude signal, and the selected lane then reports its own actionable error exactly as before.
 */
async function resolveStartHost(
  bundle: string,
  options: { host?: string; global?: boolean }
): Promise<'cline' | 'claude' | 'unsupported'> {
  const explicitHost = typeof options.host === 'string' ? options.host.trim().toLowerCase() : '';
  if (explicitHost === 'claude') {
    return 'claude';
  }
  if (explicitHost === 'cline') {
    return 'cline';
  }
  if (explicitHost.length > 0) {
    return 'unsupported';
  }

  let recordedFanout: string[] = [];
  try {
    const detection = await new ClaudeLauncher().resolveInstallation(bundle, {
      global: options.global,
      cwd: process.cwd(),
    });
    recordedFanout = detection.lockfile.fanout || [];
  } catch {
    recordedFanout = [];
  }
  return recordedFanout.includes('claude') ? 'claude' : 'cline';
}

/** Why the Agent-Teams scaffold is on or off for a Claude session. */
export type ClaudeTeamsReason = 'explicit' | 'tier-default' | 'opt-out' | 'domain-tier' | 'unresolved-tier';

export interface ClaudeTeamsPosture {
  /** Whether the ephemeral agent-teams scaffold will be injected into the spawned session. */
  active: boolean;
  reason: ClaudeTeamsReason;
  /** The resolved bundle tier that drove the decision, when the bundle could be resolved. */
  tier?: BundleTier;
}

/**
 * Tier-aware Agent-Teams posture for `agents start --host claude` (Plan 016 decision 14 + the Tier-1/Tier-2
 * split recorded in CONTEXT.md).
 *
 * - Tier 1 (`tier: 'domain'`) is a single-discipline hub-and-spoke team, so it keeps the ordinary
 *   parallel-subagent model: teams stay opt-in via `--teams`.
 * - Tier 2 (`tier: 'organization'`) is cross-functional by construction, so it runs with Agent Teams logic
 *   by default. `--no-teams` (cac parses it into `options.teams === false`) is the explicit opt-out and
 *   always wins over the tier default.
 *
 * Pure and exported so the `--dry-run` plan and the tests can assert the decision without spawning `claude`.
 */
export function resolveClaudeTeamsPosture(
  teamsOption: boolean | undefined,
  tier: BundleTier | undefined
): ClaudeTeamsPosture {
  if (teamsOption === true) return { active: true, reason: 'explicit', tier };
  if (teamsOption === false) return { active: false, reason: 'opt-out', tier };
  if (tier === 'organization') return { active: true, reason: 'tier-default', tier };
  if (tier === 'domain') return { active: false, reason: 'domain-tier', tier };
  return { active: false, reason: 'unresolved-tier' };
}

/** One-line, honest explanation of why teams is on or off — shared by the live notice and `--dry-run`. */
export function describeClaudeTeamsPosture(posture: ClaudeTeamsPosture): string {
  switch (posture.reason) {
    case 'explicit':
      return 'explicit --teams';
    case 'tier-default':
      return "default for tier 'organization'";
    case 'opt-out':
      return '--no-teams opt-out';
    case 'domain-tier':
      return "tier 'domain' — pass --teams to enable";
    case 'unresolved-tier':
      return 'no declared tier (Tier-1 domain default) — pass --teams to enable';
  }
}

/**
 * Plan 016 (Step 6) — the Claude Code lane for `agents start --host claude`.
 *
 * `--dry-run` prints the full plan (one argv element per line, plus the active flags and the env keys that
 * would be injected) and returns without spawning anything or writing anything to disk. A real session
 * spawns `claude` with `shell: false` and the ephemeral env merged over `process.env`; the teams opt-in is
 * never persisted (no settings.json write, nothing under `~/.claude/`).
 *
 * Teams posture is tier-derived (`resolveClaudeTeamsPosture`): an organization-tier (Tier 2) bundle enables
 * Agent Teams by default, a domain-tier (Tier 1) bundle only with an explicit `--teams`, and `--no-teams`
 * always wins over the tier default.
 */
async function runClaudeStart(bundle: string, prompt: string | undefined, options: any): Promise<void> {
  const launcher = new ClaudeLauncher();
  const probe = new ClaudeCapabilityProbe();

  const resolution = await launcher.resolveInstallation(bundle, {
    global: options.global,
    cwd: process.cwd(),
  });

  const probeReport = await probe.probe();
  if (!probeReport.installed && !options.dryRun) {
    outro(pc.red(`Claude Code executable was not found on PATH or via CLAUDE_BIN_PATH. Please install Claude Code or ensure it is accessible.`));
    process.exit(1);
  }

  const bundleDef = await registry.getBundle(bundle);
  // Tier-aware Agent-Teams posture: an organization-tier (Tier 2) bundle runs with Agent Teams logic by
  // default, a domain-tier (Tier 1) bundle keeps the ordinary parallel-subagent model unless `--teams`,
  // and an explicit `--no-teams` always wins (Plan 016 decision 14).
  const teamsPosture = resolveClaudeTeamsPosture(options.teams, bundleDef?.tier);
  const teamsActive = teamsPosture.active;
  // ADR 0018 decision 6 keeps ONE host-neutral team manifest under the organization package, which
  // the Cline half of the compound lane writes. A claude-only fanout has none, so the prompt must
  // not order the coordinator to read a path that does not exist.
  const manifestAvailable = await fs.pathExists(resolution.manifestPath);
  // `--plugin` points Claude at the bundle's plugin root. The path is workspace-relative because the session
  // is spawned with `cwd: workspace`; Step 7 emits the plugin manifest inside it.
  const pluginDir = options.plugin
    ? path.join('.agents', 'plugins', bundle).split(path.sep).join('/')
    : undefined;

  const plan = launcher.planActivation({
    bundleName: bundle,
    workspace: resolution.workspace,
    scope: resolution.scope,
    report: probeReport,
    prompt,
    orchestrator: bundleDef?.orchestrator,
    allowAddons: options.allowAddons,
    background: options.bg,
    teams: teamsActive,
    pluginDir,
    manifestAvailable,
  });

  const recordedFanout = resolution.lockfile.fanout || [];

  if (options.dryRun) {
    note(renderClaudeActivationPlan(plan, probeReport, recordedFanout, teamsPosture), 'Claude Activation Plan (dry run)');
    outro(pc.yellow('Dry run complete. No processes launched.'));
    return;
  }

  if (!recordedFanout.includes('claude')) {
    note(
      pc.yellow(
        `This workspace records fanout [${recordedFanout.join(', ') || 'none'}]. Run\n` +
        `'agents update ${bundle} --fanout claude' to project .claude/agents/ before the session needs it.`
      ),
      'Claude Projection'
    );
  }
  if (teamsActive && teamsPosture.reason === 'tier-default') {
    note(
      pc.yellow(
        `Agent Teams is ON by default for this organization-tier bundle (tier 'organization').\n` +
        `--no-teams falls back to ordinary parallel subagents.`
      ),
      'Agent Teams'
    );
  } else if (teamsActive) {
    note(pc.cyan('Agent Teams explicitly requested with --teams; the scaffold stays experimental.'), 'Agent Teams');
  }
  if (teamsActive && !probeReport.agentTeamsExperimental) {
    note(pc.yellow('The capability probe could not confirm agent-team support from --help; the scaffold stays experimental and unverified.'), 'Agent Teams');
  }
  if (pluginDir && !probeReport.pluginSupport) {
    note(pc.yellow('The capability probe could not confirm --plugin-dir support from --help.'), 'Plugin Dir');
  }

  note(
    `Host: ${pc.cyan('claude')}\n` +
    `Executable: ${plan.executable}\n` +
    `Workspace: ${plan.workspace}\n` +
    `Background: ${options.bg ? 'yes (--bg)' : 'no'}\n` +
    `Teams scaffold: ${teamsActive ? `yes (${describeClaudeTeamsPosture(teamsPosture)}; experimental, ephemeral env only)` : `no (${describeClaudeTeamsPosture(teamsPosture)})`}\n` +
    `Plugin dir: ${pluginDir || '(none)'}`,
    'Starting Claude Code Session'
  );

  // ADR 0018 decision 3: a main-thread `--agent` session is bounded by the projected coordinator
  // definition's `Agent(...)` allowlist, so that file must exist for the session to be meaningful.
  // `resolveInstallation` accepts either a recorded claude fanout OR the host-neutral manifest, and
  // the manifest is a Cline artifact — so a cline-only workspace can pass the gate. Fail loudly here
  // rather than spawning a session whose `--agent` target does not exist.
  const coordinatorRel = `.claude/agents/${ClaudeLauncher.resolveCoordinatorName(bundleDef?.orchestrator)}.md`;
  if (!await fs.pathExists(path.join(resolution.workspace, coordinatorRel))) {
    outro(
      pc.red(
        `Claude projection "${coordinatorRel}" was not found in ${resolution.workspace}.\n` +
        `Run 'agents update ${bundle} --fanout claude' before starting an --agent session.`
      )
    );
    process.exit(1);
  }


  await launcher.launch(plan);
  outro(pc.green(`✔ Claude Code session finished.`));
}

/** Render the `--dry-run` Claude plan: one argv element per line so each flag/value pair is unambiguous. */
function renderClaudeActivationPlan(
  plan: ClaudeActivationPlan,
  report: ClaudeCapabilityReport,
  recordedFanout: string[],
  posture: ClaudeTeamsPosture
): string {
  const envEntries = Object.keys(plan.env);
  const pluginFlagIndex = plan.argv.indexOf('--plugin-dir');
  const teamsActive = envEntries.includes('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS');
  return [
    `Bundle: ${plan.bundleName}`,
    `Host: claude`,
    `Bundle tier: ${posture.tier ?? "not declared (Tier-1 'domain' default)"}`,
    `Scope: ${plan.scope}`,
    `Workspace: ${plan.workspace}`,
    `Executable: ${plan.executable}`,
    `Background (--bg): ${plan.argv.includes('--bg') ? 'yes' : 'no'}`,
    teamsActive
      ? `Agent teams (--teams): yes (${describeClaudeTeamsPosture(posture)} — experimental; ephemeral env only, nothing persisted)`
      : `Agent teams (--teams): no (${describeClaudeTeamsPosture(posture)})`,
    `Plugin (--plugin-dir): ${pluginFlagIndex >= 0 ? plan.argv[pluginFlagIndex + 1] : '(none)'}`,
    `Env injected (merged over process.env): ${envEntries.length > 0 ? envEntries.map((k) => `${k}=${plan.env[k]}`).join(', ') : '(none)'}`,
    `Capability probe: installed=${report.installed ? `yes${report.version ? ` (${report.version})` : ''}` : 'no'}, --plugin-dir=${report.pluginSupport ? 'yes' : 'no'}, agent teams=${report.agentTeamsExperimental ? 'yes' : 'no'}, subagent handback=${report.subagentHandback ? 'yes' : 'no'}`,
    `Recorded fanout: [${recordedFanout.join(', ')}]`,
    `Argv (${plan.argv.length} elements, one element per line, spawned with shell: false):`,
    ...plan.argv.map((arg, index) => `  [${index}] ${arg.replace(/\r?\n/g, '\\n')}`),
  ].join('\n');
}

cli.help();
cli.version('1.0.0');

cli.parse();
